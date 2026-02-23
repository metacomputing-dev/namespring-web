// @ts-nocheck
/**
 * section-gyeokgukYongshin.ts -- Gyeokguk and Yongshin analysis
 *
 * Generates the '격국과 용신' section of the premium saju report.
 * Two subsections:
 *   1. Gyeokguk -- structural pattern of the birth chart
 *   2. Yongshin -- the recommended balancing element and practical guidance
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
  ELEMENT_DIRECTION,
  ELEMENT_NUMBER,
  ELEMENT_FOOD,
  elementCodeToKorean,
} from '../common/elementMaps.js';
import { findGyeokgukEntry, ELEMENT_ENCYCLOPEDIA } from '../knowledge/index.js';

// ---------------------------------------------------------------------------
//  Element normalisation (shared logic)
// ---------------------------------------------------------------------------

const ALL_ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

const FIRST_CHAR_TO_ELEMENT: Readonly<Record<string, ElementCode>> = {
  '목': 'WOOD', '화': 'FIRE', '토': 'EARTH', '금': 'METAL', '수': 'WATER',
};

function normalizeElement(code: string | null | undefined): ElementCode | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  if ((ALL_ELEMENTS as readonly string[]).includes(upper)) return upper as ElementCode;
  return FIRST_CHAR_TO_ELEMENT[code.charAt(0)] ?? null;
}

// ---------------------------------------------------------------------------
//  Template banks
// ---------------------------------------------------------------------------

const GYEOKGUK_INTRO_TEMPLATES = [
  '{{name}}님의 격국은 {{type}}({{category}})이에요.',
  '사주 구조를 분석한 결과, {{type}}({{category}})에 해당하는 격국이에요.',
  '원국의 핵심 구조는 {{type}}이며, {{category}} 계열에 속해요.',
];

const GYEOKGUK_FALLBACK_TEMPLATES = [
  '{{name}}님의 격국은 {{type}}으로 분류돼요. 구체적인 해석 정보가 준비 중이에요.',
  '사주 구조상 {{type}} 격국에 해당하며, 세부 분석은 추후 업데이트될 예정이에요.',
];

const YONGSHIN_INTRO_TEMPLATES = [
  '용신(用神)은 사주의 균형을 맞추기 위해 가장 필요한 오행이에요. {{name}}님의 용신은 {{element}}이에요.',
  '사주에서 가장 필요로 하는 기운, 즉 용신은 {{element}}이에요. 이 기운을 채우면 삶의 균형이 좋아져요.',
  '{{name}}님에게 가장 도움이 되는 기운은 {{element}}이에요. 이것이 바로 용신의 핵심이에요.',
];

const HEESHIN_TEMPLATES = [
  '희신(喜神)은 용신을 도와주는 보조 기운으로, {{element}}이에요. 용신과 함께 활용하면 시너지가 좋아요.',
  '용신을 뒷받침하는 희신은 {{element}}이에요. 이 기운도 함께 챙기면 더 큰 효과를 볼 수 있어요.',
];

const GISHIN_TEMPLATES = [
  '기신(忌神)은 {{element}}으로, 이 기운이 과하면 균형이 깨지기 쉬우니 주의가 필요해요.',
  '조심해야 할 기신은 {{element}}이에요. 이 기운이 강해지는 시기나 환경에서는 신중하게 대처하세요.',
];

const PRACTICAL_GUIDE_TEMPLATES = [
  '용신 {{element}}의 기운을 일상에서 채울 수 있는 실천법을 안내해 드릴게요.',
  '{{element}} 기운을 보강하기 위한 구체적인 생활 가이드예요.',
];

const CLOSING_TEMPLATES = [
  '격국이 삶의 기본 틀이라면, 용신은 그 틀 위에 올릴 최적의 에너지예요. 두 가지를 함께 이해하면 자신의 강점과 보완점이 더 뚜렷하게 보여요.',
  '격국으로 삶의 구조를 이해하고, 용신으로 균형을 맞추는 것이 사주 활용의 핵심이에요. 이 두 가지를 잘 활용해 보세요.',
  '격국은 나의 원형이고 용신은 나를 채워주는 열쇠예요. 일상에서 용신의 기운을 의식하면 긍정적인 변화를 경험할 수 있어요.',
];

// ---------------------------------------------------------------------------
//  Subsection builders
// ---------------------------------------------------------------------------

function buildGyeokgukSubsection(
  saju: SajuSummary,
  birth: BirthInfo,
  rng: SeededRandom,
): ReportSubsection {
  const gyeokguk = saju.gyeokguk;
  const entry = findGyeokgukEntry(gyeokguk.type);
  const displayName = birth.name ?? '회원';

  const paragraphs: ReportParagraph[] = [];
  const highlights: ReportHighlight[] = [];

  if (entry) {
    // Opening
    paragraphs.push(
      narrative(
        pickAndFill(rng, GYEOKGUK_INTRO_TEMPLATES, {
          name: displayName,
          type: entry.korean,
          category: entry.category,
        }),
      ),
    );

    // Description from encyclopedia
    for (const desc of entry.description) {
      paragraphs.push(narrative(desc));
    }

    // Strengths
    if (entry.strengths.length > 0) {
      paragraphs.push(positive(joinSentences(...entry.strengths)));
    }

    // Cautions
    if (entry.cautions.length > 0) {
      paragraphs.push(caution(joinSentences(...entry.cautions)));
    }

    // Career hints
    if (entry.careerHints.length > 0) {
      paragraphs.push(encouraging(joinSentences(...entry.careerHints)));
    }

    highlights.push(
      { label: '격국', value: entry.korean, sentiment: 'neutral' },
      { label: '격국 계열', value: entry.category, sentiment: 'neutral' },
    );
  } else {
    // Fallback when no encyclopedia entry is available
    paragraphs.push(
      narrative(
        pickAndFill(rng, GYEOKGUK_FALLBACK_TEMPLATES, {
          name: displayName,
          type: gyeokguk.type,
        }),
      ),
    );
    highlights.push(
      { label: '격국', value: gyeokguk.type, sentiment: 'neutral' },
    );
  }

  highlights.push({
    label: '판단 신뢰도',
    value: `${Math.round(gyeokguk.confidence * 100)}%`,
    sentiment: gyeokguk.confidence >= 0.7 ? 'good' : 'caution',
  });

  return {
    title: '격국 분석',
    paragraphs,
    highlights,
  };
}

function buildYongshinSubsection(
  saju: SajuSummary,
  birth: BirthInfo,
  rng: SeededRandom,
): ReportSubsection {
  const yongshin = saju.yongshin;
  const displayName = birth.name ?? '회원';

  const yongshinEl = normalizeElement(yongshin.element);
  const heeshinEl = normalizeElement(yongshin.heeshin);
  const gishinEl = normalizeElement(yongshin.gishin);

  const paragraphs: ReportParagraph[] = [];
  const highlights: ReportHighlight[] = [];

  // Core explanation
  if (yongshinEl) {
    paragraphs.push(
      emphasis(
        pickAndFill(rng, YONGSHIN_INTRO_TEMPLATES, {
          name: displayName,
          element: ELEMENT_KOREAN[yongshinEl],
        }),
        yongshinEl,
      ),
    );

    // Practical life guidance
    paragraphs.push(
      narrative(
        pickAndFill(rng, PRACTICAL_GUIDE_TEMPLATES, {
          element: ELEMENT_KOREAN[yongshinEl],
        }),
        yongshinEl,
      ),
    );

    const nums = ELEMENT_NUMBER[yongshinEl];
    const foods = ELEMENT_FOOD[yongshinEl];
    const selectedFoods = rng.sample(foods, 3).join(', ');

    paragraphs.push(
      tip(
        joinSentences(
          `행운 색상: ${ELEMENT_COLOR[yongshinEl]}`,
          `유리한 방위: ${ELEMENT_DIRECTION[yongshinEl]}`,
          `행운 숫자: ${nums[0]}, ${nums[1]}`,
          `추천 음식: ${selectedFoods}`,
        ),
        yongshinEl,
      ),
    );

    highlights.push({
      label: '용신 오행',
      value: ELEMENT_KOREAN[yongshinEl],
      element: yongshinEl,
      sentiment: 'good',
    });
  }

  // Heeshin
  if (heeshinEl) {
    paragraphs.push(
      positive(
        pickAndFill(rng, HEESHIN_TEMPLATES, {
          element: ELEMENT_KOREAN[heeshinEl],
        }),
        heeshinEl,
      ),
    );
    highlights.push({
      label: '희신 오행',
      value: ELEMENT_KOREAN[heeshinEl],
      element: heeshinEl,
      sentiment: 'good',
    });
  }

  // Gishin
  if (gishinEl) {
    paragraphs.push(
      caution(
        pickAndFill(rng, GISHIN_TEMPLATES, {
          element: ELEMENT_KOREAN[gishinEl],
        }),
        gishinEl,
      ),
    );
    highlights.push({
      label: '기신 오행',
      value: ELEMENT_KOREAN[gishinEl],
      element: gishinEl,
      sentiment: 'caution',
    });
  }

  return {
    title: '용신 분석',
    paragraphs,
    highlights,
  };
}

// ---------------------------------------------------------------------------
//  Main generator
// ---------------------------------------------------------------------------

export function generateGyeokgukYongshinSection(
  saju: SajuSummary,
  birth: BirthInfo,
  rng: SeededRandom,
): PremiumReportSection | null {
  const gyeokgukSub = buildGyeokgukSubsection(saju, birth, rng);
  const yongshinSub = buildYongshinSubsection(saju, birth, rng);

  // Closing paragraph tying both concepts together
  const closingParagraph = encouraging(pickAndFill(rng, CLOSING_TEMPLATES));

  return {
    id: 'gyeokgukYongshin',
    title: '격국과 용신',
    subtitle: '사주의 구조와 균형을 잡아주는 핵심 기운',
    paragraphs: [closingParagraph],
    subsections: [gyeokgukSub, yongshinSub],
  };
}
