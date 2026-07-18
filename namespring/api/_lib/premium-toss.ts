import { getRequiredEnv } from "./env.js";
import { ApiHttpError } from "./http.js";
import { assertServerSecretSeparationV1 } from "./server-secret-separation.js";
import { premiumDocumentKey } from "./premium-ids.js";
import type { PremiumProviderObservationV1 } from "./premium-repository-contract.js";
import type { PremiumPaymentRailAdapterIdentityV1 } from "./premium-payment-provider.js";
import { readBoundedTossJsonV1, tossApiBaseUrlV1 } from "./toss-transport.js";

export const PREMIUM_PROVIDER_REQUEST_TIMEOUT_MS = 12_000;

export interface TossPremiumClientV1 extends PremiumPaymentRailAdapterIdentityV1<"toss_web"> {
  confirm(params: { readonly paymentKey: string; readonly orderId: string; readonly amount: number }): Promise<PremiumProviderObservationV1>;
  get(paymentKey: string): Promise<PremiumProviderObservationV1>;
  cancel(params: { readonly paymentKey: string; readonly reason: string }): Promise<PremiumProviderObservationV1>;
}

function authHeader(): string {
  const secret = getRequiredEnv("TOSS_SECRET_KEY");
  assertServerSecretSeparationV1("toss", [secret], "TOSS_SECRET_REUSE");
  return `Basic ${Buffer.from(`${secret}:`, "utf8").toString("base64")}`;
}

async function requestToss(path: string, init?: RequestInit): Promise<unknown> {
  // Resolve and validate server configuration before the provider transport
  // catch. Configuration/separation failures must retain their stable error
  // code instead of being misreported as a transient Toss outage.
  const requestUrl = `${tossApiBaseUrlV1()}${path}`;
  const authorization = authHeader();
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...init,
      headers: {
        Authorization: authorization,
        ...(init?.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
      signal: AbortSignal.timeout(PREMIUM_PROVIDER_REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Fetch failures may retain a URL containing paymentKey in their cause.
    // Do not attach provider/network objects to a public-domain HTTP error.
    throw new ApiHttpError(503, "TOSS_UNAVAILABLE", "Toss request did not complete; order state was not changed.");
  }
  const payload = await readBoundedTossJsonV1(response);
  if (!response.ok) {
    // Provider error bodies are untrusted and can contain payment identifiers,
    // merchant diagnostics, or attacker-controlled text. Keep the public API
    // contract stable without reflecting the raw provider code/message.
    if (response.status >= 500) {
      throw new ApiHttpError(
        503,
        "TOSS_UNAVAILABLE",
        "Toss could not complete the request; order state was not changed.",
      );
    }
    throw new ApiHttpError(
      409,
      "TOSS_REQUEST_REJECTED",
      "Toss rejected the payment request; verify the payment details before retrying.",
    );
  }
  return payload;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()
    || Buffer.byteLength(value, "utf8") > 512) {
    throw new ApiHttpError(502, "TOSS_INVALID_RESPONSE", `Toss response ${field} is invalid.`);
  }
  return value;
}

function requiredPatternString(value: unknown, field: string, pattern: RegExp, maxBytes: number): string {
  const text = requiredString(value, field);
  if (Buffer.byteLength(text, "utf8") > maxBytes || !pattern.test(text)) {
    throw new ApiHttpError(502, "TOSS_INVALID_RESPONSE", `Toss response ${field} is invalid.`);
  }
  return text;
}

function requiredNonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new ApiHttpError(502, "TOSS_INVALID_RESPONSE", `Toss response ${field} is invalid.`);
  }
  return Number(value);
}

function requiredTimestamp(value: unknown, field: string): string {
  const text = requiredString(value, field);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    throw new ApiHttpError(502, "TOSS_INVALID_RESPONSE", `Toss response ${field} is invalid.`);
  }
  return new Date(parsed).toISOString();
}

function normalizeObservation(payload: unknown): PremiumProviderObservationV1 {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiHttpError(502, "TOSS_INVALID_RESPONSE", "Toss payment response is not an object.");
  }
  const payment = payload as Record<string, unknown>;
  const paymentKey = requiredPatternString(payment.paymentKey, "paymentKey", /^[A-Za-z0-9_-]+$/u, 200);
  const orderId = requiredPatternString(payment.orderId, "orderId", /^[A-Za-z0-9_-]+$/u, 200);
  const status = requiredPatternString(payment.status, "status", /^[A-Z][A-Z0-9_]{0,63}$/u, 64);
  const totalAmount = requiredNonNegativeInteger(payment.totalAmount, "totalAmount");
  const balanceAmount = requiredNonNegativeInteger(payment.balanceAmount, "balanceAmount");
  const currency = requiredPatternString(payment.currency, "currency", /^[A-Z]{3}$/u, 3);
  let occurredAt: string;
  if (status === "DONE") {
    occurredAt = requiredTimestamp(payment.approvedAt, "approvedAt");
  } else if (status === "CANCELED" || status === "PARTIAL_CANCELED") {
    if (!Array.isArray(payment.cancels) || payment.cancels.length < 1) {
      throw new ApiHttpError(502, "TOSS_INVALID_RESPONSE", "Canceled Toss payment has no cancellation record.");
    }
    const latest = [...payment.cancels]
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          throw new ApiHttpError(502, "TOSS_INVALID_RESPONSE", "Toss cancellation record is invalid.");
        }
        return requiredTimestamp((entry as Record<string, unknown>).canceledAt, "cancels[].canceledAt");
      })
      .sort()
      .at(-1);
    if (!latest) throw new ApiHttpError(502, "TOSS_INVALID_RESPONSE", "Toss cancellation timestamp is missing.");
    occurredAt = latest;
  } else {
    occurredAt = requiredTimestamp(payment.requestedAt, "requestedAt");
  }
  const observedAt = new Date().toISOString();
  return {
    eventId: `toss_event_v1_${premiumDocumentKey(paymentKey, status, occurredAt, String(balanceAmount)).slice(0, 43)}`,
    paymentKey,
    orderId,
    status,
    totalAmount,
    balanceAmount,
    currency,
    occurredAt,
    observedAt,
  };
}

export class HttpTossPremiumClientV1 implements TossPremiumClientV1 {
  readonly rail = "toss_web" as const;
  async confirm(params: { paymentKey: string; orderId: string; amount: number }) {
    return normalizeObservation(await requestToss("/v1/payments/confirm", {
      method: "POST",
      headers: {
        "Idempotency-Key": `namespring-confirm-${premiumDocumentKey(params.orderId, params.paymentKey)}`,
      },
      body: JSON.stringify(params),
    }));
  }

  async get(paymentKey: string) {
    return normalizeObservation(await requestToss(`/v1/payments/${encodeURIComponent(paymentKey)}`, {
      method: "GET",
    }));
  }

  async cancel(params: { paymentKey: string; reason: string }) {
    return normalizeObservation(await requestToss(
      `/v1/payments/${encodeURIComponent(params.paymentKey)}/cancel`,
      {
        method: "POST",
        headers: {
          "Idempotency-Key": `namespring-refund-${premiumDocumentKey(params.paymentKey)}`,
        },
        body: JSON.stringify({ cancelReason: params.reason }),
      },
    ));
  }
}
