import { timingSafeEqual } from "node:crypto";
import { ApiHttpError } from "./http.js";

export const SERVER_SECRET_DOMAINS_V1 = [
  "auth_identity_binding",
  "auth_audit",
  "auth_role_provisioning",
  "rate_limit",
  "sync_deletion",
  "maintenance_cron",
  "toss",
  "content_gate",
  "content_audit",
  "premium_audit",
  "premium_encryption",
  "retired_premium_owner",
] as const;

export type ServerSecretDomainV1 = (typeof SERVER_SECRET_DOMAINS_V1)[number];

type SecretValueV1 = string | Uint8Array;

interface ConfiguredSecretMaterialV1 {
  readonly domain: ServerSecretDomainV1;
  readonly bytes: Buffer;
}

interface RawSecretEnvironmentConfigV1 {
  readonly domain: ServerSecretDomainV1;
  readonly normalize: "trim" | "exact";
  readonly usable: (value: string) => boolean;
}

const utf8BytesBetween = (minimum: number, maximum = Number.POSITIVE_INFINITY) => (value: string) => {
  const bytes = Buffer.byteLength(value, "utf8");
  return bytes >= minimum && bytes <= maximum;
};

const RAW_SECRET_ENVIRONMENTS_V1: Readonly<Record<string, RawSecretEnvironmentConfigV1>> = Object.freeze({
  AUTH_IDENTITY_BINDING_HMAC_KEY: {
    domain: "auth_identity_binding",
    normalize: "exact",
    usable: (value) => value.trim() === value
      && !/[\u0000-\u001f\u007f]/u.test(value)
      && utf8BytesBetween(32, 256)(value),
  },
  AUTH_AUDIT_HMAC_KEY: {
    domain: "auth_audit",
    normalize: "trim",
    usable: utf8BytesBetween(32),
  },
  AUTH_ROLE_PROVISIONING_HMAC_KEY: {
    domain: "auth_role_provisioning",
    normalize: "trim",
    usable: utf8BytesBetween(32, 256),
  },
  RATE_LIMIT_HMAC_KEY: {
    domain: "rate_limit",
    normalize: "trim",
    usable: utf8BytesBetween(32),
  },
  SYNC_DELETION_HASH_PEPPER: {
    domain: "sync_deletion",
    normalize: "trim",
    // AccountSyncServiceV1 currently specifies characters, not UTF-8 bytes.
    usable: (value) => value.length >= 32,
  },
  CRON_SECRET: {
    domain: "maintenance_cron",
    normalize: "exact",
    usable: (value) => value.trim() === value
      && !/[\u0000-\u001f\u007f]/u.test(value)
      && !value.includes(",")
      && utf8BytesBetween(32, 512)(value),
  },
  TOSS_SECRET_KEY: {
    domain: "toss",
    normalize: "trim",
    usable: (value) => value.length > 0,
  },
  PREMIUM_OWNER_DERIVATION_SECRET: {
    domain: "retired_premium_owner",
    normalize: "exact",
    usable: utf8BytesBetween(32, 256),
  },
});

type JsonSecretEnvironmentConfigV1 = {
  readonly domain: ServerSecretDomainV1;
  readonly encoding: "utf8";
  readonly shape: "flat" | "keyring";
  readonly minimumBytes: number;
  readonly maximumBytes?: number;
} | {
  readonly domain: ServerSecretDomainV1;
  readonly encoding: "base64";
  readonly shape: "flat" | "keyring";
  readonly decodedBytes: number;
};

const JSON_SECRET_ENVIRONMENTS_V1: Readonly<Record<string, JsonSecretEnvironmentConfigV1>> = Object.freeze({
  CONTENT_GATE_ATTESTATION_KEYRING_JSON: {
    domain: "content_gate",
    encoding: "utf8",
    shape: "flat",
    minimumBytes: 32,
    maximumBytes: 256,
  },
  CONTENT_AUDIT_HMAC_KEYRING_JSON: {
    domain: "content_audit",
    encoding: "utf8",
    shape: "keyring",
    minimumBytes: 32,
    maximumBytes: 256,
  },
  PREMIUM_AUDIT_HMAC_KEYRING_JSON: {
    domain: "premium_audit",
    encoding: "utf8",
    shape: "keyring",
    minimumBytes: 32,
    maximumBytes: 256,
  },
  PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON: {
    domain: "premium_encryption",
    encoding: "base64",
    shape: "keyring",
    decodedBytes: 32,
  },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function secretBuffer(value: SecretValueV1): Buffer {
  return typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
}

function canonicalBase64Bytes(value: string): Buffer | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(value) || value.length % 4 === 1) return null;
  const decoded = Buffer.from(value, "base64");
  if (decoded.byteLength === 0
    || decoded.toString("base64").replace(/=+$/u, "") !== value.replace(/=+$/u, "")) return null;
  return decoded;
}

function jsonSecretStrings(
  raw: string,
  shape: "flat" | "keyring",
): readonly string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return [];
    const source = shape === "keyring" ? parsed.keys : parsed;
    // A malformed nested keyring is intentionally ignored here. Its owning
    // parser remains responsible for the stable configuration error; treating
    // currentKeyId or other metadata as secret material would create an
    // unrelated-domain false positive.
    if (!isRecord(source)) return [];
    const values = Object.values(source);
    return values.filter((value): value is string => typeof value === "string" && value.length > 0);
  } catch {
    // The owning parser reports malformed configuration with its own stable
    // error. Separation checks must not reinterpret an unrelated domain's
    // malformed JSON or reflect any part of it.
    return [];
  }
}

function configuredMaterialsV1(): readonly ConfiguredSecretMaterialV1[] {
  const materials: ConfiguredSecretMaterialV1[] = [];
  for (const [environmentName, config] of Object.entries(RAW_SECRET_ENVIRONMENTS_V1)) {
    const configured = process.env[environmentName];
    if (!configured) continue;
    const value = config.normalize === "trim" ? configured.trim() : configured;
    if (config.usable(value)) {
      materials.push({ domain: config.domain, bytes: Buffer.from(value, "utf8") });
    }
  }
  for (const [environmentName, config] of Object.entries(JSON_SECRET_ENVIRONMENTS_V1)) {
    const raw = process.env[environmentName];
    if (!raw) continue;
    for (const value of jsonSecretStrings(raw, config.shape)) {
      // Comparing both the serialized value and canonical decoded AES bytes
      // catches copy/paste reuse and byte-for-byte reuse across encodings.
      if (config.encoding === "base64") {
        const decoded = canonicalBase64Bytes(value);
        // Match the owning premium encryption parser exactly: malformed or
        // non-32-byte entries are not usable secrets and must not make another
        // otherwise valid service fail with a misleading reuse error.
        if (!decoded || decoded.byteLength !== config.decodedBytes) continue;
        materials.push({ domain: config.domain, bytes: Buffer.from(value, "utf8") });
        materials.push({ domain: config.domain, bytes: decoded });
        continue;
      }
      const bytes = Buffer.from(value, "utf8");
      if (bytes.byteLength < config.minimumBytes
        || (config.maximumBytes !== undefined && bytes.byteLength > config.maximumBytes)) continue;
      materials.push({ domain: config.domain, bytes });
    }
  }
  return materials;
}

function sameSecret(left: Buffer, right: Buffer): boolean {
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

/**
 * Rejects byte-for-byte reuse between server security domains.
 *
 * The caller first validates its own key shape and then supplies the exact
 * material it will use. Configuration for other domains is inspected only to
 * compare bytes; no value or conflicting domain is ever included in an error.
 */
export function assertServerSecretSeparationV1(
  domain: ServerSecretDomainV1,
  ownSecrets: readonly SecretValueV1[],
  errorCode = "SERVER_SECRET_REUSE",
): void {
  if (!(SERVER_SECRET_DOMAINS_V1 as readonly string[]).includes(domain)
    || !/^[A-Z][A-Z0-9_]{2,63}$/u.test(errorCode)) {
    throw new ApiHttpError(500, "SERVER_SECRET_POLICY_INVALID", "Server secret policy is invalid.");
  }
  const own = ownSecrets.flatMap((value) => {
    const bytes = secretBuffer(value);
    if (domain !== "premium_encryption" || typeof value !== "string") return [bytes];
    const decoded = canonicalBase64Bytes(value);
    return decoded?.byteLength === 32 ? [bytes, decoded] : [bytes];
  });
  if (own.some((value) => value.byteLength === 0)) {
    throw new ApiHttpError(500, "SERVER_SECRET_POLICY_INVALID", "Server secret policy is invalid.");
  }
  const external = configuredMaterialsV1().filter((entry) => entry.domain !== domain);
  if (own.some((candidate) => external.some((entry) => sameSecret(candidate, entry.bytes)))) {
    throw new ApiHttpError(500, errorCode, "This server security domain requires independently generated secret material.");
  }
}
