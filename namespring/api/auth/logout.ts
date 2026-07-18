import type { LogoutResponse } from "../../shared/types/auth.js";
import {
  assertAuthMethod,
  assertTrustedMutationRequest,
  clearCsrfCookie,
  clearSessionCookie,
  handleAuthApiError,
  sendAuthJson,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../_lib/auth-http.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const response: LogoutResponse = { authenticated: false };
    return sendAuthJson(res, 200, response, [clearSessionCookie(), clearCsrfCookie()]);
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
