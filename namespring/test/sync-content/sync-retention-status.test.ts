import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp, type Firestore } from "firebase-admin/firestore";

import type { MaintenanceStatusReaderV1 } from "../../api/_lib/maintenance-coordinator.js";
import {
  parseEmptySyncAdminRequestV1,
  SYNC_ADMIN_EMPTY_BODY_MAX_BYTES,
} from "../../api/_lib/sync-http.js";
import { SYNC_RATE_LIMIT_POLICIES } from "../../api/_lib/sync-rate-limit.js";
import {
  FirestoreSyncRetentionStatusRepositoryV1,
  type SyncRetentionStatusRepositoryV1,
} from "../../api/_lib/sync-repository.js";
import { SyncRetentionStatusServiceV1 } from "../../api/_lib/sync-service.js";
import { ApiHttpError } from "../../api/_lib/http.js";

test("retention status request is exact empty JSON with a 2 KiB route bound", () => {
  assert.equal(SYNC_ADMIN_EMPTY_BODY_MAX_BYTES, 2 * 1024);
  assert.deepEqual(SYNC_RATE_LIMIT_POLICIES.adminStatusRead, {
    scope: "sync.admin-retention-status",
    limit: 30,
    windowSeconds: 5 * 60,
  });
  assert.deepEqual(parseEmptySyncAdminRequestV1({}), {});
  for (const invalid of [null, [], { limit: 1 }, { userId: "user_private" }]) {
    assert.throws(
      () => parseEmptySyncAdminRequestV1(invalid),
      (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_SYNC_ADMIN_REQUEST",
    );
  }
});

test("retention status service emits only bounded aggregate and sanitized maintenance metadata", async () => {
  const repository = {
    async readRetentionDueStatus() {
      return {
        candidateCount: 100,
        candidateCountCap: 100,
        hasMore: true,
        oldestDueAt: "2026-07-17T00:00:00.000Z",
        ownerUserId: "user_private",
        ciphertext: "ciphertext_private",
      };
    },
  } as unknown as SyncRetentionStatusRepositoryV1;
  const maintenance = {
    async readStatus() {
      return {
        state: "running" as const,
        heartbeatAt: new Date("2026-07-19T01:00:00.000Z"),
        leaseExpiresAt: new Date("2026-07-19T01:01:30.000Z"),
        lastCompletedAt: new Date("2026-07-19T00:00:10.000Z"),
        lastOutcome: "partial" as const,
        lastAggregate: { scanned: 40, deleted: 39, skipped: 0, failed: 1, deadlineReached: false },
        claimToken: "claim_token_private",
        activeRunId: "mrun_private",
      };
    },
  } satisfies MaintenanceStatusReaderV1;
  const status = await new SyncRetentionStatusServiceV1(
    repository,
    maintenance,
    { now: () => new Date("2026-07-19T01:00:20.000Z") },
  ).readStatus();

  assert.deepEqual(status, {
    schemaVersion: "namespring.account-sync-retention-status.v1",
    observedAt: "2026-07-19T01:00:20.000Z",
    due: {
      candidateCount: 100,
      candidateCountCap: 100,
      hasMore: true,
      oldestDueAt: "2026-07-17T00:00:00.000Z",
    },
    maintenance: {
      state: "running",
      heartbeatAt: "2026-07-19T01:00:00.000Z",
      leaseExpiresAt: "2026-07-19T01:01:30.000Z",
      lastCompletedAt: "2026-07-19T00:00:10.000Z",
      lastOutcome: "partial",
      lastAggregate: { scanned: 40, deleted: 39, skipped: 0, failed: 1, deadlineReached: false },
    },
  });
  const serialized = JSON.stringify(status);
  for (const forbidden of [
    "user_private",
    "ownerUserId",
    "ciphertext_private",
    "ciphertext",
    "claim_token_private",
    "claimToken",
    "mrun_private",
    "activeRunId",
    "favoriteId",
    "rawError",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `status leaked ${forbidden}`);
  }
});

test("Firestore due discovery projects expiresAt and reads only cap plus one", async () => {
  const calls: Array<readonly unknown[]> = [];
  const expiries = Array.from({ length: 101 }, (_, index) =>
    Timestamp.fromDate(new Date(Date.UTC(2026, 6, 1, 0, index, 0))));
  const query = {
    where(...args: readonly unknown[]) { calls.push(["where", ...args]); return this; },
    orderBy(...args: readonly unknown[]) { calls.push(["orderBy", ...args]); return this; },
    select(...args: readonly unknown[]) { calls.push(["select", ...args]); return this; },
    limit(...args: readonly unknown[]) { calls.push(["limit", ...args]); return this; },
    async get() {
      calls.push(["get"]);
      return {
        size: expiries.length,
        docs: expiries.map((expiresAt) => ({ data: () => ({ expiresAt }) })),
      };
    },
  };
  const db = {
    collection(name: string) {
      calls.push(["collection", name]);
      return query;
    },
    async runTransaction() {
      throw new Error("read-only discovery must never open a transaction");
    },
  } as unknown as Firestore;

  const repository = new FirestoreSyncRetentionStatusRepositoryV1(db);
  assert.equal("commit" in repository, false);
  assert.equal("deleteExpired" in repository, false);
  const result = await repository
    .readRetentionDueStatus("2026-07-19T00:00:00.000Z");
  assert.deepEqual(result, {
    candidateCount: 100,
    candidateCountCap: 100,
    hasMore: true,
    oldestDueAt: "2026-07-01T00:00:00.000Z",
  });
  assert.deepEqual(calls.find((call) => call[0] === "select"), ["select", "expiresAt"]);
  assert.deepEqual(calls.find((call) => call[0] === "limit"), ["limit", 101]);
  assert.equal(calls.some((call) => call[0] === "runTransaction"), false);
});
