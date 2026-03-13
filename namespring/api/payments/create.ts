import type { CreatePaymentRequest, CreatePaymentResponse } from "../../shared/types/payment.js";
import { SUPPORT_AMOUNT, SUPPORT_ORDER_NAME } from "../../shared/types/payment.js";
import { normalizeOptionalEmail } from "../_lib/email.js";
import { assertPostMethod, handleApiError, readJsonBody, sendJson, type NodeStyleResponseLike } from "../_lib/http.js";
import { generateOrderId } from "../_lib/order-id.js";
import { createReadyPayment } from "../_lib/payments-repository.js";

export default async function handler(
  req: Request | { method?: string; body?: unknown; [key: string]: unknown },
  res?: NodeStyleResponseLike,
) {
  try {
    assertPostMethod(req, res);

    const body = await readJsonBody<CreatePaymentRequest>(req);
    const email = normalizeOptionalEmail(body?.email);

    const orderId = generateOrderId();
    await createReadyPayment({
      orderId,
      email,
    });

    const response: CreatePaymentResponse = {
      orderId,
      orderName: SUPPORT_ORDER_NAME,
      amount: SUPPORT_AMOUNT,
      customerEmail: email,
    };

    return sendJson(res, 200, response);
  } catch (error) {
    return handleApiError(res, error);
  }
}
