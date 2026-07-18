import { isIP } from "node:net";
import { getOptionalEnv } from "./env.js";
import { getHeaderValue, type AuthRequestLike } from "./auth-http.js";
import { ApiHttpError } from "./http.js";
import { consumeRateLimitV1, type RateLimitPolicyV1 } from "./rate-limit.js";

export const AUTH_RATE_LIMIT_POLICIES = {
  sessionPreAuth: { scope: "auth.session-preauth", limit: 60, windowSeconds: 10 * 60 },
  session: { scope: "auth.session", limit: 20, windowSeconds: 10 * 60 },
  link: { scope: "auth.link", limit: 10, windowSeconds: 60 * 60 },
  unlink: { scope: "auth.unlink", limit: 10, windowSeconds: 60 * 60 },
  revoke: { scope: "auth.revoke", limit: 5, windowSeconds: 60 * 60 },
  delete: { scope: "auth.delete", limit: 3, windowSeconds: 24 * 60 * 60 },
  export: { scope: "auth.export", limit: 10, windowSeconds: 60 * 60 },
  adminDeletionRetry: { scope: "auth.admin-delete-retry", limit: 20, windowSeconds: 60 * 60 },
  adminUnlinkRetry: { scope: "auth.admin-unlink-retry", limit: 30, windowSeconds: 60 * 60 },
  adminLifecycleRead: { scope: "auth.admin-lifecycle-read", limit: 120, windowSeconds: 5 * 60 },
} as const satisfies Record<string, RateLimitPolicyV1>;

export type AuthRateLimitScope = keyof typeof AUTH_RATE_LIMIT_POLICIES;

export interface AuthRateLimiter {
  consume(scope: AuthRateLimitScope, trustedSubject: string): Promise<void>;
}

export function authRateLimitModeV1(): "required" | "disabled" {
  const mode = getOptionalEnv("AUTH_RATE_LIMIT_MODE")
    ?? (process.env.NODE_ENV === "production" ? "required" : "disabled");
  if (mode !== "required" && mode !== "disabled") {
    throw new ApiHttpError(500, "INVALID_AUTH_CONFIG", "AUTH_RATE_LIMIT_MODE must be required or disabled.");
  }
  if (process.env.NODE_ENV === "production" && mode !== "required") {
    throw new ApiHttpError(500, "INVALID_AUTH_CONFIG", "Authentication rate limiting is mandatory in production.");
  }
  return mode;
}

class FirestoreAuthRateLimiter implements AuthRateLimiter {
  async consume(scope: AuthRateLimitScope, trustedSubject: string): Promise<void> {
    const mode = authRateLimitModeV1();
    if (mode === "disabled") return;
    await consumeRateLimitV1({ policy: AUTH_RATE_LIMIT_POLICIES[scope], trustedSubject });
  }
}

let rateLimiter: AuthRateLimiter = new FirestoreAuthRateLimiter();

export async function consumeAuthRateLimit(scope: AuthRateLimitScope, trustedSubject: string): Promise<void> {
  await rateLimiter.consume(scope, trustedSubject);
}

/**
 * Production accepts exactly one valid address from Vercel's dedicated
 * x-vercel-forwarded-for boundary. It deliberately does not fall back to the
 * generic x-forwarded-for header, which an upstream proxy may replace.
 * Local/test execution ignores
 * request headers and requires an explicit fixed address, so a developer can
 * never accidentally turn a caller-controlled forwarding header into the
 * pre-authentication bucket key.
 */
export function trustedAuthClientIpV1(req: Pick<AuthRequestLike, "headers">): string {
  const value = process.env.NODE_ENV === "production"
    ? getHeaderValue(req, "x-vercel-forwarded-for")
    : getOptionalEnv("AUTH_TRUSTED_DEV_CLIENT_IP") ?? null;
  if (!value || value.includes(",") || isIP(value) === 0) {
    throw new ApiHttpError(
      503,
      "TRUSTED_CLIENT_IP_UNAVAILABLE",
      "A trusted client network identity is unavailable for authentication.",
    );
  }
  return value.toLowerCase();
}

/** Raw IP exists only in this call frame; consumeRateLimitV1 HMACs it before storage. */
export async function consumeAuthSessionPreflightRateLimitV1(
  req: Pick<AuthRequestLike, "headers">,
): Promise<void> {
  await consumeAuthRateLimit("sessionPreAuth", `ip:${trustedAuthClientIpV1(req)}`);
}

export function setAuthRateLimiterForTests(next: AuthRateLimiter | null): void {
  rateLimiter = next ?? new FirestoreAuthRateLimiter();
}
