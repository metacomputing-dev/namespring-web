import assert from "node:assert/strict";
import {
  HttpTossPremiumClientV1,
  PREMIUM_PROVIDER_REQUEST_TIMEOUT_MS,
} from "../../api/_lib/premium-toss.js";
import { ApiHttpError } from "../../api/_lib/http.js";
import {
  TOSS_API_ORIGIN_V1,
  TOSS_PROVIDER_RESPONSE_MAX_BYTES_V1,
} from "../../api/_lib/toss-transport.js";

process.env.TOSS_SECRET_KEY = "test_sk_not_a_real_secret";
process.env.TOSS_API_BASE_URL = TOSS_API_ORIGIN_V1;

const originalFetch = globalThis.fetch;
const calls: Array<{ url: string; init: RequestInit }> = [];
const payment = {
  paymentKey: "payment_key_0123456789",
  orderId: "premium_order_v1_0123456789abcdef",
  status: "DONE",
  totalAmount: 1_000,
  balanceAmount: 1_000,
  currency: "KRW",
  requestedAt: "2026-07-18T09:59:00+09:00",
  approvedAt: "2026-07-18T10:00:00+09:00",
};

globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  calls.push({ url: String(url), init: init ?? {} });
  const payload = String(url).endsWith("/cancel")
    ? {
        ...payment,
        status: "CANCELED",
        balanceAmount: 0,
        cancels: [{ canceledAt: "2026-07-18T10:05:00+09:00" }],
      }
    : payment;
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

try {
  assert.equal(PREMIUM_PROVIDER_REQUEST_TIMEOUT_MS, 12_000);
  const client = new HttpTossPremiumClientV1();
  const confirmed = await client.confirm({
    paymentKey: payment.paymentKey,
    orderId: payment.orderId,
    amount: payment.totalAmount,
  });
  assert.equal(confirmed.status, "DONE");
  assert.equal(confirmed.currency, "KRW");
  assert.equal(confirmed.occurredAt, "2026-07-18T01:00:00.000Z");
  const firstKey = new Headers(calls[0]!.init.headers).get("idempotency-key");
  assert.match(firstKey ?? "", /^namespring-confirm-/u);
  assert.ok(calls[0]!.init.signal instanceof AbortSignal);

  await client.confirm({
    paymentKey: payment.paymentKey,
    orderId: payment.orderId,
    amount: payment.totalAmount,
  });
  assert.equal(new Headers(calls[1]!.init.headers).get("idempotency-key"), firstKey);

  const canceled = await client.cancel({ paymentKey: payment.paymentKey, reason: "customer request" });
  assert.equal(canceled.status, "CANCELED");
  assert.equal(canceled.balanceAmount, 0);
  assert.equal(canceled.occurredAt, "2026-07-18T01:05:00.000Z");
  const refundKey = new Headers(calls[2]!.init.headers).get("idempotency-key");
  assert.match(refundKey ?? "", /^namespring-refund-/u);

  await client.cancel({ paymentKey: payment.paymentKey, reason: "a changed retry label" });
  assert.equal(new Headers(calls[3]!.init.headers).get("idempotency-key"), refundKey);

  const callsBeforeInvalidOrigins = calls.length;
  for (const invalidOrigin of [
    "http://api.tosspayments.com",
    "https://user:password@api.tosspayments.com",
    "https://api.tosspayments.com/v1",
    "https://api.tosspayments.com?redirect=evil",
    "https://payments.example.com",
  ]) {
    process.env.TOSS_API_BASE_URL = invalidOrigin;
    await assert.rejects(
      client.get(payment.paymentKey),
      (error: unknown) => error instanceof ApiHttpError && error.code === "TOSS_API_ORIGIN_INVALID",
    );
  }
  assert.equal(calls.length, callsBeforeInvalidOrigins, "invalid origins must fail before network I/O");
  process.env.TOSS_API_BASE_URL = TOSS_API_ORIGIN_V1;

  globalThis.fetch = (async () => new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(TOSS_PROVIDER_RESPONSE_MAX_BYTES_V1));
      controller.enqueue(new Uint8Array(1));
      controller.close();
    },
  }), { status: 200 })) as typeof fetch;
  await assert.rejects(
    client.get(payment.paymentKey),
    (error: unknown) => error instanceof ApiHttpError && error.code === "TOSS_INVALID_RESPONSE",
  );

  const providerSecret = "merchant-debug-payment_key_should_never_escape";
  globalThis.fetch = (async () => new Response(JSON.stringify({
    code: `PROVIDER_${providerSecret}`,
    message: `declined: ${providerSecret}`,
  }), {
    status: 400,
    headers: { "content-type": "application/json" },
  })) as typeof fetch;
  await assert.rejects(
    client.confirm({
      paymentKey: payment.paymentKey,
      orderId: payment.orderId,
      amount: payment.totalAmount,
    }),
    (error: unknown) => {
      assert.ok(error instanceof ApiHttpError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "TOSS_REQUEST_REJECTED");
      assert.equal(error.message.includes(providerSecret), false);
      return true;
    },
  );

  globalThis.fetch = (async () => new Response(JSON.stringify({
    code: `PROVIDER_${providerSecret}`,
    message: `upstream trace: ${providerSecret}`,
  }), {
    status: 503,
    headers: { "content-type": "application/json" },
  })) as typeof fetch;
  await assert.rejects(
    client.get(payment.paymentKey),
    (error: unknown) => {
      assert.ok(error instanceof ApiHttpError);
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "TOSS_UNAVAILABLE");
      assert.equal(error.message.includes(providerSecret), false);
      return true;
    },
  );

  const unsafeStatus = `UNKNOWN_${providerSecret}:\ntrace`;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    ...payment,
    status: unsafeStatus,
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })) as typeof fetch;
  await assert.rejects(
    client.get(payment.paymentKey),
    (error: unknown) => {
      assert.ok(error instanceof ApiHttpError);
      assert.equal(error.code, "TOSS_INVALID_RESPONSE");
      assert.equal(error.message.includes(providerSecret), false);
      return true;
    },
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log("premium-toss-v1: PASS");
