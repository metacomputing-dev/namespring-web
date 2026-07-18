import { randomBytes, timingSafeEqual } from "node:crypto";
import type { CsrfTokenResponse } from "../../shared/types/auth.js";
import { getOptionalEnv } from "./env.js";
import { ApiHttpError } from "./http.js";

export const SESSION_COOKIE_NAME = "__Host-namespring_session";
export const CSRF_COOKIE_NAME = "__Host-namespring_csrf";
export const AUTH_SESSION_BODY_MAX_BYTES_V1 = 20 * 1024;
export const AUTH_LINK_BODY_MAX_BYTES_V1 = 36 * 1024;
export const AUTH_UNLINK_BODY_MAX_BYTES_V1 = 20 * 1024;
export const AUTH_DELETE_BODY_MAX_BYTES_V1 = 20 * 1024;
export const AUTH_REVOKE_BODY_MAX_BYTES_V1 = 20 * 1024;

export function assertExactAuthJsonObjectV1(
  value: unknown,
  allowedKeys: readonly string[],
  errorCode: string,
): asserts value is Record<string, unknown> {
  if (!/^[A-Z][A-Z0-9_]{2,63}$/u.test(errorCode)
    || !Array.isArray(allowedKeys)
    || allowedKeys.length < 1
    || new Set(allowedKeys).size !== allowedKeys.length) {
    throw new ApiHttpError(500, "AUTH_BODY_POLICY_INVALID", "Authentication request-body policy is invalid.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiHttpError(400, errorCode, "Authentication request body must be a JSON object.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ApiHttpError(400, errorCode, "Authentication request body must be a plain JSON object.");
  }
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new ApiHttpError(400, errorCode, "Authentication request contains unknown fields.");
  }
}

export type AuthRequestLike = Request | {
  method?: string;
  headers?: Headers | Record<string, unknown>;
  body?: unknown;
  [key: string]: unknown;
};

export interface AuthNodeResponseLike {
  setHeader?: (name: string, value: string | readonly string[]) => void;
  status: (code: number) => { json: (payload: unknown) => void };
}

export function assertAuthMethod(req: Pick<AuthRequestLike, "method">, allowed: readonly string[]): void {
  const method = (req.method ?? "GET").toUpperCase();
  if (!allowed.includes(method)) {
    throw new ApiHttpError(405, "METHOD_NOT_ALLOWED", `Allowed methods: ${allowed.join(", ")}.`);
  }
}

export function getHeaderValue(req: Pick<AuthRequestLike, "headers">, name: string): string | null {
  const headers = req.headers;
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") {
    const value = (headers as Headers).get(name);
    return value?.trim() || null;
  }
  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()] ?? record[name.toUpperCase()];
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const strings = value.filter((entry): entry is string => typeof entry === "string");
    return strings.length ? strings.join(", ").trim() || null : null;
  }
  return null;
}

function parseCookies(raw: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!raw) return cookies;
  for (const segment of raw.split(";")) {
    const separator = segment.indexOf("=");
    if (separator <= 0) continue;
    const name = segment.slice(0, separator).trim();
    const value = segment.slice(separator + 1).trim();
    if (!name) continue;
    if (cookies.has(name)) {
      throw new ApiHttpError(400, "DUPLICATE_COOKIE", `Duplicate ${name} cookie is not allowed.`);
    }
    cookies.set(name, value);
  }
  return cookies;
}

export function getCookieValue(req: Pick<AuthRequestLike, "headers">, name: string): string | null {
  return parseCookies(getHeaderValue(req, "cookie")).get(name) ?? null;
}

function normalizedOrigin(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function allowedOrigins(): ReadonlySet<string> {
  const configured = [
    ...(getOptionalEnv("AUTH_ALLOWED_ORIGINS") ?? "").split(","),
    getOptionalEnv("PUBLIC_APP_ORIGIN") ?? "",
    getOptionalEnv("VERCEL_URL") ? `https://${getOptionalEnv("VERCEL_URL")}` : "",
  ];
  if (process.env.NODE_ENV !== "production") {
    configured.push("http://localhost:5173", "http://127.0.0.1:5173");
  }
  return new Set(configured.map((entry) => normalizedOrigin(entry.trim())).filter((entry): entry is string => !!entry));
}

export function assertTrustedOrigin(req: Pick<AuthRequestLike, "headers">): void {
  const raw = getHeaderValue(req, "origin");
  const origin = raw ? normalizedOrigin(raw) : null;
  if (!origin || !allowedOrigins().has(origin)) {
    throw new ApiHttpError(403, "UNTRUSTED_ORIGIN", "Request origin is not allowed.");
  }
}

function validCsrfToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

function constantTimeEquals(left: string, right: string): boolean {
  if (!validCsrfToken(left) || !validCsrfToken(right)) return false;
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function assertCsrfToken(req: Pick<AuthRequestLike, "headers">): void {
  const cookie = getCookieValue(req, CSRF_COOKIE_NAME);
  const header = getHeaderValue(req, "x-csrf-token");
  if (!cookie || !header || !constantTimeEquals(cookie, header)) {
    throw new ApiHttpError(403, "CSRF_VALIDATION_FAILED", "CSRF validation failed.");
  }
}

/** Required before every browser-originating state mutation. */
export function assertTrustedMutationRequest(req: Pick<AuthRequestLike, "headers">): void {
  assertTrustedOrigin(req);
  assertCsrfToken(req);
}

function cookie(attributes: readonly string[]): string {
  return attributes.join("; ");
}

export function createSessionCookie(value: string, maxAgeSeconds: number): string {
  return cookie([
    `${SESSION_COOKIE_NAME}=${value}`,
    "Path=/",
    `Max-Age=${Math.max(1, Math.floor(maxAgeSeconds))}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ]);
}

export function clearSessionCookie(): string {
  return cookie([`${SESSION_COOKIE_NAME}=`, "Path=/", "Max-Age=0", "HttpOnly", "Secure", "SameSite=Lax"]);
}

export function issueCsrfToken(ttlSeconds = 3600): { response: CsrfTokenResponse; cookie: string } {
  const csrfToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  return {
    response: { csrfToken, expiresAt },
    cookie: cookie([
      `${CSRF_COOKIE_NAME}=${csrfToken}`,
      "Path=/",
      `Max-Age=${Math.max(1, Math.floor(ttlSeconds))}`,
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
    ]),
  };
}

export function clearCsrfCookie(): string {
  return cookie([`${CSRF_COOKIE_NAME}=`, "Path=/", "Max-Age=0", "HttpOnly", "Secure", "SameSite=Strict"]);
}

export function sendAuthJson(
  res: AuthNodeResponseLike | undefined,
  statusCode: number,
  payload: unknown,
  setCookies: readonly string[] = [],
): Response | void {
  if (res && typeof res.status === "function") {
    res.setHeader?.("Cache-Control", "no-store, max-age=0");
    res.setHeader?.("Pragma", "no-cache");
    res.setHeader?.("X-Content-Type-Options", "nosniff");
    res.setHeader?.("Referrer-Policy", "no-referrer");
    res.setHeader?.("Vary", "Origin, Cookie");
    if (setCookies.length) res.setHeader?.("Set-Cookie", setCookies);
    res.status(statusCode).json(payload);
    return;
  }
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin, Cookie",
  });
  for (const value of setCookies) headers.append("Set-Cookie", value);
  return new Response(JSON.stringify(payload), { status: statusCode, headers });
}

export function handleAuthApiError(
  res: AuthNodeResponseLike | undefined,
  error: unknown,
  clearInvalidSession = false,
): Response | void {
  const cookies = clearInvalidSession ? [clearSessionCookie(), clearCsrfCookie()] : [];
  if (error instanceof ApiHttpError) {
    return sendAuthJson(res, error.statusCode, { error: { code: error.code, message: error.message } }, cookies);
  }
  // Authentication endpoints never reflect internal exception messages.
  return sendAuthJson(
    res,
    500,
    { error: { code: "AUTH_INTERNAL_ERROR", message: "Authentication service is temporarily unavailable." } },
    cookies,
  );
}
