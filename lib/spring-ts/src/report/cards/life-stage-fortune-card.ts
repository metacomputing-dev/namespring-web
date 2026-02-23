/**
 * life-stage-fortune-card.ts -- 생애 시기별 운세 (대운) 카드 빌더
 *
 * 대운(10년 단위 운세)을 기반으로 인생 각 시기의 별점과 요약을 제공합니다.
 *
 * 대운 정보 소스: saju.daeunInfo (인덱스 시그니처를 통해 런타임에 접근)
 *
 * daeunInfo 구조:
 *   {
 *     isForward: boolean;
 *     firstDaeunStartAge: number;
 *     firstDaeunStartMonths: number;
 *     pillars: Array<{
 *       stem: string; branch: string;
 *       startAge: number; endAge: number; order: number;
 *     }>;
 *   }
 *
 * 모든 텍스트는 ~해요/~에요 체를 사용합니다.
 */

import type { SajuSummary } from '../../types.js';
import type {
  LifeStageFortuneCard,
  LifeStageFortuneEntry,
  StarRating,
} from '../types.js';
import type { ElementCode } from '../types.js';

import { getFortuneGrade } from '../common/fortuneCalculator.js';
import {
  STEM_BY_CODE,
  BRANCH_BY_CODE,
  ELEMENT_GENERATES,
  ELEMENT_CONTROLS,
  ELEMENT_GENERATED_BY,
  ELEMENT_NATURE,
  ELEMENT_SEASON,
  ELEMENT_HOBBY,
} from '../common/elementMaps.js';

// ---------------------------------------------------------------------------
//  Element helpers
// ---------------------------------------------------------------------------

const ELEMENT_KO: Record<ElementCode, string> = {
  WOOD: '나무', FIRE: '불', EARTH: '흙', METAL: '쇠', WATER: '물',
};

const STEM_TO_ELEMENT: Record<string, ElementCode> = {
  GAP: 'WOOD', EUL: 'WOOD',
  BYEONG: 'FIRE', JEONG: 'FIRE',
  MU: 'EARTH', GI: 'EARTH',
  GYEONG: 'METAL', SIN: 'METAL',
  IM: 'WATER', GYE: 'WATER',
};

function toElementCode(value: unknown): ElementCode | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (upper in ELEMENT_KO) return upper as ElementCode;
  return STEM_TO_ELEMENT[upper] ?? null;
}

function elementKo(code: ElementCode): string {
  return ELEMENT_KO[code];
}

/** 한글 받침 유무에 따라 와/과 선택 */
function gwaWa(word: string): string {
  if (!word) return word + '와';
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xAC00 || last > 0xD7A3) return word + '와';
  return (last - 0xAC00) % 28 !== 0 ? word + '과' : word + '와';
}

/** 천간/지지 오행이 같으면 하나로, 다르면 "A와/과 B" */
function elementPairDesc(stemEl: ElementCode, branchEl: ElementCode): string {
  const stemKo = elementKo(stemEl);
  const branchKo = elementKo(branchEl);
  if (stemEl === branchEl) return stemKo;
  return `${gwaWa(stemKo)} ${branchKo}`;
}

function gradeToStars(grade: number): StarRating {
  if (grade >= 5) return 5;
  if (grade >= 4) return 4;
  if (grade >= 3) return 3;
  if (grade >= 2) return 2;
  return 1;
}

function floorAge(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value);
}

/**
 * Adjust the stem-only fortune grade by considering the branch element.
 * - Branch matches yongshin: +1
 * - Branch matches heeshin: +0 (no adjustment, already neutral-positive)
 * - Branch matches gishin:  -1
 */
function adjustGradeForBranch(
  baseGrade: number,
  branchEl: ElementCode,
  yongshinEl: ElementCode,
  heeshinEl: ElementCode | null,
  gishinEl: ElementCode | null,
): number {
  let adjusted = baseGrade;
  if (branchEl === yongshinEl) adjusted += 1;
  else if (branchEl === gishinEl) adjusted -= 1;
  return Math.max(1, Math.min(5, Math.round(adjusted)));
}

// ---------------------------------------------------------------------------
//  Daeun pillar interface for runtime access
// ---------------------------------------------------------------------------

interface DaeunPillar {
  readonly stem: string;
  readonly branch: string;
  readonly startAge: number;
  readonly endAge: number;
  readonly order: number;
}

interface DaeunInfo {
  readonly isForward: boolean;
  readonly firstDaeunStartAge: number;
  readonly firstDaeunStartMonths: number;
  readonly pillars: DaeunPillar[];
}

function extractDaeunInfo(saju: SajuSummary): DaeunInfo | null {
  // Access via index signature
  const raw = (saju as Record<string, unknown>)['daeunInfo'];
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.pillars)) return null;

  const pillars: DaeunPillar[] = [];
  for (const p of obj.pillars) {
    if (!p || typeof p !== 'object') continue;
    const pp = p as Record<string, unknown>;
    if (typeof pp.stem !== 'string' || typeof pp.branch !== 'string') continue;

    pillars.push({
      stem: pp.stem as string,
      branch: pp.branch as string,
      startAge: typeof pp.startAge === 'number' ? pp.startAge : 0,
      endAge: typeof pp.endAge === 'number' ? pp.endAge : 0,
      order: typeof pp.order === 'number' ? pp.order : 0,
    });
  }

  if (pillars.length === 0) return null;

  return {
    isForward: typeof obj.isForward === 'boolean' ? obj.isForward : true,
    firstDaeunStartAge: typeof obj.firstDaeunStartAge === 'number' ? obj.firstDaeunStartAge : 0,
    firstDaeunStartMonths: typeof obj.firstDaeunStartMonths === 'number' ? obj.firstDaeunStartMonths : 0,
    pillars,
  };
}

// ---------------------------------------------------------------------------
//  Stage summary generator
// ---------------------------------------------------------------------------

function makeStageSummary(
  stemEl: ElementCode,
  branchEl: ElementCode,
  grade: number,
  startAge: number,
  endAge: number,
): string {
  const ageDesc = `${startAge}세~${endAge}세`;
  const elDesc = elementPairDesc(stemEl, branchEl);

  if (grade >= 5) {
    return `${ageDesc} 시기는 ${elDesc} 기운이 최고로 좋아요. 적극적으로 도전하고 확장하기 좋은 전성기예요.`;
  }
  if (grade >= 4) {
    return `${ageDesc} 시기는 ${elDesc} 기운이 도움을 줘서 성장과 발전이 기대되는 좋은 시기예요.`;
  }
  if (grade >= 3) {
    return `${ageDesc} 시기는 ${elDesc} 기운이 보통 수준이에요. 꾸준히 기반을 다지면 좋아요.`;
  }
  if (grade >= 2) {
    return `${ageDesc} 시기는 ${elDesc} 기운에 주의가 필요해요. 건강과 인간관계를 잘 챙기세요.`;
  }
  return `${ageDesc} 시기는 ${elDesc} 기운이 도전적이에요. 무리한 확장보다 내실을 다지는 데 집중하세요.`;
}

function makeHighlights(
  stemEl: ElementCode,
  branchEl: ElementCode,
  grade: number,
  yongshinEl: ElementCode,
): string[] {
  const highlights: string[] = [];
  const nature = ELEMENT_NATURE[stemEl];
  const hobbies = ELEMENT_HOBBY[stemEl] ?? [];

  if (nature) {
    highlights.push(`${nature}이 이 시기의 핵심 흐름이에요.`);
  }

  if (grade >= 4) {
    highlights.push(`이 시기에는 새로운 시작이나 도전이 잘 풀릴 가능성이 높아요.`);
  } else if (grade <= 2) {
    highlights.push(`이 시기에는 안정과 내실 다지기에 집중하는 것이 좋아요.`);
  }

  // For low-grade periods, recommend yongshin activities instead of the
  // period's stem-element activities (which may match the gishin).
  if (grade <= 2) {
    const yongshinHobbies = ELEMENT_HOBBY[yongshinEl] ?? [];
    if (yongshinHobbies.length > 0) {
      highlights.push(
        `${yongshinHobbies.slice(0, 2).join(', ')} 같은 ${elementKo(yongshinEl)} 기운 활동을 가까이하면 이 시기를 잘 보낼 수 있어요.`,
      );
    }
  } else if (hobbies.length > 0) {
    highlights.push(`${hobbies.slice(0, 2).join(', ')} 같은 활동이 이 시기의 기운과 잘 맞아요.`);
  }

  // Ensure at least 1 highlight
  if (highlights.length === 0) {
    highlights.push('균형 잡힌 생활 리듬을 유지하는 것이 이 시기의 핵심이에요.');
  }

  return highlights;
}

// ---------------------------------------------------------------------------
//  Main builder
// ---------------------------------------------------------------------------

export function buildLifeStageFortuneCard(
  saju: SajuSummary,
  currentAge: number | null,
): LifeStageFortuneCard {
  const daeunInfo = extractDaeunInfo(saju);

  // Extract yongshin data
  const yongshinElement = toElementCode(saju.yongshin?.element) ?? 'WATER';
  const heeshinElement = toElementCode(saju.yongshin?.heeshin);
  const gishinElement = toElementCode(saju.yongshin?.gishin);

  const stages: LifeStageFortuneEntry[] = [];
  let currentStageIndex: number | null = null;

  if (!daeunInfo || daeunInfo.pillars.length === 0) {
    // No daeun data: return a single default stage
    return {
      title: '생애 시기별 운세',
      stages: [{
        ageRange: '대운 정보 없음',
        startAge: 0,
        endAge: 0,
        pillarDisplay: '-',
        stars: 3,
        summary: '대운 정보가 부족해서 세부 시기별 분석이 어려워요. 기본 사주 원국의 흐름을 참고해 주세요.',
        highlights: ['대운 데이터가 제공되면 더 정확한 시기별 운세를 볼 수 있어요.'],
      }],
      currentStageIndex: null,
    };
  }

  // Sort pillars by startAge to ensure correct order
  const sortedPillars = [...daeunInfo.pillars].sort((a, b) => a.startAge - b.startAge);

  for (let i = 0; i < sortedPillars.length; i++) {
    const dp = sortedPillars[i];

    // Resolve stem and branch elements
    const stemCode = dp.stem.toUpperCase();
    const branchCode = dp.branch.toUpperCase();

    const stemInfo = STEM_BY_CODE[stemCode];
    const branchInfo = BRANCH_BY_CODE[branchCode];

    const stemEl: ElementCode = stemInfo?.element ?? toElementCode(stemCode) ?? 'EARTH';
    const branchEl: ElementCode = branchInfo?.element ?? 'EARTH';

    // Compute yongshin grade (stem-based), then adjust for branch element
    const baseGrade = getFortuneGrade(stemEl, yongshinElement, heeshinElement, gishinElement);
    const grade = adjustGradeForBranch(baseGrade, branchEl, yongshinElement, heeshinElement, gishinElement);
    const stars = gradeToStars(grade);

    // Build display string
    const stemHangul = stemInfo?.hangul ?? stemCode;
    const branchHangul = branchInfo?.hangul ?? branchCode;
    const pillarDisplay = `${stemHangul}${branchHangul}`;

    // Age range
    const flooredStartAge = floorAge(dp.startAge);
    const flooredEndAge = floorAge(dp.endAge);
    const ageRange = `${flooredStartAge}세 ~ ${flooredEndAge}세`;

    // Check if this is the current stage
    if (
      currentAge !== null &&
      currentAge >= dp.startAge &&
      currentAge <= dp.endAge
    ) {
      currentStageIndex = i;
    }

    const summary = makeStageSummary(stemEl, branchEl, grade, flooredStartAge, flooredEndAge);
    const highlights = makeHighlights(stemEl, branchEl, grade, yongshinElement);

    stages.push({
      ageRange,
      startAge: flooredStartAge,
      endAge: flooredEndAge,
      pillarDisplay,
      stars,
      summary,
      highlights,
    });
  }

  return {
    title: '생애 시기별 운세',
    stages,
    currentStageIndex,
  };
}
