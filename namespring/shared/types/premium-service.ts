import type {
  PremiumEntitlementOwnerV1,
  PremiumProductIdV1,
  PremiumRegistrationMaterialDigestV1,
  PremiumReportAccessRequestV1,
  PremiumReportBindingV1,
  PremiumReportContentV1,
  PremiumReportDeliveryV1,
  PremiumReportReferenceV1,
  PremiumReportRegistrationRequestV1,
  ReportEntitlementV1,
  ServiceCatalogV1,
} from "../../../lib/spring-ts/src/report/premium/index.js";
import type { ReportDeliveryV1 } from "../../../lib/spring-ts/src/report/delivery/index.js";

export const PREMIUM_ORDER_RECORD_SCHEMA_V1 = "namespring.premium-order-record.v1" as const;
export const PREMIUM_SERVER_ANALYSIS_SCHEMA_V1 = "namespring.premium-server-analysis.v1" as const;
export const PREMIUM_CONTENT_RECORD_SCHEMA_V1 = "namespring.premium-content-record.v1" as const;
export const PREMIUM_CONTENT_TEMPLATE_SCHEMA_V1 = "namespring.premium-content-template.v1" as const;
export const PREMIUM_AUDIT_EVENT_SCHEMA_V1 = "namespring.premium-audit-event.v1" as const;
export const PREMIUM_SEALED_ANALYSIS_SCHEMA_V1 = "namespring.premium-sealed-analysis.v1" as const;
export const PREMIUM_CONFIRMED_ORDER_VIEW_SCHEMA_V1 = "namespring.premium-confirmed-order-view.v1" as const;
export const PREMIUM_ACTIVE_ENTITLEMENT_VIEW_SCHEMA_V1 = "namespring.premium-active-entitlement-view.v1" as const;
export const PREMIUM_REPORT_REFERENCE_VIEW_SCHEMA_V1 = "namespring.premium-report-reference-view.v1" as const;
export const PREMIUM_ORDER_VIEW_SCHEMA_V1 = "namespring.premium-order-view.v1" as const;
export const PREMIUM_ENTITLEMENT_VIEW_SCHEMA_V1 = "namespring.premium-entitlement-view.v1" as const;

export type PremiumOrderStatusV1 =
  | "ready"
  | "paid"
  | "failed"
  | "refunded"
  | "revoked";

/** Canonical commerce rails. Provider tokens remain adapter-private. */
export type PremiumPaymentRailV1 =
  | "toss_web"
  | "apple_app_store"
  | "google_play";

export interface PremiumPaymentRecoveryStateV1 {
  readonly status: "not_required" | "scheduled" | "settled";
  readonly updatedAt: string;
  readonly dueAt: string | null;
}

export interface PremiumDataProcessingConsentAcceptanceV1 {
  readonly accepted: true;
  readonly noticeVersion: string;
  readonly noticeDigest: `sha256:${string}`;
  readonly purpose: "premium_report_server_recomputation";
  /** Client evidence only; server recordedAt is authoritative. */
  readonly clientAcceptedAt: string;
}

export interface PremiumDataProcessingConsentReceiptV1
  extends PremiumDataProcessingConsentAcceptanceV1 {
  readonly recordedAt: string;
  readonly registrationMaterialDigest: PremiumRegistrationMaterialDigestV1;
  readonly acceptanceDigest: `sha256:${string}`;
  readonly bindingDigest: `sha256:${string}`;
}

export interface PremiumPurchaseTermsAcceptanceV1 {
  readonly accepted: true;
  readonly termsVersion: string;
  readonly termsDigest: `sha256:${string}`;
  readonly refundPolicyVersion: string;
  readonly refundPolicyDigest: `sha256:${string}`;
  /** Client evidence only; server recordedAt is authoritative. */
  readonly clientAcceptedAt: string;
}

export interface PremiumPurchaseTermsReceiptV1 extends PremiumPurchaseTermsAcceptanceV1 {
  readonly recordedAt: string;
  readonly acceptanceDigest: `sha256:${string}`;
  readonly bindingDigest: `sha256:${string}`;
}

export type PremiumPaymentRailCapabilityV1 =
  | {
      readonly rail: "toss_web";
      readonly implemented: true;
      readonly enabled: boolean;
      readonly checkoutMode: "web_redirect";
      readonly verification: "server_provider_api";
      readonly disabledReason?: "deployment_not_verified" | "catalog_unavailable";
    }
  | {
      readonly rail: "apple_app_store" | "google_play";
      readonly implemented: false;
      readonly enabled: false;
      readonly checkoutMode: "native_store";
      readonly verification: "server_signed_purchase";
      readonly disabledReason: "adapter_not_implemented";
    };

/** Session middleware projects its richer principal onto this server-only actor. */
export interface PremiumActorV1 {
  readonly userId: string;
  readonly sessionId: string;
  readonly roles: readonly string[];
}

export interface PremiumServerEvidenceRefV1 {
  /** Server-issued evidence ID accepted by paid content. */
  readonly evidenceId: string;
  /** ID emitted by the recomputed SpringEngine delivery. */
  readonly sourceId: string;
  readonly sourceKind: "fact" | "interpretation";
}

/**
 * Immutable result of a trusted server recomputation. The browser cannot submit
 * this object. It is built from PremiumReportRegistrationRequestV1 source input.
 */
export interface PremiumServerAnalysisRecordV1 {
  readonly schemaVersion: typeof PREMIUM_SERVER_ANALYSIS_SCHEMA_V1;
  readonly analysisId: string;
  readonly reportId: string;
  readonly owner: PremiumEntitlementOwnerV1;
  readonly registrationRequestId: string;
  readonly materialDigest: PremiumRegistrationMaterialDigestV1;
  readonly dataProcessingConsent: PremiumDataProcessingConsentReceiptV1;
  readonly recomputedAt: string;
  /**
   * Firestore never receives the plaintext report. It can include a person's
   * name, so the server repository seals the complete deterministic delivery
   * with an operator-managed AES-256-GCM key before persistence.
   */
  readonly sealedDelivery: PremiumSealedAnalysisPayloadV1;
  readonly evidence: readonly PremiumServerEvidenceRefV1[];
  readonly contentSelector: PremiumContentSelectorV1;
}

export interface PremiumContentSelectorV1 {
  readonly schemaVersion: "namespring.premium-content-selector.v1";
  readonly algorithmVersion: "story-selector-v1" | "story-selector-v2";
  /** Most specific first; the reviewed default key is always last. */
  readonly keys: readonly string[];
  readonly axes: {
    readonly category: "overall" | "health" | "wealth" | "romance" | "family" | "academic";
    readonly period: "today" | "thisWeek" | "thisMonth" | "thisYear" | "life";
    readonly age: "child" | "youth" | "adult" | "senior" | "unknown";
    readonly band: "high" | "mid" | "low" | "unknown";
    readonly gender: "male" | "female" | "other";
    readonly strength: "strong" | "balanced" | "weak" | "unknown";
    readonly gyeok: "bigeop" | "insung" | "gwanseong" | "jaeseong" | "siksang" | "special" | "unknown";
    readonly interaction: "boost" | "neutral" | "adverse" | "unknown";
  };
}

export interface PremiumSealedAnalysisPayloadV1 {
  readonly schemaVersion: typeof PREMIUM_SEALED_ANALYSIS_SCHEMA_V1;
  readonly algorithm: "A256GCM";
  readonly keyId: string;
  readonly iv: string;
  readonly ciphertext: string;
  readonly authenticationTag: string;
}

/** Plaintext exists only inside the trusted process while recomputing/reviewing. */
export interface PremiumServerAnalysisPlaintextV1 {
  readonly delivery: ReportDeliveryV1;
}

/** Paid prose is unavailable until an operator-approved, versioned record exists. */
export type PremiumContentLifecycleV1 =
  | "draft"
  | "reviewed"
  | "approved"
  | "active"
  | "retired";

export interface PremiumContentProvenanceV1 {
  readonly sourceDigest: `sha256:${string}`;
  readonly model: {
    readonly provider: string;
    readonly modelId: string;
    readonly generatedAt: string;
  };
  readonly prompt: {
    readonly promptId: string;
    readonly promptVersion: string;
    readonly promptDigest: `sha256:${string}`;
  };
  readonly gate: {
    readonly gateVersion: string;
    readonly status: "passed" | "failed";
    readonly evaluatedAt: string;
    readonly resultDigest: `sha256:${string}`;
    /** Trusted pipeline attestation over the exact pre-review material subject. */
    readonly attestation: {
      readonly scheme: "HMAC-SHA256-V1";
      readonly keyId: string;
      readonly subjectDigest: `sha256:${string}`;
      readonly signature: `hmac-sha256:${string}`;
    };
  };
  readonly humanReview?: {
    readonly reviewerId: string;
    readonly reviewedAt: string;
    readonly decision: "approved" | "rejected";
    readonly notesDigest: `sha256:${string}`;
  };
}

export interface PremiumContentArtifactRecordV1 {
  readonly schemaVersion: typeof PREMIUM_CONTENT_RECORD_SCHEMA_V1;
  readonly artifactId: string;
  readonly reportId: string;
  readonly productId: PremiumProductIdV1;
  readonly contentVersion: string;
  readonly lifecycle: PremiumContentLifecycleV1;
  readonly provenance: PremiumContentProvenanceV1;
  /** Set exactly once when approved content becomes deliverable. */
  readonly activation?: {
    readonly activationId: string;
    /** Opaque server-issued review authority; never a reviewer identity. */
    readonly reviewReceiptId: string;
    readonly activatedAt: string;
    readonly activatedBy: string;
    readonly immutableContentDigest: `sha256:${string}`;
  };
  readonly content: PremiumReportContentV1;
}

export type PremiumTemplatePlaceholderV1 =
  | "displayName"
  | "dayMasterStem"
  | "yongshinElement"
  | "strengthLevel";

export interface PremiumContentTemplateSectionV1 {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** Stable IDs from SpringEngine output; rebound to report-specific evidence IDs at delivery. */
  readonly evidenceSourceRefs: readonly string[];
}

/**
 * A human-reviewed reusable asset selected by deterministic case/contentKey.
 * It cannot carry a reportId or final evidence ID.
 */
export interface PremiumContentTemplateRecordV1 {
  readonly schemaVersion: typeof PREMIUM_CONTENT_TEMPLATE_SCHEMA_V1;
  readonly templateId: string;
  readonly productId: PremiumProductIdV1;
  readonly contentVersion: string;
  readonly selectorKey: string;
  readonly lifecycle: PremiumContentLifecycleV1;
  readonly provenance: PremiumContentProvenanceV1;
  readonly placeholderAllowlist: readonly PremiumTemplatePlaceholderV1[];
  readonly activation?: {
    readonly activationId: string;
    /** Opaque server-issued review authority; never a reviewer identity. */
    readonly reviewReceiptId: string;
    readonly activatedAt: string;
    readonly activatedBy: string;
    readonly immutableContentDigest: `sha256:${string}`;
  };
  readonly template: {
    readonly kind: "story_completion";
    readonly format: "structured_plain_text_v1";
    readonly title: string;
    readonly summary: string;
    readonly sections: readonly PremiumContentTemplateSectionV1[];
  };
}

export interface PremiumContentActivationBindingV1 {
  readonly sourceKind: "report_artifact" | "case_template";
  readonly resourceId: string;
  readonly activationId: string;
  readonly immutableContentDigest: `sha256:${string}`;
  readonly selectorKey?: string;
}

/**
 * Build-time-only handoff for free/local content. Runtime browser calculation
 * imports the exported asset and must never query the server content database.
 */
export interface ApprovedLocalContentExportManifestV1 {
  readonly schemaVersion: "namespring.local-content-export-manifest.v1";
  readonly exportId: string;
  readonly exportedAt: string;
  readonly contentVersion: string;
  readonly sourceArtifactIds: readonly string[];
  readonly sourceActivationIds: readonly string[];
  readonly assetDigest: `sha256:${string}`;
  readonly runtimeBoundary: "build_time_local_asset_only";
}

export interface PremiumPaymentOrderRecordV1 {
  readonly schemaVersion: typeof PREMIUM_ORDER_RECORD_SCHEMA_V1;
  readonly orderId: string;
  /** Owner-scoped checkout idempotency key. */
  readonly requestId: string;
  /** Server-only; the enclosing order record is encrypted at rest. */
  readonly accountWriteSubjectId: string;
  readonly owner: PremiumEntitlementOwnerV1;
  readonly binding: PremiumReportBindingV1;
  /** Exact approved content snapshot rechecked atomically before payment activation. */
  readonly contentActivation: PremiumContentActivationBindingV1;
  readonly catalogVersion: string;
  readonly purchaseTermsReceipt: PremiumPurchaseTermsReceiptV1;
  readonly amount: number;
  readonly currency: "KRW";
  readonly status: PremiumOrderStatusV1;
  readonly paymentProvider: PremiumPaymentRailV1;
  readonly paymentKey: string | null;
  readonly entitlementId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly paidAt: string | null;
  readonly refundedAt: string | null;
  /** Metadata-only recovery state; the provider token remains sealed elsewhere. */
  readonly paymentRecovery: PremiumPaymentRecoveryStateV1;
  /** Last provider event accepted after an authoritative Toss API read. */
  readonly providerState?: {
    readonly status: string;
    /** Provider-confirmed original charge and remaining refundable balance. */
    readonly totalAmount: number;
    readonly balanceAmount: number;
    readonly occurredAt: string;
    readonly observedAt: string;
    readonly eventId: string;
  };
  readonly failureCode?: string;
  readonly refundReason?: string;
}

export interface PremiumAuditEventV1 {
  readonly schemaVersion: typeof PREMIUM_AUDIT_EVENT_SCHEMA_V1;
  readonly auditId: string;
  readonly occurredAt: string;
  /** Firestore TTL boundary; service audit is separate from legal payment retention. */
  readonly deleteAfter: string;
  readonly action:
    | "report.registered"
    | "payment.created"
    | "payment.confirmed"
    | "payment.refunded"
    | "payment.reconciled"
    | "entitlement.revoked"
    | "content.reviewed"
    | "content.activated"
    | "content.retired"
    | "report.delivered";
  /**
   * Key-addressed v2 HMAC pseudonyms for actor and session. Raw identifiers are
   * never stored; retained key IDs support bounded correlation during rotation.
   */
  readonly actor: PremiumActorV1;
  readonly owner: PremiumEntitlementOwnerV1;
  readonly reportId: string;
  readonly orderId?: string;
  readonly entitlementId?: string;
  readonly requestId?: string;
  readonly reason?: string;
  /** Consent/purchase receipt binding only; no notice text or request metadata. */
  readonly policyReceiptDigest?: `sha256:${string}`;
}

export interface RegisterPremiumReportCommandV1 {
  readonly request: PremiumReportRegistrationRequestV1;
  readonly dataProcessingConsent: PremiumDataProcessingConsentAcceptanceV1;
}

export interface RegisterPremiumReportResultV1 {
  readonly report: PremiumReportReferenceViewV1;
  readonly registrationMode: "initial" | "idempotent_replay";
}

/** Browser-safe report locator. Registration owner and consent/material digests stay server-side. */
export interface PremiumReportReferenceViewV1 {
  readonly schemaVersion: typeof PREMIUM_REPORT_REFERENCE_VIEW_SCHEMA_V1;
  readonly binding: PremiumReportBindingV1;
  readonly status: PremiumReportReferenceV1["status"];
  readonly registeredAt: string;
  readonly updatedAt: string;
}

export interface CreatePremiumCheckoutCommandV1 {
  readonly reportId: string;
  readonly productId: PremiumProductIdV1;
  /** Client idempotency key, not an order or authorization credential. */
  readonly requestId: string;
  readonly purchaseTermsAcceptance: PremiumPurchaseTermsAcceptanceV1;
}

export interface CreatePremiumCheckoutResultV1 {
  readonly orderId: string;
  readonly orderName: string;
  readonly amount: number;
  readonly currency: "KRW";
  readonly catalogVersion: string;
  readonly binding: PremiumReportBindingV1;
}

export interface ConfirmPremiumPaymentCommandV1 {
  readonly orderId: string;
  readonly paymentKey: string;
  readonly amount: number;
  readonly currency: "KRW";
}

/**
 * Browser-safe projection of a paid order. The encrypted persistence record is
 * deliberately not an API DTO: accountWriteSubjectId, paymentKey, provider
 * observations, audit state, and ownership pseudonyms stay server-side.
 */
export interface PremiumConfirmedOrderViewV1 {
  readonly schemaVersion: typeof PREMIUM_CONFIRMED_ORDER_VIEW_SCHEMA_V1;
  readonly orderId: string;
  readonly binding: PremiumReportBindingV1;
  readonly amount: number;
  readonly currency: "KRW";
  readonly status: "paid";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly paidAt: string | null;
}

/** Minimum client capability needed to request the purchased report. */
export interface PremiumActiveEntitlementViewV1 {
  readonly schemaVersion: typeof PREMIUM_ACTIVE_ENTITLEMENT_VIEW_SCHEMA_V1;
  readonly entitlementId: string;
  readonly binding: PremiumReportBindingV1;
  readonly status: "active";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly activatedAt?: string;
  readonly expiresAt?: string;
}

export interface ConfirmPremiumPaymentResultV1 {
  readonly order: PremiumConfirmedOrderViewV1;
  readonly entitlement: PremiumActiveEntitlementViewV1;
  readonly confirmationMode: "initial" | "idempotent_replay";
}

/** Browser-safe terminal/order projection shared by refund and admin operations. */
export interface PremiumOrderViewV1 {
  readonly schemaVersion: typeof PREMIUM_ORDER_VIEW_SCHEMA_V1;
  readonly orderId: string;
  readonly reportId: string;
  readonly productId: string;
  readonly contentVersion: string;
  readonly amount: number;
  readonly currency: "KRW";
  readonly status: PremiumOrderStatusV1;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly paidAt: string | null;
  readonly refundedAt: string | null;
}

/** Browser-safe entitlement projection. Ownership and grant internals stay server-side. */
export interface PremiumEntitlementViewV1 {
  readonly schemaVersion: typeof PREMIUM_ENTITLEMENT_VIEW_SCHEMA_V1;
  readonly entitlementId: string;
  readonly reportId: string;
  readonly productId: string;
  readonly contentVersion: string;
  readonly status: ReportEntitlementV1["status"];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly activatedAt?: string;
  readonly expiresAt?: string;
}

export interface RefundPremiumPaymentCommandV1 {
  readonly orderId: string;
  readonly reason: string;
}

export interface PremiumRetainedPaymentSummaryV1 {
  readonly schemaVersion: "namespring.retained-payment-summary.v1";
  readonly orderId: string;
  readonly amount: number;
  readonly currency: "KRW";
  readonly status: PremiumOrderStatusV1;
  readonly createdAt: string;
  readonly paidAt: string | null;
  readonly refundedAt: string | null;
  readonly deleteAfter: string;
}

export type RefundPremiumPaymentResultV1 =
  | {
      readonly order: PremiumOrderViewV1;
      readonly entitlement: PremiumEntitlementViewV1;
      readonly refundMode: "initial" | "idempotent_replay";
    }
  | {
      readonly retainedPayment: PremiumRetainedPaymentSummaryV1;
      readonly refundMode: "initial" | "idempotent_replay";
    };

export interface RevokePremiumEntitlementCommandV1 {
  readonly entitlementId: string;
  readonly reason: string;
}

export type PremiumPaymentReconciliationViewV1 = PremiumOrderViewV1 | PremiumRetainedPaymentSummaryV1;

export interface DeliverPremiumReportCommandV1 {
  readonly access: PremiumReportAccessRequestV1;
}

export interface DeliverPremiumReportResultV1 {
  readonly delivery: PremiumReportDeliveryV1;
}

export type PremiumServiceCatalogV1 = ServiceCatalogV1;
