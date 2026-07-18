import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  ActivateContentArtifactRequestV1,
  ApproveContentArtifactRequestV1,
  ContentArtifactV1,
  ContentChannelV1,
  ContentKindV1,
  ContentPayloadV1,
  ContentProvenanceV1,
  GetContentArtifactRequestV1,
  ListContentArtifactsRequestV1,
  LocalContentExportPageRequestV1,
  FinalizeLocalContentExportRequestV1,
  RegisterContentArtifactRequestV1,
  RetireContentArtifactRequestV1,
  ReviewContentArtifactRequestV1,
  RollbackContentArtifactRequestV1,
  Sha256DigestV1,
} from "../../shared/types/content-lifecycle.js";
import {
  LOCAL_CONTENT_EXPORT_CHUNK_ITEMS_V1,
  LOCAL_CONTENT_EXPORT_MAX_CHUNKS_V1,
} from "../../shared/types/content-lifecycle.js";
import { ApiHttpError } from "./http.js";
import { getOptionalEnv } from "./env.js";
import { assertServerSecretSeparationV1 } from "./server-secret-separation.js";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const HMAC_SHA256 = /^hmac-sha256:[a-f0-9]{64}$/;
const MAX_CONTENT_BYTES = 512 * 1024;
export const CONTENT_REGISTER_BODY_MAX_BYTES = 768 * 1024;
export const CONTENT_ADMIN_EMPTY_BODY_MAX_BYTES = 2 * 1024;
const MAX_JSON_DEPTH = 16;
const MAX_JSON_NODES = 50_000;
const CONTENT_GATE_KEYRING_MAX_BYTES = 8_192;
const CONTENT_GATE_KEYRING_MAX_KEYS = 8;
const CONTENT_GATE_KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const FORBIDDEN_TEXT_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const FORBIDDEN_BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/u;
const HTML_TAG = /<\/?[A-Za-z][^>]*>/u;

type JsonScalar = string | number | boolean | null;
type CanonicalJson = JsonScalar | readonly CanonicalJson[] | { readonly [key: string]: CanonicalJson };

function fail(code: string, message: string, statusCode = 400): never {
  throw new ApiHttpError(statusCode, code, message);
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_CONTENT_REQUEST", `${field} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("INVALID_CONTENT_REQUEST", `${field} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  field: string,
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      fail("INVALID_CONTENT_REQUEST", `${field}.${key} is not supported.`);
    }
  }
  for (const key of required) {
    if (!(key in value)) {
      fail("INVALID_CONTENT_REQUEST", `${field}.${key} is required.`);
    }
  }
}

function requireString(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== "string") {
    fail("INVALID_CONTENT_REQUEST", `${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    fail("INVALID_CONTENT_REQUEST", `${field} must contain 1-${maxLength} characters.`);
  }
  return trimmed;
}

export function requireContentIdentifier(value: unknown, field: string): string {
  const identifier = requireString(value, field, 160);
  if (!IDENTIFIER.test(identifier)) {
    fail("INVALID_CONTENT_REQUEST", `${field} has an invalid identifier format.`);
  }
  return identifier;
}

function requireVersion(value: unknown, field: string): string {
  const version = requireString(value, field, 80);
  if (!VERSION.test(version)) {
    fail("INVALID_CONTENT_REQUEST", `${field} has an invalid version format.`);
  }
  return version;
}

export function requireSha256Digest(value: unknown, field: string): Sha256DigestV1 {
  if (typeof value !== "string" || !SHA256.test(value)) {
    fail("INVALID_CONTENT_DIGEST", `${field} must be a lowercase sha256 digest.`);
  }
  return value as Sha256DigestV1;
}

export function requireIsoTimestamp(value: unknown, field: string): string {
  const timestamp = requireString(value, field, 40);
  const millis = Date.parse(timestamp);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== timestamp) {
    fail("INVALID_CONTENT_REQUEST", `${field} must be a canonical ISO-8601 timestamp.`);
  }
  return timestamp;
}

function toCanonicalJson(value: unknown, field: string): CanonicalJson {
  let nodes = 0;
  const seen = new Set<object>();

  const visit = (current: unknown, depth: number, path: string): CanonicalJson => {
    nodes += 1;
    if (nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) {
      fail("CONTENT_PAYLOAD_TOO_COMPLEX", `${field} exceeds the JSON complexity limit.`);
    }
    if (current === null || typeof current === "string" || typeof current === "boolean") {
      return current;
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        fail("INVALID_CONTENT_PAYLOAD", `${path} must be a finite number.`);
      }
      return current;
    }
    if (typeof current !== "object") {
      fail("INVALID_CONTENT_PAYLOAD", `${path} contains a non-JSON value.`);
    }
    if (seen.has(current)) {
      fail("INVALID_CONTENT_PAYLOAD", `${path} contains a cyclic reference.`);
    }
    seen.add(current);
    try {
      if (Array.isArray(current)) {
        return current.map((item, index) => visit(item, depth + 1, `${path}[${index}]`));
      }
      const object = requireObject(current, path);
      const result: Record<string, CanonicalJson> = {};
      for (const key of Object.keys(object).sort()) {
        if (FORBIDDEN_OBJECT_KEYS.has(key)) {
          fail("INVALID_CONTENT_PAYLOAD", `${path}.${key} is forbidden.`);
        }
        result[key] = visit(object[key], depth + 1, `${path}.${key}`);
      }
      return result;
    } finally {
      seen.delete(current);
    }
  };

  return visit(value, 0, field);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(toCanonicalJson(value, "value"));
}

export function sha256Digest(value: unknown): Sha256DigestV1 {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

export function validateContentPayload(value: unknown): Readonly<Record<string, unknown>> {
  const object = requireObject(value, "payload");
  const canonical = canonicalJson(object);
  if (Buffer.byteLength(canonical, "utf8") > MAX_CONTENT_BYTES) {
    fail("CONTENT_PAYLOAD_TOO_LARGE", `payload must not exceed ${MAX_CONTENT_BYTES} UTF-8 bytes.`, 413);
  }
  return JSON.parse(canonical) as Readonly<Record<string, unknown>>;
}

function requirePlainText(
  value: unknown,
  field: string,
  limits: { readonly min: number; readonly max: number },
): string {
  if (typeof value !== "string") {
    fail("INVALID_CONTENT_PAYLOAD", `${field} must be plain text.`);
  }
  if (value !== value.trim() || value.length < limits.min || value.length > limits.max) {
    fail(
      "INVALID_CONTENT_PAYLOAD",
      `${field} must be trimmed and contain ${limits.min}-${limits.max} characters.`,
    );
  }
  if (FORBIDDEN_TEXT_CONTROLS.test(value) || FORBIDDEN_BIDI_CONTROLS.test(value) || HTML_TAG.test(value)) {
    fail("UNSAFE_CONTENT_TEXT", `${field} contains markup or unsafe control characters.`);
  }
  return value;
}

function requireArray(value: unknown, field: string, min: number, max: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    fail("INVALID_CONTENT_PAYLOAD", `${field} must contain ${min}-${max} items.`);
  }
  return value;
}

function parseTextList(
  value: unknown,
  field: string,
  limits: { readonly minItems: number; readonly maxItems: number; readonly minChars: number; readonly maxChars: number },
): readonly string[] {
  return requireArray(value, field, limits.minItems, limits.maxItems).map((entry, index) =>
    requirePlainText(entry, `${field}[${index}]`, { min: limits.minChars, max: limits.maxChars }));
}

function parseTextSections(value: unknown, field = "payload.sections"): readonly {
  readonly id: string;
  readonly title?: string;
  readonly body: string;
  readonly expert?: string;
}[] {
  const seenIds = new Set<string>();
  return requireArray(value, field, 1, 24).map((entry, index) => {
    const section = requireObject(entry, `${field}[${index}]`);
    requireExactKeys(section, ["id", "title", "body", "expert"], ["id", "body"], `${field}[${index}]`);
    const id = requireContentIdentifier(section.id, `${field}[${index}].id`);
    if (seenIds.has(id)) {
      fail("INVALID_CONTENT_PAYLOAD", `${field} contains duplicate section id ${id}.`);
    }
    seenIds.add(id);
    return {
      id,
      ...(section.title === undefined
        ? {}
        : { title: requirePlainText(section.title, `${field}[${index}].title`, { min: 1, max: 160 }) }),
      body: requirePlainText(section.body, `${field}[${index}].body`, { min: 10, max: 8_000 }),
      ...(section.expert === undefined
        ? {}
        : { expert: requirePlainText(section.expert, `${field}[${index}].expert`, { min: 10, max: 6_000 }) }),
    };
  });
}

function assertSafeJsonStrings(value: unknown, field: string): void {
  if (typeof value === "string") {
    requirePlainText(value, field, { min: 1, max: 100_000 });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSafeJsonStrings(entry, `${field}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertSafeJsonStrings(entry, `${field}.${key}`);
    }
  }
}

/**
 * Runtime content is deliberately schema-bound. The staging-only `other` kind
 * remains available for manual migration work but cannot be activated/exported.
 */
export function validateContentPayloadForKind(
  kind: ContentKindV1,
  value: unknown,
  options: { readonly requireDeliverable?: boolean } = {},
): ContentPayloadV1 {
  const canonicalPayload = validateContentPayload(value);
  const payload = requireObject(canonicalPayload, "payload");
  assertSafeJsonStrings(payload, "payload");

  if (kind === "fortune_bundle") {
    requireExactKeys(
      payload,
      ["schemaVersion", "summary", "hook", "sections", "tips", "cautions", "expert"],
      ["schemaVersion", "summary", "hook", "sections", "tips", "cautions"],
      "payload",
    );
    if (payload.schemaVersion !== "namespring.fortune-bundle.v1") {
      fail("CONTENT_SCHEMA_MISMATCH", "fortune_bundle requires namespring.fortune-bundle.v1.");
    }
    return {
      schemaVersion: "namespring.fortune-bundle.v1",
      summary: requirePlainText(payload.summary, "payload.summary", { min: 10, max: 800 }),
      hook: requirePlainText(payload.hook, "payload.hook", { min: 5, max: 400 }),
      sections: parseTextSections(payload.sections),
      tips: parseTextList(payload.tips, "payload.tips", {
        minItems: 1, maxItems: 8, minChars: 5, maxChars: 600,
      }),
      cautions: parseTextList(payload.cautions, "payload.cautions", {
        minItems: 1, maxItems: 8, minChars: 5, maxChars: 600,
      }),
      ...(payload.expert === undefined
        ? {}
        : { expert: requirePlainText(payload.expert, "payload.expert", { min: 10, max: 8_000 }) }),
    };
  }

  if (kind === "name_energy") {
    requireExactKeys(payload, ["schemaVersion", "summary", "sections", "keywords"], ["schemaVersion", "summary", "sections"], "payload");
    if (payload.schemaVersion !== "namespring.name-energy.v1") {
      fail("CONTENT_SCHEMA_MISMATCH", "name_energy requires namespring.name-energy.v1.");
    }
    return {
      schemaVersion: "namespring.name-energy.v1",
      summary: requirePlainText(payload.summary, "payload.summary", { min: 10, max: 1_200 }),
      sections: parseTextSections(payload.sections),
      ...(payload.keywords === undefined
        ? {}
        : { keywords: parseTextList(payload.keywords, "payload.keywords", {
            minItems: 1, maxItems: 12, minChars: 1, maxChars: 80,
          }) }),
    };
  }

  if (kind === "report_copy") {
    requireExactKeys(payload, ["schemaVersion", "title", "summary", "sections"], ["schemaVersion", "title", "sections"], "payload");
    if (payload.schemaVersion !== "namespring.report-copy.v1") {
      fail("CONTENT_SCHEMA_MISMATCH", "report_copy requires namespring.report-copy.v1.");
    }
    return {
      schemaVersion: "namespring.report-copy.v1",
      title: requirePlainText(payload.title, "payload.title", { min: 1, max: 160 }),
      ...(payload.summary === undefined
        ? {}
        : { summary: requirePlainText(payload.summary, "payload.summary", { min: 5, max: 1_200 }) }),
      sections: parseTextSections(payload.sections),
    };
  }

  if (kind === "article") {
    requireExactKeys(payload, ["schemaVersion", "title", "dek", "paragraphs", "tags"], ["schemaVersion", "title", "paragraphs"], "payload");
    if (payload.schemaVersion !== "namespring.article.v1") {
      fail("CONTENT_SCHEMA_MISMATCH", "article requires namespring.article.v1.");
    }
    return {
      schemaVersion: "namespring.article.v1",
      title: requirePlainText(payload.title, "payload.title", { min: 1, max: 200 }),
      ...(payload.dek === undefined
        ? {}
        : { dek: requirePlainText(payload.dek, "payload.dek", { min: 5, max: 600 }) }),
      paragraphs: parseTextList(payload.paragraphs, "payload.paragraphs", {
        minItems: 1, maxItems: 80, minChars: 10, maxChars: 8_000,
      }),
      ...(payload.tags === undefined
        ? {}
        : { tags: parseTextList(payload.tags, "payload.tags", {
            minItems: 1, maxItems: 20, minChars: 1, maxChars: 60,
          }) }),
    };
  }

  if (kind === "glossary") {
    requireExactKeys(payload, ["schemaVersion", "entries"], ["schemaVersion", "entries"], "payload");
    if (payload.schemaVersion !== "namespring.glossary.v1") {
      fail("CONTENT_SCHEMA_MISMATCH", "glossary requires namespring.glossary.v1.");
    }
    const seenIds = new Set<string>();
    const entries = requireArray(payload.entries, "payload.entries", 1, 500).map((entry, index) => {
      const item = requireObject(entry, `payload.entries[${index}]`);
      requireExactKeys(item, ["id", "label", "definition"], ["id", "label", "definition"], `payload.entries[${index}]`);
      const id = requireContentIdentifier(item.id, `payload.entries[${index}].id`);
      if (seenIds.has(id)) fail("INVALID_CONTENT_PAYLOAD", `payload.entries contains duplicate id ${id}.`);
      seenIds.add(id);
      return {
        id,
        label: requirePlainText(item.label, `payload.entries[${index}].label`, { min: 1, max: 120 }),
        definition: requirePlainText(item.definition, `payload.entries[${index}].definition`, { min: 5, max: 2_000 }),
      };
    });
    return { schemaVersion: "namespring.glossary.v1", entries };
  }

  requireExactKeys(payload, ["schemaVersion", "data"], ["schemaVersion", "data"], "payload");
  if (payload.schemaVersion !== "namespring.other-draft.v1") {
    fail("CONTENT_SCHEMA_MISMATCH", "other requires namespring.other-draft.v1.");
  }
  if (options.requireDeliverable) {
    fail("CONTENT_KIND_NOT_DELIVERABLE", "The other content kind is staging-only and cannot be activated or exported.", 409);
  }
  return {
    schemaVersion: "namespring.other-draft.v1",
    data: requireObject(payload.data, "payload.data"),
  };
}

function parseChannel(value: unknown): ContentChannelV1 {
  const object = requireObject(value, "channel");
  requireExactKeys(object, ["contentKey", "kind", "audience", "locale"], ["contentKey", "kind", "audience", "locale"], "channel");
  const kind = requireString(object.kind, "channel.kind", 40);
  if (!["fortune_bundle", "name_energy", "report_copy", "article", "glossary", "other"].includes(kind)) {
    fail("INVALID_CONTENT_REQUEST", "channel.kind is unsupported.");
  }
  const audience = requireString(object.audience, "channel.audience", 20);
  if (!["free_local", "paid_server", "shared"].includes(audience)) {
    fail("INVALID_CONTENT_REQUEST", "channel.audience is unsupported.");
  }
  if (object.locale !== "ko-KR") {
    fail("INVALID_CONTENT_REQUEST", "channel.locale must be ko-KR.");
  }
  return {
    contentKey: requireContentIdentifier(object.contentKey, "channel.contentKey"),
    kind: kind as ContentChannelV1["kind"],
    audience: audience as ContentChannelV1["audience"],
    locale: "ko-KR",
  };
}

export function contentGateAttestationMaterial(input: {
  readonly attestationId: string;
  readonly runner: "trusted_ci";
  readonly keyId: string;
  readonly subjectContentDigest: Sha256DigestV1;
  readonly policyDigest: Sha256DigestV1;
  readonly gateVersion: string;
  readonly decision: "passed" | "failed";
  readonly checkedAt: string;
  readonly resultDigest: Sha256DigestV1;
}): string {
  return canonicalJson(input);
}

export function readContentGateAttestationKeyV1(keyId: string): string {
  const raw = getOptionalEnv("CONTENT_GATE_ATTESTATION_KEYRING_JSON");
  if (!raw) {
    fail(
      "CONTENT_GATE_ATTESTATION_CONFIG_MISSING",
      "Trusted content gate attestation keys are not configured.",
      503,
    );
  }
  if (Buffer.byteLength(raw, "utf8") > CONTENT_GATE_KEYRING_MAX_BYTES) {
    fail("CONTENT_GATE_ATTESTATION_CONFIG_INVALID", "Content gate keyring exceeds 8 KiB.", 503);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("CONTENT_GATE_ATTESTATION_CONFIG_INVALID", "Content gate keyring is not valid JSON.", 503);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
    || (Object.getPrototypeOf(parsed) !== Object.prototype && Object.getPrototypeOf(parsed) !== null)) {
    fail("CONTENT_GATE_ATTESTATION_CONFIG_INVALID", "Content gate keyring must be a plain object.", 503);
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length < 1 || entries.length > CONTENT_GATE_KEYRING_MAX_KEYS) {
    fail(
      "CONTENT_GATE_ATTESTATION_CONFIG_INVALID",
      `Content gate keyring must contain 1-${CONTENT_GATE_KEYRING_MAX_KEYS} keys.`,
      503,
    );
  }
  const secrets: string[] = [];
  const seenSecrets = new Set<string>();
  let requestedKey: string | undefined;
  for (const [configuredKeyId, value] of entries) {
    if (!CONTENT_GATE_KEY_ID.test(configuredKeyId) || FORBIDDEN_OBJECT_KEYS.has(configuredKeyId)
      || typeof value !== "string") {
      fail("CONTENT_GATE_ATTESTATION_CONFIG_INVALID", "Content gate keyring entry is invalid.", 503);
    }
    const secretBytes = Buffer.byteLength(value, "utf8");
    if (secretBytes < 32 || secretBytes > 256 || seenSecrets.has(value)) {
      fail("CONTENT_GATE_ATTESTATION_CONFIG_INVALID", "Content gate keyring secrets are invalid.", 503);
    }
    seenSecrets.add(value);
    secrets.push(value);
    if (configuredKeyId === keyId) requestedKey = value;
  }
  if (requestedKey === undefined) {
    fail("CONTENT_GATE_ATTESTATION_KEY_UNKNOWN", "Content gate attestation key is unavailable.", 503);
  }
  assertServerSecretSeparationV1(
    "content_gate",
    secrets,
    "CONTENT_GATE_KEY_REUSE",
  );
  return requestedKey;
}

function parseGateAttestation(
  value: unknown,
  gate: {
    readonly gateVersion: string;
    readonly decision: "passed" | "failed";
    readonly checkedAt: string;
    readonly resultDigest: Sha256DigestV1;
  },
  contentDigest: Sha256DigestV1,
): NonNullable<ContentProvenanceV1["gate"]["attestation"]> {
  const object = requireObject(value, "provenance.gate.attestation");
  requireExactKeys(
    object,
    ["attestationId", "runner", "keyId", "subjectContentDigest", "policyDigest", "signature"],
    ["attestationId", "runner", "keyId", "subjectContentDigest", "policyDigest", "signature"],
    "provenance.gate.attestation",
  );
  if (object.runner !== "trusted_ci") {
    fail("INVALID_CONTENT_ATTESTATION", "Content gate attestation runner must be trusted_ci.");
  }
  const attestation = {
    attestationId: requireContentIdentifier(object.attestationId, "provenance.gate.attestation.attestationId"),
    runner: "trusted_ci" as const,
    keyId: requireContentIdentifier(object.keyId, "provenance.gate.attestation.keyId"),
    subjectContentDigest: requireSha256Digest(
      object.subjectContentDigest,
      "provenance.gate.attestation.subjectContentDigest",
    ),
    policyDigest: requireSha256Digest(object.policyDigest, "provenance.gate.attestation.policyDigest"),
    signature: object.signature,
  };
  if (attestation.subjectContentDigest !== contentDigest) {
    fail("CONTENT_ATTESTATION_SUBJECT_MISMATCH", "Gate attestation does not bind the registered content digest.");
  }
  if (typeof attestation.signature !== "string" || !HMAC_SHA256.test(attestation.signature)) {
    fail("INVALID_CONTENT_ATTESTATION", "Gate attestation signature must be a lowercase HMAC-SHA256 value.");
  }
  const expected = `hmac-sha256:${createHmac("sha256", readContentGateAttestationKeyV1(attestation.keyId))
    .update(contentGateAttestationMaterial({
      attestationId: attestation.attestationId,
      runner: attestation.runner,
      keyId: attestation.keyId,
      subjectContentDigest: attestation.subjectContentDigest,
      policyDigest: attestation.policyDigest,
      gateVersion: gate.gateVersion,
      decision: gate.decision,
      checkedAt: gate.checkedAt,
      resultDigest: gate.resultDigest,
    }), "utf8")
    .digest("hex")}`;
  const suppliedBytes = Buffer.from(attestation.signature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    fail("CONTENT_ATTESTATION_SIGNATURE_INVALID", "Gate attestation signature is invalid.", 403);
  }
  return attestation as NonNullable<ContentProvenanceV1["gate"]["attestation"]>;
}

/** Re-authenticate gate authority whenever a persisted artifact is trusted. */
export function assertStoredContentGateAttestationV1(
  gate: ContentProvenanceV1["gate"],
  contentDigest: Sha256DigestV1,
): void {
  if (gate.decision !== "passed" || !gate.attestation) {
    throw new ApiHttpError(
      503,
      "CONTENT_STORED_ATTESTATION_INVALID",
      "Stored content gate authority is missing.",
    );
  }
  try {
    parseGateAttestation(gate.attestation, {
      gateVersion: gate.gateVersion,
      decision: gate.decision,
      checkedAt: gate.checkedAt,
      resultDigest: gate.resultDigest,
    }, contentDigest);
  } catch (error) {
    if (error instanceof ApiHttpError && [
      "CONTENT_GATE_ATTESTATION_CONFIG_MISSING",
      "CONTENT_GATE_ATTESTATION_CONFIG_INVALID",
      "CONTENT_GATE_ATTESTATION_KEY_UNKNOWN",
      "CONTENT_GATE_KEY_REUSE",
    ].includes(error.code)) throw error;
    throw new ApiHttpError(
      503,
      "CONTENT_STORED_ATTESTATION_INVALID",
      "Stored content gate authority failed authentication.",
    );
  }
}

function parseProvenance(value: unknown, contentDigest: Sha256DigestV1): ContentProvenanceV1 {
  const object = requireObject(value, "provenance");
  requireExactKeys(object, ["source", "generation", "prompt", "gate"], ["source", "gate"], "provenance");

  const source = requireObject(object.source, "provenance.source");
  requireExactKeys(source, ["sourceKind", "sourceId", "sourceVersion", "sourceDigest", "importedAt"], ["sourceKind", "sourceId", "sourceVersion", "sourceDigest", "importedAt"], "provenance.source");
  const sourceKind = requireString(source.sourceKind, "provenance.source.sourceKind", 40);
  if (!["bulk_json_staging", "generated", "manual", "migration"].includes(sourceKind)) {
    fail("INVALID_CONTENT_REQUEST", "provenance.source.sourceKind is unsupported.");
  }
  const parsedSource = {
    sourceKind: sourceKind as ContentProvenanceV1["source"]["sourceKind"],
    sourceId: requireContentIdentifier(source.sourceId, "provenance.source.sourceId"),
    sourceVersion: requireVersion(source.sourceVersion, "provenance.source.sourceVersion"),
    sourceDigest: requireSha256Digest(source.sourceDigest, "provenance.source.sourceDigest"),
    importedAt: requireIsoTimestamp(source.importedAt, "provenance.source.importedAt"),
  };

  let generation: ContentProvenanceV1["generation"];
  if (object.generation !== undefined) {
    const generationObject = requireObject(object.generation, "provenance.generation");
    requireExactKeys(generationObject, ["provider", "modelId", "modelVersion", "generatedAt"], ["provider", "modelId", "modelVersion", "generatedAt"], "provenance.generation");
    generation = {
      provider: requireContentIdentifier(generationObject.provider, "provenance.generation.provider"),
      modelId: requireContentIdentifier(generationObject.modelId, "provenance.generation.modelId"),
      modelVersion: requireVersion(generationObject.modelVersion, "provenance.generation.modelVersion"),
      generatedAt: requireIsoTimestamp(generationObject.generatedAt, "provenance.generation.generatedAt"),
    };
  }

  let prompt: ContentProvenanceV1["prompt"];
  if (object.prompt !== undefined) {
    const promptObject = requireObject(object.prompt, "provenance.prompt");
    requireExactKeys(promptObject, ["promptId", "promptVersion", "promptDigest"], ["promptId", "promptVersion", "promptDigest"], "provenance.prompt");
    prompt = {
      promptId: requireContentIdentifier(promptObject.promptId, "provenance.prompt.promptId"),
      promptVersion: requireVersion(promptObject.promptVersion, "provenance.prompt.promptVersion"),
      promptDigest: requireSha256Digest(promptObject.promptDigest, "provenance.prompt.promptDigest"),
    };
  }
  if (sourceKind === "generated" && (!generation || !prompt)) {
    fail("CONTENT_PROVENANCE_INCOMPLETE", "Generated content requires generation and prompt provenance.");
  }
  if ((generation && !prompt) || (!generation && prompt)) {
    fail("CONTENT_PROVENANCE_INCOMPLETE", "generation and prompt provenance must be supplied together.");
  }

  const gateObject = requireObject(object.gate, "provenance.gate");
  requireExactKeys(gateObject, ["gateVersion", "decision", "checkedAt", "resultDigest", "attestation"], ["gateVersion", "decision", "checkedAt", "resultDigest"], "provenance.gate");
  if (gateObject.decision !== "passed" && gateObject.decision !== "failed") {
    fail("INVALID_CONTENT_REQUEST", "provenance.gate.decision is unsupported.");
  }
  const gate = {
    gateVersion: requireVersion(gateObject.gateVersion, "provenance.gate.gateVersion"),
    decision: gateObject.decision,
    checkedAt: requireIsoTimestamp(gateObject.checkedAt, "provenance.gate.checkedAt"),
    resultDigest: requireSha256Digest(gateObject.resultDigest, "provenance.gate.resultDigest"),
  } as const;
  if (gate.decision === "passed" && gateObject.attestation === undefined) {
    fail("CONTENT_GATE_ATTESTATION_REQUIRED", "A passed quality gate requires trusted CI attestation.");
  }
  const attestation = gateObject.attestation === undefined
    ? undefined
    : parseGateAttestation(gateObject.attestation, gate, contentDigest);
  const result: ContentProvenanceV1 = {
    source: parsedSource,
    gate: {
      ...gate,
      ...(attestation ? { attestation } : {}),
    },
    ...(generation ? { generation } : {}),
    ...(prompt ? { prompt } : {}),
  };
  return result;
}

export function parseRegisterContentArtifactRequest(value: unknown): RegisterContentArtifactRequestV1 {
  const object = requireObject(value, "request");
  requireExactKeys(object, ["requestId", "artifactId", "channel", "version", "payload", "contentDigest", "provenance", "supersedesArtifactId"], ["requestId", "artifactId", "channel", "version", "payload", "contentDigest", "provenance"], "request");
  const channel = parseChannel(object.channel);
  const payload = validateContentPayloadForKind(channel.kind, object.payload);
  const suppliedDigest = requireSha256Digest(object.contentDigest, "contentDigest");
  const computedDigest = sha256Digest(payload);
  if (suppliedDigest !== computedDigest) {
    fail("CONTENT_DIGEST_MISMATCH", "contentDigest does not match the canonical payload.");
  }
  return {
    requestId: requireContentIdentifier(object.requestId, "requestId"),
    artifactId: requireContentIdentifier(object.artifactId, "artifactId"),
    channel,
    version: requireVersion(object.version, "version"),
    payload,
    contentDigest: suppliedDigest,
    provenance: parseProvenance(object.provenance, suppliedDigest),
    ...(object.supersedesArtifactId === undefined
      ? {}
      : { supersedesArtifactId: requireContentIdentifier(object.supersedesArtifactId, "supersedesArtifactId") }),
  };
}

export function parseGetContentArtifactRequest(value: unknown): GetContentArtifactRequestV1 {
  const object = requireObject(value, "request");
  requireExactKeys(object, ["artifactId"], ["artifactId"], "request");
  return { artifactId: requireContentIdentifier(object.artifactId, "artifactId") };
}

export function parseEmptyContentAdminRequest(value: unknown): void {
  const object = requireObject(value, "request");
  requireExactKeys(object, [], [], "request");
}

export function parseListContentArtifactsRequest(value: unknown): ListContentArtifactsRequestV1 {
  const object = requireObject(value, "request");
  requireExactKeys(object, ["lifecycle", "afterArtifactId", "limit"], ["lifecycle"], "request");
  if (!["draft", "reviewed", "approved", "active", "retired"].includes(String(object.lifecycle))) {
    fail("INVALID_CONTENT_REQUEST", "lifecycle is unsupported.");
  }
  const limit = object.limit === undefined ? 10 : object.limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 10) {
    fail("INVALID_CONTENT_REQUEST", "limit must be 1-10.");
  }
  return {
    lifecycle: object.lifecycle as ContentArtifactV1["lifecycle"],
    ...(object.afterArtifactId === undefined
      ? {}
      : { afterArtifactId: requireContentIdentifier(object.afterArtifactId, "afterArtifactId") }),
    limit,
  };
}

export function parseLocalContentExportPageRequest(value: unknown): LocalContentExportPageRequestV1 {
  const object = requireObject(value, "request");
  requireExactKeys(object, ["exportId", "cursor"], ["exportId"], "request");
  let cursor: LocalContentExportPageRequestV1["cursor"];
  if (object.cursor !== undefined) {
    const cursorObject = requireObject(object.cursor, "cursor");
    requireExactKeys(cursorObject, ["chunkIndex", "offset"], ["chunkIndex", "offset"], "cursor");
    const chunkIndex = cursorObject.chunkIndex;
    const offset = cursorObject.offset;
    if (typeof chunkIndex !== "number" || typeof offset !== "number"
      || !Number.isSafeInteger(chunkIndex) || chunkIndex < 0
      || chunkIndex >= LOCAL_CONTENT_EXPORT_MAX_CHUNKS_V1
      || !Number.isSafeInteger(offset) || offset < 0
      || offset >= LOCAL_CONTENT_EXPORT_CHUNK_ITEMS_V1) {
      fail("INVALID_CONTENT_REQUEST", "cursor chunkIndex/offset is invalid.");
    }
    cursor = { chunkIndex, offset };
  }
  return {
    exportId: requireContentIdentifier(object.exportId, "exportId"),
    ...(cursor ? { cursor } : {}),
  };
}

export function parseFinalizeLocalContentExportRequest(value: unknown): FinalizeLocalContentExportRequestV1 {
  const object = requireObject(value, "request");
  requireExactKeys(
    object,
    ["exportId", "observedArtifactCount", "observedAssetSetDigest"],
    ["exportId", "observedArtifactCount", "observedAssetSetDigest"],
    "request",
  );
  const observedArtifactCount = object.observedArtifactCount;
  if (typeof observedArtifactCount !== "number"
    || !Number.isInteger(observedArtifactCount) || observedArtifactCount < 1) {
    fail("INVALID_CONTENT_REQUEST", "observedArtifactCount must be a positive integer.");
  }
  return {
    exportId: requireContentIdentifier(object.exportId, "exportId"),
    observedArtifactCount,
    observedAssetSetDigest: requireSha256Digest(object.observedAssetSetDigest, "observedAssetSetDigest"),
  };
}

function parseTransitionBase(value: unknown, extraKey: "notesDigest" | "reason" | null) {
  const object = requireObject(value, "request");
  const keys = ["requestId", "artifactId", "expectedRevision", ...(extraKey ? [extraKey] : [])];
  requireExactKeys(object, keys, keys, "request");
  const expectedRevision = object.expectedRevision;
  if (typeof expectedRevision !== "number"
    || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    fail("INVALID_CONTENT_REQUEST", "expectedRevision must be a positive integer.");
  }
  return {
    object,
    requestId: requireContentIdentifier(object.requestId, "requestId"),
    artifactId: requireContentIdentifier(object.artifactId, "artifactId"),
    expectedRevision,
  };
}

export function parseReviewContentArtifactRequest(value: unknown): ReviewContentArtifactRequestV1 {
  const parsed = parseTransitionBase(value, "notesDigest");
  return {
    requestId: parsed.requestId,
    artifactId: parsed.artifactId,
    expectedRevision: parsed.expectedRevision,
    notesDigest: requireSha256Digest(parsed.object.notesDigest, "notesDigest"),
  };
}

export function parseApproveContentArtifactRequest(value: unknown): ApproveContentArtifactRequestV1 {
  const parsed = parseTransitionBase(value, null);
  return parsed;
}

function parseReasonTransition(value: unknown): ActivateContentArtifactRequestV1 {
  const parsed = parseTransitionBase(value, "reason");
  return {
    requestId: parsed.requestId,
    artifactId: parsed.artifactId,
    expectedRevision: parsed.expectedRevision,
    reason: requireString(parsed.object.reason, "reason", 500),
  };
}

export const parseActivateContentArtifactRequest = parseReasonTransition;
export const parseRetireContentArtifactRequest = parseReasonTransition as (value: unknown) => RetireContentArtifactRequestV1;
export const parseRollbackContentArtifactRequest = parseReasonTransition as (value: unknown) => RollbackContentArtifactRequestV1;

export function assertArtifactDeliverable(artifact: ContentArtifactV1, expectedAudience?: ContentChannelV1["audience"]): void {
  if (artifact.lifecycle !== "active" || !artifact.review || !artifact.approval || artifact.provenance.gate.decision !== "passed") {
    fail("CONTENT_NOT_ACTIVE", "Content is not fully reviewed, approved, and active.", 409);
  }
  if (expectedAudience && artifact.channel.audience !== expectedAudience && artifact.channel.audience !== "shared") {
    fail("CONTENT_AUDIENCE_MISMATCH", "Content cannot be served to this audience.", 403);
  }
  if (sha256Digest(artifact.payload) !== artifact.contentDigest) {
    fail("CONTENT_INTEGRITY_FAILURE", "Stored content digest verification failed.", 503);
  }
  assertStoredContentGateAttestationV1(artifact.provenance.gate, artifact.contentDigest);
  validateContentPayloadForKind(artifact.channel.kind, artifact.payload, { requireDeliverable: true });
  const activation = artifact.activations.at(-1);
  if (!activation || activation.immutableContentDigest !== artifact.contentDigest) {
    fail("CONTENT_INTEGRITY_FAILURE", "Activation provenance is incomplete.", 503);
  }
}

export function newOpaqueId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export function contentChannelKey(channel: ContentChannelV1): string {
  return `${channel.audience}|${channel.kind}|${channel.locale}|${channel.contentKey}`;
}
