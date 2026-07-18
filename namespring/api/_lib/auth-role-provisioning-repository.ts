import { randomBytes } from "node:crypto";
import { Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { accountDeletionFenceRefV1, assertAccountWriteFenceOpenV1 } from "./account-write-fence.js";
import type { AuthAccountRecord } from "./auth-accounts-repository.js";
import { decodeAuthAccountRecordV1, decodePrincipalRecordV1 } from "./auth-accounts-firestore-codec.js";
import { digestIdentityPart } from "./auth-identity.js";
import {
  AUTH_ROLE_PROVISIONING_LEASE_MS_V1,
  AUTH_ROLE_PROVISIONING_SCHEMA_V1,
  assertAuthRoleProvisioningTargetV1,
  assertRoleProvisioningStageForOperationV1,
  authRoleProvisioningRetentionDeadlineV1,
  authRoleProvisioningSubjectHashV1,
  canonicalAccountRolesV1,
  desiredAccountRolesV1,
  getAuthRoleProvisioningHmacKeyV1,
  type AuthRoleProvisioningOperationV1,
  type AuthRoleProvisioningReceiptV1,
  type AuthRoleProvisioningRoleV1,
  type AuthRoleProvisioningStageV1,
  type AuthRoleProvisioningSubjectHashV1,
  type AuthRoleProvisioningTargetV1,
} from "./auth-role-provisioning-contract.js";
import { getFirestoreDb } from "./firestore-admin.js";
import { ApiHttpError } from "./http.js";

export const AUTH_ROLE_PROVISIONING_RECEIPTS_COLLECTION_V1 = "authRoleProvisioningReceiptsV1" as const;
export const AUTH_ROLE_PROVISIONING_LEASES_COLLECTION_V1 = "authRoleProvisioningLeasesV1" as const;

export interface AuthRoleProvisioningClaimV1 {
  readonly requestId: string;
  readonly targetSubjectHash: AuthRoleProvisioningSubjectHashV1;
  readonly claimToken: string;
  readonly fence: number;
  /** Raw identifiers exist only in this in-process trusted actor. */
  readonly internalUserId: string;
  readonly targetFirebaseUid: string;
}

export type AcquireAuthRoleProvisioningResultV1 =
  | { readonly completed: true; readonly receipt: AuthRoleProvisioningReceiptV1 }
  | {
      readonly completed: false;
      readonly receipt: AuthRoleProvisioningReceiptV1;
      readonly target: AuthRoleProvisioningTargetV1;
      readonly claim: AuthRoleProvisioningClaimV1;
    };

export interface AcquireAuthRoleProvisioningInputV1 {
  readonly requestId: string;
  readonly targetFirebaseUid: string;
  readonly targetSubjectHash: AuthRoleProvisioningSubjectHashV1;
  readonly operatorSubjectHash: AuthRoleProvisioningSubjectHashV1;
  readonly operation: AuthRoleProvisioningOperationV1;
  readonly role: AuthRoleProvisioningRoleV1;
  readonly now: string;
  readonly claimToken: string;
  readonly leaseMs?: number;
}

export interface AuthRoleProvisioningRepositoryV1 {
  inspectTarget(
    targetFirebaseUid: string,
    operation: AuthRoleProvisioningOperationV1,
    role: AuthRoleProvisioningRoleV1,
  ): Promise<AuthRoleProvisioningTargetV1>;
  acquire(input: AcquireAuthRoleProvisioningInputV1): Promise<AcquireAuthRoleProvisioningResultV1>;
  persistDesiredRoles(
    claim: AuthRoleProvisioningClaimV1,
    receipt: AuthRoleProvisioningReceiptV1,
  ): Promise<readonly string[]>;
  advance(
    claim: AuthRoleProvisioningClaimV1,
    stage: AuthRoleProvisioningStageV1,
  ): Promise<AuthRoleProvisioningReceiptV1>;
  release(claim: AuthRoleProvisioningClaimV1): Promise<boolean>;
}

interface RoleProvisioningLeaseRecordV1 {
  readonly schemaVersion: "namespring.auth-role-provisioning-lease.v1";
  readonly requestId: string;
  readonly targetSubjectHash: AuthRoleProvisioningSubjectHashV1;
  readonly claimToken: string | null;
  readonly claimUntil: string | null;
  readonly fence: number;
}

function canonicalIso(value: unknown, code: string): string {
  if (typeof value !== "string") {
    throw new ApiHttpError(500, code, "Role provisioning time is invalid.");
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new ApiHttpError(500, code, "Role provisioning time is invalid.");
  }
  return value;
}

function claimTokenV1(): string {
  return `rpc_${randomBytes(24).toString("base64url")}`;
}

export function newAuthRoleProvisioningClaimTokenV1(): string {
  return claimTokenV1();
}

function assertClaimToken(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^rpc_[A-Za-z0-9_-]{32}$/u.test(value)) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_CLAIM_INVALID", "Role provisioning claim is invalid.");
  }
}

function receiptMaterialMatches(
  receipt: AuthRoleProvisioningReceiptV1,
  input: AcquireAuthRoleProvisioningInputV1,
): boolean {
  return receipt.requestId === input.requestId
    && receipt.targetSubjectHash === input.targetSubjectHash
    && receipt.operatorSubjectHash === input.operatorSubjectHash
    && receipt.operation === input.operation
    && receipt.role === input.role;
}

function assertAccountMatchesReceipt(
  target: AuthRoleProvisioningTargetV1,
  receipt: AuthRoleProvisioningReceiptV1,
): void {
  const roles = canonicalAccountRolesV1(target.roles, receipt.operation, receipt.role);
  if (!sameRoles(roles, receipt.beforeRoles) && !sameRoles(roles, receipt.afterRoles)) {
    throw new ApiHttpError(
      409,
      "ROLE_PROVISIONING_ACCOUNT_DRIFT",
      "Persisted account roles changed outside the active provisioning request.",
    );
  }
}

function sameRoles(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((role, index) => role === right[index]);
}

function stageRank(operation: AuthRoleProvisioningOperationV1, stage: AuthRoleProvisioningStageV1): number {
  assertRoleProvisioningStageForOperationV1(operation, stage);
  const stages = operation === "grant"
    ? ["dry_run", "reserved", "claims_applied", "sessions_revoked", "persisted_role_granted", "completed"]
    : ["dry_run", "reserved", "persisted_role_revoked", "claims_applied", "sessions_revoked", "completed"];
  return stages.indexOf(stage);
}

function pendingReceipt(
  input: AcquireAuthRoleProvisioningInputV1,
  target: AuthRoleProvisioningTargetV1,
): AuthRoleProvisioningReceiptV1 {
  const beforeRoles = canonicalAccountRolesV1(target.roles, input.operation, input.role);
  return {
    schemaVersion: AUTH_ROLE_PROVISIONING_SCHEMA_V1,
    requestId: input.requestId,
    targetSubjectHash: input.targetSubjectHash,
    operatorSubjectHash: input.operatorSubjectHash,
    operation: input.operation,
    role: input.role,
    beforeRoles,
    afterRoles: desiredAccountRolesV1(beforeRoles, input.operation, input.role),
    stage: "reserved",
    status: "pending",
    updatedAt: input.now,
    deleteAfter: null,
  };
}

function completedReceipt(receipt: AuthRoleProvisioningReceiptV1, now: string): AuthRoleProvisioningReceiptV1 {
  return {
    ...receipt,
    stage: "completed",
    status: "completed",
    updatedAt: now,
    deleteAfter: authRoleProvisioningRetentionDeadlineV1(now),
  };
}

function assertReceipt(value: AuthRoleProvisioningReceiptV1): AuthRoleProvisioningReceiptV1 {
  if (value.schemaVersion !== AUTH_ROLE_PROVISIONING_SCHEMA_V1
    || typeof value.requestId !== "string"
    || !/^role_request_v1_[A-Za-z0-9_-]{16,64}$/u.test(value.requestId)
    || typeof value.targetSubjectHash !== "string"
    || !/^hmac-sha256:[a-f0-9]{64}$/u.test(value.targetSubjectHash)
    || typeof value.operatorSubjectHash !== "string"
    || !/^hmac-sha256:[a-f0-9]{64}$/u.test(value.operatorSubjectHash)
    || (value.operation !== "grant" && value.operation !== "revoke")
    || typeof value.role !== "string"
    || !["admin", "premium_admin", "premium_system"].includes(value.role)
    || !Array.isArray(value.beforeRoles)
    || !Array.isArray(value.afterRoles)
    || typeof value.stage !== "string"
    || typeof value.updatedAt !== "string"
    || (value.deleteAfter !== null && typeof value.deleteAfter !== "string")
    || (value.status !== "pending" && value.status !== "completed")) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_RECEIPT_INTEGRITY_ERROR", "Role provisioning receipt is invalid.");
  }
  assertRoleProvisioningStageForOperationV1(value.operation, value.stage);
  canonicalAccountRolesV1(value.beforeRoles, value.operation, value.role);
  canonicalAccountRolesV1(value.afterRoles, value.operation, value.role);
  if (!sameRoles(value.afterRoles, desiredAccountRolesV1(value.beforeRoles, value.operation, value.role))
    || (value.status === "completed") !== (value.stage === "completed")
    || (value.status === "completed") !== (value.deleteAfter !== null)) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_RECEIPT_INTEGRITY_ERROR", "Role provisioning receipt is invalid.");
  }
  canonicalIso(value.updatedAt, "ROLE_PROVISIONING_RECEIPT_INTEGRITY_ERROR");
  if (value.deleteAfter) canonicalIso(value.deleteAfter, "ROLE_PROVISIONING_RECEIPT_INTEGRITY_ERROR");
  return {
    ...value,
    beforeRoles: [...value.beforeRoles],
    afterRoles: [...value.afterRoles],
  };
}

function assertTargetAccount(
  account: AuthAccountRecord | null,
  firebaseUid: string,
  deletionFenceExists: boolean,
  operation: AuthRoleProvisioningOperationV1,
  role: AuthRoleProvisioningRoleV1,
): AuthRoleProvisioningTargetV1 {
  if (!account) {
    throw new ApiHttpError(404, "ROLE_PROVISIONING_ACCOUNT_NOT_FOUND", "The target account was not found.");
  }
  if (account.status !== "active") {
    throw new ApiHttpError(409, "ROLE_PROVISIONING_ACCOUNT_INACTIVE", "The target account is not active.");
  }
  if (deletionFenceExists) {
    throw new ApiHttpError(409, "ACCOUNT_DELETION_IN_PROGRESS", "The target account is being deleted.");
  }
  if (account.pendingProviderUnlink) {
    throw new ApiHttpError(409, "ROLE_PROVISIONING_PROVIDER_UNLINK_PENDING", "Finish provider unlink before changing roles.");
  }
  if (!account.firebaseUids.includes(firebaseUid)) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_PRINCIPAL_INTEGRITY_ERROR", "The target principal is inconsistent.");
  }
  return assertAuthRoleProvisioningTargetV1({
    internalUserId: account.internalUserId,
    firebaseUids: account.firebaseUids,
    roles: account.roles,
  }, operation, role);
}

function assertLeaseClaim(lease: RoleProvisioningLeaseRecordV1 | null, claim: AuthRoleProvisioningClaimV1): void {
  if (!lease
    || lease.requestId !== claim.requestId
    || lease.targetSubjectHash !== claim.targetSubjectHash
    || lease.claimToken !== claim.claimToken
    || lease.fence !== claim.fence) {
    throw new ApiHttpError(409, "ROLE_PROVISIONING_CLAIM_LOST", "The role provisioning lease is no longer owned.");
  }
}

function leaseDuration(input: AcquireAuthRoleProvisioningInputV1): number {
  const value = input.leaseMs ?? AUTH_ROLE_PROVISIONING_LEASE_MS_V1;
  if (!Number.isSafeInteger(value) || value < 30_000 || value > 5 * 60_000) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_LEASE_INVALID", "Role provisioning lease is invalid.");
  }
  return value;
}

function nextLease(
  current: RoleProvisioningLeaseRecordV1 | null,
  input: AcquireAuthRoleProvisioningInputV1,
): RoleProvisioningLeaseRecordV1 {
  const nowMs = new Date(canonicalIso(input.now, "ROLE_PROVISIONING_TIME_INVALID")).getTime();
  assertClaimToken(input.claimToken);
  if (current?.requestId !== input.requestId) {
    throw new ApiHttpError(409, "ROLE_PROVISIONING_OPERATION_PENDING", "Another role provisioning request owns this account.");
  }
  if (current.claimToken && current.claimUntil && new Date(current.claimUntil).getTime() > nowMs) {
    throw new ApiHttpError(409, "ROLE_PROVISIONING_LEASE_HELD", "This role provisioning request is already running.");
  }
  return {
    schemaVersion: "namespring.auth-role-provisioning-lease.v1",
    requestId: input.requestId,
    targetSubjectHash: input.targetSubjectHash,
    claimToken: input.claimToken,
    claimUntil: new Date(nowMs + leaseDuration(input)).toISOString(),
    fence: (current?.fence ?? 0) + 1,
  };
}

interface InMemoryTargetStateV1 {
  account: AuthAccountRecord;
  deletionFence: boolean;
}

export class InMemoryAuthRoleProvisioningRepositoryV1 implements AuthRoleProvisioningRepositoryV1 {
  private readonly targets = new Map<string, InMemoryTargetStateV1>();
  private readonly receipts = new Map<string, AuthRoleProvisioningReceiptV1>();
  private readonly leases = new Map<AuthRoleProvisioningSubjectHashV1, RoleProvisioningLeaseRecordV1>();

  constructor(
    targets: readonly AuthAccountRecord[] = [],
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly hmacKey: () => string = () => "in-memory-role-provisioning-key-32-bytes-minimum",
  ) {
    for (const account of targets) this.seed(account);
  }

  seed(account: AuthAccountRecord): void {
    const state = { account: structuredClone(account), deletionFence: false };
    for (const uid of account.firebaseUids) this.targets.set(uid, state);
  }

  setDeletionFence(firebaseUid: string, closed: boolean): void {
    const target = this.targets.get(firebaseUid);
    if (!target) throw new Error("Unknown in-memory role target");
    target.deletionFence = closed;
  }

  getReceipt(requestId: string): AuthRoleProvisioningReceiptV1 | null {
    return this.receipts.get(requestId) ?? null;
  }

  getAccount(firebaseUid: string): AuthAccountRecord | null {
    return this.targets.get(firebaseUid)?.account ?? null;
  }

  async inspectTarget(
    targetFirebaseUid: string,
    operation: AuthRoleProvisioningOperationV1,
    role: AuthRoleProvisioningRoleV1,
  ): Promise<AuthRoleProvisioningTargetV1> {
    const state = this.targets.get(targetFirebaseUid);
    return assertTargetAccount(state?.account ?? null, targetFirebaseUid, state?.deletionFence ?? false, operation, role);
  }

  async acquire(input: AcquireAuthRoleProvisioningInputV1): Promise<AcquireAuthRoleProvisioningResultV1> {
    const target = await this.inspectTarget(input.targetFirebaseUid, input.operation, input.role);
    const expectedHash = authRoleProvisioningSubjectHashV1("target", target.internalUserId, this.hmacKey());
    if (expectedHash !== input.targetSubjectHash) {
      throw new ApiHttpError(500, "ROLE_PROVISIONING_SUBJECT_INTEGRITY_ERROR", "Role provisioning subject is inconsistent.");
    }
    const existing = this.receipts.get(input.requestId) ?? null;
    if (existing && !receiptMaterialMatches(existing, input)) {
      throw new ApiHttpError(409, "ROLE_PROVISIONING_REQUEST_REUSE", "requestId was already used for different material.");
    }
    if (existing?.status === "completed") {
      const staleLease = this.leases.get(input.targetSubjectHash);
      if (staleLease?.requestId === input.requestId) this.leases.delete(input.targetSubjectHash);
      return { completed: true, receipt: existing };
    }
    const receipt = existing ?? pendingReceipt(input, target);
    assertAccountMatchesReceipt(target, receipt);
    const currentLease = this.leases.get(input.targetSubjectHash) ?? null;
    if (currentLease && currentLease.requestId !== input.requestId) {
      const prior = this.receipts.get(currentLease.requestId);
      if (prior?.status !== "completed") {
        throw new ApiHttpError(409, "ROLE_PROVISIONING_OPERATION_PENDING", "Another role provisioning request owns this account.");
      }
      this.leases.delete(input.targetSubjectHash);
    }
    const lease = nextLease(this.leases.get(input.targetSubjectHash) ?? {
      schemaVersion: "namespring.auth-role-provisioning-lease.v1",
      requestId: input.requestId,
      targetSubjectHash: input.targetSubjectHash,
      claimToken: null,
      claimUntil: null,
      fence: 0,
    }, input);
    this.receipts.set(input.requestId, receipt);
    this.leases.set(input.targetSubjectHash, lease);
    return {
      completed: false,
      receipt,
      target,
      claim: {
        requestId: input.requestId,
        targetSubjectHash: input.targetSubjectHash,
        claimToken: input.claimToken,
        fence: lease.fence,
        internalUserId: target.internalUserId,
        targetFirebaseUid: input.targetFirebaseUid,
      },
    };
  }

  async persistDesiredRoles(
    claim: AuthRoleProvisioningClaimV1,
    receipt: AuthRoleProvisioningReceiptV1,
  ): Promise<readonly string[]> {
    const lease = this.leases.get(claim.targetSubjectHash) ?? null;
    assertLeaseClaim(lease, claim);
    const state = this.targets.get(claim.targetFirebaseUid);
    const target = assertTargetAccount(
      state?.account ?? null,
      claim.targetFirebaseUid,
      state?.deletionFence ?? false,
      receipt.operation,
      receipt.role,
    );
    assertAccountMatchesReceipt(target, receipt);
    const updated: AuthAccountRecord = {
      ...state!.account,
      roles: [...receipt.afterRoles],
      updatedAt: this.now(),
    };
    state!.account = updated;
    for (const uid of updated.firebaseUids) this.targets.set(uid, state!);
    return [...updated.roles];
  }

  async advance(
    claim: AuthRoleProvisioningClaimV1,
    stage: AuthRoleProvisioningStageV1,
  ): Promise<AuthRoleProvisioningReceiptV1> {
    assertLeaseClaim(this.leases.get(claim.targetSubjectHash) ?? null, claim);
    const receipt = this.receipts.get(claim.requestId);
    if (!receipt) throw new ApiHttpError(500, "ROLE_PROVISIONING_RECEIPT_NOT_FOUND", "Role provisioning receipt is missing.");
    if (stageRank(receipt.operation, stage) <= stageRank(receipt.operation, receipt.stage)) return receipt;
    const at = this.now();
    const updated = stage === "completed"
      ? completedReceipt(receipt, at)
      : assertReceipt({ ...receipt, stage, updatedAt: at });
    this.receipts.set(claim.requestId, updated);
    return updated;
  }

  async release(claim: AuthRoleProvisioningClaimV1): Promise<boolean> {
    const lease = this.leases.get(claim.targetSubjectHash) ?? null;
    try {
      assertLeaseClaim(lease, claim);
    } catch {
      return false;
    }
    const receipt = this.receipts.get(claim.requestId);
    if (receipt?.status === "completed") this.leases.delete(claim.targetSubjectHash);
    else this.leases.set(claim.targetSubjectHash, { ...lease!, claimToken: null, claimUntil: null });
    return true;
  }
}

function isPlainExactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function decodeReceipt(data: unknown): AuthRoleProvisioningReceiptV1 {
  if (!isPlainExactRecord(data, [
    "schemaVersion", "requestId", "targetSubjectHash", "operatorSubjectHash", "operation", "role",
    "beforeRoles", "afterRoles", "stage", "status", "updatedAt", "deleteAfter",
  ])) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_RECEIPT_INTEGRITY_ERROR", "Role provisioning receipt is invalid.");
  }
  const deleteAfter = data.deleteAfter;
  if (data.schemaVersion !== AUTH_ROLE_PROVISIONING_SCHEMA_V1
    || typeof data.requestId !== "string"
    || typeof data.targetSubjectHash !== "string"
    || typeof data.operatorSubjectHash !== "string"
    || (data.operation !== "grant" && data.operation !== "revoke")
    || typeof data.role !== "string"
    || !Array.isArray(data.beforeRoles)
    || !Array.isArray(data.afterRoles)
    || typeof data.stage !== "string"
    || (data.status !== "pending" && data.status !== "completed")
    || typeof data.updatedAt !== "string"
    || (deleteAfter !== null && !(deleteAfter instanceof Timestamp))) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_RECEIPT_INTEGRITY_ERROR", "Role provisioning receipt is invalid.");
  }
  return assertReceipt({
    schemaVersion: data.schemaVersion as typeof AUTH_ROLE_PROVISIONING_SCHEMA_V1,
    requestId: data.requestId as string,
    targetSubjectHash: data.targetSubjectHash as AuthRoleProvisioningSubjectHashV1,
    operatorSubjectHash: data.operatorSubjectHash as AuthRoleProvisioningSubjectHashV1,
    operation: data.operation as AuthRoleProvisioningOperationV1,
    role: data.role as AuthRoleProvisioningRoleV1,
    beforeRoles: data.beforeRoles as string[],
    afterRoles: data.afterRoles as string[],
    stage: data.stage as AuthRoleProvisioningStageV1,
    status: data.status as "pending" | "completed",
    updatedAt: data.updatedAt as string,
    deleteAfter: deleteAfter === null ? null : deleteAfter.toDate().toISOString(),
  });
}

function encodeReceipt(receipt: AuthRoleProvisioningReceiptV1): Record<string, unknown> {
  return {
    ...receipt,
    beforeRoles: [...receipt.beforeRoles],
    afterRoles: [...receipt.afterRoles],
    deleteAfter: receipt.deleteAfter ? Timestamp.fromDate(new Date(receipt.deleteAfter)) : null,
  };
}

function decodeLease(data: unknown): RoleProvisioningLeaseRecordV1 {
  if (!isPlainExactRecord(data, [
    "schemaVersion", "requestId", "targetSubjectHash", "claimToken", "claimUntil", "fence",
  ])
    || data.schemaVersion !== "namespring.auth-role-provisioning-lease.v1"
    || typeof data.requestId !== "string"
    || typeof data.targetSubjectHash !== "string"
    || (data.claimToken !== null && typeof data.claimToken !== "string")
    || (data.claimUntil !== null && !(data.claimUntil instanceof Timestamp))
    || !Number.isSafeInteger(data.fence)) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_LEASE_INTEGRITY_ERROR", "Role provisioning lease is invalid.");
  }
  const lease: RoleProvisioningLeaseRecordV1 = {
    schemaVersion: data.schemaVersion,
    requestId: data.requestId,
    targetSubjectHash: data.targetSubjectHash as AuthRoleProvisioningSubjectHashV1,
    claimToken: data.claimToken,
    claimUntil: data.claimUntil === null ? null : data.claimUntil.toDate().toISOString(),
    fence: data.fence as number,
  };
  if (lease.schemaVersion !== "namespring.auth-role-provisioning-lease.v1"
    || !/^role_request_v1_[A-Za-z0-9_-]{16,64}$/u.test(lease.requestId)
    || !/^hmac-sha256:[a-f0-9]{64}$/u.test(lease.targetSubjectHash)
    || !Number.isSafeInteger(lease.fence)
    || lease.fence < 0
    || (lease.claimToken !== null && !/^rpc_[A-Za-z0-9_-]{32}$/u.test(lease.claimToken))
    || (lease.claimUntil !== null && !Number.isFinite(new Date(lease.claimUntil).valueOf()))
    || (lease.claimToken === null) !== (lease.claimUntil === null)) {
    throw new ApiHttpError(500, "ROLE_PROVISIONING_LEASE_INTEGRITY_ERROR", "Role provisioning lease is invalid.");
  }
  return lease;
}

function encodeLease(lease: RoleProvisioningLeaseRecordV1): Record<string, unknown> {
  return {
    ...lease,
    claimUntil: lease.claimUntil ? Timestamp.fromDate(new Date(lease.claimUntil)) : null,
  };
}

export class FirestoreAuthRoleProvisioningRepositoryV1 implements AuthRoleProvisioningRepositoryV1 {
  constructor(
    private readonly db: Firestore,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly hmacKey: () => string = getAuthRoleProvisioningHmacKeyV1,
  ) {}

  private principalRef(firebaseUid: string) {
    return this.db.collection("authFirebasePrincipalsV1").doc(digestIdentityPart(firebaseUid));
  }

  private accountRef(internalUserId: string) {
    return this.db.collection("authAccountsV1").doc(internalUserId);
  }

  private receiptRef(requestId: string) {
    return this.db.collection(AUTH_ROLE_PROVISIONING_RECEIPTS_COLLECTION_V1).doc(requestId);
  }

  private leaseRef(targetSubjectHash: AuthRoleProvisioningSubjectHashV1) {
    return this.db.collection(AUTH_ROLE_PROVISIONING_LEASES_COLLECTION_V1).doc(targetSubjectHash);
  }

  private async targetInTransaction(
    transaction: Transaction,
    firebaseUid: string,
    operation: AuthRoleProvisioningOperationV1,
    role: AuthRoleProvisioningRoleV1,
  ): Promise<AuthRoleProvisioningTargetV1> {
    const principalSnapshot = await transaction.get(this.principalRef(firebaseUid));
    if (!principalSnapshot.exists) {
      throw new ApiHttpError(404, "ROLE_PROVISIONING_ACCOUNT_NOT_FOUND", "The target account was not found.");
    }
    const principal = decodePrincipalRecordV1(principalSnapshot.data(), firebaseUid);
    const [accountSnapshot, fenceSnapshot] = await Promise.all([
      transaction.get(this.accountRef(principal.internalUserId)),
      transaction.get(accountDeletionFenceRefV1(this.db, principal.internalUserId)),
    ]);
    assertAccountWriteFenceOpenV1(fenceSnapshot);
    const account = accountSnapshot.exists
      ? decodeAuthAccountRecordV1(accountSnapshot.data(), principal.internalUserId)
      : null;
    return assertTargetAccount(account, firebaseUid, fenceSnapshot.exists, operation, role);
  }

  async inspectTarget(
    targetFirebaseUid: string,
    operation: AuthRoleProvisioningOperationV1,
    role: AuthRoleProvisioningRoleV1,
  ): Promise<AuthRoleProvisioningTargetV1> {
    return this.db.runTransaction((transaction) => this.targetInTransaction(transaction, targetFirebaseUid, operation, role));
  }

  async acquire(input: AcquireAuthRoleProvisioningInputV1): Promise<AcquireAuthRoleProvisioningResultV1> {
    return this.db.runTransaction(async (transaction) => {
      const target = await this.targetInTransaction(transaction, input.targetFirebaseUid, input.operation, input.role);
      const expectedHash = authRoleProvisioningSubjectHashV1("target", target.internalUserId, this.hmacKey());
      if (expectedHash !== input.targetSubjectHash) {
        throw new ApiHttpError(500, "ROLE_PROVISIONING_SUBJECT_INTEGRITY_ERROR", "Role provisioning subject is inconsistent.");
      }
      const receiptRef = this.receiptRef(input.requestId);
      const leaseRef = this.leaseRef(input.targetSubjectHash);
      const [receiptSnapshot, leaseSnapshot] = await Promise.all([
        transaction.get(receiptRef),
        transaction.get(leaseRef),
      ]);
      const existing = receiptSnapshot.exists ? decodeReceipt(receiptSnapshot.data()!) : null;
      if (existing && !receiptMaterialMatches(existing, input)) {
        throw new ApiHttpError(409, "ROLE_PROVISIONING_REQUEST_REUSE", "requestId was already used for different material.");
      }
      if (existing?.status === "completed") {
        if (leaseSnapshot.exists) {
          const staleLease = decodeLease(leaseSnapshot.data()!);
          if (staleLease.requestId === input.requestId) transaction.delete(leaseRef);
        }
        return { completed: true, receipt: existing };
      }
      const receipt = existing ?? pendingReceipt(input, target);
      assertAccountMatchesReceipt(target, receipt);
      let currentLease = leaseSnapshot.exists ? decodeLease(leaseSnapshot.data()!) : null;
      if (currentLease && currentLease.requestId !== input.requestId) {
        const priorSnapshot = await transaction.get(this.receiptRef(currentLease.requestId));
        const prior = priorSnapshot.exists ? decodeReceipt(priorSnapshot.data()!) : null;
        if (prior?.status !== "completed") {
          throw new ApiHttpError(409, "ROLE_PROVISIONING_OPERATION_PENDING", "Another role provisioning request owns this account.");
        }
        currentLease = null;
      }
      const lease = nextLease(currentLease ?? {
        schemaVersion: "namespring.auth-role-provisioning-lease.v1",
        requestId: input.requestId,
        targetSubjectHash: input.targetSubjectHash,
        claimToken: null,
        claimUntil: null,
        fence: 0,
      }, input);
      if (!existing) transaction.create(receiptRef, encodeReceipt(receipt));
      transaction.set(leaseRef, encodeLease(lease));
      return {
        completed: false,
        receipt,
        target,
        claim: {
          requestId: input.requestId,
          targetSubjectHash: input.targetSubjectHash,
          claimToken: input.claimToken,
          fence: lease.fence,
          internalUserId: target.internalUserId,
          targetFirebaseUid: input.targetFirebaseUid,
        },
      };
    });
  }

  async persistDesiredRoles(
    claim: AuthRoleProvisioningClaimV1,
    receipt: AuthRoleProvisioningReceiptV1,
  ): Promise<readonly string[]> {
    return this.db.runTransaction(async (transaction) => {
      const leaseRef = this.leaseRef(claim.targetSubjectHash);
      const accountRef = this.accountRef(claim.internalUserId);
      const [leaseSnapshot, accountSnapshot, fenceSnapshot] = await Promise.all([
        transaction.get(leaseRef),
        transaction.get(accountRef),
        transaction.get(accountDeletionFenceRefV1(this.db, claim.internalUserId)),
      ]);
      assertAccountWriteFenceOpenV1(fenceSnapshot);
      assertLeaseClaim(leaseSnapshot.exists ? decodeLease(leaseSnapshot.data()!) : null, claim);
      const account = accountSnapshot.exists
        ? decodeAuthAccountRecordV1(accountSnapshot.data(), claim.internalUserId)
        : null;
      const target = assertTargetAccount(account, claim.targetFirebaseUid, fenceSnapshot.exists, receipt.operation, receipt.role);
      assertAccountMatchesReceipt(target, receipt);
      transaction.update(accountRef, { roles: [...receipt.afterRoles], updatedAt: this.now() });
      return [...receipt.afterRoles];
    });
  }

  async advance(
    claim: AuthRoleProvisioningClaimV1,
    stage: AuthRoleProvisioningStageV1,
  ): Promise<AuthRoleProvisioningReceiptV1> {
    return this.db.runTransaction(async (transaction) => {
      const [leaseSnapshot, receiptSnapshot] = await Promise.all([
        transaction.get(this.leaseRef(claim.targetSubjectHash)),
        transaction.get(this.receiptRef(claim.requestId)),
      ]);
      assertLeaseClaim(leaseSnapshot.exists ? decodeLease(leaseSnapshot.data()!) : null, claim);
      if (!receiptSnapshot.exists) {
        throw new ApiHttpError(500, "ROLE_PROVISIONING_RECEIPT_NOT_FOUND", "Role provisioning receipt is missing.");
      }
      const receipt = decodeReceipt(receiptSnapshot.data()!);
      if (stageRank(receipt.operation, stage) <= stageRank(receipt.operation, receipt.stage)) return receipt;
      const at = this.now();
      const updated = stage === "completed"
        ? completedReceipt(receipt, at)
        : assertReceipt({ ...receipt, stage, updatedAt: at });
      transaction.set(receiptSnapshot.ref, encodeReceipt(updated));
      return updated;
    });
  }

  async release(claim: AuthRoleProvisioningClaimV1): Promise<boolean> {
    return this.db.runTransaction(async (transaction) => {
      const leaseRef = this.leaseRef(claim.targetSubjectHash);
      const [leaseSnapshot, receiptSnapshot] = await Promise.all([
        transaction.get(leaseRef),
        transaction.get(this.receiptRef(claim.requestId)),
      ]);
      if (!leaseSnapshot.exists) return false;
      const lease = decodeLease(leaseSnapshot.data()!);
      try {
        assertLeaseClaim(lease, claim);
      } catch {
        return false;
      }
      const receipt = receiptSnapshot.exists ? decodeReceipt(receiptSnapshot.data()!) : null;
      if (receipt?.status === "completed") transaction.delete(leaseRef);
      else transaction.set(leaseRef, encodeLease({ ...lease, claimToken: null, claimUntil: null }));
      return true;
    });
  }
}

let roleRepository: AuthRoleProvisioningRepositoryV1 | null = null;

export function getAuthRoleProvisioningRepositoryV1(): AuthRoleProvisioningRepositoryV1 {
  roleRepository ??= new FirestoreAuthRoleProvisioningRepositoryV1(getFirestoreDb());
  return roleRepository;
}

export function setAuthRoleProvisioningRepositoryForTestsV1(
  next: AuthRoleProvisioningRepositoryV1 | null,
): void {
  roleRepository = next;
}
