import { createHmac, timingSafeEqual } from "node:crypto";
import type { PremiumActorV1 } from "../../shared/types/premium-service.js";
import { getRequiredEnv } from "./env.js";
import { ApiHttpError } from "./http.js";
import { assertServerSecretSeparationV1 } from "./server-secret-separation.js";

export const PREMIUM_AUDIT_RETENTION_DAYS_V1 = 365 as const;
export const PREMIUM_AUDIT_KEYRING_MAX_KEYS_V1 = 8 as const;

const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const SUBJECT_PATTERNS = {
  actor: /^premium_audit_actor_v2:([A-Za-z0-9][A-Za-z0-9._-]{0,63}):([a-f0-9]{64})$/u,
  session: /^premium_audit_session_v2:([A-Za-z0-9][A-Za-z0-9._-]{0,63}):([a-f0-9]{64})$/u,
} as const;

export interface PremiumAuditHmacKeyringV1 {
  readonly currentKeyId: string;
  readonly keys: Readonly<Record<string, string>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(code: string, message: string): never {
  throw new ApiHttpError(500, code, message);
}

export function assertPremiumAuditHmacKeyringV1(
  value: unknown,
  disallowedSecrets: readonly string[] = [],
): PremiumAuditHmacKeyringV1 {
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== "currentKeyId|keys") {
    return fail("PREMIUM_AUDIT_KEYRING_INVALID", "Premium audit keyring must contain only currentKeyId and keys.");
  }
  const { currentKeyId, keys } = value;
  if (typeof currentKeyId !== "string" || !KEY_ID_PATTERN.test(currentKeyId) || !isRecord(keys)) {
    return fail("PREMIUM_AUDIT_KEYRING_INVALID", "Premium audit keyring identifiers are invalid.");
  }
  const entries = Object.entries(keys).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length < 1 || entries.length > PREMIUM_AUDIT_KEYRING_MAX_KEYS_V1) {
    return fail(
      "PREMIUM_AUDIT_KEYRING_SIZE_INVALID",
      `Premium audit keyring must contain 1-${PREMIUM_AUDIT_KEYRING_MAX_KEYS_V1} keys.`,
    );
  }
  const normalized: Record<string, string> = Object.create(null) as Record<string, string>;
  const seen = new Set<string>();
  for (const [keyId, secret] of entries) {
    if (!KEY_ID_PATTERN.test(keyId) || typeof secret !== "string") {
      return fail("PREMIUM_AUDIT_KEYRING_INVALID", "Premium audit keyring entry is invalid.");
    }
    const bytes = Buffer.byteLength(secret, "utf8");
    if (bytes < 32 || bytes > 256) {
      return fail("PREMIUM_AUDIT_KEY_INVALID", "Each premium audit HMAC key must contain 32-256 bytes.");
    }
    if (seen.has(secret)) {
      return fail("PREMIUM_AUDIT_KEYRING_DUPLICATE_SECRET", "Premium audit key IDs must use distinct secrets.");
    }
    if (disallowedSecrets.some((other) => other.length > 0 && other === secret)) {
      return fail("PREMIUM_AUDIT_KEY_REUSE", "Premium audit keys must not be reused by another security domain.");
    }
    seen.add(secret);
    normalized[keyId] = secret;
  }
  if (!Object.hasOwn(normalized, currentKeyId)) {
    return fail("PREMIUM_AUDIT_CURRENT_KEY_MISSING", "Premium audit currentKeyId must reference a retained key.");
  }
  return Object.freeze({ currentKeyId, keys: Object.freeze(normalized) });
}

export function parsePremiumAuditHmacKeyringV1(
  raw: string,
  disallowedSecrets: readonly string[] = [],
): PremiumAuditHmacKeyringV1 {
  if (Buffer.byteLength(raw, "utf8") > 8_192) {
    return fail("PREMIUM_AUDIT_KEYRING_TOO_LARGE", "Premium audit keyring JSON exceeds 8 KiB.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return fail("PREMIUM_AUDIT_KEYRING_INVALID", "PREMIUM_AUDIT_HMAC_KEYRING_JSON must be valid JSON.");
  }
  return assertPremiumAuditHmacKeyringV1(parsed, disallowedSecrets);
}

export function getPremiumAuditHmacKeyringV1(): PremiumAuditHmacKeyringV1 {
  const keyring = parsePremiumAuditHmacKeyringV1(
    getRequiredEnv("PREMIUM_AUDIT_HMAC_KEYRING_JSON"),
  );
  assertServerSecretSeparationV1(
    "premium_audit",
    Object.values(keyring.keys),
    "PREMIUM_AUDIT_KEY_REUSE",
  );
  return keyring;
}

export function premiumAuditSubjectV2(
  domain: "actor" | "session",
  rawSubject: string,
  keyId: string,
  secret: string,
): string {
  const bytes = Buffer.byteLength(rawSubject, "utf8");
  if (bytes < 1 || bytes > 512 || !KEY_ID_PATTERN.test(keyId)) {
    throw new ApiHttpError(500, "PREMIUM_AUDIT_SUBJECT_INVALID", "Premium audit subject is invalid.");
  }
  const digest = createHmac("sha256", secret)
    .update(`namespring-premium-audit\0v2\0${keyId}\0${domain}\0${rawSubject}`, "utf8")
    .digest("hex");
  return `premium_audit_${domain}_v2:${keyId}:${digest}`;
}

export function premiumAuditSubjectMatchesV2(
  domain: "actor" | "session",
  rawSubject: string,
  storedSubject: string,
  keyring: PremiumAuditHmacKeyringV1,
): boolean {
  const match = SUBJECT_PATTERNS[domain].exec(storedSubject);
  if (!match?.[1] || !match[2]) {
    throw new ApiHttpError(503, "PREMIUM_AUDIT_SUBJECT_INVALID", "Stored premium audit subject is invalid.");
  }
  const secret = keyring.keys[match[1]];
  if (!secret) {
    throw new ApiHttpError(
      503,
      "PREMIUM_AUDIT_KEY_NOT_RETAINED",
      "Stored premium audit subject references a non-retained key.",
    );
  }
  const expected = premiumAuditSubjectV2(domain, rawSubject, match[1], secret);
  const expectedBytes = Buffer.from(expected, "utf8");
  const actualBytes = Buffer.from(storedSubject, "utf8");
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export function premiumAuditActorV2(
  actor: PremiumActorV1,
  keyring: PremiumAuditHmacKeyringV1,
): PremiumActorV1 {
  const secret = keyring.keys[keyring.currentKeyId];
  if (!secret) return fail("PREMIUM_AUDIT_CURRENT_KEY_MISSING", "Premium audit current key is unavailable.");
  return {
    userId: premiumAuditSubjectV2("actor", actor.userId, keyring.currentKeyId, secret),
    sessionId: premiumAuditSubjectV2("session", actor.sessionId, keyring.currentKeyId, secret),
    roles: Object.freeze([...new Set(actor.roles)].sort()),
  };
}

export function premiumAuditDeleteAfterV1(occurredAt: string): string {
  const timestamp = Date.parse(occurredAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== occurredAt) {
    throw new ApiHttpError(500, "PREMIUM_AUDIT_TIME_INVALID", "Premium audit occurrence time is invalid.");
  }
  return new Date(timestamp + PREMIUM_AUDIT_RETENTION_DAYS_V1 * 86_400_000).toISOString();
}
