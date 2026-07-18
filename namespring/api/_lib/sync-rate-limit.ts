import { getOptionalEnv } from "./env.js";
import { ApiHttpError } from "./http.js";
import { consumeRateLimitV1, type RateLimitPolicyV1 } from "./rate-limit.js";

/**
 * Per-account limits are deliberately split by workload. A noisy snapshot loop
 * must not consume the budget needed to save a user's explicit mutation, while
 * administrative retention work receives a much smaller independent budget.
 */
export const SYNC_RATE_LIMIT_POLICIES = {
  read: { scope: "sync.read", limit: 120, windowSeconds: 5 * 60 },
  write: { scope: "sync.write", limit: 60, windowSeconds: 5 * 60 },
  adminStatusRead: { scope: "sync.admin-retention-status", limit: 30, windowSeconds: 5 * 60 },
  adminSweep: { scope: "sync.admin-retention-sweep", limit: 4, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitPolicyV1>;

export type SyncRateLimitScope = keyof typeof SYNC_RATE_LIMIT_POLICIES;

export interface SyncRateLimiter {
  consume(scope: SyncRateLimitScope, trustedUserId: string): Promise<void>;
}

class FirestoreSyncRateLimiter implements SyncRateLimiter {
  async consume(scope: SyncRateLimitScope, trustedUserId: string): Promise<void> {
    const mode = getOptionalEnv("SYNC_RATE_LIMIT_MODE")
      ?? (process.env.NODE_ENV === "production" ? "required" : "disabled");
    if (mode === "disabled") return;
    if (mode !== "required") {
      throw new ApiHttpError(500, "INVALID_SYNC_CONFIG", "SYNC_RATE_LIMIT_MODE must be required or disabled.");
    }
    await consumeRateLimitV1({ policy: SYNC_RATE_LIMIT_POLICIES[scope], trustedSubject: trustedUserId });
  }
}

let rateLimiter: SyncRateLimiter = new FirestoreSyncRateLimiter();

/** The subject must come from the verified server principal, never the body. */
export async function consumeSyncRateLimit(scope: SyncRateLimitScope, trustedUserId: string): Promise<void> {
  await rateLimiter.consume(scope, trustedUserId);
}

export function setSyncRateLimiterForTests(next: SyncRateLimiter | null): void {
  rateLimiter = next ?? new FirestoreSyncRateLimiter();
}
