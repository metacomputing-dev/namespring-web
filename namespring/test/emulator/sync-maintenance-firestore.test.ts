import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, beforeEach } from "node:test";

import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

import { FirestoreMaintenanceCoordinatorV1 } from "../../api/_lib/maintenance-coordinator.js";
import {
  encodeSyncDocumentForFirestore,
  FirestoreSyncRepositoryV1,
} from "../../api/_lib/sync-repository.js";
import type { SyncDeletionReceiptV1, SyncDocumentV1 } from "../../shared/types/sync-contract.js";

const ROOT_COLLECTIONS = [
  "account_sync_v1",
  "account_sync_deletion_receipts_v1",
  "account_sync_audit_events_v1",
  "server_maintenance_run_states_v1",
] as const;
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.NAMESPRING_EMULATOR_PROJECT_ID;

if (!emulatorHost || !projectId) {
  test("sync maintenance Firestore emulator integration", {
    skip: "run with npm run test:emulator:maintenance",
  }, () => undefined);
} else {
  assert.match(emulatorHost, /^(?:127\.0\.0\.1|localhost):\d{2,5}$/u);
  assert.match(projectId, /^demo-[a-z0-9-]{5,25}$/u);
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, undefined);

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const app = initializeApp({
    projectId,
    // Ephemeral test-only service account prevents ADC/metadata lookup. Its
    // key never leaves this process and the demo emulator cannot reach prod.
    credential: cert({
      projectId,
      clientEmail: `emulator@${projectId}.iam.gserviceaccount.com`,
      privateKey,
    }),
  }, `sync-maintenance-emulator-${process.pid}`);
  const db = getFirestore(app);

  async function clearCollection(firestore: Firestore, collectionName: string): Promise<void> {
    for (;;) {
      const snapshot = await firestore.collection(collectionName).limit(100).get();
      if (snapshot.empty) return;
      const batch = firestore.batch();
      for (const document of snapshot.docs) batch.delete(document.ref);
      await batch.commit();
    }
  }

  async function clearTestData(): Promise<void> {
    for (const collectionName of ROOT_COLLECTIONS) await clearCollection(db, collectionName);
  }

  beforeEach(clearTestData);
  after(async () => {
    await clearTestData();
    await deleteApp(app);
  });

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
      updatedAt: version === 1 ? "2025-07-18T00:00:00.000Z" : "2026-07-18T00:00:00.001Z",
      expiresAt,
    };
  }

  function syncDocumentId(ownerUserId: string): string {
    return createHash("sha256").update(ownerUserId, "utf8").digest("hex");
  }

  function receipt(receiptId: string, userId: string): SyncDeletionReceiptV1 {
    assert.ok(userId.length > 0);
    return {
      receiptId,
      ownerHash: `hmac-sha256:${"a".repeat(64)}`,
      deletedAt: "2026-07-18T00:00:00.000Z",
      deleteAfter: "2026-08-17T00:00:00.000Z",
      reason: "retention_expired",
    };
  }

  function sweepParams(receiptId: string) {
    return {
      actorSessionHash: `hmac-sha256:${"b".repeat(64)}` as const,
      occurredAt: "2026-07-18T00:00:00.000Z",
      auditDeleteAfter: "2027-07-18T00:00:00.000Z",
      limit: 40,
      makeReceipt: (userId: string) => receipt(receiptId, userId),
    };
  }

  test("real query preserves a user-refreshed document and stores native Timestamp without live TTL", {
    timeout: 20_000,
  }, async () => {
    const rawUserId = "emulator-race-raw-user";
    const source = db.collection("account_sync_v1").doc(syncDocumentId(rawUserId));
    await source.set(encodeSyncDocumentForFirestore(
      syncDocument(rawUserId, "2026-07-01T00:00:00.000Z"),
    ));
    const queriedVersion = await source.get();
    assert.ok(queriedVersion.updateTime);
    assert.ok(queriedVersion.data()?.expiresAt instanceof Timestamp);

    const repository = new FirestoreSyncRepositoryV1(db, {
      async afterRetentionCandidatesRead() {
        await source.set(encodeSyncDocumentForFirestore(
          syncDocument(rawUserId, "2027-07-18T00:00:00.000Z", 2),
        ), { merge: false });
      },
    });
    const result = await repository.deleteExpired(sweepParams("sdel_emulator_race_receipt_01"));
    assert.deepEqual({
      scanned: result.dataDocumentsScanned,
      deleted: result.dataDocumentsDeleted,
      skipped: result.dataDocumentsSkipped,
      failed: result.dataDocumentsFailed,
    }, { scanned: 1, deleted: 0, skipped: 1, failed: 0 });

    const preserved = await source.get();
    assert.equal(preserved.exists, true);
    assert.equal(preserved.data()?.version, 2);
    assert.ok(preserved.data()?.expiresAt instanceof Timestamp);
    assert.equal((preserved.data()?.expiresAt as Timestamp).toDate().toISOString(), "2027-07-18T00:00:00.000Z");
    assert.equal(preserved.updateTime?.isEqual(queriedVersion.updateTime!), false);
    assert.equal((await db.collection("account_sync_deletion_receipts_v1").get()).empty, true);
    assert.equal((await db.collection("account_sync_audit_events_v1").get()).empty, true);

    const indexes = JSON.parse(await readFile(
      new URL("../../firestore.indexes.json", import.meta.url),
      "utf8",
    )) as { fieldOverrides?: readonly Record<string, unknown>[] };
    const liveExpiry = indexes.fieldOverrides?.find((entry) => entry.collectionGroup === "account_sync_v1"
      && entry.fieldPath === "expiresAt");
    assert.ok(liveExpiry);
    assert.equal(Object.hasOwn(liveExpiry, "ttl"), false);
    assert.deepEqual(liveExpiry.indexes, [{ order: "ASCENDING", queryScope: "COLLECTION" }]);
  });

  test("source delete, HMAC receipt, and payload-free audit commit atomically", {
    timeout: 30_000,
  }, async () => {
    const rawUserId = "emulator-atomicity-raw-user";
    const receiptId = "sdel_emulator_atomic_receipt_01";
    const source = db.collection("account_sync_v1").doc(syncDocumentId(rawUserId));
    const receiptRef = db.collection("account_sync_deletion_receipts_v1").doc(receiptId);
    await source.set(encodeSyncDocumentForFirestore(
      syncDocument(rawUserId, "2026-07-01T00:00:00.000Z"),
    ));
    await receiptRef.set({ collisionGuard: true });

    const repository = new FirestoreSyncRepositoryV1(db);
    const rolledBack = await repository.deleteExpired(sweepParams(receiptId));
    assert.equal(rolledBack.dataDocumentsDeleted, 0);
    assert.equal(rolledBack.dataDocumentsFailed, 1);
    assert.equal((await source.get()).exists, true, "receipt collision must roll back source deletion");
    assert.equal((await receiptRef.get()).data()?.collisionGuard, true);
    assert.equal((await db.collection("account_sync_audit_events_v1").get()).empty, true);

    await receiptRef.delete();
    const committed = await repository.deleteExpired(sweepParams(receiptId));
    assert.equal(committed.dataDocumentsDeleted, 1);
    assert.equal(committed.dataDocumentsFailed, 0);
    const [deletedSource, storedReceipt, audits] = await Promise.all([
      source.get(),
      receiptRef.get(),
      db.collection("account_sync_audit_events_v1").get(),
    ]);
    assert.equal(deletedSource.exists, false);
    assert.equal(storedReceipt.exists, true);
    assert.ok(storedReceipt.data()?.deleteAfter instanceof Timestamp);
    assert.equal(audits.size, 1);
    assert.ok(audits.docs[0]?.data().deleteAfter instanceof Timestamp);
    assert.match(String(audits.docs[0]?.data().actorSessionHash ?? ""), /^hmac-sha256:[a-f0-9]{64}$/u);
    assert.equal(Object.hasOwn(audits.docs[0]?.data() ?? {}, "actorSessionId"), false);
    assert.equal(JSON.stringify(storedReceipt.data()).includes(rawUserId), false);
    assert.equal(JSON.stringify(audits.docs[0]?.data()).includes(rawUserId), false);
  });

  test("wrong-path owner corruption fails closed while an unrelated expired document is deleted", {
    timeout: 30_000,
  }, async () => {
    const corruptOwner = "emulator-corrupt-owner";
    const healthyOwner = "emulator-healthy-owner";
    const corruptSource = db.collection("account_sync_v1").doc(syncDocumentId("different-owner"));
    const healthySource = db.collection("account_sync_v1").doc(syncDocumentId(healthyOwner));
    await Promise.all([
      corruptSource.set(encodeSyncDocumentForFirestore(
        syncDocument(corruptOwner, "2026-06-30T00:00:00.000Z"),
      )),
      healthySource.set(encodeSyncDocumentForFirestore(
        syncDocument(healthyOwner, "2026-07-01T00:00:00.000Z"),
      )),
    ]);

    const repository = new FirestoreSyncRepositoryV1(db);
    const result = await repository.deleteExpired(sweepParams("sdel_emulator_path_binding_01"));
    assert.deepEqual({
      scanned: result.dataDocumentsScanned,
      deleted: result.dataDocumentsDeleted,
      failed: result.dataDocumentsFailed,
    }, { scanned: 2, deleted: 1, failed: 1 });
    assert.equal((await corruptSource.get()).exists, true);
    assert.equal((await healthySource.get()).exists, false);
    const [receipts, audits] = await Promise.all([
      db.collection("account_sync_deletion_receipts_v1").get(),
      db.collection("account_sync_audit_events_v1").get(),
    ]);
    assert.equal(receipts.size, 1);
    assert.equal(audits.size, 1);
    assert.equal(JSON.stringify(receipts.docs[0]?.data()).includes(corruptOwner), false);
    assert.equal(JSON.stringify(audits.docs[0]?.data()).includes(corruptOwner), false);
  });

  test("concurrent durable claims have exactly one owner", { timeout: 20_000 }, async () => {
    const now = new Date("2026-07-18T00:00:00.000Z");
    const leftCoordinator = new FirestoreMaintenanceCoordinatorV1(db, () => "a".repeat(43));
    const rightCoordinator = new FirestoreMaintenanceCoordinatorV1(db, () => "b".repeat(43));
    const [left, right] = await Promise.all([
      leftCoordinator.claim({
        job: "sync_retention",
        runId: "mrun_emulator_duplicate_owner_a1",
        now,
        leaseMs: 90_000,
      }),
      rightCoordinator.claim({
        job: "sync_retention",
        runId: "mrun_emulator_duplicate_owner_b1",
        now,
        leaseMs: 90_000,
      }),
    ]);
    const owners = [left, right].filter((claim) => claim.acquired);
    assert.equal(owners.length, 1);
    assert.equal([left, right].filter((claim) => !claim.acquired).length, 1);
    const state = await db.collection("server_maintenance_run_states_v1").doc("sync_retention").get();
    assert.equal(state.data()?.activeRunId, owners[0]?.acquired ? owners[0].runId : undefined);
    assert.equal(state.data()?.fence, 1);
  });

  test("expired claim takeover advances the fence and rejects stale finalization", {
    timeout: 20_000,
  }, async () => {
    const firstCoordinator = new FirestoreMaintenanceCoordinatorV1(db, () => "c".repeat(43));
    const nextCoordinator = new FirestoreMaintenanceCoordinatorV1(db, () => "d".repeat(43));
    const first = await firstCoordinator.claim({
      job: "sync_retention",
      runId: "mrun_emulator_takeover_owner_a1",
      now: new Date("2026-07-18T00:00:00.000Z"),
      leaseMs: 90_000,
    });
    assert.ok(first.acquired);
    const takeover = await nextCoordinator.claim({
      job: "sync_retention",
      runId: "mrun_emulator_takeover_owner_b1",
      now: new Date("2026-07-18T00:01:31.000Z"),
      leaseMs: 90_000,
    });
    assert.ok(takeover.acquired);
    assert.equal(takeover.fence, first.fence + 1);
    assert.equal(await firstCoordinator.finish({
      claim: first,
      now: new Date("2026-07-18T00:01:32.000Z"),
      outcome: "completed",
      aggregate: { scanned: 1, deleted: 1, skipped: 0, failed: 0, deadlineReached: false },
    }), false);
    assert.equal(await nextCoordinator.finish({
      claim: takeover,
      now: new Date("2026-07-18T00:01:33.000Z"),
      outcome: "completed",
      aggregate: { scanned: 1, deleted: 1, skipped: 0, failed: 0, deadlineReached: false },
    }), true);
    const state = await db.collection("server_maintenance_run_states_v1").doc("sync_retention").get();
    assert.equal(state.data()?.fence, takeover.fence);
    assert.equal(state.data()?.activeRunId, null);
    assert.equal(state.data()?.claimToken, null);
    assert.equal(state.data()?.claimUntil, null);
  });
}
