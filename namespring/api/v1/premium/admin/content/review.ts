import type { PremiumContentArtifactRecordV1 } from "../../../../../shared/types/premium-service.js";
import { sendJson, type NodeStyleResponseLike } from "../../../../_lib/http.js";
import {
  assertPlainBody,
  handlePremiumApiErrorV1,
  preparePremiumAdminMutationV1,
  readPremiumJsonBodyV1,
  type PremiumRequestLike,
} from "../../../../_lib/premium-http.js";
import {
  assertPremiumReviewNotesDigestV1,
  assertPremiumReviewRequestIdV1,
} from "../../../../_lib/premium-review-contract.js";
import { PremiumServiceV1 } from "../../../../_lib/premium-service.js";

export function createPremiumContentReviewHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      const actor = await preparePremiumAdminMutationV1(req, ["premium_admin"], {
        scope: "premium.admin.content.review",
        limit: 30,
        windowSeconds: 300,
      });
      const body = await readPremiumJsonBodyV1<Record<string, unknown>>(req, 512 * 1024);
      assertPlainBody(body, ["reviewRequestId", "notesDigest", "artifact"]);
      return sendJson(res, 200, await service.reviewContentArtifact(
        actor,
        assertPremiumReviewRequestIdV1(body.reviewRequestId),
        assertPremiumReviewNotesDigestV1(body.notesDigest),
        body.artifact as PremiumContentArtifactRecordV1,
      ));
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumContentReviewHandler();
