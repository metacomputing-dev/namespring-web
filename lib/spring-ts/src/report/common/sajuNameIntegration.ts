/**
 * sajuNameIntegration.ts
 *
 * 사주 핵심 오행 신호와 이름 오행 신호를 통합해,
 * 사람이 바로 이해할 수 있는 실행형 인사이트를 만듭니다.
 *
 * 규칙은 전부 결정론적으로 동작하며(랜덤 없음),
 * 결과는 한국어 친화 문장으로 반환합니다.
 */

export type ElementCode = 'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER';

export interface SajuCoreSignalsInput {
  readonly yongshinElement?: ElementCode | null;
  readonly heeshinElement?: ElementCode | null;
  readonly gishinElement?: ElementCode | null;
  readonly deficientElements?: readonly ElementCode[] | null;
  readonly excessiveElements?: readonly ElementCode[] | null;
}

export interface NamingSignalsInput {
  /** 이름 글자(자원오행 등) 기반 오행 */
  readonly resourceElements?: readonly ElementCode[] | null;
  /** 수리/4격 등 보조 오행 */
  readonly strokeElements?: readonly ElementCode[] | null;
  /** 추가로 합산할 오행(선택) */
  readonly extraElements?: readonly ElementCode[] | null;
}

export interface SajuNameIntegrationInput {
  readonly saju?: SajuCoreSignalsInput | null;
  readonly naming?: NamingSignalsInput | null;
  /** 평면 입력 호환: 용신 오행 */
  readonly yongshinElement?: ElementCode | null;
  /** 평면 입력 호환: 희신 오행 */
  readonly heeshinElement?: ElementCode | null;
  /** 평면 입력 호환: 기신 오행 */
  readonly gishinElement?: ElementCode | null;
  /** 평면 입력 호환: 결핍 오행 */
  readonly deficientElements?: readonly ElementCode[] | null;
  /** 평면 입력 호환: 과다 오행 */
  readonly excessiveElements?: readonly ElementCode[] | null;
  /** 평면 입력 호환: 이름 주 오행 */
  readonly nameElements?: readonly ElementCode[] | null;
  /** 평면 입력 호환: 이름 보조 오행(수리 등) */
  readonly suriElements?: readonly ElementCode[] | null;
  /** 3~5 사이 제안 개수. 미지정 시 4개 */
  readonly actionSuggestionCount?: 3 | 4 | 5;
}

export interface SajuNameIntegrationSignals {
  /** 오행 조화 종합 한 줄 요약 */
  readonly elementHarmonySummary: string;
  /** 핵심 시너지 강점 */
  readonly keySynergyStrengths: readonly string[];
  /** 핵심 주의 포인트 */
  readonly keyCautionPoints: readonly string[];
  /** 오늘 바로 가능한 실천 제안 (3~5개) */
  readonly dailyActionSuggestions: readonly string[];
}

type ElementRelation = 'same' | 'generates' | 'generated_by' | 'controls' | 'controlled_by';

type ElementCounter = Record<ElementCode, number>;

interface PairFlowStats {
  readonly supportivePairs: number;
  readonly neutralPairs: number;
  readonly conflictPairs: number;
  readonly totalPairs: number;
}

const ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
const ELEMENT_SET: ReadonlySet<ElementCode> = new Set<ElementCode>(ELEMENTS);

const ELEMENT_LABEL: Readonly<Record<ElementCode, string>> = {
  WOOD: '목(木)',
  FIRE: '화(火)',
  EARTH: '토(土)',
  METAL: '금(金)',
  WATER: '수(水)',
};

const ELEMENT_GENERATES: Readonly<Record<ElementCode, ElementCode>> = {
  WOOD: 'FIRE',
  FIRE: 'EARTH',
  EARTH: 'METAL',
  METAL: 'WATER',
  WATER: 'WOOD',
};

const ELEMENT_GENERATED_BY: Readonly<Record<ElementCode, ElementCode>> = {
  WOOD: 'WATER',
  FIRE: 'WOOD',
  EARTH: 'FIRE',
  METAL: 'EARTH',
  WATER: 'METAL',
};

const ELEMENT_CONTROLS: Readonly<Record<ElementCode, ElementCode>> = {
  WOOD: 'EARTH',
  FIRE: 'METAL',
  EARTH: 'WATER',
  METAL: 'WOOD',
  WATER: 'FIRE',
};

const ELEMENT_ACTION_BOOST: Readonly<Record<ElementCode, readonly string[]>> = {
  WOOD: [
    '아침에 15분 걷고, 오늘 목표 1가지를 종이에 적어 시작해요.',
    '책상에 초록 식물이나 초록 포인트를 두고 집중 시간을 25분만 확보해요.',
  ],
  FIRE: [
    '오전 햇빛을 10분 쬐고, 중요한 대화 전에 따뜻한 한마디를 먼저 전해보세요.',
    '몸을 살짝 데우는 가벼운 유산소 10분으로 에너지 점화를 해보세요.',
  ],
  EARTH: [
    '식사와 수면 시간을 오늘만큼은 고정해 리듬을 안정시켜요.',
    '할 일을 3개만 고르고, 끝낼 때마다 체크해 성취 흐름을 만들어요.',
  ],
  METAL: [
    '우선순위 3개를 정하고, "지금 안 해도 되는 일" 1개를 과감히 빼보세요.',
    '호흡 3분 + 책상 정리 5분으로 판단력을 맑게 정돈해요.',
  ],
  WATER: [
    '물을 자주 나눠 마시고, 저녁에 20분 조용한 정리 시간을 확보해요.',
    '잠들기 30분 전 화면을 끄고, 생각을 메모로 내려놓고 쉬어보세요.',
  ],
};

const ELEMENT_ACTION_BALANCE: Readonly<Record<ElementCode, readonly string[]>> = {
  WOOD: [
    '속도를 줄이기 위해 오늘은 "시작 전 3분 정리"를 먼저 하고 움직여요.',
    '의견을 바로 밀기보다, 상대 말 1문장을 먼저 요약한 뒤 답해보세요.',
  ],
  FIRE: [
    '흥분이 올라올 때 물 한 컵을 먼저 마시고 답장을 3분 늦춰요.',
    '일정을 꽉 채우기보다 중간에 10분 휴식 블록을 꼭 넣어주세요.',
  ],
  EARTH: [
    '걱정이 길어지면 메모를 "지금 할 일 / 나중에 볼 일"로 나눠 정리해요.',
    '완벽하게 하려는 일 1개는 기준을 80%로 낮춰 가볍게 마무리해요.',
  ],
  METAL: [
    '비판 모드가 강해지면 칭찬 1개를 먼저 말한 뒤 피드백을 전달해요.',
    '결정 전 체크리스트는 유지하되, 시간 제한 10분으로 과한 고민을 끊어요.',
  ],
  WATER: [
    '생각이 많아질 때는 5분 산책으로 몸을 먼저 깨우고 다시 판단해요.',
    '밤늦은 정보 탐색은 20분 타이머를 걸고 끝내는 습관을 유지해요.',
  ],
};

const FALLBACK_ACTIONS: readonly string[] = [
  '오늘 일정은 핵심 3가지만 남기고 나머지는 과감히 비워보세요.',
  '메신저 답장 전에 3초 멈춤을 넣어 말의 온도를 맞춰요.',
  '하루 마무리에 "잘한 점 1개 + 보완점 1개"를 3줄로 기록해요.',
  '잠들기 전 5분 스트레칭으로 몸의 긴장을 풀고 수면 리듬을 지켜요.',
  '중요 결정은 즉답보다 메모 1회 검토 후 확정하는 루틴을 써보세요.',
];

function isElementCode(value: unknown): value is ElementCode {
  return typeof value === 'string' && ELEMENT_SET.has(value as ElementCode);
}

function normalizeElementList(values: readonly (ElementCode | null | undefined)[] | null | undefined): ElementCode[] {
  if (!values || values.length === 0) {
    return [];
  }

  const normalized: ElementCode[] = [];
  for (const value of values) {
    if (isElementCode(value)) {
      normalized.push(value);
    }
  }
  return normalized;
}

function uniqueElements(values: readonly ElementCode[]): ElementCode[] {
  const seen = new Set<ElementCode>();
  const out: ElementCode[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

function countElements(values: readonly ElementCode[]): ElementCounter {
  const counter: ElementCounter = {
    WOOD: 0,
    FIRE: 0,
    EARTH: 0,
    METAL: 0,
    WATER: 0,
  };

  for (const value of values) {
    counter[value] += 1;
  }

  return counter;
}

function relationBetween(a: ElementCode, b: ElementCode): ElementRelation {
  if (a === b) {
    return 'same';
  }
  if (ELEMENT_GENERATES[a] === b) {
    return 'generates';
  }
  if (ELEMENT_GENERATED_BY[a] === b) {
    return 'generated_by';
  }
  if (ELEMENT_CONTROLS[a] === b) {
    return 'controls';
  }
  return 'controlled_by';
}

function analyzePairFlow(values: readonly ElementCode[]): PairFlowStats {
  if (values.length < 2) {
    return {
      supportivePairs: 0,
      neutralPairs: 0,
      conflictPairs: 0,
      totalPairs: 0,
    };
  }

  let supportivePairs = 0;
  let neutralPairs = 0;
  let conflictPairs = 0;

  for (let i = 0; i < values.length - 1; i += 1) {
    const relation = relationBetween(values[i], values[i + 1]);
    if (relation === 'generates' || relation === 'generated_by') {
      supportivePairs += 1;
      continue;
    }
    if (relation === 'controls' || relation === 'controlled_by') {
      conflictPairs += 1;
      continue;
    }
    neutralPairs += 1;
  }

  return {
    supportivePairs,
    neutralPairs,
    conflictPairs,
    totalPairs: values.length - 1,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function elementText(value: ElementCode): string {
  return ELEMENT_LABEL[value];
}

function joinElementTexts(values: readonly ElementCode[]): string {
  return values.map(elementText).join(', ');
}

function countElementsGenerating(target: ElementCode, sourceElements: readonly ElementCode[]): number {
  let count = 0;
  for (const source of sourceElements) {
    if (ELEMENT_GENERATES[source] === target) {
      count += 1;
    }
  }
  return count;
}

function countElementsControlling(target: ElementCode, sourceElements: readonly ElementCode[]): number {
  let count = 0;
  for (const source of sourceElements) {
    if (ELEMENT_CONTROLS[source] === target) {
      count += 1;
    }
  }
  return count;
}

function addUnique(list: string[], text: string): void {
  if (!text) {
    return;
  }
  if (!list.includes(text)) {
    list.push(text);
  }
}

function computeHarmonyScore(
  pairFlow: PairFlowStats,
  counts: ElementCounter,
  yongshinElement: ElementCode | null,
  gishinElement: ElementCode | null,
  deficient: readonly ElementCode[],
  excessive: readonly ElementCode[],
  combinedNameElements: readonly ElementCode[],
): number {
  let score = 58;

  if (pairFlow.totalPairs > 0) {
    const pairBalance = (pairFlow.supportivePairs - pairFlow.conflictPairs) / pairFlow.totalPairs;
    score += Math.round(pairBalance * 28);
    score += Math.round((pairFlow.neutralPairs / pairFlow.totalPairs) * 6);
  }

  if (yongshinElement) {
    score += counts[yongshinElement] * 8;
    score += countElementsGenerating(yongshinElement, combinedNameElements) * 4;
    score -= countElementsControlling(yongshinElement, combinedNameElements) * 6;
  }

  if (gishinElement) {
    score -= counts[gishinElement] * 5;
    score += countElementsControlling(gishinElement, combinedNameElements) * 3;
  }

  for (const element of deficient) {
    score += counts[element] > 0 ? 4 : -2;
  }

  for (const element of excessive) {
    if (counts[element] > 0) {
      score -= 4;
    }
    if (countElementsControlling(element, combinedNameElements) > 0) {
      score += 2;
    }
  }

  return clamp(score, 0, 100);
}

function buildHarmonySummary(
  score: number,
  pairFlow: PairFlowStats,
  yongshinElement: ElementCode | null,
  yongshinCount: number,
): string {
  const level = score >= 80
    ? '매우 조화로운 편'
    : score >= 65
      ? '조화가 좋은 편'
      : score >= 50
        ? '무난한 편'
        : '조율이 필요한 편';

  const flowPhrase = pairFlow.totalPairs > 0
    ? `상생 흐름 ${pairFlow.supportivePairs}쌍, 상극 흐름 ${pairFlow.conflictPairs}쌍`
    : '오행 흐름 데이터가 아직 적어 중립 신호가 중심';

  if (yongshinElement && yongshinCount > 0) {
    return `이름과 사주를 함께 보면 오행 조화는 ${score}점(${level})이에요. ${flowPhrase}이며, 용신 ${elementText(yongshinElement)}이 이름에 직접 반영되어 균형 회복에 힘이 됩니다.`;
  }

  if (score >= 65) {
    return `이름과 사주를 함께 보면 오행 조화는 ${score}점(${level})이에요. ${flowPhrase}이라서, 현재 조합의 장점을 생활 루틴으로 꾸준히 살리면 더 안정적이에요.`;
  }

  if (score >= 50) {
    return `이름과 사주를 함께 보면 오행 조화는 ${score}점(${level})이에요. ${flowPhrase}이 함께 보여서, 작은 습관 보완이 체감 효과를 크게 만들어요.`;
  }

  return `이름과 사주를 함께 보면 오행 조화는 ${score}점(${level})이에요. ${flowPhrase}이라 과속 패턴만 줄여도 체감 밸런스가 빠르게 좋아질 수 있어요.`;
}

function buildDailyActions(
  actionCount: 3 | 4 | 5,
  yongshinElement: ElementCode | null,
  gishinElement: ElementCode | null,
  deficientUncovered: readonly ElementCode[],
  excessiveAmplified: readonly ElementCode[],
  pairFlow: PairFlowStats,
): readonly string[] {
  const suggestions: string[] = [];

  for (const element of deficientUncovered) {
    addUnique(suggestions, ELEMENT_ACTION_BOOST[element][0]);
  }

  if (yongshinElement) {
    addUnique(suggestions, ELEMENT_ACTION_BOOST[yongshinElement][1]);
  }

  for (const element of excessiveAmplified) {
    addUnique(suggestions, ELEMENT_ACTION_BALANCE[element][0]);
  }

  if (gishinElement) {
    addUnique(suggestions, `기신 ${elementText(gishinElement)} 자극이 커지지 않도록, 중요한 결정은 메모 점검 1회를 거친 뒤 확정해요.`);
  }

  if (pairFlow.conflictPairs > pairFlow.supportivePairs) {
    addUnique(suggestions, '오늘은 약속과 업무를 20% 덜어내고, 핵심 3가지에만 에너지를 집중해요.');
  }

  for (const fallback of FALLBACK_ACTIONS) {
    if (suggestions.length >= actionCount) {
      break;
    }
    addUnique(suggestions, fallback);
  }

  while (suggestions.length < actionCount) {
    addUnique(suggestions, '하루 끝에 컨디션을 10점 만점으로 적고, 내일 보완할 한 가지를 정해요.');
  }

  return suggestions.slice(0, actionCount);
}

/**
 * 사주 + 이름 통합 시그널을 생성합니다.
 *
 * 출력은 아래 4개 축으로 구성됩니다.
 * 1) elementHarmonySummary
 * 2) keySynergyStrengths
 * 3) keyCautionPoints
 * 4) dailyActionSuggestions (3~5)
 */
export function buildSajuNameIntegrationSignals(
  input: SajuNameIntegrationInput,
): SajuNameIntegrationSignals {
  const saju = input.saju ?? undefined;
  const naming = input.naming ?? undefined;

  const yongshinElementRaw = saju?.yongshinElement ?? input.yongshinElement;
  const heeshinElementRaw = saju?.heeshinElement ?? input.heeshinElement;
  const gishinElementRaw = saju?.gishinElement ?? input.gishinElement;

  const yongshinElement = isElementCode(yongshinElementRaw) ? yongshinElementRaw : null;
  const heeshinElement = isElementCode(heeshinElementRaw) ? heeshinElementRaw : null;
  const gishinElement = isElementCode(gishinElementRaw) ? gishinElementRaw : null;

  const deficientElements = uniqueElements(
    normalizeElementList(saju?.deficientElements ?? input.deficientElements),
  );
  const excessiveElements = uniqueElements(
    normalizeElementList(saju?.excessiveElements ?? input.excessiveElements),
  );

  const resourceElements = normalizeElementList(naming?.resourceElements ?? input.nameElements);
  const strokeElements = normalizeElementList(naming?.strokeElements ?? input.suriElements);
  const extraElements = normalizeElementList(naming?.extraElements);

  const combinedNameElements = [...resourceElements, ...strokeElements, ...extraElements];
  const counts = countElements(combinedNameElements);
  const pairFlow = analyzePairFlow(combinedNameElements);

  const strengths: string[] = [];
  const cautions: string[] = [];

  if (yongshinElement) {
    const directCount = counts[yongshinElement];
    const generatingCount = countElementsGenerating(yongshinElement, combinedNameElements);
    const controllingCount = countElementsControlling(yongshinElement, combinedNameElements);

    if (directCount > 0) {
      strengths.push(`용신 ${elementText(yongshinElement)} 기운이 이름에 ${directCount}회 반영되어 핵심 균형을 단단히 받쳐줘요.`);
    }
    if (generatingCount > 0) {
      strengths.push(`${elementText(yongshinElement)}을(를) 생하는 흐름이 ${generatingCount}회 보여서 필요한 에너지를 부드럽게 채워줘요.`);
    }
    if (controllingCount > 0) {
      cautions.push(`용신 ${elementText(yongshinElement)}을(를) 누르는 상극 신호가 ${controllingCount}회 보여, 급한 결정보다 한 번 더 점검이 유리해요.`);
    }
  }

  if (heeshinElement && counts[heeshinElement] > 0) {
    strengths.push(`희신 ${elementText(heeshinElement)} 기운이 담겨 있어 회복력과 완충력이 좋아요.`);
  }

  if (gishinElement) {
    const gishinCount = counts[gishinElement];
    const controlsGishin = countElementsControlling(gishinElement, combinedNameElements);

    if (gishinCount > 0) {
      cautions.push(`기신 ${elementText(gishinElement)} 신호가 ${gishinCount}회 보여 과로·과속 패턴을 의식적으로 줄이는 게 좋아요.`);
    }
    if (controlsGishin > 0) {
      strengths.push(`기신 ${elementText(gishinElement)}을(를) 제어하는 흐름이 ${controlsGishin}회 있어 리스크 완충 장치가 있어요.`);
    }
  }

  const deficientCovered = deficientElements.filter((element) => counts[element] > 0);
  const deficientUncovered = deficientElements.filter((element) => counts[element] === 0);

  if (deficientCovered.length > 0) {
    strengths.push(`결핍 오행(${joinElementTexts(deficientCovered)})을 이름이 직접 보완해 체감 밸런스 회복에 유리해요.`);
  }
  if (deficientUncovered.length > 0) {
    cautions.push(`결핍 오행(${joinElementTexts(deficientUncovered)}) 보완 신호가 약해서 생활 루틴에서 의식적으로 채워주면 좋아요.`);
  }

  const excessiveAmplified = excessiveElements.filter((element) => counts[element] > 0);
  const excessiveBuffered = excessiveElements.filter(
    (element) => countElementsControlling(element, combinedNameElements) > 0,
  );

  if (excessiveAmplified.length > 0) {
    cautions.push(`과다 오행(${joinElementTexts(excessiveAmplified)})이 이름에도 보여, 감정과 일정이 한쪽으로 쏠리지 않게 조율이 필요해요.`);
  }
  if (excessiveBuffered.length > 0) {
    strengths.push(`과다 오행(${joinElementTexts(excessiveBuffered)})을 눌러주는 완충 흐름도 있어 전체 균형에 도움이 돼요.`);
  }

  if (pairFlow.totalPairs > 0) {
    if (pairFlow.supportivePairs >= pairFlow.conflictPairs + 1) {
      strengths.push(`이름 내부 오행 흐름에서 상생 쌍(${pairFlow.supportivePairs})이 상극 쌍(${pairFlow.conflictPairs})보다 많아 기본 호흡이 안정적이에요.`);
    } else if (pairFlow.conflictPairs > pairFlow.supportivePairs) {
      cautions.push(`이름 내부 오행 흐름에서 상극 쌍(${pairFlow.conflictPairs})이 상대적으로 많아, 페이스 조절 습관이 중요해요.`);
    }
  }

  const harmonyScore = computeHarmonyScore(
    pairFlow,
    counts,
    yongshinElement,
    gishinElement,
    deficientElements,
    excessiveElements,
    combinedNameElements,
  );

  const elementHarmonySummary = buildHarmonySummary(
    harmonyScore,
    pairFlow,
    yongshinElement,
    yongshinElement ? counts[yongshinElement] : 0,
  );

  const keySynergyStrengths = strengths.length > 0
    ? strengths.slice(0, 4)
    : ['이름 오행이 사주와 크게 충돌하지 않아 기본 안정감이 있는 편이에요.'];

  const keyCautionPoints = cautions.length > 0
    ? cautions.slice(0, 4)
    : ['뚜렷한 충돌 신호는 작지만, 컨디션이 흔들릴 때 루틴 관리가 성패를 가를 수 있어요.'];

  const actionCountRaw = input.actionSuggestionCount ?? 4;
  const actionCount = clamp(actionCountRaw, 3, 5) as 3 | 4 | 5;

  const dailyActionSuggestions = buildDailyActions(
    actionCount,
    yongshinElement,
    gishinElement,
    deficientUncovered,
    excessiveAmplified,
    pairFlow,
  );

  return {
    elementHarmonySummary,
    keySynergyStrengths,
    keyCautionPoints,
    dailyActionSuggestions,
  };
}
