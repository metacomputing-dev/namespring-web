import type { ApplySyncDeltaRequestV1 } from "../../../shared/types/sync-contract.js";
import { assertAuthMethod, assertTrustedMutationRequest, sendAuthJson, type AuthNodeResponseLike, type AuthRequestLike } from "../../_lib/auth-http.js";
import { resolveAuthenticatedPrincipal } from "../../_lib/auth-principal.js";
import { readJsonBody } from "../../_lib/http.js";
import { handleSyncApiError } from "../../_lib/sync-http.js";
import { consumeSyncRateLimit } from "../../_lib/sync-rate-limit.js";
import { getAccountSyncService } from "../../_lib/sync-runtime.js";
import { parseApplySyncDeltaRequest } from "../../_lib/sync-validation.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const actor = await resolveAuthenticatedPrincipal(req);
    await consumeSyncRateLimit("write", actor.userId);
    const request = parseApplySyncDeltaRequest(await readJsonBody<ApplySyncDeltaRequestV1>(req));
    return sendAuthJson(res, 200, await getAccountSyncService().applyDelta(actor, request));
  } catch (error) {
    return handleSyncApiError(res, error);
  }
}
