import { sendJson, type NodeStyleResponseLike } from "../../../_lib/http.js";
import {
  assertPremiumMethod,
  handlePremiumApiErrorV1,
  resolvePremiumActorV1,
  type PremiumRequestLike,
} from "../../../_lib/premium-http.js";
import { consumeRateLimitV1 } from "../../../_lib/rate-limit.js";
import { PremiumServiceV1 } from "../../../_lib/premium-service.js";

export function createPremiumAccountExportHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      assertPremiumMethod(req, ["GET"]);
      const actor = await resolvePremiumActorV1(req);
      await consumeRateLimitV1({
        policy: { scope: "premium.account.export", limit: 6, windowSeconds: 3_600 },
        trustedSubject: actor.userId,
      });
      return sendJson(res, 200, await service.exportAccountData(actor.userId));
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumAccountExportHandler();
