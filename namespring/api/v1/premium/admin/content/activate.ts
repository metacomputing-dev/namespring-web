import type { PremiumContentArtifactRecordV1 } from "../../../../../shared/types/premium-service.js";
import { sendJson, type NodeStyleResponseLike } from "../../../../_lib/http.js";
import {
  assertPlainBody,
  handlePremiumApiErrorV1,
  preparePremiumAdminMutationV1,
  readPremiumJsonBodyV1,
  type PremiumRequestLike,
} from "../../../../_lib/premium-http.js";
import { PremiumServiceV1 } from "../../../../_lib/premium-service.js";
import {
  assertPremiumActivationRequestIdV1,
  assertPremiumReviewReceiptReferenceV1,
} from "../../../../_lib/premium-review-contract.js";

export function createPremiumContentActivationHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      const actor = await preparePremiumAdminMutationV1(req, ["premium_admin"]);
      const body = await readPremiumJsonBodyV1<Record<string, unknown>>(req, 512 * 1024);
      assertPlainBody(body, ["activationRequestId", "reviewReceiptId", "artifact"]);
      return sendJson(res, 200, {
        artifact: await service.activateApprovedContent(
          actor,
          assertPremiumActivationRequestIdV1(body.activationRequestId),
          assertPremiumReviewReceiptReferenceV1(body.reviewReceiptId),
          body.artifact as PremiumContentArtifactRecordV1,
        ),
      });
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumContentActivationHandler();
