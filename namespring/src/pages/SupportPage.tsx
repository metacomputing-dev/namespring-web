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
      subtitle="Single product checkout. No login required."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-[var(--ns-accent-text)]">{SUPPORT_PRODUCT_NAME}</p>
            <p className="text-lg font-black text-[var(--ns-accent-text)]">{SUPPORT_AMOUNT.toLocaleString()} KRW</p>
          </div>
          <p className="mt-2 text-xs text-[var(--ns-muted)]">
            You can check out without login. Email input is optional.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
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
              "w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition",
              isSubmitting || !paymentReady ? "bg-gray-400 cursor-not-allowed" : "bg-[var(--ns-primary)] hover:brightness-95",
            ].join(" ")}
          >
            {isSubmitting ? "Processing..." : "Buy Coffee"}
          </button>
        </form>

        {!paymentReady ? (
          <p className="text-xs text-red-600">
            Runtime configuration missing. Set VITE_PAYMENT_ENABLED=true and VITE_TOSS_CLIENT_KEY.
          </p>
        ) : null}

        {formErrorMessage ? <p className="text-xs text-red-600">{formErrorMessage}</p> : null}
      </div>
    </PaymentPageLayout>
  );
}
