/**
 * life-curve-card.ts -- 0~100세 연 단위 운세 커브 (대운 추세 + 세운 잔물결).
 *
 * 대운(10년 흐름)이 추세를, 세운(그 해 간지)이 잔물결을 만든다는 통념을
 * 시각화용 점수 배열로 만든다. 등급 산식은 life-stage 카드와 동일한
 * `getPillarGrade`(천간 기본 + 지지 ±1 보정)를 공유해 별점과 모순되지 않는다.
 *
 * - 세운 소스는 `saju.saeunPillars`(입춘 경계 반영, saju-ts에서 120년치 기계산).
 *   달력 연도 산술(`getYearlyFortune`)은 입춘 이전 구간에서 1년 어긋나므로
 *   여기서는 쓰지 않는다.
 * - 기운(起運) 이전 나이는 대운 성분을 빼고 세운 단독으로 가중 재정규화한다
 *   (미개시 첫 대운을 소급 적용하는 것은 명리적 오류).
 * - 점수 정본 규칙: 칩/분야 카드의 별점(정수 등급)이 정본이고, 이 커브의
 *   0~100 점수는 시각화용 파생값이다.
 */
import type { SajuSummary } from '../../types.js';
import type { ElementCode } from '../types.js';
import { getPillarGrade, gradeToStarsShared } from '../common/fortuneCalculator.js';
import { STEM_BY_CODE, BRANCH_BY_CODE } from '../common/elementMaps.js';

export interface LifeCurvePoint {
  /** 출생 기준 경과 연수 (만 나이 근사). */
  readonly age: number;
  readonly year: number;
  /** 0~100 시각화 점수 (등급 블렌드 ×20). */
  readonly score: number;
  /** 이 나이의 활성 대운 인덱스. 기운 전이면 null. */
  readonly daeunIndex: number | null;
}

export interface LifeCurveDaeunSegment {
  readonly index: number;
  /** 표시용 내림 나이 (life-stage 카드와 동일 규약). */
  readonly startAge: number;
  readonly endAge: number;
  /** 커브 전환점용 원본 소수 나이 (三日一歲 산출값 그대로). */
  readonly startAgeExact: number;
  readonly endAgeExact: number;
  readonly pillarDisplay: string;
  /** 대운 단독 등급 별점 — lifeStageFortune 칩과 같은 산식. */
  readonly stars: 1 | 2 | 3 | 4 | 5;
  readonly label: string;
}

export interface LifeCurveCard {
  readonly title: string;
  readonly points: readonly LifeCurvePoint[];
  readonly daeunSegments: readonly LifeCurveDaeunSegment[];
  readonly currentAge: number | null;
  /** 블렌드 가중 — 제품 휴리스틱(고전에 수치 가중 선례 없음). */
  readonly weights: { readonly daeun: number; readonly seun: number };
}

// 대운 0.6 + 세운 0.4 — 제품 휴리스틱. 대운=추세, 세운=잔물결이라는 읽기를
// 수치화한 것으로 고전 근거가 있는 비율이 아니다. 조정은 이 상수만 바꾼다.
const DAEUN_WEIGHT = 0.6;
const SEUN_WEIGHT = 0.4;
const MAX_AGE = 100;

const STEM_TO_ELEMENT: Record<string, ElementCode> = {
  GAP: 'WOOD', EUL: 'WOOD', BYEONG: 'FIRE', JEONG: 'FIRE', MU: 'EARTH',
  GI: 'EARTH', GYEONG: 'METAL', SIN: 'METAL', IM: 'WATER', GYE: 'WATER',
};
const ELEMENT_CODES: ReadonlySet<string> = new Set(['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']);

function toElementCode(value: unknown): ElementCode | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (ELEMENT_CODES.has(upper)) return upper as ElementCode;
  return STEM_TO_ELEMENT[upper] ?? null;
}

interface DaeunPillarRuntime {
  readonly stem: string;
  readonly branch: string;
  readonly startAge: number;
  readonly endAge: number;
}

/** SajuSummary.daeunInfo는 인덱스 시그니처 경유 런타임 파싱 (어댑터 규약). */
function extractDaeunPillars(saju: SajuSummary): DaeunPillarRuntime[] {
  const raw = (saju as Record<string, unknown>)['daeunInfo'];
  if (!raw || typeof raw !== 'object') return [];
  const pillarsRaw = (raw as Record<string, unknown>)['pillars'];
  if (!Array.isArray(pillarsRaw)) return [];
  const pillars: DaeunPillarRuntime[] = [];
  for (const p of pillarsRaw) {
    if (!p || typeof p !== 'object') continue;
    const pp = p as Record<string, unknown>;
    if (typeof pp.stem !== 'string' || typeof pp.branch !== 'string') continue;
    pillars.push({
      stem: pp.stem,
      branch: pp.branch,
      startAge: typeof pp.startAge === 'number' ? pp.startAge : 0,
      endAge: typeof pp.endAge === 'number' ? pp.endAge : 0,
    });
  }
  return pillars.sort((a, b) => a.startAge - b.startAge);
}

function pillarElements(stemCode: string, branchCode: string): { stem: ElementCode | null; branch: ElementCode | null; display: string } {
  const stemInfo = STEM_BY_CODE[stemCode.toUpperCase()];
  const branchInfo = BRANCH_BY_CODE[branchCode.toUpperCase()];
  return {
    stem: stemInfo?.element ?? toElementCode(stemCode),
    branch: branchInfo?.element ?? null,
    display: `${stemInfo?.hangul ?? stemCode}${branchInfo?.hangul ?? branchCode}`,
  };
}

export function buildLifeCurveCard(
  saju: SajuSummary,
  birthYear: number | null,
  currentAge: number | null,
): LifeCurveCard | null {
  const yongshin = toElementCode(saju.yongshin?.element);
  if (!yongshin || !birthYear) return null;
  const heeshin = toElementCode(saju.yongshin?.heeshin);
  const gishin = toElementCode(saju.yongshin?.gishin);

  const daeunPillars = extractDaeunPillars(saju);
  // saeunPillars는 SajuSummary 인덱스 시그니처 경유 (어댑터가 런타임에 부착).
  const saeun = new Map<number, { stem: string; branch: string }>();
  const saeunRaw = (saju as Record<string, unknown>)['saeunPillars'];
  if (Array.isArray(saeunRaw)) {
    for (const s of saeunRaw) {
      if (!s || typeof s !== 'object') continue;
      const sp = s as Record<string, unknown>;
      const year = Number(sp.year);
      if (!Number.isFinite(year) || typeof sp.stem !== 'string' || typeof sp.branch !== 'string') continue;
      saeun.set(year, { stem: sp.stem, branch: sp.branch });
    }
  }
  if (daeunPillars.length === 0 && saeun.size === 0) return null;

  const firstDaeunStart = daeunPillars.length ? daeunPillars[0].startAge : Number.POSITIVE_INFINITY;

  const daeunSegments: LifeCurveDaeunSegment[] = daeunPillars.map((p, index) => {
    const el = pillarElements(p.stem, p.branch);
    const grade = el.stem ? getPillarGrade(el.stem, el.branch, yongshin, heeshin, gishin) : 3;
    const startAge = Math.floor(p.startAge);
    const endAge = Math.floor(p.endAge);
    return {
      index,
      startAge,
      endAge,
      startAgeExact: p.startAge,
      endAgeExact: p.endAge,
      pillarDisplay: el.display,
      stars: gradeToStarsShared(grade),
      label: `${startAge}세~${Math.max(startAge, endAge - 1)}세`, // 폐구간 표기 (겹침 방지)
    };
  });

  const points: LifeCurvePoint[] = [];
  for (let age = 0; age <= MAX_AGE; age += 1) {
    let daeunGrade: number | null = null;
    let daeunIndex: number | null = null;
    if (age >= firstDaeunStart) {
      let idx = daeunPillars.findIndex((p) => age >= p.startAge && age <= p.endAge);
      if (idx < 0) idx = daeunPillars.length - 1; // 마지막 대운 이후는 추세 연장
      const p = daeunPillars[idx];
      const el = pillarElements(p.stem, p.branch);
      if (el.stem) {
        daeunGrade = getPillarGrade(el.stem, el.branch, yongshin, heeshin, gishin);
        daeunIndex = idx;
      }
    }

    const year = birthYear + age;
    let seunGrade: number | null = null;
    const sp = saeun.get(year);
    if (sp) {
      const el = pillarElements(sp.stem, sp.branch);
      if (el.stem) seunGrade = getPillarGrade(el.stem, el.branch, yongshin, heeshin, gishin);
    }

    let weightSum = 0;
    let acc = 0;
    if (daeunGrade !== null) { acc += DAEUN_WEIGHT * daeunGrade; weightSum += DAEUN_WEIGHT; }
    if (seunGrade !== null) { acc += SEUN_WEIGHT * seunGrade; weightSum += SEUN_WEIGHT; }
    if (weightSum === 0) continue; // 이 해는 산출 불가(둘 다 결측) — 점 생략

    points.push({
      age,
      year,
      score: Math.round((acc / weightSum) * 20),
      daeunIndex,
    });
  }

  if (points.length === 0) return null;

  return {
    title: '평생 운의 흐름 (대운·세운)',
    points,
    daeunSegments,
    currentAge,
    weights: { daeun: DAEUN_WEIGHT, seun: SEUN_WEIGHT },
  };
}
