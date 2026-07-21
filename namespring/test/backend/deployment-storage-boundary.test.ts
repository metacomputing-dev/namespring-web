import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));

async function projectFile(relative: string): Promise<string> {
  return readFile(resolve(PROJECT_ROOT, relative), "utf8");
}

interface FieldOverride {
  readonly collectionGroup: string;
  readonly fieldPath: string;
  readonly ttl?: boolean;
  readonly indexes?: readonly { readonly order?: string; readonly arrayConfig?: string; readonly queryScope?: string }[];
}

interface CompositeIndex {
  readonly collectionGroup: string;
  readonly queryScope: string;
  readonly fields: readonly { readonly fieldPath: string; readonly order?: string; readonly arrayConfig?: string }[];
}

interface FirestoreIndexConfig {
  readonly indexes: readonly CompositeIndex[];
  readonly fieldOverrides: readonly FieldOverride[];
}

function overrideKey(value: Pick<FieldOverride, "collectionGroup" | "fieldPath">): string {
  return `${value.collectionGroup}\0${value.fieldPath}`;
}

function requireOverride(config: FirestoreIndexConfig, collectionGroup: string, fieldPath: string): FieldOverride {
  const match = config.fieldOverrides.find((entry) => entry.collectionGroup === collectionGroup
    && entry.fieldPath === fieldPath);
  assert.ok(match, `missing field override ${collectionGroup}.${fieldPath}`);
  return match;
}

function expandBraces(pattern: string): string[] {
  const start = pattern.indexOf("{");
  if (start < 0) return [pattern];
  let depth = 0;
  let end = -1;
  for (let index = start; index < pattern.length; index += 1) {
    if (pattern[index] === "{") depth += 1;
    if (pattern[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  assert.notEqual(end, -1, `unbalanced includeFiles glob: ${pattern}`);
  const body = pattern.slice(start + 1, end);
  const alternatives: string[] = [];
  let partStart = 0;
  depth = 0;
  for (let index = 0; index <= body.length; index += 1) {
    const character = body[index];
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    if ((character === "," && depth === 0) || index === body.length) {
      alternatives.push(body.slice(partStart, index));
      partStart = index + 1;
    }
  }
  return alternatives.flatMap((alternative) => expandBraces(
    `${pattern.slice(0, start)}${alternative}${pattern.slice(end + 1)}`,
  ));
}

test("Firestore config exempts every sealed envelope and keeps required query indexes", async () => {
  const config = JSON.parse(await projectFile("firestore.indexes.json")) as FirestoreIndexConfig;
  const keys = config.fieldOverrides.map(overrideKey);
  assert.equal(new Set(keys).size, keys.length, "field overrides must be unique");

  const sealedCollectionGroups = [
    "premium_v1_registrations",
    "premium_v1_reports",
    "premium_v1_analyses",
    "premium_v1_checkout_requests",
    "premium_v1_orders",
    "premium_v1_provider_payment_keys",
    "premium_v1_entitlements",
    "premium_v1_entitlement_grants",
    "premium_v1_delivery_requests",
    "premium_v1_content_artifacts",
    "premium_v1_active_content",
    "premium_v1_content_templates",
    "premium_v1_active_templates",
    "premium_v1_content_reviews",
    "premium_v1_audit",
    "premium_v1_retained_payments",
    "premium_v1_deletion_receipts",
    "premium_v1_unpaid_expiry_candidates",
    // Sealed owner-resource records live in the collection-group named items.
    "items",
    "accountPaymentLeasesV1",
  ] as const;
  for (const collectionGroup of sealedCollectionGroups) {
    for (const fieldPath of ["ciphertext", "iv", "authenticationTag"] as const) {
      assert.deepEqual(requireOverride(config, collectionGroup, fieldPath).indexes, [],
        `${collectionGroup}.${fieldPath} must never be automatically indexed`);
    }
  }
  assert.deepEqual(requireOverride(config, "content_artifacts_v1", "payload").indexes, []);
  for (const fieldPath of [
    "registeredBy",
    "review.reviewerId",
    "approval.approverId",
    "activations",
    "retirement.retiredBy",
  ]) {
    assert.deepEqual(requireOverride(config, "content_artifacts_v1", fieldPath).indexes, []);
  }
  assert.deepEqual(requireOverride(config, "content_audit_events_v1", "actorSubject").indexes, []);
  assert.deepEqual(requireOverride(config, "content_audit_events_v1", "sessionSubject").indexes, []);
  assert.deepEqual(requireOverride(config, "content_export_snapshots_v1", "ownerSubjects").indexes, []);
  assert.deepEqual(requireOverride(config, "content_export_chunks_v1", "entries").indexes, []);
  assert.deepEqual(requireOverride(config, "account_sync_v1", "favorites").indexes, []);
  assert.deepEqual(requireOverride(config, "account_sync_v1", "ownerUserId").indexes, [],
    "the internal sync owner UUID must not be duplicated into automatic indexes");

  const lifecycleArtifact = config.indexes.find((entry) => entry.collectionGroup === "content_artifacts_v1"
    && entry.fields.map((field) => `${field.fieldPath}:${field.order}`).join("|")
      === "lifecycle:ASCENDING|artifactId:ASCENDING");
  const lifecycleAudience = config.indexes.find((entry) => entry.collectionGroup === "content_artifacts_v1"
    && entry.fields.map((field) => `${field.fieldPath}:${field.order}`).join("|")
      === "lifecycle:ASCENDING|channel.audience:ASCENDING");
  assert.ok(lifecycleArtifact, "list lifecycle/order query index is required");
  assert.ok(lifecycleAudience, "active audience query index is required");
  for (const collectionGroup of ["authDeletionJobsV1", "authProviderUnlinkJobsV1"]) {
    const dueAuthJob = config.indexes.find((entry) => entry.collectionGroup === collectionGroup
      && entry.queryScope === "COLLECTION"
      && entry.fields.map((field) => `${field.fieldPath}:${field.order}`).join("|")
        === "status:ASCENDING|nextAttemptAt:ASCENDING");
    assert.ok(dueAuthJob, `${collectionGroup} needs its bounded due-job query index`);
    const discovery = config.indexes.find((entry) => entry.collectionGroup === collectionGroup
      && entry.queryScope === "COLLECTION"
      && entry.fields.map((field) => `${field.fieldPath}:${field.order}`).join("|")
        === "status:ASCENDING|requestedAt:DESCENDING");
    assert.ok(discovery, `${collectionGroup} needs its stable administrator discovery index`);
    assert.equal(config.fieldOverrides.some((entry) => entry.collectionGroup === collectionGroup
      && entry.fieldPath === "nextAttemptAt" && entry.indexes?.length === 0), false,
    `${collectionGroup}.nextAttemptAt must remain queryable`);
    assert.equal(config.fieldOverrides.some((entry) => entry.collectionGroup === collectionGroup
      && entry.fieldPath === "requestedAt" && entry.indexes?.length === 0), false,
    `${collectionGroup}.requestedAt must remain queryable`);
  }

  // Lease reconciliation is a dueAt range query; retain its default ascending
  // single-field index while excluding only the sealed envelope fields.
  const dueAt = config.fieldOverrides.find((entry) => entry.collectionGroup === "accountPaymentLeasesV1"
    && entry.fieldPath === "dueAt");
  assert.equal(dueAt, undefined);
});

test("every retention policy targets a root Firestore Timestamp field", async () => {
  const config = JSON.parse(await projectFile("firestore.indexes.json")) as FirestoreIndexConfig;
  const ttlFields = [
    ["premium_v1_audit", "deleteAfter"],
    ["premium_v1_retained_payments", "deleteAfter"],
    ["premium_v1_deletion_receipts", "deleteAfter"],
    ["premium_v1_unpaid_expiry_receipts", "deleteAfter"],
    ["premium_v1_content_reviews", "deleteAfter"],
    ["server_rate_limits_v1", "expiresAt"],
    ["account_sync_request_receipts_v1", "deleteAfter"],
    ["account_sync_deletion_receipts_v1", "deleteAfter"],
    ["account_sync_audit_events_v1", "deleteAfter"],
    ["content_export_snapshots_v1", "expiresAt"],
    ["content_export_chunks_v1", "expiresAt"],
    ["content_export_progress_v1", "expiresAt"],
    ["content_audit_events_v1", "deleteAfter"],
    ["authAccountsV1", "deleteAfter"],
    ["authAuditEventsV1", "deleteAfter"],
    ["authDeletionJobsV1", "deleteAfter"],
    ["authProviderUnlinkJobsV1", "deleteAfter"],
    ["authRoleProvisioningReceiptsV1", "deleteAfter"],
  ] as const;
  for (const [collectionGroup, fieldPath] of ttlFields) {
    assert.equal(requireOverride(config, collectionGroup, fieldPath).ttl, true,
      `TTL must be enabled for ${collectionGroup}.${fieldPath}`);
  }
  const liveSyncExpiry = requireOverride(config, "account_sync_v1", "expiresAt");
  assert.equal(liveSyncExpiry.ttl, undefined,
    "live sync deletion must be owned by the transactional receipt/audit sweeper, not TTL");
  assert.deepEqual(liveSyncExpiry.indexes, [{ order: "ASCENDING", queryScope: "COLLECTION" }]);
  for (const collectionGroup of [
    "account_sync_request_receipts_v1",
    "account_sync_deletion_receipts_v1",
    "account_sync_audit_events_v1",
    "authAccountsV1",
    "authRoleProvisioningReceiptsV1",
    "premium_v1_content_reviews",
  ]) {
    assert.deepEqual(requireOverride(config, collectionGroup, "deleteAfter").indexes, [],
      `${collectionGroup}.deleteAfter is TTL-only and must not create a timestamp hotspot`);
  }

  const [premium, rateLimit, sync, content, authCodec] = await Promise.all([
    projectFile("api/_lib/premium-repository.ts"),
    projectFile("api/_lib/rate-limit.ts"),
    projectFile("api/_lib/sync-repository.ts"),
    projectFile("api/_lib/content-repository.ts"),
    projectFile("api/_lib/auth-accounts-firestore-codec.ts"),
  ]);
  assert.match(premium, /deleteAfter:\s*Timestamp\.fromDate/u);
  assert.match(rateLimit, /expiresAt:\s*Timestamp\.fromMillis/u);
  assert.match(sync, /expiresAt:\s*timestampFromIso/u);
  assert.match(sync, /deleteAfter:\s*timestampFromIso/u);
  assert.match(content, /expiresAt:\s*Timestamp\.fromDate/u);
  assert.match(content, /deleteAfter:\s*Timestamp\.fromDate/u);
  assert.match(
    authCodec,
    /deleteAfter:\s*account\.deleteAfter\s*===\s*null\s*\?\s*null\s*:\s*Timestamp\.fromDate/u,
  );
  assert.match(
    authCodec,
    /deleteAfter:\s*job\.deleteAfter\s*===\s*null\s*\?\s*null\s*:\s*Timestamp\.fromDate/u,
  );
  assert.match(premium, /dueAt:\s*Timestamp\.fromDate/u);
});

test("Firestore client rules remain a universal deny boundary", async () => {
  const rules = await projectFile("firestore.rules");
  assert.match(rules, /match \/\{document=\*\*\}/u);
  assert.match(rules, /allow read, write:\s*if false;/u);
  assert.doesNotMatch(rules, /allow\s+[^;]+:\s*if\s+(?!false\b)/u);
});

test("Vercel packages engine assets only into the premium register function", async () => {
  const config = JSON.parse(await projectFile("vercel.json")) as {
    readonly $schema?: string;
    readonly functions?: Readonly<Record<string, { readonly includeFiles?: string; readonly maxDuration?: number }>>;
    readonly crons?: readonly { readonly path: string; readonly schedule: string }[];
  };
  assert.equal(config.$schema, "https://openapi.vercel.sh/vercel.json");
  const functions = config.functions ?? {};
  const register = functions["api/v1/premium/reports/register.ts"];
  assert.ok(register, "premium registration function config is required");
  assert.equal(typeof register.includeFiles, "string");
  assert.ok((register.maxDuration ?? 0) >= 30);

  const included = new Set(expandBraces(register.includeFiles!));
  const expected = new Set([
    "public/data/hanja.db",
    "public/data/fourframe.db",
    "../lib/seed-ts/assets/sql-wasm-1.14.1.wasm",
    "../lib/spring-ts/data/name-stat/name-stat-summary.v1.bin",
  ]);
  assert.deepEqual(included, expected);
  for (const asset of expected) {
    const metadata = await stat(resolve(PROJECT_ROOT, asset));
    assert.equal(metadata.isFile(), true, `${asset} must be a file`);
    assert.ok(metadata.size > 1_024, `${asset} is unexpectedly small`);
  }
  for (const [route, settings] of Object.entries(functions)) {
    if (route !== "api/v1/premium/reports/register.ts") {
      assert.equal(settings.includeFiles, undefined, `${route} must not receive engine data files`);
    }
  }
  assert.deepEqual(config.crons, [
    {
      path: "/api/internal/maintenance/sync",
      schedule: "17 * * * *",
    },
    {
      path: "/api/internal/maintenance/auth",
      schedule: "*/5 * * * *",
    },
    {
      path: "/api/internal/maintenance/premium",
      schedule: "*/2 * * * *",
    },
    {
      path: "/api/internal/maintenance/premium-expiry",
      schedule: "7,22,37,52 * * * *",
    },
  ]);
  assert.equal(functions["api/internal/maintenance/sync.ts"]?.maxDuration, 60);
  assert.equal(functions["api/internal/maintenance/auth.ts"]?.maxDuration, 60);
  assert.equal(functions["api/internal/maintenance/premium.ts"]?.maxDuration, 60);
  assert.equal(functions["api/internal/maintenance/premium-expiry.ts"]?.maxDuration, 60);
  assert.equal(functions["api/v1/premium/admin/reconcile-leases.ts"]?.maxDuration, 60);
  assert.equal(functions["api/v1/content/admin/export-local-manifest.ts"]?.maxDuration, 300);
  assert.equal(functions["api/v1/content/admin/export-local-bundle.ts"]?.maxDuration, 300);

  const deploymentRunbook = await projectFile("DEPLOYMENT_BACKEND.md");
  assert.match(deploymentRunbook, /Sub-daily cron requires Vercel Pro or Enterprise/u);
  assert.match(deploymentRunbook, /Fluid Compute is the selected/u);
  assert.match(deploymentRunbook, /explicit 300-second maximum/u);
  assert.match(deploymentRunbook, /CONTENT_EXPORT_OPERATIONAL_STATE/u);
  assert.match(deploymentRunbook, /21,060/u);
});
