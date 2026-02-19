import React from 'react';

function formatScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return '0.0';
  return score.toFixed(1);
}

function CandidateNamingReportPage({ springReport, onBackCombined, onBackHome }) {
  const namingReport = springReport?.namingReport;

  if (!springReport || !namingReport) {
    return (
      <div className="min-h-screen flex flex-col items-center p-3 font-sans text-[var(--ns-text)]">
        <div className="bg-[var(--ns-surface)] p-5 rounded-[2rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-2xl overflow-hidden">
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-4 py-4">
            <p className="text-sm font-bold text-[var(--ns-muted)] text-center">후보 이름 리포트 정보가 없습니다.</p>
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

  const fullHangul = namingReport?.name?.fullHangul || '-';
  const fullHanja = namingReport?.name?.fullHanja || '-';

  return (
    <div className="min-h-screen flex flex-col items-center p-3 font-sans text-[var(--ns-text)]">
      <div className="bg-[var(--ns-surface)] p-5 rounded-[2rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-2xl overflow-hidden">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-[var(--ns-accent-text)]">이름 리포트</h1>
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

        <section className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-4 py-4">
          <p className="text-xs font-black text-[var(--ns-muted)]">선택된 이름</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">
            {fullHangul}
          </h2>
          <p className="text-sm text-[var(--ns-muted)] break-keep whitespace-normal">
            {fullHanja}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
              <p className="text-[11px] font-black text-[var(--ns-muted)]">이름 총점</p>
              <p className="text-lg font-black text-[var(--ns-accent-text)]">{formatScore(namingReport?.totalScore)}</p>
            </div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
              <p className="text-[11px] font-black text-[var(--ns-muted)]">종합 점수</p>
              <p className="text-lg font-black text-[var(--ns-accent-text)]">{formatScore(springReport?.finalScore)}</p>
            </div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
              <p className="text-[11px] font-black text-[var(--ns-muted)]">한글 점수</p>
              <p className="text-sm font-black text-[var(--ns-accent-text)]">{formatScore(namingReport?.scores?.hangul)}</p>
            </div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
              <p className="text-[11px] font-black text-[var(--ns-muted)]">사주 궁합 점수</p>
              <p className="text-sm font-black text-[var(--ns-accent-text)]">{formatScore(springReport?.sajuCompatibility?.affinityScore)}</p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-3">
            <p className="text-[11px] font-black text-[var(--ns-muted)] mb-1">이름 해석</p>
            <p className="text-sm text-[var(--ns-text)] break-keep whitespace-normal leading-relaxed">
              {namingReport?.interpretation || '-'}
            </p>
          </div>
        </section>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onBackCombined}
            className="w-full py-3 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] font-black"
          >
            종합 리포트로
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="w-full py-3 rounded-xl bg-[var(--ns-primary)] text-[var(--ns-accent-text)] font-black"
          >
            인쇄
          </button>
        </div>
      </div>
    </div>
  );
}

export default CandidateNamingReportPage;
