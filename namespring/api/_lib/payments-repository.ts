import { createHash } from "node:crypto";
import type {
  LegacyRefundState,
  PaymentRecord,
} from "../../shared/types/payment.js";
import { PAYMENT_STATUSES } from "../../shared/types/payment.js";
import { getFirestoreDb } from "./firestore-admin.js";
import { ApiHttpError } from "./http.js";

const PAYMENTS_COLLECTION = "payments";
const ATTEMPT_PREFIX = "legacy_refund_v1_";
const ATTEMPT_PATTERN = /^legacy_refund_v1_[a-f0-9]{40}$/u;

export interface LegacyRefundClaim {
  readonly mode: "claimed" | "already_refunded";
  readonly record: PaymentRecord;
  readonly attemptId: string;
}

export interface LegacyProviderIdentity {
  readonly paymentKey: string;
  readonly orderId: string;
  readonly totalAmount: number;
  readonly balanceAmount: number;
  readonly currency: string;
  readonly method: string | null;
  readonly status: string;
  readonly observedAt: string;
}

function digest(...parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part, "utf8").update("\0", "utf8");
  return hash.digest("hex");
}

export function legacyRefundAttemptId(orderId: string): string {
  return `${ATTEMPT_PREFIX}${digest("namespring.legacy-refund-attempt.v1", orderId).slice(0, 40)}`;
}

function recordVersion(record: PaymentRecord): number {
  const value = record.version ?? 0;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ApiHttpError(500, "LEGACY_PAYMENT_RECORD_CORRUPT", "Legacy payment version is invalid.");
  }
  return value;
}

function assertRecordIdentity(record: PaymentRecord, orderId: string): void {
  if (record.orderId !== orderId
    || !Number.isSafeInteger(record.amount)
    || record.amount <= 0
    || !PAYMENT_STATUSES.includes(record.status)
    || (record.paymentKey !== null
      && (typeof record.paymentKey !== "string"
        || !record.paymentKey.trim()
        || record.paymentKey !== record.paymentKey.trim()
        || record.paymentKey.length > 512))) {
    throw new ApiHttpError(500, "LEGACY_PAYMENT_RECORD_CORRUPT", "Legacy payment identity is invalid.");
  }
}

function assertActiveAttempt(record: PaymentRecord, attemptId: string): void {
  if (!ATTEMPT_PATTERN.test(attemptId)
    || attemptId !== legacyRefundAttemptId(record.orderId)
    || record.refundAttemptId !== attemptId
    || (record.refundState !== "PENDING" && record.refundState !== "RECONCILIATION_REQUIRED")) {
    throw new ApiHttpError(409, "LEGACY_REFUND_CAS_CONFLICT", "Legacy refund state changed; reconcile before retrying.");
  }
}

function mergeRecord(record: PaymentRecord, patch: Partial<PaymentRecord>): PaymentRecord {
  return { ...record, ...patch };
}

function safeStoredRefundReason(value: unknown): string | null {
  return typeof value === "string"
    && value === value.trim()
    && value.length >= 3
    && value.length <= 200
    && !/[\u0000-\u001F\u007F]/u.test(value)
    ? value
    : null;
}

/** Pure invariant gate shared by the transaction path and focused tests. */
export function assertLegacyProviderSettlement(input: {
  readonly record: PaymentRecord;
  readonly orderId: string;
  readonly attemptId: string;
  readonly provider: LegacyProviderIdentity;
  readonly outcome: "refunded" | "never_captured";
}): void {
  assertRecordIdentity(input.record, input.orderId);
  assertActiveAttempt(input.record, input.attemptId);
  const allowedStatuses = input.outcome === "refunded"
    ? new Set(["CANCELED", "PARTIAL_CANCELED"])
    : new Set(["ABORTED", "EXPIRED"]);
  if (input.provider.orderId !== input.orderId
    || input.record.paymentKey !== input.provider.paymentKey
    || input.record.amount !== input.provider.totalAmount
    || input.provider.currency !== "KRW"
    || input.provider.balanceAmount !== 0
    || !allowedStatuses.has(input.provider.status)) {
    throw new ApiHttpError(409, "PROVIDER_IDENTITY_MISMATCH", "Provider settlement does not match the legacy order.");
  }
}

/**
 * Claims a deterministic refund attempt without changing the financial status.
 * Firestore transaction retries provide CAS semantics for concurrent operators.
 */
export async function beginLegacyRefund(input: {
  readonly orderId: string;
  readonly reason: string;
  readonly requestedByUserId: string;
  readonly requestedAt: string;
}): Promise<LegacyRefundClaim> {
  const db = getFirestoreDb();
  const ref = db.collection(PAYMENTS_COLLECTION).doc(input.orderId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      throw new ApiHttpError(404, "PAYMENT_NOT_FOUND", "Legacy payment record not found.");
    }
    const record = snapshot.data() as PaymentRecord;
    assertRecordIdentity(record, input.orderId);
    const version = recordVersion(record);
    const attemptId = legacyRefundAttemptId(input.orderId);
    if (record.refundAttemptId && record.refundAttemptId !== attemptId) {
      throw new ApiHttpError(500, "LEGACY_PAYMENT_RECORD_CORRUPT", "Legacy refund attempt identity is invalid.");
    }

    if (record.status === "REFUNDED" || record.refundState === "AUTO_REFUNDED") {
      return { mode: "already_refunded", record, attemptId };
    }

    const patch: Partial<PaymentRecord> = {
      refundState: "PENDING",
      refundMode: null,
      refundAttemptId: attemptId,
      refundFirstRequestedAt: record.refundFirstRequestedAt ?? record.refundRequestedAt ?? input.requestedAt,
      refundFirstRequestedByUserId:
        record.refundFirstRequestedByUserId ?? record.refundRequestedByUserId ?? input.requestedByUserId,
      refundRequestedAt: input.requestedAt,
      refundRequestedByUserId: input.requestedByUserId,
      refundReason: safeStoredRefundReason(record.refundReason) ?? input.reason,
      refundFailureCode: null,
      refundFailureMessage: null,
      version: version + 1,
    };
    transaction.set(ref, patch, { merge: true });
    return { mode: "claimed", record: mergeRecord(record, patch), attemptId };
  });
}

/** Recovers a paymentKey from Toss' order lookup while defending against rebinding. */
export async function attachRecoveredLegacyPaymentKey(input: {
  readonly attemptId: string;
  readonly provider: LegacyProviderIdentity;
}): Promise<PaymentRecord> {
  const db = getFirestoreDb();
  const ref = db.collection(PAYMENTS_COLLECTION).doc(input.provider.orderId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new ApiHttpError(404, "PAYMENT_NOT_FOUND", "Legacy payment record not found.");
    const record = snapshot.data() as PaymentRecord;
    assertRecordIdentity(record, input.provider.orderId);
    if (record.status === "REFUNDED") return record;
    assertActiveAttempt(record, input.attemptId);
    if (record.amount !== input.provider.totalAmount || input.provider.currency !== "KRW") {
      throw new ApiHttpError(409, "PROVIDER_AMOUNT_MISMATCH", "Provider amount does not match the legacy order.");
    }
    if (record.paymentKey && record.paymentKey !== input.provider.paymentKey) {
      throw new ApiHttpError(409, "PROVIDER_PAYMENT_KEY_MISMATCH", "Provider payment identity conflicts with the legacy order.");
    }
    const patch: Partial<PaymentRecord> = {
      paymentKey: input.provider.paymentKey,
      method: record.method ?? input.provider.method,
      refundProviderStatus: input.provider.status,
      refundProviderObservedAt: input.provider.observedAt,
      version: recordVersion(record) + 1,
    };
    transaction.set(ref, patch, { merge: true });
    return mergeRecord(record, patch);
  });
}

export async function completeLegacyRefund(input: {
  readonly orderId: string;
  readonly attemptId: string;
  readonly provider: LegacyProviderIdentity;
  readonly refundedAt: string;
}): Promise<PaymentRecord> {
  const db = getFirestoreDb();
  const ref = db.collection(PAYMENTS_COLLECTION).doc(input.orderId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new ApiHttpError(404, "PAYMENT_NOT_FOUND", "Legacy payment record not found.");
    const record = snapshot.data() as PaymentRecord;
    assertRecordIdentity(record, input.orderId);
    if (record.status === "REFUNDED" && record.paymentKey === input.provider.paymentKey) return record;
    assertLegacyProviderSettlement({
      record,
      orderId: input.orderId,
      attemptId: input.attemptId,
      provider: input.provider,
      outcome: "refunded",
    });
    const patch: Partial<PaymentRecord> = {
      status: "REFUNDED",
      refundedAt: input.refundedAt,
      refundState: "AUTO_REFUNDED",
      refundMode: "AUTO_REFUNDED",
      refundProviderStatus: input.provider.status,
      refundProviderObservedAt: input.provider.observedAt,
      refundFailureCode: null,
      refundFailureMessage: null,
      version: recordVersion(record) + 1,
    };
    transaction.set(ref, patch, { merge: true });
    return mergeRecord(record, patch);
  });
}

export async function completeLegacyNoCapture(input: {
  readonly orderId: string;
  readonly attemptId: string;
  readonly provider: LegacyProviderIdentity;
}): Promise<PaymentRecord> {
  const db = getFirestoreDb();
  const ref = db.collection(PAYMENTS_COLLECTION).doc(input.orderId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new ApiHttpError(404, "PAYMENT_NOT_FOUND", "Legacy payment record not found.");
    const record = snapshot.data() as PaymentRecord;
    assertRecordIdentity(record, input.orderId);
    if (record.refundState === "NO_CAPTURE_FOUND") return record;
    assertLegacyProviderSettlement({
      record,
      orderId: input.orderId,
      attemptId: input.attemptId,
      provider: input.provider,
      outcome: "never_captured",
    });
    const patch: Partial<PaymentRecord> = {
      status: "CANCELED",
      paymentKey: record.paymentKey ?? input.provider.paymentKey,
      method: record.method ?? input.provider.method,
      refundState: "NO_CAPTURE_FOUND",
      refundMode: "NO_CAPTURE_FOUND",
      refundProviderStatus: input.provider.status,
      refundProviderObservedAt: input.provider.observedAt,
      refundFailureCode: null,
      refundFailureMessage: null,
      version: recordVersion(record) + 1,
    };
    transaction.set(ref, patch, { merge: true });
    return mergeRecord(record, patch);
  });
}

async function markRefundFollowUp(input: {
  readonly orderId: string;
  readonly attemptId: string;
  readonly state: Extract<LegacyRefundState, "RECONCILIATION_REQUIRED" | "MANUAL_REQUIRED">;
  readonly failureCode: string;
  readonly providerStatus?: string | null;
  readonly observedAt: string;
}): Promise<PaymentRecord> {
  const db = getFirestoreDb();
  const ref = db.collection(PAYMENTS_COLLECTION).doc(input.orderId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new ApiHttpError(404, "PAYMENT_NOT_FOUND", "Legacy payment record not found.");
    const record = snapshot.data() as PaymentRecord;
    assertRecordIdentity(record, input.orderId);
    if (record.status === "REFUNDED") return record;
    assertActiveAttempt(record, input.attemptId);
    const patch: Partial<PaymentRecord> = {
      refundState: input.state,
      refundMode: input.state,
      refundFailureCode: input.failureCode,
      // Never persist a raw provider/network exception message.
      refundFailureMessage: "Operator follow-up is required; retry the authenticated reconciliation endpoint.",
      refundProviderStatus: input.providerStatus ?? record.refundProviderStatus ?? null,
      refundProviderObservedAt: input.observedAt,
      version: recordVersion(record) + 1,
    };
    transaction.set(ref, patch, { merge: true });
    return mergeRecord(record, patch);
  });
}

export function markLegacyRefundReconciliationRequired(input: {
  readonly orderId: string;
  readonly attemptId: string;
  readonly failureCode: string;
  readonly providerStatus?: string | null;
  readonly observedAt: string;
}): Promise<PaymentRecord> {
  return markRefundFollowUp({ ...input, state: "RECONCILIATION_REQUIRED" });
}

export function markLegacyRefundManualRequired(input: {
  readonly orderId: string;
  readonly attemptId: string;
  readonly failureCode: string;
  readonly providerStatus?: string | null;
  readonly observedAt: string;
}): Promise<PaymentRecord> {
  return markRefundFollowUp({ ...input, state: "MANUAL_REQUIRED" });
}
