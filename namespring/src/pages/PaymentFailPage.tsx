import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import PaymentPageLayout from "../components/PaymentPageLayout";
import { registerPaymentFail } from "../lib/payments";

function normalizeNullableValue(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export default function PaymentFailPage() {
  const [searchParams] = useSearchParams();
  const reportedRef = useRef(false);

  const failInfo = useMemo(() => {
    return {
      orderId: normalizeNullableValue(searchParams.get("orderId")),
      code: normalizeNullableValue(searchParams.get("code")),
      message: normalizeNullableValue(searchParams.get("message")),
    };
  }, [searchParams]);

  useEffect(() => {
    if (reportedRef.current) {
      return;
    }

    if (!failInfo.orderId) {
      return;
    }

    reportedRef.current = true;
    void registerPaymentFail({
      orderId: failInfo.orderId,
      code: failInfo.code ?? undefined,
      message: failInfo.message ?? undefined,
    }).catch(() => {
      // Suppress client-side reporting errors to keep fail page visible.
    });
  }, [failInfo.code, failInfo.message, failInfo.orderId]);

  return (
    <PaymentPageLayout title="결제 실패" subtitle="결제가 완료되지 않았습니다.">
      <div className="grid gap-3">
        <p className="text-sm font-semibold leading-relaxed text-[var(--color-ink-2)]">
          후원 페이지에서 다시 시도해 주세요.
        </p>

        {failInfo.orderId ? (
          <p className="text-xs font-semibold text-[var(--color-ink-3)]">
            주문번호: <span className="font-bold text-[var(--color-accent)] break-all">{failInfo.orderId}</span>
          </p>
        ) : null}

        {failInfo.code ? (
          <p className="text-xs font-semibold text-[var(--color-danger)]">
            오류 코드: <span className="font-bold">{failInfo.code}</span>
          </p>
        ) : null}

        {failInfo.message ? (
          <p className="break-words text-xs font-semibold text-[var(--color-danger)]">{failInfo.message}</p>
        ) : null}
      </div>
    </PaymentPageLayout>
  );
}
