import assert from "node:assert/strict";
import test from "node:test";

import { ApiHttpError } from "../../api/_lib/http.js";
import { createSyncMaintenanceHandler } from "../../api/internal/maintenance/sync.js";
import { createAuthMaintenanceHandler } from "../../api/internal/maintenance/auth.js";
import { createPremiumMaintenanceHandler } from "../../api/internal/maintenance/premium.js";
import type { MaintenanceRunResponseV1 } from "../../api/_lib/maintenance-http.js";

const SECRET = "cron-secret-0123456789abcdef0123456789abcdef";

const success: MaintenanceRunResponseV1 = {
  schemaVersion: "namespring.maintenance-run.v1",
  runId: "mrun_0123456789abcdefghijklmn",
  job: "sync_retention",
  outcome: "completed",
  scanned: 2,
  deleted: 1,
  skipped: 1,
  failed: 0,
  hasMore: false,
  deadlineReached: false,
  durationMs: 12,
};

const authSuccess: MaintenanceRunResponseV1 = {
  ...success,
  job: "auth_lifecycle",
};

const premiumSuccess: MaintenanceRunResponseV1 = {
  ...success,
  job: "premium_payment_reconciliation",
  scanned: 3,
  deleted: 2,
  skipped: 0,
  failed: 1,
  hasMore: true,
  outcome: "partial",
};

async function withCronSecret(value: string | undefined, run: () => Promise<void>): Promise<void> {
  const previous = process.env.CRON_SECRET;
  if (value === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = value;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
}

test("maintenance GET fails closed when CRON_SECRET is absent or too short", async () => {
  let calls = 0;
  const handler = createSyncMaintenanceHandler(async () => {
    calls += 1;
    return success;
  });
  for (const configured of [undefined, "too-short"]) {
    await withCronSecret(configured, async () => {
      const response = await handler(new Request("https://example.test/api/internal/maintenance/sync", {
        headers: { Authorization: "Bearer too-short" },
      }));
      assert.ok(response instanceof Response);
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, "MAINTENANCE_AUTH_NOT_CONFIGURED");
    });
  }
  assert.equal(calls, 0);
});

test("maintenance auth uses only the exact bearer header", async () => {
  let calls = 0;
  const handler = createSyncMaintenanceHandler(async () => {
    calls += 1;
    return success;
  });
  await withCronSecret(SECRET, async () => {
    const attempts = [
      new Request(`https://example.test/api/internal/maintenance/sync?cron_secret=${encodeURIComponent(SECRET)}`, {
        headers: { "User-Agent": SECRET },
      }),
      new Request("https://example.test/api/internal/maintenance/sync", {
        headers: { Authorization: `Bearer ${"x".repeat(Buffer.byteLength(SECRET))}` },
      }),
      new Request("https://example.test/api/internal/maintenance/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${SECRET}` },
      }),
      { headers: { Authorization: `Bearer ${SECRET}` } },
      {
        method: "GET",
        url: "https://example.test/api/internal/maintenance/sync",
        headers: { Authorization: `Bearer ${SECRET}` },
        body: { cron_secret: SECRET },
      },
      {
        method: "GET",
        url: "https://example.test/api/internal/maintenance/sync",
        headers: { Authorization: [`Bearer ${SECRET}`, `Bearer ${SECRET}`] },
      },
    ];
    const expected = [400, 401, 405, 405, 400, 401];
    for (let index = 0; index < attempts.length; index += 1) {
      const response = await handler(attempts[index]!);
      assert.ok(response instanceof Response);
      assert.equal(response.status, expected[index]);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
    }
  });
  assert.equal(calls, 0);
});

test("maintenance response is a bounded aggregate and never reflects its secret", async () => {
  let calls = 0;
  const handler = createSyncMaintenanceHandler(async () => {
    calls += 1;
    return success;
  });
  await withCronSecret(SECRET, async () => {
    const response = await handler(new Request("https://example.test/api/internal/maintenance/sync", {
      headers: {
        Authorization: `Bearer ${SECRET}`,
        "User-Agent": "not-a-security-boundary",
      },
    }));
    assert.ok(response instanceof Response);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    const text = await response.text();
    assert.equal(text.includes(SECRET), false);
    assert.deepEqual(JSON.parse(text), success);
  });
  assert.equal(calls, 1);
});

test("Node-style case-insensitive single-value authorization is accepted", async () => {
  let calls = 0;
  const handler = createSyncMaintenanceHandler(async () => {
    calls += 1;
    return success;
  });
  await withCronSecret(SECRET, async () => {
    const response = await handler({
      method: "GET",
      url: "/api/internal/maintenance/sync",
      headers: { Authorization: [`Bearer ${SECRET}`] },
      body: {},
    });
    assert.ok(response instanceof Response);
    assert.equal(response.status, 200);
  });
  assert.equal(calls, 1);
});

test("auth lifecycle maintenance shares the strict cron boundary and returns only aggregate state", async () => {
  let calls = 0;
  const handler = createAuthMaintenanceHandler(async () => {
    calls += 1;
    return authSuccess;
  });
  await withCronSecret(SECRET, async () => {
    const response = await handler(new Request("https://example.test/api/internal/maintenance/auth", {
      headers: { Authorization: `Bearer ${SECRET}` },
    }));
    assert.ok(response instanceof Response);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
    assert.deepEqual(await response.json(), authSuccess);
  });
  assert.equal(calls, 1);

  const sensitive = "firebase-uid-and-provider-secret-detail";
  const failing = createAuthMaintenanceHandler(async () => {
    throw new ApiHttpError(503, "AUTH_PROVIDER_INTERNAL", sensitive);
  });
  await withCronSecret(SECRET, async () => {
    const response = await failing(new Request("https://example.test/api/internal/maintenance/auth", {
      headers: { Authorization: `Bearer ${SECRET}` },
    }));
    assert.ok(response instanceof Response);
    assert.equal(response.status, 500);
    const text = await response.text();
    assert.equal(text.includes("AUTH_PROVIDER_INTERNAL"), false);
    assert.equal(text.includes(sensitive), false);
    assert.equal(JSON.parse(text).error.code, "MAINTENANCE_INTERNAL_ERROR");
  });
});

test("sync maintenance seals authenticated run failures behind its aggregate-only boundary", async () => {
  const sensitive = "internal-user-session-and-document-detail";
  const failing = createSyncMaintenanceHandler(async () => {
    throw new ApiHttpError(503, "SYNC_STORAGE_INTERNAL", sensitive);
  });
  await withCronSecret(SECRET, async () => {
    const response = await failing(new Request("https://example.test/api/internal/maintenance/sync", {
      headers: { Authorization: `Bearer ${SECRET}` },
    }));
    assert.ok(response instanceof Response);
    assert.equal(response.status, 500);
    const text = await response.text();
    assert.equal(text.includes("SYNC_STORAGE_INTERNAL"), false);
    assert.equal(text.includes(sensitive), false);
    assert.equal(JSON.parse(text).error.code, "MAINTENANCE_INTERNAL_ERROR");
  });
});

test("premium maintenance shares cron auth and never reflects provider or lease failure details", async () => {
  let calls = 0;
  const handler = createPremiumMaintenanceHandler(async () => {
    calls += 1;
    return premiumSuccess;
  });
  await withCronSecret(SECRET, async () => {
    const response = await handler(new Request("https://example.test/api/internal/maintenance/premium", {
      headers: { Authorization: `Bearer ${SECRET}` },
    }));
    assert.ok(response instanceof Response);
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.deepEqual(JSON.parse(text), premiumSuccess);
    assert.equal(text.includes("paymentKey"), false);
    assert.equal(text.includes("orderId"), false);
    assert.equal(text.includes("internalUserId"), false);
  });
  assert.equal(calls, 1);

  const failing = createPremiumMaintenanceHandler(async () => {
    throw new ApiHttpError(503, "TOSS_UNAVAILABLE", "provider-secret-detail");
  });
  await withCronSecret(SECRET, async () => {
    const response = await failing(new Request("https://example.test/api/internal/maintenance/premium", {
      headers: { Authorization: `Bearer ${SECRET}` },
    }));
    assert.ok(response instanceof Response);
    assert.equal(response.status, 500);
    const text = await response.text();
    assert.equal(text.includes("TOSS_UNAVAILABLE"), false);
    assert.equal(text.includes("provider-secret-detail"), false);
    assert.deepEqual(JSON.parse(text), {
      error: {
        code: "MAINTENANCE_INTERNAL_ERROR",
        message: "Scheduled maintenance did not complete.",
      },
    });
  });
});
