import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  PREMIUM_REPORT_ACCESS_REQUEST_SCHEMA_V1,
  PREMIUM_REPORT_REGISTRATION_REQUEST_SCHEMA_V1,
  STORY_COMPLETION_PRODUCT_ID_V1,
  candidateIdFromNameIdentityV1,
  type PremiumEntitlementOwnerV1,
  type PremiumReportAccessRequestV1,
  type PremiumReportBindingV1,
  type PremiumReportReferenceV1,
  type PremiumReportRegistrationRequestV1,
  type ReportEntitlementV1,
} from "../../../lib/spring-ts/src/index.js";
import {
  PREMIUM_CONTENT_RECORD_SCHEMA_V1,
  type PremiumActorV1,
  type PremiumAuditEventV1,
  type PremiumContentArtifactRecordV1,
  type PremiumContentActivationBindingV1,
  type PremiumContentTemplateRecordV1,
  type PremiumDataProcessingConsentAcceptanceV1,
  type PremiumPaymentOrderRecordV1,
  type PremiumPurchaseTermsAcceptanceV1,
  type PremiumServerAnalysisRecordV1,
} from "../../shared/types/premium-service.js";
import { ApiHttpError } from "../../api/_lib/http.js";
import {
  PremiumServiceV1,
  classifyPremiumBandAxisV1,
  classifyPremiumAgeAxisV1,
  classifyPremiumGyeokAxisV1,
  classifyPremiumStrengthAxisV1,
  premiumOwnerForInternalUserIdV2,
  type PremiumServiceDependenciesV1,
} from "../../api/_lib/premium-service.js";
import {
  assertPremiumAuditHmacKeyringV1,
  getPremiumAuditHmacKeyringV1,
  premiumAuditActorV2,
  premiumAuditSubjectMatchesV2,
  type PremiumAuditHmacKeyringV1,
} from "../../api/_lib/premium-audit-privacy.js";
import { openPremiumJsonRecordV1, sealPremiumJsonRecordV1 } from "../../api/_lib/premium-crypto.js";
import { legacyPremiumOwnerForInternalUserIdV1ForMigration } from "../../api/_lib/premium-owner.js";
import { premiumGateAttestationMaterialV1 } from "../../api/_lib/premium-gate-attestation.js";
import {
  premiumArtifactGateSubjectDigestV1,
  premiumTemplateGateSubjectDigestV1,
  type PremiumContentReviewReceiptV1,
} from "../../api/_lib/premium-review-contract.js";
import type {
  PremiumAccessSnapshotV1,
  PremiumProviderObservationV1,
  PremiumRepositoryV1,
} from "../../api/_lib/premium-repository.js";
import type { TossPremiumClientV1 } from "../../api/_lib/premium-toss.js";

process.env.PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON = JSON.stringify({
  currentKeyId: "test-key-v1",
  keys: { "test-key-v1": Buffer.alloc(32, 7).toString("base64") },
});
const premiumGateSecret = "test-only-content-attestation-secret-32-bytes-minimum";
process.env.CONTENT_GATE_ATTESTATION_KEYRING_JSON = JSON.stringify({ "premium-test-gate-v1": premiumGateSecret });
process.env.PREMIUM_OWNER_V2_CUTOVER_STATE = "prelaunch_empty_v1_verified";
process.env.PREMIUM_SERVICE_CATALOG_JSON = JSON.stringify({
  schemaVersion: "namespring.service-catalog.v1",
  catalogVersion: "premium-catalog.2026-07.v1",
  generatedAt: "2026-07-18T00:00:00.000Z",
  products: [{
    productId: STORY_COMPLETION_PRODUCT_ID_V1,
    contentVersion: "story-completion.2026-07.v1",
    displayName: "이야기 완성하기",
    availability: "active",
    price: { amount: 1_000, currency: "KRW", authority: "server_catalog", taxIncluded: true },
  }],
});
process.env.PREMIUM_CATALOG_ACTIVATION_STATE = "provider_staging_and_content_verified_v1";
process.env.PREMIUM_TOSS_WEB_RAIL_STATE = "provider_staging_verified_v1";
process.env.PREMIUM_POLICY_CONTRACT_JSON = JSON.stringify({
  schemaVersion: "namespring.premium-policy-contract.v1",
  dataProcessing: {
    noticeVersion: "premium-data-notice.test.v1",
    noticeDigest: `sha256:${"1".repeat(64)}`,
    purpose: "premium_report_server_recomputation",
  },
  purchase: {
    termsVersion: "premium-terms.test.v1",
    termsDigest: `sha256:${"2".repeat(64)}`,
    refundPolicyVersion: "premium-refund.test.v1",
    refundPolicyDigest: `sha256:${"3".repeat(64)}`,
  },
});

const oldAuditSecret = "premium-audit-old-key-0123456789";
const newAuditSecret = "premium-audit-new-key-9876543210";
const oldAuditKeyring: PremiumAuditHmacKeyringV1 = assertPremiumAuditHmacKeyringV1({
  currentKeyId: "2026-07-old",
  keys: { "2026-07-old": oldAuditSecret },
});
const rotatedAuditKeyring: PremiumAuditHmacKeyringV1 = assertPremiumAuditHmacKeyringV1({
  currentKeyId: "2026-08-current",
  keys: {
    "2026-07-old": oldAuditSecret,
    "2026-08-current": newAuditSecret,
  },
});
process.env.PREMIUM_AUDIT_HMAC_KEYRING_JSON = JSON.stringify(oldAuditKeyring);

const originalAuthAuditKey = process.env.AUTH_AUDIT_HMAC_KEY;
process.env.AUTH_AUDIT_HMAC_KEY = oldAuditSecret;
assert.throws(
  () => getPremiumAuditHmacKeyringV1(),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_AUDIT_KEY_REUSE",
  "environment domains must reject premium-audit key reuse",
);
if (originalAuthAuditKey === undefined) delete process.env.AUTH_AUDIT_HMAC_KEY;
else process.env.AUTH_AUDIT_HMAC_KEY = originalAuthAuditKey;
assert.equal(getPremiumAuditHmacKeyringV1().currentKeyId, oldAuditKeyring.currentKeyId);
const originalCronSecret = process.env.CRON_SECRET;
process.env.CRON_SECRET = oldAuditSecret;
assert.throws(
  () => getPremiumAuditHmacKeyringV1(),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_AUDIT_KEY_REUSE",
  "cron authentication and premium audit must use different keys",
);
if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
else process.env.CRON_SECRET = originalCronSecret;
const originalEncryptionKeyring = process.env.PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON;
process.env.PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON = JSON.stringify({
  currentKeyId: "reused-aes-key",
  keys: { "reused-aes-key": Buffer.from(oldAuditSecret, "utf8").toString("base64") },
});
assert.throws(
  () => getPremiumAuditHmacKeyringV1(),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_AUDIT_KEY_REUSE",
  "UTF-8-equivalent AES material must not be reused as a premium-audit key",
);
process.env.PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON = originalEncryptionKeyring;

assert.throws(
  () => assertPremiumAuditHmacKeyringV1({ currentKeyId: "missing", keys: { retained: oldAuditSecret } }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_AUDIT_CURRENT_KEY_MISSING",
);
assert.throws(
  () => assertPremiumAuditHmacKeyringV1({
    currentKeyId: "one",
    keys: { one: oldAuditSecret, two: oldAuditSecret },
  }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_AUDIT_KEYRING_DUPLICATE_SECRET",
);
assert.throws(
  () => assertPremiumAuditHmacKeyringV1(
    { currentKeyId: "reused", keys: { reused: oldAuditSecret } },
    [oldAuditSecret],
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_AUDIT_KEY_REUSE",
);
assert.throws(
  () => assertPremiumAuditHmacKeyringV1({ currentKeyId: "one", keys: { one: oldAuditSecret }, extra: true }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_AUDIT_KEYRING_INVALID",
);

assert.equal(classifyPremiumStrengthAxisV1("STRONG"), "strong");
assert.equal(classifyPremiumStrengthAxisV1("BALANCED"), "balanced");
assert.equal(classifyPremiumStrengthAxisV1("WEAK"), "weak");
assert.equal(classifyPremiumStrengthAxisV1("UNKNOWN"), "unknown");
assert.equal(classifyPremiumBandAxisV1(5), "high");
assert.equal(classifyPremiumBandAxisV1(4), "high");
assert.equal(classifyPremiumBandAxisV1(3), "mid");
assert.equal(classifyPremiumBandAxisV1(2), "low");
assert.equal(classifyPremiumBandAxisV1(undefined), "unknown");
assert.equal(classifyPremiumAgeAxisV1(
  { year: 2006, month: 7, day: 19, hour: 0, minute: 0, gender: "female", calendarType: "lunar" },
  "2026-07-18",
), "unknown");
for (const code of ["BI_GYEON", "GYEOB_JAE", "GEOB_JAE"]) {
  assert.equal(classifyPremiumGyeokAxisV1({ categoryCode: "NORMAL", baseTenGodCode: code }), "bigeop");
}
for (const code of ["JEONG_IN", "PYEON_IN"]) {
  assert.equal(classifyPremiumGyeokAxisV1({ categoryCode: "NORMAL", baseTenGodCode: code }), "insung");
}
for (const code of ["JEONG_GWAN", "PYEON_GWAN", "CHIL_SAL"]) {
  assert.equal(classifyPremiumGyeokAxisV1({ categoryCode: "NORMAL", baseTenGodCode: code }), "gwanseong");
}
for (const code of ["JEONG_JAE", "PYEON_JAE"]) {
  assert.equal(classifyPremiumGyeokAxisV1({ categoryCode: "NORMAL", baseTenGodCode: code }), "jaeseong");
}
for (const code of ["SIK_SIN", "SIK_SHIN", "SANG_GWAN"]) {
  assert.equal(classifyPremiumGyeokAxisV1({ categoryCode: "NORMAL", baseTenGodCode: code }), "siksang");
}
assert.equal(classifyPremiumGyeokAxisV1({ categoryCode: "JONGGYEOK", baseTenGodCode: "JEONG_JAE" }), "special");
assert.equal(classifyPremiumGyeokAxisV1({ categoryCode: "UNKNOWN", baseTenGodCode: null }), "unknown");

const sensitiveProbe = {
  candidateId: "candidate_v1_dictionary_reversible_probe",
  materialDigest: `sha256:${"9".repeat(64)}`,
  displayName: "이영수",
};
const sealedProbe = sealPremiumJsonRecordV1("premium-test/probe", sensitiveProbe);
assert.equal(JSON.stringify(sealedProbe).includes(sensitiveProbe.candidateId), false);
assert.equal(JSON.stringify(sealedProbe).includes(sensitiveProbe.displayName), false);
assert.deepEqual(openPremiumJsonRecordV1("premium-test/probe", sealedProbe), sensitiveProbe);
assert.throws(() => openPremiumJsonRecordV1("premium-test/wrong-aad", sealedProbe), /authentication failed/u);

const times = {
  registration: "2026-07-18T10:00:00.000Z",
  payment: "2026-07-18T10:01:00.000Z",
  delivery: "2026-07-18T10:02:00.000Z",
  revoke: "2026-07-18T10:03:00.000Z",
  refund: "2026-07-18T10:04:00.000Z",
};
const dataProcessingConsent: PremiumDataProcessingConsentAcceptanceV1 = {
  accepted: true,
  noticeVersion: "premium-data-notice.test.v1",
  noticeDigest: `sha256:${"1".repeat(64)}`,
  purpose: "premium_report_server_recomputation",
  clientAcceptedAt: times.registration,
};
const purchaseTermsAcceptance: PremiumPurchaseTermsAcceptanceV1 = {
  accepted: true,
  termsVersion: "premium-terms.test.v1",
  termsDigest: `sha256:${"2".repeat(64)}`,
  refundPolicyVersion: "premium-refund.test.v1",
  refundPolicyDigest: `sha256:${"3".repeat(64)}`,
  clientAcceptedAt: times.registration,
};
let currentTime = times.registration;
const actorA: PremiumActorV1 = { userId: "11111111-1111-4111-8111-111111111111", sessionId: "session_a", roles: ["user"] };
const actorB: PremiumActorV1 = { userId: "22222222-2222-4222-8222-222222222222", sessionId: "session_b", roles: ["user"] };
const actorC: PremiumActorV1 = { userId: "33333333-3333-4333-8333-333333333333", sessionId: "session_c", roles: ["user"] };
const admin: PremiumActorV1 = { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", sessionId: "session_admin", roles: ["user", "premium_admin"] };
const reviewerAdmin: PremiumActorV1 = { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", sessionId: "session_reviewer", roles: ["user", "premium_admin"] };

function ownerFor(actor: PremiumActorV1): PremiumEntitlementOwnerV1 {
  return premiumOwnerForInternalUserIdV2(actor.userId);
}

const stableOwnerBeforeAuditRotation = ownerFor(actorA);
assert.match(stableOwnerBeforeAuditRotation.subjectId, /^premium_owner_v2_[A-Za-z0-9_-]{43}$/u);
assert.deepEqual(ownerFor(actorA), stableOwnerBeforeAuditRotation);
assert.notDeepEqual(ownerFor(actorA), ownerFor(actorB));
assert.notDeepEqual(
  stableOwnerBeforeAuditRotation,
  legacyPremiumOwnerForInternalUserIdV1ForMigration(
    actorA.userId,
    "legacy-premium-owner-migration-secret-0123456789",
  ),
);
assert.throws(
  () => premiumOwnerForInternalUserIdV2("not-an-internal-uuid"),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_USER_ID_INVALID",
);
const verifiedOwnerCutover = process.env.PREMIUM_OWNER_V2_CUTOVER_STATE;
delete process.env.PREMIUM_OWNER_V2_CUTOVER_STATE;
assert.throws(
  () => premiumOwnerForInternalUserIdV2(actorA.userId),
  (error: unknown) => error instanceof ApiHttpError && error.code === "MISSING_ENV",
);
process.env.PREMIUM_OWNER_V2_CUTOVER_STATE = "unverified";
assert.throws(
  () => premiumOwnerForInternalUserIdV2(actorA.userId),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_OWNER_V2_CUTOVER_UNVERIFIED",
);
process.env.PREMIUM_OWNER_V2_CUTOVER_STATE = verifiedOwnerCutover;

function ownerKey(owner: PremiumEntitlementOwnerV1): string {
  return `${owner.kind}:${owner.subjectId}`;
}

function bindingKey(binding: PremiumReportBindingV1): string {
  return [binding.reportId, binding.analysisId, binding.candidateId, binding.productId, binding.contentVersion].join(":");
}

function signPremiumGate(
  provenance: PremiumContentArtifactRecordV1["provenance"],
  subjectDigest: `sha256:${string}`,
) {
  const attestation = {
    scheme: "HMAC-SHA256-V1" as const,
    keyId: "premium-test-gate-v1",
    subjectDigest,
    signature: "" as `hmac-sha256:${string}`,
  };
  return {
    ...attestation,
    signature: `hmac-sha256:${createHmac("sha256", premiumGateSecret).update(premiumGateAttestationMaterialV1({
      scheme: attestation.scheme,
      keyId: attestation.keyId,
      subjectDigest,
      gateVersion: provenance.gate.gateVersion,
      status: provenance.gate.status,
      evaluatedAt: provenance.gate.evaluatedAt,
      resultDigest: provenance.gate.resultDigest,
    }), "utf8").digest("hex")}` as `hmac-sha256:${string}`,
  };
}

class MemoryPremiumRepository implements PremiumRepositoryV1 {
  registrations = new Map<string, {
    materialDigest: string;
    consentAcceptanceDigest: `sha256:${string}`;
    report: PremiumReportReferenceV1;
  }>();
  reports = new Map<string, PremiumReportReferenceV1>();
  analyses = new Map<string, PremiumServerAnalysisRecordV1>();
  content = new Map<string, PremiumContentArtifactRecordV1>();
  artifacts = new Map<string, PremiumContentArtifactRecordV1>();
  templates = new Map<string, PremiumContentTemplateRecordV1>();
  templateArtifacts = new Map<string, PremiumContentTemplateRecordV1>();
  reviews = new Map<string, PremiumContentReviewReceiptV1>();
  orders = new Map<string, PremiumPaymentOrderRecordV1>();
  checkout = new Map<string, string>();
  entitlements = new Map<string, ReportEntitlementV1>();
  grants = new Map<string, PremiumContentActivationBindingV1>();
  deliveries = new Map<string, { owner: PremiumEntitlementOwnerV1; requestId: string; entitlementId: string; binding: PremiumReportBindingV1; delivery: any; createdAt: string }>();
  deletionReceipts = new Map<string, { deletedResources: number; retainedPayments: number }>();
  audits: PremiumAuditEventV1[] = [];

  async getRegistration(owner: PremiumEntitlementOwnerV1, requestId: string) {
    return this.registrations.get(`${ownerKey(owner)}:${requestId}`) ?? null;
  }
  async commitRegistration(input: any) {
    const key = `${ownerKey(input.report.registration.owner)}:${input.report.registration.requestId}`;
    const existing = this.registrations.get(key);
    if (existing) {
      if (existing.materialDigest !== input.report.registration.materialDigest
        || existing.consentAcceptanceDigest !== input.analysis.dataProcessingConsent.acceptanceDigest) {
        throw new ApiHttpError(409, "PREMIUM_IDEMPOTENCY_CONFLICT", "conflict");
      }
      return { report: existing.report, mode: "idempotent_replay" as const };
    }
    this.registrations.set(key, {
      materialDigest: input.report.registration.materialDigest,
      consentAcceptanceDigest: input.analysis.dataProcessingConsent.acceptanceDigest,
      report: input.report,
    });
    this.reports.set(input.report.binding.reportId, input.report);
    this.analyses.set(input.analysis.analysisId, input.analysis);
    this.audits.push(input.audit);
    return { report: input.report, mode: "initial" as const };
  }
  async getReport(id: string) { return this.reports.get(id) ?? null; }
  async getAnalysis(id: string) { return this.analyses.get(id) ?? null; }
  async getActiveContent(binding: PremiumReportBindingV1) { return this.content.get(bindingKey(binding)) ?? null; }
  async getActiveTemplate(input: { productId: string; contentVersion: string; selectorKeys: readonly string[] }) {
    for (const selectorKey of input.selectorKeys) {
      const template = this.templates.get(`${input.productId}:${input.contentVersion}:${selectorKey}`);
      if (template) return template;
    }
    return null;
  }
  async getContentReviewReceipt(receiptId: string) { return this.reviews.get(receiptId) ?? null; }
  async createContentReview(input: {
    receipt: PremiumContentReviewReceiptV1;
    reviewer: PremiumActorV1;
    audit: PremiumAuditEventV1;
  }) {
    const existing = this.reviews.get(input.receipt.receiptId);
    if (existing) {
      if (existing.requestId !== input.receipt.requestId
        || existing.reviewedMaterialDigest !== input.receipt.reviewedMaterialDigest
        || existing.notesDigest !== input.receipt.notesDigest
        || !premiumAuditSubjectMatchesV2(
          "actor", input.reviewer.userId, existing.reviewer.actorSubject, rotatedAuditKeyring,
        )) {
        throw new ApiHttpError(409, "PREMIUM_REVIEW_IDEMPOTENCY_CONFLICT", "conflict");
      }
      return { receipt: existing, mode: "idempotent_replay" as const };
    }
    this.reviews.set(input.receipt.receiptId, input.receipt);
    this.audits.push(input.audit);
    return { receipt: input.receipt, mode: "initial" as const };
  }
  async activateContent(input: {
    artifact: PremiumContentArtifactRecordV1;
    reviewReceiptId: string;
    activationRequestId: string;
    reviewedMaterialDigest: `sha256:${string}`;
    activator: PremiumActorV1;
    audit: PremiumAuditEventV1;
  }) {
    const receipt = this.reviews.get(input.reviewReceiptId);
    if (!receipt) throw new ApiHttpError(409, "PREMIUM_REVIEW_RECEIPT_UNAVAILABLE", "missing");
    if (premiumAuditSubjectMatchesV2(
      "actor", input.activator.userId, receipt.reviewer.actorSubject, rotatedAuditKeyring,
    )) {
      throw new ApiHttpError(409, "PREMIUM_INDEPENDENT_APPROVAL_REQUIRED", "same principal");
    }
    if (receipt.resourceId !== input.artifact.artifactId
      || receipt.reviewedMaterialDigest !== input.reviewedMaterialDigest) {
      throw new ApiHttpError(409, "PREMIUM_REVIEW_BINDING_MISMATCH", "mismatch");
    }
    const report = this.reports.get(input.artifact.reportId)!;
    const key = bindingKey(report.binding);
    const existing = this.content.get(key);
    if (receipt.status === "consumed") {
      if (receipt.consumption?.activationRequestId === input.activationRequestId
        && premiumAuditSubjectMatchesV2(
          "actor", input.activator.userId, receipt.consumption.activatedBy, rotatedAuditKeyring,
        ) && existing) return existing;
      throw new ApiHttpError(409, "PREMIUM_REVIEW_RECEIPT_CONSUMED", "consumed");
    }
    if (existing) throw new ApiHttpError(409, "PREMIUM_CONTENT_ALREADY_ACTIVE", "active");
    this.content.set(key, input.artifact);
    this.artifacts.set(input.artifact.artifactId, input.artifact);
    this.reviews.set(receipt.receiptId, {
      ...receipt,
      status: "consumed",
      consumption: {
        activationId: input.artifact.activation!.activationId,
        activationRequestId: input.activationRequestId,
        activatedBy: premiumAuditActorV2(input.activator, rotatedAuditKeyring).userId,
        activatedAt: input.artifact.activation!.activatedAt,
        immutableContentDigest: input.artifact.activation!.immutableContentDigest,
      },
    });
    this.audits.push(input.audit);
    return input.artifact;
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
    const receipt = this.reviews.get(input.reviewReceiptId);
    if (!receipt) throw new ApiHttpError(409, "PREMIUM_REVIEW_RECEIPT_UNAVAILABLE", "missing");
    if (premiumAuditSubjectMatchesV2(
      "actor", input.activator.userId, receipt.reviewer.actorSubject, rotatedAuditKeyring,
    )) {
      throw new ApiHttpError(409, "PREMIUM_INDEPENDENT_APPROVAL_REQUIRED", "same principal");
    }
    if (receipt.resourceId !== input.template.templateId
      || receipt.reviewedMaterialDigest !== input.reviewedMaterialDigest) {
      throw new ApiHttpError(409, "PREMIUM_REVIEW_BINDING_MISMATCH", "mismatch");
    }
    const key = `${input.template.productId}:${input.template.contentVersion}:${input.template.selectorKey}`;
    const existing = this.templates.get(key);
    if (receipt.status === "consumed") {
      if (receipt.consumption?.activationRequestId === input.activationRequestId
        && premiumAuditSubjectMatchesV2(
          "actor", input.activator.userId, receipt.consumption.activatedBy, rotatedAuditKeyring,
        ) && existing) return existing;
      throw new ApiHttpError(409, "PREMIUM_REVIEW_RECEIPT_CONSUMED", "consumed");
    }
    if (existing) throw new ApiHttpError(409, "PREMIUM_TEMPLATE_ALREADY_ACTIVE", "active");
    this.templates.set(
      key,
      input.template,
    );
    this.templateArtifacts.set(input.template.templateId, input.template);
    this.reviews.set(receipt.receiptId, {
      ...receipt,
      status: "consumed",
      consumption: {
        activationId: input.template.activation!.activationId,
        activationRequestId: input.activationRequestId,
        activatedBy: premiumAuditActorV2(input.activator, rotatedAuditKeyring).userId,
        activatedAt: input.template.activation!.activatedAt,
        immutableContentDigest: input.template.activation!.immutableContentDigest,
      },
    });
    this.audits.push(input.audit);
    return input.template;
  }
  async retireContent(input: any) {
    if (input.activation.sourceKind === "report_artifact") {
      const artifact = this.artifacts.get(input.activation.resourceId)!;
      this.artifacts.set(artifact.artifactId, { ...artifact, lifecycle: "retired" });
      this.content.delete(bindingKey(input.binding));
    } else {
      const template = this.templateArtifacts.get(input.activation.resourceId)!;
      this.templateArtifacts.set(template.templateId, { ...template, lifecycle: "retired" });
      this.templates.delete(`${template.productId}:${template.contentVersion}:${template.selectorKey}`);
    }
    this.audits.push(input.audit);
  }
  async createCheckout(input: { order: PremiumPaymentOrderRecordV1; audit: PremiumAuditEventV1 }) {
    const key = `${ownerKey(input.order.owner)}:${input.order.requestId}`;
    const priorId = this.checkout.get(key);
    if (priorId) {
      const prior = this.orders.get(priorId)!;
      if (prior.purchaseTermsReceipt.acceptanceDigest
        !== input.order.purchaseTermsReceipt.acceptanceDigest) {
        throw new ApiHttpError(409, "PREMIUM_IDEMPOTENCY_CONFLICT", "conflict");
      }
      return { order: prior, mode: "idempotent_replay" as const };
    }
    this.checkout.set(key, input.order.orderId);
    this.orders.set(input.order.orderId, input.order);
    this.audits.push(input.audit);
    return { order: input.order, mode: "initial" as const };
  }
  async getOrder(id: string) { return this.orders.get(id) ?? null; }
  async getRetainedPayment() { return null; }
  async getEntitlement(id: string) { return this.entitlements.get(id) ?? null; }
  async acquirePaymentConfirmationLease() { return { mode: "initial" as const }; }
  async listDuePaymentConfirmationLeaseCandidates() { return []; }
  async readDuePaymentConfirmationLease() { throw new Error("No lease candidate"); }
  async finalizeSettledPaymentConfirmationLease() {}
  async confirmPayment(input: any) {
    const order = this.orders.get(input.orderId)!;
    if (order.status === "paid") return { order, entitlement: this.entitlements.get(order.entitlementId!)!, mode: "idempotent_replay" as const };
    if (input.observation.status !== "DONE" || input.observation.orderId !== order.orderId
      || input.observation.paymentKey === "wrong" || input.observation.totalAmount !== order.amount
      || input.observation.balanceAmount !== order.amount) throw new ApiHttpError(409, "TOSS_CONFIRMATION_MISMATCH", "mismatch");
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
    const updated = { ...order, status: "paid" as const, paymentKey: input.observation.paymentKey, entitlementId: entitlement.entitlementId, paidAt: input.observation.occurredAt, updatedAt: input.observation.observedAt };
    this.orders.set(order.orderId, updated);
    this.entitlements.set(entitlement.entitlementId, entitlement);
    this.grants.set(entitlement.entitlementId, order.contentActivation);
    this.audits.push(input.audit);
    return { order: updated, entitlement, mode: "initial" as const };
  }
  async refundPayment(input: any) {
    const order = this.orders.get(input.orderId)!;
    const entitlement = this.entitlements.get(order.entitlementId!)!;
    if (order.status === "refunded") return { order, entitlement, mode: "idempotent_replay" as const };
    if (input.observation.status !== "CANCELED" || input.observation.balanceAmount !== 0) throw new ApiHttpError(409, "TOSS_REFUND_MISMATCH", "mismatch");
    const updatedOrder = { ...order, status: "refunded" as const, refundedAt: input.observation.occurredAt, updatedAt: input.observation.observedAt };
    const updatedEntitlement = { ...entitlement, status: "refunded" as const, updatedAt: input.observation.observedAt };
    this.orders.set(order.orderId, updatedOrder);
    this.entitlements.set(entitlement.entitlementId, updatedEntitlement);
    this.audits.push(input.audit);
    return { order: updatedOrder, entitlement: updatedEntitlement, mode: "initial" as const };
  }
  async compensateCanceledPayment(input: any) {
    const order = this.orders.get(input.orderId)!;
    const entitlement = order.entitlementId ? this.entitlements.get(order.entitlementId) ?? null : null;
    const updatedOrder = {
      ...order,
      status: "refunded" as const,
      paymentKey: input.observation.paymentKey,
      refundedAt: input.observation.occurredAt,
      updatedAt: input.observation.observedAt,
      providerState: {
        status: input.observation.status,
        totalAmount: input.observation.totalAmount,
        balanceAmount: input.observation.balanceAmount,
        occurredAt: input.observation.occurredAt,
        observedAt: input.observation.observedAt,
        eventId: input.observation.eventId,
      },
    };
    const updatedEntitlement = entitlement ? { ...entitlement, status: "refunded" as const } : null;
    this.orders.set(order.orderId, updatedOrder);
    if (updatedEntitlement) this.entitlements.set(updatedEntitlement.entitlementId, updatedEntitlement);
    this.audits.push(input.audit);
    return { order: updatedOrder, entitlement: updatedEntitlement, mode: "initial" as const };
  }
  async settleRetainedPayment() { throw new Error("No retained-payment fixture"); }
  async failUnpaidOrder(input: any) {
    const order = this.orders.get(input.orderId)!;
    const updated = { ...order, status: "failed" as const, paymentKey: input.observation.paymentKey, updatedAt: input.observation.observedAt };
    this.orders.set(order.orderId, updated);
    this.audits.push(input.audit);
    return updated;
  }
  async revokeEntitlement(input: any) {
    const entitlement = this.entitlements.get(input.entitlementId)!;
    const updated = { ...entitlement, status: "revoked" as const, updatedAt: input.now };
    this.entitlements.set(entitlement.entitlementId, updated);
    for (const [id, order] of this.orders) if (order.entitlementId === entitlement.entitlementId) this.orders.set(id, { ...order, status: "revoked", updatedAt: input.now });
    this.audits.push(input.audit);
    return updated;
  }
  async getAccessSnapshot(input: any): Promise<PremiumAccessSnapshotV1> {
    const activation = this.grants.get(input.entitlementId) ?? null;
    const template = activation?.sourceKind === "case_template"
      ? this.templateArtifacts.get(activation.resourceId) ?? null
      : null;
    const content = activation?.sourceKind === "report_artifact"
      ? this.artifacts.get(activation.resourceId) ?? null
      : null;
    return {
      report: this.reports.get(input.binding.reportId) ?? null,
      entitlement: this.entitlements.get(input.entitlementId) ?? null,
      analysis: this.analyses.get(input.binding.analysisId) ?? null,
      content,
      template,
      contentActivation: activation,
      replay: this.deliveries.get(`${ownerKey(input.owner)}:${input.requestId}`) ?? null,
    };
  }
  async commitDelivery(input: any) {
    const key = `${ownerKey(input.owner)}:${input.requestId}`;
    const existing = this.deliveries.get(key);
    if (existing) return { delivery: existing.delivery, mode: "idempotent_replay" as const };
    this.deliveries.set(key, { owner: input.owner, requestId: input.requestId, entitlementId: input.delivery.entitlement.entitlementId, binding: input.delivery.binding, delivery: input.delivery, createdAt: input.delivery.deliveredAt });
    this.audits.push(input.audit);
    return { delivery: input.delivery, mode: "initial" as const };
  }
  async exportOwnerPortableData(input: any) {
    const reports = [...this.reports.values()].filter((report) => ownerKey(report.registration.owner) === ownerKey(input.owner));
    const orders = [...this.orders.values()].filter((order) => ownerKey(order.owner) === ownerKey(input.owner));
    const entitlements = [...this.entitlements.values()].filter((entry) => ownerKey(entry.owner) === ownerKey(input.owner));
    const deliveries = [...this.deliveries.values()].filter((entry) => ownerKey(entry.owner) === ownerKey(input.owner));
    return {
      schemaVersion: "namespring.premium-account-export.v1" as const,
      exportedAt: input.exportedAt,
      reports: reports.map((report) => ({ binding: report.binding, status: report.status, registeredAt: report.registeredAt, updatedAt: report.updatedAt })),
      orders: orders.map((order) => ({ orderId: order.orderId, binding: order.binding, amount: order.amount, currency: order.currency, status: order.status, createdAt: order.createdAt, updatedAt: order.updatedAt, paidAt: order.paidAt, refundedAt: order.refundedAt })),
      entitlements: entitlements.map(({ owner: _owner, ...entry }) => entry),
      deliveries: deliveries.map((entry) => ({ requestId: entry.requestId, delivery: entry.delivery })),
      retention: { legalPaymentRecordsExcluded: true as const, policy: "account_link_removed_and_minimized_payment_record_retained_separately" as const },
    };
  }
  async purgeOwnerPersonalData(input: any) {
    const receiptKey = `${ownerKey(input.owner)}:${input.deletionRequestId}`;
    const prior = this.deletionReceipts.get(receiptKey);
    if (prior) return { ...prior, mode: "idempotent_replay" as const };
    let deletedResources = 0;
    let retainedPayments = 0;
    const reportIds = new Set([...this.reports.values()]
      .filter((report) => ownerKey(report.registration.owner) === ownerKey(input.owner))
      .map((report) => report.binding.reportId));
    for (const [id, report] of [...this.reports]) if (reportIds.has(report.binding.reportId)) { this.reports.delete(id); deletedResources += 1; }
    for (const [id, analysis] of [...this.analyses]) if (reportIds.has(analysis.reportId)) { this.analyses.delete(id); deletedResources += 1; }
    for (const [id, order] of [...this.orders]) if (ownerKey(order.owner) === ownerKey(input.owner)) {
      if (order.paymentKey || ["paid", "refunded", "revoked"].includes(order.status)) retainedPayments += 1;
      this.orders.delete(id); deletedResources += 1;
    }
    for (const [id, entitlement] of [...this.entitlements]) if (ownerKey(entitlement.owner) === ownerKey(input.owner)) { this.entitlements.delete(id); deletedResources += 1; }
    for (const [id, delivery] of [...this.deliveries]) if (ownerKey(delivery.owner) === ownerKey(input.owner)) { this.deliveries.delete(id); deletedResources += 1; }
    for (const [id, registration] of [...this.registrations]) if (reportIds.has(registration.report.binding.reportId)) { this.registrations.delete(id); deletedResources += 1; }
    const receipt = { deletedResources, retainedPayments };
    this.deletionReceipts.set(receiptKey, receipt);
    return { ...receipt, mode: "initial" as const };
  }
}

class FakeToss implements TossPremiumClientV1 {
  readonly rail = "toss_web" as const;
  calls = 0;
  next!: PremiumProviderObservationV1;
  cancelNext: PremiumProviderObservationV1 | null = null;
  async confirm() { this.calls += 1; return this.next; }
  async get() { this.calls += 1; return this.next; }
  async cancel() { this.calls += 1; return this.cancelNext ?? this.next; }
}

const repository = new MemoryPremiumRepository();
const toss = new FakeToss();
const candidateId = candidateIdFromNameIdentityV1({
  surnameHangul: "이", surnameHanja: "李", givenHangul: "영수", givenHanja: "永洙",
});
const fakeDelivery = {
  schemaVersion: "spring-ts.report-delivery.v1",
  analysisId: "analysis_v1_server_recompute_test",
  generatedAt: times.registration,
  anchorDate: "2026-07-18",
  subject: { displayName: "이영수", candidateId },
  coverage: { surfaces: [{ id: "integrated", depth: "standard" }] },
  provenance: {},
  availability: { status: "ready", reasonCodes: [] },
  facts: [
    { id: "fact.day-master", kind: "day_master" },
    { id: "fortune.life.overall.stars", kind: "metric", unit: "stars_1_5", value: 4 },
  ],
  interpretations: [{ id: "interpretation.name-balance", kind: "claim" }],
  surfaces: [],
  offers: [],
} as any;
const deps: PremiumServiceDependenciesV1 = {
  repository,
  toss,
  now: () => currentTime,
  createEngine: () => ({ init: async () => {}, getReportDelivery: async () => structuredClone(fakeDelivery), close() {} }),
  ownerForActor: ownerFor,
};
const service = new PremiumServiceV1(deps);

const registration: PremiumReportRegistrationRequestV1 = {
  schemaVersion: PREMIUM_REPORT_REGISTRATION_REQUEST_SCHEMA_V1,
  requestId: "premium_request_v1_registration_0123456789abcdef",
  productId: STORY_COMPLETION_PRODUCT_ID_V1,
  localAnalysisId: "analysis_v1_local_0123456789abcdef",
  candidateId,
  analysisInput: {
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: "male" },
    surname: [{ hangul: "이", hanja: "李" }],
    givenName: [{ hangul: "영", hanja: "永" }, { hangul: "수", hanja: "洙" }],
    targetDate: "2026-07-18",
  },
};

const first = await service.registerReport(actorA, registration, dataProcessingConsent);
assert.equal(first.registrationMode, "initial");
const storedFirstReport = repository.reports.get(first.report.binding.reportId)!;
assert.equal(storedFirstReport.registration.owner.subjectId, ownerFor(actorA).subjectId);
const serializedRegistration = JSON.stringify(first);
for (const forbidden of [
  ownerFor(actorA).subjectId,
  storedFirstReport.registration.materialDigest,
  dataProcessingConsent.noticeDigest,
  "acceptanceDigest",
]) {
  assert.equal(serializedRegistration.includes(forbidden), false, `registration response leaked ${forbidden}`);
}
assert.equal("registration" in first.report, false);
assert.equal(repository.analyses.size, 1);
const analysis = repository.analyses.get(first.report.binding.analysisId)!;
assert.deepEqual(
  { category: analysis.contentSelector.axes.category, period: analysis.contentSelector.axes.period, band: analysis.contentSelector.axes.band },
  { category: "overall", period: "life", band: "high" },
);
assert.match(analysis.contentSelector.keys[0]!, /\/overall\.life\.adult\.high\./u);
assert.equal("delivery" in analysis, false, "plaintext analysis must not be persisted");
assert.ok(analysis.sealedDelivery.ciphertext.length > 50);
assert.equal(JSON.stringify(analysis).includes("이영수"), false, "sealed record must not contain the plaintext name");

const firstAudit = repository.audits[0]!;
assert.equal(firstAudit.action, "report.registered");
assert.equal(firstAudit.deleteAfter, "2027-07-18T10:00:00.000Z");
assert.match(firstAudit.actor.userId, /^premium_audit_actor_v2:2026-07-old:[a-f0-9]{64}$/u);
assert.match(firstAudit.actor.sessionId, /^premium_audit_session_v2:2026-07-old:[a-f0-9]{64}$/u);
assert.equal(JSON.stringify(firstAudit).includes(actorA.userId), false, "raw user ID must not be stored in premium audit");
assert.equal(JSON.stringify(firstAudit).includes(actorA.sessionId), false, "raw session ID must not be stored in premium audit");
assert.equal(premiumAuditSubjectMatchesV2("actor", actorA.userId, firstAudit.actor.userId, oldAuditKeyring), true);
assert.equal(premiumAuditSubjectMatchesV2("session", actorA.sessionId, firstAudit.actor.sessionId, oldAuditKeyring), true);
assert.equal(premiumAuditSubjectMatchesV2("actor", actorB.userId, firstAudit.actor.userId, oldAuditKeyring), false);
assert.throws(
  () => premiumAuditSubjectMatchesV2(
    "actor",
    actorA.userId,
    firstAudit.actor.userId,
    assertPremiumAuditHmacKeyringV1({ currentKeyId: "2026-08-current", keys: { "2026-08-current": newAuditSecret } }),
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_AUDIT_KEY_NOT_RETAINED",
);

const replay = await service.registerReport(actorA, structuredClone(registration), dataProcessingConsent);
assert.equal(replay.registrationMode, "idempotent_replay");
assert.equal(replay.report.binding.reportId, first.report.binding.reportId);
await assert.rejects(
  service.registerReport(actorA, structuredClone(registration), {
    ...dataProcessingConsent,
    clientAcceptedAt: "2026-07-18T09:59:59.000Z",
  }),
  (error: unknown) => error instanceof ApiHttpError && error.statusCode === 409,
  "registration replay must remain bound to the original consent acceptance",
);
await assert.rejects(
  service.registerReport(actorA, structuredClone(registration), {
    ...dataProcessingConsent,
    noticeVersion: "premium-data-notice.stale.v1",
  }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_DATA_CONSENT_REQUIRED",
);
await assert.rejects(
  service.registerReport(
    actorA,
    { ...registration, analysisInput: { ...registration.analysisInput, targetDate: "2026-07-19" } },
    dataProcessingConsent,
  ),
  (error: unknown) => error instanceof ApiHttpError && error.statusCode === 409,
);

const legacyReportId = "premium_report_v1_legacy_owner_0123456789abcdef";
const legacyOwner = legacyPremiumOwnerForInternalUserIdV1ForMigration(
  actorA.userId,
  "legacy-premium-owner-migration-secret-0123456789",
);
const legacyInjectedService = new PremiumServiceV1({
  ...deps,
  ownerForActor: () => legacyOwner,
  createEngine: () => {
    throw new Error("legacy owner must fail before premium engine creation");
  },
});
await assert.rejects(
  legacyInjectedService.registerReport(
    actorA,
    {
      ...registration,
      requestId: "premium_request_v1_legacy_adapter_0123456789abcdef",
    },
    dataProcessingConsent,
  ),
  (error: unknown) => error instanceof ApiHttpError
    && error.statusCode === 503
    && error.code === "PREMIUM_OWNER_V1_MIGRATION_REQUIRED",
  "a misconfigured owner adapter must not re-enable legacy authorization",
);
repository.reports.set(legacyReportId, {
  ...structuredClone(storedFirstReport),
  binding: { ...first.report.binding, reportId: legacyReportId },
  registration: { ...storedFirstReport.registration, owner: legacyOwner },
});
await assert.rejects(
  service.createCheckout(actorA, {
    reportId: legacyReportId,
    productId: STORY_COMPLETION_PRODUCT_ID_V1,
    requestId: "premium_request_v1_legacy_owner_0123456789abcdef",
    purchaseTermsAcceptance,
  }),
  (error: unknown) => error instanceof ApiHttpError
    && error.statusCode === 503
    && error.code === "PREMIUM_OWNER_V1_MIGRATION_REQUIRED",
  "legacy owner records must never be guessed or silently linked at runtime",
);
repository.reports.delete(legacyReportId);

process.env.PREMIUM_AUDIT_HMAC_KEYRING_JSON = JSON.stringify(rotatedAuditKeyring);
assert.deepEqual(ownerFor(actorA), stableOwnerBeforeAuditRotation, "audit-key rotation must not change premium ownership");
assert.equal(premiumAuditSubjectMatchesV2("actor", actorA.userId, firstAudit.actor.userId, rotatedAuditKeyring), true);

await assert.rejects(
  service.createCheckout(actorA, {
    reportId: first.report.binding.reportId,
    productId: STORY_COMPLETION_PRODUCT_ID_V1,
    requestId: "premium_request_v1_checkout_0123456789abcdef",
    purchaseTermsAcceptance,
  }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_CONTENT_UNAVAILABLE",
  "payment must fail closed until approved content is active",
);

const artifactDraft: PremiumContentArtifactRecordV1 = {
  schemaVersion: PREMIUM_CONTENT_RECORD_SCHEMA_V1,
  artifactId: "premium_artifact_v1_0123456789abcdef",
  reportId: first.report.binding.reportId,
  productId: STORY_COMPLETION_PRODUCT_ID_V1,
  contentVersion: first.report.binding.contentVersion,
  lifecycle: "approved",
  provenance: {
    sourceDigest: `sha256:${"1".repeat(64)}`,
    model: { provider: "review-pipeline", modelId: "model-version", generatedAt: times.registration },
    prompt: { promptId: "story", promptVersion: "v1", promptDigest: `sha256:${"2".repeat(64)}` },
    gate: {
      gateVersion: "gate-v1",
      status: "passed",
      evaluatedAt: times.registration,
      resultDigest: `sha256:${"3".repeat(64)}`,
      attestation: {
        scheme: "HMAC-SHA256-V1",
        keyId: "premium-test-gate-v1",
        subjectDigest: `sha256:${"0".repeat(64)}`,
        signature: `hmac-sha256:${"0".repeat(64)}`,
      },
    },
  },
  content: {
    kind: "story_completion",
    format: "structured_plain_text_v1",
    title: "검토된 이야기",
    summary: "검토된 요약입니다.",
    sections: [{ id: "section-1", title: "첫 장", body: "근거에 연결된 검토 문장입니다.", evidenceRefs: [analysis.evidence[0]!.evidenceId] }],
  },
};
const artifactSubjectDigest = premiumArtifactGateSubjectDigestV1(artifactDraft, first.report.binding);
const artifact: PremiumContentArtifactRecordV1 = {
  ...artifactDraft,
  provenance: {
    ...artifactDraft.provenance,
    gate: {
      ...artifactDraft.provenance.gate,
      attestation: signPremiumGate(artifactDraft.provenance, artifactSubjectDigest),
    },
  },
};
const reviewRequestId = "premium_review_request_v1_artifact_0123456789abcdef";
const activationRequestId = "premium_activation_request_v1_artifact_0123456789abcdef";
await assert.rejects(
  service.reviewContentArtifact(reviewerAdmin, reviewRequestId, `sha256:${"4".repeat(64)}`, {
    ...artifact,
    provenance: {
      ...artifact.provenance,
      humanReview: {
        reviewerId: reviewerAdmin.userId,
        reviewedAt: times.registration,
        decision: "approved",
        notesDigest: `sha256:${"4".repeat(64)}`,
      },
    },
  }),
  (error: unknown) => error instanceof ApiHttpError
    && error.code === "PREMIUM_CLIENT_REVIEW_AUTHORITY_FORBIDDEN",
  "browser-authored humanReview must never grant authority",
);
await assert.rejects(
  service.reviewContentArtifact(
    reviewerAdmin,
    "premium_review_request_v1_bad_gate_0123456789abcdef",
    `sha256:${"4".repeat(64)}`,
    {
      ...artifact,
      provenance: {
        ...artifact.provenance,
        gate: {
          ...artifact.provenance.gate,
          attestation: {
            ...artifact.provenance.gate.attestation,
            signature: `hmac-sha256:${"f".repeat(64)}`,
          },
        },
      },
    },
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_GATE_ATTESTATION_INVALID",
  "a forged trusted-CI signature must fail before receipt issuance",
);
await assert.rejects(
  service.reviewContentArtifact(
    reviewerAdmin,
    "premium_review_request_v1_wrong_subject_0123456789abcdef",
    `sha256:${"4".repeat(64)}`,
    {
      ...artifact,
      provenance: {
        ...artifact.provenance,
        gate: {
          ...artifact.provenance.gate,
          attestation: {
            ...artifact.provenance.gate.attestation,
            subjectDigest: `sha256:${"e".repeat(64)}`,
          },
        },
      },
    },
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_GATE_ATTESTATION_INVALID",
  "an attestation for another material subject must fail",
);
await assert.rejects(
  service.reviewContentArtifact(
    reviewerAdmin,
    "premium_review_request_v1_unknown_gate_key_0123456789abcdef",
    `sha256:${"4".repeat(64)}`,
    {
      ...artifact,
      provenance: {
        ...artifact.provenance,
        gate: {
          ...artifact.provenance.gate,
          attestation: { ...artifact.provenance.gate.attestation, keyId: "unknown-gate-key" },
        },
      },
    },
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "CONTENT_GATE_ATTESTATION_KEY_UNKNOWN",
);
const { attestation: _missingGateAttestation, ...gateWithoutAttestation } = artifact.provenance.gate;
await assert.rejects(
  service.reviewContentArtifact(
    reviewerAdmin,
    "premium_review_request_v1_missing_gate_0123456789abcdef",
    `sha256:${"4".repeat(64)}`,
    {
      ...artifact,
      provenance: { ...artifact.provenance, gate: gateWithoutAttestation as never },
    },
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_REVIEW_MATERIAL_INVALID",
);
await assert.rejects(
  service.reviewContentArtifact(actorA, reviewRequestId, `sha256:${"4".repeat(64)}`, artifact),
  (error: unknown) => error instanceof ApiHttpError && error.statusCode === 403,
);
await assert.rejects(
  service.reviewContentArtifact(reviewerAdmin, reviewRequestId, `sha256:${"4".repeat(64)}`, {
    ...artifact,
    content: { ...artifact.content, sections: [{ ...artifact.content.sections[0]!, evidenceRefs: ["invented"] }] },
  }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_CONTENT_EVIDENCE_INVALID",
);
const review = await service.reviewContentArtifact(
  reviewerAdmin,
  reviewRequestId,
  `sha256:${"4".repeat(64)}`,
  artifact,
);
const replayedReview = await service.reviewContentArtifact(
  { ...reviewerAdmin, sessionId: "session_reviewer_refreshed" },
  reviewRequestId,
  `sha256:${"4".repeat(64)}`,
  artifact,
);
assert.equal(replayedReview.reviewMode, "idempotent_replay");
assert.equal(replayedReview.receipt.receiptId, review.receipt.receiptId);
const postReviewRotationKeyring = assertPremiumAuditHmacKeyringV1({
  currentKeyId: "2026-09-review-rotation",
  keys: {
    ...rotatedAuditKeyring.keys,
    "2026-09-review-rotation": "premium-audit-review-rotation-key-0123456789",
  },
});
process.env.PREMIUM_AUDIT_HMAC_KEYRING_JSON = JSON.stringify(postReviewRotationKeyring);
const rotatedReviewReplay = await service.reviewContentArtifact(
  { ...reviewerAdmin, sessionId: "session_reviewer_after_key_rotation" },
  reviewRequestId,
  `sha256:${"4".repeat(64)}`,
  artifact,
);
assert.equal(rotatedReviewReplay.reviewMode, "idempotent_replay");
assert.equal(rotatedReviewReplay.receipt.receiptId, review.receipt.receiptId);
process.env.PREMIUM_AUDIT_HMAC_KEYRING_JSON = JSON.stringify(rotatedAuditKeyring);
await assert.rejects(
  service.reviewContentArtifact(
    reviewerAdmin,
    reviewRequestId,
    `sha256:${"9".repeat(64)}`,
    artifact,
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_REVIEW_IDEMPOTENCY_CONFLICT",
  "review request replay with changed notes must fail",
);
await assert.rejects(
  service.reviewContentArtifact(
    reviewerAdmin,
    "premium_review_request_v1_null_0123456789abcdef",
    `sha256:${"4".repeat(64)}`,
    null as never,
  ),
  (error: unknown) => error instanceof ApiHttpError && error.statusCode === 400,
  "malformed admin JSON must never become an internal 500",
);
await assert.rejects(
  service.reviewContentArtifact(
    reviewerAdmin,
    "premium_review_request_v1_numeric_nested_0123456789abcdef",
    `sha256:${"4".repeat(64)}`,
    {
      ...artifact,
      provenance: {
        ...artifact.provenance,
        model: { ...artifact.provenance.model, provider: 42 as never },
      },
    },
  ),
  (error: unknown) => error instanceof ApiHttpError && error.statusCode === 400,
  "nested primitive impostors must receive a stable 400 instead of throwing TypeError",
);
await assert.rejects(
  service.reviewContentArtifact(
    reviewerAdmin,
    "premium_review_request_v1_numeric_report_0123456789abcdef",
    `sha256:${"4".repeat(64)}`,
    { ...artifact, reportId: 7 as never },
  ),
  (error: unknown) => error instanceof ApiHttpError && error.statusCode === 400,
  "invalid report locators must fail before repository I/O",
);
await assert.rejects(
  service.reviewContentArtifact(
    reviewerAdmin,
    "premium_review_request_v1_unknown_nested_0123456789abcdef",
    `sha256:${"4".repeat(64)}`,
    {
      ...artifact,
      content: {
        ...artifact.content,
        sections: [{ ...artifact.content.sections[0]!, browserAuthority: true } as never],
      },
    },
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_REVIEW_MATERIAL_INVALID",
  "unknown activation-relevant nested fields must fail closed",
);
const expiringReview = await service.reviewContentArtifact(
  reviewerAdmin,
  "premium_review_request_v1_expiring_0123456789abcdef",
  `sha256:${"4".repeat(64)}`,
  artifact,
);
currentTime = "2026-07-26T10:00:00.000Z";
await assert.rejects(
  service.activateApprovedContent(
    admin,
    "premium_activation_request_v1_expired_0123456789abcdef",
    expiringReview.receipt.receiptId,
    artifact,
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_REVIEW_AUTHORITY_EXPIRED",
  "authorization must expire independently of asynchronous TTL cleanup",
);
currentTime = times.registration;
await assert.rejects(
  service.activateApprovedContent(
    reviewerAdmin,
    activationRequestId,
    review.receipt.receiptId,
    artifact,
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_INDEPENDENT_APPROVAL_REQUIRED",
);
await assert.rejects(
  service.activateApprovedContent(
    admin,
    activationRequestId,
    `premium_review_v1_${"m".repeat(43)}`,
    artifact,
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_REVIEW_RECEIPT_UNAVAILABLE",
);
const alteredArtifactDraft: PremiumContentArtifactRecordV1 = {
  ...artifact,
  content: { ...artifact.content, summary: `${artifact.content.summary} changed` },
};
const alteredSubject = premiumArtifactGateSubjectDigestV1(alteredArtifactDraft, first.report.binding);
const alteredArtifact: PremiumContentArtifactRecordV1 = {
  ...alteredArtifactDraft,
  provenance: {
    ...alteredArtifactDraft.provenance,
    gate: {
      ...alteredArtifactDraft.provenance.gate,
      attestation: signPremiumGate(alteredArtifactDraft.provenance, alteredSubject),
    },
  },
};
await assert.rejects(
  service.activateApprovedContent(
    admin,
    activationRequestId,
    review.receipt.receiptId,
    alteredArtifact,
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_REVIEW_BINDING_MISMATCH",
  "a valid gate for altered content still cannot replay an older human review",
);
const active = await service.activateApprovedContent(
  admin,
  activationRequestId,
  review.receipt.receiptId,
  artifact,
);
assert.equal(active.lifecycle, "active");
assert.equal(active.provenance.humanReview?.decision, "approved");
assert.equal(active.provenance.humanReview?.reviewerId, review.receipt.receiptId);
assert.equal(JSON.stringify(active).includes(reviewerAdmin.userId), false);
const activeReplay = await service.activateApprovedContent(
  admin,
  activationRequestId,
  review.receipt.receiptId,
  artifact,
);
assert.deepEqual(activeReplay, active, "exact activation retry must return the original immutable activation");
await assert.rejects(
  service.activateApprovedContent(
    admin,
    "premium_activation_request_v1_second_0123456789abcdef",
    review.receipt.receiptId,
    artifact,
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_REVIEW_RECEIPT_CONSUMED",
  "a consumed receipt must not authorize a second activation request",
);
const secondReviewForActiveArtifact = await service.reviewContentArtifact(
  reviewerAdmin,
  "premium_review_request_v1_already_active_0123456789abcdef",
  `sha256:${"4".repeat(64)}`,
  artifact,
);
await assert.rejects(
  service.activateApprovedContent(
    admin,
    "premium_activation_request_v1_already_active_0123456789abcdef",
    secondReviewForActiveArtifact.receipt.receiptId,
    artifact,
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_CONTENT_ALREADY_ACTIVE",
  "a second pending receipt must not falsely succeed against an existing pointer",
);

const checkoutRequest = {
  reportId: first.report.binding.reportId,
  productId: STORY_COMPLETION_PRODUCT_ID_V1,
  requestId: "premium_request_v1_checkout_0123456789abcdef",
  purchaseTermsAcceptance,
} as const;
const checkout = await service.createCheckout(actorA, checkoutRequest);
assert.equal(checkout.amount, 1_000);
assert.equal(repository.reports.get(first.report.binding.reportId)!.registration.owner.subjectId, stableOwnerBeforeAuditRotation.subjectId);
const checkoutAudit = repository.audits.find((entry) => entry.action === "payment.created" && entry.orderId === checkout.orderId)!;
assert.match(checkoutAudit.actor.userId, /^premium_audit_actor_v2:2026-08-current:[a-f0-9]{64}$/u);
assert.equal(premiumAuditSubjectMatchesV2("actor", actorA.userId, checkoutAudit.actor.userId, rotatedAuditKeyring), true);
assert.equal(JSON.stringify(checkoutAudit).includes(actorA.userId), false);
assert.equal((await service.createCheckout(actorA, checkoutRequest)).orderId, checkout.orderId);
await assert.rejects(
  service.createCheckout(actorA, {
    ...checkoutRequest,
    purchaseTermsAcceptance: {
      ...purchaseTermsAcceptance,
      clientAcceptedAt: "2026-07-18T09:59:59.000Z",
    },
  }),
  (error: unknown) => error instanceof ApiHttpError && error.statusCode === 409,
  "checkout replay must remain bound to the original purchase acceptance",
);
await assert.rejects(
  service.createCheckout(actorA, {
    ...checkoutRequest,
    purchaseTermsAcceptance: {
      ...purchaseTermsAcceptance,
      termsVersion: "premium-terms.stale.v1",
    },
  }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_PURCHASE_TERMS_REQUIRED",
);
await assert.rejects(
  service.createCheckout(actorB, { ...checkoutRequest, requestId: "premium_request_v1_checkout_other_0123456789abcdef" }),
  (error: unknown) => error instanceof ApiHttpError && error.statusCode === 403,
);

await assert.rejects(
  service.confirmPayment(actorA, {
    orderId: "not-an-order",
    paymentKey: "payment_key_0123456789",
    amount: 1_000,
    currency: "KRW",
  }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_PAYMENT_INVALID",
);
await assert.rejects(
  service.confirmPayment(actorA, {
    orderId: checkout.orderId,
    paymentKey: "bad key with spaces",
    amount: 1_000,
    currency: "KRW",
  }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_PAYMENT_INVALID",
);
assert.equal(toss.calls, 0, "invalid payment locators must fail before storage/provider I/O");

await assert.rejects(
  service.confirmPayment(actorA, { orderId: checkout.orderId, paymentKey: "payment_key_0123456789", amount: 999, currency: "KRW" }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_AMOUNT_MISMATCH",
);
assert.equal(toss.calls, 0, "server mismatch must be rejected before provider I/O");

repository.content.delete(bindingKey(first.report.binding));
await assert.rejects(
  service.confirmPayment(actorA, { orderId: checkout.orderId, paymentKey: "payment_key_0123456789", amount: 1_000, currency: "KRW" }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_CHECKOUT_STALE",
  "retired/replaced approved content must block before charging",
);
assert.equal(toss.calls, 0);
repository.content.set(bindingKey(first.report.binding), active);

currentTime = times.payment;
toss.next = {
  eventId: "toss_event_v1_payment",
  paymentKey: "wrong",
  orderId: checkout.orderId,
  status: "DONE",
  totalAmount: 1_000,
  balanceAmount: 1_000,
  currency: "KRW",
  occurredAt: times.payment,
  observedAt: times.payment,
};
await assert.rejects(
  service.confirmPayment(actorA, { orderId: checkout.orderId, paymentKey: "payment_key_0123456789", amount: 1_000, currency: "KRW" }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "TOSS_CONFIRMATION_MISMATCH",
);

toss.next = { ...toss.next, paymentKey: "payment_key_0123456789" };
const confirmed = await service.confirmPayment(actorA, {
  orderId: checkout.orderId, paymentKey: toss.next.paymentKey, amount: 1_000, currency: "KRW",
});
assert.equal(confirmed.entitlement.status, "active");
const serializedConfirmation = JSON.stringify(confirmed);
assert.equal(serializedConfirmation.includes(actorA.userId), false, "confirmation must not expose the internal user ID");
assert.equal(serializedConfirmation.includes(toss.next.paymentKey), false, "confirmation must not echo the payment key");
assert.equal(serializedConfirmation.includes("accountWriteSubjectId"), false);
assert.equal(serializedConfirmation.includes("providerState"), false);
assert.equal(serializedConfirmation.includes(stableOwnerBeforeAuditRotation.subjectId), false, "confirmation must not expose owner pseudonyms");
const providerCallsAfterPayment = toss.calls;
const confirmedReplay = await service.confirmPayment(actorA, {
  orderId: checkout.orderId, paymentKey: toss.next.paymentKey, amount: 1_000, currency: "KRW",
});
assert.equal(confirmedReplay.confirmationMode, "idempotent_replay");
assert.deepEqual(confirmedReplay.order, confirmed.order);
assert.equal(JSON.stringify(confirmedReplay).includes(toss.next.paymentKey), false);
assert.equal(toss.calls, providerCallsAfterPayment, "paid replay must not call Toss again");

const access: PremiumReportAccessRequestV1 = {
  schemaVersion: PREMIUM_REPORT_ACCESS_REQUEST_SCHEMA_V1,
  requestId: "premium_request_v1_delivery_0123456789abcdef",
  entitlementId: confirmed.entitlement.entitlementId,
  binding: first.report.binding,
};
await assert.rejects(
  service.deliverReport(actorB, access),
  (error: unknown) => error instanceof ApiHttpError && error.statusCode === 403,
);
currentTime = times.delivery;
const delivered = await service.deliverReport(actorA, access);
assert.equal(delivered.delivery.premiumContent.sections[0]!.body, artifact.content.sections[0]!.body);
currentTime = "2026-07-18T10:02:30.000Z";
const deliveredReplay = await service.deliverReport(actorA, access);
assert.equal(deliveredReplay.delivery.deliveryId, delivered.delivery.deliveryId);
assert.equal(deliveredReplay.delivery.deliveryMode, "idempotent_replay");
assert.equal(deliveredReplay.delivery.deliveredAt, delivered.delivery.deliveredAt);
assert.deepEqual(deliveredReplay.delivery.premiumContent, delivered.delivery.premiumContent);

currentTime = times.revoke;
const revoked = await service.revokeEntitlement(admin, { entitlementId: confirmed.entitlement.entitlementId, reason: "moderation decision" });
assert.equal(revoked.status, "revoked");
assert.equal(JSON.stringify(revoked).includes(first.report.binding.candidateId), false);
assert.equal(JSON.stringify(revoked).includes(first.report.binding.analysisId), false);
await assert.rejects(
  service.deliverReport(actorA, { ...access, requestId: "premium_request_v1_delivery_after_revoke_0123456789abcdef" }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "ENTITLEMENT_REVOKED",
);

currentTime = times.refund;
toss.next = {
  ...toss.next,
  eventId: "toss_event_v1_refund",
  status: "CANCELED",
  balanceAmount: 0,
  currency: "KRW",
  occurredAt: times.refund,
  observedAt: times.refund,
};
const refunded = await service.refundPayment(admin, { orderId: checkout.orderId, reason: "customer request" });
assert.equal(refunded.order.status, "refunded");
assert.equal(refunded.entitlement.status, "refunded");
for (const forbidden of [
  actorA.userId,
  stableOwnerBeforeAuditRotation.subjectId,
  toss.next.paymentKey,
  first.report.binding.candidateId,
  first.report.binding.analysisId,
  "providerState",
]) {
  assert.equal(JSON.stringify(refunded).includes(forbidden), false, `refund response leaked ${forbidden}`);
}

// A reviewed case/contentKey template is reusable. It is selected for another
// account and its stable source refs are rebound to that report's evidence IDs.
const second = await service.registerReport(
  actorB,
  {
    ...registration,
    requestId: "premium_request_v1_registration_second_0123456789abcdef",
    localAnalysisId: "analysis_v1_local_second_0123456789abcdef",
  },
  dataProcessingConsent,
);
const defaultSelector = analysis.contentSelector.keys.at(-1)!;
const reusableTemplateDraft: PremiumContentTemplateRecordV1 = {
  schemaVersion: "namespring.premium-content-template.v1",
  templateId: "premium_template_v1_0123456789abcdef",
  productId: STORY_COMPLETION_PRODUCT_ID_V1,
  contentVersion: first.report.binding.contentVersion,
  selectorKey: defaultSelector,
  lifecycle: "approved",
  provenance: artifact.provenance,
  placeholderAllowlist: ["displayName"],
  template: {
    kind: "story_completion",
    format: "structured_plain_text_v1",
    title: "{{displayName}}님의 검토된 이야기",
    summary: "검토된 공용 케이스 요약입니다.",
    sections: [{
      id: "reusable-section-1",
      title: "공용 검토 장",
      body: "{{displayName}}님의 서버 재계산 근거에 연결된 문장입니다.",
      evidenceSourceRefs: [analysis.evidence[0]!.sourceId],
    }],
  },
};
const templateSubjectDigest = premiumTemplateGateSubjectDigestV1(reusableTemplateDraft, first.report.binding);
const reusableTemplate: PremiumContentTemplateRecordV1 = {
  ...reusableTemplateDraft,
  provenance: {
    ...reusableTemplateDraft.provenance,
    gate: {
      ...reusableTemplateDraft.provenance.gate,
      attestation: signPremiumGate(reusableTemplateDraft.provenance, templateSubjectDigest),
    },
  },
};
const templateReview = await service.reviewContentTemplate(
  reviewerAdmin,
  first.report.binding.reportId,
  "premium_review_request_v1_template_0123456789abcdef",
  `sha256:${"5".repeat(64)}`,
  reusableTemplate,
);
await assert.rejects(
  service.activateApprovedTemplate(
    admin,
    first.report.binding.reportId,
    "premium_activation_request_v1_cross_resource_0123456789abcdef",
    review.receipt.receiptId,
    reusableTemplate,
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_REVIEW_BINDING_MISMATCH",
  "a report-artifact receipt must never authorize a reusable template",
);
await assert.rejects(
  service.activateApprovedTemplate(
    reviewerAdmin,
    first.report.binding.reportId,
    "premium_activation_request_v1_template_0123456789abcdef",
    templateReview.receipt.receiptId,
    reusableTemplate,
  ),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_INDEPENDENT_APPROVAL_REQUIRED",
);
const activeTemplate = await service.activateApprovedTemplate(
  admin,
  first.report.binding.reportId,
  "premium_activation_request_v1_template_0123456789abcdef",
  templateReview.receipt.receiptId,
  reusableTemplate,
);
assert.equal(activeTemplate.lifecycle, "active");
assert.deepEqual(await service.activateApprovedTemplate(
  admin,
  first.report.binding.reportId,
  "premium_activation_request_v1_template_0123456789abcdef",
  templateReview.receipt.receiptId,
  reusableTemplate,
), activeTemplate);
const analysisB = repository.analyses.get(second.report.binding.analysisId)!;
repository.analyses.set(analysisB.analysisId, { ...analysisB, evidence: [] });
await assert.rejects(
  service.createCheckout(actorB, {
    reportId: second.report.binding.reportId,
    productId: STORY_COMPLETION_PRODUCT_ID_V1,
    requestId: "premium_request_v1_template_preflight_0123456789abcdef",
    purchaseTermsAcceptance,
  }),
  (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_TEMPLATE_EVIDENCE_UNAVAILABLE",
);
repository.analyses.set(analysisB.analysisId, analysisB);
const checkoutB = await service.createCheckout(actorB, {
  reportId: second.report.binding.reportId,
  productId: STORY_COMPLETION_PRODUCT_ID_V1,
  requestId: "premium_request_v1_checkout_second_0123456789abcdef",
  purchaseTermsAcceptance,
});
assert.equal(repository.orders.get(checkoutB.orderId)!.contentActivation.sourceKind, "case_template");
toss.next = {
  eventId: "toss_event_v1_payment_second",
  paymentKey: "payment_key_second_0123456789",
  orderId: checkoutB.orderId,
  status: "DONE",
  totalAmount: 1_000,
  balanceAmount: 1_000,
  currency: "KRW",
  occurredAt: times.refund,
  observedAt: times.refund,
};
const confirmedB = await service.confirmPayment(actorB, {
  orderId: checkoutB.orderId,
  paymentKey: toss.next.paymentKey,
  amount: 1_000,
  currency: "KRW",
});
const accessB: PremiumReportAccessRequestV1 = {
  schemaVersion: PREMIUM_REPORT_ACCESS_REQUEST_SCHEMA_V1,
  requestId: "premium_request_v1_delivery_second_0123456789abcdef",
  entitlementId: confirmedB.entitlement.entitlementId,
  binding: second.report.binding,
};
const deliveryB = await service.deliverReport(actorB, accessB);
assert.match(deliveryB.delivery.premiumContent.title, /이영수/u);
assert.deepEqual(
  deliveryB.delivery.premiumContent.sections[0]!.evidenceRefs,
  [analysisB.evidence[0]!.evidenceId],
);
assert.notEqual(analysisB.evidence[0]!.evidenceId, analysis.evidence[0]!.evidenceId);

// A provider-side partial cancellation can never strand a positive balance:
// the service cancels the remainder and records a terminal refunded order,
// even when no local entitlement had been granted yet.
const third = await service.registerReport(
  actorC,
  {
    ...registration,
    requestId: "premium_request_v1_registration_third_0123456789abcdef",
    localAnalysisId: "analysis_v1_local_third_0123456789abcdef",
  },
  dataProcessingConsent,
);
const checkoutC = await service.createCheckout(actorC, {
  reportId: third.report.binding.reportId,
  productId: STORY_COMPLETION_PRODUCT_ID_V1,
  requestId: "premium_request_v1_checkout_third_0123456789abcdef",
  purchaseTermsAcceptance,
});
toss.next = {
  eventId: "toss_event_v1_partial_third",
  paymentKey: "payment_key_third_0123456789",
  orderId: checkoutC.orderId,
  status: "PARTIAL_CANCELED",
  totalAmount: 1_000,
  balanceAmount: 600,
  currency: "KRW",
  occurredAt: times.refund,
  observedAt: times.refund,
};
toss.cancelNext = {
  ...toss.next,
  eventId: "toss_event_v1_compensated_third",
  status: "CANCELED",
  balanceAmount: 0,
};
const compensatedC = await service.reconcilePayment(admin, {
  orderId: checkoutC.orderId,
  paymentKey: toss.next.paymentKey,
});
assert.equal(compensatedC.status, "refunded");
assert.equal(JSON.stringify(compensatedC).includes(toss.next.paymentKey), false);
assert.equal(JSON.stringify(compensatedC).includes(ownerFor(actorC).subjectId), false);
assert.equal(JSON.stringify(compensatedC).includes("providerState"), false);
assert.equal(JSON.stringify(compensatedC).includes(third.report.binding.candidateId), false);
assert.equal(JSON.stringify(compensatedC).includes(third.report.binding.analysisId), false);
assert.equal(repository.orders.get(checkoutC.orderId)!.providerState?.balanceAmount, 0);
toss.cancelNext = null;

await service.retireContent(admin, {
  reportId: first.report.binding.reportId,
  activation: {
    sourceKind: "case_template",
    resourceId: activeTemplate.templateId,
    activationId: activeTemplate.activation!.activationId,
    immutableContentDigest: activeTemplate.activation!.immutableContentDigest,
    selectorKey: activeTemplate.selectorKey,
  },
  reason: "stop new checkout without voiding settled purchases",
});
const replayAfterRetirement = await service.deliverReport(actorB, accessB);
assert.equal(replayAfterRetirement.delivery.deliveryId, deliveryB.delivery.deliveryId);
const purchasedAfterRetirement = await service.deliverReport(actorB, {
  ...accessB,
  requestId: "premium_request_v1_delivery_retired_pin_0123456789abcdef",
});
assert.deepEqual(purchasedAfterRetirement.delivery.premiumContent, deliveryB.delivery.premiumContent);

const portableB = await service.exportAccountData(actorB.userId);
assert.equal(portableB.orders.length, 1);
assert.equal("paymentKey" in portableB.orders[0]!, false);
assert.equal(portableB.deliveries.length, 2);
const deletionRequestId = "deletion_request_v1_0123456789abcdef0123456789abcdef";
const purgedB = await service.purgeAccountPersonalData(actorB.userId, deletionRequestId);
assert.equal(purgedB.mode, "initial");
assert.equal(repository.reports.has(second.report.binding.reportId), false);
assert.equal(repository.analyses.has(second.report.binding.analysisId), false);
assert.equal(repository.orders.has(checkoutB.orderId), false);
const purgeReplayB = await service.purgeAccountPersonalData(actorB.userId, deletionRequestId);
assert.equal(purgeReplayB.mode, "idempotent_replay");
assert.equal(purgeReplayB.deletedResources, purgedB.deletedResources);

console.log("premium-service-v1: PASS");
