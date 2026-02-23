/**
 * part4-yongshin.ts -- 용신 우선순위/역할 해설 섹션
 *
 * PART 4: 사주 균형의 핵심인 용신 체계를 쉬운 말로 풀어냅니다.
 * - 핵심 역할표(용신/희신/기신/구신/한신)
 * - 오행 우선순위 점수 차트
 * - 일간/오행 분포/결핍 정보를 엮은 생활형 안내
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportChart,
  ReportHighlight,
  ElementCode,
} from '../types.js';

import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_GENERATED_BY,
  ELEMENT_GENERATES,
  ELEMENT_CONTROLLED_BY,
  elementCodeToKorean,
} from '../common/elementMaps.js';

import {
  createRng,
  narrative,
  positive,
  caution,
  tip,
  emphasis,
  encouraging,
  listJoin,
} from '../common/sentenceUtils.js';

const ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
const ELEMENT_SET = new Set<ElementCode>(ELEMENTS);

interface CoreRoles {
  yongshin: ElementCode | null;
  heeshin: ElementCode | null;
  gishin: ElementCode | null;
  gushin: ElementCode | null;
  hanshin: ElementCode | null;
}

const ROLE_MEANING: Record<keyof CoreRoles, string> = {
  yongshin: '지금 가장 필요한 중심 기운',
  heeshin: '용신이 잘 일하도록 도와주는 기운',
  gishin: '과하면 흐름을 막을 수 있어 조심할 기운',
  gushin: '기신을 더 세게 만들 수 있는 자극 기운',
  hanshin: '크게 해가 없고 배경처럼 작용하는 기운',
};

function safeName(input: ReportInput): string {
  return input.name?.trim() || '당신';
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePolarity(value: unknown): 'YANG' | 'YIN' | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toUpperCase();
  if (raw === 'YANG' || raw.includes('양') || raw.includes('陽')) return 'YANG';
  if (raw === 'YIN' || raw.includes('음') || raw.includes('陰')) return 'YIN';
  return null;
}

function normalizeElement(value: unknown): ElementCode | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (ELEMENT_SET.has(upper as ElementCode)) return upper as ElementCode;

  const compact = raw.replace(/\s+/g, '');
  if (compact.includes('목') || compact.includes('木')) return 'WOOD';
  if (compact.includes('화') || compact.includes('火')) return 'FIRE';
  if (compact.includes('토') || compact.includes('土')) return 'EARTH';
  if (compact.includes('금') || compact.includes('金')) return 'METAL';
  if (compact.includes('수') || compact.includes('水')) return 'WATER';
  return null;
}

function elFull(value: unknown): string {
  const el = normalizeElement(value);
  return el ? (ELEMENT_KOREAN[el] ?? el) : '미정';
}

function elShort(value: unknown): string {
  const el = normalizeElement(value);
  if (!el) return '미정';
  return elementCodeToKorean(el) || ELEMENT_KOREAN_SHORT[el] || el;
}

function createZeroScores(): Record<ElementCode, number> {
  return {
    WOOD: 0,
    FIRE: 0,
    EARTH: 0,
    METAL: 0,
    WATER: 0,
  };
}

function normalizeConfidence(value: unknown): number {
  const n = toFiniteNumber(value);
  if (n == null) return 1;
  if (n <= 1) return Math.max(0, Math.min(1, n));
  return Math.max(0, Math.min(1, n / 100));
}

function recommendationTypeWeight(type: unknown): number {
  if (typeof type !== 'string') return 1;
  const t = type.toUpperCase();
  if (t.includes('RANKING') || t.includes('순위')) return 1.2;
  if (t.includes('EOKBU') || t.includes('억부')) return 1.15;
  if (t.includes('JOHU') || t.includes('조후')) return 1.1;
  return 1;
}

function addScore(target: Record<ElementCode, number>, element: ElementCode, score: number): void {
  target[element] += Number.isFinite(score) ? score : 0;
}

function addScoresFromElementObject(
  target: Record<ElementCode, number>,
  raw: unknown,
  multiplier: number = 1,
): boolean {
  const obj = toRecord(raw);
  if (!obj) return false;

  let used = false;
  for (const [key, value] of Object.entries(obj)) {
    const element = normalizeElement(key);
    const score = toFiniteNumber(value);
    if (!element || score == null) continue;
    addScore(target, element, Math.max(0, score) * multiplier);
    used = true;
  }
  return used;
}

function addScoresFromRankingArray(
  target: Record<ElementCode, number>,
  raw: unknown,
  multiplier: number = 1,
): boolean {
  if (!Array.isArray(raw)) return false;

  let used = false;
  for (const item of raw) {
    const row = toRecord(item);
    if (!row) continue;

    const element = normalizeElement(
      row['element']
      ?? row['primaryElement']
      ?? row['code']
      ?? row['name']
      ?? row['targetElement'],
    );
    if (!element) continue;

    const confidence = normalizeConfidence(row['confidence']);
    const score = toFiniteNumber(row['score'] ?? row['weight'] ?? row['value'] ?? row['priorityScore']);
    const rank = toFiniteNumber(row['rank'] ?? row['priority'] ?? row['order'] ?? row['position']);

    if (score != null) {
      addScore(target, element, Math.max(0, score) * multiplier * confidence);
      used = true;
      continue;
    }
    if (rank != null && rank > 0) {
      addScore(target, element, Math.max(0, 120 - rank * 20) * multiplier * confidence);
      used = true;
      continue;
    }

    addScore(target, element, 8 * multiplier * confidence);
    used = true;
  }

  return used;
}

function addScoresFromRecommendations(
  target: Record<ElementCode, number>,
  input: ReportInput,
): boolean {
  const recommendations = input.saju.yongshin?.recommendations;
  if (!Array.isArray(recommendations) || recommendations.length === 0) return false;

  let used = false;
  for (const rec of recommendations) {
    const primary = normalizeElement(rec?.primaryElement);
    const secondary = normalizeElement(rec?.secondaryElement);
    const confidence = normalizeConfidence(rec?.confidence);
    const weight = recommendationTypeWeight(rec?.type);
    if (primary) {
      addScore(target, primary, 36 * confidence * weight);
      used = true;
    }
    if (secondary) {
      addScore(target, secondary, 18 * confidence * weight);
      used = true;
    }
  }

  return used;
}

function extractRankingScores(
  input: ReportInput,
  target: Record<ElementCode, number>,
): boolean {
  const sajuAny = input.saju as Record<string, unknown>;
  const yongAny = toRecord(input.saju.yongshin as unknown);

  let used = false;
  const objectCandidates: unknown[] = [
    sajuAny['yongshinRanking'],
    sajuAny['yongshinScores'],
    sajuAny['elementPriority'],
    sajuAny['elementPriorityScores'],
    sajuAny['elementRankings'],
    yongAny?.['ranking'],
    yongAny?.['scores'],
    yongAny?.['priority'],
    yongAny?.['elementScores'],
  ];

  for (const candidate of objectCandidates) {
    used = addScoresFromElementObject(target, candidate) || used;
    used = addScoresFromRankingArray(target, candidate) || used;
  }

  used = addScoresFromRecommendations(target, input) || used;
  return used;
}

function extractElementDistribution(input: ReportInput): Partial<Record<ElementCode, number>> {
  const result: Partial<Record<ElementCode, number>> = {};
  const raw = input.saju.elementDistribution as unknown;

  const pull = (value: unknown): void => {
    const obj = toRecord(value);
    if (!obj) return;
    for (const [key, count] of Object.entries(obj)) {
      const el = normalizeElement(key);
      const n = toFiniteNumber(count);
      if (!el || n == null) continue;
      result[el] = n;
    }
  };

  pull(raw);
  const root = toRecord(raw);
  if (root) {
    pull(root['total']);
    pull(root['heaven']);
    pull(root['hidden']);
    pull(root['overall']);
    pull(root['distribution']);
  }

  return result;
}

function distributionTotal(dist: Partial<Record<ElementCode, number>>): number {
  let total = 0;
  for (const el of ELEMENTS) total += Math.max(0, dist[el] ?? 0);
  return total;
}

function normalizeScoresTo100(raw: Record<ElementCode, number>): Record<ElementCode, number> {
  const normalized = createZeroScores();
  const values = ELEMENTS.map((el) => Math.max(0, raw[el]));
  const max = Math.max(...values);
  const min = Math.min(...values);

  if (max <= 0) {
    let base = 70;
    for (const el of ELEMENTS) {
      normalized[el] = base;
      base -= 10;
    }
    return normalized;
  }

  if (max === min) {
    for (const el of ELEMENTS) normalized[el] = 60;
    return normalized;
  }

  for (const el of ELEMENTS) {
    const v = Math.max(0, raw[el]);
    normalized[el] = Math.round(((v - min) / (max - min)) * 100);
  }
  return normalized;
}

function sortedByScore(scores: Record<ElementCode, number>): ElementCode[] {
  return [...ELEMENTS].sort((a, b) => scores[b] - scores[a]);
}

function pickRole(
  used: Set<ElementCode>,
  order: readonly ElementCode[],
  preferred: Array<ElementCode | null | undefined>,
  fromEnd: boolean = false,
): ElementCode | null {
  for (const el of preferred) {
    if (!el || used.has(el)) continue;
    used.add(el);
    return el;
  }

  const pool = fromEnd ? [...order].reverse() : [...order];
  for (const el of pool) {
    if (used.has(el)) continue;
    used.add(el);
    return el;
  }

  for (const el of preferred) {
    if (el) return el;
  }
  return null;
}

function seedRolesFromSaju(input: ReportInput): CoreRoles {
  const yong = normalizeElement(input.saju.yongshin?.element);
  const hee = normalizeElement(input.saju.yongshin?.heeshin) ?? (yong ? ELEMENT_GENERATED_BY[yong] : null);
  const gi = normalizeElement(input.saju.yongshin?.gishin) ?? (yong ? ELEMENT_CONTROLLED_BY[yong] : null);
  const gu = normalizeElement(input.saju.yongshin?.gushin) ?? (gi ? ELEMENT_GENERATED_BY[gi] : null);

  let han: ElementCode | null = null;
  if (yong) {
    const used = new Set<ElementCode>([yong]);
    if (hee) used.add(hee);
    if (gi) used.add(gi);
    if (gu) used.add(gu);
    han = ELEMENTS.find((el) => !used.has(el)) ?? ELEMENT_GENERATES[yong];
  }

  return { yongshin: yong, heeshin: hee, gishin: gi, gushin: gu, hanshin: han };
}

function resolveRoles(seed: CoreRoles, order: readonly ElementCode[]): CoreRoles {
  const used = new Set<ElementCode>();

  const yong = pickRole(used, order, [seed.yongshin, order[0]]);
  const hee = pickRole(
    used,
    order,
    [seed.heeshin, yong ? ELEMENT_GENERATED_BY[yong] : null, order[1]],
  );
  const gi = pickRole(
    used,
    order,
    [seed.gishin, yong ? ELEMENT_CONTROLLED_BY[yong] : null, order[order.length - 1]],
    true,
  );
  const gu = pickRole(
    used,
    order,
    [seed.gushin, gi ? ELEMENT_GENERATED_BY[gi] : null, order[order.length - 2]],
    true,
  );
  const han = pickRole(
    used,
    order,
    [seed.hanshin, yong ? ELEMENT_GENERATES[yong] : null, order[2]],
  );

  return { yongshin: yong, heeshin: hee, gishin: gi, gushin: gu, hanshin: han };
}

function toUniqueElements(values: readonly string[] | undefined): ElementCode[] {
  const out: ElementCode[] = [];
  for (const value of values ?? []) {
    const el = normalizeElement(value);
    if (!el || out.includes(el)) continue;
    out.push(el);
  }
  return out;
}

function roleTableRows(roles: CoreRoles): string[][] {
  const rows: Array<[keyof CoreRoles, string]> = [
    ['yongshin', '용신'],
    ['heeshin', '희신'],
    ['gishin', '기신'],
    ['gushin', '구신'],
    ['hanshin', '한신'],
  ];

  return rows.map(([key, label]) => [label, elFull(roles[key]), ROLE_MEANING[key]]);
}

export function generateYongshinSection(input: ReportInput): ReportSection | null {
  const rng = createRng(input);
  for (let i = 0; i < 18; i++) rng.next();

  const name = safeName(input);
  const dayMasterEl = normalizeElement(input.saju.dayMaster?.element);
  const dayMasterPolarity = normalizePolarity(input.saju.dayMaster?.polarity);
  const distribution = extractElementDistribution(input);
  const deficientElements = toUniqueElements(input.saju.deficientElements);
  const excessiveElements = toUniqueElements(input.saju.excessiveElements);

  const rawScores = createZeroScores();
  const hasRankingSignal = extractRankingScores(input, rawScores);
  for (const el of ELEMENTS) {
    const count = distribution[el];
    if (count != null && Number.isFinite(count) && count > 0) {
      rawScores[el] += count * 2;
    }
  }

  const seedRoles = seedRolesFromSaju(input);
  if (seedRoles.yongshin) rawScores[seedRoles.yongshin] += 55;
  if (seedRoles.heeshin) rawScores[seedRoles.heeshin] += 35;
  if (seedRoles.hanshin) rawScores[seedRoles.hanshin] += 20;
  if (seedRoles.gushin) rawScores[seedRoles.gushin] = Math.max(0, rawScores[seedRoles.gushin] - 20);
  if (seedRoles.gishin) rawScores[seedRoles.gishin] = Math.max(0, rawScores[seedRoles.gishin] - 35);

  const hasAnySignal = hasRankingSignal
    || !!seedRoles.yongshin
    || !!dayMasterEl
    || distributionTotal(distribution) > 0
    || deficientElements.length > 0
    || excessiveElements.length > 0;
  if (!hasAnySignal) return null;

  if (Object.values(rawScores).every((v) => v <= 0)) {
    if (dayMasterEl) {
      rawScores[ELEMENT_GENERATED_BY[dayMasterEl]] = 80;
      rawScores[dayMasterEl] = 55;
      rawScores[ELEMENT_GENERATES[dayMasterEl]] = 40;
      rawScores[ELEMENT_CONTROLLED_BY[dayMasterEl]] = 20;
      const last = ELEMENTS.find(
        (el) =>
          el !== ELEMENT_GENERATED_BY[dayMasterEl]
          && el !== dayMasterEl
          && el !== ELEMENT_GENERATES[dayMasterEl]
          && el !== ELEMENT_CONTROLLED_BY[dayMasterEl],
      );
      if (last) rawScores[last] = 10;
    } else {
      let base = 70;
      for (const el of ELEMENTS) {
        rawScores[el] = base;
        base -= 10;
      }
    }
  }

  const normalizedScores = normalizeScoresTo100(rawScores);
  const priorityOrder = sortedByScore(normalizedScores);
  const roles = resolveRoles(seedRoles, priorityOrder);

  const polarityText = dayMasterPolarity === 'YANG'
    ? '양(활동적이고 직선적인 쪽)'
    : dayMasterPolarity === 'YIN'
      ? '음(차분하고 섬세한 쪽)'
      : '음양 정보';

  const top1 = priorityOrder[0];
  const top2 = priorityOrder[1];
  const low1 = priorityOrder[priorityOrder.length - 1];

  const paragraphs: ReportParagraph[] = [];
  const introTemplates = [
    `${name}님의 사주에서 "용신"은 몸과 마음의 균형을 잡아주는 핵심 버튼이에요. 어렵게 보지 말고, 내 컨디션을 맞추는 사용 설명서라고 생각하면 쉬워요.`,
    `용신은 사주를 더 편안하게 만드는 중심 기운이에요. ${name}님에게 어떤 오행이 힘이 되는지, 그리고 어떤 기운을 조심하면 좋은지 쉽게 정리해볼게요.`,
    `사주에서 용신은 "지금 나에게 가장 필요한 에너지"에 가까워요. ${name}님 맞춤형 우선순위를 표와 차트로 한눈에 볼 수 있게 만들었어요.`,
  ];
  paragraphs.push(narrative(rng.pick(introTemplates)));

  if (dayMasterEl) {
    paragraphs.push(emphasis(
      `${name}님의 일간은 ${elFull(dayMasterEl)}이고, 성향은 ${polarityText}에 가까워요. ` +
      `이 기본 기운을 기준으로 용신 우선순위를 읽으면 훨씬 이해가 쉬워져요.`,
      dayMasterEl,
    ));
  } else {
    paragraphs.push(tip(
      '일간 정보가 비어 있어서, 용신 정보와 오행 분포 데이터를 중심으로 우선순위를 계산했어요.',
    ));
  }

  if (hasRankingSignal) {
    paragraphs.push(positive(
      `용신 순위 데이터를 반영했을 때 우선 보강할 오행은 ${elFull(top1)}이고, 다음은 ${elFull(top2)}예요. ` +
      `반대로 ${elFull(low1)} 기운은 과하게 끌어올리기보다 균형을 보면서 쓰는 편이 좋아요.`,
      roles.yongshin ?? undefined,
    ));
  } else {
    paragraphs.push(narrative(
      `세부 순위 데이터가 많지 않아도 괜찮아요. 기본 용신 구조와 오행 분포를 함께 써서 ` +
      `${elFull(top1)} -> ${elFull(top2)} 순서로 실천 우선순위를 안전하게 잡았어요.`,
    ));
  }

  const distTotal = distributionTotal(distribution);
  if (distTotal > 0) {
    const dominant = ELEMENTS
      .map((el) => ({ el, value: distribution[el] ?? 0 }))
      .sort((a, b) => b.value - a.value);
    const topDist = dominant[0];
    const lowDist = dominant[dominant.length - 1];
    const topPct = Math.round(((topDist?.value ?? 0) / distTotal) * 100);
    const lowPct = Math.round(((lowDist?.value ?? 0) / distTotal) * 100);
    paragraphs.push(narrative(
      `현재 오행 분포를 보면 ${elFull(topDist?.el)} 쪽이 상대적으로 많고(약 ${topPct}%), ` +
      `${elFull(lowDist?.el)} 쪽이 약한 편(약 ${lowPct}%)이에요. 이 차이를 용신 우선순위와 같이 보면 실천 방향이 더 선명해져요.`,
      roles.yongshin ?? undefined,
    ));
  }

  if (deficientElements.length > 0 || excessiveElements.length > 0) {
    const parts: string[] = [];
    if (deficientElements.length > 0) {
      parts.push(`부족: ${listJoin(deficientElements.map((el) => elShort(el)))}`);
    }
    if (excessiveElements.length > 0) {
      parts.push(`과다: ${listJoin(excessiveElements.map((el) => elShort(el)))}`);
    }
    paragraphs.push(tip(`오행 상태 참고 메모 -> ${parts.join(' / ')}. 용신 우선순위는 이 상태를 보정하는 데 특히 유용해요.`));
  }

  if (roles.yongshin || roles.heeshin || roles.gishin) {
    const coreParts: string[] = [];
    if (roles.yongshin) coreParts.push(`용신 ${elShort(roles.yongshin)}은 자주 채우기`);
    if (roles.heeshin) coreParts.push(`희신 ${elShort(roles.heeshin)}은 보조 연료로 활용`);
    if (roles.gishin) coreParts.push(`기신 ${elShort(roles.gishin)}은 과도한 자극 피하기`);
    paragraphs.push(encouraging(`실천 핵심은 간단해요. ${coreParts.join(', ')}. 작은 습관부터 시작하면 체감이 빨라요.`));
  }

  if (roles.gishin || roles.gushin) {
    const cautionParts: string[] = [];
    if (roles.gishin) cautionParts.push(`기신 ${elShort(roles.gishin)}`);
    if (roles.gushin) cautionParts.push(`구신 ${elShort(roles.gushin)}`);
    paragraphs.push(caution(
      `${cautionParts.join(', ')} 기운은 "나쁘다"라기보다 과하면 균형이 깨지기 쉬운 영역이에요. ` +
      '완전히 막기보다 강약을 조절하는 방식으로 다루면 훨씬 안정적이에요.',
      roles.gishin ?? roles.gushin ?? undefined,
    ));
  }

  const tables: ReportTable[] = [
    {
      title: '용신 핵심 역할표',
      headers: ['역할', '오행', '쉬운 뜻'],
      rows: roleTableRows(roles),
    },
  ];

  const chartData: Record<string, number | string> = {};
  for (const el of ELEMENTS) {
    chartData[elShort(el)] = normalizedScores[el];
  }

  const charts: ReportChart[] = [
    {
      type: 'bar',
      title: '오행 우선순위 점수 (0~100)',
      data: chartData,
      meta: {
        order: priorityOrder.map((el) => elShort(el)),
        source: hasRankingSignal ? 'ranking+fallback' : 'fallback',
        note: '점수가 높을수록 우선 보강 권장',
      },
    },
  ];

  const highlights: ReportHighlight[] = [];
  if (roles.yongshin) {
    highlights.push({
      label: '핵심 용신',
      value: elFull(roles.yongshin),
      element: roles.yongshin,
      sentiment: 'good',
    });
  } else {
    highlights.push({
      label: '우선 보강 오행',
      value: elFull(top1),
      element: top1,
      sentiment: 'good',
    });
  }

  if (roles.heeshin) {
    highlights.push({
      label: '보조 희신',
      value: elFull(roles.heeshin),
      element: roles.heeshin,
      sentiment: 'good',
    });
  }

  if (roles.gishin) {
    highlights.push({
      label: '주의 기신',
      value: elFull(roles.gishin),
      element: roles.gishin,
      sentiment: 'caution',
    });
  }

  if (deficientElements.length > 0) {
    highlights.push({
      label: '결핍 보완 포인트',
      value: listJoin(deficientElements.map((el) => elShort(el))),
      element: deficientElements[0],
      sentiment: 'caution',
    });
  }

  return {
    id: 'yongshin',
    title: '용신(用神) 핵심 가이드',
    subtitle: '내 사주 균형을 잡는 오행 우선순위',
    paragraphs,
    tables,
    charts,
    highlights: highlights.length > 0 ? highlights : undefined,
  };
}

