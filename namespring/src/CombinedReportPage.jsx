import React, { useEffect, useState } from 'react';
import IntegratedReportView from './IntegratedReportView';

function CombinedReportPage({
  entryUserInfo,
  selectedCandidate,
  candidates = [],
  onLoadCombinedReport,
  onBackHome,
  onBackCandidates,
  onOpenNamingReport,
  onOpenSajuReport,
}) {
  const [springReport, setSpringReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!entryUserInfo || !selectedCandidate || !onLoadCombinedReport) {
        setSpringReport(null);
        setIsLoading(false);
        setError('선택된 추천 이름 정보가 없습니다.');
        return;
      }

      setIsLoading(true);
      setError('');
      setSpringReport(null);

      try {
        const nextSpringReport = await onLoadCombinedReport(entryUserInfo, selectedCandidate);
        if (cancelled) return;

        setSpringReport(nextSpringReport || null);

        if (!nextSpringReport) {
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
    <div className="min-h-screen flex flex-col items-center p-3 font-sans text-[var(--ns-text)]">
      <div className="bg-[var(--ns-surface)] p-5 rounded-[2rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-5xl overflow-hidden">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-[var(--ns-accent-text)]">통합 분석</h1>
            <p className="text-xs text-[var(--ns-muted)] mt-0.5">이름과 사주의 유기적 관계를 분석합니다</p>
          </div>
          <button
            onClick={onBackHome}
            aria-label="홈으로"
            title="홈으로"
            className="w-10 h-10 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] font-bold inline-flex items-center justify-center"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
              <path d="M3 9.5L10 4L17 9.5V16.5H12.5V12H7.5V16.5H3V9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </header>

        {isLoading ? (
          <div className="h-40 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-full border-4 border-[var(--ns-primary)] border-t-transparent animate-spin" />
            <p className="text-sm font-bold text-[var(--ns-muted)]">이름과 사주의 관계를 분석하고 있어요.</p>
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-4 py-4">
              <p className="text-sm font-bold text-[var(--ns-muted)] text-center">{error}</p>
            </div>
            <button
              type="button"
              onClick={onBackCandidates}
              className="w-full py-3 bg-[var(--ns-primary)] text-[var(--ns-accent-text)] rounded-2xl font-black"
            >
              추천 목록으로
            </button>
          </div>
        ) : null}

        {!isLoading && !error && springReport ? (
          <IntegratedReportView
            springReport={springReport}
            candidates={candidates}
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
