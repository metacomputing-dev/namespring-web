import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  ReportSurfaceSelectionV1,
  ReportCategoryIdV1,
  CalendarPeriodIdV1,
} from '@spring/report/delivery/types';
import { useDelivery } from '../engine/useDelivery';
import {
  factOfKind,
  factsOfKind,
  metricValue,
  type DeliveryIndex,
} from '../model/facts';
import {
  branchGlyph,
  stemGlyph,
  CATEGORY_META,
  PERIOD_META,
  PILLAR_KO,
  RELATION_MEANINGS,
  SEONGPAE_KO,
  SHINSAL_MEANINGS,
  TEN_GOD_KO,
  UNSEONG_GLOSS,
} from '../model/saju-labels';
import { fullHangulName, type V3Profile } from '../model/profile';
import {
  ElementBadge,
  Loading,
  OverrideBanner,
  QuoteCard,
  Section,
  Stars,
  TermToggle,
  useTerms,
} from '../ui/primitives';

const CATEGORIES: ReportCategoryIdV1[] = [
  'overall',
  'wealth',
  'health',
  'academic',
  'romance',
  'family',
];

const BASE_SURFACES: ReportSurfaceSelectionV1[] = [
  { id: 'saju', depth: 'standard', life: 'summary' },
];

function periodSurfaces(period: CalendarPeriodIdV1): ReportSurfaceSelectionV1[] {
  return [
    {
      id: 'saju',
      depth: 'standard',
      timeline: { periods: [period], categories: CATEGORIES as never },
      life: 'summary',
    },
  ];
}

/* ---------- 원국표 ---------- */

function PillarsTable({ index }: { index: DeliveryIndex }) {
  const pillars = factOfKind(index, 'pillars');
  const unseong = factOfKind(index, 'sibi_unseong');
  const { expert } = useTerms();
  if (!pillars) return null;
  const order = ['year', 'month', 'day', 'hour'] as const;
  const byPosition = new Map(pillars.values.map(value => [value.position, value]));
  const stageByPosition = new Map((unseong?.stages ?? []).map(entry => [entry.position, entry.stage]));
  return (
    <div className="v3-pillars" role="table" aria-label="사주 네 기둥">
      {order.map(position => {
        const pillar = byPosition.get(position);
        if (!pillar) return null;
        const stem = stemGlyph(pillar.stem.code);
        const branch = branchGlyph(pillar.branch.code);
        const stage = stageByPosition.get(position);
        return (
          <div key={position} className="v3-pillar" role="row">
            <span className="v3-hint">{PILLAR_KO[position]}</span>
            <span
              className={`v3-pillar-glyph v3-el-${stem?.element ?? 'none'}`}
              title={stem ? `${pillar.stem.hangul} — ${stem.element}` : undefined}
            >
              {pillar.stem.hangul}
              <small>{pillar.stem.hanja}</small>
            </span>
            <span className={`v3-pillar-glyph v3-el-${branch?.element ?? 'none'}`}>
              {pillar.branch.hangul}
              <small>{pillar.branch.hanja}</small>
            </span>
            {expert && stage ? <span className="v3-badge">{stage}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- 핵심 요약 ---------- */

function CoreCards({ index }: { index: DeliveryIndex }) {
  const dayMaster = factOfKind(index, 'day_master');
  const strength = factOfKind(index, 'strength');
  const yongshin = factOfKind(index, 'yongshin');
  const gyeokguk = factOfKind(index, 'gyeokguk');
  const seongpae = factOfKind(index, 'gyeokguk_seongpae');
  const { expert } = useTerms();
  return (
    <div className="v3-grid-3">
      {dayMaster ? (
        <div className="v3-card">
          <p className="v3-kicker">나를 나타내는 글자</p>
          <p className="v3-core-value">
            {dayMaster.stem}
            {dayMaster.element ? <ElementBadge element={dayMaster.element} suffix="기운" /> : null}
          </p>
          <p className="v3-hint">태어난 날의 하늘 글자(일간)를 기준으로 읽어요.</p>
        </div>
      ) : null}
      {strength ? (
        <div className="v3-card">
          <p className="v3-kicker">기운의 세기</p>
          <p className="v3-core-value">{strength.level}</p>
          <p className="v3-hint">
            {strength.isStrong
              ? '스스로 밀고 나가는 힘이 넉넉한 쪽이에요.'
              : '주변의 도움이 힘이 되어 주는 쪽이에요.'}
          </p>
        </div>
      ) : null}
      {yongshin?.element ? (
        <div className="v3-card">
          <p className="v3-kicker">반기는 기운</p>
          <p className="v3-core-value">
            <ElementBadge element={yongshin.element} suffix="기운" />
          </p>
          <p className="v3-hint">
            {expert
              ? `용신 판단이에요. 방법에 따라 다른 후보가 있을 수 있어요.`
              : '사주의 균형을 맞춰 주는 기운이에요.'}
          </p>
        </div>
      ) : null}
      {gyeokguk ? (
        <div className="v3-card">
          <p className="v3-kicker">사주의 골격</p>
          <p className="v3-core-value">{gyeokguk.type}</p>
          {seongpae ? (
            <p className="v3-hint">
              {SEONGPAE_KO[seongpae.verdict]?.label ?? seongpae.verdict} ·{' '}
              {SEONGPAE_KO[seongpae.verdict]?.gloss}
              {expert && seongpae.sangshin
                ? ` 격을 지켜 주는 글자(상신)는 ${seongpae.sangshin}이에요.`
                : ''}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- 음양 균형 ---------- */

function YinYangCard({ index }: { index: DeliveryIndex }) {
  const balance = factOfKind(index, 'yin_yang_balance');
  if (!balance) return null;
  const total = balance.yang + balance.yin;
  if (total === 0) return null;
  const yangShare = (balance.yang / total) * 100;
  const dominantText =
    balance.dominant === 'EVEN'
      ? '음과 양이 고르게 나뉘어 있어요.'
      : balance.dominant === 'YANG'
        ? '드러내고 움직이는 양의 기운이 더 많아요.'
        : '머금고 다듬는 음의 기운이 더 많아요.';
  return (
    <div className="v3-card">
      <p className="v3-kicker">음양의 저울</p>
      <div className="v3-yinyang-track" aria-hidden="true">
        <div className="v3-yinyang-yang" style={{ width: `${yangShare}%` }} />
      </div>
      <p style={{ margin: '0.5rem 0 0' }}>
        여덟 글자 중 양 {balance.yang} · 음 {balance.yin} — {dominantText}
      </p>
    </div>
  );
}

/* ---------- 구조 인사이트 ---------- */

function InsightQuotes({ index }: { index: DeliveryIndex }) {
  const shinsal = factOfKind(index, 'shinsal_hits');
  const gongmang = factOfKind(index, 'gongmang');
  const relations = factOfKind(index, 'natal_relations');
  const quotes: { key: string; main: string; expertNote?: string; tags?: string[] }[] = [];

  const sortedHits = [...(shinsal?.hits ?? [])].sort((a, b) => {
    const gradeGap = a.grade.localeCompare(b.grade);
    if (gradeGap !== 0) return gradeGap;
    const aKnown = SHINSAL_MEANINGS[a.name] ? 0 : 1;
    const bKnown = SHINSAL_MEANINGS[b.name] ? 0 : 1;
    return aKnown - bKnown;
  });
  for (const hit of sortedHits) {
    const meaning = SHINSAL_MEANINGS[hit.name];
    quotes.push({
      key: `shinsal-${hit.name}-${hit.calculationBasis.label}`,
      main: meaning ? `${hit.name} — ${meaning}` : `${hit.name}이 자리해요.`,
      expertNote: `${hit.calculationBasis.label} 기준 · ${hit.occurrenceCount}곳`,
      tags: ['신살'],
    });
  }
  if (gongmang) {
    quotes.push({
      key: 'gongmang',
      main: `${gongmang.voidBranches[0]}·${gongmang.voidBranches[1]} 자리가 비어 있는 공망이에요. 그 영역은 준비를 한 번 더 하면 든든해요.`,
      expertNote: '일주 기준으로 계산한 빈 자리예요.',
      tags: ['공망'],
    });
  }
  for (const relation of relations?.cheongan ?? []) {
    const gloss = RELATION_MEANINGS[relation.type];
    quotes.push({
      key: `cheongan-${relation.type}-${relation.stems.join('')}`,
      main: `하늘 글자 ${relation.stems.join('과 ')}이(가) ${relation.type} 관계예요. ${gloss ?? ''}`.trim(),
      expertNote: relation.resultElement
        ? `천간 ${relation.type}${relation.resultConfirmed ? ' · 합화 성립' : ''}`
        : `천간 ${relation.type}`,
      tags: ['천간 관계'],
    });
  }
  for (const relation of relations?.jiji ?? []) {
    const gloss = RELATION_MEANINGS[relation.type];
    quotes.push({
      key: `jiji-${relation.type}-${relation.branches.join('')}`,
      main: `땅의 글자 ${relation.branches.join('과 ')}이(가) ${relation.type} 관계예요. ${gloss ?? ''}`.trim(),
      expertNote: relation.outcome ? `지지 ${relation.type} · ${relation.outcome}` : `지지 ${relation.type}`,
      tags: ['지지 관계'],
    });
  }

  if (quotes.length === 0) return null;
  const [head, rest] = [quotes.slice(0, 5), quotes.slice(5)];
  return (
    <>
      {head.map(quote => (
        <QuoteCard key={quote.key} main={quote.main} expertNote={quote.expertNote} tags={quote.tags} />
      ))}
      {rest.length > 0 ? (
        <details style={{ marginTop: '0.6rem' }}>
          <summary className="v3-hint" style={{ cursor: 'pointer' }}>
            나머지 신호 {rest.length}개 더 보기
          </summary>
          <div style={{ marginTop: '0.6rem' }}>
            {rest.map(quote => (
              <QuoteCard key={quote.key} main={quote.main} expertNote={quote.expertNote} tags={quote.tags} />
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

/* ---------- 십성 표 (전문) ---------- */

function TenGodTable({ index }: { index: DeliveryIndex }) {
  const analysis = factOfKind(index, 'ten_god_analysis');
  const { expert } = useTerms();
  if (!analysis || !expert) return null;
  return (
    <div className="v3-card" style={{ overflowX: 'auto' }}>
      <p className="v3-kicker">십성 배치</p>
      <table className="v3-table">
        <thead>
          <tr>
            <th scope="col">구분</th>
            {analysis.positions.map(position => (
              <th key={position.position} scope="col">{PILLAR_KO[position.position]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">천간</th>
            {analysis.positions.map(position => (
              <td key={position.position}>{position.cheongan.label}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">지지</th>
            {analysis.positions.map(position => (
              <td key={position.position}>{position.jijiPrincipal.label}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">지장간</th>
            {analysis.positions.map(position => (
              <td key={position.position} className="v3-hint">
                {position.hiddenStems
                  .map(hidden => `${hidden.stem}(${hidden.tenGod.label})`)
                  .join(' · ')}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="v3-hint" style={{ marginTop: '0.4rem' }}>
        지장간은 땅의 글자 속에 숨어 함께 작용하는 하늘 글자예요.
      </p>
    </div>
  );
}

/* ---------- 대운 이정표 ---------- */

function currentAgeYears(profile: V3Profile): number {
  const birth = new Date(profile.birth.year, profile.birth.month - 1, profile.birth.day);
  return (Date.now() - birth.getTime()) / (365.2425 * 24 * 3600 * 1000);
}

function DaeunRoad({ index, profile }: { index: DeliveryIndex; profile: V3Profile }) {
  const daeun = factOfKind(index, 'daeun_timeline');
  const { expert } = useTerms();
  const [openOrder, setOpenOrder] = useState<number | null>(null);
  if (!daeun) return null;
  const age = currentAgeYears(profile);
  const startLabel = daeun.firstStartAgeDisplay ?? Math.round(daeun.firstStartAge);
  const maxAge = Math.max(100, ...daeun.periods.map(period => period.endAge));

  const w = 640;
  const h = 132;
  const padX = 26;
  const baselineY = 96;
  const curveAmplitude = 56;
  const x = (value: number) => padX + (Math.min(value, maxAge) / maxAge) * (w - padX * 2);

  // 대운별 별점(엔진 채점)이 delivery로 오면, 수평선 위에 그 값 그대로의
  // 부드러운 곡선을 얹는다. 값이 없으면 곡선 없이 선과 점만 남긴다.
  const lifeBlock = index.surfaceById
    .get('saju')
    ?.blocks.find(block => block.kind === 'life_flow');
  const starsByOrder = new Map<number, number>();
  if (lifeBlock && lifeBlock.kind === 'life_flow') {
    for (const entry of lifeBlock.daeunRatings ?? []) {
      const value = metricValue(index, entry.ratingFactRef);
      if (value !== null) starsByOrder.set(entry.order, value);
    }
  }
  const starY = (stars: number) => baselineY - 12 - ((stars - 1) / 4) * curveAmplitude;
  const curvePoints = daeun.periods
    .filter(period => starsByOrder.has(period.order))
    .map(period => ({
      x: x(period.startAge),
      y: starY(starsByOrder.get(period.order)!),
      endX: x(Math.min(period.endAge, maxAge)),
    }));
  let curvePath = '';
  if (curvePoints.length >= 2) {
    const points = [
      ...curvePoints.map(p => ({ x: p.x, y: p.y })),
      { x: curvePoints[curvePoints.length - 1].endX, y: curvePoints[curvePoints.length - 1].y },
    ];
    curvePath = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      curvePath += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
  }
  const dotY = (order: number) => {
    const stars = starsByOrder.get(order);
    return stars === undefined ? baselineY : starY(stars);
  };

  const openPeriod = daeun.periods.find(period => period.order === openOrder) ?? null;
  const openStem = openPeriod ? stemGlyph(openPeriod.stem) : null;
  const openBranch = openPeriod ? branchGlyph(openPeriod.branch) : null;
  const openStars = openPeriod ? starsByOrder.get(openPeriod.order) ?? null : null;

  return (
    <div className="v3-card">
      <p style={{ margin: '0 0 0.5rem' }}>
        대운은 {startLabel}세 무렵 시작해 10년마다 {daeun.isForward ? '순행' : '역행'}으로
        바뀌어요. 점을 누르면 그 구간을 열어 볼 수 있어요.
      </p>
      <div className="v3-life-timeline">
        <svg viewBox={`0 0 ${w} ${h}`} role="list" aria-label="1세부터 100세까지의 대운 구간">
          <line
            x1={padX}
            y1={baselineY}
            x2={w - padX}
            y2={baselineY}
            stroke="var(--color-rule-strong)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {[0, 20, 40, 60, 80, 100].map(tick => (
            <g key={tick}>
              <line
                x1={x(tick)}
                y1={baselineY - 3}
                x2={x(tick)}
                y2={baselineY + 3}
                stroke="var(--color-rule-strong)"
                strokeWidth="1.5"
              />
              <text
                x={x(tick)}
                y={baselineY + 20}
                textAnchor="middle"
                style={{ fill: 'var(--color-ink-3)', fontSize: '11px' }}
              >
                {tick}세
              </text>
            </g>
          ))}
          {/* 별점 곡선 — 엔진이 채점한 대운별 별점을 그대로 잇는다 */}
          {curvePath ? (
            <path
              d={curvePath}
              fill="none"
              stroke="var(--color-chart-line-a)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          ) : null}
          {/* 지금 위치 */}
          {age >= 0 && age <= maxAge ? (
            <g>
              <line
                x1={x(age)}
                y1={16}
                x2={x(age)}
                y2={baselineY}
                stroke="var(--color-accent)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <text
                x={x(age)}
                y={11}
                textAnchor="middle"
                style={{ fill: 'var(--color-accent)', fontSize: '11px', fontWeight: 700 }}
              >
                지금
              </text>
            </g>
          ) : null}
          {daeun.periods.map(period => {
            const stem = stemGlyph(period.stem);
            const branch = branchGlyph(period.branch);
            const isNow = age >= period.startAge && age < period.endAge;
            const isOpen = openOrder === period.order;
            const cx = x(period.startAge);
            return (
              <g
                key={period.order}
                className="v3-life-dot"
                role="listitem"
                tabIndex={0}
                aria-label={`${Math.round(period.startAge)}세부터 ${stem?.hangul ?? period.stem}${branch?.hangul ?? period.branch} 대운`}
                aria-expanded={isOpen}
                onClick={() => setOpenOrder(isOpen ? null : period.order)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setOpenOrder(isOpen ? null : period.order);
                  }
                }}
              >
                <circle
                  cx={cx}
                  cy={dotY(period.order)}
                  r={isOpen ? 9 : 6.5}
                  fill={isNow ? 'var(--color-accent)' : 'var(--color-paper-2)'}
                  stroke={isOpen ? 'var(--color-accent)' : isNow ? 'var(--color-accent)' : 'var(--color-rule-strong)'}
                  strokeWidth={isOpen ? 2.5 : 2}
                />
                <text
                  x={cx}
                  y={dotY(period.order) - 13}
                  textAnchor="middle"
                  style={{
                    fill: isNow ? 'var(--color-accent)' : 'var(--color-ink-2)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                  }}
                >
                  {(stem?.hangul ?? period.stem) + (branch?.hangul ?? period.branch)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {openPeriod ? (
        <div className="v3-life-panel" role="region" aria-label="선택한 대운 구간">
          <div className="v3-life-panel-head">
            <span className="v3-life-panel-ganji">
              <span className={`v3-el-${openStem?.element ?? 'none'}`}>
                {openStem?.hangul ?? openPeriod.stem}
              </span>
              <span className={`v3-el-${openBranch?.element ?? 'none'}`}>
                {openBranch?.hangul ?? openPeriod.branch}
              </span>
              <span className="v3-title-hanja" style={{ marginLeft: '0.35rem' }}>
                {(openStem?.hanja ?? '') + (openBranch?.hanja ?? '')}
              </span>
            </span>
            <span className="v3-badge">
              {Math.round(openPeriod.startAge)}세 ~ {Math.round(openPeriod.endAge)}세
            </span>
          </div>
          {openStars !== null ? (
            <div style={{ marginTop: '0.45rem' }}>
              <Stars value={openStars} />
            </div>
          ) : null}
          {expert ? (
            <p style={{ margin: '0.5rem 0 0' }}>
              {[
                openPeriod.tenGod ? `십성 ${TEN_GOD_KO[openPeriod.tenGod] ?? openPeriod.tenGod}` : null,
                openPeriod.lifeStage
                  ? `십이운성 ${openPeriod.lifeStage}${UNSEONG_GLOSS[openPeriod.lifeStage] ? ` — ${UNSEONG_GLOSS[openPeriod.lifeStage]}` : ''}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          <p className="v3-hint" style={{ margin: '0.5rem 0 0' }}>
            이 구간의 이야기는 준비하고 있어요. 곧 이 자리에서 읽을 수 있어요.
          </p>
          <button
            type="button"
            className="v3-button v3-button--ghost"
            style={{ marginTop: '0.7rem' }}
            onClick={() => setOpenOrder(null)}
          >
            접기
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- 기간 운세 ---------- */

function FortuneCells({ profile, period }: { profile: V3Profile; period: CalendarPeriodIdV1 }) {
  const state = useDelivery(useMemo(() => periodSurfaces(period), [period]));
  if (state.status === 'loading') return <Loading message={`${PERIOD_META[period]}의 흐름을 읽고 있어요…`} />;
  if (state.status === 'error') {
    return <p className="v3-hint">이 기간의 흐름은 지금 불러오지 못했어요.</p>;
  }
  const { index } = state;
  const surface = index.surfaceById.get('saju');
  const timeline = surface?.blocks.find(block => block.kind === 'timeline');
  if (!timeline || timeline.kind !== 'timeline') return null;
  const periodEntry = timeline.periods.find(entry => entry.id === period);
  if (!periodEntry) return null;
  return (
    <div className="v3-fortune-grid">
      {periodEntry.cells.map(cell => {
        const meta = CATEGORY_META[cell.category] ?? { label: cell.category, sub: '' };
        const stars = cell.ratingFactRef ? metricValue(index, cell.ratingFactRef) : null;
        const interpretation = cell.interpretationRef
          ? index.interpretationById.get(cell.interpretationRef)
          : null;
        const paragraphs = interpretation?.standard?.paragraphs ?? [];
        const tips = interpretation?.standard?.livingTips ?? [];
        const cautions = interpretation?.standard?.cautions ?? [];
        return (
          <div key={cell.category} className="v3-card v3-fortune-cell">
            <div className="v3-fortune-cell-head">
              <div>
                <strong>{meta.label}</strong>
                <span className="v3-hint" style={{ marginLeft: '0.4rem' }}>{meta.sub}</span>
              </div>
              {stars !== null ? <Stars value={stars} /> : null}
            </div>
            {interpretation?.brief?.headline ? (
              <p style={{ margin: '0.45rem 0 0' }}>{interpretation.brief.headline}</p>
            ) : null}
            {paragraphs.length > 0 || tips.length > 0 || cautions.length > 0 ? (
              <details style={{ marginTop: '0.45rem' }}>
                <summary className="v3-hint" style={{ cursor: 'pointer' }}>자세히 읽기</summary>
                <div className="v3-reading">
                  {paragraphs.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                  {tips.length > 0 ? (
                    <div className="v3-callout v3-callout--tip">
                      <p className="v3-callout-title">
                        <span aria-hidden="true">☘</span> 이 흐름을 살리는 방법
                      </p>
                      <ul>
                        {tips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {cautions.length > 0 ? (
                    <div className="v3-callout v3-callout--caution">
                      <p className="v3-callout-title">
                        <span aria-hidden="true">✦</span> 한 번 더 살필 점
                      </p>
                      <ul>
                        {cautions.map((caution, i) => (
                          <li key={i}>{caution}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function LifeSummary({ index }: { index: DeliveryIndex }) {
  const surface = index.surfaceById.get('saju');
  const life = surface?.blocks.find(block => block.kind === 'life_flow');
  if (!life || life.kind !== 'life_flow') return null;
  const interpretation = life.interpretationRef
    ? index.interpretationById.get(life.interpretationRef)
    : null;
  const stars = life.ratingFactRef ? metricValue(index, life.ratingFactRef) : null;
  if (!interpretation && stars === null) return null;
  return (
    <div className="v3-card v3-card--tinted" style={{ marginTop: 'var(--space-sm)' }}>
      <div className="v3-fortune-cell-head">
        <strong>생애 전체의 흐름</strong>
        {stars !== null ? <Stars value={stars} /> : null}
      </div>
      {interpretation?.brief?.headline ? (
        <p style={{ margin: '0.45rem 0 0' }}>{interpretation.brief.headline}</p>
      ) : null}
      {interpretation?.standard?.paragraphs?.map((paragraph, i) => (
        <p key={i} style={{ margin: '0.45rem 0 0' }}>{paragraph}</p>
      ))}
    </div>
  );
}

/* ---------- 화면 ---------- */

export default function SajuScreen() {
  const state = useDelivery(BASE_SURFACES);
  const [period, setPeriod] = useState<CalendarPeriodIdV1>('today');

  if (state.status === 'loading') {
    return (
      <main className="v3-page">
        <Loading message="타고난 기운을 정리하고 있어요…" />
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main className="v3-page">
        <div className="v3-card">
          <p style={{ margin: 0 }}>사주 보고서를 준비하지 못했어요. 태어난 정보를 다시 확인해 주시겠어요?</p>
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
        <p className="v3-kicker">사주 보고서</p>
        <h1 className="v3-page-title">{fullHangulName(profile)}님이 타고난 기운</h1>
        <p className="v3-page-lede">태어난 순간의 네 기둥에서 시작해, 지금의 흐름까지 이어서 봅니다.</p>
      </div>

      <TermToggle />

      <Section title="태어난 순간의 네 기둥">
        <div className="v3-card">
          <PillarsTable index={index} />
        </div>
      </Section>

      <Section title="이 사주의 핵심">
        <CoreCards index={index} />
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <YinYangCard index={index} />
        </div>
      </Section>

      <Section
        title="원국에서 눈에 띄는 신호"
        lede="계산으로 실제 감지된 것만 보여드려요. 좋고 나쁨을 정하는 목록이 아니에요."
      >
        <InsightQuotes index={index} />
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <TenGodTable index={index} />
        </div>
      </Section>

      <Section title="10년 단위의 큰 흐름" lede="대운은 인생을 10년씩 끊어 읽는 긴 호흡의 흐름이에요.">
        <DaeunRoad index={index} profile={profile} />
      </Section>

      <Section title="지금의 흐름">
        <div className="v3-tabs" role="tablist" aria-label="기간 선택">
          {(Object.keys(PERIOD_META) as CalendarPeriodIdV1[]).map(id => (
            <button
              key={id}
              type="button"
              role="tab"
              className="v3-tab"
              aria-selected={period === id}
              onClick={() => setPeriod(id)}
            >
              {PERIOD_META[id]}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <FortuneCells profile={profile} period={period} />
        </div>
        <LifeSummary index={index} />
      </Section>
    </main>
  );
}
