import type { CsrfTokenResponse } from "../../shared/types/auth.js";
import {
  assertAuthMethod,
  handleAuthApiError,
  issueCsrfToken,
  sendAuthJson,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../_lib/auth-http.js";
import { csrfDurationSeconds } from "../_lib/auth-policy.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["GET"]);
    const issued = issueCsrfToken(csrfDurationSeconds());
    const response: CsrfTokenResponse = issued.response;
    return sendAuthJson(res, 200, response, [issued.cookie]);
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
