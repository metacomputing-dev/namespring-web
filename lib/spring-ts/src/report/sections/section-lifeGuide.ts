// @ts-nocheck
/**
 * section-lifeGuide.ts -- Comprehensive lifestyle guide based on yongshin
 *
 * Generates the '종합 생활 가이드' section of the premium saju report.
 * Maps the yongshin (beneficial element) to concrete, actionable lifestyle
 * recommendations covering colours, directions, numbers, foods, hobbies,
 * health, emotions, seasons, and times of day.
 *
 * When gishin (unfavourable element) is present, includes items to minimise.
 * Health advice is based on *deficient* elements (not yongshin) per classical
 * saju theory -- deficiency weakens the corresponding organ system.
 */

import type {
  SajuSummary,
  BirthInfo,
  PremiumReportSection,
  ElementCode,
  ReportHighlight,
  ReportParagraph,
  ReportSubsection,
} from '../types.js';
import {
  SeededRandom,
  pickAndFill,
  narrative,
  positive,
  encouraging,
  caution,
  tip,
  emphasis,
  joinSentences,
} from '../common/sentenceUtils.js';
import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_COLOR,
  ELEMENT_COLOR_DETAIL,
  ELEMENT_DIRECTION,
  ELEMENT_NUMBER,
  ELEMENT_FOOD,
  ELEMENT_HOBBY,
  ELEMENT_ORGAN,
  ELEMENT_EMOTION,
  ELEMENT_SEASON,
  ELEMENT_TIME,
  ELEMENT_TASTE,
} from '../common/elementMaps.js';

// ---------------------------------------------------------------------------
//  Element code normalisation
// ---------------------------------------------------------------------------

const ALL_ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

const FIRST_CHAR_TO_ELEMENT: Readonly<Record<string, ElementCode>> = {
  '목': 'WOOD', '화': 'FIRE', '토': 'EARTH', '금': 'METAL', '수': 'WATER',
};

function normalizeElement(code: string): ElementCode | null {
  const upper = code.toUpperCase();
  if ((ALL_ELEMENTS as readonly string[]).includes(upper)) return upper as ElementCode;
  return FIRST_CHAR_TO_ELEMENT[code.charAt(0)] ?? null;
}

function normaliseElementList(raw: string[]): ElementCode[] {
  const out: ElementCode[] = [];
  for (const item of raw) {
    const el = normalizeElement(item);
    if (el && !out.includes(el)) out.push(el);
  }
  return out;
}

// ---------------------------------------------------------------------------
//  Template banks
// ---------------------------------------------------------------------------

const OVERVIEW_TEMPLATES = [
  '용신 오행인 {{yongshin}}의 기운을 바탕으로, 일상생활에서 실천할 수 있는 맞춤형 가이드를 준비했어요. 작은 습관 하나가 사주의 균형을 맞추는 데 큰 도움이 됩니다.',
  '사주 분석 결과, {{yongshin}}의 기운이 가장 필요한 것으로 나타났어요. 아래 가이드를 참고하여 일상 속에서 자연스럽게 용신 에너지를 채워보세요.',
  '{{yongshin}} 기운을 중심으로 한 생활 가이드입니다. 색상, 방위, 음식, 취미 등 다양한 영역에서 용신의 에너지를 보충하는 방법을 알려드릴게요.',
] as const;

const COLOR_TEMPLATES = [
  '용신 {{yongshin}}에 해당하는 행운의 색상은 {{colors}}이에요. 옷, 소품, 인테리어에 이 색상을 활용하면 자연스럽게 좋은 기운을 가까이할 수 있어요.',
  '{{colors}} 계열의 색상이 용신 {{yongshin}}의 에너지를 끌어당겨요. 평소 옷차림이나 액세서리, 생활 공간에 이 색감을 넣어보세요.',
  '행운의 컬러는 {{colors}}입니다. {{yongshin}} 기운을 강화하는 색상이니, 자주 시선이 닿는 곳에 배치해 보세요.',
] as const;

const DIRECTION_TEMPLATES = [
  '용신 {{yongshin}}의 방위는 {{direction}}이에요. 업무 공간이나 책상을 {{direction}} 방향으로 배치하면 좋은 기운을 받을 수 있어요.',
  '{{direction}} 방향이 용신과 맞는 행운의 방위예요. 출장이나 여행 시 {{direction}}으로 향하면 유리하고, 거주 공간에서도 {{direction}}을 활용해 보세요.',
  '행운의 방향은 {{direction}}입니다. 중요한 면접, 미팅, 이사 등에서 {{direction}} 방위를 의식하면 도움이 될 수 있어요.',
] as const;

const NUMBER_TEMPLATES = [
  '용신에 해당하는 행운의 숫자는 {{num1}}과 {{num2}}이에요. 비밀번호, 전화번호, 층수 등 숫자를 선택할 때 참고해 보세요.',
  '행운의 숫자는 {{num1}}과 {{num2}}입니다. 일상에서 이 숫자를 의식적으로 활용하면 미세하지만 긍정적인 에너지 변화를 느낄 수 있어요.',
  '{{num1}}과 {{num2}}가 용신 {{yongshin}}에 대응하는 숫자예요. 좌석 선택이나 날짜 결정 시 참고하면 좋아요.',
] as const;

const FOOD_TEMPLATES = [
  '{{yongshin}} 기운을 보충하는 식재료로는 {{foods}} 등이 있어요. 일주일에 2~3회 이상 식단에 포함해 보세요.',
  '용신 보충에 좋은 음식은 {{foods}} 등이에요. {{taste}} 음식도 {{yongshin}} 기운과 관련이 깊으니 즐겨 드셔보세요.',
  '{{foods}} 등은 {{yongshin}} 오행에 해당하는 대표 식재료예요. 꾸준히 섭취하면 부족한 기운을 채우는 데 도움이 됩니다.',
] as const;

const HOBBY_TEMPLATES = [
  '{{yongshin}} 기운을 높여주는 취미활동으로는 {{hobbies}} 등이 좋아요. 마음이 끌리는 활동부터 하나씩 시작해 보세요.',
  '여가 시간에는 {{hobbies}} 같은 활동이 용신 에너지를 채우는 데 효과적이에요. 주 1~2회라도 꾸준히 즐기면 좋겠어요.',
  '추천 취미활동은 {{hobbies}} 등이에요. {{yongshin}}의 기운과 잘 어울리는 활동이니 부담 없이 시도해 보세요.',
] as const;

const HEALTH_TEMPLATES = [
  '사주에서 {{element}} 기운이 부족하므로, {{organ}} 건강에 특히 신경 써주세요.',
  '{{element}} 에너지가 약한 편이라 {{organ}}이 취약할 수 있어요. 정기 검진과 관련 건강 습관을 챙겨주세요.',
  '부족한 {{element}} 기운은 {{organ}} 기능과 연결되어 있어요. 이 부분의 건강관리를 평소에 의식해 보세요.',
] as const;

const EMOTION_TEMPLATES = [
  '용신 {{yongshin}}의 감정적 키워드는 "{{positiveEmotion}}"이에요. 이런 마음가짐을 의식적으로 키워나가면 내면의 균형이 잡히고 대인관계도 좋아질 수 있어요.',
  '"{{positiveEmotion}}" -- 이것이 {{yongshin}} 기운이 주는 긍정적 에너지예요. 일상에서 이 감정을 자주 떠올리고 실천해 보세요.',
  '{{yongshin}}의 긍정적 에너지인 "{{positiveEmotion}}"을 마음에 새겨두세요. 이 감정을 의식적으로 키우면 사주의 흐름이 더 부드러워져요.',
] as const;

const GISHIN_TEMPLATES = [
  '반대로, 기신(忌神)인 {{gishin}} 기운은 줄이는 것이 좋아요. {{gishinColor}} 계열 색상은 가급적 피하고, {{gishinEmotion}} 같은 감정에 빠지지 않도록 주의해 주세요.',
  '기신 {{gishin}}에 해당하는 기운은 과도하면 부담이 돼요. {{gishinColor}} 색상을 줄이고, {{gishinEmotion}} 같은 감정 상태를 경계하면 좋겠어요.',
  '{{gishin}} 기운을 최소화하면 용신 효과가 극대화돼요. {{gishinColor}} 톤의 소품을 줄이고, 마음속 {{gishinEmotion}} 감정을 다스려 보세요.',
] as const;

const SEASON_TEMPLATES = [
  '용신에 가장 잘 맞는 계절은 {{season}}이고, 하루 중에는 {{time}}이 에너지가 가장 잘 흐르는 시간대예요.',
  '{{season}} 시즌에 중요한 계획을 실행하면 좋고, 하루 중 {{time}}에 핵심 활동을 배치하면 효율이 높아질 수 있어요.',
  '{{yongshin}} 기운이 가장 강한 계절은 {{season}}, 시간대는 {{time}}이에요. 이 타이밍을 의식적으로 활용해 보세요.',
] as const;

// ---------------------------------------------------------------------------
//  Main generator
// ---------------------------------------------------------------------------

export function generateLifeGuideSection(
  saju: SajuSummary,
  _birth: BirthInfo,
  rng: SeededRandom,
): PremiumReportSection | null {
  const { yongshin, deficientElements } = saju;

  // Normalise yongshin element
  const yongshinEl = normalizeElement(yongshin.element);
  if (!yongshinEl) return null;

  const yongshinLabel = ELEMENT_KOREAN[yongshinEl];
  const yongshinShort = ELEMENT_KOREAN_SHORT[yongshinEl];

  // ---- Overview paragraph ----
  const paragraphs: ReportParagraph[] = [
    encouraging(
      pickAndFill(rng, OVERVIEW_TEMPLATES, { yongshin: yongshinLabel }),
      yongshinEl,
    ),
  ];

  const subsections: ReportSubsection[] = [];

  // ---- 1. Colors subsection ----
  const colorList = ELEMENT_COLOR_DETAIL[yongshinEl];
  if (colorList) {
    subsections.push({
      title: '행운의 색상',
      paragraphs: [
        positive(
          pickAndFill(rng, COLOR_TEMPLATES, {
            yongshin: yongshinShort,
            colors: colorList.join(', '),
          }),
          yongshinEl,
        ),
      ],
    });
  }

  // ---- 2. Direction subsection ----
  const direction = ELEMENT_DIRECTION[yongshinEl];
  if (direction) {
    subsections.push({
      title: '행운의 방위',
      paragraphs: [
        positive(
          pickAndFill(rng, DIRECTION_TEMPLATES, {
            yongshin: yongshinShort,
            direction,
          }),
          yongshinEl,
        ),
      ],
    });
  }

  // ---- 3. Numbers subsection ----
  const numbers = ELEMENT_NUMBER[yongshinEl];
  if (numbers) {
    subsections.push({
      title: '행운의 숫자',
      paragraphs: [
        positive(
          pickAndFill(rng, NUMBER_TEMPLATES, {
            yongshin: yongshinShort,
            num1: numbers[0],
            num2: numbers[1],
          }),
          yongshinEl,
        ),
      ],
    });
  }

  // ---- 4. Food / Diet subsection ----
  const foods = ELEMENT_FOOD[yongshinEl];
  const taste = ELEMENT_TASTE[yongshinEl];
  if (foods) {
    // Pick 4-5 foods for variety without overwhelming
    const selectedFoods = rng.sample(foods, rng.intBetween(4, 5));
    subsections.push({
      title: '추천 음식',
      paragraphs: [
        tip(
          pickAndFill(rng, FOOD_TEMPLATES, {
            yongshin: yongshinShort,
            foods: selectedFoods.join(', '),
            taste: taste ?? '',
          }),
          yongshinEl,
        ),
      ],
    });
  }

  // ---- 5. Hobbies subsection ----
  const hobbies = ELEMENT_HOBBY[yongshinEl];
  if (hobbies) {
    const selectedHobbies = rng.sample(hobbies, rng.intBetween(3, 4));
    subsections.push({
      title: '추천 취미활동',
      paragraphs: [
        encouraging(
          pickAndFill(rng, HOBBY_TEMPLATES, {
            yongshin: yongshinShort,
            hobbies: selectedHobbies.join(', '),
          }),
          yongshinEl,
        ),
      ],
    });
  }

  // ---- 6. Health subsection (based on DEFICIENT elements) ----
  const deficient = normaliseElementList(deficientElements);
  if (deficient.length > 0) {
    const healthParagraphs: ReportParagraph[] = [];
    for (const el of deficient) {
      const organ = ELEMENT_ORGAN[el];
      if (!organ) continue;
      healthParagraphs.push(
        caution(
          pickAndFill(rng, HEALTH_TEMPLATES, {
            element: ELEMENT_KOREAN[el],
            organ: organ.detail,
          }),
          el,
        ),
      );
    }
    if (healthParagraphs.length > 0) {
      subsections.push({
        title: '건강 관리 포인트',
        paragraphs: healthParagraphs,
      });
    }
  }

  // ---- 7. Emotional well-being ----
  const emotion = ELEMENT_EMOTION[yongshinEl];
  if (emotion) {
    subsections.push({
      title: '마음 챙기기',
      paragraphs: [
        encouraging(
          pickAndFill(rng, EMOTION_TEMPLATES, {
            yongshin: yongshinShort,
            positiveEmotion: emotion.positive,
          }),
          yongshinEl,
        ),
      ],
    });
  }

  // ---- 8. Gishin minimisation (if available) ----
  if (yongshin.gishin) {
    const gishinEl = normalizeElement(yongshin.gishin);
    if (gishinEl) {
      const gishinColor = ELEMENT_COLOR[gishinEl] ?? '';
      const gishinEmotion = ELEMENT_EMOTION[gishinEl]?.negative ?? '';

      subsections.push({
        title: '피해야 할 기운',
        paragraphs: [
          caution(
            pickAndFill(rng, GISHIN_TEMPLATES, {
              gishin: ELEMENT_KOREAN[gishinEl],
              gishinColor,
              gishinEmotion,
            }),
            gishinEl,
          ),
        ],
      });
    }
  }

  // ---- 9. Seasonal guide ----
  const season = ELEMENT_SEASON[yongshinEl];
  const time = ELEMENT_TIME[yongshinEl];
  if (season && time) {
    subsections.push({
      title: '계절 및 시간대 활용',
      paragraphs: [
        tip(
          pickAndFill(rng, SEASON_TEMPLATES, {
            yongshin: yongshinShort,
            season,
            time,
          }),
          yongshinEl,
        ),
      ],
    });
  }

  // ---- Highlights ----
  const highlights: ReportHighlight[] = [
    {
      label: '행운의 색상',
      value: ELEMENT_COLOR[yongshinEl] ?? '',
      element: yongshinEl,
      sentiment: 'good',
    },
    {
      label: '행운의 방위',
      value: direction ?? '',
      element: yongshinEl,
      sentiment: 'good',
    },
    {
      label: '행운의 숫자',
      value: numbers ? `${numbers[0]}, ${numbers[1]}` : '',
      element: yongshinEl,
      sentiment: 'good',
    },
    {
      label: '행운의 계절',
      value: season ?? '',
      element: yongshinEl,
      sentiment: 'good',
    },
  ];

  // ---- Assemble section ----
  return {
    id: 'lifeGuide',
    title: '종합 생활 가이드',
    subtitle: `용신 ${yongshinLabel}에 기반한 맞춤형 생활 지침`,
    paragraphs,
    subsections,
    highlights,
  };
}
