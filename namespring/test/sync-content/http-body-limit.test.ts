import assert from "node:assert/strict";
import test from "node:test";
import { ApiHttpError, readJsonBody } from "../../api/_lib/http.js";

function requestWithBody(body: BodyInit): Request {
  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  };
  return new Request("https://example.test/api", init);
}

test("readJsonBody keeps the 64 KiB default and accepts an explicit larger bounded route limit", async () => {
  const encoded = JSON.stringify({ value: "x".repeat(70 * 1024) });
  await assert.rejects(
    readJsonBody(requestWithBody(encoded)),
    (error: unknown) => error instanceof ApiHttpError && error.statusCode === 413,
  );
  const parsed = await readJsonBody<{ value: string }>(requestWithBody(encoded), { maxBytes: 80 * 1024 });
  assert.equal(parsed.value.length, 70 * 1024);
});

test("Fetch streaming bodies are cancelled as soon as the configured byte budget is crossed", async () => {
  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new Uint8Array(40 * 1024).fill(0x20));
      if (pulls >= 10) controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readJsonBody(requestWithBody(stream), { maxBytes: 64 * 1024 }),
    (error: unknown) => error instanceof ApiHttpError && error.code === "REQUEST_BODY_TOO_LARGE",
  );
  assert.equal(cancelled, true);
  assert.ok(pulls < 10);
});

test("Node-style async streams use the endpoint-specific limit and reject invalid UTF-8", async () => {
  const oversized = {
    method: "POST",
    async *[Symbol.asyncIterator]() {
      yield Buffer.alloc(40 * 1024, 0x20);
      yield Buffer.alloc(40 * 1024, 0x20);
    },
  };
  await assert.rejects(
    readJsonBody(oversized, { maxBytes: 70 * 1024 }),
    (error: unknown) => error instanceof ApiHttpError && error.statusCode === 413,
  );

  const invalidUtf8 = {
    method: "POST",
    async *[Symbol.asyncIterator]() {
      yield Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d]);
    },
  };
  await assert.rejects(
    readJsonBody(invalidUtf8),
    (error: unknown) => error instanceof ApiHttpError && error.code === "INVALID_UTF8",
  );
});
