import React from 'react';
import SajuReport from './SajuReport';

function CandidateSajuReportPage({ springReport, onBackCombined, onBackHome }) {
  const sajuReport = springReport?.sajuReport;

  if (!sajuReport) {
    return (
      <div className="min-h-screen flex flex-col items-center p-3 font-sans text-[var(--ns-text)]">
        <div className="bg-[var(--ns-surface)] p-5 rounded-[2rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-2xl overflow-hidden">
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-4 py-4">
            <p className="text-sm font-bold text-[var(--ns-muted)] text-center">후보 이름 사주 리포트 정보가 없습니다.</p>
          </div>
          <button
            type="button"
            onClick={onBackCombined}
            className="mt-3 w-full py-3 bg-[var(--ns-primary)] text-[var(--ns-accent-text)] rounded-2xl font-black"
          >
            종합 리포트로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-3 font-sans text-[var(--ns-text)]">
      <div className="bg-[var(--ns-surface)] p-5 rounded-[2rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-2xl overflow-hidden">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-[var(--ns-accent-text)]">사주 리포트</h1>
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

        <SajuReport report={sajuReport} />

        <button
          type="button"
          onClick={onBackCombined}
          className="mt-3 w-full py-3 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] font-black"
        >
          종합 리포트로
        </button>
      </div>
    </div>
  );
}

export default CandidateSajuReportPage;
