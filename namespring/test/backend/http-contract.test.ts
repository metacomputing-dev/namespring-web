import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiHttpError,
  handleApiError,
  readJsonBody,
} from "../../api/_lib/http.js";

test("readJsonBody accepts a small JSON web request", async () => {
  const request = new Request("https://example.test/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  });

  assert.deepEqual(await readJsonBody(request), { ok: true });
});

test("readJsonBody rejects bodies above the server contract limit", async () => {
  const request = new Request("https://example.test/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: "x".repeat(70 * 1024) }),
  });

  await assert.rejects(
    () => readJsonBody(request),
    (error: unknown) => error instanceof ApiHttpError
      && error.statusCode === 413
      && error.code === "REQUEST_BODY_TOO_LARGE",
  );
});

test("unexpected errors never disclose internal messages", async () => {
  const response = handleApiError(undefined, new Error("private credential detail"));
  assert.ok(response instanceof Response);
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");

  const payload = await response.json() as { error: { code: string; message: string } };
  assert.equal(payload.error.code, "INTERNAL_SERVER_ERROR");
  assert.equal(payload.error.message, "Unexpected server error.");
  assert.equal(JSON.stringify(payload).includes("private credential"), false);
});
