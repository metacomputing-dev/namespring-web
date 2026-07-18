import { getAuthAccountRepository } from "../_lib/auth-accounts-repository.js";
import {
  assertAuthMethod,
  handleAuthApiError,
  sendAuthJson,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../_lib/auth-http.js";
import { createAccountPortableExportManifestV1 } from "../_lib/auth-portable-export.js";
import { resolveAuthenticatedContext } from "../_lib/auth-principal.js";
import { consumeAuthRateLimit } from "../_lib/auth-rate-limit.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["GET"]);
    const current = await resolveAuthenticatedContext(req);
    await consumeAuthRateLimit("export", current.sessionId);
    const auth = await getAuthAccountRepository().exportAccount(current.firebaseUid);
    return sendAuthJson(res, 200, createAccountPortableExportManifestV1(auth));
  } catch (error) {
    return handleAuthApiError(res, error, (error as { statusCode?: number })?.statusCode === 401);
  }
}
