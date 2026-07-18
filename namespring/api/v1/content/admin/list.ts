import type { ListContentArtifactsRequestV1 } from "../../../../shared/types/content-lifecycle.js";
import { handleAuthApiError, sendAuthJson, type AuthNodeResponseLike, type AuthRequestLike } from "../../../_lib/auth-http.js";
import { prepareContentAdminRequestV1 } from "../../../_lib/content-http.js";
import { getContentLifecycleService } from "../../../_lib/content-runtime.js";
import { parseListContentArtifactsRequest } from "../../../_lib/content-validation.js";
import { readJsonBody } from "../../../_lib/http.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    await prepareContentAdminRequestV1(req, "read");
    const request = parseListContentArtifactsRequest(await readJsonBody<ListContentArtifactsRequestV1>(req));
    return sendAuthJson(res, 200, await getContentLifecycleService().listArtifactsForAdmin(request));
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
