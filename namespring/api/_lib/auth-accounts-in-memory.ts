import { randomUUID } from "node:crypto";
import {
  AUTH_PROVIDERS,
  type AccountExportResponse,
  type AuthLifecycleJobAdminViewV1,
} from "../../shared/types/auth.js";
import { assertNoPaymentConfirmationLeaseV1 } from "./account-write-fence.js";
import { AUTH_DELETION_JOB_RETENTION_DAYS_V1, retentionDeadlineV1 } from "./auth-audit-privacy.js";
import {
  type AccountDeletionJob,
  type AuthAccountRecord,
  type AuthAccountRepository,
  type AuthLifecycleDiscoveryAuditInputV1,
  type AuthLifecycleDiscoveryAuditRecordV1,
  type AuthLifecycleJobClaimResultV1,
  type AuthLifecycleJobClaimV1,
  type AuthLifecycleJobKindV1,
  type AuthLifecycleJobMetadataPageV1,
  type AuthLifecycleJobMetadataQueryV1,
  type BeginAccountDeletionResult,
  type BeginProviderUnlinkInputV1,
  type BeginProviderUnlinkResultV1,
  type EnsureAccountInput,
  type EnsureAccountResult,
  type ProviderUnlinkFailureCodeV1,
  type ProviderUnlinkJobV1,
} from "./auth-accounts-contract.js";
import {
  accountExport,
  appendUnique,
  assertAccountActive,
  assertAuthJobClaimOwned,
  assertAuthJobLimit,
  assertAuthLifecycleMetadataQueryV1,
  assertNoProviderUnlinkPending,
  assertPendingProviderUnlinkIntegrity,
  authJobTime,
  authLifecycleJobMetadataV1,
  authLifecycleRequestIdMatchesKind,
  bindingFor,
  claimAuthJobState,
  compareAuthLifecycleMetadataV1,
  completedAuthJobState,
  deletionRequestId,
  makeAuthLifecycleDiscoveryAuditV1,
  nextAuthJobRetryState,
  providerUnlinkRequestId,
  providerUnlinkReservationMatches,
  sanitizeDeletionFailureCodes,
  sanitizeProviderUnlinkFailureCodes,
  type BindingRecord,
  type PrincipalRecord,
} from "./auth-accounts-lifecycle.js";
import {
  createAuthIdentityBindingDigesterV2,
  digestIdentityPart,
  type AuthIdentityBindingDigesterV2,
  type AuthIdentityBindingDigestV2,
  type VerifiedProviderIdentity,
} from "./auth-identity.js";
import { isPrimarySignInProvider } from "./auth-policy.js";
import { ApiHttpError } from "./http.js";

/**
 * Test double with the same conflict and privacy rules as Firestore.
 * Identity subjects become dedicated-key HMAC bindings immediately and are never retained.
 */
export class InMemoryAuthAccountRepository implements AuthAccountRepository {
  private readonly accounts = new Map<string, AuthAccountRecord>();
  private readonly principals = new Map<string, PrincipalRecord>();
  private readonly bindings = new Map<string, BindingRecord>();
  private readonly deletionJobs = new Map<string, AccountDeletionJob>();
  private readonly providerUnlinkJobs = new Map<string, ProviderUnlinkJobV1>();
  private readonly deletionFences = new Set<string>();
  public readonly lifecycleDiscoveryAudits: AuthLifecycleDiscoveryAuditRecordV1[] = [];

  constructor(
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = () => randomUUID(),
    private readonly hasPaymentConfirmationLease: (internalUserId: string) => boolean = () => false,
    private readonly auditHmacKey: () => string = () => "in-memory-auth-audit-key-32-bytes-minimum",
    private readonly bindingDigester: AuthIdentityBindingDigesterV2 = createAuthIdentityBindingDigesterV2(
      "in-memory-only-provider-binding-key-32-bytes-minimum",
    ),
  ) {}

  providerIdentityBindingDigest(identity: VerifiedProviderIdentity): AuthIdentityBindingDigestV2 {
    return this.bindingDigester(identity);
  }

  /** Test-only parity check for the production Firestore deletion fence. */
  public hasAccountDeletionFence(internalUserId: string): boolean {
    return this.deletionFences.has(internalUserId);
  }

  async ensureAccount(input: EnsureAccountInput): Promise<EnsureAccountResult> {
    const at = this.now();
    const principalKey = digestIdentityPart(input.firebaseUid);
    const bindingKey = this.providerIdentityBindingDigest(input.identity);
    const principal = this.principals.get(principalKey);
    const bound = this.bindings.get(bindingKey);

    if (principal && bound && principal.internalUserId !== bound.internalUserId) {
      throw new ApiHttpError(409, "IDENTITY_CONFLICT", "The provider identity belongs to another account.");
    }

    let account = principal ? this.accounts.get(principal.internalUserId) : bound ? this.accounts.get(bound.internalUserId) : null;
    let recoveredExistingAccount = false;

    if (!account && (principal || bound)) {
      throw new ApiHttpError(500, "AUTH_REPOSITORY_INTEGRITY_ERROR", "Authentication binding points to a missing account.");
    }

    if (!account) {
      const internalUserId = this.newId();
      account = {
        internalUserId,
        status: "active",
        roles: ["user"],
        providers: [bindingFor(input.identity, at, bindingKey)],
        firebaseUids: [input.firebaseUid],
        createdAt: at,
        updatedAt: at,
        lastAuthenticatedAt: at,
        deletionRequestedAt: null,
        deletedAt: null,
        deleteAfter: null,
        pendingProviderUnlink: null,
        version: 1,
      };
      this.accounts.set(internalUserId, account);
      this.principals.set(principalKey, { internalUserId, firebaseUid: input.firebaseUid, createdAt: at });
      this.bindings.set(bindingKey, {
        internalUserId,
        provider: input.identity.provider,
        issuer: input.identity.issuer,
        subjectDigest: bindingKey,
        createdAt: at,
      });
      return { account, recoveredExistingAccount: false };
    }

    assertAccountActive(account);
    assertNoProviderUnlinkPending(account);
    if (!principal && bound) {
      recoveredExistingAccount = true;
      this.principals.set(principalKey, {
        internalUserId: account.internalUserId,
        firebaseUid: input.firebaseUid,
        createdAt: at,
      });
    }

    const hasBinding = account.providers.some((provider) => provider.subjectDigest === bindingKey);
    if (!hasBinding) {
      const onlyAnonymous = account.providers.every((provider) => provider.provider === "anonymous");
      if (!(input.allowAnonymousUpgrade && onlyAnonymous && input.identity.provider !== "anonymous")) {
        throw new ApiHttpError(409, "EXPLICIT_LINK_REQUIRED", "Link this provider through the authenticated account-link endpoint.");
      }
      if (bound && bound.internalUserId !== account.internalUserId) {
        throw new ApiHttpError(409, "IDENTITY_CONFLICT", "The provider identity belongs to another account.");
      }
      this.bindings.set(bindingKey, {
        internalUserId: account.internalUserId,
        provider: input.identity.provider,
        issuer: input.identity.issuer,
        subjectDigest: bindingKey,
        createdAt: at,
      });
    }

    account = {
      ...account,
      firebaseUids: appendUnique(account.firebaseUids, input.firebaseUid),
      providers: hasBinding ? account.providers : [...account.providers, bindingFor(input.identity, at, bindingKey)],
      updatedAt: at,
      lastAuthenticatedAt: at,
    };
    this.accounts.set(account.internalUserId, account);
    this.principals.set(principalKey, {
      internalUserId: account.internalUserId,
      firebaseUid: input.firebaseUid,
      createdAt: principal?.createdAt ?? at,
    });
    return { account, recoveredExistingAccount };
  }

  async getActiveByFirebaseUid(firebaseUid: string): Promise<AuthAccountRecord | null> {
    const principal = this.principals.get(digestIdentityPart(firebaseUid));
    if (!principal) return null;
    const account = this.accounts.get(principal.internalUserId) ?? null;
    return account?.status === "active" && !account.pendingProviderUnlink ? account : null;
  }

  async linkIdentity(firebaseUid: string, identity: VerifiedProviderIdentity): Promise<AuthAccountRecord> {
    const account = await this.getActiveByFirebaseUid(firebaseUid);
    assertAccountActive(account);
    assertNoProviderUnlinkPending(account);
    const at = this.now();
    const key = this.providerIdentityBindingDigest(identity);
    const bound = this.bindings.get(key);
    if (bound && bound.internalUserId !== account.internalUserId) {
      throw new ApiHttpError(409, "IDENTITY_CONFLICT", "The provider identity belongs to another account.");
    }
    if (account.providers.some((provider) => provider.subjectDigest === key)) return account;
    const updated = { ...account, providers: [...account.providers, bindingFor(identity, at, key)], updatedAt: at };
    this.accounts.set(account.internalUserId, updated);
    this.bindings.set(key, {
      internalUserId: account.internalUserId,
      provider: identity.provider,
      issuer: identity.issuer,
      subjectDigest: key,
      createdAt: at,
    });
    return updated;
  }

  async beginProviderUnlink(input: BeginProviderUnlinkInputV1): Promise<BeginProviderUnlinkResultV1> {
    const principal = this.principals.get(digestIdentityPart(input.firebaseUid));
    const account = principal ? this.accounts.get(principal.internalUserId) : null;
    assertAccountActive(account);
    const bindingDigest = this.providerIdentityBindingDigest(input.identity);
    if (account.pendingProviderUnlink) {
      const pending = account.pendingProviderUnlink;
      const job = this.providerUnlinkJobs.get(pending.unlinkRequestId);
      const storedBinding = this.bindings.get(bindingDigest);
      if (providerUnlinkReservationMatches(account, job, input.identity, bindingDigest)
        && storedBinding?.internalUserId === account.internalUserId) {
        return { account, job };
      }
      assertNoProviderUnlinkPending(account);
    }
    const target = account.providers.find((entry) => entry.subjectDigest === bindingDigest
      && entry.provider === input.identity.provider);
    const storedBinding = this.bindings.get(bindingDigest);
    if (!target || !storedBinding || storedBinding.internalUserId !== account.internalUserId) {
      throw new ApiHttpError(409, "PROVIDER_BINDING_NOT_FOUND", "The exact verified provider binding is not linked.");
    }
    const remaining = account.providers.filter((entry) => entry.subjectDigest !== bindingDigest);
    if (!remaining.some((entry) => isPrimarySignInProvider(entry.provider))) {
      throw new ApiHttpError(409, "LAST_SIGN_IN_METHOD", "Link another sign-in method before unlinking this provider.");
    }
    const at = this.now();
    const unlinkRequestId = providerUnlinkRequestId(this.newId());
    const job: ProviderUnlinkJobV1 = {
      unlinkRequestId,
      internalUserId: account.internalUserId,
      provider: input.identity.provider,
      issuer: input.identity.issuer,
      firebaseProviderId: input.identity.firebaseProviderId,
      bindingDigest,
      firebaseUids: [...new Set(account.firebaseUids)],
      status: "pending",
      stage: "reserved",
      requestedAt: at,
      updatedAt: at,
      attemptCount: 0,
      lastFailureCodes: [],
      nextAttemptAt: at,
      claimUntil: null,
      claimToken: null,
      fence: 0,
      backoffMs: 0,
      deleteAfter: null,
    };
    const updated: AuthAccountRecord = {
      ...account,
      updatedAt: at,
      pendingProviderUnlink: { unlinkRequestId, provider: input.identity.provider, bindingDigest },
    };
    this.accounts.set(account.internalUserId, updated);
    this.providerUnlinkJobs.set(unlinkRequestId, job);
    return { account: updated, job };
  }

  async markProviderUnlinkFirebaseApplied(
    internalUserId: string,
    unlinkRequestId: string,
    _recordedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<ProviderUnlinkJobV1> {
    const job = this.providerUnlinkJobs.get(unlinkRequestId);
    if (!job || job.internalUserId !== internalUserId) {
      throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink job is inconsistent.");
    }
    if (job.status === "completed" || job.stage !== "reserved") return job;
    const at = this.now();
    assertAuthJobClaimOwned(job, "provider_unlink", unlinkRequestId, claim, at);
    const updated: ProviderUnlinkJobV1 = {
      ...job,
      stage: "firebase_unlinked",
      updatedAt: at,
      lastFailureCodes: [],
    };
    this.providerUnlinkJobs.set(unlinkRequestId, updated);
    return updated;
  }

  async markProviderUnlinkSessionsRevoked(
    internalUserId: string,
    unlinkRequestId: string,
    _recordedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<ProviderUnlinkJobV1> {
    const job = this.providerUnlinkJobs.get(unlinkRequestId);
    if (!job || job.internalUserId !== internalUserId) {
      throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink job is inconsistent.");
    }
    if (job.status === "completed" || job.stage === "sessions_revoked") return job;
    if (job.stage !== "firebase_unlinked") {
      throw new ApiHttpError(409, "PROVIDER_UNLINK_EXTERNAL_PENDING", "Firebase provider removal is not confirmed.");
    }
    const at = this.now();
    assertAuthJobClaimOwned(job, "provider_unlink", unlinkRequestId, claim, at);
    const updated: ProviderUnlinkJobV1 = {
      ...job,
      stage: "sessions_revoked",
      updatedAt: at,
      lastFailureCodes: [],
    };
    this.providerUnlinkJobs.set(unlinkRequestId, updated);
    return updated;
  }

  async completeProviderUnlink(
    internalUserId: string,
    unlinkRequestId: string,
    _completedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<AuthAccountRecord> {
    const account = this.accounts.get(internalUserId);
    const job = this.providerUnlinkJobs.get(unlinkRequestId);
    if (!account || !job || job.internalUserId !== internalUserId) {
      throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink job is inconsistent.");
    }
    if (job.status === "completed") return account;
    const at = this.now();
    assertAuthJobClaimOwned(job, "provider_unlink", unlinkRequestId, claim, at);
    if (job.stage !== "sessions_revoked"
      || account.pendingProviderUnlink?.unlinkRequestId !== unlinkRequestId
      || account.pendingProviderUnlink.bindingDigest !== job.bindingDigest) {
      throw new ApiHttpError(409, "PROVIDER_UNLINK_NOT_READY", "Provider unlink reconciliation is not complete.");
    }
    const binding = this.bindings.get(job.bindingDigest);
    if (!binding || binding.internalUserId !== internalUserId) {
      throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink binding ownership is inconsistent.");
    }
    const remaining = account.providers.filter((entry) => entry.subjectDigest !== job.bindingDigest);
    if (!remaining.some((entry) => isPrimarySignInProvider(entry.provider))) {
      throw new ApiHttpError(409, "LAST_SIGN_IN_METHOD", "A recoverable sign-in method must remain linked.");
    }
    const updated: AuthAccountRecord = {
      ...account,
      providers: remaining,
      updatedAt: at,
      pendingProviderUnlink: null,
    };
    this.bindings.delete(job.bindingDigest);
    this.accounts.set(internalUserId, updated);
    this.providerUnlinkJobs.set(unlinkRequestId, {
      ...job,
      bindingDigest: "",
      firebaseUids: [],
      status: "completed",
      stage: "completed",
      updatedAt: at,
      lastFailureCodes: [],
      ...completedAuthJobState(),
      deleteAfter: retentionDeadlineV1(at, AUTH_DELETION_JOB_RETENTION_DAYS_V1),
    });
    return updated;
  }

  async recordProviderUnlinkFailure(
    internalUserId: string,
    unlinkRequestId: string,
    failureCodes: readonly ProviderUnlinkFailureCodeV1[],
    _recordedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<boolean> {
    const job = this.providerUnlinkJobs.get(unlinkRequestId);
    if (!job || job.internalUserId !== internalUserId) {
      throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink job is inconsistent.");
    }
    if (job.status === "completed") return true;
    const at = this.now();
    assertAuthJobClaimOwned(job, "provider_unlink", unlinkRequestId, claim, at);
    this.providerUnlinkJobs.set(unlinkRequestId, {
      ...job,
      updatedAt: at,
      ...nextAuthJobRetryState(job, at),
      lastFailureCodes: sanitizeProviderUnlinkFailureCodes(failureCodes),
    });
    return true;
  }

  async getProviderUnlinkJob(unlinkRequestId: string): Promise<ProviderUnlinkJobV1 | null> {
    const job = this.providerUnlinkJobs.get(unlinkRequestId) ?? null;
    if (job?.status === "pending") {
      assertPendingProviderUnlinkIntegrity(
        this.accounts.get(job.internalUserId),
        job,
        this.bindings.get(job.bindingDigest),
      );
    }
    return job;
  }

  async listDueProviderUnlinkJobIds(now: string, limit: number): Promise<readonly string[]> {
    const nowMs = authJobTime(now, "Provider unlink listing time");
    assertAuthJobLimit(limit);
    return [...this.providerUnlinkJobs.values()]
      .filter((job) => job.status === "pending" && job.nextAttemptAt !== null
        && authJobTime(job.nextAttemptAt, "Provider unlink next attempt") <= nowMs)
      .sort((left, right) => String(left.nextAttemptAt).localeCompare(String(right.nextAttemptAt))
        || left.requestedAt.localeCompare(right.requestedAt)
        || left.unlinkRequestId.localeCompare(right.unlinkRequestId))
      .slice(0, limit)
      .map((job) => job.unlinkRequestId);
  }

  async claimProviderUnlinkJob(input: {
    readonly unlinkRequestId: string;
    readonly now: string;
    readonly leaseMs: number;
    readonly claimToken: string;
    readonly force: boolean;
  }): Promise<AuthLifecycleJobClaimResultV1<ProviderUnlinkJobV1>> {
    const job = await this.getProviderUnlinkJob(input.unlinkRequestId);
    if (!job) return { acquired: false };
    const claimed = claimAuthJobState({
      job,
      kind: "provider_unlink",
      jobId: input.unlinkRequestId,
      now: input.now,
      leaseMs: input.leaseMs,
      claimToken: input.claimToken,
      force: input.force,
    });
    if (!claimed) return { acquired: false };
    this.providerUnlinkJobs.set(input.unlinkRequestId, claimed.job);
    return { acquired: true, claim: claimed.claim, job: claimed.job };
  }

  async beginAccountDeletion(firebaseUid: string): Promise<BeginAccountDeletionResult> {
    const principal = this.principals.get(digestIdentityPart(firebaseUid));
    const account = principal ? this.accounts.get(principal.internalUserId) : null;
    assertAccountActive(account);
    assertNoProviderUnlinkPending(account);
    assertNoPaymentConfirmationLeaseV1({ exists: this.hasPaymentConfirmationLease(account.internalUserId) });
    const at = this.now();
    const firebaseUids = [...account.firebaseUids];
    const bindingDigests = account.providers.map((binding) => binding.subjectDigest);
    const providerKinds = AUTH_PROVIDERS.filter((provider) => account.providers.some((binding) => binding.provider === provider));
    const pending: AuthAccountRecord = {
      ...account,
      status: "deletion_pending",
      providers: [],
      firebaseUids: [],
      updatedAt: at,
      deletionRequestedAt: at,
      deletedAt: null,
    };
    const job: AccountDeletionJob = {
      deletionRequestId: deletionRequestId(this.newId()),
      internalUserId: account.internalUserId,
      firebaseUids,
      bindingDigests,
      providerKinds,
      status: "pending",
      requestedAt: at,
      updatedAt: at,
      attemptCount: 0,
      lastErrorCodes: [],
      nextAttemptAt: at,
      claimUntil: null,
      claimToken: null,
      fence: 0,
      backoffMs: 0,
      deleteAfter: null,
    };
    this.deletionFences.add(account.internalUserId);
    this.accounts.set(account.internalUserId, pending);
    this.deletionJobs.set(job.deletionRequestId, job);
    return { account: pending, job };
  }

  async completeAccountDeletion(
    internalUserId: string,
    deletionRequestId: string,
    _completedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<AuthAccountRecord> {
    const account = this.accounts.get(internalUserId);
    const job = this.deletionJobs.get(deletionRequestId);
    if (!account || !job || job.internalUserId !== internalUserId) {
      throw new ApiHttpError(500, "DELETION_JOB_INTEGRITY_ERROR", "Account deletion job is inconsistent.");
    }
    if (account.status === "deleted" && job.status === "completed") return account;
    const at = this.now();
    assertAuthJobClaimOwned(job, "account_deletion", deletionRequestId, claim, at);
    if (account.status !== "deletion_pending" || job.status !== "pending") {
      throw new ApiHttpError(409, "DELETION_NOT_PENDING", "Account deletion is not pending.");
    }
    const deleted: AuthAccountRecord = {
      ...account,
      status: "deleted",
      updatedAt: at,
      deletedAt: at,
      deleteAfter: retentionDeadlineV1(at, AUTH_DELETION_JOB_RETENTION_DAYS_V1),
    };
    for (const uid of job.firebaseUids) this.principals.delete(digestIdentityPart(uid));
    for (const bindingDigest of job.bindingDigests) this.bindings.delete(bindingDigest);
    this.accounts.set(internalUserId, deleted);
    this.deletionJobs.set(deletionRequestId, {
      ...job,
      firebaseUids: [],
      bindingDigests: [],
      providerKinds: [],
      status: "completed",
      updatedAt: at,
      lastErrorCodes: [],
      ...completedAuthJobState(),
      deleteAfter: retentionDeadlineV1(at, AUTH_DELETION_JOB_RETENTION_DAYS_V1),
    });
    return deleted;
  }

  async recordAccountDeletionCleanupFailure(
    internalUserId: string,
    deletionRequestId: string,
    errorCodes: readonly string[],
    _recordedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<boolean> {
    const job = this.deletionJobs.get(deletionRequestId);
    if (!job || job.internalUserId !== internalUserId) {
      throw new ApiHttpError(500, "DELETION_JOB_INTEGRITY_ERROR", "Account deletion job is inconsistent.");
    }
    if (job.status === "completed") return true;
    const at = this.now();
    assertAuthJobClaimOwned(job, "account_deletion", deletionRequestId, claim, at);
    this.deletionJobs.set(deletionRequestId, {
      ...job,
      updatedAt: at,
      ...nextAuthJobRetryState(job, at),
      lastErrorCodes: sanitizeDeletionFailureCodes(errorCodes),
    });
    return true;
  }

  async getAccountDeletionJob(deletionRequestId: string): Promise<AccountDeletionJob | null> {
    return this.deletionJobs.get(deletionRequestId) ?? null;
  }

  async listAuthLifecycleJobMetadata(
    input: AuthLifecycleJobMetadataQueryV1,
  ): Promise<AuthLifecycleJobMetadataPageV1> {
    assertAuthLifecycleMetadataQueryV1(input);
    const candidates = [
      ...(input.kind === "provider_unlink" ? [] : [...this.deletionJobs.values()].map(authLifecycleJobMetadataV1)),
      ...(input.kind === "account_deletion" ? [] : [...this.providerUnlinkJobs.values()].map(authLifecycleJobMetadataV1)),
    ]
      .filter((job) => job.requestedAt <= input.snapshotAt
        && (input.status === undefined || job.status === input.status)
        && (input.after === undefined || compareAuthLifecycleMetadataV1(job, input.after) > 0))
      .sort(compareAuthLifecycleMetadataV1);
    const jobs = candidates.slice(0, input.limit);
    return {
      jobs,
      nextPosition: candidates.length > input.limit
        ? (() => {
            const last = jobs.at(-1);
            return last ? { requestedAt: last.requestedAt, requestId: last.requestId } : null;
          })()
        : null,
    };
  }

  async getAuthLifecycleJobMetadata(
    kind: AuthLifecycleJobKindV1,
    requestId: string,
  ): Promise<AuthLifecycleJobAdminViewV1 | null> {
    if (!authLifecycleRequestIdMatchesKind(kind, requestId)) {
      throw new ApiHttpError(500, "AUTH_LIFECYCLE_QUERY_INVALID", "Auth lifecycle job request ID is invalid.");
    }
    const job = kind === "account_deletion"
      ? this.deletionJobs.get(requestId)
      : this.providerUnlinkJobs.get(requestId);
    return job ? authLifecycleJobMetadataV1(job) : null;
  }

  async recordAuthLifecycleDiscoveryAudit(input: AuthLifecycleDiscoveryAuditInputV1): Promise<void> {
    this.lifecycleDiscoveryAudits.push(makeAuthLifecycleDiscoveryAuditV1(
      input,
      this.now(),
      this.auditHmacKey(),
    ));
  }

  async listDueAccountDeletionJobIds(now: string, limit: number): Promise<readonly string[]> {
    const nowMs = authJobTime(now, "Account deletion listing time");
    assertAuthJobLimit(limit);
    return [...this.deletionJobs.values()]
      .filter((job) => job.status === "pending" && job.nextAttemptAt !== null
        && authJobTime(job.nextAttemptAt, "Account deletion next attempt") <= nowMs)
      .sort((left, right) => String(left.nextAttemptAt).localeCompare(String(right.nextAttemptAt))
        || left.requestedAt.localeCompare(right.requestedAt)
        || left.deletionRequestId.localeCompare(right.deletionRequestId))
      .slice(0, limit)
      .map((job) => job.deletionRequestId);
  }

  async claimAccountDeletionJob(input: {
    readonly deletionRequestId: string;
    readonly now: string;
    readonly leaseMs: number;
    readonly claimToken: string;
    readonly force: boolean;
  }): Promise<AuthLifecycleJobClaimResultV1<AccountDeletionJob>> {
    const job = await this.getAccountDeletionJob(input.deletionRequestId);
    if (!job) return { acquired: false };
    const claimed = claimAuthJobState({
      job,
      kind: "account_deletion",
      jobId: input.deletionRequestId,
      now: input.now,
      leaseMs: input.leaseMs,
      claimToken: input.claimToken,
      force: input.force,
    });
    if (!claimed) return { acquired: false };
    this.deletionJobs.set(input.deletionRequestId, claimed.job);
    return { acquired: true, claim: claimed.claim, job: claimed.job };
  }

  async releaseAuthLifecycleJobClaim(claim: AuthLifecycleJobClaimV1, retry: boolean): Promise<boolean> {
    const at = this.now();
    const map = claim.kind === "account_deletion" ? this.deletionJobs : this.providerUnlinkJobs;
    const job = map.get(claim.jobId) as AccountDeletionJob | ProviderUnlinkJobV1 | undefined;
    if (!job) return false;
    if (job.status === "completed") return true;
    try {
      assertAuthJobClaimOwned(job, claim.kind, claim.jobId, claim, at);
    } catch (error) {
      if (error instanceof ApiHttpError && error.code === "AUTH_JOB_CLAIM_LOST") return false;
      throw error;
    }
    const released = {
      ...job,
      updatedAt: at,
      ...(retry
        ? nextAuthJobRetryState(job, at)
        : { claimToken: null, claimUntil: null }),
    };
    if (claim.kind === "account_deletion") {
      this.deletionJobs.set(claim.jobId, released as AccountDeletionJob);
    } else {
      this.providerUnlinkJobs.set(claim.jobId, released as ProviderUnlinkJobV1);
    }
    return true;
  }

  async exportAccount(firebaseUid: string): Promise<AccountExportResponse> {
    const account = await this.getActiveByFirebaseUid(firebaseUid);
    assertAccountActive(account);
    return accountExport(account);
  }
}
