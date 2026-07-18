import type { RevokeSessionsRequest, RevokeSessionsResponse } from "../../shared/types/auth.js";
import {
  assertAuthMethod,
  assertExactAuthJsonObjectV1,
  assertTrustedMutationRequest,
  AUTH_REVOKE_BODY_MAX_BYTES_V1,
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
import { getFirebaseAuth, verifyFirebaseIdToken } from "../_lib/firebase-auth-admin.js";
import { revokeAllFirebaseSessions } from "../_lib/auth-lifecycle.js";
import { consumeAuthRateLimit } from "../_lib/auth-rate-limit.js";
import { ApiHttpError, readJsonBody } from "../_lib/http.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const current = await resolveAuthenticatedContext(req);
    await consumeAuthRateLimit("revoke", current.sessionId);
    const rawBody = await readJsonBody<unknown>(req, { maxBytes: AUTH_REVOKE_BODY_MAX_BYTES_V1 });
    assertExactAuthJsonObjectV1(rawBody, ["reauthIdToken"], "INVALID_REVOKE_REQUEST");
    const body = rawBody as unknown as RevokeSessionsRequest;
    if (typeof body?.reauthIdToken !== "string" || body.reauthIdToken.length < 20 || body.reauthIdToken.length > 16384) {
      throw new ApiHttpError(400, "INVALID_ID_TOKEN", "reauthIdToken is required.");
    }
    const auth = getFirebaseAuth();
    const decoded = await verifyFirebaseIdToken(body.reauthIdToken);
    assertRecentAuthentication(decoded, recentAuthenticationMaxAgeSeconds());
    if (decoded.uid !== current.firebaseUid) {
      throw new ApiHttpError(409, "FIREBASE_PRINCIPAL_MISMATCH", "Reauthentication must belong to the current principal.");
    }
    await revokeAllFirebaseSessions(auth, current.account.firebaseUids);
    const response: RevokeSessionsResponse = { revokedAt: new Date().toISOString() };
    return sendAuthJson(res, 200, response, [clearSessionCookie(), clearCsrfCookie()]);
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
