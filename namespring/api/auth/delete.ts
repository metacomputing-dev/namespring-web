import type { DeleteAccountRequest, DeleteAccountResponse } from "../../shared/types/auth.js";
import { getAuthAccountRepository } from "../_lib/auth-accounts-repository.js";
import {
  assertAuthMethod,
  assertExactAuthJsonObjectV1,
  assertTrustedMutationRequest,
  AUTH_DELETE_BODY_MAX_BYTES_V1,
  clearCsrfCookie,
  clearSessionCookie,
  handleAuthApiError,
  sendAuthJson,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../_lib/auth-http.js";
import { assertRecentAuthentication } from "../_lib/auth-identity.js";
import { recentAuthenticationMaxAgeSeconds } from "../_lib/auth-policy.js";
import { resolveAuthenticatedContext } from "../_lib/auth-principal.js";
import { verifyFirebaseIdToken } from "../_lib/firebase-auth-admin.js";
import { consumeAuthRateLimit } from "../_lib/auth-rate-limit.js";
import { ApiHttpError, readJsonBody } from "../_lib/http.js";
import {
  processAccountDeletionJobV1,
} from "../_lib/auth-maintenance.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const current = await resolveAuthenticatedContext(req);
    await consumeAuthRateLimit("delete", current.sessionId);
    const rawBody = await readJsonBody<unknown>(req, { maxBytes: AUTH_DELETE_BODY_MAX_BYTES_V1 });
    assertExactAuthJsonObjectV1(rawBody, ["reauthIdToken", "confirmation"], "INVALID_DELETE_REQUEST");
    const body = rawBody as unknown as DeleteAccountRequest;
    if (body?.confirmation !== "DELETE") {
      throw new ApiHttpError(400, "DELETE_CONFIRMATION_REQUIRED", "Explicit account deletion confirmation is required.");
    }
    if (typeof body.reauthIdToken !== "string" || body.reauthIdToken.length < 20 || body.reauthIdToken.length > 16384) {
      throw new ApiHttpError(400, "INVALID_ID_TOKEN", "reauthIdToken is required.");
    }
    const decoded = await verifyFirebaseIdToken(body.reauthIdToken);
    assertRecentAuthentication(decoded, recentAuthenticationMaxAgeSeconds());
    if (decoded.uid !== current.firebaseUid) {
      throw new ApiHttpError(409, "FIREBASE_PRINCIPAL_MISMATCH", "Reauthentication must belong to the current principal.");
    }

    // Create the cross-domain write fence and tombstone the account atomically.
    // Identity mappings remain only as resurrection blockers until every
    // Firebase, sync and premium cleanup succeeds.
    const repository = getAuthAccountRepository();
    const deletion = await repository.beginAccountDeletion(current.firebaseUid);
    const finalization = await processAccountDeletionJobV1({
      deletionRequestId: deletion.job.deletionRequestId,
      recordedByUserId: current.userId,
      force: true,
    });
    if (finalization.status === "deletion_pending") {
      const pending: DeleteAccountResponse = {
        status: "deletion_pending",
        deletionRequestId: deletion.job.deletionRequestId,
        cleanupPending: true,
        deletedAt: null,
      };
      return sendAuthJson(res, 202, pending, [clearSessionCookie(), clearCsrfCookie()]);
    }
    const deleted = finalization.account;
    const response: DeleteAccountResponse = {
      status: "deleted",
      deletionRequestId: deletion.job.deletionRequestId,
      cleanupPending: false,
      deletedAt: deleted.deletedAt,
    };
    return sendAuthJson(res, 200, response, [clearSessionCookie(), clearCsrfCookie()]);
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
