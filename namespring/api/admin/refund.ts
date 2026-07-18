import type {
  PaymentRecord,
  RefundMode,
  RefundRequest,
  RefundResponse,
} from "../../shared/types/payment.js";
import {
  assertAuthMethod,
  assertTrustedMutationRequest,
  handleAuthApiError,
  sendAuthJson,
  type AuthNodeResponseLike,
  type AuthRequestLike,
} from "../_lib/auth-http.js";
import { requireAuthenticatedRole } from "../_lib/auth-principal.js";
import {
  attachRecoveredLegacyPaymentKey,
  beginLegacyRefund,
  completeLegacyNoCapture,
  completeLegacyRefund,
  markLegacyRefundManualRequired,
  markLegacyRefundReconciliationRequired,
  type LegacyProviderIdentity,
} from "../_lib/payments-repository.js";
import { consumeRateLimitV1 } from "../_lib/rate-limit.js";
import {
  cancelTossPayment,
  getTossPayment,
  getTossPaymentByOrderId,
  TossApiError,
  type LegacyTossPaymentObservation,
} from "../_lib/toss.js";
import { ApiHttpError, readJsonBody } from "../_lib/http.js";

const ORDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/u;
const UNSAFE_REASON_PATTERN = /[\u0000-\u001F\u007F]/u;
const CAPTURED_STATUSES = new Set(["DONE", "PARTIAL_CANCELED"]);
const CANCELED_STATUSES = new Set(["CANCELED", "PARTIAL_CANCELED"]);
const NEVER_CAPTURED_STATUSES = new Set(["ABORTED", "EXPIRED"]);

function nowIso(): string {
  return new Date().toISOString();
}

function assertPlainRefundRequest(value: unknown): asserts value is RefundRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new ApiHttpError(400, "INVALID_REFUND_REQUEST", "Refund request must be a plain object.");
  }
  const unknown = Object.keys(value).find((key) => key !== "orderId" && key !== "reason");
  if (unknown) throw new ApiHttpError(400, "INVALID_REFUND_REQUEST", `Unknown refund field ${unknown}.`);
}

function requireOrderId(value: unknown): string {
  if (typeof value !== "string" || value !== value.trim() || !ORDER_ID_PATTERN.test(value)) {
    throw new ApiHttpError(400, "INVALID_ORDER_ID", "A valid legacy orderId is required.");
  }
  return value;
}

function normalizeReason(value: unknown): string {
  if (value === undefined) return "Customer-requested legacy payment refund.";
  if (typeof value !== "string" || value !== value.trim() || value.length < 3 || value.length > 200
    || UNSAFE_REASON_PATTERN.test(value)) {
    throw new ApiHttpError(400, "INVALID_REFUND_REASON", "Refund reason must be 3 to 200 safe characters.");
  }
  return value;
}

function providerIdentity(observation: LegacyTossPaymentObservation): LegacyProviderIdentity {
  return {
    paymentKey: observation.paymentKey,
    orderId: observation.orderId,
    totalAmount: observation.totalAmount,
    balanceAmount: observation.balanceAmount,
    currency: observation.currency,
    method: observation.method,
    status: observation.status,
    observedAt: observation.observedAt,
  };
}

function assertProviderMatchesOrder(observation: LegacyTossPaymentObservation, record: PaymentRecord): void {
  if (observation.orderId !== record.orderId
    || observation.totalAmount !== record.amount
    || observation.currency !== "KRW"
    || (record.paymentKey !== null && observation.paymentKey !== record.paymentKey)) {
    throw new ApiHttpError(409, "PROVIDER_IDENTITY_MISMATCH", "Toss payment does not match the legacy order.");
  }
}

function refundResponse(
  record: PaymentRecord,
  refundMode: Exclude<RefundMode, null>,
  message: string,
  retryable: boolean,
): RefundResponse {
  return {
    orderId: record.orderId,
    status: record.status,
    refundMode,
    refundedAt: record.refundedAt ?? null,
    message,
    retryable,
  };
}

async function recordProviderFollowUp(input: {
  readonly record: PaymentRecord;
  readonly attemptId: string;
  readonly mode: "RECONCILIATION_REQUIRED" | "MANUAL_REQUIRED";
  readonly failureCode: string;
  readonly providerStatus?: string | null;
}): Promise<PaymentRecord> {
  const common = {
    orderId: input.record.orderId,
    attemptId: input.attemptId,
    failureCode: input.failureCode,
    providerStatus: input.providerStatus,
    observedAt: nowIso(),
  };
  return input.mode === "MANUAL_REQUIRED"
    ? markLegacyRefundManualRequired(common)
    : markLegacyRefundReconciliationRequired(common);
}

async function settleObservedTerminal(input: {
  readonly record: PaymentRecord;
  readonly attemptId: string;
  readonly observation: LegacyTossPaymentObservation;
}): Promise<{ record: PaymentRecord; mode: "AUTO_REFUNDED" | "NO_CAPTURE_FOUND" } | null> {
  assertProviderMatchesOrder(input.observation, input.record);
  if (CANCELED_STATUSES.has(input.observation.status) && input.observation.balanceAmount === 0) {
    const record = await completeLegacyRefund({
      orderId: input.record.orderId,
      attemptId: input.attemptId,
      provider: providerIdentity(input.observation),
      refundedAt: input.observation.canceledAt ?? input.observation.observedAt,
    });
    return { record, mode: "AUTO_REFUNDED" };
  }
  if (NEVER_CAPTURED_STATUSES.has(input.observation.status) && input.observation.balanceAmount === 0) {
    const record = await completeLegacyNoCapture({
      orderId: input.record.orderId,
      attemptId: input.attemptId,
      provider: providerIdentity(input.observation),
    });
    return { record, mode: "NO_CAPTURE_FOUND" };
  }
  return null;
}

async function recoverMissingPaymentKey(input: {
  readonly record: PaymentRecord;
  readonly attemptId: string;
}): Promise<
  | { kind: "recovered"; record: PaymentRecord; observation: LegacyTossPaymentObservation }
  | {
      kind: "follow_up";
      record: PaymentRecord;
      mode: "RECONCILIATION_REQUIRED" | "MANUAL_REQUIRED";
    }
> {
  try {
    const observation = await getTossPaymentByOrderId(input.record.orderId);
    assertProviderMatchesOrder(observation, input.record);
    const record = await attachRecoveredLegacyPaymentKey({
      attemptId: input.attemptId,
      provider: providerIdentity(observation),
    });
    return { kind: "recovered", record, observation };
  } catch (error) {
    if (error instanceof ApiHttpError && !(error instanceof TossApiError)) {
      throw error;
    }
    const providerNotFound = error instanceof TossApiError && error.statusCode === 404;
    const mode = providerNotFound ? "MANUAL_REQUIRED" : "RECONCILIATION_REQUIRED";
    const record = await recordProviderFollowUp({
      record: input.record,
      attemptId: input.attemptId,
      mode,
      failureCode: providerNotFound ? "PROVIDER_ORDER_NOT_FOUND" : "PROVIDER_ORDER_LOOKUP_INDETERMINATE",
    });
    return { kind: "follow_up", record, mode };
  }
}

export default async function handler(req: AuthRequestLike, res?: AuthNodeResponseLike) {
  try {
    assertAuthMethod(req, ["POST"]);
    assertTrustedMutationRequest(req);
    const actor = await requireAuthenticatedRole(req, "admin");
    await consumeRateLimitV1({
      policy: { scope: "legacy.payment.refund", limit: 30, windowSeconds: 3_600 },
      trustedSubject: actor.userId,
    });

    const body = await readJsonBody<RefundRequest>(req, { maxBytes: 4 * 1024 });
    assertPlainRefundRequest(body);
    const orderId = requireOrderId(body.orderId);
    const reason = normalizeReason(body.reason);
    const claim = await beginLegacyRefund({
      orderId,
      reason,
      requestedByUserId: actor.userId,
      requestedAt: nowIso(),
    });

    if (claim.mode === "already_refunded") {
      return sendAuthJson(res, 200, refundResponse(
        claim.record,
        "AUTO_REFUNDED",
        "Legacy payment is already fully refunded.",
        false,
      ));
    }

    let record = claim.record;
    let observation: LegacyTossPaymentObservation;
    if (!record.paymentKey) {
      const recovered = await recoverMissingPaymentKey({ record, attemptId: claim.attemptId });
      if (recovered.kind === "follow_up") {
        return sendAuthJson(res, 202, refundResponse(
          recovered.record,
          recovered.mode,
          recovered.mode === "MANUAL_REQUIRED"
            ? "Toss has no matching order. Verify the merchant console before a manual refund."
            : "Toss lookup was indeterminate. Retry this reconciliation endpoint; the payment was not overwritten.",
          recovered.mode === "RECONCILIATION_REQUIRED",
        ));
      }
      ({ record, observation } = recovered);
    } else {
      try {
        observation = await getTossPayment(record.paymentKey);
      } catch {
        const pending = await recordProviderFollowUp({
          record,
          attemptId: claim.attemptId,
          mode: "RECONCILIATION_REQUIRED",
          failureCode: "PROVIDER_PAYMENT_LOOKUP_INDETERMINATE",
        });
        return sendAuthJson(res, 202, refundResponse(
          pending,
          "RECONCILIATION_REQUIRED",
          "Toss lookup was indeterminate. Retry this reconciliation endpoint; the payment was not overwritten.",
          true,
        ));
      }
    }

    const alreadySettled = await settleObservedTerminal({ record, attemptId: claim.attemptId, observation });
    if (alreadySettled) {
      return sendAuthJson(res, 200, refundResponse(
        alreadySettled.record,
        alreadySettled.mode,
        alreadySettled.mode === "AUTO_REFUNDED"
          ? "Toss confirms that the legacy payment has no remaining refundable balance."
          : "Toss confirms that this legacy order was never captured.",
        false,
      ));
    }

    if (!CAPTURED_STATUSES.has(observation.status) || observation.balanceAmount <= 0) {
      const pending = await recordProviderFollowUp({
        record,
        attemptId: claim.attemptId,
        mode: "RECONCILIATION_REQUIRED",
        failureCode: "PROVIDER_STATUS_NOT_REFUNDABLE",
        providerStatus: observation.status,
      });
      return sendAuthJson(res, 202, refundResponse(
        pending,
        "RECONCILIATION_REQUIRED",
        "The provider state is not terminal or refundable. Review and retry reconciliation before manual action.",
        true,
      ));
    }

    let canceled: LegacyTossPaymentObservation;
    try {
      canceled = await cancelTossPayment({
        paymentKey: observation.paymentKey,
        orderId,
        cancelReason: record.refundReason ?? reason,
        cancelAmount: observation.balanceAmount,
      });
    } catch {
      // The provider may have completed the refund even when the response timed
      // out. Read-after-error reconciliation prevents a false local failure.
      try {
        canceled = await getTossPayment(observation.paymentKey);
      } catch {
        const pending = await recordProviderFollowUp({
          record,
          attemptId: claim.attemptId,
          mode: "RECONCILIATION_REQUIRED",
          failureCode: "PROVIDER_CANCEL_INDETERMINATE",
          providerStatus: observation.status,
        });
        return sendAuthJson(res, 202, refundResponse(
          pending,
          "RECONCILIATION_REQUIRED",
          "Refund outcome is indeterminate. Retry reconciliation; do not issue a second manual refund yet.",
          true,
        ));
      }
    }

    const settled = await settleObservedTerminal({ record, attemptId: claim.attemptId, observation: canceled });
    if (!settled || settled.mode !== "AUTO_REFUNDED") {
      const pending = await recordProviderFollowUp({
        record,
        attemptId: claim.attemptId,
        mode: "RECONCILIATION_REQUIRED",
        failureCode: "PROVIDER_REFUND_NOT_FULLY_SETTLED",
        providerStatus: canceled.status,
      });
      return sendAuthJson(res, 202, refundResponse(
        pending,
        "RECONCILIATION_REQUIRED",
        "Toss has not confirmed a zero balance. Retry reconciliation before manual action.",
        true,
      ));
    }

    return sendAuthJson(res, 200, refundResponse(
      settled.record,
      "AUTO_REFUNDED",
      "Legacy payment refund completed and was reconciled with Toss.",
      false,
    ));
  } catch (error) {
    return handleAuthApiError(res, error);
  }
}
