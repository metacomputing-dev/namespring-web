import type { Auth } from "firebase-admin/auth";
import type {
  AuthAccountRecord,
  AuthAccountRepository,
  AuthLifecycleJobClaimV1,
  ProviderUnlinkFailureCodeV1,
  ProviderUnlinkJobV1,
} from "./auth-accounts-repository.js";
import { authProviderFromFirebaseId } from "./auth-identity.js";
import { isPrimarySignInProvider } from "./auth-policy.js";
import { ApiHttpError } from "./http.js";

export interface FirebaseUserLifecycleApi {
  revokeRefreshTokens(uid: string): Promise<void>;
  deleteUser(uid: string): Promise<unknown>;
}

export interface FirebaseCleanupResult {
  completed: boolean;
  errorCodes: readonly string[];
}

function uniqueUids(firebaseUids: readonly string[]): string[] {
  return [...new Set(firebaseUids.filter((uid) => typeof uid === "string" && uid.length > 0 && uid.length <= 128))];
}

function safeErrorCode(error: unknown): string {
  const raw = (error as { code?: unknown })?.code;
  if (typeof raw === "string" && /^[a-z0-9_/-]{1,80}$/i.test(raw)) return raw;
  return "auth/cleanup-failed";
}

function isUserNotFound(error: unknown): boolean {
  return (error as { code?: string })?.code === "auth/user-not-found";
}

export async function revokeAllFirebaseSessions(
  auth: Pick<Auth, "revokeRefreshTokens"> | FirebaseUserLifecycleApi,
  firebaseUids: readonly string[],
): Promise<void> {
  const results = await Promise.allSettled(uniqueUids(firebaseUids).map(async (uid) => {
    try {
      await auth.revokeRefreshTokens(uid);
    } catch (error) {
      if (!isUserNotFound(error)) throw error;
    }
  }));
  if (results.some((result) => result.status === "rejected")) {
    throw new ApiHttpError(503, "SESSION_REVOCATION_INCOMPLETE", "Not all linked sessions could be revoked. Retry shortly.");
  }
}

export async function cleanupFirebaseUsers(
  auth: Pick<Auth, "revokeRefreshTokens" | "deleteUser"> | FirebaseUserLifecycleApi,
  firebaseUids: readonly string[],
): Promise<FirebaseCleanupResult> {
  const results = await Promise.allSettled(uniqueUids(firebaseUids).map(async (uid) => {
    try {
      await auth.revokeRefreshTokens(uid);
    } catch (error) {
      if (isUserNotFound(error)) return;
      throw error;
    }
    try {
      await auth.deleteUser(uid);
    } catch (error) {
      if (!isUserNotFound(error)) throw error;
    }
  }));
  const errorCodes = results.flatMap((result) => result.status === "rejected" ? [safeErrorCode(result.reason)] : []);
  return { completed: errorCodes.length === 0, errorCodes };
}

interface FirebaseProviderInfoV1 {
  readonly providerId: string;
  readonly uid: string;
}

interface FirebaseUserRecordV1 {
  readonly providerData: readonly FirebaseProviderInfoV1[];
}

export interface FirebaseProviderUnlinkApiV1 {
  getUser(uid: string): Promise<FirebaseUserRecordV1>;
  updateUser(uid: string, properties: { providersToUnlink: string[] }): Promise<FirebaseUserRecordV1>;
  revokeRefreshTokens(uid: string): Promise<void>;
}

export type ProviderUnlinkReconciliationResultV1 =
  | { readonly status: "pending"; readonly account: null }
  | { readonly status: "completed"; readonly account: AuthAccountRecord };

function exactProviderBindingPresent(
  repository: AuthAccountRepository,
  job: ProviderUnlinkJobV1,
  firebaseUid: string,
  user: FirebaseUserRecordV1,
): { readonly exact: boolean; readonly providerIdPresent: boolean } {
  const matchingProviderIds = user.providerData.filter((entry) => entry.providerId === job.firebaseProviderId);
  return {
    providerIdPresent: matchingProviderIds.length > 0,
    exact: matchingProviderIds.some((entry) => {
      if (!entry.uid) return false;
      const subject = job.provider === "email_link" || job.provider === "phone" ? firebaseUid : entry.uid;
      return repository.providerIdentityBindingDigest({
        provider: job.provider,
        issuer: job.issuer,
        subject,
        firebaseProviderId: job.firebaseProviderId,
      }) === job.bindingDigest;
    }),
  };
}

function hasPrimaryRecoveryProvider(
  repository: AuthAccountRepository,
  job: ProviderUnlinkJobV1,
  firebaseUid: string,
  user: FirebaseUserRecordV1,
): boolean {
  return user.providerData.some((entry) => {
    try {
      if (!isPrimarySignInProvider(authProviderFromFirebaseId(entry.providerId))) return false;
    } catch {
      return false;
    }
    if (entry.providerId !== job.firebaseProviderId) return true;
    if (!entry.uid) return false;
    const subject = job.provider === "email_link" || job.provider === "phone" ? firebaseUid : entry.uid;
    return repository.providerIdentityBindingDigest({
      provider: job.provider,
      issuer: job.issuer,
      subject,
      firebaseProviderId: job.firebaseProviderId,
    }) !== job.bindingDigest;
  });
}

async function readFirebaseUserForUnlink(
  auth: FirebaseProviderUnlinkApiV1,
  firebaseUid: string,
): Promise<FirebaseUserRecordV1 | null> {
  try {
    return await auth.getUser(firebaseUid);
  } catch (error) {
    if (isUserNotFound(error)) return null;
    throw error;
  }
}

async function recordProviderUnlinkPending(
  repository: AuthAccountRepository,
  job: ProviderUnlinkJobV1,
  failureCodes: readonly ProviderUnlinkFailureCodeV1[],
  recordedByUserId: string,
  claim: AuthLifecycleJobClaimV1 | undefined,
): Promise<ProviderUnlinkReconciliationResultV1> {
  await repository.recordProviderUnlinkFailure(
    job.internalUserId,
    job.unlinkRequestId,
    failureCodes,
    recordedByUserId,
    claim,
  );
  const latest = await repository.getProviderUnlinkJob(job.unlinkRequestId);
  if (latest?.status === "completed") {
    const account = await repository.completeProviderUnlink(
      latest.internalUserId,
      latest.unlinkRequestId,
      recordedByUserId,
      claim,
    );
    return { status: "completed", account };
  }
  return { status: "pending", account: null };
}

/**
 * Reconciles a durable provider-unlink reservation across Firebase and the
 * internal identity index. Firebase state is always re-observed after an
 * ambiguous update. The internal binding remains intact until the exact
 * external identity is absent and every related Firebase UID has had its
 * refresh tokens revoked.
 */
export async function reconcileProviderUnlinkV1(input: {
  readonly repository: AuthAccountRepository;
  readonly job: ProviderUnlinkJobV1;
  readonly recordedByUserId: string;
  readonly auth: FirebaseProviderUnlinkApiV1;
  readonly claim?: AuthLifecycleJobClaimV1;
}): Promise<ProviderUnlinkReconciliationResultV1> {
  const { repository, recordedByUserId, auth } = input;
  const job = await repository.getProviderUnlinkJob(input.job.unlinkRequestId);
  if (!job || job.internalUserId !== input.job.internalUserId) {
    throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink reservation is inconsistent.");
  }
  if (job.status === "completed") {
    const account = await repository.completeProviderUnlink(
      job.internalUserId,
      job.unlinkRequestId,
      recordedByUserId,
      input.claim,
    );
    return { status: "completed", account };
  }

  const firebaseUids = uniqueUids(job.firebaseUids);
  if (firebaseUids.length === 0) {
    return recordProviderUnlinkPending(repository, job, ["firebase/read_failed"], recordedByUserId, input.claim);
  }

  const observed = new Map<string, FirebaseUserRecordV1 | null>();
  let externalMutationAttempted = false;
  for (const firebaseUid of firebaseUids) {
    try {
      observed.set(firebaseUid, await readFirebaseUserForUnlink(auth, firebaseUid));
    } catch {
      return recordProviderUnlinkPending(repository, job, ["firebase/read_failed"], recordedByUserId, input.claim);
    }
  }

  for (const firebaseUid of firebaseUids) {
    const user = observed.get(firebaseUid) ?? null;
    if (!user) continue;
    const target = exactProviderBindingPresent(repository, job, firebaseUid, user);
    if (target.providerIdPresent && !target.exact) {
      return recordProviderUnlinkPending(
        repository,
        job,
        ["firebase/target_identity_mismatch"],
        recordedByUserId,
        input.claim,
      );
    }
    if (!target.exact) continue;
    if (!hasPrimaryRecoveryProvider(repository, job, firebaseUid, user)) {
      return recordProviderUnlinkPending(
        repository,
        job,
        ["firebase/recovery_provider_missing"],
        recordedByUserId,
        input.claim,
      );
    }
    try {
      externalMutationAttempted = true;
      observed.set(firebaseUid, await auth.updateUser(firebaseUid, {
        providersToUnlink: [job.firebaseProviderId],
      }));
    } catch {
      try {
        const reconciled = await readFirebaseUserForUnlink(auth, firebaseUid);
        observed.set(firebaseUid, reconciled);
        if (reconciled && exactProviderBindingPresent(repository, job, firebaseUid, reconciled).exact) {
          return recordProviderUnlinkPending(
            repository,
            job,
            ["firebase/update_failed"],
            recordedByUserId,
            input.claim,
          );
        }
      } catch {
        return recordProviderUnlinkPending(
          repository,
          job,
          ["firebase/update_ambiguous"],
          recordedByUserId,
          input.claim,
        );
      }
    }
  }

  let externallyRecoverable = false;
  for (const firebaseUid of firebaseUids) {
    let user: FirebaseUserRecordV1 | null;
    try {
      user = await readFirebaseUserForUnlink(auth, firebaseUid);
    } catch {
      return recordProviderUnlinkPending(repository, job, ["firebase/read_failed"], recordedByUserId, input.claim);
    }
    if (!user) continue;
    const target = exactProviderBindingPresent(repository, job, firebaseUid, user);
    if (target.providerIdPresent && !target.exact) {
      return recordProviderUnlinkPending(
        repository,
        job,
        ["firebase/target_identity_mismatch"],
        recordedByUserId,
        input.claim,
      );
    }
    if (target.exact) {
      return recordProviderUnlinkPending(
        repository,
        job,
        ["firebase/update_failed"],
        recordedByUserId,
        input.claim,
      );
    }
    externallyRecoverable ||= hasPrimaryRecoveryProvider(repository, job, firebaseUid, user);
  }
  if (!externallyRecoverable) {
    return recordProviderUnlinkPending(
      repository,
      job,
      ["firebase/recovery_provider_missing"],
      recordedByUserId,
      input.claim,
    );
  }

  let durableJob = job;
  if (durableJob.stage === "reserved") {
    durableJob = await repository.markProviderUnlinkFirebaseApplied(
      job.internalUserId,
      job.unlinkRequestId,
      recordedByUserId,
      input.claim,
    );
  }

  if (durableJob.stage !== "sessions_revoked" || externalMutationAttempted) {
    const revocations = await Promise.allSettled(firebaseUids.map(async (firebaseUid) => {
      try {
        await auth.revokeRefreshTokens(firebaseUid);
      } catch (error) {
        if (!isUserNotFound(error)) throw error;
      }
    }));
    if (revocations.some((result) => result.status === "rejected")) {
      return recordProviderUnlinkPending(
        repository,
        durableJob,
        ["firebase/refresh_revoke_failed"],
        recordedByUserId,
        input.claim,
      );
    }
    durableJob = await repository.markProviderUnlinkSessionsRevoked(
      job.internalUserId,
      job.unlinkRequestId,
      recordedByUserId,
      input.claim,
    );
  }

  const account = await repository.completeProviderUnlink(
    durableJob.internalUserId,
    durableJob.unlinkRequestId,
    recordedByUserId,
    input.claim,
  );
  return { status: "completed", account };
}
