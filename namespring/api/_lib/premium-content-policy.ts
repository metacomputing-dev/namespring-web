import { createHash } from "node:crypto";
import type {
  PremiumReportRegistrationRequestV1,
} from "../../../lib/spring-ts/src/report/premium/index.js";
import type { SpringEngine } from "../../../lib/spring-ts/src/spring-engine.js";
import {
  PREMIUM_CONTENT_RECORD_SCHEMA_V1,
  type PremiumContentArtifactRecordV1,
  type PremiumContentActivationBindingV1,
  type PremiumContentSelectorV1,
  type PremiumContentTemplateRecordV1,
  type PremiumContentProvenanceV1,
  type PremiumServerAnalysisRecordV1,
  type PremiumTemplatePlaceholderV1,
} from "../../shared/types/premium-service.js";
import { ApiHttpError } from "./http.js";
import { openPremiumAnalysisDeliveryV1 } from "./premium-crypto.js";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(",")}}`;
  }
  throw new ApiHttpError(400, "PREMIUM_CONTENT_INVALID", "Content must be canonical JSON data.");
}

export function premiumContentDigestV1(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

function assertIsoTimestamp(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))
    || new Date(Date.parse(value)).toISOString() !== value) {
    throw new ApiHttpError(400, "PREMIUM_CONTENT_INVALID", `${label} must be a canonical UTC timestamp.`);
  }
}

function assertSha256(value: unknown, label: string): asserts value is `sha256:${string}` {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
    throw new ApiHttpError(400, "PREMIUM_CONTENT_INVALID", `${label} must be a SHA-256 digest.`);
  }
}

function assertSafePlainText(value: unknown, label: string, maxBytes: number): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()
    || Buffer.byteLength(value, "utf8") > maxBytes
    || /[\u0000-\u0009\u000b-\u001f\u007f]/u.test(value)
    || /[<>]/u.test(value)) {
    throw new ApiHttpError(400, "PREMIUM_CONTENT_TEXT_INVALID", `${label} must be bounded safe plain text.`);
  }
}

function assertExactPlainKeys(value: unknown, expected: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", `${label} must be a plain object.`);
  }
  const actual = Object.keys(value as Record<string, unknown>).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", `${label} contains missing or unknown fields.`);
  }
}

function assertExactReviewProvenance(provenance: PremiumContentProvenanceV1): void {
  assertExactPlainKeys(provenance, ["sourceDigest", "model", "prompt", "gate"], "provenance");
  assertExactPlainKeys(provenance.model, ["provider", "modelId", "generatedAt"], "provenance.model");
  assertExactPlainKeys(provenance.prompt, ["promptId", "promptVersion", "promptDigest"], "provenance.prompt");
  assertExactPlainKeys(
    provenance.gate,
    ["gateVersion", "status", "evaluatedAt", "resultDigest", "attestation"],
    "provenance.gate",
  );
  assertExactPlainKeys(
    provenance.gate.attestation,
    ["scheme", "keyId", "subjectDigest", "signature"],
    "provenance.gate.attestation",
  );
  if (typeof provenance.sourceDigest !== "string"
    || typeof provenance.model.provider !== "string" || typeof provenance.model.modelId !== "string"
    || typeof provenance.model.generatedAt !== "string"
    || typeof provenance.prompt.promptId !== "string" || typeof provenance.prompt.promptVersion !== "string"
    || typeof provenance.prompt.promptDigest !== "string"
    || typeof provenance.gate.gateVersion !== "string" || typeof provenance.gate.evaluatedAt !== "string"
    || typeof provenance.gate.resultDigest !== "string"
    || typeof provenance.gate.attestation.scheme !== "string"
    || typeof provenance.gate.attestation.keyId !== "string"
    || typeof provenance.gate.attestation.subjectDigest !== "string"
    || typeof provenance.gate.attestation.signature !== "string") {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "provenance fields have invalid types.");
  }
}

function assertExactArtifactReviewMaterial(input: PremiumContentArtifactRecordV1): void {
  assertExactPlainKeys(input, [
    "schemaVersion", "artifactId", "reportId", "productId", "contentVersion", "lifecycle", "provenance", "content",
  ], "artifact");
  if (typeof input.artifactId !== "string" || typeof input.reportId !== "string"
    || typeof input.productId !== "string" || typeof input.contentVersion !== "string"
    || typeof input.lifecycle !== "string") {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "artifact identity fields have invalid types.");
  }
  assertExactReviewProvenance(input.provenance);
  assertExactPlainKeys(input.content, ["kind", "format", "title", "summary", "sections"], "content");
  if (typeof input.content.kind !== "string" || typeof input.content.format !== "string"
    || typeof input.content.title !== "string" || typeof input.content.summary !== "string") {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "content fields have invalid types.");
  }
  if (!Array.isArray(input.content.sections)) {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "content.sections must be an array.");
  }
  for (const section of input.content.sections) {
    assertExactPlainKeys(section, ["id", "title", "body", "evidenceRefs"], "content.sections[]");
    if (typeof section.id !== "string" || typeof section.title !== "string" || typeof section.body !== "string"
      || !Array.isArray(section.evidenceRefs) || section.evidenceRefs.some((ref) => typeof ref !== "string")) {
      throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "content section fields have invalid types.");
    }
  }
}

function assertExactTemplateReviewMaterial(input: PremiumContentTemplateRecordV1): void {
  assertExactPlainKeys(input, [
    "schemaVersion", "templateId", "productId", "contentVersion", "selectorKey", "lifecycle", "provenance",
    "placeholderAllowlist", "template",
  ], "template record");
  if (typeof input.templateId !== "string" || typeof input.productId !== "string"
    || typeof input.contentVersion !== "string" || typeof input.selectorKey !== "string"
    || typeof input.lifecycle !== "string" || !Array.isArray(input.placeholderAllowlist)
    || input.placeholderAllowlist.some((placeholder) => typeof placeholder !== "string")) {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "template identity fields have invalid types.");
  }
  assertExactReviewProvenance(input.provenance);
  assertExactPlainKeys(input.template, ["kind", "format", "title", "summary", "sections"], "template");
  if (typeof input.template.kind !== "string" || typeof input.template.format !== "string"
    || typeof input.template.title !== "string" || typeof input.template.summary !== "string") {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "template fields have invalid types.");
  }
  if (!Array.isArray(input.template.sections)) {
    throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "template.sections must be an array.");
  }
  for (const section of input.template.sections) {
    assertExactPlainKeys(section, ["id", "title", "body", "evidenceSourceRefs"], "template.sections[]");
    if (typeof section.id !== "string" || typeof section.title !== "string" || typeof section.body !== "string"
      || !Array.isArray(section.evidenceSourceRefs)
      || section.evidenceSourceRefs.some((ref) => typeof ref !== "string")) {
      throw new ApiHttpError(400, "PREMIUM_REVIEW_MATERIAL_INVALID", "template section fields have invalid types.");
    }
  }
}

export function assertPremiumArtifactReviewCandidateShapeV1(input: PremiumContentArtifactRecordV1): void {
  const untrusted = input as unknown as Record<string, unknown>;
  const provenance = untrusted.provenance;
  const hasHumanReview = Boolean(provenance && typeof provenance === "object" && !Array.isArray(provenance)
    && Object.hasOwn(provenance as object, "humanReview"));
  if (hasHumanReview || untrusted.activation !== undefined) {
    throw new ApiHttpError(
      400,
      "PREMIUM_CLIENT_REVIEW_AUTHORITY_FORBIDDEN",
      "Browser-supplied human review or activation authority is forbidden.",
    );
  }
  assertExactArtifactReviewMaterial(input);
}

export function assertPremiumTemplateReviewCandidateShapeV1(input: PremiumContentTemplateRecordV1): void {
  const untrusted = input as unknown as Record<string, unknown>;
  const provenance = untrusted.provenance;
  const hasHumanReview = Boolean(provenance && typeof provenance === "object" && !Array.isArray(provenance)
    && Object.hasOwn(provenance as object, "humanReview"));
  if (hasHumanReview || untrusted.activation !== undefined) {
    throw new ApiHttpError(
      400,
      "PREMIUM_CLIENT_REVIEW_AUTHORITY_FORBIDDEN",
      "Browser-supplied human review or activation authority is forbidden.",
    );
  }
  assertExactTemplateReviewMaterial(input);
}

function assertApprovedProvenance(provenance: PremiumContentProvenanceV1): void {
  if (!provenance || typeof provenance !== "object") {
    throw new ApiHttpError(400, "PREMIUM_CONTENT_INVALID", "Content provenance is required.");
  }
  assertSha256(provenance.sourceDigest, "sourceDigest");
  assertSha256(provenance.prompt?.promptDigest, "promptDigest");
  assertSha256(provenance.gate?.resultDigest, "gate resultDigest");
  assertIsoTimestamp(provenance.model?.generatedAt, "model.generatedAt");
  assertIsoTimestamp(provenance.gate?.evaluatedAt, "gate.evaluatedAt");
  if (!provenance.model.provider?.trim() || !provenance.model.modelId?.trim()
    || !provenance.prompt.promptId?.trim() || !provenance.prompt.promptVersion?.trim()
    || !provenance.gate.gateVersion?.trim() || provenance.gate.status !== "passed"
    || provenance.gate.attestation?.scheme !== "HMAC-SHA256-V1"
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(provenance.gate.attestation.keyId ?? "")
    || !/^sha256:[a-f0-9]{64}$/u.test(provenance.gate.attestation.subjectDigest ?? "")
    || !/^hmac-sha256:[a-f0-9]{64}$/u.test(provenance.gate.attestation.signature ?? "")
    || !provenance.humanReview || provenance.humanReview.decision !== "approved"
    || !provenance.humanReview.reviewerId?.trim()) {
    throw new ApiHttpError(409, "PREMIUM_CONTENT_NOT_APPROVED", "Gate-passed human approval is required.");
  }
  assertIsoTimestamp(provenance.humanReview.reviewedAt, "humanReview.reviewedAt");
  assertSha256(provenance.humanReview.notesDigest, "humanReview.notesDigest");
}

function assertApprovalChronology(provenance: PremiumContentProvenanceV1, activatedAt: string): void {
  const generated = Date.parse(provenance.model.generatedAt);
  const gated = Date.parse(provenance.gate.evaluatedAt);
  const reviewed = Date.parse(provenance.humanReview!.reviewedAt);
  const activated = Date.parse(activatedAt);
  if (!(generated <= gated && gated <= reviewed && reviewed <= activated)) {
    throw new ApiHttpError(409, "PREMIUM_APPROVAL_CHRONOLOGY_INVALID", "Generation, gate, review, and activation times are out of order.");
  }
}

export function validateApprovedPremiumArtifactV1(
  input: PremiumContentArtifactRecordV1,
  analysis: PremiumServerAnalysisRecordV1,
): void {
  if (!input || typeof input !== "object" || input.schemaVersion !== PREMIUM_CONTENT_RECORD_SCHEMA_V1
    || !/^premium_artifact_v1_[A-Za-z0-9_-]{16,128}$/u.test(input.artifactId)
    || input.lifecycle !== "approved" || input.activation !== undefined
    || input.reportId !== analysis.reportId) {
    throw new ApiHttpError(400, "PREMIUM_CONTENT_INVALID", "Approved content artifact shape/binding is invalid.");
  }
  if (!input.content || input.content.kind !== "story_completion"
    || input.content.format !== "structured_plain_text_v1"
    || !input.content.title?.trim() || !input.content.summary?.trim()
    || !Array.isArray(input.content.sections) || input.content.sections.length < 1 || input.content.sections.length > 32) {
    throw new ApiHttpError(400, "PREMIUM_CONTENT_INVALID", "Structured premium content is incomplete.");
  }
  assertApprovedProvenance(input.provenance);
  assertSafePlainText(input.content.title, "content.title", 480);
  assertSafePlainText(input.content.summary, "content.summary", 4_000);
  const allowed = new Set(analysis.evidence.map((entry) => entry.evidenceId));
  const sectionIds = new Set<string>();
  for (const section of input.content.sections) {
    if (!section?.id?.trim() || sectionIds.has(section.id) || !section.title?.trim() || !section.body?.trim()
      || !Array.isArray(section.evidenceRefs) || section.evidenceRefs.length < 1) {
      throw new ApiHttpError(400, "PREMIUM_CONTENT_INVALID", "Every section requires unique identity, prose, and evidence.");
    }
    assertSafePlainText(section.title, "content.sections[].title", 480);
    assertSafePlainText(section.body, "content.sections[].body", 24_000);
    sectionIds.add(section.id);
    const refs = new Set<string>();
    for (const ref of section.evidenceRefs) {
      if (!allowed.has(ref) || refs.has(ref)) {
        throw new ApiHttpError(409, "PREMIUM_CONTENT_EVIDENCE_INVALID", "Content contains missing or duplicate evidence references.");
      }
      refs.add(ref);
    }
  }
}

/**
 * Review candidates may contain gate evidence, but never browser-asserted human
 * authority. The server creates humanReview only from a sealed review receipt.
 */
export function validatePremiumArtifactReviewCandidateV1(
  input: PremiumContentArtifactRecordV1,
  analysis: PremiumServerAnalysisRecordV1,
): void {
  assertPremiumArtifactReviewCandidateShapeV1(input);
  validateApprovedPremiumArtifactV1({
    ...input,
    provenance: {
      ...input.provenance,
      humanReview: {
        reviewerId: "server_review_validation_placeholder",
        reviewedAt: input.provenance.gate.evaluatedAt,
        decision: "approved",
        notesDigest: `sha256:${"0".repeat(64)}`,
      },
    },
  }, analysis);
}

export function classifyPremiumAgeAxisV1(
  birth: PremiumReportRegistrationRequestV1["analysisInput"]["birth"],
  targetDate: string,
) {
  // Lunar month/day cannot be compared with a Gregorian target date until the
  // delivery contract exposes the engine's canonical solar conversion.
  if (birth.calendarType === "lunar") return "unknown" as const;
  const [year, month, day] = targetDate.split("-").map(Number);
  const birthYear = Number(birth.year);
  const birthMonth = Number(birth.month);
  const birthDay = Number(birth.day);
  let age = Number(year) - birthYear;
  if (Number(month) < birthMonth || (Number(month) === birthMonth && Number(day) < birthDay)) age -= 1;
  if (age < 14) return "child" as const;
  if (age < 20) return "youth" as const;
  if (age < 65) return "adult" as const;
  return "senior" as const;
}

export function classifyPremiumGyeokAxisV1(input: {
  readonly categoryCode?: string;
  readonly baseTenGodCode?: string | null;
}): PremiumContentSelectorV1["axes"]["gyeok"] {
  if (input.categoryCode === "JONGGYEOK") return "special";
  const code = input.baseTenGodCode?.toUpperCase();
  if (!code) return "unknown";
  if (["BI_GYEON", "GYEOB_JAE", "GEOB_JAE"].includes(code)) return "bigeop";
  if (["JEONG_IN", "PYEON_IN"].includes(code)) return "insung";
  if (["JEONG_GWAN", "PYEON_GWAN", "CHIL_SAL"].includes(code)) return "gwanseong";
  if (["JEONG_JAE", "PYEON_JAE"].includes(code)) return "jaeseong";
  if (["SIK_SIN", "SIK_SHIN", "SANG_GWAN"].includes(code)) return "siksang";
  return "unknown";
}

export function classifyPremiumStrengthAxisV1(
  levelCode: "STRONG" | "BALANCED" | "WEAK" | "UNKNOWN" | undefined,
): PremiumContentSelectorV1["axes"]["strength"] {
  return levelCode ? levelCode.toLowerCase() as PremiumContentSelectorV1["axes"]["strength"] : "unknown";
}

export function classifyPremiumBandAxisV1(stars: number | undefined): PremiumContentSelectorV1["axes"]["band"] {
  if (!Number.isFinite(stars) || stars! < 1 || stars! > 5) return "unknown";
  if (stars! >= 4) return "high";
  if (stars! >= 3) return "mid";
  return "low";
}

export function buildPremiumContentSelectorV1(
  request: PremiumReportRegistrationRequestV1,
  delivery: Awaited<ReturnType<SpringEngine["getReportDelivery"]>>,
  contentVersion: string,
): PremiumContentSelectorV1 {
  const strengthFact = delivery.facts.find((fact) => fact.kind === "strength");
  const strength = classifyPremiumStrengthAxisV1(strengthFact?.levelCode);
  const gyeokFact = delivery.facts.find((fact) => fact.kind === "gyeokguk");
  const lifeOverallStars = delivery.facts.flatMap((fact) =>
    fact.kind === "metric" && fact.id === "fortune.life.overall.stars" && fact.unit === "stars_1_5"
      ? [fact.value]
      : [])[0];
  const interactionFact = delivery.facts.find((fact) => fact.kind === "name_saju_interaction");
  const interaction = !interactionFact ? "unknown" as const
    : interactionFact.classification === "supportive_signal" ? "boost" as const
      : interactionFact.classification === "caution_signal" ? "adverse" as const
        : interactionFact.classification === "unavailable" ? "unknown" as const : "neutral" as const;
  const axes: PremiumContentSelectorV1["axes"] = {
    category: "overall",
    period: "life",
    age: classifyPremiumAgeAxisV1(request.analysisInput.birth, request.analysisInput.targetDate),
    band: classifyPremiumBandAxisV1(lifeOverallStars),
    gender: request.analysisInput.birth.gender === "male" || request.analysisInput.birth.gender === "female"
      ? request.analysisInput.birth.gender : "other",
    strength,
    gyeok: classifyPremiumGyeokAxisV1(gyeokFact ?? {}),
    interaction,
  };
  const root = `${request.productId}/${contentVersion}`;
  return {
    schemaVersion: "namespring.premium-content-selector.v1",
    algorithmVersion: "story-selector-v2",
    axes,
    keys: [
      `${root}/${axes.category}.${axes.period}.${axes.age}.${axes.band}.${axes.strength}.${axes.gyeok}.${axes.interaction}.${axes.gender}`,
      `${root}/age=${axes.age}/gender=${axes.gender}/strength=${axes.strength}/gyeok=${axes.gyeok}/interaction=${axes.interaction}`,
      `${root}/age=${axes.age}/strength=${axes.strength}/gyeok=${axes.gyeok}`,
      `${root}/default`,
    ],
  };
}

const PLACEHOLDER_PATTERN = /\{\{(displayName|dayMasterStem|yongshinElement|strengthLevel)\}\}/gu;
const ANY_PLACEHOLDER_PATTERN = /\{\{[^{}]{1,80}\}\}/gu;

function templatePlaceholders(template: PremiumContentTemplateRecordV1): Set<string> {
  const text = [
    template.template.title,
    template.template.summary,
    ...template.template.sections.flatMap((section) => [section.title, section.body]),
  ].join("\n");
  const all = text.match(ANY_PLACEHOLDER_PATTERN) ?? [];
  const matches = [...text.matchAll(PLACEHOLDER_PATTERN)];
  const supported = new Set(matches.map((match) => match[1]!));
  if (all.length !== matches.length) {
    throw new ApiHttpError(400, "PREMIUM_TEMPLATE_PLACEHOLDER_INVALID", "Template contains an unsupported placeholder.");
  }
  return supported;
}

export function validateApprovedPremiumTemplateV1(
  template: PremiumContentTemplateRecordV1,
  analysis: PremiumServerAnalysisRecordV1,
): void {
  if (!template || typeof template !== "object"
    || template.schemaVersion !== "namespring.premium-content-template.v1"
    || !/^premium_template_v1_[A-Za-z0-9_-]{16,128}$/u.test(template.templateId)
    || template.lifecycle !== "approved" || template.activation !== undefined
    || !analysis.contentSelector.keys.includes(template.selectorKey)
    || template.productId !== "report.story-completion.v1"
    || !template.contentVersion?.trim()) {
    throw new ApiHttpError(400, "PREMIUM_TEMPLATE_INVALID", "Approved reusable template shape/selector is invalid.");
  }
  assertApprovedProvenance(template.provenance);
  if (!template.template || template.template.kind !== "story_completion"
    || template.template.format !== "structured_plain_text_v1"
    || !template.template.title?.trim() || !template.template.summary?.trim()
    || !Array.isArray(template.template.sections) || template.template.sections.length < 1
    || template.template.sections.length > 32 || !Array.isArray(template.placeholderAllowlist)) {
    throw new ApiHttpError(400, "PREMIUM_TEMPLATE_INVALID", "Reusable template content is incomplete.");
  }
  assertSafePlainText(template.template.title, "template.title", 480);
  assertSafePlainText(template.template.summary, "template.summary", 4_000);
  const used = templatePlaceholders(template);
  const allowlist = new Set<string>(template.placeholderAllowlist);
  if (allowlist.size !== template.placeholderAllowlist.length
    || [...used].some((placeholder) => !allowlist.has(placeholder))) {
    throw new ApiHttpError(400, "PREMIUM_TEMPLATE_PLACEHOLDER_INVALID", "Template placeholder allowlist is inconsistent.");
  }
  const allowedSources = new Set(analysis.evidence.map((entry) => entry.sourceId));
  const sectionIds = new Set<string>();
  for (const section of template.template.sections) {
    if (!section.id?.trim() || sectionIds.has(section.id) || !section.title?.trim() || !section.body?.trim()
      || !Array.isArray(section.evidenceSourceRefs) || section.evidenceSourceRefs.length < 1
      || new Set(section.evidenceSourceRefs).size !== section.evidenceSourceRefs.length
      || section.evidenceSourceRefs.some((sourceId: string) => !allowedSources.has(sourceId))) {
      throw new ApiHttpError(409, "PREMIUM_TEMPLATE_EVIDENCE_INVALID", "Template evidence sources are not grounded in the sample recomputation.");
    }
    assertSafePlainText(section.title, "template.sections[].title", 480);
    assertSafePlainText(section.body, "template.sections[].body", 24_000);
    sectionIds.add(section.id);
  }
}

export function validatePremiumTemplateReviewCandidateV1(
  input: PremiumContentTemplateRecordV1,
  analysis: PremiumServerAnalysisRecordV1,
): void {
  assertPremiumTemplateReviewCandidateShapeV1(input);
  validateApprovedPremiumTemplateV1({
    ...input,
    provenance: {
      ...input.provenance,
      humanReview: {
        reviewerId: "server_review_validation_placeholder",
        reviewedAt: input.provenance.gate.evaluatedAt,
        decision: "approved",
        notesDigest: `sha256:${"0".repeat(64)}`,
      },
    },
  }, analysis);
}

export function activatePremiumArtifactBindingV1(
  artifact: PremiumContentArtifactRecordV1,
): PremiumContentActivationBindingV1 {
  if (!artifact.activation) throw new ApiHttpError(409, "PREMIUM_CONTENT_UNAVAILABLE", "Content activation is missing.");
  return {
    sourceKind: "report_artifact",
    resourceId: artifact.artifactId,
    activationId: artifact.activation.activationId,
    immutableContentDigest: artifact.activation.immutableContentDigest,
  };
}

export function activatePremiumTemplateBindingV1(
  template: PremiumContentTemplateRecordV1,
): PremiumContentActivationBindingV1 {
  if (!template.activation) throw new ApiHttpError(409, "PREMIUM_CONTENT_UNAVAILABLE", "Template activation is missing.");
  return {
    sourceKind: "case_template",
    resourceId: template.templateId,
    activationId: template.activation.activationId,
    immutableContentDigest: template.activation.immutableContentDigest,
    selectorKey: template.selectorKey,
  };
}

const ELEMENT_LABELS: Readonly<Record<string, string>> = {
  wood: "목", fire: "화", earth: "토", metal: "금", water: "수",
};

export function instantiatePremiumTemplateV1(
  template: PremiumContentTemplateRecordV1,
  analysis: PremiumServerAnalysisRecordV1,
) {
  const delivery = openPremiumAnalysisDeliveryV1({
    analysisId: analysis.analysisId,
    reportId: analysis.reportId,
    materialDigest: analysis.materialDigest,
    sealed: analysis.sealedDelivery,
  });
  const dayMaster = delivery.facts.find((fact) => fact.kind === "day_master");
  const yongshin = delivery.facts.find((fact) => fact.kind === "yongshin");
  const strength = delivery.facts.find((fact) => fact.kind === "strength");
  const values: Readonly<Record<PremiumTemplatePlaceholderV1, string | undefined>> = {
    displayName: delivery.subject.displayName,
    dayMasterStem: dayMaster?.stem,
    yongshinElement: yongshin?.element ? ELEMENT_LABELS[yongshin.element] : undefined,
    strengthLevel: strength?.level,
  };
  const replace = (text: string) => text.replace(PLACEHOLDER_PATTERN, (_whole, key: PremiumTemplatePlaceholderV1) => {
    if (!template.placeholderAllowlist.includes(key) || !values[key]) {
      throw new ApiHttpError(409, "PREMIUM_TEMPLATE_VALUE_UNAVAILABLE", `Template value ${key} is unavailable.`);
    }
    return values[key]!;
  });
  const evidenceBySource = new Map(analysis.evidence.map((entry) => [entry.sourceId, entry.evidenceId]));
  return {
    kind: "story_completion" as const,
    format: "structured_plain_text_v1" as const,
    title: replace(template.template.title),
    summary: replace(template.template.summary),
    sections: template.template.sections.map((section) => ({
      id: section.id,
      title: replace(section.title),
      body: replace(section.body),
      evidenceRefs: section.evidenceSourceRefs.map((sourceId) => {
        const evidenceId = evidenceBySource.get(sourceId);
        if (!evidenceId) {
          throw new ApiHttpError(409, "PREMIUM_TEMPLATE_EVIDENCE_UNAVAILABLE", "Template evidence is unavailable for this report.");
        }
        return evidenceId;
      }),
    })),
  };
}

export function assertPremiumApprovalChronologyV1(
  provenance: PremiumContentProvenanceV1,
  activatedAt: string,
): void {
  assertApprovalChronology(provenance, activatedAt);
}
