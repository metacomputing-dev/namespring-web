export const SUPPORT_PRODUCT_NAME = "\uAC1C\uBC1C\uC790\uC5D0\uAC8C \uCEE4\uD53C \uC0AC\uC8FC\uAE30";
export const SUPPORT_ORDER_NAME = SUPPORT_PRODUCT_NAME;
export const SUPPORT_AMOUNT = 900;

export const PAYMENT_STATUSES = ["READY", "PAID", "FAILED", "CANCELED", "REFUNDED"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type RefundMode = "AUTO_REFUNDED" | "MANUAL_REQUIRED" | null;

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
}
