import { randomBytes } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { ApiHttpError } from "./http.js";
import { getFirestoreDb } from "./firestore-admin.js";

const MAINTENANCE_RUN_STATES = "server_maintenance_run_states_v1";
const MAINTENANCE_STATE_SCHEMA_V1 = "namespring.maintenance-run-state.v1" as const;
const MAX_MAINTENANCE_AGGREGATE_COUNT = 10_000;
const MAINTENANCE_JOBS_V1 = [
  "sync_retention",
  "auth_lifecycle",
  "premium_payment_reconciliation",
  "premium_unpaid_expiry",
] as const;
const MAINTENANCE_OUTCOMES_V1 = ["completed", "partial", "failed"] as const;
const MAINTENANCE_RUN_ID_PATTERN = /^mrun_[A-Za-z0-9_-]{20,48}$/u;
const MAINTENANCE_CLAIM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export type MaintenanceJobV1 = (typeof MAINTENANCE_JOBS_V1)[number];
export type MaintenanceRunOutcomeV1 = (typeof MAINTENANCE_OUTCOMES_V1)[number];

export interface MaintenanceAggregateV1 {
  readonly scanned: number;
  readonly deleted: number;
  readonly skipped: number;
  readonly failed: number;
  readonly deadlineReached: boolean;
}

export type MaintenanceClaimResultV1 =
  | { readonly acquired: false }
  | {
      readonly acquired: true;
      readonly job: MaintenanceJobV1;
      readonly runId: string;
      readonly claimToken: string;
      readonly fence: number;
    };

export interface MaintenanceCoordinatorV1 {
  claim(input: {
    readonly job: MaintenanceJobV1;
    readonly runId: string;
    readonly now: Date;
    readonly leaseMs: number;
  }): Promise<MaintenanceClaimResultV1>;
  finish(input: {
    readonly claim: Extract<MaintenanceClaimResultV1, { readonly acquired: true }>;
    readonly now: Date;
    readonly outcome: MaintenanceRunOutcomeV1;
    readonly aggregate: MaintenanceAggregateV1;
  }): Promise<boolean>;
}

export interface MaintenanceStatusSnapshotV1 {
  readonly state: "never_started" | "idle" | "running" | "lease_expired";
  /** Latest durable start/finish transition; this is not a worker process probe. */
  readonly heartbeatAt: Date | null;
  readonly leaseExpiresAt: Date | null;
  readonly lastCompletedAt: Date | null;
  readonly lastOutcome: MaintenanceRunOutcomeV1 | null;
  readonly lastAggregate: MaintenanceAggregateV1 | null;
}

/** Narrow read capability so operational discovery cannot claim or finish work. */
export interface MaintenanceStatusReaderV1 {
  readStatus(input: {
    readonly job: MaintenanceJobV1;
    readonly now: Date;
  }): Promise<MaintenanceStatusSnapshotV1>;
}

interface StoredMaintenanceRunStateV1 {
  readonly schemaVersion: typeof MAINTENANCE_STATE_SCHEMA_V1;
  readonly job: MaintenanceJobV1;
  readonly fence: number;
  readonly activeRunId: string | null;
  readonly claimToken: string | null;
  readonly claimUntil: Timestamp | null;
  readonly lastStartedAt: Timestamp;
  readonly lastFinishedAt: Timestamp | null;
  readonly lastOutcome: MaintenanceRunOutcomeV1 | null;
  readonly lastAggregate: MaintenanceAggregateV1 | null;
}

function assertRunId(runId: string): void {
  if (!MAINTENANCE_RUN_ID_PATTERN.test(runId)) {
    throw new ApiHttpError(500, "MAINTENANCE_RUN_ID_INVALID", "Maintenance run identity is invalid.");
  }
}

function corruptState(message = "Maintenance run state is invalid."): never {
  throw new ApiHttpError(500, "MAINTENANCE_STATE_CORRUPT", message);
}

function assertJob(job: unknown): asserts job is MaintenanceJobV1 {
  if (typeof job !== "string" || !(MAINTENANCE_JOBS_V1 as readonly string[]).includes(job)) {
    throw new ApiHttpError(500, "MAINTENANCE_JOB_INVALID", "Maintenance job identity is invalid.");
  }
}

function assertValidDate(value: Date, field: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ApiHttpError(500, "MAINTENANCE_TIME_INVALID", `${field} is invalid.`);
  }
}

function maintenanceTimestamp(value: Date, field: string): Timestamp {
  assertValidDate(value, field);
  try {
    return Timestamp.fromDate(value);
  } catch {
    throw new ApiHttpError(500, "MAINTENANCE_TIME_INVALID", `${field} is outside the supported range.`);
  }
}

function assertClaimToken(value: unknown): asserts value is string {
  if (typeof value !== "string" || !MAINTENANCE_CLAIM_TOKEN_PATTERN.test(value)) {
    throw new ApiHttpError(500, "MAINTENANCE_CLAIM_TOKEN_INVALID", "Maintenance claim token is invalid.");
  }
}

function assertFence(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    corruptState("Maintenance fencing metadata is invalid.");
  }
}

function assertLeaseMs(leaseMs: number): void {
  if (!Number.isInteger(leaseMs) || leaseMs < 30_000 || leaseMs > 5 * 60_000) {
    throw new ApiHttpError(500, "MAINTENANCE_LEASE_INVALID", "Maintenance lease duration is invalid.");
  }
}

function aggregateIsValid(value: unknown): value is MaintenanceAggregateV1 {
  if (!value || typeof value !== "object" || !hasExactKeys(value, [
    "scanned", "deleted", "skipped", "failed", "deadlineReached",
  ])) return false;
  const aggregate = value as Partial<MaintenanceAggregateV1>;
  const counts = [aggregate.scanned, aggregate.deleted, aggregate.skipped, aggregate.failed];
  return !(counts.some((candidate) => !Number.isSafeInteger(candidate)
    || (candidate as number) < 0 || (candidate as number) > MAX_MAINTENANCE_AGGREGATE_COUNT)
    || aggregate.deadlineReached !== true && aggregate.deadlineReached !== false
    || (aggregate.deleted as number) + (aggregate.skipped as number) + (aggregate.failed as number)
      > (aggregate.scanned as number));
}

function hasExactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function assertStoredState(
  value: unknown,
  expectedJob: MaintenanceJobV1,
): asserts value is StoredMaintenanceRunStateV1 {
  if (!value || typeof value !== "object" || !hasExactKeys(value, [
    "schemaVersion",
    "job",
    "fence",
    "activeRunId",
    "claimToken",
    "claimUntil",
    "lastStartedAt",
    "lastFinishedAt",
    "lastOutcome",
    "lastAggregate",
  ])) {
    corruptState();
  }
  const state = value as Partial<StoredMaintenanceRunStateV1>;
  if (state.schemaVersion !== MAINTENANCE_STATE_SCHEMA_V1 || state.job !== expectedJob) {
    corruptState("Maintenance state schema or job identity is invalid.");
  }
  assertFence(state.fence);
  if (!(state.lastStartedAt instanceof Timestamp)) corruptState("Maintenance start metadata is invalid.");

  const inactive = state.activeRunId === null && state.claimToken === null && state.claimUntil === null;
  const activeOrExpired = typeof state.activeRunId === "string"
    && typeof state.claimToken === "string" && state.claimUntil instanceof Timestamp;
  if (!inactive && !activeOrExpired) corruptState("Maintenance claim metadata is inconsistent.");
  if (activeOrExpired && (!MAINTENANCE_RUN_ID_PATTERN.test(state.activeRunId as string)
    || !MAINTENANCE_CLAIM_TOKEN_PATTERN.test(state.claimToken as string))) {
    corruptState("Maintenance claim identity is invalid.");
  }
  const startedAtMs = state.lastStartedAt.toMillis();
  if (activeOrExpired && (state.claimUntil as Timestamp).toMillis() <= startedAtMs) {
    corruptState("Maintenance claim chronology is invalid.");
  }

  const neverFinished = state.lastFinishedAt === null
    && state.lastOutcome === null && state.lastAggregate === null;
  const previouslyFinished = state.lastFinishedAt instanceof Timestamp
    && (MAINTENANCE_OUTCOMES_V1 as readonly unknown[]).includes(state.lastOutcome)
    && state.lastAggregate !== null && state.lastAggregate !== undefined;
  if (!neverFinished && !previouslyFinished) {
    corruptState("Maintenance completion metadata is inconsistent.");
  }
  if (previouslyFinished && !aggregateIsValid(state.lastAggregate)) {
    corruptState("Maintenance aggregate metadata is invalid.");
  }
  if (previouslyFinished) {
    const finishedAtMs = (state.lastFinishedAt as Timestamp).toMillis();
    // An active state carries the preceding run's completion beside the new
    // run's start. An inactive state carries one run's own start/completion.
    if ((activeOrExpired && finishedAtMs > startedAtMs)
      || (inactive && finishedAtMs < startedAtMs)) {
      corruptState("Maintenance run chronology is invalid.");
    }
  }
}

function stateClaimIsActive(state: StoredMaintenanceRunStateV1, now: Date): boolean {
  return state.claimUntil !== null && state.claimUntil.toMillis() > now.getTime();
}

async function readMaintenanceStatusV1(
  db: Firestore,
  input: { readonly job: MaintenanceJobV1; readonly now: Date },
): Promise<MaintenanceStatusSnapshotV1> {
  assertJob(input.job);
  assertValidDate(input.now, "Maintenance status observation time");
  const stateRef = db.collection(MAINTENANCE_RUN_STATES).doc(input.job);
  const snapshot = await stateRef.get();
  if (!snapshot.exists) {
    return {
      state: "never_started",
      heartbeatAt: null,
      leaseExpiresAt: null,
      lastCompletedAt: null,
      lastOutcome: null,
      lastAggregate: null,
    };
  }
  const state = snapshot.data();
  assertStoredState(state, input.job);
  const activeOrExpired = state.claimUntil !== null;
  const heartbeatTimestamp = state.lastFinishedAt !== null
    && state.lastFinishedAt.toMillis() > state.lastStartedAt.toMillis()
    ? state.lastFinishedAt
    : state.lastStartedAt;
  return {
    state: !activeOrExpired
      ? "idle"
      : stateClaimIsActive(state, input.now) ? "running" : "lease_expired",
    heartbeatAt: heartbeatTimestamp.toDate(),
    leaseExpiresAt: state.claimUntil?.toDate() ?? null,
    lastCompletedAt: state.lastFinishedAt?.toDate() ?? null,
    lastOutcome: state.lastOutcome,
    lastAggregate: state.lastAggregate === null ? null : { ...state.lastAggregate },
  };
}

/** Firestore adapter with no claim/finish methods in its runtime capability. */
export class FirestoreMaintenanceStatusReaderV1 implements MaintenanceStatusReaderV1 {
  public constructor(private readonly db: Firestore = getFirestoreDb()) {}

  public readStatus(input: {
    readonly job: MaintenanceJobV1;
    readonly now: Date;
  }): Promise<MaintenanceStatusSnapshotV1> {
    return readMaintenanceStatusV1(this.db, input);
  }
}

export class FirestoreMaintenanceCoordinatorV1 implements MaintenanceCoordinatorV1 {
  public constructor(
    private readonly db: Firestore = getFirestoreDb(),
    private readonly newToken: () => string = () => randomBytes(32).toString("base64url"),
  ) {}

  public async claim(input: {
    readonly job: MaintenanceJobV1;
    readonly runId: string;
    readonly now: Date;
    readonly leaseMs: number;
  }): Promise<MaintenanceClaimResultV1> {
    assertJob(input.job);
    assertRunId(input.runId);
    assertValidDate(input.now, "Maintenance claim time");
    assertLeaseMs(input.leaseMs);
    const claimUntil = maintenanceTimestamp(
      new Date(input.now.getTime() + input.leaseMs),
      "Maintenance claim expiry",
    );
    const stateRef = this.db.collection(MAINTENANCE_RUN_STATES).doc(input.job);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(stateRef);
      const previous = snapshot.exists ? snapshot.data() : null;
      if (previous !== null) assertStoredState(previous, input.job);
      if (previous !== null && stateClaimIsActive(previous, input.now)) return { acquired: false } as const;
      if (previous?.lastFinishedAt && previous.lastFinishedAt.toMillis() > input.now.getTime()) {
        throw new ApiHttpError(
          500,
          "MAINTENANCE_TIME_INVALID",
          "Maintenance claim time precedes the previous completion.",
        );
      }
      const previousFence = previous?.fence ?? 0;
      if (previousFence >= Number.MAX_SAFE_INTEGER) {
        corruptState("Maintenance fencing counter is exhausted.");
      }
      const fence = previousFence + 1;
      const claimToken = this.newToken();
      assertClaimToken(claimToken);
      const state: StoredMaintenanceRunStateV1 = {
        schemaVersion: MAINTENANCE_STATE_SCHEMA_V1,
        job: input.job,
        fence,
        activeRunId: input.runId,
        claimToken,
        claimUntil,
        lastStartedAt: maintenanceTimestamp(input.now, "Maintenance start time"),
        lastFinishedAt: previous?.lastFinishedAt ?? null,
        lastOutcome: previous?.lastOutcome ?? null,
        lastAggregate: previous?.lastAggregate ?? null,
      };
      transaction.set(stateRef, state, { merge: false });
      return { acquired: true, job: input.job, runId: input.runId, claimToken, fence } as const;
    });
  }

  public async finish(input: {
    readonly claim: Extract<MaintenanceClaimResultV1, { readonly acquired: true }>;
    readonly now: Date;
    readonly outcome: MaintenanceRunOutcomeV1;
    readonly aggregate: MaintenanceAggregateV1;
  }): Promise<boolean> {
    assertJob(input.claim.job);
    assertRunId(input.claim.runId);
    assertClaimToken(input.claim.claimToken);
    assertFence(input.claim.fence);
    if (!(MAINTENANCE_OUTCOMES_V1 as readonly unknown[]).includes(input.outcome)) {
      throw new ApiHttpError(500, "MAINTENANCE_OUTCOME_INVALID", "Maintenance run outcome is invalid.");
    }
    if (!aggregateIsValid(input.aggregate)) {
      throw new ApiHttpError(500, "MAINTENANCE_AGGREGATE_INVALID", "Maintenance run aggregate is invalid.");
    }
    const finishedAt = maintenanceTimestamp(input.now, "Maintenance finish time");
    const stateRef = this.db.collection(MAINTENANCE_RUN_STATES).doc(input.claim.job);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(stateRef);
      const state = snapshot.exists ? snapshot.data() : null;
      if (!state) return false;
      assertStoredState(state, input.claim.job);
      if (state.claimToken !== input.claim.claimToken
        || state.activeRunId !== input.claim.runId || state.fence !== input.claim.fence) {
        return false;
      }
      if (input.now.getTime() < state.lastStartedAt.toMillis()) {
        throw new ApiHttpError(500, "MAINTENANCE_TIME_INVALID", "Maintenance finish time precedes its start.");
      }
      if (state.claimUntil === null || state.claimUntil.toMillis() <= input.now.getTime()) {
        return false;
      }
      const completed: StoredMaintenanceRunStateV1 = {
        schemaVersion: state.schemaVersion,
        job: state.job,
        fence: input.claim.fence,
        activeRunId: null,
        claimToken: null,
        claimUntil: null,
        lastStartedAt: state.lastStartedAt,
        lastFinishedAt: finishedAt,
        lastOutcome: input.outcome,
        lastAggregate: input.aggregate,
      };
      transaction.set(stateRef, completed, { merge: false });
      return true;
    });
  }
}
