/**
 * section-interactions.ts -- Premium report interactions section
 *
 * Generates the "합충형파해 관계" (Stem & Branch Interactions) section.
 * Analyzes the dynamic interactions between heavenly stems and earthly
 * branches in the birth chart, classifying them as harmonious or
 * conflicting, and providing contextual narration for each.
 */

import type {
  SajuSummary,
  BirthInfo,
  PremiumReportSection,
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
} from '../common/sentenceUtils.js';
import {
  stemCodeToKorean,
  branchCodeToKorean,
  elementCodeToKorean,
} from '../common/elementMaps.js';

// ---------------------------------------------------------------------------
//  Relation type normalizer
// ---------------------------------------------------------------------------

interface RelationTypeInfo {
  readonly korean: string;
  readonly sentiment: 'positive' | 'caution' | 'neutral';
}

function getRelationTypeKorean(type: string): RelationTypeInfo {
  const t = type.toLowerCase().replace(/[^a-z가-힣]/g, '');
  if (t.includes('삼합') || t.includes('samhap')) return { korean: '삼합', sentiment: 'positive' };
  if (t.includes('방합') || t.includes('banghap')) return { korean: '방합', sentiment: 'positive' };
  if (t.includes('육합') || t.includes('yukhap') || t.includes('합') || t.includes('hap')) return { korean: '합', sentiment: 'positive' };
  if (t.includes('충') || t.includes('chung')) return { korean: '충', sentiment: 'caution' };
  if (t.includes('형') || t.includes('hyeong')) return { korean: '형', sentiment: 'caution' };
  if (t.includes('파') || t.includes('pa')) return { korean: '파', sentiment: 'caution' };
  if (t.includes('해') || t.includes('hae')) return { korean: '해', sentiment: 'caution' };
  if (t.includes('원진') || t.includes('wonjin')) return { korean: '원진', sentiment: 'caution' };
  return { korean: type, sentiment: 'neutral' };
}

// ---------------------------------------------------------------------------
//  Template pools
// ---------------------------------------------------------------------------

const OVERVIEW_TEMPLATES = [
  '합충형파해는 사주 원국 안에서 천간과 지지가 서로 영향을 주고받는 역동적인 관계를 말합니다. 합(合)은 조화와 결합을, 충(沖)은 변화와 갈등을, 형(刑)은 긴장과 시련을, 파(破)와 해(害)는 미묘한 균열과 방해를 의미합니다.',
  '사주의 천간과 지지는 서로 고립되어 있지 않고 끊임없이 상호작용합니다. 이 관계를 합충형파해라 하며, 각각의 상호작용이 삶의 조화, 변화, 성장, 도전에 영향을 미칩니다.',
  '합충형파해 분석은 사주 원국 내 천간과 지지의 상호작용을 살펴보는 과정입니다. 합은 시너지를, 충은 전환을, 형파해는 주의가 필요한 지점을 알려주어, 전체적인 기운의 흐름을 더 깊이 이해할 수 있게 합니다.',
] as const;

const HARMONY_TEMPLATES = [
  '{{type}}은 서로 어울리고 힘을 합치는 관계로, {{codes}} 사이에서 조화로운 에너지가 흐릅니다. {{note}}',
  '{{codes}} 사이의 {{type}} 관계는 서로를 돕고 시너지를 만드는 긍정적인 작용입니다. {{note}}',
  '{{codes}}에서 {{type}}이 형성되어 협력과 조화의 기운이 작용합니다. {{note}}',
] as const;

const CONFLICT_TEMPLATES = [
  '{{type}}은 서로 부딪히며 변화를 일으키는 관계로, {{codes}} 사이에서 긴장이 발생할 수 있습니다. {{note}}',
  '{{codes}} 사이의 {{type}} 관계는 도전과 변화의 계기가 되며, 유연한 대응이 필요합니다. {{note}}',
  '{{codes}}에서 {{type}}이 형성되어 변화와 전환의 에너지가 작용합니다. {{note}}',
] as const;

const MILD_CAUTION_TEMPLATES = [
  '{{codes}} 사이의 {{type}} 관계는 미묘한 균열을 뜻하며, 큰 문제보다는 작은 마찰에 주의가 필요합니다. {{note}}',
  '{{type}}은 {{codes}} 사이에서 눈에 띄지 않는 방해 요소로 작용할 수 있으니, 세심한 관리가 도움됩니다. {{note}}',
] as const;

const NO_RELATION_TEMPLATES = [
  '특별한 상호작용이 나타나지 않아, 비교적 안정적인 흐름을 보입니다.',
  '별다른 합충형 관계가 없어, 기운이 고요하게 유지됩니다.',
] as const;

const SUMMARY_TEMPLATES = [
  '전체적으로 조화 관계 {{harmonyCount}}개, 갈등 관계 {{conflictCount}}개가 나타납니다. {{summaryNote}}',
  '이 사주에는 합(조화)이 {{harmonyCount}}개, 충돌(갈등)이 {{conflictCount}}개 존재합니다. {{summaryNote}}',
  '합충형파해 분석 결과, 조화 {{harmonyCount}}건과 갈등 {{conflictCount}}건이 확인됩니다. {{summaryNote}}',
] as const;

// ---------------------------------------------------------------------------
//  Grouping helper (avoids Map iteration / downlevelIteration issues)
// ---------------------------------------------------------------------------

interface GroupedEntry<T> {
  readonly typeKorean: string;
  readonly sentiment: 'positive' | 'caution' | 'neutral';
  readonly items: T[];
}

function groupByRelationType<T extends { type: string }>(
  relations: readonly T[],
): GroupedEntry<T>[] {
  const orderMap: Record<string, number> = {};
  const buckets: Record<string, T[]> = {};
  const infoMap: Record<string, RelationTypeInfo> = {};
  let order = 0;

  for (const rel of relations) {
    const info = getRelationTypeKorean(rel.type);
    const key = info.korean;
    if (!(key in buckets)) {
      buckets[key] = [];
      infoMap[key] = info;
      orderMap[key] = order++;
    }
    buckets[key].push(rel);
  }

  return Object.keys(buckets)
    .sort((a, b) => orderMap[a] - orderMap[b])
    .map(key => ({
      typeKorean: key,
      sentiment: infoMap[key].sentiment,
      items: buckets[key],
    }));
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function formatStemCodes(stems: readonly string[]): string {
  return stems.map(s => stemCodeToKorean(s)).join('-');
}

function formatBranchCodes(branches: readonly string[]): string {
  return branches.map(b => branchCodeToKorean(b)).join('-');
}

// ---------------------------------------------------------------------------
//  Section generator
// ---------------------------------------------------------------------------

export function generateInteractions(
  saju: SajuSummary,
  _birth: BirthInfo,
  rng: SeededRandom,
): PremiumReportSection | null {
  const { cheonganRelations, jijiRelations } = saju;

  // ------ 1. Overview paragraph ------
  const overviewText = rng.pick(OVERVIEW_TEMPLATES);
  const paragraphs: ReportParagraph[] = [narrative(overviewText)];

  const subsections: ReportSubsection[] = [];
  let harmonyCount = 0;
  let conflictCount = 0;

  // ------ 2. Cheongan (heavenly stem) relations subsection ------
  const cheonganParagraphs: ReportParagraph[] = [];
  const cheonganTableRows: string[][] = [];

  if (cheonganRelations.length > 0) {
    const groups = groupByRelationType(cheonganRelations);

    for (const group of groups) {
      for (const rel of group.items) {
        const codesStr = formatStemCodes(rel.stems);
        let resultStr: string;
        if (rel.resultElement) {
          resultStr = elementCodeToKorean(rel.resultElement);
        } else if (group.typeKorean === '합') {
          resultStr = '합화 대기';
        } else if (group.typeKorean === '충') {
          resultStr = '상충';
        } else {
          resultStr = '-';
        }
        const noteStr = rel.note || '-';

        cheonganTableRows.push([group.typeKorean, codesStr, resultStr, noteStr]);

        if (group.sentiment === 'positive') {
          harmonyCount++;
        } else if (group.sentiment === 'caution') {
          conflictCount++;
        }
      }

      // Narration per type group (pick one representative relation)
      const sampleIndex = Math.floor(rng.next() * group.items.length);
      const sampleRel = group.items[sampleIndex];
      const codesStr = formatStemCodes(sampleRel.stems);
      const noteStr = sampleRel.note || '';

      if (group.sentiment === 'positive') {
        const text = pickAndFill(rng, HARMONY_TEMPLATES, {
          type: group.typeKorean,
          codes: codesStr,
          note: noteStr,
        });
        cheonganParagraphs.push(positive(text));
      } else if (group.sentiment === 'caution') {
        const text = pickAndFill(rng, CONFLICT_TEMPLATES, {
          type: group.typeKorean,
          codes: codesStr,
          note: noteStr,
        });
        cheonganParagraphs.push(caution(text));
      } else {
        cheonganParagraphs.push(narrative(
          `${codesStr} 사이에 ${group.typeKorean} 관계가 형성되어 있습니다. ${noteStr}`,
        ));
      }
    }
  } else {
    const noRelText = rng.pick(NO_RELATION_TEMPLATES);
    cheonganParagraphs.push(narrative(`천간 관계: ${noRelText}`));
  }

  const cheonganSubsection: ReportSubsection = {
    title: '천간(天干) 관계',
    paragraphs: cheonganParagraphs,
    ...(cheonganTableRows.length > 0
      ? {
        tables: [{
          title: '천간 상호작용',
          headers: ['유형', '천간', '결과', '설명'],
          rows: cheonganTableRows,
        }],
      }
      : {}),
  };
  subsections.push(cheonganSubsection);

  // ------ 3. Jiji (earthly branch) relations subsection ------
  const jijiParagraphs: ReportParagraph[] = [];
  const jijiTableRows: string[][] = [];

  if (jijiRelations.length > 0) {
    const groups = groupByRelationType(jijiRelations);

    for (const group of groups) {
      for (const rel of group.items) {
        const codesStr = formatBranchCodes(rel.branches);
        const outcomeStr = rel.outcome ?? '-';
        const noteStr = rel.note || '-';

        jijiTableRows.push([group.typeKorean, codesStr, outcomeStr, noteStr]);

        if (group.sentiment === 'positive') {
          harmonyCount++;
        } else if (group.sentiment === 'caution') {
          conflictCount++;
        }
      }

      // Narration per type group
      const sampleIndex = Math.floor(rng.next() * group.items.length);
      const sampleRel = group.items[sampleIndex];
      const codesStr = formatBranchCodes(sampleRel.branches);
      const noteStr = sampleRel.note || '';
      const isHarmony = group.typeKorean === '삼합' || group.typeKorean === '방합' || group.typeKorean === '합';
      const isChungOrHyeong = group.typeKorean === '충' || group.typeKorean === '형';
      const isPaOrHae = group.typeKorean === '파' || group.typeKorean === '해';

      if (isHarmony) {
        const text = pickAndFill(rng, HARMONY_TEMPLATES, {
          type: group.typeKorean,
          codes: codesStr,
          note: noteStr,
        });
        jijiParagraphs.push(positive(text));
      } else if (isChungOrHyeong) {
        const text = pickAndFill(rng, CONFLICT_TEMPLATES, {
          type: group.typeKorean,
          codes: codesStr,
          note: noteStr,
        });
        jijiParagraphs.push(caution(text));
      } else if (isPaOrHae) {
        const text = pickAndFill(rng, MILD_CAUTION_TEMPLATES, {
          type: group.typeKorean,
          codes: codesStr,
          note: noteStr,
        });
        jijiParagraphs.push(caution(text));
      } else {
        jijiParagraphs.push(narrative(
          `${codesStr} 사이에 ${group.typeKorean} 관계가 형성되어 있습니다. ${noteStr}`,
        ));
      }
    }
  } else {
    const noRelText = rng.pick(NO_RELATION_TEMPLATES);
    jijiParagraphs.push(narrative(`지지 관계: ${noRelText}`));
  }

  const jijiSubsection: ReportSubsection = {
    title: '지지(地支) 관계',
    paragraphs: jijiParagraphs,
    ...(jijiTableRows.length > 0
      ? {
        tables: [{
          title: '지지 상호작용',
          headers: ['유형', '지지', '결과', '설명'],
          rows: jijiTableRows,
        }],
      }
      : {}),
  };
  subsections.push(jijiSubsection);

  // ------ 4. Overall summary paragraph ------
  let summaryNote: string;
  if (harmonyCount > conflictCount) {
    summaryNote = '전체적으로 조화로운 기운이 우세하여, 대인관계와 협력에서 좋은 흐름이 기대됩니다.';
  } else if (conflictCount > harmonyCount) {
    summaryNote = '갈등 관계가 더 많지만, 이는 변화와 성장의 원동력이 될 수 있습니다. 유연한 태도가 핵심입니다.';
  } else if (harmonyCount === 0 && conflictCount === 0) {
    summaryNote = '특별한 합충 관계 없이 안정적인 구조를 보이며, 꾸준한 노력이 성과로 이어지기 좋은 사주입니다.';
  } else {
    summaryNote = '조화와 갈등이 균형을 이루고 있어, 상황에 따라 유연하게 대처하는 것이 중요합니다.';
  }

  const summaryText = pickAndFill(rng, SUMMARY_TEMPLATES, {
    harmonyCount: String(harmonyCount),
    conflictCount: String(conflictCount),
    summaryNote,
  });
  paragraphs.push(encouraging(summaryText));

  // ------ 5. Highlights ------
  const totalRelations = cheonganRelations.length + jijiRelations.length;
  const highlights: ReportHighlight[] = [
    {
      label: '조화 관계',
      value: `${harmonyCount}개`,
      sentiment: harmonyCount > 0 ? 'good' as const : 'neutral' as const,
    },
    {
      label: '갈등 관계',
      value: `${conflictCount}개`,
      sentiment: conflictCount > 0 ? 'caution' as const : 'neutral' as const,
    },
    {
      label: '전체 상호작용',
      value: `${totalRelations}개`,
      sentiment: 'neutral' as const,
    },
  ];

  return {
    id: 'interactions',
    title: '합충형파해 관계',
    subtitle: '천간과 지지의 역동적 상호작용',
    paragraphs,
    highlights,
    subsections,
  };
}
