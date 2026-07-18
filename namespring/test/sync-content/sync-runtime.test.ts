import assert from "node:assert/strict";
import test from "node:test";

import { createAccountSyncServiceAccessorV1 } from "../../api/_lib/sync-runtime.js";
import { ApiHttpError } from "../../api/_lib/http.js";
import type { AccountSyncServiceV1 } from "../../api/_lib/sync-service.js";

test("warm sync runtime revalidates separation and rotates a changed deletion pepper", () => {
  const names = ["SYNC_DELETION_HASH_PEPPER", "RATE_LIMIT_HMAC_KEY"] as const;
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  const firstPepper = "sync-pepper-first-0123456789abcdef";
  const secondPepper = "sync-pepper-second-0123456789abcde";
  const created: string[] = [];
  const getAccountSyncService = createAccountSyncServiceAccessorV1((pepper) => {
    created.push(pepper);
    return { pepper } as unknown as AccountSyncServiceV1;
  });
  try {
    process.env.SYNC_DELETION_HASH_PEPPER = firstPepper;
    process.env.RATE_LIMIT_HMAC_KEY = "rate-limit-independent-0123456789abcd";
    const first = getAccountSyncService();
    assert.equal(getAccountSyncService(), first, "an unchanged pepper should reuse the warm service");

    process.env.SYNC_DELETION_HASH_PEPPER = secondPepper;
    const rotated = getAccountSyncService();
    assert.notEqual(rotated, first, "a rotated pepper must replace the warm service");
    assert.deepEqual(created, [firstPepper, secondPepper]);

    process.env.RATE_LIMIT_HMAC_KEY = secondPepper;
    assert.throws(
      () => getAccountSyncService(),
      (error: unknown) => error instanceof ApiHttpError && error.code === "SYNC_DELETION_KEY_REUSE",
      "a later cross-domain collision must fail even after the service was cached",
    );
  } finally {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
