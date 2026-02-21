/**
 * part2-elements.ts -- 오행 분포 분석 섹션 생성기
 *
 * PART 2-1: 천간·지지·통합 오행 분포를 시각화하고 해설합니다.
 *
 * 페르소나: "호기심 많은 과학 교사"
 * - 오행을 원소주기율표·화학반응·에너지 스펙트럼 등 과학 비유로 설명
 * - "함께 실험해 볼까요?", "데이터가 말해주는 건..." 같은 탐구적 톤
 * - 누구나 이해할 수 있는 쉬운 한국어 존댓말
 *
 * - SeededRandom으로 동일 입력이면 동일 결과를 보장하면서도
 *   다양한 템플릿 변형을 제공합니다.
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
  ELEMENT_HANJA,
  ELEMENT_COLOR,
  ELEMENT_SEASON,
  ELEMENT_NATURE,
  ELEMENT_ORGAN,
  ELEMENT_EMOTION,
  ELEMENT_DIRECTION,
  elementCodeToKorean,
} from '../common/elementMaps.js';

import {
  createRng,
  pickAndFill,
  narrative,
  positive,
  tip,
  emphasis,
  encouraging,
  joinSentences,
  eunNeun,
  iGa,
  eulReul,
  pct,
  type SeededRandom,
} from '../common/sentenceUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
//  상수
// ─────────────────────────────────────────────────────────────────────────────

const ELEMENTS: ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

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

// ─────────────────────────────────────────────────────────────────────────────
//  도입 템플릿 (8개 — 과학 실험/연구 비유)
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_TEMPLATES: readonly string[] = [
  '오행(五行)은 마치 원소주기율표처럼 세상을 구성하는 다섯 가지 근본 요소예요. 나무(木), 불(火), 흙(土), 쇠(金), 물(水) — 이 다섯 기운이 사주에 얼마만큼 들어 있는지 분석하면, 마치 혈액검사 결과를 읽듯이 나의 에너지 체질을 정확히 파악할 수 있답니다.',
  '과학 시간에 물질의 성분비를 분석하듯, 사주에서도 오행의 비율을 분석해 볼 수 있어요. 목·화·토·금·수 다섯 원소가 어떤 비율로 섞여 있느냐에 따라 성격, 체질, 재능이 달라지거든요. 함께 이 흥미로운 실험 결과를 살펴볼까요?',
  '화학에서 원소 분석을 하면 물질의 정체를 알 수 있듯이, 사주에서 오행 분포를 분석하면 나의 타고난 에너지 밸런스를 알 수 있어요. 오행은 동양 철학이 발견한 다섯 가지 기본 에너지 — 목(木), 화(火), 토(土), 금(金), 수(水)랍니다.',
  '실험실에서 용액의 pH를 측정하듯, 사주에서는 오행의 분포를 측정해요. 목·화·토·금·수라는 다섯 가지 에너지가 어떤 농도로 섞여 있는지 — 이 데이터가 나의 성격과 체질의 비밀을 풀어 주는 열쇠거든요!',
  '과학자들이 별빛을 스펙트럼으로 분해해서 별의 성분을 알아내는 것처럼, 사주명리학에서는 오행 분석을 통해 내 안의 에너지 구성을 읽어내요. 목(木), 화(火), 토(土), 금(金), 수(水) — 이 다섯 파장의 에너지가 사주에 어떻게 분포되어 있는지 함께 관찰해 볼게요!',
  '물리학에서 에너지는 절대 사라지지 않고 형태만 바뀐다고 하죠? 오행도 마찬가지예요. 목·화·토·금·수 다섯 에너지는 서로 낳고(상생), 서로 견제하며(상극) 끊임없이 순환해요. 지금부터 이 에너지 순환의 출발점인 오행 분포를 분석해 보겠습니다.',
  '생태학자가 생태계의 종 다양성을 조사하듯이, 사주에서도 오행의 다양성과 균형을 조사할 수 있어요. 나무, 불, 흙, 금속, 물 — 이 다섯 가지 자연 원소가 사주에 얼마나 고르게 들어 있는지가 중요하거든요. 데이터를 확인해 볼까요?',
  '과학 실험에서 가장 중요한 건 정확한 측정이에요. 사주의 오행 분석도 마찬가지랍니다! 목(木)·화(火)·토(土)·금(金)·수(水) 다섯 에너지를 정량적으로 측정해서, 어떤 에너지가 풍부하고 어떤 에너지가 부족한지 객관적인 숫자로 확인할 수 있어요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  분포 요약 템플릿 (6개)
// ─────────────────────────────────────────────────────────────────────────────

const DISTRIBUTION_TEMPLATES: readonly string[] = [
  '{{이름}}님의 사주 오행 분석 결과가 나왔어요! 데이터가 말해주는 건 이래요: 가장 풍부한 에너지는 {{최강오행}}이고, 가장 희소한 에너지는 {{최약오행}}이에요.',
  '실험 결과를 발표하겠습니다! {{이름}}님의 사주에서 {{최강오행}} 에너지 농도가 가장 높고, {{최약오행}} 에너지 농도가 가장 낮게 측정되었어요.',
  '스펙트럼 분석 결과, {{이름}}님의 에너지 구성에서 {{최강오행}}이 주도적인 파장을 보이고, {{최약오행}}은 상대적으로 미약한 신호를 보내고 있네요.',
  '{{이름}}님의 오행 성분 분석표를 보면, {{최강오행}} 함량이 가장 높고 {{최약오행}} 함량이 가장 낮아요. 이 비율이 {{이름}}님만의 고유한 에너지 시그니처를 만들어 내는 거예요.',
  '측정 데이터를 정리해 보면, {{이름}}님의 사주에서 {{최강오행}} 기운이 가장 진하게 검출되고, {{최약오행}} 기운은 미량만 포함되어 있어요. 흥미로운 결과죠?',
  '{{이름}}님의 에너지 밸런스 리포트를 보면 {{최강오행}}이 가장 두드러지고, {{최약오행}}이 보완 필요 구간이에요. 마치 영양소 균형 검사처럼 과잉과 부족을 한눈에 볼 수 있답니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  오행별 과학 비유 해석 템플릿 — 각 오행마다 다양한 과학 비유
// ─────────────────────────────────────────────────────────────────────────────

const ELEMENT_SCIENCE_METAPHOR: Record<ElementCode, readonly string[]> = {
  WOOD: [
    '목(木)은 광합성하는 식물처럼 빛을 에너지로 바꾸는 성장의 기운이에요. 이 기운이 {{강약}}하다는 것은 {{의미}}.',
    '목(木)은 DNA의 이중나선처럼 끊임없이 뻗어 나가는 생명력이에요. 사주에서 이 기운이 {{강약}}하다는 건 {{의미}}.',
    '마치 봄날 땅을 뚫고 나오는 새싹의 힘처럼, 목(木)은 위를 향해 자라나는 에너지를 상징해요. 이 에너지가 {{강약}}하니, {{의미}}.',
    '생물학에서 줄기세포가 다양한 세포로 분화하듯, 목(木) 기운은 무한한 가능성을 품고 있어요. {{강약}}한 이 기운은 {{의미}}.',
  ],
  FIRE: [
    '화(火)는 태양의 핵융합 에너지처럼 강렬하고 빛나는 기운이에요. 이 기운이 {{강약}}하다는 것은 {{의미}}.',
    '화(火)는 전기 회로에 흐르는 전류처럼 활발하고 역동적인 에너지예요. 사주에서 이 기운이 {{강약}}한 것은 {{의미}}.',
    '화학 반응에서 발열 반응처럼 주변에 에너지를 전달하는 게 화(火)의 본질이에요. {{강약}}한 이 기운은 {{의미}}.',
    '마치 밤하늘을 밝히는 별빛처럼, 화(火) 기운은 열정과 표현력의 에너지랍니다. 이 에너지가 {{강약}}하니, {{의미}}.',
  ],
  EARTH: [
    '토(土)는 만유인력처럼 모든 것을 끌어안고 중심을 잡아 주는 기운이에요. 이 기운이 {{강약}}하다는 것은 {{의미}}.',
    '토(土)는 지질학에서 말하는 지각판처럼 모든 것의 기반이 되는 에너지예요. 사주에서 이 기운이 {{강약}}한 것은 {{의미}}.',
    '화학에서 촉매가 반응을 중개하듯, 토(土)는 다른 오행 사이를 조율하는 중재자 역할을 해요. {{강약}}한 이 기운은 {{의미}}.',
    '마치 생태계의 토양처럼 모든 생명의 터전이 되는 게 토(土) 기운이에요. 이 에너지가 {{강약}}하니, {{의미}}.',
  ],
  METAL: [
    '금(金)은 다이아몬드의 결정 구조처럼 정밀하고 단단한 기운이에요. 이 기운이 {{강약}}하다는 것은 {{의미}}.',
    '금(金)은 레이저 빔처럼 하나에 집중하는 수렴의 에너지예요. 사주에서 이 기운이 {{강약}}한 것은 {{의미}}.',
    '금속의 전기 전도성처럼 빠르고 명확하게 흐르는 게 금(金) 에너지의 특징이에요. {{강약}}한 이 기운은 {{의미}}.',
    '물리학에서 절대영도에 가까워질수록 물질이 질서를 갖추듯, 금(金)은 정리·정돈·명확함의 에너지랍니다. 이 에너지가 {{강약}}하니, {{의미}}.',
  ],
  WATER: [
    '수(水)는 양자역학처럼 깊고 신비로운 지혜의 기운이에요. 이 기운이 {{강약}}하다는 것은 {{의미}}.',
    '수(水)는 바다의 해류처럼 보이지 않게 흐르면서 거대한 영향을 미치는 에너지예요. 사주에서 이 기운이 {{강약}}한 것은 {{의미}}.',
    '물의 수소 결합처럼 유연하지만 강인한 힘을 가진 게 수(水) 에너지의 본질이에요. {{강약}}한 이 기운은 {{의미}}.',
    '과학에서 물이 세 가지 상태(고체·액체·기체)로 변하듯, 수(水) 기운은 뛰어난 적응력을 상징해요. 이 에너지가 {{강약}}하니, {{의미}}.',
  ],
};

/** 오행이 강할 때 의미 */
const STRONG_MEANINGS: Record<ElementCode, readonly string[]> = {
  WOOD: [
    '성장 욕구와 추진력이 강하다는 뜻이에요',
    '새로운 시작을 두려워하지 않는 개척 정신이 있다는 의미예요',
    '진취적이고 발전 지향적인 성향이 뚜렷하다고 할 수 있어요',
  ],
  FIRE: [
    '표현력과 열정이 넘치는 에너지 체질이라는 뜻이에요',
    '밝고 따뜻한 카리스마가 자연스럽게 드러나는 타입이라는 의미예요',
    '적극적이고 활력이 넘치는 성격을 타고났다는 걸 보여 줘요',
  ],
  EARTH: [
    '안정감과 포용력이 큰 사람이라는 뜻이에요',
    '신뢰를 주는 든든한 리더 기질이 있다는 의미예요',
    '중심을 잘 잡고 주변을 조율하는 능력이 탁월하다는 걸 알 수 있어요',
  ],
  METAL: [
    '분석력과 판단력이 뛰어나다는 뜻이에요',
    '결단력이 있고 목표를 향해 일직선으로 나아가는 추진력이 있다는 의미예요',
    '정확하고 체계적인 사고를 타고났다는 걸 보여 주네요',
  ],
  WATER: [
    '깊은 사고력과 뛰어난 적응력을 지녔다는 뜻이에요',
    '직관력이 뛰어나고 유연한 대처 능력이 있다는 의미예요',
    '지혜롭고 상황 판단이 빠른 성향이 잘 나타나네요',
  ],
};

/** 오행이 약할 때 의미 */
const WEAK_MEANINGS: Record<ElementCode, readonly string[]> = {
  WOOD: [
    '자기 주장을 내세우기보다 조화를 중시하는 경향이 있다는 뜻이에요',
    '시작하는 힘보다는 마무리하는 힘이 더 강한 타입이라는 의미예요',
    '새로운 도전보다 안정을 선호하는 성향이 엿보인다고 할 수 있어요',
  ],
  FIRE: [
    '조용하고 차분한 에너지가 더 강하다는 뜻이에요',
    '자기 표현보다 내면의 깊이를 추구하는 타입이라는 의미예요',
    '열정보다는 이성적 판단이 앞서는 성향이 엿보이네요',
  ],
  EARTH: [
    '변화에 적응하는 유연성이 오히려 강점이 될 수 있다는 뜻이에요',
    '한곳에 머무르기보다 다양한 경험을 추구하는 성향이라는 의미예요',
    '안정보다 자유를 중시하는 면이 있다고 할 수 있어요',
  ],
  METAL: [
    '경직된 규칙보다 유연한 사고를 선호한다는 뜻이에요',
    '논리보다 감성이 앞서는 예술가적 기질이 있다는 의미예요',
    '칼같은 결단보다 포용적인 결정을 하는 경향이 있네요',
  ],
  WATER: [
    '깊이 파기보다 넓게 보는 시야가 강점이라는 뜻이에요',
    '분석적 사고보다 실천력이 뛰어난 타입이라는 의미예요',
    '고민하기보다 행동으로 옮기는 성향이 두드러진다고 할 수 있어요',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  레이어별 해설 템플릿
// ─────────────────────────────────────────────────────────────────────────────

const HEAVEN_LAYER_TEMPLATES: readonly string[] = [
  '먼저 천간(天干) 레이어를 관찰해 볼게요. 천간은 하늘에서 내려오는 에너지로, 외부에 드러나는 성격이나 겉으로 보이는 모습과 관련이 깊어요.',
  '하늘의 에너지인 천간(天干)부터 측정해 보겠습니다. 천간은 사주의 윗줄에 해당하며, 나의 겉모습과 표면적인 성향을 보여 주거든요.',
  '첫 번째 측정 레이어는 천간(天干)이에요. 대기의 성분 분석처럼, 하늘 기운의 오행 분포를 확인해 보겠습니다.',
];

const HIDDEN_LAYER_TEMPLATES: readonly string[] = [
  '이번에는 지지(地支)와 지장간 레이어를 분석해 볼게요. 지하 광맥을 탐사하듯, 땅속에 숨어 있는 에너지를 조사하는 거예요.',
  '다음은 지지(地支) 레이어입니다. 지구 내부의 마그마처럼 표면 아래에 감춰진 기운을 포함해서 분석하는 거예요.',
  '두 번째 측정 레이어는 지지(地支)와 지장간이에요. 지장간은 지지 속에 숨어 있는 천간으로, 해양학자가 심해를 탐사하듯 깊은 곳의 에너지를 읽어내는 작업이랍니다.',
];

const TOTAL_LAYER_TEMPLATES: readonly string[] = [
  '이제 천간과 지지를 모두 합산한 통합 데이터를 살펴보겠습니다. 모든 레이어를 종합하면 더 정확한 에너지 프로필을 얻을 수 있어요.',
  '마지막으로 모든 레이어를 합친 통합 분포를 확인해 보겠습니다. 과학에서 여러 실험 결과를 종합하면 더 신뢰도가 높아지는 것처럼, 통합 데이터가 가장 정확한 에너지 지도를 보여 줘요.',
  '천간과 지지를 통합한 종합 오행 분포를 발표하겠습니다. 대기와 지각의 데이터를 모두 합산한 총체적 에너지 분석 결과라고 할 수 있어요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  마무리 템플릿 (과학자/교사 톤)
// ─────────────────────────────────────────────────────────────────────────────

const CLOSING_TEMPLATES: readonly string[] = [
  '이렇게 오행 분포를 데이터로 확인해 보니, 나의 에너지 체질이 객관적으로 보이시죠? 과학적으로 접근하면 사주도 훨씬 흥미로워진답니다. 다음 섹션에서는 이 분포에서 과다·결핍이 무엇을 의미하는지 더 깊이 탐구해 볼게요!',
  '실험 결과 발표가 끝났어요! 오행 분포는 나의 에너지 "원소 분석표"와 같아서, 강점을 살리고 부족한 부분을 보완하는 데 아주 유용한 데이터랍니다. 다음 분석도 기대해 주세요!',
  '데이터는 거짓말을 하지 않아요. 오행 분포가 보여 주는 에너지 균형 상태를 잘 기억해 두세요. 이어서 과다와 결핍이 건강, 성격, 직업에 어떤 영향을 미치는지 함께 알아보겠습니다!',
  '여기까지가 오행 분포의 기초 분석이었어요. 좋은 과학 실험은 관찰에서 시작되듯이, 지금 이 데이터가 모든 사주 분석의 출발점이 된답니다. 다음에는 더 심층적인 진단으로 넘어가 볼게요!',
  '마치 건강검진 결과를 확인한 것처럼, 오행 분포를 통해 나의 에너지 밸런스를 한눈에 파악했어요. 이 데이터를 바탕으로 앞으로 더 풍부한 해석이 이어질 거예요. 함께 계속 탐구해 볼까요?',
  '과학은 측정에서 시작되고, 사주 분석도 이 오행 분포 측정에서 시작돼요. 지금까지의 데이터를 잘 간직하고, 다음 단계인 과다·결핍 진단을 기대해 주세요!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  분포 데이터 추출 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

interface ElementDist {
  code: ElementCode;
  value: number;
  pctText: string;
  pctValue: number;
}

/** 특정 레이어의 오행 분포를 추출 */
function flattenLayer(layer: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!layer || typeof layer !== 'object') return result;
  for (const [k, v] of Object.entries(layer as Record<string, unknown>)) {
    if (typeof v === 'number' && ELEMENTS.includes(k as ElementCode)) {
      result[k] = v;
    }
  }
  return result;
}

/** 레코드를 ElementDist[] 배열로 변환 */
function toDist(flat: Record<string, number>): ElementDist[] {
  const total = Object.values(flat).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) || 1;
  return ELEMENTS.map(el => {
    const value = typeof flat[el] === 'number' ? flat[el] : 0;
    const pctValue = value / total;
    return {
      code: el,
      value,
      pctText: `${Math.round(pctValue * 100)}%`,
      pctValue,
    };
  });
}

/**
 * input.saju.elementDistribution에서 세 레이어(heaven, hidden, total) + 평탄 맵을 모두 핸들링.
 * 형태 1: {WOOD: n, FIRE: n, ...}  — flat
 * 형태 2: {heaven: {...}, hidden: {...}, total: {...}}  — layered
 */
interface LayeredDistribution {
  heaven: ElementDist[];
  hidden: ElementDist[];
  total: ElementDist[];
  normalized: ElementDist[];
  hasLayers: boolean;
}

function extractDistribution(input: ReportInput): LayeredDistribution | null {
  const raw = input.saju.elementDistribution as Record<string, unknown> | undefined;
  if (!raw || Object.keys(raw).length === 0) return null;

  // 형태 2: 중첩 구조 {heaven, hidden, total}
  const hasHeavenKey = raw['heaven'] && typeof raw['heaven'] === 'object';
  const hasTotalKey = raw['total'] && typeof raw['total'] === 'object';
  const hasHiddenKey = raw['hidden'] && typeof raw['hidden'] === 'object';

  let heavenFlat: Record<string, number> = {};
  let hiddenFlat: Record<string, number> = {};
  let totalFlat: Record<string, number> = {};

  if (hasHeavenKey || hasTotalKey || hasHiddenKey) {
    // 레이어가 있는 구조
    heavenFlat = flattenLayer(raw['heaven']);
    hiddenFlat = flattenLayer(raw['hidden']);
    if (hasTotalKey) {
      totalFlat = flattenLayer(raw['total']);
    } else {
      // total이 없으면 heaven + hidden 합산
      for (const el of ELEMENTS) {
        totalFlat[el] = (heavenFlat[el] ?? 0) + (hiddenFlat[el] ?? 0);
      }
    }
  } else {
    // 형태 1: flat 구조 {WOOD: n, FIRE: n, ...}
    for (const el of ELEMENTS) {
      const v = raw[el];
      totalFlat[el] = typeof v === 'number' ? v : 0;
    }
  }

  const hasLayers = (hasHeavenKey || hasHiddenKey) as boolean;

  // 통합 분포 정규화 (%) — rules.facts.elements.normalized가 있으면 사용, 없으면 직접 계산
  let normalizedFlat: Record<string, number> = {};
  const springData = input.spring as Record<string, unknown> | undefined;
  const rulesData = springData?.['rules'] as Record<string, unknown> | undefined;
  const factsData = rulesData?.['facts'] as Record<string, unknown> | undefined;
  const elementsData = factsData?.['elements'] as Record<string, unknown> | undefined;
  const normalizedRaw = elementsData?.['normalized'] as Record<string, unknown> | undefined;

  if (normalizedRaw) {
    for (const el of ELEMENTS) {
      const v = normalizedRaw[el];
      normalizedFlat[el] = typeof v === 'number' ? v : 0;
    }
  } else {
    // 자체 정규화: total 기준 비율
    const totalSum = Object.values(totalFlat).reduce((a, b) => a + b, 0) || 1;
    for (const el of ELEMENTS) {
      normalizedFlat[el] = (totalFlat[el] ?? 0) / totalSum;
    }
  }

  return {
    heaven: toDist(heavenFlat),
    hidden: toDist(hiddenFlat),
    total: toDist(totalFlat),
    normalized: toDist(normalizedFlat),
    hasLayers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  오행별 해석 문장 생성
// ─────────────────────────────────────────────────────────────────────────────

function makeElementAnalysis(
  rng: SeededRandom,
  el: ElementDist,
  rank: number,
  totalCount: number,
): string {
  const templates = ELEMENT_SCIENCE_METAPHOR[el.code];
  const isStrong = rank <= 1;
  const isWeak = rank >= totalCount - 1;

  let strengthWord: string;
  let meanings: readonly string[];

  if (isStrong) {
    strengthWord = '풍부';
    meanings = STRONG_MEANINGS[el.code];
  } else if (isWeak) {
    strengthWord = '미량';
    meanings = WEAK_MEANINGS[el.code];
  } else {
    strengthWord = '적정';
    meanings = [
      '균형 잡힌 에너지 상태를 유지하고 있다는 뜻이에요',
      '적절한 수준의 기운을 지니고 있다는 걸 보여 줘요',
      '과하지도 부족하지도 않은 안정적인 상태라고 할 수 있어요',
    ];
  }

  const meaning = rng.pick(meanings);
  return pickAndFill(rng, templates, { 강약: strengthWord, 의미: meaning });
}

// ─────────────────────────────────────────────────────────────────────────────
//  레이어별 미니 테이블 생성
// ─────────────────────────────────────────────────────────────────────────────

function makeLayerTable(title: string, dist: ElementDist[]): ReportTable {
  return {
    title,
    headers: ['오행', '한자', '수치', '비율'],
    rows: dist.map(el => [
      elShort(el.code),
      elHanja(el.code),
      String(Math.round(el.value * 100) / 100),
      el.pctText,
    ]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  메인 생성 함수
// ─────────────────────────────────────────────────────────────────────────────

export function generateElementsSection(input: ReportInput): ReportSection | null {
  const layered = extractDistribution(input);
  if (!layered) return null;

  const rng = createRng(input);
  for (let i = 0; i < 10; i++) rng.next(); // 고유 오프셋

  const name = safeName(input);
  const total = layered.total;
  const sorted = [...total].sort((a, b) => b.value - a.value);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  // 모든 값이 0이면 null 반환
  if (sorted.every(el => el.value === 0)) return null;

  const paragraphs: ReportParagraph[] = [];
  const tables: ReportTable[] = [];

  // ── 1) 도입부 (과학 교사 톤) ──

  paragraphs.push(narrative(rng.pick(INTRO_TEMPLATES)));

  // ── 2) 레이어별 분석 (layered 구조인 경우) ──

  if (layered.hasLayers) {
    // 천간 레이어
    const heavenNonZero = layered.heaven.some(el => el.value > 0);
    if (heavenNonZero) {
      paragraphs.push(narrative(rng.pick(HEAVEN_LAYER_TEMPLATES)));
      const heavenSorted = [...layered.heaven].sort((a, b) => b.value - a.value);
      const heavenTop = heavenSorted[0];
      paragraphs.push(narrative(
        `천간에서는 ${elFull(heavenTop.code)} 에너지가 가장 강하게 관측되었어요 (${heavenTop.pctText}).`,
        heavenTop.code,
      ));
      tables.push(makeLayerTable('천간 오행 분포', layered.heaven));
    }

    // 지지 레이어
    const hiddenNonZero = layered.hidden.some(el => el.value > 0);
    if (hiddenNonZero) {
      paragraphs.push(narrative(rng.pick(HIDDEN_LAYER_TEMPLATES)));
      const hiddenSorted = [...layered.hidden].sort((a, b) => b.value - a.value);
      const hiddenTop = hiddenSorted[0];
      paragraphs.push(narrative(
        `지지(지장간 포함)에서는 ${elFull(hiddenTop.code)} 에너지가 가장 높은 수치를 기록했어요 (${hiddenTop.pctText}).`,
        hiddenTop.code,
      ));
      tables.push(makeLayerTable('지지(지장간 포함) 오행 분포', layered.hidden));
    }

    // 통합 레이어
    paragraphs.push(narrative(rng.pick(TOTAL_LAYER_TEMPLATES)));
  }

  // ── 3) 통합 분포 요약 ──

  const distText = pickAndFill(rng, DISTRIBUTION_TEMPLATES, {
    이름: name,
    최강오행: elFull(strongest.code),
    최약오행: elFull(weakest.code),
  });
  paragraphs.push(emphasis(distText));

  // ── 4) 각 오행별 과학 비유 해석 (내림차순 정렬) ──

  for (let i = 0; i < sorted.length; i++) {
    const el = sorted[i];
    const analysis = makeElementAnalysis(rng, el, i, sorted.length);
    paragraphs.push(narrative(
      `${analysis} (${el.pctText}, ${Math.round(el.value * 100) / 100}점)`,
      el.code,
    ));
  }

  // ── 5) 결핍/과다 오행 참고 정보 ──

  const deficient = input.saju.deficientElements ?? [];
  const excessive = input.saju.excessiveElements ?? [];

  if (deficient.length > 0 || excessive.length > 0) {
    const parts: string[] = [];
    if (excessive.length > 0) {
      const excessNames = excessive.map(e => elFull(e)).join(', ');
      parts.push(`과다 오행은 ${excessNames}`);
    }
    if (deficient.length > 0) {
      const defNames = deficient.map(e => elFull(e)).join(', ');
      parts.push(`결핍 오행은 ${defNames}`);
    }
    paragraphs.push(tip(
      `참고로, 사주 엔진이 진단한 ${parts.join('이고, ')}이에요. 마치 영양소 과잉·결핍 진단서처럼, 이 정보가 보완 방향을 알려 주는 나침반이 된답니다.`,
    ));
  }

  // ── 6) 마무리 (과학자/교사 톤) ──

  paragraphs.push(encouraging(rng.pick(CLOSING_TEMPLATES)));

  // ── 테이블: 통합 오행 분포표 ──

  const mainTable: ReportTable = {
    title: '통합 오행 분포표',
    headers: ['오행', '한자', '점수', '비율', '색상', '계절', '방위', '관련 장기'],
    rows: sorted.map(el => [
      elShort(el.code),
      elHanja(el.code),
      String(Math.round(el.value * 100) / 100),
      el.pctText,
      ELEMENT_COLOR[el.code] ?? '',
      ELEMENT_SEASON[el.code] ?? '',
      ELEMENT_DIRECTION[el.code] ?? '',
      ELEMENT_ORGAN[el.code]?.main ?? '',
    ]),
  };
  tables.push(mainTable);

  // 정규화 비율 테이블
  const normalizedSorted = [...layered.normalized].sort((a, b) => b.value - a.value);
  const normalizedTable: ReportTable = {
    title: '오행 정규화 비율 (%)',
    headers: ['오행', '정규화 비율'],
    rows: normalizedSorted.map(el => [
      elFull(el.code),
      el.pctText,
    ]),
  };
  tables.push(normalizedTable);

  // ── 바 차트 데이터 ──

  const chartData: Record<string, number> = {};
  for (const el of total) {
    chartData[elShort(el.code)] = Math.round(el.value * 100) / 100;
  }

  const barChart: ReportChart = {
    type: 'bar',
    title: '오행 분포 차트 (목/화/토/금/수)',
    data: chartData,
    meta: {
      labels: ELEMENTS.map(el => elShort(el)),
      percentages: Object.fromEntries(
        total.map(el => [elShort(el.code), el.pctText]),
      ),
    },
  };

  // ── 하이라이트 ──

  const highlights: ReportHighlight[] = [
    {
      label: '가장 풍부한 오행',
      value: `${elFull(strongest.code)} (${strongest.pctText})`,
      element: strongest.code,
      sentiment: 'good',
    },
    {
      label: '가장 희소한 오행',
      value: `${elFull(weakest.code)} (${weakest.pctText})`,
      element: weakest.code,
      sentiment: 'caution',
    },
  ];

  // 결핍/과다 하이라이트 추가
  if (excessive.length > 0) {
    highlights.push({
      label: '과다 진단 오행',
      value: excessive.map(e => elFull(e)).join(', '),
      element: excessive[0] as ElementCode | undefined,
      sentiment: 'caution',
    });
  }
  if (deficient.length > 0) {
    highlights.push({
      label: '결핍 진단 오행',
      value: deficient.map(e => elFull(e)).join(', '),
      element: deficient[0] as ElementCode | undefined,
      sentiment: 'caution',
    });
  }

  return {
    id: 'elements',
    title: '오행(五行) 분포 분석',
    subtitle: '과학적으로 살펴보는 나의 에너지 스펙트럼',
    paragraphs,
    tables,
    charts: [barChart],
    highlights,
  };
}
