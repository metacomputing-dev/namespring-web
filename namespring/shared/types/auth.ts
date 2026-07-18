/**
 * Public account/session contract.
 *
 * Free readings do not require this API. A client should create a server
 * session only when the user explicitly signs in, synchronizes data, or starts
 * a paid flow.
 */
export const AUTH_PROVIDERS = [
  "anonymous",
  "google",
  "kakao_oidc",
  "email_link",
  "apple",
  "phone",
  "facebook",
  "oidc",
] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const ACCOUNT_STATUSES = ["active", "deletion_pending", "deleted"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_UPGRADE_INTENTS = ["sign_in", "account_upgrade", "sync", "payment"] as const;
export type AccountUpgradeIntent = (typeof ACCOUNT_UPGRADE_INTENTS)[number];

export interface LinkedProviderSummary {
  provider: AuthProvider;
  issuer: string;
  linkedAt: string;
}

export const BROWSER_VISIBLE_ACCOUNT_ROLES = ["user", "admin", "premium_admin"] as const;
export type BrowserVisibleAccountRole = (typeof BROWSER_VISIBLE_ACCOUNT_ROLES)[number];

export interface AccountSessionView {
  authenticated: true;
  status: "active";
  roles: readonly BrowserVisibleAccountRole[];
  providers: readonly LinkedProviderSummary[];
  /** True only when an exact, cryptographically verified provider binding restored the account. */
  recoveredExistingAccount?: boolean;
}

export interface AnonymousSessionView {
  authenticated: false;
  /** Free/local analysis remains available without creating a server account. */
  freeLocalAvailable: true;
  accountRequiredFor: readonly ["sync", "payment"];
}

export type CurrentSessionResponse = AccountSessionView | AnonymousSessionView;

export interface CreateSessionRequest {
  idToken: string;
  intent: AccountUpgradeIntent;
}

export interface CreateSessionResponse {
  session: AccountSessionView;
  /** Rotated CSRF value. Keep in memory and send as X-CSRF-Token. */
  csrfToken: string;
  csrfExpiresAt: string;
}

export interface CsrfTokenResponse {
  csrfToken: string;
  expiresAt: string;
}

export interface LinkIdentityRequest {
  /** Fresh ID token for the currently signed-in Firebase principal. */
  reauthIdToken: string;
  /** Fresh token after the client completed Firebase provider linking. */
  linkedIdToken: string;
  provider: Exclude<AuthProvider, "anonymous">;
}

export interface UnlinkIdentityRequest {
  reauthIdToken: string;
  provider: Exclude<AuthProvider, "anonymous">;
}

export interface UnlinkIdentityResponse {
  accountStatus: AccountStatus;
  unlinkRequestId: string;
  unlinkStatus: "pending" | "completed";
  cleanupPending: boolean;
  /** Pending responses still describe the last committed internal bindings. */
  providers: readonly LinkedProviderSummary[];
}

export interface AccountMutationResponse {
  status: AccountStatus;
  providers: readonly LinkedProviderSummary[];
}

export interface DeleteAccountRequest {
  /** Recent provider reauthentication is mandatory for account deletion. */
  reauthIdToken: string;
  confirmation: "DELETE";
}

export interface DeleteAccountResponse {
  status: "deletion_pending" | "deleted";
  deletionRequestId: string;
  cleanupPending: boolean;
  deletedAt: string | null;
}

export interface AccountExportResponse {
  schemaVersion: "auth-account-export.v1";
  generatedAt: string;
  account: {
    userId: string;
    status: AccountStatus;
    createdAt: string;
    updatedAt: string;
    providers: readonly LinkedProviderSummary[];
  };
  /** Legacy contract remains auth-only; use portableManifestHref for all domains. */
  includedScopes: readonly ["auth"];
  /** Additive discovery link; legacy consumers may ignore it. */
  portableManifestHref?: "/api/auth/export-portable";
}

export interface PortableExportEndpointV1 {
  readonly delivery: "authenticated_endpoint";
  readonly method: "GET";
  readonly href: string;
  readonly expectedSchemaVersion: string;
  readonly snapshot: "at_section_fetch";
  readonly bounds: {
    readonly maxItems: number;
    readonly maxResponseBytes: number;
    readonly overflow: "cursor_pagination" | "fail_closed";
  };
}

export interface AccountPortableExportManifestV1 {
  readonly schemaVersion: "namespring.account-portable-export-manifest.v1";
  readonly generatedAt: string;
  readonly userId: string;
  /** Sections are independently timestamped; this is not a false atomic snapshot claim. */
  readonly consistency: "independent_section_snapshots";
  readonly sections: {
    readonly auth: {
      readonly delivery: "inline";
      readonly expectedSchemaVersion: "auth-account-export.v1";
      readonly snapshot: "at_manifest_generation";
      readonly data: AccountExportResponse;
    };
    readonly sync: PortableExportEndpointV1;
    readonly premium: PortableExportEndpointV1;
  };
  readonly includedScopes: readonly ["auth", "sync", "premium"];
}

export interface LogoutResponse {
  authenticated: false;
}

export interface RevokeSessionsRequest {
  reauthIdToken: string;
}

export interface RevokeSessionsResponse {
  revokedAt: string;
}

export interface AuthPolicyResponse {
  schemaVersion: "auth-policy.v1";
  freeMode: "local_only_no_account";
  accountRequiredFor: readonly ["sync", "payment"];
  enabledProviders: readonly AuthProvider[];
  providerReadyContract: readonly ["anonymous", "google", "kakao_oidc", "email_link", "phone"];
  primarySignInProviders: readonly ["google", "kakao_oidc", "email_link"];
  stepUpOnlyProviders: readonly ["phone"];
  futureDisabledByDefault: readonly ["facebook", "oidc"];
  /** Apple cannot be enabled until provider-token revocation and deletion lifecycle support is deployed. */
  disabledUntilLifecycleAdapter: readonly ["apple"];
  accountLinking: "explicit_recent_reauthentication";
  emailMatchMerge: false;
  sessionTransport: "secure_http_only_cookie";
}

export const AUTH_LIFECYCLE_JOB_LIST_SCHEMA_V1 = "namespring.auth-lifecycle-job-list.v1" as const;
export const AUTH_LIFECYCLE_JOB_DETAIL_SCHEMA_V1 = "namespring.auth-lifecycle-job-detail.v1" as const;

export type AuthLifecycleJobKindV1 = "account_deletion" | "provider_unlink";
export type AuthLifecycleJobStatusV1 = "pending" | "completed";
export type AuthLifecycleJobPublicStageV1 =
  | "cleanup_pending"
  | "reserved"
  | "firebase_unlinked"
  | "sessions_revoked"
  | "completed";

/** Metadata-only administrator projection. Raw identity and claim material is deliberately absent. */
export interface AuthLifecycleJobAdminViewV1 {
  readonly requestId: string;
  readonly kind: AuthLifecycleJobKindV1;
  readonly status: AuthLifecycleJobStatusV1;
  readonly stage: AuthLifecycleJobPublicStageV1;
  readonly attemptCount: number;
  readonly requestedAt: string;
  readonly updatedAt: string;
  readonly nextAttemptAt: string | null;
  readonly claimUntil: string | null;
  readonly deleteAfter: string | null;
  readonly failureCodes: readonly string[];
}

export interface ListAuthLifecycleJobsRequestV1 {
  readonly kind?: AuthLifecycleJobKindV1;
  readonly status?: AuthLifecycleJobStatusV1;
  readonly limit?: number;
  /** Signed server cursor. Clients must store and replay it without inspection or modification. */
  readonly cursor?: string;
}

export interface ListAuthLifecycleJobsResponseV1 {
  readonly schemaVersion: typeof AUTH_LIFECYCLE_JOB_LIST_SCHEMA_V1;
  /** Immutable upper time boundary shared by every page in this cursor walk. */
  readonly snapshotAt: string;
  readonly jobs: readonly AuthLifecycleJobAdminViewV1[];
  readonly nextCursor: string | null;
}

export interface GetAuthLifecycleJobRequestV1 {
  readonly kind: AuthLifecycleJobKindV1;
  readonly requestId: string;
}

export interface GetAuthLifecycleJobResponseV1 {
  readonly schemaVersion: typeof AUTH_LIFECYCLE_JOB_DETAIL_SCHEMA_V1;
  readonly job: AuthLifecycleJobAdminViewV1;
}
