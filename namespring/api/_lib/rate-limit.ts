import { createHmac, timingSafeEqual } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";

import { getRequiredEnv } from "./env.js";
import { getFirestoreDb } from "./firestore-admin.js";
import { ApiHttpError } from "./http.js";
import { assertServerSecretSeparationV1 } from "./server-secret-separation.js";

const RATE_LIMIT_COLLECTION = "server_rate_limits_v1";
const SCOPE_PATTERN = /^[a-z][a-z0-9_.-]{2,63}$/u;
const MAX_TRUSTED_SUBJECT_LENGTH = 1_024;

export interface RateLimitPolicyV1 {
  readonly scope: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateLimitStateV1 {
  readonly schemaVersion: "namespring.rate-limit-state.v1";
  readonly windowStartedAtMs: number;
  readonly count: number;
}

export interface RateLimitDecisionV1 {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: string;
  readonly nextState: RateLimitStateV1;
}

function assertPolicy(policy: RateLimitPolicyV1): void {
  if (!SCOPE_PATTERN.test(policy.scope)
    || !Number.isSafeInteger(policy.limit)
    || policy.limit < 1
    || policy.limit > 10_000
    || !Number.isSafeInteger(policy.windowSeconds)
    || policy.windowSeconds < 1
    || policy.windowSeconds > 86_400) {
    throw new ApiHttpError(500, "INVALID_RATE_LIMIT_POLICY", "Server rate limit policy is invalid.");
  }
}

function isStoredState(value: unknown): value is RateLimitStateV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const state = value as Partial<RateLimitStateV1>;
  return state.schemaVersion === "namespring.rate-limit-state.v1"
    && Number.isSafeInteger(state.windowStartedAtMs)
    && Number(state.windowStartedAtMs) >= 0
    && Number.isSafeInteger(state.count)
    && Number(state.count) >= 0;
}

export function evaluateRateLimitWindowV1(
  current: RateLimitStateV1 | null,
  policy: RateLimitPolicyV1,
  nowMs: number,
): RateLimitDecisionV1 {
  assertPolicy(policy);
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new ApiHttpError(500, "INVALID_SERVER_TIME", "Server time is invalid.");
  }

  const windowMs = policy.windowSeconds * 1_000;
  const active = current !== null
    && isStoredState(current)
    && current.windowStartedAtMs <= nowMs
    && nowMs - current.windowStartedAtMs < windowMs;
  const windowStartedAtMs = active ? current.windowStartedAtMs : nowMs;
  const priorCount = active ? current.count : 0;
  const allowed = priorCount < policy.limit;
  const count = allowed ? priorCount + 1 : priorCount;
  const nextState: RateLimitStateV1 = {
    schemaVersion: "namespring.rate-limit-state.v1",
    windowStartedAtMs,
    count,
  };

  return {
    allowed,
    remaining: Math.max(0, policy.limit - count),
    resetAt: new Date(windowStartedAtMs + windowMs).toISOString(),
    nextState,
  };
}

export function createRateLimitKeyV1(scope: string, trustedSubject: string): string {
  assertPolicy({ scope, limit: 1, windowSeconds: 1 });
  if (typeof trustedSubject !== "string"
    || trustedSubject.length < 1
    || trustedSubject.length > MAX_TRUSTED_SUBJECT_LENGTH) {
    throw new ApiHttpError(500, "INVALID_RATE_LIMIT_SUBJECT", "Trusted rate limit subject is invalid.");
  }
  const secret = getRequiredEnv("RATE_LIMIT_HMAC_KEY");
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new ApiHttpError(500, "WEAK_RATE_LIMIT_HMAC_KEY", "RATE_LIMIT_HMAC_KEY must be at least 32 bytes.");
  }
  assertServerSecretSeparationV1("rate_limit", [secret], "RATE_LIMIT_KEY_REUSE");
  const digest = createHmac("sha256", secret)
    .update("namespring.rate-limit.v1\0", "utf8")
    .update(scope, "utf8")
    .update("\0", "utf8")
    .update(trustedSubject, "utf8")
    .digest("hex");
  return `${scope}.${digest}`;
}

export async function consumeRateLimitV1(input: {
  readonly policy: RateLimitPolicyV1;
  /** A server-trusted UID/session/IP fingerprint source; never a request body claim. */
  readonly trustedSubject: string;
  readonly now?: Date;
}): Promise<Omit<RateLimitDecisionV1, "nextState">> {
  assertPolicy(input.policy);
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new ApiHttpError(500, "INVALID_SERVER_TIME", "Server time is invalid.");
  }
  const key = createRateLimitKeyV1(input.policy.scope, input.trustedSubject);
  const db = getFirestoreDb();
  const ref = db.collection(RATE_LIMIT_COLLECTION).doc(key);
  const decision = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const raw = snapshot.exists ? snapshot.data() : undefined;
    let current: RateLimitStateV1 | null = null;
    if (raw !== undefined) {
      if (!isStoredState(raw)) {
        throw new ApiHttpError(500, "RATE_LIMIT_STATE_CORRUPT", "Stored rate limit state is invalid.");
      }
      current = raw;
    }
    const evaluated = evaluateRateLimitWindowV1(current, input.policy, nowMs);
    transaction.set(ref, {
      ...evaluated.nextState,
      scope: input.policy.scope,
      expiresAt: Timestamp.fromMillis(Date.parse(evaluated.resetAt) + 86_400_000),
    }, { merge: false });
    return evaluated;
  });

  if (!decision.allowed) {
    throw new ApiHttpError(429, "RATE_LIMITED", "Too many requests. Try again later.", {
      resetAt: decision.resetAt,
    });
  }
  return {
    allowed: true,
    remaining: decision.remaining,
    resetAt: decision.resetAt,
  };
}

/** Constant-time helper for future signed webhook/rate-limit tokens. */
export function safeEqualUtf8V1(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.byteLength === rightBytes.byteLength
    && timingSafeEqual(leftBytes, rightBytes);
}
