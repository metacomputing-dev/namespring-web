import { createHash } from "node:crypto";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { AuthAccountRecord } from "./auth-accounts-repository.js";
import {
  BROWSER_VISIBLE_ACCOUNT_ROLES,
  type BrowserVisibleAccountRole,
} from "../../shared/types/auth.js";
import { getAuthAccountRepository } from "./auth-accounts-repository.js";
import { getCookieValue, SESSION_COOKIE_NAME, type AuthRequestLike } from "./auth-http.js";
import { tokenHasRole } from "./auth-identity.js";
import { hasPrimarySignInProvider } from "./auth-policy.js";
import { getFirebaseAuth } from "./firebase-auth-admin.js";
import { ApiHttpError } from "./http.js";

export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  roles: readonly string[];
}

export interface AuthenticatedContext extends AuthenticatedPrincipal {
  firebaseUid: string;
  decodedToken: DecodedIdToken;
  account: AuthAccountRecord;
}

function sessionIdFor(cookieValue: string): string {
  return `sess_${createHash("sha256").update(cookieValue, "utf8").digest("hex").slice(0, 32)}`;
}

export function effectiveAccountRoles(account: AuthAccountRecord, token: DecodedIdToken): readonly string[] {
  // User access comes from the repository binding. Privileged roles require
  // both the persisted role and a current Firebase custom claim.
  return account.roles.filter((role) => role === "user" || tokenHasRole(token, role));
}

/** Browser menu hints are narrower than trusted internal actor roles. */
export function toBrowserVisibleAccountRoles(
  roles: readonly string[],
): readonly BrowserVisibleAccountRole[] {
  return BROWSER_VISIBLE_ACCOUNT_ROLES.filter((role) => roles.includes(role));
}

export async function resolveAuthenticatedContext(req: Pick<AuthRequestLike, "headers">): Promise<AuthenticatedContext> {
  const sessionCookie = getCookieValue(req, SESSION_COOKIE_NAME);
  if (!sessionCookie || sessionCookie.length > 8192) {
    throw new ApiHttpError(401, "AUTHENTICATION_REQUIRED", "A valid server session is required.");
  }

  const auth = getFirebaseAuth();
  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await auth.verifySessionCookie(sessionCookie, true);
  } catch {
    throw new ApiHttpError(401, "SESSION_INVALID", "The server session is invalid or revoked.");
  }

  const account = await getAuthAccountRepository().getActiveByFirebaseUid(decodedToken.uid);
  if (!account) {
    throw new ApiHttpError(401, "ACCOUNT_NOT_FOUND", "No active account is bound to this session.");
  }

  return {
    userId: account.internalUserId,
    sessionId: sessionIdFor(sessionCookie),
    roles: effectiveAccountRoles(account, decodedToken),
    firebaseUid: decodedToken.uid,
    decodedToken,
    account,
  };
}

/** Trusted actor resolver for paid, sync, and administrative server routes. */
export async function resolveAuthenticatedPrincipal(
  req: Pick<AuthRequestLike, "headers">,
): Promise<AuthenticatedPrincipal> {
  const { userId, sessionId, roles, account } = await resolveAuthenticatedContext(req);
  if (!hasPrimarySignInProvider(account.providers)) {
    throw new ApiHttpError(
      409,
      "ACCOUNT_UPGRADE_REQUIRED",
      "Link Google, Kakao, or email link before synchronization or payment.",
    );
  }
  return { userId, sessionId, roles };
}

export async function requireAuthenticatedRole(
  req: Pick<AuthRequestLike, "headers">,
  role: string,
): Promise<AuthenticatedPrincipal> {
  const principal = await resolveAuthenticatedPrincipal(req);
  if (!principal.roles.includes(role)) {
    throw new ApiHttpError(403, "ROLE_REQUIRED", `The ${role} role is required.`);
  }
  return principal;
}
