/**
 * section-dayMaster.ts -- Premium report day master personality deep-dive
 *
 * Generates the "일간(나) 분석" section that explores the day master stem's
 * personality, strengths, cautions, and life tips. Uses the stem encyclopedia
 * for rich Korean-language content and pickAndFill for sentence variety.
 */

import type {
  SajuSummary,
  BirthInfo,
  PremiumReportSection,
  ReportSubsection,
} from '../types.js';
import type { ElementCode, StemCode } from '../types.js';
import {
  SeededRandom,
  pickAndFill,
  narrative,
  positive,
  encouraging,
  tip,
  joinSentences,
} from '../common/sentenceUtils.js';
import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_NATURE,
  STEM_BY_CODE,
  STEM_BY_HANGUL,
  lookupStemInfo,
  yinYangToKorean,
} from '../common/elementMaps.js';
import { STEM_ENCYCLOPEDIA } from '../knowledge/index.js';

// ---------------------------------------------------------------------------
//  Template pools
// ---------------------------------------------------------------------------

const OPENING_TEMPLATES = [
  '일간은 사주 여덟 글자 중 "나 자신"을 대표하는 가장 핵심적인 글자입니다. {{stemHangul}}({{stemHanja}}) 일간은 오행 중 {{elementKorean}}에 속하며, {{elementNature}}을 본질로 합니다.',
  '사주의 중심인 일간은 나의 타고난 성격과 에너지를 가장 직접적으로 보여줍니다. {{stemHangul}}({{stemHanja}})은 {{elementKorean}}의 기운을 가지고 있으며, {{elementNature}}이 삶의 근본 방향이 됩니다.',
  '{{stemHangul}}({{stemHanja}}) 일간은 "나"를 상징하는 사주의 핵심 글자예요. {{elementKorean}} 오행에 해당하며, {{elementNature}}이 성격과 행동 패턴의 바탕을 이루고 있습니다.',
  '일간 {{stemHangul}}({{stemHanja}})은 당신의 본질적 성격을 나타냅니다. 오행으로는 {{elementKorean}}에 속하며, {{elementNature}}이 타고난 기질의 뿌리가 돼요.',
] as const;

const PERSONALITY_TEMPLATES = [
  '{{stemHangul}} 일간의 성격을 살펴보면, {{trait1}} 또한 {{trait2}}',
  '성격적 특성을 보면, {{trait1}} 이와 함께 {{trait2}}',
  '{{stemHangul}}({{stemHanja}})의 성격적 특징이 잘 드러나는데, {{trait1}} 더불어 {{trait2}}',
  '타고난 성격을 요약하면, {{trait1}} 동시에 {{trait2}}',
] as const;

const PERSONALITY_EXTENDED_TEMPLATES = [
  '이러한 성향은 주변 사람들과의 관계에서도 자연스럽게 나타나며, {{trait3}}',
  '일상 속에서도 이런 면이 드러나는데, {{trait3}}',
  '이런 기질은 삶 전반에 영향을 미치며, {{trait3}}',
] as const;

const STRENGTHS_INTRO_TEMPLATES = [
  '{{stemHangul}} 일간이 가진 강점을 구체적으로 살펴보면 다음과 같습니다.',
  '{{stemHangul}}({{stemHanja}}) 일간의 타고난 강점을 정리해 보았습니다.',
  '이 일간이 지닌 대표적인 강점들을 알아볼게요.',
] as const;

const CAUTIONS_INTRO_TEMPLATES = [
  '강점이 있는 만큼 주의할 부분도 있어요. 다만 이것들은 약점이 아니라 성장 포인트로 보는 것이 좋습니다.',
  '아래 주의점들은 단점이라기보다, 의식하면 더 성장할 수 있는 포인트예요.',
  '{{stemHangul}} 일간이 특히 신경 쓰면 좋을 부분들이에요. 인지하는 것만으로도 큰 차이를 만들 수 있어요.',
] as const;

const TIPS_INTRO_TEMPLATES = [
  '일상에서 {{stemHangul}} 일간의 에너지를 더 잘 활용하기 위한 팁을 소개합니다.',
  '{{stemHangul}}({{stemHanja}}) 일간에게 도움이 되는 생활 속 실천 방법들이에요.',
  '타고난 기질을 더 효과적으로 발휘하기 위한 구체적인 팁을 정리했어요.',
] as const;

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

/** Resolve the stem code, trying code-based lookup first then hangul fallback */
function resolveStemCode(dayMasterStem: string): StemCode | null {
  if (STEM_BY_CODE[dayMasterStem]) return dayMasterStem as StemCode;
  const infoByHangul = STEM_BY_HANGUL[dayMasterStem];
  if (infoByHangul) return infoByHangul.code as StemCode;
  return null;
}

// ---------------------------------------------------------------------------
//  Section generator
// ---------------------------------------------------------------------------

export function generateDayMaster(
  saju: SajuSummary,
  _birth: BirthInfo,
  rng: SeededRandom,
): PremiumReportSection | null {
  const { dayMaster } = saju;

  // Guard: need a valid element
  if (!dayMaster.element) return null;

  // Resolve stem info
  const stemCode = resolveStemCode(dayMaster.stem);
  if (!stemCode) return null;

  const stemInfo = lookupStemInfo(stemCode)!;
  const stemEntry = STEM_ENCYCLOPEDIA[stemCode];
  if (!stemEntry) return null;

  const elementCode = dayMaster.element as ElementCode;

  const vars = {
    stemHangul: stemInfo.hangul,
    stemHanja: stemInfo.hanja,
    elementKorean: ELEMENT_KOREAN[elementCode] ?? dayMaster.element,
    elementNature: ELEMENT_NATURE[elementCode] ?? '',
  };

  const paragraphs = [];

  // ------ 1. Opening paragraph ------
  paragraphs.push(narrative(pickAndFill(rng, OPENING_TEMPLATES, vars), elementCode));

  // ------ 2. Personality paragraph ------
  const personalityTraits = rng.sample(stemEntry.personality, Math.min(3, stemEntry.personality.length));

  const personalityVars = {
    ...vars,
    trait1: personalityTraits[0] ?? '',
    trait2: personalityTraits[1] ?? '',
    trait3: personalityTraits[2] ?? '',
  };

  let personalityText = pickAndFill(rng, PERSONALITY_TEMPLATES, personalityVars);
  if (personalityTraits.length >= 3) {
    const extendedText = pickAndFill(rng, PERSONALITY_EXTENDED_TEMPLATES, personalityVars);
    personalityText = joinSentences(personalityText, extendedText);
  }

  paragraphs.push(positive(personalityText, elementCode));

  // ------ 3. Strengths subsection ------
  const strengthsIntro = pickAndFill(rng, STRENGTHS_INTRO_TEMPLATES, vars);
  const strengthParagraphs = [
    narrative(strengthsIntro, elementCode),
    ...stemEntry.strengths.map(s => positive(s, elementCode)),
  ];

  // ------ 4. Cautions subsection ------
  const cautionsIntro = pickAndFill(rng, CAUTIONS_INTRO_TEMPLATES, vars);
  const cautionParagraphs = [
    encouraging(cautionsIntro, elementCode),
    ...stemEntry.cautions.map(c => encouraging(c, elementCode)),
  ];

  // ------ 5. Life tips subsection ------
  const tipsIntro = pickAndFill(rng, TIPS_INTRO_TEMPLATES, vars);

  // Select a balanced set: 2 tips from each of the three categories
  const habitsSelected = rng.sample(stemEntry.recommendedHabits, 2);
  const relationSelected = rng.sample(stemEntry.relationshipTips, 2);
  const studyWorkSelected = rng.sample(stemEntry.studyWorkTips, 2);
  const selectedTips = [...habitsSelected, ...relationSelected, ...studyWorkSelected];

  const tipsParagraphs = [
    narrative(tipsIntro, elementCode),
    ...selectedTips.map(t => tip(t, elementCode)),
  ];

  // ------ Assemble subsections ------
  const subsections: ReportSubsection[] = [
    {
      title: '강점',
      paragraphs: strengthParagraphs,
    },
    {
      title: '주의할 점',
      paragraphs: cautionParagraphs,
    },
    {
      title: '생활 속 실천 팁',
      paragraphs: tipsParagraphs,
    },
  ];

  // ------ Highlights ------
  const yinYangLabel = yinYangToKorean(dayMaster.polarity);
  const elementShort = ELEMENT_KOREAN_SHORT[elementCode] ?? dayMaster.element;
  const coreKeywords = stemEntry.coreKeywords.slice(0, 4).join(', ');

  const highlights = [
    {
      label: '오행',
      value: ELEMENT_KOREAN[elementCode] ?? elementShort,
      element: elementCode,
      sentiment: 'neutral' as const,
    },
    {
      label: '음양',
      value: yinYangLabel,
      sentiment: 'neutral' as const,
    },
    {
      label: '핵심 키워드',
      value: coreKeywords,
      element: elementCode,
      sentiment: 'good' as const,
    },
  ];

  return {
    id: 'dayMaster',
    title: '일간(나) 분석',
    subtitle: `${stemInfo.hangul}(${stemInfo.hanja}) 일간의 성격과 강점`,
    paragraphs,
    highlights,
    subsections,
  };
}
