import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReportSurfaceSelectionV1 } from '@spring/report/delivery/types';
import {
  NameStatRepository,
  type NameGenderRatioEntry,
} from '@seed/database/name-stat-repository';
import type { NameStatEntry } from '@seed/database/name-stat-row';
import { getFourframeMeaningByNumber } from '@seed/fourframe-catalog';
import { KOREA_ANNUAL_BIRTHS } from '../model/korea-births';
import { useDelivery } from '../engine/useDelivery';
import { factOfKind, factsOfKind, type DeliveryIndex } from '../model/facts';
import { fullHangulName, type V3Profile } from '../model/profile';
import {
  ElementBadge,
  Loading,
  OverrideBanner,
  ReportActions,
  ReportFootnote,
  Section,
  TermToggle,
  useTerms,
} from '../ui/primitives';

const SURFACES: ReportSurfaceSelectionV1[] = [{ id: 'naming', depth: 'standard' }];

let statRepo: NameStatRepository | null = null;
let statInit: Promise<void> | null = null;
function getStatRepo() {
  if (!statRepo) {
    statRepo = new NameStatRepository();
    statInit = statRepo.init();
  }
  return { repo: statRepo, ready: statInit! };
}

/* ---------- 글자 카드 ---------- */

function CharacterCards({ index }: { index: DeliveryIndex }) {
  const characters = factsOfKind(index, 'name_character');
  if (characters.length === 0) return null;
  return (
    <div className="v3-char-cards">
      {characters.map(fact => (
        <div key={fact.id} className="v3-card v3-char-card">
          <div className="v3-char-card-glyph">
            {fact.hanja ?? fact.hangul}
            <small>{fact.hanja ? fact.hangul : ''}</small>
          </div>
          <div className="v3-char-card-body">
            {fact.meaning ? <strong>{fact.meaning}</strong> : <strong>{fact.hangul}</strong>}
            <span className="v3-hint">
              {[
                fact.strokes ? `${fact.strokes}획` : null,
                fact.position === 'surname' ? '성' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {fact.element ? <ElementBadge element={fact.element} suffix="기운" /> : null}
              {fact.legal === 'registrable' ? (
                <span className="v3-badge">인명용 한자</span>
              ) : null}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- 소리의 흐름 ---------- */

function PhoneticFlow({ index }: { index: DeliveryIndex }) {
  const phonetic = factOfKind(index, 'naming_phonetic');
  const { expert } = useTerms();
  if (!phonetic) return null;
  const syllables = Array.from(phonetic.fullHangul);
  const statusText =
    phonetic.status === 'smooth'
      ? '입에서 자연스럽게 이어지는 이름이에요.'
      : phonetic.status === 'watch'
        ? '몇 군데 발음이 잠시 걸리는 자리가 있어요.'
        : phonetic.status === 'awkward'
          ? '이어 부를 때 혀가 걸리는 자리가 있어, 또박또박 불러 주면 좋아요.'
          : null;
  return (
    <div className="v3-card">
      <div className="v3-sound-flow" aria-label="이름을 이어 불렀을 때의 흐름">
        {syllables.map((syllable, i) => {
          const transition = phonetic.transitions[i - 1];
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              {i > 0 ? (
                <span
                  className={`v3-sound-link${transition && transition.risk !== 'none' ? ' v3-sound-link--watch' : ''}`}
                  aria-hidden="true"
                />
              ) : null}
              <span className="v3-sound-syllable">{syllable}</span>
            </span>
          );
        })}
      </div>
      {statusText ? <p style={{ margin: '0.6rem 0 0' }}>{statusText}</p> : null}
      {expert ? (
        <p className="v3-hint" style={{ margin: '0.45rem 0 0' }}>
          발음 흐름 점수 {phonetic.phoneticScore}점 · 실제 발음 전이를 계산한 결과예요.
        </p>
      ) : null}
    </div>
  );
}

/* ---------- 사격수리 ---------- */

const FRAME_STAGE_KO: Record<string, string> = {
  earlyLife: '초년',
  youthLife: '청년',
  middleLife: '중년',
  lateAndTotal: '말년·전체',
};

const FRAME_TYPE_KO: Record<string, string> = {
  won: '원격(元格)',
  hyung: '형격(亨格)',
  lee: '이격(利格)',
  jung: '정격(貞格)',
};

function frameLevelText(luckyLevel: number): string {
  if (luckyLevel >= 20) return '좋은 흐름';
  if (luckyLevel >= 10) return '무난한 흐름';
  return '살펴볼 흐름';
}

function frameMeaning(strokeSum: number) {
  try {
    return getFourframeMeaningByNumber(strokeSum);
  } catch {
    return null;
  }
}

/** 카탈로그 원문의 [성함] 자리표시자를 실제 이름으로 채운다. */
function fillName(text: string, name: string): string {
  return text.replace(/\[성함\]/g, name);
}

function FourFrames({ index, name }: { index: DeliveryIndex; name: string }) {
  const frames = factsOfKind(index, 'naming_frame');
  const { expert } = useTerms();
  if (frames.length === 0) return null;
  const order = ['earlyLife', 'youthLife', 'middleLife', 'lateAndTotal'];
  const sorted = [...frames].sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {sorted.map(frame => {
        const meaning = frameMeaning(frame.strokeSum);
        return (
          <div key={frame.id} className="v3-card">
            <div className="v3-frame-head">
              <span className="v3-badge v3-badge--accent">{FRAME_STAGE_KO[frame.stage]}</span>
              <strong className="v3-frame-title">
                {meaning ? meaning.title : frameLevelText(frame.luckyLevel)}
              </strong>
              <span className="v3-hint">
                {frame.strokeSum}수
                {expert ? ` · ${FRAME_TYPE_KO[frame.frameType]}` : ''}
              </span>
              <ElementBadge element={frame.element} />
            </div>
            {meaning?.summary ? <p style={{ margin: '0.5rem 0 0' }}>{fillName(meaning.summary, name)}</p> : null}
            {meaning && (meaning.positive_aspects || meaning.caution_points) ? (
              <details style={{ marginTop: '0.5rem' }}>
                <summary className="v3-hint" style={{ cursor: 'pointer' }}>전통 풀이 더 읽기</summary>
                <div className="v3-reading">
                  {meaning.positive_aspects ? (
                    <div className="v3-callout v3-callout--tip">
                      <p className="v3-callout-title">
                        <span aria-hidden="true">☘</span> 밝게 보는 쪽
                      </p>
                      <p style={{ margin: 0 }}>{fillName(meaning.positive_aspects, name)}</p>
                    </div>
                  ) : null}
                  {meaning.caution_points ? (
                    <div className="v3-callout v3-callout--caution">
                      <p className="v3-callout-title">
                        <span aria-hidden="true">✦</span> 조심스럽게 보는 쪽
                      </p>
                      <p style={{ margin: 0 }}>{fillName(meaning.caution_points, name)}</p>
                    </div>
                  ) : null}
                  <p className="v3-hint" style={{ margin: 0 }}>
                    전통 수리 문헌의 표현을 옮긴 것으로, 정해진 미래가 아니라 참고용 관점이에요.
                  </p>
                </div>
              </details>
            ) : null}
          </div>
        );
      })}
      <p className="v3-hint" style={{ margin: 0 }}>
        이름 획수를 네 시기로 나눠 읽는 전통 방식(사격수리)이에요. 질병이나 특정 사건을
        예언하는 값이 아니에요.
      </p>
    </div>
  );
}

/* ---------- 이름 통계 ---------- */

interface StatBundle {
  entry: NameStatEntry | null;
  gender: NameGenderRatioEntry | null;
}

function useNameStats(profile: V3Profile): StatBundle | 'loading' | 'error' {
  const givenName = profile.givenName.map(c => c.hangul).join('');
  const [state, setState] = useState<StatBundle | 'loading' | 'error'>('loading');
  useEffect(() => {
    let cancelled = false;
    const { repo, ready } = getStatRepo();
    ready
      .then(async () => {
        const entry = await repo.findByName(givenName);
        const gender = await repo.findGenderRatioByName(givenName);
        if (!cancelled) setState({ entry, gender });
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [givenName]);
  return state;
}

function BirthLineChart({ yearlyBirth }: { yearlyBirth: Record<string, Record<string, number>> }) {
  // yearly_birth는 성별 버킷 → {연도: 인원} 방향으로 저장돼 있다.
  const byYear = new Map<number, number>();
  for (const bucket of Object.values(yearlyBirth)) {
    if (!bucket || typeof bucket !== 'object') continue;
    for (const [yearText, count] of Object.entries(bucket)) {
      const year = Number(yearText);
      if (!Number.isFinite(year)) continue;
      byYear.set(year, (byYear.get(year) ?? 0) + count);
    }
  }
  // 전체 출생아가 해마다 줄기 때문에, 절대 수 대신 "그해 태어난 1만 명당
  // 몇 명"으로 보정해야 이름 자체의 흐름이 보인다.
  const ratePoints = [...byYear.entries()]
    .filter(([year]) => KOREA_ANNUAL_BIRTHS[year])
    .map(([year, count]) => ({
      year,
      count,
      rate: (count / KOREA_ANNUAL_BIRTHS[year]) * 10000,
    }))
    .sort((a, b) => a.year - b.year);
  const usingRate = ratePoints.length >= 2;
  const points = usingRate
    ? ratePoints
    : [...byYear.entries()]
        .map(([year, count]) => ({ year, count, rate: count }))
        .sort((a, b) => a.year - b.year);
  if (points.length < 2) return null;
  const w = 560;
  const h = 150;
  const pad = 24;
  const years = points.map(p => p.year);
  const values = points.map(p => p.rate);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const maxValue = Math.max(...values, usingRate ? 0.001 : 1);
  const x = (year: number) => pad + ((year - minYear) / Math.max(maxYear - minYear, 1)) * (w - pad * 2);
  const y = (value: number) => h - pad - (value / maxValue) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year).toFixed(1)},${y(p.rate).toFixed(1)}`).join(' ');
  const peak = points.reduce((best, p) => (p.rate > best.rate ? p : best), points[0]);
  const peakX = x(peak.year);
  const peakAnchor = peakX < w * 0.18 ? 'start' : peakX > w * 0.82 ? 'end' : 'middle';
  const peakLabel = usingRate
    ? `${peak.year}년 · 1만 명당 ${peak.rate.toFixed(1)}명`
    : `${peak.year}년 ${peak.count.toLocaleString()}명`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }} role="img"
        aria-label={usingRate
          ? `연도별로 전체 출생아 1만 명당 이 이름의 출생아 수, ${minYear}년부터 ${maxYear}년까지`
          : `연도별 출생아 수, ${minYear}년부터 ${maxYear}년까지`}>
        <path d={path} fill="none" stroke="var(--color-chart-line-a)" strokeWidth="2" />
        <circle cx={peakX} cy={y(peak.rate)} r="3.5" fill="var(--color-chart-line-a)" />
        <text x={peakX} y={y(peak.rate) - 8} textAnchor={peakAnchor}
          style={{ fill: 'var(--color-ink-2)', fontSize: '11px' }}>
          {peakLabel}
        </text>
        <text x={pad} y={h - 6} style={{ fill: 'var(--color-ink-3)', fontSize: '11px' }}>{minYear}</text>
        <text x={w - pad} y={h - 6} textAnchor="end" style={{ fill: 'var(--color-ink-3)', fontSize: '11px' }}>
          {maxYear}
        </text>
      </svg>
      <p className="v3-hint" style={{ margin: '0.3rem 0 0' }}>
        {usingRate
          ? `해마다 태어나는 아이 수가 달라서, 전체 출생아 1만 명당 비율로 맞춰 그렸어요. 이 이름이 가장 흔했던 해는 ${peak.year}년이에요.`
          : `이 이름으로 태어난 아이가 가장 많았던 해는 ${peak.year}년이에요.`}
      </p>
    </div>
  );
}

interface RankSeries {
  label: string;
  points: { year: number; rank: number }[];
}

/** 연도별 공식 순위에서 그릴 계열을 고른다 — 전체 버킷 우선, 없으면 점이 많은 성별 버킷. */
function pickRankSeries(yearlyRank: Record<string, Record<string, number>>): RankSeries | null {
  const buckets = Object.entries(yearlyRank)
    .map(([label, byYear]) => ({
      label,
      points: Object.entries(byYear ?? {})
        .map(([yearText, rank]) => ({ year: Number(yearText), rank }))
        .filter(p => Number.isFinite(p.year) && Number.isFinite(p.rank) && p.rank > 0)
        .sort((a, b) => a.year - b.year),
    }))
    .filter(bucket => bucket.points.length >= 2);
  if (buckets.length === 0) return null;
  return (
    buckets.find(bucket => bucket.label === '전체')
    ?? buckets.reduce((best, bucket) => (bucket.points.length > best.points.length ? bucket : best))
  );
}

/** 인기 순위의 변천 — 순위는 낮을수록 인기라 1위가 위로 가도록 축을 뒤집는다. */
function RankLineChart({ series }: { series: RankSeries }) {
  const { points } = series;
  const w = 560;
  const h = 150;
  const pad = 24;
  const years = points.map(p => p.year);
  const ranks = points.map(p => p.rank);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const bestRank = Math.min(...ranks);
  const worstRank = Math.max(...ranks);
  const x = (year: number) => pad + ((year - minYear) / Math.max(maxYear - minYear, 1)) * (w - pad * 2);
  const y = (rank: number) =>
    pad + ((rank - bestRank) / Math.max(worstRank - bestRank, 1)) * (h - pad * 2);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year).toFixed(1)},${y(p.rank).toFixed(1)}`)
    .join(' ');
  const best = points.reduce((acc, p) => (p.rank < acc.rank ? p : acc), points[0]);
  const latest = points[points.length - 1];
  const bestX = x(best.year);
  const bestAnchor = bestX < w * 0.18 ? 'start' : bestX > w * 0.82 ? 'end' : 'middle';
  // 위의 '지금의 인기' 카드와 버킷(전체/남자/여자)이 다를 수 있어 기준을 항상 밝힌다.
  const bucketNote =
    series.label === '전체' ? ' 남녀 전체 이름 순위 기준이에요.' : ` ${series.label} 이름 순위 기준이에요.`;
  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: '100%', height: 'auto' }}
        role="img"
        aria-label={`연도별 이름 인기 순위, ${minYear}년부터 ${maxYear}년까지. 위로 갈수록 순위가 높아요.`}
      >
        <path d={path} fill="none" stroke="var(--color-chart-line-a)" strokeWidth="2" />
        <circle cx={bestX} cy={y(best.rank)} r="3.5" fill="var(--color-chart-line-a)" />
        <text
          x={bestX}
          y={y(best.rank) - 8}
          textAnchor={bestAnchor}
          style={{ fill: 'var(--color-ink-2)', fontSize: '11px' }}
        >
          {best.year}년 · {best.rank.toLocaleString()}위
        </text>
        {latest.year !== best.year ? (
          <text
            x={x(latest.year)}
            y={y(latest.rank) - 8}
            textAnchor="end"
            style={{ fill: 'var(--color-ink-3)', fontSize: '11px' }}
          >
            {latest.rank.toLocaleString()}위
          </text>
        ) : null}
        <text x={pad} y={h - 6} style={{ fill: 'var(--color-ink-3)', fontSize: '11px' }}>{minYear}</text>
        <text x={w - pad} y={h - 6} textAnchor="end" style={{ fill: 'var(--color-ink-3)', fontSize: '11px' }}>
          {maxYear}
        </text>
      </svg>
      <p className="v3-hint" style={{ margin: '0.3rem 0 0' }}>
        위로 갈수록 인기 순위가 높아요.{bucketNote} 가장 높이 오른 해는{' '}
        {best.year}년({best.rank.toLocaleString()}위)이고, 마지막 집계인 {latest.year}년에는{' '}
        {latest.rank.toLocaleString()}위예요.
      </p>
    </div>
  );
}

function GenderDonut({ gender }: { gender: NameGenderRatioEntry }) {
  const total = gender.maleBirths + gender.femaleBirths;
  if (total <= 0) return null;
  const maleShare = gender.maleBirths / total;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
      <svg viewBox="0 0 90 90" width="84" height="84" role="img"
        aria-label={`남성 ${(maleShare * 100).toFixed(1)}%, 여성 ${((1 - maleShare) * 100).toFixed(1)}%`}>
        <circle cx="45" cy="45" r={r} fill="none" stroke="var(--color-chart-line-b)" strokeWidth="12" />
        <circle
          cx="45" cy="45" r={r} fill="none"
          stroke="var(--color-water)" strokeWidth="12"
          strokeDasharray={`${(maleShare * c).toFixed(1)} ${c.toFixed(1)}`}
          transform="rotate(-90 45 45)"
        />
      </svg>
      <div>
        <p style={{ margin: 0 }}>
          남성 {(maleShare * 100).toFixed(1)}% ({gender.maleBirths.toLocaleString()}명)
        </p>
        <p style={{ margin: 0 }}>
          여성 {((1 - maleShare) * 100).toFixed(1)}% ({gender.femaleBirths.toLocaleString()}명)
        </p>
      </div>
    </div>
  );
}

function NameStatsSection({ index, profile }: { index: DeliveryIndex; profile: V3Profile }) {
  const stats = useNameStats(profile);
  const statistics = factOfKind(index, 'name_statistics');
  const trend = factOfKind(index, 'naming_trend');
  if (stats === 'loading') return <Loading message="이름 통계를 찾아보고 있어요…" />;
  if (stats === 'error' || (!stats.entry && !statistics)) {
    return (
      <p className="v3-hint">
        이 이름의 사용 통계는 자료에 없어요. 드물게 쓰이는 이름일 수 있어요.
      </p>
    );
  }
  const { entry, gender } = stats;
  const rankSeries = entry ? pickRankSeries(entry.yearly_rank) : null;
  let rank = statistics?.popularityRank ?? trend?.latestPoint?.rank ?? null;
  let rankYear = trend?.latestPoint?.year ?? null;
  let rankBucket: string | null = null;
  if (rank === null && entry) {
    // 공식 통계 DB의 연도별 순위에서 가장 최근 연도를 찾는다.
    for (const [bucket, byYear] of Object.entries(entry.yearly_rank)) {
      for (const [yearText, value] of Object.entries(byYear)) {
        const year = Number(yearText);
        if (!Number.isFinite(year) || value <= 0) continue;
        if (rankYear === null || year > rankYear || (year === rankYear && value < (rank ?? Infinity))) {
          rankYear = year;
          rank = value;
          rankBucket = bucket;
        }
      }
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <div className="v3-grid-2">
        {rank !== null ? (
          <div className="v3-card">
            <p className="v3-kicker">지금의 인기</p>
            <p className="v3-core-value">{rank.toLocaleString()}위</p>
            {rankYear !== null ? (
              <p className="v3-hint">
                {rankYear}년 공식 통계
                {rankBucket ? ` · ${rankBucket} 이름 기준` : ''} 순위예요.
              </p>
            ) : null}
          </div>
        ) : null}
        {gender ? (
          <div className="v3-card">
            <p className="v3-kicker">누가 많이 쓰나요</p>
            <GenderDonut gender={gender} />
          </div>
        ) : null}
      </div>
      {entry && rankSeries ? (
        <div className="v3-card">
          <p className="v3-kicker">인기의 흐름</p>
          <RankLineChart series={rankSeries} />
        </div>
      ) : entry && Object.keys(entry.yearly_birth).length > 1 ? (
        <div className="v3-card">
          {/* 순위 자료가 없는 이름은 출생아 비율 곡선으로 흐름을 대신 보여준다. */}
          <p className="v3-kicker">인기의 흐름</p>
          <BirthLineChart yearlyBirth={entry.yearly_birth} />
        </div>
      ) : null}
      {entry && entry.similar_names.length > 0 ? (
        <div className="v3-card">
          <p className="v3-kicker">비슷한 울림의 이름</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
            {entry.similar_names.slice(0, 14).map(name => (
              <span key={name} className="v3-badge">{name}</span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- 화면 ---------- */

export default function NamingScreen() {
  const state = useDelivery(SURFACES);
  const surfaces = useMemo(() => SURFACES, []);
  void surfaces;

  if (state.status === 'loading') {
    return (
      <main className="v3-page">
        <Loading message="이름에 담긴 뜻을 읽고 있어요…" />
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main className="v3-page">
        <div className="v3-card">
          <p style={{ margin: 0 }}>이름 보고서를 준비하지 못했어요. 이름 입력을 다시 확인해 주시겠어요?</p>
          <Link to="/" className="v3-button" style={{ marginTop: '0.8rem' }}>입력 화면으로</Link>
        </div>
      </main>
    );
  }

  const { index, profile } = state;
  return (
    <main className="v3-page">
      <OverrideBanner />
      <div className="v3-page-head">
        <p className="v3-kicker">이름 보고서</p>
        <h1 className="v3-page-title">{fullHangulName(profile)}, 이름의 뜻과 울림</h1>
        <p className="v3-page-lede">글자의 뜻에서 시작해 소리, 획수, 사용 통계까지 서로 다른 눈으로 살펴봅니다.</p>
      </div>

      <TermToggle />

      <Section title="글자마다 담긴 뜻">
        <CharacterCards index={index} />
      </Section>

      <Section title="불렀을 때의 울림" lede="실제 발음이 이어질 때의 흐름을 계산했어요.">
        <PhoneticFlow index={index} />
      </Section>

      <Section title="획수로 읽는 네 시기">
        <FourFrames index={index} name={fullHangulName(profile)} />
      </Section>

      <Section title="이 이름을 쓰는 사람들" lede="공식 이름 통계 자료에서 찾은 실제 기록이에요.">
        <NameStatsSection index={index} profile={profile} />
      </Section>
      <div className="v3-card v3-report-tail" style={{ marginTop: 'var(--space-lg)' }}>
        <p style={{ margin: '0 0 0.7rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          읽은 결과는 저장하고, 다시 열어 볼 수 있게 남겨두세요.
        </p>
        <ReportActions />
      </div>
      <ReportFootnote />
    </main>
  );
}
