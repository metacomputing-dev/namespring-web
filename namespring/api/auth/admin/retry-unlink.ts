import { getAuthAccountRepository } from "../../_lib/auth-accounts-repository.js";
import {
  assertAuthMethod,
  assertTrustedMutationRequest,
  handleAuthApiError,
  sendAuthJson,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../../_lib/auth-http.js";
import { processProviderUnlinkJobV1 } from "../../_lib/auth-maintenance.js";
import { requireAuthenticatedRole } from "../../_lib/auth-principal.js";
import { consumeAuthRateLimit } from "../../_lib/auth-rate-limit.js";
import { ApiHttpError, readJsonBody } from "../../_lib/http.js";

interface RetryProviderUnlinkRequestV1 {
  unlinkRequestId: string;
}

interface RetryProviderUnlinkResponseV1 {
  unlinkRequestId: string;
  unlinkStatus: "pending" | "completed";
  cleanupPending: boolean;
}

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const operator = await requireAuthenticatedRole(req, "admin");
    await consumeAuthRateLimit("adminUnlinkRetry", operator.sessionId);
    const body = await readJsonBody<RetryProviderUnlinkRequestV1>(req);
    if (!body || typeof body !== "object" || Array.isArray(body)
      || (Object.getPrototypeOf(body) !== Object.prototype && Object.getPrototypeOf(body) !== null)
      || Object.keys(body).some((key) => key !== "unlinkRequestId")) {
      throw new ApiHttpError(400, "INVALID_UNLINK_RETRY_REQUEST", "Provider unlink retry request fields are invalid.");
    }
    if (typeof body?.unlinkRequestId !== "string"
      || !/^provider_unlink_v1_[a-f0-9]{32}$/u.test(body.unlinkRequestId)) {
      throw new ApiHttpError(400, "INVALID_UNLINK_REQUEST_ID", "A valid unlinkRequestId is required.");
    }

    const repository = getAuthAccountRepository();
    const job = await repository.getProviderUnlinkJob(body.unlinkRequestId);
    if (!job) {
      throw new ApiHttpError(404, "PROVIDER_UNLINK_JOB_NOT_FOUND", "Provider unlink job was not found.");
    }
    const result = await processProviderUnlinkJobV1({
      unlinkRequestId: job.unlinkRequestId,
      recordedByUserId: operator.userId,
      force: true,
    });
    const response: RetryProviderUnlinkResponseV1 = {
      unlinkRequestId: job.unlinkRequestId,
      unlinkStatus: result.status,
      cleanupPending: result.status === "pending",
    };
    return sendAuthJson(res, result.status === "completed" ? 200 : 202, response);
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
