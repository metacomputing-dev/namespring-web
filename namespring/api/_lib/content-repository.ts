import { createHash } from "node:crypto";
import { Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import type {
  ActiveContentPointerV1,
  ContentArtifactV1,
  ContentAuditEventV1,
  ContentMutationResponseV1,
  ContentLifecycleV1,
  ListContentArtifactsResponseV1,
  LocalContentExportCursorV1,
  LocalContentExportEntryV1,
  LocalContentExportSessionV1,
  Sha256DigestV1,
} from "../../shared/types/content-lifecycle.js";
import {
  LOCAL_CONTENT_EXPORT_CHUNK_ITEMS_V1,
  LOCAL_CONTENT_EXPORT_HARD_MAX_ARTIFACTS_V1,
  LOCAL_CONTENT_EXPORT_MAX_CHUNKS_V1,
  LOCAL_CONTENT_EXPORT_SESSION_SCHEMA_V1,
} from "../../shared/types/content-lifecycle.js";
import { ApiHttpError } from "./http.js";
import { getFirestoreDb } from "./firestore-admin.js";
import { createContentAuditEvent, type ContentActorV1 } from "./content-service.js";
import {
  assertContentAuditSubjectKeyRetainedV1,
  contentAuditSubjectKeyIdV1,
} from "./content-audit-privacy.js";
import {
  assertArtifactDeliverable,
  assertStoredContentGateAttestationV1,
  contentChannelKey,
  validateContentPayloadForKind,
} from "./content-validation.js";

const ARTIFACTS = "content_artifacts_v1";
const ACTIVE_CHANNELS = "active_content_channels_v1";
const REQUEST_RECEIPTS = "content_request_receipts_v1";
const AUDIT_EVENTS = "content_audit_events_v1";
const CATALOG_STATE = "content_catalog_state_v1";
const EXPORT_SNAPSHOTS = "content_export_snapshots_v1";
const EXPORT_CHUNKS = "content_export_chunks_v1";
const EXPORT_PROGRESS = "content_export_progress_v1";
const EXPORT_PROGRESS_DOCUMENT = "delivery";
const CATALOG_STATE_DOCUMENT = "active-local-catalog";

/**
 * Deliberately below Firestore's per-commit write ceiling and 10 MiB request
 * ceiling. A 100-entry metadata chunk can be sizeable, so count alone must not
 * be pushed up to the platform maximum.
 */
export const CONTENT_EXPORT_CHUNK_WRITE_BATCH_LIMIT_V1 = 50 as const;
export const CONTENT_EXPORT_ARTIFACT_FETCH_BATCH_LIMIT_V1 = 25 as const;
export const CONTENT_ACTIVATION_RECEIPT_INLINE_LIMIT_V1 = 64 as const;

export function partitionContentExportChunkWritesV1<T>(values: readonly T[]): readonly (readonly T[])[] {
  const batches: T[][] = [];
  for (let offset = 0; offset < values.length; offset += CONTENT_EXPORT_CHUNK_WRITE_BATCH_LIMIT_V1) {
    batches.push(values.slice(offset, offset + CONTENT_EXPORT_CHUNK_WRITE_BATCH_LIMIT_V1));
  }
  return batches;
}

interface ContentCatalogStateV1 {
  readonly revision: number;
  readonly updatedAt: string;
}

interface LocalContentExportChunkV1 {
  readonly exportId: string;
  readonly chunkIndex: number;
  readonly entries: readonly LocalContentExportEntryV1[];
  readonly expiresAt: string;
}

interface LocalContentExportProgressV1 {
  readonly schemaVersion: "namespring.local-content-export-progress.v1";
  readonly exportId: string;
  /** The only cursor accepted for a new page; null means every artifact was served. */
  readonly nextCursor: LocalContentExportCursorV1 | null;
  readonly servedArtifactCount: number;
  readonly lastRequestCursor: LocalContentExportCursorV1 | null;
  readonly lastNextCursor: LocalContentExportCursorV1 | null;
  readonly lastPageDigest: Sha256DigestV1 | null;
  readonly lastPageArtifactCount: number;
  readonly updatedAt: string;
  readonly expiresAt: string;
}

type StoredLocalContentExportSessionV1 = Omit<LocalContentExportSessionV1, "expiresAt"> & {
  readonly expiresAt: Timestamp;
  /** Key-rotation-safe content-domain HMACs, never a raw account identifier. */
  readonly ownerSubjects: readonly ContentAuditEventV1["actorSubject"][];
};
type StoredLocalContentExportChunkV1 = Omit<LocalContentExportChunkV1, "expiresAt"> & { readonly expiresAt: Timestamp };
type StoredLocalContentExportProgressV1 = Omit<LocalContentExportProgressV1, "expiresAt"> & { readonly expiresAt: Timestamp };
type StoredContentAuditEventV1 = Omit<ContentAuditEventV1, "deleteAfter"> & { readonly deleteAfter: Timestamp };

function assertExportOwnerSubjects(
  subjects: readonly ContentAuditEventV1["actorSubject"][],
  code = "CONTENT_EXPORT_OWNER_INVALID",
): void {
  if (subjects.length < 1 || subjects.length > 8 || new Set(subjects).size !== subjects.length) {
    throw new ApiHttpError(503, code, "Export snapshot owner metadata is invalid.");
  }
  for (const subject of subjects) {
    if (!/^hmac-sha256:v1:[A-Za-z0-9._-]{1,64}:[a-f0-9]{64}$/u.test(subject)) {
      throw new ApiHttpError(503, code, "Export snapshot owner metadata is invalid.");
    }
  }
}

function assertExportOwnerAccess(
  stored: StoredLocalContentExportSessionV1,
  requesterSubjects: readonly ContentAuditEventV1["actorSubject"][],
): void {
  assertExportOwnerSubjects(stored.ownerSubjects);
  assertExportOwnerSubjects(requesterSubjects, "CONTENT_EXPORT_REQUESTER_INVALID");
  if (!requesterSubjects.some((subject) => stored.ownerSubjects.includes(subject))) {
    // Do not reveal whether an opaque export ID belongs to another administrator.
    throw new ApiHttpError(404, "CONTENT_EXPORT_SNAPSHOT_NOT_FOUND", "Export snapshot or cursor was not found.");
  }
}

function encodeExportSession(
  session: LocalContentExportSessionV1,
  ownerSubjects: readonly ContentAuditEventV1["actorSubject"][],
): StoredLocalContentExportSessionV1 {
  assertExportOwnerSubjects(ownerSubjects);
  return { ...session, expiresAt: Timestamp.fromDate(new Date(session.expiresAt)), ownerSubjects };
}

function exportSnapshotCorrupt(message: string): never {
  throw new ApiHttpError(503, "CONTENT_EXPORT_SNAPSHOT_CORRUPT", message);
}

function strictStoredRecord(value: unknown, expectedKeys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return exportSnapshotCorrupt(`${label} is not a plain record.`);
  }
  const prototype = Object.getPrototypeOf(value);
  const record = value as Record<string, unknown>;
  if ((prototype !== Object.prototype && prototype !== null)
    || Object.keys(record).sort().join("|") !== [...expectedKeys].sort().join("|")) {
    return exportSnapshotCorrupt(`${label} has an invalid shape.`);
  }
  return record;
}

function exactStoredTimestamp(value: unknown, label: string): { readonly timestamp: Timestamp; readonly iso: string } {
  if (!(value instanceof Timestamp)) {
    return exportSnapshotCorrupt(`${label} must be a Firestore Timestamp.`);
  }
  const date = value.toDate();
  if (!Number.isFinite(date.getTime()) || !Timestamp.fromDate(date).isEqual(value)) {
    return exportSnapshotCorrupt(`${label} must use exact millisecond precision.`);
  }
  return { timestamp: value, iso: date.toISOString() };
}

function decodeExportSession(value: unknown, expectedExportId: string): LocalContentExportSessionV1 {
  const data = strictStoredRecord(value, [
    "schemaVersion", "exportId", "createdAt", "expiresAt", "catalogRevision", "artifactCount",
    "chunkCount", "maxPageItems", "maxPageBytes", "assetSetDigest", "runtimeBoundary", "ownerSubjects",
  ], "Export snapshot");
  const createdAt = typeof data.createdAt === "string" ? Date.parse(data.createdAt) : Number.NaN;
  const expiresAt = exactStoredTimestamp(data.expiresAt, "Export snapshot expiresAt").iso;
  if (data.schemaVersion !== LOCAL_CONTENT_EXPORT_SESSION_SCHEMA_V1
    || data.exportId !== expectedExportId
    || typeof data.exportId !== "string"
    || !CONTENT_EXPORT_IDENTIFIER.test(data.exportId)
    || typeof data.createdAt !== "string"
    || !Number.isFinite(createdAt)
    || new Date(createdAt).toISOString() !== data.createdAt
    || Date.parse(expiresAt) - createdAt !== 24 * 60 * 60 * 1_000
    || typeof data.catalogRevision !== "number"
    || !Number.isSafeInteger(data.catalogRevision)
    || data.catalogRevision < 0
    || typeof data.artifactCount !== "number"
    || !Number.isSafeInteger(data.artifactCount)
    || data.artifactCount < 1
    || data.artifactCount > LOCAL_CONTENT_EXPORT_HARD_MAX_ARTIFACTS_V1
    || typeof data.chunkCount !== "number"
    || !Number.isSafeInteger(data.chunkCount)
    || data.chunkCount < 1
    || data.chunkCount > LOCAL_CONTENT_EXPORT_MAX_CHUNKS_V1
    || data.chunkCount !== Math.ceil(data.artifactCount / LOCAL_CONTENT_EXPORT_CHUNK_ITEMS_V1)
    || data.maxPageItems !== LOCAL_CONTENT_EXPORT_CHUNK_ITEMS_V1
    || data.maxPageBytes !== 1_500_000
    || typeof data.assetSetDigest !== "string"
    || !CONTENT_EXPORT_SHA256.test(data.assetSetDigest)
    || data.runtimeBoundary !== "authenticated_build_pipeline_only"
    || !Array.isArray(data.ownerSubjects)) {
    return exportSnapshotCorrupt("Export snapshot fields are inconsistent.");
  }
  assertExportOwnerSubjects(data.ownerSubjects as readonly ContentAuditEventV1["actorSubject"][]);
  return {
    schemaVersion: LOCAL_CONTENT_EXPORT_SESSION_SCHEMA_V1,
    exportId: data.exportId,
    createdAt: data.createdAt,
    expiresAt,
    catalogRevision: data.catalogRevision,
    artifactCount: data.artifactCount,
    chunkCount: data.chunkCount,
    maxPageItems: LOCAL_CONTENT_EXPORT_CHUNK_ITEMS_V1,
    maxPageBytes: 1_500_000,
    assetSetDigest: data.assetSetDigest as Sha256DigestV1,
    runtimeBoundary: "authenticated_build_pipeline_only",
  };
}

function encodeExportChunk(chunk: LocalContentExportChunkV1): StoredLocalContentExportChunkV1 {
  return { ...chunk, expiresAt: Timestamp.fromDate(new Date(chunk.expiresAt)) };
}

function decodeExportEntry(value: unknown): LocalContentExportEntryV1 {
  const entry = strictStoredRecord(value, [
    "artifactId", "contentKey", "kind", "audience", "locale", "version", "contentDigest", "activationId",
  ], "Export chunk entry");
  if (typeof entry.artifactId !== "string" || !CONTENT_EXPORT_IDENTIFIER.test(entry.artifactId)
    || typeof entry.contentKey !== "string" || !CONTENT_EXPORT_IDENTIFIER.test(entry.contentKey)
    || !["fortune_bundle", "name_energy", "report_copy", "article", "glossary"].includes(String(entry.kind))
    || (entry.audience !== "free_local" && entry.audience !== "shared")
    || entry.locale !== "ko-KR"
    || typeof entry.version !== "string" || !CONTENT_EXPORT_VERSION.test(entry.version)
    || typeof entry.contentDigest !== "string" || !CONTENT_EXPORT_SHA256.test(entry.contentDigest)
    || typeof entry.activationId !== "string" || !CONTENT_EXPORT_IDENTIFIER.test(entry.activationId)) {
    return exportSnapshotCorrupt("Export chunk entry fields are inconsistent.");
  }
  return entry as unknown as LocalContentExportEntryV1;
}

function decodeExportChunk(
  value: unknown,
  session: LocalContentExportSessionV1,
  expectedChunkIndex: number,
): LocalContentExportChunkV1 {
  const data = strictStoredRecord(value, ["exportId", "chunkIndex", "entries", "expiresAt"], "Export chunk");
  const expiresAt = exactStoredTimestamp(data.expiresAt, "Export chunk expiresAt").iso;
  const expectedEntryCount = expectedChunkIndex === session.chunkCount - 1
    ? session.artifactCount - expectedChunkIndex * session.maxPageItems
    : session.maxPageItems;
  if (data.exportId !== session.exportId
    || data.chunkIndex !== expectedChunkIndex
    || typeof data.chunkIndex !== "number"
    || !Number.isSafeInteger(data.chunkIndex)
    || data.chunkIndex < 0
    || data.chunkIndex >= session.chunkCount
    || !Array.isArray(data.entries)
    || data.entries.length !== expectedEntryCount
    || expiresAt !== session.expiresAt) {
    return exportSnapshotCorrupt("Export chunk fields are inconsistent.");
  }
  const entries = data.entries.map(decodeExportEntry);
  const artifactIds = entries.map((entry) => entry.artifactId);
  const runtimeKeys = entries.map((entry) => `${entry.kind}|${entry.locale}|${entry.contentKey}`);
  if (new Set(artifactIds).size !== artifactIds.length || new Set(runtimeKeys).size !== runtimeKeys.length) {
    return exportSnapshotCorrupt("Export chunk contains duplicate identities.");
  }
  return { exportId: session.exportId, chunkIndex: expectedChunkIndex, entries, expiresAt };
}

function encodeExportProgress(progress: LocalContentExportProgressV1): StoredLocalContentExportProgressV1 {
  return { ...progress, expiresAt: Timestamp.fromDate(new Date(progress.expiresAt)) };
}

function sameExportCursor(
  left: LocalContentExportCursorV1 | null,
  right: LocalContentExportCursorV1 | null,
): boolean {
  return left === null
    ? right === null
    : right !== null && left.chunkIndex === right.chunkIndex && left.offset === right.offset;
}

function decodeExportCursor(value: unknown, field: string): LocalContentExportCursorV1 | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiHttpError(503, "CONTENT_EXPORT_PROGRESS_INVALID", `${field} is invalid.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ApiHttpError(503, "CONTENT_EXPORT_PROGRESS_INVALID", `${field} is invalid.`);
  }
  const object = value as Record<string, unknown>;
  if (Object.keys(object).sort().join("|") !== "chunkIndex|offset"
    || typeof object.chunkIndex !== "number"
    || !Number.isSafeInteger(object.chunkIndex)
    || object.chunkIndex < 0
    || typeof object.offset !== "number"
    || !Number.isSafeInteger(object.offset)
    || object.offset < 0) {
    throw new ApiHttpError(503, "CONTENT_EXPORT_PROGRESS_INVALID", `${field} is invalid.`);
  }
  return { chunkIndex: object.chunkIndex, offset: object.offset };
}

function decodeExportProgress(value: unknown, expectedExportId: string): LocalContentExportProgressV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiHttpError(503, "CONTENT_EXPORT_PROGRESS_INVALID", "Export delivery progress is invalid.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ApiHttpError(503, "CONTENT_EXPORT_PROGRESS_INVALID", "Export delivery progress is invalid.");
  }
  const stored = value as Record<string, unknown>;
  const updatedAtMillis = typeof stored.updatedAt === "string" ? Date.parse(stored.updatedAt) : Number.NaN;
  const expectedKeys = [
    "expiresAt", "exportId", "lastNextCursor", "lastPageArtifactCount", "lastPageDigest",
    "lastRequestCursor", "nextCursor", "schemaVersion", "servedArtifactCount", "updatedAt",
  ];
  if (Object.keys(stored).sort().join("|") !== expectedKeys.sort().join("|")
    || stored.schemaVersion !== "namespring.local-content-export-progress.v1"
    || stored.exportId !== expectedExportId
    || typeof stored.servedArtifactCount !== "number"
    || !Number.isSafeInteger(stored.servedArtifactCount)
    || stored.servedArtifactCount < 0
    || typeof stored.lastPageArtifactCount !== "number"
    || !Number.isSafeInteger(stored.lastPageArtifactCount)
    || stored.lastPageArtifactCount < 0
    || typeof stored.updatedAt !== "string"
    || !Number.isFinite(updatedAtMillis)
    || new Date(updatedAtMillis).toISOString() !== stored.updatedAt
    || !(stored.expiresAt instanceof Timestamp)
    || (stored.lastPageDigest !== null
      && (typeof stored.lastPageDigest !== "string" || !CONTENT_EXPORT_SHA256.test(stored.lastPageDigest)))) {
    throw new ApiHttpError(503, "CONTENT_EXPORT_PROGRESS_INVALID", "Export delivery progress is invalid.");
  }
  const lastRequestCursor = decodeExportCursor(stored.lastRequestCursor, "lastRequestCursor");
  const lastNextCursor = decodeExportCursor(stored.lastNextCursor, "lastNextCursor");
  const nextCursor = decodeExportCursor(stored.nextCursor, "nextCursor");
  if ((lastRequestCursor === null) !== (stored.lastPageDigest === null)
    || (lastRequestCursor === null && stored.lastPageArtifactCount !== 0)) {
    throw new ApiHttpError(503, "CONTENT_EXPORT_PROGRESS_INVALID", "Export delivery progress is invalid.");
  }
  return {
    schemaVersion: "namespring.local-content-export-progress.v1",
    exportId: expectedExportId,
    nextCursor,
    servedArtifactCount: stored.servedArtifactCount,
    lastRequestCursor,
    lastNextCursor,
    lastPageDigest: stored.lastPageDigest as Sha256DigestV1 | null,
    lastPageArtifactCount: stored.lastPageArtifactCount,
    updatedAt: stored.updatedAt,
    expiresAt: stored.expiresAt.toDate().toISOString(),
  };
}

function encodeContentAuditEvent(event: ContentAuditEventV1): StoredContentAuditEventV1 {
  return { ...event, deleteAfter: Timestamp.fromDate(new Date(event.deleteAfter)) };
}

interface ContentMutationBaseV1 {
  readonly requestId: string;
  readonly requestDigest: Sha256DigestV1;
  readonly actor: ContentActorV1;
  readonly occurredAt: string;
  readonly auditId: string;
  readonly auditActorSubject: ContentAuditEventV1["actorSubject"];
  readonly auditActorSubjects: readonly ContentAuditEventV1["actorSubject"][];
  readonly auditSessionSubject: ContentAuditEventV1["sessionSubject"];
  readonly auditRetainedKeyIds: readonly string[];
  readonly auditDeleteAfter: string;
}

export type ContentMutationCommandV1 =
  | (ContentMutationBaseV1 & { readonly kind: "register"; readonly artifact: ContentArtifactV1 })
  | (ContentMutationBaseV1 & {
      readonly kind: "review";
      readonly artifactId: string;
      readonly expectedRevision: number;
      readonly notesDigest: Sha256DigestV1;
    })
  | (ContentMutationBaseV1 & {
      readonly kind: "approve";
      readonly artifactId: string;
      readonly expectedRevision: number;
    })
  | (ContentMutationBaseV1 & {
      readonly kind: "activate" | "rollback";
      readonly artifactId: string;
      readonly expectedRevision: number;
      readonly reason: string;
      readonly activationId: string;
    })
  | (ContentMutationBaseV1 & {
      readonly kind: "retire";
      readonly artifactId: string;
      readonly expectedRevision: number;
      readonly reason: string;
    });

interface ContentRequestReceiptV1 {
  readonly requestDigest: Sha256DigestV1;
  readonly response: ContentMutationResponseV1["artifact"];
  readonly committedAt: string;
}

interface MutationStateV1 {
  readonly target: ContentArtifactV1 | null;
  readonly pointer: ActiveContentPointerV1 | null;
  readonly currentlyActive: ContentArtifactV1 | null;
}

interface AppliedContentMutationV1 {
  readonly target: ContentArtifactV1;
  readonly previousActive?: ContentArtifactV1;
  readonly pointer: ActiveContentPointerV1 | null;
  readonly audits: readonly ContentAuditEventV1[];
}

export interface ContentRepositoryV1 {
  commit(command: ContentMutationCommandV1): Promise<ContentMutationResponseV1>;
  getActive(channel: ContentArtifactV1["channel"]): Promise<ContentArtifactV1 | null>;
  appendAudit(event: ContentAuditEventV1): Promise<void>;
  getArtifact(artifactId: string): Promise<ContentArtifactV1 | null>;
  listArtifacts(
    lifecycle: ContentLifecycleV1,
    afterArtifactId: string | undefined,
    limit: number,
  ): Promise<ListContentArtifactsResponseV1>;
  getCatalogRevision(): Promise<number>;
  countActiveExportEntries(audience: "free_local" | "shared"): Promise<number>;
  listActiveExportEntries(
    audience: "free_local" | "shared",
  ): Promise<readonly LocalContentExportEntryV1[]>;
  getExportArtifacts(
    entries: readonly LocalContentExportEntryV1[],
  ): Promise<readonly (ContentArtifactV1 | null)[]>;
  createLocalExportSnapshot(
    session: LocalContentExportSessionV1,
    entries: readonly LocalContentExportEntryV1[],
    ownerSubjects: readonly ContentAuditEventV1["actorSubject"][],
  ): Promise<void>;
  getLocalExportChunk(
    exportId: string,
    chunkIndex: number,
    requesterSubjects: readonly ContentAuditEventV1["actorSubject"][],
  ): Promise<{ readonly session: LocalContentExportSessionV1; readonly chunk: LocalContentExportChunkV1 }>;
  assertLocalExportSnapshotCurrent(
    exportId: string,
    catalogRevision: number,
    requesterSubjects: readonly ContentAuditEventV1["actorSubject"][],
  ): Promise<LocalContentExportSessionV1>;
  recordLocalExportPageDelivery(params: {
    readonly exportId: string;
    readonly catalogRevision: number;
    readonly requestCursor: LocalContentExportCursorV1;
    readonly nextCursor: LocalContentExportCursorV1 | null;
    readonly pageDigest: Sha256DigestV1;
    readonly pageArtifactCount: number;
    readonly occurredAt: string;
    readonly requesterSubjects: readonly ContentAuditEventV1["actorSubject"][];
  }): Promise<void>;
  assertLocalExportDeliveryComplete(
    exportId: string,
    catalogRevision: number,
    requesterSubjects: readonly ContentAuditEventV1["actorSubject"][],
  ): Promise<LocalContentExportSessionV1>;
}

function isCatalogMutation(command: ContentMutationCommandV1): boolean {
  return command.kind === "activate" || command.kind === "rollback" || command.kind === "retire";
}

const CONTENT_EXPORT_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const CONTENT_EXPORT_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/u;
const CONTENT_EXPORT_SHA256 = /^sha256:[a-f0-9]{64}$/u;
const CONTENT_EXPORT_HMAC_SHA256 = /^hmac-sha256:v1:[A-Za-z0-9._-]{1,64}:[a-f0-9]{64}$/u;
const CONTENT_EXPORT_GATE_SIGNATURE = /^hmac-sha256:[a-f0-9]{64}$/u;

function exportMetadataInvalid(): never {
  throw new ApiHttpError(
    503,
    "CONTENT_EXPORT_METADATA_INVALID",
    "Active export metadata failed its storage integrity contract.",
  );
}

function exportMetadataObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) exportMetadataInvalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) exportMetadataInvalid();
  return value as Record<string, unknown>;
}

function exportMetadataExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) exportMetadataInvalid();
  if (required.some((key) => !Object.hasOwn(value, key))) exportMetadataInvalid();
}

function exportMetadataIdentifier(value: unknown, version = false): string {
  const pattern = version ? CONTENT_EXPORT_VERSION : CONTENT_EXPORT_IDENTIFIER;
  if (typeof value !== "string" || !pattern.test(value)) exportMetadataInvalid();
  return value;
}

function exportMetadataDigest(value: unknown): Sha256DigestV1 {
  if (typeof value !== "string" || !CONTENT_EXPORT_SHA256.test(value)) exportMetadataInvalid();
  return value as Sha256DigestV1;
}

function exportMetadataTimestamp(value: unknown): string {
  if (typeof value !== "string") exportMetadataInvalid();
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) exportMetadataInvalid();
  return value;
}

function exportMetadataSubject(value: unknown): ContentAuditEventV1["actorSubject"] {
  if (typeof value !== "string" || !CONTENT_EXPORT_HMAC_SHA256.test(value)) exportMetadataInvalid();
  return value as ContentAuditEventV1["actorSubject"];
}

/**
 * Decode only the fields selected by listActiveExportEntries. Payload is
 * intentionally absent here; full payload + digest validation happens again
 * when a page fetches the immutable artifact documents.
 */
export function exportEntryFromMetadataProjectionV1(value: unknown): LocalContentExportEntryV1 {
  const artifact = exportMetadataObject(value);
  exportMetadataExactKeys(
    artifact,
    ["artifactId", "channel", "version", "lifecycle", "contentDigest", "provenance", "review", "approval", "activations"],
    ["artifactId", "channel", "version", "lifecycle", "contentDigest", "provenance", "review", "approval", "activations"],
  );
  if (artifact.lifecycle !== "active") exportMetadataInvalid();
  const artifactId = exportMetadataIdentifier(artifact.artifactId);
  const version = exportMetadataIdentifier(artifact.version, true);
  const contentDigest = exportMetadataDigest(artifact.contentDigest);

  const channel = exportMetadataObject(artifact.channel);
  exportMetadataExactKeys(channel, ["contentKey", "kind", "audience", "locale"], ["contentKey", "kind", "audience", "locale"]);
  const contentKey = exportMetadataIdentifier(channel.contentKey);
  if (
    channel.kind !== "fortune_bundle"
    && channel.kind !== "name_energy"
    && channel.kind !== "report_copy"
    && channel.kind !== "article"
    && channel.kind !== "glossary"
  ) exportMetadataInvalid();
  if (channel.audience !== "free_local" && channel.audience !== "shared") exportMetadataInvalid();
  if (channel.locale !== "ko-KR") exportMetadataInvalid();

  const provenance = exportMetadataObject(artifact.provenance);
  exportMetadataExactKeys(provenance, ["gate"], ["gate"]);
  const gate = exportMetadataObject(provenance.gate);
  exportMetadataExactKeys(
    gate,
    ["gateVersion", "decision", "checkedAt", "resultDigest", "attestation"],
    ["gateVersion", "decision", "checkedAt", "resultDigest", "attestation"],
  );
  exportMetadataIdentifier(gate.gateVersion, true);
  if (gate.decision !== "passed") exportMetadataInvalid();
  exportMetadataTimestamp(gate.checkedAt);
  exportMetadataDigest(gate.resultDigest);
  const attestation = exportMetadataObject(gate.attestation);
  exportMetadataExactKeys(
    attestation,
    ["attestationId", "runner", "keyId", "subjectContentDigest", "policyDigest", "signature"],
    ["attestationId", "runner", "keyId", "subjectContentDigest", "policyDigest", "signature"],
  );
  exportMetadataIdentifier(attestation.attestationId);
  exportMetadataIdentifier(attestation.keyId);
  if (attestation.runner !== "trusted_ci") exportMetadataInvalid();
  if (exportMetadataDigest(attestation.subjectContentDigest) !== contentDigest) exportMetadataInvalid();
  exportMetadataDigest(attestation.policyDigest);
  if (typeof attestation.signature !== "string" || !CONTENT_EXPORT_GATE_SIGNATURE.test(attestation.signature)) {
    exportMetadataInvalid();
  }
  assertStoredContentGateAttestationV1({
    gateVersion: gate.gateVersion as string,
    decision: "passed",
    checkedAt: gate.checkedAt as string,
    resultDigest: gate.resultDigest as Sha256DigestV1,
    attestation: {
      attestationId: attestation.attestationId as string,
      runner: "trusted_ci",
      keyId: attestation.keyId as string,
      subjectContentDigest: attestation.subjectContentDigest as Sha256DigestV1,
      policyDigest: attestation.policyDigest as Sha256DigestV1,
      signature: attestation.signature as `hmac-sha256:${string}`,
    },
  }, contentDigest);

  const review = exportMetadataObject(artifact.review);
  exportMetadataExactKeys(review, ["reviewerId", "reviewedAt", "decision", "notesDigest"], ["reviewerId", "reviewedAt", "decision", "notesDigest"]);
  const reviewerId = exportMetadataSubject(review.reviewerId);
  exportMetadataTimestamp(review.reviewedAt);
  if (review.decision !== "accepted") exportMetadataInvalid();
  exportMetadataDigest(review.notesDigest);

  const approval = exportMetadataObject(artifact.approval);
  exportMetadataExactKeys(
    approval,
    ["approverId", "approvedAt", "decision", "reviewArtifactRevision"],
    ["approverId", "approvedAt", "decision", "reviewArtifactRevision"],
  );
  const approverId = exportMetadataSubject(approval.approverId);
  if (approverId === reviewerId) exportMetadataInvalid();
  exportMetadataTimestamp(approval.approvedAt);
  if (approval.decision !== "approved") exportMetadataInvalid();
  if (
    typeof approval.reviewArtifactRevision !== "number"
    || !Number.isSafeInteger(approval.reviewArtifactRevision)
    || approval.reviewArtifactRevision < 1
  ) exportMetadataInvalid();

  if (
    !Array.isArray(artifact.activations)
    || artifact.activations.length < 1
    || artifact.activations.length > CONTENT_ACTIVATION_RECEIPT_INLINE_LIMIT_V1
  ) exportMetadataInvalid();
  const activationIds = new Set<string>();
  for (const candidate of artifact.activations) {
    const activation = exportMetadataObject(candidate);
    exportMetadataExactKeys(
      activation,
      ["activationId", "activatedAt", "activatedBy", "reason", "immutableContentDigest", "mode"],
      ["activationId", "activatedAt", "activatedBy", "reason", "immutableContentDigest", "mode"],
    );
    const activationId = exportMetadataIdentifier(activation.activationId);
    if (activationIds.has(activationId)) exportMetadataInvalid();
    activationIds.add(activationId);
    exportMetadataTimestamp(activation.activatedAt);
    exportMetadataSubject(activation.activatedBy);
    if (typeof activation.reason !== "string" || !activation.reason.trim() || activation.reason.length > 500) {
      exportMetadataInvalid();
    }
    if (exportMetadataDigest(activation.immutableContentDigest) !== contentDigest) exportMetadataInvalid();
    if (activation.mode !== "initial" && activation.mode !== "replacement" && activation.mode !== "rollback") {
      exportMetadataInvalid();
    }
  }
  const latestActivation = exportMetadataObject(artifact.activations.at(-1));
  return {
    artifactId,
    contentKey,
    kind: channel.kind,
    audience: channel.audience,
    locale: "ko-KR",
    version,
    contentDigest,
    activationId: latestActivation.activationId as string,
  };
}

function exportEntryFromArtifact(artifact: ContentArtifactV1): LocalContentExportEntryV1 {
  assertArtifactDeliverable(artifact);
  if (
    artifact.lifecycle !== "active"
    || !artifact.review
    || !artifact.approval
    || artifact.provenance?.gate?.decision !== "passed"
  ) {
    throw new ApiHttpError(503, "CONTENT_EXPORT_METADATA_INVALID", "Active export metadata is not fully approved.");
  }
  const activation = artifact.activations.at(-1);
  if (!activation || activation.immutableContentDigest !== artifact.contentDigest) {
    throw new ApiHttpError(503, "CONTENT_EXPORT_METADATA_INVALID", "Active export metadata has no valid activation.");
  }
  if (artifact.channel.audience !== "free_local" && artifact.channel.audience !== "shared") {
    throw new ApiHttpError(503, "CONTENT_EXPORT_METADATA_INVALID", "Server-only content entered a local export query.");
  }
  return {
    artifactId: artifact.artifactId,
    contentKey: artifact.channel.contentKey,
    kind: artifact.channel.kind,
    audience: artifact.channel.audience,
    locale: artifact.channel.locale,
    version: artifact.version,
    contentDigest: artifact.contentDigest,
    activationId: activation.activationId,
  };
}

function responseArtifact(artifact: ContentArtifactV1): ContentMutationResponseV1["artifact"] {
  return {
    artifactId: artifact.artifactId,
    channelKey: contentChannelKey(artifact.channel),
    version: artifact.version,
    lifecycle: artifact.lifecycle,
    revision: artifact.revision,
    contentDigest: artifact.contentDigest,
  };
}

function conflict(code: string, message: string, statusCode = 409): never {
  throw new ApiHttpError(statusCode, code, message);
}

function assertCommandAuditKeyCoverage(command: ContentMutationCommandV1): void {
  const retained = command.auditRetainedKeyIds;
  if (retained.length < 1 || retained.length > 8 || new Set(retained).size !== retained.length) {
    conflict("CONTENT_AUDIT_KEYRING_INVALID", "Content mutation audit key coverage is invalid.", 500);
  }
  assertContentAuditSubjectKeyRetainedV1(command.auditActorSubject, retained);
  assertContentAuditSubjectKeyRetainedV1(command.auditSessionSubject, retained);
  if (command.auditActorSubjects.length !== retained.length
    || !command.auditActorSubjects.includes(command.auditActorSubject)) {
    conflict("CONTENT_AUDIT_KEYRING_INVALID", "Content mutation actor key coverage is incomplete.", 500);
  }
  const coveredKeyIds = command.auditActorSubjects.map((subject) => {
    assertContentAuditSubjectKeyRetainedV1(subject, retained);
    return contentAuditSubjectKeyIdV1(subject);
  });
  if (new Set(coveredKeyIds).size !== retained.length) {
    conflict("CONTENT_AUDIT_KEYRING_INVALID", "Content mutation actor key coverage is ambiguous.", 500);
  }
}

function assertArtifactActorKeysRetained(
  artifact: ContentArtifactV1,
  retainedKeyIds: readonly string[],
): void {
  const subjects = [
    artifact.registeredBy,
    artifact.review?.reviewerId,
    artifact.approval?.approverId,
    ...artifact.activations.map((activation) => activation.activatedBy),
    artifact.retirement?.retiredBy,
  ].filter((subject): subject is ContentAuditEventV1["actorSubject"] => subject !== undefined);
  for (const subject of subjects) {
    assertContentAuditSubjectKeyRetainedV1(subject, retainedKeyIds);
  }
}

function assertRevision(artifact: ContentArtifactV1, expectedRevision: number): void {
  if (artifact.revision !== expectedRevision) {
    conflict("CONTENT_REVISION_CONFLICT", "Content revision changed; reload before retrying.");
  }
}

function requireTarget(state: MutationStateV1, artifactId: string): ContentArtifactV1 {
  if (!state.target || state.target.artifactId !== artifactId) {
    conflict("CONTENT_ARTIFACT_NOT_FOUND", "Content artifact was not found.", 404);
  }
  return state.target;
}

function withoutRetirement(artifact: ContentArtifactV1): Omit<ContentArtifactV1, "retirement"> {
  const { retirement: _retirement, ...rest } = artifact;
  return rest;
}

function retireArtifact(
  artifact: ContentArtifactV1,
  command: Extract<ContentMutationCommandV1, { kind: "activate" | "rollback" | "retire" }>,
  replacedByArtifactId?: string,
): ContentArtifactV1 {
  return {
    ...artifact,
    lifecycle: "retired",
    revision: artifact.revision + 1,
    retirement: {
      retiredAt: command.occurredAt,
      retiredBy: command.auditActorSubject,
      reason: command.reason,
      ...(replacedByArtifactId ? { replacedByArtifactId } : {}),
    },
  };
}

export function applyContentMutation(
  state: MutationStateV1,
  command: ContentMutationCommandV1,
): AppliedContentMutationV1 {
  assertCommandAuditKeyCoverage(command);
  if (command.kind === "register") {
    assertArtifactActorKeysRetained(command.artifact, command.auditRetainedKeyIds);
    if (state.target) {
      conflict("CONTENT_ARTIFACT_EXISTS", "artifactId already exists.");
    }
    return {
      target: command.artifact,
      pointer: state.pointer,
      audits: [createContentAuditEvent(command, command.artifact, "artifact.registered")],
    };
  }

  const target = requireTarget(state, command.artifactId);
  assertArtifactActorKeysRetained(target, command.auditRetainedKeyIds);
  if (target.provenance.gate.decision === "passed") {
    assertStoredContentGateAttestationV1(target.provenance.gate, target.contentDigest);
  }
  if (state.currentlyActive && state.currentlyActive.artifactId !== target.artifactId) {
    assertArtifactActorKeysRetained(state.currentlyActive, command.auditRetainedKeyIds);
    if (state.currentlyActive.provenance.gate.decision === "passed") {
      assertStoredContentGateAttestationV1(
        state.currentlyActive.provenance.gate,
        state.currentlyActive.contentDigest,
      );
    }
  }
  assertRevision(target, command.expectedRevision);

  if (command.kind === "review") {
    if (target.lifecycle !== "draft") {
      conflict("INVALID_CONTENT_TRANSITION", "Only draft content can be reviewed.");
    }
    if (target.provenance.gate.decision !== "passed") {
      conflict("CONTENT_GATE_NOT_PASSED", "A passed quality gate is required before human review.");
    }
    const reviewed: ContentArtifactV1 = {
      ...target,
      lifecycle: "reviewed",
      revision: target.revision + 1,
      review: {
        reviewerId: command.auditActorSubject,
        reviewedAt: command.occurredAt,
        decision: "accepted",
        notesDigest: command.notesDigest,
      },
    };
    return {
      target: reviewed,
      pointer: state.pointer,
      audits: [createContentAuditEvent(command, reviewed, "artifact.reviewed", target.lifecycle)],
    };
  }

  if (command.kind === "approve") {
    if (target.lifecycle !== "reviewed" || !target.review) {
      conflict("INVALID_CONTENT_TRANSITION", "Only human-reviewed content can be approved.");
    }
    if (command.auditActorSubjects.includes(target.review.reviewerId)) {
      conflict(
        "CONTENT_SEPARATION_OF_DUTIES_REQUIRED",
        "The reviewer and approver must be different authenticated administrators.",
      );
    }
    const approved: ContentArtifactV1 = {
      ...target,
      lifecycle: "approved",
      revision: target.revision + 1,
      approval: {
        approverId: command.auditActorSubject,
        approvedAt: command.occurredAt,
        decision: "approved",
        reviewArtifactRevision: target.revision,
      },
    };
    return {
      target: approved,
      pointer: state.pointer,
      audits: [createContentAuditEvent(command, approved, "artifact.approved", target.lifecycle)],
    };
  }

  if (command.kind === "retire") {
    if (target.lifecycle !== "active" || !state.pointer || state.pointer.artifactId !== target.artifactId) {
      conflict("INVALID_CONTENT_TRANSITION", "Only the active channel artifact can be retired.");
    }
    const retired = retireArtifact(target, command);
    return {
      target: retired,
      pointer: null,
      audits: [createContentAuditEvent(command, retired, "artifact.retired", target.lifecycle, command.reason)],
    };
  }

  const isRollback = command.kind === "rollback";
  if ((!isRollback && target.lifecycle !== "approved") || (isRollback && target.lifecycle !== "retired")) {
    conflict(
      "INVALID_CONTENT_TRANSITION",
      isRollback ? "Rollback targets must be previously retired artifacts." : "Only approved content can be activated.",
    );
  }
  if (!target.review || !target.approval || target.provenance.gate.decision !== "passed") {
    conflict("CONTENT_NOT_APPROVED", "Activation requires passed gate, human review, and approval.");
  }
  validateContentPayloadForKind(target.channel.kind, target.payload, { requireDeliverable: true });
  if (state.pointer && !state.currentlyActive) {
    conflict("CONTENT_POINTER_INTEGRITY_FAILURE", "Active content pointer is dangling.", 503);
  }
  if (state.currentlyActive && contentChannelKey(state.currentlyActive.channel) !== contentChannelKey(target.channel)) {
    conflict("CONTENT_CHANNEL_MISMATCH", "Cannot replace content in a different channel.");
  }
  if (state.currentlyActive?.artifactId === target.artifactId) {
    conflict("CONTENT_ALREADY_ACTIVE", "Content artifact is already active.");
  }
  if (target.activations.length >= CONTENT_ACTIVATION_RECEIPT_INLINE_LIMIT_V1) {
    conflict(
      "CONTENT_ACTIVATION_HISTORY_LIMIT",
      "Inline activation history is full; register and approve a new artifact version before activation or rollback.",
    );
  }

  const mode = isRollback ? "rollback" : state.currentlyActive ? "replacement" : "initial";
  const active: ContentArtifactV1 = {
    ...withoutRetirement(target),
    lifecycle: "active",
    revision: target.revision + 1,
    activations: [
      ...target.activations,
      {
        activationId: command.activationId,
        activatedAt: command.occurredAt,
        activatedBy: command.auditActorSubject,
        reason: command.reason,
        immutableContentDigest: target.contentDigest,
        mode,
      },
    ],
  };
  const previousActive = state.currentlyActive
    ? retireArtifact(state.currentlyActive, command, target.artifactId)
    : undefined;
  const pointer: ActiveContentPointerV1 = {
    channelKey: contentChannelKey(target.channel),
    artifactId: target.artifactId,
    activationId: command.activationId,
    contentDigest: target.contentDigest,
    activatedAt: command.occurredAt,
    revision: (state.pointer?.revision ?? 0) + 1,
  };
  return {
    target: active,
    ...(previousActive ? { previousActive } : {}),
    pointer,
    audits: [
      createContentAuditEvent(
        command,
        active,
        isRollback ? "artifact.rollback_activated" : "artifact.activated",
        target.lifecycle,
        command.reason,
      ),
      ...(previousActive
        ? [createContentAuditEvent(
            { ...command, auditId: `${command.auditId}_retired` },
            previousActive,
            "artifact.retired",
            "active",
            command.reason,
          )]
        : []),
    ],
  };
}

function safeDocumentId(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function artifactIdOf(command: ContentMutationCommandV1): string {
  return command.kind === "register" ? command.artifact.artifactId : command.artifactId;
}

async function readMutationState(
  transaction: Transaction,
  command: ContentMutationCommandV1,
  db: Firestore,
): Promise<MutationStateV1> {
  const artifactRef = db.collection(ARTIFACTS).doc(artifactIdOf(command));
  const targetSnapshot = await transaction.get(artifactRef);
  const target = targetSnapshot.exists ? (targetSnapshot.data() as ContentArtifactV1) : null;
  const channel = command.kind === "register" ? command.artifact.channel : target?.channel;
  if (!channel) {
    return { target, pointer: null, currentlyActive: null };
  }
  const pointerSnapshot = await transaction.get(db.collection(ACTIVE_CHANNELS).doc(safeDocumentId(contentChannelKey(channel))));
  const pointer = pointerSnapshot.exists ? (pointerSnapshot.data() as ActiveContentPointerV1) : null;
  let currentlyActive: ContentArtifactV1 | null = null;
  if (pointer) {
    const activeSnapshot = await transaction.get(db.collection(ARTIFACTS).doc(pointer.artifactId));
    currentlyActive = activeSnapshot.exists ? (activeSnapshot.data() as ContentArtifactV1) : null;
  }
  return { target, pointer, currentlyActive };
}

export class FirestoreContentRepositoryV1 implements ContentRepositoryV1 {
  public constructor(private readonly db: Firestore = getFirestoreDb()) {}

  public async commit(command: ContentMutationCommandV1): Promise<ContentMutationResponseV1> {
    const db = this.db;
    const receiptRef = db.collection(REQUEST_RECEIPTS).doc(safeDocumentId(`${command.actor.userId}:${command.requestId}`));
    return db.runTransaction(async (transaction) => {
      const receiptSnapshot = await transaction.get(receiptRef);
      if (receiptSnapshot.exists) {
        const receipt = receiptSnapshot.data() as ContentRequestReceiptV1;
        if (receipt.requestDigest !== command.requestDigest) {
          conflict("IDEMPOTENCY_KEY_REUSED", "requestId was already used with different content.");
        }
        return {
          artifact: receipt.response,
          operation: "idempotent_replay" as const,
        };
      }

      const state = await readMutationState(transaction, command, db);
      const catalogRef = db.collection(CATALOG_STATE).doc(CATALOG_STATE_DOCUMENT);
      const catalogSnapshot = isCatalogMutation(command) ? await transaction.get(catalogRef) : null;
      const catalogState = catalogSnapshot?.exists
        ? (catalogSnapshot.data() as ContentCatalogStateV1)
        : { revision: 0, updatedAt: command.occurredAt };
      const applied = applyContentMutation(state, command);
      transaction.set(db.collection(ARTIFACTS).doc(applied.target.artifactId), applied.target, { merge: false });
      if (applied.previousActive && applied.previousActive.artifactId !== applied.target.artifactId) {
        transaction.set(db.collection(ARTIFACTS).doc(applied.previousActive.artifactId), applied.previousActive, { merge: false });
      }
      const pointerRef = db.collection(ACTIVE_CHANNELS).doc(safeDocumentId(contentChannelKey(applied.target.channel)));
      if (applied.pointer) {
        transaction.set(pointerRef, applied.pointer, { merge: false });
      } else if (state.pointer) {
        transaction.delete(pointerRef);
      }
      for (const audit of applied.audits) {
        transaction.create(db.collection(AUDIT_EVENTS).doc(audit.auditId), encodeContentAuditEvent(audit));
      }
      transaction.create(receiptRef, {
        requestDigest: command.requestDigest,
        response: responseArtifact(applied.target),
        committedAt: command.occurredAt,
      } satisfies ContentRequestReceiptV1);
      if (isCatalogMutation(command)) {
        transaction.set(catalogRef, {
          revision: catalogState.revision + 1,
          updatedAt: command.occurredAt,
        } satisfies ContentCatalogStateV1, { merge: false });
      }
      return { artifact: responseArtifact(applied.target), operation: "initial" as const };
    });
  }

  public async getActive(channel: ContentArtifactV1["channel"]): Promise<ContentArtifactV1 | null> {
    const db = this.db;
    const pointerSnapshot = await db.collection(ACTIVE_CHANNELS).doc(safeDocumentId(contentChannelKey(channel))).get();
    if (!pointerSnapshot.exists) {
      return null;
    }
    const pointer = pointerSnapshot.data() as ActiveContentPointerV1;
    const artifactSnapshot = await db.collection(ARTIFACTS).doc(pointer.artifactId).get();
    if (!artifactSnapshot.exists) {
      throw new ApiHttpError(503, "CONTENT_POINTER_INTEGRITY_FAILURE", "Active content pointer is dangling.");
    }
    const artifact = artifactSnapshot.data() as ContentArtifactV1;
    if (
      artifact.contentDigest !== pointer.contentDigest
      || artifact.lifecycle !== "active"
      || pointer.channelKey !== contentChannelKey(channel)
      || contentChannelKey(artifact.channel) !== pointer.channelKey
    ) {
      throw new ApiHttpError(503, "CONTENT_POINTER_INTEGRITY_FAILURE", "Active content pointer failed validation.");
    }
    return artifact;
  }

  public async appendAudit(event: ContentAuditEventV1): Promise<void> {
    await this.db.collection(AUDIT_EVENTS).doc(event.auditId).create(encodeContentAuditEvent(event));
  }

  public async getArtifact(artifactId: string): Promise<ContentArtifactV1 | null> {
    const snapshot = await this.db.collection(ARTIFACTS).doc(artifactId).get();
    return snapshot.exists ? (snapshot.data() as ContentArtifactV1) : null;
  }

  public async listArtifacts(
    lifecycle: ContentLifecycleV1,
    afterArtifactId: string | undefined,
    limit: number,
  ): Promise<ListContentArtifactsResponseV1> {
    const db = this.db;
    let query = db.collection(ARTIFACTS).where("lifecycle", "==", lifecycle).orderBy("artifactId").limit(limit + 1);
    if (afterArtifactId) query = query.startAfter(afterArtifactId);
    const snapshot = await query.get();
    const all = snapshot.docs.map((document) => document.data() as ContentArtifactV1);
    const hasMore = all.length > limit;
    const artifacts = hasMore ? all.slice(0, limit) : all;
    return { artifacts, nextCursor: hasMore ? (artifacts.at(-1)?.artifactId ?? null) : null };
  }

  public async getCatalogRevision(): Promise<number> {
    const snapshot = await this.db.collection(CATALOG_STATE).doc(CATALOG_STATE_DOCUMENT).get();
    return snapshot.exists ? (snapshot.data() as ContentCatalogStateV1).revision : 0;
  }

  public async countActiveExportEntries(audience: "free_local" | "shared"): Promise<number> {
    const aggregate = await this.db
      .collection(ARTIFACTS)
      .where("lifecycle", "==", "active")
      .where("channel.audience", "==", audience)
      .count()
      .get();
    const count = aggregate.data().count;
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new ApiHttpError(503, "CONTENT_EXPORT_COUNT_INVALID", "Active export count is invalid.");
    }
    return count;
  }

  public async listActiveExportEntries(
    audience: "free_local" | "shared",
  ): Promise<readonly LocalContentExportEntryV1[]> {
    const snapshot = await this.db
      .collection(ARTIFACTS)
      .where("lifecycle", "==", "active")
      .where("channel.audience", "==", audience)
      .select(
        "artifactId",
        "channel",
        "version",
        "lifecycle",
        "contentDigest",
        "provenance.gate",
        "review",
        "approval",
        "activations",
      )
      .get();
    return snapshot.docs.map((document) => exportEntryFromMetadataProjectionV1(document.data()));
  }

  public async getExportArtifacts(
    entries: readonly LocalContentExportEntryV1[],
  ): Promise<readonly (ContentArtifactV1 | null)[]> {
    if (entries.length < 1 || entries.length > CONTENT_EXPORT_ARTIFACT_FETCH_BATCH_LIMIT_V1) {
      throw new ApiHttpError(500, "CONTENT_EXPORT_FETCH_BOUNDS_INVALID", "Export artifact fetch is outside its bound.");
    }
    const db = this.db;
    const snapshots = await db.getAll(...entries.map((entry) => db.collection(ARTIFACTS).doc(entry.artifactId)));
    return snapshots.map((snapshot) => snapshot.exists ? snapshot.data() as ContentArtifactV1 : null);
  }

  public async createLocalExportSnapshot(
    session: LocalContentExportSessionV1,
    entries: readonly LocalContentExportEntryV1[],
    ownerSubjects: readonly ContentAuditEventV1["actorSubject"][],
  ): Promise<void> {
    const db = this.db;
    const headerRef = db.collection(EXPORT_SNAPSHOTS).doc(session.exportId);
    const chunks = Array.from({ length: session.chunkCount }, (_, chunkIndex) => ({
      exportId: session.exportId,
      chunkIndex,
      entries: entries.slice(chunkIndex * session.maxPageItems, (chunkIndex + 1) * session.maxPageItems),
      expiresAt: session.expiresAt,
    } satisfies LocalContentExportChunkV1));

    // Chunk documents are staged while the parent header does not exist, so
    // no reader can discover a partial snapshot. This also avoids putting a
    // 21k-entry catalog's 800+ chunk writes in one Firestore transaction.
    // Every staged chunk has its own TTL and is cleaned if any batch or the
    // final catalog-revision check fails.
    for (const chunkBatch of partitionContentExportChunkWritesV1(chunks)) {
      const writeBatch = db.batch();
      for (const chunk of chunkBatch) {
        writeBatch.create(
          headerRef.collection(EXPORT_CHUNKS).doc(String(chunk.chunkIndex).padStart(6, "0")),
          encodeExportChunk(chunk),
        );
      }
      await writeBatch.commit();
    }

    // Publishing the header is the only visibility transition. It is fenced
    // by the same catalog revision captured before metadata enumeration.
    await db.runTransaction(async (transaction) => {
      const [catalogSnapshot, existingSnapshot] = await Promise.all([
        transaction.get(db.collection(CATALOG_STATE).doc(CATALOG_STATE_DOCUMENT)),
        transaction.get(headerRef),
      ]);
      const revision = catalogSnapshot.exists ? (catalogSnapshot.data() as ContentCatalogStateV1).revision : 0;
      if (revision !== session.catalogRevision) {
        throw new ApiHttpError(409, "CONTENT_EXPORT_SNAPSHOT_CHANGED", "Active content changed while sealing export metadata.");
      }
      if (existingSnapshot.exists) {
        throw new ApiHttpError(409, "CONTENT_EXPORT_ID_EXISTS", "Export snapshot ID already exists.");
      }
      transaction.create(headerRef, encodeExportSession(session, ownerSubjects));
      transaction.create(
        headerRef.collection(EXPORT_PROGRESS).doc(EXPORT_PROGRESS_DOCUMENT),
        encodeExportProgress({
          schemaVersion: "namespring.local-content-export-progress.v1",
          exportId: session.exportId,
          nextCursor: { chunkIndex: 0, offset: 0 },
          servedArtifactCount: 0,
          lastRequestCursor: null,
          lastNextCursor: null,
          lastPageDigest: null,
          lastPageArtifactCount: 0,
          updatedAt: session.createdAt,
          expiresAt: session.expiresAt,
        }),
      );
    });
  }

  public async getLocalExportChunk(
    exportId: string,
    chunkIndex: number,
    requesterSubjects: readonly ContentAuditEventV1["actorSubject"][],
  ): Promise<{ readonly session: LocalContentExportSessionV1; readonly chunk: LocalContentExportChunkV1 }> {
    const db = this.db;
    const headerRef = db.collection(EXPORT_SNAPSHOTS).doc(exportId);
    const [headerSnapshot, chunkSnapshot, catalogSnapshot] = await Promise.all([
      headerRef.get(),
      headerRef.collection(EXPORT_CHUNKS).doc(String(chunkIndex).padStart(6, "0")).get(),
      db.collection(CATALOG_STATE).doc(CATALOG_STATE_DOCUMENT).get(),
    ]);
    if (!headerSnapshot.exists || !chunkSnapshot.exists) {
      throw new ApiHttpError(404, "CONTENT_EXPORT_SNAPSHOT_NOT_FOUND", "Export snapshot or cursor was not found.");
    }
    const storedSession = headerSnapshot.data() as StoredLocalContentExportSessionV1;
    assertExportOwnerAccess(storedSession, requesterSubjects);
    const session = decodeExportSession(storedSession, exportId);
    const revision = catalogSnapshot.exists ? (catalogSnapshot.data() as ContentCatalogStateV1).revision : 0;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      throw new ApiHttpError(410, "CONTENT_EXPORT_SNAPSHOT_EXPIRED", "Export snapshot expired.");
    }
    if (revision !== session.catalogRevision) {
      throw new ApiHttpError(409, "CONTENT_EXPORT_SNAPSHOT_INVALIDATED", "Active content changed; start a new export.");
    }
    return { session, chunk: decodeExportChunk(chunkSnapshot.data(), session, chunkIndex) };
  }

  public async assertLocalExportSnapshotCurrent(
    exportId: string,
    catalogRevision: number,
    requesterSubjects: readonly ContentAuditEventV1["actorSubject"][],
  ): Promise<LocalContentExportSessionV1> {
    const db = this.db;
    const [headerSnapshot, catalogSnapshot] = await Promise.all([
      db.collection(EXPORT_SNAPSHOTS).doc(exportId).get(),
      db.collection(CATALOG_STATE).doc(CATALOG_STATE_DOCUMENT).get(),
    ]);
    if (!headerSnapshot.exists) {
      throw new ApiHttpError(404, "CONTENT_EXPORT_SNAPSHOT_NOT_FOUND", "Export snapshot was not found.");
    }
    const storedSession = headerSnapshot.data() as StoredLocalContentExportSessionV1;
    assertExportOwnerAccess(storedSession, requesterSubjects);
    const session = decodeExportSession(storedSession, exportId);
    const revision = catalogSnapshot.exists ? (catalogSnapshot.data() as ContentCatalogStateV1).revision : 0;
    if (
      Date.parse(session.expiresAt) <= Date.now()
      || session.catalogRevision !== catalogRevision
      || revision !== catalogRevision
    ) {
      throw new ApiHttpError(409, "CONTENT_EXPORT_SNAPSHOT_INVALIDATED", "Export snapshot is expired or no longer current.");
    }
    return session;
  }

  public async recordLocalExportPageDelivery(params: {
    readonly exportId: string;
    readonly catalogRevision: number;
    readonly requestCursor: LocalContentExportCursorV1;
    readonly nextCursor: LocalContentExportCursorV1 | null;
    readonly pageDigest: Sha256DigestV1;
    readonly pageArtifactCount: number;
    readonly occurredAt: string;
    readonly requesterSubjects: readonly ContentAuditEventV1["actorSubject"][];
  }): Promise<void> {
    if (!CONTENT_EXPORT_SHA256.test(params.pageDigest)
      || !Number.isSafeInteger(params.pageArtifactCount)
      || params.pageArtifactCount < 1
      || !Number.isFinite(Date.parse(params.occurredAt))
      || new Date(Date.parse(params.occurredAt)).toISOString() !== params.occurredAt) {
      throw new ApiHttpError(500, "CONTENT_EXPORT_DELIVERY_INPUT_INVALID", "Export page delivery input is invalid.");
    }
    const db = this.db;
    const headerRef = db.collection(EXPORT_SNAPSHOTS).doc(params.exportId);
    const progressRef = headerRef.collection(EXPORT_PROGRESS).doc(EXPORT_PROGRESS_DOCUMENT);
    await db.runTransaction(async (transaction) => {
      const [headerSnapshot, progressSnapshot, catalogSnapshot] = await Promise.all([
        transaction.get(headerRef),
        transaction.get(progressRef),
        transaction.get(db.collection(CATALOG_STATE).doc(CATALOG_STATE_DOCUMENT)),
      ]);
      if (!headerSnapshot.exists || !progressSnapshot.exists) {
        throw new ApiHttpError(404, "CONTENT_EXPORT_SNAPSHOT_NOT_FOUND", "Export snapshot was not found.");
      }
      const storedSession = headerSnapshot.data() as StoredLocalContentExportSessionV1;
      assertExportOwnerAccess(storedSession, params.requesterSubjects);
      const session = decodeExportSession(storedSession, params.exportId);
      const progress = decodeExportProgress(progressSnapshot.data(), params.exportId);
      const revision = catalogSnapshot.exists ? (catalogSnapshot.data() as ContentCatalogStateV1).revision : 0;
      if (Date.parse(session.expiresAt) <= Date.now()
        || session.catalogRevision !== params.catalogRevision
        || revision !== params.catalogRevision
        || progress.expiresAt !== session.expiresAt) {
        throw new ApiHttpError(409, "CONTENT_EXPORT_SNAPSHOT_INVALIDATED", "Export snapshot is expired or no longer current.");
      }

      const isIdempotentReplay = sameExportCursor(progress.lastRequestCursor, params.requestCursor)
        && progress.lastPageDigest === params.pageDigest
        && progress.lastPageArtifactCount === params.pageArtifactCount
        && sameExportCursor(progress.lastNextCursor, params.nextCursor);
      if (isIdempotentReplay) return;
      if (!sameExportCursor(progress.nextCursor, params.requestCursor)) {
        throw new ApiHttpError(
          409,
          "CONTENT_EXPORT_CURSOR_OUT_OF_SEQUENCE",
          "Export pages must be consumed in cursor order.",
        );
      }
      if (params.pageArtifactCount > session.maxPageItems) {
        throw new ApiHttpError(500, "CONTENT_EXPORT_DELIVERY_INPUT_INVALID", "Export page item count exceeds its bound.");
      }
      if (params.nextCursor !== null) {
        const sameChunkAdvance = params.nextCursor.chunkIndex === params.requestCursor.chunkIndex
          && params.nextCursor.offset > params.requestCursor.offset;
        const nextChunkAdvance = params.nextCursor.chunkIndex === params.requestCursor.chunkIndex + 1
          && params.nextCursor.offset === 0;
        if ((!sameChunkAdvance && !nextChunkAdvance) || params.nextCursor.chunkIndex >= session.chunkCount) {
          throw new ApiHttpError(500, "CONTENT_EXPORT_DELIVERY_INPUT_INVALID", "Export next cursor is invalid.");
        }
      }
      const servedArtifactCount = progress.servedArtifactCount + params.pageArtifactCount;
      if (servedArtifactCount > session.artifactCount
        || (params.nextCursor === null && servedArtifactCount !== session.artifactCount)
        || (params.nextCursor !== null && servedArtifactCount >= session.artifactCount)) {
        throw new ApiHttpError(503, "CONTENT_EXPORT_PROGRESS_INVALID", "Export delivery count is inconsistent.");
      }
      transaction.set(progressRef, encodeExportProgress({
        schemaVersion: "namespring.local-content-export-progress.v1",
        exportId: session.exportId,
        nextCursor: params.nextCursor,
        servedArtifactCount,
        lastRequestCursor: params.requestCursor,
        lastNextCursor: params.nextCursor,
        lastPageDigest: params.pageDigest,
        lastPageArtifactCount: params.pageArtifactCount,
        updatedAt: params.occurredAt,
        expiresAt: session.expiresAt,
      }), { merge: false });
    });
  }

  public async assertLocalExportDeliveryComplete(
    exportId: string,
    catalogRevision: number,
    requesterSubjects: readonly ContentAuditEventV1["actorSubject"][],
  ): Promise<LocalContentExportSessionV1> {
    const db = this.db;
    const headerRef = db.collection(EXPORT_SNAPSHOTS).doc(exportId);
    return db.runTransaction(async (transaction) => {
      const [headerSnapshot, progressSnapshot, catalogSnapshot] = await Promise.all([
        transaction.get(headerRef),
        transaction.get(headerRef.collection(EXPORT_PROGRESS).doc(EXPORT_PROGRESS_DOCUMENT)),
        transaction.get(db.collection(CATALOG_STATE).doc(CATALOG_STATE_DOCUMENT)),
      ]);
      if (!headerSnapshot.exists || !progressSnapshot.exists) {
        throw new ApiHttpError(404, "CONTENT_EXPORT_SNAPSHOT_NOT_FOUND", "Export snapshot was not found.");
      }
      const storedSession = headerSnapshot.data() as StoredLocalContentExportSessionV1;
      assertExportOwnerAccess(storedSession, requesterSubjects);
      const session = decodeExportSession(storedSession, exportId);
      const progress = decodeExportProgress(progressSnapshot.data(), exportId);
      const revision = catalogSnapshot.exists ? (catalogSnapshot.data() as ContentCatalogStateV1).revision : 0;
      if (Date.parse(session.expiresAt) <= Date.now()
        || session.catalogRevision !== catalogRevision
        || revision !== catalogRevision) {
        throw new ApiHttpError(409, "CONTENT_EXPORT_SNAPSHOT_INVALIDATED", "Export snapshot is expired or no longer current.");
      }
      if (progress.nextCursor !== null
        || progress.servedArtifactCount !== session.artifactCount
        || progress.lastPageDigest === null) {
        throw new ApiHttpError(
          409,
          "CONTENT_EXPORT_DELIVERY_INCOMPLETE",
          "Every export page must be served in order before finalization.",
        );
      }
      return session;
    });
  }
}

/** Deterministic adapter for contract tests; production uses Firestore transactions. */
export class InMemoryContentRepositoryV1 implements ContentRepositoryV1 {
  private readonly artifacts = new Map<string, ContentArtifactV1>();
  private readonly pointers = new Map<string, ActiveContentPointerV1>();
  private readonly receipts = new Map<string, ContentRequestReceiptV1>();
  private readonly exportSessions = new Map<string, LocalContentExportSessionV1>();
  private readonly exportOwnerSubjects = new Map<string, readonly ContentAuditEventV1["actorSubject"][]>();
  private readonly exportChunks = new Map<string, LocalContentExportChunkV1>();
  private readonly exportProgress = new Map<string, LocalContentExportProgressV1>();
  private catalogRevision = 0;
  public readonly audits: ContentAuditEventV1[] = [];

  public async commit(command: ContentMutationCommandV1): Promise<ContentMutationResponseV1> {
    const receiptKey = `${command.actor.userId}:${command.requestId}`;
    const receipt = this.receipts.get(receiptKey);
    if (receipt) {
      if (receipt.requestDigest !== command.requestDigest) {
        conflict("IDEMPOTENCY_KEY_REUSED", "requestId was already used with different content.");
      }
      return { artifact: receipt.response, operation: "idempotent_replay" };
    }
    const artifactId = artifactIdOf(command);
    const target = this.artifacts.get(artifactId) ?? null;
    const channel = command.kind === "register" ? command.artifact.channel : target?.channel;
    const pointer = channel ? (this.pointers.get(contentChannelKey(channel)) ?? null) : null;
    const currentlyActive = pointer ? (this.artifacts.get(pointer.artifactId) ?? null) : null;
    const applied = applyContentMutation({ target, pointer, currentlyActive }, command);
    this.artifacts.set(applied.target.artifactId, applied.target);
    if (applied.previousActive) {
      this.artifacts.set(applied.previousActive.artifactId, applied.previousActive);
    }
    const key = contentChannelKey(applied.target.channel);
    if (applied.pointer) this.pointers.set(key, applied.pointer);
    else this.pointers.delete(key);
    this.audits.push(...applied.audits);
    const summary = responseArtifact(applied.target);
    this.receipts.set(receiptKey, {
      requestDigest: command.requestDigest,
      response: summary,
      committedAt: command.occurredAt,
    });
    if (isCatalogMutation(command)) this.catalogRevision += 1;
    return { artifact: summary, operation: "initial" };
  }

  public async getActive(channel: ContentArtifactV1["channel"]): Promise<ContentArtifactV1 | null> {
    const pointer = this.pointers.get(contentChannelKey(channel));
    if (!pointer) return null;
    const artifact = this.artifacts.get(pointer.artifactId) ?? null;
    if (!artifact || artifact.lifecycle !== "active" || artifact.contentDigest !== pointer.contentDigest) {
      throw new ApiHttpError(503, "CONTENT_POINTER_INTEGRITY_FAILURE", "Active content pointer failed validation.");
    }
    return artifact;
  }

  public async appendAudit(event: ContentAuditEventV1): Promise<void> {
    this.audits.push(event);
  }

  public async getArtifact(artifactId: string): Promise<ContentArtifactV1 | null> {
    return this.artifacts.get(artifactId) ?? null;
  }

  public peekArtifact(artifactId: string): ContentArtifactV1 | null {
    return this.artifacts.get(artifactId) ?? null;
  }

  public async listArtifacts(
    lifecycle: ContentLifecycleV1,
    afterArtifactId: string | undefined,
    limit: number,
  ): Promise<ListContentArtifactsResponseV1> {
    const matches = [...this.artifacts.values()]
      .filter((artifact) => artifact.lifecycle === lifecycle && (!afterArtifactId || artifact.artifactId > afterArtifactId))
      .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
    const artifacts = matches.slice(0, limit);
    return {
      artifacts,
      nextCursor: matches.length > limit ? (artifacts.at(-1)?.artifactId ?? null) : null,
    };
  }

  public async getCatalogRevision(): Promise<number> {
    return this.catalogRevision;
  }

  public async countActiveExportEntries(audience: "free_local" | "shared"): Promise<number> {
    return [...this.artifacts.values()].filter(
      (artifact) => artifact.lifecycle === "active" && artifact.channel.audience === audience,
    ).length;
  }

  public async listActiveExportEntries(
    audience: "free_local" | "shared",
  ): Promise<readonly LocalContentExportEntryV1[]> {
    return [...this.artifacts.values()]
      .filter((artifact) => artifact.lifecycle === "active" && artifact.channel.audience === audience)
      .map(exportEntryFromArtifact);
  }

  public async getExportArtifacts(
    entries: readonly LocalContentExportEntryV1[],
  ): Promise<readonly (ContentArtifactV1 | null)[]> {
    if (entries.length < 1 || entries.length > CONTENT_EXPORT_ARTIFACT_FETCH_BATCH_LIMIT_V1) {
      throw new ApiHttpError(500, "CONTENT_EXPORT_FETCH_BOUNDS_INVALID", "Export artifact fetch is outside its bound.");
    }
    return entries.map((entry) => this.artifacts.get(entry.artifactId) ?? null);
  }

  public async createLocalExportSnapshot(
    session: LocalContentExportSessionV1,
    entries: readonly LocalContentExportEntryV1[],
    ownerSubjects: readonly ContentAuditEventV1["actorSubject"][],
  ): Promise<void> {
    if (this.catalogRevision !== session.catalogRevision) {
      throw new ApiHttpError(409, "CONTENT_EXPORT_SNAPSHOT_CHANGED", "Active content changed while sealing export metadata.");
    }
    if (this.exportSessions.has(session.exportId)) {
      throw new ApiHttpError(409, "CONTENT_EXPORT_ID_EXISTS", "Export snapshot ID already exists.");
    }
    assertExportOwnerSubjects(ownerSubjects);
    this.exportSessions.set(session.exportId, session);
    this.exportOwnerSubjects.set(session.exportId, [...ownerSubjects]);
    this.exportProgress.set(session.exportId, {
      schemaVersion: "namespring.local-content-export-progress.v1",
      exportId: session.exportId,
      nextCursor: { chunkIndex: 0, offset: 0 },
      servedArtifactCount: 0,
      lastRequestCursor: null,
      lastNextCursor: null,
      lastPageDigest: null,
      lastPageArtifactCount: 0,
      updatedAt: session.createdAt,
      expiresAt: session.expiresAt,
    });
    for (let chunkIndex = 0; chunkIndex < session.chunkCount; chunkIndex += 1) {
      const chunk: LocalContentExportChunkV1 = {
        exportId: session.exportId,
        chunkIndex,
        entries: entries.slice(chunkIndex * session.maxPageItems, (chunkIndex + 1) * session.maxPageItems),
        expiresAt: session.expiresAt,
      };
      this.exportChunks.set(`${session.exportId}:${chunkIndex}`, chunk);
    }
  }

  public async getLocalExportChunk(
    exportId: string,
    chunkIndex: number,
    requesterSubjects: readonly ContentAuditEventV1["actorSubject"][],
  ): Promise<{ readonly session: LocalContentExportSessionV1; readonly chunk: LocalContentExportChunkV1 }> {
    const session = this.exportSessions.get(exportId);
    const chunk = this.exportChunks.get(`${exportId}:${chunkIndex}`);
    if (!session || !chunk) {
      throw new ApiHttpError(404, "CONTENT_EXPORT_SNAPSHOT_NOT_FOUND", "Export snapshot or cursor was not found.");
    }
    const ownerSubjects = this.exportOwnerSubjects.get(exportId);
    if (!ownerSubjects) {
      throw new ApiHttpError(503, "CONTENT_EXPORT_OWNER_INVALID", "Export snapshot owner metadata is invalid.");
    }
    assertExportOwnerAccess(
      { ...session, expiresAt: Timestamp.fromDate(new Date(session.expiresAt)), ownerSubjects },
      requesterSubjects,
    );
    if (this.catalogRevision !== session.catalogRevision) {
      throw new ApiHttpError(409, "CONTENT_EXPORT_SNAPSHOT_INVALIDATED", "Active content changed; start a new export.");
    }
    return { session, chunk };
  }

  public async assertLocalExportSnapshotCurrent(
    exportId: string,
    catalogRevision: number,
    requesterSubjects: readonly ContentAuditEventV1["actorSubject"][],
  ): Promise<LocalContentExportSessionV1> {
    const session = this.exportSessions.get(exportId);
    if (!session || session.catalogRevision !== catalogRevision || this.catalogRevision !== catalogRevision) {
      throw new ApiHttpError(409, "CONTENT_EXPORT_SNAPSHOT_INVALIDATED", "Export snapshot is no longer current.");
    }
    const ownerSubjects = this.exportOwnerSubjects.get(exportId);
    if (!ownerSubjects) {
      throw new ApiHttpError(503, "CONTENT_EXPORT_OWNER_INVALID", "Export snapshot owner metadata is invalid.");
    }
    assertExportOwnerAccess(
      { ...session, expiresAt: Timestamp.fromDate(new Date(session.expiresAt)), ownerSubjects },
      requesterSubjects,
    );
    return session;
  }

  public async recordLocalExportPageDelivery(params: {
    readonly exportId: string;
    readonly catalogRevision: number;
    readonly requestCursor: LocalContentExportCursorV1;
    readonly nextCursor: LocalContentExportCursorV1 | null;
    readonly pageDigest: Sha256DigestV1;
    readonly pageArtifactCount: number;
    readonly occurredAt: string;
    readonly requesterSubjects: readonly ContentAuditEventV1["actorSubject"][];
  }): Promise<void> {
    const session = await this.assertLocalExportSnapshotCurrent(
      params.exportId,
      params.catalogRevision,
      params.requesterSubjects,
    );
    const progress = this.exportProgress.get(params.exportId);
    if (!progress) {
      throw new ApiHttpError(503, "CONTENT_EXPORT_PROGRESS_INVALID", "Export delivery progress is missing.");
    }
    const occurredAtMs = Date.parse(params.occurredAt);
    if (!CONTENT_EXPORT_SHA256.test(params.pageDigest)
      || !Number.isSafeInteger(params.pageArtifactCount)
      || params.pageArtifactCount < 1
      || params.pageArtifactCount > session.maxPageItems
      || !Number.isFinite(occurredAtMs)
      || new Date(occurredAtMs).toISOString() !== params.occurredAt) {
      throw new ApiHttpError(500, "CONTENT_EXPORT_DELIVERY_INPUT_INVALID", "Export page delivery input is invalid.");
    }
    if (sameExportCursor(progress.lastRequestCursor, params.requestCursor)
      && progress.lastPageDigest === params.pageDigest
      && progress.lastPageArtifactCount === params.pageArtifactCount
      && sameExportCursor(progress.lastNextCursor, params.nextCursor)) return;
    if (!sameExportCursor(progress.nextCursor, params.requestCursor)) {
      throw new ApiHttpError(409, "CONTENT_EXPORT_CURSOR_OUT_OF_SEQUENCE", "Export pages must be consumed in cursor order.");
    }
    if (params.nextCursor !== null) {
      const sameChunkAdvance = params.nextCursor.chunkIndex === params.requestCursor.chunkIndex
        && params.nextCursor.offset > params.requestCursor.offset;
      const nextChunkAdvance = params.nextCursor.chunkIndex === params.requestCursor.chunkIndex + 1
        && params.nextCursor.offset === 0;
      if ((!sameChunkAdvance && !nextChunkAdvance) || params.nextCursor.chunkIndex >= session.chunkCount) {
        throw new ApiHttpError(500, "CONTENT_EXPORT_DELIVERY_INPUT_INVALID", "Export next cursor is invalid.");
      }
    }
    const servedArtifactCount = progress.servedArtifactCount + params.pageArtifactCount;
    if (servedArtifactCount > session.artifactCount
      || (params.nextCursor === null && servedArtifactCount !== session.artifactCount)
      || (params.nextCursor !== null && servedArtifactCount >= session.artifactCount)) {
      throw new ApiHttpError(503, "CONTENT_EXPORT_PROGRESS_INVALID", "Export delivery count is inconsistent.");
    }
    this.exportProgress.set(params.exportId, {
      ...progress,
      nextCursor: params.nextCursor,
      servedArtifactCount,
      lastRequestCursor: params.requestCursor,
      lastNextCursor: params.nextCursor,
      lastPageDigest: params.pageDigest,
      lastPageArtifactCount: params.pageArtifactCount,
      updatedAt: params.occurredAt,
    });
  }

  public async assertLocalExportDeliveryComplete(
    exportId: string,
    catalogRevision: number,
    requesterSubjects: readonly ContentAuditEventV1["actorSubject"][],
  ): Promise<LocalContentExportSessionV1> {
    const session = await this.assertLocalExportSnapshotCurrent(exportId, catalogRevision, requesterSubjects);
    const progress = this.exportProgress.get(exportId);
    if (!progress
      || progress.nextCursor !== null
      || progress.servedArtifactCount !== session.artifactCount
      || progress.lastPageDigest === null) {
      throw new ApiHttpError(
        409,
        "CONTENT_EXPORT_DELIVERY_INCOMPLETE",
        "Every export page must be served in order before finalization.",
      );
    }
    return session;
  }
}
