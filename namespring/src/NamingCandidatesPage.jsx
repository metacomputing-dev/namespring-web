import React, { useEffect, useMemo, useState } from 'react';
import ReportShell from './components/report/ReportShell';
import { MetricStrip, PageHeading, SearchIcon, StatusPanel } from './components/report/ReportPrimitives';
import { BezelCard } from './components/ui/BezelCard.jsx';
import { SegmentedControl } from './components/ui/SegmentedControl.jsx';

const DEFAULT_RECOMMEND_WEIGHT_A = 0.5;
const DEFAULT_RECOMMEND_MAX_SCORE = 80;
const FAVORITE_STORAGE_KEY = 'namespring_favorite_candidate_keys';
const TOTAL_NAME_STATS_COUNT = 50194;
const CHOSEONG_LIST = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const CHOSEONG_SET = new Set(CHOSEONG_LIST);

function clamp(value, min, max) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return min;
  if (numeric === Number.POSITIVE_INFINITY) return max;
  if (numeric === Number.NEGATIVE_INFINITY) return min;
  return Math.min(max, Math.max(min, numeric));
}

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

function normalizeSearchKeyword(value) {
  return String(value ?? '').replace(/\s+/g, '').toLowerCase();
}

function getHangulInitials(value) {
  return Array.from(String(value ?? ''))
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        const offset = code - 0xac00;
        const choIndex = Math.floor(offset / 588);
        return CHOSEONG_LIST[choIndex] || '';
      }
      if (CHOSEONG_SET.has(char)) {
        return char;
      }
      return '';
    })
    .join('');
}

function isChoseongKeyword(keyword) {
  if (!keyword) return false;
  return Array.from(keyword).every((char) => CHOSEONG_SET.has(char));
}

function getCandidateKey(candidate) {
  const fullHangul = candidate?.fullHangul || candidate?.namingReport?.name?.fullHangul || '';
  const fullHanja = candidate?.fullHanja || candidate?.namingReport?.name?.fullHanja || '';
  const rank = String(candidate?.rank ?? candidate?.namingReport?.rank ?? '');
  const score = Number(candidate?.finalScore ?? 0);
  const popularity = Number(candidate?.popularityRank ?? 0);
  return `${fullHangul}|${fullHanja}|${rank}|${score.toFixed(4)}|${popularity.toFixed(4)}`;
}

function candidateMatchesSearch(candidate, keyword) {
  if (!keyword) return true;

  const fullHangul = candidate?.fullHangul || candidate?.namingReport?.name?.fullHangul || '';
  const fullHanja = candidate?.fullHanja || candidate?.namingReport?.name?.fullHanja || '';
  const display = `${fullHangul}${fullHanja}`;
  const targets = [fullHangul, fullHanja, display, getDisplayName(candidate)]
    .map((value) => normalizeSearchKeyword(value));

  if (targets.some((target) => target.includes(keyword))) {
    return true;
  }

  if (isChoseongKeyword(keyword)) {
    const initials = normalizeSearchKeyword(getHangulInitials(fullHangul));
    return initials.includes(keyword);
  }

  return false;
}

function getRecommendationSortScore(
  candidate,
  a = DEFAULT_RECOMMEND_WEIGHT_A,
  maxScore = DEFAULT_RECOMMEND_MAX_SCORE
) {
  const normalizedA = clamp(a, 0, 1);
  const b = 1 - normalizedA;

  const p = getPopularityRank(candidate) ?? Number.POSITIVE_INFINITY;
  const P = b * (1 - clamp(p / 3000, 0, 1));

  const s = Number(candidate?.finalScore);
  const safeScore = Number.isFinite(s) ? s : 0;
  const safeMaxScore = Number(maxScore) > 0 ? Number(maxScore) : DEFAULT_RECOMMEND_MAX_SCORE;
  const S = normalizedA * clamp(safeScore / safeMaxScore, 0, 1);

  return S + P;
}

const SORT_OPTIONS = [
  { value: 'recommended', label: '추천순' },
  { value: 'score', label: '점수순' },
  { value: 'popularity', label: '인기도순' },
];

function NamingCandidatesPage({ entryUserInfo, onRecommendAsync, onLoadCurrentSpringReport, onBackHome, onOpenCombinedReport }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isCurrentLoading, setIsCurrentLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortMode, setSortMode] = useState('recommended');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showFavoriteOnly, setShowFavoriteOnly] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [currentSpringReport, setCurrentSpringReport] = useState(null);
  const [favoriteCandidateKeys, setFavoriteCandidateKeys] = useState(() => {
    try {
      const raw = localStorage.getItem(FAVORITE_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.map((item) => String(item)));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITE_STORAGE_KEY, JSON.stringify(Array.from(favoriteCandidateKeys)));
    } catch {
      /* localStorage may be unavailable (private mode, quota) — favorites stay in memory. */
    }
  }, [favoriteCandidateKeys]);

  const toggleFavoriteCandidate = (candidateKey) => {
    setFavoriteCandidateKeys((prev) => {
      const next = new Set(prev);
      if (next.has(candidateKey)) {
        next.delete(candidateKey);
      } else {
        next.add(candidateKey);
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!entryUserInfo || !onRecommendAsync) {
        setCandidates([]);
        setError('입력한 정보가 없어 추천을 진행할 수 없습니다.');
        setIsLoading(false);
        return;
      }

      setSortMode('recommended');
      setSearchKeyword('');
      setShowFavoriteOnly(false);
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

  const normalizedSearchKeyword = useMemo(
    () => normalizeSearchKeyword(searchKeyword),
    [searchKeyword]
  );

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      const key = getCandidateKey(candidate);
      if (showFavoriteOnly && !favoriteCandidateKeys.has(key)) {
        return false;
      }
      if (normalizedSearchKeyword && !candidateMatchesSearch(candidate, normalizedSearchKeyword)) {
        return false;
      }
      return true;
    });
  }, [candidates, favoriteCandidateKeys, normalizedSearchKeyword, showFavoriteOnly]);

  const sortedCandidates = useMemo(() => {
    return [...filteredCandidates].sort((a, b) => {
      if (sortMode === 'recommended') {
        const aRecommend = getRecommendationSortScore(a);
        const bRecommend = getRecommendationSortScore(b);
        if (aRecommend !== bRecommend) return bRecommend - aRecommend;
      }
      if (sortMode === 'popularity') {
        const aRank = getPopularityRank(a);
        const bRank = getPopularityRank(b);
        const safeA = aRank ?? Number.POSITIVE_INFINITY;
        const safeB = bRank ?? Number.POSITIVE_INFINITY;
        if (safeA !== safeB) return safeA - safeB;
      }
      return Number(b?.finalScore ?? 0) - Number(a?.finalScore ?? 0);
    });
  }, [filteredCandidates, sortMode]);

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
    <ReportShell activeNav="naming" onHome={onBackHome} size="wide">
      <PageHeading
        kicker="Naming candidates"
        title="이름을 추천드려요"
        description="현재 이름과 비교하면서 점수, 인기도, 즐겨찾기를 한 화면에서 정리합니다."
      />
      <div className="ns-section-stack ns-section-stack--loose">

        <BezelCard as="section" faceClassName="grid gap-5 sm:grid-cols-2 sm:gap-6">
          <div className="min-w-0">
            <p className="ns-kicker">현재 이름 비교 기준</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-serif text-lg font-bold text-[var(--color-ink)] break-keep whitespace-normal">
                {currentSpringReport?.namingReport?.name?.fullHangul || '-'}
                {currentSpringReport?.namingReport?.name?.fullHanja
                  ? ` (${currentSpringReport.namingReport.name.fullHanja})`
                  : ''}
              </p>
              {isCurrentLoading ? (
                <span className="text-xs font-semibold text-[var(--color-ink-3)]">기준 정보를 계산 중...</span>
              ) : null}
            </div>
            <MetricStrip
              className="mt-3"
              items={[
                { label: '현재 이름 총점', value: currentTotalScoreText },
                { label: '현재 이름 인기도', value: currentPopularityText },
              ]}
            />
          </div>

          <div className="min-w-0 sm:border-l sm:border-[var(--color-rule)] sm:pl-6">
            <p className="ns-kicker">추천 이름 요약</p>
            <MetricStrip
              className="mt-3 ns-metric-strip--candidate-summary"
              items={[
                { label: '총점 범위', value: scoreRangeText },
                { label: `인기도 범위 (전체 ${TOTAL_NAME_STATS_COUNT.toLocaleString()})`, value: popularityRangeText },
              ]}
            />
          </div>
        </BezelCard>

        <section className="ns-report-surface p-3 md:p-4">
          <div className="ns-split-row">
            <p className="text-sm font-black text-[var(--ns-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              총 {sortedCandidates.length}개의 추천 이름을 찾았어요.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFavoriteOnly((prev) => !prev)}
                aria-pressed={showFavoriteOnly}
                className={`${showFavoriteOnly ? 'ns-primary-button' : 'ns-secondary-button'} min-h-11 rounded-full px-4 text-xs`}
              >
                즐겨찾기만
              </button>
              <SegmentedControl
                name="candidate-sort"
                value={sortMode}
                options={SORT_OPTIONS}
                onChange={setSortMode}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-field)] border border-[var(--color-rule)] bg-[var(--ns-surface-soft)] py-1 pl-3 pr-1">
            <SearchIcon className="h-4 w-4 shrink-0 text-[var(--ns-muted)]" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="추천 이름 검색 (초성 검색 지원: 예) ㄱㅁㅎ"
              className="ns-input min-h-11 w-full min-w-0 border-none bg-transparent text-sm font-semibold"
            />
          </div>

          {isLoading && (
            <div className="mt-3 h-40 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex flex-col items-center justify-center gap-3">
              <div className="ns-report-spinner" aria-hidden="true" />
              <p className="text-sm font-bold text-[var(--ns-muted)]">작명 중입니다. 잠시만 기다려주세요.</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="mt-3">
              <StatusPanel tone="warn" title="추천 결과를 표시할 수 없습니다.">
                {error}
              </StatusPanel>
            </div>
          )}

          {!isLoading && !error && (
            <ul className="mt-3 grid gap-2 xl:grid-cols-2">
              {sortedCandidates.map((candidate, index) => {
                const popularityRank = getPopularityRank(candidate);
                const candidateKey = getCandidateKey(candidate);
                const isFavorite = favoriteCandidateKeys.has(candidateKey);
                return (
                  <li
                    key={`${candidate?.rank ?? index}-${candidate?.fullHanja ?? candidate?.namingReport?.name?.fullHanja ?? index}`}
                    className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-card)] shadow-[var(--shadow-inset-soft)]"
                  >
                    <div className="flex items-start gap-2 px-2.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => onOpenCombinedReport?.(candidate)}
                        className="ns-candidate-card__button flex-1 min-w-0 text-left rounded-lg px-2 py-1 transition-colors hover:bg-[var(--color-paper-3)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm md:text-base font-black text-[var(--color-ink)] break-keep whitespace-normal">
                            {getDisplayName(candidate)}
                          </p>
                          <div
                            className="shrink-0 rounded-lg border border-[var(--color-accent-quiet)] bg-[var(--color-accent-quiet)] px-2.5 py-1 text-right text-[var(--color-accent)]"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            <p className="text-2xs font-black opacity-75">최종 점수</p>
                            <p className="text-sm font-black leading-none mt-0.5">{formatScore(candidate?.finalScore)}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <span
                            className="inline-flex items-center rounded-md border border-[var(--color-rule)] bg-[var(--color-paper-3)] px-2.5 py-1 text-2xs font-black text-[var(--color-ink-2)]"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            인기도 {popularityRank ? `${Math.round(popularityRank).toLocaleString()}위` : '-'}
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavoriteCandidate(candidateKey)}
                        aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                        aria-pressed={isFavorite}
                        title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                        className="shrink-0 w-11 h-11 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] text-[var(--ns-muted)] inline-flex items-center justify-center"
                      >
                        <svg viewBox="0 0 20 20" className={`w-5 h-5 ${isFavorite ? 'text-[var(--color-warn)]' : 'text-[var(--color-ink-3)]'}`} aria-hidden="true">
                          <path
                            d="M10 1.7L12.6 6.9L18.3 7.7L14.1 11.8L15.1 17.5L10 14.8L4.9 17.5L5.9 11.8L1.7 7.7L7.4 6.9L10 1.7Z"
                            fill={isFavorite ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!isLoading && !error && !sortedCandidates.length && (
            <div className="mt-3">
              <StatusPanel tone="neutral" title="검색/즐겨찾기 조건에 맞는 후보가 없습니다.">
                검색어를 지우거나 즐겨찾기 필터를 해제해 보세요.
              </StatusPanel>
            </div>
          )}
        </section>
      </div>
    </ReportShell>
  );
}

export default NamingCandidatesPage;
