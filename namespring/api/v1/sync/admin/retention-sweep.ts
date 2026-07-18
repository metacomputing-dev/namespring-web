import { assertAuthMethod, assertTrustedMutationRequest, handleAuthApiError, sendAuthJson, type AuthNodeResponseLike, type AuthRequestLike } from "../../../_lib/auth-http.js";
import { requireAuthenticatedRole } from "../../../_lib/auth-principal.js";
import { ApiHttpError, readJsonBody } from "../../../_lib/http.js";
import { consumeSyncRateLimit } from "../../../_lib/sync-rate-limit.js";
import { getAccountSyncService } from "../../../_lib/sync-runtime.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const actor = await requireAuthenticatedRole(req, "admin");
    await consumeSyncRateLimit("adminSweep", actor.userId);
    const body = await readJsonBody<{ limit?: unknown }>(req);
    if (!body || typeof body !== "object" || Array.isArray(body)
      || (Object.getPrototypeOf(body) !== Object.prototype && Object.getPrototypeOf(body) !== null)
      || Object.keys(body).some((key) => key !== "limit")) {
      throw new ApiHttpError(400, "INVALID_RETENTION_REQUEST", "Retention sweep request fields are invalid.");
    }
    const numericLimit = body.limit === undefined ? 50 : body.limit;
    if (typeof numericLimit !== "number" || !Number.isInteger(numericLimit)
      || numericLimit < 1 || numericLimit > 80) {
      throw new ApiHttpError(400, "INVALID_RETENTION_LIMIT", "Retention sweep limit must be 1-80.");
    }
    return sendAuthJson(res, 200, await getAccountSyncService().sweepExpired(actor, numericLimit));
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
