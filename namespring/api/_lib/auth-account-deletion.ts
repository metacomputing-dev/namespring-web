import type { Auth } from "firebase-admin/auth";
import type {
  AccountDeletionJob,
  AuthAccountRecord,
  AuthAccountRepository,
  AuthLifecycleJobClaimV1,
} from "./auth-accounts-repository.js";
import {
  cleanupFirebaseUsers,
  type FirebaseCleanupResult,
} from "./auth-lifecycle.js";
import { purgePremiumAccountPersonalDataV1 } from "./premium-account-lifecycle.js";
import { getAccountSyncService } from "./sync-runtime.js";

export interface AccountDeletionCleanupDependenciesV1 {
  readonly cleanupFirebase: (firebaseUids: readonly string[]) => Promise<FirebaseCleanupResult>;
  readonly deleteSyncData: (internalUserId: string, deletionRequestId: string) => Promise<unknown>;
  readonly purgePremiumData: (internalUserId: string, deletionRequestId: string) => Promise<unknown>;
}

export interface AccountDeletionCleanupResultV1 {
  readonly completed: boolean;
  readonly errorCodes: readonly string[];
  readonly domains: {
    readonly firebase: "completed" | "failed";
    readonly sync: "completed" | "failed";
    readonly premium: "completed" | "failed";
  };
}

export type AccountDeletionFinalizationResultV1 =
  | {
      readonly status: "deletion_pending";
      readonly cleanup: AccountDeletionCleanupResultV1;
      readonly account: null;
    }
  | {
      readonly status: "deleted";
      readonly cleanup: AccountDeletionCleanupResultV1;
      readonly account: AuthAccountRecord;
    };

function safeCleanupErrorCode(domain: "firebase" | "sync" | "premium", error: unknown): string {
  const raw = (error as { code?: unknown })?.code;
  if (typeof raw === "string" && /^[A-Za-z0-9_/-]{1,64}$/u.test(raw)) {
    return `${domain}/${raw}`.slice(0, 80);
  }
  return `${domain}/cleanup-failed`;
}

function safeFirebaseResultCodes(result: FirebaseCleanupResult): readonly string[] {
  if (result.completed) return [];
  const safe = result.errorCodes.filter(
    (code): code is string => typeof code === "string" && /^[A-Za-z0-9_/-]{1,80}$/u.test(code),
  );
  return safe.length > 0 ? safe : ["firebase/cleanup-failed"];
}

/**
 * Every domain cleanup is idempotent for the durable deletionRequestId. The
 * three operations are attempted even after a sibling fails so retries make
 * forward progress. The auth account is never completed from this function.
 */
export async function cleanupAccountDomainsV1(
  job: Pick<AccountDeletionJob, "deletionRequestId" | "internalUserId" | "firebaseUids" | "providerKinds">,
  dependencies: AccountDeletionCleanupDependenciesV1,
): Promise<AccountDeletionCleanupResultV1> {
  const appleRevocationPending = job.providerKinds.includes("apple");
  const [firebase, sync, premium] = await Promise.allSettled([
    dependencies.cleanupFirebase(job.firebaseUids),
    dependencies.deleteSyncData(job.internalUserId, job.deletionRequestId),
    dependencies.purgePremiumData(job.internalUserId, job.deletionRequestId),
  ]);

  const errorCodes: string[] = [];
  if (firebase.status === "rejected") {
    errorCodes.push(safeCleanupErrorCode("firebase", firebase.reason));
  } else {
    errorCodes.push(...safeFirebaseResultCodes(firebase.value));
  }
  if (appleRevocationPending) errorCodes.push("apple/revocation-adapter-required");
  if (sync.status === "rejected") errorCodes.push(safeCleanupErrorCode("sync", sync.reason));
  if (premium.status === "rejected") errorCodes.push(safeCleanupErrorCode("premium", premium.reason));

  const uniqueErrorCodes = [...new Set(errorCodes)].slice(0, 20);
  return {
    completed: uniqueErrorCodes.length === 0,
    errorCodes: uniqueErrorCodes,
    domains: {
      firebase: firebase.status === "fulfilled" && firebase.value.completed && !appleRevocationPending
        ? "completed"
        : "failed",
      sync: sync.status === "fulfilled" ? "completed" : "failed",
      premium: premium.status === "fulfilled" ? "completed" : "failed",
    },
  };
}

/**
 * The only transition to `deleted`: all Firebase, sync and premium cleanup
 * operations must have succeeded. Partial failures remain in the durable
 * deletion outbox and are safe to retry with the same request ID.
 */
export async function finalizeAccountDeletionJobV1(input: {
  readonly repository: AuthAccountRepository;
  readonly job: AccountDeletionJob;
  readonly recordedByUserId: string;
  readonly dependencies: AccountDeletionCleanupDependenciesV1;
  readonly claim?: AuthLifecycleJobClaimV1;
}): Promise<AccountDeletionFinalizationResultV1> {
  const cleanup = await cleanupAccountDomainsV1(input.job, input.dependencies);
  if (!cleanup.completed) {
    await input.repository.recordAccountDeletionCleanupFailure(
      input.job.internalUserId,
      input.job.deletionRequestId,
      cleanup.errorCodes,
      input.recordedByUserId,
      input.claim,
    );
    return { status: "deletion_pending", cleanup, account: null };
  }
  const account = await input.repository.completeAccountDeletion(
    input.job.internalUserId,
    input.job.deletionRequestId,
    input.recordedByUserId,
    input.claim,
  );
  return { status: "deleted", cleanup, account };
}

export function createAccountDeletionCleanupDependenciesV1(
  auth: Pick<Auth, "revokeRefreshTokens" | "deleteUser">,
): AccountDeletionCleanupDependenciesV1 {
  return {
    cleanupFirebase: (firebaseUids) => cleanupFirebaseUsers(auth, firebaseUids),
    async deleteSyncData(internalUserId, deletionRequestId) {
      await getAccountSyncService().deleteData(
        { userId: internalUserId, sessionId: "account_deletion_coordinator" },
        { requestId: deletionRequestId, reason: "account_deletion" },
      );
    },
    async purgePremiumData(internalUserId, deletionRequestId) {
      await purgePremiumAccountPersonalDataV1(internalUserId, deletionRequestId);
    },
  };
}
