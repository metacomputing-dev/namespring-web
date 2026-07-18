import { PremiumContractValidationErrorV1 } from "../../../lib/spring-ts/src/report/premium/index.js";
import type { PremiumActorV1 } from "../../shared/types/premium-service.js";
import {
  assertTrustedMutationRequest,
  type AuthRequestLike,
} from "./auth-http.js";
import { resolveAuthenticatedPrincipal } from "./auth-principal.js";
import { consumeRateLimitV1, type RateLimitPolicyV1 } from "./rate-limit.js";
import {
  ApiHttpError,
  readJsonBody,
  sendJson,
  type NodeStyleResponseLike,
} from "./http.js";

export type PremiumRequestLike = AuthRequestLike;

export function assertPremiumMethod(req: Pick<PremiumRequestLike, "method">, allowed: readonly string[]): void {
  const method = (req.method ?? "GET").toUpperCase();
  if (!allowed.includes(method)) {
    throw new ApiHttpError(405, "METHOD_NOT_ALLOWED", `Allowed methods: ${allowed.join(", ")}.`);
  }
}

export async function resolvePremiumActorV1(req: Pick<PremiumRequestLike, "headers">): Promise<PremiumActorV1> {
  const principal = await resolveAuthenticatedPrincipal(req);
  return { userId: principal.userId, sessionId: principal.sessionId, roles: [...principal.roles] };
}

export async function readPremiumJsonBodyV1<T>(req: PremiumRequestLike, maxBytes = 64 * 1024): Promise<T> {
  const value = await readJsonBody<T>(req, { maxBytes });
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new ApiHttpError(400, "PREMIUM_REQUEST_INVALID", "Request must be JSON serializable.");
  }
  if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
    throw new ApiHttpError(413, "PREMIUM_REQUEST_TOO_LARGE", "Premium request exceeds its byte budget.");
  }
  return value;
}

export function assertPlainBody(value: unknown, allowedKeys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new ApiHttpError(400, "PREMIUM_REQUEST_INVALID", "Request body must be a plain object.");
  }
  const unknown = Object.keys(value).find((key) => !allowedKeys.includes(key));
  if (unknown) throw new ApiHttpError(400, "PREMIUM_REQUEST_INVALID", `Unknown request field ${unknown}.`);
}

export function requirePremiumString(value: unknown, field: string, pattern?: RegExp, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > max
    || (pattern && !pattern.test(value))) {
    throw new ApiHttpError(400, "PREMIUM_REQUEST_INVALID", `${field} is invalid.`);
  }
  return value;
}

export function requirePremiumAmount(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new ApiHttpError(400, "PREMIUM_REQUEST_INVALID", "amount must be a positive safe integer.");
  }
  return Number(value);
}

export async function prepareAuthenticatedPremiumMutation(
  req: PremiumRequestLike,
  policy: RateLimitPolicyV1 = { scope: "premium.mutation", limit: 120, windowSeconds: 300 },
): Promise<PremiumActorV1> {
  assertPremiumMethod(req, ["POST"]);
  assertTrustedMutationRequest(req);
  const actor = await resolvePremiumActorV1(req);
  await consumeRateLimitV1({ policy, trustedSubject: actor.userId });
  return actor;
}

/**
 * Administrative routes reject a non-privileged session before parsing a
 * potentially large body. `actor.roles` already contains only roles present
 * in both the persisted account and the current Firebase custom claims.
 * Domain services repeat this check as a defense-in-depth invariant.
 */
export async function preparePremiumAdminMutationV1(
  req: PremiumRequestLike,
  allowedRoles: readonly ("premium_admin" | "premium_system")[],
  policy?: RateLimitPolicyV1,
): Promise<PremiumActorV1> {
  const actor = await prepareAuthenticatedPremiumMutation(req, policy);
  if (!allowedRoles.some((role) => actor.roles.includes(role))) {
    throw new ApiHttpError(403, "PREMIUM_ADMIN_REQUIRED", "Premium administrator role is required.");
  }
  return actor;
}

export function handlePremiumApiErrorV1(res: NodeStyleResponseLike | undefined, error: unknown): Response | void {
  if (error instanceof ApiHttpError) {
    return sendJson(res, error.statusCode, { error: { code: error.code, message: error.message } });
  }
  if (error instanceof PremiumContractValidationErrorV1) {
    return sendJson(res, 400, {
      error: { code: "PREMIUM_CONTRACT_INVALID", message: "Premium request does not satisfy the V1 contract." },
    });
  }
  // Internal exception messages may contain provider/storage details.
  return sendJson(res, 500, {
    error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected premium service error." },
  });
}
