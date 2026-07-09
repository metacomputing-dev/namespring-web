/**
 * category-fortune-card.ts -- 5대 분야별 운세 카드 빌더
 *
 * 5개 분야: wealth(재물/커리어), health(건강), academic(학업),
 *           romance(연애/결혼), family(가족)
 *
 * 분야별 십성 매핑:
 *   - wealth:   재성 (PYEON_JAE, JEONG_JAE) -- 내가 극하는 오행
 *   - health:   인성 (PYEON_IN, JEONG_IN) + 결핍 오행 -- 나를 생하는 오행
 *   - academic: 식상 (SIK_SHIN, SANG_GWAN) + 인성 -- 내가 생하는 + 나를 생하는
 *   - romance:  재성(남) / 관성(여) + 비겁 -- 복합 판단
 *   - family:   인성 + 비겁 -- 나를 생하는 + 같은 오행
 *
 * 연간 운세 기둥이 각 분야의 십성 오행을 얼마나 도와주는지 평가합니다.
 *
 * 모든 텍스트는 ~해요/~에요 체를 사용합니다.
 */

import type { SajuSummary, EvidenceRow, SajuAxisStrengthMap } from '../../types.js';
import type {
  CategoryFortuneCard,
  CategoryFortuneSubDomain,
  FortuneCategory,
  FortuneCategoryExtended,
  FortuneReportOptions,
  StarRating,
  FortuneAdvice,
  FortuneWarning,
} from '../types.js';
import type { ElementCode } from '../types.js';
import {
  SUB_DOMAIN_NARRATIVES,
  SUB_DOMAIN_TITLE,
  SUB_DOMAIN_PLAN,
  computeSubDomainGrade,
  getExtendedCategoryElements,
  gradeBucket,
  shouldSurfaceConditional,
  type SubDomainGateInput,
} from './category-fortune-subdomain-data.js';

import {
  getYearlyFortune,
  getFortuneGrade,
} from '../common/fortuneCalculator.js';

import {
  ELEMENT_GENERATES,
  ELEMENT_CONTROLS,
  ELEMENT_GENERATED_BY,
  ELEMENT_CONTROLLED_BY,
  ELEMENT_FOOD,
  ELEMENT_HOBBY,
  ELEMENT_COLOR,
  ELEMENT_DIRECTION,
  ELEMENT_EMOTION,
  ELEMENT_SEASON,
  STEM_BY_CODE,
  BRANCH_BY_CODE,
  getElementRelation,
} from '../common/elementMaps.js';
import { luckAnnotationFeatures, type LuckPillarAnnotationsForReport } from '../common/transit-luck-metadata.js';

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

interface CategorySaeunRow extends LuckPillarAnnotationsForReport {
  readonly year?: number;
  readonly stem?: string;
  readonly branch?: string;
  readonly startUtcMs?: number | null;
  readonly endUtcMs?: number | null;
}

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function findCategorySaeunRow(saju: SajuSummary, targetDate: Date): CategorySaeunRow | null {
  const rows = (saju as Record<string, unknown>).saeunPillars as readonly CategorySaeunRow[] | undefined;
  if (!Array.isArray(rows)) return null;
  const targetMs = targetDate.getTime();
  for (const row of rows) {
    const start = finiteNumber(row.startUtcMs);
    const end = finiteNumber(row.endUtcMs);
    if (start !== null && end !== null && targetMs >= start && targetMs < end) return row;
  }
  const year = targetDate.getFullYear();
  return rows.find((p) => p.year === year) ?? null;
}
function elementKo(code: ElementCode): string {
  return ELEMENT_KO[code];
}

function iGa(word: string): string {
  if (!word) return `${word}가`;
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xAC00 || last > 0xD7A3) return `${word}가`;
  return (last - 0xAC00) % 28 !== 0 ? `${word}이` : `${word}가`;
}

function gradeToStars(grade: number): StarRating {
  if (grade >= 5) return 5;
  if (grade >= 4) return 4;
  if (grade >= 3) return 3;
  if (grade >= 2) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
//  Category metadata
// ---------------------------------------------------------------------------

const CATEGORY_TITLE: Record<FortuneCategory, string> = {
  wealth: '재물/커리어운',
  health: '건강운',
  academic: '학업운',
  romance: '연애/결혼운',
  family: '가족운',
};

interface CategoryFortuneContext {
  readonly currentAge?: number;
}

function isMinorContext(context?: CategoryFortuneContext): boolean {
  return typeof context?.currentAge === 'number' && context.currentAge < 19;
}

function categoryTitle(category: FortuneCategory, context?: CategoryFortuneContext): string {
  if (category === 'wealth' && isMinorContext(context)) return '돈 관리/습관운';
  if (category === 'romance' && isMinorContext(context)) return '친구/관계운';
  return CATEGORY_TITLE[category];
}

// ---------------------------------------------------------------------------
//  Category element computation
// ---------------------------------------------------------------------------

interface CategoryElements {
  readonly primary: ElementCode;
  readonly secondary: ElementCode | null;
}

function getCategoryElements(
  category: FortuneCategory,
  dayMasterEl: ElementCode,
): CategoryElements {
  switch (category) {
    case 'wealth':
      // 재성: 내가 극하는 오행
      return { primary: ELEMENT_CONTROLS[dayMasterEl], secondary: null };
    case 'health':
      // 인성: 나를 생하는 오행
      return { primary: ELEMENT_GENERATED_BY[dayMasterEl], secondary: null };
    case 'academic':
      // 식상 + 인성: 내가 생하는 + 나를 생하는
      return {
        primary: ELEMENT_GENERATES[dayMasterEl],
        secondary: ELEMENT_GENERATED_BY[dayMasterEl],
      };
    case 'romance':
      // 재성 + 관성: 내가 극하는 + 나를 극하는
      return {
        primary: ELEMENT_CONTROLS[dayMasterEl],
        secondary: ELEMENT_CONTROLLED_BY[dayMasterEl],
      };
    case 'family':
      // 인성 + 비겁: 나를 생하는 + 같은 오행
      return {
        primary: ELEMENT_GENERATED_BY[dayMasterEl],
        secondary: dayMasterEl,
      };
    default:
      return { primary: dayMasterEl, secondary: null };
  }
}

// ---------------------------------------------------------------------------
//  Category grade computation
// ---------------------------------------------------------------------------

/**
 * Compute how well the fortune element supports a category.
 *
 * Logic:
 *   fortune = category primary element -> 5 (directly activates)
 *   fortune generates category element -> 4 (supports it)
 *   fortune is generated by category element -> 3 (neutral exchange)
 *   fortune = category secondary element -> 4 (secondary activation)
 *   fortune controls category element -> 1 (undermines)
 *   else -> 3 (neutral)
 *
 * Then blend with yongshin grade (40%) for overall assessment.
 */
function computeCategoryGrade(
  fortuneEl: ElementCode,
  categoryEls: CategoryElements,
  yongshinGrade: number,
): number {
  let categoryScore: number;

  const relPrimary = getElementRelation(fortuneEl, categoryEls.primary);

  if (relPrimary === 'same') {
    categoryScore = 5;
  } else if (relPrimary === 'generates') {
    categoryScore = 4;
  } else if (relPrimary === 'generated_by') {
    categoryScore = 3;
  } else if (relPrimary === 'controls') {
    categoryScore = 2;
  } else if (relPrimary === 'controlled_by') {
    categoryScore = 1;
  } else {
    categoryScore = 3;
  }

  // If there is a secondary element, average in its score
  if (categoryEls.secondary) {
    let secScore: number;
    const relSec = getElementRelation(fortuneEl, categoryEls.secondary);
    if (relSec === 'same') {
      secScore = 5;
    } else if (relSec === 'generates') {
      secScore = 4;
    } else if (relSec === 'generated_by') {
      secScore = 3;
    } else if (relSec === 'controls') {
      secScore = 2;
    } else if (relSec === 'controlled_by') {
      secScore = 1;
    } else {
      secScore = 3;
    }
    categoryScore = (categoryScore + secScore) / 2;
  }

  // Blend: 60% category-specific, 40% yongshin
  return categoryScore * 0.6 + yongshinGrade * 0.4;
}

// ---------------------------------------------------------------------------
//  Summary generators
// ---------------------------------------------------------------------------

function makeCategorySummary(
  category: FortuneCategory,
  stars: StarRating,
  fortuneEl: ElementCode,
  catEls: CategoryElements,
  context?: CategoryFortuneContext,
  alignment?: { readonly isGishinAligned?: boolean },
): string {
  const fortuneKo = elementKo(fortuneEl);
  const catKo = elementKo(catEls.primary);
  const title = categoryTitle(category, context);
  const sameElement = fortuneEl === catEls.primary;
  const isMinorRomance = category === 'romance' && isMinorContext(context);

  const GOOD_SUFFIX: Record<FortuneCategory, string> = {
    wealth: '재물 흐름이 원활해져요.',
    health: '생활 리듬을 안정적으로 지키기 좋아요.',
    academic: '학습 효율이 올라가는 한 해예요.',
    romance: isMinorRomance ? '친구 관계와 협동이 자연스러워져요.' : '인연의 호흡이 부드러워져요.',
    family: '가정의 분위기가 따뜻해져요.',
  };

  // Category voice (NARRATIVE_STYLE_GUIDE §6): 카테고리별 어휘를 다르게 풀어
  // wealth = 운영, health = 컨디션 관리, academic = 페이스, romance = 거리감,
  // family = 일상 — 한 표현이 5 카테고리에 단조롭게 반복되지 않도록 함.
  const MID_BODY: Record<FortuneCategory, string> = {
    wealth: '큰 변화를 시도하기보다 기본 운영을 지키며 꾸준히 챙기면 좋아요.',
    health: '큰 변화를 만들기보다 일상 컨디션 관리를 꾸준히 챙기면 좋아요.',
    academic: '욕심을 내기보다 자기 페이스로 꾸준히 다지면 좋아요.',
    romance: isMinorRomance
      ? '거리감을 갑자기 좁히기보다 평소 대화를 꾸준히 이어 가면 좋아요.'
      : '큰 변화를 서두르기보다 지금의 호흡을 꾸준히 다듬으면 좋아요.',
    family: '큰 이벤트를 만들기보다 일상의 안부를 꾸준히 챙기면 좋아요.',
  };

  const LOW_BODY: Record<FortuneCategory, string> = {
    wealth: '무리한 결정을 미루고 보수적인 운영에 무게를 두면 좋아요.',
    health: '무리한 일정을 줄이고 회복 리듬을 우선 챙기면 좋아요.',
    academic: '욕심을 내려놓고 기초를 다시 점검하면 좋아요.',
    romance: isMinorRomance
      ? '편안한 거리감을 지키고 익숙한 친구와 차분히 대화하면 좋아요.'
      : '새 관계를 서두르기보다 기존 인연에서 호흡을 다듬으면 좋아요.',
    family: '큰 결정은 한 박자 미루고 가까운 이의 말을 먼저 들어 보면 좋아요.',
  };

  const HARD_BODY: Record<FortuneCategory, string> = {
    wealth: '서두르지 말고 보수적인 운영을 우선 챙겨 보세요.',
    health: '몸을 몰아붙이지 말고 회복 시간을 넉넉히 잡아 보세요.',
    academic: '결과보다 기초 점검에 무게를 두고 차분히 이어 가 보세요.',
    romance: isMinorRomance
      ? '관계를 빨리 풀려 하기보다 한 박자 쉬어 가 보세요.'
      : '새로운 관계를 서두르기보다 한 박자 쉬어 가 보세요.',
    family: '갈등을 빨리 풀려 하기보다 한 박자 쉬며 거리를 두어 보세요.',
  };

  if (stars >= 4 && alignment?.isGishinAligned) {
    const support = sameElement
      ? `${fortuneKo} 기운이 직접 드러나지만`
      : `${fortuneKo} 기운이 ${catKo} 기운을 움직이지만`;
    return `올해 ${title}은 좋은 흐름도 있으나 속도 조절이 필요해요. ${support} 과하게 서두르지 않으면 안정적으로 관리할 수 있어요.`;
  }
  if (stars >= 5) {
    const support = sameElement
      ? `${fortuneKo} 기운이 직접 활성화되어`
      : `${fortuneKo} 기운이 ${catKo} 기운을 크게 도와줘서`;
    return `올해 ${title}은 흐름이 아주 좋아요. ${support} ${GOOD_SUFFIX[category]}`;
  }
  if (stars >= 4) {
    const support = sameElement
      ? `${fortuneKo} 기운이 직접 흘러들어`
      : `${fortuneKo} 기운이 ${catKo} 기운을 받쳐줘서`;
    return `올해 ${title}은 좋은 편이에요. ${support} ${GOOD_SUFFIX[category]}`;
  }
  if (stars >= 3) {
    return `올해 ${title}은 큰 굴곡 없는 한 해예요. ${MID_BODY[category]}`;
  }
  if (stars >= 2) {
    return `올해 ${title}은 살짝 조심이 필요해요. ${LOW_BODY[category]}`;
  }
  return `올해 ${title}은 부담이 큰 한 해예요. ${HARD_BODY[category]}`;
}

// ---------------------------------------------------------------------------
//  Advice generators per category
// ---------------------------------------------------------------------------

function makeWealthAdvice(
  stars: StarRating,
  fortuneEl: ElementCode,
  catEl: ElementCode,
  context?: CategoryFortuneContext,
): FortuneAdvice[] {
  const advice: FortuneAdvice[] = [];
  const foods = ELEMENT_FOOD[catEl] ?? [];
  const color = ELEMENT_COLOR[catEl] ?? '';
  const direction = ELEMENT_DIRECTION[catEl] ?? '';
  const isMinor = isMinorContext(context);

  if (stars >= 4) {
    advice.push(isMinor
      ? {
          text: '용돈, 저축, 필요한 물건을 구분해 보는 습관을 만들기 좋아요.',
          reason: '돈 관리 흐름이 부드러울 때 작은 기록 습관을 들이면 생활 감각이 한결 또렷해져요.',
        }
      : {
          text: '새로운 투자나 사업 기회를 차분히 검토해 두기 좋아요.',
          reason: '재성 기운이 받쳐 주는 시기에는 재무 판단을 차분히 굴려 보기도 자연스럽게 풀려요.',
        });
    advice.push({
      text: `${color} 계열의 지갑이나 소품이 재물운을 도와줄 수 있어요.`,
      reason: `눈에 자주 닿는 곳에 재성 오행(${elementKo(catEl)})의 색을 두면 그 기운을 일상에 가까이 두게 돼요.`,
    });
  } else {
    advice.push(isMinor
      ? {
          text: '큰 물건을 사거나 돈을 쓰는 일은 혼자 정하지 말고 보호자와 함께 확인하세요.',
          reason: '돈 관리 흐름이 약할 때는 속도를 늦추고 도움을 받는 편이 마음 부담이 적어요.',
        }
      : {
          text: '큰 지출이나 투자는 신중하게, 가능하면 전문가 상담 후 결정하세요.',
          reason: '재성 기운이 약한 시기에는 보수적인 재무 운영이 흔들림을 줄여 줘요.',
        });
    advice.push({
      text: '불필요한 지출을 줄이고 저축 비율을 조금씩 높여보세요.',
      reason: '재물 기운이 약한 시기에는 절제 습관 하나가 다음 해의 여유로 이어지기 쉬워요.',
    });
  }

  return advice;
}

function makeHealthAdvice(
  stars: StarRating,
  fortuneEl: ElementCode,
  dayMasterEl: ElementCode,
  deficients: ElementCode[],
  gishinEl: ElementCode | null,
  yongshinEl: ElementCode,
): FortuneAdvice[] {
  const advice: FortuneAdvice[] = [];
  const resourceEl = ELEMENT_GENERATED_BY[dayMasterEl];

  if (stars >= 4) {
    advice.push({
      text: '컨디션이 안정적인 편이에요. 꾸준한 운동과 휴식 루틴을 유지하면 더욱 좋아요.',
      reason: '인성 기운이 잘 흐르는 시기에는 평소의 생활 루틴을 유지하기가 한결 수월하게 느껴져요.',
    });
  } else {
    advice.push({
      text: '무리한 일정을 줄이고 수면, 식사, 운동 리듬을 먼저 챙기세요.',
      reason: '인성 기운이 약한 시기에는 몸을 몰아붙이기보다 기본 루틴을 지키는 쪽이 부담을 덜어 줘요.',
    });
  }

  if (deficients.length > 0) {
    const weakEl = deficients[0];
    const foods = ELEMENT_FOOD[weakEl] ?? [];
    advice.push({
      text: foods.length > 0
        ? `${elementKo(weakEl)} 기운 보충을 위해 ${foods.slice(0, 3).join(', ')} 같은 음식을 챙기세요.`
        : `${elementKo(weakEl)} 기운이 약하니 생활 리듬을 더 차분히 챙겨주세요.`,
      reason: `평소 약한 ${elementKo(weakEl)} 기운을 일상에서 챙기면 컨디션 관리가 한결 수월해져요.`,
    });
  }

  // Recommend activities: prefer yongshin hobbies if resource element matches gishin
  const activityEl = (resourceEl === gishinEl) ? yongshinEl : resourceEl;
  const hobbies = ELEMENT_HOBBY[activityEl] ?? [];
  if (hobbies.length > 0) {
    const elLabel = (resourceEl === gishinEl)
      ? `용신(${elementKo(yongshinEl)})`
      : `인성(${elementKo(resourceEl)})`;
    advice.push({
      text: `${hobbies.slice(0, 2).join(', ')} 같은 활동이 건강 기운을 보강해 줘요.`,
      reason: `${elLabel} 기운과 어울리는 활동은 생활 리듬과 마음의 여유를 함께 챙기는 흐름을 만들어 줘요.`,
    });
  }

  return advice.slice(0, 3);
}

function makeAcademicAdvice(stars: StarRating, dayMasterEl: ElementCode): FortuneAdvice[] {
  const advice: FortuneAdvice[] = [];
  const outputEl = ELEMENT_GENERATES[dayMasterEl]; // 식상
  const resourceEl = ELEMENT_GENERATED_BY[dayMasterEl]; // 인성

  if (stars >= 4) {
    advice.push({
      text: '학습 효율이 잘 올라가는 한 해예요. 새로운 분야에 도전하거나 자격증 준비를 시작해 보세요.',
      reason: '식상과 인성 기운이 받쳐 주는 시기에는 이해와 표현이 한결 매끄럽게 이어져요.',
    });
    advice.push({
      text: '배운 내용을 다른 사람에게 설명하거나 정리 노트를 만들면 실력이 빠르게 올라요.',
      reason: `${elementKo(outputEl)} 기운(식상)이 받쳐 주는 시기에는 아웃풋 학습이 특히 잘 받쳐 줘요.`,
    });
  } else {
    advice.push({
      text: '기본기 복습에 집중하고, 난이도 높은 과제는 단계적으로 접근하세요.',
      reason: '학업 기운이 약한 시기에는 무리한 진도보다 기초를 다지는 쪽이 더 단단히 남아요.',
    });
    advice.push({
      text: '혼자 끙끙대기보다 스터디 그룹이나 멘토의 도움을 받으면 효과가 커요.',
      reason: `${elementKo(resourceEl)} 기운(인성)이 약한 시기에는 외부의 도움이 학습 호흡을 받쳐 주기 쉬워요.`,
    });
  }

  return advice;
}

function makeRomanceAdvice(
  stars: StarRating,
  dayMasterEl: ElementCode,
  context?: CategoryFortuneContext,
): FortuneAdvice[] {
  const advice: FortuneAdvice[] = [];
  const wealthEl = ELEMENT_CONTROLS[dayMasterEl]; // 재성
  const color = ELEMENT_COLOR[wealthEl] ?? '';
  const isMinor = isMinorContext(context);

  if (stars >= 4) {
    if (isMinor) {
      advice.push({
        text: '친구나 또래와 함께하는 활동에서 좋은 호흡을 만들기 쉬워요.',
        reason: '관계 기운이 부드러운 시기에는 협동, 대화, 모임 참여가 자연스럽게 이어지기 쉬워요.',
      });
      advice.push({
        text: `${color} 계열의 소품을 가볍게 활용하면 밝고 편안한 인상을 만드는 데 도움이 돼요.`,
        reason: `관계 흐름과 닿아 있는 오행(${elementKo(wealthEl)})의 색을 일상에서 가볍게 곁들이는 방법이에요.`,
      });
    } else {
      advice.push({
        text: '새로운 인연이 자연스럽게 닿아 오기 쉬워요. 모임에 가볍게 발을 들여 보세요.',
        reason: '재성·관성 기운이 받쳐 주는 시기에는 사람과 닿는 자리가 부드럽게 풀려 가기 쉬워요.',
      });
      advice.push({
        text: `${color} 계열의 옷이나 액세서리가 인연의 호흡을 한층 가다듬어 줘요.`,
        reason: `인연과 닿아 있는 오행(${elementKo(wealthEl)})의 색을 곁들이면 자연스러운 인상을 더하기 쉬워요.`,
      });
    }
  } else {
    advice.push(isMinor
      ? {
          text: '친구 관계에서 급하게 인정받으려 하기보다 편안한 대화부터 쌓아 보세요.',
          reason: '관계 기운이 약한 시기에는 거리를 좁히려 서두르기보다 안정적인 거리감이 더 잘 맞아요.',
        }
      : {
          text: '지금은 새 관계를 서두르기보다 기존 관계를 깊게 가꾸는 데 집중하세요.',
          reason: '관계 기운이 약한 시기에는 호흡을 서두르면 자잘한 어긋남이 쌓이기 쉬워요.',
        });
    advice.push({
      text: '상대방의 말을 먼저 경청하고, 감정적 반응을 한 박자 늦추는 연습을 해보세요.',
      reason: '관성 기운이 약한 시기에는 듣고 가다듬는 호흡이 관계의 안정감을 받쳐 줘요.',
    });
  }

  return advice;
}

function makeFamilyAdvice(stars: StarRating, dayMasterEl: ElementCode): FortuneAdvice[] {
  const advice: FortuneAdvice[] = [];
  const resourceEl = ELEMENT_GENERATED_BY[dayMasterEl]; // 인성
  const emotion = ELEMENT_EMOTION[dayMasterEl];

  if (stars >= 4) {
    advice.push({
      text: '가족과의 소통이 자연스럽게 잘 풀리는 한 해예요. 함께하는 시간을 의도적으로 만들어 보세요.',
      reason: '인성과 비겁 기운이 받쳐 주는 시기에는 가까운 사이의 호흡이 한결 맞춰지기 쉬워요.',
    });
    advice.push({
      text: '감사 표현과 작은 선물이 관계를 더 따뜻하게 만들어 줘요.',
      reason: '좋은 흐름이 받쳐 주는 시기에 마음을 표현해 두면 그 따뜻함이 더 오래 남아요.',
    });
  } else {
    advice.push({
      text: '가족과 의견 차이가 생길 수 있어요. 충고보다 공감을 먼저 전하세요.',
      reason: '비겁 기운이 약한 시기에는 가까운 사이일수록 사소한 일에도 신경이 곤두서기 쉬워요.',
    });
    if (emotion) {
      advice.push({
        text: `${emotion.negative}이 올라올 때 바로 말하기보다 잠시 호흡을 고르세요.`,
        reason: '감정이 올라오는 순간 한 박자 쉬면 불필요한 충돌을 줄이기 쉬워요.',
      });
    }
  }

  return advice;
}

// ---------------------------------------------------------------------------
//  Caution generator
// ---------------------------------------------------------------------------

function makeCaution(
  category: FortuneCategory,
  stars: StarRating,
  fortuneEl: ElementCode,
  catEls: CategoryElements,
  context?: CategoryFortuneContext,
): FortuneWarning | null {
  // Only generate caution for low scores
  if (stars >= 4) return null;

  const catKo = elementKo(catEls.primary);
  const fortuneKo = elementKo(fortuneEl);
  const isMinorRomance = category === 'romance' && isMinorContext(context);
  const isMinorWealth = category === 'wealth' && isMinorContext(context);

  const cautionMap: Record<FortuneCategory, FortuneWarning> = {
    wealth: {
      signal: `올해 재물 기운이 ${fortuneKo} 기운과 살짝 어긋나 있어요.`,
      response: isMinorWealth
        ? '돈을 쓰거나 물건을 고를 때는 기준을 적어 보고, 보호자와 함께 확인해 보세요.'
        : '큰 투자나 보증은 신중하게 검토하고, 지출 상한선을 미리 정해 두세요.',
      reason: isMinorWealth
        ? `${fortuneKo} 기운이 ${catKo} 기운과 부딪쳐 돈 관리 습관이 평소보다 느슨해지기 쉬워요.`
        : `${fortuneKo} 기운이 ${catKo} 기운(재성)을 압박해 큰 지출이 부담으로 돌아오기 쉬워요.`,
    },
    health: {
      signal: '컨디션 관리에 평소보다 신경을 조금 더 써야 해요.',
      response: '과로를 피하고 수면, 식사, 휴식 리듬을 함께 챙겨 주세요.',
      reason: '인성 기운이 약하면 생활 리듬을 회복하는 데 평소보다 시간이 걸려요.',
    },
    academic: {
      signal: '학업 집중력이 평소보다 흩어지기 쉬워요.',
      response: '공부 시간을 짧게 나누고, 어려운 부분은 질문하거나 멘토의 도움을 받으세요.',
      reason: '식상과 인성 기운이 약하면 이해와 표현 모두 효율이 떨어질 수 있어요.',
    },
    romance: {
      signal: isMinorRomance
        ? '친구 관계에서 작은 오해와 감정 소모가 생기기 쉬워요.'
        : '관계에서 작은 오해와 감정 소모가 생기기 쉬워요.',
      response: isMinorRomance
        ? '새 친구와 급히 가까워지려 하기보다, 이미 알고 지내는 친구와의 대화 방식을 점검해 보세요.'
        : '새로운 인연을 서두르기보다, 기존 관계에서 소통 방식을 먼저 점검해 보세요.',
      reason: isMinorRomance
        ? '관계 기운이 약할 때는 속도보다 편안한 거리감과 꾸준한 대화가 더 중요해요.'
        : '재성/관성 기운이 약하면 인연의 타이밍이 어긋나기 쉬워요.',
    },
    family: {
      signal: '가족 사이에 작은 마찰이 살짝 늘어날 수 있어요.',
      response: '충고보다 경청을 우선하고, 감정이 올라오면 잠시 자리를 비우세요.',
      reason: '비겁과 인성 기운이 약하면 가까운 사이일수록 사소한 일에 부딪히기 쉬워요.',
    },
  };

  return cautionMap[category] ?? null;
}

// ---------------------------------------------------------------------------
//  Main builder
// ---------------------------------------------------------------------------

export function buildCategoryFortuneCards(
  saju: SajuSummary,
  targetDate: Date,
  options?: Pick<FortuneReportOptions, 'surfaceSubDomains'>,
  context?: CategoryFortuneContext,
): Record<FortuneCategory, CategoryFortuneCard> {
  // Extract natal data
  const dayMasterElement = toElementCode(saju.dayMaster?.element) ?? 'EARTH';
  const yongshinElement = toElementCode(saju.yongshin?.element) ?? 'WATER';
  const heeshinElement = toElementCode(saju.yongshin?.heeshin);
  const gishinElement = toElementCode(saju.yongshin?.gishin);

  const deficientElements: ElementCode[] = [];
  if (Array.isArray(saju.deficientElements)) {
    for (const raw of saju.deficientElements) {
      const el = toElementCode(raw);
      if (el) deficientElements.push(el);
    }
  }

  // Get yearly fortune pillar
  const year = targetDate.getFullYear();

  // Try saeunPillars first
  let fortuneEl: ElementCode = 'EARTH';
  const saeunRow = findCategorySaeunRow(saju, targetDate);
  if (saeunRow) {
    const stemEl = toElementCode(saeunRow.stem);
    if (stemEl) fortuneEl = stemEl;
  }

  if (!saeunRow) {
    // Fallback: compute from formula
    const yf = getYearlyFortune(year);
    fortuneEl = yf.stemElement;
  }
  // Yongshin grade for the year
  const yongshinGrade = getFortuneGrade(fortuneEl, yongshinElement, heeshinElement, gishinElement);

  const CATEGORIES: FortuneCategory[] = ['wealth', 'health', 'academic', 'romance', 'family'];

  const result = {} as Record<FortuneCategory, CategoryFortuneCard>;

  for (const category of CATEGORIES) {
    const catEls = getCategoryElements(category, dayMasterElement);
    const grade = computeCategoryGrade(fortuneEl, catEls, yongshinGrade);
    const stars = gradeToStars(Math.round(grade));
    const isGishinAligned = !!gishinElement && catEls.primary === gishinElement;
    const title = categoryTitle(category, context);

    const summary = makeCategorySummary(category, stars, fortuneEl, catEls, context, { isGishinAligned });

    // Generate category-specific advice
    let advice: FortuneAdvice[];
    switch (category) {
      case 'wealth':
        advice = makeWealthAdvice(stars, fortuneEl, catEls.primary, context);
        break;
      case 'health':
        advice = makeHealthAdvice(stars, fortuneEl, dayMasterElement, deficientElements, gishinElement, yongshinElement);
        break;
      case 'academic':
        advice = makeAcademicAdvice(stars, dayMasterElement);
        break;
      case 'romance':
        advice = makeRomanceAdvice(stars, dayMasterElement, context);
        break;
      case 'family':
        advice = makeFamilyAdvice(stars, dayMasterElement);
        break;
      default:
        advice = [];
    }

    const caution = makeCaution(category, stars, fortuneEl, catEls, context);

    // ── PR-J-8a — narrative foundations (axisStrength + evidence) ──
    const sajuAxis = (saju as unknown as { axisStrength?: SajuAxisStrengthMap }).axisStrength;
    const isYongshinAligned = catEls.primary === yongshinElement;

    let claim: string;
    const primaryElementName = elementKo(catEls.primary);
    if (isYongshinAligned) {
      claim = `${title}의 핵심 오행 ${iGa(primaryElementName)} 용신과 일치해 든든히 받쳐 주는 흐름이에요.`;
    } else if (isGishinAligned) {
      claim = stars >= 4
        ? `${title}의 핵심 오행 ${iGa(primaryElementName)} 기신과 겹치지만, 다른 보조 기운이 받쳐 주어 속도 조절이 중요해요.`
        : `${title}의 핵심 오행 ${iGa(primaryElementName)} 기신과 겹쳐 보수적 운영이 좋아요.`;
    } else {
      claim = `${title}은 ${primaryElementName} 기운을 중심에 두고 살펴봤어요.`;
    }

    const supporting: string[] = [
      `카테고리 핵심: ${elementKo(catEls.primary)}`,
      `올해 천간 오행: ${elementKo(fortuneEl)}`,
      `별점: ${stars}/5`,
    ];
    if (yongshinElement) supporting.push(`용신: ${elementKo(yongshinElement)}`);
    if (gishinElement) supporting.push(`기신: ${elementKo(gishinElement)}`);

    if (saeunRow) supporting.push(...luckAnnotationFeatures(saeunRow));

    const evidence: EvidenceRow[] = [{
      axis: 'category',
      claim,
      supportingFeatures: supporting,
      weakness: stars <= 2
        ? `${title} 영역에서는 중요한 결정을 서두르지 말고 회복되는 흐름을 확인해 보세요.`
        : undefined,
      strength: sajuAxis?.yongshin,
    }];

    const subDomains = options?.surfaceSubDomains
      ? buildSubDomainRows(category, dayMasterElement, fortuneEl, yongshinGrade, saju)
      : undefined;

    result[category] = {
      title,
      category,
      stars,
      summary,
      advice,
      caution,
      axisStrength: sajuAxis,
      evidence,
      ...(subDomains && subDomains.length > 0 ? { subDomains } : {}),
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
//  PR-K-1 — sub-domain row assembly (surfaceSubDomains opt-in)
// ---------------------------------------------------------------------------

function buildSubDomainRows(
  category: FortuneCategory,
  dayMasterEl: ElementCode,
  fortuneEl: ElementCode,
  yongshinGrade: number,
  saju: SajuSummary,
): CategoryFortuneSubDomain[] {
  const plan = SUB_DOMAIN_PLAN[category];
  const gate: SubDomainGateInput = extractSubDomainGate(saju);
  const candidates: FortuneCategoryExtended[] = [
    plan.always,
    ...plan.conditional.filter((sub) => shouldSurfaceConditional(sub, gate)),
  ];
  return candidates.slice(0, 3).map((name) => {
    const els = getExtendedCategoryElements(name, dayMasterEl);
    const grade = computeSubDomainGrade(fortuneEl, els, yongshinGrade);
    const stars = gradeToStars(Math.round(grade));
    return {
      name,
      title: SUB_DOMAIN_TITLE[name],
      stars,
      narrative: SUB_DOMAIN_NARRATIVES[name][gradeBucket(stars)],
    };
  });
}

// PR-Q-16 — TenGodSummary surfaces only byPosition (cheonganTenGod /
// jijiPrincipalTenGod) with Korean labels. We aggregate to a 5-group count
// here without depending on the saju-adapter's internal mapping.
const TEN_GOD_KO_TO_GROUP: Record<string, string> = {
  '비견': 'friend',
  '겁재': 'friend',
  '식신': 'output',
  '상관': 'output',
  '편재': 'wealth',
  '정재': 'wealth',
  '편관': 'authority',
  '정관': 'authority',
  '편인': 'resource',
  '정인': 'resource',
};

function extractSubDomainGate(saju: SajuSummary): SubDomainGateInput {
  const groupCounts: Record<string, number> = {
    friend: 0, output: 0, wealth: 0, authority: 0, resource: 0,
  };
  const byPosition = saju.tenGodAnalysis?.byPosition;
  if (byPosition) {
    for (const positionInfo of Object.values(byPosition)) {
      if (!positionInfo) continue;
      const cheonganGroup = TEN_GOD_KO_TO_GROUP[positionInfo.cheonganTenGod];
      const jijiGroup = TEN_GOD_KO_TO_GROUP[positionInfo.jijiPrincipalTenGod];
      if (cheonganGroup) groupCounts[cheonganGroup]++;
      if (jijiGroup) groupCounts[jijiGroup]++;
    }
  }
  const shinsalHits = (saju as Record<string, unknown>).shinsalHits as
    | Array<{ name?: string }>
    | undefined;
  const yeokmaHits = Array.isArray(shinsalHits)
    ? shinsalHits.filter((h) => h?.name === '역마' || h?.name === 'YEOKMA').length
    : 0;
  const jijiRelations = (saju as Record<string, unknown>).resolvedJijiRelations as
    | Array<{ kind?: string }>
    | undefined;
  const chungHits = Array.isArray(jijiRelations)
    ? jijiRelations.filter((r) => r?.kind === '충' || r?.kind === 'CHUNG').length
    : 0;
  return {
    groupCounts,
    yeokmaHits,
    chungHits,
  };
}
