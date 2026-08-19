import React, { useEffect, useMemo, useState } from 'react';
import CombiedNamingReport from './CombiedNamingReport';
import CombinedReportV2 from './report/combined/CombinedReportV2.jsx';
import ReportShell from './components/report/ReportShell';
import { PageHeading } from './components/report/ReportPrimitives';
import { REPORT_PAGE_CLASS } from './theme/report-ui-theme';

// v2 is the default renderer; the legacy layout stays reachable for one
// release via ?reportLegacy=1 (and ?reportV2=0).
function readReportV2Flag() {
  if (typeof window === 'undefined') return true;
  const query = new URLSearchParams(window.location.search);
  if (query.get('reportLegacy') === '1' || query.get('reportV2') === '0') return false;
  return true;
}

function CombinedReportPage({
  entryUserInfo,
  selectedCandidate,
  onLoadCombinedReport,
  onLoadSpringReport,
  onBackHome,
  onBackCandidates,
  onOpenNamingReport,
  onOpenSajuReport,
  onOpenPremium,
}) {
  const useV2 = useMemo(() => readReportV2Flag(), []);
  const [report, setReport] = useState(null);
  const [springReport, setSpringReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!entryUserInfo || !selectedCandidate || !onLoadCombinedReport) {
        setReport(null);
        setSpringReport(null);
        setIsLoading(false);
        setError('선택한 추천 이름 정보가 없습니다.');
        return;
      }

      setIsLoading(true);
      setError('');
      setReport(null);
      setSpringReport(null);
      try {
        const fortunePromise = onLoadCombinedReport(entryUserInfo, selectedCandidate);
        const springPromise = useV2 && onLoadSpringReport
          ? onLoadSpringReport(entryUserInfo, selectedCandidate?.givenName)
          : Promise.resolve(null);
        const [nextReport, nextSpringReport] = await Promise.all([fortunePromise, springPromise]);
        if (cancelled) return;
        setReport(nextReport || null);
        setSpringReport(nextSpringReport || null);
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
  }, [entryUserInfo, selectedCandidate, onLoadCombinedReport, onLoadSpringReport, useV2]);

  const shellSize = useV2 ? 'reader' : 'wide';

  return (
    <ReportShell activeNav="report" onHome={onBackHome} size={shellSize}>
      {!useV2 ? (
        <PageHeading
          kicker="보고서 · 통합"
          title="통합 평가 보고서"
          description="사주 평가와 성명학 평가를 함께 묶은 종합 보고서입니다."
          className="ns-page-heading--compact"
        />
      ) : null}
      <div className={REPORT_PAGE_CLASS.container}>

        {isLoading ? (
          <div className={REPORT_PAGE_CLASS.loadingCard}>
            <div className="ns-report-spinner" aria-hidden="true" />
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
          useV2 && springReport ? (
            <CombinedReportV2
              springReport={springReport}
              fortuneReport={report}
              entryUserInfo={entryUserInfo}
              onOpenNamingReport={onOpenNamingReport}
              onOpenSajuReport={onOpenSajuReport}
              onOpenPremium={onOpenPremium}
              onRecommend={onBackCandidates}
            />
          ) : (
            <CombiedNamingReport
              fortuneReport={report}
              onOpenNamingReport={onOpenNamingReport}
              onOpenSajuReport={onOpenSajuReport}
              onOpenPremium={onOpenPremium}
              shareUserInfo={entryUserInfo}
            />
          )
        ) : null}
      </div>
    </ReportShell>
  );
}

export default CombinedReportPage;
