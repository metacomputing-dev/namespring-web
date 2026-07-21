import assert from "node:assert/strict";
import test from "node:test";

import { ApiHttpError } from "../../api/_lib/http.js";
import { runPremiumExpiryMaintenanceV1 } from "../../api/_lib/premium-expiry-maintenance.js";

test("premium unpaid expiry is globally fenced and returns aggregate-only progress", async () => {
  let sweepCalls = 0;
  let finishedAggregate: unknown;
  const result = await runPremiumExpiryMaintenanceV1({ limit: 7 }, {
    coordinator: {
      async claim(input) {
        assert.equal(input.job, "premium_unpaid_expiry");
        assert.equal(input.leaseMs, 90_000);
        return {
          acquired: true,
          job: input.job,
          runId: input.runId,
          claimToken: "a".repeat(43),
          fence: 1,
        } as const;
      },
      async finish(input) {
        finishedAggregate = input.aggregate;
        return true;
      },
    },
    sweeper: {
      async sweepExpiredUnpaidData(input) {
        sweepCalls += 1;
        assert.deepEqual(input, { now: "2026-07-19T00:00:00.000Z", limit: 7 });
        return { scanned: 3, deleted: 2, skipped: 1, failed: 0, hasMore: false };
      },
    },
    now: () => new Date("2026-07-19T00:00:00.000Z"),
    newRunId: () => `mrun_${"x".repeat(24)}`,
  });
  assert.equal(sweepCalls, 1);
  assert.deepEqual(finishedAggregate, {
    scanned: 3, deleted: 2, skipped: 1, failed: 0, deadlineReached: false,
  });
  assert.deepEqual(result, {
    schemaVersion: "namespring.maintenance-run.v1",
    runId: `mrun_${"x".repeat(24)}`,
    job: "premium_unpaid_expiry",
    outcome: "completed",
    scanned: 3,
    deleted: 2,
    skipped: 1,
    failed: 0,
    hasMore: false,
    deadlineReached: false,
    durationMs: 0,
  });
});

test("premium unpaid expiry overlap and invalid limits touch no candidate data", async () => {
  let sweepCalls = 0;
  const dependencies = {
    coordinator: {
      async claim() { return { acquired: false } as const; },
      async finish() { throw new Error("finish must not run"); },
    },
    sweeper: {
      async sweepExpiredUnpaidData() {
        sweepCalls += 1;
        return { scanned: 0, deleted: 0, skipped: 0, failed: 0, hasMore: false };
      },
    },
    now: () => new Date("2026-07-19T00:00:00.000Z"),
    newRunId: () => `mrun_${"y".repeat(24)}`,
  };
  const locked = await runPremiumExpiryMaintenanceV1({}, dependencies);
  assert.equal(locked.outcome, "skipped_locked");
  assert.equal(sweepCalls, 0);
  await assert.rejects(
    runPremiumExpiryMaintenanceV1({ limit: 21 }, dependencies),
    (error: unknown) => error instanceof ApiHttpError && error.code === "PREMIUM_EXPIRY_SWEEP_INVALID",
  );
  assert.equal(sweepCalls, 0);
});
