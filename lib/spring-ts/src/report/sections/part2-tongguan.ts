/**
 * part2-tongguan.ts -- 통관(通關) 분석 섹션
 *
 * PART 2-3: 오행 간의 상극 관계에서 중재 역할을 하는 통관 오행을 분석합니다.
 *
 * 페르소나: "철학적 사색가"
 * 깊은 통찰과 사유의 언어로, 동양 철학의 깊이를 현대적 언어로 풀어냅니다.
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
  ELEMENT_KOREAN_SHORT,
  ELEMENT_HANJA,
  ELEMENT_GENERATES,
  ELEMENT_CONTROLS,
  ELEMENT_NATURE,
  elementCodeToKorean,
} from '../common/elementMaps.js';

import { describeElementPair } from '../knowledge/elementRelationsEncyclopedia.js';

import {
  createRng,
  pickAndFill,
  narrative,
  positive,
  tip,
  emphasis,
  encouraging,
  SeededRandom,
} from '../common/sentenceUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
//  헬퍼 함수
// ─────────────────────────────────────────────────────────────────────────────

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

function elFull(c: string | undefined): string {
  return c ? (ELEMENT_KOREAN[c as ElementCode] ?? c) : '?';
}

function elShort(c: string | undefined): string {
  return c ? (ELEMENT_KOREAN_SHORT[c as ElementCode] ?? c) : '?';
}

function elHanja(c: string | undefined): string {
  return c ? (ELEMENT_HANJA[c as ElementCode] ?? c) : '?';
}

const ELEMENT_CODE_SET: ReadonlySet<ElementCode> = new Set(['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']);

function asElementCode(value: string | undefined): ElementCode | null {
  if (!value) return null;
  return ELEMENT_CODE_SET.has(value as ElementCode) ? (value as ElementCode) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  철학적 사색가 문장 풀
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_TEMPLATES: readonly string[] = [
  '막혀 있던 물길에 새로운 수로를 내는 것, 그것이 통관(通關)의 지혜입니다. 상극(相剋)이라는 이름의 갈등은 자연의 섭리이지만, 그 사이에 다리를 놓는 중재의 오행이 있을 때 비로소 기운은 막힘없이 흘러가는 법이지요.',
  '대립은 반드시 중재자를 필요로 합니다. 오행의 세계에서 상극이란 단순한 충돌이 아니라, 새로운 균형을 향한 긴장이라 할 수 있겠죠. 통관은 바로 그 긴장 속에서 화해의 길을 여는 지혜인 거죠.',
  '갈등 속에서 균형점을 찾는 것이야말로 동양 철학이 수천 년에 걸쳐 탐구해 온 핵심 명제입니다. 통관(通關)은 "관문을 통하게 한다"는 뜻으로, 서로 극하는 두 오행 사이에 중재의 다리를 놓아 기운의 흐름을 복원하는 이치에요.',
  '산이 높으면 골이 깊듯, 강한 기운과 기운이 맞부딪히는 곳에는 반드시 골이 생기는 법입니다. 통관이란 그 골짜기에 다리를 놓아 양쪽의 기운이 서로 소통하게 하는 것이지요. {{이름}}님 사주의 통관 구조를 사색해 보겠습니다.',
  '물은 불을 끄고, 불은 쇠를 녹이며, 쇠는 나무를 베고, 나무는 흙을 뚫고, 흙은 물길을 막습니다. 이 다섯 가지 상극의 고리에서, 각각의 갈등을 풀어주는 중재자가 있으니 그것이 바로 통관이라 하는 것이에요.',
  '세상에 갈등 없는 관계란 없는 법이지요. 다만 지혜로운 이는 그 갈등 사이에서 조화의 길을 찾습니다. 오행에서도 마찬가지로, 상극의 두 기운 사이에 놓이는 통관의 오행이야말로 사주의 균형을 지키는 숨은 열쇠인 거죠.',
];

/** 각 상극 쌍별 철학적 비유 (from→to 기준) */
const PAIR_METAPHORS: Record<string, readonly string[]> = {
  // 목극토: 나무뿌리가 흙을 뚫는다 → 화(火)가 중재
  'WOOD→EARTH': [
    '나무가 땅을 뚫고 솟아오르는 것은 생명의 의지이지만, 그 과정에서 땅은 갈라지는 법입니다. 이때 불(火)의 기운이 나무의 열정을 받아 흙에 따스함을 전하니, 대립이 아닌 순환이 이루어지는 이치에요.',
    '뿌리가 대지를 파고드는 힘은 강하지만, 그 사이에 따뜻한 햇볕 같은 화(火)의 기운이 스며들면 나무는 재가 되어 흙을 비옥하게 하는 법이지요. 갈등이 상생으로 바뀌는 순간입니다.',
    '목(木)과 토(土)의 갈등은 마치 개척자와 수호자의 대립과도 같은 것이에요. 화(火)라는 중재자는 나무의 에너지를 변환하여 흙에게 양분으로 돌려주니, 이것이 통관의 오묘한 작용이라 하겠죠.',
  ],
  // 토극수: 흙이 물길을 막는다 → 금(金)이 중재
  'EARTH→WATER': [
    '흙이 물길을 막으면 물은 갈 곳을 잃는 법입니다. 그러나 금(金)의 기운이 흙 속에서 나와 물방울을 맺히게 하니, 막힌 물길에 새로운 수로가 열리는 것이지요. 이것이 자연의 중재인 거죠.',
    '제방이 강물을 가로막듯, 토(土)와 수(水)의 상극은 정지와 흐름의 대립이에요. 금(金)은 흙 속에서 태어나되 물을 품어 내보내니, 두 세계를 잇는 다리가 되는 이치입니다.',
    '대지가 물의 흐름을 멈추려 할 때, 금(金)이라는 광맥이 그 사이에서 길을 내어 줍니다. 흙에서 나고 물을 살리는 금의 중재야말로, 정체된 기운을 다시 흐르게 하는 지혜라 할 수 있겠죠.',
  ],
  // 수극화: 물이 불을 끄다 → 목(木)이 중재
  'WATER→FIRE': [
    '물이 불을 끄는 것은 자연의 이치이지만, 그 사이에 나무(木)라는 생명이 서면 이야기가 달라지는 법이에요. 물은 나무를 키우고, 나무는 불을 일으키니, 소멸이 아닌 순환의 고리가 완성되는 것이지요.',
    '차가운 물과 뜨거운 불, 이보다 극적인 대립이 또 있을까요. 그러나 나무(木)는 물의 자양분을 받아 자라고, 그 나무가 불의 연료가 되어 주니, 대립이 협력으로 변하는 마련이에요.',
    '수(水)와 화(火)의 충돌은 존재의 근원적 긴장을 상징하지요. 목(木)은 물을 마시고 불을 피워내는 매개자로서, 소멸의 관계를 창조의 관계로 전환시키는 것이야말로 통관의 진수라 하겠습니다.',
  ],
  // 화극금: 불이 쇠를 녹이다 → 토(土)가 중재
  'FIRE→METAL': [
    '불이 쇠를 녹이는 것은 거스를 수 없는 힘의 논리이지만, 그 사이에 흙(土)이 놓이면 이야기가 달라지는 법입니다. 불은 재가 되어 흙을 이루고, 흙은 그 품에서 쇠를 길러내니, 파괴가 아닌 변환의 서사가 펼쳐지는 것이지요.',
    '용광로의 불꽃이 쇠를 집어삼킬 때, 대지(土)라는 완충지대가 그 맹렬함을 부드럽게 감싸 안는 마련이에요. 화에서 태어나고 금을 품어내는 토의 중재는 파괴를 변환으로 바꾸는 이치에요.',
    '화(火)와 금(金)의 상극은 열정과 원칙의 충돌이라 할 수 있겠죠. 토(土)라는 안정의 기운이 그 사이에서 불의 열기를 받아 안정시키고, 그 안에서 금의 결단을 빚어내니, 이것이 중재의 참 모습인 거죠.',
  ],
  // 금극목: 도끼가 나무를 자르다 → 수(水)가 중재
  'METAL→WOOD': [
    '날카로운 도끼가 나무를 벨 때, 그 사이에 물(水)의 기운이 스며들면 나무에게 새로운 생명력을 불어넣는 법이지요. 금에서 물이 나고, 물이 나무를 키우니, 단절이 아닌 순환이 이루어지는 것입니다.',
    '쇠와 나무의 대립은 문명과 자연의 긴장을 닮았습니다. 수(水)는 금속의 차가움에서 태어나되 나무의 뿌리를 적시니, 베임의 관계를 키움의 관계로 바꾸는 지혜가 담긴 이치라 하겠지요.',
    '금(金)이 목(木)을 극하는 것은 결단이 성장을 제어하는 것과 같은 이치에요. 수(水)라는 지혜의 기운이 그 사이에 흘러들면, 쇠의 차가움은 물이 되고 물은 나무를 살리니, 이것이야말로 갈등을 넘어서는 통관의 묘리인 거죠.',
  ],
};

/** 강도 수준별 철학적 해석 */
const STRENGTH_COMMENTARY: Record<string, readonly string[]> = {
  '강함': [
    '이 상극의 긴장이 상당히 강하게 작용하고 있으니, 통관 오행의 보충이 특히 절실한 상황이라 하겠습니다.',
    '갈등의 골이 깊다는 것은, 역설적으로 통관이 이루어졌을 때 그 효과도 크다는 뜻이지요.',
    '강한 상극은 마치 팽팽한 활시위와 같아서, 통관이라는 화살을 쏘아야 비로소 에너지가 흐르는 법입니다.',
  ],
  '보통': [
    '적당한 긴장감은 오히려 성장의 동력이 될 수 있는 법이에요. 통관이 있다면 더욱 매끄러운 흐름을 기대할 수 있겠죠.',
    '이 정도의 상극은 자연스러운 균형의 일부라 볼 수 있으니, 크게 우려할 바는 아니지만 통관의 보완이 있다면 금상첨화이지요.',
    '보통 수준의 갈등이 감지되는데, 이는 사주에 적절한 긴장감을 부여하는 요소이기도 하답니다.',
  ],
  '약함': [
    '상극의 기운이 미미하니, 이 쌍의 갈등은 크게 신경 쓰지 않아도 되는 수준이에요.',
    '약한 상극은 물결 위의 잔 파문 같은 것이어서, 사주 전체의 흐름에 큰 영향을 미치지 않는 법이지요.',
    '이 부분은 갈등보다 조화에 가까운 상태라 할 수 있겠습니다. 통관이 없더라도 무방한 수준이에요.',
  ],
};

const CLOSING_TEMPLATES: readonly string[] = [
  '통관이 사주 원국에 이미 존재한다면, 갈등의 물길은 자연스럽게 소통의 강으로 흘러가게 됩니다. 원국에 없더라도 대운이나 세운에서 통관의 기운이 찾아올 때, 막혔던 일들이 풀리는 경험을 하시게 될 거예요.',
  '옛 현인들은 "화이부동(和而不同)"이라 하였으니, 서로 다름 속에서 조화를 이루는 것이야말로 삶의 지혜입니다. 통관의 오행을 일상에서 보충하면 사주의 갈등 구조를 부드럽게 풀어나갈 수 있는 법이지요.',
  '갈등이란 반드시 해로운 것만은 아닙니다. 적절한 긴장이 있어야 성장이 있고, 대립이 있어야 창조가 있는 법이니까요. 다만 너무 강한 상극은 통관으로 다스려야 기운이 순탄하게 순환하는 이치에요.',
  '모든 상극에는 그에 걸맞은 중재자가 있으니, 이것이 자연이 스스로 균형을 찾아가는 방식입니다. 용신 분석과 함께 살펴보시면, 어떤 오행을 보충해야 사주의 흐름이 원활해지는지 더 분명히 보이게 될 것입니다.',
  '동양 사상에서 말하는 중용(中庸)의 도란, 극단을 피하고 중심을 잡는 것이지요. 통관은 바로 그 중용의 실천이에요. 상극의 양 끝 사이에서 균형점을 찾아 놓인 다리, 그것이 {{이름}}님 사주를 더욱 단단하게 만들어 줄 열쇠인 거죠.',
];

/** 통관 개념 전체를 조망하는 사색 문장 */
const OVERVIEW_TEMPLATES: readonly string[] = [
  '{{이름}}님의 사주에서 총 {{총쌍수}}개의 상극 쌍을 살펴보겠습니다. 각 쌍에는 고유한 중재자(bridge) 오행이 존재하며, 이 통관의 구조를 이해하면 사주 내 기운의 흐름이 어디서 막히고 어디서 소통되는지 한눈에 조망할 수 있는 법입니다.',
  '오행의 상극은 다섯 쌍이 존재하며, 각각에는 반드시 하나의 중재 오행이 자리합니다. {{이름}}님 사주에서 이 {{총쌍수}}개의 갈등 구조가 어떤 양상을 보이는지, 철학적 시선으로 하나씩 들여다보겠습니다.',
  '상극이란 자연의 제어 장치이며, 통관이란 그 제어가 과도해지지 않도록 조율하는 균형추와 같은 것이지요. {{이름}}님 사주의 {{총쌍수}} 상극 쌍을 하나하나 살펴 그 속에 숨은 조화의 가능성을 읽어보겠습니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  통관 쌍 추출
// ─────────────────────────────────────────────────────────────────────────────

interface TongguanPair {
  from: string;
  to: string;
  bridge: string;
  strength: number;
}

/** 기본 5쌍 (상극 관계 + bridge) */
const DEFAULT_PAIRS: TongguanPair[] = [
  { from: 'WOOD', to: 'EARTH', bridge: 'FIRE', strength: 0 },
  { from: 'EARTH', to: 'WATER', bridge: 'METAL', strength: 0 },
  { from: 'WATER', to: 'FIRE', bridge: 'WOOD', strength: 0 },
  { from: 'FIRE', to: 'METAL', bridge: 'EARTH', strength: 0 },
  { from: 'METAL', to: 'WOOD', bridge: 'WATER', strength: 0 },
];

function extractTongguanPairs(input: ReportInput): TongguanPair[] {
  // saju 객체에서 tongguan 데이터를 안전하게 추출
  const saju = input.saju as Record<string, unknown>;

  // rules.facts.tongguan.pairs 경로 탐색
  const rules = saju['rules'] as Record<string, unknown> | undefined;
  const facts = (rules?.['facts'] ?? saju['facts']) as Record<string, unknown> | undefined;
  const tongguan = (facts?.['tongguan'] ?? saju['tongguan']) as Record<string, unknown> | undefined;
  const rawPairs = tongguan?.['pairs'] as Array<Record<string, unknown>> | undefined;

  if (Array.isArray(rawPairs) && rawPairs.length > 0) {
    return rawPairs.map(p => ({
      from: (p['from'] ?? p['elementA'] ?? '') as string,
      to: (p['to'] ?? p['elementB'] ?? '') as string,
      bridge: (p['bridge'] ?? '') as string,
      strength: (typeof p['strength'] === 'number' ? p['strength'] : 0),
    }));
  }

  // 데이터가 없으면 기본 5쌍 반환
  return DEFAULT_PAIRS.map(p => ({ ...p }));
}

function getPracticalRelationLine(from: ElementCode, to: ElementCode): string {
  const relation = describeElementPair(from, to);
  return relation.practicalUseCases[0] ?? relation.easyExplanation;
}

function buildPracticalTongguanGuide(pair: TongguanPair): string {
  const fromCode = asElementCode(pair.from);
  const toCode = asElementCode(pair.to);
  const bridgeCode = asElementCode(pair.bridge);

  if (!fromCode || !toCode) {
    return '실전에서는 우선순위와 마감 기준을 먼저 정해 갈등을 줄이는 습관이 좋아요.';
  }

  const pairPractical = getPracticalRelationLine(fromCode, toCode);
  if (!bridgeCode) {
    return `실전에서는 ${pairPractical}`;
  }

  const bridgeInPractical = getPracticalRelationLine(fromCode, bridgeCode);
  const bridgeOutPractical = getPracticalRelationLine(bridgeCode, toCode);
  return `실전에서는 ${pairPractical} 통관 ${elFull(bridgeCode)}은 ${bridgeInPractical} 또 ${bridgeOutPractical}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  쌍별 철학적 해석 생성
// ─────────────────────────────────────────────────────────────────────────────

function generatePairNarrative(
  rng: SeededRandom,
  pair: TongguanPair,
): string {
  const key = `${pair.from}→${pair.to}`;
  const metaphors = PAIR_METAPHORS[key];

  // 강도 레이블 판정
  const strengthLabel = pair.strength >= 0.7 ? '강함'
    : pair.strength >= 0.3 ? '보통'
    : '약함';

  // 비유적 해석 선택
  let metaphor: string;
  if (metaphors && metaphors.length > 0) {
    metaphor = rng.pick(metaphors);
  } else {
    // 매핑에 없는 경우 범용 생성
    metaphor = `${elFull(pair.from)}${elFull(pair.to)}을 극할 때, ${elFull(pair.bridge)}${elFull(pair.from)}의 기운을 받아 ${elFull(pair.to)}에게 전달하는 중재자 역할을 하는 이치에요.`;
  }

  // 강도 코멘트 추가
  const commentPool = STRENGTH_COMMENTARY[strengthLabel];
  const comment = commentPool ? rng.pick(commentPool) : '';
  const practicalGuide = buildPracticalTongguanGuide(pair);

  // 강도가 0이면 코멘트 생략
  if (pair.strength > 0 && comment) {
    return `${metaphor} ${comment} ${practicalGuide}`;
  }
  return `${metaphor} ${practicalGuide}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  상극 관계 한글 표기
// ─────────────────────────────────────────────────────────────────────────────

function pairLabel(from: string, to: string): string {
  return `${elShort(from)}극${elShort(to)}(${elHanja(from)}剋${elHanja(to)})`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  메인 생성 함수
// ─────────────────────────────────────────────────────────────────────────────

export function generateTongguanSection(input: ReportInput): ReportSection | null {
  const rng = createRng(input);
  for (let i = 0; i < 14; i++) rng.next();

  const name = safeName(input);
  const pairs = extractTongguanPairs(input);

  const paragraphs: ReportParagraph[] = [];

  // 1. 도입 — 철학적 서두
  const introText = rng.pick(INTRO_TEMPLATES).replace('{{이름}}', name);
  paragraphs.push(narrative(introText));

  // 2. 개관 — 전체 조망
  const overviewText = pickAndFill(rng, OVERVIEW_TEMPLATES, {
    이름: name,
    총쌍수: String(pairs.length),
  });
  paragraphs.push(emphasis(overviewText));

  // 3. 각 쌍별 철학적 분석
  for (const pair of pairs) {
    const pairNarrative = generatePairNarrative(rng, pair);
    const label = pairLabel(pair.from, pair.to);
    const bridgeEl = pair.bridge as ElementCode;

    // 쌍 헤더 + 비유적 해석을 하나의 단락으로
    const fullText = `[${label} — 통관: ${elFull(pair.bridge)}] ${pairNarrative}`;

    // 강한 상극은 caution 톤, 나머지는 중립/긍정
    if (pair.strength >= 0.7) {
      paragraphs.push(emphasis(fullText, bridgeEl));
    } else {
      paragraphs.push(narrative(fullText, bridgeEl));
    }
  }

  // 4. 마무리 — 철학적 결론
  const closingText = rng.pick(CLOSING_TEMPLATES).replace('{{이름}}', name);
  paragraphs.push(encouraging(closingText));

  // 5. 통관 분석 테이블
  const table: ReportTable = {
    title: '통관(通關) 분석표 — 상극 쌍과 중재 오행',
    headers: ['상극 관계', '극하는 오행', '극받는 오행', '통관(bridge) 오행', '갈등 강도'],
    rows: pairs.map(p => [
      pairLabel(p.from, p.to),
      elFull(p.from),
      elFull(p.to),
      elFull(p.bridge),
      p.strength > 0 ? `${Math.round(p.strength * 100)}%` : '—',
    ]),
  };

  // 6. 하이라이트 — 가장 강한 상극 쌍 + 총 쌍수
  const sortedPairs = [...pairs].sort((a, b) => b.strength - a.strength);
  const strongestPair = sortedPairs[0];
  const highlights: ReportHighlight[] = [];

  highlights.push({
    label: '통관 쌍 수',
    value: `${pairs.length}쌍`,
    sentiment: 'neutral',
  });

  if (strongestPair && strongestPair.strength > 0) {
    highlights.push({
      label: '가장 강한 상극',
      value: `${elShort(strongestPair.from)}→${elShort(strongestPair.to)} (통관: ${elShort(strongestPair.bridge)}, ${Math.round(strongestPair.strength * 100)}%)`,
      element: strongestPair.bridge as ElementCode,
      sentiment: 'caution',
    });
  }

  // 통관 오행이 사주에 있는지 체크 (원국 오행 분포 참조)
  const activeBridges = pairs.filter(p => p.strength > 0 && p.strength < 0.3);
  const tenseBridges = pairs.filter(p => p.strength >= 0.7);
  if (tenseBridges.length > 0) {
    highlights.push({
      label: '강한 갈등 수',
      value: `${tenseBridges.length}쌍 — 통관 보충 권장`,
      sentiment: 'caution',
    });
  } else if (activeBridges.length === pairs.length || pairs.every(p => p.strength === 0)) {
    highlights.push({
      label: '갈등 수준',
      value: '전반적으로 안정',
      sentiment: 'good',
    });
  }

  return {
    id: 'tongguan',
    title: '통관(通關) 분석',
    subtitle: '갈등을 넘어 조화로 — 상극의 중재 오행을 찾아서',
    paragraphs,
    tables: [table],
    highlights: highlights.length > 0 ? highlights : undefined,
  };
}
