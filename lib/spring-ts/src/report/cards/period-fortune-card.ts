/**
 * period-fortune-card.ts -- 기간별 운세 카드 빌더
 *
 * 일운 / 주운 / 월운 / 연운을 산출하고, 용신 부합도에 따라 별점과
 * 조언/경고를 생성합니다.
 *
 * 기간별 간지 산출:
 *   - yearly:  saeunPillars 또는 (year - 4) % 60
 *   - monthly: 오호기법 (fortuneCalculator)
 *   - daily:   줄리안 데이 기반 (fortuneCalculator)
 *   - weekly:  7일 일운의 평균/지배적 등급
 *
 * 모든 텍스트는 ~해요/~에요 체를 사용합니다.
 */

import type { SajuSummary } from '../../types.js';
import type {
  PeriodFortuneCard,
  FortunePeriodKind,
  StarRating,
  FortuneAdvice,
  FortuneWarning,
  FortuneCategory,
  FortuneTimeSeries,
} from '../types.js';
import type { ElementCode, BranchCode } from '../types.js';

import {
  getYearlyFortune,
  getMonthlyFortuneSolar,
  getDailyFortune,
  getWeeklyFortunes,
  getFortuneGrade,
  getHourStemElement,
  checkFortuneRelations,
} from '../common/fortuneCalculator.js';
import type { FortuneGanzhi } from '../common/fortuneCalculator.js';

import {
  ELEMENT_GENERATES,
  ELEMENT_CONTROLS,
  ELEMENT_GENERATED_BY,
  ELEMENT_CONTROLLED_BY,
  ELEMENT_FOOD,
  ELEMENT_HOBBY,
  ELEMENT_COLOR,
  ELEMENT_DIRECTION,
  ELEMENT_ORGAN,
  STEM_BY_CODE,
  BRANCH_BY_CODE,
  BRANCHES,
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

/** 한글 받침 유무에 따라 은/는 선택 */
function eunNeun(word: string): string {
  if (!word) return word + '는';
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xAC00 || last > 0xD7A3) return word + '는';
  return (last - 0xAC00) % 28 !== 0 ? word + '은' : word + '는';
}

/** 천간/지지 오행이 같으면 하나로, 다르면 "A와/과 B" */
function elementPairDesc(stemEl: ElementCode, branchEl: ElementCode): string {
  const stemKo = elementKo(stemEl);
  const branchKo = elementKo(branchEl);
  if (stemEl === branchEl) return stemKo;
  return `${gwaWa(stemKo)} ${branchKo}`;
}

// ---------------------------------------------------------------------------
//  Extract natal data from SajuSummary
// ---------------------------------------------------------------------------

interface NatalData {
  readonly dayMasterElement: ElementCode;
  readonly yongshinElement: ElementCode;
  readonly heeshinElement: ElementCode | null;
  readonly gishinElement: ElementCode | null;
  readonly natalBranches: BranchCode[];
  readonly deficientElements: ElementCode[];
}

function extractNatalData(saju: SajuSummary): NatalData {
  const dayMasterElement = toElementCode(saju.dayMaster?.element) ?? 'EARTH';
  const yongshinElement = toElementCode(saju.yongshin?.element) ?? 'WATER';
  const heeshinElement = toElementCode(saju.yongshin?.heeshin);
  const gishinElement = toElementCode(saju.yongshin?.gishin);

  const natalBranches: BranchCode[] = [];
  const pillars = saju.pillars;
  if (pillars) {
    for (const pos of ['year', 'month', 'day', 'hour'] as const) {
      const branch = pillars[pos]?.branch;
      if (branch) {
        const code = branch.code?.toUpperCase?.();
        if (code && BRANCH_BY_CODE[code]) {
          natalBranches.push(code as BranchCode);
        }
      }
    }
  }

  const deficientElements: ElementCode[] = [];
  if (Array.isArray(saju.deficientElements)) {
    for (const raw of saju.deficientElements) {
      const el = toElementCode(raw);
      if (el) deficientElements.push(el);
    }
  }

  return {
    dayMasterElement,
    yongshinElement,
    heeshinElement,
    gishinElement,
    natalBranches,
    deficientElements,
  };
}

// ---------------------------------------------------------------------------
//  Grade to StarRating
// ---------------------------------------------------------------------------

function gradeToStars(grade: number): StarRating {
  if (grade >= 5) return 5;
  if (grade >= 4) return 4;
  if (grade >= 3) return 3;
  if (grade >= 2) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
//  Compute pillar for a given period
// ---------------------------------------------------------------------------

interface PeriodPillar {
  readonly ganzhi: FortuneGanzhi;
  readonly label: string;
}

function computePillarForPeriod(
  saju: SajuSummary,
  periodKind: FortunePeriodKind,
  targetDate: Date,
): PeriodPillar | null {
  const year = targetDate.getFullYear();

  if (periodKind === 'yearly') {
    // Try saeunPillars first
    const saeunPillars = saju.saeunPillars as
      | Array<{ year: number; stem: string; branch: string }>
      | undefined;
    if (Array.isArray(saeunPillars)) {
      const match = saeunPillars.find((p) => p.year === year);
      if (match) {
        const stemInfo = STEM_BY_CODE[match.stem?.toUpperCase?.()];
        const branchInfo = BRANCH_BY_CODE[match.branch?.toUpperCase?.()];
        if (stemInfo && branchInfo) {
          return {
            ganzhi: {
              ganzhiIndex: 0, // not critical for grading
              stemIndex: stemInfo.index,
              branchIndex: branchInfo.index,
              stem: stemInfo,
              branch: branchInfo,
              ganzhiHangul: `${stemInfo.hangul}${branchInfo.hangul}`,
              ganzhiHanja: `${stemInfo.hanja}${branchInfo.hanja}`,
              stemElement: stemInfo.element,
              branchElement: branchInfo.element,
            },
            label: `${year}년`,
          };
        }
      }
    }
    // Fallback: compute from formula
    const yf = getYearlyFortune(year);
    return { ganzhi: yf, label: `${year}년` };
  }

  if (periodKind === 'monthly') {
    const solarMonth = targetDate.getMonth() + 1;
    const mf = getMonthlyFortuneSolar(year, solarMonth);
    return { ganzhi: mf, label: `${year}년 ${solarMonth}월` };
  }

  if (periodKind === 'daily') {
    const df = getDailyFortune(targetDate);
    const m = targetDate.getMonth() + 1;
    const d = targetDate.getDate();
    return { ganzhi: df, label: `${year}년 ${m}월 ${d}일` };
  }

  if (periodKind === 'weekly') {
    // Use the first day of the week for the label
    const m = targetDate.getMonth() + 1;
    const d = targetDate.getDate();
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 6);
    const em = endDate.getMonth() + 1;
    const ed = endDate.getDate();
    // For weekly, return null here -- handled separately
    return {
      ganzhi: getDailyFortune(targetDate),
      label: `${m}/${d} ~ ${em}/${ed}`,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
//  Period kind title mapping
// ---------------------------------------------------------------------------

const PERIOD_TITLE: Record<FortunePeriodKind, string> = {
  daily: '오늘의 운세',
  weekly: '이번 주 운세',
  monthly: '이번 달 운세',
  yearly: '올해의 운세',
  decade: '대운',
};

// ---------------------------------------------------------------------------
//  Summary text generators
// ---------------------------------------------------------------------------

function makeSummary(
  periodKind: FortunePeriodKind,
  stars: StarRating,
  stemEl: ElementCode,
  branchEl: ElementCode,
  natal: NatalData,
): string {
  const periodName =
    periodKind === 'daily' ? '오늘' :
    periodKind === 'weekly' ? '이번 주' :
    periodKind === 'monthly' ? '이번 달' :
    periodKind === 'yearly' ? '올해' : '이 시기';

  const elDesc = elementPairDesc(stemEl, branchEl);
  const periodSubject = eunNeun(periodName);

  if (stars >= 5) {
    return `${periodSubject} ${elDesc} 기운이 용신과 딱 맞아서 최고로 좋은 흐름이에요. 적극적으로 움직여도 좋아요.`;
  }
  if (stars >= 4) {
    return `${periodSubject} ${elDesc} 기운이 도움을 주는 흐름이에요. 계획한 일을 실행에 옮기기 좋은 시기예요.`;
  }
  if (stars >= 3) {
    return `${periodSubject} ${elDesc} 기운이 보통 수준이에요. 무리하지 않고 꾸준히 해나가면 좋아요.`;
  }
  if (stars >= 2) {
    return `${periodSubject} ${elDesc} 기운에 다소 주의가 필요해요. 큰 결정은 미루고 안정에 집중하세요.`;
  }
  return `${periodSubject} ${elDesc} 기운이 기신 방향이라 조심이 필요해요. 무리한 도전보다 체력 관리를 우선하세요.`;
}

// ---------------------------------------------------------------------------
//  Good/Bad actions generators
// ---------------------------------------------------------------------------

function makeGoodActions(
  stemEl: ElementCode,
  branchEl: ElementCode,
  natal: NatalData,
  grade: number,
  periodKind?: FortunePeriodKind,
): FortuneAdvice[] {
  const actions: FortuneAdvice[] = [];
  const yongshinEl = natal.yongshinElement;
  const foods = ELEMENT_FOOD[yongshinEl] ?? [];
  const hobbies = ELEMENT_HOBBY[yongshinEl] ?? [];
  const color = ELEMENT_COLOR[yongshinEl] ?? '';
  const direction = ELEMENT_DIRECTION[yongshinEl] ?? '';
  const isYongshinActive = stemEl === yongshinEl;

  if (periodKind === 'daily') {
    // Daily: immediate, specific actions
    if (isYongshinActive) {
      actions.push({
        text: `오늘은 ${elementKo(yongshinEl)} 기운이 자연스럽게 흐르는 날이에요. 이 기운을 적극 활용하세요.`,
        reason: '용신 기운이 활성화된 날이라 하는 일마다 순조로울 확률이 높아요.',
      });
    } else {
      actions.push({
        text: hobbies.length > 0
          ? `${elementKo(yongshinEl)} 기운을 보강하는 ${hobbies.slice(0, 2).join(', ')} 같은 활동을 추천해요.`
          : `${elementKo(yongshinEl)} 기운을 보강하는 활동이 오늘 운세 흐름에 도움이 돼요.`,
        reason: `용신인 ${elementKo(yongshinEl)} 기운을 채우면 오늘의 운세 흐름이 좋아져요.`,
      });
    }
    if (color && direction) {
      actions.push({
        text: `${color} 계열 옷이나 소품을 활용하고, ${direction} 방향을 의식하면 도움이 돼요.`,
        reason: `${elementKo(yongshinEl)} 기운의 색과 방위를 활용하면 자연스럽게 좋은 기운을 끌어올 수 있어요.`,
      });
    }
    if (foods.length > 0) {
      actions.push({
        text: `${foods.slice(0, 3).join(', ')} 같은 음식을 챙기면 기운 보충에 좋아요.`,
        reason: `${elementKo(yongshinEl)} 기운과 어울리는 음식은 몸의 균형을 맞추는 데 도움이 돼요.`,
      });
    }
  } else if (periodKind === 'weekly') {
    // Weekly: planning and social focus
    if (grade >= 4) {
      actions.push({
        text: '이번 주는 계획했던 일을 실행에 옮기기 좋아요. 미뤄둔 약속이나 프로젝트를 시작해 보세요.',
        reason: '기운이 좋은 주간에 행동하면 결과가 잘 따라와요.',
      });
    } else {
      actions.push({
        text: hobbies.length > 0
          ? `이번 주는 ${hobbies.slice(0, 2).join(', ')} 같은 활동으로 ${elementKo(yongshinEl)} 기운을 충전하세요.`
          : `이번 주는 ${elementKo(yongshinEl)} 기운을 채우는 활동에 시간을 투자하세요.`,
        reason: `용신인 ${elementKo(yongshinEl)} 기운을 채우면 한 주의 흐름이 좋아져요.`,
      });
    }
    if (color) {
      actions.push({
        text: `${color} 계열 소품이나 인테리어를 활용하면 주간 기운을 높일 수 있어요.`,
        reason: '생활 공간에 용신의 색을 두면 지속적으로 좋은 기운을 받을 수 있어요.',
      });
    }
    if (foods.length > 0) {
      actions.push({
        text: `이번 주 식단에 ${foods.slice(0, 3).join(', ')} 같은 음식을 포함시켜 보세요.`,
        reason: `${elementKo(yongshinEl)} 기운에 맞는 음식은 한 주의 에너지를 안정시켜 줘요.`,
      });
    }
  } else if (periodKind === 'monthly') {
    // Monthly: habit and routine focus
    if (grade >= 4) {
      actions.push({
        text: '이번 달은 새로운 습관이나 루틴을 시작하기 좋은 시기예요.',
        reason: '월간 기운이 안정적이라 꾸준히 이어갈 수 있는 동력이 있어요.',
      });
    } else {
      actions.push({
        text: hobbies.length > 0
          ? `${hobbies.slice(0, 2).join(', ')} 같은 활동을 주 2~3회 루틴으로 만들면 ${elementKo(yongshinEl)} 기운이 보강돼요.`
          : `${elementKo(yongshinEl)} 기운을 보강하는 활동을 주기적으로 하면 이번 달 운세 흐름이 좋아져요.`,
        reason: '용신 기운을 꾸준히 채우는 루틴이 월간 운세의 핵심이에요.',
      });
    }
    if (color && direction) {
      actions.push({
        text: `생활 공간에 ${color} 계열 소품을 배치하고, ${direction} 방향의 활동을 의식해 보세요.`,
        reason: '한 달간 꾸준히 용신 기운에 노출되면 자연스럽게 좋은 흐름이 만들어져요.',
      });
    }
    if (foods.length > 0) {
      actions.push({
        text: `${foods.slice(0, 3).join(', ')} 같은 음식을 식단에 자주 포함시키세요.`,
        reason: `한 달 동안 꾸준히 챙기면 ${elementKo(yongshinEl)} 기운 보충 효과가 커져요.`,
      });
    }
  } else if (periodKind === 'yearly') {
    // Yearly: big picture strategy
    if (isYongshinActive) {
      actions.push({
        text: `올해는 ${elementKo(yongshinEl)} 기운이 자연스럽게 흐르는 해예요. 큰 목표를 세우고 적극적으로 추진하세요.`,
        reason: '용신 기운이 활성화된 해라 도전과 확장에 유리해요.',
      });
    } else {
      actions.push({
        text: hobbies.length > 0
          ? `올해의 핵심은 ${elementKo(yongshinEl)} 기운 보강이에요. ${hobbies.slice(0, 2).join(', ')} 같은 활동을 꾸준히 해보세요.`
          : `올해는 ${elementKo(yongshinEl)} 기운을 의식적으로 보강하는 것이 핵심이에요.`,
        reason: '연간 기운의 균형을 잡으려면 용신 기운을 꾸준히 채우는 것이 중요해요.',
      });
    }
    if (color && direction) {
      actions.push({
        text: `${color} 계열을 올해의 테마 컬러로 삼고, 중요한 일은 ${direction} 방향을 의식하세요.`,
        reason: '연간 전략으로 용신의 색과 방위를 활용하면 장기적인 좋은 기운을 끌어올 수 있어요.',
      });
    }
    if (foods.length > 0) {
      actions.push({
        text: `올 한 해 ${foods.slice(0, 3).join(', ')} 같은 음식을 자주 챙기면 기운 보충에 좋아요.`,
        reason: `${elementKo(yongshinEl)} 기운에 맞는 식습관이 연간 건강과 운세의 기반이 돼요.`,
      });
    }
  } else {
    // Fallback (decade or unknown)
    actions.push({
      text: `${elementKo(yongshinEl)} 기운을 보강하는 활동이 좋아요. ${hobbies.length > 0 ? hobbies.slice(0, 2).join(', ') + ' 같은 활동을 추천해요.' : '편안한 활동을 찾아보세요.'}`,
      reason: `용신인 ${elementKo(yongshinEl)} 기운을 채우면 전체 운세 흐름이 좋아져요.`,
    });
  }

  return actions.slice(0, 3);
}

function makeBadActions(
  stemEl: ElementCode,
  branchEl: ElementCode,
  natal: NatalData,
  grade: number,
  periodKind?: FortunePeriodKind,
): FortuneAdvice[] {
  const actions: FortuneAdvice[] = [];
  const gishinEl = natal.gishinElement;

  // Action 1: Avoid gishin element activities
  if (gishinEl) {
    actions.push({
      text: `${elementKo(gishinEl)} 기운이 강한 활동이나 환경은 피하는 것이 좋아요.`,
      reason: `기신인 ${elementKo(gishinEl)} 기운이 강해지면 전체 운세 흐름에 방해가 될 수 있어요.`,
    });
  }

  // Action 2: Avoid rushed decisions on low-grade periods
  if (grade <= 2) {
    const periodDesc =
      periodKind === 'daily' ? '오늘은' :
      periodKind === 'weekly' ? '이번 주는' :
      periodKind === 'monthly' ? '이번 달은' :
      periodKind === 'yearly' ? '올해는' : '지금은';
    actions.push({
      text: `${periodDesc} 큰 계약이나 중요한 결정을 미루는 것이 안전해요.`,
      reason: '기운이 약한 시기에 무리하면 후회할 결과가 나오기 쉬워요.',
    });
  }

  // Action 3: Health caution for deficient elements
  if (natal.deficientElements.length > 0) {
    const weakEl = natal.deficientElements[0];
    const organ = ELEMENT_ORGAN[weakEl];
    actions.push({
      text: `${elementKo(weakEl)} 기운이 부족하니 ${organ?.detail ?? '관련 부위'}에 무리가 가지 않도록 주의하세요.`,
      reason: `평소 약한 오행의 장기는 기운이 떨어질 때 더 취약해질 수 있어요.`,
    });
  }

  // Fallback if we have fewer than 2
  if (actions.length < 2) {
    actions.push({
      text: '과로나 야식은 피하고 충분한 수면을 취하세요.',
      reason: '기본 컨디션을 지키는 것이 어떤 시기에나 가장 중요해요.',
    });
  }

  return actions.slice(0, 3);
}

// ---------------------------------------------------------------------------
//  Warning generator
// ---------------------------------------------------------------------------

function makeWarning(
  ganzhi: FortuneGanzhi,
  natal: NatalData,
  grade?: number,
): FortuneWarning {
  // Check branch relations with natal chart
  const branchCode = ganzhi.branch.code as BranchCode;
  const relations = checkFortuneRelations(branchCode, natal.natalBranches);
  const negativeRelations = relations.filter((r) => r.tone === 'negative');

  if (negativeRelations.length > 0) {
    const first = negativeRelations[0];
    const relType = first.type;
    const typeKo =
      relType === 'CHUNG' ? '충' :
      relType === 'HYEONG' ? '형' :
      relType === 'HAE' ? '해' :
      relType === 'PA' ? '파' :
      relType === 'WONJIN' ? '원진' : relType;

    return {
      signal: `원국 지지와 ${typeKo} 관계가 생겨 갈등이나 변동에 주의해야 해요.`,
      response: '중요한 대화나 결정은 한 박자 쉬고 진행하고, 감정적인 반응을 줄여보세요.',
      reason: `이 시기의 지지가 원국과 ${typeKo} 관계를 만들어 긴장이 높아질 수 있어요.`,
    };
  }

  // Check if fortune element controls day master
  const fortuneEl = ganzhi.stemElement;
  const controlsTarget = ELEMENT_CONTROLS[fortuneEl];
  if (controlsTarget === natal.dayMasterElement) {
    return {
      signal: '이 시기의 기운이 일간을 억누르는 방향이라 체력 관리가 중요해요.',
      response: '무리한 일정을 줄이고, 휴식 시간을 넉넉히 확보하세요.',
      reason: `${elementKo(fortuneEl)} 기운이 일간(${elementKo(natal.dayMasterElement)})을 극하므로 에너지가 소모되기 쉬워요.`,
    };
  }

  // Check if fortune element matches gishin (bad energy) on low-grade periods
  if (grade !== undefined && grade <= 2 && natal.gishinElement && fortuneEl === natal.gishinElement) {
    return {
      signal: `이 시기의 ${elementKo(fortuneEl)} 기운이 기신과 겹쳐서 전체적으로 주의가 필요해요.`,
      response: '무리한 계획을 줄이고 안정적인 루틴을 유지하세요. 용신 기운을 의식적으로 보충하면 도움이 돼요.',
      reason: `기신인 ${elementKo(fortuneEl)} 기운이 강한 시기라 에너지가 분산되기 쉬워요.`,
    };
  }

  // Fallback for low grades without specific cause
  if (grade !== undefined && grade <= 2) {
    return {
      signal: '전체적으로 기운이 약한 시기라 컨디션 관리에 신경 써야 해요.',
      response: '과로를 피하고 충분한 휴식을 취하세요. 큰 결정은 기운이 좋아질 때로 미루는 것이 안전해요.',
      reason: '운세 흐름이 약한 시기에는 기본기를 지키는 것이 가장 중요해요.',
    };
  }

  return {
    signal: '특별히 큰 주의 신호는 없지만 기본 컨디션 관리를 소홀히 하지 마세요.',
    response: '규칙적인 식사와 수면 리듬을 유지하고, 과로를 피하세요.',
    reason: '좋은 운세 흐름에서도 기본 건강을 지키는 것이 핵심이에요.',
  };
}

// ---------------------------------------------------------------------------
//  Category scores
// ---------------------------------------------------------------------------

/**
 * Compute category scores based on how the period pillar element
 * interacts with the ten-god elements relevant to each category.
 *
 * Category -> ten-god element mapping:
 *   wealth:   element that day-master controls (재성 = 내가 극하는)
 *   health:   element that generates day-master (인성 = 나를 생하는) + deficients
 *   academic: element that day-master generates (식상 = 내가 생하는) + 인성
 *   romance:  재성(남) or 관성(여) -- simplified to 재성
 *   family:   인성 + 비겁 (same element as day-master)
 */
function computeCategoryScores(
  fortuneEl: ElementCode,
  natal: NatalData,
): Record<FortuneCategory, StarRating> {
  const dm = natal.dayMasterElement;
  const yong = natal.yongshinElement;
  const hee = natal.heeshinElement;
  const gi = natal.gishinElement;

  // Relevant elements per category
  const wealthEl = ELEMENT_CONTROLS[dm]; // 재성: I control
  const outputEl = ELEMENT_GENERATES[dm]; // 식상: I generate
  const resourceEl = ELEMENT_GENERATED_BY[dm]; // 인성: generates me
  const authorityEl = ELEMENT_CONTROLLED_BY[dm]; // 관성: controls me

  function categoryGrade(targetEls: ElementCode[]): StarRating {
    // Average yongshin alignment of the fortune element
    // relative to the target category elements
    let totalGrade = 0;
    let count = 0;
    for (const tel of targetEls) {
      // How well does the fortune element support this category?
      // If fortune element = the category element, that category is activated
      if (fortuneEl === tel) {
        totalGrade += 5;
      } else if (ELEMENT_GENERATES[fortuneEl] === tel) {
        totalGrade += 4;
      } else if (ELEMENT_GENERATED_BY[fortuneEl] === tel) {
        totalGrade += 3;
      } else if (ELEMENT_CONTROLS[fortuneEl] === tel) {
        totalGrade += 2;
      } else {
        totalGrade += 3;
      }
      count++;
    }
    // Also factor in yongshin alignment
    const baseGrade = getFortuneGrade(fortuneEl, yong, hee, gi);
    const avgCategory = count > 0 ? totalGrade / count : 3;
    // Weighted blend: 60% category-specific, 40% overall yongshin
    const blended = avgCategory * 0.6 + baseGrade * 0.4;
    return gradeToStars(Math.round(blended));
  }

  return {
    wealth: categoryGrade([wealthEl]),
    health: categoryGrade([resourceEl, ...(natal.deficientElements.length > 0 ? [natal.deficientElements[0]] : [])]),
    academic: categoryGrade([outputEl, resourceEl]),
    romance: categoryGrade([wealthEl, authorityEl]),
    family: categoryGrade([resourceEl, dm]),
  };
}

// ---------------------------------------------------------------------------
//  Weekly category scores (7-day average)
// ---------------------------------------------------------------------------

function computeWeeklyCategoryScores(
  startDate: Date,
  natal: NatalData,
): Record<FortuneCategory, StarRating> {
  const dailyFortunes = getWeeklyFortunes(startDate);
  const CATEGORIES: FortuneCategory[] = ['wealth', 'health', 'academic', 'romance', 'family'];
  const totals: Record<string, number> = {
    wealth: 0, health: 0, academic: 0, romance: 0, family: 0,
  };

  for (const df of dailyFortunes) {
    const dayScores = computeCategoryScores(df.stemElement, natal);
    for (const cat of CATEGORIES) {
      totals[cat] += dayScores[cat];
    }
  }

  const result = {} as Record<FortuneCategory, StarRating>;
  for (const cat of CATEGORIES) {
    result[cat] = gradeToStars(Math.round(totals[cat] / dailyFortunes.length));
  }
  return result;
}

// ---------------------------------------------------------------------------
//  Weekly aggregation
// ---------------------------------------------------------------------------

function computeWeeklyGrade(
  saju: SajuSummary,
  startDate: Date,
  natal: NatalData,
): { avgGrade: number; dominantEl: ElementCode } {
  const dailyFortunes = getWeeklyFortunes(startDate);
  let totalGrade = 0;
  const elCounts: Record<ElementCode, number> = {
    WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0,
  };

  for (const df of dailyFortunes) {
    const grade = getFortuneGrade(
      df.stemElement,
      natal.yongshinElement,
      natal.heeshinElement,
      natal.gishinElement,
    );
    totalGrade += grade;
    elCounts[df.stemElement]++;
  }

  // Find dominant element
  let dominantEl: ElementCode = 'EARTH';
  let maxCount = 0;
  for (const [el, count] of Object.entries(elCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantEl = el as ElementCode;
    }
  }

  return {
    avgGrade: totalGrade / 7,
    dominantEl,
  };
}

// ---------------------------------------------------------------------------
//  Time-series computation
// ---------------------------------------------------------------------------

/** 4-hour blocks (6 data points): adjacent 시진 pairs */
const DAILY_BLOCKS: { label: string; branches: [number, number] }[] = [
  { label: '심야', branches: [0, 1] },   // 子丑 (23~03)
  { label: '새벽', branches: [2, 3] },   // 寅卯 (03~07)
  { label: '오전', branches: [4, 5] },   // 辰巳 (07~11)
  { label: '오후', branches: [6, 7] },   // 午未 (11~15)
  { label: '저녁', branches: [8, 9] },   // 申酉 (15~19)
  { label: '밤',   branches: [10, 11] }, // 戌亥 (19~23)
];

/** Branch index → element (derived from BRANCHES) */
const BRANCH_ELEMENT: ElementCode[] = BRANCHES.map(b => b.element);

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function blendedGrade(
  stemEl: ElementCode,
  branchEl: ElementCode,
  natal: NatalData,
): number {
  const stemG = getFortuneGrade(stemEl, natal.yongshinElement, natal.heeshinElement, natal.gishinElement);
  const branchG = getFortuneGrade(branchEl, natal.yongshinElement, natal.heeshinElement, natal.gishinElement);
  return stemG * 0.7 + branchG * 0.3;
}

function gradeToScore(grade: number): number {
  return Math.max(20, Math.min(100, Math.round(grade * 20)));
}

function computeDailyTimeSeries(
  targetDate: Date,
  natal: NatalData,
): FortuneTimeSeries {
  const daily = getDailyFortune(targetDate);
  const dayStemIdx = daily.stemIndex;

  const points = DAILY_BLOCKS.map((block) => {
    const [b1, b2] = block.branches;
    const stemEl1 = getHourStemElement(dayStemIdx, b1);
    const stemEl2 = getHourStemElement(dayStemIdx, b2);
    const branchEl1 = BRANCH_ELEMENT[b1];
    const branchEl2 = BRANCH_ELEMENT[b2];

    const g1 = blendedGrade(stemEl1, branchEl1, natal);
    const g2 = blendedGrade(stemEl2, branchEl2, natal);
    const avg = (g1 + g2) / 2;

    return { label: block.label, value: gradeToScore(avg) };
  });

  return { points };
}

function computeWeeklyTimeSeries(
  startDate: Date,
  natal: NatalData,
): FortuneTimeSeries {
  const dailyFortunes = getWeeklyFortunes(startDate);
  const points = dailyFortunes.map((df) => ({
    label: DAY_LABELS[df.dayOfWeek],
    value: gradeToScore(blendedGrade(df.stemElement, df.branchElement, natal)),
  }));
  return { points };
}

function computeMonthlyTimeSeries(
  targetDate: Date,
  natal: NatalData,
): FortuneTimeSeries {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth(); // 0-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Compute daily grades for every day in the month
  const dailyGrades: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const df = getDailyFortune(new Date(year, month, d));
    dailyGrades.push(blendedGrade(df.stemElement, df.branchElement, natal));
  }

  // Build week boundaries; fold short remainders (<= 3 days) into the last full week
  const boundaries: number[] = [];
  for (let start = 0; start < daysInMonth; start += 7) {
    boundaries.push(start);
  }
  const lastStart = boundaries[boundaries.length - 1];
  if (boundaries.length >= 2 && daysInMonth - lastStart <= 3) {
    boundaries.pop();
  }

  const points = boundaries.map((start, i) => {
    const end = i < boundaries.length - 1 ? boundaries[i + 1] : daysInMonth;
    const weekGrades = dailyGrades.slice(start, end);
    const avg = weekGrades.reduce((s, g) => s + g, 0) / weekGrades.length;
    return { label: `${i + 1}주`, value: gradeToScore(avg) };
  });

  return { points };
}

function computeYearlyTimeSeries(
  targetDate: Date,
  natal: NatalData,
): FortuneTimeSeries {
  const year = targetDate.getFullYear();
  const points = [];
  for (let m = 1; m <= 12; m++) {
    const mf = getMonthlyFortuneSolar(year, m);
    const grade = blendedGrade(mf.stemElement, mf.branchElement, natal);
    points.push({ label: `${m}월`, value: gradeToScore(grade) });
  }
  return { points };
}

function computeTimeSeries(
  periodKind: FortunePeriodKind,
  targetDate: Date,
  natal: NatalData,
): FortuneTimeSeries | undefined {
  if (periodKind === 'daily') return computeDailyTimeSeries(targetDate, natal);
  if (periodKind === 'weekly') return computeWeeklyTimeSeries(targetDate, natal);
  if (periodKind === 'monthly') return computeMonthlyTimeSeries(targetDate, natal);
  if (periodKind === 'yearly') return computeYearlyTimeSeries(targetDate, natal);
  return undefined;
}

// ---------------------------------------------------------------------------
//  Main builder
// ---------------------------------------------------------------------------

export function buildPeriodFortuneCard(
  saju: SajuSummary,
  periodKind: FortunePeriodKind,
  targetDate: Date,
): PeriodFortuneCard {
  const natal = extractNatalData(saju);

  // Compute the period pillar
  const pillarResult = computePillarForPeriod(saju, periodKind, targetDate);
  const ganzhi = pillarResult?.ganzhi ?? getYearlyFortune(targetDate.getFullYear());
  const periodLabel = pillarResult?.label ?? `${targetDate.getFullYear()}년`;

  let grade: number;
  let effectiveStemEl: ElementCode;
  let effectiveBranchEl: ElementCode;

  if (periodKind === 'weekly') {
    // Weekly: average of 7 daily grades
    const weekResult = computeWeeklyGrade(saju, targetDate, natal);
    grade = weekResult.avgGrade;
    effectiveStemEl = weekResult.dominantEl;
    effectiveBranchEl = ganzhi.branchElement;
  } else {
    grade = getFortuneGrade(
      ganzhi.stemElement,
      natal.yongshinElement,
      natal.heeshinElement,
      natal.gishinElement,
    );
    effectiveStemEl = ganzhi.stemElement;
    effectiveBranchEl = ganzhi.branchElement;
  }

  const stars = gradeToStars(Math.round(grade));

  const summary = makeSummary(periodKind, stars, effectiveStemEl, effectiveBranchEl, natal);
  const goodActions = makeGoodActions(effectiveStemEl, effectiveBranchEl, natal, Math.round(grade), periodKind);
  const badActions = makeBadActions(effectiveStemEl, effectiveBranchEl, natal, Math.round(grade), periodKind);
  const warning = makeWarning(ganzhi, natal, Math.round(grade));
  const categoryScores = periodKind === 'weekly'
    ? computeWeeklyCategoryScores(targetDate, natal)
    : computeCategoryScores(effectiveStemEl, natal);

  const timeSeries = computeTimeSeries(periodKind, targetDate, natal);

  return {
    title: PERIOD_TITLE[periodKind] ?? '운세',
    periodKind,
    periodLabel,
    stars,
    summary,
    goodActions,
    badActions,
    warning,
    categoryScores,
    ...(timeSeries ? { timeSeries } : {}),
  };
}
