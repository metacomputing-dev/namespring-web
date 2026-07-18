import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const namespringRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function source(path: string): string {
  return readFileSync(join(namespringRoot, path), "utf8");
}

function filesRecursively(path: string): string[] {
  const absolute = join(namespringRoot, path);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) return filesRecursively(relative(namespringRoot, child));
    return entry.name.endsWith(".ts") ? [relative(namespringRoot, child).replaceAll("\\", "/")] : [];
  });
}

const adminRouteFiles = [
  ...filesRecursively("api/admin"),
  ...filesRecursively("api/auth/admin"),
  ...filesRecursively("api/v1/content/admin"),
  ...filesRecursively("api/v1/premium/admin"),
  ...filesRecursively("api/v1/sync/admin"),
].sort();

const expectedAdminRouteFiles = [
  "api/admin/refund.ts",
  "api/auth/admin/get-lifecycle-job.ts",
  "api/auth/admin/list-lifecycle-jobs.ts",
  "api/auth/admin/retry-deletion.ts",
  "api/auth/admin/retry-unlink.ts",
  "api/v1/content/admin/activate.ts",
  "api/v1/content/admin/approve.ts",
  "api/v1/content/admin/export-local-bundle.ts",
  "api/v1/content/admin/export-local-manifest.ts",
  "api/v1/content/admin/export-local-page.ts",
  "api/v1/content/admin/finalize-local-export.ts",
  "api/v1/content/admin/get.ts",
  "api/v1/content/admin/list.ts",
  "api/v1/content/admin/register.ts",
  "api/v1/content/admin/retire.ts",
  "api/v1/content/admin/review.ts",
  "api/v1/content/admin/rollback.ts",
  "api/v1/content/admin/stage-batch.ts",
  "api/v1/premium/admin/content/activate-template.ts",
  "api/v1/premium/admin/content/activate.ts",
  "api/v1/premium/admin/content/review-template.ts",
  "api/v1/premium/admin/content/review.ts",
  "api/v1/premium/admin/content/retire.ts",
  "api/v1/premium/admin/discovery/get.ts",
  "api/v1/premium/admin/discovery/list.ts",
  "api/v1/premium/admin/reconcile-leases.ts",
  "api/v1/premium/admin/reconcile.ts",
  "api/v1/premium/admin/refund.ts",
  "api/v1/premium/admin/revoke.ts",
  "api/v1/sync/admin/retention-status.ts",
  "api/v1/sync/admin/retention-sweep.ts",
].sort();

test("the versioned admin contract inventories every browser admin route", () => {
  assert.deepEqual(adminRouteFiles, expectedAdminRouteFiles);
  const contract = source("docs/ADMIN_API_CONTRACT_V1.md");
  assert.match(contract, /namespring\.backend-admin-api\.v1/u);
  for (const routeFile of expectedAdminRouteFiles) {
    const endpoint = `/${routeFile.replace(/\.ts$/u, "")}`;
    assert.ok(contract.includes(`\`${endpoint}\``), `${endpoint} is missing from the versioned contract`);
  }
  for (const endpoint of [
    "/api/internal/maintenance/auth",
    "/api/internal/maintenance/sync",
    "/api/internal/maintenance/premium",
    "/api/internal/maintenance/premium-expiry",
  ]) {
    assert.ok(contract.includes(endpoint), `${endpoint} must remain documented as browser-forbidden`);
  }
});

test("content admin routes share POST, Origin, CSRF, dual-admin-role and bounded-body guards", () => {
  const common = source("api/_lib/content-http.ts");
  assert.ok(common.includes("assertAuthMethod(req, [\"POST\"])") && common.includes("assertTrustedMutationRequest(req)"));
  assert.ok(common.includes("requireAuthenticatedRole(req, \"admin\")"));
  assert.ok(common.includes("consumeRateLimitV1"));

  for (const routeFile of adminRouteFiles.filter((path) => path.startsWith("api/v1/content/admin/"))) {
    const route = source(routeFile);
    assert.ok(route.includes("prepareContentAdminRequestV1"), `${routeFile} bypasses the content admin guard`);
    assert.ok(route.includes("readJsonBody"), `${routeFile} has no application-level request byte bound`);
    assert.ok(
      route.lastIndexOf("prepareContentAdminRequestV1") < route.lastIndexOf("readJsonBody"),
      `${routeFile} must authorize before parsing the request body`,
    );
  }
  for (const routeFile of [
    "api/v1/content/admin/export-local-bundle.ts",
    "api/v1/content/admin/export-local-manifest.ts",
  ]) {
    const route = source(routeFile);
    assert.ok(route.includes("CONTENT_ADMIN_EMPTY_BODY_MAX_BYTES"));
    assert.ok(route.includes("parseEmptyContentAdminRequest"));
  }
});

test("premium admin routes enforce their role at the route boundary before body parsing", () => {
  const premiumRoutes = adminRouteFiles.filter((path) => path.startsWith("api/v1/premium/admin/"));
  const expectedRoles: Readonly<Record<string, string>> = {
    "api/v1/premium/admin/content/activate.ts": "[\"premium_admin\"]",
    "api/v1/premium/admin/content/activate-template.ts": "[\"premium_admin\"]",
    "api/v1/premium/admin/content/review.ts": "[\"premium_admin\"]",
    "api/v1/premium/admin/content/review-template.ts": "[\"premium_admin\"]",
    "api/v1/premium/admin/content/retire.ts": "[\"premium_admin\"]",
    "api/v1/premium/admin/discovery/get.ts": "[\"premium_admin\"]",
    "api/v1/premium/admin/discovery/list.ts": "[\"premium_admin\"]",
    "api/v1/premium/admin/reconcile.ts": "[\"premium_admin\"]",
    "api/v1/premium/admin/reconcile-leases.ts": "[\"premium_admin\"]",
    "api/v1/premium/admin/refund.ts": "[\"premium_admin\"]",
    "api/v1/premium/admin/revoke.ts": "[\"premium_admin\"]",
  };
  assert.deepEqual(premiumRoutes.sort(), Object.keys(expectedRoles).sort());
  for (const routeFile of premiumRoutes) {
    const route = source(routeFile);
    assert.ok(route.includes("preparePremiumAdminMutationV1"), `${routeFile} lacks the route-level role guard`);
    assert.equal(route.includes("prepareAuthenticatedPremiumMutation"), false);
    assert.ok(route.includes(expectedRoles[routeFile] ?? "missing-role-contract"), `${routeFile} role contract drifted`);
    assert.ok(
      route.lastIndexOf("preparePremiumAdminMutationV1") < route.lastIndexOf("readPremiumJsonBodyV1"),
      `${routeFile} must authorize before parsing the request body`,
    );
  }

  const common = source("api/_lib/premium-http.ts");
  assert.ok(common.includes("resolveAuthenticatedPrincipal(req)"));
  assert.ok(common.includes("allowedRoles.some((role) => actor.roles.includes(role))"));
});

test("premium discovery is metadata-only, exact, bounded, opaque-cursor paginated, and fail-closed", () => {
  const discovery = source("api/_lib/premium-admin-discovery.ts");
  for (const routeFile of [
    "api/v1/premium/admin/discovery/get.ts",
    "api/v1/premium/admin/discovery/list.ts",
  ]) {
    const route = source(routeFile);
    assert.ok(route.includes("readPremiumJsonBodyV1") && route.includes("4 * 1024"));
    assert.ok(route.includes("assertPlainBody"));
    assert.ok(route.includes("premium.admin.discovery.read"));
    assert.ok(route.includes("assertPremiumAdminDiscoveryResponseBudgetV1"));
  }
  assert.ok(discovery.includes("PREMIUM_ADMIN_DISCOVERY_LIMIT_MAX_V1 = 20"));
  assert.ok(discovery.includes("PREMIUM_ADMIN_DISCOVERY_RESPONSE_MAX_BYTES_V1 = 128 * 1024"));
  assert.ok(discovery.includes("PREMIUM_ADMIN_PROJECTION_STALE"));
  assert.ok(discovery.includes("PREMIUM_ADMIN_PROJECTION_MISSING"));
  assert.ok(discovery.includes("premium_admin_cursor_v1_"));
  for (const forbidden of [
    "accountWriteSubjectId", "paymentKey", "ciphertext", "authenticationTag", "claimToken",
    "ownerPseudonym", "candidateId", "analysisId", "PremiumReportBindingV1",
  ]) {
    assert.equal(
      source("shared/types/premium-admin-discovery.ts").includes(forbidden),
      false,
      `admin discovery DTO leaked forbidden field ${forbidden}`,
    );
  }
});

test("premium admin operation receipts cannot expose owner or candidate-analysis binding internals", () => {
  const contract = source("shared/types/premium-service.ts");
  const orderView = contract.match(/export interface PremiumOrderViewV1 \{[\s\S]*?\n\}/u)?.[0] ?? "";
  const entitlementView = contract.match(/export interface PremiumEntitlementViewV1 \{[\s\S]*?\n\}/u)?.[0] ?? "";
  assert.ok(orderView && entitlementView);
  for (const view of [orderView, entitlementView]) {
    for (const forbidden of ["owner", "subjectId", "candidateId", "analysisId", "PremiumReportBindingV1", "paymentKey", "providerState"]) {
      assert.equal(view.includes(forbidden), false, `premium admin operation view leaked ${forbidden}`);
    }
    for (const required of ["reportId", "productId", "contentVersion", "status"]) {
      assert.ok(view.includes(required), `premium admin operation view is missing ${required}`);
    }
  }
});

test("non-premium admin routes require trusted browser mutation and dual admin role before bounded parsing", () => {
  for (const routeFile of [
    "api/admin/refund.ts",
    "api/auth/admin/get-lifecycle-job.ts",
    "api/auth/admin/list-lifecycle-jobs.ts",
    "api/auth/admin/retry-deletion.ts",
    "api/auth/admin/retry-unlink.ts",
    "api/v1/sync/admin/retention-status.ts",
    "api/v1/sync/admin/retention-sweep.ts",
  ]) {
    const route = source(routeFile);
    assert.ok(route.includes("assertAuthMethod(req, [\"POST\"])") && route.includes("assertTrustedMutationRequest(req)"));
    assert.ok(route.includes("requireAuthenticatedRole(req, \"admin\")"));
    assert.ok(route.includes("readJsonBody"), `${routeFile} has no application-level request byte bound`);
    assert.ok(
      route.lastIndexOf("requireAuthenticatedRole") < route.lastIndexOf("readJsonBody"),
      `${routeFile} must authorize before parsing the request body`,
    );
  }
});

test("auth lifecycle discovery is metadata-only, bounded, audited, and separately rate limited", () => {
  const lifecycleAdmin = source("api/_lib/auth-lifecycle-admin.ts");
  const authRepositoryContract = source("api/_lib/auth-accounts-contract.ts");
  const authLifecycle = source("api/_lib/auth-accounts-lifecycle.ts");
  const authRateLimit = source("api/_lib/auth-rate-limit.ts");
  for (const routeFile of [
    "api/auth/admin/list-lifecycle-jobs.ts",
    "api/auth/admin/get-lifecycle-job.ts",
  ]) {
    const route = source(routeFile);
    assert.ok(route.includes("AUTH_LIFECYCLE_ADMIN_BODY_MAX_BYTES_V1"));
    assert.ok(route.includes("consumeAuthRateLimit(\"adminLifecycleRead\", operator.userId)"));
    assert.ok(route.includes("sendAuthJson(res, 200"), "discovery responses must inherit no-store headers");
  }
  assert.match(lifecycleAdmin, /AUTH_LIFECYCLE_ADMIN_BODY_MAX_BYTES_V1\s*=\s*8\s*\*\s*1024/u);
  assert.match(lifecycleAdmin, /AUTH_LIFECYCLE_ADMIN_RESPONSE_MAX_BYTES_V1\s*=\s*64\s*\*\s*1024/u);
  assert.ok(lifecycleAdmin.includes("AUTH_LIFECYCLE_ADMIN_LIST_MAX_ITEMS_V1 = 20"));
  assert.ok(authRateLimit.includes("auth.admin-lifecycle-read"));
  assert.ok(authRepositoryContract.includes("recordAuthLifecycleDiscoveryAudit"));
  assert.ok(authLifecycle.includes("authAuditOpaqueValueHashV1(\"lifecycle_job_request\""));
});

test("sync retention status is exact-empty, aggregate-only, bounded, and separately rate limited", () => {
  const route = source("api/v1/sync/admin/retention-status.ts");
  const syncHttp = source("api/_lib/sync-http.ts");
  const syncRateLimit = source("api/_lib/sync-rate-limit.ts");
  assert.ok(route.includes("SYNC_ADMIN_EMPTY_BODY_MAX_BYTES"));
  assert.ok(route.includes("parseEmptySyncAdminRequestV1"));
  assert.ok(route.includes("consumeSyncRateLimit(\"adminStatusRead\", actor.userId)"));
  assert.ok(route.includes("sendAuthJson(res, 200"), "status must inherit the no-store response helper");
  assert.match(syncHttp, /SYNC_ADMIN_EMPTY_BODY_MAX_BYTES\s*=\s*2\s*\*\s*1024/u);
  assert.ok(syncRateLimit.includes("sync.admin-retention-status"));
});
