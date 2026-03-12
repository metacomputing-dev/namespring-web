import type { FailPaymentRequest, FailPaymentResponse, PaymentStatus } from "../../shared/types/payment";
import { ApiHttpError, assertPostMethod, handleApiError, readJsonBody, requireNonEmptyString, sendJson } from "../_lib/http";
import { createFailedFallbackPayment, getPaymentRecord, updatePaymentRecord } from "../_lib/payments-repository";

const CANCELED_CODES = new Set(["USER_CANCEL", "PAY_PROCESS_CANCELED"]);

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function resolveFailureStatus(code: string | null): Extract<PaymentStatus, "FAILED" | "CANCELED"> {
  if (code && CANCELED_CODES.has(code)) {
    return "CANCELED";
  }
  return "FAILED";
}

function nowIso() {
  return new Date().toISOString();
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: { setHeader?: (name: string, value: string) => void; status: (code: number) => { json: (payload: unknown) => void } },
) {
  try {
    assertPostMethod(req, res);

    const body = await readJsonBody<FailPaymentRequest>(req);
    const orderId = requireNonEmptyString(body?.orderId, "orderId");
    const code = normalizeOptionalText(body?.code);
    const message = normalizeOptionalText(body?.message);
    const status = resolveFailureStatus(code);
    const failedAt = nowIso();

    const paymentRecord = await getPaymentRecord(orderId);
    if (!paymentRecord) {
      await createFailedFallbackPayment({
        orderId,
        code,
        message,
        status,
      });
    } else {
      await updatePaymentRecord(orderId, {
        status,
        failedAt,
        failCode: code,
        failMessage: message,
      });
    }

    const response: FailPaymentResponse = {
      orderId,
      status,
      failedAt,
    };

    return sendJson(res, 200, response);
  } catch (error) {
    if (error instanceof ApiHttpError) {
      return handleApiError(res, error);
    }
    return handleApiError(res, error);
  }
}
