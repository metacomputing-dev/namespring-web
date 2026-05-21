import React, { useEffect, useMemo, useState } from 'react';
import ReportShell from './components/report/ReportShell';
import { MetricStrip, PageHeading, SearchIcon } from './components/report/ReportPrimitives';
import {
  NAMING_CANDIDATES_CARD_THEME,
  buildReportCardStyle,
  buildTintedBoxStyle,
} from './theme/card-color-theme';

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

function getNameCardTheme(index) {
  const themes = NAMING_CANDIDATES_CARD_THEME.candidates || [];
  if (!themes.length) return null;
  return themes[index % themes.length];
}

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
    } catch {}
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

        <section className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="ns-report-surface p-4">
            <p className="text-xs font-black text-[var(--ns-muted)]">현재 이름 비교 기준</p>
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
            <MetricStrip
              className="mt-3"
              items={[
                { label: '현재 이름 총점', value: currentTotalScoreText },
                { label: '현재 이름 인기도', value: currentPopularityText },
              ]}
            />
          </div>

          <div className="ns-report-surface p-4">
            <p className="text-xs font-black text-[var(--ns-muted)]">추천 이름 요약</p>
            <MetricStrip
              className="mt-3"
              items={[
                { label: '총점 범위', value: scoreRangeText },
                { label: `인기도 범위 (전체 ${TOTAL_NAME_STATS_COUNT.toLocaleString()})`, value: popularityRangeText },
              ]}
            />
          </div>
        </section>

        <section className="ns-report-surface p-3 md:p-4">
          <div className="ns-split-row">
            <p className="text-sm font-black text-[var(--ns-muted)]">
              총 {sortedCandidates.length}개의 추천 이름을 찾았어요.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFavoriteOnly((prev) => !prev)}
                className={`${showFavoriteOnly ? 'ns-primary-button' : 'ns-secondary-button'} min-h-10 text-xs`}
              >
                즐겨찾기만
              </button>
              <div className="flex items-center gap-2">
                <label htmlFor="candidate-sort" className="text-xs font-black text-[var(--ns-muted)]">정렬</label>
                <select
                  id="candidate-sort"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className="ns-input min-h-10 w-auto bg-[var(--ns-surface-soft)] text-sm font-bold"
                >
                  <option value="recommended">추천순</option>
                  <option value="score">점수순</option>
                  <option value="popularity">인기도순</option>
                </select>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-2">
            <SearchIcon className="h-4 w-4 shrink-0 text-[var(--ns-muted)]" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="추천 이름 검색 (초성 검색 지원: 예) ㄱㅁㅎ"
              className="ns-input min-h-10 w-full min-w-0 bg-[var(--ns-surface)] text-sm font-semibold"
            />
          </div>

          {isLoading && (
            <div className="mt-3 h-40 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-full border-4 border-[var(--ns-primary)] border-t-transparent animate-spin" />
              <p className="text-sm font-bold text-[var(--ns-muted)]">작명 중입니다. 잠시만 기다려주세요.</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="mt-3 h-24 rounded-xl border border-[var(--ns-tone-warn-border)] bg-[var(--ns-tone-warn-bg)] flex items-center justify-center px-4">
              <p className="text-sm font-bold text-[var(--ns-muted)] text-center">{error}</p>
            </div>
          )}

          {!isLoading && !error && (
            <ul className="mt-3 grid gap-2">
              {sortedCandidates.map((candidate, index) => {
                const popularityRank = getPopularityRank(candidate);
                const candidateKey = getCandidateKey(candidate);
                const isFavorite = favoriteCandidateKeys.has(candidateKey);
                const cardTheme = getNameCardTheme(index);
                const cardStyle = buildReportCardStyle(cardTheme);
                const scoreMiniStyle = buildTintedBoxStyle(cardTheme, { bgAlpha: 0.36 });
                const popularityMiniStyle = buildTintedBoxStyle(cardTheme, { bgAlpha: 0.22 });
                return (
                  <li
                    key={`${candidate?.rank ?? index}-${candidate?.fullHanja ?? candidate?.namingReport?.name?.fullHanja ?? index}`}
                    className="rounded-xl border border-[var(--ns-border)] shadow-[var(--shadow-inset-soft)]"
                    style={cardStyle}
                  >
                    <div className="flex items-start gap-2 px-2.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => onOpenCombinedReport?.(candidate)}
                        className="flex-1 min-w-0 text-left rounded-lg px-2 py-1 transition-colors hover:bg-[var(--ns-surface)]/20"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm md:text-base font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">
                            {getDisplayName(candidate)}
                          </p>
                          <div className="shrink-0 rounded-lg border px-2.5 py-1 text-right text-[var(--ns-accent-text)]" style={scoreMiniStyle}>
                            <p className="text-[10px] font-black opacity-75">최종 점수</p>
                            <p className="text-sm font-black leading-none mt-0.5">{formatScore(candidate?.finalScore)}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <span
                            className="inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-black text-[var(--ns-accent-text)]"
                            style={popularityMiniStyle}
                          >
                            인기도 {popularityRank ? `${Math.round(popularityRank).toLocaleString()}위` : '-'}
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavoriteCandidate(candidateKey)}
                        aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                        title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                        className="shrink-0 mt-1 w-9 h-9 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)]/80 hover:bg-[var(--ns-surface)] text-[var(--ns-muted)] inline-flex items-center justify-center"
                      >
                        <svg viewBox="0 0 20 20" className={`w-5 h-5 ${isFavorite ? 'text-[var(--ns-tone-warn-text)]' : 'text-[var(--ns-muted)]/60'}`} aria-hidden="true">
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
            <div className="mt-3 h-24 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex items-center justify-center px-4">
              <p className="text-sm font-bold text-[var(--ns-muted)] text-center">검색/즐겨찾기 조건에 맞는 후보가 없습니다.</p>
            </div>
          )}
        </section>
      </div>
    </ReportShell>
  );
}

export default NamingCandidatesPage;
