import type { AuthNodeResponseLike } from "./auth-http.js";
import { sendAuthJson } from "./auth-http.js";
import { handleAuthApiError } from "./auth-http.js";
import { ApiHttpError } from "./http.js";
import { PublicSyncVersionConflictErrorV1 } from "./sync-service.js";

export const SYNC_ADMIN_EMPTY_BODY_MAX_BYTES = 2 * 1024;
export const SYNC_EMPTY_BODY_MAX_BYTES_V1 = 2 * 1024;

export function parseEmptySyncRequestV1(value: unknown): Record<string, never> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    || Object.keys(value).length !== 0) {
    throw new ApiHttpError(400, "INVALID_SYNC_REQUEST", "Sync request must be an empty object.");
  }
  return {};
}

export function parseEmptySyncAdminRequestV1(value: unknown): Record<string, never> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    || Object.keys(value).length !== 0) {
    throw new ApiHttpError(400, "INVALID_SYNC_ADMIN_REQUEST", "Sync admin request must be an empty object.");
  }
  return {};
}

export function handleSyncApiError(res: AuthNodeResponseLike | undefined, error: unknown): Response | void {
  if (error instanceof PublicSyncVersionConflictErrorV1) {
    return sendAuthJson(res, 409, {
      error: {
        code: error.code,
        message: error.message,
        currentVersion: error.serverDocument.version,
      },
      serverDocument: error.serverDocument,
      aadContext: error.aadContext,
    });
  }
  return handleAuthApiError(res, error);
}
