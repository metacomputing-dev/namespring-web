import type { DeliverPremiumReportCommandV1 } from "../../../../shared/types/premium-service.js";
import { sendJson, type NodeStyleResponseLike } from "../../../_lib/http.js";
import {
  assertPlainBody,
  handlePremiumApiErrorV1,
  prepareAuthenticatedPremiumMutation,
  readPremiumJsonBodyV1,
  type PremiumRequestLike,
} from "../../../_lib/premium-http.js";
import { PremiumServiceV1 } from "../../../_lib/premium-service.js";

export function createPremiumReportDeliveryHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      const actor = await prepareAuthenticatedPremiumMutation(req, {
        scope: "premium.report.deliver", limit: 120, windowSeconds: 300,
      });
      const body = await readPremiumJsonBodyV1<DeliverPremiumReportCommandV1>(req);
      assertPlainBody(body, ["access"]);
      return sendJson(res, 200, await service.deliverReport(actor, body.access));
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumReportDeliveryHandler();
