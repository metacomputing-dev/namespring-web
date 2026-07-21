import { createHmac, timingSafeEqual } from "node:crypto";
import {
  AUTH_LIFECYCLE_JOB_DETAIL_SCHEMA_V1,
  AUTH_LIFECYCLE_JOB_LIST_SCHEMA_V1,
  type AuthLifecycleJobAdminViewV1,
  type AuthLifecycleJobKindV1,
  type AuthLifecycleJobStatusV1,
  type GetAuthLifecycleJobRequestV1,
  type GetAuthLifecycleJobResponseV1,
  type ListAuthLifecycleJobsRequestV1,
  type ListAuthLifecycleJobsResponseV1,
} from "../../shared/types/auth.js";
import type {
  AuthAccountRepository,
  AuthLifecycleJobListPositionV1,
} from "./auth-accounts-repository.js";
import { getAuthAuditHmacKeyV1 } from "./auth-audit-privacy.js";
import { ApiHttpError } from "./http.js";

export const AUTH_LIFECYCLE_ADMIN_BODY_MAX_BYTES_V1 = 8 * 1024;
export const AUTH_LIFECYCLE_ADMIN_RESPONSE_MAX_BYTES_V1 = 64 * 1024;
export const AUTH_LIFECYCLE_ADMIN_LIST_MAX_ITEMS_V1 = 20;

const CURSOR_PREFIX_V1 = "alc1";
const CURSOR_MAX_CHARS_V1 = 2_048;
const CURSOR_PAYLOAD_MAX_BYTES_V1 = 1_024;
const DELETION_REQUEST_ID_V1 = /^deletion_request_v1_[a-f0-9]{32}$/u;
const UNLINK_REQUEST_ID_V1 = /^provider_unlink_v1_[a-f0-9]{32}$/u;
const FAILURE_CODE_V1 = /^[A-Za-z0-9_/-]{1,80}$/u;

interface AuthLifecycleCursorPayloadV1 {
  readonly version: 1;
  readonly snapshotAt: string;
  readonly kind: AuthLifecycleJobKindV1 | null;
  readonly status: AuthLifecycleJobStatusV1 | null;
  readonly requestedAt: string;
  readonly requestId: string;
}

export interface AuthLifecycleAdminClockV1 {
  now(): Date;
}

const systemClock: AuthLifecycleAdminClockV1 = { now: () => new Date() };

function fail(code: string, message: string, statusCode = 400): never {
  throw new ApiHttpError(statusCode, code, message);
}

function requirePlainObject(value: unknown, field = "request"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail("INVALID_AUTH_LIFECYCLE_REQUEST", `${field} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  object: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(object).some((key) => !allowedSet.has(key))
    || required.some((key) => !(key in object))) {
    fail("INVALID_AUTH_LIFECYCLE_REQUEST", "Auth lifecycle request fields are invalid.");
  }
}

function isCanonicalIso(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function requestIdMatchesKind(kind: AuthLifecycleJobKindV1, requestId: string): boolean {
  return kind === "account_deletion"
    ? DELETION_REQUEST_ID_V1.test(requestId)
    : UNLINK_REQUEST_ID_V1.test(requestId);
}

function requireKind(value: unknown): AuthLifecycleJobKindV1 {
  if (value !== "account_deletion" && value !== "provider_unlink") {
    fail("INVALID_AUTH_LIFECYCLE_REQUEST", "kind is unsupported.");
  }
  return value;
}

function requireStatus(value: unknown): AuthLifecycleJobStatusV1 {
  if (value !== "pending" && value !== "completed") {
    fail("INVALID_AUTH_LIFECYCLE_REQUEST", "status is unsupported.");
  }
  return value;
}

export function parseListAuthLifecycleJobsRequestV1(value: unknown): Required<Pick<
  ListAuthLifecycleJobsRequestV1,
  "limit"
>> & Omit<ListAuthLifecycleJobsRequestV1, "limit"> {
  const object = requirePlainObject(value);
  requireExactKeys(object, ["kind", "status", "limit", "cursor"], []);
  const limit = object.limit === undefined ? AUTH_LIFECYCLE_ADMIN_LIST_MAX_ITEMS_V1 : object.limit;
  if (typeof limit !== "number" || !Number.isSafeInteger(limit)
    || limit < 1 || limit > AUTH_LIFECYCLE_ADMIN_LIST_MAX_ITEMS_V1) {
    fail("INVALID_AUTH_LIFECYCLE_REQUEST", "limit must be an integer from 1 to 20.");
  }
  let cursor: string | undefined;
  if (object.cursor !== undefined) {
    if (typeof object.cursor !== "string" || object.cursor.length < 10
      || object.cursor.length > CURSOR_MAX_CHARS_V1
      || !/^[A-Za-z0-9_.-]+$/u.test(object.cursor)) {
      fail("INVALID_AUTH_LIFECYCLE_CURSOR", "cursor is invalid.");
    }
    cursor = object.cursor;
  }
  return {
    ...(object.kind === undefined ? {} : { kind: requireKind(object.kind) }),
    ...(object.status === undefined ? {} : { status: requireStatus(object.status) }),
    limit,
    ...(cursor ? { cursor } : {}),
  };
}

export function parseGetAuthLifecycleJobRequestV1(value: unknown): GetAuthLifecycleJobRequestV1 {
  const object = requirePlainObject(value);
  requireExactKeys(object, ["kind", "requestId"], ["kind", "requestId"]);
  const kind = requireKind(object.kind);
  if (typeof object.requestId !== "string" || !requestIdMatchesKind(kind, object.requestId)) {
    fail("INVALID_AUTH_LIFECYCLE_REQUEST", "requestId does not match kind.");
  }
  return { kind, requestId: object.requestId };
}

function cursorSigningKey(rootKey: string): Buffer {
  return createHmac("sha256", rootKey)
    .update("namespring.auth.lifecycle-admin.cursor-signing.v1", "utf8")
    .digest();
}

function cursorSignature(payload: string, rootKey: string): string {
  return createHmac("sha256", cursorSigningKey(rootKey))
    .update(`${CURSOR_PREFIX_V1}.${payload}`, "utf8")
    .digest("base64url");
}

function encodeCursor(
  payload: AuthLifecycleCursorPayloadV1,
  rootKey: string,
): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${CURSOR_PREFIX_V1}.${encoded}.${cursorSignature(encoded, rootKey)}`;
}

function decodeCursor(
  token: string,
  request: Pick<ListAuthLifecycleJobsRequestV1, "kind" | "status">,
  rootKey: string,
): AuthLifecycleCursorPayloadV1 {
  const segments = token.split(".");
  if (segments.length !== 3 || segments[0] !== CURSOR_PREFIX_V1) {
    fail("INVALID_AUTH_LIFECYCLE_CURSOR", "cursor is invalid.");
  }
  const [, encoded, suppliedSignature] = segments;
  if (!encoded || !suppliedSignature || suppliedSignature.length !== 43) {
    fail("INVALID_AUTH_LIFECYCLE_CURSOR", "cursor is invalid.");
  }
  const expectedSignature = cursorSignature(encoded, rootKey);
  const left = Buffer.from(suppliedSignature, "utf8");
  const right = Buffer.from(expectedSignature, "utf8");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    fail("INVALID_AUTH_LIFECYCLE_CURSOR", "cursor signature is invalid.");
  }
  let decoded: Buffer;
  let value: unknown;
  try {
    decoded = Buffer.from(encoded, "base64url");
    if (decoded.toString("base64url") !== encoded || decoded.length > CURSOR_PAYLOAD_MAX_BYTES_V1) throw new Error();
    value = JSON.parse(decoded.toString("utf8"));
  } catch {
    fail("INVALID_AUTH_LIFECYCLE_CURSOR", "cursor payload is invalid.");
  }
  const object = requirePlainObject(value, "cursor");
  const keys = ["version", "snapshotAt", "kind", "status", "requestedAt", "requestId"];
  if (Object.keys(object).length !== keys.length || keys.some((key) => !(key in object))) {
    fail("INVALID_AUTH_LIFECYCLE_CURSOR", "cursor payload fields are invalid.");
  }
  const kind = object.kind === null ? null : requireKind(object.kind);
  const status = object.status === null ? null : requireStatus(object.status);
  const requestId = object.requestId;
  if (object.version !== 1 || !isCanonicalIso(object.snapshotAt) || !isCanonicalIso(object.requestedAt)
    || typeof requestId !== "string"
    || (!DELETION_REQUEST_ID_V1.test(requestId) && !UNLINK_REQUEST_ID_V1.test(requestId))
    || object.requestedAt > object.snapshotAt
    || kind !== (request.kind ?? null) || status !== (request.status ?? null)
    || (kind !== null && !requestIdMatchesKind(kind, requestId))) {
    fail("INVALID_AUTH_LIFECYCLE_CURSOR", "cursor does not match this query.");
  }
  return {
    version: 1,
    snapshotAt: object.snapshotAt,
    kind,
    status,
    requestedAt: object.requestedAt,
    requestId,
  };
}

function copyMetadataOnlyView(value: AuthLifecycleJobAdminViewV1): AuthLifecycleJobAdminViewV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("AUTH_LIFECYCLE_METADATA_INVALID", "Stored lifecycle metadata is invalid.", 503);
  }
  const kind = value.kind;
  const status = value.status;
  const requestId = value.requestId;
  const validStage = kind === "account_deletion"
    ? (status === "pending" ? value.stage === "cleanup_pending" : value.stage === "completed")
    : (status === "pending"
        ? ["reserved", "firebase_unlinked", "sessions_revoked"].includes(value.stage)
        : value.stage === "completed");
  const nullableTimes = [value.nextAttemptAt, value.claimUntil, value.deleteAfter];
  const hasFailureCodeArray = Array.isArray(value.failureCodes);
  const failureCodes = hasFailureCodeArray ? [...new Set(value.failureCodes)] : [];
  if ((kind !== "account_deletion" && kind !== "provider_unlink")
    || (status !== "pending" && status !== "completed")
    || typeof requestId !== "string" || !requestIdMatchesKind(kind, requestId)
    || !validStage || !Number.isSafeInteger(value.attemptCount)
    || value.attemptCount < 0 || value.attemptCount > 10_000
    || !isCanonicalIso(value.requestedAt) || !isCanonicalIso(value.updatedAt)
    || value.updatedAt < value.requestedAt
    || nullableTimes.some((time) => time !== null && !isCanonicalIso(time))
    || (status === "pending" && (value.nextAttemptAt === null || value.deleteAfter !== null))
    || (status === "completed" && (value.nextAttemptAt !== null || value.claimUntil !== null || value.deleteAfter === null))
    || !hasFailureCodeArray || failureCodes.length > 20
    || failureCodes.some((code) => !FAILURE_CODE_V1.test(code))) {
    fail("AUTH_LIFECYCLE_METADATA_INVALID", "Stored lifecycle metadata is invalid.", 503);
  }
  return {
    requestId,
    kind,
    status,
    stage: value.stage,
    attemptCount: value.attemptCount,
    requestedAt: value.requestedAt,
    updatedAt: value.updatedAt,
    nextAttemptAt: value.nextAttemptAt,
    claimUntil: value.claimUntil,
    deleteAfter: value.deleteAfter,
    failureCodes,
  };
}

function assertBoundedResponse(value: unknown): void {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > AUTH_LIFECYCLE_ADMIN_RESPONSE_MAX_BYTES_V1) {
    fail("AUTH_LIFECYCLE_RESPONSE_TOO_LARGE", "Lifecycle metadata exceeds the bounded response contract.", 503);
  }
}

export class AuthLifecycleAdminServiceV1 {
  public constructor(
    private readonly repository: AuthAccountRepository,
    private readonly clock: AuthLifecycleAdminClockV1 = systemClock,
    private readonly cursorRootKey: () => string = getAuthAuditHmacKeyV1,
  ) {}

  public async list(
    actorUserId: string,
    request: ReturnType<typeof parseListAuthLifecycleJobsRequestV1>,
  ): Promise<ListAuthLifecycleJobsResponseV1> {
    const cursor = request.cursor
      ? decodeCursor(request.cursor, request, this.cursorRootKey())
      : null;
    const snapshotAt = cursor?.snapshotAt ?? this.clock.now().toISOString();
    if (!isCanonicalIso(snapshotAt)) {
      fail("AUTH_LIFECYCLE_CLOCK_INVALID", "Lifecycle discovery clock is invalid.", 500);
    }
    const page = await this.repository.listAuthLifecycleJobMetadata({
      ...(request.kind ? { kind: request.kind } : {}),
      ...(request.status ? { status: request.status } : {}),
      snapshotAt,
      ...(cursor ? { after: { requestedAt: cursor.requestedAt, requestId: cursor.requestId } } : {}),
      limit: request.limit,
    });
    const jobs = page.jobs.map(copyMetadataOnlyView);
    if (jobs.length > request.limit
      || jobs.some((job) => job.requestedAt > snapshotAt
        || (request.kind !== undefined && job.kind !== request.kind)
        || (request.status !== undefined && job.status !== request.status))) {
      fail("AUTH_LIFECYCLE_METADATA_INVALID", "Lifecycle repository returned an invalid page.", 503);
    }
    let nextCursor: string | null = null;
    if (page.nextPosition) {
      const last = jobs.at(-1);
      if (!last || page.nextPosition.requestedAt !== last.requestedAt
        || page.nextPosition.requestId !== last.requestId) {
        fail("AUTH_LIFECYCLE_METADATA_INVALID", "Lifecycle repository returned an invalid cursor position.", 503);
      }
      nextCursor = encodeCursor({
        version: 1,
        snapshotAt,
        kind: request.kind ?? null,
        status: request.status ?? null,
        requestedAt: page.nextPosition.requestedAt,
        requestId: page.nextPosition.requestId,
      }, this.cursorRootKey());
    }
    const response: ListAuthLifecycleJobsResponseV1 = {
      schemaVersion: AUTH_LIFECYCLE_JOB_LIST_SCHEMA_V1,
      snapshotAt,
      jobs,
      nextCursor,
    };
    assertBoundedResponse(response);
    await this.repository.recordAuthLifecycleDiscoveryAudit({
      actorUserId,
      operation: "list",
      ...(request.kind ? { kind: request.kind } : {}),
      ...(request.status ? { status: request.status } : {}),
      resultCount: jobs.length,
    });
    return response;
  }

  public async get(
    actorUserId: string,
    request: GetAuthLifecycleJobRequestV1,
  ): Promise<GetAuthLifecycleJobResponseV1> {
    const stored = await this.repository.getAuthLifecycleJobMetadata(request.kind, request.requestId);
    await this.repository.recordAuthLifecycleDiscoveryAudit({
      actorUserId,
      operation: "get",
      kind: request.kind,
      requestId: request.requestId,
      resultCount: stored ? 1 : 0,
    });
    if (!stored) {
      fail("AUTH_LIFECYCLE_JOB_NOT_FOUND", "Auth lifecycle job was not found.", 404);
    }
    const job = copyMetadataOnlyView(stored);
    if (job.kind !== request.kind || job.requestId !== request.requestId) {
      fail("AUTH_LIFECYCLE_METADATA_INVALID", "Lifecycle repository returned the wrong job.", 503);
    }
    const response: GetAuthLifecycleJobResponseV1 = {
      schemaVersion: AUTH_LIFECYCLE_JOB_DETAIL_SCHEMA_V1,
      job,
    };
    assertBoundedResponse(response);
    return response;
  }
}
