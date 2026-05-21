import React, { useEffect, useState } from 'react';
import SajuReport from './SajuReport';
import ReportShell from './components/report/ReportShell';
import { PageHeading } from './components/report/ReportPrimitives';
import { REPORT_PAGE_CLASS } from './theme/report-ui-theme';

function SajuReportPage({
  entryUserInfo,
  onLoadSajuReport,
  onBackHome,
}) {
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = async () => {
    if (!entryUserInfo || !onLoadSajuReport) {
      setReport(null);
      setIsLoading(false);
      setError('사주 평가를 위한 입력 정보가 없습니다.');
      return;
    }

    setIsLoading(true);
    setError('');
    setReport(null);
    try {
      const nextReport = await onLoadSajuReport(entryUserInfo);
      setReport(nextReport || null);
      if (!nextReport) {
        setError('사주 평가 보고서를 불러오지 못했습니다.');
      }
    } catch {
      setError('사주 평가 보고서를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryUserInfo, onLoadSajuReport]);

  return (
    <ReportShell activeNav="report" onHome={onBackHome} size="wide">
      <PageHeading
        kicker="Saju report"
        title="사주 평가 보고서"
        description="입력한 생년월일시를 기준으로 사주 구조와 균형을 확인합니다."
      />
      <div className={REPORT_PAGE_CLASS.container}>

        {isLoading ? (
          <div className={REPORT_PAGE_CLASS.loadingCard}>
            <div className="h-12 w-12 rounded-full border-4 border-[var(--ns-primary)] border-t-transparent animate-spin" />
            <p className={REPORT_PAGE_CLASS.loadingText}>사주 보고서를 생성하고 있습니다.</p>
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="space-y-3">
            <div className={REPORT_PAGE_CLASS.errorCard}>
              <p className={REPORT_PAGE_CLASS.errorText}>{error}</p>
            </div>
            <button
              type="button"
              onClick={loadReport}
              className={REPORT_PAGE_CLASS.primaryButton}
            >
              다시 불러오기
            </button>
          </div>
        ) : null}

        {!isLoading && !error && report ? (
          <SajuReport report={report} shareUserInfo={entryUserInfo} />
        ) : null}
      </div>
    </ReportShell>
  );
}

export default SajuReportPage;
