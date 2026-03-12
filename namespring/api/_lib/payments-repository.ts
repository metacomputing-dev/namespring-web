import type { PaymentRecord } from "../../shared/types/payment";
import { SUPPORT_AMOUNT } from "../../shared/types/payment";
import { getFirestoreDb } from "./firestore-admin";

const PAYMENTS_COLLECTION = "payments";

function nowIso(): string {
  return new Date().toISOString();
}

function paymentDocRef(orderId: string) {
  const firestore = getFirestoreDb();
  return firestore.collection(PAYMENTS_COLLECTION).doc(orderId);
}

export async function getPaymentRecord(orderId: string): Promise<PaymentRecord | null> {
  const snapshot = await paymentDocRef(orderId).get();
  if (!snapshot.exists) {
    return null;
  }
  return snapshot.data() as PaymentRecord;
}

export async function createReadyPayment(params: { orderId: string; email: string | null }): Promise<PaymentRecord> {
  const createdAt = nowIso();
  const paymentRecord: PaymentRecord = {
    orderId: params.orderId,
    email: params.email,
    amount: SUPPORT_AMOUNT,
    status: "READY",
    paymentKey: null,
    method: null,
    createdAt,
    paidAt: null,
    failedAt: null,
    refundedAt: null,
  };

  await paymentDocRef(params.orderId).set(paymentRecord, { merge: false });
  return paymentRecord;
}

export async function createFailedFallbackPayment(params: {
  orderId: string;
  code: string | null;
  message: string | null;
  status: "FAILED" | "CANCELED";
}) {
  const failedAt = nowIso();
  const fallbackRecord: PaymentRecord = {
    orderId: params.orderId,
    email: null,
    amount: SUPPORT_AMOUNT,
    status: params.status,
    paymentKey: null,
    method: null,
    createdAt: failedAt,
    paidAt: null,
    failedAt,
    refundedAt: null,
    failCode: params.code,
    failMessage: params.message,
  };

  await paymentDocRef(params.orderId).set(fallbackRecord, { merge: false });
}

export async function updatePaymentRecord(orderId: string, patch: Partial<PaymentRecord>) {
  await paymentDocRef(orderId).set(patch, { merge: true });
}
