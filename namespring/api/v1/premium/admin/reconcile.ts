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

export function createPremiumReconciliationHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      const actor = await preparePremiumAdminMutationV1(req, ["premium_admin"]);
      const body = await readPremiumJsonBodyV1<Record<string, unknown>>(req);
      assertPlainBody(body, ["orderId", "paymentKey"]);
      const order = await service.reconcilePayment(actor, {
        orderId: requirePremiumString(body.orderId, "orderId", /^premium_order_v1_[A-Za-z0-9_-]{16,128}$/u, 160),
        paymentKey: requirePremiumString(body.paymentKey, "paymentKey", /^[A-Za-z0-9_-]{10,200}$/u, 200),
      });
      return sendJson(res, 200, { order });
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumReconciliationHandler();
