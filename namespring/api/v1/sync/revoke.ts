import type { RevokeSyncConsentRequestV1 } from "../../../shared/types/sync-contract.js";
import { assertAuthMethod, assertTrustedMutationRequest, handleAuthApiError, sendAuthJson, type AuthNodeResponseLike, type AuthRequestLike } from "../../_lib/auth-http.js";
import { resolveAuthenticatedPrincipal } from "../../_lib/auth-principal.js";
import { readJsonBody } from "../../_lib/http.js";
import { consumeSyncRateLimit } from "../../_lib/sync-rate-limit.js";
import { getAccountSyncService } from "../../_lib/sync-runtime.js";
import { parseRevokeSyncConsentRequest } from "../../_lib/sync-validation.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const actor = await resolveAuthenticatedPrincipal(req);
    await consumeSyncRateLimit("write", actor.userId);
    const request = parseRevokeSyncConsentRequest(await readJsonBody<RevokeSyncConsentRequestV1>(req));
    return sendAuthJson(res, 200, await getAccountSyncService().revokeConsent(actor, request));
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
