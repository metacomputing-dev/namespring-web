import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp, type Firestore } from "firebase-admin/firestore";

import { FirestoreAuthAccountRepository } from "../../api/_lib/auth-accounts-repository.js";
import {
  ACCOUNT_DELETION_FENCE_COLLECTION_V1,
  ACCOUNT_PAYMENT_LEASE_COLLECTION_V1,
} from "../../api/_lib/account-write-fence.js";
import {
  createAuthIdentityBindingDigesterV2,
  digestIdentityPart,
} from "../../api/_lib/auth-identity.js";

const TEST_BINDING_DIGESTER = createAuthIdentityBindingDigesterV2(
  "auth-deletion-binding-test-key-0123456789abcdef",
);

interface FakeReference {
  readonly collectionName: string;
  readonly id: string;
  readonly path: string;
  get(): Promise<{ readonly exists: boolean; readonly data: () => unknown }>;
}

interface RecordedOperation {
  readonly kind: "get" | "set" | "create" | "delete";
  readonly path: string;
  readonly data?: unknown;
}

function fakeDeletionFirestore(hasPaymentLease: boolean): {
  readonly db: Firestore;
  readonly operations: RecordedOperation[];
} {
  const firebaseUid = "firebase-firestore-delete";
  const internalUserId = "internal-user-firestore-delete";
  const principalPath = `authFirebasePrincipalsV1/${digestIdentityPart(firebaseUid)}`;
  const accountPath = `authAccountsV1/${internalUserId}`;
  const leasePath = `${ACCOUNT_PAYMENT_LEASE_COLLECTION_V1}/${internalUserId}`;
  const records = new Map<string, unknown>([
    [principalPath, { internalUserId, firebaseUid, createdAt: "2026-07-18T00:00:00.000Z" }],
    [accountPath, {
      internalUserId,
      status: "active",
      roles: ["user"],
      providers: [{
        provider: "google",
        issuer: "https://accounts.google.com",
        subjectDigest: `hmac-sha256:v2:${"a".repeat(64)}`,
        linkedAt: "2026-07-18T00:00:00.000Z",
      }],
      firebaseUids: [firebaseUid],
      createdAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z",
      lastAuthenticatedAt: "2026-07-18T00:00:00.000Z",
      deletionRequestedAt: null,
      deletedAt: null,
      deleteAfter: null,
      pendingProviderUnlink: null,
      version: 1,
    }],
  ]);
  if (hasPaymentLease) records.set(leasePath, { orderId: "order_in_flight" });
  const operations: RecordedOperation[] = [];
  const reference = (collectionName: string, id: string): FakeReference => {
    const path = `${collectionName}/${id}`;
    return {
      collectionName,
      id,
      path,
      async get() {
        const value = records.get(path);
        return { exists: value !== undefined, data: () => value };
      },
    };
  };
  const transaction = {
    async get(ref: FakeReference) {
      operations.push({ kind: "get", path: ref.path });
      const value = records.get(ref.path);
      return { exists: value !== undefined, data: () => value };
    },
    set(ref: FakeReference, data: unknown) {
      operations.push({ kind: "set", path: ref.path, data });
      records.set(ref.path, data);
    },
    create(ref: FakeReference, data: unknown) {
      operations.push({ kind: "create", path: ref.path, data });
      records.set(ref.path, data);
    },
    delete(ref: FakeReference) {
      operations.push({ kind: "delete", path: ref.path });
      records.delete(ref.path);
    },
  };
  const db = {
    collection(collectionName: string) {
      return { doc: (id: string) => reference(collectionName, id) };
    },
    async runTransaction<T>(callback: (value: typeof transaction) => Promise<T>): Promise<T> {
      return callback(transaction);
    },
  } as unknown as Firestore;
  return { db, operations };
}

test("Firestore deletion reads the payment lease before atomically creating the write fence", async () => {
  let id = 0;
  const open = fakeDeletionFirestore(false);
  const repository = new FirestoreAuthAccountRepository(
    open.db,
    () => "2026-07-18T00:00:00.000Z",
    () => `deletion-firestore-entropy-${++id}`,
    () => "auth-audit-test-key-0123456789abcdef",
    TEST_BINDING_DIGESTER,
  );
  const deletion = await repository.beginAccountDeletion("firebase-firestore-delete");
  assert.match(deletion.job.deletionRequestId, /^deletion_request_v1_[a-f0-9]{32}$/u);

  const leaseRead = open.operations.findIndex(
    (operation) => operation.kind === "get" && operation.path.startsWith(`${ACCOUNT_PAYMENT_LEASE_COLLECTION_V1}/`),
  );
  const firstWrite = open.operations.findIndex((operation) => operation.kind !== "get");
  const fenceCreate = open.operations.findIndex(
    (operation) => operation.kind === "create" && operation.path.startsWith(`${ACCOUNT_DELETION_FENCE_COLLECTION_V1}/`),
  );
  assert.ok(leaseRead >= 0);
  assert.ok(firstWrite > leaseRead);
  assert.ok(fenceCreate >= firstWrite);
  assert.equal(open.operations.some((operation) => operation.kind === "delete"), false);
  const audit = open.operations.find(
    (operation) => operation.kind === "create" && operation.path.startsWith("authAuditEventsV1/"),
  );
  assert.ok(audit?.data);
  const auditData = audit.data as { subjectHash?: unknown; deleteAfter?: unknown };
  assert.match(String(auditData.subjectHash), /^hmac-sha256:[a-f0-9]{64}$/u);
  assert.ok(auditData.deleteAfter instanceof Timestamp);
  assert.equal(JSON.stringify(audit.data).includes("internal-user-firestore-delete"), false);

  await repository.recordAccountDeletionCleanupFailure(
    deletion.account.internalUserId,
    deletion.job.deletionRequestId,
    ["sync/temporary"],
  );
  const retriable = await repository.getAccountDeletionJob(deletion.job.deletionRequestId);
  assert.equal(retriable?.attemptCount, 1);
  assert.equal(retriable?.backoffMs, 30_000);
  assert.equal(retriable?.nextAttemptAt, "2026-07-18T00:00:30.000Z");
  assert.equal(retriable?.deleteAfter, null);

  const claim = await repository.claimAccountDeletionJob({
    deletionRequestId: deletion.job.deletionRequestId,
    now: "2026-07-18T00:00:00.000Z",
    leaseMs: 90_000,
    claimToken: `ajc_${"a".repeat(32)}`,
    force: true,
  });
  assert.equal(claim.acquired, true);
  const duplicate = await repository.claimAccountDeletionJob({
    deletionRequestId: deletion.job.deletionRequestId,
    now: "2026-07-18T00:00:00.000Z",
    leaseMs: 90_000,
    claimToken: `ajc_${"b".repeat(32)}`,
    force: true,
  });
  assert.deepEqual(duplicate, { acquired: false });
  assert.equal(claim.acquired, true);
  if (!claim.acquired) return;

  const completed = await repository.completeAccountDeletion(
    deletion.account.internalUserId,
    deletion.job.deletionRequestId,
    undefined,
    claim.claim,
  );
  assert.equal(completed.status, "deleted");
  assert.equal(completed.deleteAfter, "2026-08-17T00:00:00.000Z");
  const completedJob = await repository.getAccountDeletionJob(deletion.job.deletionRequestId);
  assert.equal(completedJob?.deleteAfter, "2026-08-17T00:00:00.000Z");
  assert.equal(completedJob?.nextAttemptAt, null);
  assert.equal(completedJob?.backoffMs, 0);
  assert.deepEqual(completedJob?.firebaseUids, []);
  assert.deepEqual(completedJob?.bindingDigests, []);
  const storedJob = open.operations.findLast(
    (operation) => operation.kind === "set" && operation.path.startsWith("authDeletionJobsV1/"),
  );
  assert.ok((storedJob?.data as { deleteAfter?: unknown })?.deleteAfter instanceof Timestamp);
  const storedAccount = open.operations.findLast(
    (operation) => operation.kind === "set" && operation.path === `authAccountsV1/${deletion.account.internalUserId}`,
  );
  assert.ok((storedAccount?.data as { deleteAfter?: unknown })?.deleteAfter instanceof Timestamp);
  assert.equal(open.operations.some(
    (operation) => operation.kind === "delete" && operation.path.startsWith("authFirebasePrincipalsV1/"),
  ), true);
});

test("Firestore deletion with a surviving payment lease performs no writes", async () => {
  const leased = fakeDeletionFirestore(true);
  const repository = new FirestoreAuthAccountRepository(
    leased.db,
    () => "2026-07-18T00:00:00.000Z",
    () => "deletion-firestore-entropy",
    () => "auth-audit-test-key-0123456789abcdef",
    TEST_BINDING_DIGESTER,
  );
  await assert.rejects(
    () => repository.beginAccountDeletion("firebase-firestore-delete"),
    (error: unknown) => (error as { code?: string }).code === "PAYMENT_RECONCILIATION_REQUIRED",
  );
  assert.equal(leased.operations.some((operation) => operation.kind !== "get"), false);
});
