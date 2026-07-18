import { createHash } from "node:crypto";

import type { PremiumRegistrationMaterialDigestV1 } from "../../../lib/spring-ts/src/report/premium/index.js";
import type {
  PremiumDataProcessingConsentAcceptanceV1,
  PremiumDataProcessingConsentReceiptV1,
  PremiumPurchaseTermsAcceptanceV1,
  PremiumPurchaseTermsReceiptV1,
} from "../../shared/types/premium-service.js";
import { getOptionalEnv } from "./env.js";
import { ApiHttpError } from "./http.js";

export interface PremiumPolicyContractV1 {
  readonly schemaVersion: "namespring.premium-policy-contract.v1";
  readonly dataProcessing: {
    readonly noticeVersion: string;
    readonly noticeDigest: `sha256:${string}`;
    readonly purpose: "premium_report_server_recomputation";
  };
  readonly purchase: {
    readonly termsVersion: string;
    readonly termsDigest: `sha256:${string}`;
    readonly refundPolicyVersion: string;
    readonly refundPolicyDigest: `sha256:${string}`;
  };
}

const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/u;
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const CLIENT_FUTURE_MAX_MS = 5 * 60 * 1_000;

let cachedSource: string | undefined;
let cachedContract: PremiumPolicyContractV1 | undefined;

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value as Record<string, unknown>).sort().join("|") === [...keys].sort().join("|");
}

function invalid(message: string): never {
  throw new ApiHttpError(503, "PREMIUM_POLICY_CONTRACT_INVALID", message);
}

function canonicalTime(value: unknown, field: string): string {
  if (typeof value !== "string") return invalid(`${field} is invalid.`);
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== value) {
    return invalid(`${field} is invalid.`);
  }
  return value;
}

function digest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")}`;
}

export function parsePremiumPolicyContractV1(raw: string): PremiumPolicyContractV1 {
  if (Buffer.byteLength(raw, "utf8") > 8 * 1024) return invalid("Premium policy contract exceeds 8 KiB.");
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return invalid("Premium policy contract must be valid JSON.");
  }
  if (!exactObject(value, ["schemaVersion", "dataProcessing", "purchase"])
    || value.schemaVersion !== "namespring.premium-policy-contract.v1"
    || !exactObject(value.dataProcessing, ["noticeVersion", "noticeDigest", "purpose"])
    || !exactObject(value.purchase, ["termsVersion", "termsDigest", "refundPolicyVersion", "refundPolicyDigest"])) {
    return invalid("Premium policy contract has an invalid shape.");
  }
  const data = value.dataProcessing;
  const purchase = value.purchase;
  if (typeof data.noticeVersion !== "string" || !VERSION.test(data.noticeVersion)
    || typeof data.noticeDigest !== "string" || !DIGEST.test(data.noticeDigest)
    || data.purpose !== "premium_report_server_recomputation"
    || typeof purchase.termsVersion !== "string" || !VERSION.test(purchase.termsVersion)
    || typeof purchase.termsDigest !== "string" || !DIGEST.test(purchase.termsDigest)
    || typeof purchase.refundPolicyVersion !== "string" || !VERSION.test(purchase.refundPolicyVersion)
    || typeof purchase.refundPolicyDigest !== "string" || !DIGEST.test(purchase.refundPolicyDigest)) {
    return invalid("Premium policy versions or digests are invalid.");
  }
  return Object.freeze({
    schemaVersion: "namespring.premium-policy-contract.v1",
    dataProcessing: Object.freeze({
      noticeVersion: data.noticeVersion,
      noticeDigest: data.noticeDigest as `sha256:${string}`,
      purpose: data.purpose,
    }),
    purchase: Object.freeze({
      termsVersion: purchase.termsVersion,
      termsDigest: purchase.termsDigest as `sha256:${string}`,
      refundPolicyVersion: purchase.refundPolicyVersion,
      refundPolicyDigest: purchase.refundPolicyDigest as `sha256:${string}`,
    }),
  });
}

export function getPremiumPolicyContractV1(): PremiumPolicyContractV1 {
  const source = getOptionalEnv("PREMIUM_POLICY_CONTRACT_JSON");
  if (!source) {
    throw new ApiHttpError(503, "PREMIUM_POLICY_NOT_CONFIGURED", "Premium policy contract is not configured.");
  }
  if (cachedContract && cachedSource === source) return cachedContract;
  cachedSource = source;
  cachedContract = parsePremiumPolicyContractV1(source);
  return cachedContract;
}

export function getPremiumPolicyCapabilityV1():
  | { readonly configured: false; readonly disabledReason: "policy_not_configured" }
  | { readonly configured: true; readonly contract: PremiumPolicyContractV1 } {
  if (!getOptionalEnv("PREMIUM_POLICY_CONTRACT_JSON")) {
    return { configured: false, disabledReason: "policy_not_configured" };
  }
  return { configured: true, contract: getPremiumPolicyContractV1() };
}

function assertClientTime(clientAcceptedAt: string, recordedAt: string): void {
  const clientEpoch = Date.parse(canonicalTime(clientAcceptedAt, "clientAcceptedAt"));
  const serverEpoch = Date.parse(canonicalTime(recordedAt, "recordedAt"));
  // Client time is reference evidence only. Server recordedAt is authoritative,
  // so an old canonical timestamp remains replayable while future skew is not.
  if (clientEpoch > serverEpoch + CLIENT_FUTURE_MAX_MS) {
    throw new ApiHttpError(409, "PREMIUM_POLICY_ACCEPTANCE_STALE", "Policy acceptance timestamp is stale.");
  }
}

export function buildPremiumDataProcessingConsentReceiptV1(
  acceptance: PremiumDataProcessingConsentAcceptanceV1,
  registrationMaterialDigest: PremiumRegistrationMaterialDigestV1,
  recordedAt: string,
): PremiumDataProcessingConsentReceiptV1 {
  const current = getPremiumPolicyContractV1().dataProcessing;
  if (!exactObject(acceptance, ["accepted", "noticeVersion", "noticeDigest", "purpose", "clientAcceptedAt"])
    || acceptance.accepted !== true
    || acceptance.noticeVersion !== current.noticeVersion
    || acceptance.noticeDigest !== current.noticeDigest
    || acceptance.purpose !== current.purpose) {
    throw new ApiHttpError(409, "PREMIUM_DATA_CONSENT_REQUIRED", "Current data-processing consent is required.");
  }
  assertClientTime(acceptance.clientAcceptedAt, recordedAt);
  const acceptanceDigest = digest({ domain: "premium-data-processing-consent-v1", ...acceptance });
  const bindingDigest = digest({
    domain: "premium-registration-consent-binding-v1",
    registrationMaterialDigest,
    acceptanceDigest,
    recordedAt,
  });
  return {
    ...acceptance,
    recordedAt,
    registrationMaterialDigest,
    acceptanceDigest,
    bindingDigest,
  };
}

export function premiumDataConsentAcceptanceDigestV1(
  acceptance: PremiumDataProcessingConsentAcceptanceV1,
): `sha256:${string}` {
  return digest({ domain: "premium-data-processing-consent-v1", ...acceptance });
}

export function buildPremiumPurchaseTermsReceiptV1(
  acceptance: PremiumPurchaseTermsAcceptanceV1,
  checkoutMaterial: unknown,
  recordedAt: string,
): PremiumPurchaseTermsReceiptV1 {
  const current = getPremiumPolicyContractV1().purchase;
  if (!exactObject(acceptance, [
    "accepted", "termsVersion", "termsDigest", "refundPolicyVersion", "refundPolicyDigest", "clientAcceptedAt",
  ]) || acceptance.accepted !== true
    || acceptance.termsVersion !== current.termsVersion
    || acceptance.termsDigest !== current.termsDigest
    || acceptance.refundPolicyVersion !== current.refundPolicyVersion
    || acceptance.refundPolicyDigest !== current.refundPolicyDigest) {
    throw new ApiHttpError(409, "PREMIUM_PURCHASE_TERMS_REQUIRED", "Current purchase and refund terms are required.");
  }
  assertClientTime(acceptance.clientAcceptedAt, recordedAt);
  const acceptanceDigest = digest({ domain: "premium-purchase-terms-acceptance-v1", ...acceptance });
  const bindingDigest = digest({
    domain: "premium-checkout-terms-binding-v1",
    checkoutMaterial,
    acceptanceDigest,
    recordedAt,
  });
  return { ...acceptance, recordedAt, acceptanceDigest, bindingDigest };
}
