import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { withBasePath } from "../lib/paths";

interface PaymentPageLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function PaymentPageLayout({ title, subtitle, children }: PaymentPageLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--ns-background)] text-[var(--ns-text)] p-6 md:p-10">
      <div className="max-w-xl mx-auto">
        <div className="rounded-[2rem] border border-[var(--ns-border)] bg-[var(--ns-surface)] shadow-xl p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-black text-[var(--ns-accent-text)]">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-[var(--ns-muted)]">{subtitle}</p> : null}
          </div>

          {children}

          <div className="mt-8 pt-4 border-t border-[var(--ns-border)]">
            <Link className="text-sm font-semibold text-[var(--ns-accent-text)] underline" to={withBasePath("/")}>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
