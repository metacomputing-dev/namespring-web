import type { ConfirmPaymentRequest, ConfirmPaymentResponse, PaymentStatus } from "../../shared/types/payment";
import { SUPPORT_AMOUNT } from "../../shared/types/payment";
import {
  ApiHttpError,
  assertPostMethod,
  handleApiError,
  readJsonBody,
  requireNonEmptyString,
  requirePositiveInteger,
  sendJson,
} from "../_lib/http";
import { getPaymentRecord, updatePaymentRecord } from "../_lib/payments-repository";
import { confirmTossPayment, TossApiError } from "../_lib/toss";

function nowIso() {
  return new Date().toISOString();
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: { setHeader?: (name: string, value: string) => void; status: (code: number) => { json: (payload: unknown) => void } },
) {
  let orderIdForFailureTracking = "";

  try {
    assertPostMethod(req, res);

    const body = await readJsonBody<ConfirmPaymentRequest>(req);
    const paymentKey = requireNonEmptyString(body?.paymentKey, "paymentKey");
    const orderId = requireNonEmptyString(body?.orderId, "orderId");
    const amount = requirePositiveInteger(body?.amount, "amount");

    orderIdForFailureTracking = orderId;

    if (amount !== SUPPORT_AMOUNT) {
      throw new ApiHttpError(400, "INVALID_AMOUNT", `Amount must be ${SUPPORT_AMOUNT}.`);
    }

    const paymentRecord = await getPaymentRecord(orderId);
    if (!paymentRecord) {
      throw new ApiHttpError(404, "PAYMENT_NOT_FOUND", "Payment record not found.");
    }

    if (paymentRecord.amount !== amount) {
      throw new ApiHttpError(400, "AMOUNT_MISMATCH", "Amount does not match the order.");
    }

    if (paymentRecord.status === "PAID" && paymentRecord.paymentKey === paymentKey) {
      const paidAt = paymentRecord.paidAt ?? nowIso();
      const response: ConfirmPaymentResponse = {
        orderId,
        status: "PAID",
        paymentKey,
        method: paymentRecord.method ?? null,
        paidAt,
      };
      return sendJson(res, 200, response);
    }

    const tossConfirmed = await confirmTossPayment({
      paymentKey,
      orderId,
      amount,
    });

    const method = typeof tossConfirmed.method === "string" ? tossConfirmed.method : null;
    const paidAt = typeof tossConfirmed.approvedAt === "string" && tossConfirmed.approvedAt
      ? tossConfirmed.approvedAt
      : nowIso();

    await updatePaymentRecord(orderId, {
      status: "PAID",
      paymentKey,
      method,
      paidAt,
      failedAt: null,
      failCode: null,
      failMessage: null,
    });

    const response: ConfirmPaymentResponse = {
      orderId,
      status: "PAID",
      paymentKey,
      method,
      paidAt,
    };

    return sendJson(res, 200, response);
  } catch (error) {
    if (orderIdForFailureTracking && error instanceof TossApiError) {
      try {
        const fallbackStatus: PaymentStatus = "FAILED";
        await updatePaymentRecord(orderIdForFailureTracking, {
          status: fallbackStatus,
          failedAt: nowIso(),
          failCode: error.code,
          failMessage: error.message,
        });
      } catch {
        // Ignore secondary write errors to avoid masking the original error.
      }
    }

    return handleApiError(res, error);
  }
}
