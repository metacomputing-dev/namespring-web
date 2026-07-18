import type { ContentMutationResponseV1 } from "../../../../shared/types/content-lifecycle.js";
import type { StageContentBatchRequestV1, StageContentBatchResponseV1 } from "../../../../shared/types/content-staging.js";
import { handleAuthApiError, sendAuthJson, type AuthNodeResponseLike, type AuthRequestLike } from "../../../_lib/auth-http.js";
import { prepareContentAdminRequestV1 } from "../../../_lib/content-http.js";
import { getContentLifecycleService } from "../../../_lib/content-runtime.js";
import { CONTENT_STAGING_BODY_MAX_BYTES, parseStageContentBatchRequest } from "../../../_lib/content-staging.js";
import { readJsonBody } from "../../../_lib/http.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    const actor = await prepareContentAdminRequestV1(req, "bulk");
    const request = parseStageContentBatchRequest(
      await readJsonBody<StageContentBatchRequestV1>(req, { maxBytes: CONTENT_STAGING_BODY_MAX_BYTES }),
    );
    const registered: ContentMutationResponseV1[] = [];
    if (request.mode === "register_drafts") {
      for (const [index, artifact] of request.artifacts.entries()) {
        registered.push(await getContentLifecycleService().register(actor, {
          ...artifact,
          requestId: `${request.requestId}:${index}`,
        }));
      }
    }
    const response: StageContentBatchResponseV1 = {
      mode: request.mode,
      validatedCount: request.artifacts.length,
      registered,
      invariant: "staging_never_auto_activates",
    };
    return sendAuthJson(res, request.mode === "register_drafts" ? 201 : 200, response);
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
