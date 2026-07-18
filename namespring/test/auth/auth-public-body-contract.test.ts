import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assertExactAuthJsonObjectV1,
  issueCsrfToken,
} from "../../api/_lib/auth-http.js";
import sessionHandler from "../../api/auth/session.js";

const namespringRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function source(path: string): string {
  return readFileSync(join(namespringRoot, path), "utf8");
}

test("every public auth JSON mutation declares a route-specific byte cap and exact key set", () => {
  const contracts = [
    ["api/auth/session.ts", "AUTH_SESSION_BODY_MAX_BYTES_V1", '["idToken", "intent"]'],
    ["api/auth/link.ts", "AUTH_LINK_BODY_MAX_BYTES_V1", '["reauthIdToken", "linkedIdToken", "provider"]'],
    ["api/auth/unlink.ts", "AUTH_UNLINK_BODY_MAX_BYTES_V1", '["reauthIdToken", "provider"]'],
    ["api/auth/delete.ts", "AUTH_DELETE_BODY_MAX_BYTES_V1", '["reauthIdToken", "confirmation"]'],
    ["api/auth/revoke.ts", "AUTH_REVOKE_BODY_MAX_BYTES_V1", '["reauthIdToken"]'],
  ] as const;
  for (const [routeFile, limit, keys] of contracts) {
    const route = source(routeFile);
    assert.ok(route.includes(`{ maxBytes: ${limit} }`), `${routeFile} has no explicit body limit`);
    assert.ok(route.includes(`assertExactAuthJsonObjectV1(rawBody, ${keys}`), `${routeFile} has no exact DTO gate`);
    assert.ok(
      route.lastIndexOf("assertExactAuthJsonObjectV1(") < route.lastIndexOf("verifyFirebaseIdToken("),
      `${routeFile} verifies tokens before DTO shape`,
    );
  }
});

test("exact auth DTO gate rejects arrays, exotic prototypes, proto keys, and unknown fields", () => {
  for (const value of [null, [], new Date(), Object.assign(Object.create({ inherited: true }), { idToken: "x" })]) {
    assert.throws(
      () => assertExactAuthJsonObjectV1(value, ["idToken"], "INVALID_TEST_REQUEST"),
      (error: unknown) => (error as { code?: string }).code === "INVALID_TEST_REQUEST",
    );
  }
  const protoKey = JSON.parse('{"idToken":"x","__proto__":{"polluted":true}}') as unknown;
  assert.throws(
    () => assertExactAuthJsonObjectV1(protoKey, ["idToken"], "INVALID_TEST_REQUEST"),
    (error: unknown) => (error as { code?: string }).code === "INVALID_TEST_REQUEST",
  );
  assert.throws(
    () => assertExactAuthJsonObjectV1({ idToken: "x", unexpected: true }, ["idToken"], "INVALID_TEST_REQUEST"),
    (error: unknown) => (error as { code?: string }).code === "INVALID_TEST_REQUEST",
  );
  assert.doesNotThrow(() => assertExactAuthJsonObjectV1(Object.assign(Object.create(null), { idToken: "x" }), ["idToken"], "INVALID_TEST_REQUEST"));
});

test("session route rejects unknown, oversized, and coerced bodies before Firebase and never echoes tokens", async () => {
  const previousOrigins = process.env.AUTH_ALLOWED_ORIGINS;
  const previousClientIp = process.env.AUTH_TRUSTED_DEV_CLIENT_IP;
  process.env.AUTH_ALLOWED_ORIGINS = "https://app.example";
  process.env.AUTH_TRUSTED_DEV_CLIENT_IP = "127.0.0.1";
  const csrf = issueCsrfToken();
  const csrfCookie = csrf.cookie.split(";", 1)[0];
  const invoke = (body: string) => sessionHandler(new Request("https://app.example/api/auth/session", {
    method: "POST",
    headers: {
      Origin: "https://app.example",
      Cookie: csrfCookie,
      "X-CSRF-Token": csrf.response.csrfToken,
      "Content-Type": "application/json",
    },
    body,
  }));
  try {
    const secretToken = `token-secret-${"x".repeat(32)}`;
    const unknown = await invoke(JSON.stringify({ idToken: secretToken, intent: "sign_in", unexpected: true }));
    assert.ok(unknown instanceof Response);
    assert.equal(unknown.status, 400);
    const unknownText = await unknown.text();
    assert.match(unknownText, /INVALID_SESSION_REQUEST/u);
    assert.equal(unknownText.includes(secretToken), false);

    const coerced = await invoke(JSON.stringify({ idToken: 12345, intent: "sign_in" }));
    assert.ok(coerced instanceof Response);
    assert.equal(coerced.status, 400);
    assert.match(await coerced.text(), /INVALID_ID_TOKEN/u);

    const oversized = await invoke(JSON.stringify({ idToken: "x".repeat(21 * 1024), intent: "sign_in" }));
    assert.ok(oversized instanceof Response);
    assert.equal(oversized.status, 413);
    assert.match(await oversized.text(), /REQUEST_BODY_TOO_LARGE/u);
  } finally {
    if (previousOrigins === undefined) delete process.env.AUTH_ALLOWED_ORIGINS;
    else process.env.AUTH_ALLOWED_ORIGINS = previousOrigins;
    if (previousClientIp === undefined) delete process.env.AUTH_TRUSTED_DEV_CLIENT_IP;
    else process.env.AUTH_TRUSTED_DEV_CLIENT_IP = previousClientIp;
  }
});
