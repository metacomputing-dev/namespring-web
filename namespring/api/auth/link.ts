import type { AuthProvider, LinkIdentityRequest, AccountMutationResponse } from "../../shared/types/auth.js";
import { AUTH_PROVIDERS } from "../../shared/types/auth.js";
import { getAuthAccountRepository, toPublicProviderSummaries } from "../_lib/auth-accounts-repository.js";
import {
  assertAuthMethod,
  assertExactAuthJsonObjectV1,
  assertTrustedMutationRequest,
  AUTH_LINK_BODY_MAX_BYTES_V1,
  createSessionCookie,
  handleAuthApiError,
  sendAuthJson,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../_lib/auth-http.js";
import { assertRecentAuthentication, extractProviderIdentity } from "../_lib/auth-identity.js";
import { assertAuthProviderEnabled, recentAuthenticationMaxAgeSeconds, sessionDurationSeconds } from "../_lib/auth-policy.js";
import { resolveAuthenticatedContext } from "../_lib/auth-principal.js";
import { getFirebaseAuth, verifyFirebaseIdToken } from "../_lib/firebase-auth-admin.js";
import { consumeAuthRateLimit } from "../_lib/auth-rate-limit.js";
import { ApiHttpError, readJsonBody } from "../_lib/http.js";

function token(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length < 20 || value.length > 16384) {
    throw new ApiHttpError(400, "INVALID_ID_TOKEN", `${field} must be a valid Firebase ID token.`);
  }
  return value;
}

function provider(value: unknown): Exclude<AuthProvider, "anonymous"> {
  if (typeof value !== "string" || value === "anonymous" || !AUTH_PROVIDERS.includes(value as AuthProvider)) {
    throw new ApiHttpError(400, "INVALID_AUTH_PROVIDER", "A linkable authentication provider is required.");
  }
  return value as Exclude<AuthProvider, "anonymous">;
}

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const current = await resolveAuthenticatedContext(req);
    await consumeAuthRateLimit("link", current.sessionId);
    const rawBody = await readJsonBody<unknown>(req, { maxBytes: AUTH_LINK_BODY_MAX_BYTES_V1 });
    assertExactAuthJsonObjectV1(rawBody, ["reauthIdToken", "linkedIdToken", "provider"], "INVALID_LINK_REQUEST");
    const body = rawBody as unknown as LinkIdentityRequest;
    const reauthToken = token(body?.reauthIdToken, "reauthIdToken");
    const linkedToken = token(body?.linkedIdToken, "linkedIdToken");
    const requestedProvider = provider(body?.provider);
    assertAuthProviderEnabled(requestedProvider);
    const auth = getFirebaseAuth();
    const [reauth, linked] = await Promise.all([
      verifyFirebaseIdToken(reauthToken),
      verifyFirebaseIdToken(linkedToken),
    ]);
    assertRecentAuthentication(reauth, recentAuthenticationMaxAgeSeconds());
    assertRecentAuthentication(linked, recentAuthenticationMaxAgeSeconds());
    if (reauth.uid !== current.firebaseUid || linked.uid !== current.firebaseUid) {
      throw new ApiHttpError(409, "FIREBASE_PRINCIPAL_MISMATCH", "Linked credentials must belong to the current Firebase principal.");
    }
    const identity = extractProviderIdentity(linked, requestedProvider);
    const account = await getAuthAccountRepository().linkIdentity(current.firebaseUid, identity);
    const duration = sessionDurationSeconds();
    const refreshedCookie = await auth.createSessionCookie(linkedToken, { expiresIn: duration * 1000 });
    const response: AccountMutationResponse = {
      status: account.status,
      providers: toPublicProviderSummaries(account),
    };
    return sendAuthJson(res, 200, response, [createSessionCookie(refreshedCookie, duration)]);
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
