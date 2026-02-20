/**
 * part11-health.ts
 *
 * PART 11: 건강 예방 루틴 섹션
 * - 오행 균형/결핍/과다 관점의 생활 가이드
 * - 예방 중심 루틴만 제안 (의료 진단/치료 아님)
 */

import type {
  ElementCode,
  ReportHighlight,
  ReportInput,
  ReportParagraph,
  ReportSection,
  ReportTable,
} from '../types.js';

import { ELEMENT_KOREAN } from '../common/elementMaps.js';
import {
  caution,
  createRng,
  emphasis,
  encouraging,
  narrative,
  tip,
} from '../common/sentenceUtils.js';

const ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

const IDEAL_PERCENT = 20;
const DEFICIENT_THRESHOLD = 14;
const EXCESSIVE_THRESHOLD = 26;

type BalanceState = '균형' | '결핍' | '과다';
type DistributionSource = 'saju' | 'springNormalized' | 'fallback';

interface ElementScore {
  readonly code: ElementCode;
  readonly value: number;
  readonly percent: number;
  readonly percentText: string;
}

interface DistributionResult {
  readonly values: Record<ElementCode, number>;
  readonly source: DistributionSource;
}

const DEFICIENT_TIPS: Record<ElementCode, string> = {
  WOOD: '아침 햇빛 10분 + 가벼운 스트레칭으로 몸을 천천히 깨우고, 초록 채소를 한 끼에 꼭 넣어주세요.',
  FIRE: '늦은 카페인을 줄이고 취침 시간을 고정해 주세요. 가벼운 유산소로 몸 온도를 부드럽게 올리면 좋아요.',
  EARTH: '식사 시간을 일정하게 맞추고, 따뜻한 음식 위주로 천천히 먹는 습관을 유지해 주세요.',
  METAL: '짧은 호흡 정리(코로 4초 들이마시고 6초 내쉬기)를 하루 3번 해보세요. 건조한 환경은 피해주세요.',
  WATER: '수분을 나눠서 자주 마시고, 밤에는 화면 노출을 줄여 깊은 휴식 시간을 확보해 주세요.',
};

const EXCESSIVE_TIPS: Record<ElementCode, string> = {
  WOOD: '일정을 빽빽하게 채우기보다 우선순위 2개만 남기고, 저녁엔 긴장 푸는 루틴을 먼저 잡아주세요.',
  FIRE: '자극적인 음식과 야식을 줄이고, 저녁에는 조도를 낮춰 몸의 흥분도를 천천히 내려주세요.',
  EARTH: '과식/야식 빈도를 줄이고, 식후 15~20분 산책으로 몸의 무거움을 가볍게 풀어주세요.',
  METAL: '완벽하게 하려는 압박을 조금 덜고, 50분 집중 후 10분 이완 루틴으로 긴장을 비워주세요.',
  WATER: '늦은 낮잠과 밤샘 리듬을 줄이고, 아침 기상 시간을 일정하게 유지해 생활 템포를 맞춰주세요.',
};

const BALANCED_TIPS: Record<ElementCode, string> = {
  WOOD: '지금의 활동성과 회복 루틴 균형이 좋아요. 주 3회 가벼운 전신 스트레칭을 계속 유지해 주세요.',
  FIRE: '수면-활동 리듬이 비교적 안정적이에요. 무리한 고강도보다 꾸준한 중강도 운동을 추천해요.',
  EARTH: '식사와 휴식의 리듬이 좋은 편이에요. 규칙적인 식사 간격만 유지해도 컨디션이 안정됩니다.',
  METAL: '정리와 집중 밸런스가 좋아요. 짧은 호흡 루틴만 더하면 피로 누적을 잘 막을 수 있어요.',
  WATER: '회복 감각이 안정적이에요. 수분 보충과 취침 전 루틴을 계속 지키면 컨디션 유지에 도움이 됩니다.',
};

const INTRO_TEMPLATES: readonly string[] = [
  '어렵게 보지 말고, 오늘 바로 실천할 수 있는 루틴만 뽑아서 볼게요.',
  '무리한 변화보다 작고 꾸준한 변화가 더 오래 갑니다.',
  '결핍은 채우고, 과다는 덜고, 균형은 유지하는 방식으로 정리해드릴게요.',
];

const CLOSING_TEMPLATES: readonly string[] = [
  '한 번에 전부 바꾸기보다, 이번 주는 한 가지 루틴만 꾸준히 지켜보세요.',
  '좋은 루틴은 강도보다 지속이 중요해요. 오늘부터 가볍게 시작해 보세요.',
  '몸이 편해지는 방향으로 조금씩 조절하면, 오행 균형도 자연스럽게 맞춰집니다.',
];

function safeName(input: ReportInput): string {
  const trimmed = input.name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : '당신';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function isElementCode(value: unknown): value is ElementCode {
  return typeof value === 'string' && (ELEMENTS as readonly string[]).includes(value);
}

function normalizeElementCode(value: unknown): ElementCode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return isElementCode(normalized) ? normalized : null;
}

function normalizeElementList(raw: unknown): ElementCode[] {
  if (!Array.isArray(raw)) return [];
  const out: ElementCode[] = [];

  for (const item of raw) {
    const code = normalizeElementCode(item);
    if (code && !out.includes(code)) {
      out.push(code);
    }
  }
  return out;
}

function createEmptyDistribution(): Record<ElementCode, number> {
  return {
    WOOD: 0,
    FIRE: 0,
    EARTH: 0,
    METAL: 0,
    WATER: 0,
  };
}

function sumDistribution(values: Record<ElementCode, number>): number {
  return ELEMENTS.reduce((sum, el) => sum + values[el], 0);
}

function readDistribution(value: unknown): Record<ElementCode, number> {
  const record = asRecord(value);
  const out = createEmptyDistribution();
  if (!record) return out;

  for (const element of ELEMENTS) {
    const raw = record[element];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      out[element] = Math.max(0, raw);
    }
  }
  return out;
}

function extractDistribution(input: ReportInput): DistributionResult {
  const sajuDistribution = asRecord(input.saju.elementDistribution);
  if (sajuDistribution) {
    const total = readDistribution(sajuDistribution['total']);
    if (sumDistribution(total) > 0) {
      return { values: total, source: 'saju' };
    }

    const flat = readDistribution(sajuDistribution);
    if (sumDistribution(flat) > 0) {
      return { values: flat, source: 'saju' };
    }

    const heaven = readDistribution(sajuDistribution['heaven']);
    const hidden = readDistribution(sajuDistribution['hidden']);
    const merged = createEmptyDistribution();

    for (const element of ELEMENTS) {
      merged[element] = heaven[element] + hidden[element];
    }
    if (sumDistribution(merged) > 0) {
      return { values: merged, source: 'saju' };
    }
  }

  const spring = asRecord(input.spring);
  const rules = asRecord(spring?.['rules']);
  const facts = asRecord(rules?.['facts']);
  const elements = asRecord(facts?.['elements']);
  const normalized = readDistribution(elements?.['normalized']);
  if (sumDistribution(normalized) > 0) {
    return { values: normalized, source: 'springNormalized' };
  }

  const fallback = createEmptyDistribution();
  for (const element of ELEMENTS) fallback[element] = 1;
  return { values: fallback, source: 'fallback' };
}

function toScores(values: Record<ElementCode, number>): ElementScore[] {
  const total = sumDistribution(values);
  const safeTotal = total > 0 ? total : ELEMENTS.length;

  return ELEMENTS.map(code => {
    const value = total > 0 ? values[code] : 1;
    const percent = Math.round((value / safeTotal) * 1000) / 10;

    return {
      code,
      value,
      percent,
      percentText: `${percent.toFixed(1)}%`,
    };
  });
}

function createScoreMap(scores: readonly ElementScore[]): Record<ElementCode, ElementScore> {
  const map = {} as Record<ElementCode, ElementScore>;
  for (const score of scores) {
    map[score.code] = score;
  }

  for (const element of ELEMENTS) {
    if (!map[element]) {
      map[element] = {
        code: element,
        value: 0,
        percent: 0,
        percentText: '0.0%',
      };
    }
  }
  return map;
}

function inferState(percent: number): BalanceState {
  if (percent < DEFICIENT_THRESHOLD) return '결핍';
  if (percent > EXCESSIVE_THRESHOLD) return '과다';
  return '균형';
}

function resolveStates(
  scores: readonly ElementScore[],
  declaredDeficient: readonly ElementCode[],
  declaredExcessive: readonly ElementCode[],
  scoreMap: Record<ElementCode, ElementScore>,
): Record<ElementCode, BalanceState> {
  const states = {} as Record<ElementCode, BalanceState>;
  for (const score of scores) {
    states[score.code] = inferState(score.percent);
  }

  const deficientSet = new Set<ElementCode>(declaredDeficient);
  const excessiveSet = new Set<ElementCode>(declaredExcessive);

  for (const element of ELEMENTS) {
    const inDeficient = deficientSet.has(element);
    const inExcessive = excessiveSet.has(element);

    if (inDeficient && inExcessive) {
      states[element] = scoreMap[element].percent >= IDEAL_PERCENT ? '과다' : '결핍';
    } else if (inDeficient) {
      states[element] = '결핍';
    } else if (inExcessive) {
      states[element] = '과다';
    }
  }

  return states;
}

function elementName(code: ElementCode): string {
  return ELEMENT_KOREAN[code] ?? code;
}

function sourceText(source: DistributionSource): string {
  if (source === 'saju') return '사주 오행 분포';
  if (source === 'springNormalized') return '정규화된 오행 분포';
  return '기본 균형값';
}

function tipForState(code: ElementCode, state: BalanceState): string {
  if (state === '결핍') return DEFICIENT_TIPS[code];
  if (state === '과다') return EXCESSIVE_TIPS[code];
  return BALANCED_TIPS[code];
}

function pickDeficientLead(
  states: Record<ElementCode, BalanceState>,
  scoreMap: Record<ElementCode, ElementScore>,
): ElementCode {
  const sorted = [...ELEMENTS].sort((a, b) => scoreMap[a].percent - scoreMap[b].percent);
  const explicit = sorted.find(element => states[element] === '결핍');
  return explicit ?? sorted[0] ?? 'EARTH';
}

function pickExcessiveLead(
  states: Record<ElementCode, BalanceState>,
  scoreMap: Record<ElementCode, ElementScore>,
): ElementCode {
  const sorted = [...ELEMENTS].sort((a, b) => scoreMap[b].percent - scoreMap[a].percent);
  const explicit = sorted.find(element => states[element] === '과다');
  return explicit ?? sorted[0] ?? 'EARTH';
}

function pickBalancedLead(
  states: Record<ElementCode, BalanceState>,
  scoreMap: Record<ElementCode, ElementScore>,
): ElementCode {
  const sorted = [...ELEMENTS].sort(
    (a, b) =>
      Math.abs(scoreMap[a].percent - IDEAL_PERCENT) -
      Math.abs(scoreMap[b].percent - IDEAL_PERCENT),
  );
  const explicit = sorted.find(element => states[element] === '균형');
  return explicit ?? sorted[0] ?? 'EARTH';
}

function listElementNames(elements: readonly ElementCode[]): string {
  return elements.length > 0 ? elements.map(elementName).join(', ') : '없음';
}

export function generateHealthSection(input: ReportInput): ReportSection | null {
  try {
    const rng = createRng(input);
    for (let i = 0; i < 44; i++) rng.next();

    const name = safeName(input);
    const distribution = extractDistribution(input);
    const scores = toScores(distribution.values);
    const scoreMap = createScoreMap(scores);

    const declaredDeficient = normalizeElementList(input.saju.deficientElements);
    const declaredExcessive = normalizeElementList(input.saju.excessiveElements);
    const states = resolveStates(scores, declaredDeficient, declaredExcessive, scoreMap);

    const sortedScores = [...scores].sort((a, b) => b.percent - a.percent);
    const deficientElements = ELEMENTS
      .filter(element => states[element] === '결핍')
      .sort((a, b) => scoreMap[a].percent - scoreMap[b].percent);
    const excessiveElements = ELEMENTS
      .filter(element => states[element] === '과다')
      .sort((a, b) => scoreMap[b].percent - scoreMap[a].percent);
    const balancedElements = ELEMENTS
      .filter(element => states[element] === '균형')
      .sort(
        (a, b) =>
          Math.abs(scoreMap[a].percent - IDEAL_PERCENT) -
          Math.abs(scoreMap[b].percent - IDEAL_PERCENT),
      );

    const leadDeficient = pickDeficientLead(states, scoreMap);
    const leadExcessive = pickExcessiveLead(states, scoreMap);
    const leadBalanced = pickBalancedLead(states, scoreMap);

    const paragraphs: ReportParagraph[] = [];
    paragraphs.push(
      narrative(
        `${name}님의 건강 관리를 오행 기준으로 가볍게 정리해드릴게요. ${rng.pick(INTRO_TEMPLATES)}`,
      ),
    );
    paragraphs.push(
      emphasis(
        `현재 상태는 균형 ${balancedElements.length}개, 결핍 ${deficientElements.length}개, 과다 ${excessiveElements.length}개예요. `
          + '결핍은 채우고, 과다는 덜고, 균형은 유지하는 방식으로 접근하면 부담이 적어요.',
      ),
    );
    paragraphs.push(
      tip(
        `실천 순서는 ${elementName(leadDeficient)} 보완 → ${elementName(leadExcessive)} 조절 → ${elementName(leadBalanced)} 유지가 좋아요. `
          + '하루에 하나씩만 적용해도 충분합니다.',
      ),
    );
    paragraphs.push(
      narrative(`분석 기준: ${sourceText(distribution.source)}.`),
    );

    if (distribution.source === 'fallback') {
      paragraphs.push(
        caution(
          '오행 분포 원본 수치를 충분히 찾지 못해 기본 균형값으로 안내했어요. 컨디션에 맞게 강도를 조절해 주세요.',
        ),
      );
    }

    paragraphs.push(
      caution(
        '이 내용은 예방 중심의 생활 가이드이며, 의료 진단이나 치료를 대신하지 않습니다.',
      ),
    );
    paragraphs.push(encouraging(rng.pick(CLOSING_TEMPLATES)));

    const table: ReportTable = {
      title: '오행 상태별 예방 생활 루틴',
      headers: ['오행', '비중', '상태', '예방 루틴 팁'],
      rows: sortedScores.map(score => {
        const state = states[score.code];
        return [
          elementName(score.code),
          score.percentText,
          state,
          tipForState(score.code, state),
        ];
      }),
    };

    const highlights: ReportHighlight[] = [
      {
        label: '균형 포인트',
        value: `${elementName(leadBalanced)} (${scoreMap[leadBalanced].percentText})`,
        element: leadBalanced,
        sentiment: 'good',
      },
      {
        label: '보완 우선',
        value: `${elementName(leadDeficient)} (${scoreMap[leadDeficient].percentText})`,
        element: leadDeficient,
        sentiment: deficientElements.length > 0 ? 'caution' : 'neutral',
      },
      {
        label: '조절 우선',
        value: `${elementName(leadExcessive)} (${scoreMap[leadExcessive].percentText})`,
        element: leadExcessive,
        sentiment: excessiveElements.length > 0 ? 'caution' : 'neutral',
      },
      {
        label: '입력 상태 요약',
        value: `결핍 ${listElementNames(declaredDeficient)} / 과다 ${listElementNames(declaredExcessive)}`,
        sentiment: 'neutral',
      },
    ];

    return {
      id: 'health',
      title: '건강 예방 루틴 가이드',
      subtitle: '오행 균형·결핍·과다 기준 생활 관리',
      paragraphs,
      tables: [table],
      highlights,
    };
  } catch {
    return null;
  }
}
