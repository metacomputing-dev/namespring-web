/**
 * part10-elementLifestyle.ts
 *
 * PART 10-1: 오행 균형을 일상 루틴으로 번역하는 생활 가이드
 * - 결핍/과다 + 분포 강약을 함께 반영
 * - 아이도 이해하기 쉬운 문장으로 실천 항목 제시
 * - 수면/식습관/학습·일습관/운동·환경 4개 카테고리 고정 포함
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

import {
  ELEMENT_COLOR,
  ELEMENT_DIRECTION,
  ELEMENT_FOOD,
  ELEMENT_HOBBY,
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
} from '../common/elementMaps.js';

import {
  caution,
  createRng,
  emphasis,
  encouraging,
  narrative,
  tip,
} from '../common/sentenceUtils.js';

const ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

type ElementState = 'deficient' | 'excessive' | 'strong' | 'weak' | 'balanced';
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

interface LifestyleAdvice {
  readonly sleep: string;
  readonly diet: string;
  readonly studyWork: string;
  readonly exerciseEnv: string;
}

const STATE_LABEL: Record<ElementState, string> = {
  deficient: '결핍(보강 필요)',
  excessive: '과다(조절 필요)',
  strong: '강점(주도)',
  weak: '약점(보완)',
  balanced: '균형(유지)',
};

const DEFICIENT_ADVICE: Record<ElementCode, LifestyleAdvice> = {
  WOOD: {
    sleep: '밤 10시 전 취침, 아침 햇빛 10분 받기.',
    diet: '초록 채소 한 주먹을 매일 먹기.',
    studyWork: '할 일 3칸 체크리스트로 시작 버튼 누르기.',
    exerciseEnv: '가벼운 스트레칭 10분 + 책상에 초록 소품 두기.',
  },
  FIRE: {
    sleep: '기상 시간을 고정하고 낮잠은 20분 이내.',
    diet: '따뜻한 국물과 붉은 채소를 하루 1회 챙기기.',
    studyWork: '소리 내어 읽기 10분으로 집중 스위치 켜기.',
    exerciseEnv: '줄넘기/점프 10~15분, 방 조명은 너무 어둡지 않게.',
  },
  EARTH: {
    sleep: '매일 같은 시간에 자고 일어나기.',
    diet: '세 끼 시간을 일정하게, 노란 곡물·뿌리채소 보강.',
    studyWork: '자리 정리 5분 후 25분 집중 블록 시작.',
    exerciseEnv: '걷기 20분과 균형 운동, 주변을 안정적으로 정돈.',
  },
  METAL: {
    sleep: '잠들기 전 정리 5분으로 마음을 가볍게 만들기.',
    diet: '무·배·양파 같은 맑은 식재료를 자주 넣기.',
    studyWork: '폴더 3개(해야 할 일/진행 중/완료)로 분류 습관 만들기.',
    exerciseEnv: '호흡 운동 5분 + 가슴 펴기 스트레칭.',
  },
  WATER: {
    sleep: '취침 30분 전 화면 끄고 조용한 루틴 만들기.',
    diet: '검은콩·해조류·충분한 물로 수분 저금통 채우기.',
    studyWork: '20분 깊은 집중 후 5분 휴식, 조용한 자리 확보.',
    exerciseEnv: '하체를 따뜻하게 하고 천천히 걷기·수영 선택.',
  },
};

const EXCESSIVE_ADVICE: Record<ElementCode, LifestyleAdvice> = {
  WOOD: {
    sleep: '잠들기 1시간 전 게임/영상 멈추고 호흡 4회.',
    diet: '자극적인 맛은 줄이고 따뜻한 곡물 비율 늘리기.',
    studyWork: '한 번에 한 과제만, 중간 점검 알람 1회 넣기.',
    exerciseEnv: '승부형 운동 대신 산책·요가로 속도 낮추기.',
  },
  FIRE: {
    sleep: '늦은 취침을 피하고 저녁 카페인은 쉬기.',
    diet: '맵고 튀긴 음식은 줄이고 수분 많은 과일 보강.',
    studyWork: '25분 집중 + 5분 진정 호흡으로 열감 조절.',
    exerciseEnv: '늦은 밤 고강도 운동 대신 저녁 산책.',
  },
  EARTH: {
    sleep: '과잠을 피하고 기상 알람은 한 번에 일어나기.',
    diet: '단 음식/밀가루 줄이고 채소·단백질 균형 맞추기.',
    studyWork: '미루기 방지용 10분 스타트 타이머 사용.',
    exerciseEnv: '식후 15분 걷기, 환기를 자주 해서 답답함 빼기.',
  },
  METAL: {
    sleep: '완벽하게 끝내려는 생각은 잠시 내려두고 메모 3줄.',
    diet: '건조한 간식은 줄이고 물·수분 식품 늘리기.',
    studyWork: '정답 100점보다 “먼저 제출” 원칙 연습.',
    exerciseEnv: '강한 근력운동만 고집하지 말고 부드러운 스트레칭 추가.',
  },
  WATER: {
    sleep: '아침 햇빛으로 몸을 깨우고 기상 후 바로 스트레칭.',
    diet: '찬 음식은 줄이고 따뜻한 단백질·국물 중심.',
    studyWork: '생각만 길어질 때는 5분 실행 규칙 적용.',
    exerciseEnv: '습한 공간은 줄이고 밝고 건조한 자리 유지.',
  },
};

const BALANCED_ADVICE: Record<ElementCode, LifestyleAdvice> = {
  WOOD: {
    sleep: '주중·주말 취침 시간 차이를 1시간 이내로 유지.',
    diet: '초록 채소를 매일 한 번 이상 유지.',
    studyWork: '하루 목표 1개를 정하고 끝까지 마무리.',
    exerciseEnv: '가벼운 유산소와 스트레칭을 번갈아 하기.',
  },
  FIRE: {
    sleep: '아침 기상 시간을 고정해 리듬 유지.',
    diet: '따뜻한 음식과 수분을 균형 있게 챙기기.',
    studyWork: '발표/질문 시간을 짧게라도 꾸준히 확보.',
    exerciseEnv: '활동량은 유지하되 밤에는 강도를 낮추기.',
  },
  EARTH: {
    sleep: '매일 같은 수면 루틴으로 안정감 유지.',
    diet: '정해진 식사 시간과 천천히 먹는 습관 유지.',
    studyWork: '정리 5분 + 집중 25분 루틴 반복.',
    exerciseEnv: '걷기와 코어 운동을 규칙적으로 유지.',
  },
  METAL: {
    sleep: '잠들기 전 정리 루틴을 짧게 유지.',
    diet: '맑은 국물/채소를 꾸준히 섭취.',
    studyWork: '파일·노트 분류 체계를 매일 조금씩 관리.',
    exerciseEnv: '호흡과 자세 교정을 함께 챙기기.',
  },
  WATER: {
    sleep: '취침 전 화면을 줄이고 차분한 루틴 유지.',
    diet: '수분 섭취량을 꾸준히 체크.',
    studyWork: '깊은 집중 시간대를 고정해 사용.',
    exerciseEnv: '과로하지 않는 저강도 운동을 꾸준히 지속.',
  },
};

function safeName(input: ReportInput): string {
  return input.name?.trim() || '우리 아이';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function isElementCode(value: unknown): value is ElementCode {
  return typeof value === 'string' && (ELEMENTS as readonly string[]).includes(value);
}

function createEmptyDistribution(): Record<ElementCode, number> {
  return { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
}

function distributionSum(values: Record<ElementCode, number>): number {
  return ELEMENTS.reduce((sum, el) => sum + values[el], 0);
}

function readDistribution(value: unknown): Record<ElementCode, number> {
  const source = asRecord(value);
  const result = createEmptyDistribution();
  if (!source) return result;

  for (const el of ELEMENTS) {
    const raw = source[el];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      result[el] = Math.max(0, raw);
    }
  }
  return result;
}

function extractDistribution(input: ReportInput): DistributionResult {
  const sajuRaw = asRecord(input.saju.elementDistribution);
  if (sajuRaw) {
    const totalLayer = readDistribution(sajuRaw['total']);
    if (distributionSum(totalLayer) > 0) {
      return { values: totalLayer, source: 'saju' };
    }

    const flat = readDistribution(sajuRaw);
    if (distributionSum(flat) > 0) {
      return { values: flat, source: 'saju' };
    }

    const heaven = readDistribution(sajuRaw['heaven']);
    const hidden = readDistribution(sajuRaw['hidden']);
    const merged = createEmptyDistribution();
    for (const el of ELEMENTS) {
      merged[el] = heaven[el] + hidden[el];
    }
    if (distributionSum(merged) > 0) {
      return { values: merged, source: 'saju' };
    }
  }

  const spring = asRecord(input.spring);
  const rules = asRecord(spring?.['rules']);
  const facts = asRecord(rules?.['facts']);
  const elements = asRecord(facts?.['elements']);
  const normalized = readDistribution(elements?.['normalized']);
  if (distributionSum(normalized) > 0) {
    return { values: normalized, source: 'springNormalized' };
  }

  const fallback = createEmptyDistribution();
  for (const el of ELEMENTS) fallback[el] = 1;
  return { values: fallback, source: 'fallback' };
}

function toScores(values: Record<ElementCode, number>): ElementScore[] {
  const total = distributionSum(values);
  const safeTotal = total > 0 ? total : ELEMENTS.length;

  return ELEMENTS.map(code => {
    const value = total > 0 ? values[code] : 1;
    const percent = Math.round(((value / safeTotal) * 1000)) / 10;
    return {
      code,
      value,
      percent,
      percentText: `${percent.toFixed(1)}%`,
    };
  });
}

function normalizeElementList(raw: unknown): ElementCode[] {
  if (!Array.isArray(raw)) return [];
  const out: ElementCode[] = [];
  for (const item of raw) {
    if (isElementCode(item) && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

function elFull(code: ElementCode): string {
  return ELEMENT_KOREAN[code] ?? code;
}

function elShort(code: ElementCode): string {
  return ELEMENT_KOREAN_SHORT[code] ?? code;
}

function pickStrongest(scores: ElementScore[], excessive: ElementCode[]): ElementCode {
  if (excessive.length > 0) return excessive[0];
  const sorted = [...scores].sort((a, b) => b.value - a.value);
  return sorted[0]?.code ?? 'EARTH';
}

function pickWeakest(scores: ElementScore[], deficient: ElementCode[], strongest: ElementCode): ElementCode {
  if (deficient.length > 0) return deficient[0];
  const sorted = [...scores].sort((a, b) => a.value - b.value);
  const first = sorted[0]?.code ?? 'EARTH';
  if (first !== strongest) return first;
  return sorted[1]?.code ?? first;
}

function stateForElement(
  code: ElementCode,
  strongest: ElementCode,
  weakest: ElementCode,
  deficientSet: Set<ElementCode>,
  excessiveSet: Set<ElementCode>,
): ElementState {
  if (deficientSet.has(code)) return 'deficient';
  if (excessiveSet.has(code)) return 'excessive';
  if (code === strongest) return 'strong';
  if (code === weakest) return 'weak';
  return 'balanced';
}

function adviceFor(code: ElementCode, state: ElementState): LifestyleAdvice {
  if (state === 'deficient' || state === 'weak') return DEFICIENT_ADVICE[code];
  if (state === 'excessive') return EXCESSIVE_ADVICE[code];
  if (state === 'strong') {
    const base = BALANCED_ADVICE[code];
    return {
      sleep: `${base.sleep} 밤에는 10분 진정 시간을 넣어 과열을 막기.`,
      diet: `${base.diet} 자극적인 음식은 연속으로 먹지 않기.`,
      studyWork: `${base.studyWork} 속도만 보지 말고 마무리 정확도 확인.`,
      exerciseEnv: `${base.exerciseEnv} 운동 강도는 주 1회만 높이기.`,
    };
  }
  return BALANCED_ADVICE[code];
}

function scoreByCode(scores: ElementScore[]): Record<ElementCode, ElementScore> {
  const out = {} as Record<ElementCode, ElementScore>;
  for (const score of scores) out[score.code] = score;
  return out;
}

export function generateElementLifestyleSection(input: ReportInput): ReportSection | null {
  const rng = createRng(input);
  for (let i = 0; i < 20; i++) rng.next();

  const name = safeName(input);
  const distribution = extractDistribution(input);
  const scores = toScores(distribution.values);
  const scoreMap = scoreByCode(scores);

  const deficient = normalizeElementList(input.saju.deficientElements);
  const excessive = normalizeElementList(input.saju.excessiveElements);
  const deficientSet = new Set<ElementCode>(deficient);
  const excessiveSet = new Set<ElementCode>(excessive);

  const strongest = pickStrongest(scores, excessive);
  const weakest = pickWeakest(scores, deficient, strongest);

  const introTemplates = [
    `${name}의 오행은 다섯 색 배터리처럼 움직여요. 배터리 양을 맞추면 하루 컨디션이 훨씬 안정돼요.`,
    `오행은 어려운 이론이 아니라 생활 리듬 지도예요. ${name}에게 맞는 루틴으로 쉽게 바꿔 볼게요.`,
    `오행 균형은 “몸과 마음의 볼륨 조절”이에요. 너무 큰 소리는 줄이고, 작은 소리는 키우는 방식으로 안내할게요.`,
  ] as const;

  const sourceText =
    distribution.source === 'saju'
      ? '사주 분포 원본'
      : distribution.source === 'springNormalized'
        ? '정규화된 오행 분포'
        : '안전 기본값(균형 분포)';

  const paragraphs: ReportParagraph[] = [];
  paragraphs.push(narrative(rng.pick(introTemplates)));
  paragraphs.push(emphasis(
    `현재 기준에서 가장 강한 오행은 ${elFull(strongest)}, 가장 약한 오행은 ${elFull(weakest)}이에요. ` +
    `이 강약과 결핍/과다 진단을 함께 써서 생활 가이드를 만들었어요.`,
  ));

  if (distribution.source === 'fallback') {
    paragraphs.push(caution(
      '오행 분포 수치를 찾지 못해요. 그래서 결핍/과다 정보와 기본 균형 원칙으로 안전하게 안내해요.',
    ));
  } else {
    paragraphs.push(narrative(`이번 안내는 ${sourceText}를 기준으로 만들었어요.`));
  }

  if (excessive.length > 0 || deficient.length > 0) {
    const excessiveText = excessive.length > 0 ? excessive.map(elFull).join(', ') : '없음';
    const deficientText = deficient.length > 0 ? deficient.map(elFull).join(', ') : '없음';
    paragraphs.push(narrative(`진단 요약: 과다 ${excessiveText} / 결핍 ${deficientText}`));
  }

  const boostTarget = deficient[0] ?? weakest;
  const calmTarget = excessive[0] ?? strongest;
  const boostState = stateForElement(boostTarget, strongest, weakest, deficientSet, excessiveSet);
  const calmState = stateForElement(calmTarget, strongest, weakest, deficientSet, excessiveSet);
  const boostAdvice = adviceFor(boostTarget, boostState);
  const calmAdvice = adviceFor(calmTarget, calmState);

  paragraphs.push(tip(
    `[수면] ${elShort(boostTarget)} 보강: ${boostAdvice.sleep} ` +
    `${calmTarget !== boostTarget ? `${elShort(calmTarget)} 조절: ${calmAdvice.sleep}` : ''}`.trim(),
    boostTarget,
  ));
  paragraphs.push(tip(
    `[식습관] ${elShort(boostTarget)} 보강: ${boostAdvice.diet} ` +
    `${calmTarget !== boostTarget ? `${elShort(calmTarget)} 조절: ${calmAdvice.diet}` : ''}`.trim(),
    boostTarget,
  ));
  paragraphs.push(tip(
    `[학습·일습관] ${elShort(boostTarget)} 보강: ${boostAdvice.studyWork} ` +
    `${calmTarget !== boostTarget ? `${elShort(calmTarget)} 조절: ${calmAdvice.studyWork}` : ''}`.trim(),
    boostTarget,
  ));
  paragraphs.push(tip(
    `[운동·환경] ${elShort(boostTarget)} 보강: ${boostAdvice.exerciseEnv} ` +
    `${calmTarget !== boostTarget ? `${elShort(calmTarget)} 조절: ${calmAdvice.exerciseEnv}` : ''}`.trim(),
    boostTarget,
  ));
  paragraphs.push(encouraging('한 번에 전부 바꾸지 않아도 괜찮아요. 오늘은 네 가지 중 한 가지만 실천해도 균형이 조금씩 맞춰져요.'));

  const sortedScores = [...scores].sort((a, b) => b.value - a.value);
  const table: ReportTable = {
    title: '오행별 생활 루틴 제안표',
    headers: ['오행', '비율', '상태', '수면', '식습관', '학습·일습관', '운동·환경'],
    rows: sortedScores.map(score => {
      const state = stateForElement(score.code, strongest, weakest, deficientSet, excessiveSet);
      const advice = adviceFor(score.code, state);
      return [
        `${elFull(score.code)}(${elShort(score.code)})`,
        score.percentText,
        STATE_LABEL[state],
        advice.sleep,
        advice.diet,
        advice.studyWork,
        advice.exerciseEnv,
      ];
    }),
  };

  const chartData: Record<string, number> = {};
  for (const score of sortedScores) {
    chartData[elShort(score.code)] = score.percent;
  }

  const chart: ReportChart = {
    type: 'bar',
    title: '오행 균형 차트 (%)',
    data: chartData,
    meta: {
      source: sourceText,
      strongest: elShort(strongest),
      weakest: elShort(weakest),
      colorHint: Object.fromEntries(
        ELEMENTS.map(el => [elShort(el), ELEMENT_COLOR[el] ?? '']),
      ),
    },
  };

  const highlights: ReportHighlight[] = [
    {
      label: '가장 강한 오행',
      value: `${elFull(strongest)} (${scoreMap[strongest].percentText})`,
      element: strongest,
      sentiment: excessiveSet.has(strongest) ? 'caution' : 'good',
    },
    {
      label: '가장 약한 오행',
      value: `${elFull(weakest)} (${scoreMap[weakest].percentText})`,
      element: weakest,
      sentiment: 'caution',
    },
  ];

  if (excessive.length > 0) {
    highlights.push({
      label: '과다 오행',
      value: excessive.map(el => `${elFull(el)}(${ELEMENT_DIRECTION[el] ?? ''})`).join(', '),
      element: excessive[0],
      sentiment: 'caution',
    });
  }

  if (deficient.length > 0) {
    highlights.push({
      label: '결핍 오행',
      value: deficient.map(el => `${elFull(el)}(보강 음식: ${(ELEMENT_FOOD[el] ?? []).slice(0, 2).join('/') || '기본 식단'})`).join(', '),
      element: deficient[0],
      sentiment: 'caution',
    });
  }

  const strongestEmotion = ELEMENT_HOBBY[strongest]?.[0] ?? '가벼운 활동';
  const weakestFood = ELEMENT_FOOD[weakest]?.[0] ?? '따뜻한 식사';
  highlights.push({
    label: '오늘의 한 줄 실천',
    value: `${strongestEmotion}로 에너지 배출 + ${weakestFood}로 약한 기운 보강`,
    sentiment: 'neutral',
  });

  return {
    id: 'elementLifestyle',
    title: '오행 균형 생활 가이드',
    subtitle: '수면·식습관·학습·일습관·운동·환경 실천표',
    paragraphs,
    tables: [table],
    charts: [chart],
    highlights,
  };
}
