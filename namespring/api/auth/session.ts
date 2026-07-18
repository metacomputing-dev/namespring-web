import type {
  AccountUpgradeIntent,
  CreateSessionRequest,
  CreateSessionResponse,
} from "../../shared/types/auth.js";
import { ACCOUNT_UPGRADE_INTENTS } from "../../shared/types/auth.js";
import { getAuthAccountRepository, toPublicProviderSummaries } from "../_lib/auth-accounts-repository.js";
import {
  assertAuthMethod,
  assertExactAuthJsonObjectV1,
  assertTrustedMutationRequest,
  AUTH_SESSION_BODY_MAX_BYTES_V1,
  createSessionCookie,
  handleAuthApiError,
  issueCsrfToken,
  sendAuthJson,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../_lib/auth-http.js";
import { toBrowserVisibleAccountRoles } from "../_lib/auth-principal.js";
import { extractProviderIdentity, assertRecentAuthentication, tokenHasRole } from "../_lib/auth-identity.js";
import {
  assertAuthProviderEnabled,
  assertAnonymousBridgeIntent,
  assertPublicSessionProvider,
  csrfDurationSeconds,
  recentAuthenticationMaxAgeSeconds,
  sessionDurationSeconds,
} from "../_lib/auth-policy.js";
import { getFirebaseAuth, verifyFirebaseIdToken } from "../_lib/firebase-auth-admin.js";
import {
  consumeAuthRateLimit,
  consumeAuthSessionPreflightRateLimitV1,
} from "../_lib/auth-rate-limit.js";
import { ApiHttpError, readJsonBody } from "../_lib/http.js";

function requireIntent(value: unknown): AccountUpgradeIntent {
  if (typeof value !== "string" || !ACCOUNT_UPGRADE_INTENTS.includes(value as AccountUpgradeIntent)) {
    throw new ApiHttpError(400, "INVALID_UPGRADE_INTENT", "A valid account upgrade intent is required.");
  }
  return value as AccountUpgradeIntent;
}

function requireIdToken(value: unknown): string {
  if (typeof value !== "string" || value.length < 20 || value.length > 16384) {
    throw new ApiHttpError(400, "INVALID_ID_TOKEN", "A valid Firebase ID token is required.");
  }
  return value;
}

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    await consumeAuthSessionPreflightRateLimitV1(req);
    const rawBody = await readJsonBody<unknown>(req, { maxBytes: AUTH_SESSION_BODY_MAX_BYTES_V1 });
    assertExactAuthJsonObjectV1(rawBody, ["idToken", "intent"], "INVALID_SESSION_REQUEST");
    const body = rawBody as unknown as CreateSessionRequest;
    const idToken = requireIdToken(body?.idToken);
    const intent = requireIntent(body?.intent);
    const auth = getFirebaseAuth();
    const decoded = await verifyFirebaseIdToken(idToken);
    assertRecentAuthentication(decoded, recentAuthenticationMaxAgeSeconds());
    const identity = extractProviderIdentity(decoded);
    assertAuthProviderEnabled(identity.provider);
    assertPublicSessionProvider(identity.provider);
    await consumeAuthRateLimit("session", decoded.uid);

    if (identity.provider === "anonymous") assertAnonymousBridgeIntent(intent);

    const ensured = await getAuthAccountRepository().ensureAccount({
      firebaseUid: decoded.uid,
      identity,
      allowAnonymousUpgrade: identity.provider !== "anonymous",
    });
    const durationSeconds = sessionDurationSeconds();
    const firebaseSession = await auth.createSessionCookie(idToken, { expiresIn: durationSeconds * 1000 });
    const csrf = issueCsrfToken(csrfDurationSeconds());
    const roles = toBrowserVisibleAccountRoles(
      ensured.account.roles.filter((role) => role === "user" || tokenHasRole(decoded, role)),
    );
    const response: CreateSessionResponse = {
      session: {
        authenticated: true,
        status: "active",
        roles,
        providers: toPublicProviderSummaries(ensured.account),
        ...(ensured.recoveredExistingAccount ? { recoveredExistingAccount: true } : {}),
      },
      csrfToken: csrf.response.csrfToken,
      csrfExpiresAt: csrf.response.expiresAt,
    };

    return sendAuthJson(res, 200, response, [createSessionCookie(firebaseSession, durationSeconds), csrf.cookie]);
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
