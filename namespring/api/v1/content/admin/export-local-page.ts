import type { LocalContentExportPageRequestV1 } from "../../../../shared/types/content-lifecycle.js";
import { handleAuthApiError, sendAuthJson, type AuthNodeResponseLike, type AuthRequestLike } from "../../../_lib/auth-http.js";
import { consumeContentAdminRateLimitV1, prepareContentAdminRequestV1 } from "../../../_lib/content-http.js";
import { getContentLifecycleService } from "../../../_lib/content-runtime.js";
import { parseLocalContentExportPageRequest } from "../../../_lib/content-validation.js";
import { readJsonBody } from "../../../_lib/http.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    const actor = await prepareContentAdminRequestV1(req, "export_page");
    const request = parseLocalContentExportPageRequest(await readJsonBody<LocalContentExportPageRequestV1>(req));
    await consumeContentAdminRateLimitV1(actor, "export_page", request.exportId);
    return sendAuthJson(res, 200, await getContentLifecycleService().getLocalExportPage(actor, request));
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
