import React, { useEffect, useState } from 'react';
import CombiedNamingReport from './CombiedNamingReport';
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
    <div className={REPORT_PAGE_CLASS.outer}>
      <div className={REPORT_PAGE_CLASS.container}>
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className={REPORT_PAGE_CLASS.headerTitle}>통합 보고서</h1>
          </div>
          <button
            onClick={onBackHome}
            aria-label="홈으로"
            title="홈으로"
            className={REPORT_PAGE_CLASS.homeButton}
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
              <path d="M3 9.5L10 4L17 9.5V16.5H12.5V12H7.5V16.5H3V9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </header>

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
    </div>
  );
}

export default CombinedReportPage;
