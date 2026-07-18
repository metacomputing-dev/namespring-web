import type { GetAuthLifecycleJobRequestV1 } from "../../../shared/types/auth.js";
import { getAuthAccountRepository } from "../../_lib/auth-accounts-repository.js";
import {
  AUTH_LIFECYCLE_ADMIN_BODY_MAX_BYTES_V1,
  AuthLifecycleAdminServiceV1,
  parseGetAuthLifecycleJobRequestV1,
} from "../../_lib/auth-lifecycle-admin.js";
import {
  assertAuthMethod,
  assertTrustedMutationRequest,
  handleAuthApiError,
  sendAuthJson,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../../_lib/auth-http.js";
import { requireAuthenticatedRole } from "../../_lib/auth-principal.js";
import { consumeAuthRateLimit } from "../../_lib/auth-rate-limit.js";
import { readJsonBody } from "../../_lib/http.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const operator = await requireAuthenticatedRole(req, "admin");
    await consumeAuthRateLimit("adminLifecycleRead", operator.userId);
    const request = parseGetAuthLifecycleJobRequestV1(
      await readJsonBody<GetAuthLifecycleJobRequestV1>(req, {
        maxBytes: AUTH_LIFECYCLE_ADMIN_BODY_MAX_BYTES_V1,
      }),
    );
    const service = new AuthLifecycleAdminServiceV1(getAuthAccountRepository());
    return sendAuthJson(res, 200, await service.get(operator.userId, request));
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
