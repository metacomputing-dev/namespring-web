import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { withBasePath } from "../lib/paths";
import ReportShell from "./report/ReportShell";
import { PageHeading } from "./report/ReportPrimitives";

interface PaymentPageLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function PaymentPageLayout({ title, subtitle, children }: PaymentPageLayoutProps) {
  return (
    <ReportShell activeNav="support" size="narrow">
      <PageHeading
        kicker="Support"
        title={title}
        description={subtitle}
      />
      <div className="ns-card ns-card--large ns-card--surface">
        <div className="grid gap-4">
          {children}

          <div className="border-t border-[var(--ns-border)] pt-4">
            <Link className="ns-secondary-button w-full" to={withBasePath("/")}>
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </ReportShell>
  );
}
