/**
 * section-overallSummary.ts -- Premium report hero/overview section
 *
 * Generates the "사주 총평" (Overall Saju Summary) section that serves as
 * the opening narrative of the premium report. Combines dayMaster identity,
 * strength level, gyeokguk structure, and yongshin guidance into a concise
 * 3-4 paragraph overview with highlight badges.
 */

import type { SajuSummary, BirthInfo, PremiumReportSection } from '../types.js';
import type { ElementCode } from '../types.js';
import {
  SeededRandom,
  pickAndFill,
  narrative,
  positive,
  encouraging,
  joinSentences,
} from '../common/sentenceUtils.js';
import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_NATURE,
  STRENGTH_KOREAN,
  lookupStemInfo,
  elementCodeToKorean,
  yinYangToKorean,
} from '../common/elementMaps.js';
import { STEM_ENCYCLOPEDIA } from '../knowledge/index.js';
import { findGyeokgukEntry } from '../knowledge/gyeokgukEncyclopedia.js';

import type { StemCode } from '../types.js';

// ---------------------------------------------------------------------------
//  Template pools
// ---------------------------------------------------------------------------

const OPENING_TEMPLATES = [
  '{{stemHangul}}({{stemHanja}}) 일간의 기운을 타고난 사주입니다. {{personality}} {{elementNature}}의 특성이 삶 전반에 자연스럽게 드러나며, 신강도는 {{strengthKorean}}에 해당합니다.',
  '이 사주의 중심에는 {{stemHangul}}({{stemHanja}}) 일간이 자리하고 있습니다. {{personality}} 오행으로는 {{elementKorean}}에 속하며 {{elementNature}}의 기질을 지녔고, 신강도 기준으로 {{strengthKorean}} 사주에 해당해요.',
  '{{stemHangul}}({{stemHanja}})의 기운을 일간으로 가지고 태어났습니다. {{personality}} {{strengthKorean}} 수준의 에너지 밸런스를 갖추고 있으며, {{elementKorean}}의 기운이 사주의 방향을 이끌어 갑니다.',
  '사주 원국의 핵심인 일간이 {{stemHangul}}({{stemHanja}})입니다. {{personality}} 오행 속성은 {{elementKorean}}이고 {{elementNature}}을 본질로 하며, 전체 에너지 균형은 {{strengthKorean}}으로 분류됩니다.',
] as const;

const GYEOKGUK_TEMPLATES = [
  '격국 구조는 {{gyeokgukName}}({{gyeokgukHanja}})으로 판별되었습니다. {{gyeokgukDesc}} 이 구조는 {{gyeokgukCategory}} 계열에 속하며, 삶의 방향과 에너지 흐름에 영향을 줍니다.',
  '사주의 구조적 틀인 격국은 {{gyeokgukName}}({{gyeokgukHanja}})입니다. {{gyeokgukDesc}} {{gyeokgukCategory}} 성격의 격국으로, 고유한 강점과 성장 방향을 제시해 줍니다.',
  '전체 사주의 골격을 이루는 격국은 {{gyeokgukName}}({{gyeokgukHanja}})에 해당해요. {{gyeokgukDesc}} {{gyeokgukCategory}} 계열 격국의 특징이 삶의 패턴에 자연스럽게 녹아 있습니다.',
] as const;

const YONGSHIN_TEMPLATES = [
  '이 사주에서 가장 필요한 보완 오행, 즉 용신은 {{yongshinElement}}입니다. {{yongshinElement}}의 기운을 생활 속에서 의식적으로 채워주면 에너지 균형이 좋아지고 삶의 흐름이 더 안정될 수 있어요.',
  '용신 분석 결과, {{yongshinElement}}의 기운이 이 사주에 가장 큰 도움이 됩니다. {{yongshinElement}}과 관련된 색상, 방향, 음식, 활동 등을 일상에 반영하면 부족한 에너지를 효과적으로 보충할 수 있습니다.',
  '사주 균형을 위해 가장 필요한 오행은 {{yongshinElement}}이에요. 일상에서 {{yongshinElement}}의 기운을 가까이하면 자연스럽게 에너지가 보충되어 전체적인 운세 흐름이 좋아질 수 있습니다.',
  '에너지 보완의 핵심인 용신은 {{yongshinElement}}으로 판별되었습니다. {{yongshinElement}}의 속성을 생활 곳곳에 배치하면 사주가 요구하는 균형에 한 발짝 더 다가갈 수 있어요.',
] as const;

const HEESHIN_TEMPLATES = [
  '용신을 돕는 희신은 {{heeshinElement}}이므로, {{heeshinElement}}의 기운도 함께 활용하면 시너지 효과를 기대할 수 있어요.',
  '또한 희신인 {{heeshinElement}}의 기운도 보조적으로 취해 주면 용신의 효과가 더욱 높아집니다.',
  '희신으로 작용하는 {{heeshinElement}}의 기운 역시 함께 챙기면 용신의 보완 효과가 한층 커질 수 있어요.',
] as const;

// ---------------------------------------------------------------------------
//  Section generator
// ---------------------------------------------------------------------------

export function generateOverallSummary(
  saju: SajuSummary,
  _birth: BirthInfo,
  rng: SeededRandom,
): PremiumReportSection | null {
  const { dayMaster, strength, gyeokguk, yongshin } = saju;

  // Guard: dayMaster.element must be present
  if (!dayMaster.element) return null;

  // Resolve stem info and encyclopedia entry
  const stemInfo = lookupStemInfo(dayMaster.stem);
  const stemCode = stemInfo?.code as StemCode | undefined;
  const stemEntry = stemCode ? STEM_ENCYCLOPEDIA[stemCode] : null;

  if (!stemInfo || !stemEntry) return null;

  const elementCode = dayMaster.element as ElementCode;

  // ------ 1. Opening paragraph ------
  const personalityLine = stemEntry.personality[0];
  const openingText = pickAndFill(rng, OPENING_TEMPLATES, {
    stemHangul: stemInfo.hangul,
    stemHanja: stemInfo.hanja,
    personality: personalityLine,
    elementKorean: ELEMENT_KOREAN[elementCode] ?? elementCodeToKorean(dayMaster.element),
    elementNature: ELEMENT_NATURE[elementCode] ?? '',
    strengthKorean: STRENGTH_KOREAN[strength.level as keyof typeof STRENGTH_KOREAN] ?? strength.level,
  });

  // ------ 2. Gyeokguk paragraph ------
  const gyeokgukEntry = findGyeokgukEntry(gyeokguk.type);
  let gyeokgukParagraph: string;
  if (gyeokgukEntry) {
    const descLine = rng.pick(gyeokgukEntry.description);
    gyeokgukParagraph = pickAndFill(rng, GYEOKGUK_TEMPLATES, {
      gyeokgukName: gyeokgukEntry.korean,
      gyeokgukHanja: gyeokgukEntry.hanja,
      gyeokgukDesc: descLine,
      gyeokgukCategory: gyeokgukEntry.category,
    });
  } else {
    gyeokgukParagraph = `격국 구조는 ${gyeokguk.type}으로 판별되었습니다. ${gyeokguk.reasoning}`;
  }

  // ------ 3. Yongshin paragraph ------
  const yongshinElementLabel = (ELEMENT_KOREAN[yongshin.element as ElementCode]
    ?? elementCodeToKorean(yongshin.element))
    || yongshin.element;

  let yongshinText = pickAndFill(rng, YONGSHIN_TEMPLATES, {
    yongshinElement: yongshinElementLabel,
  });

  // Append heeshin note if available
  if (yongshin.heeshin) {
    const heeshinLabel = (ELEMENT_KOREAN[yongshin.heeshin as ElementCode]
      ?? elementCodeToKorean(yongshin.heeshin))
      || yongshin.heeshin;
    const heeshinNote = pickAndFill(rng, HEESHIN_TEMPLATES, {
      heeshinElement: heeshinLabel,
    });
    yongshinText = joinSentences(yongshinText, heeshinNote);
  }

  // ------ Assemble paragraphs ------
  const paragraphs = [
    positive(openingText, elementCode),
    narrative(gyeokgukParagraph),
    encouraging(yongshinText, yongshin.element as ElementCode),
  ];

  // ------ Highlights ------
  const strengthLabel = STRENGTH_KOREAN[strength.level as keyof typeof STRENGTH_KOREAN] ?? strength.level;
  const gyeokgukLabel = gyeokgukEntry ? gyeokgukEntry.korean : gyeokguk.type;

  const highlights = [
    {
      label: '일간 (Day Master)',
      value: `${stemInfo.hangul}(${stemInfo.hanja}) ${ELEMENT_KOREAN_SHORT[elementCode] ?? ''} ${yinYangToKorean(dayMaster.polarity)}`,
      element: elementCode,
      sentiment: 'neutral' as const,
    },
    {
      label: '신강도',
      value: strengthLabel,
      sentiment: (strength.isStrong ? 'neutral' : 'caution') as 'neutral' | 'caution',
    },
    {
      label: '격국',
      value: gyeokgukLabel,
      sentiment: 'neutral' as const,
    },
    {
      label: '용신 (필요 오행)',
      value: yongshinElementLabel,
      element: yongshin.element as ElementCode,
      sentiment: 'good' as const,
    },
  ];

  return {
    id: 'overallSummary',
    title: '사주 총평',
    subtitle: `${stemInfo.hangul}(${stemInfo.hanja}) 일간의 사주 분석 개요`,
    paragraphs,
    highlights,
  };
}
