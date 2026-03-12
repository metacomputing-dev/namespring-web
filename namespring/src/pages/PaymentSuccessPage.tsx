import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ConfirmPaymentResponse } from "../../shared/types/payment";
import PaymentPageLayout from "../components/PaymentPageLayout";
import { confirmPayment } from "../lib/payments";

type ConfirmState =
  | { type: "loading" }
  | { type: "success"; data: ConfirmPaymentResponse }
  | { type: "error"; message: string };

function parseAmount(rawAmount: string | null): number | null {
  if (!rawAmount) {
    return null;
  }
  const amount = Number(rawAmount);
  return Number.isInteger(amount) ? amount : null;
}

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<ConfirmState>({ type: "loading" });
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) {
      return;
    }
    requestedRef.current = true;

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = parseAmount(searchParams.get("amount"));

    if (!paymentKey || !orderId || amount === null) {
      setState({ type: "error", message: "Missing payment confirmation query parameters." });
      return;
    }

    (async () => {
      try {
        const confirmed = await confirmPayment({
          paymentKey,
          orderId,
          amount,
        });
        setState({ type: "success", data: confirmed });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Payment confirmation failed.";
        setState({ type: "error", message });
      }
    })();
  }, [searchParams]);

  if (state.type === "loading") {
    return (
      <PaymentPageLayout title="Payment Confirmation" subtitle="Finalizing payment with server approval.">
        <p className="text-sm text-[var(--ns-muted)]">Confirming payment...</p>
      </PaymentPageLayout>
    );
  }

  if (state.type === "error") {
    return (
      <PaymentPageLayout title="Payment Confirmation Failed" subtitle="The payment could not be confirmed.">
        <p className="text-sm text-red-600">{state.message}</p>
      </PaymentPageLayout>
    );
  }

  return (
    <PaymentPageLayout title="Thank You" subtitle="Your support has been received.">
      <div className="space-y-4">
        <p className="text-sm text-[var(--ns-muted)]">
          Thank you for your support. No additional reward is provided for this payment.
        </p>
        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4">
          <p className="text-xs font-semibold text-[var(--ns-muted)]">Order Number</p>
          <p className="mt-1 text-sm font-bold text-[var(--ns-accent-text)] break-all">{state.data.orderId}</p>
        </div>
      </div>
    </PaymentPageLayout>
  );
}
