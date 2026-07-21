import { createHmac } from "node:crypto";
import { ApiHttpError } from "./http.js";
import { getRequiredEnv } from "./env.js";
import { assertServerSecretSeparationV1 } from "./server-secret-separation.js";

export const AUTH_AUDIT_RETENTION_DAYS_V1 = 365 as const;
export const AUTH_DELETION_JOB_RETENTION_DAYS_V1 = 30 as const;

export type AuthAuditSubjectHashV1 = `hmac-sha256:${string}`;

export function assertAuthAuditHmacKeyV1(
  key: string,
  disallowedKeys: readonly string[] = [],
): string {
  if (Buffer.byteLength(key, "utf8") < 32) {
    throw new ApiHttpError(500, "AUTH_AUDIT_KEY_INVALID", "AUTH_AUDIT_HMAC_KEY must contain at least 32 bytes.");
  }
  if (disallowedKeys.some((other) => other.length > 0 && other === key)) {
    throw new ApiHttpError(500, "AUTH_AUDIT_KEY_REUSE", "Authentication audit pseudonymization requires a dedicated secret.");
  }
  return key;
}

export function getAuthAuditHmacKeyV1(): string {
  const key = assertAuthAuditHmacKeyV1(
    getRequiredEnv("AUTH_AUDIT_HMAC_KEY"),
    [
      process.env.PREMIUM_OWNER_DERIVATION_SECRET ?? "",
      process.env.SYNC_DELETION_HASH_PEPPER ?? "",
      process.env.RATE_LIMIT_HMAC_KEY ?? "",
    ],
  );
  assertServerSecretSeparationV1("auth_audit", [key], "AUTH_AUDIT_KEY_REUSE");
  return key;
}

export function authAuditSubjectHashV1(
  internalUserId: string,
  hmacKey: string,
): AuthAuditSubjectHashV1 {
  if (!internalUserId || Buffer.byteLength(internalUserId, "utf8") > 256) {
    throw new ApiHttpError(500, "AUTH_AUDIT_SUBJECT_INVALID", "Authentication audit subject is invalid.");
  }
  const digest = createHmac("sha256", hmacKey).update(internalUserId, "utf8").digest("hex");
  return `hmac-sha256:${digest}`;
}

export function authAuditOpaqueValueHashV1(
  domain: "lifecycle_job_request",
  value: string,
  hmacKey: string,
): AuthAuditSubjectHashV1 {
  if (!/^[a-z_]{1,64}$/u.test(domain)
    || !value || Buffer.byteLength(value, "utf8") > 256) {
    throw new ApiHttpError(500, "AUTH_AUDIT_VALUE_INVALID", "Authentication audit value is invalid.");
  }
  const digest = createHmac("sha256", hmacKey)
    .update(`namespring.auth.audit.${domain}.v1`, "utf8")
    .update("\0", "utf8")
    .update(value, "utf8")
    .digest("hex");
  return `hmac-sha256:${digest}`;
}

export function retentionDeadlineV1(occurredAt: string, days: number): string {
  const timestamp = Date.parse(occurredAt);
  if (!Number.isFinite(timestamp) || !Number.isInteger(days) || days < 1 || days > 3_650) {
    throw new ApiHttpError(500, "AUTH_RETENTION_DEADLINE_INVALID", "Authentication retention deadline is invalid.");
  }
  return new Date(timestamp + days * 86_400_000).toISOString();
}
