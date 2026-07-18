import { createHash } from "node:crypto";
import type {
  ApplySyncDeltaRequestV1,
  DeleteSyncedDataRequestV1,
  GrantSyncConsentRequestV1,
  RevokeSyncConsentRequestV1,
  SyncMutationV1,
  SyncedFavoriteV1,
  SyncedPreferencesV1,
  SyncScopeV1,
} from "../../shared/types/sync-contract.js";
import {
  SYNC_CONSENT_POLICY_VERSION_V1,
  SYNC_SCOPES_V1,
} from "../../shared/types/sync-contract.js";
import { ApiHttpError } from "./http.js";
import { canonicalJson } from "./content-validation.js";

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const FAVORITE_ID = /^fav_[A-Za-z0-9_-]{16,64}$/;
const MAX_MUTATIONS = 100;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export function syncRequestDigest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

function fail(message: string, code = "INVALID_SYNC_REQUEST"): never {
  throw new ApiHttpError(400, code, message);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${field} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(`${field} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  field: string,
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      fail(`${field}.${key} is not supported. Birth/name fields are never accepted by sync.`);
    }
  }
  for (const key of required) {
    if (!(key in value)) {
      fail(`${field}.${key} is required.`);
    }
  }
}

function opaqueId(value: unknown, field: string): string {
  if (typeof value !== "string" || !OPAQUE_ID.test(value)) {
    fail(`${field} must be an opaque identifier; display text and URLs are forbidden.`);
  }
  return value;
}

function isoTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string") {
    fail(`${field} must be an ISO timestamp.`);
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) {
    fail(`${field} must be a canonical ISO timestamp.`);
  }
  return value;
}

function favoriteId(value: unknown, field: string): string {
  if (typeof value !== "string" || !FAVORITE_ID.test(value)) {
    fail(`${field} must be a random opaque fav_ identifier.`);
  }
  return value;
}

function parseScopes(value: unknown): readonly SyncScopeV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > SYNC_SCOPES_V1.length) {
    fail("scopes must contain one or two supported scopes.");
  }
  const scopes = value.map((scope) => {
    if (scope !== "favorites" && scope !== "preferences") {
      fail("scopes contains an unsupported scope.");
    }
    return scope;
  });
  if (new Set(scopes).size !== scopes.length) {
    fail("scopes must not contain duplicates.");
  }
  return [...scopes].sort();
}

function parseFavorite(value: unknown, field: string): SyncedFavoriteV1 {
  const favorite = object(value, field);
  exactKeys(
    favorite,
    ["favoriteId", "resourceType", "encryptedEnvelope", "createdAt", "updatedAt"],
    ["favoriteId", "resourceType", "encryptedEnvelope", "createdAt", "updatedAt"],
    field,
  );
  if (!["name_candidate", "local_report", "paid_report"].includes(String(favorite.resourceType))) {
    fail(`${field}.resourceType is unsupported.`);
  }
  const envelope = object(favorite.encryptedEnvelope, `${field}.encryptedEnvelope`);
  exactKeys(
    envelope,
    ["algorithm", "aadVersion", "keyVersion", "nonce", "ciphertext"],
    ["algorithm", "aadVersion", "keyVersion", "nonce", "ciphertext"],
    `${field}.encryptedEnvelope`,
  );
  if (envelope.algorithm !== "A256GCM" || envelope.aadVersion !== "namespring.favorite-envelope.v1") {
    fail(`${field}.encryptedEnvelope uses an unsupported encryption contract.`);
  }
  if (typeof envelope.nonce !== "string" || !BASE64URL.test(envelope.nonce)) {
    fail(`${field}.encryptedEnvelope.nonce must be unpadded base64url.`);
  }
  const nonceBytes = Buffer.from(envelope.nonce, "base64url");
  if (nonceBytes.length !== 12 || nonceBytes.toString("base64url") !== envelope.nonce) {
    fail(`${field}.encryptedEnvelope.nonce must decode to 96 bits.`);
  }
  if (typeof envelope.ciphertext !== "string" || !BASE64URL.test(envelope.ciphertext)) {
    fail(`${field}.encryptedEnvelope.ciphertext must be unpadded base64url.`);
  }
  const ciphertextBuffer = Buffer.from(envelope.ciphertext, "base64url");
  const ciphertextBytes = ciphertextBuffer.length;
  if (
    ciphertextBytes < 16
    || ciphertextBytes > 4096
    || ciphertextBuffer.toString("base64url") !== envelope.ciphertext
  ) {
    fail(`${field}.encryptedEnvelope.ciphertext must decode to 16-4096 bytes.`);
  }
  return {
    favoriteId: favoriteId(favorite.favoriteId, `${field}.favoriteId`),
    resourceType: favorite.resourceType as SyncedFavoriteV1["resourceType"],
    encryptedEnvelope: {
      algorithm: "A256GCM",
      aadVersion: "namespring.favorite-envelope.v1",
      keyVersion: opaqueId(envelope.keyVersion, `${field}.encryptedEnvelope.keyVersion`),
      nonce: envelope.nonce,
      ciphertext: envelope.ciphertext,
    },
    createdAt: isoTimestamp(favorite.createdAt, `${field}.createdAt`),
    updatedAt: isoTimestamp(favorite.updatedAt, `${field}.updatedAt`),
  };
}

function parsePreferences(value: unknown, field: string): SyncedPreferencesV1 {
  const preferences = object(value, field);
  exactKeys(
    preferences,
    ["theme", "fontScale", "reduceMotion", "locale", "defaultReportSurface"],
    [],
    field,
  );
  if (preferences.theme !== undefined && !["system", "light", "dark"].includes(String(preferences.theme))) {
    fail(`${field}.theme is unsupported.`);
  }
  if (preferences.fontScale !== undefined && !["sm", "md", "lg"].includes(String(preferences.fontScale))) {
    fail(`${field}.fontScale is unsupported.`);
  }
  if (preferences.reduceMotion !== undefined && typeof preferences.reduceMotion !== "boolean") {
    fail(`${field}.reduceMotion must be boolean.`);
  }
  if (preferences.locale !== undefined && preferences.locale !== "ko-KR") {
    fail(`${field}.locale must be ko-KR.`);
  }
  if (
    preferences.defaultReportSurface !== undefined
    && !["integrated", "saju", "naming"].includes(String(preferences.defaultReportSurface))
  ) {
    fail(`${field}.defaultReportSurface is unsupported.`);
  }
  return {
    ...(preferences.theme === undefined ? {} : { theme: preferences.theme as NonNullable<SyncedPreferencesV1["theme"]> }),
    ...(preferences.fontScale === undefined ? {} : { fontScale: preferences.fontScale as NonNullable<SyncedPreferencesV1["fontScale"]> }),
    ...(preferences.reduceMotion === undefined ? {} : { reduceMotion: preferences.reduceMotion }),
    ...(preferences.locale === undefined ? {} : { locale: "ko-KR" as const }),
    ...(preferences.defaultReportSurface === undefined
      ? {}
      : { defaultReportSurface: preferences.defaultReportSurface as NonNullable<SyncedPreferencesV1["defaultReportSurface"]> }),
  };
}

function parseMutation(value: unknown, index: number): SyncMutationV1 {
  const mutation = object(value, `mutations[${index}]`);
  const base = ["mutationId", "scope", "operation"];
  if (mutation.scope === "favorites" && mutation.operation === "upsert") {
    exactKeys(mutation, [...base, "favorite"], [...base, "favorite"], `mutations[${index}]`);
    return {
      mutationId: opaqueId(mutation.mutationId, `mutations[${index}].mutationId`),
      scope: "favorites",
      operation: "upsert",
      favorite: parseFavorite(mutation.favorite, `mutations[${index}].favorite`),
    };
  }
  if (mutation.scope === "favorites" && mutation.operation === "delete") {
    exactKeys(mutation, [...base, "favoriteId"], [...base, "favoriteId"], `mutations[${index}]`);
    return {
      mutationId: opaqueId(mutation.mutationId, `mutations[${index}].mutationId`),
      scope: "favorites",
      operation: "delete",
      favoriteId: favoriteId(mutation.favoriteId, `mutations[${index}].favoriteId`),
    };
  }
  if (mutation.scope === "preferences" && mutation.operation === "replace") {
    exactKeys(mutation, [...base, "preferences"], [...base, "preferences"], `mutations[${index}]`);
    return {
      mutationId: opaqueId(mutation.mutationId, `mutations[${index}].mutationId`),
      scope: "preferences",
      operation: "replace",
      preferences: parsePreferences(mutation.preferences, `mutations[${index}].preferences`),
    };
  }
  fail(`mutations[${index}] has an unsupported scope/operation combination.`);
}

export function parseGrantSyncConsentRequest(value: unknown): GrantSyncConsentRequestV1 {
  const request = object(value, "request");
  exactKeys(request, ["requestId", "policyVersion", "scopes"], ["requestId", "policyVersion", "scopes"], "request");
  if (request.policyVersion !== SYNC_CONSENT_POLICY_VERSION_V1) {
    throw new ApiHttpError(409, "SYNC_POLICY_VERSION_MISMATCH", "The current sync privacy policy must be accepted.");
  }
  return {
    requestId: opaqueId(request.requestId, "requestId"),
    policyVersion: SYNC_CONSENT_POLICY_VERSION_V1,
    scopes: parseScopes(request.scopes),
  };
}

export function parseApplySyncDeltaRequest(value: unknown): ApplySyncDeltaRequestV1 {
  const request = object(value, "request");
  exactKeys(request, ["requestId", "baseVersion", "mutations"], ["requestId", "baseVersion", "mutations"], "request");
  const baseVersion = request.baseVersion;
  if (typeof baseVersion !== "number" || !Number.isSafeInteger(baseVersion) || baseVersion < 0) {
    fail("baseVersion must be a non-negative integer.");
  }
  if (!Array.isArray(request.mutations) || request.mutations.length < 1 || request.mutations.length > MAX_MUTATIONS) {
    fail(`mutations must contain 1-${MAX_MUTATIONS} items.`);
  }
  const mutations = request.mutations.map(parseMutation);
  const mutationIds = mutations.map((mutation) => mutation.mutationId);
  if (new Set(mutationIds).size !== mutationIds.length) {
    fail("mutationId values must be unique within a delta.");
  }
  return {
    requestId: opaqueId(request.requestId, "requestId"),
    baseVersion,
    mutations,
  };
}

function parseReasonRequest(value: unknown, allowed: readonly string[]) {
  const request = object(value, "request");
  exactKeys(request, ["requestId", "reason"], ["requestId", "reason"], "request");
  if (typeof request.reason !== "string" || !allowed.includes(request.reason)) {
    fail("reason is unsupported.");
  }
  return { requestId: opaqueId(request.requestId, "requestId"), reason: request.reason };
}

export function parseRevokeSyncConsentRequest(value: unknown): RevokeSyncConsentRequestV1 {
  return parseReasonRequest(value, ["user_request", "account_deletion", "policy_change"]) as RevokeSyncConsentRequestV1;
}

export function parseDeleteSyncedDataRequest(value: unknown): DeleteSyncedDataRequestV1 {
  return parseReasonRequest(value, ["user_request", "account_deletion"]) as DeleteSyncedDataRequestV1;
}
