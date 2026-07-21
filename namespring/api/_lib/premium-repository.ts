import { Timestamp, type DocumentData, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import type {
  PremiumEntitlementOwnerV1,
  PremiumReportBindingV1,
  PremiumReportDeliveryV1,
  PremiumReportReferenceV1,
  ReportEntitlementV1,
} from "../../../lib/spring-ts/src/report/premium/index.js";
import type {
  PremiumActorV1,
  PremiumAuditEventV1,
  PremiumContentArtifactRecordV1,
  PremiumContentActivationBindingV1,
  PremiumContentTemplateRecordV1,
  PremiumPaymentOrderRecordV1,
  PremiumServerAnalysisRecordV1,
} from "../../shared/types/premium-service.js";
import { getFirestoreDb } from "./firestore-admin.js";
import { ApiHttpError } from "./http.js";
import { premiumDocumentKey } from "./premium-ids.js";
import { openPremiumJsonRecordV1, sealPremiumJsonRecordV1 } from "./premium-crypto.js";
import {
  ACCOUNT_PAYMENT_LEASE_COLLECTION_V1,
  accountPaymentLeaseRefV1,
  assertAccountWriteAllowedV1,
} from "./account-write-fence.js";
import type {
  PremiumAccessSnapshotV1,
  PremiumAccountExportSectionV1,
  PremiumDeliveryReplayRecordV1,
  PremiumPaymentCommitResultV1,
  PremiumPaymentLeaseCandidateV1,
  PremiumPaymentLeaseWorkItemV1,
  PremiumProviderObservationV1,
  PremiumRegistrationCommitV1,
  PremiumRepositoryV1,
  PremiumRetainedPaymentRecordV1,
  PremiumUnpaidExpirySweepResultV1,
} from "./premium-repository-contract.js";
import {
  samePremiumContentActivationV1 as sameActivation,
  samePremiumOwnerV1 as sameOwner,
  samePremiumReportBindingV1 as sameBinding,
} from "./premium-domain-equality.js";
import {
  deletePremiumEntitlementAdminProjectionV1,
  deletePremiumOrderAdminProjectionsV1,
  writePremiumEntitlementAdminProjectionV1,
  writePremiumOrderAdminProjectionsV1,
} from "./premium-admin-discovery.js";
import {
  getPremiumAuditHmacKeyringV1,
  premiumAuditActorV2,
  premiumAuditSubjectMatchesV2,
} from "./premium-audit-privacy.js";
import {
  assertPremiumContentReviewReceiptV1,
  premiumArtifactReviewedMaterialDigestV1,
  premiumTemplateReviewedMaterialDigestV1,
  type PremiumContentReviewReceiptV1,
} from "./premium-review-contract.js";

export type {
  PremiumAccessSnapshotV1,
  PremiumAccountExportSectionV1,
  PremiumDeliveryReplayRecordV1,
  PremiumPaymentCommitResultV1,
  PremiumPaymentLeaseCandidateV1,
  PremiumPaymentLeaseWorkItemV1,
  PremiumProviderObservationV1,
  PremiumRegistrationCommitV1,
  PremiumRepositoryV1,
  PremiumRetainedPaymentRecordV1,
  PremiumUnpaidExpirySweepResultV1,
} from "./premium-repository-contract.js";

const COLLECTIONS = {
  registrations: "premium_v1_registrations",
  reports: "premium_v1_reports",
  analyses: "premium_v1_analyses",
  checkoutRequests: "premium_v1_checkout_requests",
  orders: "premium_v1_orders",
  providerKeys: "premium_v1_provider_payment_keys",
  entitlements: "premium_v1_entitlements",
  deliveryRequests: "premium_v1_delivery_requests",
  contentArtifacts: "premium_v1_content_artifacts",
  activeContent: "premium_v1_active_content",
  contentTemplates: "premium_v1_content_templates",
  activeTemplates: "premium_v1_active_templates",
  contentReviews: "premium_v1_content_reviews",
  entitlementGrants: "premium_v1_entitlement_grants",
  audit: "premium_v1_audit",
  ownerResources: "premium_v1_owner_resources",
  retainedPayments: "premium_v1_retained_payments",
  deletionReceipts: "premium_v1_deletion_receipts",
  unpaidExpiryCandidates: "premium_v1_unpaid_expiry_candidates",
  unpaidExpiryReceipts: "premium_v1_unpaid_expiry_receipts",
} as const;

interface RegistrationIndexRecordV1 {
  readonly owner: PremiumEntitlementOwnerV1;
  readonly requestId: string;
  readonly materialDigest: string;
  readonly consentAcceptanceDigest: `sha256:${string}`;
  readonly reportId: string;
  readonly createdAt: string;
}

interface CheckoutIndexRecordV1 {
  readonly owner: PremiumEntitlementOwnerV1;
  readonly requestId: string;
  readonly orderId: string;
  readonly binding: PremiumReportBindingV1;
  readonly createdAt: string;
}

interface EntitlementGrantRecordV1 {
  readonly entitlementId: string;
  readonly orderId: string;
  readonly contentActivation: PremiumContentActivationBindingV1;
  readonly createdAt: string;
}

interface AccountPaymentLeaseRecordV1 {
  readonly schemaVersion: "namespring.account-payment-lease.v1";
  readonly orderId: string;
  readonly ownerSubjectId: string;
  readonly paymentKey: string;
  readonly acquiredAt: string;
  readonly reconcileAfter: string;
}

type PremiumUnpaidExpiryCandidateV1 =
  | {
      readonly schemaVersion: "namespring.premium-unpaid-expiry-candidate.v1";
      readonly kind: "report_bundle";
      readonly owner: PremiumEntitlementOwnerV1;
      readonly registrationId: string;
      readonly reportId: string;
      readonly analysisId: string;
      readonly openOrderCount: number;
      readonly expiresAt: string;
    }
  | {
      readonly schemaVersion: "namespring.premium-unpaid-expiry-candidate.v1";
      readonly kind: "ready_order";
      readonly owner: PremiumEntitlementOwnerV1;
      readonly internalUserId: string;
      readonly checkoutRequestId: string;
      readonly orderId: string;
      readonly reportId: string;
      /** Missing means true for pre-field launch fixtures. */
      readonly locksReportCheckout?: boolean;
      readonly expiresAt: string;
    };

const PREMIUM_REPORT_UNPURCHASED_TTL_MS = 24 * 60 * 60 * 1_000;
const PREMIUM_READY_ORDER_TTL_MS = 30 * 60 * 1_000;
const PREMIUM_EXPIRY_RECEIPT_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const PREMIUM_UNPAID_EXPIRY_BATCH_LIMIT_V1 = 20;

const SENSITIVE_COLLECTIONS = new Set<string>([
  COLLECTIONS.registrations,
  COLLECTIONS.reports,
  COLLECTIONS.analyses,
  COLLECTIONS.checkoutRequests,
  COLLECTIONS.orders,
  COLLECTIONS.providerKeys,
  COLLECTIONS.entitlements,
  COLLECTIONS.entitlementGrants,
  COLLECTIONS.deliveryRequests,
  COLLECTIONS.contentArtifacts,
  COLLECTIONS.activeContent,
  COLLECTIONS.contentTemplates,
  COLLECTIONS.activeTemplates,
  COLLECTIONS.contentReviews,
  COLLECTIONS.audit,
  COLLECTIONS.ownerResources,
  COLLECTIONS.retainedPayments,
  COLLECTIONS.deletionReceipts,
  COLLECTIONS.unpaidExpiryCandidates,
]);

function registrationKey(owner: PremiumEntitlementOwnerV1, requestId: string): string {
  return premiumDocumentKey(owner.kind, owner.subjectId, requestId);
}

function activeContentKey(binding: PremiumReportBindingV1): string {
  return premiumDocumentKey(binding.reportId, binding.productId, binding.contentVersion);
}

function activeTemplateKey(productId: string, contentVersion: string, selectorKey: string): string {
  return premiumDocumentKey(productId, contentVersion, selectorKey);
}

function activationForArtifact(artifact: PremiumContentArtifactRecordV1): PremiumContentActivationBindingV1 | null {
  return artifact.activation ? {
    sourceKind: "report_artifact",
    resourceId: artifact.artifactId,
    activationId: artifact.activation.activationId,
    immutableContentDigest: artifact.activation.immutableContentDigest,
  } : null;
}

function activationForTemplate(template: PremiumContentTemplateRecordV1): PremiumContentActivationBindingV1 | null {
  return template.activation ? {
    sourceKind: "case_template",
    resourceId: template.templateId,
    activationId: template.activation.activationId,
    immutableContentDigest: template.activation.immutableContentDigest,
    selectorKey: template.selectorKey,
  } : null;
}

function checkoutKey(owner: PremiumEntitlementOwnerV1, requestId: string): string {
  return premiumDocumentKey(owner.kind, owner.subjectId, requestId);
}

function deliveryKey(owner: PremiumEntitlementOwnerV1, requestId: string): string {
  return premiumDocumentKey(owner.kind, owner.subjectId, requestId);
}

function ownerResourceRootId(owner: PremiumEntitlementOwnerV1): string {
  return premiumDocumentKey(owner.kind, owner.subjectId);
}

function unpaidExpiryCandidateId(kind: PremiumUnpaidExpiryCandidateV1["kind"], resourceId: string): string {
  return premiumDocumentKey("premium-unpaid-expiry-v1", kind, resourceId);
}

function unpaidExpiryCandidateRef(
  db: ReturnType<typeof getFirestoreDb>,
  kind: PremiumUnpaidExpiryCandidateV1["kind"],
  resourceId: string,
) {
  return db.collection(COLLECTIONS.unpaidExpiryCandidates)
    .doc(unpaidExpiryCandidateId(kind, resourceId));
}

function ownerResourceIndexRef(
  db: ReturnType<typeof getFirestoreDb>,
  owner: PremiumEntitlementOwnerV1,
  collection: string,
  id: string,
) {
  return db.collection(COLLECTIONS.ownerResources)
    .doc(ownerResourceRootId(owner)).collection("items")
    .doc(premiumDocumentKey(collection, id));
}

function deleteOwnerResourceIndex(
  transaction: Transaction,
  db: ReturnType<typeof getFirestoreDb>,
  owner: PremiumEntitlementOwnerV1,
  collection: string,
  id: string,
): void {
  transaction.delete(ownerResourceIndexRef(db, owner, collection, id));
}

function indexOwnerResource(
  transaction: Transaction,
  owner: PremiumEntitlementOwnerV1,
  collection: string,
  id: string,
): void {
  const ref = getFirestoreDb().collection(COLLECTIONS.ownerResources)
    .doc(ownerResourceRootId(owner)).collection("items")
    .doc(premiumDocumentKey(collection, id));
  transaction.set(ref, sealPremiumJsonRecordV1(
    `${COLLECTIONS.ownerResources}/${ownerResourceRootId(owner)}/items/${ref.id}`,
    { collection, id },
  ), { merge: false });
}

function ownerResourceIndexValue(
  ownerRootId: string,
  id: string,
  value: DocumentData,
): { collection?: unknown; id?: unknown } {
  return openPremiumJsonRecordV1(
    `${COLLECTIONS.ownerResources}/${ownerRootId}/items/${id}`,
    value,
  );
}

function requireAdmin(actor: PremiumActorV1): void {
  if (!actor.roles.includes("premium_admin") && !actor.roles.includes("premium_system")) {
    throw new ApiHttpError(403, "PREMIUM_ADMIN_REQUIRED", "Premium administrator role is required.");
  }
}

async function transactionGet<T>(transaction: Transaction, collection: string, id: string): Promise<T | null> {
  const reference = getFirestoreDb().collection(collection).doc(id);
  const snapshot = await transaction.get(reference);
  if (!snapshot.exists) return null;
  const value = snapshot.data();
  return SENSITIVE_COLLECTIONS.has(collection)
    ? openPremiumJsonRecordV1<T>(`${collection}/${id}`, value)
    : value as T;
}

async function transactionGetReview(
  transaction: Transaction,
  receiptId: string,
): Promise<PremiumContentReviewReceiptV1 | null> {
  const raw = await transactionGet<unknown>(transaction, COLLECTIONS.contentReviews, receiptId);
  return raw === null ? null : assertPremiumContentReviewReceiptV1(raw);
}

function reviewReceiptSameRequest(
  existing: PremiumContentReviewReceiptV1,
  proposed: PremiumContentReviewReceiptV1,
): boolean {
  return existing.receiptId === proposed.receiptId
    && existing.requestId === proposed.requestId
    && existing.resourceKind === proposed.resourceKind
    && existing.resourceId === proposed.resourceId
    && existing.reportId === proposed.reportId
    && existing.analysisId === proposed.analysisId
    && existing.productId === proposed.productId
    && existing.contentVersion === proposed.contentVersion
    && existing.selectorKey === proposed.selectorKey
    && existing.reviewedMaterialDigest === proposed.reviewedMaterialDigest
    && existing.notesDigest === proposed.notesDigest
    && existing.decision === proposed.decision;
}

function assertReviewReceiptActivationContext(input: {
  readonly receipt: PremiumContentReviewReceiptV1;
  readonly resourceKind: "report_artifact" | "case_template";
  readonly resourceId: string;
  readonly report: PremiumReportReferenceV1;
  readonly selectorKey: string | null;
  readonly reviewedMaterialDigest: `sha256:${string}`;
  readonly activator: PremiumActorV1;
  readonly activatedAt: string;
}): void {
  const { receipt, report } = input;
  if (receipt.resourceKind !== input.resourceKind || receipt.resourceId !== input.resourceId
    || receipt.reportId !== report.binding.reportId || receipt.analysisId !== report.binding.analysisId
    || receipt.productId !== report.binding.productId || receipt.contentVersion !== report.binding.contentVersion
    || receipt.selectorKey !== input.selectorKey
    || receipt.reviewedMaterialDigest !== input.reviewedMaterialDigest) {
    throw new ApiHttpError(409, "PREMIUM_REVIEW_BINDING_MISMATCH", "Review receipt does not authorize this exact material.");
  }
  if (premiumAuditSubjectMatchesV2(
    "actor",
    input.activator.userId,
    receipt.reviewer.actorSubject,
    getPremiumAuditHmacKeyringV1(),
  )) {
    throw new ApiHttpError(
      409,
      "PREMIUM_INDEPENDENT_APPROVAL_REQUIRED",
      "Content reviewer and activator must be different authenticated principals.",
    );
  }
  if (Date.parse(input.activatedAt) < Date.parse(receipt.reviewedAt)) {
    throw new ApiHttpError(409, "PREMIUM_REVIEW_CHRONOLOGY_INVALID", "Activation predates the server review.");
  }
}

function storedValue(collection: string, id: string, value: unknown): unknown {
  if (!SENSITIVE_COLLECTIONS.has(collection)) return value;
  const sealed = sealPremiumJsonRecordV1(`${collection}/${id}`, value);
  if (collection === COLLECTIONS.audit || collection === COLLECTIONS.retainedPayments
    || collection === COLLECTIONS.deletionReceipts || collection === COLLECTIONS.contentReviews) {
    const deleteAfter = (value as { deleteAfter?: unknown })?.deleteAfter;
    if (typeof deleteAfter !== "string" || !Number.isFinite(Date.parse(deleteAfter))) {
      throw new ApiHttpError(500, "PREMIUM_RETENTION_INVALID", "Record deleteAfter is invalid.");
    }
    return { ...sealed, deleteAfter: Timestamp.fromDate(new Date(deleteAfter)) };
  }
  return sealed;
}

function transactionCreate(
  transaction: Transaction,
  collection: string,
  id: string,
  value: unknown,
): void {
  transaction.create(
    getFirestoreDb().collection(collection).doc(id),
    storedValue(collection, id, value) as DocumentData,
  );
}

function transactionSet(
  transaction: Transaction,
  collection: string,
  id: string,
  value: unknown,
): void {
  transaction.set(
    getFirestoreDb().collection(collection).doc(id),
    storedValue(collection, id, value) as DocumentData,
    { merge: false },
  );
}

function snapshotValue<T>(collection: string, id: string, value: DocumentData): T {
  return SENSITIVE_COLLECTIONS.has(collection)
    ? openPremiumJsonRecordV1<T>(`${collection}/${id}`, value)
    : value as T;
}

function canonicalUtc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return null;
  const canonical = new Date(epoch).toISOString();
  return canonical === value ? canonical : null;
}

function addDurationUtc(value: string, durationMs: number): string {
  const canonical = canonicalUtc(value);
  if (!canonical || !Number.isSafeInteger(durationMs) || durationMs <= 0) {
    throw new ApiHttpError(500, "PREMIUM_EXPIRY_TIME_INVALID", "Premium expiry time is invalid.");
  }
  return new Date(Date.parse(canonical) + durationMs).toISOString();
}

function assertUnpaidExpiryCandidate(value: PremiumUnpaidExpiryCandidateV1): void {
  const baseValid = value?.schemaVersion === "namespring.premium-unpaid-expiry-candidate.v1"
    && (value.kind === "report_bundle" || value.kind === "ready_order")
    && value.owner?.kind === "account"
    && typeof value.owner.subjectId === "string" && value.owner.subjectId.length <= 256
    && canonicalUtc(value.expiresAt) !== null;
  const resourceId = /^[A-Za-z0-9_-]{1,256}$/u;
  const valid = baseValid && (value.kind === "report_bundle"
    ? resourceId.test(value.registrationId) && resourceId.test(value.reportId)
      && resourceId.test(value.analysisId) && Number.isSafeInteger(value.openOrderCount)
      && value.openOrderCount >= 0 && value.openOrderCount <= 1
    : resourceId.test(value.internalUserId) && resourceId.test(value.checkoutRequestId)
      && resourceId.test(value.orderId) && resourceId.test(value.reportId)
      && (value.locksReportCheckout === undefined || typeof value.locksReportCheckout === "boolean"));
  if (!valid) {
    throw new ApiHttpError(500, "PREMIUM_EXPIRY_CANDIDATE_CORRUPT", "Premium expiry candidate is invalid.");
  }
}

function unpaidExpiryStoredValue(id: string, value: PremiumUnpaidExpiryCandidateV1): DocumentData {
  assertUnpaidExpiryCandidate(value);
  return {
    ...sealPremiumJsonRecordV1(`${COLLECTIONS.unpaidExpiryCandidates}/${id}`, value),
    expiresAt: Timestamp.fromDate(new Date(value.expiresAt)),
  };
}

function transactionCreateUnpaidExpiry(
  transaction: Transaction,
  db: ReturnType<typeof getFirestoreDb>,
  value: PremiumUnpaidExpiryCandidateV1,
): string {
  const resourceId = value.kind === "report_bundle" ? value.reportId : value.orderId;
  const id = unpaidExpiryCandidateId(value.kind, resourceId);
  transaction.create(db.collection(COLLECTIONS.unpaidExpiryCandidates).doc(id), unpaidExpiryStoredValue(id, value));
  return id;
}

function transactionSetUnpaidExpiry(
  transaction: Transaction,
  db: ReturnType<typeof getFirestoreDb>,
  value: PremiumUnpaidExpiryCandidateV1,
): string {
  const resourceId = value.kind === "report_bundle" ? value.reportId : value.orderId;
  const id = unpaidExpiryCandidateId(value.kind, resourceId);
  transaction.set(
    db.collection(COLLECTIONS.unpaidExpiryCandidates).doc(id),
    unpaidExpiryStoredValue(id, value),
    { merge: false },
  );
  return id;
}

async function transactionGetUnpaidExpiry(
  transaction: Transaction,
  db: ReturnType<typeof getFirestoreDb>,
  kind: PremiumUnpaidExpiryCandidateV1["kind"],
  resourceId: string,
): Promise<PremiumUnpaidExpiryCandidateV1 | null> {
  const id = unpaidExpiryCandidateId(kind, resourceId);
  const snapshot = await transaction.get(db.collection(COLLECTIONS.unpaidExpiryCandidates).doc(id));
  if (!snapshot.exists) return null;
  return unpaidExpirySnapshotValue(id, snapshot.data());
}

function unpaidExpirySnapshotValue(
  id: string,
  data: DocumentData | undefined,
): PremiumUnpaidExpiryCandidateV1 {
  if (!data) {
    throw new ApiHttpError(500, "PREMIUM_EXPIRY_CANDIDATE_CORRUPT", "Premium expiry candidate is missing.");
  }
  const due = data.expiresAt;
  if (!(due instanceof Timestamp)) {
    throw new ApiHttpError(500, "PREMIUM_EXPIRY_CANDIDATE_CORRUPT", "Premium expiry due time is invalid.");
  }
  const value = openPremiumJsonRecordV1<PremiumUnpaidExpiryCandidateV1>(
    `${COLLECTIONS.unpaidExpiryCandidates}/${id}`,
    data,
  );
  assertUnpaidExpiryCandidate(value);
  const expectedId = unpaidExpiryCandidateId(
    value.kind,
    value.kind === "report_bundle" ? value.reportId : value.orderId,
  );
  if (expectedId !== id || due.toDate().toISOString() !== value.expiresAt) {
    throw new ApiHttpError(500, "PREMIUM_EXPIRY_CANDIDATE_CORRUPT", "Premium expiry candidate metadata is inconsistent.");
  }
  return value;
}

function completeUnpaidExpiryCandidate(
  transaction: Transaction,
  db: ReturnType<typeof getFirestoreDb>,
  candidate: PremiumUnpaidExpiryCandidateV1,
  completedAt: string,
): void {
  const resourceId = candidate.kind === "report_bundle" ? candidate.reportId : candidate.orderId;
  const id = unpaidExpiryCandidateId(candidate.kind, resourceId);
  transaction.delete(db.collection(COLLECTIONS.unpaidExpiryCandidates).doc(id));
  deleteOwnerResourceIndex(transaction, db, candidate.owner, COLLECTIONS.unpaidExpiryCandidates, id);
  transaction.set(db.collection(COLLECTIONS.unpaidExpiryReceipts).doc(id), {
    schemaVersion: "namespring.premium-unpaid-expiry-receipt.v1",
    kind: candidate.kind,
    completedAt,
    deleteAfter: Timestamp.fromDate(new Date(addDurationUtc(completedAt, PREMIUM_EXPIRY_RECEIPT_TTL_MS))),
  }, { merge: false });
}

function releaseReadyOrderExpiryAfterTerminalNoGrant(
  transaction: Transaction,
  db: ReturnType<typeof getFirestoreDb>,
  order: PremiumPaymentOrderRecordV1,
  orderExpiry: PremiumUnpaidExpiryCandidateV1 | null,
  reportExpiry: PremiumUnpaidExpiryCandidateV1 | null,
  completedAt: string,
): void {
  if (!orderExpiry || orderExpiry.kind !== "ready_order"
    || !reportExpiry || reportExpiry.kind !== "report_bundle"
    || orderExpiry.orderId !== order.orderId
    || orderExpiry.reportId !== order.binding.reportId
    || reportExpiry.reportId !== order.binding.reportId
    || reportExpiry.analysisId !== order.binding.analysisId
    || !sameOwner(orderExpiry.owner, order.owner)
    || !sameOwner(reportExpiry.owner, order.owner)) {
    throw new ApiHttpError(
      503,
      "PREMIUM_EXPIRY_STATE_INVALID",
      "Terminal unpaid order expiry state is unavailable or requires migration.",
    );
  }
  if (orderExpiry.locksReportCheckout === false) return;
  if (reportExpiry.openOrderCount < 1) {
    throw new ApiHttpError(
      503,
      "PREMIUM_EXPIRY_STATE_INVALID",
      "Terminal unpaid order checkout count is inconsistent.",
    );
  }
  transactionSetUnpaidExpiry(transaction, db, {
    ...orderExpiry,
    locksReportCheckout: false,
  });
  transactionSetUnpaidExpiry(transaction, db, {
    ...reportExpiry,
    openOrderCount: reportExpiry.openOrderCount - 1,
  });
}

function assertPaymentLeaseRecord(
  value: AccountPaymentLeaseRecordV1,
  dueAt: string,
): void {
  const acquiredAt = canonicalUtc(value.acquiredAt);
  const reconcileAfter = canonicalUtc(value.reconcileAfter);
  if (value.schemaVersion !== "namespring.account-payment-lease.v1"
    || typeof value.orderId !== "string" || !value.orderId || value.orderId.length > 256
    || typeof value.ownerSubjectId !== "string" || !value.ownerSubjectId || value.ownerSubjectId.length > 256
    || typeof value.paymentKey !== "string" || !value.paymentKey || value.paymentKey.length > 256
    || !acquiredAt || !reconcileAfter || reconcileAfter !== dueAt
    || Date.parse(acquiredAt) > Date.parse(reconcileAfter)) {
    throw new ApiHttpError(500, "PREMIUM_PAYMENT_LEASE_CORRUPT", "Payment reconciliation lease is invalid.");
  }
}

function assertLeaseMatchesOrder(
  order: PremiumPaymentOrderRecordV1,
  lease: AccountPaymentLeaseRecordV1,
  internalUserId: string,
): "scheduled" | "settled" {
  const recoveryMatches = order.paymentRecovery?.status === "scheduled"
    ? order.paymentRecovery.dueAt === lease.reconcileAfter
    : order.paymentRecovery?.status === "settled" && order.paymentRecovery.dueAt === null;
  if (order.orderId !== lease.orderId || order.accountWriteSubjectId !== internalUserId
    || order.owner.kind !== "account" || order.owner.subjectId !== lease.ownerSubjectId
    || (order.paymentKey !== null && order.paymentKey !== lease.paymentKey)
    || !recoveryMatches
    || !["ready", "paid", "failed", "refunded", "revoked"].includes(order.status)) {
    throw new ApiHttpError(409, "PREMIUM_PAYMENT_LEASE_CONFLICT", "Payment lease no longer matches its order.");
  }
  return order.paymentRecovery.status === "settled" ? "settled" : "scheduled";
}

function assertLeaseMatchesRetainedPayment(
  payment: PremiumRetainedPaymentRecordV1,
  lease: AccountPaymentLeaseRecordV1,
): "scheduled" | "settled" {
  const recoveryMatches = payment.paymentRecovery?.status === "scheduled"
    ? payment.paymentRecovery.dueAt === lease.reconcileAfter
    : payment.paymentRecovery?.status === "settled" && payment.paymentRecovery.dueAt === null;
  if (payment.schemaVersion !== "namespring.retained-payment.v1"
    || payment.orderId !== lease.orderId || payment.paymentKey !== lease.paymentKey
    || !recoveryMatches
    || !["paid", "failed", "refunded", "revoked"].includes(payment.status)) {
    throw new ApiHttpError(409, "PREMIUM_PAYMENT_LEASE_CONFLICT", "Payment lease no longer matches retained payment state.");
  }
  return payment.paymentRecovery.status === "settled" ? "settled" : "scheduled";
}

function settledPaymentRecovery(at: string): PremiumPaymentOrderRecordV1["paymentRecovery"] {
  const updatedAt = canonicalUtc(at);
  if (!updatedAt) {
    throw new ApiHttpError(500, "PREMIUM_PAYMENT_RECOVERY_TIME_INVALID", "Payment recovery time is invalid.");
  }
  return { status: "settled", updatedAt, dueAt: null };
}

function providerStateIsTerminalForLease(
  payment: Pick<PremiumPaymentOrderRecordV1, "status" | "amount" | "providerState">,
): boolean {
  const state = payment.providerState;
  if (!state || state.totalAmount !== payment.amount) return false;
  if ((payment.status === "paid" || payment.status === "revoked")
    && state.status === "DONE" && state.balanceAmount === payment.amount) return true;
  if (payment.status === "refunded"
    && state.status === "CANCELED" && state.balanceAmount === 0) return true;
  return payment.status === "failed"
    && ["CANCELED", "ABORTED", "EXPIRED"].includes(state.status)
    && state.balanceAmount === 0;
}

async function transactionGetActivation(
  transaction: Transaction,
  binding: PremiumReportBindingV1,
  expected: PremiumContentActivationBindingV1,
): Promise<PremiumContentActivationBindingV1 | null> {
  if (expected.sourceKind === "report_artifact") {
    const artifact = await transactionGet<PremiumContentArtifactRecordV1>(
      transaction, COLLECTIONS.activeContent, activeContentKey(binding),
    );
    if (!artifact || artifact.lifecycle !== "active" || artifact.reportId !== binding.reportId
      || artifact.productId !== binding.productId || artifact.contentVersion !== binding.contentVersion) return null;
    return activationForArtifact(artifact);
  }
  if (!expected.selectorKey) return null;
  const template = await transactionGet<PremiumContentTemplateRecordV1>(
    transaction,
    COLLECTIONS.activeTemplates,
    activeTemplateKey(binding.productId, binding.contentVersion, expected.selectorKey),
  );
  if (!template || template.lifecycle !== "active" || template.productId !== binding.productId
    || template.contentVersion !== binding.contentVersion || template.selectorKey !== expected.selectorKey) return null;
  return activationForTemplate(template);
}

/**
 * Resolve a purchased immutable resource, independent of the active pointer.
 * Active pointers are checkout eligibility only. Soft retirement stops new
 * sales but does not silently destroy an already purchased delivery.
 */
async function transactionGetPinnedResource(
  transaction: Transaction,
  binding: PremiumReportBindingV1,
  expected: PremiumContentActivationBindingV1,
): Promise<{
  readonly activation: PremiumContentActivationBindingV1;
  readonly content: PremiumContentArtifactRecordV1 | null;
  readonly template: PremiumContentTemplateRecordV1 | null;
} | null> {
  if (expected.sourceKind === "report_artifact") {
    const artifact = await transactionGet<PremiumContentArtifactRecordV1>(
      transaction, COLLECTIONS.contentArtifacts, expected.resourceId,
    );
    const activation = artifact ? activationForArtifact(artifact) : null;
    if (!artifact || !activation || !["active", "retired"].includes(artifact.lifecycle)
      || artifact.reportId !== binding.reportId || artifact.productId !== binding.productId
      || artifact.contentVersion !== binding.contentVersion || !sameActivation(activation, expected)) return null;
    return { activation, content: artifact, template: null };
  }
  if (!expected.selectorKey) return null;
  const template = await transactionGet<PremiumContentTemplateRecordV1>(
    transaction, COLLECTIONS.contentTemplates, expected.resourceId,
  );
  const activation = template ? activationForTemplate(template) : null;
  if (!template || !activation || !["active", "retired"].includes(template.lifecycle)
    || template.productId !== binding.productId || template.contentVersion !== binding.contentVersion
    || template.selectorKey !== expected.selectorKey || !sameActivation(activation, expected)) return null;
  return { activation, content: null, template };
}

export class FirestorePremiumRepositoryV1 implements PremiumRepositoryV1 {
  async getRegistration(owner: PremiumEntitlementOwnerV1, requestId: string) {
    const db = getFirestoreDb();
    const index = await db.collection(COLLECTIONS.registrations)
      .doc(registrationKey(owner, requestId)).get();
    if (!index.exists) return null;
    const record = snapshotValue<RegistrationIndexRecordV1>(
      COLLECTIONS.registrations,
      registrationKey(owner, requestId),
      index.data()!,
    );
    const report = await this.getReport(record.reportId);
    if (!report || !sameOwner(record.owner, owner) || record.requestId !== requestId) {
      throw new ApiHttpError(500, "PREMIUM_REGISTRATION_CORRUPT", "Registration index is inconsistent.");
    }
    if (!/^sha256:[a-f0-9]{64}$/u.test(record.consentAcceptanceDigest)) {
      throw new ApiHttpError(503, "PREMIUM_CONSENT_MIGRATION_REQUIRED", "Registration consent binding requires migration.");
    }
    return {
      materialDigest: record.materialDigest,
      consentAcceptanceDigest: record.consentAcceptanceDigest,
      report,
    };
  }

  async commitRegistration(input: PremiumRegistrationCommitV1) {
    const db = getFirestoreDb();
    const key = registrationKey(input.report.registration.owner, input.report.registration.requestId);
    return db.runTransaction(async (transaction) => {
      await assertAccountWriteAllowedV1(transaction, db, input.internalUserId);
      const existing = await transactionGet<RegistrationIndexRecordV1>(transaction, COLLECTIONS.registrations, key);
      if (existing) {
        const report = await transactionGet<PremiumReportReferenceV1>(transaction, COLLECTIONS.reports, existing.reportId);
        if (!report || existing.materialDigest !== input.report.registration.materialDigest
          || existing.consentAcceptanceDigest !== input.analysis.dataProcessingConsent.acceptanceDigest
          || !sameOwner(existing.owner, input.report.registration.owner)) {
          throw new ApiHttpError(409, "PREMIUM_IDEMPOTENCY_CONFLICT", "Registration key was reused with different material.");
        }
        return { report, mode: "idempotent_replay" as const };
      }
      transactionCreate(transaction, COLLECTIONS.reports, input.report.binding.reportId, input.report);
      transactionCreate(transaction, COLLECTIONS.analyses, input.analysis.analysisId, input.analysis);
      transactionCreate(transaction, COLLECTIONS.registrations, key, {
        owner: input.report.registration.owner,
        requestId: input.report.registration.requestId,
        materialDigest: input.report.registration.materialDigest,
        consentAcceptanceDigest: input.analysis.dataProcessingConsent.acceptanceDigest,
        reportId: input.report.binding.reportId,
        createdAt: input.report.registeredAt,
      } satisfies RegistrationIndexRecordV1);
      transactionCreate(transaction, COLLECTIONS.audit, input.audit.auditId, input.audit);
      const expiryCandidateId = transactionCreateUnpaidExpiry(transaction, db, {
        schemaVersion: "namespring.premium-unpaid-expiry-candidate.v1",
        kind: "report_bundle",
        owner: input.report.registration.owner,
        registrationId: key,
        reportId: input.report.binding.reportId,
        analysisId: input.analysis.analysisId,
        openOrderCount: 0,
        expiresAt: addDurationUtc(input.report.registeredAt, PREMIUM_REPORT_UNPURCHASED_TTL_MS),
      });
      indexOwnerResource(transaction, input.report.registration.owner, COLLECTIONS.registrations, key);
      indexOwnerResource(transaction, input.report.registration.owner, COLLECTIONS.reports, input.report.binding.reportId);
      indexOwnerResource(transaction, input.report.registration.owner, COLLECTIONS.analyses, input.analysis.analysisId);
      indexOwnerResource(transaction, input.report.registration.owner, COLLECTIONS.audit, input.audit.auditId);
      indexOwnerResource(
        transaction,
        input.report.registration.owner,
        COLLECTIONS.unpaidExpiryCandidates,
        expiryCandidateId,
      );
      return { report: input.report, mode: "initial" as const };
    });
  }

  async getReport(reportId: string) {
    const snapshot = await getFirestoreDb().collection(COLLECTIONS.reports).doc(reportId).get();
    return snapshot.exists
      ? snapshotValue<PremiumReportReferenceV1>(COLLECTIONS.reports, reportId, snapshot.data()!)
      : null;
  }

  async getAnalysis(analysisId: string) {
    const snapshot = await getFirestoreDb().collection(COLLECTIONS.analyses).doc(analysisId).get();
    return snapshot.exists
      ? snapshotValue<PremiumServerAnalysisRecordV1>(COLLECTIONS.analyses, analysisId, snapshot.data()!)
      : null;
  }

  async getActiveContent(binding: PremiumReportBindingV1) {
    const id = activeContentKey(binding);
    const snapshot = await getFirestoreDb().collection(COLLECTIONS.activeContent).doc(id).get();
    return snapshot.exists
      ? snapshotValue<PremiumContentArtifactRecordV1>(COLLECTIONS.activeContent, id, snapshot.data()!)
      : null;
  }

  async getActiveTemplate(input: { productId: string; contentVersion: string; selectorKeys: readonly string[] }) {
    const db = getFirestoreDb();
    for (const selectorKey of input.selectorKeys) {
      const snapshot = await db.collection(COLLECTIONS.activeTemplates)
        .doc(activeTemplateKey(input.productId, input.contentVersion, selectorKey)).get();
      if (snapshot.exists) return snapshotValue<PremiumContentTemplateRecordV1>(
        COLLECTIONS.activeTemplates,
        activeTemplateKey(input.productId, input.contentVersion, selectorKey),
        snapshot.data()!,
      );
    }
    return null;
  }

  async getContentReviewReceipt(receiptId: string) {
    const snapshot = await getFirestoreDb().collection(COLLECTIONS.contentReviews).doc(receiptId).get();
    if (!snapshot.exists) return null;
    return assertPremiumContentReviewReceiptV1(snapshotValue<unknown>(
      COLLECTIONS.contentReviews,
      receiptId,
      snapshot.data()!,
    ));
  }

  async createContentReview(input: {
    receipt: PremiumContentReviewReceiptV1;
    reviewer: PremiumActorV1;
    audit: PremiumAuditEventV1;
  }) {
    requireAdmin(input.reviewer);
    const proposed = assertPremiumContentReviewReceiptV1(input.receipt);
    if (!premiumAuditSubjectMatchesV2(
      "actor",
      input.reviewer.userId,
      proposed.reviewer.actorSubject,
      getPremiumAuditHmacKeyringV1(),
    )) {
      throw new ApiHttpError(403, "PREMIUM_REVIEW_PRINCIPAL_MISMATCH", "Review receipt principal is not the authenticated reviewer.");
    }
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      const report = await transactionGet<PremiumReportReferenceV1>(
        transaction,
        COLLECTIONS.reports,
        proposed.reportId,
      );
      if (!report || report.status !== "registered"
        || report.binding.analysisId !== proposed.analysisId
        || report.binding.productId !== proposed.productId
        || report.binding.contentVersion !== proposed.contentVersion) {
        throw new ApiHttpError(409, "PREMIUM_REVIEW_BINDING_MISMATCH", "Review/report binding is invalid.");
      }
      const existing = await transactionGetReview(transaction, proposed.receiptId);
      if (existing) {
        if (!reviewReceiptSameRequest(existing, proposed)
          || !premiumAuditSubjectMatchesV2(
            "actor",
            input.reviewer.userId,
            existing.reviewer.actorSubject,
            getPremiumAuditHmacKeyringV1(),
          )) {
          throw new ApiHttpError(409, "PREMIUM_REVIEW_IDEMPOTENCY_CONFLICT", "Review request was reused with different material.");
        }
        return { receipt: existing, mode: "idempotent_replay" as const };
      }
      transactionCreate(transaction, COLLECTIONS.contentReviews, proposed.receiptId, proposed);
      transactionCreate(transaction, COLLECTIONS.audit, input.audit.auditId, input.audit);
      indexOwnerResource(transaction, report.registration.owner, COLLECTIONS.audit, input.audit.auditId);
      return { receipt: proposed, mode: "initial" as const };
    });
  }

  async activateContent(input: {
    artifact: PremiumContentArtifactRecordV1;
    reviewReceiptId: string;
    activationRequestId: string;
    reviewedMaterialDigest: `sha256:${string}`;
    activator: PremiumActorV1;
    audit: PremiumAuditEventV1;
  }) {
    requireAdmin(input.activator);
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      const report = await transactionGet<PremiumReportReferenceV1>(
        transaction, COLLECTIONS.reports, input.artifact.reportId,
      );
      if (!report || report.status !== "registered"
        || report.binding.productId !== input.artifact.productId
        || report.binding.contentVersion !== input.artifact.contentVersion) {
        throw new ApiHttpError(409, "PREMIUM_CONTENT_BINDING_MISMATCH", "Content/report binding is invalid.");
      }
      if (premiumArtifactReviewedMaterialDigestV1(input.artifact, report.binding)
        !== input.reviewedMaterialDigest) {
        throw new ApiHttpError(409, "PREMIUM_REVIEW_BINDING_MISMATCH", "Activation material digest changed before persistence.");
      }
      const receipt = await transactionGetReview(transaction, input.reviewReceiptId);
      if (!receipt) {
        throw new ApiHttpError(409, "PREMIUM_REVIEW_RECEIPT_UNAVAILABLE", "Review receipt is missing or expired.");
      }
      assertReviewReceiptActivationContext({
        receipt,
        resourceKind: "report_artifact",
        resourceId: input.artifact.artifactId,
        report,
        selectorKey: null,
        reviewedMaterialDigest: input.reviewedMaterialDigest,
        activator: input.activator,
        activatedAt: input.artifact.activation!.activatedAt,
      });
      if (input.artifact.activation?.reviewReceiptId !== receipt.receiptId) {
        throw new ApiHttpError(409, "PREMIUM_REVIEW_BINDING_MISMATCH", "Activation is not bound to the sealed review receipt.");
      }
      const activatorSubject = premiumAuditActorV2(input.activator, getPremiumAuditHmacKeyringV1()).userId;
      if (input.artifact.activation.activatedBy !== activatorSubject) {
        throw new ApiHttpError(403, "PREMIUM_ACTIVATOR_SUBJECT_MISMATCH", "Activation principal binding is invalid.");
      }
      const pointerRef = db.collection(COLLECTIONS.activeContent).doc(activeContentKey(report.binding));
      const pointer = await transaction.get(pointerRef);
      if (receipt.status === "consumed") {
        const consumption = receipt.consumption!;
        const existing = pointer.exists ? snapshotValue<PremiumContentArtifactRecordV1>(
          COLLECTIONS.activeContent, activeContentKey(report.binding), pointer.data()!,
        ) : null;
        if (premiumAuditSubjectMatchesV2(
          "actor", input.activator.userId, consumption.activatedBy, getPremiumAuditHmacKeyringV1(),
        )
          && consumption.activationRequestId === input.activationRequestId
          && consumption.activationId === input.artifact.activation?.activationId
          && consumption.immutableContentDigest === input.artifact.activation?.immutableContentDigest
          && existing?.artifactId === input.artifact.artifactId
          && existing.activation?.reviewReceiptId === receipt.receiptId
          && existing.activation.immutableContentDigest === consumption.immutableContentDigest) {
          return existing;
        }
        throw new ApiHttpError(409, "PREMIUM_REVIEW_RECEIPT_CONSUMED", "Review receipt has already been consumed.");
      }
      if (Date.parse(input.artifact.activation!.activatedAt) >= Date.parse(receipt.authorityExpiresAt)) {
        throw new ApiHttpError(409, "PREMIUM_REVIEW_AUTHORITY_EXPIRED", "Review authority expired before activation.");
      }
      if (pointer.exists) {
        throw new ApiHttpError(409, "PREMIUM_CONTENT_ALREADY_ACTIVE", "A different immutable content version is active.");
      }
      transactionCreate(transaction, COLLECTIONS.contentArtifacts, input.artifact.artifactId, input.artifact);
      transactionCreate(transaction, COLLECTIONS.activeContent, activeContentKey(report.binding), input.artifact);
      transactionSet(transaction, COLLECTIONS.contentReviews, receipt.receiptId, {
        ...receipt,
        status: "consumed",
        consumption: {
          activationId: input.artifact.activation!.activationId,
          activationRequestId: input.activationRequestId,
          activatedBy: activatorSubject,
          activatedAt: input.artifact.activation!.activatedAt,
          immutableContentDigest: input.artifact.activation!.immutableContentDigest,
        },
      } satisfies PremiumContentReviewReceiptV1);
      transactionCreate(transaction, COLLECTIONS.audit, input.audit.auditId, input.audit);
      indexOwnerResource(transaction, report.registration.owner, COLLECTIONS.contentArtifacts, input.artifact.artifactId);
      indexOwnerResource(transaction, report.registration.owner, COLLECTIONS.activeContent, activeContentKey(report.binding));
      indexOwnerResource(transaction, report.registration.owner, COLLECTIONS.audit, input.audit.auditId);
      return input.artifact;
    });
  }

  async activateTemplate(input: {
    template: PremiumContentTemplateRecordV1;
    sampleReportId: string;
    reviewReceiptId: string;
    activationRequestId: string;
    reviewedMaterialDigest: `sha256:${string}`;
    activator: PremiumActorV1;
    audit: PremiumAuditEventV1;
  }) {
    requireAdmin(input.activator);
    const db = getFirestoreDb();
    const pointerRef = db.collection(COLLECTIONS.activeTemplates).doc(activeTemplateKey(
      input.template.productId,
      input.template.contentVersion,
      input.template.selectorKey,
    ));
    return db.runTransaction(async (transaction) => {
      const report = await transactionGet<PremiumReportReferenceV1>(
        transaction,
        COLLECTIONS.reports,
        input.sampleReportId,
      );
      if (!report || report.status !== "registered"
        || report.binding.productId !== input.template.productId
        || report.binding.contentVersion !== input.template.contentVersion) {
        throw new ApiHttpError(409, "PREMIUM_TEMPLATE_BINDING_MISMATCH", "Template/sample binding is invalid.");
      }
      if (premiumTemplateReviewedMaterialDigestV1(input.template, report.binding)
        !== input.reviewedMaterialDigest) {
        throw new ApiHttpError(409, "PREMIUM_REVIEW_BINDING_MISMATCH", "Template material digest changed before persistence.");
      }
      const receipt = await transactionGetReview(transaction, input.reviewReceiptId);
      if (!receipt) {
        throw new ApiHttpError(409, "PREMIUM_REVIEW_RECEIPT_UNAVAILABLE", "Review receipt is missing or expired.");
      }
      assertReviewReceiptActivationContext({
        receipt,
        resourceKind: "case_template",
        resourceId: input.template.templateId,
        report,
        selectorKey: input.template.selectorKey,
        reviewedMaterialDigest: input.reviewedMaterialDigest,
        activator: input.activator,
        activatedAt: input.template.activation!.activatedAt,
      });
      if (input.template.activation?.reviewReceiptId !== receipt.receiptId) {
        throw new ApiHttpError(409, "PREMIUM_REVIEW_BINDING_MISMATCH", "Template activation is not bound to the sealed review receipt.");
      }
      const activatorSubject = premiumAuditActorV2(input.activator, getPremiumAuditHmacKeyringV1()).userId;
      if (input.template.activation.activatedBy !== activatorSubject) {
        throw new ApiHttpError(403, "PREMIUM_ACTIVATOR_SUBJECT_MISMATCH", "Template activation principal binding is invalid.");
      }
      const pointer = await transaction.get(pointerRef);
      if (receipt.status === "consumed") {
        const consumption = receipt.consumption!;
        const existing = pointer.exists ? snapshotValue<PremiumContentTemplateRecordV1>(
          COLLECTIONS.activeTemplates,
          activeTemplateKey(input.template.productId, input.template.contentVersion, input.template.selectorKey),
          pointer.data()!,
        ) : null;
        if (premiumAuditSubjectMatchesV2(
          "actor", input.activator.userId, consumption.activatedBy, getPremiumAuditHmacKeyringV1(),
        )
          && consumption.activationRequestId === input.activationRequestId
          && consumption.activationId === input.template.activation?.activationId
          && consumption.immutableContentDigest === input.template.activation?.immutableContentDigest
          && existing?.templateId === input.template.templateId
          && existing.activation?.reviewReceiptId === receipt.receiptId
          && existing.activation.immutableContentDigest === consumption.immutableContentDigest) {
          return existing;
        }
        throw new ApiHttpError(409, "PREMIUM_REVIEW_RECEIPT_CONSUMED", "Review receipt has already been consumed.");
      }
      if (Date.parse(input.template.activation!.activatedAt) >= Date.parse(receipt.authorityExpiresAt)) {
        throw new ApiHttpError(409, "PREMIUM_REVIEW_AUTHORITY_EXPIRED", "Review authority expired before activation.");
      }
      if (pointer.exists) {
        throw new ApiHttpError(409, "PREMIUM_TEMPLATE_ALREADY_ACTIVE", "A different template is active for this selector.");
      }
      transactionCreate(transaction, COLLECTIONS.contentTemplates, input.template.templateId, input.template);
      transactionCreate(
        transaction,
        COLLECTIONS.activeTemplates,
        activeTemplateKey(input.template.productId, input.template.contentVersion, input.template.selectorKey),
        input.template,
      );
      transactionSet(transaction, COLLECTIONS.contentReviews, receipt.receiptId, {
        ...receipt,
        status: "consumed",
        consumption: {
          activationId: input.template.activation!.activationId,
          activationRequestId: input.activationRequestId,
          activatedBy: activatorSubject,
          activatedAt: input.template.activation!.activatedAt,
          immutableContentDigest: input.template.activation!.immutableContentDigest,
        },
      } satisfies PremiumContentReviewReceiptV1);
      transactionCreate(transaction, COLLECTIONS.audit, input.audit.auditId, input.audit);
      indexOwnerResource(transaction, input.audit.owner, COLLECTIONS.audit, input.audit.auditId);
      return input.template;
    });
  }

  async retireContent(input: {
    binding: PremiumReportBindingV1;
    activation: PremiumContentActivationBindingV1;
    retiredAt: string;
    audit: PremiumAuditEventV1;
  }) {
    const db = getFirestoreDb();
    await db.runTransaction(async (transaction) => {
      if (input.activation.sourceKind === "report_artifact") {
        const pointerRef = db.collection(COLLECTIONS.activeContent).doc(activeContentKey(input.binding));
        const pointer = await transaction.get(pointerRef);
        const artifact = pointer.exists
          ? snapshotValue<PremiumContentArtifactRecordV1>(
              COLLECTIONS.activeContent, activeContentKey(input.binding), pointer.data()!,
            )
          : null;
        const current = artifact ? activationForArtifact(artifact) : null;
        if (!artifact || !current || !sameActivation(current, input.activation)) {
          throw new ApiHttpError(409, "PREMIUM_CONTENT_ACTIVATION_MISMATCH", "Report content activation changed.");
        }
        transactionSet(transaction, COLLECTIONS.contentArtifacts, artifact.artifactId, {
          ...artifact,
          lifecycle: "retired",
        } satisfies PremiumContentArtifactRecordV1);
        transaction.delete(pointerRef);
      } else {
        if (!input.activation.selectorKey) {
          throw new ApiHttpError(400, "PREMIUM_CONTENT_ACTIVATION_INVALID", "Template selector is missing.");
        }
        const pointerRef = db.collection(COLLECTIONS.activeTemplates).doc(activeTemplateKey(
          input.binding.productId,
          input.binding.contentVersion,
          input.activation.selectorKey,
        ));
        const pointer = await transaction.get(pointerRef);
        const template = pointer.exists ? snapshotValue<PremiumContentTemplateRecordV1>(
          COLLECTIONS.activeTemplates,
          activeTemplateKey(input.binding.productId, input.binding.contentVersion, input.activation.selectorKey),
          pointer.data()!,
        ) : null;
        const current = template ? activationForTemplate(template) : null;
        if (!template || !current || !sameActivation(current, input.activation)) {
          throw new ApiHttpError(409, "PREMIUM_CONTENT_ACTIVATION_MISMATCH", "Template activation changed.");
        }
        transactionSet(transaction, COLLECTIONS.contentTemplates, template.templateId, {
          ...template,
          lifecycle: "retired",
        } satisfies PremiumContentTemplateRecordV1);
        transaction.delete(pointerRef);
      }
      transactionCreate(transaction, COLLECTIONS.audit, input.audit.auditId, input.audit);
      indexOwnerResource(transaction, input.audit.owner, COLLECTIONS.audit, input.audit.auditId);
    });
  }

  async createCheckout(input: { internalUserId: string; order: PremiumPaymentOrderRecordV1; audit: PremiumAuditEventV1 }) {
    const db = getFirestoreDb();
    const key = checkoutKey(input.order.owner, input.order.requestId);
    return db.runTransaction(async (transaction) => {
      await assertAccountWriteAllowedV1(transaction, db, input.internalUserId);
      const existingIndex = await transactionGet<CheckoutIndexRecordV1>(
        transaction, COLLECTIONS.checkoutRequests, key,
      );
      if (existingIndex) {
        const existing = await transactionGet<PremiumPaymentOrderRecordV1>(
          transaction, COLLECTIONS.orders, existingIndex.orderId,
        );
        if (!existing || !sameOwner(existing.owner, input.order.owner)
          || !sameBinding(existing.binding, input.order.binding)
          || existing.amount !== input.order.amount || existing.catalogVersion !== input.order.catalogVersion
          || existing.paymentProvider !== input.order.paymentProvider
          || existing.purchaseTermsReceipt?.acceptanceDigest
            !== input.order.purchaseTermsReceipt.acceptanceDigest) {
          throw new ApiHttpError(409, "PREMIUM_IDEMPOTENCY_CONFLICT", "Checkout key was reused with different material.");
        }
        writePremiumOrderAdminProjectionsV1(transaction, db, existing);
        return { order: existing, mode: "idempotent_replay" as const };
      }
      const report = await transactionGet<PremiumReportReferenceV1>(
        transaction, COLLECTIONS.reports, input.order.binding.reportId,
      );
      if (!report || report.status !== "registered"
        || !sameOwner(report.registration.owner, input.order.owner)
        || !sameBinding(report.binding, input.order.binding)) {
        throw new ApiHttpError(409, "PREMIUM_REPORT_UNAVAILABLE", "Report is not eligible for checkout.");
      }
      const currentActivation = await transactionGetActivation(
        transaction, input.order.binding, input.order.contentActivation,
      );
      if (!currentActivation || !sameActivation(currentActivation, input.order.contentActivation)) {
        throw new ApiHttpError(409, "PREMIUM_CONTENT_UNAVAILABLE", "Exact human-approved content activation is not active.");
      }
      const reportExpiry = await transactionGetUnpaidExpiry(
        transaction, db, "report_bundle", input.order.binding.reportId,
      );
      if (!reportExpiry || reportExpiry.kind !== "report_bundle"
        || !sameOwner(reportExpiry.owner, input.order.owner)
        || reportExpiry.analysisId !== input.order.binding.analysisId
        || reportExpiry.openOrderCount < 0 || reportExpiry.openOrderCount > 1) {
        throw new ApiHttpError(
          503,
          "PREMIUM_EXPIRY_STATE_INVALID",
          "Unpurchased report expiry state is unavailable or requires migration.",
        );
      }
      // A report may have only one unsettled checkout. The payment lease is
      // account-scoped, but the expiry marker is report-scoped; allowing a
      // second ready order would let the first successful payment remove the
      // marker needed to grant the second provider-confirmed charge. Same-key
      // retries have already replayed above, so this rejects only a distinct
      // checkout request and closes that stranded-charge race transactionally.
      if (reportExpiry.openOrderCount !== 0) {
        throw new ApiHttpError(
          409,
          "PREMIUM_CHECKOUT_ALREADY_OPEN",
          "This report already has an unsettled checkout; retry its request or wait for expiry.",
        );
      }
      const orderExpiresAt = addDurationUtc(input.order.createdAt, PREMIUM_READY_ORDER_TTL_MS);
      const extendedReportExpiry = new Date(Math.max(
        Date.parse(reportExpiry.expiresAt),
        Date.parse(orderExpiresAt) + 5 * 60 * 1_000,
      )).toISOString();
      transactionCreate(transaction, COLLECTIONS.orders, input.order.orderId, input.order);
      transactionCreate(transaction, COLLECTIONS.checkoutRequests, key, {
        owner: input.order.owner,
        requestId: input.order.requestId,
        orderId: input.order.orderId,
        binding: input.order.binding,
        createdAt: input.order.createdAt,
      } satisfies CheckoutIndexRecordV1);
      transactionCreate(transaction, COLLECTIONS.audit, input.audit.auditId, input.audit);
      transactionSetUnpaidExpiry(transaction, db, {
        ...reportExpiry,
        openOrderCount: reportExpiry.openOrderCount + 1,
        expiresAt: extendedReportExpiry,
      });
      const orderExpiryCandidateId = transactionCreateUnpaidExpiry(transaction, db, {
        schemaVersion: "namespring.premium-unpaid-expiry-candidate.v1",
        kind: "ready_order",
        owner: input.order.owner,
        internalUserId: input.internalUserId,
        checkoutRequestId: key,
        orderId: input.order.orderId,
        reportId: input.order.binding.reportId,
        locksReportCheckout: true,
        expiresAt: orderExpiresAt,
      });
      writePremiumOrderAdminProjectionsV1(transaction, db, input.order);
      indexOwnerResource(transaction, input.order.owner, COLLECTIONS.orders, input.order.orderId);
      indexOwnerResource(transaction, input.order.owner, COLLECTIONS.checkoutRequests, key);
      indexOwnerResource(transaction, input.order.owner, COLLECTIONS.audit, input.audit.auditId);
      indexOwnerResource(
        transaction,
        input.order.owner,
        COLLECTIONS.unpaidExpiryCandidates,
        orderExpiryCandidateId,
      );
      return { order: input.order, mode: "initial" as const };
    });
  }

  async getOrder(orderId: string) {
    const snapshot = await getFirestoreDb().collection(COLLECTIONS.orders).doc(orderId).get();
    return snapshot.exists
      ? snapshotValue<PremiumPaymentOrderRecordV1>(COLLECTIONS.orders, orderId, snapshot.data()!)
      : null;
  }

  async getRetainedPayment(orderId: string) {
    const id = premiumDocumentKey("retained-payment", orderId);
    const snapshot = await getFirestoreDb().collection(COLLECTIONS.retainedPayments).doc(id).get();
    if (!snapshot.exists) return null;
    const payment = snapshotValue<PremiumRetainedPaymentRecordV1>(
      COLLECTIONS.retainedPayments, id, snapshot.data()!,
    );
    if (payment.orderId !== orderId || payment.schemaVersion !== "namespring.retained-payment.v1") {
      throw new ApiHttpError(500, "PREMIUM_RETAINED_PAYMENT_CORRUPT", "Retained payment ledger is invalid.");
    }
    return payment;
  }

  async getEntitlement(entitlementId: string) {
    const snapshot = await getFirestoreDb().collection(COLLECTIONS.entitlements).doc(entitlementId).get();
    return snapshot.exists
      ? snapshotValue<ReportEntitlementV1>(COLLECTIONS.entitlements, entitlementId, snapshot.data()!)
      : null;
  }

  async acquirePaymentConfirmationLease(input: {
    internalUserId: string;
    owner: PremiumEntitlementOwnerV1;
    orderId: string;
    paymentKey: string;
    now: string;
  }) {
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      await assertAccountWriteAllowedV1(transaction, db, input.internalUserId);
      const leaseRef = accountPaymentLeaseRefV1(db, input.internalUserId);
      const [leaseSnapshot, order] = await Promise.all([
        transaction.get(leaseRef),
        transactionGet<PremiumPaymentOrderRecordV1>(transaction, COLLECTIONS.orders, input.orderId),
      ]);
      if (!order || order.status !== "ready" || !sameOwner(order.owner, input.owner)
        || order.accountWriteSubjectId !== input.internalUserId) {
        throw new ApiHttpError(409, "PREMIUM_PAYMENT_NOT_CONFIRMABLE", "Order is not eligible for a payment confirmation lease.");
      }
      if (leaseSnapshot.exists) {
        const lease = openPremiumJsonRecordV1<AccountPaymentLeaseRecordV1>(
          `${ACCOUNT_PAYMENT_LEASE_COLLECTION_V1}/${input.internalUserId}`,
          leaseSnapshot.data(),
        );
        if (lease.schemaVersion === "namespring.account-payment-lease.v1"
          && lease.orderId === order.orderId && lease.ownerSubjectId === order.owner.subjectId
          && lease.paymentKey === input.paymentKey) {
          if (order.paymentRecovery?.status !== "scheduled"
            || order.paymentRecovery.dueAt !== lease.reconcileAfter) {
            throw new ApiHttpError(503, "PREMIUM_ADMIN_PROJECTION_STALE", "Payment recovery state requires migration.");
          }
          writePremiumOrderAdminProjectionsV1(transaction, db, order);
          return { mode: "idempotent_replay" as const };
        }
        throw new ApiHttpError(409, "PAYMENT_RECONCILIATION_REQUIRED", "Another payment confirmation is awaiting reconciliation.");
      }
      const acquiredAt = input.now;
      const lease: AccountPaymentLeaseRecordV1 = {
        schemaVersion: "namespring.account-payment-lease.v1",
        orderId: order.orderId,
        ownerSubjectId: order.owner.subjectId,
        paymentKey: input.paymentKey,
        acquiredAt,
        reconcileAfter: new Date(Date.parse(acquiredAt) + 15 * 60 * 1_000).toISOString(),
      };
      transaction.create(leaseRef, {
        ...sealPremiumJsonRecordV1(`${ACCOUNT_PAYMENT_LEASE_COLLECTION_V1}/${input.internalUserId}`, lease),
        dueAt: Timestamp.fromDate(new Date(lease.reconcileAfter)),
      });
      const updatedOrder: PremiumPaymentOrderRecordV1 = {
        ...order,
        updatedAt: acquiredAt,
        paymentRecovery: {
          status: "scheduled",
          updatedAt: acquiredAt,
          dueAt: lease.reconcileAfter,
        },
      };
      transactionSet(transaction, COLLECTIONS.orders, order.orderId, updatedOrder);
      writePremiumOrderAdminProjectionsV1(transaction, db, updatedOrder);
      return { mode: "initial" as const };
    });
  }

  async listDuePaymentConfirmationLeaseCandidates(input: { now: string; limit: number }) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 3
      || canonicalUtc(input.now) === null) {
      throw new ApiHttpError(400, "PREMIUM_RECONCILIATION_BATCH_INVALID", "Reconciliation batch parameters are invalid.");
    }
    const snapshot = await getFirestoreDb().collection(ACCOUNT_PAYMENT_LEASE_COLLECTION_V1)
      .where("dueAt", "<=", Timestamp.fromDate(new Date(input.now)))
      .orderBy("dueAt", "asc")
      .limit(input.limit)
      .get();
    return snapshot.docs.map((doc) => {
      const dueAt = doc.data().dueAt;
      return {
        internalUserId: doc.id,
        // Keep a corrupt physical cursor inside the bounded batch so the
        // per-candidate transaction can fail it in isolation. Never decrypt
        // queue documents in this query/map phase.
        dueAt: dueAt instanceof Timestamp && dueAt.toMillis() <= Date.parse(input.now)
          ? dueAt.toDate().toISOString()
          : null,
      };
    });
  }

  async readDuePaymentConfirmationLease(input: {
    candidate: PremiumPaymentLeaseCandidateV1;
    now: string;
  }): Promise<PremiumPaymentLeaseWorkItemV1> {
    const now = canonicalUtc(input.now);
    const expectedDueAt = canonicalUtc(input.candidate.dueAt);
    if (!now || !input.candidate.internalUserId) {
      throw new ApiHttpError(400, "PREMIUM_RECONCILIATION_BATCH_INVALID", "Reconciliation candidate is invalid.");
    }
    if (!expectedDueAt) {
      throw new ApiHttpError(500, "PREMIUM_PAYMENT_LEASE_CORRUPT", "Payment reconciliation lease is invalid.");
    }
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      const leaseRef = accountPaymentLeaseRefV1(db, input.candidate.internalUserId);
      const leaseSnapshot = await transaction.get(leaseRef);
      if (!leaseSnapshot.exists) {
        throw new ApiHttpError(409, "PREMIUM_PAYMENT_LEASE_CHANGED", "Payment lease changed before reconciliation.");
      }
      const dueAtValue = leaseSnapshot.data()?.dueAt;
      if (!(dueAtValue instanceof Timestamp)) {
        throw new ApiHttpError(500, "PREMIUM_PAYMENT_LEASE_CORRUPT", "Payment reconciliation lease is invalid.");
      }
      const dueAt = dueAtValue.toDate().toISOString();
      if (dueAt !== expectedDueAt || dueAtValue.toMillis() > Date.parse(now)) {
        throw new ApiHttpError(409, "PREMIUM_PAYMENT_LEASE_CHANGED", "Payment lease is no longer due.");
      }
      const lease = openPremiumJsonRecordV1<AccountPaymentLeaseRecordV1>(
        `${ACCOUNT_PAYMENT_LEASE_COLLECTION_V1}/${input.candidate.internalUserId}`,
        leaseSnapshot.data(),
      );
      assertPaymentLeaseRecord(lease, dueAt);

      const order = await transactionGet<PremiumPaymentOrderRecordV1>(
        transaction, COLLECTIONS.orders, lease.orderId,
      );
      let settlementState: "scheduled" | "settled";
      if (order) {
        settlementState = assertLeaseMatchesOrder(order, lease, input.candidate.internalUserId);
      } else {
        const retainedId = premiumDocumentKey("retained-payment", lease.orderId);
        const retained = await transactionGet<PremiumRetainedPaymentRecordV1>(
          transaction, COLLECTIONS.retainedPayments, retainedId,
        );
        if (!retained) {
          throw new ApiHttpError(409, "PREMIUM_PAYMENT_LEASE_CONFLICT", "Payment state is unavailable for this lease.");
        }
        settlementState = assertLeaseMatchesRetainedPayment(retained, lease);
      }
      return {
        internalUserId: input.candidate.internalUserId,
        dueAt,
        settlementState,
        orderId: lease.orderId,
        ownerSubjectId: lease.ownerSubjectId,
        paymentKey: lease.paymentKey,
        acquiredAt: lease.acquiredAt,
        reconcileAfter: lease.reconcileAfter,
      };
    });
  }

  async finalizeSettledPaymentConfirmationLease(input: {
    lease: PremiumPaymentLeaseWorkItemV1;
  }): Promise<void> {
    const db = getFirestoreDb();
    await db.runTransaction(async (transaction) => {
      const leaseRef = accountPaymentLeaseRefV1(db, input.lease.internalUserId);
      const leaseSnapshot = await transaction.get(leaseRef);
      if (!leaseSnapshot.exists) return;
      const dueAtValue = leaseSnapshot.data()?.dueAt;
      if (!(dueAtValue instanceof Timestamp) || dueAtValue.toDate().toISOString() !== input.lease.dueAt) {
        throw new ApiHttpError(409, "PREMIUM_PAYMENT_LEASE_CHANGED", "Payment lease changed during reconciliation.");
      }
      const current = openPremiumJsonRecordV1<AccountPaymentLeaseRecordV1>(
        `${ACCOUNT_PAYMENT_LEASE_COLLECTION_V1}/${input.lease.internalUserId}`,
        leaseSnapshot.data(),
      );
      assertPaymentLeaseRecord(current, input.lease.dueAt);
      if (current.orderId !== input.lease.orderId
        || current.ownerSubjectId !== input.lease.ownerSubjectId
        || current.paymentKey !== input.lease.paymentKey
        || current.acquiredAt !== input.lease.acquiredAt
        || current.reconcileAfter !== input.lease.reconcileAfter) {
        throw new ApiHttpError(409, "PREMIUM_PAYMENT_LEASE_CHANGED", "Payment lease changed during reconciliation.");
      }

      const order = await transactionGet<PremiumPaymentOrderRecordV1>(
        transaction, COLLECTIONS.orders, current.orderId,
      );
      if (order) {
        assertLeaseMatchesOrder(order, current, input.lease.internalUserId);
        if (!providerStateIsTerminalForLease(order)) {
          throw new ApiHttpError(409, "PREMIUM_PAYMENT_NOT_SETTLED", "Payment state is not terminal.");
        }
        if (order.paymentKey !== current.paymentKey) {
          throw new ApiHttpError(409, "PREMIUM_PAYMENT_LEASE_CONFLICT", "Settled order payment identity is inconsistent.");
        }
        if ((order.status === "paid" || order.status === "revoked") && !order.entitlementId) {
          throw new ApiHttpError(500, "PREMIUM_ENTITLEMENT_CORRUPT", "Settled payment entitlement is missing.");
        }
        if ((order.status === "paid" || order.status === "refunded" || order.status === "revoked")
          && order.entitlementId) {
          const entitlement = await transactionGet<ReportEntitlementV1>(
            transaction, COLLECTIONS.entitlements, order.entitlementId,
          );
          const expectedStatus = order.status === "paid" ? "active" : order.status;
          if (!entitlement || !sameOwner(entitlement.owner, order.owner)
            || !sameBinding(entitlement.binding, order.binding)
            || entitlement.status !== expectedStatus) {
            throw new ApiHttpError(500, "PREMIUM_ENTITLEMENT_CORRUPT", "Settled payment entitlement is inconsistent.");
          }
        }
        const settledOrder: PremiumPaymentOrderRecordV1 = {
          ...order,
          paymentRecovery: settledPaymentRecovery(order.providerState!.observedAt),
        };
        transactionSet(transaction, COLLECTIONS.orders, order.orderId, settledOrder);
        writePremiumOrderAdminProjectionsV1(transaction, db, settledOrder);
      } else {
        const retainedId = premiumDocumentKey("retained-payment", current.orderId);
        const retained = await transactionGet<PremiumRetainedPaymentRecordV1>(
          transaction, COLLECTIONS.retainedPayments, retainedId,
        );
        if (!retained) {
          throw new ApiHttpError(409, "PREMIUM_PAYMENT_LEASE_CONFLICT", "Payment state is unavailable for this lease.");
        }
        assertLeaseMatchesRetainedPayment(retained, current);
        if (!providerStateIsTerminalForLease(retained)) {
          throw new ApiHttpError(409, "PREMIUM_PAYMENT_NOT_SETTLED", "Retained payment state is not terminal.");
        }
        const settledRetained: PremiumRetainedPaymentRecordV1 = {
          ...retained,
          paymentRecovery: settledPaymentRecovery(retained.providerState!.observedAt),
        };
        transactionSet(transaction, COLLECTIONS.retainedPayments, retainedId, settledRetained);
        writePremiumOrderAdminProjectionsV1(transaction, db, settledRetained);
      }
      transaction.delete(leaseRef);
    });
  }

  async confirmPayment(input: {
    orderId: string;
    actor: PremiumActorV1;
    owner: PremiumEntitlementOwnerV1;
    observation: PremiumProviderObservationV1;
    entitlementId: string;
    audit: PremiumAuditEventV1;
  }): Promise<PremiumPaymentCommitResultV1> {
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      const order = await transactionGet<PremiumPaymentOrderRecordV1>(transaction, COLLECTIONS.orders, input.orderId);
      if (!order) throw new ApiHttpError(404, "PREMIUM_ORDER_NOT_FOUND", "Premium order was not found.");
      if (!sameOwner(input.owner, order.owner)) {
        throw new ApiHttpError(403, "PREMIUM_OWNER_MISMATCH", "Premium resource belongs to another account.");
      }
      if (input.observation.orderId !== order.orderId
        || input.observation.totalAmount !== order.amount || input.observation.balanceAmount !== order.amount
        || input.observation.currency !== order.currency || input.observation.status !== "DONE") {
        throw new ApiHttpError(409, "TOSS_CONFIRMATION_MISMATCH", "Authoritative Toss confirmation does not match the order.");
      }
      // A settled replay no longer has a lease because the initial grant
      // deleted it atomically. Validate the immutable paid state directly.
      if (order.status === "paid") {
        if (order.paymentKey !== input.observation.paymentKey || !order.entitlementId) {
          throw new ApiHttpError(409, "PREMIUM_PAYMENT_CONFLICT", "Order is paid by a different payment.");
        }
        const entitlement = await transactionGet<ReportEntitlementV1>(
          transaction, COLLECTIONS.entitlements, order.entitlementId,
        );
        const grant = await transactionGet<EntitlementGrantRecordV1>(
          transaction, COLLECTIONS.entitlementGrants, order.entitlementId,
        );
        if (!entitlement || entitlement.status !== "active" || !grant
          || grant.entitlementId !== entitlement.entitlementId
          || grant.orderId !== order.orderId
          || !sameOwner(entitlement.owner, order.owner)
          || !sameBinding(entitlement.binding, order.binding)
          || !sameActivation(grant.contentActivation, order.contentActivation)) {
          throw new ApiHttpError(500, "PREMIUM_ENTITLEMENT_CORRUPT", "Paid order entitlement is inconsistent.");
        }
        const replayOrderExpiry = await transactionGetUnpaidExpiry(
          transaction, db, "ready_order", order.orderId,
        );
        const replayReportExpiry = await transactionGetUnpaidExpiry(
          transaction, db, "report_bundle", order.binding.reportId,
        );
        if (replayOrderExpiry) completeUnpaidExpiryCandidate(
          transaction, db, replayOrderExpiry, input.observation.observedAt,
        );
        if (replayReportExpiry) completeUnpaidExpiryCandidate(
          transaction, db, replayReportExpiry, input.observation.observedAt,
        );
        writePremiumOrderAdminProjectionsV1(transaction, db, order);
        writePremiumEntitlementAdminProjectionV1(transaction, db, entitlement);
        return { order, entitlement, mode: "idempotent_replay" as const };
      }
      await assertAccountWriteAllowedV1(transaction, db, order.accountWriteSubjectId);
      const leaseRef = accountPaymentLeaseRefV1(db, order.accountWriteSubjectId);
      const leaseSnapshot = await transaction.get(leaseRef);
      const lease = leaseSnapshot.exists
        ? openPremiumJsonRecordV1<AccountPaymentLeaseRecordV1>(
            `${ACCOUNT_PAYMENT_LEASE_COLLECTION_V1}/${order.accountWriteSubjectId}`,
            leaseSnapshot.data(),
          )
        : null;
      if (!lease || lease.schemaVersion !== "namespring.account-payment-lease.v1"
        || lease.orderId !== order.orderId || lease.ownerSubjectId !== order.owner.subjectId
        || lease.paymentKey !== input.observation.paymentKey) {
        throw new ApiHttpError(409, "PREMIUM_PAYMENT_LEASE_MISSING", "Payment confirmation lease is missing or mismatched.");
      }
      if (order.status !== "ready") {
        throw new ApiHttpError(409, "PREMIUM_PAYMENT_NOT_CONFIRMABLE", `Order status ${order.status} cannot be confirmed.`);
      }
      const report = await transactionGet<PremiumReportReferenceV1>(
        transaction, COLLECTIONS.reports, order.binding.reportId,
      );
      const pinnedResource = await transactionGetPinnedResource(
        transaction, order.binding, order.contentActivation,
      );
      if (!report || report.status !== "registered" || !sameOwner(report.registration.owner, order.owner)
        || !sameBinding(report.binding, order.binding)
        || !pinnedResource || !sameActivation(pinnedResource.activation, order.contentActivation)) {
        throw new ApiHttpError(409, "PREMIUM_CHECKOUT_STALE", "Report or approved content changed before payment activation.");
      }
      const providerKeyRef = db.collection(COLLECTIONS.providerKeys)
        .doc(premiumDocumentKey(order.paymentProvider, input.observation.paymentKey));
      const providerKey = await transactionGet<{ orderId: string }>(
        transaction, COLLECTIONS.providerKeys, providerKeyRef.id,
      );
      if (providerKey && providerKey.orderId !== order.orderId) {
        throw new ApiHttpError(409, "PREMIUM_PAYMENT_KEY_REUSED", "Payment key is already bound to another order.");
      }
      const orderExpiry = await transactionGetUnpaidExpiry(
        transaction, db, "ready_order", order.orderId,
      );
      const reportExpiry = await transactionGetUnpaidExpiry(
        transaction, db, "report_bundle", order.binding.reportId,
      );
      if (!orderExpiry || orderExpiry.kind !== "ready_order"
        || !reportExpiry || reportExpiry.kind !== "report_bundle"
        || !sameOwner(orderExpiry.owner, order.owner)
        || !sameOwner(reportExpiry.owner, order.owner)
        || orderExpiry.reportId !== order.binding.reportId
        || reportExpiry.openOrderCount < 1) {
        throw new ApiHttpError(
          503,
          "PREMIUM_EXPIRY_STATE_INVALID",
          "Payment expiry state is unavailable or requires migration.",
        );
      }
      const entitlement: ReportEntitlementV1 = {
        schemaVersion: "namespring.report-entitlement.v1",
        entitlementId: input.entitlementId,
        authority: "server",
        owner: order.owner,
        binding: order.binding,
        status: "active",
        grantSource: "verified_payment",
        createdAt: input.observation.observedAt,
        updatedAt: input.observation.observedAt,
        activatedAt: input.observation.occurredAt,
      };
      const updated: PremiumPaymentOrderRecordV1 = {
        ...order,
        status: "paid",
        paymentKey: input.observation.paymentKey,
        entitlementId: entitlement.entitlementId,
        updatedAt: input.observation.observedAt,
        paidAt: input.observation.occurredAt,
        paymentRecovery: settledPaymentRecovery(input.observation.observedAt),
        failureCode: undefined,
        providerState: {
          status: input.observation.status,
          totalAmount: input.observation.totalAmount,
          balanceAmount: input.observation.balanceAmount,
          occurredAt: input.observation.occurredAt,
          observedAt: input.observation.observedAt,
          eventId: input.observation.eventId,
        },
      };
      transactionSet(transaction, COLLECTIONS.providerKeys, providerKeyRef.id, { orderId: order.orderId });
      transactionCreate(transaction, COLLECTIONS.entitlements, entitlement.entitlementId, entitlement);
      transactionCreate(transaction, COLLECTIONS.entitlementGrants, entitlement.entitlementId, {
        entitlementId: entitlement.entitlementId,
        orderId: order.orderId,
        contentActivation: order.contentActivation,
        createdAt: input.observation.observedAt,
      } satisfies EntitlementGrantRecordV1);
      transactionSet(transaction, COLLECTIONS.orders, order.orderId, updated);
      transactionCreate(transaction, COLLECTIONS.audit, input.audit.auditId, input.audit);
      transaction.delete(leaseRef);
      writePremiumOrderAdminProjectionsV1(transaction, db, updated);
      writePremiumEntitlementAdminProjectionV1(transaction, db, entitlement);
      indexOwnerResource(transaction, order.owner, COLLECTIONS.providerKeys, providerKeyRef.id);
      indexOwnerResource(transaction, order.owner, COLLECTIONS.entitlements, entitlement.entitlementId);
      indexOwnerResource(transaction, order.owner, COLLECTIONS.entitlementGrants, entitlement.entitlementId);
      indexOwnerResource(transaction, order.owner, COLLECTIONS.audit, input.audit.auditId);
      completeUnpaidExpiryCandidate(transaction, db, orderExpiry, input.observation.observedAt);
      completeUnpaidExpiryCandidate(transaction, db, reportExpiry, input.observation.observedAt);
      return { order: updated, entitlement, mode: "initial" as const };
    });
  }

  async refundPayment(input: {
    orderId: string;
    actor: PremiumActorV1;
    reason: string;
    observation: PremiumProviderObservationV1;
    audit: PremiumAuditEventV1;
  }): Promise<PremiumPaymentCommitResultV1> {
    requireAdmin(input.actor);
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      const order = await transactionGet<PremiumPaymentOrderRecordV1>(transaction, COLLECTIONS.orders, input.orderId);
      if (!order) throw new ApiHttpError(404, "PREMIUM_ORDER_NOT_FOUND", "Premium order was not found.");
      const leaseRef = accountPaymentLeaseRefV1(db, order.accountWriteSubjectId);
      const leaseSnapshot = await transaction.get(leaseRef);
      const lease = leaseSnapshot.exists
        ? openPremiumJsonRecordV1<AccountPaymentLeaseRecordV1>(
            `${ACCOUNT_PAYMENT_LEASE_COLLECTION_V1}/${order.accountWriteSubjectId}`,
            leaseSnapshot.data(),
          )
        : null;
      if (lease && (lease.orderId !== order.orderId || lease.ownerSubjectId !== order.owner.subjectId
        || lease.paymentKey !== input.observation.paymentKey)) {
        throw new ApiHttpError(409, "PAYMENT_RECONCILIATION_REQUIRED", "Another payment lease blocks refund finalization.");
      }
      if (!order.entitlementId || !order.paymentKey) {
        throw new ApiHttpError(409, "PREMIUM_REFUND_NOT_ALLOWED", "Order has no verified payment entitlement.");
      }
      const entitlement = await transactionGet<ReportEntitlementV1>(
        transaction, COLLECTIONS.entitlements, order.entitlementId,
      );
      const expectedEntitlementStatus = order.status === "refunded"
        ? "refunded"
        : order.status === "revoked" ? "revoked" : "active";
      if (!entitlement || !sameOwner(entitlement.owner, order.owner)
        || !sameBinding(entitlement.binding, order.binding)
        || entitlement.status !== expectedEntitlementStatus) {
        throw new ApiHttpError(500, "PREMIUM_ENTITLEMENT_CORRUPT", "Entitlement is missing or mismatched.");
      }
      if (order.status === "refunded" && entitlement.status === "refunded") {
        if (leaseSnapshot.exists) transaction.delete(leaseRef);
        const replayOrder: PremiumPaymentOrderRecordV1 = {
          ...order,
          paymentRecovery: settledPaymentRecovery(order.providerState?.observedAt ?? order.updatedAt),
        };
        transactionSet(transaction, COLLECTIONS.orders, order.orderId, replayOrder);
        writePremiumOrderAdminProjectionsV1(transaction, db, replayOrder);
        writePremiumEntitlementAdminProjectionV1(transaction, db, entitlement);
        return { order: replayOrder, entitlement, mode: "idempotent_replay" as const };
      }
      if (order.status !== "paid" && order.status !== "revoked") {
        throw new ApiHttpError(409, "PREMIUM_REFUND_NOT_ALLOWED", `Order status ${order.status} cannot be refunded.`);
      }
      if (input.observation.orderId !== order.orderId
        || input.observation.paymentKey !== order.paymentKey
        || input.observation.totalAmount !== order.amount
        || input.observation.currency !== order.currency
        || input.observation.balanceAmount !== 0
        || input.observation.status !== "CANCELED") {
        throw new ApiHttpError(409, "TOSS_REFUND_MISMATCH", "Authoritative Toss refund does not match a full cancellation.");
      }
      const occurredAt = input.observation.occurredAt;
      if (order.paidAt && Date.parse(occurredAt) < Date.parse(order.paidAt)) {
        throw new ApiHttpError(409, "TOSS_EVENT_OUT_OF_ORDER", "Refund predates the verified payment.");
      }
      const updatedOrder: PremiumPaymentOrderRecordV1 = {
        ...order,
        status: "refunded",
        updatedAt: input.observation.observedAt,
        refundedAt: occurredAt,
        paymentRecovery: settledPaymentRecovery(input.observation.observedAt),
        refundReason: input.reason,
        providerState: {
          status: input.observation.status,
          totalAmount: input.observation.totalAmount,
          balanceAmount: input.observation.balanceAmount,
          occurredAt,
          observedAt: input.observation.observedAt,
          eventId: input.observation.eventId,
        },
      };
      const updatedEntitlement: ReportEntitlementV1 = {
        ...entitlement,
        status: "refunded",
        updatedAt: input.observation.observedAt,
      };
      transactionSet(transaction, COLLECTIONS.orders, order.orderId, updatedOrder);
      transactionSet(transaction, COLLECTIONS.entitlements, entitlement.entitlementId, updatedEntitlement);
      transactionCreate(transaction, COLLECTIONS.audit, input.audit.auditId, input.audit);
      if (leaseSnapshot.exists) transaction.delete(leaseRef);
      writePremiumOrderAdminProjectionsV1(transaction, db, updatedOrder);
      writePremiumEntitlementAdminProjectionV1(transaction, db, updatedEntitlement);
      indexOwnerResource(transaction, order.owner, COLLECTIONS.audit, input.audit.auditId);
      return { order: updatedOrder, entitlement: updatedEntitlement, mode: "initial" as const };
    });
  }

  async compensateCanceledPayment(input: {
    orderId: string;
    actor: PremiumActorV1;
    reason: string;
    observation: PremiumProviderObservationV1;
    audit: PremiumAuditEventV1;
  }) {
    requireAdmin(input.actor);
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      const order = await transactionGet<PremiumPaymentOrderRecordV1>(transaction, COLLECTIONS.orders, input.orderId);
      if (!order) throw new ApiHttpError(404, "PREMIUM_ORDER_NOT_FOUND", "Premium order was not found.");
      const leaseRef = accountPaymentLeaseRefV1(db, order.accountWriteSubjectId);
      const leaseSnapshot = await transaction.get(leaseRef);
      const lease = leaseSnapshot.exists
        ? openPremiumJsonRecordV1<AccountPaymentLeaseRecordV1>(
            `${ACCOUNT_PAYMENT_LEASE_COLLECTION_V1}/${order.accountWriteSubjectId}`,
            leaseSnapshot.data(),
          )
        : null;
      if (lease && (lease.orderId !== order.orderId || lease.ownerSubjectId !== order.owner.subjectId
        || lease.paymentKey !== input.observation.paymentKey)) {
        throw new ApiHttpError(409, "PAYMENT_RECONCILIATION_REQUIRED", "Another payment lease blocks compensation.");
      }
      const entitlement = order.entitlementId
        ? await transactionGet<ReportEntitlementV1>(transaction, COLLECTIONS.entitlements, order.entitlementId)
        : null;
      if (entitlement && (!sameOwner(entitlement.owner, order.owner)
        || !sameBinding(entitlement.binding, order.binding))) {
        throw new ApiHttpError(500, "PREMIUM_ENTITLEMENT_CORRUPT", "Compensation entitlement is mismatched.");
      }
      const providerKeyRef = db.collection(COLLECTIONS.providerKeys)
        .doc(premiumDocumentKey(order.paymentProvider, input.observation.paymentKey));
      const providerKey = await transactionGet<{ orderId: string }>(
        transaction, COLLECTIONS.providerKeys, providerKeyRef.id,
      );
      const orderExpiry = order.status === "ready"
        ? await transactionGetUnpaidExpiry(transaction, db, "ready_order", order.orderId)
        : null;
      const reportExpiry = order.status === "ready"
        ? await transactionGetUnpaidExpiry(transaction, db, "report_bundle", order.binding.reportId)
        : null;
      if (providerKey && providerKey.orderId !== order.orderId) {
        throw new ApiHttpError(409, "PREMIUM_PAYMENT_KEY_REUSED", "Payment key is already bound to another order.");
      }
      if (input.observation.orderId !== order.orderId
        || input.observation.totalAmount !== order.amount
        || input.observation.balanceAmount !== 0
        || input.observation.currency !== order.currency
        || input.observation.status !== "CANCELED"
        || (order.paymentKey && order.paymentKey !== input.observation.paymentKey)) {
        throw new ApiHttpError(409, "TOSS_COMPENSATION_MISMATCH", "Provider compensation did not produce a full cancellation.");
      }
      if (order.status === "refunded") {
        if (order.providerState?.status !== "CANCELED" || order.providerState.balanceAmount !== 0) {
          throw new ApiHttpError(500, "PREMIUM_REFUND_STATE_CORRUPT", "Refunded order lacks a full-cancellation provider state.");
        }
        if (leaseSnapshot.exists) transaction.delete(leaseRef);
        const replayOrder: PremiumPaymentOrderRecordV1 = {
          ...order,
          paymentRecovery: settledPaymentRecovery(order.providerState?.observedAt ?? order.updatedAt),
        };
        transactionSet(transaction, COLLECTIONS.orders, order.orderId, replayOrder);
        writePremiumOrderAdminProjectionsV1(transaction, db, replayOrder);
        if (entitlement) writePremiumEntitlementAdminProjectionV1(transaction, db, entitlement);
        return { order: replayOrder, entitlement, mode: "idempotent_replay" as const };
      }
      if (!["ready", "paid", "revoked"].includes(order.status)
        || ((order.status === "paid" || order.status === "revoked") && !entitlement)) {
        throw new ApiHttpError(409, "PREMIUM_COMPENSATION_NOT_ALLOWED", `Order status ${order.status} cannot be compensated.`);
      }
      const updatedOrder: PremiumPaymentOrderRecordV1 = {
        ...order,
        status: "refunded",
        paymentKey: input.observation.paymentKey,
        updatedAt: input.observation.observedAt,
        refundedAt: input.observation.occurredAt,
        paymentRecovery: settledPaymentRecovery(input.observation.observedAt),
        refundReason: input.reason,
        failureCode: order.entitlementId
          ? "PROVIDER_PARTIAL_CANCELED_COMPENSATED"
          : "PROVIDER_PARTIAL_CANCELED_COMPENSATED_BEFORE_LOCAL_GRANT",
        providerState: {
          status: input.observation.status,
          totalAmount: input.observation.totalAmount,
          balanceAmount: input.observation.balanceAmount,
          occurredAt: input.observation.occurredAt,
          observedAt: input.observation.observedAt,
          eventId: input.observation.eventId,
        },
      };
      const updatedEntitlement = entitlement ? {
        ...entitlement,
        status: "refunded" as const,
        updatedAt: input.observation.observedAt,
      } : null;
      transactionSet(transaction, COLLECTIONS.providerKeys, providerKeyRef.id, { orderId: order.orderId });
      transactionSet(transaction, COLLECTIONS.orders, order.orderId, updatedOrder);
      if (updatedEntitlement) {
        transactionSet(transaction, COLLECTIONS.entitlements, updatedEntitlement.entitlementId, updatedEntitlement);
      }
      transactionCreate(transaction, COLLECTIONS.audit, input.audit.auditId, input.audit);
      if (leaseSnapshot.exists) transaction.delete(leaseRef);
      writePremiumOrderAdminProjectionsV1(transaction, db, updatedOrder);
      if (updatedEntitlement) writePremiumEntitlementAdminProjectionV1(transaction, db, updatedEntitlement);
      indexOwnerResource(transaction, order.owner, COLLECTIONS.providerKeys, providerKeyRef.id);
      indexOwnerResource(transaction, order.owner, COLLECTIONS.audit, input.audit.auditId);
      if (order.status === "ready") {
        releaseReadyOrderExpiryAfterTerminalNoGrant(
          transaction,
          db,
          order,
          orderExpiry,
          reportExpiry,
          input.observation.observedAt,
        );
      }
      return { order: updatedOrder, entitlement: updatedEntitlement, mode: "initial" as const };
    });
  }

  async settleRetainedPayment(input: {
    orderId: string;
    actor: PremiumActorV1;
    reason: string;
    observation: PremiumProviderObservationV1;
  }) {
    requireAdmin(input.actor);
    const db = getFirestoreDb();
    const id = premiumDocumentKey("retained-payment", input.orderId);
    return db.runTransaction(async (transaction) => {
      const payment = await transactionGet<PremiumRetainedPaymentRecordV1>(
        transaction, COLLECTIONS.retainedPayments, id,
      );
      if (!payment) throw new ApiHttpError(404, "PREMIUM_ORDER_NOT_FOUND", "Retained payment was not found.");
      if (!payment.paymentKey || input.observation.orderId !== payment.orderId
        || input.observation.paymentKey !== payment.paymentKey
        || input.observation.totalAmount !== payment.amount
        || input.observation.currency !== payment.currency) {
        throw new ApiHttpError(409, "PREMIUM_RETAINED_PAYMENT_MISMATCH", "Provider state does not match retained payment.");
      }
      const fullyCanceled = input.observation.status === "CANCELED" && input.observation.balanceAmount === 0;
      const stillPaid = input.observation.status === "DONE" && input.observation.balanceAmount === payment.amount;
      if (!fullyCanceled && !stillPaid) {
        throw new ApiHttpError(409, "PREMIUM_RETAINED_PAYMENT_UNSETTLED", "Retained payment provider state is not settled.");
      }
      if ((stillPaid && payment.status === "refunded")
        || (fullyCanceled && payment.paidAt
          && Date.parse(input.observation.occurredAt) < Date.parse(payment.paidAt))) {
        throw new ApiHttpError(409, "TOSS_EVENT_OUT_OF_ORDER", "Retained payment observation is out of order.");
      }
      if (fullyCanceled && payment.status === "refunded"
        && payment.providerState?.status === "CANCELED" && payment.providerState.balanceAmount === 0) {
        const replayPayment: PremiumRetainedPaymentRecordV1 = {
          ...payment,
          paymentRecovery: settledPaymentRecovery(payment.providerState.observedAt),
        };
        transactionSet(transaction, COLLECTIONS.retainedPayments, id, replayPayment);
        writePremiumOrderAdminProjectionsV1(transaction, db, replayPayment);
        return { payment: replayPayment, mode: "idempotent_replay" as const };
      }
      const updated: PremiumRetainedPaymentRecordV1 = {
        ...payment,
        status: fullyCanceled ? "refunded" : payment.status,
        refundedAt: fullyCanceled ? input.observation.occurredAt : payment.refundedAt,
        paymentRecovery: settledPaymentRecovery(input.observation.observedAt),
        ...(fullyCanceled ? { refundReason: input.reason } : {}),
        providerState: {
          status: input.observation.status,
          totalAmount: input.observation.totalAmount,
          balanceAmount: input.observation.balanceAmount,
          occurredAt: input.observation.occurredAt,
          observedAt: input.observation.observedAt,
          eventId: input.observation.eventId,
        },
      };
      transactionSet(transaction, COLLECTIONS.retainedPayments, id, updated);
      writePremiumOrderAdminProjectionsV1(transaction, db, updated);
      return { payment: updated, mode: "initial" as const };
    });
  }

  async failUnpaidOrder(input: {
    orderId: string;
    actor: PremiumActorV1;
    observation: PremiumProviderObservationV1;
    audit: PremiumAuditEventV1;
  }) {
    requireAdmin(input.actor);
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      const order = await transactionGet<PremiumPaymentOrderRecordV1>(transaction, COLLECTIONS.orders, input.orderId);
      if (!order) throw new ApiHttpError(404, "PREMIUM_ORDER_NOT_FOUND", "Premium order was not found.");
      const leaseRef = accountPaymentLeaseRefV1(db, order.accountWriteSubjectId);
      const leaseSnapshot = await transaction.get(leaseRef);
      const lease = leaseSnapshot.exists
        ? openPremiumJsonRecordV1<AccountPaymentLeaseRecordV1>(
            `${ACCOUNT_PAYMENT_LEASE_COLLECTION_V1}/${order.accountWriteSubjectId}`,
            leaseSnapshot.data(),
          )
        : null;
      const orderExpiry = await transactionGetUnpaidExpiry(
        transaction, db, "ready_order", order.orderId,
      );
      const reportExpiry = await transactionGetUnpaidExpiry(
        transaction, db, "report_bundle", order.binding.reportId,
      );
      if (lease && (lease.orderId !== order.orderId || lease.ownerSubjectId !== order.owner.subjectId
        || lease.paymentKey !== input.observation.paymentKey)) {
        throw new ApiHttpError(409, "PAYMENT_RECONCILIATION_REQUIRED", "Another payment lease blocks failure finalization.");
      }
      if (order.status === "failed") {
        if (leaseSnapshot.exists) transaction.delete(leaseRef);
        const replayOrder: PremiumPaymentOrderRecordV1 = {
          ...order,
          paymentRecovery: settledPaymentRecovery(order.providerState?.observedAt ?? order.updatedAt),
        };
        transactionSet(transaction, COLLECTIONS.orders, order.orderId, replayOrder);
        writePremiumOrderAdminProjectionsV1(transaction, db, replayOrder);
        if (orderExpiry) {
          releaseReadyOrderExpiryAfterTerminalNoGrant(
            transaction,
            db,
            order,
            orderExpiry,
            reportExpiry,
            order.providerState?.observedAt ?? order.updatedAt,
          );
        }
        return replayOrder;
      }
      const providerTerminalWithoutGrant =
        (input.observation.status === "CANCELED" && input.observation.balanceAmount === 0)
        || (["ABORTED", "EXPIRED"].includes(input.observation.status)
          && input.observation.balanceAmount === 0);
      if (order.status !== "ready" || input.observation.orderId !== order.orderId
        || input.observation.totalAmount !== order.amount
        || input.observation.currency !== order.currency || !providerTerminalWithoutGrant) {
        throw new ApiHttpError(409, "PREMIUM_RECONCILIATION_CONFLICT", "Canceled provider state cannot be applied to this order.");
      }
      const updated: PremiumPaymentOrderRecordV1 = {
        ...order,
        status: "failed",
        paymentKey: input.observation.paymentKey,
        updatedAt: input.observation.observedAt,
        paymentRecovery: settledPaymentRecovery(input.observation.observedAt),
        failureCode: `PROVIDER_${input.observation.status}_BEFORE_LOCAL_CONFIRMATION`,
        providerState: {
          status: input.observation.status,
          totalAmount: input.observation.totalAmount,
          balanceAmount: input.observation.balanceAmount,
          occurredAt: input.observation.occurredAt,
          observedAt: input.observation.observedAt,
          eventId: input.observation.eventId,
        },
      };
      transactionSet(transaction, COLLECTIONS.orders, order.orderId, updated);
      transactionCreate(transaction, COLLECTIONS.audit, input.audit.auditId, input.audit);
      if (leaseSnapshot.exists) transaction.delete(leaseRef);
      writePremiumOrderAdminProjectionsV1(transaction, db, updated);
      indexOwnerResource(transaction, order.owner, COLLECTIONS.audit, input.audit.auditId);
      releaseReadyOrderExpiryAfterTerminalNoGrant(
        transaction,
        db,
        order,
        orderExpiry,
        reportExpiry,
        input.observation.observedAt,
      );
      return updated;
    });
  }

  async revokeEntitlement(input: {
    entitlementId: string;
    actor: PremiumActorV1;
    reason: string;
    now: string;
    audit: PremiumAuditEventV1;
  }) {
    requireAdmin(input.actor);
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      const entitlement = await transactionGet<ReportEntitlementV1>(
        transaction, COLLECTIONS.entitlements, input.entitlementId,
      );
      if (!entitlement) throw new ApiHttpError(404, "PREMIUM_ENTITLEMENT_NOT_FOUND", "Entitlement was not found.");
      if (entitlement.status === "refunded" || entitlement.status === "expired" || entitlement.status === "revoked") {
        writePremiumEntitlementAdminProjectionV1(transaction, db, entitlement);
        return entitlement;
      }
      const updated: ReportEntitlementV1 = {
        ...entitlement,
        status: "revoked",
        updatedAt: input.now,
      };
      const grant = await transactionGet<EntitlementGrantRecordV1>(
        transaction, COLLECTIONS.entitlementGrants, entitlement.entitlementId,
      );
      const matchingOrder = grant
        ? await transactionGet<PremiumPaymentOrderRecordV1>(
            transaction, COLLECTIONS.orders, grant.orderId,
          )
        : null;
      if (!grant || grant.entitlementId !== entitlement.entitlementId
        || !matchingOrder || matchingOrder.entitlementId !== entitlement.entitlementId
        || !sameOwner(matchingOrder.owner, entitlement.owner)
        || !sameBinding(matchingOrder.binding, entitlement.binding)
        || !sameActivation(grant.contentActivation, matchingOrder.contentActivation)) {
        throw new ApiHttpError(
          500,
          "PREMIUM_ENTITLEMENT_CORRUPT",
          "Entitlement grant and payment order are inconsistent.",
        );
      }
      // Firestore transactions require every read before the first write.
      transactionSet(transaction, COLLECTIONS.entitlements, entitlement.entitlementId, updated);
      writePremiumEntitlementAdminProjectionV1(transaction, db, updated);
      if (matchingOrder.status === "paid") {
          const updatedOrder = {
            ...matchingOrder,
            status: "revoked",
            updatedAt: input.now,
          } satisfies PremiumPaymentOrderRecordV1;
          transactionSet(transaction, COLLECTIONS.orders, grant.orderId, updatedOrder);
          writePremiumOrderAdminProjectionsV1(transaction, db, updatedOrder);
      }
      transactionCreate(transaction, COLLECTIONS.audit, input.audit.auditId, input.audit);
      indexOwnerResource(transaction, entitlement.owner, COLLECTIONS.audit, input.audit.auditId);
      return updated;
    });
  }

  async getAccessSnapshot(input: {
    owner: PremiumEntitlementOwnerV1;
    requestId: string;
    entitlementId: string;
    binding: PremiumReportBindingV1;
  }): Promise<PremiumAccessSnapshotV1> {
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      const [report, entitlement, analysis, replay, grant] = await Promise.all([
        transactionGet<PremiumReportReferenceV1>(transaction, COLLECTIONS.reports, input.binding.reportId),
        transactionGet<ReportEntitlementV1>(transaction, COLLECTIONS.entitlements, input.entitlementId),
        transactionGet<PremiumServerAnalysisRecordV1>(transaction, COLLECTIONS.analyses, input.binding.analysisId),
        transactionGet<PremiumDeliveryReplayRecordV1>(transaction, COLLECTIONS.deliveryRequests, deliveryKey(input.owner, input.requestId)),
        transactionGet<EntitlementGrantRecordV1>(transaction, COLLECTIONS.entitlementGrants, input.entitlementId),
      ]);
      const pinned = grant
        ? await transactionGetPinnedResource(transaction, input.binding, grant.contentActivation)
        : null;
      return {
        report,
        entitlement,
        analysis,
        content: pinned?.content ?? null,
        template: pinned?.template ?? null,
        contentActivation: grant?.contentActivation ?? null,
        replay,
      };
    });
  }

  async commitDelivery(input: {
    internalUserId: string;
    owner: PremiumEntitlementOwnerV1;
    requestId: string;
    delivery: PremiumReportDeliveryV1;
    contentActivation: PremiumContentActivationBindingV1;
    audit: PremiumAuditEventV1;
  }) {
    const db = getFirestoreDb();
    const key = deliveryKey(input.owner, input.requestId);
    return db.runTransaction(async (transaction) => {
      await assertAccountWriteAllowedV1(transaction, db, input.internalUserId);
      const existing = await transactionGet<PremiumDeliveryReplayRecordV1>(
        transaction, COLLECTIONS.deliveryRequests, key,
      );
      if (existing) {
        if (existing.entitlementId !== input.delivery.entitlement.entitlementId
          || !sameBinding(existing.binding, input.delivery.binding)) {
          throw new ApiHttpError(409, "PREMIUM_IDEMPOTENCY_CONFLICT", "Delivery key was reused for another resource.");
        }
        return { delivery: existing.delivery, mode: "idempotent_replay" as const };
      }
      const report = await transactionGet<PremiumReportReferenceV1>(
        transaction, COLLECTIONS.reports, input.delivery.binding.reportId,
      );
      const entitlement = await transactionGet<ReportEntitlementV1>(
        transaction, COLLECTIONS.entitlements, input.delivery.entitlement.entitlementId,
      );
      const grant = await transactionGet<EntitlementGrantRecordV1>(
        transaction, COLLECTIONS.entitlementGrants, input.delivery.entitlement.entitlementId,
      );
      const pinnedResource = await transactionGetPinnedResource(
        transaction, input.delivery.binding, input.contentActivation,
      );
      if (!report || report.status !== "registered" || !sameOwner(report.registration.owner, input.owner)
        || !sameBinding(report.binding, input.delivery.binding)
        || !entitlement || entitlement.status !== "active" || !sameOwner(entitlement.owner, input.owner)
        || !sameBinding(entitlement.binding, input.delivery.binding)
        || (entitlement.expiresAt && Date.parse(entitlement.expiresAt) <= Date.parse(input.delivery.deliveredAt))
        || !grant || !sameActivation(grant.contentActivation, input.contentActivation)
        || !pinnedResource || !sameActivation(pinnedResource.activation, input.contentActivation)) {
        throw new ApiHttpError(403, "PREMIUM_ACCESS_REVOKED", "Premium access changed before delivery commit.");
      }
      const record: PremiumDeliveryReplayRecordV1 = {
        owner: input.owner,
        requestId: input.requestId,
        entitlementId: input.delivery.entitlement.entitlementId,
        binding: input.delivery.binding,
        delivery: input.delivery,
        createdAt: input.delivery.deliveredAt,
      };
      transactionCreate(transaction, COLLECTIONS.deliveryRequests, key, record);
      transactionCreate(transaction, COLLECTIONS.audit, input.audit.auditId, input.audit);
      indexOwnerResource(transaction, input.owner, COLLECTIONS.deliveryRequests, key);
      indexOwnerResource(transaction, input.owner, COLLECTIONS.audit, input.audit.auditId);
      return { delivery: input.delivery, mode: "initial" as const };
    });
  }

  async sweepExpiredUnpaidData(input: {
    now: string;
    limit: number;
  }): Promise<PremiumUnpaidExpirySweepResultV1> {
    const now = canonicalUtc(input.now);
    if (!now || !Number.isInteger(input.limit) || input.limit < 1
      || input.limit > PREMIUM_UNPAID_EXPIRY_BATCH_LIMIT_V1) {
      throw new ApiHttpError(400, "PREMIUM_EXPIRY_SWEEP_INVALID", "Premium expiry sweep input is invalid.");
    }
    const db = getFirestoreDb();
    const candidates = await db.collection(COLLECTIONS.unpaidExpiryCandidates)
      .where("expiresAt", "<=", Timestamp.fromDate(new Date(now)))
      .orderBy("expiresAt", "asc")
      .limit(input.limit)
      .get();
    let deleted = 0;
    let skipped = 0;
    let failed = 0;
    let deferred = 0;

    for (const queued of candidates.docs) {
      try {
        const outcome = await db.runTransaction(async (transaction): Promise<
          "deleted" | "protected" | "deferred" | "gone"
        > => {
          const current = await transaction.get(queued.ref);
          if (!current.exists) return "gone";
          const candidate = unpaidExpirySnapshotValue(current.id, current.data());
          if (Date.parse(candidate.expiresAt) > Date.parse(now)) return "deferred";

          if (candidate.kind === "report_bundle") {
            if (candidate.openOrderCount > 0) return "deferred";
            const [registration, report, analysis] = await Promise.all([
              transactionGet<RegistrationIndexRecordV1>(
                transaction, COLLECTIONS.registrations, candidate.registrationId,
              ),
              transactionGet<PremiumReportReferenceV1>(
                transaction, COLLECTIONS.reports, candidate.reportId,
              ),
              transactionGet<PremiumServerAnalysisRecordV1>(
                transaction, COLLECTIONS.analyses, candidate.analysisId,
              ),
            ]);
            if (!registration && !report && !analysis) {
              completeUnpaidExpiryCandidate(transaction, db, candidate, now);
              return "gone";
            }
            if (!registration || !report || !analysis
              || registration.reportId !== candidate.reportId
              || report.binding.reportId !== candidate.reportId
              || report.binding.analysisId !== candidate.analysisId
              || analysis.reportId !== candidate.reportId
              || analysis.analysisId !== candidate.analysisId
              || report.status !== "registered"
              || !sameOwner(registration.owner, candidate.owner)
              || !sameOwner(report.registration.owner, candidate.owner)
              || !sameOwner(analysis.owner, candidate.owner)) {
              throw new ApiHttpError(
                500,
                "PREMIUM_EXPIRY_SOURCE_CORRUPT",
                "Unpurchased report expiry sources are inconsistent.",
              );
            }
            transaction.delete(db.collection(COLLECTIONS.registrations).doc(candidate.registrationId));
            transaction.delete(db.collection(COLLECTIONS.reports).doc(candidate.reportId));
            transaction.delete(db.collection(COLLECTIONS.analyses).doc(candidate.analysisId));
            deleteOwnerResourceIndex(
              transaction, db, candidate.owner, COLLECTIONS.registrations, candidate.registrationId,
            );
            deleteOwnerResourceIndex(
              transaction, db, candidate.owner, COLLECTIONS.reports, candidate.reportId,
            );
            deleteOwnerResourceIndex(
              transaction, db, candidate.owner, COLLECTIONS.analyses, candidate.analysisId,
            );
            completeUnpaidExpiryCandidate(transaction, db, candidate, now);
            return "deleted";
          }

          const order = await transactionGet<PremiumPaymentOrderRecordV1>(
            transaction, COLLECTIONS.orders, candidate.orderId,
          );
          const checkout = await transactionGet<CheckoutIndexRecordV1>(
            transaction, COLLECTIONS.checkoutRequests, candidate.checkoutRequestId,
          );
          const reportExpiry = await transactionGetUnpaidExpiry(
            transaction, db, "report_bundle", candidate.reportId,
          );
          const leaseRef = accountPaymentLeaseRefV1(db, candidate.internalUserId);
          const leaseSnapshot = await transaction.get(leaseRef);
          let providerKeyRef: DocumentReference | null = null;
          if (order?.paymentKey) {
            providerKeyRef = db.collection(COLLECTIONS.providerKeys)
              .doc(premiumDocumentKey(order.paymentProvider, order.paymentKey));
            await transaction.get(providerKeyRef);
          }

          if (order && (order.entitlementId || ["paid", "refunded", "revoked"].includes(order.status))) {
            completeUnpaidExpiryCandidate(transaction, db, candidate, now);
            if (reportExpiry?.kind === "report_bundle") {
              completeUnpaidExpiryCandidate(transaction, db, reportExpiry, now);
            }
            return "protected";
          }
          if (order) {
            const readySafe = order.status === "ready" && order.paymentKey === null
              && order.paymentRecovery.status === "not_required";
            const failedSafe = order.status === "failed"
              && order.paymentRecovery.status === "settled"
              && order.providerState !== undefined
              && order.providerState.balanceAmount === 0
              && ["CANCELED", "ABORTED", "EXPIRED"].includes(order.providerState.status);
            if ((!readySafe && !failedSafe) || !sameOwner(order.owner, candidate.owner)
              || order.accountWriteSubjectId !== candidate.internalUserId
              || order.binding.reportId !== candidate.reportId) {
              return "deferred";
            }
          }
          if (checkout && (!sameOwner(checkout.owner, candidate.owner)
            || checkout.orderId !== candidate.orderId
            || checkout.binding.reportId !== candidate.reportId)) {
            throw new ApiHttpError(500, "PREMIUM_EXPIRY_SOURCE_CORRUPT", "Checkout expiry source is inconsistent.");
          }
          if (order && !checkout) {
            throw new ApiHttpError(500, "PREMIUM_EXPIRY_SOURCE_CORRUPT", "Checkout expiry index is missing.");
          }
          if (leaseSnapshot.exists) {
            const lease = openPremiumJsonRecordV1<AccountPaymentLeaseRecordV1>(
              `${ACCOUNT_PAYMENT_LEASE_COLLECTION_V1}/${candidate.internalUserId}`,
              leaseSnapshot.data(),
            );
            if (lease.orderId !== candidate.orderId || order?.paymentRecovery.status === "scheduled") {
              return "deferred";
            }
          }
          if (order) {
            transaction.delete(db.collection(COLLECTIONS.orders).doc(candidate.orderId));
            deleteOwnerResourceIndex(
              transaction, db, candidate.owner, COLLECTIONS.orders, candidate.orderId,
            );
            deletePremiumOrderAdminProjectionsV1(transaction, db, candidate.orderId);
          }
          if (checkout) {
            transaction.delete(db.collection(COLLECTIONS.checkoutRequests).doc(candidate.checkoutRequestId));
            deleteOwnerResourceIndex(
              transaction, db, candidate.owner, COLLECTIONS.checkoutRequests, candidate.checkoutRequestId,
            );
          }
          if (providerKeyRef) {
            transaction.delete(providerKeyRef);
            deleteOwnerResourceIndex(
              transaction, db, candidate.owner, COLLECTIONS.providerKeys, providerKeyRef.id,
            );
          }
          if (leaseSnapshot.exists) transaction.delete(leaseRef);
          if (reportExpiry?.kind === "report_bundle" && candidate.locksReportCheckout !== false) {
            if (!sameOwner(reportExpiry.owner, candidate.owner) || reportExpiry.openOrderCount < 1) {
              throw new ApiHttpError(500, "PREMIUM_EXPIRY_SOURCE_CORRUPT", "Report expiry order count is inconsistent.");
            }
            transactionSetUnpaidExpiry(transaction, db, {
              ...reportExpiry,
              openOrderCount: reportExpiry.openOrderCount - 1,
            });
          }
          completeUnpaidExpiryCandidate(transaction, db, candidate, now);
          return order || checkout ? "deleted" : "gone";
        });
        if (outcome === "deleted") deleted += 1;
        else {
          skipped += 1;
          if (outcome === "deferred") deferred += 1;
        }
      } catch {
        // Corrupt or racing candidates are isolated. Their durable row remains
        // for the next run and no sensitive exception crosses maintenance.
        failed += 1;
      }
    }
    return {
      scanned: candidates.size,
      deleted,
      skipped,
      failed,
      hasMore: candidates.size >= input.limit || deferred > 0 || failed > 0,
    };
  }

  async exportOwnerPortableData(input: {
    owner: PremiumEntitlementOwnerV1;
    exportedAt: string;
  }): Promise<PremiumAccountExportSectionV1> {
    const db = getFirestoreDb();
    const MAX_RESOURCES = 1_000;
    // Leaves response-wrapper/header headroom below common serverless limits.
    const MAX_BYTES = 3 * 1024 * 1024;
    const exportable = new Set<string>([
      COLLECTIONS.reports,
      COLLECTIONS.orders,
      COLLECTIONS.entitlements,
      COLLECTIONS.deliveryRequests,
    ]);
    const indexedCollections = new Set<string>([
      COLLECTIONS.registrations, COLLECTIONS.reports, COLLECTIONS.analyses,
      COLLECTIONS.checkoutRequests, COLLECTIONS.orders, COLLECTIONS.providerKeys,
      COLLECTIONS.entitlements, COLLECTIONS.entitlementGrants, COLLECTIONS.deliveryRequests,
      COLLECTIONS.contentArtifacts, COLLECTIONS.activeContent, COLLECTIONS.audit,
      COLLECTIONS.unpaidExpiryCandidates,
    ]);
    const ownerRootId = ownerResourceRootId(input.owner);
    const index = await db.collection(COLLECTIONS.ownerResources)
      .doc(ownerRootId).collection("items")
      .limit(MAX_RESOURCES + 1).get();
    if (index.size > MAX_RESOURCES) {
      throw new ApiHttpError(413, "PREMIUM_EXPORT_TOO_LARGE", "Premium export exceeds the bounded record limit.");
    }

    const reports: Array<PremiumAccountExportSectionV1["reports"][number]> = [];
    const orders: Array<PremiumAccountExportSectionV1["orders"][number]> = [];
    const entitlements: Array<PremiumAccountExportSectionV1["entitlements"][number]> = [];
    const deliveries: Array<PremiumAccountExportSectionV1["deliveries"][number]> = [];
    let encodedBytes = 0;
    const append = <T>(target: T[], value: T) => {
      encodedBytes += Buffer.byteLength(JSON.stringify(value), "utf8");
      if (encodedBytes > MAX_BYTES) {
        throw new ApiHttpError(413, "PREMIUM_EXPORT_TOO_LARGE", "Premium export exceeds the bounded byte limit.");
      }
      target.push(value);
    };
    const rows = index.docs.map((doc) => {
      const row = ownerResourceIndexValue(ownerRootId, doc.id, doc.data());
      if (typeof row.collection !== "string" || typeof row.id !== "string"
        || !indexedCollections.has(row.collection) || !/^[A-Za-z0-9_-]{1,256}$/u.test(row.id)) {
        throw new ApiHttpError(500, "PREMIUM_OWNER_INDEX_CORRUPT", "Premium owner resource index is invalid.");
      }
      return { collection: row.collection, id: row.id };
    }).filter((row) => exportable.has(row.collection));
    for (let offset = 0; offset < rows.length; offset += 25) {
      const chunk = rows.slice(offset, offset + 25);
      const snapshots = await Promise.all(chunk.map((row) => db.collection(row.collection).doc(row.id).get()));
      for (let position = 0; position < chunk.length; position += 1) {
        const row = chunk[position]!;
        const snapshot = snapshots[position]!;
        if (!snapshot.exists) continue;
        if (row.collection === COLLECTIONS.reports) {
          const report = snapshotValue<PremiumReportReferenceV1>(row.collection, row.id, snapshot.data()!);
          if (!sameOwner(report.registration.owner, input.owner)) throw new ApiHttpError(500, "PREMIUM_EXPORT_OWNER_MISMATCH", "Report owner index is inconsistent.");
          append(reports, {
            binding: report.binding,
            status: report.status,
            registeredAt: report.registeredAt,
            updatedAt: report.updatedAt,
          });
        } else if (row.collection === COLLECTIONS.orders) {
          const order = snapshotValue<PremiumPaymentOrderRecordV1>(row.collection, row.id, snapshot.data()!);
          if (!sameOwner(order.owner, input.owner)) throw new ApiHttpError(500, "PREMIUM_EXPORT_OWNER_MISMATCH", "Order owner index is inconsistent.");
          append(orders, {
            orderId: order.orderId,
            binding: order.binding,
            amount: order.amount,
            currency: order.currency,
            status: order.status,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            paidAt: order.paidAt,
            refundedAt: order.refundedAt,
          });
        } else if (row.collection === COLLECTIONS.entitlements) {
          const entitlement = snapshotValue<ReportEntitlementV1>(row.collection, row.id, snapshot.data()!);
          if (!sameOwner(entitlement.owner, input.owner)) throw new ApiHttpError(500, "PREMIUM_EXPORT_OWNER_MISMATCH", "Entitlement owner index is inconsistent.");
          const { owner: _owner, ...portable } = entitlement;
          append(entitlements, portable);
        } else if (row.collection === COLLECTIONS.deliveryRequests) {
          const delivery = snapshotValue<PremiumDeliveryReplayRecordV1>(row.collection, row.id, snapshot.data()!);
          if (!sameOwner(delivery.owner, input.owner)) throw new ApiHttpError(500, "PREMIUM_EXPORT_OWNER_MISMATCH", "Delivery owner index is inconsistent.");
          append(deliveries, { requestId: delivery.requestId, delivery: delivery.delivery });
        }
      }
    }
    const byIdentity = (left: unknown, right: unknown) => JSON.stringify(left).localeCompare(JSON.stringify(right));
    reports.sort(byIdentity);
    orders.sort(byIdentity);
    entitlements.sort(byIdentity);
    deliveries.sort(byIdentity);
    const result: PremiumAccountExportSectionV1 = {
      schemaVersion: "namespring.premium-account-export.v1",
      exportedAt: input.exportedAt,
      reports,
      orders,
      entitlements,
      deliveries,
      retention: {
        legalPaymentRecordsExcluded: true,
        policy: "account_link_removed_and_minimized_payment_record_retained_separately",
      },
    };
    if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_BYTES) {
      throw new ApiHttpError(413, "PREMIUM_EXPORT_TOO_LARGE", "Premium export exceeds the bounded byte limit.");
    }
    return result;
  }

  async purgeOwnerPersonalData(input: {
    owner: PremiumEntitlementOwnerV1;
    deletionRequestId: string;
    now: string;
  }) {
    const db = getFirestoreDb();
    const ownerRootId = ownerResourceRootId(input.owner);
    const receiptId = premiumDocumentKey(ownerRootId, input.deletionRequestId);
    const receiptRef = db.collection(COLLECTIONS.deletionReceipts).doc(receiptId);
    const priorReceipt = await receiptRef.get();
    if (priorReceipt.exists) {
      const prior = snapshotValue<{ deletedResources?: unknown; retainedPayments?: unknown }>(
        COLLECTIONS.deletionReceipts, receiptId, priorReceipt.data()!,
      );
      return {
        deletedResources: Number(prior.deletedResources ?? 0),
        retainedPayments: Number(prior.retainedPayments ?? 0),
        mode: "idempotent_replay" as const,
      };
    }

    const purgeable = new Set<string>([
      COLLECTIONS.registrations,
      COLLECTIONS.reports,
      COLLECTIONS.analyses,
      COLLECTIONS.checkoutRequests,
      COLLECTIONS.orders,
      COLLECTIONS.providerKeys,
      COLLECTIONS.entitlements,
      COLLECTIONS.entitlementGrants,
      COLLECTIONS.deliveryRequests,
      COLLECTIONS.contentArtifacts,
      COLLECTIONS.activeContent,
      COLLECTIONS.audit,
      COLLECTIONS.unpaidExpiryCandidates,
    ]);
    const items = db.collection(COLLECTIONS.ownerResources).doc(ownerRootId).collection("items");
    let deletedResources = 0;
    let retainedPayments = 0;

    while (true) {
      // Every row costs two writes (resource + index) and an order may add a
      // retained-payment write. 120 keeps the worst case (360) below the
      // Firestore 500-operation batch ceiling with ample migration headroom.
      const page = await items.limit(120).get();
      if (page.empty) break;
      const rows = page.docs.map((doc) => {
        const data = ownerResourceIndexValue(ownerRootId, doc.id, doc.data());
        if (typeof data.collection !== "string" || typeof data.id !== "string"
          || !purgeable.has(data.collection) || !/^[A-Za-z0-9_-]{1,256}$/u.test(data.id)) {
          throw new ApiHttpError(500, "PREMIUM_OWNER_INDEX_CORRUPT", "Premium owner resource index is invalid.");
        }
        return { indexRef: doc.ref, collection: data.collection, id: data.id };
      });
      const orderRows = rows.filter((row) => row.collection === COLLECTIONS.orders);
      // A financial handoff must observe and delete the same order revision.
      // This transaction conflicts/retries against concurrent refund or
      // reconciliation writes, preventing a stale retained ledger snapshot.
      for (const row of orderRows) {
        const didRetain = await db.runTransaction(async (transaction) => {
          const orderRef = db.collection(COLLECTIONS.orders).doc(row.id);
          const [orderSnapshot, indexSnapshot] = await Promise.all([
            transaction.get(orderRef),
            transaction.get(row.indexRef),
          ]);
          if (!indexSnapshot.exists) return false;
          if (!orderSnapshot.exists) {
            transaction.delete(row.indexRef);
            deletePremiumOrderAdminProjectionsV1(transaction, db, row.id);
            return false;
          }
          const order = snapshotValue<PremiumPaymentOrderRecordV1>(
            COLLECTIONS.orders, row.id, orderSnapshot.data()!,
          );
          if (!sameOwner(order.owner, input.owner)) {
            throw new ApiHttpError(500, "PREMIUM_OWNER_INDEX_CORRUPT", "Order owner index is inconsistent.");
          }
          const retain = Boolean(order.paymentKey)
            || ["paid", "refunded", "revoked"].includes(order.status);
          if (retain) {
            const retainedId = premiumDocumentKey("retained-payment", order.orderId);
            const value: PremiumRetainedPaymentRecordV1 = {
              schemaVersion: "namespring.retained-payment.v1",
              orderId: order.orderId,
              amount: order.amount,
              currency: order.currency,
              paymentProvider: order.paymentProvider,
              paymentKey: order.paymentKey,
              status: order.status,
              createdAt: order.createdAt,
              paidAt: order.paidAt,
              refundedAt: order.refundedAt,
              paymentRecovery: order.paymentRecovery,
              purchasePolicyReceipt: {
                termsVersion: order.purchaseTermsReceipt.termsVersion,
                termsDigest: order.purchaseTermsReceipt.termsDigest,
                refundPolicyVersion: order.purchaseTermsReceipt.refundPolicyVersion,
                refundPolicyDigest: order.purchaseTermsReceipt.refundPolicyDigest,
                recordedAt: order.purchaseTermsReceipt.recordedAt,
                bindingDigest: order.purchaseTermsReceipt.bindingDigest,
              },
              providerState: order.providerState,
              refundReason: order.refundReason,
              retainedAt: input.now,
              retentionReason: "payment_tax_refund_record",
              deletionReference: premiumDocumentKey(input.deletionRequestId),
              deleteAfter: new Date(Date.parse(input.now) + 5 * 365 * 24 * 60 * 60 * 1_000).toISOString(),
            };
            transaction.set(
              db.collection(COLLECTIONS.retainedPayments).doc(retainedId),
              storedValue(COLLECTIONS.retainedPayments, retainedId, value) as DocumentData,
              { merge: false },
            );
            writePremiumOrderAdminProjectionsV1(transaction, db, value);
          } else {
            deletePremiumOrderAdminProjectionsV1(transaction, db, order.orderId);
          }
          transaction.delete(orderRef);
          transaction.delete(row.indexRef);
          return retain;
        });
        deletedResources += 1;
        if (didRetain) retainedPayments += 1;
      }
      const batch = db.batch();
      for (const row of rows.filter((entry) => entry.collection !== COLLECTIONS.orders)) {
        batch.delete(db.collection(row.collection).doc(row.id));
        batch.delete(row.indexRef);
        if (row.collection === COLLECTIONS.entitlements) {
          deletePremiumEntitlementAdminProjectionV1(batch, db, row.id);
        }
        deletedResources += 1;
      }
      await batch.commit();
    }

    const receipt = {
      schemaVersion: "namespring.premium-deletion-receipt.v1",
      ownerReference: ownerRootId,
      deletionReference: premiumDocumentKey(input.deletionRequestId),
      completedAt: input.now,
      deletedResources,
      retainedPayments,
      deleteAfter: new Date(Date.parse(input.now) + 365 * 24 * 60 * 60 * 1_000).toISOString(),
    };
    try {
      await receiptRef.create(storedValue(COLLECTIONS.deletionReceipts, receiptId, receipt) as DocumentData);
    } catch (error) {
      const concurrent = await receiptRef.get();
      if (!concurrent.exists) throw error;
      const prior = snapshotValue<{ deletedResources?: unknown; retainedPayments?: unknown }>(
        COLLECTIONS.deletionReceipts, receiptId, concurrent.data()!,
      );
      return {
        deletedResources: Number(prior.deletedResources ?? deletedResources),
        retainedPayments: Number(prior.retainedPayments ?? retainedPayments),
        mode: "idempotent_replay" as const,
      };
    }
    return { deletedResources, retainedPayments, mode: "initial" as const };
  }
}
