import { createHash, createHmac, randomUUID } from "node:crypto";
import type {
  ApplySyncDeltaRequestV1,
  DeleteSyncedDataRequestV1,
  GrantSyncConsentRequestV1,
  RevokeSyncConsentRequestV1,
  SyncDataExportV1,
  SyncDeletionReceiptV1,
  SyncDocumentV1,
  SyncDocumentViewV1,
  SyncAadContextV1,
  SyncMutationResponseV1,
  SyncRetentionStatusV1,
  SyncSnapshotResponseV1,
  SyncRetentionSweepResultV1,
} from "../../shared/types/sync-contract.js";
import {
  SYNC_ENCRYPTION_CAPABILITY_V1,
  SYNC_EXPORT_SCHEMA_V1,
  SYNC_RETENTION_POLICY_V1,
  SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1,
  SYNC_RETENTION_STATUS_SCHEMA_V1,
} from "../../shared/types/sync-contract.js";
import { ApiHttpError } from "./http.js";
import type { MaintenanceStatusReaderV1 } from "./maintenance-coordinator.js";
import type {
  SyncActorV1,
  SyncMutationCommandV1,
  SyncRepositoryV1,
  SyncRetentionStatusRepositoryV1,
} from "./sync-repository.js";
import { SyncVersionConflictError } from "./sync-repository.js";
import { syncRequestDigest } from "./sync-validation.js";

export interface SyncClockV1 {
  now(): Date;
}

const systemClock: SyncClockV1 = { now: () => new Date() };

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export function syncAadContextForUserIdV1(userId: string): SyncAadContextV1 {
  const digest = createHash("sha256")
    .update("namespring.sync.aad-subject.v1", "utf8")
    .update("\0", "utf8")
    .update(userId, "utf8")
    .digest("base64url");
  return {
    schemaVersion: "namespring.sync-aad-context.v1",
    subjectId: `sync_aad_v1_${digest}`,
  };
}

export function projectSyncDocumentForBrowserV1(document: SyncDocumentV1): SyncDocumentViewV1 {
  // Rebuild the public DTO field-by-field instead of subtracting ownerUserId.
  // Firestore is a persistence boundary, not a DTO validator: legacy or
  // accidentally contaminated records must never gain a browser-visible field
  // merely because it was added to the stored object.
  return {
    schemaVersion: document.schemaVersion,
    version: document.version,
    consent: {
      policyVersion: document.consent.policyVersion,
      status: document.consent.status,
      scopes: [...document.consent.scopes],
      grantedAt: document.consent.grantedAt,
      ...(document.consent.revokedAt === undefined ? {} : { revokedAt: document.consent.revokedAt }),
    },
    favorites: document.favorites.map((favorite) => ({
      favoriteId: favorite.favoriteId,
      resourceType: favorite.resourceType,
      encryptedEnvelope: {
        algorithm: favorite.encryptedEnvelope.algorithm,
        aadVersion: favorite.encryptedEnvelope.aadVersion,
        keyVersion: favorite.encryptedEnvelope.keyVersion,
        nonce: favorite.encryptedEnvelope.nonce,
        ciphertext: favorite.encryptedEnvelope.ciphertext,
      },
      createdAt: favorite.createdAt,
      updatedAt: favorite.updatedAt,
    })),
    preferences: {
      ...(document.preferences.theme === undefined ? {} : { theme: document.preferences.theme }),
      ...(document.preferences.fontScale === undefined ? {} : { fontScale: document.preferences.fontScale }),
      ...(document.preferences.reduceMotion === undefined ? {} : { reduceMotion: document.preferences.reduceMotion }),
      ...(document.preferences.locale === undefined ? {} : { locale: document.preferences.locale }),
      ...(document.preferences.defaultReportSurface === undefined
        ? {}
        : { defaultReportSurface: document.preferences.defaultReportSurface }),
    },
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    expiresAt: document.expiresAt,
  };
}

export class PublicSyncVersionConflictErrorV1 extends ApiHttpError {
  public constructor(
    public readonly serverDocument: SyncDocumentViewV1,
    public readonly aadContext: SyncAadContextV1,
  ) {
    super(409, "SYNC_VERSION_CONFLICT", "Sync state changed; merge the server document before retrying.");
  }
}

function commandBase(
  actor: SyncActorV1,
  ownerHash: `hmac-sha256:${string}`,
  actorSessionHash: `hmac-sha256:${string}`,
  requestId: string,
  request: unknown,
  clock: SyncClockV1,
): Pick<SyncMutationCommandV1, "actor" | "ownerHash" | "actorSessionHash" | "requestId" | "requestDigest" | "occurredAt" | "auditId" | "auditDeleteAfter"> {
  const occurredAt = clock.now().toISOString();
  return {
    actor,
    ownerHash,
    actorSessionHash,
    requestId,
    requestDigest: syncRequestDigest(request),
    occurredAt,
    auditId: id("saud"),
    auditDeleteAfter: addDays(occurredAt, SYNC_RETENTION_POLICY_V1.payloadFreeAuditDays),
  };
}

export class AccountSyncServiceV1 {
  public constructor(
    private readonly repository: SyncRepositoryV1,
    private readonly deletionHashPepper: string,
    private readonly clock: SyncClockV1 = systemClock,
  ) {
    if (deletionHashPepper.length < 32) {
      throw new ApiHttpError(500, "INVALID_SYNC_HASH_PEPPER", "SYNC_DELETION_HASH_PEPPER must contain at least 32 characters.");
    }
  }

  public grantConsent(actor: SyncActorV1, request: GrantSyncConsentRequestV1): Promise<SyncMutationResponseV1> {
    const occurredAt = this.clock.now().toISOString();
    return this.repository.commit({
      kind: "grant",
      ...commandBase(actor, this.ownerHash(actor.userId), this.sessionHash(actor.sessionId), request.requestId, request, { now: () => new Date(occurredAt) }),
      scopes: request.scopes,
      expiresAt: addDays(occurredAt, SYNC_RETENTION_POLICY_V1.inactiveDataDays),
    });
  }

  public async applyDelta(actor: SyncActorV1, request: ApplySyncDeltaRequestV1): Promise<SyncMutationResponseV1> {
    const occurredAt = this.clock.now().toISOString();
    try {
      return await this.repository.commit({
        kind: "delta",
        ...commandBase(actor, this.ownerHash(actor.userId), this.sessionHash(actor.sessionId), request.requestId, request, { now: () => new Date(occurredAt) }),
        baseVersion: request.baseVersion,
        mutations: request.mutations,
        expiresAt: addDays(occurredAt, SYNC_RETENTION_POLICY_V1.inactiveDataDays),
      });
    } catch (error) {
      if (error instanceof SyncVersionConflictError) {
        throw new PublicSyncVersionConflictErrorV1(
          projectSyncDocumentForBrowserV1(error.serverDocument),
          syncAadContextForUserIdV1(actor.userId),
        );
      }
      throw error;
    }
  }

  public revokeConsent(actor: SyncActorV1, request: RevokeSyncConsentRequestV1): Promise<SyncMutationResponseV1> {
    const occurredAt = this.clock.now().toISOString();
    return this.repository.commit({
      kind: "revoke",
      ...commandBase(actor, this.ownerHash(actor.userId), this.sessionHash(actor.sessionId), request.requestId, request, { now: () => new Date(occurredAt) }),
      reason: request.reason,
      expiresAt: addDays(occurredAt, SYNC_RETENTION_POLICY_V1.deletionReceiptDays),
      deletionReceipt: this.deletionReceipt(actor.userId, occurredAt, "consent_revoked"),
    });
  }

  public deleteData(actor: SyncActorV1, request: DeleteSyncedDataRequestV1): Promise<SyncMutationResponseV1> {
    const occurredAt = this.clock.now().toISOString();
    return this.repository.commit({
      kind: "delete",
      ...commandBase(actor, this.ownerHash(actor.userId), this.sessionHash(actor.sessionId), request.requestId, request, { now: () => new Date(occurredAt) }),
      reason: request.reason,
      deletionReceipt: this.deletionReceipt(actor.userId, occurredAt, request.reason),
    });
  }

  public async snapshot(actor: SyncActorV1): Promise<SyncSnapshotResponseV1> {
    const document = await this.repository.get(actor.userId);
    const aadContext = syncAadContextForUserIdV1(actor.userId);
    if (document && Date.parse(document.expiresAt) <= this.clock.now().getTime()) {
      return { document: null, encryption: SYNC_ENCRYPTION_CAPABILITY_V1, aadContext };
    }
    return {
      document: document ? projectSyncDocumentForBrowserV1(document) : null,
      encryption: SYNC_ENCRYPTION_CAPABILITY_V1,
      aadContext,
    };
  }

  public async exportData(actor: SyncActorV1): Promise<SyncDataExportV1> {
    const snapshot = await this.snapshot(actor);
    return {
      schemaVersion: SYNC_EXPORT_SCHEMA_V1,
      exportedAt: this.clock.now().toISOString(),
      retentionPolicy: SYNC_RETENTION_POLICY_V1,
      encryption: SYNC_ENCRYPTION_CAPABILITY_V1,
      aadContext: snapshot.aadContext,
      document: snapshot.document,
    };
  }

  public async sweepExpired(
    actor: SyncActorV1,
    limit = 50,
    options: { readonly deadlineAtEpochMs?: number } = {},
  ): Promise<SyncRetentionSweepResultV1> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 80) {
      throw new ApiHttpError(400, "INVALID_RETENTION_LIMIT", "Retention sweep limit must be 1-80.");
    }
    const occurredAt = this.clock.now().toISOString();
    return this.repository.deleteExpired({
      actorSessionHash: this.sessionHash(actor.sessionId),
      occurredAt,
      auditDeleteAfter: addDays(occurredAt, SYNC_RETENTION_POLICY_V1.payloadFreeAuditDays),
      limit,
      ...(options.deadlineAtEpochMs === undefined ? {} : { deadlineAtEpochMs: options.deadlineAtEpochMs }),
      makeReceipt: (userId) => this.deletionReceipt(userId, occurredAt, "retention_expired"),
    });
  }

  private deletionReceipt(
    userId: string,
    deletedAt: string,
    reason: SyncDeletionReceiptV1["reason"],
  ): SyncDeletionReceiptV1 {
    const ownerHash = this.ownerHash(userId).slice("hmac-sha256:".length);
    return {
      receiptId: id("sdel"),
      ownerHash: `hmac-sha256:${ownerHash}`,
      deletedAt,
      deleteAfter: addDays(deletedAt, SYNC_RETENTION_POLICY_V1.deletionReceiptDays),
      reason,
    };
  }

  private ownerHash(userId: string): `hmac-sha256:${string}` {
    return this.domainHash("namespring.sync.owner.v1", userId);
  }

  private sessionHash(sessionId: string): `hmac-sha256:${string}` {
    return this.domainHash("namespring.sync.session.v1", sessionId);
  }

  private domainHash(domain: string, value: string): `hmac-sha256:${string}` {
    const digest = createHmac("sha256", this.deletionHashPepper)
      .update(domain, "utf8")
      .update("\0", "utf8")
      .update(value, "utf8")
      .digest("hex");
    return `hmac-sha256:${digest}`;
  }
}

/**
 * Aggregate-only operations service. Its narrow repository capability cannot
 * load an account document, mutate sync data, or participate in a sweep.
 */
export class SyncRetentionStatusServiceV1 {
  public constructor(
    private readonly repository: SyncRetentionStatusRepositoryV1,
    private readonly maintenance: MaintenanceStatusReaderV1,
    private readonly clock: SyncClockV1 = systemClock,
  ) {}

  public async readStatus(): Promise<SyncRetentionStatusV1> {
    const observedAtDate = this.clock.now();
    if (!(observedAtDate instanceof Date) || !Number.isFinite(observedAtDate.getTime())) {
      throw new ApiHttpError(500, "SYNC_RETENTION_STATUS_TIME_INVALID", "Retention status time is invalid.");
    }
    const observedAt = observedAtDate.toISOString();
    const [due, maintenance] = await Promise.all([
      this.repository.readRetentionDueStatus(observedAt),
      this.maintenance.readStatus({ job: "sync_retention", now: observedAtDate }),
    ]);
    if (!Number.isSafeInteger(due.candidateCount)
      || due.candidateCount < 0
      || due.candidateCount > SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1
      || due.candidateCountCap !== SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1
      || typeof due.hasMore !== "boolean"
      || (due.hasMore && due.candidateCount !== SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1)
      || (due.candidateCount === 0) !== (due.oldestDueAt === null)
      || (due.oldestDueAt !== null && !Number.isFinite(Date.parse(due.oldestDueAt)))) {
      throw new ApiHttpError(503, "SYNC_RETENTION_STATUS_INVALID", "Retention due aggregate is invalid.");
    }
    return {
      schemaVersion: SYNC_RETENTION_STATUS_SCHEMA_V1,
      observedAt,
      due: {
        candidateCount: due.candidateCount,
        candidateCountCap: SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1,
        hasMore: due.hasMore,
        oldestDueAt: due.oldestDueAt,
      },
      maintenance: {
        state: maintenance.state,
        heartbeatAt: maintenance.heartbeatAt?.toISOString() ?? null,
        leaseExpiresAt: maintenance.leaseExpiresAt?.toISOString() ?? null,
        lastCompletedAt: maintenance.lastCompletedAt?.toISOString() ?? null,
        lastOutcome: maintenance.lastOutcome,
        lastAggregate: maintenance.lastAggregate === null ? null : {
          scanned: maintenance.lastAggregate.scanned,
          deleted: maintenance.lastAggregate.deleted,
          skipped: maintenance.lastAggregate.skipped,
          failed: maintenance.lastAggregate.failed,
          deadlineReached: maintenance.lastAggregate.deadlineReached,
        },
      },
    };
  }
}
