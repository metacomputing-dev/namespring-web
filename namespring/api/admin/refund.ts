import type { RefundRequest, RefundResponse } from "../../shared/types/payment.js";
import { getRequiredEnv } from "../_lib/env.js";
import {
  ApiHttpError,
  assertPostMethod,
  handleApiError,
  type NodeStyleResponseLike,
  readJsonBody,
  requireNonEmptyString,
  sendJson,
} from "../_lib/http.js";
import { getPaymentRecord, updatePaymentRecord } from "../_lib/payments-repository.js";
import { cancelTossPayment, TossApiError } from "../_lib/toss.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeOptionalReason(value: unknown): string {
  if (typeof value !== "string") {
    return "Operator approved refund.";
  }
  const trimmed = value.trim();
  return trimmed || "Operator approved refund.";
}

function getHeaderValue(headers: Headers | Record<string, unknown> | undefined, key: string): string | null {
  if (!headers) {
    return null;
  }

  if (typeof (headers as Headers).get === "function") {
    const fromHeaders = (headers as Headers).get(key);
    if (!fromHeaders) {
      return null;
    }
    const trimmed = fromHeaders.trim();
    return trimmed || null;
  }

  const headerRecord = headers as Record<string, unknown>;
  const value = headerRecord[key] ?? headerRecord[key.toLowerCase()] ?? headerRecord[key.toUpperCase()];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value) && value.length && typeof value[0] === "string") {
    const trimmed = value[0].trim();
    return trimmed || null;
  }
  return null;
}

function assertAdminAuthorized(req: { headers?: Headers | Record<string, unknown> }) {
  const expected = getRequiredEnv("ADMIN_REFUND_TOKEN");
  const provided = getHeaderValue(req.headers, "x-admin-token");
  if (!provided || provided !== expected) {
    throw new ApiHttpError(401, "UNAUTHORIZED", "Invalid admin token.");
  }
}

function extractRefundedAt(cancelResult: { cancels?: Array<{ canceledAt?: string }> }): string {
  const canceledAt = cancelResult.cancels?.[0]?.canceledAt;
  if (typeof canceledAt === "string" && canceledAt.trim()) {
    return canceledAt;
  }
  return nowIso();
}

export default async function handler(
  req: Request | { method?: string; body?: unknown; headers?: Headers | Record<string, unknown>; [key: string]: unknown },
  res?: NodeStyleResponseLike,
) {
  try {
    assertPostMethod(req, res);
    assertAdminAuthorized(req);

    const body = await readJsonBody<RefundRequest>(req);
    const orderId = requireNonEmptyString(body?.orderId, "orderId");
    const reason = normalizeOptionalReason(body?.reason);

    const paymentRecord = await getPaymentRecord(orderId);
    if (!paymentRecord) {
      throw new ApiHttpError(404, "PAYMENT_NOT_FOUND", "Payment record not found.");
    }

    if (paymentRecord.status === "REFUNDED") {
      const alreadyRefundedResponse: RefundResponse = {
        orderId,
        status: "REFUNDED",
        refundMode: "AUTO_REFUNDED",
        refundedAt: paymentRecord.refundedAt ?? null,
        message: "Payment is already refunded.",
      };
      return sendJson(res, 200, alreadyRefundedResponse);
    }

    if (!paymentRecord.paymentKey) {
      await updatePaymentRecord(orderId, {
        status: "CANCELED",
        refundMode: "MANUAL_REQUIRED",
        refundReason: reason,
        refundFailureCode: "PAYMENT_KEY_MISSING",
        refundFailureMessage: "Automatic refund is unavailable because paymentKey is missing.",
      });

      const manualResponse: RefundResponse = {
        orderId,
        status: "CANCELED",
        refundMode: "MANUAL_REQUIRED",
        refundedAt: null,
        message: "Automatic refund is unavailable. Manual refund is required.",
      };
      return sendJson(res, 202, manualResponse);
    }

    if (paymentRecord.status !== "PAID" && paymentRecord.status !== "CANCELED") {
      throw new ApiHttpError(409, "REFUND_NOT_ALLOWED", `Refund cannot be requested for status ${paymentRecord.status}.`);
    }

    try {
      const cancelResult = await cancelTossPayment({
        paymentKey: paymentRecord.paymentKey,
        cancelReason: reason,
      });

      const refundedAt = extractRefundedAt(cancelResult);
      await updatePaymentRecord(orderId, {
        status: "REFUNDED",
        refundedAt,
        refundMode: "AUTO_REFUNDED",
        refundReason: reason,
        refundFailureCode: null,
        refundFailureMessage: null,
      });

      const response: RefundResponse = {
        orderId,
        status: "REFUNDED",
        refundMode: "AUTO_REFUNDED",
        refundedAt,
        message: "Refund completed automatically.",
      };
      return sendJson(res, 200, response);
    } catch (error) {
      if (error instanceof TossApiError) {
        await updatePaymentRecord(orderId, {
          status: "CANCELED",
          refundMode: "MANUAL_REQUIRED",
          refundReason: reason,
          refundFailureCode: error.code,
          refundFailureMessage: error.message,
        });

        const response: RefundResponse = {
          orderId,
          status: "CANCELED",
          refundMode: "MANUAL_REQUIRED",
          refundedAt: null,
          message: "Automatic refund failed. Manual refund is required.",
        };
        return sendJson(res, 202, response);
      }

      throw error;
    }
  } catch (error) {
    return handleApiError(res, error);
  }
}
