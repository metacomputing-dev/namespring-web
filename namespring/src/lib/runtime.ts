export interface FrontRuntimeConfig {
  paymentEnabled: boolean;
  tossClientKey: string;
  apiBaseUrl: string | null;
  paymentAppOrigin: string | null;
  canonicalOrigin: string | null;
}

let cachedConfig: FrontRuntimeConfig | null = null;
const DEFAULT_PRODUCTION_APP_ORIGIN = "https://namespring-web.vercel.app";

function toNullableTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeOrigin(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.replace(/\/+$/g, "");
}

function isLocalhostHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function shouldUseDefaultProductionOrigin(): boolean {
  if (import.meta.env.DEV) {
    return false;
  }

  if (typeof window !== "undefined" && isLocalhostHost(window.location.hostname)) {
    return false;
  }

  return true;
}

export function getFrontRuntimeConfig(): FrontRuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const paymentEnabled = String(import.meta.env.VITE_PAYMENT_ENABLED || "").trim().toLowerCase() === "true";
  const tossClientKey = toNullableTrimmedString(import.meta.env.VITE_TOSS_CLIENT_KEY) ?? "";
  const apiBaseUrl = toNullableTrimmedString(import.meta.env.VITE_API_BASE_URL);
  const defaultProductionOrigin = shouldUseDefaultProductionOrigin() ? DEFAULT_PRODUCTION_APP_ORIGIN : null;
  const paymentAppOrigin =
    normalizeOrigin(toNullableTrimmedString(import.meta.env.VITE_PAYMENT_APP_ORIGIN)) ??
    defaultProductionOrigin;
  const canonicalOrigin =
    normalizeOrigin(toNullableTrimmedString(import.meta.env.VITE_CANONICAL_ORIGIN)) ??
    defaultProductionOrigin;

  cachedConfig = {
    paymentEnabled,
    tossClientKey,
    apiBaseUrl: normalizeOrigin(apiBaseUrl),
    paymentAppOrigin,
    canonicalOrigin,
  };
  return cachedConfig;
}
