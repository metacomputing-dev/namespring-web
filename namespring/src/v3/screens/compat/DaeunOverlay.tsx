/**
 * 전 생애를 나란히 — 두 사람의 대운 별점 곡선을 하나의 달력 연도 축에 겹친다.
 *
 * 데이터는 사람별 delivery(궁합 계산이 이미 캐시해 둔 것)에서만 온다:
 * daeun_timeline fact + saju 표면 life_flow 블록의 daeunRatings(stars_1_5 metric).
 * 각 대운의 연속 나이 구간 [startAge, endAge)를 그 사람의 태어난 해에 더해
 * 달력 연도로 옮긴 뒤, 두 곡선이 함께 존재하는 구간만 그린다.
 * 어느 한쪽이라도 대운·별점이 없으면 섹션 전체를 그리지 않는다.
 *
 * 아래 읽기 문장은 엔진 별점의 투명한 산술(구간 평균·차이)로만 만들고,
 * 두 사람 사이의 새로운 운세 판단을 더하지 않는다.
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
import { Section } from '../../ui/primitives';

/* ================================================================== */
/* 데이터 추출                                                           */
/* ================================================================== */

interface DecadeSegment {
  order: number;
  /** 달력 연도(연속값) — 태어난 해 + 연속 나이. */
  startYear: number;
  endYear: number;
  stars: number;
}

interface PersonCurve {
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

/** 해당 연도에 걸린 대운의 별점. 채점이 빠진 구간이면 null. */
function starsAtYear(curve: PersonCurve, year: number): number | null {
  const segment = curve.segments.find(s => year >= s.startYear && year < s.endYear);
  return segment ? segment.stars : null;
}

/* ================================================================== */
/* 읽기 문장용 겹침 구간 산술                                              */
/* ================================================================== */

interface OverlapSegment {
  startYear: number;
  endYear: number;
  aStars: number;
  bStars: number;
}

/** 두 사람의 대운 경계를 합쳐 만든 겹침 구간마다 양쪽 별점을 붙인다. */
function overlapSegments(
  a: PersonCurve,
  b: PersonCurve,
  spanStart: number,
  spanEnd: number,
): OverlapSegment[] {
  const boundaries = new Set<number>([spanStart, spanEnd]);
  for (const curve of [a, b]) {
    for (const segment of curve.segments) {
      if (segment.startYear > spanStart && segment.startYear < spanEnd) {
        boundaries.add(segment.startYear);
      }
      if (segment.endYear > spanStart && segment.endYear < spanEnd) {
        boundaries.add(segment.endYear);
      }
    }
  }
  const sorted = [...boundaries].sort((x, y) => x - y);
  const result: OverlapSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const startYear = sorted[i];
    const endYear = sorted[i + 1];
    if (endYear - startYear < 1) continue;
    const mid = (startYear + endYear) / 2;
    const aStars = starsAtYear(a, mid);
    const bStars = starsAtYear(b, mid);
    if (aStars === null || bStars === null) continue;
    result.push({ startYear, endYear, aStars, bStars });
  }
  return result;
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
/* 읽기 문장                                                             */
/* ================================================================== */

function yearRangeLabel(segment: OverlapSegment): string {
  return `${Math.round(segment.startYear)}–${Math.round(segment.endYear)}`;
}

function buildReadingLines(
  segments: OverlapSegment[],
  framing: CompatFramingV1,
): string[] {
  const lines: string[] = [];
  if (segments.length === 0) return lines;

  let best = segments[0];
  for (const segment of segments) {
    if (segment.aStars + segment.bStars > best.aStars + best.bStars) best = segment;
  }
  lines.push(
    `두 흐름이 함께 높아지는 구간은 ${yearRangeLabel(best)} 무렵이에요. 함께 도모하는 일에 힘이 실리는 시기로 읽어요.`,
  );

  let widest = segments[0];
  for (const segment of segments) {
    if (
      Math.abs(segment.aStars - segment.bStars)
      > Math.abs(widest.aStars - widest.bStars)
    ) {
      widest = segment;
    }
  }
  if (Math.abs(widest.aStars - widest.bStars) >= 1) {
    if (framing === 'guardian' || framing === 'kids') {
      lines.push(
        `${yearRangeLabel(widest)} 무렵에는 두 흐름의 높이가 가장 다르게 나타나요. 어른의 흐름이 받쳐 주는 동안 아이의 흐름이 자라나는 구간으로 읽어요.`,
      );
    } else {
      lines.push(
        `${yearRangeLabel(widest)} 무렵에는 두 흐름의 결이 가장 크게 갈려요. 한쪽의 흐름이 잠시 쉬어 갈 때 다른 쪽이 이끌어 주는 리듬이에요.`,
      );
    }
  }
  return lines;
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

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
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

  const ticks: number[] = [];
  for (let tick = Math.ceil(spanStart / 10) * 10; tick <= spanEnd; tick += 10) {
    ticks.push(tick);
  }

  // '지금'은 delivery의 anchorDate 연도로 표시한다 (기기 시계를 쓰지 않는다).
  const anchorYear = a.anchorYear ?? b.anchorYear;
  const showNow = anchorYear !== null && anchorYear >= spanStart && anchorYear <= spanEnd;

  const framing = result.context.fact.framing;
  const readingLines = buildReadingLines(
    overlapSegments(a, b, spanStart, spanEnd),
    framing,
  );

  const aName = result.persons.a.displayName;
  const bName = result.persons.b.displayName;

  const legendChip = (color: string, name: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
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
        </div>
        <div className="v3-life-timeline">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            role="img"
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
          </svg>
        </div>
        {readingLines.map((line, index) => (
          <p key={index} style={{ margin: '0.55rem 0 0' }}>{line}</p>
        ))}
        <p className="v3-hint" style={{ margin: '0.6rem 0 0' }}>
          엔진이 사람별로 채점한 대운 별점을 태어난 해에 맞춰 달력 연도로 겹쳐 본
          참고 그림이에요. 두 사람 사이의 새로운 판단을 더한 것은 아니에요.
        </p>
      </div>
    </Section>
  );
}
