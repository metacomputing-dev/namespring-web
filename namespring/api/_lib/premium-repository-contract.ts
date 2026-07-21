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
  PremiumPaymentRailV1,
  PremiumPaymentRecoveryStateV1,
  PremiumServerAnalysisRecordV1,
} from "../../shared/types/premium-service.js";
import type { PremiumContentReviewReceiptV1 } from "./premium-review-contract.js";

/** Persistence-neutral replay row returned with an access snapshot. */
export interface PremiumDeliveryReplayRecordV1 {
  readonly owner: PremiumEntitlementOwnerV1;
  readonly requestId: string;
  readonly entitlementId: string;
  readonly binding: PremiumReportBindingV1;
  readonly delivery: PremiumReportDeliveryV1;
  readonly createdAt: string;
}

/**
 * Queue cursors contain no decrypted payment identity. The adapter opens the
 * encrypted lease and current financial state transactionally before I/O.
 */
export interface PremiumPaymentLeaseCandidateV1 {
  readonly internalUserId: string;
  readonly dueAt: string | null;
}

export interface PremiumPaymentLeaseWorkItemV1 extends PremiumPaymentLeaseCandidateV1 {
  readonly dueAt: string;
  /** A previous attempt may have committed the provider transition before its lease cleanup. */
  readonly settlementState: "scheduled" | "settled";
  readonly orderId: string;
  readonly ownerSubjectId: string;
  readonly paymentKey: string;
  readonly acquiredAt: string;
  readonly reconcileAfter: string;
}

export interface PremiumUnpaidExpirySweepResultV1 {
  readonly scanned: number;
  readonly deleted: number;
  readonly skipped: number;
  readonly failed: number;
  readonly hasMore: boolean;
}

export interface PremiumRegistrationCommitV1 {
  readonly internalUserId: string;
  readonly report: PremiumReportReferenceV1;
  readonly analysis: PremiumServerAnalysisRecordV1;
  readonly audit: PremiumAuditEventV1;
}

export interface PremiumProviderObservationV1 {
  readonly eventId: string;
  readonly paymentKey: string;
  readonly orderId: string;
  readonly status: string;
  readonly totalAmount: number;
  readonly balanceAmount: number;
  readonly currency: string;
  readonly occurredAt: string;
  readonly observedAt: string;
}

export interface PremiumRetainedPaymentRecordV1 {
  readonly schemaVersion: "namespring.retained-payment.v1";
  readonly orderId: string;
  readonly amount: number;
  readonly currency: "KRW";
  readonly paymentProvider: PremiumPaymentRailV1;
  readonly paymentKey: string | null;
  readonly status: PremiumPaymentOrderRecordV1["status"];
  readonly createdAt: string;
  readonly paidAt: string | null;
  readonly refundedAt: string | null;
  readonly paymentRecovery: PremiumPaymentRecoveryStateV1;
  readonly purchasePolicyReceipt: {
    readonly termsVersion: string;
    readonly termsDigest: `sha256:${string}`;
    readonly refundPolicyVersion: string;
    readonly refundPolicyDigest: `sha256:${string}`;
    readonly recordedAt: string;
    readonly bindingDigest: `sha256:${string}`;
  };
  readonly providerState?: PremiumPaymentOrderRecordV1["providerState"];
  readonly refundReason?: string;
  readonly retainedAt: string;
  readonly retentionReason: "payment_tax_refund_record";
  readonly deletionReference: string;
  readonly deleteAfter: string;
}

export interface PremiumPaymentCommitResultV1 {
  readonly order: PremiumPaymentOrderRecordV1;
  readonly entitlement: ReportEntitlementV1;
  readonly mode: "initial" | "idempotent_replay";
}

export interface PremiumAccessSnapshotV1 {
  readonly report: PremiumReportReferenceV1 | null;
  readonly entitlement: ReportEntitlementV1 | null;
  readonly analysis: PremiumServerAnalysisRecordV1 | null;
  readonly content: PremiumContentArtifactRecordV1 | null;
  readonly template: PremiumContentTemplateRecordV1 | null;
  readonly contentActivation: PremiumContentActivationBindingV1 | null;
  readonly replay: PremiumDeliveryReplayRecordV1 | null;
}

export interface PremiumAccountExportSectionV1 {
  readonly schemaVersion: "namespring.premium-account-export.v1";
  readonly exportedAt: string;
  readonly reports: readonly {
    readonly binding: PremiumReportBindingV1;
    readonly status: PremiumReportReferenceV1["status"];
    readonly registeredAt: string;
    readonly updatedAt: string;
  }[];
  readonly orders: readonly {
    readonly orderId: string;
    readonly binding: PremiumReportBindingV1;
    readonly amount: number;
    readonly currency: "KRW";
    readonly status: PremiumPaymentOrderRecordV1["status"];
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly paidAt: string | null;
    readonly refundedAt: string | null;
  }[];
  readonly entitlements: readonly Omit<ReportEntitlementV1, "owner">[];
  readonly deliveries: readonly {
    readonly requestId: string;
    readonly delivery: PremiumReportDeliveryV1;
  }[];
  readonly retention: {
    readonly legalPaymentRecordsExcluded: true;
    readonly policy: "account_link_removed_and_minimized_payment_record_retained_separately";
  };
}

/** Domain port implemented by the production adapter and deterministic test doubles. */
export interface PremiumRepositoryV1 {
  getRegistration(owner: PremiumEntitlementOwnerV1, requestId: string): Promise<{
    readonly materialDigest: string;
    readonly consentAcceptanceDigest: `sha256:${string}`;
    readonly report: PremiumReportReferenceV1;
  } | null>;
  commitRegistration(input: PremiumRegistrationCommitV1): Promise<{
    readonly report: PremiumReportReferenceV1;
    readonly mode: "initial" | "idempotent_replay";
  }>;
  getReport(reportId: string): Promise<PremiumReportReferenceV1 | null>;
  getAnalysis(analysisId: string): Promise<PremiumServerAnalysisRecordV1 | null>;
  getActiveContent(binding: PremiumReportBindingV1): Promise<PremiumContentArtifactRecordV1 | null>;
  getActiveTemplate(input: {
    readonly productId: string;
    readonly contentVersion: string;
    readonly selectorKeys: readonly string[];
  }): Promise<PremiumContentTemplateRecordV1 | null>;
  getContentReviewReceipt(receiptId: string): Promise<PremiumContentReviewReceiptV1 | null>;
  createContentReview(input: {
    readonly receipt: PremiumContentReviewReceiptV1;
    readonly reviewer: PremiumActorV1;
    readonly audit: PremiumAuditEventV1;
  }): Promise<{ readonly receipt: PremiumContentReviewReceiptV1; readonly mode: "initial" | "idempotent_replay" }>;
  activateContent(input: {
    readonly artifact: PremiumContentArtifactRecordV1;
    readonly reviewReceiptId: string;
    readonly activationRequestId: string;
    readonly reviewedMaterialDigest: `sha256:${string}`;
    readonly activator: PremiumActorV1;
    readonly audit: PremiumAuditEventV1;
  }): Promise<PremiumContentArtifactRecordV1>;
  activateTemplate(input: {
    readonly template: PremiumContentTemplateRecordV1;
    readonly sampleReportId: string;
    readonly reviewReceiptId: string;
    readonly activationRequestId: string;
    readonly reviewedMaterialDigest: `sha256:${string}`;
    readonly activator: PremiumActorV1;
    readonly audit: PremiumAuditEventV1;
  }): Promise<PremiumContentTemplateRecordV1>;
  retireContent(input: {
    readonly binding: PremiumReportBindingV1;
    readonly activation: PremiumContentActivationBindingV1;
    readonly retiredAt: string;
    readonly audit: PremiumAuditEventV1;
  }): Promise<void>;
  createCheckout(input: {
    readonly internalUserId: string;
    readonly order: PremiumPaymentOrderRecordV1;
    readonly audit: PremiumAuditEventV1;
  }): Promise<{ readonly order: PremiumPaymentOrderRecordV1; readonly mode: "initial" | "idempotent_replay" }>;
  getOrder(orderId: string): Promise<PremiumPaymentOrderRecordV1 | null>;
  getRetainedPayment(orderId: string): Promise<PremiumRetainedPaymentRecordV1 | null>;
  getEntitlement(entitlementId: string): Promise<ReportEntitlementV1 | null>;
  acquirePaymentConfirmationLease(input: {
    readonly internalUserId: string;
    readonly owner: PremiumEntitlementOwnerV1;
    readonly orderId: string;
    readonly paymentKey: string;
    readonly now: string;
  }): Promise<{ readonly mode: "initial" | "idempotent_replay" }>;
  listDuePaymentConfirmationLeaseCandidates(input: {
    readonly now: string;
    readonly limit: number;
  }): Promise<readonly PremiumPaymentLeaseCandidateV1[]>;
  readDuePaymentConfirmationLease(input: {
    readonly candidate: PremiumPaymentLeaseCandidateV1;
    readonly now: string;
  }): Promise<PremiumPaymentLeaseWorkItemV1>;
  finalizeSettledPaymentConfirmationLease(input: {
    readonly lease: PremiumPaymentLeaseWorkItemV1;
  }): Promise<void>;
  sweepExpiredUnpaidData(input: {
    readonly now: string;
    readonly limit: number;
  }): Promise<PremiumUnpaidExpirySweepResultV1>;
  confirmPayment(input: {
    readonly orderId: string;
    readonly actor: PremiumActorV1;
    readonly owner: PremiumEntitlementOwnerV1;
    readonly observation: PremiumProviderObservationV1;
    readonly entitlementId: string;
    readonly audit: PremiumAuditEventV1;
  }): Promise<PremiumPaymentCommitResultV1>;
  refundPayment(input: {
    readonly orderId: string;
    readonly actor: PremiumActorV1;
    readonly reason: string;
    readonly observation: PremiumProviderObservationV1;
    readonly audit: PremiumAuditEventV1;
  }): Promise<PremiumPaymentCommitResultV1>;
  compensateCanceledPayment(input: {
    readonly orderId: string;
    readonly actor: PremiumActorV1;
    readonly reason: string;
    readonly observation: PremiumProviderObservationV1;
    readonly audit: PremiumAuditEventV1;
  }): Promise<{
    readonly order: PremiumPaymentOrderRecordV1;
    readonly entitlement: ReportEntitlementV1 | null;
    readonly mode: "initial" | "idempotent_replay";
  }>;
  settleRetainedPayment(input: {
    readonly orderId: string;
    readonly actor: PremiumActorV1;
    readonly reason: string;
    readonly observation: PremiumProviderObservationV1;
  }): Promise<{ readonly payment: PremiumRetainedPaymentRecordV1; readonly mode: "initial" | "idempotent_replay" }>;
  failUnpaidOrder(input: {
    readonly orderId: string;
    readonly actor: PremiumActorV1;
    readonly observation: PremiumProviderObservationV1;
    readonly audit: PremiumAuditEventV1;
  }): Promise<PremiumPaymentOrderRecordV1>;
  revokeEntitlement(input: {
    readonly entitlementId: string;
    readonly actor: PremiumActorV1;
    readonly reason: string;
    readonly now: string;
    readonly audit: PremiumAuditEventV1;
  }): Promise<ReportEntitlementV1>;
  getAccessSnapshot(input: {
    readonly owner: PremiumEntitlementOwnerV1;
    readonly requestId: string;
    readonly entitlementId: string;
    readonly binding: PremiumReportBindingV1;
  }): Promise<PremiumAccessSnapshotV1>;
  commitDelivery(input: {
    readonly internalUserId: string;
    readonly owner: PremiumEntitlementOwnerV1;
    readonly requestId: string;
    readonly delivery: PremiumReportDeliveryV1;
    readonly contentActivation: PremiumContentActivationBindingV1;
    readonly audit: PremiumAuditEventV1;
  }): Promise<{ readonly delivery: PremiumReportDeliveryV1; readonly mode: "initial" | "idempotent_replay" }>;
  exportOwnerPortableData(input: {
    readonly owner: PremiumEntitlementOwnerV1;
    readonly exportedAt: string;
  }): Promise<PremiumAccountExportSectionV1>;
  purgeOwnerPersonalData(input: {
    readonly owner: PremiumEntitlementOwnerV1;
    readonly deletionRequestId: string;
    readonly now: string;
  }): Promise<{
    readonly deletedResources: number;
    readonly retainedPayments: number;
    readonly mode: "initial" | "idempotent_replay";
  }>;
}
