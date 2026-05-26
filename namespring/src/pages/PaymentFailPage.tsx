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
      // Keep the fail page visible even when client-side reporting fails.
    });
  }, [failInfo.code, failInfo.message, failInfo.orderId]);

  return (
    <PaymentPageLayout title="결제가 완료되지 않았습니다" subtitle="원하면 리포트로 돌아가 다시 시도할 수 있습니다.">
      <div className="ns-section-stack">
        <div className="ns-report-panel ns-report-panel--sunken">
          <p className="text-sm font-semibold leading-relaxed text-[var(--color-ink-2)]">
            결제는 진행되지 않았습니다. 입력한 리포트 결과는 브라우저에 남아 있으면 다시 이어볼 수 있습니다.
          </p>
        </div>

        {failInfo.orderId ? (
          <p className="ns-report-panel text-xs font-semibold text-[var(--color-ink-3)]">
            주문번호: <span className="font-bold text-[var(--color-accent)] break-all">{failInfo.orderId}</span>
          </p>
        ) : null}

        {failInfo.code ? (
          <p className="ns-report-panel border-[var(--color-danger-line)] bg-[var(--color-danger-bg)] text-xs font-semibold text-[var(--color-danger)]">
            오류 코드: <span className="font-bold">{failInfo.code}</span>
          </p>
        ) : null}

        {failInfo.message ? (
          <p className="ns-report-panel break-words border-[var(--color-danger-line)] bg-[var(--color-danger-bg)] text-xs font-semibold text-[var(--color-danger)]">
            {failInfo.message}
          </p>
        ) : null}
      </div>
    </PaymentPageLayout>
  );
}
