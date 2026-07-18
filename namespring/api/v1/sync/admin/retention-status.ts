import {
  assertAuthMethod,
  assertTrustedMutationRequest,
  handleAuthApiError,
  sendAuthJson,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../../../_lib/auth-http.js";
import { requireAuthenticatedRole } from "../../../_lib/auth-principal.js";
import { readJsonBody } from "../../../_lib/http.js";
import {
  parseEmptySyncAdminRequestV1,
  SYNC_ADMIN_EMPTY_BODY_MAX_BYTES,
} from "../../../_lib/sync-http.js";
import { consumeSyncRateLimit } from "../../../_lib/sync-rate-limit.js";
import { getSyncRetentionStatusService } from "../../../_lib/sync-runtime.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const actor = await requireAuthenticatedRole(req, "admin");
    await consumeSyncRateLimit("adminStatusRead", actor.userId);
    const body = await readJsonBody<unknown>(req, { maxBytes: SYNC_ADMIN_EMPTY_BODY_MAX_BYTES });
    parseEmptySyncAdminRequestV1(body);
    return sendAuthJson(res, 200, await getSyncRetentionStatusService().readStatus());
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
