import type {
  ActivateContentArtifactRequestV1,
  ApproveContentArtifactRequestV1,
  ContentArtifactV1,
  ContentAuditEventV1,
  ContentMutationResponseV1,
  ContentChannelV1,
  FinalizeLocalContentExportRequestV1,
  LocalContentExportCompletionV1,
  LocalContentExportPageRequestV1,
  LocalContentExportPageV1,
  LocalContentExportSessionV1,
  ListContentArtifactsRequestV1,
  ListContentArtifactsResponseV1,
  RegisterContentArtifactRequestV1,
  RetireContentArtifactRequestV1,
  ReviewContentArtifactRequestV1,
  RollbackContentArtifactRequestV1,
} from "../../shared/types/content-lifecycle.js";
import {
  CONTENT_ARTIFACT_SCHEMA_V1,
  CONTENT_AUDIT_EVENT_SCHEMA_V1,
  LOCAL_CONTENT_EXPORT_COMPLETION_SCHEMA_V1,
  LOCAL_CONTENT_EXPORT_CHUNK_ITEMS_V1,
  LOCAL_CONTENT_EXPORT_HARD_MAX_ARTIFACTS_V1,
  LOCAL_CONTENT_EXPORT_PAGE_SCHEMA_V1,
  LOCAL_CONTENT_EXPORT_SESSION_SCHEMA_V1,
} from "../../shared/types/content-lifecycle.js";
import { ApiHttpError } from "./http.js";
import {
  assertContentAuditHmacKeyringV1,
  contentAuditPrivacyFieldsV1,
  getContentAuditHmacKeyringV1,
  type ContentAuditHmacKeyringV1,
} from "./content-audit-privacy.js";
import {
  assertArtifactDeliverable,
  canonicalJson,
  contentChannelKey,
  newOpaqueId,
  sha256Digest,
  validateContentPayloadForKind,
} from "./content-validation.js";
import type {
  ContentMutationCommandV1,
  ContentRepositoryV1,
} from "./content-repository.js";
import { CONTENT_EXPORT_ARTIFACT_FETCH_BATCH_LIMIT_V1 } from "./content-repository.js";

export interface ContentActorV1 {
  readonly userId: string;
  readonly sessionId: string;
}

export interface ContentServiceClockV1 {
  now(): Date;
}

const systemClock: ContentServiceClockV1 = { now: () => new Date() };
const EXPORT_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
const EXPORT_CHUNK_ITEMS = LOCAL_CONTENT_EXPORT_CHUNK_ITEMS_V1;
const EXPORT_PAGE_BYTE_LIMIT = 1_500_000 as const;
export const CONTENT_ADMIN_LIST_RESPONSE_MAX_BYTES = 1_250_000 as const;
export const CONTENT_EXPORT_LARGE_CATALOG_THRESHOLD_V1 = 2_500 as const;
export const CONTENT_EXPORT_HARD_MAX_ACTIVE_ARTIFACTS_V1 = LOCAL_CONTENT_EXPORT_HARD_MAX_ARTIFACTS_V1;
export const CONTENT_EXPORT_OPERATIONAL_STATE_V1 = "large_catalog_v1_reviewed" as const;

export interface ContentExportOperationalPolicyV1 {
  readonly largeCatalogEnabled: boolean;
  readonly maxActiveArtifacts: number;
}

export function contentExportOperationalPolicyFromEnvironmentV1(
  environment: NodeJS.ProcessEnv = process.env,
): ContentExportOperationalPolicyV1 {
  const enabled = environment.CONTENT_EXPORT_OPERATIONAL_STATE === CONTENT_EXPORT_OPERATIONAL_STATE_V1;
  if (!enabled) {
    return {
      largeCatalogEnabled: false,
      maxActiveArtifacts: CONTENT_EXPORT_LARGE_CATALOG_THRESHOLD_V1,
    };
  }
  const rawMax = environment.CONTENT_EXPORT_MAX_ACTIVE_ARTIFACTS;
  if (!rawMax || !/^[1-9][0-9]{0,5}$/u.test(rawMax)) {
    throw new ApiHttpError(
      503,
      "CONTENT_EXPORT_OPERATIONAL_CONFIG_INVALID",
      "Large content export requires an explicit active-artifact ceiling.",
    );
  }
  const maxActiveArtifacts = Number(rawMax);
  if (!Number.isSafeInteger(maxActiveArtifacts)
    || maxActiveArtifacts <= CONTENT_EXPORT_LARGE_CATALOG_THRESHOLD_V1
    || maxActiveArtifacts > CONTENT_EXPORT_HARD_MAX_ACTIVE_ARTIFACTS_V1) {
    throw new ApiHttpError(
      503,
      "CONTENT_EXPORT_OPERATIONAL_CONFIG_INVALID",
      "Large content export active-artifact ceiling is outside the reviewed bound.",
    );
  }
  return { largeCatalogEnabled: true, maxActiveArtifacts };
}

function assertExportCatalogAllowedV1(
  artifactCount: number,
  policy: ContentExportOperationalPolicyV1,
): void {
  if (!Number.isSafeInteger(artifactCount) || artifactCount < 0) {
    throw new ApiHttpError(503, "CONTENT_EXPORT_COUNT_INVALID", "Active export count is invalid.");
  }
  if (artifactCount > CONTENT_EXPORT_HARD_MAX_ACTIVE_ARTIFACTS_V1) {
    throw new ApiHttpError(
      503,
      "CONTENT_EXPORT_CATALOG_HARD_LIMIT",
      "Active local content exceeds the reviewed export architecture bound.",
    );
  }
  if (artifactCount > CONTENT_EXPORT_LARGE_CATALOG_THRESHOLD_V1
    && (!policy.largeCatalogEnabled || artifactCount > policy.maxActiveArtifacts)) {
    throw new ApiHttpError(
      503,
      "CONTENT_EXPORT_LARGE_CATALOG_NOT_ENABLED",
      "Large local export is disabled until its deployment ceiling and runbook are explicitly enabled.",
    );
  }
}

function nowIso(clock: ContentServiceClockV1): string {
  return clock.now().toISOString();
}

function commandBase(
  actor: ContentActorV1,
  requestId: string,
  clock: ContentServiceClockV1,
  auditHmacKeyring: ContentAuditHmacKeyringV1,
): Pick<
  ContentMutationCommandV1,
  | "requestId"
  | "actor"
  | "occurredAt"
  | "auditId"
  | "auditActorSubject"
  | "auditActorSubjects"
  | "auditSessionSubject"
  | "auditRetainedKeyIds"
  | "auditDeleteAfter"
> {
  const occurredAt = nowIso(clock);
  const auditPrivacy = contentAuditPrivacyFieldsV1(actor, occurredAt, auditHmacKeyring);
  return {
    requestId,
    actor,
    occurredAt,
    auditId: newOpaqueId("caud"),
    auditActorSubject: auditPrivacy.actorSubject,
    auditActorSubjects: auditPrivacy.actorSubjects,
    auditSessionSubject: auditPrivacy.sessionSubject,
    auditRetainedKeyIds: auditPrivacy.retainedKeyIds,
    auditDeleteAfter: auditPrivacy.deleteAfter,
  };
}

export class ContentLifecycleServiceV1 {
  private readonly auditHmacKeyring: ContentAuditHmacKeyringV1;

  public constructor(
    private readonly repository: ContentRepositoryV1,
    private readonly clock: ContentServiceClockV1 = systemClock,
    auditHmacKeyring: ContentAuditHmacKeyringV1 = getContentAuditHmacKeyringV1(),
    private readonly exportPolicyProvider: () => ContentExportOperationalPolicyV1 =
      contentExportOperationalPolicyFromEnvironmentV1,
  ) {
    this.auditHmacKeyring = assertContentAuditHmacKeyringV1(auditHmacKeyring);
  }

  public async register(
    actor: ContentActorV1,
    request: RegisterContentArtifactRequestV1,
  ): Promise<ContentMutationResponseV1> {
    const payload = validateContentPayloadForKind(request.channel.kind, request.payload);
    if (sha256Digest(payload) !== request.contentDigest) {
      throw new ApiHttpError(400, "CONTENT_DIGEST_MISMATCH", "contentDigest does not match the validated payload.");
    }
    const occurredAt = nowIso(this.clock);
    const base = commandBase(actor, request.requestId, { now: () => new Date(occurredAt) }, this.auditHmacKeyring);
    const importedAt = Date.parse(request.provenance.source.importedAt);
    const gateCheckedAt = Date.parse(request.provenance.gate.checkedAt);
    const registeredAt = Date.parse(occurredAt);
    const generatedAt = request.provenance.generation
      ? Date.parse(request.provenance.generation.generatedAt)
      : importedAt;
    if (generatedAt > importedAt || importedAt > gateCheckedAt || gateCheckedAt > registeredAt) {
      throw new ApiHttpError(
        400,
        "CONTENT_PROVENANCE_TIME_ORDER",
        "Content provenance must satisfy generatedAt <= importedAt <= gate.checkedAt <= registeredAt.",
      );
    }
    const artifact: ContentArtifactV1 = {
      schemaVersion: CONTENT_ARTIFACT_SCHEMA_V1,
      artifactId: request.artifactId,
      channel: request.channel,
      version: request.version,
      lifecycle: "draft",
      revision: 1,
      contentDigest: request.contentDigest,
      payload,
      provenance: request.provenance,
      registeredAt: occurredAt,
      registeredBy: base.auditActorSubject,
      ...(request.supersedesArtifactId ? { supersedesArtifactId: request.supersedesArtifactId } : {}),
      activations: [],
    };
    return this.repository.commit({
      kind: "register",
      ...base,
      requestDigest: sha256Digest(request),
      artifact,
    });
  }

  public review(actor: ContentActorV1, request: ReviewContentArtifactRequestV1): Promise<ContentMutationResponseV1> {
    return this.repository.commit({
      kind: "review",
      ...commandBase(actor, request.requestId, this.clock, this.auditHmacKeyring),
      requestDigest: sha256Digest(request),
      artifactId: request.artifactId,
      expectedRevision: request.expectedRevision,
      notesDigest: request.notesDigest,
    });
  }

  public approve(actor: ContentActorV1, request: ApproveContentArtifactRequestV1): Promise<ContentMutationResponseV1> {
    return this.repository.commit({
      kind: "approve",
      ...commandBase(actor, request.requestId, this.clock, this.auditHmacKeyring),
      requestDigest: sha256Digest(request),
      artifactId: request.artifactId,
      expectedRevision: request.expectedRevision,
    });
  }

  public activate(actor: ContentActorV1, request: ActivateContentArtifactRequestV1): Promise<ContentMutationResponseV1> {
    return this.repository.commit({
      kind: "activate",
      ...commandBase(actor, request.requestId, this.clock, this.auditHmacKeyring),
      requestDigest: sha256Digest(request),
      artifactId: request.artifactId,
      expectedRevision: request.expectedRevision,
      reason: request.reason,
      activationId: newOpaqueId("cact"),
    });
  }

  public retire(actor: ContentActorV1, request: RetireContentArtifactRequestV1): Promise<ContentMutationResponseV1> {
    return this.repository.commit({
      kind: "retire",
      ...commandBase(actor, request.requestId, this.clock, this.auditHmacKeyring),
      requestDigest: sha256Digest(request),
      artifactId: request.artifactId,
      expectedRevision: request.expectedRevision,
      reason: request.reason,
    });
  }

  public rollback(actor: ContentActorV1, request: RollbackContentArtifactRequestV1): Promise<ContentMutationResponseV1> {
    return this.repository.commit({
      kind: "rollback",
      ...commandBase(actor, request.requestId, this.clock, this.auditHmacKeyring),
      requestDigest: sha256Digest(request),
      artifactId: request.artifactId,
      expectedRevision: request.expectedRevision,
      reason: request.reason,
      activationId: newOpaqueId("cact"),
    });
  }

  public async getArtifactForAdmin(artifactId: string): Promise<ContentArtifactV1> {
    const artifact = await this.repository.getArtifact(artifactId);
    if (!artifact) throw new ApiHttpError(404, "CONTENT_ARTIFACT_NOT_FOUND", "Content artifact was not found.");
    return artifact;
  }

  public async listArtifactsForAdmin(
    request: ListContentArtifactsRequestV1,
  ): Promise<ListContentArtifactsResponseV1> {
    const page = await this.repository.listArtifacts(
      request.lifecycle,
      request.afterArtifactId,
      request.limit ?? 10,
    );
    const artifacts: ContentArtifactV1[] = [];
    for (const [index, artifact] of page.artifacts.entries()) {
      const candidate = [...artifacts, artifact];
      const candidateCursor = index < page.artifacts.length - 1
        ? artifact.artifactId
        : page.nextCursor;
      const responseBytes = Buffer.byteLength(JSON.stringify({
        artifacts: candidate,
        nextCursor: candidateCursor,
      }), "utf8");
      if (responseBytes > CONTENT_ADMIN_LIST_RESPONSE_MAX_BYTES) {
        if (artifacts.length === 0) {
          throw new ApiHttpError(
            503,
            "CONTENT_ADMIN_ARTIFACT_RESPONSE_TOO_LARGE",
            "The stored content artifact exceeds the bounded admin response contract.",
          );
        }
        return {
          artifacts,
          nextCursor: artifacts.at(-1)?.artifactId ?? null,
        };
      }
      artifacts.push(artifact);
    }
    return { artifacts, nextCursor: page.nextCursor };
  }

  /** Paid/server callers get only fully active content; local-only content is never served here. */
  public async getActiveServerContent(channel: ContentChannelV1): Promise<ContentArtifactV1> {
    if (channel.audience === "free_local") {
      throw new ApiHttpError(403, "LOCAL_CONTENT_SERVER_DELIVERY_FORBIDDEN", "Free/local content has no runtime server delivery path.");
    }
    const artifact = await this.repository.getActive(channel);
    if (!artifact) {
      throw new ApiHttpError(404, "ACTIVE_CONTENT_NOT_FOUND", "No active server content exists for this key.");
    }
    if (artifact.channel.audience === "free_local") {
      throw new ApiHttpError(
        403,
        "LOCAL_CONTENT_SERVER_DELIVERY_FORBIDDEN",
        "Free/local content must be consumed from a packaged build asset.",
      );
    }
    assertArtifactDeliverable(artifact, "paid_server");
    return artifact;
  }

  /** Creates a metadata-only immutable snapshot; payloads are fetched in bounded pages. */
  public async createLocalExportSession(actor: ContentActorV1): Promise<LocalContentExportSessionV1> {
    const revisionBefore = await this.repository.getCatalogRevision();
    const [freeCount, sharedCount] = await Promise.all([
      this.repository.countActiveExportEntries("free_local"),
      this.repository.countActiveExportEntries("shared"),
    ]);
    const expectedArtifactCount = freeCount + sharedCount;
    assertExportCatalogAllowedV1(expectedArtifactCount, this.exportPolicyProvider());
    const [freeEntries, sharedEntries] = await Promise.all([
      this.repository.listActiveExportEntries("free_local"),
      this.repository.listActiveExportEntries("shared"),
    ]);
    const revisionAfter = await this.repository.getCatalogRevision();
    if (revisionBefore !== revisionAfter
      || freeEntries.length !== freeCount
      || sharedEntries.length !== sharedCount) {
      throw new ApiHttpError(409, "CONTENT_EXPORT_SNAPSHOT_CHANGED", "Active content changed while listing export metadata.");
    }
    const entries = [...freeEntries, ...sharedEntries].sort((left, right) => {
      const leftKey = `${left.audience}|${left.kind}|${left.locale}|${left.contentKey}`;
      const rightKey = `${right.audience}|${right.kind}|${right.locale}|${right.contentKey}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
    if (entries.length === 0) {
      throw new ApiHttpError(409, "NO_ACTIVE_LOCAL_CONTENT", "No reviewed and active local content is available for export.");
    }
    const runtimeKeys = new Set<string>();
    for (const entry of entries) {
      const runtimeKey = `${entry.kind}|${entry.locale}|${entry.contentKey}`;
      if (runtimeKeys.has(runtimeKey)) {
        throw new ApiHttpError(
          409,
          "LOCAL_EXPORT_KEY_COLLISION",
          "free_local and shared content cannot define the same packaged runtime key.",
        );
      }
      runtimeKeys.add(runtimeKey);
    }
    const createdAt = nowIso(this.clock);
    const auditPrivacy = contentAuditPrivacyFieldsV1(actor, createdAt, this.auditHmacKeyring);
    const exportId = newOpaqueId("cexp");
    const assetSetDigest = sha256Digest(entries);
    const session: LocalContentExportSessionV1 = {
      schemaVersion: LOCAL_CONTENT_EXPORT_SESSION_SCHEMA_V1,
      exportId,
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + EXPORT_SNAPSHOT_TTL_MS).toISOString(),
      catalogRevision: revisionAfter,
      artifactCount: entries.length,
      chunkCount: Math.ceil(entries.length / EXPORT_CHUNK_ITEMS),
      maxPageItems: EXPORT_CHUNK_ITEMS,
      maxPageBytes: EXPORT_PAGE_BYTE_LIMIT,
      assetSetDigest,
      runtimeBoundary: "authenticated_build_pipeline_only",
    };
    await this.repository.createLocalExportSnapshot(session, entries, auditPrivacy.actorSubjects);
    await this.repository.appendAudit({
      schemaVersion: CONTENT_AUDIT_EVENT_SCHEMA_V1,
      auditId: newOpaqueId("caud"),
      requestId: exportId,
      action: "local_export.manifest_created",
      occurredAt: createdAt,
      actorSubject: auditPrivacy.actorSubject,
      sessionSubject: auditPrivacy.sessionSubject,
      deleteAfter: auditPrivacy.deleteAfter,
      artifactId: "local-export",
      channelKey: "local-export",
      reason: `snapshot:${revisionAfter};entries:${entries.length}`,
      contentDigest: assetSetDigest,
    });
    return session;
  }

  public async getLocalExportPage(
    actor: ContentActorV1,
    request: LocalContentExportPageRequestV1,
  ): Promise<LocalContentExportPageV1> {
    const cursor = request.cursor ?? { chunkIndex: 0, offset: 0 };
    const requesterSubjects = contentAuditPrivacyFieldsV1(
      actor,
      nowIso(this.clock),
      this.auditHmacKeyring,
    ).actorSubjects;
    const { session, chunk } = await this.repository.getLocalExportChunk(
      request.exportId,
      cursor.chunkIndex,
      requesterSubjects,
    );
    if (cursor.chunkIndex >= session.chunkCount || cursor.offset >= chunk.entries.length) {
      throw new ApiHttpError(400, "CONTENT_EXPORT_CURSOR_INVALID", "Export cursor is outside the immutable snapshot.");
    }
    const artifacts: LocalContentExportPageV1["artifacts"][number][] = [];
    let pageBytes = 0;
    const remainingEntries = chunk.entries.slice(cursor.offset);
    exportBatchLoop: for (
      let batchOffset = 0;
      batchOffset < remainingEntries.length;
      batchOffset += CONTENT_EXPORT_ARTIFACT_FETCH_BATCH_LIMIT_V1
    ) {
      const batchEntries = remainingEntries.slice(
        batchOffset,
        batchOffset + CONTENT_EXPORT_ARTIFACT_FETCH_BATCH_LIMIT_V1,
      );
      const batchArtifacts = await this.repository.getExportArtifacts(batchEntries);
      for (let index = 0; index < batchEntries.length; index += 1) {
        const entry = batchEntries[index]!;
        const artifact = batchArtifacts[index];
        const activation = artifact?.activations.at(-1);
        if (
          !artifact
          || artifact.lifecycle !== "active"
          || artifact.artifactId !== entry.artifactId
          || contentChannelKey(artifact.channel) !== contentChannelKey({
            contentKey: entry.contentKey,
            kind: entry.kind,
            audience: entry.audience,
            locale: entry.locale,
          })
          || artifact.contentDigest !== entry.contentDigest
          || activation?.activationId !== entry.activationId
        ) {
          throw new ApiHttpError(409, "CONTENT_EXPORT_SNAPSHOT_INVALIDATED", "Active content changed; start a new export.");
        }
        assertArtifactDeliverable(artifact);
        const item = { entry, payload: artifact.payload } as const;
        const itemBytes = Buffer.byteLength(canonicalJson(item), "utf8");
        if (artifacts.length > 0 && pageBytes + itemBytes > session.maxPageBytes) break exportBatchLoop;
        if (itemBytes > session.maxPageBytes) {
          throw new ApiHttpError(413, "CONTENT_EXPORT_ARTIFACT_TOO_LARGE", "A single artifact exceeds the export page budget.");
        }
        artifacts.push(item);
        pageBytes += itemBytes;
      }
    }
    if (artifacts.length === 0) {
      throw new ApiHttpError(503, "CONTENT_EXPORT_PAGE_EMPTY", "Export page could not make progress within its byte budget.");
    }
    const consumedOffset = cursor.offset + artifacts.length;
    const nextCursor = consumedOffset < chunk.entries.length
      ? { chunkIndex: cursor.chunkIndex, offset: consumedOffset }
      : cursor.chunkIndex + 1 < session.chunkCount
        ? { chunkIndex: cursor.chunkIndex + 1, offset: 0 }
        : null;
    const pageDigest = sha256Digest({
      exportId: request.exportId,
      catalogRevision: session.catalogRevision,
      assetSetDigest: session.assetSetDigest,
      artifacts,
      nextCursor,
    });
    await this.repository.recordLocalExportPageDelivery({
      exportId: request.exportId,
      catalogRevision: session.catalogRevision,
      requestCursor: cursor,
      nextCursor,
      pageDigest,
      pageArtifactCount: artifacts.length,
      occurredAt: nowIso(this.clock),
      requesterSubjects,
    });
    return {
      schemaVersion: LOCAL_CONTENT_EXPORT_PAGE_SCHEMA_V1,
      exportId: request.exportId,
      catalogRevision: session.catalogRevision,
      assetSetDigest: session.assetSetDigest,
      artifacts,
      nextCursor,
      pageBytes,
      pageDigest,
    };
  }

  public async finalizeLocalExport(
    actor: ContentActorV1,
    request: FinalizeLocalContentExportRequestV1,
  ): Promise<LocalContentExportCompletionV1> {
    const finalizedAt = nowIso(this.clock);
    const auditPrivacy = contentAuditPrivacyFieldsV1(actor, finalizedAt, this.auditHmacKeyring);
    const { session } = await this.repository.getLocalExportChunk(
      request.exportId,
      0,
      auditPrivacy.actorSubjects,
    );
    if (
      request.observedArtifactCount !== session.artifactCount
      || request.observedAssetSetDigest !== session.assetSetDigest
    ) {
      throw new ApiHttpError(409, "CONTENT_EXPORT_OBSERVATION_MISMATCH", "Build observations do not match the sealed snapshot.");
    }
    await this.repository.assertLocalExportDeliveryComplete(
      request.exportId,
      session.catalogRevision,
      auditPrivacy.actorSubjects,
    );
    const receiptMaterial = {
      schemaVersion: LOCAL_CONTENT_EXPORT_COMPLETION_SCHEMA_V1,
      exportId: session.exportId,
      catalogRevision: session.catalogRevision,
      artifactCount: session.artifactCount,
      assetSetDigest: session.assetSetDigest,
      finalizedAt,
      publishGate: "recheck_immediately_before_asset_publication" as const,
    };
    const completion: LocalContentExportCompletionV1 = {
      ...receiptMaterial,
      receiptDigest: sha256Digest(receiptMaterial),
    };
    await this.repository.appendAudit({
      schemaVersion: CONTENT_AUDIT_EVENT_SCHEMA_V1,
      auditId: newOpaqueId("caud"),
      requestId: request.exportId,
      action: "local_export.finalized",
      occurredAt: finalizedAt,
      actorSubject: auditPrivacy.actorSubject,
      sessionSubject: auditPrivacy.sessionSubject,
      deleteAfter: auditPrivacy.deleteAfter,
      artifactId: "local-export-finalized",
      channelKey: "local-export",
      reason: `finalized-revision:${session.catalogRevision}`,
      contentDigest: session.assetSetDigest,
    });
    return completion;
  }
}

export function createContentAuditEvent(
  command: ContentMutationCommandV1,
  artifact: ContentArtifactV1,
  action: ContentAuditEventV1["action"],
  fromLifecycle?: ContentArtifactV1["lifecycle"],
  reason?: string,
): ContentAuditEventV1 {
  return {
    schemaVersion: CONTENT_AUDIT_EVENT_SCHEMA_V1,
    auditId: command.auditId,
    requestId: command.requestId,
    action,
    occurredAt: command.occurredAt,
    actorSubject: command.auditActorSubject,
    sessionSubject: command.auditSessionSubject,
    deleteAfter: command.auditDeleteAfter,
    artifactId: artifact.artifactId,
    channelKey: contentChannelKey(artifact.channel),
    ...(fromLifecycle ? { fromLifecycle } : {}),
    toLifecycle: artifact.lifecycle,
    ...(reason ? { reason } : {}),
    contentDigest: artifact.contentDigest,
  };
}
