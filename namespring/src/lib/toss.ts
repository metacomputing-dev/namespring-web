import { ANONYMOUS, loadTossPayments, type TossPaymentsPayment } from "@tosspayments/tosspayments-sdk";
import { getFrontRuntimeConfig } from "./runtime";

let paymentClientPromise: Promise<TossPaymentsPayment> | null = null;

async function createPaymentClient(): Promise<TossPaymentsPayment> {
  const { tossClientKey } = getFrontRuntimeConfig();
  if (!tossClientKey) {
    throw new Error("Toss client key is missing. Set VITE_TOSS_CLIENT_KEY.");
  }

  const tossPayments = await loadTossPayments(tossClientKey);
  return tossPayments.payment({
    customerKey: ANONYMOUS,
  });
}

export async function getTossPaymentClient() {
  if (!paymentClientPromise) {
    paymentClientPromise = createPaymentClient();
  }
  return paymentClientPromise;
}
