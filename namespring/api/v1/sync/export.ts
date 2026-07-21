import { assertAuthMethod, assertTrustedMutationRequest, handleAuthApiError, sendAuthJson, type AuthNodeResponseLike, type AuthRequestLike } from "../../_lib/auth-http.js";
import { resolveAuthenticatedPrincipal } from "../../_lib/auth-principal.js";
import { readJsonBody } from "../../_lib/http.js";
import { parseEmptySyncRequestV1, SYNC_EMPTY_BODY_MAX_BYTES_V1 } from "../../_lib/sync-http.js";
import { consumeSyncRateLimit } from "../../_lib/sync-rate-limit.js";
import { getAccountSyncService } from "../../_lib/sync-runtime.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const actor = await resolveAuthenticatedPrincipal(req);
    await consumeSyncRateLimit("read", actor.userId);
    parseEmptySyncRequestV1(await readJsonBody(req, { maxBytes: SYNC_EMPTY_BODY_MAX_BYTES_V1 }));
    return sendAuthJson(res, 200, await getAccountSyncService().exportData(actor));
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
