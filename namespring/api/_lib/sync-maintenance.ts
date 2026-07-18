import { randomBytes } from "node:crypto";
import type { SyncRetentionSweepResultV1 } from "../../shared/types/sync-contract.js";
import { ApiHttpError } from "./http.js";
import {
  FirestoreMaintenanceCoordinatorV1,
  type MaintenanceAggregateV1,
  type MaintenanceCoordinatorV1,
} from "./maintenance-coordinator.js";
import type { MaintenanceRunResponseV1 } from "./maintenance-http.js";
import { getAccountSyncService } from "./sync-runtime.js";

const SYNC_RETENTION_BATCH_LIMIT = 40;
const SYNC_RETENTION_DEADLINE_MS = 45_000;
const SYNC_RETENTION_CLAIM_MS = 90_000;

export interface SyncMaintenanceServiceV1 {
  sweepExpired(
    actor: { readonly userId: string; readonly sessionId: string },
    limit: number,
    options: { readonly deadlineAtEpochMs: number },
  ): Promise<SyncRetentionSweepResultV1>;
}

export interface SyncMaintenanceDependenciesV1 {
  readonly coordinator: MaintenanceCoordinatorV1;
  readonly service: SyncMaintenanceServiceV1;
  readonly now: () => Date;
  readonly newRunId: () => string;
}

function defaultDependencies(): SyncMaintenanceDependenciesV1 {
  return {
    coordinator: new FirestoreMaintenanceCoordinatorV1(),
    service: getAccountSyncService(),
    now: () => new Date(),
    newRunId: () => `mrun_${randomBytes(18).toString("base64url")}`,
  };
}

function durationMs(startedAt: Date, finishedAt: Date): number {
  return Math.max(0, Math.min(60_000, Math.round(finishedAt.getTime() - startedAt.getTime())));
}

function aggregate(result: SyncRetentionSweepResultV1): MaintenanceAggregateV1 {
  const counts = [
    result.dataDocumentsScanned,
    result.dataDocumentsDeleted,
    result.dataDocumentsSkipped,
    result.dataDocumentsFailed,
  ];
  if (counts.some((value) => !Number.isSafeInteger(value) || value < 0 || value > SYNC_RETENTION_BATCH_LIMIT)
    || result.dataDocumentsDeleted + result.dataDocumentsSkipped + result.dataDocumentsFailed
      > result.dataDocumentsScanned) {
    throw new ApiHttpError(500, "MAINTENANCE_RESULT_INVALID", "Sync maintenance returned invalid aggregate counts.");
  }
  return {
    scanned: result.dataDocumentsScanned,
    deleted: result.dataDocumentsDeleted,
    skipped: result.dataDocumentsSkipped,
    failed: result.dataDocumentsFailed,
    deadlineReached: result.deadlineReached,
  };
}

export async function runSyncRetentionMaintenanceV1(
  dependencies: SyncMaintenanceDependenciesV1 = defaultDependencies(),
): Promise<MaintenanceRunResponseV1> {
  const startedAt = dependencies.now();
  const runId = dependencies.newRunId();
  const claim = await dependencies.coordinator.claim({
    job: "sync_retention",
    runId,
    now: startedAt,
    leaseMs: SYNC_RETENTION_CLAIM_MS,
  });
  if (!claim.acquired) {
    return {
      schemaVersion: "namespring.maintenance-run.v1",
      runId,
      job: "sync_retention",
      outcome: "skipped_locked",
      scanned: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
      // A locked run did not inspect the queue and therefore cannot prove
      // exhaustion. `true` means "retry/catch up later", not "work confirmed".
      hasMore: true,
      deadlineReached: false,
      durationMs: durationMs(startedAt, dependencies.now()),
    };
  }

  try {
    const result = await dependencies.service.sweepExpired(
      { userId: "system_sync_retention", sessionId: runId },
      SYNC_RETENTION_BATCH_LIMIT,
      { deadlineAtEpochMs: startedAt.getTime() + SYNC_RETENTION_DEADLINE_MS },
    );
    const summary = aggregate(result);
    const outcome = result.dataDocumentsFailed > 0 || result.deadlineReached ? "partial" : "completed";
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
      job: "sync_retention",
      outcome,
      scanned: summary.scanned,
      deleted: summary.deleted,
      skipped: summary.skipped,
      failed: summary.failed,
      hasMore: summary.scanned >= SYNC_RETENTION_BATCH_LIMIT
        || summary.failed > 0 || summary.deadlineReached,
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
