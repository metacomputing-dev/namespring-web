import { randomBytes } from "node:crypto";
import type { PremiumActorV1 } from "../../shared/types/premium-service.js";
import { ApiHttpError } from "./http.js";
import {
  FirestoreMaintenanceCoordinatorV1,
  type MaintenanceAggregateV1,
  type MaintenanceCoordinatorV1,
} from "./maintenance-coordinator.js";
import type { MaintenanceRunResponseV1 } from "./maintenance-http.js";
import {
  PremiumServiceV1,
  type PremiumLeaseReconciliationSweepResultV1,
} from "./premium-service.js";

export const PREMIUM_RECONCILIATION_BATCH_LIMIT = 3;
const PREMIUM_RECONCILIATION_DEADLINE_MS = 45_000;
const PREMIUM_RECONCILIATION_CLAIM_MS = 90_000;

export interface PremiumMaintenanceServiceV1 {
  reconcileDuePaymentLeases(
    actor: PremiumActorV1,
    limit: number,
    options: { readonly deadlineAtEpochMs: number },
  ): Promise<PremiumLeaseReconciliationSweepResultV1>;
}

export interface PremiumMaintenanceDependenciesV1 {
  readonly coordinator: MaintenanceCoordinatorV1;
  readonly service: PremiumMaintenanceServiceV1;
  readonly now: () => Date;
  readonly newRunId: () => string;
}

export interface PremiumMaintenanceRunInputV1 {
  readonly actor?: PremiumActorV1;
  readonly limit?: number;
}

function defaultDependencies(): PremiumMaintenanceDependenciesV1 {
  return {
    coordinator: new FirestoreMaintenanceCoordinatorV1(),
    service: new PremiumServiceV1(),
    now: () => new Date(),
    newRunId: () => `mrun_${randomBytes(18).toString("base64url")}`,
  };
}

function durationMs(startedAt: Date, finishedAt: Date): number {
  return Math.max(0, Math.min(60_000, Math.round(finishedAt.getTime() - startedAt.getTime())));
}

function assertMaintenanceActor(actor: PremiumActorV1): void {
  if (!actor.roles.includes("premium_admin") && !actor.roles.includes("premium_system")) {
    throw new ApiHttpError(403, "PREMIUM_ADMIN_REQUIRED", "Premium administrator role is required.");
  }
}

function aggregate(result: PremiumLeaseReconciliationSweepResultV1): MaintenanceAggregateV1 {
  const counts = [result.scanned, result.settled, result.retryRequired];
  if (counts.some((value) => !Number.isSafeInteger(value) || value < 0
      || value > PREMIUM_RECONCILIATION_BATCH_LIMIT)
    || result.settled + result.retryRequired !== result.scanned
    || (result.deadlineReached !== true && result.deadlineReached !== false)
    || (result.hasMore !== true && result.hasMore !== false)
    || ((result.retryRequired > 0 || result.deadlineReached) && !result.hasMore)) {
    throw new ApiHttpError(500, "MAINTENANCE_RESULT_INVALID", "Premium maintenance returned invalid aggregate counts.");
  }
  return {
    scanned: result.scanned,
    // The shared maintenance envelope calls completed work `deleted`; for
    // this job it means a terminal payment was verified and its lease removed.
    deleted: result.settled,
    skipped: 0,
    failed: result.retryRequired,
    deadlineReached: result.deadlineReached,
  };
}

export async function runPremiumPaymentMaintenanceV1(
  input: PremiumMaintenanceRunInputV1 = {},
  dependencies: PremiumMaintenanceDependenciesV1 = defaultDependencies(),
): Promise<MaintenanceRunResponseV1> {
  const limit = input.limit ?? PREMIUM_RECONCILIATION_BATCH_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > PREMIUM_RECONCILIATION_BATCH_LIMIT) {
    throw new ApiHttpError(400, "PREMIUM_RECONCILIATION_BATCH_INVALID", "limit must be an integer from 1 to 3.");
  }
  if (input.actor) assertMaintenanceActor(input.actor);

  const startedAt = dependencies.now();
  const runId = dependencies.newRunId();
  const actor = input.actor ?? {
    userId: "system_premium_payment_reconciliation",
    sessionId: runId,
    roles: ["premium_system"],
  };
  assertMaintenanceActor(actor);
  const claim = await dependencies.coordinator.claim({
    job: "premium_payment_reconciliation",
    runId,
    now: startedAt,
    leaseMs: PREMIUM_RECONCILIATION_CLAIM_MS,
  });
  if (!claim.acquired) {
    return {
      schemaVersion: "namespring.maintenance-run.v1",
      runId,
      job: "premium_payment_reconciliation",
      outcome: "skipped_locked",
      scanned: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
      hasMore: true,
      deadlineReached: false,
      durationMs: durationMs(startedAt, dependencies.now()),
    };
  }

  try {
    const result = await dependencies.service.reconcileDuePaymentLeases(actor, limit, {
      deadlineAtEpochMs: startedAt.getTime() + PREMIUM_RECONCILIATION_DEADLINE_MS,
    });
    const summary = aggregate(result);
    const outcome = summary.failed > 0 || summary.deadlineReached ? "partial" : "completed";
    const finishedAt = dependencies.now();
    const finalized = await dependencies.coordinator.finish({
      claim,
      now: finishedAt,
      outcome,
      aggregate: summary,
    });
    if (!finalized) {
      throw new ApiHttpError(503, "MAINTENANCE_CLAIM_LOST", "Maintenance run ownership expired before completion.");
    }
    return {
      schemaVersion: "namespring.maintenance-run.v1",
      runId,
      job: "premium_payment_reconciliation",
      outcome,
      scanned: summary.scanned,
      deleted: summary.deleted,
      skipped: summary.skipped,
      failed: summary.failed,
      hasMore: result.hasMore,
      deadlineReached: summary.deadlineReached,
      durationMs: durationMs(startedAt, finishedAt),
    };
  } catch (error) {
    await dependencies.coordinator.finish({
      claim,
      now: dependencies.now(),
      outcome: "failed",
      aggregate: { scanned: 0, deleted: 0, skipped: 0, failed: 0, deadlineReached: false },
    }).catch(() => false);
    throw error;
  }
}
