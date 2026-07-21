import { randomUUID } from "node:crypto";
import { FieldPath, Timestamp, type Firestore, type Query, type Transaction } from "firebase-admin/firestore";
import {
  AUTH_PROVIDERS,
  type AccountExportResponse,
  type AuthLifecycleJobAdminViewV1,
} from "../../shared/types/auth.js";
import {
  accountDeletionFenceRefV1,
  accountPaymentLeaseRefV1,
  assertNoPaymentConfirmationLeaseV1,
  type AccountDeletionFenceRecordV1,
} from "./account-write-fence.js";
import {
  AUTH_AUDIT_RETENTION_DAYS_V1,
  AUTH_DELETION_JOB_RETENTION_DAYS_V1,
  authAuditSubjectHashV1,
  getAuthAuditHmacKeyV1,
  retentionDeadlineV1,
} from "./auth-audit-privacy.js";
import {
  type AccountDeletionJob,
  type AuthAccountRecord,
  type AuthAccountRepository,
  type AuthLifecycleDiscoveryAuditInputV1,
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
  COLLECTIONS,
  decodeAuthAccountRecordV1,
  decodeAccountDeletionJobV1,
  decodeBindingRecordV1,
  decodePrincipalRecordV1,
  decodeProviderUnlinkJobV1,
  encodeAuthAccountRecordV1,
  encodeAccountDeletionJobV1,
  encodeProviderUnlinkJobV1,
} from "./auth-accounts-firestore-codec.js";
import {
  accountExport,
  appendUnique,
  assertAccountActive,
  assertAuthJobClaimInput,
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
  type AuditType,
  type AuthAuditDetailsV1,
  type BindingRecord,
  type PrincipalRecord,
} from "./auth-accounts-lifecycle.js";
import { digestIdentityPart, getAuthIdentityBindingDigesterV2, type AuthIdentityBindingDigesterV2, type AuthIdentityBindingDigestV2, type VerifiedProviderIdentity } from "./auth-identity.js";
import { isPrimarySignInProvider } from "./auth-policy.js";
import { ApiHttpError } from "./http.js";
export class FirestoreAuthAccountRepository implements AuthAccountRepository {
  constructor(
    private readonly db: Firestore,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = () => randomUUID(),
    private readonly auditHmacKey: () => string = getAuthAuditHmacKeyV1,
    private readonly bindingDigester: AuthIdentityBindingDigesterV2 = getAuthIdentityBindingDigesterV2(),
  ) {}
  providerIdentityBindingDigest(identity: VerifiedProviderIdentity): AuthIdentityBindingDigestV2 { return this.bindingDigester(identity); }
  private accountRef(userId: string) {
    return this.db.collection(COLLECTIONS.accounts).doc(userId);
  }
  private principalRef(firebaseUid: string) {
    return this.db.collection(COLLECTIONS.principals).doc(digestIdentityPart(firebaseUid));
  }

  private bindingRef(bindingDigest: string) {
    return this.db.collection(COLLECTIONS.bindings).doc(bindingDigest);
  }

  private async listLifecycleMetadataForKind(
    kind: AuthLifecycleJobKindV1,
    input: AuthLifecycleJobMetadataQueryV1,
  ): Promise<readonly AuthLifecycleJobAdminViewV1[]> {
    const collection = kind === "account_deletion" ? COLLECTIONS.deletionJobs : COLLECTIONS.providerUnlinkJobs;
    let query: Query = this.db.collection(collection);
    if (input.status) query = query.where("status", "==", input.status);
    query = query
      .where("requestedAt", "<=", input.snapshotAt)
      .orderBy("requestedAt", "desc")
      .orderBy(FieldPath.documentId(), "desc");
    if (input.after) query = query.startAfter(input.after.requestedAt, input.after.requestId);
    const snapshot = await query.limit(input.limit + 1).get();
    return snapshot.docs.map((document) => authLifecycleJobMetadataV1(
      kind === "account_deletion"
        ? decodeAccountDeletionJobV1(document.data(), document.id)
        : decodeProviderUnlinkJobV1(document.data(), document.id),
    ));
  }

  private writeAudit(
    transaction: Transaction,
    type: AuditType,
    userId: string,
    at: string,
    details: AuthAuditDetailsV1 = {},
  ) {
    const hmacKey = this.auditHmacKey();
    transaction.create(this.db.collection(COLLECTIONS.audit).doc(this.newId()), {
      schemaVersion: "namespring.auth-audit.v1",
      type,
      subjectHash: authAuditSubjectHashV1(userId, hmacKey),
      occurredAt: at,
      deleteAfter: Timestamp.fromDate(new Date(retentionDeadlineV1(at, AUTH_AUDIT_RETENTION_DAYS_V1))),
      ...(details.provider ? { provider: details.provider } : {}),
      ...(details.unlinkRequestId ? { unlinkRequestId: details.unlinkRequestId } : {}),
      ...(details.deletionRequestId ? { deletionRequestId: details.deletionRequestId } : {}),
      ...(details.actorUserId ? { actorSubjectHash: authAuditSubjectHashV1(details.actorUserId, hmacKey) } : {}),
    });
  }

  async ensureAccount(input: EnsureAccountInput): Promise<EnsureAccountResult> {
    const at = this.now();
    const principalRef = this.principalRef(input.firebaseUid);
    const bindingDigest = this.providerIdentityBindingDigest(input.identity);
    const bindingRef = this.bindingRef(bindingDigest);

    return this.db.runTransaction(async (transaction) => {
      const [principalSnapshot, bindingSnapshot] = await Promise.all([
        transaction.get(principalRef),
        transaction.get(bindingRef),
      ]);
      const principal = principalSnapshot.exists
        ? decodePrincipalRecordV1(principalSnapshot.data(), input.firebaseUid)
        : null;
      const bound = bindingSnapshot.exists
        ? decodeBindingRecordV1(bindingSnapshot.data(), bindingDigest, input.identity)
        : null;
      if (principal && bound && principal.internalUserId !== bound.internalUserId) {
        throw new ApiHttpError(409, "IDENTITY_CONFLICT", "The provider identity belongs to another account.");
      }

      const internalUserId = principal?.internalUserId ?? bound?.internalUserId ?? this.newId();
      const accountRef = this.accountRef(internalUserId);
      const accountSnapshot = principal || bound ? await transaction.get(accountRef) : null;
      let account = accountSnapshot?.exists
        ? decodeAuthAccountRecordV1(accountSnapshot.data(), internalUserId)
        : null;
      let recoveredExistingAccount = false;

      if (!account && (principal || bound)) {
        throw new ApiHttpError(500, "AUTH_REPOSITORY_INTEGRITY_ERROR", "Authentication binding points to a missing account.");
      }

      if (!account) {
        account = {
          internalUserId,
          status: "active",
          roles: ["user"],
          providers: [bindingFor(input.identity, at, bindingDigest)],
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
        transaction.create(accountRef, encodeAuthAccountRecordV1(account));
        transaction.create(principalRef, { internalUserId, firebaseUid: input.firebaseUid, createdAt: at } satisfies PrincipalRecord);
        transaction.set(bindingRef, {
          internalUserId,
          provider: input.identity.provider,
          issuer: input.identity.issuer,
          subjectDigest: bindingDigest,
          createdAt: at,
        } satisfies BindingRecord);
        this.writeAudit(transaction, "account.created", internalUserId, at, { provider: input.identity.provider });
        return { account, recoveredExistingAccount: false };
      }

      assertAccountActive(account);
      assertNoProviderUnlinkPending(account);
      if (!principal && bound) {
        recoveredExistingAccount = true;
      }
      const hasBinding = account.providers.some((entry) => entry.subjectDigest === bindingDigest);
      if (!hasBinding) {
        const onlyAnonymous = account.providers.every((entry) => entry.provider === "anonymous");
        if (!(input.allowAnonymousUpgrade && onlyAnonymous && input.identity.provider !== "anonymous")) {
          throw new ApiHttpError(409, "EXPLICIT_LINK_REQUIRED", "Link this provider through the authenticated account-link endpoint.");
        }
        if (bound && bound.internalUserId !== internalUserId) {
          throw new ApiHttpError(409, "IDENTITY_CONFLICT", "The provider identity belongs to another account.");
        }
      }

      const updated: AuthAccountRecord = {
        ...account,
        firebaseUids: appendUnique(account.firebaseUids, input.firebaseUid),
        providers: hasBinding ? account.providers : [...account.providers, bindingFor(input.identity, at, bindingDigest)],
        updatedAt: at,
        lastAuthenticatedAt: at,
      };
      transaction.set(accountRef, encodeAuthAccountRecordV1(updated));
      transaction.set(principalRef, {
        internalUserId,
        firebaseUid: input.firebaseUid,
        createdAt: principal?.createdAt ?? at,
      } satisfies PrincipalRecord);
      if (!hasBinding) {
        transaction.create(bindingRef, {
          internalUserId,
          provider: input.identity.provider,
          issuer: input.identity.issuer,
          subjectDigest: bindingDigest,
          createdAt: at,
        } satisfies BindingRecord);
        this.writeAudit(transaction, "identity.linked", internalUserId, at, { provider: input.identity.provider });
      }
      if (recoveredExistingAccount) {
        this.writeAudit(transaction, "account.recovered", internalUserId, at, { provider: input.identity.provider });
      }
      return { account: updated, recoveredExistingAccount };
    });
  }

  async getActiveByFirebaseUid(firebaseUid: string): Promise<AuthAccountRecord | null> {
    const principalSnapshot = await this.principalRef(firebaseUid).get();
    if (!principalSnapshot.exists) return null;
    const principal = decodePrincipalRecordV1(principalSnapshot.data(), firebaseUid);
    const accountSnapshot = await this.accountRef(principal.internalUserId).get();
    if (!accountSnapshot.exists) throw new ApiHttpError(500, "AUTH_REPOSITORY_INTEGRITY_ERROR", "Authentication principal points to a missing account.");
    const account = decodeAuthAccountRecordV1(accountSnapshot.data(), principal.internalUserId);
    return account.status === "active" && !account.pendingProviderUnlink ? account : null;
  }

  async linkIdentity(firebaseUid: string, identity: VerifiedProviderIdentity): Promise<AuthAccountRecord> {
    const at = this.now();
    const principalRef = this.principalRef(firebaseUid);
    const bindingDigest = this.providerIdentityBindingDigest(identity);
    const bindingRef = this.bindingRef(bindingDigest);
    return this.db.runTransaction(async (transaction) => {
      const [principalSnapshot, bindingSnapshot] = await Promise.all([
        transaction.get(principalRef),
        transaction.get(bindingRef),
      ]);
      if (!principalSnapshot.exists) {
        throw new ApiHttpError(401, "ACCOUNT_NOT_FOUND", "No account is bound to this authenticated principal.");
      }
      const principal = decodePrincipalRecordV1(principalSnapshot.data(), firebaseUid);
      const accountRef = this.accountRef(principal.internalUserId);
      const accountSnapshot = await transaction.get(accountRef);
      const account = accountSnapshot.exists
        ? decodeAuthAccountRecordV1(accountSnapshot.data(), principal.internalUserId)
        : null;
      assertAccountActive(account);
      assertNoProviderUnlinkPending(account);
      const bound = bindingSnapshot.exists
        ? decodeBindingRecordV1(bindingSnapshot.data(), bindingDigest, identity)
        : null;
      if (bound && bound.internalUserId !== account.internalUserId) {
        throw new ApiHttpError(409, "IDENTITY_CONFLICT", "The provider identity belongs to another account.");
      }
      if (account.providers.some((entry) => entry.subjectDigest === bindingDigest)) return account;
      const updated: AuthAccountRecord = {
        ...account,
        providers: [...account.providers, bindingFor(identity, at, bindingDigest)],
        updatedAt: at,
      };
      transaction.set(accountRef, encodeAuthAccountRecordV1(updated));
      transaction.set(bindingRef, {
        internalUserId: account.internalUserId,
        provider: identity.provider,
        issuer: identity.issuer,
        subjectDigest: bindingDigest,
        createdAt: at,
      } satisfies BindingRecord);
      this.writeAudit(transaction, "identity.linked", account.internalUserId, at, { provider: identity.provider });
      return updated;
    });
  }

  async beginProviderUnlink(input: BeginProviderUnlinkInputV1): Promise<BeginProviderUnlinkResultV1> {
    const at = this.now();
    const principalRef = this.principalRef(input.firebaseUid);
    const bindingDigest = this.providerIdentityBindingDigest(input.identity);
    const bindingRef = this.bindingRef(bindingDigest);
    return this.db.runTransaction(async (transaction) => {
      const [principalSnapshot, bindingSnapshot] = await Promise.all([
        transaction.get(principalRef),
        transaction.get(bindingRef),
      ]);
      if (!principalSnapshot.exists) {
        throw new ApiHttpError(401, "ACCOUNT_NOT_FOUND", "No account is bound to this authenticated principal.");
      }
      const principal = decodePrincipalRecordV1(principalSnapshot.data(), input.firebaseUid);
      const accountRef = this.accountRef(principal.internalUserId);
      const accountSnapshot = await transaction.get(accountRef);
      const account = accountSnapshot.exists
        ? decodeAuthAccountRecordV1(accountSnapshot.data(), principal.internalUserId)
        : null;
      assertAccountActive(account);
      if (account.pendingProviderUnlink) {
        const pending = account.pendingProviderUnlink;
        const pendingSnapshot = await transaction.get(
          this.db.collection(COLLECTIONS.providerUnlinkJobs).doc(pending.unlinkRequestId),
        );
        const pendingJob = pendingSnapshot.exists
          ? decodeProviderUnlinkJobV1(pendingSnapshot.data(), pending.unlinkRequestId)
          : null;
        const pendingBinding = bindingSnapshot.exists
          ? decodeBindingRecordV1(bindingSnapshot.data(), bindingDigest, input.identity)
          : null;
        if (providerUnlinkReservationMatches(account, pendingJob, input.identity, bindingDigest)
          && pendingBinding?.internalUserId === account.internalUserId) {
          return { account, job: pendingJob };
        }
        assertNoProviderUnlinkPending(account);
      }
      const target = account.providers.find((entry) => entry.subjectDigest === bindingDigest
        && entry.provider === input.identity.provider);
      const storedBinding = bindingSnapshot.exists
        ? decodeBindingRecordV1(bindingSnapshot.data(), bindingDigest, input.identity)
        : null;
      if (!target || !storedBinding || storedBinding.internalUserId !== account.internalUserId) {
        throw new ApiHttpError(409, "PROVIDER_BINDING_NOT_FOUND", "The exact verified provider binding is not linked.");
      }
      const remaining = account.providers.filter((entry) => entry.subjectDigest !== bindingDigest);
      if (!remaining.some((entry) => isPrimarySignInProvider(entry.provider))) {
        throw new ApiHttpError(409, "LAST_SIGN_IN_METHOD", "Link another sign-in method before unlinking this provider.");
      }
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
      transaction.set(accountRef, encodeAuthAccountRecordV1(updated));
      transaction.create(
        this.db.collection(COLLECTIONS.providerUnlinkJobs).doc(unlinkRequestId),
        encodeProviderUnlinkJobV1(job),
      );
      this.writeAudit(transaction, "identity.unlink_reserved", account.internalUserId, at, {
        provider: input.identity.provider,
        unlinkRequestId,
      });
      return { account: updated, job };
    });
  }

  async markProviderUnlinkFirebaseApplied(
    internalUserId: string,
    unlinkRequestId: string,
    recordedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<ProviderUnlinkJobV1> {
    const at = this.now();
    const jobRef = this.db.collection(COLLECTIONS.providerUnlinkJobs).doc(unlinkRequestId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(jobRef);
      const job = snapshot.exists ? decodeProviderUnlinkJobV1(snapshot.data(), unlinkRequestId) : null;
      if (!job || job.internalUserId !== internalUserId) {
        throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink job is inconsistent.");
      }
      if (job.status === "completed" || job.stage !== "reserved") return job;
      assertAuthJobClaimOwned(job, "provider_unlink", unlinkRequestId, claim, at);
      const updated: ProviderUnlinkJobV1 = {
        ...job,
        stage: "firebase_unlinked",
        updatedAt: at,
        lastFailureCodes: [],
      };
      transaction.set(jobRef, encodeProviderUnlinkJobV1(updated));
      this.writeAudit(transaction, "identity.unlink_external_applied", internalUserId, at, {
        provider: job.provider,
        unlinkRequestId,
        actorUserId: recordedByUserId ?? internalUserId,
      });
      return updated;
    });
  }

  async markProviderUnlinkSessionsRevoked(
    internalUserId: string,
    unlinkRequestId: string,
    _recordedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<ProviderUnlinkJobV1> {
    const at = this.now();
    const jobRef = this.db.collection(COLLECTIONS.providerUnlinkJobs).doc(unlinkRequestId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(jobRef);
      const job = snapshot.exists ? decodeProviderUnlinkJobV1(snapshot.data(), unlinkRequestId) : null;
      if (!job || job.internalUserId !== internalUserId) {
        throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink job is inconsistent.");
      }
      if (job.status === "completed" || job.stage === "sessions_revoked") return job;
      if (job.stage !== "firebase_unlinked") {
        throw new ApiHttpError(409, "PROVIDER_UNLINK_EXTERNAL_PENDING", "Firebase provider removal is not confirmed.");
      }
      assertAuthJobClaimOwned(job, "provider_unlink", unlinkRequestId, claim, at);
      const updated: ProviderUnlinkJobV1 = {
        ...job,
        stage: "sessions_revoked",
        updatedAt: at,
        lastFailureCodes: [],
      };
      transaction.set(jobRef, encodeProviderUnlinkJobV1(updated));
      return updated;
    });
  }

  async completeProviderUnlink(
    internalUserId: string,
    unlinkRequestId: string,
    completedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<AuthAccountRecord> {
    const at = this.now();
    const accountRef = this.accountRef(internalUserId);
    const jobRef = this.db.collection(COLLECTIONS.providerUnlinkJobs).doc(unlinkRequestId);
    return this.db.runTransaction(async (transaction) => {
      const [accountSnapshot, jobSnapshot] = await Promise.all([
        transaction.get(accountRef),
        transaction.get(jobRef),
      ]);
      const account = accountSnapshot.exists
        ? decodeAuthAccountRecordV1(accountSnapshot.data(), internalUserId)
        : null;
      const job = jobSnapshot.exists ? decodeProviderUnlinkJobV1(jobSnapshot.data(), unlinkRequestId) : null;
      if (!account || !job || job.internalUserId !== internalUserId) {
        throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink job is inconsistent.");
      }
      if (job.status === "completed") return account;
      assertAuthJobClaimOwned(job, "provider_unlink", unlinkRequestId, claim, at);
      if (job.stage !== "sessions_revoked"
        || account.pendingProviderUnlink?.unlinkRequestId !== unlinkRequestId
        || account.pendingProviderUnlink.bindingDigest !== job.bindingDigest) {
        throw new ApiHttpError(409, "PROVIDER_UNLINK_NOT_READY", "Provider unlink reconciliation is not complete.");
      }
      const bindingSnapshot = await transaction.get(this.bindingRef(job.bindingDigest));
      const binding = bindingSnapshot.exists
        ? decodeBindingRecordV1(bindingSnapshot.data(), job.bindingDigest, job)
        : null;
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
      transaction.set(accountRef, encodeAuthAccountRecordV1(updated));
      if (bindingSnapshot.exists) transaction.delete(this.bindingRef(job.bindingDigest));
      transaction.set(jobRef, encodeProviderUnlinkJobV1({
        ...job,
        bindingDigest: "",
        firebaseUids: [],
        status: "completed",
        stage: "completed",
        updatedAt: at,
        lastFailureCodes: [],
        ...completedAuthJobState(),
        deleteAfter: retentionDeadlineV1(at, AUTH_DELETION_JOB_RETENTION_DAYS_V1),
      }));
      this.writeAudit(transaction, "identity.unlinked", internalUserId, at, {
        provider: job.provider,
        unlinkRequestId,
        actorUserId: completedByUserId ?? internalUserId,
      });
      return updated;
    });
  }

  async recordProviderUnlinkFailure(
    internalUserId: string,
    unlinkRequestId: string,
    failureCodes: readonly ProviderUnlinkFailureCodeV1[],
    recordedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<boolean> {
    const at = this.now();
    const jobRef = this.db.collection(COLLECTIONS.providerUnlinkJobs).doc(unlinkRequestId);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(jobRef);
      const job = snapshot.exists ? decodeProviderUnlinkJobV1(snapshot.data(), unlinkRequestId) : null;
      if (!job || job.internalUserId !== internalUserId) {
        throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink job is inconsistent.");
      }
      if (job.status === "completed") return true;
      assertAuthJobClaimOwned(job, "provider_unlink", unlinkRequestId, claim, at);
      transaction.set(jobRef, encodeProviderUnlinkJobV1({
        ...job,
        updatedAt: at,
        ...nextAuthJobRetryState(job, at),
        lastFailureCodes: sanitizeProviderUnlinkFailureCodes(failureCodes),
      }));
      this.writeAudit(transaction, "identity.unlink_failed", internalUserId, at, {
        provider: job.provider,
        unlinkRequestId,
        actorUserId: recordedByUserId ?? internalUserId,
      });
      return true;
    });
    return true;
  }

  async getProviderUnlinkJob(unlinkRequestId: string): Promise<ProviderUnlinkJobV1 | null> {
    const snapshot = await this.db.collection(COLLECTIONS.providerUnlinkJobs).doc(unlinkRequestId).get();
    if (!snapshot.exists) return null;
    const job = decodeProviderUnlinkJobV1(snapshot.data(), unlinkRequestId);
    if (job.status === "pending") {
      const [accountSnapshot, bindingSnapshot] = await Promise.all([
        this.accountRef(job.internalUserId).get(),
        this.bindingRef(job.bindingDigest).get(),
      ]);
      assertPendingProviderUnlinkIntegrity(
        accountSnapshot.exists ? decodeAuthAccountRecordV1(accountSnapshot.data(), job.internalUserId) : null,
        job,
        bindingSnapshot.exists ? decodeBindingRecordV1(bindingSnapshot.data(), job.bindingDigest, job) : null,
      );
    }
    return job;
  }

  async listDueProviderUnlinkJobIds(now: string, limit: number): Promise<readonly string[]> {
    const at = authJobTime(now, "Provider unlink listing time");
    assertAuthJobLimit(limit);
    const snapshot = await this.db.collection(COLLECTIONS.providerUnlinkJobs)
      .where("status", "==", "pending")
      .where("nextAttemptAt", "<=", Timestamp.fromMillis(at))
      .orderBy("nextAttemptAt", "asc")
      .limit(limit)
      .get();
    return snapshot.docs.map((document) => document.id);
  }

  async claimProviderUnlinkJob(input: {
    readonly unlinkRequestId: string;
    readonly now: string;
    readonly leaseMs: number;
    readonly claimToken: string;
    readonly force: boolean;
  }): Promise<AuthLifecycleJobClaimResultV1<ProviderUnlinkJobV1>> {
    assertAuthJobClaimInput(input.now, input.leaseMs, input.claimToken);
    const ref = this.db.collection(COLLECTIONS.providerUnlinkJobs).doc(input.unlinkRequestId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return { acquired: false } as const;
      const job = decodeProviderUnlinkJobV1(snapshot.data(), input.unlinkRequestId);
      const claimed = claimAuthJobState({
        job,
        kind: "provider_unlink",
        jobId: input.unlinkRequestId,
        now: input.now,
        leaseMs: input.leaseMs,
        claimToken: input.claimToken,
        force: input.force,
      });
      if (!claimed) return { acquired: false } as const;
      transaction.set(ref, encodeProviderUnlinkJobV1(claimed.job));
      return { acquired: true, claim: claimed.claim, job: claimed.job } as const;
    });
  }

  async beginAccountDeletion(firebaseUid: string): Promise<BeginAccountDeletionResult> {
    const at = this.now();
    const principalRef = this.principalRef(firebaseUid);
    return this.db.runTransaction(async (transaction) => {
      const principalSnapshot = await transaction.get(principalRef);
      if (!principalSnapshot.exists) {
        throw new ApiHttpError(401, "ACCOUNT_NOT_FOUND", "No account is bound to this authenticated principal.");
      }
      const principal = decodePrincipalRecordV1(principalSnapshot.data(), firebaseUid);
      const accountRef = this.accountRef(principal.internalUserId);
      const accountSnapshot = await transaction.get(accountRef);
      const account = accountSnapshot.exists
        ? decodeAuthAccountRecordV1(accountSnapshot.data(), principal.internalUserId)
        : null;
      assertAccountActive(account);
      assertNoProviderUnlinkPending(account);
      const paymentLeaseSnapshot = await transaction.get(
        accountPaymentLeaseRefV1(this.db, account.internalUserId),
      );
      assertNoPaymentConfirmationLeaseV1(paymentLeaseSnapshot);
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
      transaction.set(accountRef, encodeAuthAccountRecordV1(pending));
      transaction.create(accountDeletionFenceRefV1(this.db, account.internalUserId), {
        schemaVersion: "namespring.account-deletion-fence.v1",
        createdAt: at,
        deletionRequestId: job.deletionRequestId,
      } satisfies AccountDeletionFenceRecordV1);
      transaction.create(
        this.db.collection(COLLECTIONS.deletionJobs).doc(job.deletionRequestId),
        encodeAccountDeletionJobV1(job),
      );
      this.writeAudit(transaction, "account.deletion_requested", account.internalUserId, at, {
        deletionRequestId: job.deletionRequestId,
      });
      return { account: pending, job };
    });
  }

  async completeAccountDeletion(
    internalUserId: string,
    deletionRequestId: string,
    completedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<AuthAccountRecord> {
    const at = this.now();
    const accountRef = this.accountRef(internalUserId);
    const jobRef = this.db.collection(COLLECTIONS.deletionJobs).doc(deletionRequestId);
    return this.db.runTransaction(async (transaction) => {
      const [accountSnapshot, jobSnapshot] = await Promise.all([
        transaction.get(accountRef),
        transaction.get(jobRef),
      ]);
      const account = accountSnapshot.exists
        ? decodeAuthAccountRecordV1(accountSnapshot.data(), internalUserId)
        : null;
      const job = jobSnapshot.exists
        ? decodeAccountDeletionJobV1(jobSnapshot.data(), deletionRequestId)
        : null;
      if (!account || !job || job.internalUserId !== internalUserId) {
        throw new ApiHttpError(500, "DELETION_JOB_INTEGRITY_ERROR", "Account deletion job is inconsistent.");
      }
      if (account.status === "deleted" && job.status === "completed") return account;
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
      transaction.set(accountRef, encodeAuthAccountRecordV1(deleted));
      for (const uid of job.firebaseUids) transaction.delete(this.principalRef(uid));
      for (const bindingDigest of job.bindingDigests) transaction.delete(this.bindingRef(bindingDigest));
      transaction.set(jobRef, encodeAccountDeletionJobV1({
        ...job,
        firebaseUids: [],
        bindingDigests: [],
        providerKinds: [],
        status: "completed",
        updatedAt: at,
        lastErrorCodes: [],
        ...completedAuthJobState(),
        deleteAfter: retentionDeadlineV1(at, AUTH_DELETION_JOB_RETENTION_DAYS_V1),
      }));
      this.writeAudit(transaction, "account.deleted", internalUserId, at, {
        deletionRequestId,
        actorUserId: completedByUserId ?? internalUserId,
      });
      return deleted;
    });
  }

  async recordAccountDeletionCleanupFailure(
    internalUserId: string,
    deletionRequestId: string,
    errorCodes: readonly string[],
    recordedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<boolean> {
    const at = this.now();
    const jobRef = this.db.collection(COLLECTIONS.deletionJobs).doc(deletionRequestId);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(jobRef);
      const job = snapshot.exists
        ? decodeAccountDeletionJobV1(snapshot.data(), deletionRequestId)
        : null;
      if (!job || job.internalUserId !== internalUserId) {
        throw new ApiHttpError(500, "DELETION_JOB_INTEGRITY_ERROR", "Account deletion job is inconsistent.");
      }
      if (job.status === "completed") return true;
      assertAuthJobClaimOwned(job, "account_deletion", deletionRequestId, claim, at);
      transaction.set(jobRef, encodeAccountDeletionJobV1({
        ...job,
        updatedAt: at,
        ...nextAuthJobRetryState(job, at),
        lastErrorCodes: sanitizeDeletionFailureCodes(errorCodes),
      }));
      this.writeAudit(transaction, "account.deletion_cleanup_failed", internalUserId, at, {
        deletionRequestId,
        actorUserId: recordedByUserId ?? internalUserId,
      });
      return true;
    });
    return true;
  }

  async getAccountDeletionJob(deletionRequestId: string): Promise<AccountDeletionJob | null> {
    const snapshot = await this.db.collection(COLLECTIONS.deletionJobs).doc(deletionRequestId).get();
    return snapshot.exists ? decodeAccountDeletionJobV1(snapshot.data(), deletionRequestId) : null;
  }

  async listAuthLifecycleJobMetadata(
    input: AuthLifecycleJobMetadataQueryV1,
  ): Promise<AuthLifecycleJobMetadataPageV1> {
    assertAuthLifecycleMetadataQueryV1(input);
    const kinds: readonly AuthLifecycleJobKindV1[] = input.kind
      ? [input.kind]
      : ["account_deletion", "provider_unlink"];
    const pages = await Promise.all(kinds.map((kind) => this.listLifecycleMetadataForKind(kind, input)));
    const candidates = pages.flat().sort(compareAuthLifecycleMetadataV1);
    const jobs = candidates.slice(0, input.limit);
    const last = jobs.at(-1);
    return {
      jobs,
      nextPosition: candidates.length > input.limit && last
        ? { requestedAt: last.requestedAt, requestId: last.requestId }
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
      ? await this.getAccountDeletionJob(requestId)
      : await this.getProviderUnlinkJob(requestId);
    return job ? authLifecycleJobMetadataV1(job) : null;
  }

  async recordAuthLifecycleDiscoveryAudit(input: AuthLifecycleDiscoveryAuditInputV1): Promise<void> {
    const record = makeAuthLifecycleDiscoveryAuditV1(input, this.now(), this.auditHmacKey());
    const { deleteAfter, ...stored } = record;
    await this.db.collection(COLLECTIONS.audit).doc(this.newId()).create({
      ...stored,
      deleteAfter: Timestamp.fromDate(new Date(deleteAfter)),
    });
  }

  async listDueAccountDeletionJobIds(now: string, limit: number): Promise<readonly string[]> {
    const at = authJobTime(now, "Account deletion listing time");
    assertAuthJobLimit(limit);
    const snapshot = await this.db.collection(COLLECTIONS.deletionJobs)
      .where("status", "==", "pending")
      .where("nextAttemptAt", "<=", Timestamp.fromMillis(at))
      .orderBy("nextAttemptAt", "asc")
      .limit(limit)
      .get();
    return snapshot.docs.map((document) => document.id);
  }

  async claimAccountDeletionJob(input: {
    readonly deletionRequestId: string;
    readonly now: string;
    readonly leaseMs: number;
    readonly claimToken: string;
    readonly force: boolean;
  }): Promise<AuthLifecycleJobClaimResultV1<AccountDeletionJob>> {
    assertAuthJobClaimInput(input.now, input.leaseMs, input.claimToken);
    const ref = this.db.collection(COLLECTIONS.deletionJobs).doc(input.deletionRequestId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return { acquired: false } as const;
      const job = decodeAccountDeletionJobV1(snapshot.data(), input.deletionRequestId);
      const claimed = claimAuthJobState({
        job,
        kind: "account_deletion",
        jobId: input.deletionRequestId,
        now: input.now,
        leaseMs: input.leaseMs,
        claimToken: input.claimToken,
        force: input.force,
      });
      if (!claimed) return { acquired: false } as const;
      transaction.set(ref, encodeAccountDeletionJobV1(claimed.job));
      return { acquired: true, claim: claimed.claim, job: claimed.job } as const;
    });
  }

  async releaseAuthLifecycleJobClaim(claim: AuthLifecycleJobClaimV1, retry: boolean): Promise<boolean> {
    const at = this.now();
    const ref = this.db.collection(
      claim.kind === "account_deletion" ? COLLECTIONS.deletionJobs : COLLECTIONS.providerUnlinkJobs,
    ).doc(claim.jobId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return false;
      const job = claim.kind === "account_deletion"
        ? decodeAccountDeletionJobV1(snapshot.data(), claim.jobId)
        : decodeProviderUnlinkJobV1(snapshot.data(), claim.jobId);
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
        transaction.set(ref, encodeAccountDeletionJobV1(released as AccountDeletionJob));
      } else {
        transaction.set(ref, encodeProviderUnlinkJobV1(released as ProviderUnlinkJobV1));
      }
      return true;
    });
  }

  async exportAccount(firebaseUid: string): Promise<AccountExportResponse> {
    const account = await this.getActiveByFirebaseUid(firebaseUid);
    assertAccountActive(account);
    return accountExport(account);
  }
}
