import { assertAuthMethod, handleAuthApiError, sendAuthJson, type AuthNodeResponseLike, type AuthRequestLike } from "../../_lib/auth-http.js";
import { resolveAuthenticatedPrincipal } from "../../_lib/auth-principal.js";
import { consumeSyncRateLimit } from "../../_lib/sync-rate-limit.js";
import { getAccountSyncService } from "../../_lib/sync-runtime.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["GET"]);
    const actor = await resolveAuthenticatedPrincipal(req);
    await consumeSyncRateLimit("read", actor.userId);
    return sendAuthJson(res, 200, await getAccountSyncService().snapshot(actor));
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
