import type {
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  CreatePaymentResponse,
  FailPaymentRequest,
  FailPaymentResponse,
} from "../../shared/types/payment";
import { SUPPORT_AMOUNT } from "../../shared/types/payment";
import { postJson } from "./api";
import { toAbsoluteAppUrl } from "./paths";
import { getFrontRuntimeConfig } from "./runtime";
import { getTossPaymentClient } from "./toss";

export async function createPayment(email: string | null): Promise<CreatePaymentResponse> {
  return postJson<CreatePaymentResponse>("/api/payments/create", {
    email: email ?? undefined,
  });
}

export async function requestCardPayment(params: {
  orderId: string;
  orderName: string;
  amount: number;
  customerEmail: string | null;
}) {
  if (params.amount !== SUPPORT_AMOUNT) {
    throw new Error(`Amount must be ${SUPPORT_AMOUNT}.`);
  }

  const paymentClient = await getTossPaymentClient();
  const { paymentAppOrigin } = getFrontRuntimeConfig();

  await paymentClient.requestPayment({
    method: "CARD",
    amount: {
      currency: "KRW",
      value: params.amount,
    },
    orderId: params.orderId,
    orderName: params.orderName,
    customerEmail: params.customerEmail ?? undefined,
    successUrl: toAbsoluteAppUrl("/payment/success", {
      originOverride: paymentAppOrigin,
      includeBasePath: !paymentAppOrigin,
    }),
    failUrl: toAbsoluteAppUrl("/payment/fail", {
      originOverride: paymentAppOrigin,
      includeBasePath: !paymentAppOrigin,
    }),
  });
}

export async function confirmPayment(payload: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse> {
  return postJson<ConfirmPaymentResponse>("/api/payments/confirm", payload);
}

export async function registerPaymentFail(payload: FailPaymentRequest): Promise<FailPaymentResponse> {
  return postJson<FailPaymentResponse>("/api/payments/fail", payload);
}
