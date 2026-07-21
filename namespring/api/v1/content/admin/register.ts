import type { RegisterContentArtifactRequestV1 } from "../../../../shared/types/content-lifecycle.js";
import { handleAuthApiError, sendAuthJson, type AuthNodeResponseLike, type AuthRequestLike } from "../../../_lib/auth-http.js";
import { prepareContentAdminRequestV1 } from "../../../_lib/content-http.js";
import { getContentLifecycleService } from "../../../_lib/content-runtime.js";
import { CONTENT_REGISTER_BODY_MAX_BYTES, parseRegisterContentArtifactRequest } from "../../../_lib/content-validation.js";
import { readJsonBody } from "../../../_lib/http.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    const actor = await prepareContentAdminRequestV1(req, "bulk");
    const request = parseRegisterContentArtifactRequest(
      await readJsonBody<RegisterContentArtifactRequestV1>(req, { maxBytes: CONTENT_REGISTER_BODY_MAX_BYTES }),
    );
    return sendAuthJson(res, 201, await getContentLifecycleService().register(actor, request));
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
