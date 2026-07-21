import { getOptionalEnv } from "./env.js";
import { ApiHttpError } from "./http.js";
import { AUTH_PROVIDERS, type AuthProvider } from "../../shared/types/auth.js";
import type { AccountUpgradeIntent } from "../../shared/types/auth.js";

export const PRIMARY_SIGN_IN_PROVIDERS = ["google", "kakao_oidc", "email_link"] as const;
export const STEP_UP_ONLY_PROVIDERS = ["phone"] as const;
export const FUTURE_PROVIDERS = ["facebook", "oidc"] as const;
export const PROVIDER_READY_CONTRACT = ["anonymous", "google", "kakao_oidc", "email_link", "phone"] as const;
export const DISABLED_UNTIL_LIFECYCLE_ADAPTER_PROVIDERS = ["apple"] as const;

const FIREBASE_OIDC_PROVIDER_ID_PATTERN = /^oidc\.[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

function exactFirebaseOidcProviderId(name: string, value: string): string {
  if (!FIREBASE_OIDC_PROVIDER_ID_PATTERN.test(value)) {
    throw new ApiHttpError(
      500,
      "INVALID_AUTH_CONFIG",
      `${name} must be one exact Firebase OIDC provider ID (for example, oidc.kakao).`,
    );
  }
  return value;
}

/**
 * Provider-family substring matching is unsafe for account bindings. The
 * Firebase console's exact Kakao provider ID is therefore a required launch
 * configuration whenever Kakao is enabled.
 */
export function configuredKakaoFirebaseProviderId(): string | null {
  const raw = getOptionalEnv("AUTH_KAKAO_FIREBASE_PROVIDER_ID");
  return raw ? exactFirebaseOidcProviderId("AUTH_KAKAO_FIREBASE_PROVIDER_ID", raw) : null;
}

/** Future generic OIDC adapters are accepted only through an exact, bounded allowlist. */
export function configuredGenericOidcFirebaseProviderIds(): readonly string[] {
  const raw = getOptionalEnv("AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS");
  if (!raw) return [];
  const values = raw.split(",").map((entry) => entry.trim());
  if (values.some((entry) => entry.length === 0) || values.length > 8 || new Set(values).size !== values.length) {
    throw new ApiHttpError(
      500,
      "INVALID_AUTH_CONFIG",
      "AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS must contain 1-8 distinct exact provider IDs.",
    );
  }
  const kakaoProviderId = configuredKakaoFirebaseProviderId();
  const exact = values.map((value) => exactFirebaseOidcProviderId("AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS", value));
  if (kakaoProviderId && exact.includes(kakaoProviderId)) {
    throw new ApiHttpError(
      500,
      "INVALID_AUTH_CONFIG",
      "The Kakao Firebase provider ID must not also appear in the generic OIDC allowlist.",
    );
  }
  return exact;
}

export function assertAuthProviderLifecycleReady(provider: AuthProvider): void {
  if ((DISABLED_UNTIL_LIFECYCLE_ADAPTER_PROVIDERS as readonly AuthProvider[]).includes(provider)) {
    throw new ApiHttpError(
      503,
      "APPLE_AUTH_REVOCATION_ADAPTER_REQUIRED",
      "Apple sign-in remains disabled until verified token revocation and deletion lifecycle support is deployed.",
    );
  }
}

function boundedInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = getOptionalEnv(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ApiHttpError(500, "INVALID_AUTH_CONFIG", `${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

export function sessionDurationSeconds(): number {
  // Firebase Admin supports a maximum session-cookie duration of 14 days.
  return boundedInteger("AUTH_SESSION_DAYS", 5, 1, 14) * 24 * 60 * 60;
}

export function recentAuthenticationMaxAgeSeconds(): number {
  return boundedInteger("AUTH_RECENT_AUTH_MAX_AGE_SECONDS", 5 * 60, 60, 15 * 60);
}

export function csrfDurationSeconds(): number {
  return boundedInteger("AUTH_CSRF_TTL_SECONDS", 60 * 60, 5 * 60, 24 * 60 * 60);
}

export function enabledAuthProviders(): readonly AuthProvider[] {
  const raw = getOptionalEnv("AUTH_ENABLED_PROVIDERS");
  if (!raw) return [];
  const unique = new Set<AuthProvider>();
  for (const entry of raw.split(",")) {
    const provider = entry.trim();
    if (!AUTH_PROVIDERS.includes(provider as AuthProvider)) {
      throw new ApiHttpError(500, "INVALID_AUTH_CONFIG", `Unsupported AUTH_ENABLED_PROVIDERS entry: ${provider}`);
    }
    assertAuthProviderLifecycleReady(provider as AuthProvider);
    unique.add(provider as AuthProvider);
  }
  if (unique.has("kakao_oidc") && !configuredKakaoFirebaseProviderId()) {
    throw new ApiHttpError(
      500,
      "INVALID_AUTH_CONFIG",
      "AUTH_KAKAO_FIREBASE_PROVIDER_ID is required when kakao_oidc is enabled.",
    );
  }
  if (unique.has("oidc") && configuredGenericOidcFirebaseProviderIds().length === 0) {
    throw new ApiHttpError(
      500,
      "INVALID_AUTH_CONFIG",
      "AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS is required when generic OIDC is enabled.",
    );
  }
  return AUTH_PROVIDERS.filter((provider) => unique.has(provider));
}

export function assertAuthProviderEnabled(provider: AuthProvider): void {
  assertAuthProviderLifecycleReady(provider);
  if (!enabledAuthProviders().includes(provider)) {
    throw new ApiHttpError(403, "AUTH_PROVIDER_DISABLED", "This authentication provider is not enabled.");
  }
}

export function isPrimarySignInProvider(provider: AuthProvider): boolean {
  return (PRIMARY_SIGN_IN_PROVIDERS as readonly AuthProvider[]).includes(provider);
}

export function hasPrimarySignInProvider(
  providers: readonly Pick<{ provider: AuthProvider }, "provider">[],
): boolean {
  return providers.some((entry) => isPrimarySignInProvider(entry.provider));
}

export function assertPublicSessionProvider(provider: AuthProvider): void {
  if (provider === "anonymous" || isPrimarySignInProvider(provider)) return;
  throw new ApiHttpError(
    403,
    "PROVIDER_NOT_PRIMARY_SIGN_IN",
    provider === "phone"
      ? "Phone verification is available only as a step-up or linked recovery factor."
      : "This provider is not enabled as a primary sign-in method.",
  );
}

/**
 * Anonymous Firebase principals are a short bridge into an explicitly requested
 * server-backed sync or paid flow. Free/local use and generic account-upgrade
 * navigation must never create a server account as a side effect.
 */
export function assertAnonymousBridgeIntent(intent: AccountUpgradeIntent): void {
  if (intent === "sync" || intent === "payment") return;
  throw new ApiHttpError(
    409,
    "ACCOUNT_UPGRADE_REQUIRED",
    "Anonymous authentication is available only when explicitly starting synchronization or payment.",
  );
}
