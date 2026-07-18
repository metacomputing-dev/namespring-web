import type { ConfirmPremiumPaymentCommandV1 } from "../../../../shared/types/premium-service.js";
import { sendJson, type NodeStyleResponseLike } from "../../../_lib/http.js";
import {
  assertPlainBody,
  handlePremiumApiErrorV1,
  prepareAuthenticatedPremiumMutation,
  readPremiumJsonBodyV1,
  type PremiumRequestLike,
} from "../../../_lib/premium-http.js";
import { PremiumServiceV1 } from "../../../_lib/premium-service.js";

export function createPremiumPaymentConfirmationHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      const actor = await prepareAuthenticatedPremiumMutation(req, {
        scope: "premium.payment.confirm", limit: 30, windowSeconds: 300,
      });
      const body = await readPremiumJsonBodyV1<ConfirmPremiumPaymentCommandV1>(req);
      assertPlainBody(body, ["orderId", "paymentKey", "amount", "currency"]);
      return sendJson(res, 200, await service.confirmPayment(actor, body));
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumPaymentConfirmationHandler();
