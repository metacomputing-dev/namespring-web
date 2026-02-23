/**
 * section-lifeStages.ts -- Premium report life-stages section
 *
 * Generates the "십이운성 에너지" (Twelve Life Stages Energy) section.
 * Analyzes the energy cycle of the day master across the four pillars,
 * providing a visual energy chart, per-pillar meanings, and actionable advice.
 */

import type {
  SajuSummary,
  BirthInfo,
  PremiumReportSection,
  ElementCode,
  ReportHighlight,
  ReportParagraph,
  ReportTable,
  ReportSubsection,
} from '../types.js';
import type { LifeStageCode } from '../types.js';
import {
  SeededRandom,
  pickAndFill,
  narrative,
  positive,
  encouraging,
  tip,
  joinSentences,
} from '../common/sentenceUtils.js';
import { LIFE_STAGE_BY_CODE } from '../common/elementMaps.js';
import { LIFE_STAGE_ENCYCLOPEDIA } from '../knowledge/index.js';

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;

const PILLAR_KOREAN: Record<typeof PILLAR_KEYS[number], string> = {
  year: '연주(年柱)',
  month: '월주(月柱)',
  day: '일주(日柱)',
  hour: '시주(時柱)',
};

const PILLAR_KOREAN_SHORT: Record<typeof PILLAR_KEYS[number], string> = {
  year: '연주',
  month: '월주',
  day: '일주',
  hour: '시주',
};

// ---------------------------------------------------------------------------
//  Energy-to-star visual conversion
// ---------------------------------------------------------------------------

function energyToStars(energy: number): string {
  if (energy >= 12) return '●●●●●';
  if (energy >= 10) return '●●●●○';
  if (energy >= 7) return '●●●○○';
  if (energy >= 4) return '●●○○○';
  return '●○○○○';
}

// ---------------------------------------------------------------------------
//  Template pools
// ---------------------------------------------------------------------------

const OVERVIEW_TEMPLATES = [
  '십이운성은 일간의 에너지가 네 기둥을 따라 어떻게 흐르는지를 보여줍니다. 탄생에서 정점, 쇠퇴에서 재탄생까지의 자연스러운 순환을 통해 삶의 각 시기별 에너지 특성을 파악할 수 있어요.',
  '사주의 네 기둥에 배치된 십이운성은 일간 에너지의 흐름을 보여주는 지도입니다. 각 기둥마다 다른 에너지 단계가 놓여 있어, 시기별로 어떤 기운이 강하고 약한지를 한눈에 알 수 있어요.',
  '십이운성은 일간이 네 기둥 위에서 어떤 에너지 단계에 있는지를 나타냅니다. 마치 사계절처럼 에너지의 성장과 순환을 보여주며, 각 시기에 맞는 전략을 세우는 데 도움이 됩니다.',
] as const;

const HIGH_ENERGY_TEMPLATES = [
  '{{pillar}}에 {{stage}}의 에너지가 자리하고 있어, {{period}} {{theme}}',
  '{{pillar}}의 {{stage}} 기운은 {{period}} {{theme}}',
  '{{period}} {{stage}}의 강한 에너지가 {{pillar}}에서 빛나며, {{theme}}',
] as const;

const LOW_ENERGY_TEMPLATES = [
  '{{pillar}}에는 {{stage}}의 기운이 놓여 있어, {{period}} {{theme}}',
  '{{pillar}}의 {{stage}} 에너지는 {{period}} {{theme}}',
  '{{period}} {{stage}}의 기운이 {{pillar}}에 자리하며, {{theme}}',
] as const;

const ADVICE_TEMPLATES = [
  '십이운성의 에너지 흐름을 고려할 때, {{advice1}} 또한 {{advice2}}',
  '에너지 순환의 관점에서 보면, {{advice1}} 아울러 {{advice2}}',
  '운성의 흐름에 맞추어 {{advice1}} 동시에 {{advice2}}',
] as const;

const PERIOD_MAP: Record<typeof PILLAR_KEYS[number], string> = {
  year: '초년기에',
  month: '청년기에',
  day: '중년기에',
  hour: '말년기에',
};

// ---------------------------------------------------------------------------
//  Section generator
// ---------------------------------------------------------------------------

export function generateLifeStages(
  saju: SajuSummary,
  _birth: BirthInfo,
  rng: SeededRandom,
): PremiumReportSection | null {
  const sibiUnseong = saju.sibiUnseong as Record<string, string> | null;
  if (!sibiUnseong) return null;

  const dayMasterElement = (saju.dayMaster.element ?? undefined) as ElementCode | undefined;

  // ------ Collect per-pillar data ------
  interface PillarStageData {
    key: typeof PILLAR_KEYS[number];
    code: LifeStageCode;
    korean: string;
    hanja: string;
    energy: number;
    theme: string;
    pillarMeaning: string;
    descriptions: readonly string[];
    advice: readonly string[];
  }

  const pillarData: PillarStageData[] = [];

  for (const key of PILLAR_KEYS) {
    const stageCode = sibiUnseong[key] as LifeStageCode | undefined;
    if (!stageCode) continue;

    const entry = LIFE_STAGE_ENCYCLOPEDIA[stageCode];
    if (!entry) continue;

    const meaningKey = `${key}PillarMeaning` as keyof typeof entry;
    const pillarMeaning = (entry[meaningKey] as string) ?? '';

    pillarData.push({
      key,
      code: stageCode,
      korean: entry.korean,
      hanja: entry.hanja,
      energy: entry.energy,
      theme: entry.theme,
      pillarMeaning,
      descriptions: entry.description,
      advice: entry.advice,
    });
  }

  if (pillarData.length === 0) return null;

  // ------ Sort to find extremes ------
  const sorted = [...pillarData].sort((a, b) => b.energy - a.energy);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];

  // ------ 1. Overview paragraph ------
  const overviewText = rng.pick(OVERVIEW_TEMPLATES);
  const paragraphs: ReportParagraph[] = [narrative(overviewText)];

  // ------ 2. Per-pillar subsections ------
  const subsections: ReportSubsection[] = [];

  for (const pd of pillarData) {
    const templates = pd.energy >= 7 ? HIGH_ENERGY_TEMPLATES : LOW_ENERGY_TEMPLATES;
    const mainNarration = pickAndFill(rng, templates, {
      pillar: PILLAR_KOREAN[pd.key],
      stage: `${pd.korean}(${pd.hanja})`,
      period: PERIOD_MAP[pd.key],
      theme: pd.theme,
    });

    const descLine = rng.pick(pd.descriptions);

    const subParagraphs: ReportParagraph[] = [
      pd.energy >= 7
        ? positive(mainNarration, dayMasterElement)
        : narrative(mainNarration, dayMasterElement),
      narrative(joinSentences(pd.pillarMeaning, descLine)),
    ];

    subsections.push({
      title: `${PILLAR_KOREAN_SHORT[pd.key]} - ${pd.korean}(${pd.hanja})`,
      paragraphs: subParagraphs,
    });
  }

  // ------ 3. Table ------
  const tableRows: string[][] = pillarData.map(pd => [
    PILLAR_KOREAN_SHORT[pd.key],
    `${pd.korean}(${pd.hanja})`,
    energyToStars(pd.energy),
    pd.theme,
  ]);

  const tables: ReportTable[] = [{
    title: '기둥별 십이운성',
    headers: ['기둥', '운성', '에너지', '의미'],
    rows: tableRows,
  }];

  // ------ 4. Chart ------
  const chartData: Record<string, number> = {};
  for (const pd of pillarData) {
    chartData[PILLAR_KOREAN_SHORT[pd.key]] = pd.energy;
  }

  const charts = [{
    type: 'line' as const,
    title: '기둥별 에너지 흐름',
    data: chartData,
  }];

  // ------ 5. Highlights ------
  const highlights: ReportHighlight[] = [
    {
      label: '최고 에너지',
      value: `${PILLAR_KOREAN_SHORT[highest.key]} - ${highest.korean}(${highest.energy})`,
      sentiment: 'good' as const,
    },
    {
      label: '최저 에너지',
      value: `${PILLAR_KOREAN_SHORT[lowest.key]} - ${lowest.korean}(${lowest.energy})`,
      sentiment: 'caution' as const,
    },
  ];

  // ------ 6. Advice paragraph ------
  const allAdvice = pillarData.flatMap(pd => [...pd.advice]);
  const selectedAdvice = rng.sample(allAdvice, 2);
  if (selectedAdvice.length >= 2) {
    const adviceText = pickAndFill(rng, ADVICE_TEMPLATES, {
      advice1: selectedAdvice[0],
      advice2: selectedAdvice[1],
    });
    paragraphs.push(tip(adviceText));
  } else if (selectedAdvice.length === 1) {
    paragraphs.push(tip(selectedAdvice[0]));
  }

  return {
    id: 'lifeStages',
    title: '십이운성 에너지',
    subtitle: '네 기둥에 흐르는 생명 에너지의 순환',
    paragraphs,
    tables,
    charts,
    highlights,
    subsections,
  };
}
