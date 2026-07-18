import { createHash } from "node:crypto";
import type {
  AccountExportResponse,
  AuthLifecycleJobAdminViewV1,
  AuthProvider,
  LinkedProviderSummary,
} from "../../shared/types/auth.js";
import {
  AUTH_AUDIT_RETENTION_DAYS_V1,
  authAuditOpaqueValueHashV1,
  authAuditSubjectHashV1,
  retentionDeadlineV1,
} from "./auth-audit-privacy.js";
import {
  AUTH_JOB_INITIAL_BACKOFF_MS_V1,
  AUTH_JOB_MAX_BACKOFF_MS_V1,
  AUTH_JOB_MAX_CLAIM_MS_V1,
  AUTH_JOB_MIN_CLAIM_MS_V1,
  PROVIDER_UNLINK_FAILURE_CODES_V1,
  type AccountDeletionJob,
  type AuthAccountRecord,
  type AuthLifecycleDiscoveryAuditInputV1,
  type AuthLifecycleDiscoveryAuditRecordV1,
  type AuthLifecycleJobClaimV1,
  type AuthLifecycleJobKindV1,
  type AuthLifecycleJobMetadataQueryV1,
  type AuthLifecycleJobStateV1,
  type BeginProviderUnlinkInputV1,
  type ProviderUnlinkFailureCodeV1,
  type ProviderUnlinkJobV1,
  type StoredProviderBinding,
} from "./auth-accounts-contract.js";
import type { AuthIdentityBindingDigestV2, VerifiedProviderIdentity } from "./auth-identity.js";
import { ApiHttpError } from "./http.js";

export interface PrincipalRecord {
  internalUserId: string;
  firebaseUid: string;
  createdAt: string;
}

export interface BindingRecord {
  internalUserId: string;
  provider: AuthProvider;
  issuer: string;
  subjectDigest: AuthIdentityBindingDigestV2;
  createdAt: string;
}

export type AuditType =
  | "account.created"
  | "account.recovered"
  | "identity.linked"
  | "identity.unlink_reserved"
  | "identity.unlink_external_applied"
  | "identity.unlink_failed"
  | "identity.unlinked"
  | "account.deletion_requested"
  | "account.deletion_cleanup_failed"
  | "account.deleted";

export interface AuthAuditDetailsV1 {
  readonly provider?: AuthProvider;
  readonly unlinkRequestId?: string;
  readonly deletionRequestId?: string;
  readonly actorUserId?: string;
}

export function publicProviders(account: AuthAccountRecord): LinkedProviderSummary[] {
  return account.providers.map(({ provider, issuer, linkedAt }) => ({ provider, issuer, linkedAt }));
}

export function toPublicProviderSummaries(account: AuthAccountRecord): LinkedProviderSummary[] {
  return publicProviders(account);
}

export function assertAccountActive(account: AuthAccountRecord | null | undefined): asserts account is AuthAccountRecord {
  if (!account) {
    throw new ApiHttpError(401, "ACCOUNT_NOT_FOUND", "No account is bound to this authenticated principal.");
  }
  if (account.status !== "active") {
    throw new ApiHttpError(403, "ACCOUNT_INACTIVE", "The account is not active.");
  }
}

export function appendUnique<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? [...values] : [...values, value];
}

export function deletionRequestId(entropy: string): string {
  return `deletion_request_v1_${createHash("sha256").update(entropy, "utf8").digest("hex").slice(0, 32)}`;
}

export function providerUnlinkRequestId(entropy: string): string {
  return `provider_unlink_v1_${createHash("sha256").update(entropy, "utf8").digest("hex").slice(0, 32)}`;
}

export const AUTH_JOB_CLAIM_TOKEN_PATTERN_V1 = /^ajc_[A-Za-z0-9_-]{32}$/u;
export const MAX_AUTH_JOB_ATTEMPTS_V1 = 10_000;

export function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

export function authJobTime(value: string, field: string): number {
  if (!isCanonicalIsoTimestamp(value)) {
    throw new ApiHttpError(500, "AUTH_JOB_TIME_INVALID", `${field} is invalid.`);
  }
  return new Date(value).getTime();
}

export function assertAuthJobLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
    throw new ApiHttpError(500, "AUTH_JOB_LIMIT_INVALID", "Auth lifecycle job limit is invalid.");
  }
}

export function assertAuthJobClaimInput(now: string, leaseMs: number, claimToken: string): number {
  const nowMs = authJobTime(now, "Auth lifecycle claim time");
  if (!Number.isSafeInteger(leaseMs) || leaseMs < AUTH_JOB_MIN_CLAIM_MS_V1 || leaseMs > AUTH_JOB_MAX_CLAIM_MS_V1) {
    throw new ApiHttpError(500, "AUTH_JOB_LEASE_INVALID", "Auth lifecycle claim lease is invalid.");
  }
  if (!AUTH_JOB_CLAIM_TOKEN_PATTERN_V1.test(claimToken)) {
    throw new ApiHttpError(500, "AUTH_JOB_CLAIM_TOKEN_INVALID", "Auth lifecycle claim token is invalid.");
  }
  return nowMs;
}

export function authJobBackoffMsForAttemptV1(attemptCount: number): number {
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 0 || attemptCount > MAX_AUTH_JOB_ATTEMPTS_V1) {
    throw new ApiHttpError(500, "AUTH_JOB_ATTEMPT_INVALID", "Auth lifecycle attempt count is invalid.");
  }
  if (attemptCount === 0) return 0;
  const exponent = Math.min(attemptCount - 1, 30);
  return Math.min(AUTH_JOB_MAX_BACKOFF_MS_V1, AUTH_JOB_INITIAL_BACKOFF_MS_V1 * (2 ** exponent));
}

export function nextAuthJobRetryState<T extends AuthLifecycleJobStateV1 & { attemptCount: number }>(
  job: T,
  at: string,
): Pick<AuthLifecycleJobStateV1, "nextAttemptAt" | "claimUntil" | "claimToken" | "backoffMs"> & {
  readonly attemptCount: number;
} {
  const attemptCount = Math.min(MAX_AUTH_JOB_ATTEMPTS_V1, job.attemptCount + 1);
  const backoffMs = authJobBackoffMsForAttemptV1(attemptCount);
  return {
    attemptCount,
    backoffMs,
    nextAttemptAt: new Date(authJobTime(at, "Auth lifecycle retry time") + backoffMs).toISOString(),
    claimUntil: null,
    claimToken: null,
  };
}

export function completedAuthJobState(): Pick<
  AuthLifecycleJobStateV1,
  "nextAttemptAt" | "claimUntil" | "claimToken" | "backoffMs"
> {
  return { nextAttemptAt: null, claimUntil: null, claimToken: null, backoffMs: 0 };
}

export function assertAuthJobClaimOwned(
  job: AuthLifecycleJobStateV1,
  expectedKind: AuthLifecycleJobKindV1,
  expectedJobId: string,
  claim: AuthLifecycleJobClaimV1 | undefined,
  at: string,
): void {
  const storedClaimExists = job.claimToken !== null || job.claimUntil !== null;
  if (!storedClaimExists && claim === undefined) return;
  if (!claim
    || claim.kind !== expectedKind
    || claim.jobId !== expectedJobId
    || claim.claimToken !== job.claimToken
    || claim.fence !== job.fence
    || job.claimUntil === null
    || authJobTime(job.claimUntil, "Auth lifecycle claim expiry") <= authJobTime(at, "Auth lifecycle mutation time")) {
    throw new ApiHttpError(409, "AUTH_JOB_CLAIM_LOST", "Auth lifecycle job ownership has expired or changed.");
  }
}

export function claimAuthJobState<T extends AuthLifecycleJobStateV1 & {
  status: "pending" | "completed";
  updatedAt: string;
}>(input: {
  readonly job: T;
  readonly kind: AuthLifecycleJobKindV1;
  readonly jobId: string;
  readonly now: string;
  readonly leaseMs: number;
  readonly claimToken: string;
  readonly force: boolean;
}): { readonly job: T; readonly claim: AuthLifecycleJobClaimV1 } | null {
  const nowMs = assertAuthJobClaimInput(input.now, input.leaseMs, input.claimToken);
  if (input.job.status === "completed") return null;
  const activeClaim = input.job.claimToken !== null
    && input.job.claimUntil !== null
    && authJobTime(input.job.claimUntil, "Auth lifecycle claim expiry") > nowMs;
  if (activeClaim) return null;
  if (!input.force && (input.job.nextAttemptAt === null
    || authJobTime(input.job.nextAttemptAt, "Auth lifecycle next attempt") > nowMs)) return null;
  if (!Number.isSafeInteger(input.job.fence) || input.job.fence < 0 || input.job.fence >= Number.MAX_SAFE_INTEGER) {
    throw new ApiHttpError(500, "AUTH_JOB_FENCE_INVALID", "Auth lifecycle fencing metadata is invalid.");
  }
  const fence = input.job.fence + 1;
  const claim: AuthLifecycleJobClaimV1 = {
    kind: input.kind,
    jobId: input.jobId,
    claimToken: input.claimToken,
    fence,
  };
  return {
    claim,
    job: {
      ...input.job,
      updatedAt: input.now,
      claimToken: input.claimToken,
      claimUntil: new Date(nowMs + input.leaseMs).toISOString(),
      fence,
    },
  };
}

export function assertNoProviderUnlinkPending(account: AuthAccountRecord): void {
  if (account.pendingProviderUnlink) {
    throw new ApiHttpError(
      409,
      "PROVIDER_UNLINK_IN_PROGRESS",
      "A provider unlink is pending reconciliation. Retry it through the support workflow before another account mutation.",
    );
  }
}

export function sanitizeProviderUnlinkFailureCodes(
  values: readonly ProviderUnlinkFailureCodeV1[],
): ProviderUnlinkFailureCodeV1[] {
  const allowed = new Set<string>(PROVIDER_UNLINK_FAILURE_CODES_V1);
  return [...new Set(values.filter((value) => allowed.has(value)))].slice(0, 10);
}

export function sanitizeDeletionFailureCodes(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => (
    typeof value === "string" && /^[A-Za-z0-9_/-]{1,80}$/u.test(value)
  )))].slice(0, 20);
}

export const DELETION_REQUEST_ID_PATTERN_V1 = /^deletion_request_v1_[a-f0-9]{32}$/u;
export const UNLINK_REQUEST_ID_PATTERN_V1 = /^provider_unlink_v1_[a-f0-9]{32}$/u;

export function authLifecycleRequestIdMatchesKind(kind: AuthLifecycleJobKindV1, requestId: string): boolean {
  return kind === "account_deletion"
    ? DELETION_REQUEST_ID_PATTERN_V1.test(requestId)
    : UNLINK_REQUEST_ID_PATTERN_V1.test(requestId);
}

export function authLifecycleJobMetadataV1(
  job: AccountDeletionJob | ProviderUnlinkJobV1,
): AuthLifecycleJobAdminViewV1 {
  if ("deletionRequestId" in job) {
    return {
      requestId: job.deletionRequestId,
      kind: "account_deletion",
      status: job.status,
      stage: job.status === "completed" ? "completed" : "cleanup_pending",
      attemptCount: job.attemptCount,
      requestedAt: job.requestedAt,
      updatedAt: job.updatedAt,
      nextAttemptAt: job.nextAttemptAt,
      claimUntil: job.claimUntil,
      deleteAfter: job.deleteAfter,
      failureCodes: sanitizeDeletionFailureCodes(job.lastErrorCodes),
    };
  }
  return {
    requestId: job.unlinkRequestId,
    kind: "provider_unlink",
    status: job.status,
    stage: job.stage,
    attemptCount: job.attemptCount,
    requestedAt: job.requestedAt,
    updatedAt: job.updatedAt,
    nextAttemptAt: job.nextAttemptAt,
    claimUntil: job.claimUntil,
    deleteAfter: job.deleteAfter,
    failureCodes: sanitizeProviderUnlinkFailureCodes(job.lastFailureCodes),
  };
}

export function compareAuthLifecycleMetadataV1(
  left: Pick<AuthLifecycleJobAdminViewV1, "requestedAt" | "requestId">,
  right: Pick<AuthLifecycleJobAdminViewV1, "requestedAt" | "requestId">,
): number {
  return right.requestedAt.localeCompare(left.requestedAt) || right.requestId.localeCompare(left.requestId);
}

export function assertAuthLifecycleMetadataQueryV1(input: AuthLifecycleJobMetadataQueryV1): void {
  assertAuthJobLimit(input.limit);
  const snapshotAtMs = authJobTime(input.snapshotAt, "Auth lifecycle discovery snapshot");
  if (input.kind !== undefined && input.kind !== "account_deletion" && input.kind !== "provider_unlink") {
    throw new ApiHttpError(500, "AUTH_LIFECYCLE_QUERY_INVALID", "Auth lifecycle job kind is invalid.");
  }
  if (input.status !== undefined && input.status !== "pending" && input.status !== "completed") {
    throw new ApiHttpError(500, "AUTH_LIFECYCLE_QUERY_INVALID", "Auth lifecycle job status is invalid.");
  }
  if (input.after) {
    const afterMs = authJobTime(input.after.requestedAt, "Auth lifecycle discovery cursor time");
    if (afterMs > snapshotAtMs
      || (!DELETION_REQUEST_ID_PATTERN_V1.test(input.after.requestId)
        && !UNLINK_REQUEST_ID_PATTERN_V1.test(input.after.requestId))) {
      throw new ApiHttpError(500, "AUTH_LIFECYCLE_QUERY_INVALID", "Auth lifecycle cursor position is invalid.");
    }
  }
}

export function makeAuthLifecycleDiscoveryAuditV1(
  input: AuthLifecycleDiscoveryAuditInputV1,
  occurredAt: string,
  hmacKey: string,
): AuthLifecycleDiscoveryAuditRecordV1 {
  authJobTime(occurredAt, "Auth lifecycle discovery audit time");
  if ((input.operation === "list" && (input.requestId !== undefined
      || !Number.isSafeInteger(input.resultCount) || input.resultCount < 0 || input.resultCount > 20))
    || (input.operation === "get" && (!input.kind || !input.requestId
      || !authLifecycleRequestIdMatchesKind(input.kind, input.requestId)
      || !Number.isSafeInteger(input.resultCount) || input.resultCount < 0 || input.resultCount > 1))) {
    throw new ApiHttpError(500, "AUTH_LIFECYCLE_AUDIT_INVALID", "Auth lifecycle discovery audit is invalid.");
  }
  const deleteAfter = retentionDeadlineV1(occurredAt, AUTH_AUDIT_RETENTION_DAYS_V1);
  return {
    schemaVersion: "namespring.auth-lifecycle-discovery-audit.v1",
    operation: input.operation,
    actorSubjectHash: authAuditSubjectHashV1(input.actorUserId, hmacKey),
    ...(input.requestId
      ? { jobRequestHash: authAuditOpaqueValueHashV1("lifecycle_job_request", input.requestId, hmacKey) }
      : {}),
    kindFilter: input.kind ?? null,
    statusFilter: input.status ?? null,
    resultCount: input.resultCount,
    occurredAt,
    deleteAfter,
  };
}

export function providerUnlinkReservationMatches(
  account: AuthAccountRecord,
  job: ProviderUnlinkJobV1 | null | undefined,
  identity: BeginProviderUnlinkInputV1["identity"],
  bindingDigest: string,
): job is ProviderUnlinkJobV1 {
  return Boolean(job
    && job.status === "pending"
    && job.internalUserId === account.internalUserId
    && job.provider === identity.provider
    && job.issuer === identity.issuer
    && job.firebaseProviderId === identity.firebaseProviderId
    && job.bindingDigest === bindingDigest
    && account.pendingProviderUnlink?.unlinkRequestId === job.unlinkRequestId
    && account.pendingProviderUnlink.bindingDigest === bindingDigest);
}

export function assertPendingProviderUnlinkIntegrity(
  account: AuthAccountRecord | null | undefined,
  job: ProviderUnlinkJobV1,
  binding: BindingRecord | null | undefined,
): asserts account is AuthAccountRecord {
  assertAccountActive(account);
  const target = account.providers.find((entry) => entry.subjectDigest === job.bindingDigest);
  const sameFirebaseUids = account.firebaseUids.length === job.firebaseUids.length
    && account.firebaseUids.every((uid) => job.firebaseUids.includes(uid));
  if (job.status !== "pending"
    || account.pendingProviderUnlink?.unlinkRequestId !== job.unlinkRequestId
    || account.pendingProviderUnlink.provider !== job.provider
    || account.pendingProviderUnlink.bindingDigest !== job.bindingDigest
    || !target
    || target.provider !== job.provider
    || target.issuer !== job.issuer
    || !sameFirebaseUids
    || !binding
    || binding.internalUserId !== job.internalUserId
    || binding.provider !== job.provider
    || binding.issuer !== job.issuer
    || binding.subjectDigest !== job.bindingDigest) {
    throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink reservation is inconsistent.");
  }
}

export function bindingFor(
  identity: VerifiedProviderIdentity,
  linkedAt: string,
  subjectDigest: AuthIdentityBindingDigestV2,
): StoredProviderBinding {
  return {
    provider: identity.provider,
    issuer: identity.issuer,
    subjectDigest,
    linkedAt,
  };
}

export function accountExport(account: AuthAccountRecord): AccountExportResponse {
  return {
    schemaVersion: "auth-account-export.v1",
    generatedAt: new Date().toISOString(),
    account: {
      userId: account.internalUserId,
      status: account.status,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      providers: publicProviders(account),
    },
    includedScopes: ["auth"],
    portableManifestHref: "/api/auth/export-portable",
  };
}
