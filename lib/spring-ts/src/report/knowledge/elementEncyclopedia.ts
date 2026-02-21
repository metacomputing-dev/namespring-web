/**
 * elementEncyclopedia.ts -- Five Elements (오행) knowledge base
 *
 * Detailed interpretations for each of the five elements (Wood, Fire, Earth,
 * Metal, Water) including associated colors, directions, numbers, tastes,
 * seasons, organs, emotions, and practical supplementation tips based on
 * traditional saju (四柱) theory.
 */

export interface ElementEncyclopediaEntry {
  readonly korean: string;
  readonly hanja: string;
  readonly nature: string;
  readonly color: string;
  readonly direction: string;
  readonly numbers: [number, number];
  readonly taste: string;
  readonly season: string;
  readonly timeOfDay: string;
  readonly organ: { main: string; sub: string };
  readonly emotion: { positive: string; negative: string };
  readonly deficientMeaning: string;
  readonly excessiveMeaning: string;
  readonly supplementTips: readonly string[];
}

export const ELEMENT_ENCYCLOPEDIA: Record<string, ElementEncyclopediaEntry> = {
  WOOD: {
    korean: '목',
    hanja: '木',
    nature: '나무처럼 위로 뻗어 자라는 성장의 기운',
    color: '초록색',
    direction: '동쪽',
    numbers: [3, 8],
    taste: '신맛',
    season: '봄',
    timeOfDay: '새벽(03~07시)',
    organ: { main: '간(肝)', sub: '담(膽)' },
    emotion: { positive: '인자함, 너그러움', negative: '분노, 짜증' },
    deficientMeaning:
      '목(木)이 부족하면 추진력과 결단력이 약해지고, 새로운 시작을 망설이게 돼요. 간과 담 기능이 약해지기 쉬워요.',
    excessiveMeaning:
      '목(木)이 과다하면 성격이 급해지고 화를 잘 내며, 고집이 세질 수 있어요. 간에 무리가 갈 수 있어요.',
    supplementTips: [
      '초록색 옷이나 소품을 활용해 보세요.',
      '동쪽 방향의 공간을 자주 이용해 보세요.',
      '숲 산책이나 등산을 취미로 즐겨보세요.',
      '시금치, 부추, 브로콜리 같은 푸른 채소를 자주 드세요.',
      '새벽 시간대에 일찍 일어나 활동하면 좋아요.',
    ],
  },

  FIRE: {
    korean: '화',
    hanja: '火',
    nature: '불꽃처럼 위로 타오르는 열정의 기운',
    color: '빨간색',
    direction: '남쪽',
    numbers: [2, 7],
    taste: '쓴맛',
    season: '여름',
    timeOfDay: '한낮(09~13시)',
    organ: { main: '심장(心)', sub: '소장(小腸)' },
    emotion: { positive: '예의, 즐거움', negative: '조급함, 흥분' },
    deficientMeaning:
      '화(火)가 부족하면 표현력과 열정이 약해지고, 동기부여가 떨어지기 쉬워요. 심장과 소장 기능이 약해질 수 있어요.',
    excessiveMeaning:
      '화(火)가 과다하면 성급하고 충동적이 되며, 감정 기복이 심해질 수 있어요. 심장에 부담이 갈 수 있어요.',
    supplementTips: [
      '빨간색이나 분홍색 소품을 가까이 두어 보세요.',
      '남쪽 방향으로 자리를 잡거나 외출해 보세요.',
      '촛불 명상이나 따뜻한 차 한 잔으로 에너지를 채워보세요.',
      '쑥, 씀바귀, 고들빼기 같은 쓴맛 식재료를 챙겨 드세요.',
      '한낮 시간대에 중요 활동을 배치하면 집중력이 올라가요.',
    ],
  },

  EARTH: {
    korean: '토',
    hanja: '土',
    nature: '대지처럼 만물을 품고 중심을 잡는 안정의 기운',
    color: '노란색',
    direction: '중앙',
    numbers: [5, 10],
    taste: '단맛',
    season: '환절기(각 계절 끝)',
    timeOfDay: '오전/오후 전환기(07~09시, 13~15시)',
    organ: { main: '비장(脾)', sub: '위장(胃)' },
    emotion: { positive: '신뢰, 포용', negative: '걱정, 집착' },
    deficientMeaning:
      '토(土)가 부족하면 중심이 흔들리고 안정감이 떨어지며, 신뢰 관계를 만드는 데 어려움을 느끼기 쉬워요. 비장과 위장이 약해질 수 있어요.',
    excessiveMeaning:
      '토(土)가 과다하면 고지식하고 융통성이 없어지며, 걱정이 지나치게 많아질 수 있어요. 소화기 계통에 부담이 갈 수 있어요.',
    supplementTips: [
      '노란색이나 베이지색 옷과 인테리어를 활용해 보세요.',
      '집 중심부나 거실을 편안하게 꾸며보세요.',
      '맨발로 흙을 밟는 어싱이나 텃밭 가꾸기를 해보세요.',
      '고구마, 호박, 대추 같은 단맛 식재료를 챙겨 드세요.',
      '규칙적인 식사 시간을 지켜 소화 리듬을 안정시키세요.',
    ],
  },

  METAL: {
    korean: '금',
    hanja: '金',
    nature: '쇠처럼 단단하고 날카롭게 다듬어지는 결단의 기운',
    color: '흰색',
    direction: '서쪽',
    numbers: [4, 9],
    taste: '매운맛',
    season: '가을',
    timeOfDay: '저녁(15~19시)',
    organ: { main: '폐(肺)', sub: '대장(大腸)' },
    emotion: { positive: '의로움, 결단력', negative: '슬픔, 비관' },
    deficientMeaning:
      '금(金)이 부족하면 결단력이 약해지고 우유부단해지며, 정리 정돈이 어려워져요. 폐와 대장 기능이 약해지기 쉬워요.',
    excessiveMeaning:
      '금(金)이 과다하면 지나치게 냉정하고 비판적이 되며, 외로움을 느끼기 쉬워요. 호흡기 계통에 무리가 갈 수 있어요.',
    supplementTips: [
      '흰색이나 은색 계열 옷과 소품을 활용해 보세요.',
      '서쪽 방향으로 산책하거나 자리를 잡아 보세요.',
      '호흡 명상이나 복식호흡 연습을 꾸준히 해보세요.',
      '무, 도라지, 배 같은 매운맛 또는 흰색 식재료를 드세요.',
      '저녁 시간대에 정리 정돈이나 마무리 작업을 하면 효과적이에요.',
    ],
  },

  WATER: {
    korean: '수',
    hanja: '水',
    nature: '물처럼 아래로 흐르며 지혜를 모으는 유연한 기운',
    color: '검은색',
    direction: '북쪽',
    numbers: [1, 6],
    taste: '짠맛',
    season: '겨울',
    timeOfDay: '밤(21~03시)',
    organ: { main: '신장(腎)', sub: '방광(膀胱)' },
    emotion: { positive: '지혜, 유연함', negative: '두려움, 우울' },
    deficientMeaning:
      '수(水)가 부족하면 지혜와 유연성이 줄어들고, 두려움에 위축되기 쉬워요. 신장과 방광 기능이 약해질 수 있어요.',
    excessiveMeaning:
      '수(水)가 과다하면 생각이 지나치게 많아지고 우유부단해지며, 감정 기복이 커질 수 있어요. 신장에 부담이 갈 수 있어요.',
    supplementTips: [
      '검은색이나 남색 계열 옷과 소품을 활용해 보세요.',
      '북쪽 방향의 공간을 활용하거나 수변 산책을 즐겨보세요.',
      '반신욕이나 족욕으로 하체 순환을 도와보세요.',
      '검은콩, 미역, 해조류 같은 짠맛 또는 검은색 식재료를 드세요.',
      '밤 시간대에 충분히 수면을 취하고 무리한 야식을 줄이세요.',
    ],
  },
} as const;
