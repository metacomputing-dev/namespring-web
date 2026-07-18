import type { PremiumProductIdV1, PremiumReportBindingV1 } from "../../../lib/spring-ts/src/report/premium/index.js";
import type {
  PremiumActorV1,
  PremiumContentArtifactRecordV1,
  PremiumContentTemplateRecordV1,
} from "../../shared/types/premium-service.js";
import { ApiHttpError } from "./http.js";
import { premiumContentDigestV1 } from "./premium-content-policy.js";
import { premiumDocumentKey } from "./premium-ids.js";

export const PREMIUM_CONTENT_REVIEW_RECEIPT_SCHEMA_V1 = "namespring.premium-content-review-receipt.v1" as const;
export const PREMIUM_CONTENT_REVIEW_RETENTION_DAYS_V1 = 365 as const;
export const PREMIUM_CONTENT_REVIEW_AUTHORITY_DAYS_V1 = 7 as const;

export type PremiumReviewResourceKindV1 = "report_artifact" | "case_template";

export interface PremiumContentReviewReceiptV1 {
  readonly schemaVersion: typeof PREMIUM_CONTENT_REVIEW_RECEIPT_SCHEMA_V1;
  readonly receiptId: string;
  readonly requestId: string;
  readonly resourceKind: PremiumReviewResourceKindV1;
  readonly resourceId: string;
  /** The exact report used to bind evidence and selector validation. */
  readonly reportId: string;
  readonly analysisId: string;
  readonly productId: PremiumProductIdV1;
  readonly contentVersion: string;
  readonly selectorKey: string | null;
  readonly reviewedMaterialDigest: `sha256:${string}`;
  readonly notesDigest: `sha256:${string}`;
  readonly decision: "approved";
  /** Rotation-aware premium-audit HMAC subject; never a raw account/session ID. */
  readonly reviewer: {
    readonly actorSubject: string;
  };
  readonly reviewedAt: string;
  /** Explicit authority boundary; Firestore TTL is cleanup, never authorization. */
  readonly authorityExpiresAt: string;
  readonly status: "pending" | "consumed";
  readonly consumption: null | {
    readonly activationId: string;
    readonly activationRequestId: string;
    /** Rotation-aware premium-audit HMAC subject. */
    readonly activatedBy: string;
    readonly activatedAt: string;
    readonly immutableContentDigest: `sha256:${string}`;
  };
  readonly deleteAfter: string;
}

export interface PremiumContentReviewReceiptViewV1 {
  readonly schemaVersion: "namespring.premium-content-review-receipt-view.v1";
  readonly receiptId: string;
  readonly resourceKind: PremiumReviewResourceKindV1;
  readonly resourceId: string;
  readonly reportId: string;
  readonly productId: PremiumProductIdV1;
  readonly contentVersion: string;
  readonly selectorKey: string | null;
  readonly reviewedMaterialDigest: `sha256:${string}`;
  readonly reviewedAt: string;
  readonly status: "pending" | "consumed";
}

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const RECEIPT_ID_PATTERN = /^premium_review_v1_[A-Za-z0-9_-]{43}$/u;
const REQUEST_ID_PATTERN = /^premium_review_request_v1_[A-Za-z0-9_-]{16,128}$/u;
const RESOURCE_ID_PATTERN = /^(?:premium_artifact|premium_template)_v1_[A-Za-z0-9_-]{16,128}$/u;
const REPORT_ID_PATTERN = /^report_v1_[A-Za-z0-9_-]{16,128}$/u;
const ANALYSIS_ID_PATTERN = /^server_analysis_v1_[A-Za-z0-9_-]{16,128}$/u;
const ACTIVATION_ID_PATTERN = /^premium_activation_v1_[A-Za-z0-9_-]{16,128}$/u;
const AUDIT_ACTOR_PATTERN = /^premium_audit_actor_v2:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[a-f0-9]{64}$/u;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], code = "PREMIUM_REVIEW_RECEIPT_CORRUPT"): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new ApiHttpError(503, code, "Premium review record has an invalid shape.");
  }
}

function canonicalUtc(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function premiumReviewReceiptIdV1(actor: PremiumActorV1, requestId: string): string {
  if (!UUID_V4_PATTERN.test(actor.userId) || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_REQUEST_INVALID", "Premium review identity or request ID is invalid.");
  }
  return `premium_review_v1_${premiumDocumentKey("premium-content-review-v1", actor.userId, requestId).slice(0, 43)}`;
}

export function premiumReviewDeleteAfterV1(reviewedAt: string): string {
  if (!canonicalUtc(reviewedAt)) {
    throw new ApiHttpError(500, "PREMIUM_REVIEW_TIME_INVALID", "Premium review time is invalid.");
  }
  return new Date(Date.parse(reviewedAt) + PREMIUM_CONTENT_REVIEW_RETENTION_DAYS_V1 * 86_400_000).toISOString();
}

export function premiumReviewAuthorityExpiresAtV1(reviewedAt: string): string {
  if (!canonicalUtc(reviewedAt)) {
    throw new ApiHttpError(500, "PREMIUM_REVIEW_TIME_INVALID", "Premium review time is invalid.");
  }
  return new Date(Date.parse(reviewedAt) + PREMIUM_CONTENT_REVIEW_AUTHORITY_DAYS_V1 * 86_400_000).toISOString();
}

export function premiumActivationIdV1(
  actor: PremiumActorV1,
  receiptId: string,
  activationRequestId: string,
): string {
  if (!UUID_V4_PATTERN.test(actor.userId) || !RECEIPT_ID_PATTERN.test(receiptId)
    || !/^premium_activation_request_v1_[A-Za-z0-9_-]{16,128}$/u.test(activationRequestId)) {
    throw new ApiHttpError(400, "PREMIUM_ACTIVATION_REQUEST_INVALID", "Premium activation request is invalid.");
  }
  return `premium_activation_v1_${premiumDocumentKey(
    "premium-content-activation-v1", actor.userId, receiptId, activationRequestId,
  ).slice(0, 43)}`;
}

export function assertPremiumActivationRequestIdV1(value: unknown): string {
  if (typeof value !== "string" || !/^premium_activation_request_v1_[A-Za-z0-9_-]{16,128}$/u.test(value)) {
    throw new ApiHttpError(400, "PREMIUM_ACTIVATION_REQUEST_INVALID", "Activation request ID is invalid.");
  }
  return value;
}

function provenanceWithoutHumanReview(
  provenance: PremiumContentArtifactRecordV1["provenance"],
): Omit<PremiumContentArtifactRecordV1["provenance"], "humanReview"> {
  return {
    sourceDigest: provenance.sourceDigest,
    model: provenance.model,
    prompt: provenance.prompt,
    gate: provenance.gate,
  };
}

function provenanceForGateSubject(
  provenance: PremiumContentArtifactRecordV1["provenance"],
) {
  return {
    sourceDigest: provenance.sourceDigest,
    model: provenance.model,
    prompt: provenance.prompt,
    gate: {
      gateVersion: provenance.gate.gateVersion,
      status: provenance.gate.status,
      evaluatedAt: provenance.gate.evaluatedAt,
      resultDigest: provenance.gate.resultDigest,
    },
  };
}

export function premiumArtifactGateSubjectDigestV1(
  artifact: PremiumContentArtifactRecordV1,
  binding: PremiumReportBindingV1,
): `sha256:${string}` {
  return premiumContentDigestV1({
    contract: "namespring.premium-gate-subject.v1",
    resourceKind: "report_artifact",
    resource: {
      schemaVersion: artifact.schemaVersion,
      artifactId: artifact.artifactId,
      reportId: artifact.reportId,
      productId: artifact.productId,
      contentVersion: artifact.contentVersion,
      provenance: provenanceForGateSubject(artifact.provenance),
      content: artifact.content,
    },
    reportBinding: binding,
  });
}

export function premiumTemplateGateSubjectDigestV1(
  template: PremiumContentTemplateRecordV1,
  sampleBinding: PremiumReportBindingV1,
): `sha256:${string}` {
  return premiumContentDigestV1({
    contract: "namespring.premium-gate-subject.v1",
    resourceKind: "case_template",
    resource: {
      schemaVersion: template.schemaVersion,
      templateId: template.templateId,
      productId: template.productId,
      contentVersion: template.contentVersion,
      selectorKey: template.selectorKey,
      provenance: provenanceForGateSubject(template.provenance),
      placeholderAllowlist: template.placeholderAllowlist,
      template: template.template,
    },
    sampleReportBinding: sampleBinding,
  });
}

/** Digest every field that can affect report-artifact activation or delivery. */
export function premiumArtifactReviewedMaterialDigestV1(
  artifact: PremiumContentArtifactRecordV1,
  binding: PremiumReportBindingV1,
): `sha256:${string}` {
  return premiumContentDigestV1({
    contract: "namespring.premium-reviewed-material.v1",
    resourceKind: "report_artifact",
    resource: {
      schemaVersion: artifact.schemaVersion,
      artifactId: artifact.artifactId,
      reportId: artifact.reportId,
      productId: artifact.productId,
      contentVersion: artifact.contentVersion,
      provenance: provenanceWithoutHumanReview(artifact.provenance),
      content: artifact.content,
    },
    reportBinding: binding,
  });
}

/** Digest every field that can affect reusable-template selection or delivery. */
export function premiumTemplateReviewedMaterialDigestV1(
  template: PremiumContentTemplateRecordV1,
  sampleBinding: PremiumReportBindingV1,
): `sha256:${string}` {
  return premiumContentDigestV1({
    contract: "namespring.premium-reviewed-material.v1",
    resourceKind: "case_template",
    resource: {
      schemaVersion: template.schemaVersion,
      templateId: template.templateId,
      productId: template.productId,
      contentVersion: template.contentVersion,
      selectorKey: template.selectorKey,
      provenance: provenanceWithoutHumanReview(template.provenance),
      placeholderAllowlist: template.placeholderAllowlist,
      template: template.template,
    },
    sampleReportBinding: sampleBinding,
  });
}

export function premiumReviewReceiptViewV1(
  receipt: PremiumContentReviewReceiptV1,
): PremiumContentReviewReceiptViewV1 {
  return {
    schemaVersion: "namespring.premium-content-review-receipt-view.v1",
    receiptId: receipt.receiptId,
    resourceKind: receipt.resourceKind,
    resourceId: receipt.resourceId,
    reportId: receipt.reportId,
    productId: receipt.productId,
    contentVersion: receipt.contentVersion,
    selectorKey: receipt.selectorKey,
    reviewedMaterialDigest: receipt.reviewedMaterialDigest,
    reviewedAt: receipt.reviewedAt,
    status: receipt.status,
  };
}

/** Strict fail-closed codec for the decrypted Firestore review envelope. */
export function assertPremiumContentReviewReceiptV1(value: unknown): PremiumContentReviewReceiptV1 {
  if (!isPlainRecord(value)) {
    throw new ApiHttpError(503, "PREMIUM_REVIEW_RECEIPT_CORRUPT", "Premium review record is unavailable.");
  }
  exactKeys(value, [
    "schemaVersion", "receiptId", "requestId", "resourceKind", "resourceId", "reportId", "analysisId",
    "productId", "contentVersion", "selectorKey", "reviewedMaterialDigest", "notesDigest", "decision",
    "reviewer", "reviewedAt", "authorityExpiresAt", "status", "consumption", "deleteAfter",
  ]);
  if (value.schemaVersion !== PREMIUM_CONTENT_REVIEW_RECEIPT_SCHEMA_V1
    || typeof value.receiptId !== "string" || !RECEIPT_ID_PATTERN.test(value.receiptId)
    || typeof value.requestId !== "string" || !REQUEST_ID_PATTERN.test(value.requestId)
    || (value.resourceKind !== "report_artifact" && value.resourceKind !== "case_template")
    || typeof value.resourceId !== "string" || !RESOURCE_ID_PATTERN.test(value.resourceId)
    || typeof value.reportId !== "string" || !REPORT_ID_PATTERN.test(value.reportId)
    || typeof value.analysisId !== "string" || !ANALYSIS_ID_PATTERN.test(value.analysisId)
    || value.productId !== "report.story-completion.v1"
    || typeof value.contentVersion !== "string" || !value.contentVersion.trim() || value.contentVersion.length > 160
    || (value.selectorKey !== null && (typeof value.selectorKey !== "string" || !value.selectorKey.trim() || value.selectorKey.length > 512))
    || typeof value.reviewedMaterialDigest !== "string" || !SHA256_PATTERN.test(value.reviewedMaterialDigest)
    || typeof value.notesDigest !== "string" || !SHA256_PATTERN.test(value.notesDigest)
    || value.decision !== "approved"
    || !canonicalUtc(value.reviewedAt) || !canonicalUtc(value.authorityExpiresAt) || !canonicalUtc(value.deleteAfter)
    || (value.status !== "pending" && value.status !== "consumed")) {
    throw new ApiHttpError(503, "PREMIUM_REVIEW_RECEIPT_CORRUPT", "Premium review record is inconsistent.");
  }
  if ((value.resourceKind === "report_artifact" && value.selectorKey !== null)
    || (value.resourceKind === "case_template" && value.selectorKey === null)) {
    throw new ApiHttpError(503, "PREMIUM_REVIEW_RECEIPT_CORRUPT", "Premium review resource binding is inconsistent.");
  }
  if (!(Date.parse(value.reviewedAt) < Date.parse(value.authorityExpiresAt)
    && Date.parse(value.authorityExpiresAt) <= Date.parse(value.deleteAfter))) {
    throw new ApiHttpError(503, "PREMIUM_REVIEW_RECEIPT_CORRUPT", "Premium review authority chronology is inconsistent.");
  }
  if (!isPlainRecord(value.reviewer)) {
    throw new ApiHttpError(503, "PREMIUM_REVIEW_RECEIPT_CORRUPT", "Premium review principal is unavailable.");
  }
  exactKeys(value.reviewer, ["actorSubject"]);
  if (typeof value.reviewer.actorSubject !== "string" || !AUDIT_ACTOR_PATTERN.test(value.reviewer.actorSubject)) {
    throw new ApiHttpError(503, "PREMIUM_REVIEW_RECEIPT_CORRUPT", "Premium review principal is inconsistent.");
  }
  if (value.status === "pending" && value.consumption !== null) {
    throw new ApiHttpError(503, "PREMIUM_REVIEW_RECEIPT_CORRUPT", "Pending review receipt cannot have consumption data.");
  }
  if (value.status === "consumed") {
    if (!isPlainRecord(value.consumption)) {
      throw new ApiHttpError(503, "PREMIUM_REVIEW_RECEIPT_CORRUPT", "Consumed review receipt is incomplete.");
    }
    exactKeys(value.consumption, [
      "activationId", "activationRequestId", "activatedBy", "activatedAt", "immutableContentDigest",
    ]);
    if (typeof value.consumption.activationId !== "string" || !ACTIVATION_ID_PATTERN.test(value.consumption.activationId)
      || typeof value.consumption.activationRequestId !== "string"
      || !/^premium_activation_request_v1_[A-Za-z0-9_-]{16,128}$/u.test(value.consumption.activationRequestId)
      || typeof value.consumption.activatedBy !== "string" || !AUDIT_ACTOR_PATTERN.test(value.consumption.activatedBy)
      || !canonicalUtc(value.consumption.activatedAt)
      || typeof value.consumption.immutableContentDigest !== "string"
      || !SHA256_PATTERN.test(value.consumption.immutableContentDigest)) {
      throw new ApiHttpError(503, "PREMIUM_REVIEW_RECEIPT_CORRUPT", "Review consumption data is inconsistent.");
    }
    if (Date.parse(value.consumption.activatedAt) < Date.parse(value.reviewedAt)
      || Date.parse(value.consumption.activatedAt) >= Date.parse(value.authorityExpiresAt)) {
      throw new ApiHttpError(503, "PREMIUM_REVIEW_RECEIPT_CORRUPT", "Review activation is outside its authority window.");
    }
  }
  return value as unknown as PremiumContentReviewReceiptV1;
}

export function assertPremiumReviewReceiptReferenceV1(value: unknown): string {
  if (typeof value !== "string" || !RECEIPT_ID_PATTERN.test(value)) {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_RECEIPT_INVALID", "Review receipt reference is invalid.");
  }
  return value;
}

export function assertPremiumReviewRequestIdV1(value: unknown): string {
  if (typeof value !== "string" || !REQUEST_ID_PATTERN.test(value)) {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_REQUEST_INVALID", "Review request ID is invalid.");
  }
  return value;
}

export function assertPremiumReviewNotesDigestV1(value: unknown): `sha256:${string}` {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_NOTES_DIGEST_INVALID", "Review notes digest is invalid.");
  }
  return value as `sha256:${string}`;
}
