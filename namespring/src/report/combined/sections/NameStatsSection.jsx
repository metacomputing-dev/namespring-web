import React, { useEffect, useMemo, useState } from 'react';
import { NameStatRepository } from '@seed/database/name-stat-repository';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';
import { TimeSeriesChart } from '../../../report-modules-ui';
import {
  TOTAL_NAME_STATS_COUNT,
  getPopularityTrendLabel,
  mergeYearlyBirthBuckets,
  mergeYearlyRankBuckets,
} from '../../name-stat-utils.js';

const EMPTY_DB_STATE = {
  loading: false,
  found: false,
  similarNames: [],
  birthSeries: [],
  rankSeries: [],
  latestRank: 0,
  bestYear: 0,
  bestRank: 0,
  maleBirths: 0,
  femaleBirths: 0,
  maleRatio: 0,
  femaleRatio: 0,
};

function useNameStatDb(givenHangul) {
  const [state, setState] = useState({ ...EMPTY_DB_STATE, loading: Boolean(givenHangul) });

  useEffect(() => {
    if (!givenHangul) {
      setState(EMPTY_DB_STATE);
      return undefined;
    }
    let cancelled = false;
    const repo = new NameStatRepository();

    const run = async () => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        await repo.init();
        const stat = await repo.findByName(givenHangul);
        if (cancelled) return;
        if (!stat) {
          setState(EMPTY_DB_STATE);
          return;
        }
        const genderRatio = await repo.findGenderRatioByName(givenHangul);
        if (cancelled) return;
        const birthSeries = mergeYearlyBirthBuckets(stat.yearly_birth);
        const rankSeries = mergeYearlyRankBuckets(stat.yearly_rank);
        const latestRank = rankSeries.length ? rankSeries[rankSeries.length - 1].rank : 0;
        const best = rankSeries.length
          ? [...rankSeries].sort((a, b) => a.rank - b.rank)[0]
          : { year: 0, rank: 0 };
        setState({
          loading: false,
          found: true,
          similarNames: Array.isArray(stat.similar_names) ? stat.similar_names : [],
          birthSeries,
          rankSeries,
          latestRank,
          bestYear: best.year,
          bestRank: best.rank,
          maleBirths: genderRatio?.maleBirths ?? 0,
          femaleBirths: genderRatio?.femaleBirths ?? 0,
          maleRatio: genderRatio?.maleRatio ?? 0,
          femaleRatio: genderRatio?.femaleRatio ?? 0,
        });
      } catch {
        if (!cancelled) setState(EMPTY_DB_STATE);
      } finally {
        repo.close();
      }
    };

    run();
    return () => {
      cancelled = true;
      repo.close();
    };
  }, [givenHangul]);

  return state;
}

function StatTile({ label, value, caption }) {
  return (
    <div className="min-w-[8rem] flex-1 rounded-3xl border border-hairline bg-card p-5 text-center">
      <p className="text-xs text-inkfaint">{label}</p>
      <b className="mt-1 block text-xl" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</b>
      {caption ? <p className="mt-0.5 text-2xs text-inkfaint">{caption}</p> : null}
    </div>
  );
}

function ChartCard({ title, caption, children }) {
  return (
    <div className="rounded-3xl border border-hairline bg-card p-5">
      <p className="text-xs font-bold text-inksoft">{title}</p>
      {caption ? <p className="mt-0.5 text-2xs text-inkfaint">{caption}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function GenderSplitBar({ maleRatio, femaleRatio, maleBirths, femaleBirths }) {
  if (maleBirths + femaleBirths <= 0) return null;
  const malePercent = Math.round((maleRatio || 0) * 1000) / 10;
  const femalePercent = Math.round((femaleRatio || 0) * 1000) / 10;
  return (
    <div className="rounded-3xl border border-hairline bg-card p-5">
      <p className="text-xs font-bold text-inksoft">성별 사용 비율</p>
      <div
        className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-hairline"
        role="img"
        aria-label={`남성 ${malePercent}%, 여성 ${femalePercent}%`}
      >
        <span className="h-full bg-elwater" style={{ width: `${malePercent}%` }} />
        <span className="h-full bg-rose2" style={{ width: `${femalePercent}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span className="font-bold text-elwater">남성 {malePercent.toFixed(1)}% ({maleBirths.toLocaleString()}명)</span>
        <span className="font-bold text-rose2">여성 {femalePercent.toFixed(1)}% ({femaleBirths.toLocaleString()}명)</span>
      </div>
    </div>
  );
}

function NameStatsBody({ stats }) {
  const db = useNameStatDb(stats.givenHangul);
  const trend = useMemo(() => getPopularityTrendLabel(db.rankSeries), [db.rankSeries]);

  const currentRank = db.found && db.latestRank > 0
    ? Math.round(db.latestRank)
    : stats.popularityRank;

  const headline = useMemo(() => {
    if (db.loading) return '인기도 추세를 살펴보고 있어요.';
    if (!currentRank) return null;
    const rankText = `${Math.round(currentRank).toLocaleString()}위`;
    if (trend === '상승중') return `최근 10년 인기가 오르는 중이에요. 지금은 ${rankText}예요.`;
    if (trend === '하락중') return `최근 10년 인기가 내려오는 흐름이에요. 지금은 ${rankText}예요.`;
    if (trend === '유지') return `최근 10년 인기가 비슷하게 유지되고 있어요. 지금은 ${rankText}예요.`;
    return `출생신고 기준 인기 순위는 ${rankText}예요.`;
  }, [db.loading, currentRank, trend]);

  const tiles = [];
  if (currentRank) {
    tiles.push({
      label: '출생신고 인기',
      value: `${Math.round(currentRank).toLocaleString()}위`,
      caption: `전체 ${TOTAL_NAME_STATS_COUNT.toLocaleString()}개 이름 중`,
    });
  }
  if (db.found && db.bestRank > 0 && db.bestYear > 0) {
    tiles.push({
      label: '가장 높았던 해',
      value: `${Math.round(db.bestRank).toLocaleString()}위`,
      caption: `${db.bestYear}년`,
    });
  }
  if (stats.nameGender) {
    tiles.push({ label: '성별 경향', value: stats.nameGender === 'male' ? '남성 쪽' : '여성 쪽' });
  } else if (stats.maleRatio !== null) {
    const malePercent = Math.round(stats.maleRatio * 100);
    tiles.push({ label: '남녀 비율', value: `${malePercent}:${100 - malePercent}` });
  }

  const hasCharts = db.found && (db.birthSeries.length > 0 || db.rankSeries.length > 0);
  if (!db.loading && !tiles.length && !hasCharts) return null;

  return (
    <RevealOnScroll as="section" id="sec-stats" className="scroll-mt-32 pt-14">
      <div className="mb-4 px-1">
        <p className="mb-1 text-2xs font-medium uppercase tracking-[0.15em] text-sage">참고 정보</p>
        <h2 className="font-serif text-xl font-bold tracking-tight sm:text-2xl">이름 통계</h2>
        {headline ? <p className="mt-1 text-xs text-inkfaint">{headline}</p> : null}
      </div>

      {tiles.length ? (
        <div className="flex flex-wrap items-stretch gap-3">
          {tiles.map((tile) => (
            <StatTile key={tile.label} label={tile.label} value={tile.value} caption={tile.caption} />
          ))}
        </div>
      ) : null}

      {hasCharts ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {db.birthSeries.length ? (
            <ChartCard title="연도별 출생아 수" caption="이 이름으로 출생신고된 아기 수예요">
              <TimeSeriesChart
                points={db.birthSeries.map((item) => ({ label: `${item.year}`, value: item.value }))}
                stroke="var(--color-accent)"
                valueFormatter={(value) => Math.round(Number(value) || 0).toLocaleString()}
              />
            </ChartCard>
          ) : null}
          {db.rankSeries.length ? (
            <ChartCard title="연도별 인기 순위" caption="위쪽일수록 인기가 높아요">
              <TimeSeriesChart
                points={db.rankSeries.map((item) => ({ label: `${item.year}`, value: item.rank }))}
                stroke="var(--color-warn)"
                valueFormatter={(value) => Math.round(Number(value) || 0).toLocaleString()}
                invertMinToTop
              />
            </ChartCard>
          ) : null}
        </div>
      ) : null}

      {db.found ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GenderSplitBar
            maleRatio={db.maleRatio}
            femaleRatio={db.femaleRatio}
            maleBirths={db.maleBirths}
            femaleBirths={db.femaleBirths}
          />
          {db.similarNames.length ? (
            <div className="rounded-3xl border border-hairline bg-card p-5">
              <p className="text-xs font-bold text-inksoft">비슷한 느낌의 이름</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {db.similarNames.map((name) => (
                  <span key={name} className="rounded-full bg-parchment px-3 py-1 text-xs font-bold text-inksoft">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-center text-2xs text-inkfaint">
        이름 통계는 출생신고 데이터 기반의 참고 재미 요소예요.
      </p>
    </RevealOnScroll>
  );
}

export function NameStatsSection({ stats }) {
  if (!stats) return null;
  return <NameStatsBody stats={stats} />;
}
