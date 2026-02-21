/**
 * part10-luckItems.ts -- 개운 아이템 섹션
 *
 * PART 10: 용신/희신과 결핍 오행을 기준으로
 * 일상에서 바로 써볼 수 있는 행운 아이템/루틴 가이드를 제공합니다.
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportHighlight,
  ElementCode,
} from '../types.js';

import {
  ELEMENT_KOREAN,
  ELEMENT_COLOR,
  ELEMENT_DIRECTION,
  ELEMENT_NUMBER,
  ELEMENT_HOBBY,
  ELEMENT_CONTROLLED_BY,
  ELEMENT_GENERATED_BY,
  elementCodeToKorean,
} from '../common/elementMaps.js';

import {
  createRng,
  narrative,
  tip,
  caution,
  emphasis,
  encouraging,
  type SeededRandom,
} from '../common/sentenceUtils.js';

const ELEMENT_CODES: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

const LUCKY_ITEM_POOL: Record<ElementCode, readonly string[]> = {
  WOOD: ['초록 텀블러', '작은 화분', '나무 질감 카드지갑'],
  FIRE: ['레드 포인트 펜', '따뜻한 톤 머플러', '오렌지 메모 노트'],
  EARTH: ['베이지 파우치', '도자기 머그컵', '황토 톤 방석'],
  METAL: ['화이트 금속 볼펜', '실버 키링', '정리용 메탈 트레이'],
  WATER: ['네이비 물병', '검정 우산', '딥블루 파우치'],
};

const AVOID_HABIT_POOL: Record<ElementCode, readonly string[]> = {
  WOOD: ['수면을 깨는 야근 패턴'],
  FIRE: ['카페인 과다와 과열된 일정'],
  EARTH: ['오래 앉아만 있는 정체된 루틴'],
  METAL: ['완벽주의로 정리만 하다 시작을 미루는 패턴'],
  WATER: ['밤낮이 뒤집힌 생활'],
};

type TargetBasis = '용신' | '희신' | '결핍 보완' | '기본 균형';

interface GuideTarget {
  readonly basis: TargetBasis;
  readonly element: ElementCode;
}

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

function isElementCode(value: unknown): value is ElementCode {
  return typeof value === 'string' && (ELEMENT_CODES as readonly string[]).includes(value);
}

function normalizeElement(value: unknown): ElementCode | null {
  return isElementCode(value) ? value : null;
}

function normalizeElementArray(value: unknown): ElementCode[] {
  if (!Array.isArray(value)) return [];
  const out: ElementCode[] = [];
  for (const v of value) {
    if (isElementCode(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

function elementLabel(element: ElementCode): string {
  return ELEMENT_KOREAN[element] ?? elementCodeToKorean(element) ?? element;
}

function pickText(rng: SeededRandom, pool: readonly string[] | undefined, fallback: string): string {
  if (!pool || pool.length === 0) return fallback;
  return rng.pick(pool);
}

function buildItemRoutine(target: GuideTarget, rng: SeededRandom): string {
  const item = pickText(rng, LUCKY_ITEM_POOL[target.element], '작은 생활 소품');
  const hobbies = ELEMENT_HOBBY[target.element] ?? [];
  const hobby = pickText(rng, hobbies, '가벼운 정리 루틴');

  if (target.basis === '결핍 보완') {
    const helperElement = ELEMENT_GENERATED_BY[target.element];
    return `${item}, ${hobby} 주 2~3회 (${elementLabel(helperElement)} 기운 보조)`;
  }

  return `${item}, ${hobby} 주 2~3회`;
}

function buildAvoidText(
  element: ElementCode,
  gishinElement: ElementCode | null,
  excessiveElements: ElementCode[],
  rng: SeededRandom,
): string {
  const cautionElement = gishinElement ?? ELEMENT_CONTROLLED_BY[element];
  const excessiveNames = excessiveElements
    .filter(el => el !== element)
    .slice(0, 2)
    .map(elementLabel);
  const excessiveText = excessiveNames.length > 0
    ? `${excessiveNames.join(', ')} 계열 과다`
    : `${elementLabel(cautionElement)} 기운 과다`;
  const avoidHabit = pickText(rng, AVOID_HABIT_POOL[element], '한쪽으로 치우친 생활 습관');

  return `${excessiveText}, ${avoidHabit}`;
}

function buildGuideRow(
  target: GuideTarget,
  gishinElement: ElementCode | null,
  excessiveElements: ElementCode[],
  rng: SeededRandom,
): string[] {
  const color = ELEMENT_COLOR[target.element] ?? '무난한 자연색';
  const direction = ELEMENT_DIRECTION[target.element] ?? '중앙';
  const numbers = ELEMENT_NUMBER[target.element] ?? [0, 0];

  return [
    target.basis,
    elementLabel(target.element),
    color,
    direction,
    `${numbers[0]}, ${numbers[1]}`,
    buildItemRoutine(target, rng),
    buildAvoidText(target.element, gishinElement, excessiveElements, rng),
  ];
}

export function generateLuckItemsSection(input: ReportInput): ReportSection | null {
  const rng = createRng(input);
  for (let i = 0; i < 40; i++) rng.next();

  const name = safeName(input);

  const yongshinRaw = input.saju.yongshin as {
    element?: unknown;
    heeshin?: unknown;
    gishin?: unknown;
  } | null | undefined;

  const yongElement = normalizeElement(yongshinRaw?.element);
  const heeElement = normalizeElement(yongshinRaw?.heeshin);
  const gishinElement = normalizeElement(yongshinRaw?.gishin);

  const deficientElements = normalizeElementArray((input.saju as { deficientElements?: unknown }).deficientElements);
  const excessiveElements = normalizeElementArray((input.saju as { excessiveElements?: unknown }).excessiveElements);

  const targets: GuideTarget[] = [];
  const pushTarget = (basis: TargetBasis, element: ElementCode | null): void => {
    if (!element) return;
    if (targets.some(t => t.element === element)) return;
    targets.push({ basis, element });
  };

  pushTarget('용신', yongElement);
  pushTarget('희신', heeElement);
  for (const el of deficientElements.slice(0, 3)) pushTarget('결핍 보완', el);

  if (targets.length === 0) {
    const dayMasterElement = normalizeElement((input.saju as { dayMaster?: { element?: unknown } | null }).dayMaster?.element);
    pushTarget('기본 균형', dayMasterElement ?? 'EARTH');
  }

  if (targets.length === 0) return null;

  const yongText = yongElement ? elementLabel(yongElement) : '미확인';
  const heeText = heeElement ? elementLabel(heeElement) : '미확인';
  const deficiencyText = deficientElements.length > 0
    ? deficientElements.map(elementLabel).join(', ')
    : '특별한 결핍 오행 없음';

  const paragraphs: ReportParagraph[] = [];
  if (yongElement || heeElement || deficientElements.length > 0) {
    paragraphs.push(
      narrative(
        `${name}님에게 맞는 개운 포인트를 용신/희신과 결핍 오행 기준으로 정리했어요. `
        + `핵심은 ${yongText}, 보조는 ${heeText}, 결핍 보완은 ${deficiencyText}입니다.`,
      ),
    );
  } else {
    paragraphs.push(
      narrative(
        `${name}님은 핵심 오행 데이터가 일부 비어 있어요. `
        + '그래서 일간 기준 기본 개운 루틴으로 안전하게 안내해드릴게요.',
      ),
    );
  }

  paragraphs.push(
    tip(
      '아래 표에서 한 줄만 먼저 적용해도 충분해요. '
      + '색상은 휴대폰 케이스/지갑, 방향은 책상 배치, 숫자는 비밀번호 일부에 가볍게 써보세요.',
    ),
  );

  const cautionTarget = gishinElement
    ? `${elementLabel(gishinElement)} 기운 과다`
    : excessiveElements.length > 0
      ? `${excessiveElements.map(elementLabel).join(', ')} 과다`
      : '한쪽 기운 과몰입';

  paragraphs.push(
    caution(
      `피하면 좋은 패턴은 ${cautionTarget}이에요. `
      + '강한 아이템을 한 번에 많이 쓰기보다, 작은 소품과 루틴을 꾸준히 유지하는 편이 훨씬 좋아요.',
    ),
  );

  paragraphs.push(
    encouraging('작은 소품 1개 + 짧은 루틴 1개를 3주만 유지해도 체감이 빨라집니다.'),
  );

  const table: ReportTable = {
    title: '용신/희신 + 결핍 오행 기준 행운 아이템 표',
    headers: ['구분', '오행', '색상', '방향', '숫자', '소품/루틴', '피하면 좋은 것'],
    rows: targets.map(target => buildGuideRow(target, gishinElement, excessiveElements, rng)),
  };

  const highlights: ReportHighlight[] = [];
  if (yongElement) {
    highlights.push({
      label: '핵심 개운 오행',
      value: `${elementLabel(yongElement)} 중심으로 맞추기`,
      element: yongElement,
      sentiment: 'good',
    });
  }
  if (heeElement) {
    highlights.push({
      label: '보조 오행',
      value: `${elementLabel(heeElement)} 아이템을 보조로 사용`,
      element: heeElement,
      sentiment: 'good',
    });
  }
  if (deficientElements.length > 0) {
    highlights.push({
      label: '결핍 보완 우선',
      value: deficientElements.slice(0, 3).map(elementLabel).join(', '),
      sentiment: 'neutral',
    });
  }

  const avoidElements = gishinElement ? [gishinElement] : excessiveElements.slice(0, 2);
  if (avoidElements.length > 0) {
    highlights.push({
      label: '피하면 좋은 기운',
      value: avoidElements.map(elementLabel).join(', '),
      sentiment: 'caution',
    });
  }

  if (highlights.length === 0) {
    const fallbackElement = targets[0].element;
    highlights.push({
      label: '기본 개운 포인트',
      value: `${elementLabel(fallbackElement)} 기운을 가볍게 채우기`,
      element: fallbackElement,
      sentiment: 'neutral',
    });
  }

  paragraphs.push(
    emphasis('한 번에 전부 바꾸기보다, 오늘 당장 적용 가능한 한 가지부터 시작해 보세요.'),
  );

  return {
    id: 'luckItems',
    title: '행운 아이템 가이드',
    subtitle: '용신/희신 + 결핍 오행 기반 실전 개운법',
    paragraphs,
    tables: [table],
    highlights,
  };
}
