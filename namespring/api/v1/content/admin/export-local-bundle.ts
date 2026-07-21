import { handleAuthApiError, sendAuthJson, type AuthNodeResponseLike, type AuthRequestLike } from "../../../_lib/auth-http.js";
import { prepareContentAdminRequestV1 } from "../../../_lib/content-http.js";
import { getContentLifecycleService } from "../../../_lib/content-runtime.js";
import {
  CONTENT_ADMIN_EMPTY_BODY_MAX_BYTES,
  parseEmptyContentAdminRequest,
} from "../../../_lib/content-validation.js";
import { readJsonBody } from "../../../_lib/http.js";

/** Deprecated alias: creates a bounded export session, never an all-payload response. */
export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    const actor = await prepareContentAdminRequestV1(req, "export_start");
    parseEmptyContentAdminRequest(await readJsonBody(req, { maxBytes: CONTENT_ADMIN_EMPTY_BODY_MAX_BYTES }));
    return sendAuthJson(res, 201, await getContentLifecycleService().createLocalExportSession(actor));
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
