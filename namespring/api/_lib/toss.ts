import { getOptionalEnv, getRequiredEnv } from "./env.js";
import { ApiHttpError } from "./http.js";

const DEFAULT_TOSS_API_BASE_URL = "https://api.tosspayments.com";

export class TossApiError extends ApiHttpError {
  public readonly raw?: unknown;

  constructor(statusCode: number, code: string, message: string, raw?: unknown) {
    super(statusCode, code, message, raw);
    this.raw = raw;
  }
}

export interface TossConfirmResponse {
  paymentKey: string;
  orderId: string;
  method?: string;
  approvedAt?: string;
  status?: string;
  [key: string]: unknown;
}

export interface TossCancelResponse {
  paymentKey: string;
  status?: string;
  method?: string;
  cancels?: Array<{
    canceledAt?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

function getAuthHeader() {
  const secretKey = getRequiredEnv("TOSS_SECRET_KEY");
  return `Basic ${Buffer.from(`${secretKey}:`, "utf8").toString("base64")}`;
}

function getApiBaseUrl() {
  return getOptionalEnv("TOSS_API_BASE_URL") ?? DEFAULT_TOSS_API_BASE_URL;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const rawText = await response.text();
  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return { raw: rawText };
  }
}

async function tossPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await parseResponseBody(response);
  if (!response.ok) {
    const code = typeof (payload as { code?: unknown })?.code === "string"
      ? String((payload as { code?: unknown }).code)
      : `TOSS_HTTP_${response.status}`;
    const message = typeof (payload as { message?: unknown })?.message === "string"
      ? String((payload as { message?: unknown }).message)
      : "Toss API request failed.";
    throw new TossApiError(response.status, code, message, payload);
  }

  return payload as T;
}

export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<TossConfirmResponse> {
  return tossPost<TossConfirmResponse>("/v1/payments/confirm", params);
}

export async function cancelTossPayment(params: {
  paymentKey: string;
  cancelReason: string;
  cancelAmount?: number;
}): Promise<TossCancelResponse> {
  const body: Record<string, unknown> = {
    cancelReason: params.cancelReason,
  };

  if (typeof params.cancelAmount === "number") {
    body.cancelAmount = params.cancelAmount;
  }

  return tossPost<TossCancelResponse>(`/v1/payments/${encodeURIComponent(params.paymentKey)}/cancel`, body);
}
