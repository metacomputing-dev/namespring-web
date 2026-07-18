import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp, type Firestore } from "firebase-admin/firestore";

import {
  FirestoreMaintenanceCoordinatorV1,
  FirestoreMaintenanceStatusReaderV1,
} from "../../api/_lib/maintenance-coordinator.js";
import { ApiHttpError } from "../../api/_lib/http.js";

interface FakeRef {
  readonly path: string;
  get(): Promise<{ exists: boolean; data(): unknown }>;
}

function fakeFirestore(): { readonly db: Firestore; readonly records: Map<string, unknown> } {
  const records = new Map<string, unknown>();
  const db = {
    collection(name: string) {
      return { doc: (id: string): FakeRef => {
        const path = `${name}/${id}`;
        return {
          path,
          async get() {
            const value = records.get(path);
            return { exists: value !== undefined, data: () => value };
          },
        };
      } };
    },
    async runTransaction<T>(callback: (transaction: {
      get(ref: FakeRef): Promise<{ exists: boolean; data(): unknown }>;
      set(ref: FakeRef, value: unknown): void;
    }) => Promise<T>): Promise<T> {
      const pending = new Map<string, unknown>();
      const result = await callback({
        async get(ref) {
          const value = records.get(ref.path);
          return { exists: value !== undefined, data: () => value };
        },
        set(ref, value) { pending.set(ref.path, value); },
      });
      for (const [path, value] of pending) records.set(path, value);
      return result;
    },
  } as unknown as Firestore;
  return { db, records };
}

function inactiveState(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    schemaVersion: "namespring.maintenance-run-state.v1",
    job: "sync_retention",
    fence: 1,
    activeRunId: null,
    claimToken: null,
    claimUntil: null,
    lastStartedAt: Timestamp.fromDate(new Date("2026-07-18T00:00:00.000Z")),
    lastFinishedAt: null,
    lastOutcome: null,
    lastAggregate: null,
    ...overrides,
  };
}

async function assertApiError(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof ApiHttpError);
    assert.equal(error.code, code);
    return true;
  });
}

test("durable maintenance claim fences overlaps and permits expired-lease takeover", async () => {
  const fake = fakeFirestore();
  let token = 0;
  const coordinator = new FirestoreMaintenanceCoordinatorV1(
    fake.db,
    () => `${String(++token).padStart(43, "a")}`,
  );
  const first = await coordinator.claim({
    job: "sync_retention",
    runId: "mrun_0123456789abcdefghijklmn",
    now: new Date("2026-07-18T00:00:00.000Z"),
    leaseMs: 90_000,
  });
  assert.equal(first.acquired, true);
  const overlap = await coordinator.claim({
    job: "sync_retention",
    runId: "mrun_0123456789abcdefghijklmX",
    now: new Date("2026-07-18T00:00:30.000Z"),
    leaseMs: 90_000,
  });
  assert.deepEqual(overlap, { acquired: false });
  const takeover = await coordinator.claim({
    job: "sync_retention",
    runId: "mrun_0123456789abcdefghijklmY",
    now: new Date("2026-07-18T00:01:31.000Z"),
    leaseMs: 90_000,
  });
  assert.equal(takeover.acquired, true);
  assert.ok(first.acquired && takeover.acquired);
  assert.equal(takeover.fence, first.fence + 1);

  assert.equal(await coordinator.finish({
    claim: first,
    now: new Date("2026-07-18T00:01:32.000Z"),
    outcome: "completed",
    aggregate: { scanned: 1, deleted: 1, skipped: 0, failed: 0, deadlineReached: false },
  }), false, "a stale worker must not finalize a newer claim");
  assert.equal(await coordinator.finish({
    claim: takeover,
    now: new Date("2026-07-18T00:01:33.000Z"),
    outcome: "partial",
    aggregate: { scanned: 40, deleted: 39, skipped: 0, failed: 1, deadlineReached: false },
  }), true);

  const stored = fake.records.get("server_maintenance_run_states_v1/sync_retention") as {
    claimToken?: unknown;
    claimUntil?: unknown;
    lastFinishedAt?: unknown;
    lastAggregate?: unknown;
  };
  assert.equal(stored.claimToken, null);
  assert.equal(stored.claimUntil, null);
  assert.ok(stored.lastFinishedAt instanceof Timestamp);
  assert.deepEqual(stored.lastAggregate, {
    scanned: 40,
    deleted: 39,
    skipped: 0,
    failed: 1,
    deadlineReached: false,
  });
  assert.equal(JSON.stringify(stored).includes("user"), false);
});

test("claim fails closed before overwriting corrupt or exhausted durable state", async () => {
  const cases: readonly [string, Record<string, unknown>][] = [
    ["wrong schema", inactiveState({ schemaVersion: "namespring.maintenance-run-state.v0" })],
    ["wrong job", inactiveState({ job: "auth_lifecycle" })],
    ["mixed claim tuple", inactiveState({ claimToken: "a".repeat(43) })],
    ["invalid prior aggregate", inactiveState({
      lastFinishedAt: Timestamp.fromDate(new Date("2026-07-18T00:00:01.000Z")),
      lastOutcome: "completed",
      lastAggregate: { scanned: 1, deleted: 2, skipped: 0, failed: 0, deadlineReached: false },
    })],
    ["inactive finish precedes start", inactiveState({
      lastStartedAt: Timestamp.fromDate(new Date("2026-07-18T00:00:02.000Z")),
      lastFinishedAt: Timestamp.fromDate(new Date("2026-07-18T00:00:01.000Z")),
      lastOutcome: "completed",
      lastAggregate: { scanned: 1, deleted: 1, skipped: 0, failed: 0, deadlineReached: false },
    })],
    ["active previous finish follows new start", inactiveState({
      activeRunId: "mrun_0123456789abcdefghijklmA",
      claimToken: "b".repeat(43),
      claimUntil: Timestamp.fromDate(new Date("2026-07-18T00:02:00.000Z")),
      lastStartedAt: Timestamp.fromDate(new Date("2026-07-18T00:00:01.000Z")),
      lastFinishedAt: Timestamp.fromDate(new Date("2026-07-18T00:00:02.000Z")),
      lastOutcome: "completed",
      lastAggregate: { scanned: 1, deleted: 1, skipped: 0, failed: 0, deadlineReached: false },
    })],
  ];
  for (const [label, state] of cases) {
    const fake = fakeFirestore();
    fake.records.set("server_maintenance_run_states_v1/sync_retention", state);
    const coordinator = new FirestoreMaintenanceCoordinatorV1(fake.db, () => "a".repeat(43));
    await assertApiError(() => coordinator.claim({
      job: "sync_retention",
      runId: "mrun_0123456789abcdefghijklmn",
      now: new Date("2026-07-18T00:01:31.000Z"),
      leaseMs: 90_000,
    }), "MAINTENANCE_STATE_CORRUPT");
    assert.equal(fake.records.get("server_maintenance_run_states_v1/sync_retention"), state, label);
  }

  const exhausted = fakeFirestore();
  const state = inactiveState({ fence: Number.MAX_SAFE_INTEGER });
  exhausted.records.set("server_maintenance_run_states_v1/sync_retention", state);
  const coordinator = new FirestoreMaintenanceCoordinatorV1(exhausted.db, () => "a".repeat(43));
  await assertApiError(() => coordinator.claim({
    job: "sync_retention",
    runId: "mrun_0123456789abcdefghijklmn",
    now: new Date("2026-07-18T00:01:31.000Z"),
    leaseMs: 90_000,
  }), "MAINTENANCE_STATE_CORRUPT");
  assert.equal(exhausted.records.get("server_maintenance_run_states_v1/sync_retention"), state);
});

test("claim and finish reject invalid time and aggregate inputs without mutating state", async () => {
  const fake = fakeFirestore();
  const coordinator = new FirestoreMaintenanceCoordinatorV1(fake.db, () => "a".repeat(43));
  await assertApiError(() => coordinator.claim({
    job: "sync_retention",
    runId: "mrun_0123456789abcdefghijklmn",
    now: new Date(Number.NaN),
    leaseMs: 90_000,
  }), "MAINTENANCE_TIME_INVALID");
  assert.equal(fake.records.size, 0);

  const claim = await coordinator.claim({
    job: "sync_retention",
    runId: "mrun_0123456789abcdefghijklmn",
    now: new Date("2026-07-18T00:00:00.000Z"),
    leaseMs: 90_000,
  });
  assert.ok(claim.acquired);
  const before = fake.records.get("server_maintenance_run_states_v1/sync_retention");
  await assertApiError(() => coordinator.finish({
    claim,
    now: new Date("2026-07-18T00:00:01.000Z"),
    outcome: "completed",
    aggregate: { scanned: 1, deleted: 2, skipped: 0, failed: 0, deadlineReached: false },
  }), "MAINTENANCE_AGGREGATE_INVALID");
  assert.equal(fake.records.get("server_maintenance_run_states_v1/sync_retention"), before);
});

test("an expired coordinator lease cannot finalize without a takeover", async () => {
  const fake = fakeFirestore();
  const coordinator = new FirestoreMaintenanceCoordinatorV1(fake.db, () => "a".repeat(43));
  const claim = await coordinator.claim({
    job: "sync_retention",
    runId: "mrun_0123456789abcdefghijklmn",
    now: new Date("2026-07-18T00:00:00.000Z"),
    leaseMs: 90_000,
  });
  assert.ok(claim.acquired);
  assert.equal(await coordinator.finish({
    claim,
    now: new Date("2026-07-18T00:01:30.000Z"),
    outcome: "completed",
    aggregate: { scanned: 1, deleted: 1, skipped: 0, failed: 0, deadlineReached: false },
  }), false);
  const stored = fake.records.get("server_maintenance_run_states_v1/sync_retention") as {
    activeRunId?: unknown;
    claimToken?: unknown;
  };
  assert.equal(stored.activeRunId, claim.runId);
  assert.equal(stored.claimToken, claim.claimToken);
});

test("coordinator rejects clock regression at claim and finish", async () => {
  const previous = fakeFirestore();
  previous.records.set("server_maintenance_run_states_v1/sync_retention", inactiveState({
    lastStartedAt: Timestamp.fromDate(new Date("2026-07-18T00:01:00.000Z")),
    lastFinishedAt: Timestamp.fromDate(new Date("2026-07-18T00:02:00.000Z")),
    lastOutcome: "completed",
    lastAggregate: { scanned: 1, deleted: 1, skipped: 0, failed: 0, deadlineReached: false },
  }));
  const previousCoordinator = new FirestoreMaintenanceCoordinatorV1(previous.db, () => "a".repeat(43));
  await assertApiError(() => previousCoordinator.claim({
    job: "sync_retention",
    runId: "mrun_0123456789abcdefghijklmn",
    now: new Date("2026-07-18T00:01:59.999Z"),
    leaseMs: 90_000,
  }), "MAINTENANCE_TIME_INVALID");

  const current = fakeFirestore();
  const currentCoordinator = new FirestoreMaintenanceCoordinatorV1(current.db, () => "a".repeat(43));
  const claim = await currentCoordinator.claim({
    job: "sync_retention",
    runId: "mrun_0123456789abcdefghijklmn",
    now: new Date("2026-07-18T00:01:00.000Z"),
    leaseMs: 90_000,
  });
  assert.ok(claim.acquired);
  await assertApiError(() => currentCoordinator.finish({
    claim,
    now: new Date("2026-07-18T00:00:59.999Z"),
    outcome: "completed",
    aggregate: { scanned: 0, deleted: 0, skipped: 0, failed: 0, deadlineReached: false },
  }), "MAINTENANCE_TIME_INVALID");
});

test("maintenance status read is aggregate-only and never mutates the coordinator state", async () => {
  const fake = fakeFirestore();
  const coordinator = new FirestoreMaintenanceCoordinatorV1(fake.db, () => "a".repeat(43));
  const reader = new FirestoreMaintenanceStatusReaderV1(fake.db);
  assert.equal("claim" in reader, false);
  assert.equal("finish" in reader, false);
  assert.deepEqual(await reader.readStatus({
    job: "sync_retention",
    now: new Date("2026-07-18T00:00:00.000Z"),
  }), {
    state: "never_started",
    heartbeatAt: null,
    leaseExpiresAt: null,
    lastCompletedAt: null,
    lastOutcome: null,
    lastAggregate: null,
  });

  const claim = await coordinator.claim({
    job: "sync_retention",
    runId: "mrun_0123456789abcdefghijklmn",
    now: new Date("2026-07-18T00:01:00.000Z"),
    leaseMs: 90_000,
  });
  assert.ok(claim.acquired);
  const beforeRead = fake.records.get("server_maintenance_run_states_v1/sync_retention");
  const running = await reader.readStatus({
    job: "sync_retention",
    now: new Date("2026-07-18T00:01:30.000Z"),
  });
  assert.equal(running.state, "running");
  assert.equal(running.heartbeatAt?.toISOString(), "2026-07-18T00:01:00.000Z");
  assert.equal(running.leaseExpiresAt?.toISOString(), "2026-07-18T00:02:30.000Z");
  assert.equal(fake.records.get("server_maintenance_run_states_v1/sync_retention"), beforeRead);
  assert.equal(JSON.stringify(running).includes(claim.claimToken), false);
  assert.equal(JSON.stringify(running).includes(claim.runId), false);

  const expired = await reader.readStatus({
    job: "sync_retention",
    now: new Date("2026-07-18T00:02:30.000Z"),
  });
  assert.equal(expired.state, "lease_expired");

  const takeover = await coordinator.claim({
    job: "sync_retention",
    runId: "mrun_0123456789abcdefghijklmZ",
    now: new Date("2026-07-18T00:02:31.000Z"),
    leaseMs: 90_000,
  });
  assert.ok(takeover.acquired);
  assert.equal(await coordinator.finish({
    claim: takeover,
    now: new Date("2026-07-18T00:02:32.000Z"),
    outcome: "completed",
    aggregate: { scanned: 8, deleted: 7, skipped: 1, failed: 0, deadlineReached: false },
  }), true);
  const idle = await reader.readStatus({
    job: "sync_retention",
    now: new Date("2026-07-18T00:02:33.000Z"),
  });
  assert.equal(idle.state, "idle");
  assert.equal(idle.heartbeatAt?.toISOString(), "2026-07-18T00:02:32.000Z");
  assert.equal(idle.lastCompletedAt?.toISOString(), "2026-07-18T00:02:32.000Z");
  assert.equal(idle.lastOutcome, "completed");
  assert.deepEqual(idle.lastAggregate, {
    scanned: 8,
    deleted: 7,
    skipped: 1,
    failed: 0,
    deadlineReached: false,
  });
});
