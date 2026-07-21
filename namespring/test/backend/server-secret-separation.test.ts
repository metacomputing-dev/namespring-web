import assert from "node:assert/strict";
import test from "node:test";

import { ApiHttpError } from "../../api/_lib/http.js";
import { getAuthAuditHmacKeyV1 } from "../../api/_lib/auth-audit-privacy.js";
import { getAuthIdentityBindingHmacKeyV2 } from "../../api/_lib/auth-identity.js";
import { getAuthRoleProvisioningHmacKeyV1 } from "../../api/_lib/auth-role-provisioning-contract.js";
import { getContentAuditHmacKeyringV1 } from "../../api/_lib/content-audit-privacy.js";
import {
  parseRegisterContentArtifactRequest,
  sha256Digest,
} from "../../api/_lib/content-validation.js";
import { assertMaintenanceCronRequest } from "../../api/_lib/maintenance-http.js";
import { getPremiumAuditHmacKeyringV1 } from "../../api/_lib/premium-audit-privacy.js";
import { sealPremiumJsonRecordV1 } from "../../api/_lib/premium-crypto.js";
import { createRateLimitKeyV1 } from "../../api/_lib/rate-limit.js";
import { assertServerSecretSeparationV1 } from "../../api/_lib/server-secret-separation.js";
import { getAccountSyncService } from "../../api/_lib/sync-runtime.js";
import { getTossPayment } from "../../api/_lib/toss.js";

const SECRET_ENVIRONMENTS = [
  "AUTH_IDENTITY_BINDING_HMAC_KEY",
  "AUTH_AUDIT_HMAC_KEY",
  "AUTH_ROLE_PROVISIONING_HMAC_KEY",
  "RATE_LIMIT_HMAC_KEY",
  "SYNC_DELETION_HASH_PEPPER",
  "CRON_SECRET",
  "TOSS_SECRET_KEY",
  "PREMIUM_OWNER_DERIVATION_SECRET",
  "CONTENT_GATE_ATTESTATION_KEYRING_JSON",
  "CONTENT_AUDIT_HMAC_KEYRING_JSON",
  "PREMIUM_AUDIT_HMAC_KEYRING_JSON",
  "PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON",
] as const;

async function withSecretEnvironment(
  values: Readonly<Record<string, string | undefined>>,
  run: () => void | Promise<void>,
): Promise<void> {
  const previous = new Map(SECRET_ENVIRONMENTS.map((name) => [name, process.env[name]] as const));
  for (const name of SECRET_ENVIRONMENTS) delete process.env[name];
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) process.env[name] = value;
  }
  try {
    await run();
  } finally {
    for (const name of SECRET_ENVIRONMENTS) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function expectReuse(code: string, run: () => void): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof ApiHttpError);
    assert.equal(error.code, code);
    assert.equal(error.message.includes("AUTH_AUDIT_HMAC_KEY"), false);
    assert.equal(error.message.includes("CRON_SECRET"), false);
    return true;
  });
}

function contentGateProbeRequest() {
  const payload = {
    schemaVersion: "namespring.other-draft.v1",
    data: { purpose: "secret-separation-probe" },
  } as const;
  const contentDigest = sha256Digest(payload);
  return {
    requestId: "register:secret-separation-probe",
    artifactId: "secret-separation-probe",
    channel: {
      contentKey: "security.secret-separation-probe",
      kind: "other",
      audience: "shared",
      locale: "ko-KR",
    },
    version: "v1",
    payload,
    contentDigest,
    provenance: {
      source: {
        sourceKind: "manual",
        sourceId: "secret-separation-test",
        sourceVersion: "v1",
        sourceDigest: sha256Digest({ source: "secret-separation-test" }),
        importedAt: "2026-07-19T00:00:00.000Z",
      },
      gate: {
        gateVersion: "v1",
        decision: "passed",
        checkedAt: "2026-07-19T00:01:00.000Z",
        resultDigest: sha256Digest({ result: "passed" }),
        attestation: {
          attestationId: "gate:secret-separation-probe",
          runner: "trusted_ci",
          keyId: "requested",
          subjectContentDigest: contentDigest,
          policyDigest: sha256Digest({ policy: "test" }),
          signature: `hmac-sha256:${"0".repeat(64)}`,
        },
      },
    },
  } as const;
}

test("independent server secret domains pass without inspecting their labels", async () => {
  await withSecretEnvironment({
    AUTH_AUDIT_HMAC_KEY: "auth-audit-0123456789abcdef0123456789abcdef",
    CRON_SECRET: "cron-0123456789abcdef0123456789abcdef0123",
    CONTENT_AUDIT_HMAC_KEYRING_JSON: JSON.stringify({
      currentKeyId: "content-1",
      keys: { "content-1": "content-audit-0123456789abcdef0123456789abcdef" },
    }),
  }, () => {
    assert.doesNotThrow(() => assertServerSecretSeparationV1(
      "auth_audit",
      [process.env.AUTH_AUDIT_HMAC_KEY!],
      "AUTH_AUDIT_KEY_REUSE",
    ));
  });
});

test("raw auth and cron key reuse fails closed", async () => {
  const reused = "reused-0123456789abcdef0123456789abcdef";
  await withSecretEnvironment({ AUTH_AUDIT_HMAC_KEY: reused, CRON_SECRET: reused }, () => {
    expectReuse("AUTH_AUDIT_KEY_REUSE", () => assertServerSecretSeparationV1(
      "auth_audit",
      [reused],
      "AUTH_AUDIT_KEY_REUSE",
    ));
    expectReuse("MAINTENANCE_SECRET_REUSE", () => assertServerSecretSeparationV1(
      "maintenance_cron",
      [reused],
      "MAINTENANCE_SECRET_REUSE",
    ));
  });
});

test("nested content and premium keyrings cannot reuse a value", async () => {
  const reused = "nested-reuse-0123456789abcdef0123456789abcdef";
  await withSecretEnvironment({
    CONTENT_AUDIT_HMAC_KEYRING_JSON: JSON.stringify({
      currentKeyId: "content-1",
      keys: { "content-1": reused },
    }),
    PREMIUM_AUDIT_HMAC_KEYRING_JSON: JSON.stringify({
      currentKeyId: "premium-1",
      keys: { "premium-1": reused },
    }),
  }, () => {
    expectReuse("CONTENT_AUDIT_KEY_REUSE", () => assertServerSecretSeparationV1(
      "content_audit",
      [reused],
      "CONTENT_AUDIT_KEY_REUSE",
    ));
  });
});

test("decoded premium encryption bytes cannot equal an HMAC key", async () => {
  const rawBytes = Buffer.from("decoded-reuse-0123456789abcdef0123456789", "utf8");
  const encoded = rawBytes.toString("base64").replace(/=+$/u, "");
  await withSecretEnvironment({
    AUTH_AUDIT_HMAC_KEY: rawBytes.toString("utf8"),
    PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON: JSON.stringify({
      currentKeyId: "enc-1",
      keys: { "enc-1": encoded },
    }),
  }, () => {
    expectReuse("PREMIUM_ENCRYPTION_KEY_REUSE", () => assertServerSecretSeparationV1(
      "premium_encryption",
      [encoded, rawBytes],
      "PREMIUM_ENCRYPTION_KEY_REUSE",
    ));
  });
});

test("same-domain retained keys do not conflict and malformed unrelated JSON is ignored", async () => {
  const current = "content-current-0123456789abcdef0123456789abcdef";
  const retained = "content-retained-0123456789abcdef0123456789abcdef";
  await withSecretEnvironment({
    CONTENT_AUDIT_HMAC_KEYRING_JSON: JSON.stringify({
      currentKeyId: "current",
      keys: { current, retained },
    }),
    PREMIUM_AUDIT_HMAC_KEYRING_JSON: "{malformed",
  }, () => {
    assert.doesNotThrow(() => assertServerSecretSeparationV1(
      "content_audit",
      [current, retained],
      "CONTENT_AUDIT_KEY_REUSE",
    ));
  });
});

test("malformed nested metadata and unusable encryption values do not create reuse false positives", async () => {
  const reusedMetadata = "metadata-only-0123456789abcdef0123456789abcdef";
  await withSecretEnvironment({
    AUTH_AUDIT_HMAC_KEY: reusedMetadata,
    CONTENT_AUDIT_HMAC_KEYRING_JSON: JSON.stringify({
      currentKeyId: reusedMetadata,
      keys: null,
    }),
    PREMIUM_AUDIT_HMAC_KEYRING_JSON: JSON.stringify({
      currentKeyId: reusedMetadata,
      keys: [],
    }),
    PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON: JSON.stringify({
      currentKeyId: "bad",
      keys: {
        bad: reusedMetadata,
        short: Buffer.from("not-32-bytes", "utf8").toString("base64"),
      },
    }),
  }, () => {
    assert.doesNotThrow(() => assertServerSecretSeparationV1(
      "auth_audit",
      [reusedMetadata],
      "AUTH_AUDIT_KEY_REUSE",
    ));
  });
  const oversizedGateValue = "g".repeat(257);
  await withSecretEnvironment({
    AUTH_AUDIT_HMAC_KEY: oversizedGateValue,
    CONTENT_GATE_ATTESTATION_KEYRING_JSON: JSON.stringify({ gate: oversizedGateValue }),
  }, () => {
    assert.doesNotThrow(() => assertServerSecretSeparationV1(
      "auth_audit",
      [oversizedGateValue],
      "AUTH_AUDIT_KEY_REUSE",
    ));
  });
});

test("premium encryption own material is canonicalized across padded and unpadded base64", async () => {
  const rawKey = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");
  const padded = rawKey.toString("base64");
  const unpadded = padded.replace(/=+$/u, "");
  await withSecretEnvironment({ AUTH_AUDIT_HMAC_KEY: rawKey.toString("utf8") }, () => {
    expectReuse("PREMIUM_ENCRYPTION_KEY_REUSE", () => assertServerSecretSeparationV1(
      "premium_encryption",
      [unpadded],
      "PREMIUM_ENCRYPTION_KEY_REUSE",
    ));
    expectReuse("PREMIUM_ENCRYPTION_KEY_REUSE", () => assertServerSecretSeparationV1(
      "premium_encryption",
      [padded],
      "PREMIUM_ENCRYPTION_KEY_REUSE",
    ));
  });
});

test("raw getter trimming cannot disguise reuse, while unusable raw config is ignored", async () => {
  const reused = "trimmed-reuse-0123456789abcdef0123456789abcdef";
  await withSecretEnvironment({ AUTH_AUDIT_HMAC_KEY: `  ${reused}  ` }, () => {
    expectReuse("RATE_LIMIT_KEY_REUSE", () => assertServerSecretSeparationV1(
      "rate_limit",
      [reused],
      "RATE_LIMIT_KEY_REUSE",
    ));
  });
  await withSecretEnvironment({
    AUTH_AUDIT_HMAC_KEY: reused,
    CRON_SECRET: `${reused},`,
  }, () => {
    assert.doesNotThrow(() => assertServerSecretSeparationV1(
      "auth_audit",
      [reused],
      "AUTH_AUDIT_KEY_REUSE",
    ));
  });
  const tooFewSyncCharacters = "가".repeat(16);
  await withSecretEnvironment({ SYNC_DELETION_HASH_PEPPER: tooFewSyncCharacters }, () => {
    assert.doesNotThrow(() => assertServerSecretSeparationV1(
      "toss",
      [tooFewSyncCharacters],
      "TOSS_SECRET_REUSE",
    ));
  });
});

test("every configured secret environment participates in the domain matrix", async () => {
  const reused = "matrix-reuse-0123456789abcdef0123456789abcdef";
  const encoded = Buffer.from(reused, "utf8").subarray(0, 32).toString("base64");
  const cases = [
    { environment: { AUTH_IDENTITY_BINDING_HMAC_KEY: reused }, ownDomain: "auth_audit", own: reused },
    { environment: { AUTH_AUDIT_HMAC_KEY: reused }, ownDomain: "rate_limit", own: reused },
    { environment: { AUTH_ROLE_PROVISIONING_HMAC_KEY: reused }, ownDomain: "auth_audit", own: reused },
    { environment: { RATE_LIMIT_HMAC_KEY: reused }, ownDomain: "auth_audit", own: reused },
    { environment: { SYNC_DELETION_HASH_PEPPER: reused }, ownDomain: "auth_audit", own: reused },
    { environment: { CRON_SECRET: reused }, ownDomain: "auth_audit", own: reused },
    { environment: { TOSS_SECRET_KEY: reused }, ownDomain: "auth_audit", own: reused },
    { environment: { PREMIUM_OWNER_DERIVATION_SECRET: reused }, ownDomain: "auth_audit", own: reused },
    {
      environment: { CONTENT_GATE_ATTESTATION_KEYRING_JSON: JSON.stringify({ gate: reused }) },
      ownDomain: "auth_audit",
      own: reused,
    },
    {
      environment: {
        CONTENT_AUDIT_HMAC_KEYRING_JSON: JSON.stringify({ currentKeyId: "one", keys: { one: reused } }),
      },
      ownDomain: "auth_audit",
      own: reused,
    },
    {
      environment: {
        PREMIUM_AUDIT_HMAC_KEYRING_JSON: JSON.stringify({ currentKeyId: "one", keys: { one: reused } }),
      },
      ownDomain: "auth_audit",
      own: reused,
    },
    {
      environment: {
        PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON: JSON.stringify({ currentKeyId: "one", keys: { one: encoded } }),
      },
      ownDomain: "auth_audit",
      own: Buffer.from(encoded, "base64"),
    },
  ] as const;
  for (const scenario of cases) {
    await withSecretEnvironment(scenario.environment, () => {
      expectReuse("SERVER_SECRET_REUSE", () => assertServerSecretSeparationV1(
        scenario.ownDomain,
        [scenario.own],
      ));
    });
  }
});

test("real auth, role, content, premium, rate-limit, sync, and maintenance getters reject reuse", async () => {
  const reused = "getter-reuse-0123456789abcdef0123456789abcdef";
  await withSecretEnvironment({ AUTH_IDENTITY_BINDING_HMAC_KEY: reused, AUTH_AUDIT_HMAC_KEY: reused }, () => {
    expectReuse("AUTH_IDENTITY_BINDING_KEY_REUSE", getAuthIdentityBindingHmacKeyV2);
  });
  await withSecretEnvironment({ AUTH_AUDIT_HMAC_KEY: reused, CRON_SECRET: reused }, () => {
    expectReuse("AUTH_AUDIT_KEY_REUSE", getAuthAuditHmacKeyV1);
  });
  await withSecretEnvironment({ AUTH_ROLE_PROVISIONING_HMAC_KEY: reused, AUTH_AUDIT_HMAC_KEY: reused }, () => {
    expectReuse("ROLE_PROVISIONING_HMAC_KEY_REUSE", getAuthRoleProvisioningHmacKeyV1);
  });
  await withSecretEnvironment({
    CONTENT_AUDIT_HMAC_KEYRING_JSON: JSON.stringify({ currentKeyId: "one", keys: { one: reused } }),
    TOSS_SECRET_KEY: reused,
  }, () => {
    expectReuse("CONTENT_AUDIT_KEY_REUSE", getContentAuditHmacKeyringV1);
  });
  await withSecretEnvironment({
    PREMIUM_AUDIT_HMAC_KEYRING_JSON: JSON.stringify({ currentKeyId: "one", keys: { one: reused } }),
    CONTENT_GATE_ATTESTATION_KEYRING_JSON: JSON.stringify({ gate: reused }),
  }, () => {
    expectReuse("PREMIUM_AUDIT_KEY_REUSE", getPremiumAuditHmacKeyringV1);
  });
  await withSecretEnvironment({
    RATE_LIMIT_HMAC_KEY: reused,
    CONTENT_GATE_ATTESTATION_KEYRING_JSON: JSON.stringify({ gate: reused }),
  }, () => {
    expectReuse("RATE_LIMIT_KEY_REUSE", () => createRateLimitKeyV1("auth.login", "trusted-user"));
  });
  await withSecretEnvironment({
    SYNC_DELETION_HASH_PEPPER: reused,
    RATE_LIMIT_HMAC_KEY: reused,
  }, () => {
    expectReuse("SYNC_DELETION_KEY_REUSE", getAccountSyncService);
  });
  await withSecretEnvironment({
    CRON_SECRET: reused,
    PREMIUM_AUDIT_HMAC_KEYRING_JSON: JSON.stringify({ currentKeyId: "one", keys: { one: reused } }),
  }, () => {
    expectReuse("MAINTENANCE_SECRET_REUSE", () => assertMaintenanceCronRequest({
      method: "GET",
      url: "https://example.test/api/internal/maintenance/sync",
      headers: { Authorization: `Bearer ${reused}` },
    }));
  });
});

test("separation checks re-read environment changes instead of caching a prior safe result", async () => {
  const own = "runtime-own-0123456789abcdef0123456789abcdef";
  await withSecretEnvironment({
    AUTH_AUDIT_HMAC_KEY: own,
    CRON_SECRET: "runtime-other-0123456789abcdef0123456789abcdef",
  }, () => {
    assert.doesNotThrow(() => assertServerSecretSeparationV1("auth_audit", [own]));
    process.env.CRON_SECRET = own;
    expectReuse("SERVER_SECRET_REUSE", () => assertServerSecretSeparationV1("auth_audit", [own]));
  });
});

test("premium encryption getter rejects decoded reuse on cold and warm cache paths", async () => {
  const encryptionBytes = Buffer.from("abcdef0123456789abcdef0123456789", "utf8");
  const encryptionSource = JSON.stringify({
    currentKeyId: "enc-1",
    keys: { "enc-1": encryptionBytes.toString("base64").replace(/=+$/u, "") },
  });
  await withSecretEnvironment({
    PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON: encryptionSource,
    AUTH_AUDIT_HMAC_KEY: encryptionBytes.toString("utf8"),
  }, () => {
    expectReuse("PREMIUM_ENCRYPTION_KEY_REUSE", () => sealPremiumJsonRecordV1("probe/cold", { ok: true }));
  });
  await withSecretEnvironment({
    PREMIUM_ANALYSIS_ENCRYPTION_KEYS_JSON: encryptionSource,
    AUTH_AUDIT_HMAC_KEY: "independent-auth-0123456789abcdef0123456789abcdef",
  }, () => {
    assert.doesNotThrow(() => sealPremiumJsonRecordV1("probe/cache-fill", { ok: true }));
    process.env.AUTH_AUDIT_HMAC_KEY = encryptionBytes.toString("utf8");
    expectReuse("PREMIUM_ENCRYPTION_KEY_REUSE", () => sealPremiumJsonRecordV1("probe/cached", { ok: true }));
  });
});

test("content gate getter checks every retained key, including an unrequested reused key", async () => {
  const requestedSecret = "requested-gate-0123456789abcdef0123456789abcdef";
  const reusedRetainedSecret = "retained-gate-0123456789abcdef0123456789abcdef";
  await withSecretEnvironment({
    AUTH_AUDIT_HMAC_KEY: reusedRetainedSecret,
    CONTENT_GATE_ATTESTATION_KEYRING_JSON: JSON.stringify({
      requested: requestedSecret,
      retained: reusedRetainedSecret,
    }),
  }, () => {
    expectReuse("CONTENT_GATE_KEY_REUSE", () => parseRegisterContentArtifactRequest(contentGateProbeRequest()));
  });
});

test("content gate rejects malformed unrequested entries before signature or separation checks", async () => {
  const requested = "requested-gate-0123456789abcdef0123456789abcdef";
  const distinct = (index: number) => `extra-gate-${index}-0123456789abcdef0123456789abcdef`;
  const invalidKeyrings = [
    { requested, short: "too-short" },
    { requested, duplicate: requested },
    { requested, oversized: "x".repeat(257) },
    Object.fromEntries([
      ["requested", requested],
      ...Array.from({ length: 8 }, (_, index) => [`extra-${index}`, distinct(index)] as const),
    ]),
    { requested, "bad key id": distinct(9) },
  ];
  for (const keyring of invalidKeyrings) {
    await withSecretEnvironment({
      CONTENT_GATE_ATTESTATION_KEYRING_JSON: JSON.stringify(keyring),
    }, () => {
      assert.throws(
        () => parseRegisterContentArtifactRequest(contentGateProbeRequest()),
        (error: unknown) => error instanceof ApiHttpError
          && error.statusCode === 503
          && error.code === "CONTENT_GATE_ATTESTATION_CONFIG_INVALID",
      );
    });
  }
});

test("Toss request path fails before network I/O when its server key is reused", async () => {
  const reused = "toss-reuse-0123456789abcdef0123456789abcdef";
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("network must not be reached");
  }) as typeof fetch;
  try {
    await withSecretEnvironment({
      TOSS_SECRET_KEY: reused,
      AUTH_AUDIT_HMAC_KEY: reused,
    }, async () => {
      await assert.rejects(
        getTossPayment("payment-key-secret-separation-probe"),
        (error: unknown) => error instanceof ApiHttpError
          && error.code === "TOSS_SECRET_REUSE"
          && !error.message.includes(reused),
      );
    });
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
