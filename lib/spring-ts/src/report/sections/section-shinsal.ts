/**
 * section-shinsal.ts -- Premium report shinsal analysis section
 *
 * Generates the "신살 분석" (Divine-Sha Analysis) section.
 * Classifies shinsal hits as auspicious (길신), inauspicious (흉살),
 * or neutral, and provides encyclopedia-backed meanings and tips.
 *
 * IMPORTANT: Inauspicious shinsals are framed encouragingly, as
 * areas for mindful awareness rather than sources of fear.
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
  branchCodeToKorean,
} from '../common/elementMaps.js';
import { findShinsalEntry } from '../knowledge/index.js';

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

interface ClassifiedHit {
  readonly type: string;
  readonly position: string;
  readonly grade: string;
  readonly weightedScore: number;
  readonly korean: string;
  readonly meaning: string;
  readonly description: readonly string[];
  readonly tips: readonly string[];
  readonly category: 'auspicious' | 'inauspicious' | 'neutral';
}

// ---------------------------------------------------------------------------
//  Template pools
// ---------------------------------------------------------------------------

const OVERVIEW_TEMPLATES = [
  '신살(神殺)은 사주 원국에 내재된 특별한 기운으로, 길신은 삶에 도움이 되는 복의 에너지를, 흉살은 주의가 필요한 지점을 알려주는 이정표 역할을 합니다.',
  '사주에 나타나는 신살은 삶의 흐름 속에서 특정 방향으로 작용하는 에너지입니다. 길신은 타고난 복을, 흉살은 성장을 위해 신경 써야 할 부분을 나타냅니다.',
  '신살 분석은 사주 안에 숨겨진 특별한 기운을 읽어내는 과정입니다. 좋은 신살은 삶의 순풍이 되고, 주의가 필요한 신살은 미리 대비하면 오히려 성장의 발판이 됩니다.',
] as const;

const AUSPICIOUS_TEMPLATES = [
  '이 사주에는 {{count}}개의 길신이 자리하고 있어, 타고난 복과 도움의 기운이 함께합니다. 특히 {{highlight}}의 에너지가 삶의 곳곳에서 긍정적으로 작용할 수 있어요.',
  '총 {{count}}개의 길신이 발견되어 인연운, 학습운, 재물운 등에서 자연스러운 도움을 받을 수 있습니다. {{highlight}}의 기운이 특히 돋보입니다.',
  '{{count}}개의 길신이 사주에 깃들어 있으며, {{highlight}}을 비롯한 좋은 기운이 삶의 흐름을 밝게 이끌어 줍니다.',
] as const;

const INAUSPICIOUS_TEMPLATES = [
  '주의가 필요한 신살이 {{count}}개 나타나지만, 이는 두려워할 대상이 아니라 미리 알고 대비하면 되는 참고 사항입니다. {{highlight}}에 대해 의식적으로 관리하면 오히려 성장의 기회가 됩니다.',
  '{{count}}개의 주의 신살이 있으나, 이를 인식하고 준비하는 것만으로도 큰 차이를 만들 수 있습니다. {{highlight}}는 신경 써서 관리하면 충분히 극복할 수 있어요.',
  '이 사주에 {{count}}개의 주의 신살이 보이지만, 이는 삶에서 더 신중해야 할 영역을 알려주는 나침반입니다. {{highlight}}에 주의를 기울이면 지혜롭게 넘어갈 수 있습니다.',
] as const;

const GONGMANG_TEMPLATES = [
  '이 사주에는 공망(空亡)이 {{branches}}에 걸려 있습니다. 공망은 해당 지지의 기운이 비어 허탈감이 올 수 있는 구간을 뜻하지만, 비움을 통한 재정비와 성찰의 기회로 활용할 수 있어요.',
  '공망이 {{branches}}에 위치하여, 이 영역에서 간헐적으로 공허함을 느낄 수 있습니다. 그러나 공망은 낡은 것을 비우고 새로운 것을 채울 수 있는 여백이기도 합니다.',
  '{{branches}}에 공망이 놓여 있어 해당 기운이 약해질 수 있으나, 의식적으로 루틴을 유지하고 작은 행동을 이어가면 공망의 영향을 줄일 수 있습니다.',
] as const;

const BALANCE_TEMPLATES = [
  '전체적으로 길신 {{auspicious}}개, 주의 신살 {{inauspicious}}개, 중립 {{neutral}}개로 구성되어 있습니다. {{balanceNote}}',
  '신살 분포를 보면 길신이 {{auspicious}}개, 주의 신살이 {{inauspicious}}개, 중립이 {{neutral}}개입니다. {{balanceNote}}',
] as const;

const POSITION_KOREAN: Record<string, string> = {
  year: '년주',
  month: '월주',
  day: '일주',
  hour: '시주',
};

/** Position-based weight multiplier (일주 most important, 기타 least) */
const POSITION_WEIGHT: Readonly<Record<string, number>> = {
  '일주': 1.0, '월주': 0.9, '년주': 0.8, '시주': 0.7,
  'day': 1.0, 'month': 0.9, 'year': 0.8, 'hour': 0.7,
};

const DOMINANT_TEMPLATES = [
  '이 사주에서 가장 크게 작용하는 신살은 {{name}}입니다. {{meaning}} {{detail}}',
  '{{name}}이 사주의 핵심 신살로 자리하고 있습니다. {{meaning}} {{detail}}',
  '특히 주목해야 할 신살은 {{name}}입니다. {{meaning}} {{detail}}',
] as const;

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function positionToKorean(position: string): string {
  return POSITION_KOREAN[position] ?? position;
}

function classifyHit(hit: { type: string; position: string; grade: string; baseWeight: number; positionMultiplier: number; weightedScore: number }): ClassifiedHit {
  const entry = findShinsalEntry(hit.type);

  // Determine category from encyclopedia; unknown shinsals default to neutral
  let category: 'auspicious' | 'inauspicious' | 'neutral';
  if (entry) {
    category = entry.type;
  } else {
    category = 'neutral';
  }

  // Compute importance-based weight using encyclopedia importance + position multiplier
  const importance = entry?.importance ?? 40;
  const posKorean = positionToKorean(hit.position);
  const posWeight = POSITION_WEIGHT[posKorean] ?? POSITION_WEIGHT[hit.position] ?? 0.6;
  let computedWeight = importance * posWeight;

  // Inauspicious shinsals get negative sign for semantic clarity
  if (category === 'inauspicious') {
    computedWeight = -computedWeight;
  }

  return {
    type: hit.type,
    position: hit.position,
    grade: hit.grade,
    weightedScore: computedWeight,
    korean: entry?.korean ?? hit.type,
    meaning: entry?.meaning ?? '',
    description: entry?.description ?? [],
    tips: entry?.tips ?? [],
    category,
  };
}

// ---------------------------------------------------------------------------
//  Section generator
// ---------------------------------------------------------------------------

export function generateShinsal(
  saju: SajuSummary,
  _birth: BirthInfo,
  rng: SeededRandom,
): PremiumReportSection | null {
  const { shinsalHits, gongmang } = saju;

  if (!shinsalHits || shinsalHits.length === 0) return null;

  // ------ Classify all hits ------
  const classified = shinsalHits.map(classifyHit);
  const auspicious = classified
    .filter(h => h.category === 'auspicious')
    .sort((a, b) => Math.abs(b.weightedScore) - Math.abs(a.weightedScore));
  const inauspicious = classified
    .filter(h => h.category === 'inauspicious')
    .sort((a, b) => Math.abs(b.weightedScore) - Math.abs(a.weightedScore));
  const neutral = classified
    .filter(h => h.category === 'neutral')
    .sort((a, b) => Math.abs(b.weightedScore) - Math.abs(a.weightedScore));

  // ------ 1. Overview paragraph ------
  const overviewText = rng.pick(OVERVIEW_TEMPLATES);
  const paragraphs: ReportParagraph[] = [narrative(overviewText)];

  const subsections: ReportSubsection[] = [];
  const allTips: string[] = [];

  // ------ 2. Auspicious subsection ------
  if (auspicious.length > 0) {
    const auspiciousParagraphs: ReportParagraph[] = [];

    const highlightName = auspicious[0].korean;
    const auspiciousText = pickAndFill(rng, AUSPICIOUS_TEMPLATES, {
      count: String(auspicious.length),
      highlight: highlightName,
    });
    auspiciousParagraphs.push(positive(auspiciousText));

    const auspiciousTableRows: string[][] = auspicious.map(h => [
      h.korean,
      positionToKorean(h.position),
      h.grade,
      Math.abs(h.weightedScore).toFixed(1) + '점',
      h.meaning || '-',
    ]);

    // Collect tips from auspicious entries
    for (const h of auspicious) {
      allTips.push(...h.tips);
    }

    subsections.push({
      title: '길신 (吉神)',
      paragraphs: auspiciousParagraphs,
      tables: [{
        title: '길신 목록',
        headers: ['신살명', '위치', '등급', '영향도', '의미'],
        rows: auspiciousTableRows,
      }],
    });
  }

  // ------ 3. Inauspicious subsection ------
  if (inauspicious.length > 0) {
    const inauspiciousParagraphs: ReportParagraph[] = [];

    const highlightName = inauspicious[0].korean;
    const inauspiciousText = pickAndFill(rng, INAUSPICIOUS_TEMPLATES, {
      count: String(inauspicious.length),
      highlight: highlightName,
    });
    inauspiciousParagraphs.push(encouraging(inauspiciousText));

    const inauspiciousTableRows: string[][] = inauspicious.map(h => [
      h.korean,
      positionToKorean(h.position),
      h.grade,
      Math.abs(h.weightedScore).toFixed(1) + '점',
      h.meaning || '-',
    ]);

    // Collect tips from inauspicious entries
    for (const h of inauspicious) {
      allTips.push(...h.tips);
    }

    subsections.push({
      title: '주의 신살',
      paragraphs: inauspiciousParagraphs,
      tables: [{
        title: '주의 신살 목록',
        headers: ['신살명', '위치', '등급', '영향도', '의미'],
        rows: inauspiciousTableRows,
      }],
    });
  }

  // ------ 4. Neutral subsection (only if there are neutrals and no auspicious/inauspicious) ------
  if (neutral.length > 0) {
    const neutralParagraphs: ReportParagraph[] = [];
    neutralParagraphs.push(narrative(
      `중립 성격의 신살이 ${neutral.length}개 나타납니다. 이들은 상황과 활용에 따라 좋은 쪽으로도, 주의가 필요한 쪽으로도 작용할 수 있습니다.`,
    ));

    const neutralTableRows: string[][] = neutral.map(h => [
      h.korean,
      positionToKorean(h.position),
      h.grade,
      Math.abs(h.weightedScore).toFixed(1) + '점',
      h.meaning || '-',
    ]);

    // Collect tips from neutral entries
    for (const h of neutral) {
      allTips.push(...h.tips);
    }

    subsections.push({
      title: '중립 신살',
      paragraphs: neutralParagraphs,
      tables: [{
        title: '중립 신살 목록',
        headers: ['신살명', '위치', '등급', '영향도', '의미'],
        rows: neutralTableRows,
      }],
    });
  }

  // ------ 5. Gongmang note ------
  if (gongmang) {
    const branchNames = gongmang
      .map(code => branchCodeToKorean(code))
      .join(', ');

    const gongmangText = pickAndFill(rng, GONGMANG_TEMPLATES, {
      branches: branchNames,
    });
    paragraphs.push(encouraging(gongmangText));
  }

  // ------ 6. Dominant shinsal analysis subsection ------
  const allSorted = [...classified].sort((a, b) => Math.abs(b.weightedScore) - Math.abs(a.weightedScore));
  const dominantHits = allSorted.slice(0, Math.min(3, allSorted.length));

  if (dominantHits.length > 0) {
    const dominantParagraphs: ReportParagraph[] = [];
    for (const hit of dominantHits) {
      const detail = hit.description.length > 0 ? hit.description[0] : '';
      const text = pickAndFill(rng, DOMINANT_TEMPLATES, {
        name: hit.korean,
        meaning: hit.meaning,
        detail,
      });
      const toneFactory = hit.category === 'auspicious' ? positive
        : hit.category === 'inauspicious' ? caution : narrative;
      dominantParagraphs.push(toneFactory(text));

      // Add second description line if available
      if (hit.description.length > 1) {
        dominantParagraphs.push(encouraging(hit.description[1]));
      }
    }

    subsections.push({
      title: '지배적 신살 분석',
      paragraphs: dominantParagraphs,
    });
  }

  // ------ 7. Weighted totals & Chart ------
  const totalAuspiciousWeight = auspicious
    .reduce((sum, h) => sum + Math.abs(h.weightedScore), 0);
  const totalInauspiciousWeight = inauspicious
    .reduce((sum, h) => sum + Math.abs(h.weightedScore), 0);
  const totalNeutralWeight = neutral
    .reduce((sum, h) => sum + Math.abs(h.weightedScore), 0);

  const charts = [{
    type: 'donut' as const,
    title: '신살 영향도 분포',
    data: {
      '길신': totalAuspiciousWeight,
      '주의 신살': totalInauspiciousWeight,
      '중립 신살': totalNeutralWeight,
    } as Record<string, number>,
  }];

  // ------ 8. Highlights ------
  const totalCount = classified.length;
  const highlights: ReportHighlight[] = [
    {
      label: '전체 신살',
      value: `${totalCount}개`,
      sentiment: 'neutral' as const,
    },
    {
      label: '길신',
      value: `${auspicious.length}개`,
      sentiment: auspicious.length > 0 ? 'good' as const : 'neutral' as const,
    },
    {
      label: '주의 신살',
      value: `${inauspicious.length}개`,
      sentiment: inauspicious.length > 0 ? 'caution' as const : 'neutral' as const,
    },
  ];

  // ------ 9. Balance summary paragraph ------
  let balanceNote: string;
  if (auspicious.length > inauspicious.length) {
    balanceNote = '길신이 우세하여 전반적으로 복의 기운이 강한 사주입니다.';
  } else if (inauspicious.length > auspicious.length) {
    balanceNote = '주의 신살이 더 많지만, 인식하고 대비하면 충분히 좋은 방향으로 이끌 수 있습니다.';
  } else if (auspicious.length === 0 && inauspicious.length === 0) {
    balanceNote = '중립적인 신살로 구성되어 활용 방법에 따라 결과가 달라질 수 있습니다.';
  } else {
    balanceNote = '길신과 주의 신살이 균형을 이루고 있어, 의식적인 관리가 중요합니다.';
  }

  const balanceText = pickAndFill(rng, BALANCE_TEMPLATES, {
    auspicious: String(auspicious.length),
    inauspicious: String(inauspicious.length),
    neutral: String(neutral.length),
    balanceNote,
  });
  paragraphs.push(narrative(balanceText));

  // ------ 9b. Weighted score summary paragraph ------
  if (totalAuspiciousWeight > 0 || totalInauspiciousWeight > 0) {
    const weightVerdict = totalAuspiciousWeight >= totalInauspiciousWeight
      ? '전체적으로 길한 기운이 우세합니다.'
      : '주의가 필요한 영역이 있으나, 인식하고 대비하면 충분히 관리할 수 있습니다.';
    const weightSummaryText =
      `길신 총 영향도 ${totalAuspiciousWeight.toFixed(1)}점, ` +
      `주의 신살 총 영향도 ${totalInauspiciousWeight.toFixed(1)}점, ` +
      `중립 신살 영향도 ${totalNeutralWeight.toFixed(1)}점으로, ` +
      weightVerdict;
    paragraphs.push(narrative(weightSummaryText));
  }

  // ------ 10. Tips from encyclopedia entries ------
  if (allTips.length > 0) {
    const selectedTips = rng.sample(allTips, Math.min(3, allTips.length));
    const tipsText = selectedTips.join(' ');
    paragraphs.push(tip(tipsText));
  }

  return {
    id: 'shinsal',
    title: '신살 분석',
    subtitle: '사주에 깃든 특별한 기운',
    paragraphs,
    charts,
    highlights,
    subsections,
  };
}
