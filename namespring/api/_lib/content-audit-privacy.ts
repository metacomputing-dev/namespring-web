import { createHmac } from "node:crypto";
import type { ContentActorSubjectV1 } from "../../shared/types/content-lifecycle.js";
import { ApiHttpError } from "./http.js";
import { getRequiredEnv } from "./env.js";
import { assertServerSecretSeparationV1 } from "./server-secret-separation.js";

export const CONTENT_AUDIT_RETENTION_DAYS_V1 = 365 as const;
export const CONTENT_AUDIT_KEYRING_MAX_KEYS_V1 = 8 as const;

const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const SUBJECT_PATTERN = /^hmac-sha256:v1:([A-Za-z0-9][A-Za-z0-9._-]{0,63}):[a-f0-9]{64}$/u;

export interface ContentAuditHmacKeyringV1 {
  readonly currentKeyId: string;
  readonly keys: Readonly<Record<string, string>>;
}

interface ContentAuditActorV1 {
  readonly userId: string;
  readonly sessionId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failKeyring(code: string, message: string): never {
  throw new ApiHttpError(500, code, message);
}

export function assertContentAuditHmacKeyringV1(
  value: unknown,
  disallowedKeys: readonly string[] = [],
): ContentAuditHmacKeyringV1 {
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== "currentKeyId|keys") {
    return failKeyring("CONTENT_AUDIT_KEYRING_INVALID", "Content audit keyring must contain only currentKeyId and keys.");
  }
  const { currentKeyId, keys } = value;
  if (typeof currentKeyId !== "string" || !KEY_ID_PATTERN.test(currentKeyId) || !isRecord(keys)) {
    return failKeyring("CONTENT_AUDIT_KEYRING_INVALID", "Content audit keyring identifiers are invalid.");
  }
  const entries = Object.entries(keys).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length < 1 || entries.length > CONTENT_AUDIT_KEYRING_MAX_KEYS_V1) {
    return failKeyring(
      "CONTENT_AUDIT_KEYRING_SIZE_INVALID",
      `Content audit keyring must contain 1-${CONTENT_AUDIT_KEYRING_MAX_KEYS_V1} keys.`,
    );
  }
  const normalized: Record<string, string> = Object.create(null) as Record<string, string>;
  const seenSecrets = new Set<string>();
  for (const [keyId, secret] of entries) {
    if (!KEY_ID_PATTERN.test(keyId) || typeof secret !== "string") {
      return failKeyring("CONTENT_AUDIT_KEYRING_INVALID", "Content audit keyring entry is invalid.");
    }
    const secretBytes = Buffer.byteLength(secret, "utf8");
    if (secretBytes < 32 || secretBytes > 256) {
      return failKeyring("CONTENT_AUDIT_KEY_INVALID", "Each content audit HMAC key must contain 32-256 bytes.");
    }
    if (seenSecrets.has(secret)) {
      return failKeyring("CONTENT_AUDIT_KEYRING_DUPLICATE_SECRET", "Content audit key IDs must use distinct secrets.");
    }
    if (disallowedKeys.some((other) => other.length > 0 && other === secret)) {
      return failKeyring("CONTENT_AUDIT_KEY_REUSE", "Content audit pseudonymization requires dedicated secrets.");
    }
    seenSecrets.add(secret);
    normalized[keyId] = secret;
  }
  if (!Object.hasOwn(normalized, currentKeyId)) {
    return failKeyring("CONTENT_AUDIT_CURRENT_KEY_MISSING", "Content audit currentKeyId must reference a retained key.");
  }
  return Object.freeze({
    currentKeyId,
    keys: Object.freeze(normalized),
  });
}

export function parseContentAuditHmacKeyringV1(
  raw: string,
  disallowedKeys: readonly string[] = [],
): ContentAuditHmacKeyringV1 {
  if (Buffer.byteLength(raw, "utf8") > 8_192) {
    return failKeyring("CONTENT_AUDIT_KEYRING_TOO_LARGE", "Content audit keyring JSON exceeds 8 KiB.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return failKeyring("CONTENT_AUDIT_KEYRING_INVALID", "CONTENT_AUDIT_HMAC_KEYRING_JSON must be valid JSON.");
  }
  return assertContentAuditHmacKeyringV1(parsed, disallowedKeys);
}

export function getContentAuditHmacKeyringV1(): ContentAuditHmacKeyringV1 {
  const keyring = parseContentAuditHmacKeyringV1(
    getRequiredEnv("CONTENT_AUDIT_HMAC_KEYRING_JSON"),
    [
      process.env.AUTH_AUDIT_HMAC_KEY ?? "",
      process.env.PREMIUM_OWNER_DERIVATION_SECRET ?? "",
      process.env.SYNC_DELETION_HASH_PEPPER ?? "",
      process.env.RATE_LIMIT_HMAC_KEY ?? "",
    ],
  );
  assertServerSecretSeparationV1(
    "content_audit",
    Object.values(keyring.keys),
    "CONTENT_AUDIT_KEY_REUSE",
  );
  return keyring;
}

export function contentAuditSubjectV1(
  domain: "actor" | "session",
  rawSubject: string,
  keyId: string,
  hmacKey: string,
): ContentActorSubjectV1 {
  const byteLength = Buffer.byteLength(rawSubject, "utf8");
  if (byteLength < 1 || byteLength > 512 || !KEY_ID_PATTERN.test(keyId)) {
    throw new ApiHttpError(500, "CONTENT_AUDIT_SUBJECT_INVALID", "Content audit subject is invalid.");
  }
  const digest = createHmac("sha256", hmacKey)
    .update(`namespring-content-audit-v1\0${keyId}\0${domain}\0${rawSubject}`, "utf8")
    .digest("hex");
  return `hmac-sha256:v1:${keyId}:${digest}`;
}

export function contentAuditSubjectKeyIdV1(subject: string): string {
  const match = SUBJECT_PATTERN.exec(subject);
  if (!match?.[1]) {
    throw new ApiHttpError(503, "CONTENT_ACTOR_SUBJECT_INVALID", "Stored content actor pseudonym is invalid.");
  }
  return match[1];
}

export function assertContentAuditSubjectKeyRetainedV1(
  subject: string,
  retainedKeyIds: readonly string[],
): void {
  const keyId = contentAuditSubjectKeyIdV1(subject);
  if (!retainedKeyIds.includes(keyId)) {
    throw new ApiHttpError(
      503,
      "CONTENT_AUDIT_KEY_NOT_RETAINED",
      "A stored content actor pseudonym references a non-retained key; freeze mutations and migrate before removal.",
    );
  }
}

export function contentAuditPrivacyFieldsV1(
  actor: ContentAuditActorV1,
  occurredAt: string,
  keyring: ContentAuditHmacKeyringV1,
): {
  readonly actorSubject: ContentActorSubjectV1;
  readonly actorSubjects: readonly ContentActorSubjectV1[];
  readonly sessionSubject: ContentActorSubjectV1;
  readonly retainedKeyIds: readonly string[];
  readonly deleteAfter: string;
} {
  const timestamp = Date.parse(occurredAt);
  if (!Number.isFinite(timestamp)) {
    throw new ApiHttpError(500, "CONTENT_AUDIT_TIME_INVALID", "Content audit occurrence time is invalid.");
  }
  const retainedKeyIds = Object.freeze(Object.keys(keyring.keys).sort());
  const actorSubjects = Object.freeze(retainedKeyIds.map((keyId) => contentAuditSubjectV1(
    "actor",
    actor.userId,
    keyId,
    keyring.keys[keyId]!,
  )));
  const currentKey = keyring.keys[keyring.currentKeyId];
  if (!currentKey) {
    return failKeyring("CONTENT_AUDIT_CURRENT_KEY_MISSING", "Content audit current key is unavailable.");
  }
  return {
    actorSubject: contentAuditSubjectV1("actor", actor.userId, keyring.currentKeyId, currentKey),
    actorSubjects,
    sessionSubject: contentAuditSubjectV1("session", actor.sessionId, keyring.currentKeyId, currentKey),
    retainedKeyIds,
    deleteAfter: new Date(timestamp + CONTENT_AUDIT_RETENTION_DAYS_V1 * 86_400_000).toISOString(),
  };
}
