import type { CreatePaymentRequest, CreatePaymentResponse } from "../../shared/types/payment";
import { SUPPORT_AMOUNT, SUPPORT_ORDER_NAME } from "../../shared/types/payment";
import { normalizeOptionalEmail } from "../_lib/email";
import { assertPostMethod, handleApiError, readJsonBody, sendJson } from "../_lib/http";
import { generateOrderId } from "../_lib/order-id";
import { createReadyPayment } from "../_lib/payments-repository";

export default async function handler(
  req: { method?: string; body?: unknown },
  res: { setHeader?: (name: string, value: string) => void; status: (code: number) => { json: (payload: unknown) => void } },
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
