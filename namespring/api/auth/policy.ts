import type { AuthPolicyResponse } from "../../shared/types/auth.js";
import {
  assertAuthMethod,
  handleAuthApiError,
  sendAuthJson,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../_lib/auth-http.js";
import {
  enabledAuthProviders,
  DISABLED_UNTIL_LIFECYCLE_ADAPTER_PROVIDERS,
  FUTURE_PROVIDERS,
  PRIMARY_SIGN_IN_PROVIDERS,
  PROVIDER_READY_CONTRACT,
  STEP_UP_ONLY_PROVIDERS,
} from "../_lib/auth-policy.js";

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["GET"]);
    const response: AuthPolicyResponse = {
      schemaVersion: "auth-policy.v1",
      freeMode: "local_only_no_account",
      accountRequiredFor: ["sync", "payment"],
      enabledProviders: enabledAuthProviders(),
      providerReadyContract: PROVIDER_READY_CONTRACT,
      primarySignInProviders: PRIMARY_SIGN_IN_PROVIDERS,
      stepUpOnlyProviders: STEP_UP_ONLY_PROVIDERS,
      futureDisabledByDefault: FUTURE_PROVIDERS,
      disabledUntilLifecycleAdapter: DISABLED_UNTIL_LIFECYCLE_ADAPTER_PROVIDERS,
      accountLinking: "explicit_recent_reauthentication",
      emailMatchMerge: false,
      sessionTransport: "secure_http_only_cookie",
    };
    return sendAuthJson(res, 200, response);
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
