/**
 * 전 생애를 나란히 — 두 사람의 대운 별점 곡선을 하나의 달력 연도 축에 겹친다.
 *
 * 데이터는 사람별 delivery(궁합 계산이 이미 캐시해 둔 것)에서만 온다:
 * daeun_timeline fact + saju 표면 life_flow 블록의 daeunRatings(stars_1_5 metric).
 * 각 대운의 연속 나이 구간 [startAge, endAge)를 그 사람의 태어난 해에 더해
 * 달력 연도로 옮긴 뒤, 두 곡선이 함께 존재하는 구간만 그린다.
 * 어느 한쪽이라도 대운·별점이 없으면 섹션 전체를 그리지 않는다.
 *
 * 겹침 구간은 두 사람의 대운 경계의 중간 위상에 맞춘 10년 창으로 자르고,
 * 창마다 엔진 별점의 커버리지 가중 평균만으로 구간 성격을 분류한다
 * (둘 다 승승장구 / 함께 웅크림 / 한쪽이 받쳐 줌 / 무난). 두 사람 사이의
 * 새로운 운세 판단을 더하지 않는다. 구간 서사는 daeun-window-copy.ts에서 온다.
 */
import { useEffect, useState } from 'react';
import type { ReportDeliveryV1 } from '@spring/report/delivery/types';
import type {
  CompatFramingV1,
  CoupleCompatibilityV1,
} from '@spring/report/compatibility/index';
import { COMPAT_SURFACES } from '../../engine/compatibility';
import { fetchDelivery } from '../../engine/client';
import { factOfKind, indexDelivery, metricValue } from '../../model/facts';
import type { CompatSlot } from '../../model/compat';
import { Section, Stars } from '../../ui/primitives';
import {
  daeunWindowReading,
  type DaeunWindowClassV1,
} from './daeun-window-copy';

/* ================================================================== */
/* 데이터 추출                                                           */
/* ================================================================== */

export interface DecadeSegment {
  order: number;
  /** 달력 연도(연속값) — 태어난 해 + 연속 나이. */
  startYear: number;
  endYear: number;
  stars: number;
}

export interface PersonCurve {
  segments: DecadeSegment[];
  anchorYear: number | null;
}

/** delivery에서 대운 별점 곡선을 달력 연도로 옮겨 꺼낸다. 부족하면 null. */
function extractCurve(delivery: ReportDeliveryV1, birthYear: number): PersonCurve | null {
  const index = indexDelivery(delivery);
  const daeun = factOfKind(index, 'daeun_timeline');
  if (!daeun) return null;
  const lifeBlock = index.surfaceById
    .get('saju')
    ?.blocks.find(block => block.kind === 'life_flow');
  if (!lifeBlock || lifeBlock.kind !== 'life_flow') return null;
  const starsByOrder = new Map<number, number>();
  for (const entry of lifeBlock.daeunRatings ?? []) {
    const value = metricValue(index, entry.ratingFactRef);
    if (value !== null) starsByOrder.set(entry.order, value);
  }
  const segments = daeun.periods
    .filter(period => starsByOrder.has(period.order))
    .map(period => ({
      order: period.order,
      startYear: birthYear + period.startAge,
      endYear: birthYear + period.endAge,
      stars: starsByOrder.get(period.order)!,
    }))
    .sort((a, b) => a.startYear - b.startYear);
  if (segments.length < 2) return null;
  const anchorYearRaw = Number.parseInt(delivery.anchorDate.slice(0, 4), 10);
  return {
    segments,
    anchorYear: Number.isFinite(anchorYearRaw) ? anchorYearRaw : null,
  };
}

/* ================================================================== */
/* 10년 창 격자와 구간 산술 (순수 함수 — 테스트를 위해 export)               */
/* ================================================================== */

export interface DaeunWindow {
  startYear: number;
  endYear: number;
  aAvg: number;
  bAvg: number;
  combined: number;
  cls: DaeunWindowClassV1;
}

/** 창 경계가 앉을 10년 위상 — 두 사람의 첫 대운 시작 연도 위상의 중간. */
export function decadePhase(aFirstStartYear: number, bFirstStartYear: number): number {
  const phaseA = ((Math.round(aFirstStartYear) % 10) + 10) % 10;
  const phaseB = ((Math.round(bFirstStartYear) % 10) + 10) % 10;
  return Math.round((phaseA + phaseB) / 2) % 10;
}

/**
 * [t0, t1)을 위상에 맞춘 연속 10년 창 경계로 자른다.
 * 첫 정렬 경계가 t0보다 뒤라면 첫 창을 t0까지 뒤로 늘려 틈을 없앤다.
 * 마지막 창은 짧을 수 있다 — 4년 미만 창은 호출부에서 버린다.
 */
export function windowBoundaries(t0: number, t1: number, phase: number): number[] {
  const base = Math.ceil(t0);
  const firstAligned = base + ((((phase - (base % 10)) % 10) + 10) % 10);
  const bounds: number[] = [t0];
  for (let year = firstAligned + 10; year < t1; year += 10) bounds.push(year);
  if (t1 > bounds[bounds.length - 1]) bounds.push(t1);
  return bounds;
}

/**
 * 창 [ws, we)에 대한 커버리지 가중 별점 평균.
 * 창을 부분적으로 덮는 대운은 겹치는 연수만큼만 가중하고,
 * 채점 없는 대운은 분자·분모 모두에서 제외한다(segments에 애초에 없다).
 * 채점된 커버리지가 0이면 null.
 */
export function coverageWeightedStars(
  segments: DecadeSegment[],
  ws: number,
  we: number,
): number | null {
  let numerator = 0;
  let denominator = 0;
  for (const segment of segments) {
    const overlap = Math.min(segment.endYear, we) - Math.max(segment.startYear, ws);
    if (overlap > 0) {
      numerator += overlap * segment.stars;
      denominator += overlap;
    }
  }
  return denominator > 0 ? numerator / denominator : null;
}

export function classifyWindow(aAvg: number, bAvg: number): DaeunWindowClassV1 {
  if (aAvg >= 3.5 && bAvg >= 3.5) return 'both_high';
  if (aAvg <= 2.5 && bAvg <= 2.5) return 'both_low';
  if (Math.abs(aAvg - bAvg) >= 1.2) return 'complementary';
  return 'steady';
}

/** 겹침 구간 [t0, t1)을 10년 창으로 잘라 구간별 지표를 붙인다. */
export function buildDaeunWindows(
  a: PersonCurve,
  b: PersonCurve,
  t0: number,
  t1: number,
): DaeunWindow[] {
  const phase = decadePhase(a.segments[0].startYear, b.segments[0].startYear);
  const bounds = windowBoundaries(t0, t1, phase);
  const windows: DaeunWindow[] = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const startYear = bounds[i];
    const endYear = bounds[i + 1];
    if (endYear - startYear < 4) continue;
    const aAvg = coverageWeightedStars(a.segments, startYear, endYear);
    const bAvg = coverageWeightedStars(b.segments, startYear, endYear);
    // 어느 한쪽이라도 채점된 커버리지가 없으면 그 창은 통째로 건너뛴다.
    if (aAvg === null || bAvg === null) continue;
    windows.push({
      startYear,
      endYear,
      aAvg,
      bAvg,
      combined: (aAvg + bAvg) / 2,
      cls: classifyWindow(aAvg, bAvg),
    });
  }
  return windows;
}

const WINDOW_CLASS_KO: Record<DaeunWindowClassV1, string> = {
  both_high: '둘 다 승승장구',
  both_low: '함께 웅크리는 시기',
  complementary: '한쪽이 받쳐 주는 시기',
  steady: '무난히 함께 걷는 시기',
};

/** 별점 표시용 반올림(소수 1자리) — 곡선 좌표는 원값을 쓴다. */
function displayStars(value: number): number {
  return Math.round(value * 10) / 10;
}

/* ================================================================== */
/* 곡선 경로 (SajuScreen DaeunRoad와 같은 catmull-rom 제어점 산식)          */
/* ================================================================== */

interface Point {
  x: number;
  y: number;
}

function catmullRomPath(points: Point[]): string {
  if (points.length < 2) return '';
  let path = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
}

/** 별점 앵커(대운 시작점 + 마지막 끝점)를 표시 구간 안으로 잘라 모은다. */
function curveAnchors(
  curve: PersonCurve,
  spanStart: number,
  spanEnd: number,
): { year: number; stars: number; isDecadeStart: boolean }[] {
  const anchors: { year: number; stars: number; isDecadeStart: boolean }[] = [];
  const visible = curve.segments.filter(
    segment => segment.endYear > spanStart && segment.startYear < spanEnd,
  );
  for (const segment of visible) {
    const year = Math.max(segment.startYear, spanStart);
    if (anchors.length === 0 || year > anchors[anchors.length - 1].year) {
      anchors.push({ year, stars: segment.stars, isDecadeStart: true });
    }
  }
  if (visible.length > 0) {
    const last = visible[visible.length - 1];
    const endYear = Math.min(last.endYear, spanEnd);
    if (anchors.length > 0 && endYear > anchors[anchors.length - 1].year) {
      anchors.push({ year: endYear, stars: last.stars, isDecadeStart: false });
    }
  }
  return anchors;
}

/* ================================================================== */
/* 섹션 컴포넌트                                                          */
/* ================================================================== */

type OverlayState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; a: PersonCurve; b: PersonCurve };

export default function DaeunOverlaySection({
  slotA,
  slotB,
  result,
}: {
  slotA: CompatSlot;
  slotB: CompatSlot;
  result: CoupleCompatibilityV1;
}) {
  const [state, setState] = useState<OverlayState>({ status: 'loading' });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    setOpenIndex(null);
    Promise.all([
      fetchDelivery(slotA.profile, COMPAT_SURFACES),
      fetchDelivery(slotB.profile, COMPAT_SURFACES),
    ])
      .then(([deliveryA, deliveryB]) => {
        if (cancelled) return;
        const a = extractCurve(deliveryA, slotA.profile.birth.year);
        const b = extractCurve(deliveryB, slotB.profile.birth.year);
        if (!a || !b) setState({ status: 'unavailable' });
        else setState({ status: 'ready', a, b });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, [slotA, slotB]);

  // 데이터가 없으면 섹션 자체를 그리지 않는다 — 자리표시자 금지.
  if (state.status !== 'ready') return null;

  const { a, b } = state;
  // 두 곡선이 함께 존재하는 달력 연도 구간: 늦게 시작하는 쪽의 시작부터
  // 먼저 끝나는 쪽의 끝까지.
  const spanStart = Math.max(a.segments[0].startYear, b.segments[0].startYear);
  const spanEnd = Math.min(
    a.segments[a.segments.length - 1].endYear,
    b.segments[b.segments.length - 1].endYear,
  );
  if (spanEnd - spanStart < 10) return null;

  const anchorsA = curveAnchors(a, spanStart, spanEnd);
  const anchorsB = curveAnchors(b, spanStart, spanEnd);
  if (anchorsA.length < 2 || anchorsB.length < 2) return null;

  const windows = buildDaeunWindows(a, b, spanStart, spanEnd);
  // 창이 2개 미만이면 평균 곡선·점 없이 두 곡선 그림만 남긴다.
  const showWindows = windows.length >= 2;

  const w = 640;
  const h = 150;
  const padX = 26;
  const baselineY = 114;
  const curveAmplitude = 56;
  const x = (year: number) =>
    padX + ((Math.min(Math.max(year, spanStart), spanEnd) - spanStart) / (spanEnd - spanStart)) * (w - padX * 2);
  const starY = (stars: number) => baselineY - 12 - ((stars - 1) / 4) * curveAmplitude;

  const pathA = catmullRomPath(anchorsA.map(p => ({ x: x(p.year), y: starY(p.stars) })));
  const pathB = catmullRomPath(anchorsB.map(p => ({ x: x(p.year), y: starY(p.stars) })));
  const pathAvg = showWindows
    ? catmullRomPath(
        windows.map(window => ({
          x: x((window.startYear + window.endYear) / 2),
          y: starY(window.combined),
        })),
      )
    : '';

  const ticks: number[] = [];
  for (let tick = Math.ceil(spanStart / 10) * 10; tick <= spanEnd; tick += 10) {
    ticks.push(tick);
  }

  // '지금'은 delivery의 anchorDate 연도로 표시한다 (기기 시계를 쓰지 않는다).
  const anchorYear = a.anchorYear ?? b.anchorYear;
  const showNow = anchorYear !== null && anchorYear >= spanStart && anchorYear <= spanEnd;

  const framing: CompatFramingV1 = result.context.fact.framing;
  const aName = result.persons.a.displayName;
  const bName = result.persons.b.displayName;

  const openWindow =
    showWindows && openIndex !== null ? windows[openIndex] ?? null : null;
  const openReading = openWindow
    ? daeunWindowReading(openWindow.cls, framing, {
        aName,
        bName,
        leader:
          openWindow.cls === 'complementary'
            ? openWindow.aAvg > openWindow.bAvg
              ? 'a'
              : 'b'
            : undefined,
      })
    : null;

  const legendChip = (color: string, name: string) => (
    <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
      <span
        aria-hidden="true"
        style={{
          width: '0.65rem',
          height: '0.65rem',
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      <strong>{name}</strong>
    </span>
  );

  const starRow = (label: string, value: number) => (
    <div
      key={label}
      style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginTop: '0.4rem' }}
    >
      <span style={{ minWidth: '5.5rem', fontWeight: 700 }}>{label}</span>
      <Stars value={displayStars(value)} />
    </div>
  );

  return (
    <Section
      title="전 생애를 나란히"
      lede="10년 대운의 큰 흐름을 달력 연도로 맞춰 겹쳐 봐요."
    >
      <div className="v3-card">
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '0.5rem',
          }}
        >
          {legendChip('var(--color-chart-line-a)', aName)}
          {legendChip('var(--color-chart-line-b)', bName)}
          {showWindows ? legendChip('var(--color-accent)', '두 사람의 평균') : null}
        </div>
        {showWindows ? (
          <p style={{ margin: '0 0 0.5rem' }}>
            평균 곡선 위의 점을 누르면 그 10년 구간을 열어 볼 수 있어요.
          </p>
        ) : null}
        <div className="v3-life-timeline">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            role={showWindows ? 'list' : 'img'}
            aria-label={`${aName}과 ${bName}의 대운 별점 곡선을 ${Math.round(spanStart)}년부터 ${Math.round(spanEnd)}년까지 겹쳐 본 그림`}
          >
            <line
              x1={padX}
              y1={baselineY}
              x2={w - padX}
              y2={baselineY}
              stroke="var(--color-rule-strong)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {ticks.map(tick => (
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
                  {tick}
                </text>
              </g>
            ))}
            {showNow ? (
              <g>
                <line
                  x1={x(anchorYear!)}
                  y1={16}
                  x2={x(anchorYear!)}
                  y2={baselineY}
                  stroke="var(--color-accent)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <text
                  x={x(anchorYear!)}
                  y={11}
                  textAnchor="middle"
                  style={{
                    fill: 'var(--color-accent)',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  지금
                </text>
              </g>
            ) : null}
            <path
              d={pathA}
              fill="none"
              stroke="var(--color-chart-line-a)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d={pathB}
              fill="none"
              stroke="var(--color-chart-line-b)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {anchorsA
              .filter(point => point.isDecadeStart)
              .map(point => (
                <circle
                  key={`a-${point.year}`}
                  cx={x(point.year)}
                  cy={starY(point.stars)}
                  r={3}
                  fill="var(--color-chart-line-a)"
                />
              ))}
            {anchorsB
              .filter(point => point.isDecadeStart)
              .map(point => (
                <circle
                  key={`b-${point.year}`}
                  cx={x(point.year)}
                  cy={starY(point.stars)}
                  r={3}
                  fill="var(--color-chart-line-b)"
                />
              ))}
            {showWindows ? (
              <path
                d={pathAvg}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="2.6"
                strokeOpacity="0.9"
                strokeLinecap="round"
              />
            ) : null}
            {showWindows
              ? windows.map((window, index) => {
                  const isOpen = openIndex === index;
                  const cx = x((window.startYear + window.endYear) / 2);
                  const cy = starY(window.combined);
                  return (
                    <g
                      key={`w-${window.startYear}`}
                      className="v3-life-dot"
                      role="listitem"
                      tabIndex={0}
                      aria-label={`${Math.round(window.startYear)}년부터 ${Math.round(window.endYear)}년까지 함께 흐름 구간`}
                      aria-expanded={isOpen}
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setOpenIndex(isOpen ? null : index);
                        }
                      }}
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isOpen ? 8.5 : 6}
                        fill={isOpen ? 'var(--color-accent)' : 'var(--color-paper-2)'}
                        stroke="var(--color-accent)"
                        strokeWidth={isOpen ? 2.5 : 2}
                      />
                    </g>
                  );
                })
              : null}
          </svg>
        </div>
        {openWindow && openReading ? (
          <div className="v3-life-panel" role="region" aria-label="선택한 함께 흐름 구간">
            <div className="v3-life-panel-head">
              <span className="v3-badge">
                {Math.round(openWindow.startYear)}–{Math.round(openWindow.endYear)}
              </span>
              <span
                className="v3-badge"
                style={{ color: 'var(--color-accent)', borderColor: 'var(--color-accent-soft)' }}
              >
                {WINDOW_CLASS_KO[openWindow.cls]}
              </span>
            </div>
            <div style={{ marginTop: '0.45rem' }}>
              {starRow(aName, openWindow.aAvg)}
              {starRow(bName, openWindow.bAvg)}
              {starRow('함께', openWindow.combined)}
            </div>
            <p style={{ margin: '0.6rem 0 0', fontWeight: 700 }}>{openReading.headline}</p>
            {openReading.body ? (
              <p style={{ margin: '0.45rem 0 0' }}>{openReading.body}</p>
            ) : null}
            <button
              type="button"
              className="v3-button v3-button--ghost"
              style={{ marginTop: '0.7rem' }}
              onClick={() => setOpenIndex(null)}
            >
              접기
            </button>
          </div>
        ) : null}
        <p className="v3-hint" style={{ margin: '0.6rem 0 0' }}>
          엔진이 사람별로 채점한 대운 별점을 태어난 해에 맞춰 달력 연도로 겹쳐 본
          참고 그림이에요. 구간의 분류도 그 별점의 구간 평균·차이라는 투명한
          산술에서만 나와요. 두 사람 사이의 새로운 판단을 더한 것은 아니에요.
        </p>
      </div>
    </Section>
  );
}
