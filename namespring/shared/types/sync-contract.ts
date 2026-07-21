export const SYNC_DOCUMENT_SCHEMA_V1 = "namespring.account-sync.v1" as const;
export const SYNC_EXPORT_SCHEMA_V1 = "namespring.account-sync-export.v1" as const;
export const SYNC_RETENTION_STATUS_SCHEMA_V1 = "namespring.account-sync-retention-status.v1" as const;
export const SYNC_CONSENT_POLICY_VERSION_V1 = "2026-07-18.v1" as const;
/**
 * The operations endpoint never performs an unbounded count. It reads this
 * many projected due candidates plus one sentinel document for `hasMore`.
 */
export const SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1 = 100 as const;

export const SYNC_SCOPES_V1 = ["favorites", "preferences"] as const;
export type SyncScopeV1 = (typeof SYNC_SCOPES_V1)[number];

export interface SyncRetentionPolicyV1 {
  /** Active synced data expires after this many days without an account write. */
  readonly inactiveDataDays: 365;
  /** Payload-free deletion receipts expire after this many days. */
  readonly deletionReceiptDays: 30;
  /** Audit events contain no favorite/preference payload. */
  readonly payloadFreeAuditDays: 365;
}

export const SYNC_RETENTION_POLICY_V1: SyncRetentionPolicyV1 = {
  inactiveDataDays: 365,
  deletionReceiptDays: 30,
  payloadFreeAuditDays: 365,
};

export interface SyncConsentV1 {
  readonly policyVersion: typeof SYNC_CONSENT_POLICY_VERSION_V1;
  readonly status: "active" | "revoked";
  readonly scopes: readonly SyncScopeV1[];
  readonly grantedAt: string;
  readonly revokedAt?: string;
}

/**
 * Opaque references deliberately exclude a person's name, Hanja and birth
 * input. The free client hydrates display text from its local engine/assets.
 */
export interface SyncedFavoriteV1 {
  readonly favoriteId: string;
  readonly resourceType: "name_candidate" | "local_report" | "paid_report";
  /**
   * Display/name/birth material is client-encrypted. The server stores the
   * authenticated ciphertext but has neither the data key nor a recovery key.
   * Candidate/report IDs, display text and reconstruction material all live in
   * the ciphertext. AAD is the UTF-8 join of the server-issued
   * `SyncAadContextV1.subjectId`, favoriteId, resourceType, keyVersion and
   * aadVersion using `|`. The raw internal account ID is never a browser DTO.
   */
  readonly encryptedEnvelope: {
    readonly algorithm: "A256GCM";
    readonly aadVersion: "namespring.favorite-envelope.v1";
    readonly keyVersion: string;
    /** 96-bit AES-GCM nonce, unpadded base64url. */
    readonly nonce: string;
    /** Ciphertext including the 128-bit GCM tag, unpadded base64url. */
    readonly ciphertext: string;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SyncEncryptionCapabilityV1 {
  readonly mode: "client_e2ee_required";
  readonly algorithm: "A256GCM";
  readonly aadVersion: "namespring.favorite-envelope.v1";
  readonly serverCanDecrypt: false;
  /** New devices need a user-managed recovery secret or a passkey-PRF key. */
  readonly crossDeviceKeyRecovery: "user_managed_recovery_secret_or_passkey_prf";
  readonly maxCiphertextBytes: 4096;
}

/**
 * Stable, domain-separated browser input for favorite-envelope AAD. It is
 * derived from the high-entropy internal UUID but is neither that UUID nor an
 * authorization credential. It remains stable across server-secret rotation.
 */
export interface SyncAadContextV1 {
  readonly schemaVersion: "namespring.sync-aad-context.v1";
  readonly subjectId: `sync_aad_v1_${string}`;
}

export const SYNC_ENCRYPTION_CAPABILITY_V1: SyncEncryptionCapabilityV1 = {
  mode: "client_e2ee_required",
  algorithm: "A256GCM",
  aadVersion: "namespring.favorite-envelope.v1",
  serverCanDecrypt: false,
  crossDeviceKeyRecovery: "user_managed_recovery_secret_or_passkey_prf",
  maxCiphertextBytes: 4096,
};

export interface SyncedPreferencesV1 {
  readonly theme?: "system" | "light" | "dark";
  readonly fontScale?: "sm" | "md" | "lg";
  readonly reduceMotion?: boolean;
  readonly locale?: "ko-KR";
  readonly defaultReportSurface?: "integrated" | "saju" | "naming";
}

export interface SyncDocumentV1 {
  readonly schemaVersion: typeof SYNC_DOCUMENT_SCHEMA_V1;
  readonly ownerUserId: string;
  readonly version: number;
  readonly consent: SyncConsentV1;
  readonly favorites: readonly SyncedFavoriteV1[];
  readonly preferences: SyncedPreferencesV1;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
}

/** Browser-safe projection. Storage ownership never crosses the API boundary. */
export type SyncDocumentViewV1 = Omit<SyncDocumentV1, "ownerUserId">;

export type SyncMutationV1 =
  | {
      readonly mutationId: string;
      readonly scope: "favorites";
      readonly operation: "upsert";
      readonly favorite: SyncedFavoriteV1;
    }
  | {
      readonly mutationId: string;
      readonly scope: "favorites";
      readonly operation: "delete";
      readonly favoriteId: string;
    }
  | {
      readonly mutationId: string;
      readonly scope: "preferences";
      readonly operation: "replace";
      readonly preferences: SyncedPreferencesV1;
    };

export interface GrantSyncConsentRequestV1 {
  readonly requestId: string;
  readonly policyVersion: typeof SYNC_CONSENT_POLICY_VERSION_V1;
  readonly scopes: readonly SyncScopeV1[];
}

export interface ApplySyncDeltaRequestV1 {
  readonly requestId: string;
  readonly baseVersion: number;
  readonly mutations: readonly SyncMutationV1[];
}

export interface RevokeSyncConsentRequestV1 {
  readonly requestId: string;
  readonly reason: "user_request" | "account_deletion" | "policy_change";
}

export interface DeleteSyncedDataRequestV1 {
  readonly requestId: string;
  readonly reason: "user_request" | "account_deletion";
}

export interface SyncSnapshotResponseV1 {
  readonly document: SyncDocumentViewV1 | null;
  readonly encryption: SyncEncryptionCapabilityV1;
  readonly aadContext: SyncAadContextV1;
}

export interface SyncMutationResponseV1 {
  readonly resultingVersion: number | null;
  readonly operation: "initial" | "idempotent_replay";
  readonly encryption: SyncEncryptionCapabilityV1;
}

export interface SyncConflictResponseV1 {
  readonly error: {
    readonly code: "SYNC_VERSION_CONFLICT";
    readonly message: string;
    readonly currentVersion: number;
  };
  readonly serverDocument: SyncDocumentViewV1;
  readonly aadContext: SyncAadContextV1;
}

export interface SyncDataExportV1 {
  readonly schemaVersion: typeof SYNC_EXPORT_SCHEMA_V1;
  readonly exportedAt: string;
  readonly retentionPolicy: SyncRetentionPolicyV1;
  readonly encryption: SyncEncryptionCapabilityV1;
  readonly aadContext: SyncAadContextV1;
  readonly document: SyncDocumentViewV1 | null;
}

export interface SyncDeletionReceiptV1 {
  readonly receiptId: string;
  /** HMAC of internal userId; raw account identifiers are not retained here. */
  readonly ownerHash: `hmac-sha256:${string}`;
  readonly deletedAt: string;
  readonly deleteAfter: string;
  readonly reason: "user_request" | "account_deletion" | "consent_revoked" | "retention_expired";
}

export interface SyncAuditEventV1 {
  readonly schemaVersion: "namespring.account-sync-audit.v1";
  readonly auditId: string;
  readonly requestId: string;
  readonly ownerHash: `hmac-sha256:${string}`;
  /** Domain-separated HMAC; raw/auth-layer session identifiers are never retained. */
  readonly actorSessionHash: `hmac-sha256:${string}`;
  readonly action: "consent.granted" | "delta.applied" | "consent.revoked" | "data.deleted" | "retention.expired";
  readonly occurredAt: string;
  readonly deleteAfter: string;
  readonly resultingVersion: number | null;
  /** Number only; favorite/preference values are deliberately absent. */
  readonly mutationCount: number;
}

export interface SyncRetentionSweepResultV1 {
  /** Number of live-data candidates read by this bounded run. */
  readonly dataDocumentsScanned: number;
  readonly dataDocumentsDeleted: number;
  /** Candidates preserved because they disappeared or changed after the query snapshot. */
  readonly dataDocumentsSkipped: number;
  /** Candidates whose isolated transactional deletion failed and must be retried. */
  readonly dataDocumentsFailed: number;
  /** True when the worker stopped at its execution deadline before all candidates were attempted. */
  readonly deadlineReached: boolean;
  readonly deletionReceiptsDeleted: number;
  readonly requestReceiptsDeleted: number;
  readonly auditEventsDeleted: number;
}

export interface SyncRetentionDueAggregateV1 {
  /** Bounded lower-bound count. When `hasMore` is true the real count is larger. */
  readonly candidateCount: number;
  readonly candidateCountCap: typeof SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1;
  readonly hasMore: boolean;
  readonly oldestDueAt: string | null;
}

export interface SyncRetentionMaintenanceAggregateV1 {
  readonly scanned: number;
  readonly deleted: number;
  readonly skipped: number;
  readonly failed: number;
  readonly deadlineReached: boolean;
}

export interface SyncRetentionMaintenanceStatusV1 {
  readonly state: "never_started" | "idle" | "running" | "lease_expired";
  /** Most recent durable start/finish transition, not a process liveness probe. */
  readonly heartbeatAt: string | null;
  readonly leaseExpiresAt: string | null;
  readonly lastCompletedAt: string | null;
  readonly lastOutcome: "completed" | "partial" | "failed" | null;
  readonly lastAggregate: SyncRetentionMaintenanceAggregateV1 | null;
}

/** Aggregate-only operational discovery. No account or synced-content fields are permitted. */
export interface SyncRetentionStatusV1 {
  readonly schemaVersion: typeof SYNC_RETENTION_STATUS_SCHEMA_V1;
  readonly observedAt: string;
  readonly due: SyncRetentionDueAggregateV1;
  readonly maintenance: SyncRetentionMaintenanceStatusV1;
}
