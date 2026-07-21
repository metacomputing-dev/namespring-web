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

export function createPremiumRevocationHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      const actor = await preparePremiumAdminMutationV1(req, ["premium_admin"]);
      const body = await readPremiumJsonBodyV1<Record<string, unknown>>(req);
      assertPlainBody(body, ["entitlementId", "reason"]);
      const entitlement = await service.revokeEntitlement(actor, {
        entitlementId: requirePremiumString(body.entitlementId, "entitlementId", /^entitlement_v1_[A-Za-z0-9_-]{16,128}$/u, 160),
        reason: requirePremiumString(body.reason, "reason", undefined, 500),
      });
      return sendJson(res, 200, { entitlement });
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumRevocationHandler();
