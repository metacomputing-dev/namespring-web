import type { CurrentSessionResponse } from "../../shared/types/auth.js";
import { toPublicProviderSummaries } from "../_lib/auth-accounts-repository.js";
import {
  assertAuthMethod,
  clearSessionCookie,
  getCookieValue,
  handleAuthApiError,
  sendAuthJson,
  SESSION_COOKIE_NAME,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../_lib/auth-http.js";
import { resolveAuthenticatedContext, toBrowserVisibleAccountRoles } from "../_lib/auth-principal.js";

const ANONYMOUS_RESPONSE: CurrentSessionResponse = {
  authenticated: false,
  freeLocalAvailable: true,
  accountRequiredFor: ["sync", "payment"],
};

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["GET"]);
    if (!getCookieValue(req, SESSION_COOKIE_NAME)) {
      return sendAuthJson(res, 200, ANONYMOUS_RESPONSE);
    }
    const context = await resolveAuthenticatedContext(req);
    const response: CurrentSessionResponse = {
      authenticated: true,
      status: "active",
      roles: toBrowserVisibleAccountRoles(context.roles),
      providers: toPublicProviderSummaries(context.account),
    };
    return sendAuthJson(res, 200, response);
  } catch (error) {
    // Stale/revoked cookies are cleared; the free local application remains usable.
    if ((error as { statusCode?: number })?.statusCode === 401) {
      return sendAuthJson(res, 200, ANONYMOUS_RESPONSE, [clearSessionCookie()]);
    }
    return handleAuthApiError(res, error);
  }
}
