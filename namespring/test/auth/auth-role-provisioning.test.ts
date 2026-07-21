import assert from "node:assert/strict";
import test from "node:test";

import type { AuthAccountRecord } from "../../api/_lib/auth-accounts-repository.js";
import {
  authRoleProvisioningSubjectHashV1,
  desiredFirebaseClaimsV1,
  type AuthRoleProvisioningReceiptV1,
} from "../../api/_lib/auth-role-provisioning-contract.js";
import {
  InMemoryAuthRoleProvisioningRepositoryV1,
  type AuthRoleProvisioningClaimV1,
} from "../../api/_lib/auth-role-provisioning-repository.js";
import {
  provisionAuthRoleV1,
  type AuthRoleProvisioningClaimsGatewayV1,
} from "../../api/_lib/auth-role-provisioning.js";
import { ApiHttpError } from "../../api/_lib/http.js";

const KEY = "role-provisioning-test-key-0123456789abcdef";
const AT = "2026-07-19T00:00:00.000Z";

function account(
  roles: readonly string[] = ["user"],
  overrides: Partial<AuthAccountRecord> = {},
): AuthAccountRecord {
  return {
    internalUserId: "internal-role-target",
    status: "active",
    roles,
    providers: [],
    firebaseUids: ["firebase-role-a", "firebase-role-b"],
    createdAt: AT,
    updatedAt: AT,
    lastAuthenticatedAt: AT,
    deletionRequestedAt: null,
    deletedAt: null,
    deleteAfter: null,
    pendingProviderUnlink: null,
    version: 1,
    ...overrides,
  };
}

class FakeClaims implements AuthRoleProvisioningClaimsGatewayV1 {
  readonly values = new Map<string, Record<string, unknown>>();
  readonly events: string[];
  failSetOnceFor: string | null = null;
  ignoreWrites = false;

  constructor(initial: Readonly<Record<string, Readonly<Record<string, unknown>>>>, events: string[] = []) {
    this.events = events;
    for (const [uid, claims] of Object.entries(initial)) this.values.set(uid, structuredClone(claims));
  }

  async getCustomClaims(firebaseUid: string): Promise<Readonly<Record<string, unknown>>> {
    this.events.push(`get:${firebaseUid}`);
    return structuredClone(this.values.get(firebaseUid) ?? {});
  }

  async setCustomClaims(firebaseUid: string, claims: Readonly<Record<string, unknown>>): Promise<void> {
    this.events.push(`set:${firebaseUid}`);
    if (this.failSetOnceFor === firebaseUid) {
      this.failSetOnceFor = null;
      throw new ApiHttpError(503, "ROLE_PROVISIONING_FIREBASE_WRITE_FAILED", "Firebase custom claims could not be updated.");
    }
    if (!this.ignoreWrites) this.values.set(firebaseUid, structuredClone(claims));
  }

  async revokeRefreshTokens(firebaseUid: string): Promise<void> {
    this.events.push(`revoke:${firebaseUid}`);
  }
}

class TrackingRepository extends InMemoryAuthRoleProvisioningRepositoryV1 {
  constructor(target: AuthAccountRecord, private readonly events: string[] = []) {
    super([target], () => AT, () => KEY);
  }

  async persistDesiredRoles(
    claim: AuthRoleProvisioningClaimV1,
    receipt: AuthRoleProvisioningReceiptV1,
  ): Promise<readonly string[]> {
    this.events.push("persist");
    return super.persistDesiredRoles(claim, receipt);
  }
}

function dependencies(
  repository: InMemoryAuthRoleProvisioningRepositoryV1,
  claims: AuthRoleProvisioningClaimsGatewayV1,
  now = () => AT,
) {
  let token = 0;
  return {
    repository,
    claims,
    now,
    hmacKey: () => KEY,
    newClaimToken: () => `rpc_${String(++token).padStart(32, "a")}`,
  } as const;
}

const request = {
  requestId: "role_request_v1_aaaaaaaaaaaaaaaa",
  targetFirebaseUid: "firebase-role-a",
  operatorRef: "ops.primary",
  operation: "grant",
  role: "admin",
  confirmed: true,
} as const;

test("dry-run is the default-safe read path and emits only a pseudonymized preview", async () => {
  const repository = new TrackingRepository(account());
  const claims = new FakeClaims({
    "firebase-role-a": { plan: "paid" },
    "firebase-role-b": { feature: { beta: true } },
  });
  const receipt = await provisionAuthRoleV1(
    { ...request, confirmed: false },
    dependencies(repository, claims),
  );

  assert.equal(receipt.status, "dry_run");
  assert.equal(receipt.stage, "dry_run");
  assert.deepEqual(receipt.beforeRoles, ["user"]);
  assert.deepEqual(receipt.afterRoles, ["user", "admin"]);
  assert.equal(repository.getReceipt(request.requestId), null);
  assert.deepEqual(repository.getAccount("firebase-role-a")?.roles, ["user"]);
  assert.equal(claims.events.some((event) => event.startsWith("set:") || event.startsWith("revoke:")), false);
  const serialized = JSON.stringify(receipt);
  assert.equal(serialized.includes("firebase-role-a"), false);
  assert.equal(serialized.includes("internal-role-target"), false);
  assert.equal(serialized.includes("ops.primary"), false);
});

test("grant preserves unrelated claims, verifies every UID, revokes sessions, then persists last", async () => {
  const events: string[] = [];
  const repository = new TrackingRepository(account(), events);
  const claims = new FakeClaims({
    "firebase-role-a": { plan: "paid", nested: { keep: [1, true, "yes"] } },
    "firebase-role-b": { support: true, roles: ["support"] },
  }, events);

  const receipt = await provisionAuthRoleV1(request, dependencies(repository, claims));
  assert.equal(receipt.status, "completed");
  assert.equal(receipt.stage, "completed");
  assert.deepEqual(repository.getAccount("firebase-role-a")?.roles, ["user", "admin"]);
  assert.deepEqual(claims.values.get("firebase-role-a"), {
    plan: "paid",
    nested: { keep: [1, true, "yes"] },
    admin: true,
    roles: ["admin"],
  });
  assert.deepEqual(claims.values.get("firebase-role-b"), {
    support: true,
    admin: true,
    roles: ["admin", "support"],
  });
  const persistAt = events.indexOf("persist");
  assert.ok(persistAt > events.lastIndexOf("revoke:firebase-role-b"));
  assert.ok(events.indexOf("revoke:firebase-role-a") > events.lastIndexOf("set:firebase-role-b"));
  assert.deepEqual(Object.keys(receipt).sort(), [
    "afterRoles",
    "beforeRoles",
    "deleteAfter",
    "operation",
    "operatorSubjectHash",
    "requestId",
    "role",
    "schemaVersion",
    "stage",
    "status",
    "targetSubjectHash",
    "updatedAt",
  ]);
  assert.equal(new Date(receipt.deleteAfter!).toISOString(), "2027-07-19T00:00:00.000Z");
});

test("revoke removes the persisted role first and a partial Firebase failure reruns safely", async () => {
  const events: string[] = [];
  const repository = new TrackingRepository(account(["user", "admin"]), events);
  const claims = new FakeClaims({
    "firebase-role-a": { admin: true, roles: ["admin"], keep: "a" },
    "firebase-role-b": { admin: true, roles: ["admin"], keep: "b" },
  }, events);
  claims.failSetOnceFor = "firebase-role-b";
  const revoke = { ...request, operation: "revoke", confirmed: true } as const;

  await assert.rejects(
    () => provisionAuthRoleV1(revoke, dependencies(repository, claims)),
    (error: unknown) => error instanceof ApiHttpError && error.code === "ROLE_PROVISIONING_FIREBASE_WRITE_FAILED",
  );
  assert.deepEqual(repository.getAccount("firebase-role-a")?.roles, ["user"]);
  assert.equal(events.indexOf("persist") < events.indexOf("set:firebase-role-a"), true);
  assert.equal(repository.getReceipt(request.requestId)?.status, "pending");

  const completed = await provisionAuthRoleV1(revoke, dependencies(repository, claims));
  assert.equal(completed.status, "completed");
  assert.deepEqual(claims.values.get("firebase-role-a"), { roles: [], keep: "a" });
  assert.deepEqual(claims.values.get("firebase-role-b"), { roles: [], keep: "b" });
  assert.equal(events.filter((event) => event === "revoke:firebase-role-a").length, 1);
});

test("same request is idempotent and different material is rejected", async () => {
  const events: string[] = [];
  const repository = new TrackingRepository(account(), events);
  const claims = new FakeClaims({ "firebase-role-a": {}, "firebase-role-b": {} }, events);
  const first = await provisionAuthRoleV1(request, dependencies(repository, claims));
  const mutationEvents = events.filter((event) => event.startsWith("set:") || event.startsWith("revoke:") || event === "persist").length;
  const second = await provisionAuthRoleV1(request, dependencies(repository, claims));
  assert.deepEqual(second, first);
  assert.equal(
    events.filter((event) => event.startsWith("set:") || event.startsWith("revoke:") || event === "persist").length,
    mutationEvents,
  );
  await assert.rejects(
    () => provisionAuthRoleV1({ ...request, operatorRef: "ops.different" }, dependencies(repository, claims)),
    (error: unknown) => error instanceof ApiHttpError && error.code === "ROLE_PROVISIONING_REQUEST_REUSE",
  );
});

test("target lease serializes races, fences expired workers, and keeps pending anchors", async () => {
  const repository = new InMemoryAuthRoleProvisioningRepositoryV1([account()], () => AT, () => KEY);
  const targetHash = authRoleProvisioningSubjectHashV1("target", "internal-role-target", KEY);
  const operatorHash = authRoleProvisioningSubjectHashV1("operator", "ops.primary", KEY);
  const base = {
    requestId: request.requestId,
    targetFirebaseUid: request.targetFirebaseUid,
    targetSubjectHash: targetHash,
    operatorSubjectHash: operatorHash,
    operation: request.operation,
    role: request.role,
    now: AT,
    claimToken: `rpc_${"a".repeat(32)}`,
  } as const;
  const first = await repository.acquire(base);
  assert.equal(first.completed, false);
  if (first.completed) return;
  await assert.rejects(
    () => repository.acquire({ ...base, claimToken: `rpc_${"b".repeat(32)}` }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "ROLE_PROVISIONING_LEASE_HELD",
  );
  const takeover = await repository.acquire({
    ...base,
    now: "2026-07-19T00:02:00.001Z",
    claimToken: `rpc_${"b".repeat(32)}`,
  });
  assert.equal(takeover.completed, false);
  if (takeover.completed) return;
  assert.equal(takeover.claim.fence, first.claim.fence + 1);
  await assert.rejects(
    () => repository.persistDesiredRoles(first.claim, first.receipt),
    (error: unknown) => error instanceof ApiHttpError && error.code === "ROLE_PROVISIONING_CLAIM_LOST",
  );
  assert.equal(await repository.release(takeover.claim), true);
  await assert.rejects(
    () => repository.acquire({
      ...base,
      requestId: "role_request_v1_bbbbbbbbbbbbbbbb",
      now: "2026-07-19T00:02:01.000Z",
      claimToken: `rpc_${"c".repeat(32)}`,
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "ROLE_PROVISIONING_OPERATION_PENDING",
  );
});

test("premium_system is never grantable but can be explicitly scrubbed from a human account", async () => {
  const contaminated = new TrackingRepository(account(["user", "premium_system"]));
  const contaminatedClaims = new FakeClaims({
    "firebase-role-a": { premium_system: true, roles: ["premium_system"], keep: 1 },
    "firebase-role-b": { roles: ["premium_system"], keep: 2 },
  });
  await assert.rejects(
    () => provisionAuthRoleV1(
      { ...request, role: "premium_system" as const },
      dependencies(contaminated, contaminatedClaims),
    ),
    (error: unknown) => error instanceof ApiHttpError && error.code === "ROLE_PROVISIONING_SYSTEM_ROLE_GRANT_FORBIDDEN",
  );
  await assert.rejects(
    () => provisionAuthRoleV1(request, dependencies(contaminated, contaminatedClaims)),
    (error: unknown) => error instanceof ApiHttpError && error.code === "ROLE_PROVISIONING_SYSTEM_ROLE_CONTAMINATION",
  );

  const cleaned = await provisionAuthRoleV1({
    ...request,
    operation: "revoke",
    role: "premium_system",
  }, dependencies(contaminated, contaminatedClaims));
  assert.equal(cleaned.status, "completed");
  assert.deepEqual(contaminated.getAccount("firebase-role-a")?.roles, ["user"]);
  assert.deepEqual(contaminatedClaims.values.get("firebase-role-a"), { roles: [], keep: 1 });
  assert.deepEqual(contaminatedClaims.values.get("firebase-role-b"), { roles: [], keep: 2 });
});

test("system contamination in claims blocks normal work and user is immutable", async () => {
  const repository = new TrackingRepository(account());
  const claims = new FakeClaims({
    // Even a false/stale key is contamination and must be explicitly scrubbed.
    "firebase-role-a": { premium_system: false },
    "firebase-role-b": {},
  });
  await assert.rejects(
    () => provisionAuthRoleV1(request, dependencies(repository, claims)),
    (error: unknown) => error instanceof ApiHttpError && error.code === "ROLE_PROVISIONING_SYSTEM_ROLE_CONTAMINATION",
  );
  await assert.rejects(
    () => provisionAuthRoleV1({ ...request, role: "user" as never }, dependencies(repository, claims)),
    (error: unknown) => error instanceof ApiHttpError && error.code === "ROLE_PROVISIONING_USER_IMMUTABLE",
  );
});

test("claims mutation fails closed on size overflow and readback mismatch", async () => {
  assert.throws(
    () => desiredFirebaseClaimsV1({ large: "x".repeat(1_000) }, "grant", "admin"),
    (error: unknown) => error instanceof ApiHttpError && error.code === "ROLE_PROVISIONING_CLAIMS_TOO_LARGE",
  );

  const repository = new TrackingRepository(account());
  const claims = new FakeClaims({ "firebase-role-a": {}, "firebase-role-b": {} });
  claims.ignoreWrites = true;
  await assert.rejects(
    () => provisionAuthRoleV1(request, dependencies(repository, claims)),
    (error: unknown) => error instanceof ApiHttpError && error.code === "ROLE_PROVISIONING_FIREBASE_READBACK_MISMATCH",
  );
  assert.deepEqual(repository.getAccount("firebase-role-a")?.roles, ["user"]);
});

test("inactive, deletion-fenced, and provider-unlink-pending accounts cannot be provisioned", async () => {
  for (const target of [
    account(["user"], { status: "deletion_pending" }),
    account(["user"], { pendingProviderUnlink: {
      unlinkRequestId: `provider_unlink_v1_${"a".repeat(32)}`,
      provider: "google",
      bindingDigest: `hmac-sha256:v2:${"b".repeat(64)}`,
    } }),
  ]) {
    const repository = new TrackingRepository(target);
    const claims = new FakeClaims({ "firebase-role-a": {}, "firebase-role-b": {} });
    await assert.rejects(() => provisionAuthRoleV1(request, dependencies(repository, claims)), ApiHttpError);
  }
  const fenced = new TrackingRepository(account());
  fenced.setDeletionFence("firebase-role-a", true);
  await assert.rejects(
    () => provisionAuthRoleV1(request, dependencies(fenced, new FakeClaims({}))),
    (error: unknown) => error instanceof ApiHttpError && error.code === "ACCOUNT_DELETION_IN_PROGRESS",
  );
});
