import type { CreatePremiumCheckoutCommandV1 } from "../../../../shared/types/premium-service.js";
import { sendJson, type NodeStyleResponseLike } from "../../../_lib/http.js";
import {
  assertPlainBody,
  handlePremiumApiErrorV1,
  prepareAuthenticatedPremiumMutation,
  readPremiumJsonBodyV1,
  type PremiumRequestLike,
} from "../../../_lib/premium-http.js";
import { PremiumServiceV1 } from "../../../_lib/premium-service.js";

export function createPremiumCheckoutHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      const actor = await prepareAuthenticatedPremiumMutation(req, {
        scope: "premium.checkout.create", limit: 30, windowSeconds: 300,
      });
      const body = await readPremiumJsonBodyV1<CreatePremiumCheckoutCommandV1>(req);
      assertPlainBody(body, ["reportId", "productId", "requestId", "purchaseTermsAcceptance"]);
      return sendJson(res, 200, await service.createCheckout(actor, body));
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumCheckoutHandler();
