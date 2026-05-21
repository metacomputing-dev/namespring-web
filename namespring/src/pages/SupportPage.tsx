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
      setFormErrorMessage("Payment is disabled in this environment.");
      return;
    }

    const normalizedEmail = normalizeOptionalEmail(email);
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      setEmailErrorMessage("Please enter a valid email format.");
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
      const message = error instanceof Error ? error.message : "Unable to start payment.";
      setFormErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PaymentPageLayout
      title={SUPPORT_PRODUCT_NAME}
      subtitle="로그인 없이 한 번만 결제할 수 있습니다."
    >
      <div className="ns-section-stack">
        <div className="ns-report-surface p-4">
          <div className="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-3">
            <p className="font-bold text-[var(--color-accent)]">{SUPPORT_PRODUCT_NAME}</p>
            <p className="text-lg font-black text-[var(--color-accent)] sm:text-right">{SUPPORT_AMOUNT.toLocaleString()} KRW</p>
          </div>
          <p className="mt-2 text-xs font-semibold text-[var(--color-ink-3)]">
            이메일은 선택 입력입니다. 결제 확인 외의 보상은 제공되지 않습니다.
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
            {isSubmitting ? "처리 중" : "커피 한 잔 결제하기"}
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
