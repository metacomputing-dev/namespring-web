/**
 * part8-nameElement.ts -- 이름 오행(자원오행/수리오행)과 사주 용희기 관계 섹션
 *
 * Section ID: nameElement
 */

import type {
  ElementCode,
  ReportChart,
  ReportHighlight,
  ReportInput,
  ReportParagraph,
  ReportSection,
  ReportTable,
} from '../types.js';

const ALL_ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

const ELEMENT_LABEL: Record<ElementCode, string> = {
  WOOD: '목(木)',
  FIRE: '화(火)',
  EARTH: '토(土)',
  METAL: '금(金)',
  WATER: '수(水)',
};

const ELEMENT_SHORT: Record<ElementCode, string> = {
  WOOD: '목',
  FIRE: '화',
  EARTH: '토',
  METAL: '금',
  WATER: '수',
};

const GENERATES: Record<ElementCode, ElementCode> = {
  WOOD: 'FIRE',
  FIRE: 'EARTH',
  EARTH: 'METAL',
  METAL: 'WATER',
  WATER: 'WOOD',
};

const GENERATED_BY: Record<ElementCode, ElementCode> = {
  WOOD: 'WATER',
  FIRE: 'WOOD',
  EARTH: 'FIRE',
  METAL: 'EARTH',
  WATER: 'METAL',
};

const CONTROLS: Record<ElementCode, ElementCode> = {
  WOOD: 'EARTH',
  FIRE: 'METAL',
  EARTH: 'WATER',
  METAL: 'WOOD',
  WATER: 'FIRE',
};

const CONTROLLED_BY: Record<ElementCode, ElementCode> = {
  WOOD: 'METAL',
  FIRE: 'WATER',
  EARTH: 'WOOD',
  METAL: 'FIRE',
  WATER: 'EARTH',
};

type ElementRelation = 'same' | 'generates' | 'generated_by' | 'controls' | 'controlled_by';

interface ShenElements {
  readonly yong: ElementCode;
  readonly hee: ElementCode;
  readonly gi: ElementCode;
}

interface ElementStats {
  readonly element: ElementCode;
  readonly nameCount: number;
  readonly suriCount: number;
  readonly totalCount: number;
  readonly baseScore: number;
  readonly weightedScore: number;
}

function safeName(input: ReportInput): string {
  return input.name?.trim() || '아이';
}

function normalizeElement(value: string | null | undefined): ElementCode | null {
  if (!value) return null;

  const raw = value.trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (upper === 'WOOD' || upper === 'FIRE' || upper === 'EARTH' || upper === 'METAL' || upper === 'WATER') {
    return upper;
  }

  if (raw.includes('목') || raw.includes('木') || upper.includes('WOOD')) return 'WOOD';
  if (raw.includes('화') || raw.includes('火') || upper.includes('FIRE')) return 'FIRE';
  if (raw.includes('토') || raw.includes('土') || upper.includes('EARTH')) return 'EARTH';
  if (raw.includes('금') || raw.includes('金') || upper.includes('METAL')) return 'METAL';
  if (raw.includes('수') || raw.includes('水') || upper.includes('WATER')) return 'WATER';

  return null;
}

function normalizeElements(values: readonly (string | null | undefined)[]): ElementCode[] {
  const result: ElementCode[] = [];
  for (const value of values) {
    const normalized = normalizeElement(value);
    if (normalized) result.push(normalized);
  }
  return result;
}

function emptyElementCount(): Record<ElementCode, number> {
  return {
    WOOD: 0,
    FIRE: 0,
    EARTH: 0,
    METAL: 0,
    WATER: 0,
  };
}

function countElements(elements: readonly ElementCode[]): Record<ElementCode, number> {
  const counts = emptyElementCount();
  for (const element of elements) {
    counts[element] += 1;
  }
  return counts;
}

function extractNameElements(input: ReportInput): ElementCode[] {
  const fromCompatibility = normalizeElements(input.spring?.sajuCompatibility?.nameElements ?? []);
  if (fromCompatibility.length > 0) return fromCompatibility;

  const fromNaming = normalizeElements((input.naming?.name?.givenName ?? []).map(char => char.element));
  if (fromNaming.length > 0) return fromNaming;

  return normalizeElements((input.spring?.namingReport?.name?.givenName ?? []).map(char => char.element));
}

function extractSuriElements(input: ReportInput): ElementCode[] {
  const fromNamingFrames = normalizeElements((input.naming?.analysis?.fourFrame?.frames ?? []).map(frame => frame.element));
  if (fromNamingFrames.length > 0) return fromNamingFrames;

  return normalizeElements((input.spring?.namingReport?.analysis?.fourFrame?.frames ?? []).map(frame => frame.element));
}

function extractShenElements(input: ReportInput): ShenElements | null {
  const yong = normalizeElement(input.spring?.sajuCompatibility?.yongshinElement)
    ?? normalizeElement(input.saju.yongshin?.element);

  if (!yong) return null;

  const hee = normalizeElement(input.spring?.sajuCompatibility?.heeshinElement)
    ?? normalizeElement(input.saju.yongshin?.heeshin)
    ?? GENERATED_BY[yong];

  const gi = normalizeElement(input.spring?.sajuCompatibility?.gishinElement)
    ?? normalizeElement(input.saju.yongshin?.gishin)
    ?? CONTROLLED_BY[yong];

  return { yong, hee, gi };
}

function getRelation(from: ElementCode, to: ElementCode): ElementRelation {
  if (from === to) return 'same';
  if (GENERATES[from] === to) return 'generates';
  if (GENERATED_BY[from] === to) return 'generated_by';
  if (CONTROLS[from] === to) return 'controls';
  return 'controlled_by';
}

function relationLabel(element: ElementCode, shen: ShenElements): string {
  if (element === shen.yong) return '용신';
  if (element === shen.hee) return '희신';
  if (element === shen.gi) return '기신';

  const relation = getRelation(element, shen.yong);
  if (relation === 'generates') return '용신을 돕는 상생';
  if (relation === 'generated_by') return '용신이 돕는 상생';
  if (relation === 'controls') return '용신을 누르는 상극';
  if (relation === 'controlled_by') return '용신이 누르는 관계';
  return '중립';
}

function baseScore(element: ElementCode, shen: ShenElements): number {
  if (element === shen.yong) return 4;
  if (element === shen.hee) return 3;
  if (element === shen.gi) return -4;

  const relation = getRelation(element, shen.yong);
  if (relation === 'generates') return 2;
  if (relation === 'generated_by') return 1;
  if (relation === 'controls') return -2;
  if (relation === 'controlled_by') return -1;
  return 0;
}

function explainRow(stat: ElementStats, shen: ShenElements): string {
  if (stat.totalCount === 0) return '이름에서 거의 보이지 않아요.';
  if (stat.element === shen.yong) return '사주에 가장 필요한 기운이라 중심을 잘 잡아줘요.';
  if (stat.element === shen.hee) return '용신을 옆에서 도와주는 좋은 지원군이에요.';
  if (stat.element === shen.gi) return '기신이라 많아지면 흐름이 답답해질 수 있어요.';

  const relation = getRelation(stat.element, shen.yong);
  if (relation === 'generates') return '용신을 낳아주는 상생 관계라 보조 효과가 좋아요.';
  if (relation === 'generated_by') return '용신에게 도움을 받는 쪽이라 무난한 편이에요.';
  if (relation === 'controls') return '용신과 맞부딪히는 상극 관계라 주의가 필요해요.';
  return '용신이 눌러주는 관계라 강하게 튀지는 않아요.';
}

function summarizeElements(elements: readonly ElementCode[]): string {
  if (elements.length === 0) return '없음';
  const counts = countElements(elements);
  const parts: string[] = [];

  for (const element of ALL_ELEMENTS) {
    const count = counts[element];
    if (count > 0) {
      parts.push(`${ELEMENT_SHORT[element]} ${count}개`);
    }
  }

  return parts.length > 0 ? parts.join(', ') : '없음';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildStats(
  nameCounts: Record<ElementCode, number>,
  suriCounts: Record<ElementCode, number>,
  shen: ShenElements,
): ElementStats[] {
  return ALL_ELEMENTS.map((element): ElementStats => {
    const nameCount = nameCounts[element];
    const suriCount = suriCounts[element];
    const totalCount = nameCount + suriCount;
    const score = baseScore(element, shen);
    const bridgeBonus = nameCount > 0 && suriCount > 0
      ? (score > 0 ? 1 : score < 0 ? -1 : 0)
      : 0;

    return {
      element,
      nameCount,
      suriCount,
      totalCount,
      baseScore: score,
      weightedScore: totalCount > 0 ? (score * totalCount) + bridgeBonus : 0,
    };
  });
}

function pickBestElement(stats: readonly ElementStats[], shen: ShenElements): ElementStats {
  const present = stats.filter(stat => stat.totalCount > 0);
  if (present.length === 0) {
    const fallback = stats.find(stat => stat.element === shen.yong);
    return fallback ?? stats[0];
  }

  const sorted = [...present].sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;
    if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
    return b.baseScore - a.baseScore;
  });

  return sorted[0];
}

function pickCautionElement(stats: readonly ElementStats[], shen: ShenElements): ElementStats {
  const gishinStat = stats.find(stat => stat.element === shen.gi);
  if (gishinStat && gishinStat.element !== shen.yong) {
    return gishinStat;
  }

  const present = stats.filter(stat => stat.totalCount > 0);
  if (present.length === 0) return stats[0];

  const sorted = [...present].sort((a, b) => {
    if (a.weightedScore !== b.weightedScore) return a.weightedScore - b.weightedScore;
    if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
    return a.baseScore - b.baseScore;
  });

  return sorted[0];
}

function overallAlignmentScore(stats: readonly ElementStats[], totalSlots: number): number {
  if (totalSlots <= 0) return 0;

  const totalWeighted = stats.reduce((sum, stat) => sum + (stat.baseScore * stat.totalCount), 0);
  const normalized = ((totalWeighted / (totalSlots * 4)) + 1) * 50;
  return clamp(Math.round(normalized), 0, 100);
}

export function generateNameElementSection(input: ReportInput): ReportSection | null {
  const nameElements = extractNameElements(input);
  const suriElements = extractSuriElements(input);

  // 이름(자원오행 + 수리오행) 데이터가 비어 있으면 이 섹션은 만들지 않습니다.
  if (nameElements.length === 0 && suriElements.length === 0) {
    return null;
  }

  const shen = extractShenElements(input);
  if (!shen) return null;

  const nameCounts = countElements(nameElements);
  const suriCounts = countElements(suriElements);
  const stats = buildStats(nameCounts, suriCounts, shen);

  const totalSlots = nameElements.length + suriElements.length;
  const alignment = overallAlignmentScore(stats, totalSlots);

  const best = pickBestElement(stats, shen);
  const caution = pickCautionElement(stats, shen);

  const targetName = safeName(input);

  const paragraphs: ReportParagraph[] = [
    {
      type: 'narrative',
      tone: 'neutral',
      text: `${targetName} 이름은 두 가지 오행으로 볼 수 있어요. ` +
        `글자 자체의 기운은 자원오행, 원형이정 수의 기운은 수리오행이에요.`,
    },
    {
      type: 'narrative',
      tone: 'neutral',
      text: `사주에서는 용신이 "가장 필요한 기운", 희신이 "용신을 도와주는 기운", ` +
        `기신이 "너무 많아지면 버거운 기운"이에요. 이 기준으로 이름을 쉽게 비교해볼게요.`,
    },
    {
      type: 'emphasis',
      tone: 'positive',
      element: best.element,
      text: `이번 이름에서는 ${ELEMENT_LABEL[best.element]}이(가) 가장 잘 맞아요. ` +
        `${relationLabel(best.element, shen)} 쪽이라 사주의 균형을 잡는 데 도움이 돼요.`,
    },
    {
      type: 'warning',
      tone: 'negative',
      element: caution.element,
      text: caution.totalCount > 0
        ? `주의 포인트는 ${ELEMENT_LABEL[caution.element]}이에요. ` +
          `자원 ${caution.nameCount}개, 수리 ${caution.suriCount}개가 보여서 ` +
          `생활 습관이나 색/환경에서 용신 쪽 기운을 조금 더 보강하면 좋아요.`
        : `주의 오행은 ${ELEMENT_LABEL[caution.element]}이에요. ` +
          `지금 이름에는 거의 없어서 큰 충돌은 적지만, 별명/추가 이름을 고를 때는 과해지지 않게 보면 좋아요.`,
    },
    {
      type: 'tip',
      tone: 'encouraging',
      element: shen.yong,
      text: `한 줄 요약: 자원오행은 "이름 글자의 성격", 수리오행은 "이름의 리듬"이에요. ` +
        `두 축이 함께 용신(${ELEMENT_LABEL[shen.yong]}) 쪽으로 모이면 이름의 안정감이 더 커져요.`,
    },
  ];

  const rows: string[][] = stats.map(stat => [
    ELEMENT_LABEL[stat.element],
    `${stat.nameCount}개`,
    `${stat.suriCount}개`,
    relationLabel(stat.element, shen),
    explainRow(stat, shen),
  ]);

  const tables: ReportTable[] = [
    {
      title: '자원오행/수리오행과 용신·희신·기신 관계',
      headers: ['오행', '자원오행', '수리오행', '기준', '쉽게 설명'],
      rows,
    },
  ];

  const distributionData: Record<string, number | string> = {
    [ELEMENT_LABEL.WOOD]: nameCounts.WOOD + suriCounts.WOOD,
    [ELEMENT_LABEL.FIRE]: nameCounts.FIRE + suriCounts.FIRE,
    [ELEMENT_LABEL.EARTH]: nameCounts.EARTH + suriCounts.EARTH,
    [ELEMENT_LABEL.METAL]: nameCounts.METAL + suriCounts.METAL,
    [ELEMENT_LABEL.WATER]: nameCounts.WATER + suriCounts.WATER,
  };

  const charts: ReportChart[] = [
    {
      type: 'bar',
      title: '이름 오행 분포(자원 + 수리)',
      data: distributionData,
      meta: {
        yongshin: ELEMENT_LABEL[shen.yong],
        heeshin: ELEMENT_LABEL[shen.hee],
        gishin: ELEMENT_LABEL[shen.gi],
      },
    },
    {
      type: 'gauge',
      title: '용신 정렬 점수',
      data: {
        '정렬 점수': alignment,
      },
      meta: {
        min: 0,
        max: 100,
        good: 70,
        caution: 40,
      },
    },
  ];

  const highlights: ReportHighlight[] = [
    {
      label: '가장 잘 맞는 오행',
      value: `${ELEMENT_LABEL[best.element]} (${relationLabel(best.element, shen)})`,
      element: best.element,
      sentiment: 'good',
    },
    {
      label: '주의 오행',
      value: caution.totalCount > 0
        ? `${ELEMENT_LABEL[caution.element]} ${caution.totalCount}개 (자원 ${caution.nameCount}, 수리 ${caution.suriCount})`
        : `${ELEMENT_LABEL[caution.element]} 0개 (현재 이름 충돌은 낮음)`,
      element: caution.element,
      sentiment: 'caution',
    },
    {
      label: '용신/희신/기신',
      value: `${ELEMENT_LABEL[shen.yong]} / ${ELEMENT_LABEL[shen.hee]} / ${ELEMENT_LABEL[shen.gi]}`,
      sentiment: 'neutral',
    },
    {
      label: '자원오행 요약',
      value: summarizeElements(nameElements),
      sentiment: 'neutral',
    },
    {
      label: '수리오행 요약',
      value: summarizeElements(suriElements),
      sentiment: 'neutral',
    },
  ];

  return {
    id: 'nameElement',
    title: '이름 오행 분석',
    subtitle: '자원오행/수리오행과 용신·희신·기신의 연결',
    paragraphs,
    tables,
    charts,
    highlights,
  };
}
