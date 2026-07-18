export const SUPPORT_PRODUCT_NAME = "\uC774\uB984\uBD04 \uD1B5\uD569 \uB9AC\uD3EC\uD2B8 \uC644\uC131\uD558\uAE30";
export const SUPPORT_ORDER_NAME = SUPPORT_PRODUCT_NAME;
export const SUPPORT_AMOUNT = 900;
export const PREMIUM_ACCESS_STORAGE_KEY = "namespring_premium_access";

export const PAYMENT_STATUSES = ["READY", "PAID", "FAILED", "CANCELED", "REFUNDED"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const LEGACY_REFUND_STATES = [
  "PENDING",
  "RECONCILIATION_REQUIRED",
  "AUTO_REFUNDED",
  "NO_CAPTURE_FOUND",
  "MANUAL_REQUIRED",
] as const;

export type LegacyRefundState = (typeof LEGACY_REFUND_STATES)[number];
export type RefundMode = Exclude<LegacyRefundState, "PENDING"> | null;

export interface PaymentRecord {
  orderId: string;
  email: string | null;
  amount: number;
  status: PaymentStatus;
  paymentKey: string | null;
  method: string | null;
  createdAt: string;
  paidAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
  failCode?: string | null;
  failMessage?: string | null;
  refundMode?: RefundMode;
  refundReason?: string | null;
  refundFailureCode?: string | null;
  refundFailureMessage?: string | null;
  /** Monotonic CAS version. Historic documents without this field are version 0. */
  version?: number;
  refundState?: LegacyRefundState | null;
  refundAttemptId?: string | null;
  refundFirstRequestedAt?: string | null;
  refundFirstRequestedByUserId?: string | null;
  refundRequestedAt?: string | null;
  refundRequestedByUserId?: string | null;
  refundProviderStatus?: string | null;
  refundProviderObservedAt?: string | null;
}

export interface CreatePaymentRequest {
  email?: string;
}

export interface CreatePaymentResponse {
  orderId: string;
  orderName: string;
  amount: number;
  customerEmail: string | null;
}

export interface ConfirmPaymentRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface ConfirmPaymentResponse {
  orderId: string;
  status: PaymentStatus;
  paymentKey: string;
  method: string | null;
  paidAt: string;
}

export interface FailPaymentRequest {
  orderId: string;
  code?: string;
  message?: string;
}

export interface FailPaymentResponse {
  orderId: string;
  status: PaymentStatus;
  failedAt: string;
}

export interface RefundRequest {
  orderId: string;
  reason?: string;
}

export interface RefundResponse {
  orderId: string;
  status: PaymentStatus;
  refundMode: Exclude<RefundMode, null>;
  refundedAt: string | null;
  message: string;
  retryable: boolean;
}
