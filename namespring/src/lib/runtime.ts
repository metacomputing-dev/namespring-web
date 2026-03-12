export interface FrontRuntimeConfig {
  paymentEnabled: boolean;
  tossClientKey: string;
  apiBaseUrl: string | null;
}

let cachedConfig: FrontRuntimeConfig | null = null;

function toNullableTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export function getFrontRuntimeConfig(): FrontRuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const paymentEnabled = String(import.meta.env.VITE_PAYMENT_ENABLED || "").trim().toLowerCase() === "true";
  const tossClientKey = toNullableTrimmedString(import.meta.env.VITE_TOSS_CLIENT_KEY) ?? "";
  const apiBaseUrl = toNullableTrimmedString(import.meta.env.VITE_API_BASE_URL);

  cachedConfig = {
    paymentEnabled,
    tossClientKey,
    apiBaseUrl,
  };
  return cachedConfig;
}
