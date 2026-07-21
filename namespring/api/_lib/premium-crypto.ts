import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import type { ReportDeliveryV1 } from "../../../lib/spring-ts/src/report/delivery/index.js";
import {
  PREMIUM_SEALED_ANALYSIS_SCHEMA_V1,
  type PremiumSealedAnalysisPayloadV1,
  type PremiumServerAnalysisPlaintextV1,
} from "../../shared/types/premium-service.js";
import { getOptionalEnv } from "./env.js";
import { ApiHttpError } from "./http.js";
import { assertServerSecretSeparationV1 } from "./server-secret-separation.js";

interface KeyringConfig {
  readonly currentKeyId: string;
  readonly keys: Readonly<Record<string, string>>;
}

interface DecodedKeyring {
  readonly currentKeyId: string;
  readonly keys: ReadonlyMap<string, Buffer>;
  readonly separationMaterials: readonly (string | Buffer)[];
}

export interface PremiumSealedJsonRecordV1 {
  readonly schemaVersion: "namespring.premium-sealed-json-record.v1";
  readonly algorithm: "A256GCM";
  readonly keyId: string;
  readonly iv: string;
  readonly ciphertext: string;
  readonly authenticationTag: string;
}

let cachedKeyringSource: string | null = null;
let cachedKeyring: DecodedKeyring | null = null;

function invalidConfiguration(message: string, cause?: unknown): never {
  throw new ApiHttpError(500, "PREMIUM_ENCRYPTION_NOT_CONFIGURED", message, cause);
}

function readKeyring(): DecodedKeyring {
  const source = getOptionalEnv("PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON");
  if (!source) {
    invalidConfiguration(
      "PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON is required for premium report persistence.",
    );
  }
  if (cachedKeyring && cachedKeyringSource === source) {
    assertServerSecretSeparationV1(
      "premium_encryption",
      cachedKeyring.separationMaterials,
      "PREMIUM_ENCRYPTION_KEY_REUSE",
    );
    return cachedKeyring;
  }

  let raw: KeyringConfig;
  try {
    raw = JSON.parse(source) as KeyringConfig;
  } catch (error) {
    invalidConfiguration("Premium analysis keyring must be valid JSON.", error);
  }
  if (!raw || typeof raw.currentKeyId !== "string" || !raw.currentKeyId.trim()
    || !raw.keys || typeof raw.keys !== "object" || Array.isArray(raw.keys)) {
    invalidConfiguration("Premium analysis keyring has an invalid shape.");
  }

  const keys = new Map<string, Buffer>();
  const separationMaterials: Array<string | Buffer> = [];
  for (const [keyId, encoded] of Object.entries(raw.keys)) {
    if (!/^[A-Za-z0-9._-]{1,64}$/u.test(keyId) || typeof encoded !== "string") {
      invalidConfiguration("Premium analysis key identifiers must be stable opaque strings.");
    }
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32 || key.toString("base64").replace(/=+$/u, "")
      !== encoded.replace(/=+$/u, "")) {
      invalidConfiguration(`Premium analysis key ${keyId} must be exactly 32 base64 bytes.`);
    }
    keys.set(keyId, key);
    separationMaterials.push(encoded, key);
  }
  if (!keys.has(raw.currentKeyId)) {
    invalidConfiguration("The premium analysis currentKeyId is not present in keys.");
  }

  assertServerSecretSeparationV1(
    "premium_encryption",
    separationMaterials,
    "PREMIUM_ENCRYPTION_KEY_REUSE",
  );
  cachedKeyringSource = source;
  cachedKeyring = { currentKeyId: raw.currentKeyId, keys, separationMaterials };
  return cachedKeyring;
}

function aadForAnalysis(analysisId: string, reportId: string, materialDigest: string): Buffer {
  return Buffer.from(`namespring/premium-analysis/v1\n${analysisId}\n${reportId}\n${materialDigest}`, "utf8");
}

function aadForRecord(context: string): Buffer {
  return Buffer.from(`namespring/premium-record/v1\n${context}`, "utf8");
}

export function sealPremiumJsonRecordV1(context: string, value: unknown): PremiumSealedJsonRecordV1 {
  const keyring = readKeyring();
  const key = keyring.keys.get(keyring.currentKeyId);
  if (!key) invalidConfiguration("The current premium encryption key is unavailable.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aadForRecord(context));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return {
    schemaVersion: "namespring.premium-sealed-json-record.v1",
    algorithm: "A256GCM",
    keyId: keyring.currentKeyId,
    iv: iv.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    authenticationTag: cipher.getAuthTag().toString("base64url"),
  };
}

export function openPremiumJsonRecordV1<T>(context: string, sealed: unknown): T {
  if (!sealed || typeof sealed !== "object" || Array.isArray(sealed)
    || (sealed as { schemaVersion?: unknown }).schemaVersion !== "namespring.premium-sealed-json-record.v1") {
    throw new ApiHttpError(500, "PREMIUM_RECORD_NOT_SEALED", "Sensitive premium record is not sealed.");
  }
  const payload = sealed as PremiumSealedJsonRecordV1;
  const key = readKeyring().keys.get(payload.keyId);
  if (!key) throw new ApiHttpError(500, "PREMIUM_ANALYSIS_KEY_UNAVAILABLE", "Record decryption key is unavailable.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64url"));
    decipher.setAAD(aadForRecord(context));
    decipher.setAuthTag(Buffer.from(payload.authenticationTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch (error) {
    throw new ApiHttpError(500, "PREMIUM_RECORD_CORRUPT", "Premium record authentication failed.", error);
  }
}

export function sealPremiumAnalysisDeliveryV1(params: {
  readonly analysisId: string;
  readonly reportId: string;
  readonly materialDigest: string;
  readonly delivery: ReportDeliveryV1;
}): PremiumSealedAnalysisPayloadV1 {
  const keyring = readKeyring();
  const key = keyring.keys.get(keyring.currentKeyId);
  if (!key) invalidConfiguration("The current premium analysis encryption key is unavailable.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aadForAnalysis(params.analysisId, params.reportId, params.materialDigest));
  const plaintext: PremiumServerAnalysisPlaintextV1 = { delivery: params.delivery };
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(plaintext), "utf8"),
    cipher.final(),
  ]);

  return {
    schemaVersion: PREMIUM_SEALED_ANALYSIS_SCHEMA_V1,
    algorithm: "A256GCM",
    keyId: keyring.currentKeyId,
    iv: iv.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    authenticationTag: cipher.getAuthTag().toString("base64url"),
  };
}

export function openPremiumAnalysisDeliveryV1(params: {
  readonly analysisId: string;
  readonly reportId: string;
  readonly materialDigest: string;
  readonly sealed: PremiumSealedAnalysisPayloadV1;
}): ReportDeliveryV1 {
  if (params.sealed.schemaVersion !== PREMIUM_SEALED_ANALYSIS_SCHEMA_V1
    || params.sealed.algorithm !== "A256GCM") {
    throw new ApiHttpError(500, "PREMIUM_ANALYSIS_CORRUPT", "Unsupported sealed analysis payload.");
  }
  const key = readKeyring().keys.get(params.sealed.keyId);
  if (!key) {
    throw new ApiHttpError(500, "PREMIUM_ANALYSIS_KEY_UNAVAILABLE", "Analysis decryption key is unavailable.");
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(params.sealed.iv, "base64url"),
    );
    decipher.setAAD(aadForAnalysis(params.analysisId, params.reportId, params.materialDigest));
    decipher.setAuthTag(Buffer.from(params.sealed.authenticationTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(params.sealed.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as PremiumServerAnalysisPlaintextV1;
    if (!parsed || typeof parsed !== "object" || !parsed.delivery) throw new Error("delivery missing");
    return parsed.delivery;
  } catch (error) {
    throw new ApiHttpError(500, "PREMIUM_ANALYSIS_CORRUPT", "Analysis authentication failed.", error);
  }
}
