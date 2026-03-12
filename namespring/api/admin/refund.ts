import type { RefundRequest, RefundResponse } from "../../shared/types/payment";
import { getRequiredEnv } from "../_lib/env";
import {
  ApiHttpError,
  assertPostMethod,
  handleApiError,
  readJsonBody,
  requireNonEmptyString,
  sendJson,
} from "../_lib/http";
import { getPaymentRecord, updatePaymentRecord } from "../_lib/payments-repository";
import { cancelTossPayment, TossApiError } from "../_lib/toss";

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

function getHeaderValue(headers: Record<string, unknown>, key: string): string | null {
  const value = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length && typeof value[0] === "string") {
    return value[0];
  }
  return null;
}

function assertAdminAuthorized(req: { headers?: Record<string, unknown> }) {
  const expected = getRequiredEnv("ADMIN_REFUND_TOKEN");
  const provided = getHeaderValue(req.headers ?? {}, "x-admin-token");
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
  req: { method?: string; body?: unknown; headers?: Record<string, unknown> },
  res: { setHeader?: (name: string, value: string) => void; status: (code: number) => { json: (payload: unknown) => void } },
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
