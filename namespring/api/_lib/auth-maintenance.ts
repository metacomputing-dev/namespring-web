import { randomBytes } from "node:crypto";
import type { Auth } from "firebase-admin/auth";
import {
  createAccountDeletionCleanupDependenciesV1,
  finalizeAccountDeletionJobV1,
  type AccountDeletionCleanupDependenciesV1,
} from "./auth-account-deletion.js";
import {
  type AccountDeletionJob,
  type AuthAccountRecord,
  type AuthAccountRepository,
  type ProviderUnlinkJobV1,
  getAuthAccountRepository,
} from "./auth-accounts-repository.js";
import {
  reconcileProviderUnlinkV1,
  type FirebaseProviderUnlinkApiV1,
} from "./auth-lifecycle.js";
import { getFirebaseAuth } from "./firebase-auth-admin.js";
import { ApiHttpError } from "./http.js";
import {
  FirestoreMaintenanceCoordinatorV1,
  type MaintenanceAggregateV1,
  type MaintenanceCoordinatorV1,
} from "./maintenance-coordinator.js";
import type { MaintenanceRunResponseV1 } from "./maintenance-http.js";

export const AUTH_DELETION_MAINTENANCE_LIMIT_V1 = 2;
export const AUTH_PROVIDER_UNLINK_MAINTENANCE_LIMIT_V1 = 5;
const AUTH_MAINTENANCE_DEADLINE_MS_V1 = 45_000;
const AUTH_MAINTENANCE_CLAIM_MS_V1 = 90_000;

type AuthLifecycleFirebaseApiV1 = FirebaseProviderUnlinkApiV1
  & Pick<Auth, "revokeRefreshTokens" | "deleteUser">;

export type AccountDeletionProcessingResultV1 =
  | {
      readonly status: "deleted";
      readonly account: AuthAccountRecord;
      readonly job: AccountDeletionJob;
      readonly locked: false;
    }
  | {
      readonly status: "deletion_pending";
      readonly account: null;
      readonly job: AccountDeletionJob;
      readonly locked: boolean;
    };

export type ProviderUnlinkProcessingResultV1 =
  | {
      readonly status: "completed";
      readonly account: AuthAccountRecord;
      readonly job: ProviderUnlinkJobV1;
      readonly locked: false;
    }
  | {
      readonly status: "pending";
      readonly account: null;
      readonly job: ProviderUnlinkJobV1;
      readonly locked: boolean;
    };

export interface AuthJobClaimDependenciesV1 {
  readonly repository: AuthAccountRepository;
  readonly auth: AuthLifecycleFirebaseApiV1;
  readonly now: () => Date;
  readonly newClaimToken: () => string;
}

export interface AuthJobProcessingDependenciesV1 extends AuthJobClaimDependenciesV1 {
  readonly deletionDependencies: AccountDeletionCleanupDependenciesV1;
}

export interface AuthMaintenanceDependenciesV1 extends AuthJobProcessingDependenciesV1 {
  readonly coordinator: MaintenanceCoordinatorV1;
  readonly newRunId: () => string;
}

function defaultClaimDependencies(): AuthJobClaimDependenciesV1 {
  const auth = getFirebaseAuth();
  return {
    repository: getAuthAccountRepository(),
    auth,
    now: () => new Date(),
    newClaimToken: () => `ajc_${randomBytes(24).toString("base64url")}`,
  };
}

function defaultJobDependencies(): AuthJobProcessingDependenciesV1 {
  const dependencies = defaultClaimDependencies();
  return {
    ...dependencies,
    deletionDependencies: createAccountDeletionCleanupDependenciesV1(dependencies.auth),
  };
}

function defaultMaintenanceDependencies(): AuthMaintenanceDependenciesV1 {
  return {
    ...defaultJobDependencies(),
    coordinator: new FirestoreMaintenanceCoordinatorV1(),
    newRunId: () => `mrun_${randomBytes(18).toString("base64url")}`,
  };
}

function safeIsoDate(now: Date): string {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new ApiHttpError(500, "AUTH_MAINTENANCE_TIME_INVALID", "Auth maintenance time is invalid.");
  }
  return now.toISOString();
}

function durationMs(startedAt: Date, finishedAt: Date): number {
  return Math.max(0, Math.min(60_000, Math.round(finishedAt.getTime() - startedAt.getTime())));
}

async function requireDeletionJob(
  repository: AuthAccountRepository,
  deletionRequestId: string,
): Promise<AccountDeletionJob> {
  const job = await repository.getAccountDeletionJob(deletionRequestId);
  if (!job) {
    throw new ApiHttpError(404, "DELETION_JOB_NOT_FOUND", "Account deletion job was not found.");
  }
  return job;
}

async function requireUnlinkJob(
  repository: AuthAccountRepository,
  unlinkRequestId: string,
): Promise<ProviderUnlinkJobV1> {
  const job = await repository.getProviderUnlinkJob(unlinkRequestId);
  if (!job) {
    throw new ApiHttpError(404, "PROVIDER_UNLINK_JOB_NOT_FOUND", "Provider unlink job was not found.");
  }
  return job;
}

export async function processAccountDeletionJobV1(input: {
  readonly deletionRequestId: string;
  readonly recordedByUserId: string;
  readonly force: boolean;
  readonly dependencies?: AuthJobProcessingDependenciesV1;
}): Promise<AccountDeletionProcessingResultV1> {
  const dependencies = input.dependencies ?? defaultJobDependencies();
  const initial = await requireDeletionJob(dependencies.repository, input.deletionRequestId);
  if (initial.status === "completed") {
    const account = await dependencies.repository.completeAccountDeletion(
      initial.internalUserId,
      initial.deletionRequestId,
      input.recordedByUserId,
    );
    return { status: "deleted", account, job: initial, locked: false };
  }

  const claimResult = await dependencies.repository.claimAccountDeletionJob({
    deletionRequestId: initial.deletionRequestId,
    now: safeIsoDate(dependencies.now()),
    leaseMs: AUTH_MAINTENANCE_CLAIM_MS_V1,
    claimToken: dependencies.newClaimToken(),
    force: input.force,
  });
  if (!claimResult.acquired) {
    const latest = await requireDeletionJob(dependencies.repository, initial.deletionRequestId);
    if (latest.status === "completed") {
      const account = await dependencies.repository.completeAccountDeletion(
        latest.internalUserId,
        latest.deletionRequestId,
        input.recordedByUserId,
      );
      return { status: "deleted", account, job: latest, locked: false };
    }
    return { status: "deletion_pending", account: null, job: latest, locked: true };
  }

  try {
    const result = await finalizeAccountDeletionJobV1({
      repository: dependencies.repository,
      job: claimResult.job,
      recordedByUserId: input.recordedByUserId,
      dependencies: dependencies.deletionDependencies,
      claim: claimResult.claim,
    });
    const latest = await requireDeletionJob(dependencies.repository, initial.deletionRequestId);
    if (result.status === "deleted") {
      return { status: "deleted", account: result.account, job: latest, locked: false };
    }
    return { status: "deletion_pending", account: null, job: latest, locked: false };
  } catch (error) {
    await dependencies.repository.releaseAuthLifecycleJobClaim(claimResult.claim, true).catch(() => false);
    throw error;
  }
}

export async function processProviderUnlinkJobV1(input: {
  readonly unlinkRequestId: string;
  readonly recordedByUserId: string;
  readonly force: boolean;
  readonly dependencies?: AuthJobClaimDependenciesV1;
}): Promise<ProviderUnlinkProcessingResultV1> {
  const dependencies = input.dependencies ?? defaultClaimDependencies();
  const initial = await requireUnlinkJob(dependencies.repository, input.unlinkRequestId);
  if (initial.status === "completed") {
    const account = await dependencies.repository.completeProviderUnlink(
      initial.internalUserId,
      initial.unlinkRequestId,
      input.recordedByUserId,
    );
    return { status: "completed", account, job: initial, locked: false };
  }

  const claimResult = await dependencies.repository.claimProviderUnlinkJob({
    unlinkRequestId: initial.unlinkRequestId,
    now: safeIsoDate(dependencies.now()),
    leaseMs: AUTH_MAINTENANCE_CLAIM_MS_V1,
    claimToken: dependencies.newClaimToken(),
    force: input.force,
  });
  if (!claimResult.acquired) {
    const latest = await requireUnlinkJob(dependencies.repository, initial.unlinkRequestId);
    if (latest.status === "completed") {
      const account = await dependencies.repository.completeProviderUnlink(
        latest.internalUserId,
        latest.unlinkRequestId,
        input.recordedByUserId,
      );
      return { status: "completed", account, job: latest, locked: false };
    }
    return { status: "pending", account: null, job: latest, locked: true };
  }

  try {
    const result = await reconcileProviderUnlinkV1({
      repository: dependencies.repository,
      job: claimResult.job,
      recordedByUserId: input.recordedByUserId,
      auth: dependencies.auth,
      claim: claimResult.claim,
    });
    const latest = await requireUnlinkJob(dependencies.repository, initial.unlinkRequestId);
    if (result.status === "completed") {
      return { status: "completed", account: result.account, job: latest, locked: false };
    }
    return { status: "pending", account: null, job: latest, locked: false };
  } catch (error) {
    await dependencies.repository.releaseAuthLifecycleJobClaim(claimResult.claim, true).catch(() => false);
    throw error;
  }
}

type MutableAggregateV1 = {
  scanned: number;
  deleted: number;
  skipped: number;
  failed: number;
  deadlineReached: boolean;
};

async function processCandidates(input: {
  readonly ids: readonly string[];
  readonly deadlineAt: number;
  readonly now: () => Date;
  readonly aggregate: MutableAggregateV1;
  readonly process: (id: string) => Promise<{ readonly completed: boolean; readonly locked: boolean }>;
}): Promise<void> {
  for (const id of input.ids) {
    if (input.now().getTime() >= input.deadlineAt) {
      input.aggregate.deadlineReached = true;
      break;
    }
    input.aggregate.scanned += 1;
    try {
      const result = await input.process(id);
      if (result.completed) input.aggregate.deleted += 1;
      else if (result.locked) input.aggregate.skipped += 1;
      else input.aggregate.failed += 1;
    } catch {
      // A malformed or temporarily unavailable candidate must not prevent
      // unrelated accounts from making progress. Only aggregate state leaves
      // this privileged boundary; job and provider identifiers never do.
      input.aggregate.failed += 1;
    }
  }
}

export async function runAuthLifecycleMaintenanceV1(
  dependencies: AuthMaintenanceDependenciesV1 = defaultMaintenanceDependencies(),
): Promise<MaintenanceRunResponseV1> {
  const startedAt = dependencies.now();
  const startedAtIso = safeIsoDate(startedAt);
  const runId = dependencies.newRunId();
  const coordinatorClaim = await dependencies.coordinator.claim({
    job: "auth_lifecycle",
    runId,
    now: startedAt,
    leaseMs: AUTH_MAINTENANCE_CLAIM_MS_V1,
  });
  if (!coordinatorClaim.acquired) {
    return {
      schemaVersion: "namespring.maintenance-run.v1",
      runId,
      job: "auth_lifecycle",
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

  const summary: MutableAggregateV1 = {
    scanned: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
    deadlineReached: false,
  };
  const deadlineAt = startedAt.getTime() + AUTH_MAINTENANCE_DEADLINE_MS_V1;
  let unlinkIds: readonly string[] = [];
  try {
    const deletionIds = await dependencies.repository.listDueAccountDeletionJobIds(
      startedAtIso,
      AUTH_DELETION_MAINTENANCE_LIMIT_V1,
    );
    await processCandidates({
      ids: deletionIds,
      deadlineAt,
      now: dependencies.now,
      aggregate: summary,
      process: async (deletionRequestId) => {
        const result = await processAccountDeletionJobV1({
          deletionRequestId,
          recordedByUserId: "system_auth_lifecycle",
          force: false,
          dependencies,
        });
        return { completed: result.status === "deleted", locked: result.locked };
      },
    });

    if (!summary.deadlineReached) {
      unlinkIds = await dependencies.repository.listDueProviderUnlinkJobIds(
        startedAtIso,
        AUTH_PROVIDER_UNLINK_MAINTENANCE_LIMIT_V1,
      );
      await processCandidates({
        ids: unlinkIds,
        deadlineAt,
        now: dependencies.now,
        aggregate: summary,
        process: async (unlinkRequestId) => {
          const result = await processProviderUnlinkJobV1({
            unlinkRequestId,
            recordedByUserId: "system_auth_lifecycle",
            force: false,
            dependencies,
          });
          return { completed: result.status === "completed", locked: result.locked };
        },
      });
    }

    const aggregate: MaintenanceAggregateV1 = { ...summary };
    const outcome = summary.failed > 0 || summary.deadlineReached ? "partial" : "completed";
    const finishedAt = dependencies.now();
    const finalized = await dependencies.coordinator.finish({
      claim: coordinatorClaim,
      now: finishedAt,
      outcome,
      aggregate,
    });
    if (!finalized) {
      throw new ApiHttpError(503, "MAINTENANCE_CLAIM_LOST", "Maintenance run ownership expired before completion.");
    }
    return {
      schemaVersion: "namespring.maintenance-run.v1",
      runId,
      job: "auth_lifecycle",
      outcome,
      scanned: summary.scanned,
      deleted: summary.deleted,
      skipped: summary.skipped,
      failed: summary.failed,
      hasMore: deletionIds.length >= AUTH_DELETION_MAINTENANCE_LIMIT_V1
        || unlinkIds.length >= AUTH_PROVIDER_UNLINK_MAINTENANCE_LIMIT_V1
        || summary.skipped > 0 || summary.failed > 0 || summary.deadlineReached,
      deadlineReached: summary.deadlineReached,
      durationMs: durationMs(startedAt, finishedAt),
    };
  } catch (error) {
    await dependencies.coordinator.finish({
      claim: coordinatorClaim,
      now: dependencies.now(),
      outcome: "failed",
      aggregate: summary,
    }).catch(() => false);
    throw error;
  }
}
