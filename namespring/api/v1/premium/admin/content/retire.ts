import type { PremiumContentActivationBindingV1 } from "../../../../../shared/types/premium-service.js";
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

export function createPremiumContentRetirementHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      const actor = await preparePremiumAdminMutationV1(req, ["premium_admin"]);
      const body = await readPremiumJsonBodyV1<Record<string, unknown>>(req);
      assertPlainBody(body, ["reportId", "activation", "reason"]);
      await service.retireContent(actor, {
        reportId: requirePremiumString(body.reportId, "reportId", /^report_v1_[A-Za-z0-9_-]{16,128}$/u, 160),
        activation: body.activation as PremiumContentActivationBindingV1,
        reason: requirePremiumString(body.reason, "reason", undefined, 500),
      });
      return sendJson(res, 200, { retired: true });
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumContentRetirementHandler();
