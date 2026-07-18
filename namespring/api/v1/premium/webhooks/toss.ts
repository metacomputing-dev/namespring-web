import type { PremiumActorV1 } from "../../../../shared/types/premium-service.js";
import { ApiHttpError, sendJson, type NodeStyleResponseLike } from "../../../_lib/http.js";
import { getHeaderValue } from "../../../_lib/auth-http.js";
import { consumeRateLimitV1 } from "../../../_lib/rate-limit.js";
import {
  assertPremiumMethod,
  handlePremiumApiErrorV1,
  readPremiumJsonBodyV1,
  requirePremiumString,
  type PremiumRequestLike,
} from "../../../_lib/premium-http.js";
import { PremiumServiceV1 } from "../../../_lib/premium-service.js";

const TOSS_SYSTEM_ACTOR: PremiumActorV1 = {
  userId: "premium_system_toss_webhook",
  sessionId: "premium_system_session_toss_webhook",
  roles: ["premium_system"],
};

export function createPremiumTossWebhookHandler(service = new PremiumServiceV1()) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      assertPremiumMethod(req, ["POST"]);
      const body = await readPremiumJsonBodyV1<Record<string, unknown>>(req, 32 * 1024);
      if (body.eventType !== "PAYMENT_STATUS_CHANGED") {
        throw new ApiHttpError(400, "TOSS_WEBHOOK_EVENT_UNSUPPORTED", "Unsupported Toss webhook event type.");
      }
      const data = body?.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new ApiHttpError(400, "TOSS_WEBHOOK_INVALID", "Toss webhook data is missing.");
      }
      const record = data as Record<string, unknown>;
      const paymentKey = requirePremiumString(record.paymentKey, "data.paymentKey", /^[A-Za-z0-9_-]{10,200}$/u, 200);
      // Vercel overwrites this platform header. Do not trust ordinary
      // X-Forwarded-For supplied by an arbitrary caller.
      const forwarded = getHeaderValue(req, "x-vercel-forwarded-for") ?? "unknown";
      await consumeRateLimitV1({
        policy: { scope: "premium.webhook.toss", limit: 120, windowSeconds: 60 },
        trustedSubject: forwarded.slice(0, 256),
      });
      const order = await service.reconcilePayment(TOSS_SYSTEM_ACTOR, {
        orderId: requirePremiumString(record.orderId, "data.orderId", /^premium_order_v1_[A-Za-z0-9_-]{16,128}$/u, 160),
        paymentKey,
      });
      return sendJson(res, 200, { received: true, orderId: order.orderId, status: order.status });
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumTossWebhookHandler();
