import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  AccountSyncServiceV1,
  PublicSyncVersionConflictErrorV1,
  syncAadContextForUserIdV1,
} from "../../api/_lib/sync-service.js";
import {
  applySyncMutation,
  decodeSyncDocumentAtFirestoreLocation,
  decodeSyncDocumentFromFirestore,
  decodeSyncRequestReceiptFromFirestore,
  encodeSyncDocumentForFirestore,
  FirestoreSyncRepositoryV1,
  InMemorySyncRepositoryV1,
} from "../../api/_lib/sync-repository.js";
import {
  parseApplySyncDeltaRequest,
  parseGrantSyncConsentRequest,
} from "../../api/_lib/sync-validation.js";
import { consumeSyncRateLimit, setSyncRateLimiterForTests } from "../../api/_lib/sync-rate-limit.js";
import { ApiHttpError } from "../../api/_lib/http.js";
import { handleSyncApiError } from "../../api/_lib/sync-http.js";

const actor = { userId: "user_sync_test", sessionId: "sess_sync_test" };
const now = "2026-07-18T12:00:00.000Z";
const clock = { now: () => new Date(now) };
const nonce = Buffer.alloc(12, 1).toString("base64url");
const ciphertext = Buffer.alloc(32, 2).toString("base64url");

function syncDomainHash(pepper: string, domain: "owner" | "session", value: string): string {
  return `hmac-sha256:${createHmac("sha256", pepper)
    .update(`namespring.sync.${domain}.v1`, "utf8")
    .update("\0", "utf8")
    .update(value, "utf8")
    .digest("hex")}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function favorite() {
  return {
    favoriteId: "fav_0123456789abcdef",
    resourceType: "name_candidate" as const,
    encryptedEnvelope: {
      algorithm: "A256GCM" as const,
      aadVersion: "namespring.favorite-envelope.v1" as const,
      keyVersion: "key_v1",
      nonce,
      ciphertext,
    },
    createdAt: "2026-07-18T10:00:00.000Z",
    updatedAt: "2026-07-18T10:00:00.000Z",
  };
}

test("sync rejects plaintext name/birth fields and requires a bounded client-encrypted envelope", () => {
  assert.throws(
    () => parseApplySyncDeltaRequest({
      requestId: "delta_plaintext",
      baseVersion: 1,
      mutations: [{
        mutationId: "mutation_plaintext",
        scope: "favorites",
        operation: "upsert",
        favorite: { ...favorite(), name: "홍길동", birthDate: "2000-01-01" },
      }],
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_SYNC_REQUEST",
  );
  const parsed = parseApplySyncDeltaRequest({
    requestId: "delta_encrypted",
    baseVersion: 1,
    mutations: [{ mutationId: "mutation_encrypted", scope: "favorites", operation: "upsert", favorite: favorite() }],
  });
  assert.equal(parsed.mutations[0]?.scope, "favorites");
  if (parsed.mutations[0]?.operation === "upsert") {
    assert.equal(parsed.mutations[0].favorite.encryptedEnvelope.algorithm, "A256GCM");
  }
  assert.throws(
    () => parseApplySyncDeltaRequest({
      requestId: "delta_numeric_coercion",
      baseVersion: "1",
      mutations: [{ mutationId: "mutation_numeric", scope: "favorites", operation: "delete", favoriteId: "fav_0123456789abcdef" }],
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_SYNC_REQUEST",
  );
});

test("sync requires explicit current-policy consent and stores only normalized E2EE favorite data", async () => {
  const repository = new InMemorySyncRepositoryV1();
  const service = new AccountSyncServiceV1(repository, "x".repeat(32), clock);
  const consent = parseGrantSyncConsentRequest({
    requestId: "consent_01",
    policyVersion: "2026-07-18.v1",
    scopes: ["favorites"],
  });
  const granted = await service.grantConsent(actor, consent);
  assert.equal(granted.resultingVersion, 1);
  assert.equal(granted.encryption.serverCanDecrypt, false);

  const request = parseApplySyncDeltaRequest({
    requestId: "delta_01",
    baseVersion: 1,
    mutations: [{ mutationId: "mutation_01", scope: "favorites", operation: "upsert", favorite: favorite() }],
  });
  const applied = await service.applyDelta(actor, request);
  assert.equal(applied.resultingVersion, 2);
  const snapshot = await service.snapshot(actor);
  assert.equal(snapshot.document?.favorites.length, 1);
  assert.equal(snapshot.document?.favorites[0]?.createdAt, now);
  assert.equal(snapshot.document?.favorites[0]?.updatedAt, now);
  assert.deepEqual(snapshot.document?.favorites[0]?.encryptedEnvelope, favorite().encryptedEnvelope);
  assert.equal("name" in (snapshot.document?.favorites[0] ?? {}), false);
  assert.equal("ownerUserId" in (snapshot.document ?? {}), false);
  assert.deepEqual(snapshot.aadContext, syncAadContextForUserIdV1(actor.userId));
  assert.equal(JSON.stringify(snapshot).includes(actor.userId), false);
});

test("version conflicts return the authoritative server document for deterministic merge", async () => {
  const repository = new InMemorySyncRepositoryV1();
  const service = new AccountSyncServiceV1(repository, "x".repeat(32), clock);
  await service.grantConsent(actor, {
    requestId: "consent_conflict",
    policyVersion: "2026-07-18.v1",
    scopes: ["favorites"],
  });
  await assert.rejects(
    service.applyDelta(actor, {
      requestId: "delta_conflict",
      baseVersion: 0,
      mutations: [{ mutationId: "mutation_conflict", scope: "favorites", operation: "delete", favoriteId: "fav_0123456789abcdef" }],
    }),
    (error: unknown) => error instanceof PublicSyncVersionConflictErrorV1
      && error.serverDocument.version === 1
      && !("ownerUserId" in error.serverDocument)
      && error.aadContext.subjectId === syncAadContextForUserIdV1(actor.userId).subjectId,
  );
});

test("version-conflict HTTP projection contains AAD context but no internal owner identifier", async () => {
  const repository = new InMemorySyncRepositoryV1();
  const service = new AccountSyncServiceV1(repository, "x".repeat(32), clock);
  await service.grantConsent(actor, {
    requestId: "consent_http_conflict",
    policyVersion: "2026-07-18.v1",
    scopes: ["favorites"],
  });
  let conflict: unknown;
  try {
    await service.applyDelta(actor, {
      requestId: "delta_http_conflict",
      baseVersion: 0,
      mutations: [{ mutationId: "mutation_http_conflict", scope: "favorites", operation: "delete", favoriteId: "fav_0123456789abcdef" }],
    });
  } catch (error) {
    conflict = error;
  }
  const response = handleSyncApiError(undefined, conflict) as Response;
  assert.equal(response.status, 409);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(JSON.stringify(body).includes("ownerUserId"), false);
  assert.equal(JSON.stringify(body).includes(actor.userId), false);
  assert.equal(
    (body.aadContext as { subjectId?: unknown }).subjectId,
    syncAadContextForUserIdV1(actor.userId).subjectId,
  );
});

test("A256GCM nonce reuse is rejected within an account key version", async () => {
  const repository = new InMemorySyncRepositoryV1();
  const service = new AccountSyncServiceV1(repository, "x".repeat(32), clock);
  await service.grantConsent(actor, {
    requestId: "consent_nonce",
    policyVersion: "2026-07-18.v1",
    scopes: ["favorites"],
  });
  await assert.rejects(
    service.applyDelta(actor, {
      requestId: "delta_nonce",
      baseVersion: 1,
      mutations: [
        { mutationId: "mutation_nonce_1", scope: "favorites", operation: "upsert", favorite: favorite() },
        {
          mutationId: "mutation_nonce_2",
          scope: "favorites",
          operation: "upsert",
          favorite: { ...favorite(), favoriteId: "fav_fedcba9876543210" },
        },
      ],
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "SYNC_ENCRYPTION_NONCE_REUSE",
  );
});

test("mutation idempotency returns the original version even after later account changes", async () => {
  const repository = new InMemorySyncRepositoryV1();
  const service = new AccountSyncServiceV1(repository, "x".repeat(32), clock);
  const consent = {
    requestId: "consent_replay",
    policyVersion: "2026-07-18.v1" as const,
    scopes: ["favorites"] as const,
  };
  const initial = await service.grantConsent(actor, consent);
  await service.applyDelta(actor, {
    requestId: "delta_after_consent",
    baseVersion: 1,
    mutations: [{ mutationId: "mutation_after", scope: "favorites", operation: "upsert", favorite: favorite() }],
  });
  const replay = await service.grantConsent(actor, consent);
  assert.equal(initial.resultingVersion, 1);
  assert.equal(replay.resultingVersion, 1);
  assert.equal(replay.operation, "idempotent_replay");
});

test("reducing consent scopes wipes data from the removed scope in the same transaction", async () => {
  const repository = new InMemorySyncRepositoryV1();
  const service = new AccountSyncServiceV1(repository, "x".repeat(32), clock);
  await service.grantConsent(actor, {
    requestId: "consent_both_scopes",
    policyVersion: "2026-07-18.v1",
    scopes: ["favorites", "preferences"],
  });
  await service.applyDelta(actor, {
    requestId: "delta_both_scopes",
    baseVersion: 1,
    mutations: [
      { mutationId: "mutation_scope_favorite", scope: "favorites", operation: "upsert", favorite: favorite() },
      { mutationId: "mutation_scope_preference", scope: "preferences", operation: "replace", preferences: { theme: "dark" } },
    ],
  });
  await service.grantConsent(actor, {
    requestId: "consent_preferences_only",
    policyVersion: "2026-07-18.v1",
    scopes: ["preferences"],
  });
  const snapshot = await service.snapshot(actor);
  assert.deepEqual(snapshot.document?.consent.scopes, ["preferences"]);
  assert.deepEqual(snapshot.document?.favorites, []);
  assert.deepEqual(snapshot.document?.preferences, { theme: "dark" });
});

test("revocation wipes payload, delete emits HMAC-only receipt, and export declares retention", async () => {
  const repository = new InMemorySyncRepositoryV1();
  const pepper = "pepper".repeat(8);
  const service = new AccountSyncServiceV1(repository, pepper, clock);
  await service.grantConsent(actor, {
    requestId: "consent_delete",
    policyVersion: "2026-07-18.v1",
    scopes: ["favorites", "preferences"],
  });
  await service.applyDelta(actor, {
    requestId: "delta_delete",
    baseVersion: 1,
    mutations: [
      { mutationId: "mutation_fav", scope: "favorites", operation: "upsert", favorite: favorite() },
      { mutationId: "mutation_pref", scope: "preferences", operation: "replace", preferences: { theme: "dark" } },
    ],
  });
  await service.revokeConsent(actor, { requestId: "revoke_01", reason: "user_request" });
  const revoked = await service.snapshot(actor);
  assert.deepEqual(revoked.document?.favorites, []);
  assert.deepEqual(revoked.document?.preferences, {});
  assert.equal(revoked.document?.consent.status, "revoked");
  const exported = await service.exportData(actor);
  assert.equal(exported.retentionPolicy.inactiveDataDays, 365);
  assert.equal(exported.encryption.crossDeviceKeyRecovery, "user_managed_recovery_secret_or_passkey_prf");
  assert.equal("ownerUserId" in (exported.document ?? {}), false);
  assert.deepEqual(exported.aadContext, syncAadContextForUserIdV1(actor.userId));
  assert.equal(JSON.stringify(exported).includes(actor.userId), false);
  const rotatedPepperService = new AccountSyncServiceV1(repository, "y".repeat(32), clock);
  assert.deepEqual((await rotatedPepperService.snapshot(actor)).aadContext, exported.aadContext);

  await service.deleteData(actor, { requestId: "delete_01", reason: "user_request" });
  assert.equal((await service.snapshot(actor)).document, null);
  const receipt = repository.deletionReceipts.at(-1);
  assert.match(receipt?.ownerHash ?? "", /^hmac-sha256:[a-f0-9]{64}$/);
  assert.equal(receipt?.ownerHash, syncDomainHash(pepper, "owner", actor.userId));
  assert.equal(JSON.stringify(receipt).includes(actor.userId), false);
  const audit = repository.audits.at(-1);
  assert.equal(audit?.actorSessionHash, syncDomainHash(pepper, "session", actor.sessionId));
  assert.equal(JSON.stringify(audit).includes(actor.sessionId), false);
});

test("retention sweep atomically expires live data while TTL owns payload-free metadata", async () => {
  const repository = new InMemorySyncRepositoryV1();
  const initialService = new AccountSyncServiceV1(repository, "x".repeat(32), clock);
  await initialService.grantConsent(actor, {
    requestId: "consent_retention",
    policyVersion: "2026-07-18.v1",
    scopes: ["favorites"],
  });
  const futureService = new AccountSyncServiceV1(
    repository,
    "x".repeat(32),
    { now: () => new Date("2028-07-18T12:00:00.000Z") },
  );
  const result = await futureService.sweepExpired({ userId: "admin_01", sessionId: "sess_admin" });
  assert.equal(result.dataDocumentsScanned, 1);
  assert.equal(result.dataDocumentsDeleted, 1);
  assert.equal(result.dataDocumentsFailed, 0);
  assert.equal(result.requestReceiptsDeleted, 0);
  assert.equal(result.auditEventsDeleted, 0);
  assert.equal((await futureService.snapshot(actor)).document, null);
  assert.equal(repository.audits.some((event) => JSON.stringify(event).includes(actor.userId)), false);
  assert.match(repository.audits.at(-1)?.ownerHash ?? "", /^hmac-sha256:[a-f0-9]{64}$/);
  assert.equal(
    repository.audits.at(-1)?.actorSessionHash,
    syncDomainHash("x".repeat(32), "session", "sess_admin"),
  );
  assert.equal(JSON.stringify(repository.audits.at(-1)).includes("sess_admin"), false);
});

test("sync rate-limit seam keeps user and admin workloads separate and uses only trusted user IDs", async () => {
  const calls: Array<[string, string]> = [];
  setSyncRateLimiterForTests({
    async consume(scope, trustedUserId) {
      calls.push([scope, trustedUserId]);
    },
  });
  try {
    await consumeSyncRateLimit("read", "user_server_resolved");
    await consumeSyncRateLimit("write", "user_server_resolved");
    await consumeSyncRateLimit("adminStatusRead", "admin_server_resolved");
    await consumeSyncRateLimit("adminSweep", "admin_server_resolved");
    assert.deepEqual(calls, [
      ["read", "user_server_resolved"],
      ["write", "user_server_resolved"],
      ["adminStatusRead", "admin_server_resolved"],
      ["adminSweep", "admin_server_resolved"],
    ]);
  } finally {
    setSyncRateLimiterForTests(null);
  }
});

test("Firestore persistence encodes TTL fields as Timestamp and decodes the public ISO contract", async () => {
  const repository = new InMemorySyncRepositoryV1();
  const service = new AccountSyncServiceV1(repository, "x".repeat(32), clock);
  await service.grantConsent(actor, {
    requestId: "consent_timestamp",
    policyVersion: "2026-07-18.v1",
    scopes: ["favorites"],
  });
  const document = await repository.get(actor.userId);
  assert.ok(document);
  const stored = encodeSyncDocumentForFirestore(document);
  assert.equal(typeof stored.expiresAt.toDate, "function");
  assert.equal(stored.expiresAt.toDate().toISOString(), document.expiresAt);
  assert.deepEqual(decodeSyncDocumentFromFirestore(stored), document);
});

test("stored sync documents reject owner confusion, coercion, and unknown fields before projection", async () => {
  const repository = new InMemorySyncRepositoryV1();
  const service = new AccountSyncServiceV1(repository, "x".repeat(32), clock);
  await service.grantConsent(actor, {
    requestId: "consent_storage_codec",
    policyVersion: "2026-07-18.v1",
    scopes: ["favorites"],
  });
  const document = await repository.get(actor.userId);
  assert.ok(document);
  const stored = encodeSyncDocumentForFirestore(document);
  const correctLocation = { path: `account_sync_v1/${sha256(actor.userId)}` };

  assert.deepEqual(decodeSyncDocumentAtFirestoreLocation(stored, correctLocation, actor.userId), document);
  assert.throws(
    () => decodeSyncDocumentAtFirestoreLocation(
      stored,
      { path: `account_sync_v1/${sha256("another_owner")}` },
    ),
    (error: unknown) => error instanceof ApiHttpError && error.code === "SYNC_STORAGE_RECORD_INVALID",
  );

  assert.throws(
    () => decodeSyncDocumentFromFirestore(stored, "different_owner"),
    (error: unknown) => error instanceof ApiHttpError && error.code === "SYNC_STORAGE_RECORD_INVALID",
  );
  for (const corrupt of [
    { ...stored, ownerUserId: 123 },
    { ...stored, version: "1" },
    { ...stored, unexpectedPlaintext: "name-or-birth" },
    { ...stored, consent: { ...stored.consent, scopes: ["favorites", "favorites"] } },
    { ...stored, preferences: { theme: 1 } },
  ]) {
    assert.throws(
      () => decodeSyncDocumentFromFirestore(corrupt),
      (error: unknown) => error instanceof ApiHttpError && error.code === "SYNC_STORAGE_RECORD_INVALID",
    );
  }

  const wrongOwnerStored = { ...stored, ownerUserId: "different_owner" };
  const fakeDb = {
    collection() {
      return {
        doc() {
          return {
            async get() {
              return { exists: true, data: () => wrongOwnerStored };
            },
          };
        },
      };
    },
  } as unknown as Firestore;
  await assert.rejects(
    new FirestoreSyncRepositoryV1(fakeDb).get(actor.userId),
    (error: unknown) => error instanceof ApiHttpError && error.code === "SYNC_STORAGE_RECORD_INVALID",
  );
});

test("stored sync request receipts are exact, path-bound, and reject coercion impostors", () => {
  const requestId = "receipt_storage_codec";
  const location = {
    path: `account_sync_request_receipts_v1/${sha256(`${actor.userId}:${requestId}`)}`,
  };
  const valid = {
    requestDigest: `sha256:${"a".repeat(64)}`,
    resultingVersion: 3,
    committedAt: "2026-07-18T12:00:00.000Z",
    deleteAfter: Timestamp.fromDate(new Date("2027-07-18T12:00:00.000Z")),
  };
  assert.deepEqual(
    decodeSyncRequestReceiptFromFirestore(valid, location, { ownerUserId: actor.userId, requestId }),
    {
      ...valid,
      deleteAfter: "2027-07-18T12:00:00.000Z",
    },
  );
  assert.equal(
    decodeSyncRequestReceiptFromFirestore(
      { ...valid, resultingVersion: null },
      location,
      { ownerUserId: actor.userId, requestId },
    ).resultingVersion,
    null,
  );

  assert.throws(
    () => decodeSyncRequestReceiptFromFirestore(
      valid,
      { path: `account_sync_request_receipts_v1/${sha256(`another_owner:${requestId}`)}` },
      { ownerUserId: actor.userId, requestId },
    ),
    (error: unknown) => error instanceof ApiHttpError && error.code === "SYNC_STORAGE_RECORD_INVALID",
  );

  const corruptRecords: readonly Record<string, unknown>[] = [
    { ...valid, requestDigest: 123 },
    { ...valid, requestDigest: { digest: valid.requestDigest } },
    { ...valid, requestDigest: Timestamp.now() },
    { ...valid, requestDigest: `sha256:${"A".repeat(64)}` },
    { ...valid, resultingVersion: "3" },
    { ...valid, resultingVersion: { value: 3 } },
    { ...valid, resultingVersion: Timestamp.now() },
    { ...valid, resultingVersion: 0 },
    { ...valid, committedAt: 123 },
    { ...valid, committedAt: { iso: valid.committedAt } },
    { ...valid, committedAt: Timestamp.now() },
    { ...valid, committedAt: "2026-07-18T12:00:00Z" },
    { ...valid, deleteAfter: "2027-07-18T12:00:00.000Z" },
    { ...valid, deleteAfter: { seconds: 1 } },
    { ...valid, deleteAfter: 123 },
    {
      ...valid,
      deleteAfter: new Timestamp(valid.deleteAfter.seconds, valid.deleteAfter.nanoseconds + 1),
    },
    { ...valid, deleteAfter: Timestamp.fromDate(new Date(valid.committedAt)) },
    { ...valid, unexpectedOwner: actor.userId },
  ];
  for (const corrupt of corruptRecords) {
    assert.throws(
      () => decodeSyncRequestReceiptFromFirestore(
        corrupt,
        location,
        { ownerUserId: actor.userId, requestId },
      ),
      (error: unknown) => error instanceof ApiHttpError && error.code === "SYNC_STORAGE_RECORD_INVALID",
    );
  }

  for (const expected of [
    { ownerUserId: 123, requestId },
    { ownerUserId: actor.userId, requestId: { opaque: requestId } },
    { ownerUserId: actor.userId, requestId: Timestamp.now() },
  ]) {
    assert.throws(
      () => decodeSyncRequestReceiptFromFirestore(valid, location, expected as never),
      (error: unknown) => error instanceof ApiHttpError && error.code === "SYNC_STORAGE_RECORD_INVALID",
    );
  }
});

test("grant never re-owns or copies a current sync document from another account", () => {
  const current = {
    schemaVersion: "namespring.account-sync.v1",
    ownerUserId: "victim_owner",
    version: 7,
    consent: {
      policyVersion: "2026-07-18.v1",
      status: "active",
      scopes: ["favorites"] as const,
      grantedAt: "2026-07-18T10:00:00.000Z",
    },
    favorites: [favorite()],
    preferences: {},
    createdAt: "2026-07-18T10:00:00.000Z",
    updatedAt: "2026-07-18T10:00:00.000Z",
    expiresAt: "2027-07-18T10:00:00.000Z",
  } as const;
  assert.throws(
    () => applySyncMutation(current, {
      kind: "grant",
      actor,
      ownerHash: `hmac-sha256:${"a".repeat(64)}`,
      actorSessionHash: `hmac-sha256:${"b".repeat(64)}`,
      requestId: "consent_cross_owner",
      requestDigest: `sha256:${"c".repeat(64)}`,
      occurredAt: now,
      auditId: "saud_cross_owner",
      auditDeleteAfter: "2027-07-18T12:00:00.000Z",
      scopes: ["favorites"],
      expiresAt: "2027-07-18T12:00:00.000Z",
    }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "SYNC_OWNER_MISMATCH",
  );
});
