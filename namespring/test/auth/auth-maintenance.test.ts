import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryAuthAccountRepository,
  authJobBackoffMsForAttemptV1,
  type AuthAccountRepository,
} from "../../api/_lib/auth-accounts-repository.js";
import {
  AUTH_DELETION_MAINTENANCE_LIMIT_V1,
  AUTH_PROVIDER_UNLINK_MAINTENANCE_LIMIT_V1,
  processAccountDeletionJobV1,
  processProviderUnlinkJobV1,
  runAuthLifecycleMaintenanceV1,
  type AuthJobProcessingDependenciesV1,
  type AuthMaintenanceDependenciesV1,
} from "../../api/_lib/auth-maintenance.js";
import type {
  MaintenanceClaimResultV1,
  MaintenanceCoordinatorV1,
} from "../../api/_lib/maintenance-coordinator.js";
import type { VerifiedProviderIdentity } from "../../api/_lib/auth-identity.js";

process.env.AUTH_KAKAO_FIREBASE_PROVIDER_ID ??= "oidc.kakao";

function google(subject: string): VerifiedProviderIdentity & { provider: "google" } {
  return {
    provider: "google",
    issuer: "https://accounts.google.com",
    subject,
    firebaseProviderId: "google.com",
  };
}

function kakao(subject: string): VerifiedProviderIdentity & { provider: "kakao_oidc" } {
  return {
    provider: "kakao_oidc",
    issuer: "https://kauth.kakao.com",
    subject,
    firebaseProviderId: "oidc.kakao",
  };
}

class MutableClock {
  public constructor(public epochMs = Date.parse("2026-07-19T00:00:00.000Z")) {}
  public date = (): Date => new Date(this.epochMs);
  public iso = (): string => this.date().toISOString();
}

class FakeLifecycleAuth {
  public readonly users = new Map<string, Array<{ providerId: string; uid: string }>>();
  public failRevocation = false;

  public async getUser(uid: string) {
    const providerData = this.users.get(uid);
    if (!providerData) throw Object.assign(new Error("missing"), { code: "auth/user-not-found" });
    return { providerData: providerData.map((entry) => ({ ...entry })) };
  }

  public async updateUser(uid: string, properties: { providersToUnlink: string[] }) {
    const providerData = this.users.get(uid);
    if (!providerData) throw Object.assign(new Error("missing"), { code: "auth/user-not-found" });
    const updated = providerData.filter((entry) => !properties.providersToUnlink.includes(entry.providerId));
    this.users.set(uid, updated);
    return { providerData: updated.map((entry) => ({ ...entry })) };
  }

  public async revokeRefreshTokens(): Promise<void> {
    if (this.failRevocation) throw Object.assign(new Error("temporary"), { code: "auth/internal-error" });
  }

  public async deleteUser(): Promise<void> {}
}

function claimToken(character: string): string {
  return `ajc_${character.repeat(32)}`;
}

function jobDependencies(input: {
  repository: AuthAccountRepository;
  clock: MutableClock;
  auth?: FakeLifecycleAuth;
  cleanupFirebase?: AuthJobProcessingDependenciesV1["deletionDependencies"]["cleanupFirebase"];
  deleteSyncData?: AuthJobProcessingDependenciesV1["deletionDependencies"]["deleteSyncData"];
  purgePremiumData?: AuthJobProcessingDependenciesV1["deletionDependencies"]["purgePremiumData"];
  token?: string;
}): AuthJobProcessingDependenciesV1 {
  const auth = input.auth ?? new FakeLifecycleAuth();
  return {
    repository: input.repository,
    auth,
    deletionDependencies: {
      cleanupFirebase: input.cleanupFirebase ?? (async () => ({ completed: true, errorCodes: [] })),
      deleteSyncData: input.deleteSyncData ?? (async () => undefined),
      purgePremiumData: input.purgePremiumData ?? (async () => undefined),
    },
    now: input.clock.date,
    newClaimToken: () => input.token ?? claimToken("z"),
  };
}

async function pendingDeletion(repository: InMemoryAuthAccountRepository, suffix: string) {
  await repository.ensureAccount({
    firebaseUid: `firebase-delete-${suffix}`,
    identity: google(`google-delete-${suffix}`),
    allowAnonymousUpgrade: false,
  });
  return repository.beginAccountDeletion(`firebase-delete-${suffix}`);
}

async function pendingUnlink(
  repository: InMemoryAuthAccountRepository,
  auth: FakeLifecycleAuth,
  suffix: string,
) {
  const firebaseUid = `firebase-unlink-${suffix}`;
  await repository.ensureAccount({
    firebaseUid,
    identity: google(`google-unlink-${suffix}`),
    allowAnonymousUpgrade: false,
  });
  await repository.linkIdentity(firebaseUid, kakao(`kakao-unlink-${suffix}`));
  auth.users.set(firebaseUid, [
    { providerId: "google.com", uid: `google-unlink-${suffix}` },
    { providerId: "oidc.kakao", uid: `kakao-unlink-${suffix}` },
  ]);
  return repository.beginProviderUnlink({
    firebaseUid,
    identity: google(`google-unlink-${suffix}`),
  });
}

test("auth jobs fence duplicate runners, permit expired takeover, and reject stale owners", async () => {
  const clock = new MutableClock();
  let sequence = 0;
  const repository = new InMemoryAuthAccountRepository(clock.iso, () => `claim-${++sequence}`);
  const deletion = await pendingDeletion(repository, "claim");
  const first = await repository.claimAccountDeletionJob({
    deletionRequestId: deletion.job.deletionRequestId,
    now: clock.iso(),
    leaseMs: 90_000,
    claimToken: claimToken("a"),
    force: false,
  });
  assert.equal(first.acquired, true);
  if (!first.acquired) return;

  const duplicate = await repository.claimAccountDeletionJob({
    deletionRequestId: deletion.job.deletionRequestId,
    now: clock.iso(),
    leaseMs: 90_000,
    claimToken: claimToken("b"),
    force: true,
  });
  assert.deepEqual(duplicate, { acquired: false });

  clock.epochMs += 90_001;
  const takeover = await repository.claimAccountDeletionJob({
    deletionRequestId: deletion.job.deletionRequestId,
    now: clock.iso(),
    leaseMs: 90_000,
    claimToken: claimToken("b"),
    force: false,
  });
  assert.equal(takeover.acquired, true);
  if (!takeover.acquired) return;
  assert.equal(takeover.claim.fence, first.claim.fence + 1);
  await assert.rejects(
    () => repository.recordAccountDeletionCleanupFailure(
      deletion.job.internalUserId,
      deletion.job.deletionRequestId,
      ["sync/temporary"],
      "system",
      first.claim,
    ),
    (error: unknown) => (error as { code?: string }).code === "AUTH_JOB_CLAIM_LOST",
  );
  assert.equal(await repository.releaseAuthLifecycleJobClaim(first.claim, true), false);
  assert.equal(await repository.releaseAuthLifecycleJobClaim(takeover.claim, true), true);

  const scheduled = await repository.getAccountDeletionJob(deletion.job.deletionRequestId);
  assert.equal(scheduled?.attemptCount, 1);
  assert.equal(scheduled?.backoffMs, 30_000);
  assert.equal(scheduled?.nextAttemptAt, new Date(clock.epochMs + 30_000).toISOString());
  assert.equal(scheduled?.claimToken, null);
  assert.equal(scheduled?.deleteAfter, null, "pending jobs must never be TTL eligible");
});

test("auth retry backoff is deterministic, monotonic, and capped without jitter", () => {
  assert.equal(authJobBackoffMsForAttemptV1(0), 0);
  assert.equal(authJobBackoffMsForAttemptV1(1), 30_000);
  assert.equal(authJobBackoffMsForAttemptV1(2), 60_000);
  assert.equal(authJobBackoffMsForAttemptV1(4), 240_000);
  assert.equal(authJobBackoffMsForAttemptV1(20), 6 * 60 * 60 * 1_000);
  assert.equal(authJobBackoffMsForAttemptV1(10_000), 6 * 60 * 60 * 1_000);
});

test("account cleanup retries partial domains after backoff and completion replays without cleanup", async () => {
  const clock = new MutableClock();
  let sequence = 0;
  let syncCalls = 0;
  let firebaseCalls = 0;
  let premiumCalls = 0;
  const repository = new InMemoryAuthAccountRepository(clock.iso, () => `partial-${++sequence}`);
  const deletion = await pendingDeletion(repository, "partial");
  const dependencies = jobDependencies({
    repository,
    clock,
    cleanupFirebase: async () => {
      firebaseCalls += 1;
      return { completed: true, errorCodes: [] };
    },
    deleteSyncData: async () => {
      syncCalls += 1;
      if (syncCalls === 1) throw Object.assign(new Error("temporary"), { code: "unavailable" });
    },
    purgePremiumData: async () => { premiumCalls += 1; },
    token: claimToken("c"),
  });

  const first = await processAccountDeletionJobV1({
    deletionRequestId: deletion.job.deletionRequestId,
    recordedByUserId: "system",
    force: true,
    dependencies,
  });
  assert.equal(first.status, "deletion_pending");
  assert.equal(first.job.attemptCount, 1);

  clock.epochMs += 29_999;
  const early = await processAccountDeletionJobV1({
    deletionRequestId: deletion.job.deletionRequestId,
    recordedByUserId: "system",
    force: false,
    dependencies,
  });
  assert.equal(early.status, "deletion_pending");
  assert.equal(early.locked, true);
  assert.equal(syncCalls, 1);

  clock.epochMs += 1;
  const completed = await processAccountDeletionJobV1({
    deletionRequestId: deletion.job.deletionRequestId,
    recordedByUserId: "system",
    force: false,
    dependencies,
  });
  assert.equal(completed.status, "deleted");
  assert.equal(completed.job.nextAttemptAt, null);
  assert.equal(completed.job.claimToken, null);
  assert.ok(completed.job.deleteAfter);
  assert.deepEqual([firebaseCalls, syncCalls, premiumCalls], [2, 2, 2]);

  const replay = await processAccountDeletionJobV1({
    deletionRequestId: deletion.job.deletionRequestId,
    recordedByUserId: "system",
    force: true,
    dependencies,
  });
  assert.equal(replay.status, "deleted");
  assert.deepEqual([firebaseCalls, syncCalls, premiumCalls], [2, 2, 2]);
});

test("provider unlink resumes after restart-safe backoff and completes exactly once", async () => {
  const clock = new MutableClock();
  let sequence = 0;
  const repository = new InMemoryAuthAccountRepository(clock.iso, () => `unlink-${++sequence}`);
  const auth = new FakeLifecycleAuth();
  const unlink = await pendingUnlink(repository, auth, "resume");
  const dependencies = jobDependencies({ repository, clock, auth, token: claimToken("d") });
  auth.failRevocation = true;
  const first = await processProviderUnlinkJobV1({
    unlinkRequestId: unlink.job.unlinkRequestId,
    recordedByUserId: "system",
    force: true,
    dependencies,
  });
  assert.equal(first.status, "pending");
  assert.equal(first.job.stage, "firebase_unlinked");
  assert.equal(first.job.attemptCount, 1);

  auth.failRevocation = false;
  clock.epochMs += 30_000;
  const completed = await processProviderUnlinkJobV1({
    unlinkRequestId: unlink.job.unlinkRequestId,
    recordedByUserId: "system",
    force: false,
    dependencies,
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.job.bindingDigest, "");
  assert.equal(completed.job.nextAttemptAt, null);
  assert.ok(completed.job.deleteAfter);

  const replay = await processProviderUnlinkJobV1({
    unlinkRequestId: unlink.job.unlinkRequestId,
    recordedByUserId: "system",
    force: true,
    dependencies,
  });
  assert.equal(replay.status, "completed");
});

const maintenanceClaim: Extract<MaintenanceClaimResultV1, { readonly acquired: true }> = {
  acquired: true,
  job: "auth_lifecycle",
  runId: "mrun_0123456789abcdefghijklmn",
  claimToken: "m".repeat(43),
  fence: 1,
};

test("auth maintenance enforces fixed limits and isolates a corrupt candidate", async () => {
  const clock = new MutableClock();
  let sequence = 0;
  const base = new InMemoryAuthAccountRepository(clock.iso, () => `sweep-${++sequence}`);
  const deletion = await pendingDeletion(base, "sweep");
  const listCalls: Array<{ kind: string; limit: number }> = [];
  const repository = new Proxy(base, {
    get(target, property) {
      if (property === "listDueAccountDeletionJobIds") {
        return async (_now: string, limit: number) => {
          listCalls.push({ kind: "deletion", limit });
          return ["malformed-or-missing-candidate", deletion.job.deletionRequestId];
        };
      }
      if (property === "listDueProviderUnlinkJobIds") {
        return async (_now: string, limit: number) => {
          listCalls.push({ kind: "unlink", limit });
          return [];
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as unknown as AuthAccountRepository;
  const finishes: unknown[] = [];
  const coordinator: MaintenanceCoordinatorV1 = {
    async claim() { return maintenanceClaim; },
    async finish(input) { finishes.push(input); return true; },
  };
  const dependencies: AuthMaintenanceDependenciesV1 = {
    ...jobDependencies({ repository, clock, token: claimToken("e") }),
    coordinator,
    newRunId: () => maintenanceClaim.runId,
  };
  const response = await runAuthLifecycleMaintenanceV1(dependencies);
  assert.deepEqual(listCalls, [
    { kind: "deletion", limit: AUTH_DELETION_MAINTENANCE_LIMIT_V1 },
    { kind: "unlink", limit: AUTH_PROVIDER_UNLINK_MAINTENANCE_LIMIT_V1 },
  ]);
  assert.equal(response.scanned, 2);
  assert.equal(response.deleted, 1);
  assert.equal(response.failed, 1);
  assert.equal(response.outcome, "partial");
  assert.equal(response.hasMore, true);
  assert.equal(JSON.stringify(response).includes(deletion.job.deletionRequestId), false);
  assert.equal(finishes.length, 1);
});

test("auth maintenance stops before a candidate once its fixed deadline is reached", async () => {
  const clock = new MutableClock();
  let sequence = 0;
  const base = new InMemoryAuthAccountRepository(clock.iso, () => `deadline-${++sequence}`);
  const deletion = await pendingDeletion(base, "deadline");
  const repository = new Proxy(base, {
    get(target, property) {
      if (property === "listDueAccountDeletionJobIds") return async () => [deletion.job.deletionRequestId];
      if (property === "listDueProviderUnlinkJobIds") return async () => [];
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as unknown as AuthAccountRepository;
  let nowCalls = 0;
  const now = () => new Date(clock.epochMs + (nowCalls++ === 0 ? 0 : 46_000));
  const coordinator: MaintenanceCoordinatorV1 = {
    async claim() { return maintenanceClaim; },
    async finish() { return true; },
  };
  const response = await runAuthLifecycleMaintenanceV1({
    ...jobDependencies({ repository, clock, token: claimToken("f") }),
    coordinator,
    now,
    newRunId: () => maintenanceClaim.runId,
  });
  assert.equal(response.scanned, 0);
  assert.equal(response.deadlineReached, true);
  assert.equal(response.hasMore, true);
  assert.equal(response.durationMs, 46_000);
});

test("an overlapping auth maintenance runner touches no job queue", async () => {
  let listCalls = 0;
  const clock = new MutableClock();
  const base = new InMemoryAuthAccountRepository(clock.iso, () => "locked");
  const repository = new Proxy(base, {
    get(target, property) {
      if (property === "listDueAccountDeletionJobIds" || property === "listDueProviderUnlinkJobIds") {
        return async () => { listCalls += 1; return []; };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as unknown as AuthAccountRepository;
  const coordinator: MaintenanceCoordinatorV1 = {
    async claim() { return { acquired: false }; },
    async finish() { throw new Error("must not finish an unclaimed run"); },
  };
  const response = await runAuthLifecycleMaintenanceV1({
    ...jobDependencies({ repository, clock }),
    coordinator,
    newRunId: () => maintenanceClaim.runId,
  });
  assert.equal(response.outcome, "skipped_locked");
  assert.equal(response.hasMore, true);
  assert.equal(listCalls, 0);
});
