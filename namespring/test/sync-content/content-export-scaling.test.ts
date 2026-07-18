import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CONTENT_EXPORT_ARTIFACT_FETCH_BATCH_LIMIT_V1,
  CONTENT_EXPORT_CHUNK_WRITE_BATCH_LIMIT_V1,
  type ContentRepositoryV1,
  partitionContentExportChunkWritesV1,
} from "../../api/_lib/content-repository.js";
import {
  CONTENT_EXPORT_HARD_MAX_ACTIVE_ARTIFACTS_V1,
  CONTENT_EXPORT_LARGE_CATALOG_THRESHOLD_V1,
  CONTENT_EXPORT_OPERATIONAL_STATE_V1,
  ContentLifecycleServiceV1,
  contentExportOperationalPolicyFromEnvironmentV1,
} from "../../api/_lib/content-service.js";
import {
  CONTENT_ADMIN_EXPORT_GLOBAL_RATE_LIMIT_POLICIES_V1,
  CONTENT_ADMIN_RATE_LIMIT_POLICIES_V1,
  contentAdminRateLimitInputsV1,
} from "../../api/_lib/content-http.js";
import { assertContentAuditHmacKeyringV1 } from "../../api/_lib/content-audit-privacy.js";
import { ApiHttpError } from "../../api/_lib/http.js";

const namespringRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("a 21,060-entry local catalog is staged in bounded Firestore write batches", () => {
  const entryCount = 21_060;
  assert.equal(Math.ceil(entryCount / 25), 843, "legacy 25-item chunks amplified writes and requests");
  const metadataChunkCount = Math.ceil(entryCount / 100);
  assert.equal(metadataChunkCount, 211, "fixture must still exercise more than one bounded commit");
  const chunks = Array.from({ length: metadataChunkCount }, (_, index) => index);
  const batches = partitionContentExportChunkWritesV1(chunks);

  assert.equal(CONTENT_EXPORT_CHUNK_WRITE_BATCH_LIMIT_V1, 50);
  assert.equal(batches.length, 5);
  assert.equal(batches.flat().length, metadataChunkCount);
  assert.deepEqual(batches.flat(), chunks);
  assert.equal(
    batches.every((batch) => batch.length > 0 && batch.length <= CONTENT_EXPORT_CHUNK_WRITE_BATCH_LIMIT_V1),
    true,
  );
});

test("max-length metadata stays well below the 10 MiB Firestore commit boundary", () => {
  const identifier = `a${"x".repeat(159)}`;
  const version = `v${"x".repeat(79)}`;
  const entries = Array.from({ length: 100 }, (_, index) => ({
    artifactId: `${identifier.slice(0, -6)}${String(index).padStart(6, "0")}`,
    contentKey: `${identifier.slice(0, -6)}${String(index).padStart(6, "0")}`,
    kind: "fortune_bundle" as const,
    audience: "free_local" as const,
    locale: "ko-KR" as const,
    version,
    contentDigest: `sha256:${"a".repeat(64)}` as const,
    activationId: identifier,
  }));
  const chunkBytes = Buffer.byteLength(JSON.stringify({
    exportId: identifier,
    chunkIndex: 25_000,
    entries,
    expiresAt: "2026-07-20T00:00:00.000Z",
  }), "utf8");
  assert.ok(chunkBytes < 128 * 1024, `max metadata chunk unexpectedly grew to ${chunkBytes} bytes`);
  assert.ok(
    chunkBytes * CONTENT_EXPORT_CHUNK_WRITE_BATCH_LIMIT_V1 < 7 * 1024 * 1024,
    "canonical upper-bound fixture must leave at least 3 MiB for Firestore protobuf/document overhead",
  );
});

test("content export publishes only the header and constant-size delivery progress in the catalog fence", () => {
  const repository = readFileSync(join(namespringRoot, "api/_lib/content-repository.ts"), "utf8");
  const method = repository.match(
    /public async createLocalExportSnapshot\([\s\S]*?\n  public async getLocalExportChunk/u,
  )?.[0] ?? "";
  assert.ok(method, "snapshot implementation must remain discoverable by the boundary test");
  assert.match(method, /for \(const chunkBatch of partitionContentExportChunkWritesV1\(chunks\)\)/u);
  assert.match(method, /writeBatch\.create\([\s\S]*?encodeExportChunk\(chunk\)/u);
  assert.match(method, /await writeBatch\.commit\(\)/u);
  assert.match(method, /expiresAt: session\.expiresAt/u, "every invisible partial chunk needs independent TTL cleanup");
  assert.match(method, /transaction\.create\(headerRef, encodeExportSession\(session, ownerSubjects\)\)/u);
  assert.match(method, /transaction\.create\([\s\S]*?encodeExportProgress/u);
  assert.doesNotMatch(
    method,
    /transaction\.create\([\s\S]{0,200}encodeExportChunk/u,
    "metadata chunks must not return to the single header transaction",
  );
});

test("large-catalog environment gate is explicit, bounded, and never browser supplied", () => {
  assert.equal(CONTENT_EXPORT_LARGE_CATALOG_THRESHOLD_V1, 2_500);
  assert.equal(CONTENT_EXPORT_HARD_MAX_ACTIVE_ARTIFACTS_V1, 25_000);
  assert.deepEqual(contentExportOperationalPolicyFromEnvironmentV1({}), {
    largeCatalogEnabled: false,
    maxActiveArtifacts: 2_500,
  });
  assert.deepEqual(contentExportOperationalPolicyFromEnvironmentV1({
    CONTENT_EXPORT_OPERATIONAL_STATE: CONTENT_EXPORT_OPERATIONAL_STATE_V1,
    CONTENT_EXPORT_MAX_ACTIVE_ARTIFACTS: "22000",
  }), {
    largeCatalogEnabled: true,
    maxActiveArtifacts: 22_000,
  });
  for (const rawMax of [undefined, "2500", "25001", "21060.0", " 22000"] as const) {
    assert.throws(
      () => contentExportOperationalPolicyFromEnvironmentV1({
        CONTENT_EXPORT_OPERATIONAL_STATE: CONTENT_EXPORT_OPERATIONAL_STATE_V1,
        ...(rawMax === undefined ? {} : { CONTENT_EXPORT_MAX_ACTIVE_ARTIFACTS: rawMax }),
      }),
      (error: unknown) => error instanceof ApiHttpError
        && error.code === "CONTENT_EXPORT_OPERATIONAL_CONFIG_INVALID",
    );
  }
});

test("a disabled 21,060-entry export fails before full metadata reads or writes", async () => {
  let listed = false;
  const repository = {
    getCatalogRevision: async () => 19,
    countActiveExportEntries: async (audience: "free_local" | "shared") => audience === "free_local" ? 21_060 : 0,
    listActiveExportEntries: async () => {
      listed = true;
      return [];
    },
  } as unknown as ContentRepositoryV1;
  const keyring = assertContentAuditHmacKeyringV1({
    currentKeyId: "test-export",
    keys: { "test-export": "test-only-content-export-hmac-secret-at-least-32-bytes" },
  });
  const service = new ContentLifecycleServiceV1(
    repository,
    { now: () => new Date("2026-07-19T00:00:00.000Z") },
    keyring,
    () => ({ largeCatalogEnabled: false, maxActiveArtifacts: 2_500 }),
  );
  await assert.rejects(
    service.createLocalExportSession({ userId: "admin", sessionId: "session" }),
    (error: unknown) => error instanceof ApiHttpError
      && error.code === "CONTENT_EXPORT_LARGE_CATALOG_NOT_ENABLED",
  );
  assert.equal(listed, false);
});

test("export start cost is isolated from owner-session page throughput", () => {
  assert.deepEqual(CONTENT_ADMIN_RATE_LIMIT_POLICIES_V1.export_start, {
    scope: "content.admin.export_start",
    limit: 4,
    windowSeconds: 3_600,
  });
  assert.deepEqual(CONTENT_ADMIN_RATE_LIMIT_POLICIES_V1.export_page, {
    scope: "content.admin.export_page.session",
    limit: 600,
    windowSeconds: 3_600,
  });
  assert.deepEqual(CONTENT_ADMIN_EXPORT_GLOBAL_RATE_LIMIT_POLICIES_V1.export_page, {
    scope: "content.admin.export_page.global",
    limit: 1_200,
    windowSeconds: 3_600,
  });
  const actor = { userId: "admin-user", sessionId: "admin-session" };
  const left = contentAdminRateLimitInputsV1(actor, "export_page", "cexp-left");
  const right = contentAdminRateLimitInputsV1(actor, "export_page", "cexp-right");
  assert.equal(left.length, 2);
  assert.equal(left[0]?.trustedSubject, actor.userId);
  assert.equal(right[0]?.trustedSubject, actor.userId, "different export IDs must share the global budget");
  assert.notEqual(left[1]?.trustedSubject, right[1]?.trustedSubject, "session budgets remain isolated");
  assert.equal(CONTENT_EXPORT_ARTIFACT_FETCH_BATCH_LIMIT_V1, 25);

  const service = readFileSync(join(namespringRoot, "api/_lib/content-service.ts"), "utf8");
  assert.match(service, /getExportArtifacts\(batchEntries\)/u);
  assert.doesNotMatch(
    service.match(/public async getLocalExportPage[\s\S]*?public async finalizeLocalExport/u)?.[0] ?? "",
    /getActive\(/u,
    "export pages must not return to per-artifact pointer plus artifact round trips",
  );
});
