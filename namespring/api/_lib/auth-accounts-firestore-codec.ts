import { Timestamp } from "firebase-admin/firestore";
import { AUTH_PROVIDERS, type AuthProvider } from "../../shared/types/auth.js";
import {
  AUTH_JOB_MAX_BACKOFF_MS_V1,
  PROVIDER_UNLINK_FAILURE_CODES_V1,
  type AccountDeletionJob,
  type AuthAccountRecord,
  type AuthLifecycleJobStateV1,
  type ProviderUnlinkFailureCodeV1,
  type ProviderUnlinkJobV1,
  type ProviderUnlinkStageV1,
} from "./auth-accounts-contract.js";
import {
  AUTH_JOB_CLAIM_TOKEN_PATTERN_V1,
  MAX_AUTH_JOB_ATTEMPTS_V1,
  authJobBackoffMsForAttemptV1,
  isCanonicalIsoTimestamp,
  type BindingRecord,
  type PrincipalRecord,
} from "./auth-accounts-lifecycle.js";
import {
  AUTH_IDENTITY_BINDING_DIGEST_V2_PATTERN,
  authProviderFromFirebaseId,
  type AuthIdentityBindingDigestV2,
} from "./auth-identity.js";
import { ApiHttpError } from "./http.js";

export const COLLECTIONS = {
  accounts: "authAccountsV1",
  principals: "authFirebasePrincipalsV1",
  bindings: "authIdentityBindingsV1",
  audit: "authAuditEventsV1",
  deletionJobs: "authDeletionJobsV1",
  providerUnlinkJobs: "authProviderUnlinkJobsV1",
} as const;

export type StoredAccountDeletionJobV1 = Omit<
  AccountDeletionJob,
  "deleteAfter" | "nextAttemptAt" | "claimUntil"
> & {
  readonly deleteAfter: Timestamp | null;
  readonly nextAttemptAt: Timestamp | null;
  readonly claimUntil: Timestamp | null;
};

export type StoredAuthAccountRecordV1 = Omit<AuthAccountRecord, "deleteAfter"> & {
  readonly deleteAfter: Timestamp | null;
};

export function encodeAuthAccountRecordV1(account: AuthAccountRecord): StoredAuthAccountRecordV1 {
  return {
    ...account,
    deleteAfter: account.deleteAfter === null ? null : Timestamp.fromDate(new Date(account.deleteAfter)),
  };
}

export function encodeAccountDeletionJobV1(job: AccountDeletionJob): StoredAccountDeletionJobV1 {
  return {
    ...job,
    deleteAfter: job.deleteAfter === null ? null : Timestamp.fromDate(new Date(job.deleteAfter)),
    nextAttemptAt: job.nextAttemptAt === null ? null : Timestamp.fromDate(new Date(job.nextAttemptAt)),
    claimUntil: job.claimUntil === null ? null : Timestamp.fromDate(new Date(job.claimUntil)),
  };
}

export type StoredProviderUnlinkJobV1 = Omit<
  ProviderUnlinkJobV1,
  "deleteAfter" | "nextAttemptAt" | "claimUntil"
> & {
  readonly deleteAfter: Timestamp | null;
  readonly nextAttemptAt: Timestamp | null;
  readonly claimUntil: Timestamp | null;
};

export function encodeProviderUnlinkJobV1(job: ProviderUnlinkJobV1): StoredProviderUnlinkJobV1 {
  return {
    ...job,
    deleteAfter: job.deleteAfter === null ? null : Timestamp.fromDate(new Date(job.deleteAfter)),
    nextAttemptAt: job.nextAttemptAt === null ? null : Timestamp.fromDate(new Date(job.nextAttemptAt)),
    claimUntil: job.claimUntil === null ? null : Timestamp.fromDate(new Date(job.claimUntil)),
  };
}

export function hasExactObjectKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

const ACCOUNT_ROLE_VALUES_V1 = ["user", "admin", "premium_admin", "premium_system"] as const;
const INTERNAL_USER_ID_V1 = /^[A-Za-z0-9_-]{1,128}$/u;
const FIREBASE_UID_V1 = /^[^\u0000-\u001f\u007f]{1,128}$/u;
const TEXT_VALUE_V1 = /^[^\u0000-\u001f\u007f]{1,512}$/u;

function isMatchingString(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}

function isCanonicalIsoString(value: unknown): value is string {
  return typeof value === "string" && isCanonicalIsoTimestamp(value);
}

function authAccountIntegrityFailure(message: string): never {
  throw new ApiHttpError(500, "AUTH_ACCOUNT_INTEGRITY_ERROR", message);
}

function isPlainExactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && hasExactObjectKeys(value, keys);
}

export function decodePrincipalRecordV1(value: unknown, expectedFirebaseUid?: string): PrincipalRecord {
  if (!isPlainExactObject(value, ["internalUserId", "firebaseUid", "createdAt"])
    || !isMatchingString(value.internalUserId, INTERNAL_USER_ID_V1)
    || !isMatchingString(value.firebaseUid, FIREBASE_UID_V1)
    || (expectedFirebaseUid !== undefined && value.firebaseUid !== expectedFirebaseUid)
    || !isCanonicalIsoString(value.createdAt)) {
    authAccountIntegrityFailure("Authentication principal data is malformed.");
  }
  return {
    internalUserId: value.internalUserId as string,
    firebaseUid: value.firebaseUid as string,
    createdAt: value.createdAt as string,
  };
}

export function decodeBindingRecordV1(
  value: unknown,
  expectedSubjectDigest?: string,
  expectedIdentity?: Readonly<{ provider: AuthProvider; issuer: string }>,
): BindingRecord {
  if (!isPlainExactObject(value, ["internalUserId", "provider", "issuer", "subjectDigest", "createdAt"])
    || !isMatchingString(value.internalUserId, INTERNAL_USER_ID_V1)
    || typeof value.provider !== "string"
    || !(AUTH_PROVIDERS as readonly string[]).includes(value.provider)
    || !isMatchingString(value.issuer, TEXT_VALUE_V1)
    || !isMatchingString(value.subjectDigest, AUTH_IDENTITY_BINDING_DIGEST_V2_PATTERN)
    || (expectedSubjectDigest !== undefined && value.subjectDigest !== expectedSubjectDigest)
    || (expectedIdentity !== undefined && (value.provider !== expectedIdentity.provider
      || value.issuer !== expectedIdentity.issuer))
    || !isCanonicalIsoString(value.createdAt)) {
    authAccountIntegrityFailure("Authentication identity binding is malformed.");
  }
  return {
    internalUserId: value.internalUserId as string,
    provider: value.provider as AuthProvider,
    issuer: value.issuer as string,
    subjectDigest: value.subjectDigest as AuthIdentityBindingDigestV2,
    createdAt: value.createdAt as string,
  };
}

export function decodeAuthAccountRecordV1(value: unknown, expectedInternalUserId?: string): AuthAccountRecord {
  const requiredKeys = [
    "internalUserId", "status", "roles", "providers", "firebaseUids", "createdAt", "updatedAt",
    "lastAuthenticatedAt", "deletionRequestedAt", "deletedAt", "deleteAfter", "pendingProviderUnlink", "version",
  ] as const;
  if (!isPlainExactObject(value, requiredKeys)) {
    authAccountIntegrityFailure("Authentication account data is malformed.");
  }
  const roles = value.roles;
  const providers = value.providers;
  const firebaseUids = value.firebaseUids;
  if (!isMatchingString(value.internalUserId, INTERNAL_USER_ID_V1)
    || (expectedInternalUserId !== undefined && value.internalUserId !== expectedInternalUserId)
    || (value.status !== "active" && value.status !== "deletion_pending" && value.status !== "deleted")
    || value.version !== 1
    || !Array.isArray(roles) || roles.length < 1 || roles.length > ACCOUNT_ROLE_VALUES_V1.length
    || roles.some((role) => typeof role !== "string" || !(ACCOUNT_ROLE_VALUES_V1 as readonly string[]).includes(role))
    || new Set(roles).size !== roles.length || !roles.includes("user")
    || !Array.isArray(providers) || providers.length > 20
    || !Array.isArray(firebaseUids) || firebaseUids.length > 20
    || firebaseUids.some((uid) => typeof uid !== "string" || !FIREBASE_UID_V1.test(uid))
    || new Set(firebaseUids).size !== firebaseUids.length
    || !isCanonicalIsoString(value.createdAt)
    || !isCanonicalIsoString(value.updatedAt)
    || !isCanonicalIsoString(value.lastAuthenticatedAt)
    || value.updatedAt < value.createdAt
    || value.lastAuthenticatedAt < value.createdAt
    || value.lastAuthenticatedAt > value.updatedAt
    || (value.deletionRequestedAt !== null && !isCanonicalIsoString(value.deletionRequestedAt))
    || (value.deletedAt !== null && !isCanonicalIsoString(value.deletedAt))
    || (value.deleteAfter !== null && !(value.deleteAfter instanceof Timestamp))) {
    authAccountIntegrityFailure("Authentication account data is malformed.");
  }
  const createdAt = value.createdAt as string;
  const updatedAt = value.updatedAt as string;

  const decodedProviders = providers.map((provider) => {
    if (!isPlainExactObject(provider, ["provider", "issuer", "linkedAt", "subjectDigest"])
      || typeof provider.provider !== "string"
      || !(AUTH_PROVIDERS as readonly string[]).includes(provider.provider)
      || !isMatchingString(provider.issuer, TEXT_VALUE_V1)
      || !isCanonicalIsoString(provider.linkedAt)
      || provider.linkedAt < createdAt
      || provider.linkedAt > updatedAt
      || !isMatchingString(provider.subjectDigest, AUTH_IDENTITY_BINDING_DIGEST_V2_PATTERN)) {
      authAccountIntegrityFailure("Authentication provider binding data is malformed.");
    }
    return {
      provider: provider.provider as AuthProvider,
      issuer: provider.issuer as string,
      linkedAt: provider.linkedAt as string,
      subjectDigest: provider.subjectDigest as AuthIdentityBindingDigestV2,
    };
  });
  if (new Set(decodedProviders.map((provider) => provider.subjectDigest)).size !== decodedProviders.length) {
    authAccountIntegrityFailure("Authentication provider bindings are duplicated.");
  }

  let pendingProviderUnlink: AuthAccountRecord["pendingProviderUnlink"] = null;
  if (value.pendingProviderUnlink !== null) {
    const pending = value.pendingProviderUnlink;
    if (!isPlainExactObject(pending, ["unlinkRequestId", "provider", "bindingDigest"])
      || !isMatchingString(pending.unlinkRequestId, /^provider_unlink_v1_[a-f0-9]{32}$/u)
      || typeof pending.provider !== "string" || pending.provider === "anonymous"
      || !(AUTH_PROVIDERS as readonly string[]).includes(pending.provider)
      || !isMatchingString(pending.bindingDigest, AUTH_IDENTITY_BINDING_DIGEST_V2_PATTERN)
      || !decodedProviders.some((provider) => provider.provider === pending.provider
        && provider.subjectDigest === pending.bindingDigest)) {
      authAccountIntegrityFailure("Pending provider unlink state is malformed.");
    }
    pendingProviderUnlink = {
      unlinkRequestId: pending.unlinkRequestId as string,
      provider: pending.provider as Exclude<AuthProvider, "anonymous">,
      bindingDigest: pending.bindingDigest as string,
    };
  }

  const active = value.status === "active";
  const pendingDeletion = value.status === "deletion_pending";
  const deleted = value.status === "deleted";
  const deleteAfter = value.deleteAfter === null ? null : value.deleteAfter.toDate().toISOString();
  if ((active && (decodedProviders.length === 0 || firebaseUids.length === 0
      || value.deletionRequestedAt !== null || value.deletedAt !== null || deleteAfter !== null))
    || (!active && (decodedProviders.length !== 0 || firebaseUids.length !== 0 || pendingProviderUnlink !== null))
    || (pendingDeletion && (value.deletionRequestedAt === null || value.deletedAt !== null || deleteAfter !== null))
    || (deleted && (value.deletionRequestedAt === null || value.deletedAt === null || deleteAfter === null))
    || (value.deletionRequestedAt !== null && value.deletionRequestedAt < value.createdAt)
    || (value.deletedAt !== null && value.deletionRequestedAt !== null && value.deletedAt < value.deletionRequestedAt)
    || (deleteAfter !== null && value.deletedAt !== null && deleteAfter <= value.deletedAt)) {
    authAccountIntegrityFailure("Authentication account lifecycle state is malformed.");
  }

  return {
    internalUserId: value.internalUserId as string,
    status: value.status as AuthAccountRecord["status"],
    roles: [...roles as string[]],
    providers: decodedProviders,
    firebaseUids: [...firebaseUids as string[]],
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
    lastAuthenticatedAt: value.lastAuthenticatedAt as string,
    deletionRequestedAt: value.deletionRequestedAt as string | null,
    deletedAt: value.deletedAt as string | null,
    deleteAfter,
    pendingProviderUnlink,
    version: 1,
  };
}

export function decodeAuthJobStateV1(
  stored: Record<string, unknown>,
  status: "pending" | "completed",
  errorCode: "DELETION_JOB_INTEGRITY_ERROR" | "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR",
): AuthLifecycleJobStateV1 {
  const fail = (message: string): never => {
    throw new ApiHttpError(500, errorCode, message);
  };
  if (!Number.isSafeInteger(stored.fence) || Number(stored.fence) < 0
    || !Number.isSafeInteger(stored.backoffMs) || Number(stored.backoffMs) < 0
    || Number(stored.backoffMs) > AUTH_JOB_MAX_BACKOFF_MS_V1
    || !Number.isSafeInteger(stored.attemptCount) || Number(stored.attemptCount) < 0
    || Number(stored.attemptCount) > MAX_AUTH_JOB_ATTEMPTS_V1
    || Number(stored.backoffMs) !== (status === "completed"
      ? 0
      : authJobBackoffMsForAttemptV1(Number(stored.attemptCount)))) {
    fail("Auth lifecycle retry metadata is invalid.");
  }
  const inactive = stored.claimToken === null && stored.claimUntil === null;
  const active = typeof stored.claimToken === "string"
    && AUTH_JOB_CLAIM_TOKEN_PATTERN_V1.test(stored.claimToken)
    && stored.claimUntil instanceof Timestamp
    && Number(stored.fence) >= 1;
  if (!inactive && !active) fail("Auth lifecycle claim metadata is inconsistent.");

  if (status === "pending") {
    if (!(stored.nextAttemptAt instanceof Timestamp) || stored.deleteAfter !== null) {
      fail("Pending auth lifecycle scheduling metadata is invalid.");
    }
  } else if (stored.nextAttemptAt !== null
    || stored.claimToken !== null
    || stored.claimUntil !== null
    || stored.backoffMs !== 0
    || !(stored.deleteAfter instanceof Timestamp)) {
    fail("Completed auth lifecycle retention metadata is invalid.");
  }
  return {
    nextAttemptAt: stored.nextAttemptAt === null
      ? null
      : (stored.nextAttemptAt as Timestamp).toDate().toISOString(),
    claimUntil: stored.claimUntil === null
      ? null
      : (stored.claimUntil as Timestamp).toDate().toISOString(),
    claimToken: stored.claimToken as string | null,
    fence: stored.fence as number,
    backoffMs: stored.backoffMs as number,
  };
}

export function decodeAccountDeletionJobV1(value: unknown, expectedDeletionRequestId?: string): AccountDeletionJob {
  if (!isPlainExactObject(value, [
    "deletionRequestId", "internalUserId", "firebaseUids", "bindingDigests", "providerKinds", "status",
    "requestedAt", "updatedAt", "attemptCount", "lastErrorCodes", "deleteAfter",
    "nextAttemptAt", "claimUntil", "claimToken", "fence", "backoffMs",
  ])) {
    throw new ApiHttpError(500, "DELETION_JOB_INTEGRITY_ERROR", "Account deletion job is malformed.");
  }
  const stored = value as Record<string, unknown>;
  const status = stored.status === "pending" || stored.status === "completed" ? stored.status : null;
  const validUids = Array.isArray(stored.firebaseUids)
    && stored.firebaseUids.every((uid) => typeof uid === "string" && uid.length > 0 && uid.length <= 128
      && !/[\u0000-\u001f\u007f]/u.test(uid))
    && new Set(stored.firebaseUids).size === stored.firebaseUids.length;
  const validDigests = Array.isArray(stored.bindingDigests)
    && stored.bindingDigests.every((digest) => typeof digest === "string"
      && AUTH_IDENTITY_BINDING_DIGEST_V2_PATTERN.test(digest))
    && new Set(stored.bindingDigests).size === stored.bindingDigests.length;
  const validProviderKinds = Array.isArray(stored.providerKinds)
    && stored.providerKinds.every((provider) => typeof provider === "string"
      && (AUTH_PROVIDERS as readonly string[]).includes(provider))
    && new Set(stored.providerKinds).size === stored.providerKinds.length;
  const validErrors = Array.isArray(stored.lastErrorCodes)
    && stored.lastErrorCodes.length <= 20
    && stored.lastErrorCodes.every((code) => typeof code === "string" && /^[A-Za-z0-9_/-]{1,80}$/u.test(code));
  if (!isMatchingString(stored.deletionRequestId, /^deletion_request_v1_[a-f0-9]{32}$/u)
    || (expectedDeletionRequestId !== undefined && stored.deletionRequestId !== expectedDeletionRequestId)
    || !isMatchingString(stored.internalUserId, INTERNAL_USER_ID_V1)
    || !status || !validUids || !validDigests || !validProviderKinds || !validErrors
    || !isCanonicalIsoString(stored.requestedAt) || !isCanonicalIsoString(stored.updatedAt)
    || !Number.isSafeInteger(stored.attemptCount)) {
    throw new ApiHttpError(500, "DELETION_JOB_INTEGRITY_ERROR", "Account deletion job is malformed.");
  }
  if ((status === "pending" && ((stored.firebaseUids as unknown[]).length === 0
    || (stored.bindingDigests as unknown[]).length === 0
    || (stored.providerKinds as unknown[]).length === 0))
    || (status === "completed" && ((stored.firebaseUids as unknown[]).length !== 0
      || (stored.bindingDigests as unknown[]).length !== 0
      || (stored.providerKinds as unknown[]).length !== 0))) {
    throw new ApiHttpError(500, "DELETION_JOB_INTEGRITY_ERROR", "Account deletion payload state is malformed.");
  }
  const state = decodeAuthJobStateV1(stored, status, "DELETION_JOB_INTEGRITY_ERROR");
  return {
    deletionRequestId: stored.deletionRequestId as string,
    internalUserId: stored.internalUserId as string,
    firebaseUids: [...stored.firebaseUids as string[]],
    bindingDigests: [...stored.bindingDigests as string[]],
    providerKinds: [...stored.providerKinds as AuthProvider[]],
    status,
    requestedAt: stored.requestedAt as string,
    updatedAt: stored.updatedAt as string,
    attemptCount: stored.attemptCount as number,
    lastErrorCodes: [...stored.lastErrorCodes as string[]],
    deleteAfter: stored.deleteAfter === null ? null : (stored.deleteAfter as Timestamp).toDate().toISOString(),
    ...state,
  };
}

export function decodeProviderUnlinkJobV1(value: unknown, expectedUnlinkRequestId?: string): ProviderUnlinkJobV1 {
  if (!isPlainExactObject(value, [
    "unlinkRequestId", "internalUserId", "provider", "issuer", "firebaseProviderId",
    "bindingDigest", "firebaseUids", "status", "stage", "requestedAt", "updatedAt",
    "attemptCount", "lastFailureCodes", "deleteAfter", "nextAttemptAt", "claimUntil",
    "claimToken", "fence", "backoffMs",
  ])) {
    throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink job is malformed.");
  }
  const stored = value as Record<string, unknown>;
  const pendingStages: readonly ProviderUnlinkStageV1[] = ["reserved", "firebase_unlinked", "sessions_revoked"];
  const validProvider = typeof stored.provider === "string"
    && stored.provider !== "anonymous"
    && AUTH_PROVIDERS.includes(stored.provider as AuthProvider);
  let providerIdMatches = false;
  if (validProvider && typeof stored.firebaseProviderId === "string") {
    try {
      providerIdMatches = authProviderFromFirebaseId(stored.firebaseProviderId) === stored.provider
        && (stored.provider !== "email_link" || stored.firebaseProviderId === "password");
    } catch {
      providerIdMatches = false;
    }
  }
  const validFailureCodes = Array.isArray(stored.lastFailureCodes)
    && stored.lastFailureCodes.length <= 10
    && stored.lastFailureCodes.every((code) => (
      typeof code === "string"
      && PROVIDER_UNLINK_FAILURE_CODES_V1.includes(code as ProviderUnlinkFailureCodeV1)
    ));
  const validFirebaseUids = Array.isArray(stored.firebaseUids)
    && stored.firebaseUids.every((uid) => (
      typeof uid === "string"
      && uid.length > 0
      && uid.length <= 128
      && !/[\u0000-\u001f\u007f]/u.test(uid)
    ))
    && new Set(stored.firebaseUids).size === stored.firebaseUids.length;
  const isCompleted = stored.status === "completed" && stored.stage === "completed";
  const isPending = stored.status === "pending"
    && pendingStages.includes(stored.stage as ProviderUnlinkStageV1);

  if (!isMatchingString(stored.unlinkRequestId, /^provider_unlink_v1_[a-f0-9]{32}$/u)
    || (expectedUnlinkRequestId !== undefined && stored.unlinkRequestId !== expectedUnlinkRequestId)
    || !isMatchingString(stored.internalUserId, INTERNAL_USER_ID_V1)
    || !validProvider
    || !providerIdMatches
    || !isMatchingString(stored.issuer, TEXT_VALUE_V1)
    || !isMatchingString(stored.firebaseProviderId, /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u)
    || !validFirebaseUids
    || !isCanonicalIsoString(stored.requestedAt)
    || !isCanonicalIsoString(stored.updatedAt)
    || !Number.isSafeInteger(stored.attemptCount)
    || !validFailureCodes
    || (!isPending && !isCompleted)) {
    throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Provider unlink job is malformed.");
  }

  if (isPending && (
    !isMatchingString(stored.bindingDigest, AUTH_IDENTITY_BINDING_DIGEST_V2_PATTERN)
    || (stored.firebaseUids as unknown[]).length === 0
  )) {
    throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Pending provider unlink state is malformed.");
  }
  if (isCompleted && (
    stored.bindingDigest !== ""
    || (stored.firebaseUids as unknown[]).length !== 0
  )) {
    throw new ApiHttpError(500, "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR", "Completed provider unlink state is malformed.");
  }
  const state = decodeAuthJobStateV1(
    stored,
    stored.status as "pending" | "completed",
    "PROVIDER_UNLINK_JOB_INTEGRITY_ERROR",
  );
  return {
    unlinkRequestId: stored.unlinkRequestId as string,
    internalUserId: stored.internalUserId as string,
    provider: stored.provider as Exclude<AuthProvider, "anonymous">,
    issuer: stored.issuer as string,
    firebaseProviderId: stored.firebaseProviderId as string,
    bindingDigest: stored.bindingDigest as string,
    firebaseUids: [...stored.firebaseUids as string[]],
    status: stored.status as "pending" | "completed",
    stage: stored.stage as ProviderUnlinkStageV1,
    requestedAt: stored.requestedAt as string,
    updatedAt: stored.updatedAt as string,
    attemptCount: stored.attemptCount as number,
    lastFailureCodes: [...stored.lastFailureCodes as ProviderUnlinkFailureCodeV1[]],
    deleteAfter: stored.deleteAfter === null ? null : (stored.deleteAfter as Timestamp).toDate().toISOString(),
    ...state,
  };
}
