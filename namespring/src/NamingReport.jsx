import React, { useEffect, useMemo, useState } from 'react';
import { NameStatRepository } from '@seed/database/name-stat-repository';
import { createPortal } from 'react-dom';

const TOTAL_NAME_STATS_COUNT = 50194;
const ELEMENT_ORDER = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

const ELEMENT_LABEL = {
  Wood: '목',
  Fire: '화',
  Earth: '토',
  Metal: '금',
  Water: '수',
};

const ELEMENT_SOFT = {
  Wood: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Fire: 'bg-rose-50 text-rose-700 border-rose-200',
  Earth: 'bg-amber-50 text-amber-700 border-amber-200',
  Metal: 'bg-slate-100 text-slate-700 border-slate-200',
  Water: 'bg-blue-50 text-blue-700 border-blue-200',
};

const POLARITY_SOFT = {
  양: 'bg-orange-50 text-orange-700 border-orange-200',
  음: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function getBlocks(calculator) {
  if (!calculator || typeof calculator.getNameBlocks !== 'function') return [];
  return calculator.getNameBlocks();
}

function getFrames(calculator) {
  if (!calculator || typeof calculator.getFrames !== 'function') return [];
  return calculator.getFrames();
}

function getCalculatorScore(calculator) {
  if (!calculator || typeof calculator.getScore !== 'function') return 0;
  const score = Number(calculator.getScore());
  return Number.isFinite(score) ? score : 0;
}

function normalizeElement(element) {
  const raw = typeof element === 'object'
    ? element?.english || element?.korean || ''
    : String(element ?? '');
  const value = raw.trim().toLowerCase();
  if (value === 'wood' || value === '목' || value === '나무') return 'Wood';
  if (value === 'fire' || value === '화' || value === '불') return 'Fire';
  if (value === 'earth' || value === '토' || value === '흙') return 'Earth';
  if (value === 'metal' || value === '금' || value === '쇠') return 'Metal';
  if (value === 'water' || value === '수' || value === '물') return 'Water';
  return '';
}

function polarityLabel(polarity) {
  const raw = typeof polarity === 'object'
    ? polarity?.english || polarity?.korean || ''
    : String(polarity ?? '');
  const value = raw.trim().toLowerCase();
  if (value === 'positive' || value === '양') return '양';
  if (value === 'negative' || value === '음') return '음';
  return '-';
}

function summarizeEnergies(items) {
  const elementCounts = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  let positive = 0;
  let negative = 0;

  for (const item of items) {
    const key = normalizeElement(item?.energy?.element);
    if (key) elementCounts[key] += 1;
    const p = polarityLabel(item?.energy?.polarity);
    if (p === '양') positive += 1;
    if (p === '음') negative += 1;
  }

  return { elementCounts, positive, negative };
}

function getElementSoftClass(el) {
  return ELEMENT_SOFT[el] || 'bg-slate-100 text-slate-700 border-slate-200';
}

function getPolaritySoftClass(pol) {
  return POLARITY_SOFT[pol] || 'bg-slate-100 text-slate-700 border-slate-200';
}

function frameTypeLabel(type) {
  if (type === 'won') return '원격';
  if (type === 'hyung') return '형격';
  if (type === 'lee') return '이격';
  if (type === 'jung') return '정격';
  return '-';
}

function lifePhaseLabel(type) {
  if (type === 'won') return '초년';
  if (type === 'hyung') return '중년';
  if (type === 'lee') return '말년';
  if (type === 'jung') return '전체';
  return '-';
}

function getScoreGrade(score) {
  if (score >= 85) return '매우 균형이 좋은 이름';
  if (score >= 70) return '안정적인 균형의 이름';
  if (score >= 55) return '무난한 흐름의 이름';
  return '보완이 필요한 이름';
}

function mergeYearlyBirthBuckets(yearlyBirth) {
  const source = yearlyBirth || {};
  const totalBucket = source?.전체;
  if (totalBucket && typeof totalBucket === 'object' && !Array.isArray(totalBucket)) {
    return Object.entries(totalBucket)
      .map(([year, value]) => ({ year: Number(year), value: Number(value) }))
      .filter((item) => !Number.isNaN(item.year) && !Number.isNaN(item.value))
      .sort((a, b) => a.year - b.year);
  }

  const byYear = {};
  for (const [key, bucket] of Object.entries(source)) {
    const flatYear = Number(key);
    const flatValue = Number(bucket);
    if (!Number.isNaN(flatYear) && !Number.isNaN(flatValue)) {
      byYear[flatYear] = (byYear[flatYear] || 0) + flatValue;
      continue;
    }
    if (!bucket || typeof bucket !== 'object') continue;
    for (const [year, value] of Object.entries(bucket)) {
      const y = Number(year);
      const v = Number(value);
      if (Number.isNaN(y) || Number.isNaN(v)) continue;
      byYear[y] = (byYear[y] || 0) + v;
    }
  }
  return Object.entries(byYear)
    .map(([year, value]) => ({ year: Number(year), value: Number(value) }))
    .sort((a, b) => a.year - b.year);
}

function mergeYearlyRankBuckets(yearlyRank) {
  const source = yearlyRank || {};
  const totalBucket = source?.전체;
  if (totalBucket && typeof totalBucket === 'object' && !Array.isArray(totalBucket)) {
    return Object.entries(totalBucket)
      .map(([year, rank]) => ({ year: Number(year), rank: Number(rank) }))
      .filter((item) => !Number.isNaN(item.year) && !Number.isNaN(item.rank))
      .sort((a, b) => a.year - b.year);
  }

  const byYear = {};
  for (const [key, bucket] of Object.entries(source)) {
    const flatYear = Number(key);
    const flatValue = Number(bucket);
    if (!Number.isNaN(flatYear) && !Number.isNaN(flatValue)) {
      byYear[flatYear] = byYear[flatYear] || [];
      byYear[flatYear].push(flatValue);
      continue;
    }
    if (!bucket || typeof bucket !== 'object') continue;
    for (const [year, value] of Object.entries(bucket)) {
      const y = Number(year);
      const v = Number(value);
      if (Number.isNaN(y) || Number.isNaN(v)) continue;
      byYear[y] = byYear[y] || [];
      byYear[y].push(v);
    }
  }
  return Object.entries(byYear)
    .map(([year, arr]) => {
      const values = Array.isArray(arr) ? arr : [];
      const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
      return { year: Number(year), rank: avg };
    })
    .sort((a, b) => a.year - b.year);
}

function getPopularityTrendLabel(rankSeries) {
  if (!rankSeries.length) return '';
  const recent = rankSeries.slice(-10);
  if (recent.length < 2) return '';
  const first = recent[0].rank;
  const last = recent[recent.length - 1].rank;
  if (last < first) return '상승중';
  if (last > first) return '하락중';
  return '유지';
}

function buildSeriesPath(series, width, height, valueKey, invertMinToTop = false, padding = 12) {
  if (!series.length) return '';
  const values = series.map((item) => Number(item?.[valueKey] ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xSpan = Math.max(1, series.length - 1);

  const points = series.map((item, idx) => {
    const x = padding + (idx / xSpan) * (width - padding * 2);
    const value = Number(item?.[valueKey] ?? 0);
    const ratio = (value - min) / span;
    const y = invertMinToTop
      ? padding + ratio * (height - padding * 2)
      : height - padding - ratio * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `M ${points.join(' L ')}`;
}

function YearlySeriesChart({
  title,
  subtitle,
  series,
  valueKey,
  unit,
  tone = 'emerald',
  invertMinToTop = false,
}) {
  const width = 520;
  const height = 170;
  const sorted = [...series].sort((a, b) => a.year - b.year);
  const line = buildSeriesPath(sorted, width, height, valueKey, invertMinToTop, 14);
  const area = line ? `${line} L ${width - 14},${height - 14} L 14,${height - 14} Z` : '';

  const toneClass = tone === 'indigo'
    ? {
        border: 'border-indigo-200',
        bg: 'bg-indigo-50',
        title: 'text-indigo-700',
        line: '#4f46e5',
        area: 'rgba(99, 102, 241, 0.18)',
      }
    : {
        border: 'border-amber-200',
        bg: 'bg-amber-50',
        title: 'text-amber-700',
        line: '#d97706',
        area: 'rgba(245, 158, 11, 0.2)',
      };

  const firstYear = sorted.length ? sorted[0].year : '-';
  const lastYear = sorted.length ? sorted[sorted.length - 1].year : '-';
  const latestValue = sorted.length ? Number(sorted[sorted.length - 1][valueKey]) : 0;

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass.border} ${toneClass.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-[11px] font-black ${toneClass.title}`}>{title}</p>
        <p className={`text-xs font-semibold ${toneClass.title}`}>{subtitle}</p>
      </div>
      {sorted.length ? (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36">
            {area ? <path d={area} fill={toneClass.area} /> : null}
            {line ? <path d={line} fill="none" stroke={toneClass.line} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
          </svg>
          <div className="flex items-center justify-between text-xs">
            <span className={toneClass.title}>{firstYear}년</span>
            <span className={`${toneClass.title} font-black`}>최근 {Math.round(latestValue).toLocaleString()}{unit}</span>
            <span className={toneClass.title}>{lastYear}년</span>
          </div>
        </>
      ) : (
        <p className={`text-sm font-semibold ${toneClass.title}`}>표시할 시계열 데이터가 없습니다.</p>
      )}
    </div>
  );
}

function replaceNamePlaceholder(value, fullName) {
  if (typeof value !== 'string') return value;
  return value.replace(/\[성함\]/g, fullName);
}

function MetaInfoCard({ title, value, tone = 'default' }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-800'
          : 'border-[var(--ns-border)] bg-[var(--ns-surface)] text-[var(--ns-muted)]';

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneClass}`}>
      <p className="text-[11px] font-black mb-1">{title}</p>
      <p className="text-sm font-semibold leading-relaxed">{value || '-'}</p>
    </div>
  );
}

function getFrameDetailScores(frames, index) {
  const current = frames[index];
  const next = frames[(index + 1) % frames.length];
  if (!current?.energy || !next?.energy) {
    return { polarity: 0, element: 0, final: 0 };
  }

  const pair = [current.energy, next.energy];

  let polarityRaw = 0;
  for (const energy of pair) {
    const p = polarityLabel(energy?.polarity);
    polarityRaw += p === '양' ? 1 : -1;
  }
  const polarityScore = (pair.length - Math.abs(polarityRaw)) * 100 / pair.length;

  const currentElement = pair[0].element;
  const nextElement = pair[1].element;
  let elementScore = 70;
  if (currentElement?.isGenerating?.(nextElement)) {
    elementScore += 15;
  } else if (currentElement?.isOvercoming?.(nextElement)) {
    elementScore -= 20;
  } else if (currentElement?.isSameAs?.(nextElement)) {
    elementScore -= 5;
  }
  elementScore = Math.max(0, Math.min(100, elementScore));

  return {
    polarity: polarityScore,
    element: elementScore,
    final: polarityScore * 0.5 + elementScore * 0.5,
  };
}

function CollapseCard({ title, subtitle, open, onToggle, children }) {
  return (
    <section className="bg-[var(--ns-surface)] rounded-[2rem] border border-[var(--ns-border)] shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-lg font-black text-[var(--ns-accent-text)]">{title}</h3>
          {subtitle ? <p className="text-sm text-[var(--ns-muted)] mt-1 break-keep whitespace-normal">{subtitle}</p> : null}
        </div>
        <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface-soft)]">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className={`w-4 h-4 text-[var(--ns-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </section>
  );
}

function SummaryBadges({ items }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item.key} className={`px-2.5 py-1 rounded-full border text-xs font-black whitespace-nowrap ${item.className}`}>
          {item.label}
        </span>
      ))}
    </div>
  );
}

function GenderRatioPie({ maleRatio, femaleRatio, maleBirths, femaleBirths }) {
  const hasData = (maleBirths + femaleBirths) > 0;
  const malePercent = Math.round((maleRatio || 0) * 1000) / 10;
  const femalePercent = Math.round((femaleRatio || 0) * 1000) / 10;
  const pieStyle = {
    background: `conic-gradient(#3b82f6 0 ${(maleRatio || 0) * 360}deg, #ec4899 ${(maleRatio || 0) * 360}deg 360deg)`,
  };

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
      <p className="text-[11px] font-black text-violet-700 mb-2">성별 사용 비율</p>
      {hasData ? (
        <div className="flex items-center justify-center gap-5">
          <div className="relative w-20 h-20 rounded-full shadow-inner" style={pieStyle}>
            <div className="absolute inset-3 rounded-full bg-violet-50" />
          </div>
          <div className="space-y-1 text-sm text-center">
            <p className="font-black text-blue-700">남성 {malePercent.toFixed(1)}% ({maleBirths.toLocaleString()}명)</p>
            <p className="font-black text-pink-700">여성 {femalePercent.toFixed(1)}% ({femaleBirths.toLocaleString()}명)</p>
          </div>
        </div>
      ) : (
        <p className="text-sm font-semibold text-violet-700 text-center">성별 비율 데이터가 없습니다.</p>
      )}
    </div>
  );
}

const NamingReport = ({ result, onNewAnalysis }) => {
  if (!result) return null;

  const [openCards, setOpenCards] = useState({
    popularity: false,
    lifeFlow: false,
    fourFrame: false,
    hanja: false,
    hangul: false,
  });
  const [openLifeDetails, setOpenLifeDetails] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [popularityState, setPopularityState] = useState({
    loading: true,
    error: '',
    found: false,
    similarNames: [],
    birthSeries: [],
    rankSeries: [],
    latestBirth: 0,
    latestRank: 0,
    bestYear: 0,
    bestRank: 0,
    maleBirths: 0,
    femaleBirths: 0,
    maleRatio: 0,
    femaleRatio: 0,
  });

  const { lastName, firstName, totalScore, hanja, hangul, fourFrames, interpretation } = result;
  const fullEntries = [...lastName, ...firstName];
  const fullNameHanja = fullEntries.map((v) => v.hanja).join('');
  const fullNameHangul = fullEntries.map((v) => v.hangul).join('');
  const firstNameHangul = firstName.map((v) => v.hangul).join('');

  const score = Number(totalScore ?? 0);
  const scoreText = Number.isFinite(score) ? score.toFixed(1) : '0.0';

  const hangulBlocks = getBlocks(hangul);
  const hanjaBlocks = getBlocks(hanja);
  const frameBlocks = getFrames(fourFrames);
  const lifeFlowBlocks = useMemo(() => {
    const order = { jung: 0, won: 1, hyung: 2, lee: 3 };
    return [...frameBlocks].sort((a, b) => (order[a?.type] ?? 99) - (order[b?.type] ?? 99));
  }, [frameBlocks]);

  const hangulScore = getCalculatorScore(hangul);
  const hanjaScore = getCalculatorScore(hanja);
  const fourFrameScore = getCalculatorScore(fourFrames);

  const hangulPolarityScore = Number(hangul?.polarityScore ?? 0);
  const hangulElementScore = Number(hangul?.elementScore ?? 0);
  const hanjaPolarityScore = Number(hanja?.polarityScore ?? 0);
  const hanjaElementScore = Number(hanja?.elementScore ?? 0);
  const fourFrameLuckScore = Number(fourFrames?.luckScore ?? 0);

  const hangulSummary = useMemo(() => summarizeEnergies(hangulBlocks), [hangulBlocks]);
  const hanjaSummary = useMemo(() => summarizeEnergies(hanjaBlocks), [hanjaBlocks]);
  const frameSummary = useMemo(() => summarizeEnergies(frameBlocks), [frameBlocks]);
  const popularityTrend = useMemo(
    () => getPopularityTrendLabel(popularityState.rankSeries),
    [popularityState.rankSeries]
  );
  const popularityHeadline = useMemo(() => {
    if (popularityState.loading) return '인기도 추세를 분석하고 있어요.';
    if (!popularityState.found || popularityState.error) return '현재 이름에 대한 인기도 해석 정보를 찾지 못했어요.';
    const latestRank = Math.round(popularityState.latestRank);
    const prefix = latestRank > 0 && latestRank <= 1000 ? '인기있는 이름입니다. ' : '';
    if (!popularityTrend) return `${prefix}현재 인기도는 ${latestRank.toLocaleString()}위입니다.`;
    if (popularityTrend === '상승중') return `${prefix}최근 10년 인기도가 상승 중이며, 현재 ${latestRank.toLocaleString()}위입니다.`;
    if (popularityTrend === '하락중') return `${prefix}최근 10년 인기도가 하락 추세이며, 현재 ${latestRank.toLocaleString()}위입니다.`;
    return `${prefix}최근 10년 인기도는 유지 흐름이며, 현재 ${latestRank.toLocaleString()}위입니다.`;
  }, [popularityState.loading, popularityState.found, popularityState.error, popularityState.latestRank, popularityTrend]);

  const toggleCard = (key) => {
    setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleLifeDetail = (idx) => {
    setOpenLifeDetails((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  useEffect(() => {
    let cancelled = false;
    const repo = new NameStatRepository();

    const run = async () => {
      setPopularityState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        await repo.init();
        const stat = await repo.findByName(firstNameHangul);
        if (cancelled) return;
        if (!stat) {
          setPopularityState({
            loading: false,
            error: '',
            found: false,
            similarNames: [],
            birthSeries: [],
            rankSeries: [],
            latestBirth: 0,
            latestRank: 0,
            bestYear: 0,
            bestRank: 0,
            maleBirths: 0,
            femaleBirths: 0,
            maleRatio: 0,
            femaleRatio: 0,
          });
          return;
        }

        const genderRatio = await repo.findGenderRatioByName(firstNameHangul);
        const birthSeries = mergeYearlyBirthBuckets(stat.yearly_birth);
        const rankSeries = mergeYearlyRankBuckets(stat.yearly_rank);
        const latestBirth = birthSeries.length ? birthSeries[birthSeries.length - 1].value : 0;
        const latestRank = rankSeries.length ? rankSeries[rankSeries.length - 1].rank : 0;
        const best = rankSeries.length
          ? [...rankSeries].sort((a, b) => a.rank - b.rank)[0]
          : { year: 0, rank: 0 };

        setPopularityState({
          loading: false,
          error: '',
          found: true,
          similarNames: Array.isArray(stat.similar_names) ? stat.similar_names : [],
          birthSeries,
          rankSeries,
          latestBirth,
          latestRank,
          bestYear: best.year,
          bestRank: best.rank,
          maleBirths: genderRatio?.maleBirths ?? 0,
          femaleBirths: genderRatio?.femaleBirths ?? 0,
          maleRatio: genderRatio?.maleRatio ?? 0,
          femaleRatio: genderRatio?.femaleRatio ?? 0,
        });
      } catch (err) {
        if (cancelled) return;
        setPopularityState({
          loading: false,
          error: err instanceof Error ? err.message : '인기도 통계를 불러오지 못했습니다.',
          found: false,
          similarNames: [],
          birthSeries: [],
          rankSeries: [],
          latestBirth: 0,
          latestRank: 0,
          bestYear: 0,
          bestRank: 0,
          maleBirths: 0,
          femaleBirths: 0,
          maleRatio: 0,
          femaleRatio: 0,
        });
      } finally {
        repo.close();
      }
    };

    run();
    return () => {
      cancelled = true;
      repo.close();
    };
  }, [firstNameHangul]);

  useEffect(() => {
    const onScroll = () => {
      const top = window.scrollY
        || document.documentElement.scrollTop
        || document.body.scrollTop
        || document.getElementById('root')?.scrollTop
        || 0;
      setShowScrollTop(top > 280);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, []);

  return (
    <>
    <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <section className="bg-[var(--ns-surface)] rounded-[2.4rem] p-4 md:p-5 border border-[var(--ns-border)] shadow-xl relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-[var(--ns-primary)]/15 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.22em] text-[var(--ns-muted)] font-black mb-3">이름 평가 요약</p>
            <h2 className="text-4xl md:text-5xl font-black text-[var(--ns-accent-text)]">{fullNameHangul}</h2>
            <p className="text-xl md:text-2xl text-[var(--ns-muted)] font-semibold mt-1">{fullNameHanja}</p>
            <p className="text-[var(--ns-muted)] mt-2 leading-relaxed">{interpretation || getScoreGrade(score)}</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-sm text-[var(--ns-muted)] font-bold mb-1">종합 점수</p>
            <div className="text-6xl md:text-7xl font-black text-[var(--ns-accent-text)] leading-none">{scoreText}</div>
            <p className="text-sm text-[var(--ns-muted)] font-semibold mt-2">{getScoreGrade(score)}</p>
          </div>
        </div>
      </section>

      <CollapseCard
        title="인기도"
        subtitle={popularityHeadline}
        open={openCards.popularity}
        onToggle={() => toggleCard('popularity')}
      >

        {popularityState.loading ? (
          <div className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4 text-sm font-semibold text-[var(--ns-muted)]">
            인기도 통계를 불러오는 중입니다...
          </div>
        ) : null}

        {!popularityState.loading && popularityState.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {popularityState.error}
          </div>
        ) : null}

        {!popularityState.loading && !popularityState.error && !popularityState.found ? (
          <div className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4 text-sm font-semibold text-[var(--ns-muted)]">
            현재 이름에 대한 통계 데이터가 없습니다.
          </div>
        ) : null}

        {!popularityState.loading && popularityState.found ? (
          <div className="space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-black text-blue-700 mb-1">인기도 및 인기 추세</p>
              <div className="flex flex-wrap items-center gap-2 text-sm break-keep">
                <span className="font-black text-blue-800">
                  현재인기도: {Math.round(popularityState.latestRank).toLocaleString()}순위 (전체 {TOTAL_NAME_STATS_COUNT})
                </span>
                {popularityTrend ? (
                  <>
                    <span className="text-blue-700">·</span>
                    <span className="font-black text-blue-800">최근 10년 추세: {popularityTrend}</span>
                  </>
                ) : null}
              </div>
            </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[11px] font-black text-emerald-700 mb-2">유사 이름 리스트</p>
              {popularityState.similarNames.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {popularityState.similarNames.map((name) => (
                    <span key={name} className="px-2 py-0.5 rounded-full text-xs font-black border border-emerald-200 bg-white text-emerald-800 whitespace-nowrap">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-semibold text-emerald-800">유사 이름 정보가 없습니다.</p>
              )}
            </div>

            <GenderRatioPie
              maleRatio={popularityState.maleRatio}
              femaleRatio={popularityState.femaleRatio}
              maleBirths={popularityState.maleBirths}
              femaleBirths={popularityState.femaleBirths}
            />

            <YearlySeriesChart
              title="연도별 출생아 수"
              subtitle="연도 내림차순 데이터 기반"
              series={popularityState.birthSeries}
              valueKey="value"
              unit="명"
              tone="amber"
            />

            <YearlySeriesChart
              title="연도별 인기도 순위"
              subtitle="높을수록 인기"
              series={popularityState.rankSeries.map((item) => ({
                ...item,
                popularity: Math.max(0, TOTAL_NAME_STATS_COUNT - Number(item.rank) + 1),
              }))}
              valueKey="popularity"
              unit="점"
              tone="indigo"
              invertMinToTop
            />
          </div>
        ) : null}
      </CollapseCard>

      <CollapseCard
        title="인생의 흐름"
        subtitle="사격수리의 원·형·이·정을 기준으로 초중말년과 전체 흐름을 풀어봅니다."
        open={openCards.lifeFlow}
        onToggle={() => toggleCard('lifeFlow')}
      >

        <div className="space-y-4">
          {lifeFlowBlocks.map((frame, idx) => {
            const el = normalizeElement(frame?.energy?.element);
            const pol = polarityLabel(frame?.energy?.polarity);
            const entry = frame?.entry;
            const isOpen = Boolean(openLifeDetails[idx]);
            const titleText = replaceNamePlaceholder(entry?.title || '흐름 해석 준비중', fullNameHangul);
            const summaryText = replaceNamePlaceholder(entry?.summary || '해당 수리의 기본 의미를 불러오는 중입니다.', fullNameHangul);
            const detailedText = replaceNamePlaceholder(entry?.detailed_explanation || '', fullNameHangul);
            const positiveText = replaceNamePlaceholder(entry?.positive_aspects || '', fullNameHangul);
            const cautionText = replaceNamePlaceholder(entry?.caution_points || '', fullNameHangul);
            const lifePeriodText = replaceNamePlaceholder(entry?.life_period_influence || '', fullNameHangul);
            const challengeText = replaceNamePlaceholder(entry?.challenge_period || '', fullNameHangul);
            const opportunityText = replaceNamePlaceholder(entry?.opportunity_area || '', fullNameHangul);
            const luckyLevelText = replaceNamePlaceholder(entry?.lucky_level || '', fullNameHangul);
            const personalityText = Array.isArray(entry?.personality_traits)
              ? entry.personality_traits.map((item) => replaceNamePlaceholder(item, fullNameHangul)).join(', ')
              : '';
            const careerText = Array.isArray(entry?.suitable_career)
              ? entry.suitable_career.map((item) => replaceNamePlaceholder(item, fullNameHangul)).join(', ')
              : '';
            return (
              <article key={`life-flow-${idx}`} className="rounded-2xl border border-[var(--ns-border)] bg-gradient-to-b from-[var(--ns-surface)] to-[var(--ns-surface-soft)] p-2.5 md:p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[var(--ns-accent-text)]">{lifePhaseLabel(frame?.type)} · {frameTypeLabel(frame?.type)} ({frame?.strokeSum}수)</p>
                    <p className="text-base font-black text-[var(--ns-text)] mt-1 break-keep whitespace-normal">{titleText}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${el ? getElementSoftClass(el) : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{el ? ELEMENT_LABEL[el] : '-'}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${getPolaritySoftClass(pol)}`}>{pol}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-2">
                  <p className="text-sm text-[var(--ns-muted)] leading-relaxed break-keep whitespace-normal">{summaryText}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleLifeDetail(idx)}
                  className="w-full rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-2 text-sm font-black text-[var(--ns-muted)] text-left flex items-center justify-between"
                >
                  <span>상세 해석</span>
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >
                    <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {isOpen ? (
                  <div className="space-y-3">
                    {entry?.detailed_explanation ? (
                      <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-2">
                        <p className="text-sm text-[var(--ns-muted)] leading-relaxed break-keep whitespace-normal">{detailedText}</p>
                      </div>
                    ) : null}

                    <div className="space-y-2.5 text-sm">
                      {entry?.positive_aspects ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-2.5 py-2">
                          <p className="text-xs font-black mb-1">강점</p>
                          <p className="leading-relaxed font-semibold break-keep whitespace-normal">{positiveText}</p>
                        </div>
                      ) : null}
                      {entry?.caution_points ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-2.5 py-2">
                          <p className="text-xs font-black mb-1">유의점</p>
                          <p className="leading-relaxed font-semibold break-keep whitespace-normal">{cautionText}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2.5">
                      {entry?.personality_traits?.length ? (
                        <MetaInfoCard title="성향" value={personalityText} tone="blue" />
                      ) : null}
                      {entry?.suitable_career?.length ? (
                        <MetaInfoCard title="적성 분야" value={careerText} tone="emerald" />
                      ) : null}
                      {entry?.life_period_influence ? (
                        <MetaInfoCard title="인생 구간 영향" value={lifePeriodText} tone="default" />
                      ) : null}
                      {entry?.opportunity_area ? (
                        <MetaInfoCard title="기회 영역" value={opportunityText} tone="amber" />
                      ) : null}
                      {entry?.challenge_period ? (
                        <MetaInfoCard title="도전 구간" value={challengeText} tone="default" />
                      ) : null}
                      {entry?.lucky_level ? (
                        <MetaInfoCard title="길흉 단계" value={luckyLevelText} tone="default" />
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </CollapseCard>

      <CollapseCard
        title={`사격수리 평가 (${fourFrameScore.toFixed(1)}점)`}
        subtitle="클릭해서 상세 점수와 프레임별 값을 확인하세요."
        open={openCards.fourFrame}
        onToggle={() => toggleCard('fourFrame')}
      >
        <div className="space-y-4">
          <SummaryBadges
            items={[
              { key: 'p', label: `양 ${frameSummary.positive}`, className: getPolaritySoftClass('양') },
              { key: 'n', label: `음 ${frameSummary.negative}`, className: getPolaritySoftClass('음') },
              ...ELEMENT_ORDER.map((el) => ({
                key: `e-${el}`,
                label: `${ELEMENT_LABEL[el]} ${frameSummary.elementCounts[el]}`,
                className: getElementSoftClass(el),
              })),
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">길흉 점수: {fourFrameLuckScore.toFixed(1)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">최종 점수: {fourFrameScore.toFixed(1)}</div>
          </div>
          <div className="space-y-2">
            {frameBlocks.map((frame, idx) => {
              const el = normalizeElement(frame?.energy?.element);
              const pol = polarityLabel(frame?.energy?.polarity);
              const detail = getFrameDetailScores(frameBlocks, idx);
              return (
                <div key={`f-row-${idx}`} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-3 text-sm space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">{frameTypeLabel(frame?.type)} ({frame?.strokeSum}수)</span>
                    <div className="flex gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${el ? getElementSoftClass(el) : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{el ? ELEMENT_LABEL[el] : '-'}</span>
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${getPolaritySoftClass(pol)}`}>{pol}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-black">
                    <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2 py-1 text-[var(--ns-muted)]">음양 {detail.polarity.toFixed(1)}</div>
                    <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2 py-1 text-[var(--ns-muted)]">오행 {detail.element.toFixed(1)}</div>
                    <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2 py-1 text-[var(--ns-accent-text)]">최종 {detail.final.toFixed(1)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CollapseCard>

      <CollapseCard
        title={`한자 평가 (${hanjaScore.toFixed(1)}점)`}
        subtitle="클릭해서 음양/오행 점수와 글자별 결과를 확인하세요."
        open={openCards.hanja}
        onToggle={() => toggleCard('hanja')}
      >
        <div className="space-y-4">
          <SummaryBadges
            items={[
              { key: 'p', label: `양 ${hanjaSummary.positive}`, className: getPolaritySoftClass('양') },
              { key: 'n', label: `음 ${hanjaSummary.negative}`, className: getPolaritySoftClass('음') },
              ...ELEMENT_ORDER.map((el) => ({
                key: `e-${el}`,
                label: `${ELEMENT_LABEL[el]} ${hanjaSummary.elementCounts[el]}`,
                className: getElementSoftClass(el),
              })),
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">음양 점수: {hanjaPolarityScore.toFixed(1)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">오행 점수: {hanjaElementScore.toFixed(1)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">최종 점수: {hanjaScore.toFixed(1)}</div>
          </div>
          <div className="space-y-2">
            {hanjaBlocks.map((block, idx) => {
              const el = normalizeElement(block?.energy?.element || block?.entry?.resource_element);
              const pol = polarityLabel(block?.energy?.polarity);
              return (
                <div key={`j-row-${idx}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2 text-sm">
                  <span className="font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">{block?.entry?.hanja || '-'} ({block?.entry?.strokes ?? '-'}획)</span>
                  <div className="flex gap-1.5 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${el ? getElementSoftClass(el) : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{el ? ELEMENT_LABEL[el] : '-'}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${getPolaritySoftClass(pol)}`}>{pol}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CollapseCard>

      <CollapseCard
        title={`한글 평가 (${hangulScore.toFixed(1)}점)`}
        subtitle="클릭해서 음양/오행 점수와 음절별 결과를 확인하세요."
        open={openCards.hangul}
        onToggle={() => toggleCard('hangul')}
      >
        <div className="space-y-4">
          <SummaryBadges
            items={[
              { key: 'p', label: `양 ${hangulSummary.positive}`, className: getPolaritySoftClass('양') },
              { key: 'n', label: `음 ${hangulSummary.negative}`, className: getPolaritySoftClass('음') },
              ...ELEMENT_ORDER.map((el) => ({
                key: `e-${el}`,
                label: `${ELEMENT_LABEL[el]} ${hangulSummary.elementCounts[el]}`,
                className: getElementSoftClass(el),
              })),
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">음양 점수: {hangulPolarityScore.toFixed(1)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">오행 점수: {hangulElementScore.toFixed(1)}</div>
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3 font-black text-[var(--ns-muted)]">최종 점수: {hangulScore.toFixed(1)}</div>
          </div>
          <div className="space-y-2">
            {hangulBlocks.map((block, idx) => {
              const el = normalizeElement(block?.energy?.element);
              const pol = polarityLabel(block?.energy?.polarity);
              return (
                <div key={`h-row-${idx}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-3 py-2 text-sm">
                  <span className="font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">{block?.entry?.hangul || '-'} ({block?.entry?.nucleus || '-'})</span>
                  <div className="flex gap-1.5 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${el ? getElementSoftClass(el) : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{el ? ELEMENT_LABEL[el] : '-'}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${getPolaritySoftClass(pol)}`}>{pol}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CollapseCard>

      <div className="flex gap-4 pt-2">
        <button
          onClick={() => window.print()}
          className="flex-1 py-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl font-black text-[var(--ns-muted)] hover:bg-[var(--ns-surface-soft)] active:scale-95 transition-all"
        >
          인쇄하기
        </button>
        <button
          onClick={() => (onNewAnalysis ? onNewAnalysis() : window.location.reload())}
          className="flex-1 py-4 bg-[var(--ns-primary)] text-[var(--ns-accent-text)] rounded-2xl font-black shadow-lg hover:brightness-95 active:scale-95 transition-all"
        >
          다시 분석하기
        </button>
      </div>

    </div>
    {showScrollTop
      ? createPortal(
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
              document.body.scrollTo({ top: 0, behavior: 'smooth' });
              document.getElementById('root')?.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="최상단으로 이동"
            className="ns-scroll-top-fab w-12 h-12 rounded-full border border-[var(--ns-border)] bg-[var(--ns-surface)] text-[var(--ns-muted)] shadow-xl inline-flex items-center justify-center"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
              <path d="M10 4L4.5 9.5M10 4L15.5 9.5M10 4V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>,
          document.body
        )
      : null}
    </>
  );
};

export default NamingReport;
