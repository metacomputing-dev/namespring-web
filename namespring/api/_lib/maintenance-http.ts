import { createHash, timingSafeEqual } from "node:crypto";
import { ApiHttpError } from "./http.js";
import type { MaintenanceJobV1 } from "./maintenance-coordinator.js";
import { assertServerSecretSeparationV1 } from "./server-secret-separation.js";

export type MaintenanceRequestLike = Request | {
  readonly method?: string;
  readonly headers?: Headers | Readonly<Record<string, unknown>>;
  readonly body?: unknown;
  readonly url?: string;
};

export interface MaintenanceResponseLike {
  setHeader?: (name: string, value: string | readonly string[]) => void;
  status: (code: number) => { json: (payload: unknown) => void };
}

export interface MaintenanceRunResponseV1 {
  readonly schemaVersion: "namespring.maintenance-run.v1";
  readonly runId: string;
  readonly job: MaintenanceJobV1;
  readonly outcome: "completed" | "partial" | "skipped_locked";
  readonly scanned: number;
  readonly deleted: number;
  readonly skipped: number;
  readonly failed: number;
  readonly hasMore: boolean;
  readonly deadlineReached: boolean;
  readonly durationMs: number;
}

function headerValue(req: MaintenanceRequestLike, name: string): string | null {
  const headers = req.headers;
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }
  const record = headers as Readonly<Record<string, unknown>>;
  const matches = Object.entries(record).filter(([key]) => key.toLowerCase() === name.toLowerCase());
  if (matches.length !== 1) return null;
  const value = matches[0]![1];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === "string") return value[0];
  return null;
}

function hasNonEmptyBody(req: MaintenanceRequestLike): boolean {
  if (req instanceof Request) return req.body !== null;
  const body = req.body;
  if (body === undefined || body === null) return false;
  if (typeof body === "string") return body.length > 0;
  if (body instanceof Uint8Array) return body.byteLength > 0;
  if (Array.isArray(body)) return body.length > 0;
  if (typeof body === "object") return Object.keys(body).length > 0;
  return true;
}

function hasQuery(req: MaintenanceRequestLike): boolean {
  if (!req.url) return false;
  try {
    return new URL(req.url, "https://maintenance.invalid").search.length > 0;
  } catch {
    return true;
  }
}

function configuredCronSecret(): string {
  const secret = process.env.CRON_SECRET;
  const byteLength = secret ? Buffer.byteLength(secret, "utf8") : 0;
  if (!secret || secret.trim() !== secret || /[\u0000-\u001f\u007f]/u.test(secret)
    || secret.includes(",") || byteLength < 32 || byteLength > 512) {
    throw new ApiHttpError(
      503,
      "MAINTENANCE_AUTH_NOT_CONFIGURED",
      "Scheduled maintenance authentication is not configured.",
    );
  }
  assertServerSecretSeparationV1("maintenance_cron", [secret], "MAINTENANCE_SECRET_REUSE");
  return secret;
}

function constantTimeSecretEquals(provided: string, expected: string): boolean {
  // Hashing to a fixed length avoids leaking whether the supplied bearer token
  // happened to have the configured secret's byte length.
  const providedDigest = createHash("sha256").update(provided, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

export function assertMaintenanceCronRequest(
  req: MaintenanceRequestLike,
  res?: Pick<MaintenanceResponseLike, "setHeader">,
): void {
  const method = typeof req.method === "string" ? req.method.toUpperCase() : "";
  if (method !== "GET") {
    res?.setHeader?.("Allow", "GET");
    throw new ApiHttpError(405, "METHOD_NOT_ALLOWED", "Only GET is supported.");
  }
  if (hasQuery(req) || hasNonEmptyBody(req)) {
    throw new ApiHttpError(400, "MAINTENANCE_REQUEST_SHAPE_INVALID", "Maintenance requests cannot include a query or body.");
  }
  const expected = configuredCronSecret();
  const authorization = headerValue(req, "authorization") ?? "";
  const prefix = "Bearer ";
  const provided = authorization.startsWith(prefix) && authorization.indexOf(",") === -1
    ? authorization.slice(prefix.length)
    : "";
  if (!provided || !constantTimeSecretEquals(provided, expected)) {
    throw new ApiHttpError(401, "MAINTENANCE_AUTH_INVALID", "Scheduled maintenance authentication failed.");
  }
}

function responseHeaders(): Readonly<Record<string, string>> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

export function sendMaintenanceJson(
  res: MaintenanceResponseLike | undefined,
  statusCode: number,
  payload: unknown,
): Response | void {
  const headers = responseHeaders();
  if (res) {
    for (const [name, value] of Object.entries(headers)) res.setHeader?.(name, value);
    res.status(statusCode).json(payload);
    return;
  }
  return new Response(JSON.stringify(payload), { status: statusCode, headers });
}

export function handleMaintenanceError(
  res: MaintenanceResponseLike | undefined,
  error: unknown,
): Response | void {
  if (error instanceof ApiHttpError) {
    return sendMaintenanceJson(res, error.statusCode, {
      error: { code: error.code, message: error.message },
    });
  }
  // Never reflect provider, Firestore, job, or secret details from an
  // unattended privileged endpoint.
  return sendMaintenanceJson(res, 500, {
    error: {
      code: "MAINTENANCE_INTERNAL_ERROR",
      message: "Scheduled maintenance did not complete.",
    },
  });
}
