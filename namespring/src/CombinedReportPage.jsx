import React, { useEffect, useState } from 'react';
import CombiedNamingReport from './CombiedNamingReport';
import ReportShell from './components/report/ReportShell';
import { PageHeading } from './components/report/ReportPrimitives';
import { REPORT_PAGE_CLASS } from './theme/report-ui-theme';

function CombinedReportPage({
  entryUserInfo,
  selectedCandidate,
  onLoadCombinedReport,
  onBackHome,
  onBackCandidates,
  onOpenNamingReport,
  onOpenSajuReport,
}) {
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!entryUserInfo || !selectedCandidate || !onLoadCombinedReport) {
        setReport(null);
        setIsLoading(false);
        setError('선택한 추천 이름 정보가 없습니다.');
        return;
      }

      setIsLoading(true);
      setError('');
      setReport(null);
      try {
        const nextReport = await onLoadCombinedReport(entryUserInfo, selectedCandidate);
        if (cancelled) return;
        setReport(nextReport || null);
        if (!nextReport) {
          setError('통합 보고서를 불러오지 못했습니다.');
        }
      } catch {
        if (cancelled) return;
        setError('통합 보고서를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [entryUserInfo, selectedCandidate, onLoadCombinedReport]);

  return (
    <ReportShell activeNav="report" onHome={onBackHome} size="wide">
      <PageHeading
        kicker="보고서 · 통합"
        title="통합 평가 보고서"
        description="사주 평가와 성명학 평가를 함께 묶은 종합 보고서입니다."
        className="ns-page-heading--compact"
        action={(
          <button
            type="button"
            onClick={onBackHome}
            className="ns-secondary-button"
            aria-label="홈으로"
          >
            홈으로
          </button>
        )}
      />
      <div className={REPORT_PAGE_CLASS.container}>

        {isLoading ? (
          <div className={REPORT_PAGE_CLASS.loadingCard}>
            <div className="h-12 w-12 rounded-full border-4 border-[var(--ns-primary)] border-t-transparent animate-spin" />
            <p className={REPORT_PAGE_CLASS.loadingText}>통합 보고서를 생성하고 있습니다.</p>
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="space-y-3">
            <div className={REPORT_PAGE_CLASS.errorCard}>
              <p className={REPORT_PAGE_CLASS.errorText}>{error}</p>
            </div>
            <button
              type="button"
              onClick={onBackCandidates}
              className={REPORT_PAGE_CLASS.primaryButton}
            >
              추천 목록으로
            </button>
          </div>
        ) : null}

        {!isLoading && !error && report ? (
          <CombiedNamingReport
            fortuneReport={report}
            onOpenNamingReport={onOpenNamingReport}
            onOpenSajuReport={onOpenSajuReport}
            shareUserInfo={entryUserInfo}
          />
        ) : null}
      </div>
    </ReportShell>
  );
}

export default CombinedReportPage;
