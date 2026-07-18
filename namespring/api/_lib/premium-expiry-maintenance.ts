import { randomBytes } from "node:crypto";

import { ApiHttpError } from "./http.js";
import {
  FirestoreMaintenanceCoordinatorV1,
  type MaintenanceAggregateV1,
  type MaintenanceCoordinatorV1,
} from "./maintenance-coordinator.js";
import type { MaintenanceRunResponseV1 } from "./maintenance-http.js";
import {
  FirestorePremiumRepositoryV1,
  PREMIUM_UNPAID_EXPIRY_BATCH_LIMIT_V1,
  type PremiumUnpaidExpirySweepResultV1,
} from "./premium-repository.js";

const CLAIM_MS = 90_000;

export interface PremiumExpirySweeperV1 {
  sweepExpiredUnpaidData(input: {
    readonly now: string;
    readonly limit: number;
  }): Promise<PremiumUnpaidExpirySweepResultV1>;
}

export interface PremiumExpiryMaintenanceDependenciesV1 {
  readonly coordinator: MaintenanceCoordinatorV1;
  readonly sweeper: PremiumExpirySweeperV1;
  readonly now: () => Date;
  readonly newRunId: () => string;
}

function defaults(): PremiumExpiryMaintenanceDependenciesV1 {
  return {
    coordinator: new FirestoreMaintenanceCoordinatorV1(),
    sweeper: new FirestorePremiumRepositoryV1(),
    now: () => new Date(),
    newRunId: () => `mrun_${randomBytes(18).toString("base64url")}`,
  };
}

function durationMs(start: Date, finish: Date): number {
  return Math.max(0, Math.min(60_000, Math.round(finish.getTime() - start.getTime())));
}

function aggregate(result: PremiumUnpaidExpirySweepResultV1): MaintenanceAggregateV1 {
  const counts = [result.scanned, result.deleted, result.skipped, result.failed];
  if (counts.some((value) => !Number.isSafeInteger(value) || value < 0
      || value > PREMIUM_UNPAID_EXPIRY_BATCH_LIMIT_V1)
    || result.deleted + result.skipped + result.failed !== result.scanned
    || (result.hasMore !== true && result.hasMore !== false)
    || (result.failed > 0 && !result.hasMore)) {
    throw new ApiHttpError(500, "MAINTENANCE_RESULT_INVALID", "Premium expiry returned invalid aggregate counts.");
  }
  return {
    scanned: result.scanned,
    deleted: result.deleted,
    skipped: result.skipped,
    failed: result.failed,
    deadlineReached: false,
  };
}

export async function runPremiumExpiryMaintenanceV1(
  input: { readonly limit?: number } = {},
  dependencies: PremiumExpiryMaintenanceDependenciesV1 = defaults(),
): Promise<MaintenanceRunResponseV1> {
  const limit = input.limit ?? PREMIUM_UNPAID_EXPIRY_BATCH_LIMIT_V1;
  if (!Number.isInteger(limit) || limit < 1 || limit > PREMIUM_UNPAID_EXPIRY_BATCH_LIMIT_V1) {
    throw new ApiHttpError(400, "PREMIUM_EXPIRY_SWEEP_INVALID", "limit must be an integer from 1 to 20.");
  }
  const startedAt = dependencies.now();
  const runId = dependencies.newRunId();
  const claim = await dependencies.coordinator.claim({
    job: "premium_unpaid_expiry",
    runId,
    now: startedAt,
    leaseMs: CLAIM_MS,
  });
  if (!claim.acquired) {
    return {
      schemaVersion: "namespring.maintenance-run.v1",
      runId,
      job: "premium_unpaid_expiry",
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
    const result = await dependencies.sweeper.sweepExpiredUnpaidData({
      now: startedAt.toISOString(),
      limit,
    });
    const summary = aggregate(result);
    const outcome = summary.failed > 0 || result.hasMore ? "partial" : "completed";
    const finishedAt = dependencies.now();
    const finalized = await dependencies.coordinator.finish({
      claim,
      now: finishedAt,
      outcome,
      aggregate: summary,
    });
    if (!finalized) {
      throw new ApiHttpError(503, "MAINTENANCE_CLAIM_LOST", "Premium expiry ownership expired before completion.");
    }
    return {
      schemaVersion: "namespring.maintenance-run.v1",
      runId,
      job: "premium_unpaid_expiry",
      outcome,
      scanned: summary.scanned,
      deleted: summary.deleted,
      skipped: summary.skipped,
      failed: summary.failed,
      hasMore: result.hasMore,
      deadlineReached: false,
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
