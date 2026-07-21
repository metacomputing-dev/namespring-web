import { createHash, randomBytes } from "node:crypto";
import {
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type QueryDocumentSnapshot,
  type Transaction,
} from "firebase-admin/firestore";
import type {
  SyncAuditEventV1,
  SyncDeletionReceiptV1,
  SyncDocumentV1,
  SyncMutationV1,
  SyncMutationResponseV1,
  SyncRetentionDueAggregateV1,
  SyncRetentionSweepResultV1,
  SyncScopeV1,
  SyncedFavoriteV1,
} from "../../shared/types/sync-contract.js";
import {
  SYNC_CONSENT_POLICY_VERSION_V1,
  SYNC_DOCUMENT_SCHEMA_V1,
  SYNC_ENCRYPTION_CAPABILITY_V1,
  SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1,
} from "../../shared/types/sync-contract.js";
import { ApiHttpError } from "./http.js";
import { assertAccountWriteAllowedV1 } from "./account-write-fence.js";
import { getFirestoreDb } from "./firestore-admin.js";

const SYNC_DOCUMENTS = "account_sync_v1";
const REQUEST_RECEIPTS = "account_sync_request_receipts_v1";
const DELETION_RECEIPTS = "account_sync_deletion_receipts_v1";
const AUDIT_EVENTS = "account_sync_audit_events_v1";
const RETENTION_TRANSACTION_CHUNK_SIZE = 10;
// 100 * 4 KiB decoded ciphertext stays comfortably below Firestore's 1 MiB
// document limit after base64 and metadata overhead.
const MAX_FAVORITES = 100;

export class SyncVersionConflictError extends ApiHttpError {
  public constructor(public readonly serverDocument: SyncDocumentV1) {
    super(409, "SYNC_VERSION_CONFLICT", "Sync state changed; merge the server document before retrying.");
  }
}

export interface SyncActorV1 {
  readonly userId: string;
  readonly sessionId: string;
}

interface SyncMutationBaseV1 {
  readonly actor: SyncActorV1;
  readonly ownerHash: `hmac-sha256:${string}`;
  readonly actorSessionHash: `hmac-sha256:${string}`;
  readonly requestId: string;
  readonly requestDigest: `sha256:${string}`;
  readonly occurredAt: string;
  readonly auditId: string;
  readonly auditDeleteAfter: string;
}

export type SyncMutationCommandV1 =
  | (SyncMutationBaseV1 & {
      readonly kind: "grant";
      readonly scopes: readonly SyncScopeV1[];
      readonly expiresAt: string;
    })
  | (SyncMutationBaseV1 & {
      readonly kind: "delta";
      readonly baseVersion: number;
      readonly mutations: readonly SyncMutationV1[];
      readonly expiresAt: string;
    })
  | (SyncMutationBaseV1 & {
      readonly kind: "revoke";
      readonly reason: "user_request" | "account_deletion" | "policy_change";
      readonly expiresAt: string;
      readonly deletionReceipt: SyncDeletionReceiptV1;
    })
  | (SyncMutationBaseV1 & {
      readonly kind: "delete";
      readonly reason: "user_request" | "account_deletion";
      readonly deletionReceipt: SyncDeletionReceiptV1;
    });

interface SyncRequestReceiptV1 {
  readonly requestDigest: `sha256:${string}`;
  readonly resultingVersion: number | null;
  readonly committedAt: string;
  readonly deleteAfter: string;
}

type StoredSyncDocumentV1 = Omit<SyncDocumentV1, "expiresAt"> & { readonly expiresAt: Timestamp };
type StoredSyncRequestReceiptV1 = Omit<SyncRequestReceiptV1, "deleteAfter"> & { readonly deleteAfter: Timestamp };
type StoredSyncDeletionReceiptV1 = Omit<SyncDeletionReceiptV1, "deleteAfter"> & { readonly deleteAfter: Timestamp };
type StoredSyncAuditEventV1 = Omit<SyncAuditEventV1, "deleteAfter"> & { readonly deleteAfter: Timestamp };

const STORED_SYNC_OWNER_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const STORED_FAVORITE_ID = /^fav_[A-Za-z0-9_-]{16,64}$/u;
const STORED_OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const STORED_BASE64URL = /^[A-Za-z0-9_-]+$/u;
const STORED_SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/u;

function storedSyncInvalid(field: string): never {
  throw new ApiHttpError(
    503,
    "SYNC_STORAGE_RECORD_INVALID",
    `Stored sync document failed the ${field} integrity check.`,
  );
}

function storedPlainObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) storedSyncInvalid(field);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) storedSyncInvalid(field);
  return value as Record<string, unknown>;
}

function storedExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  field: string,
): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) storedSyncInvalid(field);
  if (required.some((key) => !Object.hasOwn(value, key))) storedSyncInvalid(field);
}

function storedCanonicalIso(value: unknown, field: string): string {
  if (typeof value !== "string") storedSyncInvalid(field);
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) storedSyncInvalid(field);
  return value;
}

function decodeStoredConsent(value: unknown): SyncDocumentV1["consent"] {
  const consent = storedPlainObject(value, "consent");
  storedExactKeys(
    consent,
    ["policyVersion", "status", "scopes", "grantedAt", "revokedAt"],
    ["policyVersion", "status", "scopes", "grantedAt"],
    "consent",
  );
  if (consent.policyVersion !== SYNC_CONSENT_POLICY_VERSION_V1) storedSyncInvalid("consent.policyVersion");
  if (consent.status !== "active" && consent.status !== "revoked") storedSyncInvalid("consent.status");
  if (!Array.isArray(consent.scopes) || consent.scopes.length < 1 || consent.scopes.length > 2) {
    storedSyncInvalid("consent.scopes");
  }
  const scopes = consent.scopes.map((scope) => {
    if (scope !== "favorites" && scope !== "preferences") storedSyncInvalid("consent.scopes");
    return scope;
  });
  if (new Set(scopes).size !== scopes.length) storedSyncInvalid("consent.scopes");
  const sortedScopes = [...scopes].sort();
  if (sortedScopes.some((scope, index) => scope !== scopes[index])) storedSyncInvalid("consent.scopes");
  const grantedAt = storedCanonicalIso(consent.grantedAt, "consent.grantedAt");
  if (consent.status === "active") {
    if (Object.hasOwn(consent, "revokedAt")) storedSyncInvalid("consent.revokedAt");
    return {
      policyVersion: SYNC_CONSENT_POLICY_VERSION_V1,
      status: "active",
      scopes: sortedScopes,
      grantedAt,
    };
  }
  const revokedAt = storedCanonicalIso(consent.revokedAt, "consent.revokedAt");
  if (Date.parse(revokedAt) < Date.parse(grantedAt)) storedSyncInvalid("consent.revokedAt");
  return {
    policyVersion: SYNC_CONSENT_POLICY_VERSION_V1,
    status: "revoked",
    scopes: sortedScopes,
    grantedAt,
    revokedAt,
  };
}

function decodeStoredFavorite(value: unknown, index: number): SyncedFavoriteV1 {
  const field = `favorites[${index}]`;
  const favorite = storedPlainObject(value, field);
  storedExactKeys(
    favorite,
    ["favoriteId", "resourceType", "encryptedEnvelope", "createdAt", "updatedAt"],
    ["favoriteId", "resourceType", "encryptedEnvelope", "createdAt", "updatedAt"],
    field,
  );
  if (typeof favorite.favoriteId !== "string" || !STORED_FAVORITE_ID.test(favorite.favoriteId)) {
    storedSyncInvalid(`${field}.favoriteId`);
  }
  if (
    favorite.resourceType !== "name_candidate"
    && favorite.resourceType !== "local_report"
    && favorite.resourceType !== "paid_report"
  ) storedSyncInvalid(`${field}.resourceType`);
  const envelope = storedPlainObject(favorite.encryptedEnvelope, `${field}.encryptedEnvelope`);
  storedExactKeys(
    envelope,
    ["algorithm", "aadVersion", "keyVersion", "nonce", "ciphertext"],
    ["algorithm", "aadVersion", "keyVersion", "nonce", "ciphertext"],
    `${field}.encryptedEnvelope`,
  );
  if (envelope.algorithm !== "A256GCM" || envelope.aadVersion !== "namespring.favorite-envelope.v1") {
    storedSyncInvalid(`${field}.encryptedEnvelope`);
  }
  if (typeof envelope.keyVersion !== "string" || !STORED_OPAQUE_ID.test(envelope.keyVersion)) {
    storedSyncInvalid(`${field}.encryptedEnvelope.keyVersion`);
  }
  if (typeof envelope.nonce !== "string" || !STORED_BASE64URL.test(envelope.nonce)) {
    storedSyncInvalid(`${field}.encryptedEnvelope.nonce`);
  }
  const nonce = Buffer.from(envelope.nonce, "base64url");
  if (nonce.length !== 12 || nonce.toString("base64url") !== envelope.nonce) {
    storedSyncInvalid(`${field}.encryptedEnvelope.nonce`);
  }
  if (typeof envelope.ciphertext !== "string" || !STORED_BASE64URL.test(envelope.ciphertext)) {
    storedSyncInvalid(`${field}.encryptedEnvelope.ciphertext`);
  }
  const ciphertext = Buffer.from(envelope.ciphertext, "base64url");
  if (
    ciphertext.length < 16
    || ciphertext.length > SYNC_ENCRYPTION_CAPABILITY_V1.maxCiphertextBytes
    || ciphertext.toString("base64url") !== envelope.ciphertext
  ) storedSyncInvalid(`${field}.encryptedEnvelope.ciphertext`);
  const createdAt = storedCanonicalIso(favorite.createdAt, `${field}.createdAt`);
  const updatedAt = storedCanonicalIso(favorite.updatedAt, `${field}.updatedAt`);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) storedSyncInvalid(`${field}.updatedAt`);
  return {
    favoriteId: favorite.favoriteId,
    resourceType: favorite.resourceType,
    encryptedEnvelope: {
      algorithm: "A256GCM",
      aadVersion: "namespring.favorite-envelope.v1",
      keyVersion: envelope.keyVersion,
      nonce: envelope.nonce,
      ciphertext: envelope.ciphertext,
    },
    createdAt,
    updatedAt,
  };
}

function decodeStoredPreferences(value: unknown): SyncDocumentV1["preferences"] {
  const preferences = storedPlainObject(value, "preferences");
  storedExactKeys(
    preferences,
    ["theme", "fontScale", "reduceMotion", "locale", "defaultReportSurface"],
    [],
    "preferences",
  );
  if (preferences.theme !== undefined && !["system", "light", "dark"].includes(preferences.theme as string)) {
    storedSyncInvalid("preferences.theme");
  }
  if (preferences.fontScale !== undefined && !["sm", "md", "lg"].includes(preferences.fontScale as string)) {
    storedSyncInvalid("preferences.fontScale");
  }
  if (preferences.reduceMotion !== undefined && typeof preferences.reduceMotion !== "boolean") {
    storedSyncInvalid("preferences.reduceMotion");
  }
  if (preferences.locale !== undefined && preferences.locale !== "ko-KR") storedSyncInvalid("preferences.locale");
  if (
    preferences.defaultReportSurface !== undefined
    && !["integrated", "saju", "naming"].includes(preferences.defaultReportSurface as string)
  ) storedSyncInvalid("preferences.defaultReportSurface");
  return {
    ...(preferences.theme === undefined
      ? {}
      : { theme: preferences.theme as NonNullable<SyncDocumentV1["preferences"]["theme"]> }),
    ...(preferences.fontScale === undefined
      ? {}
      : { fontScale: preferences.fontScale as NonNullable<SyncDocumentV1["preferences"]["fontScale"]> }),
    ...(preferences.reduceMotion === undefined ? {} : { reduceMotion: preferences.reduceMotion }),
    ...(preferences.locale === undefined ? {} : { locale: "ko-KR" as const }),
    ...(preferences.defaultReportSurface === undefined
      ? {}
      : {
          defaultReportSurface: preferences.defaultReportSurface as NonNullable<
            SyncDocumentV1["preferences"]["defaultReportSurface"]
          >,
        }),
  };
}

function timestampFromIso(value: string, field: string): Timestamp {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) {
    throw new ApiHttpError(500, "SYNC_TIMESTAMP_INVALID", `${field} is not a valid ISO timestamp.`);
  }
  return Timestamp.fromMillis(millis);
}

export function encodeSyncDocumentForFirestore(document: SyncDocumentV1): StoredSyncDocumentV1 {
  return { ...document, expiresAt: timestampFromIso(document.expiresAt, "expiresAt") };
}

export function decodeSyncDocumentFromFirestore(
  data: DocumentData,
  expectedOwnerUserId?: string,
): SyncDocumentV1 {
  const stored = storedPlainObject(data, "document");
  storedExactKeys(
    stored,
    ["schemaVersion", "ownerUserId", "version", "consent", "favorites", "preferences", "createdAt", "updatedAt", "expiresAt"],
    ["schemaVersion", "ownerUserId", "version", "consent", "favorites", "preferences", "createdAt", "updatedAt", "expiresAt"],
    "document",
  );
  if (stored.schemaVersion !== SYNC_DOCUMENT_SCHEMA_V1) storedSyncInvalid("schemaVersion");
  if (typeof stored.ownerUserId !== "string" || !STORED_SYNC_OWNER_ID.test(stored.ownerUserId)) {
    storedSyncInvalid("ownerUserId");
  }
  if (expectedOwnerUserId !== undefined && stored.ownerUserId !== expectedOwnerUserId) {
    storedSyncInvalid("ownerUserId");
  }
  if (typeof stored.version !== "number" || !Number.isSafeInteger(stored.version) || stored.version < 1) {
    storedSyncInvalid("version");
  }
  if (!Array.isArray(stored.favorites) || stored.favorites.length > MAX_FAVORITES) {
    storedSyncInvalid("favorites");
  }
  const favorites = stored.favorites.map(decodeStoredFavorite);
  if (new Set(favorites.map((favorite) => favorite.favoriteId)).size !== favorites.length) {
    storedSyncInvalid("favorites.favoriteId");
  }
  if (favorites.some((favorite, index) => index > 0 && favorites[index - 1]!.favoriteId >= favorite.favoriteId)) {
    storedSyncInvalid("favorites.order");
  }
  try {
    assertNoEncryptionNonceReuse(favorites);
  } catch {
    storedSyncInvalid("favorites.encryptedEnvelope.nonce");
  }
  if (!(stored.expiresAt instanceof Timestamp)) {
    throw new ApiHttpError(
      503,
      "SYNC_TTL_FIELD_INVALID",
      "Stored sync expiresAt must be a Firestore Timestamp; run the TTL migration before serving it.",
    );
  }
  const createdAt = storedCanonicalIso(stored.createdAt, "createdAt");
  const updatedAt = storedCanonicalIso(stored.updatedAt, "updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) storedSyncInvalid("updatedAt");
  return {
    schemaVersion: SYNC_DOCUMENT_SCHEMA_V1,
    ownerUserId: stored.ownerUserId,
    version: stored.version,
    consent: decodeStoredConsent(stored.consent),
    favorites,
    preferences: decodeStoredPreferences(stored.preferences),
    createdAt,
    updatedAt,
    expiresAt: stored.expiresAt.toDate().toISOString(),
  };
}

interface StoredDocumentLocationV1 {
  readonly path: string;
}

function expectedSyncDocumentPath(ownerUserId: string): string {
  return `${SYNC_DOCUMENTS}/${safeId(ownerUserId)}`;
}

/**
 * Bind a decoded owner to the physical Firestore document that contains it.
 * This is essential for collection sweeps, where the owner is discovered from
 * storage rather than supplied by an authenticated request.
 */
export function decodeSyncDocumentAtFirestoreLocation(
  data: DocumentData,
  location: StoredDocumentLocationV1,
  expectedOwnerUserId?: string,
): SyncDocumentV1 {
  const document = decodeSyncDocumentFromFirestore(data, expectedOwnerUserId);
  if (location.path !== expectedSyncDocumentPath(document.ownerUserId)) {
    storedSyncInvalid("documentPath");
  }
  return document;
}

/** Strict Firestore decoder for durable sync idempotency receipts. */
export function decodeSyncRequestReceiptFromFirestore(
  data: DocumentData,
  location: StoredDocumentLocationV1,
  expected: { readonly ownerUserId: string; readonly requestId: string },
): SyncRequestReceiptV1 {
  if (
    typeof expected.ownerUserId !== "string"
    || !STORED_SYNC_OWNER_ID.test(expected.ownerUserId)
    || typeof expected.requestId !== "string"
    || !STORED_OPAQUE_ID.test(expected.requestId)
  ) {
    storedSyncInvalid("requestReceipt.expectedIdentity");
  }
  if (location.path !== `${REQUEST_RECEIPTS}/${safeId(`${expected.ownerUserId}:${expected.requestId}`)}`) {
    storedSyncInvalid("requestReceipt.documentPath");
  }
  const stored = storedPlainObject(data, "requestReceipt");
  storedExactKeys(
    stored,
    ["requestDigest", "resultingVersion", "committedAt", "deleteAfter"],
    ["requestDigest", "resultingVersion", "committedAt", "deleteAfter"],
    "requestReceipt",
  );
  if (typeof stored.requestDigest !== "string" || !STORED_SHA256_DIGEST.test(stored.requestDigest)) {
    storedSyncInvalid("requestReceipt.requestDigest");
  }
  if (
    stored.resultingVersion !== null
    && (
      typeof stored.resultingVersion !== "number"
      || !Number.isSafeInteger(stored.resultingVersion)
      || stored.resultingVersion < 1
    )
  ) storedSyncInvalid("requestReceipt.resultingVersion");
  const committedAt = storedCanonicalIso(stored.committedAt, "requestReceipt.committedAt");
  if (!(stored.deleteAfter instanceof Timestamp)) {
    storedSyncInvalid("requestReceipt.deleteAfter");
  }
  const deleteAfterDate = stored.deleteAfter.toDate();
  const deleteAfter = deleteAfterDate.toISOString();
  if (
    !Timestamp.fromDate(deleteAfterDate).isEqual(stored.deleteAfter)
    || Date.parse(deleteAfter) <= Date.parse(committedAt)
  ) {
    storedSyncInvalid("requestReceipt.deleteAfter");
  }
  return {
    requestDigest: stored.requestDigest as `sha256:${string}`,
    resultingVersion: stored.resultingVersion,
    committedAt,
    deleteAfter,
  };
}

function encodeDeletionReceipt(receipt: SyncDeletionReceiptV1): StoredSyncDeletionReceiptV1 {
  return { ...receipt, deleteAfter: timestampFromIso(receipt.deleteAfter, "deleteAfter") };
}

function encodeAudit(event: SyncAuditEventV1): StoredSyncAuditEventV1 {
  return { ...event, deleteAfter: timestampFromIso(event.deleteAfter, "deleteAfter") };
}

interface AppliedSyncMutationV1 {
  readonly document: SyncDocumentV1 | null;
  readonly deletionReceipt?: SyncDeletionReceiptV1;
  readonly audit: SyncAuditEventV1;
}

export interface SyncRepositoryV1 {
  commit(command: SyncMutationCommandV1): Promise<SyncMutationResponseV1>;
  get(userId: string): Promise<SyncDocumentV1 | null>;
  deleteExpired(params: {
    readonly actorSessionHash: `hmac-sha256:${string}`;
    readonly occurredAt: string;
    readonly auditDeleteAfter: string;
    readonly limit: number;
    readonly deadlineAtEpochMs?: number;
    readonly makeReceipt: (userId: string) => SyncDeletionReceiptV1;
  }): Promise<SyncRetentionSweepResultV1>;
}

/** Read-only aggregate capability used by the retention operations surface. */
export interface SyncRetentionStatusRepositoryV1 {
  readRetentionDueStatus(observedAt: string): Promise<SyncRetentionDueAggregateV1>;
}

function audit(
  command: SyncMutationCommandV1,
  action: SyncAuditEventV1["action"],
  resultingVersion: number | null,
  mutationCount: number,
): SyncAuditEventV1 {
  return {
    schemaVersion: "namespring.account-sync-audit.v1",
    auditId: command.auditId,
    requestId: command.requestId,
    ownerHash: command.ownerHash,
    actorSessionHash: command.actorSessionHash,
    action,
    occurredAt: command.occurredAt,
    deleteAfter: command.auditDeleteAfter,
    resultingVersion,
    mutationCount,
  };
}

function normalizeFavorite(
  favorite: SyncedFavoriteV1,
  existing: SyncedFavoriteV1 | undefined,
  occurredAt: string,
): SyncedFavoriteV1 {
  return {
    favoriteId: favorite.favoriteId,
    resourceType: favorite.resourceType,
    encryptedEnvelope: favorite.encryptedEnvelope,
    createdAt: existing?.createdAt ?? occurredAt,
    updatedAt: occurredAt,
  };
}

function encryptionNonceKey(favorite: SyncedFavoriteV1): string {
  return `${favorite.encryptedEnvelope.keyVersion}:${favorite.encryptedEnvelope.nonce}`;
}

function assertNoEncryptionNonceReuse(favorites: Iterable<SyncedFavoriteV1>): void {
  const owners = new Map<string, string>();
  for (const favorite of favorites) {
    const key = encryptionNonceKey(favorite);
    const previousFavoriteId = owners.get(key);
    if (previousFavoriteId && previousFavoriteId !== favorite.favoriteId) {
      throw new ApiHttpError(
        409,
        "SYNC_ENCRYPTION_NONCE_REUSE",
        "The same A256GCM keyVersion/nonce pair cannot protect multiple favorites.",
      );
    }
    owners.set(key, favorite.favoriteId);
  }
}

export function applySyncMutation(
  current: SyncDocumentV1 | null,
  command: SyncMutationCommandV1,
): AppliedSyncMutationV1 {
  if (current && current.ownerUserId !== command.actor.userId) {
    throw new ApiHttpError(403, "SYNC_OWNER_MISMATCH", "Sync document ownership mismatch.");
  }
  if (command.kind === "grant") {
    const requestedScopes = new Set(command.scopes);
    const keepExisting = current?.consent.status === "active"
      && Date.parse(current.expiresAt) > Date.parse(command.occurredAt);
    const removedFavoriteCount = keepExisting && !requestedScopes.has("favorites") ? current.favorites.length : 0;
    const removedPreferenceCount = keepExisting && !requestedScopes.has("preferences")
      ? Object.keys(current.preferences).length
      : 0;
    const next: SyncDocumentV1 = {
      schemaVersion: SYNC_DOCUMENT_SCHEMA_V1,
      ownerUserId: command.actor.userId,
      version: (current?.version ?? 0) + 1,
      consent: {
        policyVersion: SYNC_CONSENT_POLICY_VERSION_V1,
        status: "active",
        scopes: [...command.scopes].sort(),
        grantedAt: command.occurredAt,
      },
      favorites: keepExisting && requestedScopes.has("favorites") ? current.favorites : [],
      preferences: keepExisting && requestedScopes.has("preferences") ? current.preferences : {},
      createdAt: current?.createdAt ?? command.occurredAt,
      updatedAt: command.occurredAt,
      expiresAt: command.expiresAt,
    };
    return {
      document: next,
      audit: audit(command, "consent.granted", next.version, removedFavoriteCount + removedPreferenceCount),
    };
  }

  if (command.kind === "delete") {
    return {
      document: null,
      deletionReceipt: command.deletionReceipt,
      audit: audit(command, "data.deleted", null, 0),
    };
  }

  if (!current) {
    throw new ApiHttpError(409, "SYNC_CONSENT_REQUIRED", "Grant sync consent before storing account data.");
  }
  if (command.kind === "revoke") {
    const revoked: SyncDocumentV1 = {
      ...current,
      version: current.version + 1,
      consent: {
        ...current.consent,
        status: "revoked",
        revokedAt: command.occurredAt,
      },
      favorites: [],
      preferences: {},
      updatedAt: command.occurredAt,
      expiresAt: command.expiresAt,
    };
    return {
      document: revoked,
      deletionReceipt: command.deletionReceipt,
      audit: audit(command, "consent.revoked", revoked.version, 0),
    };
  }

  if (current.consent.status !== "active") {
    throw new ApiHttpError(409, "SYNC_CONSENT_REQUIRED", "Sync consent is not active.");
  }
  if (Date.parse(current.expiresAt) <= Date.parse(command.occurredAt)) {
    throw new ApiHttpError(410, "SYNC_DATA_EXPIRED", "Synced data expired; grant consent again.");
  }
  if (current.version !== command.baseVersion) {
    throw new SyncVersionConflictError(current);
  }
  const grantedScopes = new Set(current.consent.scopes);
  for (const mutation of command.mutations) {
    if (!grantedScopes.has(mutation.scope)) {
      throw new ApiHttpError(403, "SYNC_SCOPE_NOT_GRANTED", `Consent does not include ${mutation.scope}.`);
    }
  }

  const favorites = new Map(current.favorites.map((favorite) => [favorite.favoriteId, favorite]));
  let preferences = current.preferences;
  for (const mutation of command.mutations) {
    if (mutation.scope === "favorites" && mutation.operation === "upsert") {
      const previous = favorites.get(mutation.favorite.favoriteId);
      if (
        previous
        && encryptionNonceKey(previous) === encryptionNonceKey(mutation.favorite)
        && previous.encryptedEnvelope.ciphertext !== mutation.favorite.encryptedEnvelope.ciphertext
      ) {
        throw new ApiHttpError(
          409,
          "SYNC_ENCRYPTION_NONCE_REUSE",
          "Updating encrypted favorite content requires a fresh A256GCM nonce.",
        );
      }
      favorites.set(
        mutation.favorite.favoriteId,
        normalizeFavorite(mutation.favorite, favorites.get(mutation.favorite.favoriteId), command.occurredAt),
      );
    } else if (mutation.scope === "favorites" && mutation.operation === "delete") {
      favorites.delete(mutation.favoriteId);
    } else if (mutation.scope === "preferences" && mutation.operation === "replace") {
      preferences = mutation.preferences;
    }
  }
  if (favorites.size > MAX_FAVORITES) {
    throw new ApiHttpError(409, "SYNC_FAVORITE_LIMIT", `At most ${MAX_FAVORITES} favorites can be synchronized.`);
  }
  assertNoEncryptionNonceReuse(favorites.values());
  const next: SyncDocumentV1 = {
    ...current,
    version: current.version + 1,
    favorites: [...favorites.values()].sort((left, right) => left.favoriteId.localeCompare(right.favoriteId)),
    preferences,
    updatedAt: command.occurredAt,
    expiresAt: command.expiresAt,
  };
  return {
    document: next,
    audit: audit(command, "delta.applied", next.version, command.mutations.length),
  };
}

function safeId(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

interface SyncRetentionCandidateV1 {
  readonly ref: DocumentReference<DocumentData>;
  readonly updateTime: Timestamp;
}

interface SyncRetentionChunkResultV1 {
  readonly deleted: number;
  readonly skipped: number;
}

export interface FirestoreSyncRepositoryOptionsV1 {
  /**
   * Deterministic race-test seam invoked after the real candidate query and
   * before any deletion transaction. Production leaves this unset.
   */
  readonly afterRetentionCandidatesRead?: () => void | Promise<void>;
}

function sameTimestamp(left: Timestamp | undefined, right: Timestamp): boolean {
  return !!left && left.isEqual(right);
}

function chunked<T>(values: readonly T[], size: number): readonly (readonly T[])[] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function readRetentionDueStatusFromFirestoreV1(
  db: Firestore,
  observedAt: string,
): Promise<SyncRetentionDueAggregateV1> {
  const due = await db.collection(SYNC_DOCUMENTS)
    .where("expiresAt", "<=", timestampFromIso(observedAt, "observedAt"))
    .orderBy("expiresAt", "asc")
    // Project only the one aggregate input. Account IDs, encrypted payloads,
    // preferences, and document references never enter the response builder.
    .select("expiresAt")
    .limit(SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1 + 1)
    .get();
  const oldestData = due.docs[0]?.data();
  if (oldestData !== undefined && !(oldestData.expiresAt instanceof Timestamp)) {
    throw new ApiHttpError(503, "SYNC_TTL_FIELD_INVALID", "Stored sync expiresAt must be a Firestore Timestamp.");
  }
  return {
    candidateCount: Math.min(due.size, SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1),
    candidateCountCap: SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1,
    hasMore: due.size > SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1,
    oldestDueAt: oldestData === undefined ? null : oldestData.expiresAt.toDate().toISOString(),
  };
}

/** Firestore adapter with no account get/commit/sweep methods at runtime. */
export class FirestoreSyncRetentionStatusRepositoryV1 implements SyncRetentionStatusRepositoryV1 {
  public constructor(private readonly db: Firestore = getFirestoreDb()) {}

  public readRetentionDueStatus(observedAt: string): Promise<SyncRetentionDueAggregateV1> {
    return readRetentionDueStatusFromFirestoreV1(this.db, observedAt);
  }
}

export class FirestoreSyncRepositoryV1 implements SyncRepositoryV1 {
  public constructor(
    private readonly db: Firestore = getFirestoreDb(),
    private readonly options: FirestoreSyncRepositoryOptionsV1 = {},
  ) {}

  public async commit(command: SyncMutationCommandV1): Promise<SyncMutationResponseV1> {
    const db = this.db;
    const syncRef = db.collection(SYNC_DOCUMENTS).doc(safeId(command.actor.userId));
    const receiptRef = db.collection(REQUEST_RECEIPTS).doc(safeId(`${command.actor.userId}:${command.requestId}`));
    return db.runTransaction(async (transaction) => {
      if (!(command.kind === "delete" && command.reason === "account_deletion")) {
        await assertAccountWriteAllowedV1(transaction, db, command.actor.userId);
      }
      const [receiptSnapshot, syncSnapshot] = await Promise.all([
        transaction.get(receiptRef),
        transaction.get(syncRef),
      ]);
      if (receiptSnapshot.exists) {
        const receipt = decodeSyncRequestReceiptFromFirestore(
          receiptSnapshot.data()!,
          receiptSnapshot.ref,
          { ownerUserId: command.actor.userId, requestId: command.requestId },
        );
        if (receipt.requestDigest !== command.requestDigest) {
          throw new ApiHttpError(409, "IDEMPOTENCY_KEY_REUSED", "requestId was reused with different sync content.");
        }
        return {
          resultingVersion: receipt.resultingVersion,
          operation: "idempotent_replay" as const,
          encryption: SYNC_ENCRYPTION_CAPABILITY_V1,
        };
      }
      const current = syncSnapshot.exists
        ? decodeSyncDocumentAtFirestoreLocation(syncSnapshot.data()!, syncSnapshot.ref, command.actor.userId)
        : null;
      const applied = applySyncMutation(current, command);
      if (applied.document) {
        transaction.set(syncRef, encodeSyncDocumentForFirestore(applied.document), { merge: false });
      } else {
        transaction.delete(syncRef);
      }
      if (applied.deletionReceipt) {
        transaction.create(
          db.collection(DELETION_RECEIPTS).doc(applied.deletionReceipt.receiptId),
          encodeDeletionReceipt(applied.deletionReceipt),
        );
      }
      transaction.create(db.collection(AUDIT_EVENTS).doc(applied.audit.auditId), encodeAudit(applied.audit));
      transaction.create(receiptRef, {
        requestDigest: command.requestDigest,
        resultingVersion: applied.document?.version ?? null,
        committedAt: command.occurredAt,
        deleteAfter: timestampFromIso(command.auditDeleteAfter, "deleteAfter"),
      } satisfies StoredSyncRequestReceiptV1);
      return {
        resultingVersion: applied.document?.version ?? null,
        operation: "initial" as const,
        encryption: SYNC_ENCRYPTION_CAPABILITY_V1,
      };
    });
  }

  public async get(userId: string): Promise<SyncDocumentV1 | null> {
    const snapshot = await this.db.collection(SYNC_DOCUMENTS).doc(safeId(userId)).get();
    return snapshot.exists ? decodeSyncDocumentAtFirestoreLocation(snapshot.data()!, snapshot.ref, userId) : null;
  }

  private async deleteExpiredChunk(
    transaction: Transaction,
    candidates: readonly SyncRetentionCandidateV1[],
    params: {
      readonly actorSessionHash: `hmac-sha256:${string}`;
      readonly occurredAt: string;
      readonly auditDeleteAfter: string;
      readonly makeReceipt: (userId: string) => SyncDeletionReceiptV1;
    },
  ): Promise<SyncRetentionChunkResultV1> {
    // All reads happen before writes. Firestore retries this callback if a user
    // changes a document before commit; the original query updateTime then no
    // longer matches and the refreshed document is deliberately preserved.
    const snapshots = await Promise.all(candidates.map((candidate) => transaction.get(candidate.ref)));
    let deleted = 0;
    let skipped = 0;
    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index]!;
      const candidate = candidates[index]!;
      if (!snapshot.exists || !sameTimestamp(snapshot.updateTime, candidate.updateTime)) {
        skipped += 1;
        continue;
      }
      const document = decodeSyncDocumentAtFirestoreLocation(snapshot.data()!, snapshot.ref);
      if (Date.parse(document.expiresAt) > Date.parse(params.occurredAt)) {
        skipped += 1;
        continue;
      }
      const receipt = params.makeReceipt(document.ownerUserId);
      const auditId = `saud_${randomHash(`${document.ownerUserId}:${params.occurredAt}`)}`;
      const retentionAudit = {
        schemaVersion: "namespring.account-sync-audit.v1",
        auditId,
        requestId: `retention_${randomHash(document.ownerUserId)}`,
        ownerHash: receipt.ownerHash,
        actorSessionHash: params.actorSessionHash,
        action: "retention.expired",
        occurredAt: params.occurredAt,
        deleteAfter: params.auditDeleteAfter,
        resultingVersion: null,
        mutationCount: 0,
      } satisfies SyncAuditEventV1;
      // The raw owner ID exists only in the expiring source document and local
      // memory. Durable receipt/audit records contain its keyed HMAC only.
      transaction.delete(snapshot.ref);
      transaction.create(
        this.db.collection(DELETION_RECEIPTS).doc(receipt.receiptId),
        encodeDeletionReceipt(receipt),
      );
      transaction.create(this.db.collection(AUDIT_EVENTS).doc(auditId), encodeAudit(retentionAudit));
      deleted += 1;
    }
    return { deleted, skipped };
  }

  private async runRetentionChunk(
    candidates: readonly SyncRetentionCandidateV1[],
    params: {
      readonly actorSessionHash: `hmac-sha256:${string}`;
      readonly occurredAt: string;
      readonly auditDeleteAfter: string;
      readonly makeReceipt: (userId: string) => SyncDeletionReceiptV1;
    },
  ): Promise<SyncRetentionChunkResultV1> {
    return this.db.runTransaction(
      (transaction) => this.deleteExpiredChunk(transaction, candidates, params),
    );
  }

  public async deleteExpired(params: {
    readonly actorSessionHash: `hmac-sha256:${string}`;
    readonly occurredAt: string;
    readonly auditDeleteAfter: string;
    readonly limit: number;
    readonly deadlineAtEpochMs?: number;
    readonly makeReceipt: (userId: string) => SyncDeletionReceiptV1;
  }): Promise<SyncRetentionSweepResultV1> {
    const expired = await this.db.collection(SYNC_DOCUMENTS)
      .where("expiresAt", "<=", timestampFromIso(params.occurredAt, "occurredAt"))
      .orderBy("expiresAt", "asc")
      .limit(params.limit)
      .get();
    const candidates = expired.docs.map((snapshot: QueryDocumentSnapshot<DocumentData>) => ({
      ref: snapshot.ref,
      updateTime: snapshot.updateTime,
    }));
    if (candidates.length > 0) await this.options.afterRetentionCandidatesRead?.();
    let dataDocumentsDeleted = 0;
    let dataDocumentsSkipped = 0;
    let dataDocumentsFailed = 0;
    let deadlineReached = false;
    for (const chunk of chunked(candidates, RETENTION_TRANSACTION_CHUNK_SIZE)) {
      if (params.deadlineAtEpochMs !== undefined && Date.now() >= params.deadlineAtEpochMs) {
        deadlineReached = true;
        break;
      }
      try {
        const result = await this.runRetentionChunk(chunk, params);
        dataDocumentsDeleted += result.deleted;
        dataDocumentsSkipped += result.skipped;
      } catch {
        // Isolate a corrupt/contended candidate so one record cannot prevent
        // unrelated retention work. Every single-document retry remains fully
        // atomic: source delete + HMAC receipt + payload-free audit.
        for (const candidate of chunk) {
          if (params.deadlineAtEpochMs !== undefined && Date.now() >= params.deadlineAtEpochMs) {
            deadlineReached = true;
            break;
          }
          try {
            const result = await this.runRetentionChunk([candidate], params);
            dataDocumentsDeleted += result.deleted;
            dataDocumentsSkipped += result.skipped;
          } catch {
            dataDocumentsFailed += 1;
          }
        }
      }
      if (deadlineReached) break;
    }
    return {
      dataDocumentsScanned: expired.size,
      dataDocumentsDeleted,
      dataDocumentsSkipped,
      dataDocumentsFailed,
      deadlineReached,
      // These three collections are intentionally owned by Firestore TTL.
      // The live-data worker never races TTL for receipt/audit cleanup.
      deletionReceiptsDeleted: 0,
      requestReceiptsDeleted: 0,
      auditEventsDeleted: 0,
    };
  }
}

/** Deterministic adapter for validation and conflict/idempotency contract tests. */
export class InMemorySyncRepositoryV1 implements SyncRepositoryV1, SyncRetentionStatusRepositoryV1 {
  private readonly documents = new Map<string, SyncDocumentV1>();
  private readonly receipts = new Map<string, SyncRequestReceiptV1>();
  public readonly deletionReceipts: SyncDeletionReceiptV1[] = [];
  public readonly audits: SyncAuditEventV1[] = [];

  public async commit(command: SyncMutationCommandV1): Promise<SyncMutationResponseV1> {
    const receiptKey = `${command.actor.userId}:${command.requestId}`;
    const receipt = this.receipts.get(receiptKey);
    if (receipt) {
      if (receipt.requestDigest !== command.requestDigest) {
        throw new ApiHttpError(409, "IDEMPOTENCY_KEY_REUSED", "requestId was reused with different sync content.");
      }
      return {
        resultingVersion: receipt.resultingVersion,
        operation: "idempotent_replay",
        encryption: SYNC_ENCRYPTION_CAPABILITY_V1,
      };
    }
    const current = this.documents.get(command.actor.userId) ?? null;
    const applied = applySyncMutation(current, command);
    if (applied.document) this.documents.set(command.actor.userId, applied.document);
    else this.documents.delete(command.actor.userId);
    if (applied.deletionReceipt) this.deletionReceipts.push(applied.deletionReceipt);
    this.audits.push(applied.audit);
    const resultingVersion = applied.document?.version ?? null;
    this.receipts.set(receiptKey, {
      requestDigest: command.requestDigest,
      resultingVersion,
      committedAt: command.occurredAt,
      deleteAfter: command.auditDeleteAfter,
    });
    return { resultingVersion, operation: "initial", encryption: SYNC_ENCRYPTION_CAPABILITY_V1 };
  }

  public async get(userId: string): Promise<SyncDocumentV1 | null> {
    return this.documents.get(userId) ?? null;
  }

  public async readRetentionDueStatus(observedAt: string): Promise<SyncRetentionDueAggregateV1> {
    const observedAtMillis = timestampFromIso(observedAt, "observedAt").toMillis();
    const due = [...this.documents.values()]
      .filter((document) => Date.parse(document.expiresAt) <= observedAtMillis)
      .sort((left, right) => Date.parse(left.expiresAt) - Date.parse(right.expiresAt))
      .slice(0, SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1 + 1);
    return {
      candidateCount: Math.min(due.length, SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1),
      candidateCountCap: SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1,
      hasMore: due.length > SYNC_RETENTION_STATUS_DUE_COUNT_CAP_V1,
      oldestDueAt: due[0]?.expiresAt ?? null,
    };
  }

  public async deleteExpired(params: {
    readonly actorSessionHash: `hmac-sha256:${string}`;
    readonly occurredAt: string;
    readonly auditDeleteAfter: string;
    readonly limit: number;
    readonly deadlineAtEpochMs?: number;
    readonly makeReceipt: (userId: string) => SyncDeletionReceiptV1;
  }): Promise<SyncRetentionSweepResultV1> {
    const expired = [...this.documents.values()]
      .filter((document) => document.expiresAt <= params.occurredAt)
      .slice(0, params.limit);
    for (const document of expired) {
      this.documents.delete(document.ownerUserId);
      this.deletionReceipts.push(params.makeReceipt(document.ownerUserId));
      this.audits.push({
        schemaVersion: "namespring.account-sync-audit.v1",
        auditId: `saud_${safeId(`${document.ownerUserId}:${params.occurredAt}`).slice(0, 32)}`,
        requestId: `retention_${safeId(document.ownerUserId).slice(0, 32)}`,
        ownerHash: this.deletionReceipts.at(-1)?.ownerHash ?? params.makeReceipt(document.ownerUserId).ownerHash,
        actorSessionHash: params.actorSessionHash,
        action: "retention.expired",
        occurredAt: params.occurredAt,
        deleteAfter: params.auditDeleteAfter,
        resultingVersion: null,
        mutationCount: 0,
      });
    }
    return {
      dataDocumentsScanned: expired.length,
      dataDocumentsDeleted: expired.length,
      dataDocumentsSkipped: 0,
      dataDocumentsFailed: 0,
      deadlineReached: false,
      deletionReceiptsDeleted: 0,
      requestReceiptsDeleted: 0,
      auditEventsDeleted: 0,
    };
  }
}

function randomHash(value: string): string {
  return createHash("sha256")
    .update(value, "utf8")
    .update(randomBytes(32))
    .digest("hex")
    .slice(0, 32);
}
