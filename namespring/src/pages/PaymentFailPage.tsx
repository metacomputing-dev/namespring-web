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
    <PaymentPageLayout title="Payment Failed" subtitle="The payment was not completed.">
      <div className="space-y-3">
        <p className="text-sm text-[var(--ns-muted)]">
          The transaction could not be completed. Please try again from the support page.
        </p>

        {failInfo.orderId ? (
          <p className="text-xs text-[var(--ns-muted)]">
            Order Number: <span className="font-semibold text-[var(--ns-accent-text)] break-all">{failInfo.orderId}</span>
          </p>
        ) : null}

        {failInfo.code ? (
          <p className="text-xs text-red-600">
            Error Code: <span className="font-semibold">{failInfo.code}</span>
          </p>
        ) : null}

        {failInfo.message ? (
          <p className="text-xs text-red-600 break-words">{failInfo.message}</p>
        ) : null}
      </div>
    </PaymentPageLayout>
  );
}
