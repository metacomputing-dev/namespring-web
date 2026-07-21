import { createHash, createHmac } from "node:crypto";
import type { PremiumEntitlementOwnerV1 } from "../../../lib/spring-ts/src/report/premium/index.js";
import { getRequiredEnv } from "./env.js";
import { ApiHttpError } from "./http.js";

const INTERNAL_USER_UUID_V4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const OWNER_V2_CUTOVER_STATES = new Set([
  "prelaunch_empty_v1_verified",
  "legacy_v1_migration_verified",
] as const);

export type PremiumOwnerV2CutoverState =
  | "prelaunch_empty_v1_verified"
  | "legacy_v1_migration_verified";

function assertInternalUserUuidV4(internalUserId: string): void {
  if (typeof internalUserId !== "string" || !INTERNAL_USER_UUID_V4.test(internalUserId)) {
    throw new ApiHttpError(400, "PREMIUM_USER_ID_INVALID", "Premium ownership requires a canonical internal UUIDv4.");
  }
}

export function assertPremiumOwnerV2CutoverState(value: string): PremiumOwnerV2CutoverState {
  if (!OWNER_V2_CUTOVER_STATES.has(value as PremiumOwnerV2CutoverState)) {
    throw new ApiHttpError(
      503,
      "PREMIUM_OWNER_V2_CUTOVER_UNVERIFIED",
      "Premium owner v2 requires a verified empty-v1 audit or completed legacy migration.",
    );
  }
  return value as PremiumOwnerV2CutoverState;
}

export function getPremiumOwnerV2CutoverState(): PremiumOwnerV2CutoverState {
  return assertPremiumOwnerV2CutoverState(getRequiredEnv("PREMIUM_OWNER_V2_CUTOVER_STATE"));
}

/**
 * Stable account binding. UUIDv4 supplies 122 bits of unpredictable input;
 * this domain/version hash never depends on an operator-rotated secret.
 */
export function premiumOwnerForInternalUserIdV2(
  internalUserId: string,
  cutoverState: PremiumOwnerV2CutoverState = getPremiumOwnerV2CutoverState(),
): PremiumEntitlementOwnerV1 {
  assertPremiumOwnerV2CutoverState(cutoverState);
  assertInternalUserUuidV4(internalUserId);
  const suffix = createHash("sha256")
    .update(`namespring-premium-owner\0v2\0${internalUserId}`, "utf8")
    .digest("base64url");
  return { kind: "account", subjectId: `premium_owner_v2_${suffix}` };
}

/**
 * Offline migration helper only. Runtime authorization must never fall back
 * from v2 to this legacy keyed identity or infer a cross-version owner link.
 */
export function legacyPremiumOwnerForInternalUserIdV1ForMigration(
  internalUserId: string,
  legacySecret: string,
): PremiumEntitlementOwnerV1 {
  assertInternalUserUuidV4(internalUserId);
  if (Buffer.byteLength(legacySecret, "utf8") < 32 || Buffer.byteLength(legacySecret, "utf8") > 256) {
    throw new ApiHttpError(500, "PREMIUM_OWNER_V1_MIGRATION_KEY_INVALID", "Legacy owner migration key must contain 32-256 bytes.");
  }
  const suffix = createHmac("sha256", legacySecret).update(internalUserId, "utf8").digest("base64url");
  return { kind: "account", subjectId: `premium_owner_v1_${suffix}` };
}

export function isLegacyPremiumOwnerV1(owner: PremiumEntitlementOwnerV1): boolean {
  return owner.kind === "account" && /^premium_owner_v1_[A-Za-z0-9_-]{16,128}$/u.test(owner.subjectId);
}
