import {
  PREMIUM_REPORT_DELIVERY_SCHEMA_V1,
  PREMIUM_REPORT_REFERENCE_SCHEMA_V1,
  REPORT_ENTITLEMENT_SCHEMA_V1,
  assertPremiumReportAccessRequestV1,
  assertPremiumReportDeliveryV1,
  assertPremiumReportReferenceForRegistrationDecisionV1,
  assertPremiumReportRegistrationRequestV1,
  createPremiumRegistrationMaterialDigestV1,
  evaluatePremiumReportAccessV1,
  evaluatePremiumReportRegistrationReplayV1,
  type PremiumEntitlementOwnerV1,
  type PremiumReportAccessRequestV1,
  type PremiumReportBindingV1,
  type PremiumReportDeliveryV1,
  type PremiumReportReferenceV1,
  type PremiumReportRegistrationRequestV1,
  type ReportEntitlementV1,
  type ServiceCatalogProductV1,
} from "../../../lib/spring-ts/src/report/premium/index.js";
import { REPORT_DELIVERY_REQUEST_SCHEMA_V1 } from "../../../lib/spring-ts/src/report/delivery/types.js";
import type { SpringEngine } from "../../../lib/spring-ts/src/spring-engine.js";
import {
  PREMIUM_AUDIT_EVENT_SCHEMA_V1,
  PREMIUM_ACTIVE_ENTITLEMENT_VIEW_SCHEMA_V1,
  PREMIUM_CONFIRMED_ORDER_VIEW_SCHEMA_V1,
  PREMIUM_ENTITLEMENT_VIEW_SCHEMA_V1,
  PREMIUM_ORDER_VIEW_SCHEMA_V1,
  PREMIUM_REPORT_REFERENCE_VIEW_SCHEMA_V1,
  PREMIUM_SERVER_ANALYSIS_SCHEMA_V1,
  type ConfirmPremiumPaymentCommandV1,
  type ConfirmPremiumPaymentResultV1,
  type CreatePremiumCheckoutCommandV1,
  type CreatePremiumCheckoutResultV1,
  type DeliverPremiumReportResultV1,
  type PremiumActorV1,
  type PremiumAuditEventV1,
  type PremiumContentArtifactRecordV1,
  type PremiumContentActivationBindingV1,
  type PremiumContentTemplateRecordV1,
  type PremiumPaymentOrderRecordV1,
  type PremiumPaymentReconciliationViewV1,
  type PremiumDataProcessingConsentAcceptanceV1,
  type PremiumEntitlementViewV1,
  type PremiumOrderViewV1,
  type PremiumReportReferenceViewV1,
  type PremiumRetainedPaymentSummaryV1,
  type PremiumServerAnalysisRecordV1,
  type RefundPremiumPaymentResultV1,
  type RegisterPremiumReportResultV1,
} from "../../shared/types/premium-service.js";
import { ApiHttpError } from "./http.js";
import {
  activatePremiumArtifactBindingV1 as activationForArtifact,
  activatePremiumTemplateBindingV1 as activationForTemplate,
  assertPremiumApprovalChronologyV1 as assertApprovalChronology,
  buildPremiumContentSelectorV1 as buildContentSelector,
  instantiatePremiumTemplateV1 as instantiateTemplate,
  premiumContentDigestV1 as sha256,
  validatePremiumArtifactReviewCandidateV1,
  validatePremiumTemplateReviewCandidateV1,
  assertPremiumArtifactReviewCandidateShapeV1,
  assertPremiumTemplateReviewCandidateShapeV1,
} from "./premium-content-policy.js";
export {
  classifyPremiumAgeAxisV1,
  classifyPremiumBandAxisV1,
  classifyPremiumGyeokAxisV1,
  classifyPremiumStrengthAxisV1,
} from "./premium-content-policy.js";
import {
  samePremiumContentActivationV1 as sameActivation,
  samePremiumOwnerV1 as sameOwner,
  samePremiumReportBindingV1 as sameBinding,
} from "./premium-domain-equality.js";
import {
  getPremiumAuditHmacKeyringV1,
  premiumAuditActorV2,
  premiumAuditDeleteAfterV1,
  premiumAuditSubjectMatchesV2,
} from "./premium-audit-privacy.js";
import { sealPremiumAnalysisDeliveryV1 } from "./premium-crypto.js";
import { getPremiumServiceCatalogV1, requireActivePremiumProductV1 } from "./premium-catalog.js";
import {
  assertTossWebRailV1,
  getPremiumPaymentRailCapabilitiesV1,
  requirePremiumPaymentRailEnabledV1,
} from "./premium-payment-provider.js";
import {
  buildPremiumDataProcessingConsentReceiptV1,
  buildPremiumPurchaseTermsReceiptV1,
  getPremiumPolicyCapabilityV1,
} from "./premium-policy.js";
import { newPremiumId, premiumEvidenceId } from "./premium-ids.js";
import { isLegacyPremiumOwnerV1, premiumOwnerForInternalUserIdV2 } from "./premium-owner.js";
export { premiumOwnerForInternalUserIdV2 } from "./premium-owner.js";
import { FirestorePremiumRepositoryV1 } from "./premium-repository.js";
import type {
  PremiumProviderObservationV1,
  PremiumRepositoryV1,
  PremiumRetainedPaymentRecordV1,
} from "./premium-repository-contract.js";
import {
  assertPremiumActivationRequestIdV1,
  assertPremiumReviewReceiptReferenceV1,
  premiumActivationIdV1,
  premiumArtifactGateSubjectDigestV1,
  premiumArtifactReviewedMaterialDigestV1,
  premiumReviewAuthorityExpiresAtV1,
  premiumReviewDeleteAfterV1,
  premiumReviewReceiptIdV1,
  premiumReviewReceiptViewV1,
  premiumTemplateReviewedMaterialDigestV1,
  premiumTemplateGateSubjectDigestV1,
  PREMIUM_CONTENT_REVIEW_RECEIPT_SCHEMA_V1,
  type PremiumContentReviewReceiptV1,
  type PremiumContentReviewReceiptViewV1,
} from "./premium-review-contract.js";
import { assertPremiumGateAttestationV1 } from "./premium-gate-attestation.js";
import {
  HttpTossPremiumClientV1,
  PREMIUM_PROVIDER_REQUEST_TIMEOUT_MS,
  type TossPremiumClientV1,
} from "./premium-toss.js";

export interface PremiumAnalysisEngineV1 {
  init(): Promise<void>;
  getReportDelivery: SpringEngine["getReportDelivery"];
  close(): void;
}

let installedPremiumEngineFactory: (() => PremiumAnalysisEngineV1) | null = null;

/** Installed only by the Node filesystem runtime adapter after asset checks pass. */
export function installPremiumAnalysisEngineFactoryV1(factory: () => PremiumAnalysisEngineV1): void {
  installedPremiumEngineFactory = factory;
}

function createInstalledPremiumEngineV1(): PremiumAnalysisEngineV1 {
  if (!installedPremiumEngineFactory) {
    throw new ApiHttpError(503, "PREMIUM_ANALYSIS_ENGINE_UNAVAILABLE", "Premium registration engine adapter is not installed.");
  }
  return installedPremiumEngineFactory();
}

export interface PremiumServiceDependenciesV1 {
  readonly repository: PremiumRepositoryV1;
  readonly toss: TossPremiumClientV1;
  readonly now: () => string;
  readonly createEngine: () => PremiumAnalysisEngineV1;
  readonly ownerForActor: (actor: PremiumActorV1) => PremiumEntitlementOwnerV1;
}

export interface PremiumLeaseReconciliationSweepResultV1 {
  readonly scanned: number;
  readonly settled: number;
  readonly retryRequired: number;
  readonly deadlineReached: boolean;
  readonly hasMore: boolean;
}

function defaultOwnerForActor(actor: PremiumActorV1): PremiumEntitlementOwnerV1 {
  return premiumOwnerForInternalUserIdV2(actor.userId);
}

export function createDefaultPremiumServiceDependenciesV1(): PremiumServiceDependenciesV1 {
  return {
    repository: new FirestorePremiumRepositoryV1(),
    toss: new HttpTossPremiumClientV1(),
    now: () => new Date().toISOString(),
    // A browser-default SpringEngine can attempt URL/WASM fetches. Paid
    // registration is deliberately unavailable until the Node filesystem
    // adapter installs a repository-backed factory.
    createEngine: createInstalledPremiumEngineV1,
    ownerForActor: defaultOwnerForActor,
  };
}

function paymentConfirmationView(
  order: PremiumPaymentOrderRecordV1,
  entitlement: ReportEntitlementV1,
  confirmationMode: ConfirmPremiumPaymentResultV1["confirmationMode"],
): ConfirmPremiumPaymentResultV1 {
  if (order.status !== "paid" || !order.entitlementId
    || entitlement.status !== "active" || order.entitlementId !== entitlement.entitlementId
    || !sameOwner(order.owner, entitlement.owner) || !sameBinding(order.binding, entitlement.binding)) {
    throw new ApiHttpError(500, "PREMIUM_CONFIRMATION_STATE_INVALID", "Confirmed payment state is inconsistent.");
  }
  return {
    order: {
      schemaVersion: PREMIUM_CONFIRMED_ORDER_VIEW_SCHEMA_V1,
      orderId: order.orderId,
      binding: order.binding,
      amount: order.amount,
      currency: order.currency,
      status: "paid",
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt,
    },
    entitlement: {
      schemaVersion: PREMIUM_ACTIVE_ENTITLEMENT_VIEW_SCHEMA_V1,
      entitlementId: entitlement.entitlementId,
      binding: entitlement.binding,
      status: "active",
      createdAt: entitlement.createdAt,
      updatedAt: entitlement.updatedAt,
      ...(entitlement.activatedAt ? { activatedAt: entitlement.activatedAt } : {}),
      ...(entitlement.expiresAt ? { expiresAt: entitlement.expiresAt } : {}),
    },
    confirmationMode,
  };
}

function reportReferenceView(report: PremiumReportReferenceV1): PremiumReportReferenceViewV1 {
  return {
    schemaVersion: PREMIUM_REPORT_REFERENCE_VIEW_SCHEMA_V1,
    binding: report.binding,
    status: report.status,
    registeredAt: report.registeredAt,
    updatedAt: report.updatedAt,
  };
}

function paymentOrderView(order: PremiumPaymentOrderRecordV1): PremiumOrderViewV1 {
  return {
    schemaVersion: PREMIUM_ORDER_VIEW_SCHEMA_V1,
    orderId: order.orderId,
    reportId: order.binding.reportId,
    productId: order.binding.productId,
    contentVersion: order.binding.contentVersion,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt,
    refundedAt: order.refundedAt,
  };
}

function entitlementView(entitlement: ReportEntitlementV1): PremiumEntitlementViewV1 {
  return {
    schemaVersion: PREMIUM_ENTITLEMENT_VIEW_SCHEMA_V1,
    entitlementId: entitlement.entitlementId,
    reportId: entitlement.binding.reportId,
    productId: entitlement.binding.productId,
    contentVersion: entitlement.binding.contentVersion,
    status: entitlement.status,
    createdAt: entitlement.createdAt,
    updatedAt: entitlement.updatedAt,
    ...(entitlement.activatedAt ? { activatedAt: entitlement.activatedAt } : {}),
    ...(entitlement.expiresAt ? { expiresAt: entitlement.expiresAt } : {}),
  };
}

function requireAccountOwner(deps: PremiumServiceDependenciesV1, actor: PremiumActorV1) {
  const owner = deps.ownerForActor(actor);
  if (owner.kind !== "account") {
    throw new ApiHttpError(401, "PREMIUM_ACCOUNT_REQUIRED", "Payment and synchronized premium access require an account.");
  }
  if (isLegacyPremiumOwnerV1(owner)) {
    throw new ApiHttpError(
      503,
      "PREMIUM_OWNER_V1_MIGRATION_REQUIRED",
      "Legacy premium ownership must be migrated and verified before access can resume.",
    );
  }
  return owner;
}

function assertActorOwns(deps: PremiumServiceDependenciesV1, actor: PremiumActorV1, owner: PremiumEntitlementOwnerV1) {
  const actorOwner = requireAccountOwner(deps, actor);
  if (!sameOwner(actorOwner, owner)) {
    if (isLegacyPremiumOwnerV1(owner)) {
      throw new ApiHttpError(
        503,
        "PREMIUM_OWNER_V1_MIGRATION_REQUIRED",
        "Legacy premium ownership must be migrated and verified before access can resume.",
      );
    }
    throw new ApiHttpError(403, "PREMIUM_OWNER_MISMATCH", "Premium resource belongs to another account.");
  }
  return actorOwner;
}

function requireRole(actor: PremiumActorV1, ...roles: readonly string[]): void {
  if (!roles.some((role) => actor.roles.includes(role))) {
    throw new ApiHttpError(403, "PREMIUM_ADMIN_REQUIRED", "Premium administrator role is required.");
  }
}

function assertProviderCallBudget(
  deps: PremiumServiceDependenciesV1,
  deadlineAtEpochMs: number | undefined,
): void {
  if (deadlineAtEpochMs === undefined) return;
  const now = Date.parse(deps.now());
  if (!Number.isFinite(now) || !Number.isFinite(deadlineAtEpochMs)
    || now + PREMIUM_PROVIDER_REQUEST_TIMEOUT_MS > deadlineAtEpochMs) {
    throw new ApiHttpError(503, "PREMIUM_RECONCILIATION_DEADLINE", "No provider-call budget remains in this reconciliation run.");
  }
}

function audit(params: {
  readonly actor: PremiumActorV1;
  readonly owner: PremiumEntitlementOwnerV1;
  readonly reportId: string;
  readonly action: PremiumAuditEventV1["action"];
  readonly now: string;
  readonly orderId?: string;
  readonly entitlementId?: string;
  readonly requestId?: string;
  readonly reason?: string;
  readonly policyReceiptDigest?: `sha256:${string}`;
}): PremiumAuditEventV1 {
  const keyring = getPremiumAuditHmacKeyringV1();
  return {
    schemaVersion: PREMIUM_AUDIT_EVENT_SCHEMA_V1,
    auditId: newPremiumId("audit"),
    occurredAt: params.now,
    deleteAfter: premiumAuditDeleteAfterV1(params.now),
    action: params.action,
    actor: premiumAuditActorV2(params.actor, keyring),
    owner: params.owner,
    reportId: params.reportId,
    ...(params.orderId ? { orderId: params.orderId } : {}),
    ...(params.entitlementId ? { entitlementId: params.entitlementId } : {}),
    ...(params.requestId ? { requestId: params.requestId } : {}),
    ...(params.reason ? { reason: params.reason } : {}),
    ...(params.policyReceiptDigest ? { policyReceiptDigest: params.policyReceiptDigest } : {}),
  };
}

function activeProductForReport(report: PremiumReportReferenceV1): ServiceCatalogProductV1 {
  const product = requireActivePremiumProductV1(report.binding.productId);
  if (product.contentVersion !== report.binding.contentVersion) {
    throw new ApiHttpError(409, "PREMIUM_REPORT_VERSION_RETIRED", "Report is bound to a non-current content version.");
  }
  return product;
}

const PREMIUM_ORDER_ID_PATTERN_V1 = /^premium_order_v1_[A-Za-z0-9_-]{16,128}$/u;
const PREMIUM_PAYMENT_KEY_PATTERN_V1 = /^[A-Za-z0-9_-]{10,200}$/u;
const PREMIUM_CONFIRMATION_PERMANENT_FAILURES_V1 = new Set([
  "PREMIUM_ORDER_NOT_FOUND",
  "PREMIUM_OWNER_MISMATCH",
  "PREMIUM_PAYMENT_NOT_CONFIRMABLE",
  "PREMIUM_PAYMENT_LEASE_MISSING",
  "PREMIUM_CHECKOUT_STALE",
  "PREMIUM_PAYMENT_KEY_REUSED",
  "PREMIUM_EXPIRY_STATE_INVALID",
]);

function assertPaymentCommandIdentityV1(orderId: unknown, paymentKey: unknown): asserts orderId is string {
  if (typeof orderId !== "string" || !PREMIUM_ORDER_ID_PATTERN_V1.test(orderId)
    || typeof paymentKey !== "string" || !PREMIUM_PAYMENT_KEY_PATTERN_V1.test(paymentKey)) {
    throw new ApiHttpError(400, "PREMIUM_PAYMENT_INVALID", "Payment order or provider identity is invalid.");
  }
}

function retainedPaymentSummary(payment: PremiumRetainedPaymentRecordV1): PremiumRetainedPaymentSummaryV1 {
  return {
    schemaVersion: "namespring.retained-payment-summary.v1",
    orderId: payment.orderId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt,
    refundedAt: payment.refundedAt,
    deleteAfter: payment.deleteAfter,
  };
}

export class PremiumServiceV1 {
  constructor(private readonly deps: PremiumServiceDependenciesV1 = createDefaultPremiumServiceDependenciesV1()) {}

  getCatalog() {
    return getPremiumServiceCatalogV1();
  }

  getPaymentRailCapabilities() {
    return getPremiumPaymentRailCapabilitiesV1(getPremiumServiceCatalogV1());
  }

  getPolicyCapability() {
    return getPremiumPolicyCapabilityV1();
  }

  async registerReport(
    actor: PremiumActorV1,
    request: PremiumReportRegistrationRequestV1,
    consent: PremiumDataProcessingConsentAcceptanceV1,
  ): Promise<RegisterPremiumReportResultV1> {
    assertPremiumReportRegistrationRequestV1(request);
    const owner = requireAccountOwner(this.deps, actor);
    const product = requireActivePremiumProductV1(request.productId);
    const materialDigest = await createPremiumRegistrationMaterialDigestV1(request);
    const consentRecordedAt = this.deps.now();
    const consentReceipt = buildPremiumDataProcessingConsentReceiptV1(
      consent,
      materialDigest,
      consentRecordedAt,
    );
    const existing = await this.deps.repository.getRegistration(owner, request.requestId);
    const decision = await evaluatePremiumReportRegistrationReplayV1({
      principal: owner,
      request,
      replay: existing
        ? existing.materialDigest === materialDigest
          && existing.consentAcceptanceDigest === consentReceipt.acceptanceDigest
          ? { state: "same_material_replay", materialDigest, priorReport: existing.report }
          : { state: "conflicting_material_replay" }
        : { state: "first_seen" },
    });
    if (decision.registration === "deny") {
      throw new ApiHttpError(409, decision.reasonCode, "Premium registration idempotency check failed.");
    }
    if (decision.registrationMode === "idempotent_replay") {
      assertPremiumReportReferenceForRegistrationDecisionV1(decision.priorReport, decision);
      return { report: reportReferenceView(decision.priorReport), registrationMode: "idempotent_replay" };
    }

    const reportId = newPremiumId("report");
    const analysisId = newPremiumId("analysis");
    const engine = this.deps.createEngine();
    let delivery;
    try {
      await engine.init();
      delivery = await engine.getReportDelivery({
        birth: request.analysisInput.birth,
        surname: [...request.analysisInput.surname],
        givenName: [...request.analysisInput.givenName],
        targetDate: request.analysisInput.targetDate,
        ...(request.analysisInput.options ? { options: request.analysisInput.options } : {}),
        candidateId: request.candidateId,
        delivery: {
          schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
          surfaces: [
            { id: "integrated", depth: "standard" },
            { id: "saju", depth: "expert", life: "summary" },
            { id: "naming", depth: "expert" },
          ],
        },
      });
    } finally {
      engine.close();
    }
    if (delivery.subject.candidateId !== request.candidateId) {
      throw new ApiHttpError(409, "PREMIUM_RECOMPUTATION_MISMATCH", "Server recomputation did not reproduce the candidate identity.");
    }
    const seenSourceIds = new Set<string>();
    const evidence = [
      ...delivery.facts.map((item) => ({ item, sourceKind: "fact" as const })),
      ...delivery.interpretations.map((item) => ({ item, sourceKind: "interpretation" as const })),
    ].map(({ item, sourceKind }) => {
      if (seenSourceIds.has(item.id)) {
        throw new ApiHttpError(500, "PREMIUM_EVIDENCE_COLLISION", "Server analysis emitted duplicate evidence IDs.");
      }
      seenSourceIds.add(item.id);
      return {
        evidenceId: premiumEvidenceId(analysisId, item.id),
        sourceId: item.id,
        sourceKind,
      };
    });
    const now = this.deps.now();
    const binding: PremiumReportBindingV1 = {
      reportId,
      analysisId,
      candidateId: request.candidateId,
      productId: request.productId,
      contentVersion: product.contentVersion,
    };
    const report: PremiumReportReferenceV1 = {
      schemaVersion: PREMIUM_REPORT_REFERENCE_SCHEMA_V1,
      authority: "server",
      registration: decision.authorization,
      binding,
      status: "registered",
      registeredAt: now,
      updatedAt: now,
    };
    assertPremiumReportReferenceForRegistrationDecisionV1(report, decision);
    const analysis: PremiumServerAnalysisRecordV1 = {
      schemaVersion: PREMIUM_SERVER_ANALYSIS_SCHEMA_V1,
      analysisId,
      reportId,
      owner,
      registrationRequestId: request.requestId,
      materialDigest,
      dataProcessingConsent: consentReceipt,
      recomputedAt: now,
      sealedDelivery: sealPremiumAnalysisDeliveryV1({ analysisId, reportId, materialDigest, delivery }),
      evidence,
      contentSelector: buildContentSelector(request, delivery, product.contentVersion),
    };
    const committed = await this.deps.repository.commitRegistration({
      internalUserId: actor.userId,
      report,
      analysis,
      audit: audit({
        actor,
        owner,
        reportId,
        action: "report.registered",
        now,
        requestId: request.requestId,
        policyReceiptDigest: consentReceipt.bindingDigest,
      }),
    });
    return { report: reportReferenceView(committed.report), registrationMode: committed.mode };
  }

  async reviewContentArtifact(
    actor: PremiumActorV1,
    requestId: string,
    notesDigest: `sha256:${string}`,
    candidate: PremiumContentArtifactRecordV1,
  ): Promise<{ readonly receipt: PremiumContentReviewReceiptViewV1; readonly reviewMode: "initial" | "idempotent_replay" }> {
    requireRole(actor, "premium_admin");
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "Review artifact must be a plain object.");
    }
    if (typeof candidate.reportId !== "string"
      || !/^report_v1_[A-Za-z0-9_-]{16,128}$/u.test(candidate.reportId)) {
      throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "Review artifact reportId is invalid.");
    }
    assertPremiumArtifactReviewCandidateShapeV1(candidate);
    const report = await this.deps.repository.getReport(candidate.reportId);
    if (!report) throw new ApiHttpError(404, "PREMIUM_REPORT_NOT_FOUND", "Report was not found.");
    activeProductForReport(report);
    if (candidate.productId !== report.binding.productId
      || candidate.contentVersion !== report.binding.contentVersion) {
      throw new ApiHttpError(409, "PREMIUM_CONTENT_BINDING_MISMATCH", "Content version does not match the report.");
    }
    const analysis = await this.deps.repository.getAnalysis(report.binding.analysisId);
    if (!analysis || analysis.reportId !== report.binding.reportId
      || !sameOwner(analysis.owner, report.registration.owner)) {
      throw new ApiHttpError(500, "PREMIUM_ANALYSIS_CORRUPT", "Server analysis is missing or mismatched.");
    }
    const now = this.deps.now();
    validatePremiumArtifactReviewCandidateV1(candidate, analysis);
    assertPremiumGateAttestationV1(
      candidate.provenance,
      premiumArtifactGateSubjectDigestV1(candidate, report.binding),
    );
    const receipt: PremiumContentReviewReceiptV1 = {
      schemaVersion: PREMIUM_CONTENT_REVIEW_RECEIPT_SCHEMA_V1,
      receiptId: premiumReviewReceiptIdV1(actor, requestId),
      requestId,
      resourceKind: "report_artifact",
      resourceId: candidate.artifactId,
      reportId: report.binding.reportId,
      analysisId: report.binding.analysisId,
      productId: report.binding.productId,
      contentVersion: report.binding.contentVersion,
      selectorKey: null,
      reviewedMaterialDigest: premiumArtifactReviewedMaterialDigestV1(candidate, report.binding),
      notesDigest,
      decision: "approved",
      reviewer: { actorSubject: premiumAuditActorV2(actor, getPremiumAuditHmacKeyringV1()).userId },
      reviewedAt: now,
      authorityExpiresAt: premiumReviewAuthorityExpiresAtV1(now),
      status: "pending",
      consumption: null,
      deleteAfter: premiumReviewDeleteAfterV1(now),
    };
    const committed = await this.deps.repository.createContentReview({
      receipt,
      reviewer: actor,
      audit: audit({
        actor,
        owner: report.registration.owner,
        reportId: report.binding.reportId,
        action: "content.reviewed",
        now,
        requestId,
      }),
    });
    return { receipt: premiumReviewReceiptViewV1(committed.receipt), reviewMode: committed.mode };
  }

  async activateApprovedContent(
    actor: PremiumActorV1,
    activationRequestId: string,
    reviewReceiptId: string,
    approved: PremiumContentArtifactRecordV1,
  ): Promise<PremiumContentArtifactRecordV1> {
    requireRole(actor, "premium_admin");
    assertPremiumActivationRequestIdV1(activationRequestId);
    assertPremiumReviewReceiptReferenceV1(reviewReceiptId);
    if (!approved || typeof approved !== "object" || Array.isArray(approved)) {
      throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "Activation artifact must be a plain object.");
    }
    if (typeof approved.reportId !== "string"
      || !/^report_v1_[A-Za-z0-9_-]{16,128}$/u.test(approved.reportId)) {
      throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "Activation artifact reportId is invalid.");
    }
    assertPremiumArtifactReviewCandidateShapeV1(approved);
    const report = await this.deps.repository.getReport(approved.reportId);
    if (!report) throw new ApiHttpError(404, "PREMIUM_REPORT_NOT_FOUND", "Report was not found.");
    activeProductForReport(report);
    if (approved.productId !== report.binding.productId
      || approved.contentVersion !== report.binding.contentVersion) {
      throw new ApiHttpError(409, "PREMIUM_CONTENT_BINDING_MISMATCH", "Content version does not match the report.");
    }
    const analysis = await this.deps.repository.getAnalysis(report.binding.analysisId);
    if (!analysis || analysis.reportId !== report.binding.reportId
      || !sameOwner(analysis.owner, report.registration.owner)) {
      throw new ApiHttpError(500, "PREMIUM_ANALYSIS_CORRUPT", "Server analysis is missing or mismatched.");
    }
    validatePremiumArtifactReviewCandidateV1(approved, analysis);
    assertPremiumGateAttestationV1(
      approved.provenance,
      premiumArtifactGateSubjectDigestV1(approved, report.binding),
    );
    const reviewedMaterialDigest = premiumArtifactReviewedMaterialDigestV1(approved, report.binding);
    const receipt = await this.deps.repository.getContentReviewReceipt(reviewReceiptId);
    if (!receipt) throw new ApiHttpError(409, "PREMIUM_REVIEW_RECEIPT_UNAVAILABLE", "Review receipt is missing or expired.");
    const now = this.deps.now();
    if (receipt.resourceKind !== "report_artifact" || receipt.resourceId !== approved.artifactId
      || receipt.reportId !== report.binding.reportId || receipt.analysisId !== report.binding.analysisId
      || receipt.productId !== approved.productId || receipt.contentVersion !== approved.contentVersion
      || receipt.selectorKey !== null || receipt.reviewedMaterialDigest !== reviewedMaterialDigest) {
      throw new ApiHttpError(409, "PREMIUM_REVIEW_BINDING_MISMATCH", "Review receipt does not authorize this exact content.");
    }
    if (premiumAuditSubjectMatchesV2(
      "actor", actor.userId, receipt.reviewer.actorSubject, getPremiumAuditHmacKeyringV1(),
    )) {
      throw new ApiHttpError(409, "PREMIUM_INDEPENDENT_APPROVAL_REQUIRED", "Reviewer and activator must be different principals.");
    }
    if (receipt.status === "pending" && Date.parse(now) >= Date.parse(receipt.authorityExpiresAt)) {
      throw new ApiHttpError(409, "PREMIUM_REVIEW_AUTHORITY_EXPIRED", "Review authority expired before activation.");
    }
    const activationId = premiumActivationIdV1(actor, reviewReceiptId, activationRequestId);
    const provenance = {
      ...approved.provenance,
      humanReview: {
        reviewerId: reviewReceiptId,
        reviewedAt: receipt.reviewedAt,
        decision: "approved" as const,
        notesDigest: receipt.notesDigest,
      },
    };
    assertApprovalChronology(provenance, now);
    const artifact: PremiumContentArtifactRecordV1 = {
      ...approved,
      lifecycle: "active",
      provenance,
      activation: {
        activationId,
        reviewReceiptId,
        activatedAt: now,
        activatedBy: premiumAuditActorV2(actor, getPremiumAuditHmacKeyringV1()).userId,
        immutableContentDigest: sha256({
          reportId: approved.reportId,
          productId: approved.productId,
          contentVersion: approved.contentVersion,
          provenance,
          content: approved.content,
        }),
      },
    };
    return this.deps.repository.activateContent({
      artifact,
      reviewReceiptId,
      activationRequestId,
      reviewedMaterialDigest,
      activator: actor,
      audit: audit({
        actor,
        owner: report.registration.owner,
        reportId: report.binding.reportId,
        action: "content.activated",
        now,
      }),
    });
  }

  async reviewContentTemplate(
    actor: PremiumActorV1,
    sampleReportId: string,
    requestId: string,
    notesDigest: `sha256:${string}`,
    candidate: PremiumContentTemplateRecordV1,
  ): Promise<{ readonly receipt: PremiumContentReviewReceiptViewV1; readonly reviewMode: "initial" | "idempotent_replay" }> {
    requireRole(actor, "premium_admin");
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "Review template must be a plain object.");
    }
    if (!/^report_v1_[A-Za-z0-9_-]{16,128}$/u.test(sampleReportId)) {
      throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "Template sampleReportId is invalid.");
    }
    assertPremiumTemplateReviewCandidateShapeV1(candidate);
    const report = await this.deps.repository.getReport(sampleReportId);
    if (!report) throw new ApiHttpError(404, "PREMIUM_REPORT_NOT_FOUND", "Sample report was not found.");
    const product = activeProductForReport(report);
    if (candidate.productId !== report.binding.productId
      || candidate.contentVersion !== product.contentVersion) {
      throw new ApiHttpError(409, "PREMIUM_TEMPLATE_BINDING_MISMATCH", "Template product/version does not match the sample report.");
    }
    const analysis = await this.deps.repository.getAnalysis(report.binding.analysisId);
    if (!analysis || analysis.reportId !== report.binding.reportId) {
      throw new ApiHttpError(500, "PREMIUM_ANALYSIS_CORRUPT", "Sample analysis is missing.");
    }
    const now = this.deps.now();
    validatePremiumTemplateReviewCandidateV1(candidate, analysis);
    assertPremiumGateAttestationV1(
      candidate.provenance,
      premiumTemplateGateSubjectDigestV1(candidate, report.binding),
    );
    const receipt: PremiumContentReviewReceiptV1 = {
      schemaVersion: PREMIUM_CONTENT_REVIEW_RECEIPT_SCHEMA_V1,
      receiptId: premiumReviewReceiptIdV1(actor, requestId),
      requestId,
      resourceKind: "case_template",
      resourceId: candidate.templateId,
      reportId: report.binding.reportId,
      analysisId: report.binding.analysisId,
      productId: report.binding.productId,
      contentVersion: report.binding.contentVersion,
      selectorKey: candidate.selectorKey,
      reviewedMaterialDigest: premiumTemplateReviewedMaterialDigestV1(candidate, report.binding),
      notesDigest,
      decision: "approved",
      reviewer: { actorSubject: premiumAuditActorV2(actor, getPremiumAuditHmacKeyringV1()).userId },
      reviewedAt: now,
      authorityExpiresAt: premiumReviewAuthorityExpiresAtV1(now),
      status: "pending",
      consumption: null,
      deleteAfter: premiumReviewDeleteAfterV1(now),
    };
    const committed = await this.deps.repository.createContentReview({
      receipt,
      reviewer: actor,
      audit: audit({
        actor,
        owner: report.registration.owner,
        reportId: report.binding.reportId,
        action: "content.reviewed",
        now,
        requestId,
        reason: `reusable_template:${candidate.selectorKey}`,
      }),
    });
    return { receipt: premiumReviewReceiptViewV1(committed.receipt), reviewMode: committed.mode };
  }

  async activateApprovedTemplate(
    actor: PremiumActorV1,
    sampleReportId: string,
    activationRequestId: string,
    reviewReceiptId: string,
    approved: PremiumContentTemplateRecordV1,
  ): Promise<PremiumContentTemplateRecordV1> {
    requireRole(actor, "premium_admin");
    assertPremiumActivationRequestIdV1(activationRequestId);
    assertPremiumReviewReceiptReferenceV1(reviewReceiptId);
    if (!approved || typeof approved !== "object" || Array.isArray(approved)) {
      throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "Activation template must be a plain object.");
    }
    if (!/^report_v1_[A-Za-z0-9_-]{16,128}$/u.test(sampleReportId)) {
      throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "Template sampleReportId is invalid.");
    }
    assertPremiumTemplateReviewCandidateShapeV1(approved);
    const report = await this.deps.repository.getReport(sampleReportId);
    if (!report) throw new ApiHttpError(404, "PREMIUM_REPORT_NOT_FOUND", "Sample report was not found.");
    const product = activeProductForReport(report);
    if (approved.productId !== report.binding.productId
      || approved.contentVersion !== product.contentVersion) {
      throw new ApiHttpError(409, "PREMIUM_TEMPLATE_BINDING_MISMATCH", "Template product/version does not match the sample report.");
    }
    const analysis = await this.deps.repository.getAnalysis(report.binding.analysisId);
    if (!analysis || analysis.reportId !== report.binding.reportId) {
      throw new ApiHttpError(500, "PREMIUM_ANALYSIS_CORRUPT", "Sample analysis is missing.");
    }
    validatePremiumTemplateReviewCandidateV1(approved, analysis);
    assertPremiumGateAttestationV1(
      approved.provenance,
      premiumTemplateGateSubjectDigestV1(approved, report.binding),
    );
    const reviewedMaterialDigest = premiumTemplateReviewedMaterialDigestV1(approved, report.binding);
    const receipt = await this.deps.repository.getContentReviewReceipt(reviewReceiptId);
    if (!receipt) throw new ApiHttpError(409, "PREMIUM_REVIEW_RECEIPT_UNAVAILABLE", "Review receipt is missing or expired.");
    const now = this.deps.now();
    if (receipt.resourceKind !== "case_template" || receipt.resourceId !== approved.templateId
      || receipt.reportId !== report.binding.reportId || receipt.analysisId !== report.binding.analysisId
      || receipt.productId !== approved.productId || receipt.contentVersion !== approved.contentVersion
      || receipt.selectorKey !== approved.selectorKey || receipt.reviewedMaterialDigest !== reviewedMaterialDigest) {
      throw new ApiHttpError(409, "PREMIUM_REVIEW_BINDING_MISMATCH", "Review receipt does not authorize this exact template.");
    }
    if (premiumAuditSubjectMatchesV2(
      "actor", actor.userId, receipt.reviewer.actorSubject, getPremiumAuditHmacKeyringV1(),
    )) {
      throw new ApiHttpError(409, "PREMIUM_INDEPENDENT_APPROVAL_REQUIRED", "Reviewer and activator must be different principals.");
    }
    if (receipt.status === "pending" && Date.parse(now) >= Date.parse(receipt.authorityExpiresAt)) {
      throw new ApiHttpError(409, "PREMIUM_REVIEW_AUTHORITY_EXPIRED", "Review authority expired before activation.");
    }
    const activationId = premiumActivationIdV1(actor, reviewReceiptId, activationRequestId);
    const provenance = {
      ...approved.provenance,
      humanReview: {
        reviewerId: reviewReceiptId,
        reviewedAt: receipt.reviewedAt,
        decision: "approved" as const,
        notesDigest: receipt.notesDigest,
      },
    };
    assertApprovalChronology(provenance, now);
    const template: PremiumContentTemplateRecordV1 = {
      ...approved,
      lifecycle: "active",
      provenance,
      activation: {
        activationId,
        reviewReceiptId,
        activatedAt: now,
        activatedBy: premiumAuditActorV2(actor, getPremiumAuditHmacKeyringV1()).userId,
        immutableContentDigest: sha256({
          productId: approved.productId,
          contentVersion: approved.contentVersion,
          selectorKey: approved.selectorKey,
          provenance,
          placeholderAllowlist: approved.placeholderAllowlist,
          template: approved.template,
        }),
      },
    };
    return this.deps.repository.activateTemplate({
      template,
      sampleReportId,
      reviewReceiptId,
      activationRequestId,
      reviewedMaterialDigest,
      activator: actor,
      audit: audit({
        actor,
        owner: report.registration.owner,
        reportId: report.binding.reportId,
        action: "content.activated",
        now,
        reason: `reusable_template:${template.selectorKey}`,
      }),
    });
  }

  async retireContent(
    actor: PremiumActorV1,
    params: { reportId: string; activation: PremiumContentActivationBindingV1; reason: string },
  ): Promise<void> {
    requireRole(actor, "premium_admin");
    const activation = params.activation as PremiumContentActivationBindingV1;
    if (!activation || typeof activation !== "object"
      || !["report_artifact", "case_template"].includes(activation.sourceKind)
      || !/^(?:premium_artifact|premium_template)_v1_[A-Za-z0-9_-]{16,128}$/u.test(activation.resourceId)
      || !/^premium_activation_v1_[A-Za-z0-9_-]{16,128}$/u.test(activation.activationId)
      || !/^sha256:[a-f0-9]{64}$/u.test(activation.immutableContentDigest)
      || (activation.sourceKind === "case_template" && !activation.selectorKey?.trim())
      || (activation.sourceKind === "report_artifact" && activation.selectorKey !== undefined)) {
      throw new ApiHttpError(400, "PREMIUM_CONTENT_ACTIVATION_INVALID", "Content activation binding is invalid.");
    }
    const reason = params.reason?.trim();
    if (!reason || reason.length > 500) {
      throw new ApiHttpError(400, "PREMIUM_RETIRE_REASON_INVALID", "Content retirement reason is required.");
    }
    const report = await this.deps.repository.getReport(params.reportId);
    if (!report) throw new ApiHttpError(404, "PREMIUM_REPORT_NOT_FOUND", "Audit-context report was not found.");
    const now = this.deps.now();
    await this.deps.repository.retireContent({
      binding: report.binding,
      activation,
      retiredAt: now,
      audit: audit({
        actor,
        owner: report.registration.owner,
        reportId: report.binding.reportId,
        action: "content.retired",
        now,
        reason,
      }),
    });
  }

  async createCheckout(actor: PremiumActorV1, command: CreatePremiumCheckoutCommandV1): Promise<CreatePremiumCheckoutResultV1> {
    const owner = requireAccountOwner(this.deps, actor);
    if (!/^premium_request_v1_[A-Za-z0-9_-]{16,128}$/u.test(command.requestId)) {
      throw new ApiHttpError(400, "PREMIUM_REQUEST_INVALID", "Checkout requestId is invalid.");
    }
    const report = await this.deps.repository.getReport(command.reportId);
    if (!report || report.status !== "registered") {
      throw new ApiHttpError(404, "PREMIUM_REPORT_NOT_FOUND", "Registered report was not found.");
    }
    assertActorOwns(this.deps, actor, report.registration.owner);
    if (command.productId !== report.binding.productId) {
      throw new ApiHttpError(409, "PREMIUM_PRODUCT_MISMATCH", "Product does not match the report binding.");
    }
    const product = activeProductForReport(report);
    const analysis = await this.deps.repository.getAnalysis(report.binding.analysisId);
    if (!analysis || analysis.reportId !== report.binding.reportId) {
      throw new ApiHttpError(500, "PREMIUM_ANALYSIS_CORRUPT", "Server analysis is unavailable.");
    }
    const content = await this.deps.repository.getActiveContent(report.binding);
    const template = content ? null : await this.deps.repository.getActiveTemplate({
      productId: report.binding.productId,
      contentVersion: report.binding.contentVersion,
      selectorKeys: analysis.contentSelector.keys,
    });
    if ((!content || content.lifecycle !== "active" || !content.activation)
      && (!template || template.lifecycle !== "active" || !template.activation)) {
      throw new ApiHttpError(409, "PREMIUM_CONTENT_UNAVAILABLE", "No active human-approved content is available; payment is blocked.");
    }
    // Prove that this exact report can resolve every reviewed placeholder and
    // evidence source before an order is created. A payment must never be the
    // first operation to discover an unusable reusable template.
    if (!content) instantiateTemplate(template!, analysis);
    const contentActivation = content && content.lifecycle === "active" && content.activation
      ? activationForArtifact(content)
      : activationForTemplate(template!);
    const catalog = getPremiumServiceCatalogV1();
    requirePremiumPaymentRailEnabledV1("toss_web", catalog);
    const now = this.deps.now();
    const purchaseTermsReceipt = buildPremiumPurchaseTermsReceiptV1(
      command.purchaseTermsAcceptance,
      {
        owner,
        requestId: command.requestId,
        binding: report.binding,
        catalogVersion: catalog.catalogVersion,
        amount: product.price.amount,
        currency: product.price.currency,
        paymentProvider: "toss_web",
      },
      now,
    );
    const order: PremiumPaymentOrderRecordV1 = {
      schemaVersion: "namespring.premium-order-record.v1",
      orderId: newPremiumId("order"),
      requestId: command.requestId,
      accountWriteSubjectId: actor.userId,
      owner,
      binding: report.binding,
      contentActivation,
      catalogVersion: catalog.catalogVersion,
      purchaseTermsReceipt,
      amount: product.price.amount,
      currency: product.price.currency,
      status: "ready",
      paymentProvider: "toss_web",
      paymentKey: null,
      entitlementId: null,
      createdAt: now,
      updatedAt: now,
      paidAt: null,
      refundedAt: null,
      paymentRecovery: { status: "not_required", updatedAt: now, dueAt: null },
    };
    const committed = await this.deps.repository.createCheckout({
      internalUserId: actor.userId,
      order,
      audit: audit({
        actor,
        owner,
        reportId: report.binding.reportId,
        orderId: order.orderId,
        action: "payment.created",
        now,
        requestId: command.requestId,
        policyReceiptDigest: purchaseTermsReceipt.bindingDigest,
      }),
    });
    return {
      orderId: committed.order.orderId,
      orderName: product.displayName,
      amount: committed.order.amount,
      currency: committed.order.currency,
      catalogVersion: committed.order.catalogVersion,
      binding: committed.order.binding,
    };
  }

  async confirmPayment(actor: PremiumActorV1, command: ConfirmPremiumPaymentCommandV1): Promise<ConfirmPremiumPaymentResultV1> {
    if (!command || typeof command !== "object") {
      throw new ApiHttpError(400, "PREMIUM_PAYMENT_INVALID", "Payment confirmation is invalid.");
    }
    assertPaymentCommandIdentityV1(command.orderId, command.paymentKey);
    if (command.currency !== "KRW" || !Number.isSafeInteger(command.amount) || command.amount <= 0) {
      throw new ApiHttpError(400, "PREMIUM_PAYMENT_INVALID", "Payment amount/currency is invalid.");
    }
    const order = await this.deps.repository.getOrder(command.orderId);
    if (!order) throw new ApiHttpError(404, "PREMIUM_ORDER_NOT_FOUND", "Premium order was not found.");
    assertTossWebRailV1(order.paymentProvider);
    if (this.deps.toss.rail !== "toss_web") {
      throw new ApiHttpError(503, "PREMIUM_PAYMENT_ADAPTER_INVALID", "Toss web adapter is unavailable.");
    }
    assertActorOwns(this.deps, actor, order.owner);
    if (order.amount !== command.amount || order.currency !== command.currency) {
      throw new ApiHttpError(409, "PREMIUM_AMOUNT_MISMATCH", "Client confirmation does not match the server catalog order.");
    }
    if (order.status === "paid") {
      if (order.paymentKey !== command.paymentKey || !order.entitlementId) {
        throw new ApiHttpError(409, "PREMIUM_PAYMENT_CONFLICT", "Order is already paid by a different payment.");
      }
      const entitlement = await this.deps.repository.getEntitlement(order.entitlementId);
      if (!entitlement || entitlement.status !== "active") {
        throw new ApiHttpError(409, "PREMIUM_ACCESS_NOT_ACTIVE", "Existing entitlement is no longer active.");
      }
      return paymentConfirmationView(order, entitlement, "idempotent_replay");
    }
    if (order.status !== "ready") {
      throw new ApiHttpError(409, "PREMIUM_PAYMENT_NOT_CONFIRMABLE", `Order status ${order.status} cannot be confirmed.`);
    }
    const report = await this.deps.repository.getReport(order.binding.reportId);
    if (!report || report.status !== "registered" || !sameBinding(report.binding, order.binding)
      || !sameOwner(report.registration.owner, order.owner)) {
      throw new ApiHttpError(409, "PREMIUM_CHECKOUT_STALE", "Registered report changed before payment confirmation.");
    }
    let currentActivation: PremiumContentActivationBindingV1 | null = null;
    if (order.contentActivation.sourceKind === "report_artifact") {
      const content = await this.deps.repository.getActiveContent(order.binding);
      currentActivation = content?.lifecycle === "active" && content.activation
        ? activationForArtifact(content) : null;
    } else if (order.contentActivation.selectorKey) {
      const template = await this.deps.repository.getActiveTemplate({
        productId: order.binding.productId,
        contentVersion: order.binding.contentVersion,
        selectorKeys: [order.contentActivation.selectorKey],
      });
      currentActivation = template?.lifecycle === "active" && template.activation
        ? activationForTemplate(template) : null;
    }
    if (!currentActivation || !sameActivation(currentActivation, order.contentActivation)) {
      throw new ApiHttpError(409, "PREMIUM_CHECKOUT_STALE", "Approved content changed before payment confirmation.");
    }
    await this.deps.repository.acquirePaymentConfirmationLease({
      internalUserId: actor.userId,
      owner: order.owner,
      orderId: order.orderId,
      paymentKey: command.paymentKey,
      now: this.deps.now(),
    });
    const observation = await this.deps.toss.confirm({
      paymentKey: command.paymentKey,
      orderId: order.orderId,
      amount: order.amount,
    });
    if (observation.paymentKey !== command.paymentKey || observation.orderId !== order.orderId
      || observation.totalAmount !== order.amount || observation.balanceAmount !== order.amount
      || observation.currency !== order.currency || observation.status !== "DONE") {
      throw new ApiHttpError(409, "TOSS_CONFIRMATION_MISMATCH", "Toss confirmation did not exactly match the order.");
    }
    const now = this.deps.now();
    const result = await this.deps.repository.confirmPayment({
      orderId: order.orderId,
      actor,
      owner: order.owner,
      observation,
      entitlementId: newPremiumId("entitlement"),
      audit: audit({ actor, owner: order.owner, reportId: order.binding.reportId, orderId: order.orderId, action: "payment.confirmed", now }),
    });
    return paymentConfirmationView(result.order, result.entitlement, result.mode);
  }

  async refundPayment(actor: PremiumActorV1, params: { orderId: string; reason: string }): Promise<RefundPremiumPaymentResultV1> {
    requireRole(actor, "premium_admin");
    const reason = params.reason?.trim();
    if (!reason || reason.length > 500) throw new ApiHttpError(400, "PREMIUM_REFUND_REASON_INVALID", "Refund reason is required.");
    const order = await this.deps.repository.getOrder(params.orderId);
    if (!order) {
      const retained = await this.deps.repository.getRetainedPayment(params.orderId);
      if (!retained) throw new ApiHttpError(404, "PREMIUM_ORDER_NOT_FOUND", "Premium order was not found.");
      assertTossWebRailV1(retained.paymentProvider);
      if (retained.status === "refunded") {
        return { retainedPayment: retainedPaymentSummary(retained), refundMode: "idempotent_replay" };
      }
      if (!retained.paymentKey || !["paid", "revoked"].includes(retained.status)) {
        throw new ApiHttpError(409, "PREMIUM_REFUND_NOT_ALLOWED", "Retained payment is not refundable.");
      }
      const observation = await this.deps.toss.cancel({ paymentKey: retained.paymentKey, reason });
      const result = await this.deps.repository.settleRetainedPayment({
        orderId: retained.orderId,
        actor,
        reason,
        observation,
      });
      return { retainedPayment: retainedPaymentSummary(result.payment), refundMode: result.mode };
    }
    assertTossWebRailV1(order.paymentProvider);
    if (order.status === "refunded" && order.entitlementId) {
      const entitlement = await this.deps.repository.getEntitlement(order.entitlementId);
      if (!entitlement) throw new ApiHttpError(500, "PREMIUM_ENTITLEMENT_CORRUPT", "Refunded entitlement is missing.");
      return {
        order: paymentOrderView(order),
        entitlement: entitlementView(entitlement),
        refundMode: "idempotent_replay",
      };
    }
    if (!order.paymentKey || !order.entitlementId || (order.status !== "paid" && order.status !== "revoked")) {
      throw new ApiHttpError(409, "PREMIUM_REFUND_NOT_ALLOWED", "Only a verified paid order can be refunded.");
    }
    const observation = await this.deps.toss.cancel({ paymentKey: order.paymentKey, reason });
    const now = this.deps.now();
    try {
      const result = await this.deps.repository.refundPayment({
        orderId: order.orderId,
        actor,
        reason,
        observation,
        audit: audit({ actor, owner: order.owner, reportId: order.binding.reportId, orderId: order.orderId, entitlementId: order.entitlementId, action: "payment.refunded", now, reason }),
      });
      return {
        order: paymentOrderView(result.order),
        entitlement: entitlementView(result.entitlement),
        refundMode: result.mode,
      };
    } catch (error) {
      // Account purge may atomically move the order into the minimized legal
      // ledger while the provider cancellation is in flight. Finish against
      // that ledger instead of losing the successful financial transition.
      if (!(error instanceof ApiHttpError) || error.code !== "PREMIUM_ORDER_NOT_FOUND") throw error;
      const result = await this.deps.repository.settleRetainedPayment({
        orderId: order.orderId,
        actor,
        reason,
        observation,
      });
      return { retainedPayment: retainedPaymentSummary(result.payment), refundMode: result.mode };
    }
  }

  async revokeEntitlement(actor: PremiumActorV1, params: { entitlementId: string; reason: string }): Promise<PremiumEntitlementViewV1> {
    requireRole(actor, "premium_admin", "premium_system");
    const reason = params.reason?.trim();
    if (!reason || reason.length > 500) throw new ApiHttpError(400, "PREMIUM_REVOKE_REASON_INVALID", "Revocation reason is required.");
    const entitlement = await this.deps.repository.getEntitlement(params.entitlementId);
    if (!entitlement) throw new ApiHttpError(404, "PREMIUM_ENTITLEMENT_NOT_FOUND", "Entitlement was not found.");
    const now = this.deps.now();
    const revoked = await this.deps.repository.revokeEntitlement({
      entitlementId: entitlement.entitlementId,
      actor,
      reason,
      now,
      audit: audit({ actor, owner: entitlement.owner, reportId: entitlement.binding.reportId, entitlementId: entitlement.entitlementId, action: "entitlement.revoked", now, reason }),
    });
    return entitlementView(revoked);
  }

  async reconcilePayment(
    actor: PremiumActorV1,
    params: { orderId: string; paymentKey: string },
    options: { readonly deadlineAtEpochMs?: number } = {},
  ): Promise<PremiumPaymentReconciliationViewV1> {
    const payment = await this.reconcilePaymentState(actor, params, options);
    return payment.schemaVersion === "namespring.retained-payment.v1"
      ? retainedPaymentSummary(payment)
      : paymentOrderView(payment);
  }

  private async reconcilePaymentState(
    actor: PremiumActorV1,
    params: { orderId: string; paymentKey: string },
    options: { readonly deadlineAtEpochMs?: number } = {},
  ): Promise<PremiumPaymentOrderRecordV1 | PremiumRetainedPaymentRecordV1> {
    requireRole(actor, "premium_admin", "premium_system");
    const order = await this.deps.repository.getOrder(params.orderId);
    if (!order) {
      const retained = await this.deps.repository.getRetainedPayment(params.orderId);
      if (!retained) throw new ApiHttpError(404, "PREMIUM_ORDER_NOT_FOUND", "Premium order was not found.");
      assertTossWebRailV1(retained.paymentProvider);
      if (!retained.paymentKey || retained.paymentKey !== params.paymentKey) {
        throw new ApiHttpError(409, "PREMIUM_PAYMENT_CONFLICT", "Payment key does not match the retained ledger.");
      }
      assertProviderCallBudget(this.deps, options.deadlineAtEpochMs);
      let observation = await this.deps.toss.get(params.paymentKey);
      if (observation.orderId !== retained.orderId || observation.paymentKey !== params.paymentKey
        || observation.totalAmount !== retained.amount || observation.currency !== retained.currency) {
        throw new ApiHttpError(409, "TOSS_RECONCILIATION_MISMATCH", "Authoritative provider state does not match retained payment.");
      }
      const reason = observation.status === "PARTIAL_CANCELED"
        ? "Automatic full cancellation of retained PARTIAL_CANCELED balance"
        : "Authoritative retained-payment reconciliation";
      if (observation.status === "PARTIAL_CANCELED") {
        assertProviderCallBudget(this.deps, options.deadlineAtEpochMs);
        observation = await this.deps.toss.cancel({ paymentKey: retained.paymentKey, reason });
      }
      const result = await this.deps.repository.settleRetainedPayment({
        orderId: retained.orderId,
        actor,
        reason,
        observation,
      });
      return result.payment;
    }
    assertTossWebRailV1(order.paymentProvider);
    if (order.paymentKey && order.paymentKey !== params.paymentKey) {
      throw new ApiHttpError(409, "PREMIUM_PAYMENT_CONFLICT", "Payment key does not match the order binding.");
    }
    assertProviderCallBudget(this.deps, options.deadlineAtEpochMs);
    const observation = await this.deps.toss.get(params.paymentKey);
    if (observation.orderId !== order.orderId || observation.paymentKey !== params.paymentKey
      || observation.totalAmount !== order.amount || observation.currency !== order.currency) {
      throw new ApiHttpError(409, "TOSS_RECONCILIATION_MISMATCH", "Authoritative provider state does not match the order.");
    }
    const now = this.deps.now();
    if (observation.status === "DONE") {
      if (order.status === "paid") return order;
      try {
        const result = await this.deps.repository.confirmPayment({
          orderId: order.orderId,
          actor,
          owner: order.owner,
          observation,
          entitlementId: newPremiumId("entitlement"),
          audit: audit({ actor, owner: order.owner, reportId: order.binding.reportId, orderId: order.orderId, action: "payment.reconciled", now, reason: "authoritative_toss_done" }),
        });
        return result.order;
      } catch (error) {
        // A provider-confirmed charge may not remain indefinitely without an
        // entitlement when a deterministic local invariant can never commit.
        // Transient transport/storage errors keep the durable lease for retry;
        // only explicit permanent domain failures trigger full compensation.
        if (!(error instanceof ApiHttpError)
          || !PREMIUM_CONFIRMATION_PERMANENT_FAILURES_V1.has(error.code)) {
          throw error;
        }
        const reason = `Automatic full cancellation after local grant failure: ${error.code}`;
        assertProviderCallBudget(this.deps, options.deadlineAtEpochMs);
        const compensated = await this.deps.toss.cancel({
          paymentKey: observation.paymentKey,
          reason,
        });
        if (compensated.orderId !== order.orderId
          || compensated.paymentKey !== observation.paymentKey
          || compensated.totalAmount !== order.amount
          || compensated.balanceAmount !== 0
          || compensated.currency !== order.currency
          || compensated.status !== "CANCELED") {
          throw new ApiHttpError(
            409,
            "TOSS_COMPENSATION_MISMATCH",
            "Toss did not confirm a full cancellation after the local grant failure.",
          );
        }
        try {
          return (await this.deps.repository.compensateCanceledPayment({
            orderId: order.orderId,
            actor,
            reason,
            observation: compensated,
            audit: audit({
              actor,
              owner: order.owner,
              reportId: order.binding.reportId,
              orderId: order.orderId,
              action: "payment.reconciled",
              now: compensated.observedAt,
              reason: "provider_done_local_grant_failed_fully_compensated",
            }),
          })).order;
        } catch (compensationError) {
          if (!(compensationError instanceof ApiHttpError)
            || compensationError.code !== "PREMIUM_ORDER_NOT_FOUND") {
            throw compensationError;
          }
          return (await this.deps.repository.settleRetainedPayment({
            orderId: order.orderId,
            actor,
            reason,
            observation: compensated,
          })).payment;
        }
      }
    }
    if (observation.status === "CANCELED") {
      if (order.status === "ready") {
        return this.deps.repository.failUnpaidOrder({
          orderId: order.orderId,
          actor,
          observation,
          audit: audit({ actor, owner: order.owner, reportId: order.binding.reportId, orderId: order.orderId, action: "payment.reconciled", now, reason: "authoritative_toss_canceled_before_confirmation" }),
        });
      }
      if (order.status === "paid" || order.status === "revoked") {
        const reason = "Authoritative Toss reconciliation: full cancellation";
        try {
          const result = await this.deps.repository.refundPayment({
            orderId: order.orderId,
            actor,
            reason,
            observation,
            audit: audit({ actor, owner: order.owner, reportId: order.binding.reportId, orderId: order.orderId, entitlementId: order.entitlementId ?? undefined, action: "payment.reconciled", now, reason: "authoritative_toss_canceled" }),
          });
          return result.order;
        } catch (error) {
          if (!(error instanceof ApiHttpError) || error.code !== "PREMIUM_ORDER_NOT_FOUND") throw error;
          return (await this.deps.repository.settleRetainedPayment({
            orderId: order.orderId, actor, reason, observation,
          })).payment;
        }
      }
      return order;
    }
    if (observation.status === "PARTIAL_CANCELED") {
      if (order.entitlementId && (order.status === "paid" || order.status === "revoked")) {
        await this.revokeEntitlement(actor, {
          entitlementId: order.entitlementId,
          reason: "Authoritative Toss state is PARTIAL_CANCELED; access is fail-closed during full-balance compensation.",
        });
      }
      if (order.status === "ready" || order.status === "paid" || order.status === "revoked") {
        const reason = "Automatic full cancellation of remaining balance after PARTIAL_CANCELED reconciliation";
        assertProviderCallBudget(this.deps, options.deadlineAtEpochMs);
        const compensated = await this.deps.toss.cancel({ paymentKey: observation.paymentKey, reason });
        if (compensated.orderId !== order.orderId || compensated.paymentKey !== observation.paymentKey
          || compensated.totalAmount !== order.amount || compensated.balanceAmount !== 0
          || compensated.currency !== order.currency || compensated.status !== "CANCELED") {
          throw new ApiHttpError(409, "TOSS_COMPENSATION_MISMATCH", "Toss did not confirm a full remaining-balance cancellation.");
        }
        try {
          const result = await this.deps.repository.compensateCanceledPayment({
            orderId: order.orderId,
            actor,
            reason,
            observation: compensated,
            audit: audit({
              actor,
              owner: order.owner,
              reportId: order.binding.reportId,
              orderId: order.orderId,
              ...(order.entitlementId ? { entitlementId: order.entitlementId } : {}),
              action: "payment.reconciled",
              now: compensated.observedAt,
              reason: "authoritative_toss_partial_canceled_fully_compensated",
            }),
          });
          return result.order;
        } catch (error) {
          if (!(error instanceof ApiHttpError) || error.code !== "PREMIUM_ORDER_NOT_FOUND") throw error;
          return (await this.deps.repository.settleRetainedPayment({
            orderId: order.orderId, actor, reason, observation: compensated,
          })).payment;
        }
      }
      return order;
    }
    if (["ABORTED", "EXPIRED"].includes(observation.status) && order.status === "ready") {
      return this.deps.repository.failUnpaidOrder({
        orderId: order.orderId,
        actor,
        observation,
        audit: audit({ actor, owner: order.owner, reportId: order.binding.reportId, orderId: order.orderId, action: "payment.reconciled", now, reason: `authoritative_toss_${observation.status.toLowerCase()}` }),
      });
    }
    throw new ApiHttpError(409, "TOSS_PAYMENT_NOT_SETTLED", "Provider payment state is not settled.");
  }

  async reconcileDuePaymentLeases(
    actor: PremiumActorV1,
    limit = 3,
    options: { readonly deadlineAtEpochMs?: number } = {},
  ): Promise<PremiumLeaseReconciliationSweepResultV1> {
    requireRole(actor, "premium_admin", "premium_system");
    const requestedAt = this.deps.now();
    const requestedAtEpoch = Date.parse(requestedAt);
    const deadlineAtEpochMs = options.deadlineAtEpochMs
      ?? requestedAtEpoch + 45_000;
    if (!Number.isInteger(limit) || limit < 1 || limit > 3
      || !Number.isFinite(requestedAtEpoch) || !Number.isFinite(deadlineAtEpochMs)) {
      throw new ApiHttpError(400, "PREMIUM_RECONCILIATION_BATCH_INVALID", "limit must be an integer from 1 to 3.");
    }
    const candidates = await this.deps.repository.listDuePaymentConfirmationLeaseCandidates({
      now: requestedAt,
      limit,
    });
    let scanned = 0;
    let settled = 0;
    let retryRequired = 0;
    let deadlineReached = false;
    // Deliberately sequential: the provider API and Firestore should see a
    // bounded, stable load even when a scheduler catches up after downtime.
    for (const candidate of candidates) {
      const attemptNow = this.deps.now();
      const attemptEpoch = Date.parse(attemptNow);
      if (!Number.isFinite(attemptEpoch)
        || attemptEpoch + PREMIUM_PROVIDER_REQUEST_TIMEOUT_MS > deadlineAtEpochMs) {
        deadlineReached = true;
        break;
      }
      scanned += 1;
      try {
        const lease = await this.deps.repository.readDuePaymentConfirmationLease({
          candidate,
          now: attemptNow,
        });
        if (lease.settlementState === "scheduled") {
          await this.reconcilePayment(actor, {
            orderId: lease.orderId,
            paymentKey: lease.paymentKey,
          }, { deadlineAtEpochMs });
        }
        await this.deps.repository.finalizeSettledPaymentConfirmationLease({ lease });
        settled += 1;
      } catch (error) {
        // Retry remains represented by the durable lease. Provider and
        // Firestore details are deliberately absent from the aggregate result.
        retryRequired += 1;
        if (error instanceof ApiHttpError && error.code === "PREMIUM_RECONCILIATION_DEADLINE") {
          deadlineReached = true;
          break;
        }
      }
    }
    return {
      scanned,
      settled,
      retryRequired,
      deadlineReached,
      hasMore: deadlineReached || retryRequired > 0 || candidates.length >= limit,
    };
  }

  async deliverReport(actor: PremiumActorV1, access: PremiumReportAccessRequestV1): Promise<DeliverPremiumReportResultV1> {
    assertPremiumReportAccessRequestV1(access);
    const owner = requireAccountOwner(this.deps, actor);
    const snapshot = await this.deps.repository.getAccessSnapshot({
      owner,
      requestId: access.requestId,
      entitlementId: access.entitlementId,
      binding: access.binding,
    });
    const replay = snapshot.replay
      ? sameBinding(snapshot.replay.binding, access.binding)
        && snapshot.replay.entitlementId === access.entitlementId
        ? { state: "same_binding_replay" as const, priorDeliveryId: snapshot.replay.delivery.deliveryId }
        : { state: "conflicting_binding_replay" as const, priorDeliveryId: snapshot.replay.delivery.deliveryId }
      : { state: "first_seen" as const };
    const now = this.deps.now();
    const decision = evaluatePremiumReportAccessV1({
      request: access,
      report: snapshot.report,
      entitlement: snapshot.entitlement,
      principal: owner,
      replay,
      now,
    });
    if (decision.access === "deny") {
      throw new ApiHttpError(403, decision.reasonCode, "Premium report access was denied.");
    }
    if (!snapshot.analysis || snapshot.analysis.reportId !== access.binding.reportId
      || !sameOwner(snapshot.analysis.owner, owner)) {
      throw new ApiHttpError(500, "PREMIUM_ANALYSIS_CORRUPT", "Trusted analysis record is unavailable.");
    }
    if (!snapshot.contentActivation) {
      throw new ApiHttpError(409, "PREMIUM_CONTENT_UNAVAILABLE", "Entitlement content activation is unavailable.");
    }
    let currentActivation: PremiumContentActivationBindingV1;
    let premiumContent = snapshot.content?.content;
    if (snapshot.contentActivation.sourceKind === "report_artifact") {
      if (!snapshot.content || !["active", "retired"].includes(snapshot.content.lifecycle) || !snapshot.content.activation
        || snapshot.content.reportId !== access.binding.reportId
        || snapshot.content.productId !== access.binding.productId
        || snapshot.content.contentVersion !== access.binding.contentVersion) {
        throw new ApiHttpError(409, "PREMIUM_CONTENT_UNAVAILABLE", "Active report content is unavailable.");
      }
      currentActivation = activationForArtifact(snapshot.content);
      premiumContent = snapshot.content.content;
    } else {
      if (!snapshot.template || !["active", "retired"].includes(snapshot.template.lifecycle) || !snapshot.template.activation
        || snapshot.template.productId !== access.binding.productId
        || snapshot.template.contentVersion !== access.binding.contentVersion) {
        throw new ApiHttpError(409, "PREMIUM_CONTENT_UNAVAILABLE", "Active reusable template is unavailable.");
      }
      currentActivation = activationForTemplate(snapshot.template);
      premiumContent = undefined;
    }
    if (!sameActivation(currentActivation, snapshot.contentActivation)) {
      throw new ApiHttpError(409, "PREMIUM_CONTENT_ACTIVATION_MISMATCH", "Entitlement is not bound to the active immutable content.");
    }
    if (decision.deliveryMode === "idempotent_replay") {
      if (!snapshot.replay) throw new ApiHttpError(500, "PREMIUM_DELIVERY_REPLAY_CORRUPT", "Stored delivery is missing.");
      // Reuse the immutable stored body and timestamp. Only the protocol mode
      // identifies this response as a replay; current content is never rebuilt.
      const replayDelivery: PremiumReportDeliveryV1 = {
        ...snapshot.replay.delivery,
        deliveryMode: "idempotent_replay",
      };
      assertPremiumReportDeliveryV1(replayDelivery, {
        entitlement: snapshot.entitlement!,
        allowedEvidenceRefs: snapshot.analysis.evidence.map((entry) => entry.evidenceId),
        accessDecision: decision,
      });
      return { delivery: replayDelivery };
    }
    if (!premiumContent) premiumContent = instantiateTemplate(snapshot.template!, snapshot.analysis);
    const delivery: PremiumReportDeliveryV1 = {
      schemaVersion: PREMIUM_REPORT_DELIVERY_SCHEMA_V1,
      deliveryId: newPremiumId("delivery"),
      binding: access.binding,
      entitlement: { entitlementId: access.entitlementId, status: "active" },
      deliveryMode: "initial",
      deliveredAt: now,
      premiumContent,
    };
    assertPremiumReportDeliveryV1(delivery, {
      entitlement: snapshot.entitlement!,
      allowedEvidenceRefs: snapshot.analysis.evidence.map((entry) => entry.evidenceId),
      accessDecision: decision,
    });
    const committed = await this.deps.repository.commitDelivery({
      internalUserId: actor.userId,
      owner,
      requestId: access.requestId,
      delivery,
      contentActivation: snapshot.contentActivation,
      audit: audit({ actor, owner, reportId: access.binding.reportId, entitlementId: access.entitlementId, action: "report.delivered", now, requestId: access.requestId }),
    });
    if (committed.mode === "initial") return { delivery: committed.delivery };
    // A concurrent identical request won the transaction. Re-run current access
    // checks so a response is never based on a stale entitlement observation.
    return this.deliverReport(actor, access);
  }

  /** Bounded portable section; excludes provider keys, audit, and analysis plaintext. */
  async exportAccountData(internalUserId: string) {
    return this.deps.repository.exportOwnerPortableData({
      owner: premiumOwnerForInternalUserIdV2(internalUserId),
      exportedAt: this.deps.now(),
    });
  }

  /** Server-internal hook for the account deletion coordinator. */
  async purgeAccountPersonalData(internalUserId: string, deletionRequestId: string) {
    if (!/^deletion_request_v1_[A-Za-z0-9_-]{16,128}$/u.test(deletionRequestId)) {
      throw new ApiHttpError(400, "PREMIUM_DELETION_REQUEST_INVALID", "Deletion request identity is invalid.");
    }
    return this.deps.repository.purgeOwnerPersonalData({
      owner: premiumOwnerForInternalUserIdV2(internalUserId),
      deletionRequestId,
      now: this.deps.now(),
    });
  }
}
