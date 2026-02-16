import React, { useEffect, useMemo, useState } from 'react';

function getDisplayName(candidate) {
  const fullHangul = candidate?.fullHangul || candidate?.namingReport?.name?.fullHangul || '-';
  const fullHanja = candidate?.fullHanja || candidate?.namingReport?.name?.fullHanja || '-';
  return `${fullHangul} (${fullHanja})`;
}

function formatScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return '0.0';
  return score.toFixed(1);
}

function getPopularityRank(candidate) {
  const rank = Number(candidate?.popularityRank);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
}

function NamingCandidatesPage({ entryUserInfo, onRecommendAsync, onLoadCurrentSpringReport, onBackHome, onOpenCombinedReport }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isCurrentLoading, setIsCurrentLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortMode, setSortMode] = useState('popularity');
  const [candidates, setCandidates] = useState([]);
  const [currentSpringReport, setCurrentSpringReport] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!entryUserInfo || !onRecommendAsync) {
        setCandidates([]);
        setError('입력한 정보가 없어 추천을 진행할 수 없습니다.');
        setIsLoading(false);
        return;
      }

      setSortMode('popularity');
      setError('');
      setCandidates([]);
      setCurrentSpringReport(null);
      setIsLoading(true);
      setIsCurrentLoading(true);

      try {
        const [reports, currentReport] = await Promise.all([
          onRecommendAsync(entryUserInfo),
          onLoadCurrentSpringReport ? onLoadCurrentSpringReport(entryUserInfo) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const safeReports = Array.isArray(reports) ? reports : [];
        setCandidates(safeReports);
        setCurrentSpringReport(currentReport || null);
        if (!safeReports.length) {
          setError('추천 결과가 없습니다.');
        }
      } catch {
        if (!cancelled) {
          setError('작명 결과를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsCurrentLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [entryUserInfo, onRecommendAsync, onLoadCurrentSpringReport]);

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      if (sortMode === 'popularity') {
        const aRank = getPopularityRank(a);
        const bRank = getPopularityRank(b);
        const safeA = aRank ?? Number.POSITIVE_INFINITY;
        const safeB = bRank ?? Number.POSITIVE_INFINITY;
        if (safeA !== safeB) return safeA - safeB;
      }
      return Number(b?.finalScore ?? 0) - Number(a?.finalScore ?? 0);
    });
  }, [candidates, sortMode]);

  const scoreRangeText = useMemo(() => {
    if (!candidates.length) return '-';
    const scores = candidates
      .map((candidate) => Number(candidate?.finalScore))
      .filter((score) => Number.isFinite(score));
    if (!scores.length) return '-';
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    return `${formatScore(max)}점 ~ ${formatScore(min)}점`;
  }, [candidates]);

  const popularityRangeText = useMemo(() => {
    const ranks = candidates
      .map((candidate) => getPopularityRank(candidate))
      .filter((rank) => Number.isFinite(rank));
    if (!ranks.length) return '-';
    const min = Math.min(...ranks);
    const max = Math.max(...ranks);
    return `${Math.round(min).toLocaleString()}위 ~ ${Math.round(max).toLocaleString()}위`;
  }, [candidates]);

  const currentTotalScoreText = useMemo(() => {
    const score = Number(currentSpringReport?.finalScore);
    return Number.isFinite(score) ? `${formatScore(score)}점` : '-';
  }, [currentSpringReport]);

  const currentPopularityText = useMemo(() => {
    const rank = Number(currentSpringReport?.popularityRank);
    return Number.isFinite(rank) && rank > 0 ? `${Math.round(rank).toLocaleString()}위` : '-';
  }, [currentSpringReport]);

  return (
    <div className="min-h-screen flex flex-col items-center p-3 font-sans text-[var(--ns-text)]">
      <div className="bg-[var(--ns-surface)] p-5 rounded-[2rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-2xl overflow-hidden">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-[var(--ns-accent-text)]">이름을 추천드려요</h1>
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

        <section className="space-y-3">
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3">
            <p className="text-xs font-black text-[var(--ns-muted)] mb-2">현재 이름 비교 기준</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">
                {currentSpringReport?.namingReport?.name?.fullHangul || '-'}
                {currentSpringReport?.namingReport?.name?.fullHanja
                  ? ` (${currentSpringReport.namingReport.name.fullHanja})`
                  : ''}
              </p>
              {isCurrentLoading ? (
                <span className="text-xs font-semibold text-[var(--ns-muted)]">기준 정보를 계산 중...</span>
              ) : null}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)]">현재 이름 총점</p>
                <p className="text-sm font-black text-[var(--ns-accent-text)]">{currentTotalScoreText}</p>
              </div>
              <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)]">현재 이름 인기도</p>
                <p className="text-sm font-black text-[var(--ns-accent-text)]">{currentPopularityText}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3">
            <p className="text-xs font-black text-[var(--ns-muted)] mb-2">후보 요약</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)]">총점 범위</p>
                <p className="text-sm font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">{scoreRangeText}</p>
              </div>
              <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)]">인기도 범위</p>
                <p className="text-sm font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">{popularityRangeText}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-[var(--ns-muted)]">총 {candidates.length}개 후보</p>
            <div className="flex items-center gap-2">
              <label htmlFor="candidate-sort" className="text-xs font-black text-[var(--ns-muted)]">정렬</label>
              <select
                id="candidate-sort"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-sm font-bold text-[var(--ns-text)]"
              >
                <option value="score">점수순</option>
                <option value="popularity">인기도순</option>
              </select>
            </div>
          </div>

          {isLoading && (
            <div className="h-40 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-full border-4 border-[var(--ns-primary)] border-t-transparent animate-spin" />
              <p className="text-sm font-bold text-[var(--ns-muted)]">작명 중입니다. 잠시만 기다려주세요.</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="h-24 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex items-center justify-center px-4">
              <p className="text-sm font-bold text-[var(--ns-muted)] text-center">{error}</p>
            </div>
          )}

          {!isLoading && !error && (
            <ul className="max-h-[66vh] overflow-y-auto space-y-2 pr-1">
              {sortedCandidates.map((candidate, index) => {
                const popularityRank = getPopularityRank(candidate);
                return (
                  <li key={`${candidate?.rank ?? index}-${candidate?.fullHanja ?? candidate?.namingReport?.name?.fullHanja ?? index}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)]">
                    <button
                      type="button"
                      onClick={() => onOpenCombinedReport?.(candidate)}
                      className="w-full text-left px-4 py-3 hover:bg-white/60 transition-colors rounded-xl"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm md:text-base font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">
                          {getDisplayName(candidate)}
                        </p>
                        <p className="text-sm font-black text-[var(--ns-text)]">
                          최종 점수 {formatScore(candidate?.finalScore)}
                        </p>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-[var(--ns-muted)] flex justify-end">
                        인기도 {popularityRank ? `${Math.round(popularityRank).toLocaleString()}위` : '-'}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default NamingCandidatesPage;
