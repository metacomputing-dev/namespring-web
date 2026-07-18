import type { Auth, UserRecord } from "firebase-admin/auth";
import {
  AUTH_ROLE_PROVISIONING_SCHEMA_V1,
  assertAuthRoleProvisioningOperationAllowedV1,
  assertNoFirebaseSystemRoleContaminationV1,
  authRoleProvisioningSubjectHashV1,
  desiredAccountRolesV1,
  desiredFirebaseClaimsV1,
  firebaseClaimsEqualV1,
  getAuthRoleProvisioningHmacKeyV1,
  requireAuthRoleProvisioningFirebaseUidV1,
  requireAuthRoleProvisioningOperationV1,
  requireAuthRoleProvisioningOperatorRefV1,
  requireAuthRoleProvisioningRequestIdV1,
  requireAuthRoleProvisioningRoleV1,
  type AuthRoleProvisioningOperationV1,
  type AuthRoleProvisioningReceiptV1,
  type AuthRoleProvisioningRoleV1,
} from "./auth-role-provisioning-contract.js";
import {
  getAuthRoleProvisioningRepositoryV1,
  newAuthRoleProvisioningClaimTokenV1,
  type AuthRoleProvisioningRepositoryV1,
} from "./auth-role-provisioning-repository.js";
import { getFirebaseAuth } from "./firebase-auth-admin.js";
import { ApiHttpError } from "./http.js";

export interface AuthRoleProvisioningInputV1 {
  readonly requestId: string;
  readonly targetFirebaseUid: string;
  readonly operatorRef: string;
  readonly operation: AuthRoleProvisioningOperationV1;
  readonly role: AuthRoleProvisioningRoleV1;
  /** Mutations require an explicit true; the CLI defaults this to false. */
  readonly confirmed: boolean;
}

export interface AuthRoleProvisioningClaimsGatewayV1 {
  getCustomClaims(firebaseUid: string): Promise<Readonly<Record<string, unknown>>>;
  setCustomClaims(firebaseUid: string, claims: Readonly<Record<string, unknown>>): Promise<void>;
  revokeRefreshTokens(firebaseUid: string): Promise<void>;
}

export interface AuthRoleProvisioningDependenciesV1 {
  readonly repository: AuthRoleProvisioningRepositoryV1;
  readonly claims: AuthRoleProvisioningClaimsGatewayV1;
  readonly now: () => string;
  readonly hmacKey: () => string;
  readonly newClaimToken: () => string;
}

function userClaims(record: UserRecord): Readonly<Record<string, unknown>> {
  const claims = record.customClaims;
  return claims && typeof claims === "object" && !Array.isArray(claims) ? claims : {};
}

export class FirebaseAdminRoleClaimsGatewayV1 implements AuthRoleProvisioningClaimsGatewayV1 {
  constructor(private readonly auth: Auth) {}

  async getCustomClaims(firebaseUid: string): Promise<Readonly<Record<string, unknown>>> {
    try {
      return userClaims(await this.auth.getUser(firebaseUid));
    } catch {
      throw new ApiHttpError(503, "ROLE_PROVISIONING_FIREBASE_READ_FAILED", "Firebase custom claims could not be read.");
    }
  }

  async setCustomClaims(firebaseUid: string, claims: Readonly<Record<string, unknown>>): Promise<void> {
    try {
      await this.auth.setCustomUserClaims(firebaseUid, claims);
    } catch {
      throw new ApiHttpError(503, "ROLE_PROVISIONING_FIREBASE_WRITE_FAILED", "Firebase custom claims could not be updated.");
    }
  }

  async revokeRefreshTokens(firebaseUid: string): Promise<void> {
    try {
      await this.auth.revokeRefreshTokens(firebaseUid);
    } catch {
      throw new ApiHttpError(503, "ROLE_PROVISIONING_FIREBASE_REVOKE_FAILED", "Firebase refresh tokens could not be revoked.");
    }
  }
}

function defaultDependencies(): AuthRoleProvisioningDependenciesV1 {
  return {
    repository: getAuthRoleProvisioningRepositoryV1(),
    claims: new FirebaseAdminRoleClaimsGatewayV1(getFirebaseAuth()),
    now: () => new Date().toISOString(),
    hmacKey: getAuthRoleProvisioningHmacKeyV1,
    newClaimToken: newAuthRoleProvisioningClaimTokenV1,
  };
}

function validatedInput(input: AuthRoleProvisioningInputV1): AuthRoleProvisioningInputV1 {
  const operation = requireAuthRoleProvisioningOperationV1(input.operation);
  const role = requireAuthRoleProvisioningRoleV1(input.role);
  assertAuthRoleProvisioningOperationAllowedV1(operation, role);
  return {
    requestId: requireAuthRoleProvisioningRequestIdV1(input.requestId),
    targetFirebaseUid: requireAuthRoleProvisioningFirebaseUidV1(input.targetFirebaseUid),
    operatorRef: requireAuthRoleProvisioningOperatorRefV1(input.operatorRef),
    operation,
    role,
    confirmed: input.confirmed === true,
  };
}

async function readAllClaims(
  gateway: AuthRoleProvisioningClaimsGatewayV1,
  firebaseUids: readonly string[],
): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const result: Readonly<Record<string, unknown>>[] = [];
  for (const uid of firebaseUids) result.push(await gateway.getCustomClaims(uid));
  return result;
}

async function applyClaimsToAllFirebaseUids(
  gateway: AuthRoleProvisioningClaimsGatewayV1,
  firebaseUids: readonly string[],
  operation: AuthRoleProvisioningOperationV1,
  role: AuthRoleProvisioningRoleV1,
): Promise<void> {
  for (const uid of firebaseUids) {
    const current = await gateway.getCustomClaims(uid);
    assertNoFirebaseSystemRoleContaminationV1([current], operation, role);
    const desired = desiredFirebaseClaimsV1(current, operation, role);
    if (!firebaseClaimsEqualV1(current, desired)) await gateway.setCustomClaims(uid, desired);
    const observed = await gateway.getCustomClaims(uid);
    if (!firebaseClaimsEqualV1(observed, desired)) {
      throw new ApiHttpError(
        503,
        "ROLE_PROVISIONING_FIREBASE_READBACK_MISMATCH",
        "Firebase custom claims did not match after write verification.",
      );
    }
  }
}

async function revokeEveryFirebaseSession(
  gateway: AuthRoleProvisioningClaimsGatewayV1,
  firebaseUids: readonly string[],
): Promise<void> {
  for (const uid of firebaseUids) await gateway.revokeRefreshTokens(uid);
}

function assertPersistedRoles(
  observed: readonly string[],
  receipt: AuthRoleProvisioningReceiptV1,
): void {
  if (observed.length !== receipt.afterRoles.length
    || observed.some((role, index) => role !== receipt.afterRoles[index])) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_PERSISTENCE_MISMATCH", "Persisted roles did not match the provisioning receipt.");
  }
}

function dryRunReceipt(
  input: AuthRoleProvisioningInputV1,
  targetSubjectHash: ReturnType<typeof authRoleProvisioningSubjectHashV1>,
  operatorSubjectHash: ReturnType<typeof authRoleProvisioningSubjectHashV1>,
  beforeRoles: readonly string[],
  now: string,
): AuthRoleProvisioningReceiptV1 {
  return {
    schemaVersion: AUTH_ROLE_PROVISIONING_SCHEMA_V1,
    requestId: input.requestId,
    targetSubjectHash,
    operatorSubjectHash,
    operation: input.operation,
    role: input.role,
    beforeRoles: [...beforeRoles],
    afterRoles: desiredAccountRolesV1(beforeRoles, input.operation, input.role),
    stage: "dry_run",
    status: "dry_run",
    updatedAt: now,
    deleteAfter: null,
  };
}

/**
 * Trusted operator workflow only. There is deliberately no HTTP route around
 * this service: browser sessions can never grant or remove account roles.
 */
export async function provisionAuthRoleV1(
  rawInput: AuthRoleProvisioningInputV1,
  providedDependencies?: AuthRoleProvisioningDependenciesV1,
): Promise<AuthRoleProvisioningReceiptV1> {
  const input = validatedInput(rawInput);
  const dependencies = providedDependencies ?? defaultDependencies();
  const key = dependencies.hmacKey();
  const target = await dependencies.repository.inspectTarget(
    input.targetFirebaseUid,
    input.operation,
    input.role,
  );
  const targetSubjectHash = authRoleProvisioningSubjectHashV1("target", target.internalUserId, key);
  const operatorSubjectHash = authRoleProvisioningSubjectHashV1("operator", input.operatorRef, key);
  const preflightClaims = await readAllClaims(dependencies.claims, target.firebaseUids);
  assertNoFirebaseSystemRoleContaminationV1(preflightClaims, input.operation, input.role);
  const startedAt = dependencies.now();

  if (!input.confirmed) {
    return dryRunReceipt(input, targetSubjectHash, operatorSubjectHash, target.roles, startedAt);
  }

  const acquired = await dependencies.repository.acquire({
    requestId: input.requestId,
    targetFirebaseUid: input.targetFirebaseUid,
    targetSubjectHash,
    operatorSubjectHash,
    operation: input.operation,
    role: input.role,
    now: startedAt,
    claimToken: dependencies.newClaimToken(),
  });
  if (acquired.completed) return acquired.receipt;

  const { claim, receipt } = acquired;
  let completed: AuthRoleProvisioningReceiptV1 | null = null;
  try {
    if (input.operation === "revoke") {
      assertPersistedRoles(await dependencies.repository.persistDesiredRoles(claim, receipt), receipt);
      await dependencies.repository.advance(claim, "persisted_role_revoked");
    }

    await applyClaimsToAllFirebaseUids(
      dependencies.claims,
      acquired.target.firebaseUids,
      input.operation,
      input.role,
    );
    await dependencies.repository.advance(claim, "claims_applied");

    await revokeEveryFirebaseSession(dependencies.claims, acquired.target.firebaseUids);
    await dependencies.repository.advance(claim, "sessions_revoked");

    if (input.operation === "grant") {
      assertPersistedRoles(await dependencies.repository.persistDesiredRoles(claim, receipt), receipt);
      await dependencies.repository.advance(claim, "persisted_role_granted");
    }

    completed = await dependencies.repository.advance(claim, "completed");
  } catch (error) {
    await dependencies.repository.release(claim).catch(() => false);
    if (error instanceof ApiHttpError) throw error;
    throw new ApiHttpError(503, "ROLE_PROVISIONING_FAILED", "Role provisioning did not complete.");
  }

  const released = await dependencies.repository.release(claim).catch(() => false);
  if (!released || !completed) {
    throw new ApiHttpError(503, "ROLE_PROVISIONING_RELEASE_FAILED", "Role provisioning completed but its lease was not released.");
  }
  return completed;
}
