import type { AuthProvider, UnlinkIdentityRequest, UnlinkIdentityResponse } from "../../shared/types/auth.js";
import { AUTH_PROVIDERS } from "../../shared/types/auth.js";
import { getAuthAccountRepository, toPublicProviderSummaries } from "../_lib/auth-accounts-repository.js";
import {
  assertAuthMethod,
  assertExactAuthJsonObjectV1,
  assertTrustedMutationRequest,
  AUTH_UNLINK_BODY_MAX_BYTES_V1,
  clearCsrfCookie,
  clearSessionCookie,
  handleAuthApiError,
  sendAuthJson,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../_lib/auth-http.js";
import { assertRecentAuthentication, extractProviderIdentity } from "../_lib/auth-identity.js";
import { processProviderUnlinkJobV1 } from "../_lib/auth-maintenance.js";
import { assertAuthProviderLifecycleReady, recentAuthenticationMaxAgeSeconds } from "../_lib/auth-policy.js";
import { resolveAuthenticatedContext } from "../_lib/auth-principal.js";
import { verifyFirebaseIdToken } from "../_lib/firebase-auth-admin.js";
import { consumeAuthRateLimit } from "../_lib/auth-rate-limit.js";
import { ApiHttpError, readJsonBody } from "../_lib/http.js";

function requireProvider(value: unknown): Exclude<AuthProvider, "anonymous"> {
  if (typeof value !== "string" || value === "anonymous" || !AUTH_PROVIDERS.includes(value as AuthProvider)) {
    throw new ApiHttpError(400, "INVALID_AUTH_PROVIDER", "A linked authentication provider is required.");
  }
  return value as Exclude<AuthProvider, "anonymous">;
}

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  let reservationStarted = false;
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const current = await resolveAuthenticatedContext(req);
    await consumeAuthRateLimit("unlink", current.sessionId);
    const rawBody = await readJsonBody<unknown>(req, { maxBytes: AUTH_UNLINK_BODY_MAX_BYTES_V1 });
    assertExactAuthJsonObjectV1(rawBody, ["reauthIdToken", "provider"], "INVALID_UNLINK_REQUEST");
    const body = rawBody as unknown as UnlinkIdentityRequest;
    if (typeof body?.reauthIdToken !== "string" || body.reauthIdToken.length < 20 || body.reauthIdToken.length > 16384) {
      throw new ApiHttpError(400, "INVALID_ID_TOKEN", "reauthIdToken is required.");
    }
    const provider = requireProvider(body?.provider);
    assertAuthProviderLifecycleReady(provider);
    const decoded = await verifyFirebaseIdToken(body.reauthIdToken);
    assertRecentAuthentication(decoded, recentAuthenticationMaxAgeSeconds());
    if (decoded.uid !== current.firebaseUid) {
      throw new ApiHttpError(409, "FIREBASE_PRINCIPAL_MISMATCH", "Reauthentication must belong to the current principal.");
    }
    const identity = extractProviderIdentity(decoded, provider);
    const repository = getAuthAccountRepository();
    const reservation = await repository.beginProviderUnlink({
      firebaseUid: current.firebaseUid,
      identity: {
        ...identity,
        provider,
      },
    });
    reservationStarted = true;
    const reconciliation = await processProviderUnlinkJobV1({
      unlinkRequestId: reservation.job.unlinkRequestId,
      recordedByUserId: current.userId,
      force: true,
    });
    const account = reconciliation.account ?? reservation.account;
    const response: UnlinkIdentityResponse = {
      accountStatus: account.status,
      unlinkRequestId: reservation.job.unlinkRequestId,
      unlinkStatus: reconciliation.status,
      cleanupPending: reconciliation.status === "pending",
      providers: toPublicProviderSummaries(account),
    };
    return sendAuthJson(
      res,
      reconciliation.status === "completed" ? 200 : 202,
      response,
      [clearSessionCookie(), clearCsrfCookie()],
    );
  } catch (error) {
    return handleAuthApiError(res, error, reservationStarted);
  }
}
