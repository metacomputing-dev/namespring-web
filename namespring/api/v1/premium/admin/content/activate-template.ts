import type { PremiumContentTemplateRecordV1 } from "../../../../../shared/types/premium-service.js";
import { sendJson, type NodeStyleResponseLike } from "../../../../_lib/http.js";
import {
  assertPlainBody,
  handlePremiumApiErrorV1,
  preparePremiumAdminMutationV1,
  readPremiumJsonBodyV1,
  requirePremiumString,
  type PremiumRequestLike,
} from "../../../../_lib/premium-http.js";
import { PremiumServiceV1 } from "../../../../_lib/premium-service.js";
import {
  assertPremiumActivationRequestIdV1,
  assertPremiumReviewReceiptReferenceV1,
} from "../../../../_lib/premium-review-contract.js";

export function createPremiumTemplateActivationHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      const actor = await preparePremiumAdminMutationV1(req, ["premium_admin"]);
      const body = await readPremiumJsonBodyV1<Record<string, unknown>>(req, 512 * 1024);
      assertPlainBody(body, ["sampleReportId", "activationRequestId", "reviewReceiptId", "template"]);
      const sampleReportId = requirePremiumString(
        body.sampleReportId, "sampleReportId", /^report_v1_[A-Za-z0-9_-]{16,128}$/u, 160,
      );
      const template = await service.activateApprovedTemplate(
        actor,
        sampleReportId,
        assertPremiumActivationRequestIdV1(body.activationRequestId),
        assertPremiumReviewReceiptReferenceV1(body.reviewReceiptId),
        body.template as PremiumContentTemplateRecordV1,
      );
      return sendJson(res, 200, { template });
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumTemplateActivationHandler();
