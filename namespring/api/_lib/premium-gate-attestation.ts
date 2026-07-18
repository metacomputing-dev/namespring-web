import { createHmac, timingSafeEqual } from "node:crypto";
import type { PremiumContentProvenanceV1 } from "../../shared/types/premium-service.js";
import { ApiHttpError } from "./http.js";
import { readContentGateAttestationKeyV1 } from "./content-validation.js";

export function premiumGateAttestationMaterialV1(input: {
  readonly scheme: "HMAC-SHA256-V1";
  readonly keyId: string;
  readonly subjectDigest: `sha256:${string}`;
  readonly gateVersion: string;
  readonly status: "passed" | "failed";
  readonly evaluatedAt: string;
  readonly resultDigest: `sha256:${string}`;
}): string {
  return [
    "namespring-premium-content-gate-attestation-v1",
    input.scheme,
    input.keyId,
    input.subjectDigest,
    input.gateVersion,
    input.status,
    input.evaluatedAt,
    input.resultDigest,
  ].join("\0");
}

/** Re-authenticate trusted-CI authority over the exact pre-review material. */
export function assertPremiumGateAttestationV1(
  provenance: PremiumContentProvenanceV1,
  expectedSubjectDigest: `sha256:${string}`,
): void {
  const attestation = provenance.gate?.attestation;
  if (provenance.gate?.status !== "passed" || !attestation
    || attestation.scheme !== "HMAC-SHA256-V1"
    || typeof attestation.keyId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(attestation.keyId)
    || attestation.subjectDigest !== expectedSubjectDigest
    || typeof attestation.signature !== "string" || !/^hmac-sha256:[a-f0-9]{64}$/u.test(attestation.signature)) {
    throw new ApiHttpError(403, "PREMIUM_GATE_ATTESTATION_INVALID", "Trusted premium content gate authority is invalid.");
  }
  const secret = readContentGateAttestationKeyV1(attestation.keyId);
  const expected = `hmac-sha256:${createHmac("sha256", secret).update(premiumGateAttestationMaterialV1({
    scheme: attestation.scheme,
    keyId: attestation.keyId,
    subjectDigest: attestation.subjectDigest,
    gateVersion: provenance.gate.gateVersion,
    status: provenance.gate.status,
    evaluatedAt: provenance.gate.evaluatedAt,
    resultDigest: provenance.gate.resultDigest,
  }), "utf8").digest("hex")}`;
  const suppliedBytes = Buffer.from(attestation.signature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    throw new ApiHttpError(403, "PREMIUM_GATE_ATTESTATION_INVALID", "Trusted premium content gate signature is invalid.");
  }
}
