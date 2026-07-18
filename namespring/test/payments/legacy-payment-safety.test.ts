import assert from "node:assert/strict";
import test from "node:test";

import adminRefundHandler from "../../api/admin/refund.js";
import {
  assertLegacyProviderSettlement,
  legacyRefundAttemptId,
} from "../../api/_lib/payments-repository.js";
import type { PaymentRecord } from "../../shared/types/payment.js";
import {
  cancelTossPayment,
  getTossPaymentByOrderId,
  legacyRefundIdempotencyKey,
} from "../../api/_lib/toss.js";
import legacyConfirmHandler from "../../api/payments/confirm.js";
import legacyCreateHandler from "../../api/payments/create.js";
import legacyFailHandler from "../../api/payments/fail.js";
import { ApiHttpError } from "../../api/_lib/http.js";

test("public legacy payment mutations are explicit fail-closed tombstones", async () => {
  for (const handler of [legacyCreateHandler, legacyConfirmHandler, legacyFailHandler]) {
    const response = await handler(new Request("https://app.example/api/payments/legacy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: "ns_20260718_120000_deadbeef" }),
    }));
    assert.ok(response instanceof Response);
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), {
      error: {
        code: "LEGACY_PAYMENT_FLOW_RETIRED",
        message: handler === legacyFailHandler
          ? "This payment flow is retired. Payment state is now determined by the authenticated premium API."
          : "This payment flow is retired. Start a new purchase through the authenticated premium API.",
      },
    });
  }
});

test("legacy tombstones retain method allowlisting", async () => {
  const response = await legacyCreateHandler(new Request("https://app.example/api/payments/create"));
  assert.ok(response instanceof Response);
  assert.equal(response.status, 405);
});

test("legacy admin refund rejects a static token without trusted browser mutation proof", async () => {
  const response = await adminRefundHandler(new Request("https://app.example/api/admin/refund", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": "obsolete-static-token",
    },
    body: JSON.stringify({ orderId: "ns_20260718_120000_deadbeef" }),
  }));
  assert.ok(response instanceof Response);
  assert.equal(response.status, 403);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "UNTRUSTED_ORIGIN");
});

test("legacy refund identifiers are deterministic and contain no raw financial identifier", () => {
  const orderId = "ns_20260718_120000_deadbeef";
  const paymentKey = "payment_key_sensitive_0123456789";
  const attempt = legacyRefundAttemptId(orderId);
  assert.equal(attempt, legacyRefundAttemptId(orderId));
  assert.match(attempt, /^legacy_refund_v1_[a-f0-9]{40}$/u);
  assert.equal(attempt.includes(orderId), false);

  const providerKey = legacyRefundIdempotencyKey({ orderId, paymentKey, cancelAmount: 900 });
  assert.equal(providerKey, legacyRefundIdempotencyKey({ orderId, paymentKey, cancelAmount: 900 }));
  assert.notEqual(providerKey, legacyRefundIdempotencyKey({ orderId, paymentKey, cancelAmount: 400 }));
  assert.equal(providerKey.includes(orderId), false);
  assert.equal(providerKey.includes(paymentKey), false);
});

test("legacy financial transition rejects a nonzero or mismatched provider settlement", () => {
  const orderId = "ns_20260718_120000_deadbeef";
  const attemptId = legacyRefundAttemptId(orderId);
  const record: PaymentRecord = {
    orderId,
    email: null,
    amount: 900,
    status: "PAID",
    paymentKey: "payment_key_0123456789",
    method: "CARD",
    createdAt: "2026-07-18T00:00:00.000Z",
    paidAt: "2026-07-18T00:01:00.000Z",
    failedAt: null,
    refundedAt: null,
    refundState: "PENDING",
    refundAttemptId: attemptId,
  };
  const provider = {
    paymentKey: record.paymentKey!,
    orderId,
    totalAmount: 900,
    balanceAmount: 0,
    currency: "KRW",
    method: "CARD",
    status: "CANCELED",
    observedAt: "2026-07-18T00:02:00.000Z",
  };
  assert.doesNotThrow(() => assertLegacyProviderSettlement({
    record,
    orderId,
    attemptId,
    provider,
    outcome: "refunded",
  }));
  for (const changed of [
    { ...provider, balanceAmount: 1 },
    { ...provider, totalAmount: 901 },
    { ...provider, currency: "USD" },
    { ...provider, paymentKey: "different_payment_key" },
    { ...provider, status: "DONE" },
  ]) {
    assert.throws(
      () => assertLegacyProviderSettlement({ record, orderId, attemptId, provider: changed, outcome: "refunded" }),
      (error: unknown) => (error as { code?: string }).code === "PROVIDER_IDENTITY_MISMATCH",
    );
  }
});

test("legacy Toss adapter recovers by orderId and sends deterministic cancel idempotency", async () => {
  const previousFetch = globalThis.fetch;
  const previousSecret = process.env.TOSS_SECRET_KEY;
  const previousBaseUrl = process.env.TOSS_API_BASE_URL;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  process.env.TOSS_SECRET_KEY = "test_sk_not_a_real_secret";
  process.env.TOSS_API_BASE_URL = "https://api.tosspayments.com";
  const payment = {
    paymentKey: "payment_key_0123456789",
    orderId: "ns_20260718_120000_deadbeef",
    status: "DONE",
    totalAmount: 900,
    balanceAmount: 900,
    currency: "KRW",
    method: "CARD",
    cancels: [],
  };
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const canceled = String(url).endsWith("/cancel");
    return new Response(JSON.stringify(canceled ? {
      ...payment,
      status: "CANCELED",
      balanceAmount: 0,
      cancels: [{ canceledAt: "2026-07-18T15:30:00+09:00" }],
    } : payment), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const recovered = await getTossPaymentByOrderId(payment.orderId);
    assert.equal(recovered.paymentKey, payment.paymentKey);
    assert.equal(calls[0]?.url, `https://api.tosspayments.com/v1/payments/orders/${payment.orderId}`);

    const first = await cancelTossPayment({
      paymentKey: payment.paymentKey,
      orderId: payment.orderId,
      cancelReason: "customer request",
      cancelAmount: 900,
    });
    assert.equal(first.status, "CANCELED");
    assert.equal(first.balanceAmount, 0);
    assert.equal(first.canceledAt, "2026-07-18T06:30:00.000Z");
    const firstKey = new Headers(calls[1]?.init.headers).get("idempotency-key");
    assert.match(firstKey ?? "", /^namespring-legacy-refund-[a-f0-9]{64}$/u);

    await cancelTossPayment({
      paymentKey: payment.paymentKey,
      orderId: payment.orderId,
      cancelReason: "a different retry label",
      cancelAmount: 900,
    });
    assert.equal(new Headers(calls[2]?.init.headers).get("idempotency-key"), firstKey);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.TOSS_SECRET_KEY;
    else process.env.TOSS_SECRET_KEY = previousSecret;
    if (previousBaseUrl === undefined) delete process.env.TOSS_API_BASE_URL;
    else process.env.TOSS_API_BASE_URL = previousBaseUrl;
  }
});

test("legacy Toss adapter rejects an unpinned origin before constructing a network request", async () => {
  const previousFetch = globalThis.fetch;
  const previousSecret = process.env.TOSS_SECRET_KEY;
  const previousBaseUrl = process.env.TOSS_API_BASE_URL;
  let fetchCalls = 0;
  process.env.TOSS_SECRET_KEY = "test_sk_not_a_real_secret";
  process.env.TOSS_API_BASE_URL = "https://api.tosspayments.com.attacker.invalid";
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("network must not be reached");
  }) as typeof fetch;
  try {
    await assert.rejects(
      getTossPaymentByOrderId("ns_20260718_120000_deadbeef"),
      (error: unknown) => error instanceof ApiHttpError && error.code === "TOSS_API_ORIGIN_INVALID",
    );
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.TOSS_SECRET_KEY;
    else process.env.TOSS_SECRET_KEY = previousSecret;
    if (previousBaseUrl === undefined) delete process.env.TOSS_API_BASE_URL;
    else process.env.TOSS_API_BASE_URL = previousBaseUrl;
  }
});

test("legacy Toss adapter rejects internally inconsistent provider balances", async () => {
  const previousFetch = globalThis.fetch;
  const previousSecret = process.env.TOSS_SECRET_KEY;
  const previousBaseUrl = process.env.TOSS_API_BASE_URL;
  process.env.TOSS_SECRET_KEY = "test_sk_not_a_real_secret";
  process.env.TOSS_API_BASE_URL = "https://api.tosspayments.com";
  globalThis.fetch = (async () => new Response(JSON.stringify({
    paymentKey: "payment_key_0123456789",
    orderId: "ns_20260718_120000_deadbeef",
    status: "DONE",
    totalAmount: 900,
    balanceAmount: 901,
    currency: "KRW",
  }), { status: 200 })) as typeof fetch;
  try {
    await assert.rejects(
      () => getTossPaymentByOrderId("ns_20260718_120000_deadbeef"),
      (error: unknown) => (error as { code?: string }).code === "TOSS_INVALID_RESPONSE",
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.TOSS_SECRET_KEY;
    else process.env.TOSS_SECRET_KEY = previousSecret;
    if (previousBaseUrl === undefined) delete process.env.TOSS_API_BASE_URL;
    else process.env.TOSS_API_BASE_URL = previousBaseUrl;
  }
});

test("legacy Toss adapter does not retain or reflect provider error payloads", async () => {
  const previousFetch = globalThis.fetch;
  const previousSecret = process.env.TOSS_SECRET_KEY;
  const previousBaseUrl = process.env.TOSS_API_BASE_URL;
  const sensitive = "merchant-payment-key-and-debug-trace";
  process.env.TOSS_SECRET_KEY = "test_sk_not_a_real_secret";
  process.env.TOSS_API_BASE_URL = "https://api.tosspayments.com";
  globalThis.fetch = (async () => new Response(JSON.stringify({
    code: `PROVIDER_${sensitive}`,
    message: `provider message ${sensitive}`,
    paymentKey: sensitive,
  }), { status: 400 })) as typeof fetch;
  try {
    await assert.rejects(
      () => getTossPaymentByOrderId("ns_20260718_120000_deadbeef"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { code?: unknown }).code, "TOSS_REQUEST_REJECTED");
        assert.equal(error.message.includes(sensitive), false);
        assert.equal(Object.hasOwn(error, "raw"), false);
        assert.equal(JSON.stringify(error).includes(sensitive), false);
        return true;
      },
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.TOSS_SECRET_KEY;
    else process.env.TOSS_SECRET_KEY = previousSecret;
    if (previousBaseUrl === undefined) delete process.env.TOSS_API_BASE_URL;
    else process.env.TOSS_API_BASE_URL = previousBaseUrl;
  }
});
