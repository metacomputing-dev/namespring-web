import React, { useEffect, useState } from 'react';
import SajuReport from './SajuReport';

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
    <div className="min-h-screen flex flex-col items-center p-3 font-sans text-[var(--ns-text)]">
      <div className="bg-[var(--ns-surface)] p-5 rounded-[2rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-2xl overflow-hidden">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-[var(--ns-accent-text)]">사주 평가 보고서</h1>
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
            <p className="text-sm font-bold text-[var(--ns-muted)]">사주 보고서를 생성하고 있습니다.</p>
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-4 py-4">
              <p className="text-sm font-bold text-[var(--ns-muted)] text-center">{error}</p>
            </div>
            <button
              type="button"
              onClick={loadReport}
              className="w-full py-3 bg-[var(--ns-primary)] text-[var(--ns-accent-text)] rounded-2xl font-black"
            >
              다시 불러오기
            </button>
          </div>
        ) : null}

        {!isLoading && !error && report ? (
          <SajuReport report={report} />
        ) : null}
      </div>
    </div>
  );
}

export default SajuReportPage;
