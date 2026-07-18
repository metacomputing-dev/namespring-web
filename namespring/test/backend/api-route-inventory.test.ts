import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = fileURLToPath(new URL("../../api/", import.meta.url));

function routeFiles(directory = apiRoot): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(absolute);
    if (!entry.isFile() || !entry.name.endsWith(".ts")) return [];
    const path = relative(apiRoot, absolute).replaceAll("\\", "/");
    return path.startsWith("_lib/") ? [] : [path];
  }).sort();
}

const EXPECTED_API_ROUTES = [
  "admin/refund.ts",
  "auth/admin/get-lifecycle-job.ts",
  "auth/admin/list-lifecycle-jobs.ts",
  "auth/admin/retry-deletion.ts",
  "auth/admin/retry-unlink.ts",
  "auth/csrf.ts",
  "auth/current.ts",
  "auth/delete.ts",
  "auth/export-portable.ts",
  "auth/export.ts",
  "auth/link.ts",
  "auth/logout.ts",
  "auth/policy.ts",
  "auth/revoke.ts",
  "auth/session.ts",
  "auth/unlink.ts",
  "internal/maintenance/auth.ts",
  "internal/maintenance/premium-expiry.ts",
  "internal/maintenance/premium.ts",
  "internal/maintenance/sync.ts",
  "payments/confirm.ts",
  "payments/create.ts",
  "payments/fail.ts",
  "v1/content/admin/activate.ts",
  "v1/content/admin/approve.ts",
  "v1/content/admin/export-local-bundle.ts",
  "v1/content/admin/export-local-manifest.ts",
  "v1/content/admin/export-local-page.ts",
  "v1/content/admin/finalize-local-export.ts",
  "v1/content/admin/get.ts",
  "v1/content/admin/list.ts",
  "v1/content/admin/register.ts",
  "v1/content/admin/retire.ts",
  "v1/content/admin/review.ts",
  "v1/content/admin/rollback.ts",
  "v1/content/admin/stage-batch.ts",
  "v1/premium/account/export.ts",
  "v1/premium/admin/content/activate-template.ts",
  "v1/premium/admin/content/activate.ts",
  "v1/premium/admin/content/review-template.ts",
  "v1/premium/admin/content/review.ts",
  "v1/premium/admin/content/retire.ts",
  "v1/premium/admin/discovery/get.ts",
  "v1/premium/admin/discovery/list.ts",
  "v1/premium/admin/reconcile-leases.ts",
  "v1/premium/admin/reconcile.ts",
  "v1/premium/admin/refund.ts",
  "v1/premium/admin/revoke.ts",
  "v1/premium/catalog.ts",
  "v1/premium/checkout/create.ts",
  "v1/premium/payments/confirm.ts",
  "v1/premium/reports/deliver.ts",
  "v1/premium/reports/register.ts",
  "v1/premium/webhooks/toss.ts",
  "v1/sync/admin/retention-status.ts",
  "v1/sync/admin/retention-sweep.ts",
  "v1/sync/consent.ts",
  "v1/sync/delete.ts",
  "v1/sync/delta.ts",
  "v1/sync/export.ts",
  "v1/sync/revoke.ts",
  "v1/sync/snapshot.ts",
] as const;

test("every deployable API route is explicitly reviewed in the backend inventory", () => {
  assert.deepEqual(routeFiles(), [...EXPECTED_API_ROUTES].sort());
});

test("free saju, naming, integrated reports, and local content have no runtime server route", () => {
  const routes = routeFiles();
  assert.equal(
    routes.some((path) => /^v1\/(?:free|saju|naming|integrated|reports)(?:\/|\.ts$)/u.test(path)),
    false,
    "free/local computation must stay in the packaged mobile engine",
  );
  assert.equal(
    routes.filter((path) => path.startsWith("v1/content/")).every((path) => path.startsWith("v1/content/admin/")),
    true,
    "content APIs are build/admin lifecycle routes, never a free runtime delivery path",
  );

  const contentService = readFileSync(join(apiRoot, "_lib/content-service.ts"), "utf8");
  assert.match(contentService, /LOCAL_CONTENT_SERVER_DELIVERY_FORBIDDEN/u);
  assert.match(contentService, /channel\.audience === "free_local"/u);
  assert.match(contentService, /assertArtifactDeliverable\(artifact, "paid_server"\)/u);
});
