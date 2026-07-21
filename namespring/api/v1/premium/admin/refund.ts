import { sendJson, type NodeStyleResponseLike } from "../../../_lib/http.js";
import {
  assertPlainBody,
  handlePremiumApiErrorV1,
  preparePremiumAdminMutationV1,
  readPremiumJsonBodyV1,
  requirePremiumString,
  type PremiumRequestLike,
} from "../../../_lib/premium-http.js";
import { PremiumServiceV1 } from "../../../_lib/premium-service.js";

export function createPremiumRefundHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      const actor = await preparePremiumAdminMutationV1(req, ["premium_admin"]);
      const body = await readPremiumJsonBodyV1<Record<string, unknown>>(req);
      assertPlainBody(body, ["orderId", "reason"]);
      const result = await service.refundPayment(actor, {
        orderId: requirePremiumString(body.orderId, "orderId", /^premium_order_v1_[A-Za-z0-9_-]{16,128}$/u, 160),
        reason: requirePremiumString(body.reason, "reason", undefined, 500),
      });
      return sendJson(res, 200, result);
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumRefundHandler();
