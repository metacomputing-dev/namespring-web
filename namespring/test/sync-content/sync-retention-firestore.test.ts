import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { Timestamp, type Firestore } from "firebase-admin/firestore";

import {
  encodeSyncDocumentForFirestore,
  FirestoreSyncRepositoryV1,
} from "../../api/_lib/sync-repository.js";
import type { SyncDocumentV1 } from "../../shared/types/sync-contract.js";

interface FakeRef {
  readonly path: string;
}

function syncPath(ownerUserId: string): string {
  return `account_sync_v1/${createHash("sha256").update(ownerUserId, "utf8").digest("hex")}`;
}

interface FakeSnapshot {
  readonly exists: boolean;
  readonly ref: FakeRef;
  readonly updateTime: Timestamp;
  data(): unknown;
}

interface RecordedWrite {
  readonly kind: "delete" | "create";
  readonly path: string;
  readonly data?: unknown;
}

function syncDocument(ownerUserId: string, expiresAt: string, version = 1): SyncDocumentV1 {
  return {
    schemaVersion: "namespring.account-sync.v1",
    ownerUserId,
    version,
    consent: {
      policyVersion: "2026-07-18.v1",
      status: "active",
      scopes: ["favorites"],
      grantedAt: "2025-07-18T00:00:00.000Z",
    },
    favorites: [],
    preferences: {},
    createdAt: "2025-07-18T00:00:00.000Z",
    updatedAt: "2025-07-18T00:00:00.000Z",
    expiresAt,
  };
}

function snapshot(ref: FakeRef, document: SyncDocumentV1, updateTime: Timestamp): FakeSnapshot {
  const stored = encodeSyncDocumentForFirestore(document);
  return { exists: true, ref, updateTime, data: () => stored };
}

function retentionFirestore(input: {
  readonly candidate: FakeSnapshot | readonly FakeSnapshot[];
  readonly current: FakeSnapshot | readonly FakeSnapshot[];
  readonly retryWith?: FakeSnapshot;
  readonly failurePath?: string;
}): { readonly db: Firestore; readonly committedWrites: RecordedWrite[] } {
  const committedWrites: RecordedWrite[] = [];
  const candidates = Array.isArray(input.candidate) ? [...input.candidate] : [input.candidate];
  const currentSnapshots = Array.isArray(input.current) ? [...input.current] : [input.current];
  const current = new Map(currentSnapshots.map((entry) => [entry.ref.path, entry]));
  let didRetry = false;
  const transactionFor = (writes: RecordedWrite[]) => ({
    async get(ref: FakeRef) {
      if (ref.path === input.failurePath) throw new Error("isolated fake Firestore failure");
      const value = current.get(ref.path);
      return value ?? { exists: false, ref, updateTime: Timestamp.fromMillis(0), data: () => undefined };
    },
    delete(ref: FakeRef) { writes.push({ kind: "delete" as const, path: ref.path }); },
    create(ref: FakeRef, data: unknown) {
      writes.push({ kind: "create" as const, path: ref.path, data });
    },
  });
  const db = {
    collection(collectionName: string) {
      const collection = {
        doc(id: string): FakeRef { return { path: `${collectionName}/${id}` }; },
        where(field: string, operator: string, value: unknown) {
          assert.equal(collectionName, "account_sync_v1");
          assert.equal(field, "expiresAt");
          assert.equal(operator, "<=");
          assert.ok(value instanceof Timestamp);
          const query = {
            orderBy(orderField: string, direction: string) {
              assert.equal(orderField, "expiresAt");
              assert.equal(direction, "asc");
              return query;
            },
            limit(valueLimit: number) {
              assert.ok(valueLimit >= 1 && valueLimit <= 80);
              return query;
            },
            async get() { return { docs: candidates, size: candidates.length }; },
          };
          return query;
        },
      };
      return collection;
    },
    async runTransaction<T>(callback: (transaction: ReturnType<typeof transactionFor>) => Promise<T>): Promise<T> {
      if (input.retryWith && !didRetry) {
        didRetry = true;
        await callback(transactionFor([]));
        // Model Firestore retrying after a concurrent user commit. Writes from
        // the first callback are discarded and the second callback sees the
        // refreshed snapshot/updateTime.
        current.set(input.retryWith.ref.path, input.retryWith);
      }
      const writes: RecordedWrite[] = [];
      const result = await callback(transactionFor(writes));
      committedWrites.push(...writes);
      return result;
    },
  } as unknown as Firestore;
  return { db, committedWrites };
}

function sweepParams() {
  return {
    actorSessionHash: `hmac-sha256:${"b".repeat(64)}` as const,
    occurredAt: "2026-07-18T00:00:00.000Z",
    auditDeleteAfter: "2027-07-18T00:00:00.000Z",
    limit: 40,
    makeReceipt: () => ({
      receiptId: "sdel_0123456789abcdefghijklmn",
      ownerHash: `hmac-sha256:${"a".repeat(64)}` as const,
      deletedAt: "2026-07-18T00:00:00.000Z",
      deleteAfter: "2026-08-17T00:00:00.000Z",
      reason: "retention_expired" as const,
    }),
  };
}

test("retention atomically deletes an unchanged expired source with HMAC-only receipt and audit", async () => {
  const rawUserId = "raw-user-id-must-disappear";
  const ref = { path: syncPath(rawUserId) };
  const updateTime = Timestamp.fromDate(new Date("2026-07-17T00:00:00.000Z"));
  const expired = snapshot(ref, syncDocument(rawUserId, "2026-07-01T00:00:00.000Z"), updateTime);
  const fake = retentionFirestore({ candidate: expired, current: expired });
  const result = await new FirestoreSyncRepositoryV1(fake.db).deleteExpired(sweepParams());

  assert.equal(result.dataDocumentsScanned, 1);
  assert.equal(result.dataDocumentsDeleted, 1);
  assert.equal(result.dataDocumentsSkipped, 0);
  assert.equal(result.dataDocumentsFailed, 0);
  assert.deepEqual(fake.committedWrites.map((entry) => entry.kind), ["delete", "create", "create"]);
  assert.equal(fake.committedWrites.filter((entry) => entry.path.startsWith("account_sync_deletion_receipts_v1/")).length, 1);
  assert.equal(fake.committedWrites.filter((entry) => entry.path.startsWith("account_sync_audit_events_v1/")).length, 1);
  assert.equal(JSON.stringify(fake.committedWrites).includes(rawUserId), false);
});

test("a user refresh between query and commit is preserved after Firestore retries the transaction", async () => {
  const rawUserId = "concurrent-refresh-user";
  const ref = { path: syncPath(rawUserId) };
  const queriedAt = Timestamp.fromDate(new Date("2026-07-17T00:00:00.000Z"));
  const refreshedAt = Timestamp.fromDate(new Date("2026-07-18T00:00:01.000Z"));
  const expired = snapshot(ref, syncDocument(rawUserId, "2026-07-01T00:00:00.000Z"), queriedAt);
  const refreshed = snapshot(
    ref,
    syncDocument(rawUserId, "2027-07-18T00:00:00.000Z", 2),
    refreshedAt,
  );
  const fake = retentionFirestore({ candidate: expired, current: expired, retryWith: refreshed });
  const result = await new FirestoreSyncRepositoryV1(fake.db).deleteExpired(sweepParams());

  assert.equal(result.dataDocumentsScanned, 1);
  assert.equal(result.dataDocumentsDeleted, 0);
  assert.equal(result.dataDocumentsSkipped, 1);
  assert.equal(result.dataDocumentsFailed, 0);
  assert.deepEqual(fake.committedWrites, []);
});

test("one failing retention candidate is isolated without blocking unrelated atomic deletion", async () => {
  const updateTime = Timestamp.fromDate(new Date("2026-07-17T00:00:00.000Z"));
  const goodRef = { path: syncPath("good-raw-user") };
  const badRef = { path: syncPath("bad-raw-user") };
  const good = snapshot(goodRef, syncDocument("good-raw-user", "2026-07-01T00:00:00.000Z"), updateTime);
  const bad = snapshot(badRef, syncDocument("bad-raw-user", "2026-07-01T00:00:00.000Z"), updateTime);
  const fake = retentionFirestore({
    candidate: [good, bad],
    current: [good, bad],
    failurePath: badRef.path,
  });
  const result = await new FirestoreSyncRepositoryV1(fake.db).deleteExpired(sweepParams());

  assert.equal(result.dataDocumentsScanned, 2);
  assert.equal(result.dataDocumentsDeleted, 1);
  assert.equal(result.dataDocumentsFailed, 1);
  assert.equal(fake.committedWrites.filter((entry) => entry.kind === "delete").length, 1);
  assert.equal(fake.committedWrites.some((entry) => entry.path === badRef.path), false);
  assert.equal(JSON.stringify(fake.committedWrites).includes("good-raw-user"), false);
});

test("retention fails closed and isolates a valid payload stored under the wrong owner hash", async () => {
  const corruptOwner = "wrong-path-raw-user";
  const corruptRef = { path: syncPath("different-raw-user") };
  const healthyOwner = "healthy-raw-user";
  const healthyRef = { path: syncPath(healthyOwner) };
  const updateTime = Timestamp.fromDate(new Date("2026-07-17T00:00:00.000Z"));
  const corrupt = snapshot(
    corruptRef,
    syncDocument(corruptOwner, "2026-07-01T00:00:00.000Z"),
    updateTime,
  );
  const healthy = snapshot(
    healthyRef,
    syncDocument(healthyOwner, "2026-07-01T00:00:00.000Z"),
    updateTime,
  );
  const fake = retentionFirestore({ candidate: [corrupt, healthy], current: [corrupt, healthy] });
  const result = await new FirestoreSyncRepositoryV1(fake.db).deleteExpired(sweepParams());

  assert.deepEqual({
    scanned: result.dataDocumentsScanned,
    deleted: result.dataDocumentsDeleted,
    failed: result.dataDocumentsFailed,
  }, { scanned: 2, deleted: 1, failed: 1 });
  assert.equal(fake.committedWrites.some((entry) => entry.path === corruptRef.path), false);
  assert.equal(fake.committedWrites.some((entry) => entry.path === healthyRef.path && entry.kind === "delete"), true);
  assert.equal(JSON.stringify(fake.committedWrites).includes(corruptOwner), false);
});
