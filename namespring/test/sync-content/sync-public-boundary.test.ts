import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  parseEmptySyncRequestV1,
  SYNC_EMPTY_BODY_MAX_BYTES_V1,
} from "../../api/_lib/sync-http.js";
import { projectSyncDocumentForBrowserV1 } from "../../api/_lib/sync-service.js";
import { ApiHttpError } from "../../api/_lib/http.js";
import type { SyncDocumentV1 } from "../../shared/types/sync-contract.js";

const namespringRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("sync export accepts only an exact bounded empty JSON object", () => {
  assert.equal(SYNC_EMPTY_BODY_MAX_BYTES_V1, 2 * 1024);
  assert.deepEqual(parseEmptySyncRequestV1({}), {});
  for (const invalid of [null, [], { userId: "internal-user" }, { report: "free-local-data" }]) {
    assert.throws(
      () => parseEmptySyncRequestV1(invalid),
      (error: unknown) => error instanceof ApiHttpError
        && error.statusCode === 400
        && error.code === "INVALID_SYNC_REQUEST",
    );
  }

  const route = readFileSync(join(namespringRoot, "api/v1/sync/export.ts"), "utf8");
  assert.ok(route.includes("assertTrustedMutationRequest(req)"));
  assert.ok(route.includes("resolveAuthenticatedPrincipal(req)"));
  assert.ok(route.includes("consumeSyncRateLimit(\"read\", actor.userId)"));
  assert.ok(route.includes("{ maxBytes: SYNC_EMPTY_BODY_MAX_BYTES_V1 }"));
  assert.ok(route.includes("parseEmptySyncRequestV1"));
  assert.ok(
    route.lastIndexOf("resolveAuthenticatedPrincipal(req)") < route.lastIndexOf("readJsonBody"),
    "authentication must happen before body parsing",
  );
});

test("browser sync projection is an additive-field allowlist boundary", () => {
  const document = {
    schemaVersion: "namespring.account-sync.v1",
    ownerUserId: "internal-user-id",
    version: 3,
    consent: {
      policyVersion: "2026-07-18.v1",
      status: "active",
      scopes: ["favorites"],
      grantedAt: "2026-07-18T00:00:00.000Z",
      internalProviderUid: "firebase-secret",
    },
    favorites: [{
      favoriteId: "fav_0123456789abcdef",
      resourceType: "name_candidate",
      encryptedEnvelope: {
        algorithm: "A256GCM",
        aadVersion: "namespring.favorite-envelope.v1",
        keyVersion: "key_v1",
        nonce: "AAAAAAAAAAAAAAAA",
        ciphertext: "AAAAAAAAAAAAAAAAAAAAAA",
        plaintextDisplayName: "should-never-leak",
      },
      createdAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z",
      candidateId: "candidate-internal",
    }],
    preferences: {
      theme: "system",
      plaintextBirthInput: "should-never-leak",
    },
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    expiresAt: "2027-07-18T00:00:00.000Z",
    internalEmail: "person@example.test",
    deletionFence: "claim-secret",
  } as unknown as SyncDocumentV1;

  const view = projectSyncDocumentForBrowserV1(document);
  assert.deepEqual(Object.keys(view).sort(), [
    "consent",
    "createdAt",
    "expiresAt",
    "favorites",
    "preferences",
    "schemaVersion",
    "updatedAt",
    "version",
  ]);
  const serialized = JSON.stringify(view);
  for (const forbidden of [
    "ownerUserId",
    "internal-user-id",
    "internalProviderUid",
    "firebase-secret",
    "plaintextDisplayName",
    "candidateId",
    "plaintextBirthInput",
    "internalEmail",
    "person@example.test",
    "deletionFence",
    "claim-secret",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `public sync DTO leaked ${forbidden}`);
  }
});
