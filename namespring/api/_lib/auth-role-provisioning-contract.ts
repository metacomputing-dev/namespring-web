import { createHmac } from "node:crypto";
import { ApiHttpError } from "./http.js";
import { assertServerSecretSeparationV1 } from "./server-secret-separation.js";

export const AUTH_ROLE_PROVISIONING_SCHEMA_V1 = "namespring.auth-role-provisioning-receipt.v1" as const;
export const AUTH_ROLE_PROVISIONING_RETENTION_DAYS_V1 = 365;
export const AUTH_ROLE_PROVISIONING_LEASE_MS_V1 = 2 * 60_000;
export const AUTH_ROLE_PROVISIONING_MAX_FIREBASE_UIDS_V1 = 20;
export const AUTH_ROLE_PROVISIONING_CLAIMS_MAX_BYTES_V1 = 1_000;

export const AUTH_ROLE_PROVISIONING_GRANTABLE_ROLES_V1 = ["admin", "premium_admin"] as const;
export const AUTH_ROLE_PROVISIONING_CLEANUP_ONLY_ROLES_V1 = ["premium_system"] as const;
export const AUTH_ROLE_PROVISIONING_REQUEST_ROLES_V1 = [
  ...AUTH_ROLE_PROVISIONING_GRANTABLE_ROLES_V1,
  ...AUTH_ROLE_PROVISIONING_CLEANUP_ONLY_ROLES_V1,
] as const;

export type AuthRoleProvisioningGrantableRoleV1 = (typeof AUTH_ROLE_PROVISIONING_GRANTABLE_ROLES_V1)[number];
export type AuthRoleProvisioningCleanupOnlyRoleV1 = (typeof AUTH_ROLE_PROVISIONING_CLEANUP_ONLY_ROLES_V1)[number];
export type AuthRoleProvisioningRoleV1 = (typeof AUTH_ROLE_PROVISIONING_REQUEST_ROLES_V1)[number];
export type AuthRoleProvisioningOperationV1 = "grant" | "revoke";
export type AuthRoleProvisioningStatusV1 = "dry_run" | "pending" | "completed";
export type AuthRoleProvisioningStageV1 =
  | "dry_run"
  | "reserved"
  | "persisted_role_revoked"
  | "claims_applied"
  | "sessions_revoked"
  | "persisted_role_granted"
  | "completed";

export type AuthRoleProvisioningSubjectHashV1 = `hmac-sha256:${string}`;

export interface AuthRoleProvisioningReceiptV1 {
  readonly schemaVersion: typeof AUTH_ROLE_PROVISIONING_SCHEMA_V1;
  readonly requestId: string;
  readonly targetSubjectHash: AuthRoleProvisioningSubjectHashV1;
  readonly operatorSubjectHash: AuthRoleProvisioningSubjectHashV1;
  readonly operation: AuthRoleProvisioningOperationV1;
  readonly role: AuthRoleProvisioningRoleV1;
  readonly beforeRoles: readonly string[];
  readonly afterRoles: readonly string[];
  readonly stage: AuthRoleProvisioningStageV1;
  readonly status: AuthRoleProvisioningStatusV1;
  readonly updatedAt: string;
  /** Null for dry-runs and unresolved jobs; completed receipts expire after 365 days. */
  readonly deleteAfter: string | null;
}

export interface AuthRoleProvisioningTargetV1 {
  readonly internalUserId: string;
  readonly firebaseUids: readonly string[];
  readonly roles: readonly string[];
}

const ROLE_ORDER_V1 = ["user", "admin", "premium_admin", "premium_system"] as const;
const REQUEST_ID_PATTERN_V1 = /^role_request_v1_[A-Za-z0-9_-]{16,64}$/u;
const OPERATOR_REF_PATTERN_V1 = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,127}$/u;
const FIREBASE_UID_PATTERN_V1 = /^[^\u0000-\u001f\u007f/]{1,128}$/u;

function canonicalIso(value: string, code: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new ApiHttpError(500, code, "Role provisioning time is invalid.");
  }
  return value;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function requireAuthRoleProvisioningRequestIdV1(value: unknown): string {
  if (typeof value !== "string" || !REQUEST_ID_PATTERN_V1.test(value)) {
    throw new ApiHttpError(
      400,
      "ROLE_PROVISIONING_REQUEST_ID_INVALID",
      "requestId must use role_request_v1_ followed by 16-64 URL-safe characters.",
    );
  }
  return value;
}

export function requireAuthRoleProvisioningOperatorRefV1(value: unknown): string {
  if (typeof value !== "string" || !OPERATOR_REF_PATTERN_V1.test(value)) {
    throw new ApiHttpError(400, "ROLE_PROVISIONING_OPERATOR_INVALID", "A bounded non-empty operator reference is required.");
  }
  return value;
}

export function requireAuthRoleProvisioningFirebaseUidV1(value: unknown): string {
  if (typeof value !== "string" || !FIREBASE_UID_PATTERN_V1.test(value)) {
    throw new ApiHttpError(400, "ROLE_PROVISIONING_TARGET_INVALID", "A valid Firebase UID is required.");
  }
  return value;
}

export function requireAuthRoleProvisioningOperationV1(value: unknown): AuthRoleProvisioningOperationV1 {
  if (value !== "grant" && value !== "revoke") {
    throw new ApiHttpError(400, "ROLE_PROVISIONING_OPERATION_INVALID", "operation must be grant or revoke.");
  }
  return value;
}

export function requireAuthRoleProvisioningRoleV1(value: unknown): AuthRoleProvisioningRoleV1 {
  if (typeof value !== "string" || !(AUTH_ROLE_PROVISIONING_REQUEST_ROLES_V1 as readonly string[]).includes(value)) {
    throw new ApiHttpError(
      400,
      value === "user" ? "ROLE_PROVISIONING_USER_IMMUTABLE" : "ROLE_PROVISIONING_ROLE_INVALID",
      value === "user" ? "The baseline user role is immutable." : "The requested account role is not provisionable.",
    );
  }
  return value as AuthRoleProvisioningRoleV1;
}

export function assertAuthRoleProvisioningOperationAllowedV1(
  operation: AuthRoleProvisioningOperationV1,
  role: AuthRoleProvisioningRoleV1,
): void {
  if (operation === "grant" && role === "premium_system") {
    throw new ApiHttpError(
      409,
      "ROLE_PROVISIONING_SYSTEM_ROLE_GRANT_FORBIDDEN",
      "premium_system is reserved for service actors and may only be removed from human accounts.",
    );
  }
}

export function canonicalAccountRolesV1(
  roles: readonly string[],
  operation?: AuthRoleProvisioningOperationV1,
  requestedRole?: AuthRoleProvisioningRoleV1,
): string[] {
  if (!Array.isArray(roles)
    || roles.length < 1
    || roles.length > ROLE_ORDER_V1.length
    || roles.some((role) => typeof role !== "string")
    || unique(roles).length !== roles.length
    || !roles.includes("user")) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_ACCOUNT_ROLES_INVALID", "Persisted account roles are invalid.");
  }
  const unknown = roles.filter((role) => !(ROLE_ORDER_V1 as readonly string[]).includes(role));
  if (unknown.length > 0) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_ACCOUNT_ROLES_INVALID", "Persisted account roles are invalid.");
  }
  if (roles.includes("premium_system") && !(operation === "revoke" && requestedRole === "premium_system")) {
    throw new ApiHttpError(
      409,
      "ROLE_PROVISIONING_SYSTEM_ROLE_CONTAMINATION",
      "A human account contains premium_system; run the explicit emergency revoke before other role changes.",
    );
  }
  return ROLE_ORDER_V1.filter((role) => roles.includes(role));
}

export function desiredAccountRolesV1(
  beforeRoles: readonly string[],
  operation: AuthRoleProvisioningOperationV1,
  role: AuthRoleProvisioningRoleV1,
): string[] {
  assertAuthRoleProvisioningOperationAllowedV1(operation, role);
  const before = canonicalAccountRolesV1(beforeRoles, operation, role);
  const desired = operation === "grant"
    ? unique([...before, role])
    : before.filter((current) => current !== role);
  return ROLE_ORDER_V1.filter((current) => desired.includes(current));
}

export function assertAuthRoleProvisioningTargetV1(
  target: AuthRoleProvisioningTargetV1,
  operation: AuthRoleProvisioningOperationV1,
  role: AuthRoleProvisioningRoleV1,
): AuthRoleProvisioningTargetV1 {
  if (typeof target.internalUserId !== "string" || target.internalUserId.length < 1 || target.internalUserId.length > 128) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_ACCOUNT_INVALID", "Role provisioning account data is invalid.");
  }
  if (!Array.isArray(target.firebaseUids)
    || target.firebaseUids.length < 1
    || target.firebaseUids.length > AUTH_ROLE_PROVISIONING_MAX_FIREBASE_UIDS_V1
    || unique(target.firebaseUids).length !== target.firebaseUids.length) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_FIREBASE_UIDS_INVALID", "Role provisioning principal data is invalid.");
  }
  for (const uid of target.firebaseUids) requireAuthRoleProvisioningFirebaseUidV1(uid);
  return {
    internalUserId: target.internalUserId,
    firebaseUids: [...target.firebaseUids].sort(),
    roles: canonicalAccountRolesV1(target.roles, operation, role),
  };
}

export function getAuthRoleProvisioningHmacKeyV1(): string {
  const value = process.env.AUTH_ROLE_PROVISIONING_HMAC_KEY?.trim() ?? "";
  if (Buffer.byteLength(value, "utf8") < 32 || Buffer.byteLength(value, "utf8") > 256) {
    throw new ApiHttpError(
      503,
      "ROLE_PROVISIONING_HMAC_CONFIG_INVALID",
      "AUTH_ROLE_PROVISIONING_HMAC_KEY must contain 32-256 UTF-8 bytes.",
    );
  }
  assertServerSecretSeparationV1(
    "auth_role_provisioning",
    [value],
    "ROLE_PROVISIONING_HMAC_KEY_REUSE",
  );
  return value;
}

export function authRoleProvisioningSubjectHashV1(
  kind: "target" | "operator",
  value: string,
  key = getAuthRoleProvisioningHmacKeyV1(),
): AuthRoleProvisioningSubjectHashV1 {
  if (!value || value.length > 256) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_SUBJECT_INVALID", "Role provisioning subject is invalid.");
  }
  return `hmac-sha256:${createHmac("sha256", key).update(`namespring/auth-role/${kind}/v1\0${value}`, "utf8").digest("hex")}`;
}

export function authRoleProvisioningRetentionDeadlineV1(completedAt: string): string {
  const parsed = new Date(canonicalIso(completedAt, "ROLE_PROVISIONING_TIME_INVALID"));
  parsed.setUTCDate(parsed.getUTCDate() + AUTH_ROLE_PROVISIONING_RETENTION_DAYS_V1);
  return parsed.toISOString();
}

function assertJsonClaimValue(value: unknown, depth: number): void {
  if (depth > 12) {
    throw new ApiHttpError(409, "ROLE_PROVISIONING_CLAIMS_INVALID", "Existing Firebase custom claims are too deeply nested.");
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    if (value.length > 100) throw new ApiHttpError(409, "ROLE_PROVISIONING_CLAIMS_INVALID", "Existing Firebase custom claims are invalid.");
    for (const entry of value) assertJsonClaimValue(entry, depth + 1);
    return;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ApiHttpError(409, "ROLE_PROVISIONING_CLAIMS_INVALID", "Existing Firebase custom claims are invalid.");
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 100) throw new ApiHttpError(409, "ROLE_PROVISIONING_CLAIMS_INVALID", "Existing Firebase custom claims are invalid.");
    for (const [key, entry] of entries) {
      if (!key || key.length > 128 || key === "__proto__" || key === "constructor" || key === "prototype") {
        throw new ApiHttpError(409, "ROLE_PROVISIONING_CLAIMS_INVALID", "Existing Firebase custom claims are invalid.");
      }
      assertJsonClaimValue(entry, depth + 1);
    }
    return;
  }
  throw new ApiHttpError(409, "ROLE_PROVISIONING_CLAIMS_INVALID", "Existing Firebase custom claims are invalid.");
}

function cloneClaims(claims: Readonly<Record<string, unknown>>): Record<string, unknown> {
  assertJsonClaimValue(claims, 0);
  return JSON.parse(JSON.stringify(claims)) as Record<string, unknown>;
}

function customClaimRolesV1(claims: Readonly<Record<string, unknown>>): string[] {
  const value = claims.roles;
  if (value === undefined) return [];
  if (!Array.isArray(value)
    || value.length > 32
    || value.some((role) => typeof role !== "string" || role.length < 1 || role.length > 64)) {
    throw new ApiHttpError(409, "ROLE_PROVISIONING_CLAIMS_INVALID", "The Firebase roles claim is invalid.");
  }
  return unique(value as string[]);
}

export function firebaseClaimsContainRoleV1(
  claims: Readonly<Record<string, unknown>>,
  role: AuthRoleProvisioningRoleV1,
): boolean {
  return claims[role] === true || customClaimRolesV1(claims).includes(role);
}

export function assertNoFirebaseSystemRoleContaminationV1(
  claimsByUid: readonly Readonly<Record<string, unknown>>[],
  operation: AuthRoleProvisioningOperationV1,
  role: AuthRoleProvisioningRoleV1,
): void {
  if (operation === "revoke" && role === "premium_system") return;
  if (claimsByUid.some((claims) => Object.hasOwn(claims, "premium_system")
    || customClaimRolesV1(claims).includes("premium_system"))) {
    throw new ApiHttpError(
      409,
      "ROLE_PROVISIONING_SYSTEM_ROLE_CONTAMINATION",
      "A human Firebase principal contains premium_system; run the explicit emergency revoke before other role changes.",
    );
  }
}

export function desiredFirebaseClaimsV1(
  currentClaims: Readonly<Record<string, unknown>>,
  operation: AuthRoleProvisioningOperationV1,
  role: AuthRoleProvisioningRoleV1,
): Record<string, unknown> {
  assertAuthRoleProvisioningOperationAllowedV1(operation, role);
  const desired = cloneClaims(currentClaims);
  const existingRoles = customClaimRolesV1(desired);
  if (operation === "grant") {
    if (desired[role] !== undefined && typeof desired[role] !== "boolean") {
      throw new ApiHttpError(409, "ROLE_PROVISIONING_CLAIMS_INVALID", "The Firebase role claim is invalid.");
    }
    desired[role] = true;
    desired.roles = unique([...existingRoles, role]).sort();
  } else {
    delete desired[role];
    if (desired.roles !== undefined) desired.roles = existingRoles.filter((current) => current !== role).sort();
  }
  const encoded = JSON.stringify(desired);
  if (Buffer.byteLength(encoded, "utf8") > AUTH_ROLE_PROVISIONING_CLAIMS_MAX_BYTES_V1) {
    throw new ApiHttpError(409, "ROLE_PROVISIONING_CLAIMS_TOO_LARGE", "Updated Firebase custom claims exceed the safe size limit.");
  }
  return desired;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function firebaseClaimsEqualV1(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  assertJsonClaimValue(left, 0);
  assertJsonClaimValue(right, 0);
  return canonicalJson(left) === canonicalJson(right);
}

export function assertRoleProvisioningStageForOperationV1(
  operation: AuthRoleProvisioningOperationV1,
  stage: AuthRoleProvisioningStageV1,
): void {
  const allowed = operation === "grant"
    ? ["dry_run", "reserved", "claims_applied", "sessions_revoked", "persisted_role_granted", "completed"]
    : ["dry_run", "reserved", "persisted_role_revoked", "claims_applied", "sessions_revoked", "completed"];
  if (!allowed.includes(stage)) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_STAGE_INVALID", "Role provisioning stage is invalid.");
  }
}
