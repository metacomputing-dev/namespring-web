import { createHash } from "node:crypto";
import { getRequiredEnv } from "./env.js";
import { ApiHttpError } from "./http.js";
import { assertServerSecretSeparationV1 } from "./server-secret-separation.js";
import { readBoundedTossJsonV1, tossApiBaseUrlV1 } from "./toss-transport.js";

const REQUEST_TIMEOUT_MS = 12_000;

export class TossApiError extends ApiHttpError {
  constructor(statusCode: number, code: string, message: string) {
    super(statusCode, code, message);
  }
}

export interface LegacyTossPaymentObservation {
  readonly paymentKey: string;
  readonly orderId: string;
  readonly status: string;
  readonly totalAmount: number;
  readonly balanceAmount: number;
  readonly currency: string;
  readonly method: string | null;
  readonly canceledAt: string | null;
  readonly observedAt: string;
}

function getAuthHeader(): string {
  const secretKey = getRequiredEnv("TOSS_SECRET_KEY");
  assertServerSecretSeparationV1("toss", [secretKey], "TOSS_SECRET_REUSE");
  return `Basic ${Buffer.from(`${secretKey}:`, "utf8").toString("base64")}`;
}

function providerString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 512) {
    throw new TossApiError(502, "TOSS_INVALID_RESPONSE", `Toss response ${field} is invalid.`);
  }
  return value;
}

function providerInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new TossApiError(502, "TOSS_INVALID_RESPONSE", `Toss response ${field} is invalid.`);
  }
  return Number(value);
}

function providerTimestamp(value: unknown, field: string): string {
  const text = providerString(value, field);
  const milliseconds = Date.parse(text);
  if (!Number.isFinite(milliseconds)) {
    throw new TossApiError(502, "TOSS_INVALID_RESPONSE", `Toss response ${field} is invalid.`);
  }
  return new Date(milliseconds).toISOString();
}

function latestCancellation(payload: Record<string, unknown>): string | null {
  if (payload.cancels === undefined || payload.cancels === null) return null;
  if (!Array.isArray(payload.cancels)) {
    throw new TossApiError(502, "TOSS_INVALID_RESPONSE", "Toss response cancels is invalid.");
  }
  const timestamps = payload.cancels.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TossApiError(502, "TOSS_INVALID_RESPONSE", `Toss response cancels[${index}] is invalid.`);
    }
    return providerTimestamp((entry as Record<string, unknown>).canceledAt, `cancels[${index}].canceledAt`);
  });
  return timestamps.sort().at(-1) ?? null;
}

function normalizePayment(payload: unknown): LegacyTossPaymentObservation {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TossApiError(502, "TOSS_INVALID_RESPONSE", "Toss payment response must be an object.");
  }
  const raw = payload as Record<string, unknown>;
  const totalAmount = providerInteger(raw.totalAmount, "totalAmount");
  const balanceAmount = providerInteger(raw.balanceAmount, "balanceAmount");
  if (balanceAmount > totalAmount) {
    throw new TossApiError(502, "TOSS_INVALID_RESPONSE", "Toss balance exceeds the total amount.");
  }
  const method = raw.method === null || raw.method === undefined
    ? null
    : providerString(raw.method, "method");
  return {
    paymentKey: providerString(raw.paymentKey, "paymentKey"),
    orderId: providerString(raw.orderId, "orderId"),
    status: providerString(raw.status, "status"),
    totalAmount,
    balanceAmount,
    currency: providerString(raw.currency, "currency"),
    method,
    canceledAt: latestCancellation(raw),
    observedAt: new Date().toISOString(),
  };
}

async function tossRequest(path: string, init: RequestInit): Promise<LegacyTossPaymentObservation> {
  // Keep server configuration failures outside the network-error wrapper so
  // operations can distinguish secret reuse/misconfiguration from provider
  // downtime without exposing the configured value.
  const requestUrl = `${tossApiBaseUrlV1()}${path}`;
  const authorization = getAuthHeader();
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...init,
      headers: {
        Authorization: authorization,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...init.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new TossApiError(503, "TOSS_UNAVAILABLE", "Toss request did not complete.");
  }

  const payload = await readBoundedTossJsonV1(response);
  if (!response.ok) {
    const code = response.status === 404
      ? "TOSS_PAYMENT_NOT_FOUND"
      : response.status >= 500 ? "TOSS_UNAVAILABLE" : "TOSS_REQUEST_REJECTED";
    const message = response.status === 404
      ? "Toss payment was not found."
      : response.status >= 500 ? "Toss could not complete the request." : "Toss rejected the request.";
    // Provider bodies can include merchant diagnostics or payment identifiers;
    // neither the body nor its code/message belongs in an exception object.
    throw new TossApiError(response.status, code, message);
  }
  return normalizePayment(payload);
}

export function legacyRefundIdempotencyKey(input: {
  readonly orderId: string;
  readonly paymentKey: string;
  readonly cancelAmount: number;
}): string {
  const digest = createHash("sha256")
    .update("namespring.legacy-refund-provider.v1\0", "utf8")
    .update(input.orderId, "utf8")
    .update("\0", "utf8")
    .update(input.paymentKey, "utf8")
    .update("\0", "utf8")
    .update(String(input.cancelAmount), "utf8")
    .digest("hex");
  return `namespring-legacy-refund-${digest}`;
}

export function getTossPayment(paymentKey: string): Promise<LegacyTossPaymentObservation> {
  return tossRequest(`/v1/payments/${encodeURIComponent(paymentKey)}`, { method: "GET" });
}

export function getTossPaymentByOrderId(orderId: string): Promise<LegacyTossPaymentObservation> {
  return tossRequest(`/v1/payments/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

export function cancelTossPayment(params: {
  readonly paymentKey: string;
  readonly orderId: string;
  readonly cancelReason: string;
  readonly cancelAmount: number;
}): Promise<LegacyTossPaymentObservation> {
  const idempotencyKey = legacyRefundIdempotencyKey(params);
  return tossRequest(`/v1/payments/${encodeURIComponent(params.paymentKey)}/cancel`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      cancelReason: params.cancelReason,
      cancelAmount: params.cancelAmount,
    }),
  });
}
