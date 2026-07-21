import type {
  AccountExportResponse,
  AccountStatus,
  AuthLifecycleJobAdminViewV1,
  AuthLifecycleJobStatusV1,
  AuthProvider,
  LinkedProviderSummary,
} from "../../shared/types/auth.js";
import type { AuthIdentityBindingDigestV2, VerifiedProviderIdentity } from "./auth-identity.js";

export interface StoredProviderBinding extends LinkedProviderSummary {
  subjectDigest: AuthIdentityBindingDigestV2;
}

export interface PendingProviderUnlinkV1 {
  unlinkRequestId: string;
  provider: Exclude<AuthProvider, "anonymous">;
  bindingDigest: string;
}

export interface AuthAccountRecord {
  internalUserId: string;
  status: AccountStatus;
  roles: readonly string[];
  providers: readonly StoredProviderBinding[];
  firebaseUids: readonly string[];
  createdAt: string;
  updatedAt: string;
  lastAuthenticatedAt: string;
  deletionRequestedAt: string | null;
  deletedAt: string | null;
  /** Null while live; deleted tombstones are minimized and removed by Firestore TTL. */
  deleteAfter: string | null;
  /** Durable account-level mutex for the cross-system provider unlink saga. */
  pendingProviderUnlink?: PendingProviderUnlinkV1 | null;
  version: 1;
}

export interface EnsureAccountInput {
  firebaseUid: string;
  identity: VerifiedProviderIdentity;
  allowAnonymousUpgrade: boolean;
}

export interface EnsureAccountResult {
  account: AuthAccountRecord;
  recoveredExistingAccount: boolean;
}

export const AUTH_JOB_INITIAL_BACKOFF_MS_V1 = 30_000;
export const AUTH_JOB_MAX_BACKOFF_MS_V1 = 6 * 60 * 60 * 1_000;
export const AUTH_JOB_MIN_CLAIM_MS_V1 = 30_000;
export const AUTH_JOB_MAX_CLAIM_MS_V1 = 5 * 60_000;

export type AuthLifecycleJobKindV1 = "account_deletion" | "provider_unlink";

export interface AuthLifecycleJobStateV1 {
  /** Pending jobs are queryable only when this root timestamp is due. */
  nextAttemptAt: string | null;
  /** Claim fields are all-null or all-valid. Claims are fenced and expiring. */
  claimUntil: string | null;
  claimToken: string | null;
  fence: number;
  /** Deterministic exponential retry delay; there is intentionally no jitter. */
  backoffMs: number;
}

export interface AuthLifecycleJobClaimV1 {
  readonly kind: AuthLifecycleJobKindV1;
  readonly jobId: string;
  readonly claimToken: string;
  readonly fence: number;
}

export type AuthLifecycleJobClaimResultV1<TJob> =
  | { readonly acquired: false }
  | { readonly acquired: true; readonly claim: AuthLifecycleJobClaimV1; readonly job: TJob };

export interface AccountDeletionJob extends AuthLifecycleJobStateV1 {
  deletionRequestId: string;
  internalUserId: string;
  firebaseUids: readonly string[];
  bindingDigests: readonly string[];
  /** Provider kinds are retained only while pending to gate provider-specific revocation. */
  providerKinds: readonly AuthProvider[];
  status: "pending" | "completed";
  requestedAt: string;
  updatedAt: string;
  attemptCount: number;
  lastErrorCodes: readonly string[];
  /** Null while pending; completed jobs are minimized and removed by Firestore TTL. */
  deleteAfter: string | null;
}

export interface BeginAccountDeletionResult {
  account: AuthAccountRecord;
  job: AccountDeletionJob;
}

export const PROVIDER_UNLINK_FAILURE_CODES_V1 = [
  "firebase/read_failed",
  "firebase/target_identity_mismatch",
  "firebase/recovery_provider_missing",
  "firebase/update_failed",
  "firebase/update_ambiguous",
  "firebase/refresh_revoke_failed",
] as const;

export type ProviderUnlinkFailureCodeV1 = (typeof PROVIDER_UNLINK_FAILURE_CODES_V1)[number];
export type ProviderUnlinkStageV1 = "reserved" | "firebase_unlinked" | "sessions_revoked" | "completed";

export interface ProviderUnlinkJobV1 extends AuthLifecycleJobStateV1 {
  unlinkRequestId: string;
  internalUserId: string;
  provider: Exclude<AuthProvider, "anonymous">;
  issuer: string;
  firebaseProviderId: string;
  /** One-way identity binding digest. The raw provider subject is never stored. */
  bindingDigest: string;
  /** Server-only Firebase principals; minimized immediately after completion. */
  firebaseUids: readonly string[];
  status: "pending" | "completed";
  stage: ProviderUnlinkStageV1;
  requestedAt: string;
  updatedAt: string;
  attemptCount: number;
  lastFailureCodes: readonly ProviderUnlinkFailureCodeV1[];
  /** Null while pending so TTL can never abandon an unresolved external mutation. */
  deleteAfter: string | null;
}

export interface AuthLifecycleJobListPositionV1 {
  readonly requestedAt: string;
  readonly requestId: string;
}

export interface AuthLifecycleJobMetadataQueryV1 {
  readonly kind?: AuthLifecycleJobKindV1;
  readonly status?: AuthLifecycleJobStatusV1;
  readonly snapshotAt: string;
  readonly after?: AuthLifecycleJobListPositionV1;
  readonly limit: number;
}

export interface AuthLifecycleJobMetadataPageV1 {
  readonly jobs: readonly AuthLifecycleJobAdminViewV1[];
  readonly nextPosition: AuthLifecycleJobListPositionV1 | null;
}

export interface AuthLifecycleDiscoveryAuditInputV1 {
  readonly actorUserId: string;
  readonly operation: "list" | "get";
  readonly kind?: AuthLifecycleJobKindV1;
  readonly status?: AuthLifecycleJobStatusV1;
  readonly requestId?: string;
  readonly resultCount: number;
}

export interface AuthLifecycleDiscoveryAuditRecordV1 {
  readonly schemaVersion: "namespring.auth-lifecycle-discovery-audit.v1";
  readonly operation: "list" | "get";
  readonly actorSubjectHash: `hmac-sha256:${string}`;
  readonly jobRequestHash?: `hmac-sha256:${string}`;
  readonly kindFilter: AuthLifecycleJobKindV1 | null;
  readonly statusFilter: AuthLifecycleJobStatusV1 | null;
  readonly resultCount: number;
  readonly occurredAt: string;
  readonly deleteAfter: string;
}

export interface BeginProviderUnlinkInputV1 {
  firebaseUid: string;
  identity: VerifiedProviderIdentity & { provider: Exclude<AuthProvider, "anonymous"> };
}

export interface BeginProviderUnlinkResultV1 {
  account: AuthAccountRecord;
  job: ProviderUnlinkJobV1;
}

export interface AuthAccountRepository {
  /** Uses the same server-only key as every durable binding in this repository. */
  providerIdentityBindingDigest(identity: VerifiedProviderIdentity): AuthIdentityBindingDigestV2;
  ensureAccount(input: EnsureAccountInput): Promise<EnsureAccountResult>;
  getActiveByFirebaseUid(firebaseUid: string): Promise<AuthAccountRecord | null>;
  linkIdentity(firebaseUid: string, identity: VerifiedProviderIdentity): Promise<AuthAccountRecord>;
  beginProviderUnlink(input: BeginProviderUnlinkInputV1): Promise<BeginProviderUnlinkResultV1>;
  markProviderUnlinkFirebaseApplied(
    internalUserId: string,
    unlinkRequestId: string,
    recordedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<ProviderUnlinkJobV1>;
  markProviderUnlinkSessionsRevoked(
    internalUserId: string,
    unlinkRequestId: string,
    recordedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<ProviderUnlinkJobV1>;
  completeProviderUnlink(
    internalUserId: string,
    unlinkRequestId: string,
    completedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<AuthAccountRecord>;
  recordProviderUnlinkFailure(
    internalUserId: string,
    unlinkRequestId: string,
    failureCodes: readonly ProviderUnlinkFailureCodeV1[],
    recordedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<boolean>;
  getProviderUnlinkJob(unlinkRequestId: string): Promise<ProviderUnlinkJobV1 | null>;
  listDueProviderUnlinkJobIds(now: string, limit: number): Promise<readonly string[]>;
  claimProviderUnlinkJob(input: {
    readonly unlinkRequestId: string;
    readonly now: string;
    readonly leaseMs: number;
    readonly claimToken: string;
    readonly force: boolean;
  }): Promise<AuthLifecycleJobClaimResultV1<ProviderUnlinkJobV1>>;
  beginAccountDeletion(firebaseUid: string): Promise<BeginAccountDeletionResult>;
  completeAccountDeletion(
    internalUserId: string,
    deletionRequestId: string,
    completedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<AuthAccountRecord>;
  recordAccountDeletionCleanupFailure(
    internalUserId: string,
    deletionRequestId: string,
    errorCodes: readonly string[],
    recordedByUserId?: string,
    claim?: AuthLifecycleJobClaimV1,
  ): Promise<boolean>;
  getAccountDeletionJob(deletionRequestId: string): Promise<AccountDeletionJob | null>;
  listAuthLifecycleJobMetadata(input: AuthLifecycleJobMetadataQueryV1): Promise<AuthLifecycleJobMetadataPageV1>;
  getAuthLifecycleJobMetadata(
    kind: AuthLifecycleJobKindV1,
    requestId: string,
  ): Promise<AuthLifecycleJobAdminViewV1 | null>;
  recordAuthLifecycleDiscoveryAudit(input: AuthLifecycleDiscoveryAuditInputV1): Promise<void>;
  listDueAccountDeletionJobIds(now: string, limit: number): Promise<readonly string[]>;
  claimAccountDeletionJob(input: {
    readonly deletionRequestId: string;
    readonly now: string;
    readonly leaseMs: number;
    readonly claimToken: string;
    readonly force: boolean;
  }): Promise<AuthLifecycleJobClaimResultV1<AccountDeletionJob>>;
  releaseAuthLifecycleJobClaim(claim: AuthLifecycleJobClaimV1, retry: boolean): Promise<boolean>;
  exportAccount(firebaseUid: string): Promise<AccountExportResponse>;
}
