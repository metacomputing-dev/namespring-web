import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ConfirmPaymentResponse } from "../../shared/types/payment";
import { PREMIUM_ACCESS_STORAGE_KEY } from "../../shared/types/payment";
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
      setState({ type: "error", message: "결제 확인에 필요한 정보가 없습니다." });
      return;
    }

    (async () => {
      try {
        const confirmed = await confirmPayment({
          paymentKey,
          orderId,
          amount,
        });
        try {
          window.sessionStorage.setItem(PREMIUM_ACCESS_STORAGE_KEY, "paid");
        } catch {
          /* sessionStorage may be unavailable — premium unlock still succeeds server-side. */
        }
        setState({ type: "success", data: confirmed });
      } catch (error) {
        const message = error instanceof Error ? error.message : "결제 확인에 실패했습니다.";
        setState({ type: "error", message });
      }
    })();
  }, [searchParams]);

  if (state.type === "loading") {
    return (
      <PaymentPageLayout title="결제 확인" subtitle="서버 승인 결과를 확인하고 있습니다.">
        <div className="ns-report-panel ns-report-panel--sunken flex items-center gap-3">
          <div className="ns-report-spinner shrink-0" aria-hidden="true" style={{ width: "1.5rem" }} />
          <p className="text-sm font-semibold text-[var(--color-ink-2)]">결제를 확인하고 있습니다.</p>
        </div>
      </PaymentPageLayout>
    );
  }

  if (state.type === "error") {
    return (
      <PaymentPageLayout title="결제 확인 실패" subtitle="결제를 승인할 수 없습니다.">
        <div className="ns-report-panel border-[var(--color-danger-line)] bg-[var(--color-danger-bg)]">
          <p className="text-sm font-semibold text-[var(--color-danger)]">{state.message}</p>
        </div>
      </PaymentPageLayout>
    );
  }

  return (
    <PaymentPageLayout title="해석이 열렸습니다" subtitle="결제가 정상적으로 확인되었습니다.">
      <div className="ns-section-stack">
        <div className="ns-report-panel ns-report-panel--sunken">
          <p className="text-sm font-semibold leading-relaxed text-[var(--color-ink-2)]">
            같은 브라우저에서 통합 리포트를 다시 열면 잠겨 있던 심화 영역을 이어서 읽을 수 있습니다.
          </p>
        </div>
        <div className="ns-report-surface p-4">
          <p className="text-xs font-bold text-[var(--color-ink-3)]">주문번호</p>
          <p className="mt-1 break-all text-sm font-bold text-[var(--color-accent)]">{state.data.orderId}</p>
        </div>
      </div>
    </PaymentPageLayout>
  );
}
