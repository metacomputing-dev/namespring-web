// @ts-nocheck
/**
 * section-elementBalance.ts -- Five-element balance analysis
 *
 * Generates the '오행 균형 분석' section of the premium saju report.
 * Reads the element distribution from SajuSummary and produces:
 *   - Overview paragraph summarising the element balance
 *   - Bar chart of element distribution
 *   - Deficiency / excess narratives from ELEMENT_ENCYCLOPEDIA
 *   - Supplement tips for each deficient element
 *   - Highlights for the most abundant and most deficient element
 *   - Radar chart with normalised five-element distribution
 */

import type {
  SajuSummary,
  BirthInfo,
  PremiumReportSection,
  ElementCode,
  ReportHighlight,
  ReportParagraph,
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
  ELEMENT_HANJA,
} from '../common/elementMaps.js';
import { ELEMENT_ENCYCLOPEDIA } from '../knowledge/index.js';

// ---------------------------------------------------------------------------
//  Element code normalisation
// ---------------------------------------------------------------------------

const ALL_ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

const FIRST_CHAR_TO_ELEMENT: Readonly<Record<string, ElementCode>> = {
  '목': 'WOOD',
  '화': 'FIRE',
  '토': 'EARTH',
  '금': 'METAL',
  '수': 'WATER',
};

function normalizeElement(code: string): ElementCode | null {
  const upper = code.toUpperCase();
  if ((ALL_ELEMENTS as readonly string[]).includes(upper)) return upper as ElementCode;
  return FIRST_CHAR_TO_ELEMENT[code.charAt(0)] ?? null;
}

// ---------------------------------------------------------------------------
//  Normalise the distribution map into a Record<ElementCode, number>
// ---------------------------------------------------------------------------

function normaliseDistribution(
  raw: Record<string, number>,
): Record<ElementCode, number> {
  const result: Record<ElementCode, number> = {
    WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0,
  };
  for (const [key, value] of Object.entries(raw)) {
    const el = normalizeElement(key);
    if (el) result[el] += value;
  }
  return result;
}

// ---------------------------------------------------------------------------
//  Normalise an element list (deficient / excessive) into ElementCode[]
// ---------------------------------------------------------------------------

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
  '사주 원국에 나타난 오행의 분포를 살펴보면, {{dominant}} 기운이 가장 강하고 {{weakest}} 기운이 가장 약한 구성이에요.',
  '오행 균형을 분석한 결과, {{dominant}} 에너지가 두드러지며 {{weakest}} 에너지는 상대적으로 부족한 편이에요.',
  '원국의 오행 배분을 보면 {{dominant}}이(가) 중심 기운을 이루고 있고, {{weakest}}은(는) 보완이 필요한 상태예요.',
];

const BALANCED_TEMPLATES = [
  '전체적으로 오행이 비교적 고르게 분포되어 있어, 큰 치우침 없이 균형 잡힌 구성이에요.',
  '오행 분포가 안정적인 편으로, 특정 기운에 크게 치우치지 않은 조화로운 구조예요.',
];

const DEFICIENT_TEMPLATES = [
  '{{element}} 기운이 부족한 편이에요. {{meaning}}',
  '원국에서 {{element}} 에너지가 약하게 나타나요. {{meaning}}',
  '{{element}}의 기운이 충분하지 않은데요. {{meaning}}',
];

const EXCESSIVE_TEMPLATES = [
  '{{element}} 기운이 과다한 편이에요. {{meaning}}',
  '원국에서 {{element}} 에너지가 넘치는 양상이에요. {{meaning}}',
  '{{element}}의 기운이 지나치게 강한 상태예요. {{meaning}}',
];

const TIP_INTRO_TEMPLATES = [
  '부족한 {{element}} 기운을 보충하기 위해 다음을 실천해 보세요.',
  '{{element}} 에너지를 채우려면 아래 방법을 시도해 보세요.',
  '{{element}} 기운 보완을 위해 일상에서 이런 점을 의식해 보세요.',
];

// ---------------------------------------------------------------------------
//  Main generator
// ---------------------------------------------------------------------------

export function generateElementBalanceSection(
  saju: SajuSummary,
  _birth: BirthInfo,
  rng: SeededRandom,
): PremiumReportSection | null {
  const dist = normaliseDistribution(saju.elementDistribution);
  const deficient = normaliseElementList(saju.deficientElements);
  const excessive = normaliseElementList(saju.excessiveElements);

  // Determine the most abundant and the weakest element
  let dominantEl: ElementCode = 'WOOD';
  let weakestEl: ElementCode = 'WOOD';
  let maxVal = -Infinity;
  let minVal = Infinity;

  for (const el of ALL_ELEMENTS) {
    const v = dist[el];
    if (v > maxVal) { maxVal = v; dominantEl = el; }
    if (v < minVal) { minVal = v; weakestEl = el; }
  }

  // Total for percentage calculations
  const total = ALL_ELEMENTS.reduce((s, e) => s + dist[e], 0);

  // ---- Paragraphs ----
  const paragraphs: ReportParagraph[] = [];

  // Check whether the distribution is relatively balanced (max/min ratio < 2)
  const isBalanced = total > 0 && maxVal > 0 && minVal > 0 && maxVal / minVal < 2;

  if (isBalanced) {
    paragraphs.push(
      positive(pickAndFill(rng, BALANCED_TEMPLATES)),
    );
  } else {
    paragraphs.push(
      narrative(
        pickAndFill(rng, OVERVIEW_TEMPLATES, {
          dominant: ELEMENT_KOREAN[dominantEl],
          weakest: ELEMENT_KOREAN[weakestEl],
        }),
      ),
    );
  }

  // Deficient elements
  for (const el of deficient) {
    const entry = ELEMENT_ENCYCLOPEDIA[el];
    if (!entry) continue;
    paragraphs.push(
      caution(
        pickAndFill(rng, DEFICIENT_TEMPLATES, {
          element: ELEMENT_KOREAN[el],
          meaning: entry.deficientMeaning,
        }),
        el,
      ),
    );
  }

  // Excessive elements
  for (const el of excessive) {
    const entry = ELEMENT_ENCYCLOPEDIA[el];
    if (!entry) continue;
    paragraphs.push(
      caution(
        pickAndFill(rng, EXCESSIVE_TEMPLATES, {
          element: ELEMENT_KOREAN[el],
          meaning: entry.excessiveMeaning,
        }),
        el,
      ),
    );
  }

  // Supplement tips for each deficient element
  for (const el of deficient) {
    const entry = ELEMENT_ENCYCLOPEDIA[el];
    if (!entry || entry.supplementTips.length === 0) continue;

    paragraphs.push(
      emphasis(
        pickAndFill(rng, TIP_INTRO_TEMPLATES, { element: ELEMENT_KOREAN[el] }),
        el,
      ),
    );

    // Pick 2-3 tips at random for variety
    const selectedTips = rng.sample(entry.supplementTips, rng.intBetween(2, 3));
    for (const t of selectedTips) {
      paragraphs.push(tip(t, el));
    }
  }

  // ---- Bar chart ----
  const barData: Record<string, number> = {};
  for (const el of ALL_ELEMENTS) {
    barData[ELEMENT_KOREAN_SHORT[el]] = dist[el];
  }

  // ---- Radar chart (normalised to 0~100 scale) ----
  const radarData: Record<string, number> = {};
  for (const el of ALL_ELEMENTS) {
    radarData[ELEMENT_KOREAN_SHORT[el]] = total > 0
      ? Math.round((dist[el] / total) * 100)
      : 0;
  }

  // ---- Highlights ----
  const highlights: ReportHighlight[] = [
    {
      label: '가장 강한 오행',
      value: `${ELEMENT_KOREAN[dominantEl]} (${total > 0 ? Math.round((maxVal / total) * 100) : 0}%)`,
      element: dominantEl,
      sentiment: 'neutral',
    },
  ];

  if (deficient.length > 0) {
    highlights.push({
      label: '가장 부족한 오행',
      value: ELEMENT_KOREAN[weakestEl],
      element: weakestEl,
      sentiment: 'caution',
    });
  }

  // ---- Assemble section ----
  return {
    id: 'elementBalance',
    title: '오행 균형 분석',
    subtitle: '다섯 가지 기운의 분포와 보완 전략',
    paragraphs,
    charts: [
      {
        type: 'bar',
        title: '오행 분포',
        data: barData,
      },
      {
        type: 'radar',
        title: '오행 균형 레이더',
        data: radarData,
      },
    ],
    highlights,
  };
}
