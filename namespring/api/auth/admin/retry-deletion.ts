import type { DeleteAccountResponse } from "../../../shared/types/auth.js";
import { getAuthAccountRepository } from "../../_lib/auth-accounts-repository.js";
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
import { ApiHttpError, readJsonBody } from "../../_lib/http.js";
import { processAccountDeletionJobV1 } from "../../_lib/auth-maintenance.js";

interface RetryDeletionRequest {
  deletionRequestId: string;
}

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const operator = await requireAuthenticatedRole(req, "admin");
    await consumeAuthRateLimit("adminDeletionRetry", operator.sessionId);
    const body = await readJsonBody<RetryDeletionRequest>(req);
    if (!body || typeof body !== "object" || Array.isArray(body)
      || (Object.getPrototypeOf(body) !== Object.prototype && Object.getPrototypeOf(body) !== null)
      || Object.keys(body).some((key) => key !== "deletionRequestId")) {
      throw new ApiHttpError(400, "INVALID_DELETION_RETRY_REQUEST", "Deletion retry request fields are invalid.");
    }
    if (typeof body?.deletionRequestId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(body.deletionRequestId)) {
      throw new ApiHttpError(400, "INVALID_DELETION_REQUEST_ID", "A valid deletionRequestId is required.");
    }
    const repository = getAuthAccountRepository();
    const job = await repository.getAccountDeletionJob(body.deletionRequestId);
    if (!job) {
      throw new ApiHttpError(404, "DELETION_JOB_NOT_FOUND", "Account deletion job was not found.");
    }
    if (job.status === "completed") {
      const completed: DeleteAccountResponse = {
        status: "deleted",
        deletionRequestId: job.deletionRequestId,
        cleanupPending: false,
        deletedAt: job.updatedAt,
      };
      return sendAuthJson(res, 200, completed);
    }
    const finalization = await processAccountDeletionJobV1({
      deletionRequestId: job.deletionRequestId,
      recordedByUserId: operator.userId,
      force: true,
    });
    if (finalization.status === "deletion_pending") {
      const pending: DeleteAccountResponse = {
        status: "deletion_pending",
        deletionRequestId: job.deletionRequestId,
        cleanupPending: true,
        deletedAt: null,
      };
      return sendAuthJson(res, 202, pending);
    }
    const account = finalization.account;
    const completed: DeleteAccountResponse = {
      status: "deleted",
      deletionRequestId: job.deletionRequestId,
      cleanupPending: false,
      deletedAt: account.deletedAt,
    };
    return sendAuthJson(res, 200, completed);
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
