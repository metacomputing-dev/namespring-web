import { useMemo, useState, type FormEvent } from "react";
import PaymentPageLayout from "../components/PaymentPageLayout";
import OptionalEmailInput from "../components/OptionalEmailInput";
import { isValidEmail, normalizeOptionalEmail } from "../lib/email";
import { createPayment, requestCardPayment } from "../lib/payments";
import { getFrontRuntimeConfig } from "../lib/runtime";
import { SUPPORT_AMOUNT, SUPPORT_PRODUCT_NAME } from "../../shared/types/payment";

export default function SupportPage() {
  const runtimeConfig = useMemo(() => getFrontRuntimeConfig(), []);
  const [email, setEmail] = useState("");
  const [emailErrorMessage, setEmailErrorMessage] = useState("");
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const paymentReady = runtimeConfig.paymentEnabled && Boolean(runtimeConfig.tossClientKey);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailErrorMessage("");
    setFormErrorMessage("");

    if (!paymentReady) {
      setFormErrorMessage("현재 환경에서는 결제를 시작할 수 없습니다.");
      return;
    }

    const normalizedEmail = normalizeOptionalEmail(email);
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      setEmailErrorMessage("이메일 형식을 확인해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await createPayment(normalizedEmail);
      await requestCardPayment({
        orderId: order.orderId,
        orderName: order.orderName,
        amount: order.amount,
        customerEmail: order.customerEmail,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "결제를 시작할 수 없습니다.";
      setFormErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PaymentPageLayout
      title={SUPPORT_PRODUCT_NAME}
      subtitle="무료 요약 뒤의 심화 해석을 이어서 열어봅니다. 결제는 한 번만 진행됩니다."
    >
      <div className="ns-section-stack">
        <div className="ns-payment-summary">
          <div className="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-3">
            <p className="font-bold text-[var(--color-accent)]">통합 리포트 완성</p>
            <p className="text-lg font-black text-[var(--color-accent)] sm:text-right">{SUPPORT_AMOUNT.toLocaleString()} KRW</p>
          </div>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-[var(--color-ink-3)]">
            이메일은 선택 입력입니다. 결제 확인과 리포트 재접속 안내가 필요할 때만 사용합니다.
          </p>
        </div>

        <form className="ns-section-stack" onSubmit={handleSubmit}>
          <OptionalEmailInput
            value={email}
            onChange={setEmail}
            disabled={isSubmitting}
            errorMessage={emailErrorMessage}
          />

          <button
            type="submit"
            disabled={isSubmitting || !paymentReady}
            className={[
              "ns-primary-button w-full",
              isSubmitting || !paymentReady ? "ns-button-disabled" : "",
            ].join(" ")}
          >
            {isSubmitting ? "결제 준비 중" : "내 해석 완성하기"}
          </button>
        </form>

        {!paymentReady ? (
          <p className="ns-report-panel border-[var(--color-danger-line)] bg-[var(--color-danger-bg)] text-xs font-semibold text-[var(--color-danger)]">
            결제 설정이 준비되지 않았습니다. VITE_PAYMENT_ENABLED와 VITE_TOSS_CLIENT_KEY를 확인해 주세요.
          </p>
        ) : null}

        {formErrorMessage ? (
          <p className="ns-report-panel border-[var(--color-danger-line)] bg-[var(--color-danger-bg)] text-xs font-semibold text-[var(--color-danger)]">
            {formErrorMessage}
          </p>
        ) : null}
      </div>
    </PaymentPageLayout>
  );
}
