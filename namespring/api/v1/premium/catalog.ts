import { handlePremiumApiErrorV1, assertPremiumMethod, type PremiumRequestLike } from "../../_lib/premium-http.js";
import { PremiumServiceV1 } from "../../_lib/premium-service.js";
import { sendJson, type NodeStyleResponseLike } from "../../_lib/http.js";

export function createPremiumCatalogHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      assertPremiumMethod(req, ["GET"]);
      res?.setHeader?.("Cache-Control", "no-store");
      return sendJson(res, 200, {
        catalog: service.getCatalog(),
        paymentRails: service.getPaymentRailCapabilities(),
        policy: service.getPolicyCapability(),
      });
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumCatalogHandler();
