import assert from "node:assert/strict";
import test from "node:test";

import type {
  MaintenanceClaimResultV1,
  MaintenanceCoordinatorV1,
} from "../../api/_lib/maintenance-coordinator.js";
import { runSyncRetentionMaintenanceV1 } from "../../api/_lib/sync-maintenance.js";

const claim: Extract<MaintenanceClaimResultV1, { readonly acquired: true }> = {
  acquired: true,
  job: "sync_retention",
  runId: "mrun_0123456789abcdefghijklmn",
  claimToken: "a".repeat(43),
  fence: 1,
};

test("sync maintenance uses fixed bounds and returns aggregate-only progress", async () => {
  const calls: unknown[][] = [];
  const finishes: unknown[] = [];
  const times = [
    new Date("2026-07-18T00:00:00.000Z"),
    new Date("2026-07-18T00:00:00.025Z"),
  ];
  const coordinator: MaintenanceCoordinatorV1 = {
    async claim() { return claim; },
    async finish(input) { finishes.push(input); return true; },
  };
  const response = await runSyncRetentionMaintenanceV1({
    coordinator,
    service: {
      async sweepExpired(...args) {
        calls.push(args);
        return {
          dataDocumentsScanned: 40,
          dataDocumentsDeleted: 37,
          dataDocumentsSkipped: 2,
          dataDocumentsFailed: 1,
          deadlineReached: false,
          deletionReceiptsDeleted: 0,
          requestReceiptsDeleted: 0,
          auditEventsDeleted: 0,
        };
      },
    },
    now: () => times.shift() ?? new Date("2026-07-18T00:00:00.025Z"),
    newRunId: () => claim.runId,
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.[0], { userId: "system_sync_retention", sessionId: claim.runId });
  assert.equal(calls[0]?.[1], 40);
  assert.deepEqual(calls[0]?.[2], { deadlineAtEpochMs: Date.parse("2026-07-18T00:00:45.000Z") });
  assert.equal(finishes.length, 1);
  assert.deepEqual(response, {
    schemaVersion: "namespring.maintenance-run.v1",
    runId: claim.runId,
    job: "sync_retention",
    outcome: "partial",
    scanned: 40,
    deleted: 37,
    skipped: 2,
    failed: 1,
    hasMore: true,
    deadlineReached: false,
    durationMs: 25,
  });
  assert.equal(JSON.stringify(response).includes("internalUserId"), false);
});

test("an overlapping sync run is skipped before touching retention data", async () => {
  let serviceCalls = 0;
  const coordinator: MaintenanceCoordinatorV1 = {
    async claim() { return { acquired: false }; },
    async finish() { throw new Error("finish must not run without a claim"); },
  };
  const response = await runSyncRetentionMaintenanceV1({
    coordinator,
    service: {
      async sweepExpired() {
        serviceCalls += 1;
        throw new Error("must not run");
      },
    },
    now: () => new Date("2026-07-18T00:00:00.000Z"),
    newRunId: () => "mrun_0123456789abcdefghijklmZ",
  });
  assert.equal(serviceCalls, 0);
  assert.equal(response.outcome, "skipped_locked");
  assert.equal(response.scanned, 0);
  assert.equal(response.hasMore, true, "a locked run cannot prove the retention queue is empty");
});
