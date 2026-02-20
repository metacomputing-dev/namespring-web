/**
 * 오행론(五行論) 이론 모듈
 *
 * 木(목/MOK), 火(화/HWA), 土(토/TO), 金(금/GEUM), 水(수/SU)
 *
 * 오행은 우주 만물을 구성하는 다섯 가지 기운으로,
 * 상생(相生)·상극(相剋) 관계를 통해 순환한다.
 */

import type { Element } from '../core/cycle.js';

// ---------------------------------------------------------------------------
// 기본 타입
// ---------------------------------------------------------------------------

/**
 * 오행 한글 로마자 표기
 *
 * 영문 {@link Element} 타입과 대응하며 한국 사주명리 관습 표기를 따른다.
 * - MOK  = 木 (목)
 * - HWA  = 火 (화)
 * - TO   = 土 (토)
 * - GEUM = 金 (금)
 * - SU   = 水 (수)
 */
export type Ohhaeng = 'MOK' | 'HWA' | 'TO' | 'GEUM' | 'SU';

// ---------------------------------------------------------------------------
// Element ↔ Ohhaeng 변환 테이블
// ---------------------------------------------------------------------------

/**
 * Element(영문) → Ohhaeng(한글 로마자) 변환 맵
 *
 * core/cycle.ts 의 Element 타입을 이 모듈의 Ohhaeng 표기로 변환한다.
 */
export const ELEMENT_TO_OHHAENG: Record<Element, Ohhaeng> = {
  WOOD:  'MOK',
  FIRE:  'HWA',
  EARTH: 'TO',
  METAL: 'GEUM',
  WATER: 'SU',
};

/**
 * Ohhaeng(한글 로마자) → Element(영문) 변환 맵
 *
 * 이 모듈의 Ohhaeng 표기를 core/cycle.ts 의 Element 타입으로 역변환한다.
 */
export const OHHAENG_TO_ELEMENT: Record<Ohhaeng, Element> = {
  MOK:  'WOOD',
  HWA:  'FIRE',
  TO:   'EARTH',
  GEUM: 'METAL',
  SU:   'WATER',
};

// ---------------------------------------------------------------------------
// 상생(相生) — 나를 낳는 순환
// ---------------------------------------------------------------------------

/**
 * 상생(相生) 순환 맵 — 내가 생(生)하는 오행
 *
 * 목생화(木生火) → 화생토(火生土) → 토생금(土生金) → 금생수(金生水) → 수생목(水生木)
 */
export const SAENGSAENG: Record<Ohhaeng, Ohhaeng> = {
  MOK:  'HWA',  // 목생화: 木은 火를 생한다
  HWA:  'TO',   // 화생토: 火는 土를 생한다
  TO:   'GEUM', // 토생금: 土는 金을 생한다
  GEUM: 'SU',   // 금생수: 金은 水를 생한다
  SU:   'MOK',  // 수생목: 水는 木을 생한다
};

/**
 * 역생(逆生) 맵 — 나를 생(生)하는 오행
 *
 * SAENGSAENG의 역방향: 키 오행을 생해주는 오행을 반환한다.
 * 예) 수생목(水生木) → MOK의 역생 출처는 SU
 */
export const SAENGSAENG_REVERSE: Record<Ohhaeng, Ohhaeng> = {
  MOK:  'SU',   // 水生木: 木을 생하는 것은 水
  HWA:  'MOK',  // 木生火: 火를 생하는 것은 木
  TO:   'HWA',  // 火生土: 土를 생하는 것은 火
  GEUM: 'TO',   // 土生金: 金을 생하는 것은 土
  SU:   'GEUM', // 金生水: 水를 생하는 것은 金
};

// ---------------------------------------------------------------------------
// 상극(相剋) — 극하는 순환
// ---------------------------------------------------------------------------

/**
 * 상극(相剋) 순환 맵 — 내가 극(剋)하는 오행
 *
 * 목극토(木剋土) → 토극수(土剋水) → 수극화(水剋火) → 화극금(火剋金) → 금극목(金剋木)
 */
export const SANGGEUK: Record<Ohhaeng, Ohhaeng> = {
  MOK:  'TO',   // 목극토: 木은 土를 극한다
  TO:   'SU',   // 토극수: 土는 水를 극한다
  SU:   'HWA',  // 수극화: 水는 火를 극한다
  HWA:  'GEUM', // 화극금: 火는 金을 극한다
  GEUM: 'MOK',  // 금극목: 金은 木을 극한다
};

/**
 * 역극(逆剋) 맵 — 나를 극(剋)하는 오행
 *
 * SANGGEUK의 역방향: 키 오행을 극하는 오행을 반환한다.
 * 예) 금극목(金剋木) → MOK의 역극 출처는 GEUM
 */
export const SANGGEUK_REVERSE: Record<Ohhaeng, Ohhaeng> = {
  MOK:  'GEUM', // 金剋木: 木을 극하는 것은 金
  HWA:  'SU',   // 水剋火: 火를 극하는 것은 水
  TO:   'MOK',  // 木剋土: 土를 극하는 것은 木
  GEUM: 'HWA',  // 火剋金: 金을 극하는 것은 火
  SU:   'TO',   // 土剋水: 水를 극하는 것은 土
};

// ---------------------------------------------------------------------------
// 오행 배속(配屬) 테이블
// ---------------------------------------------------------------------------

/**
 * 오행 방위 배속(方位配屬)
 *
 * - MOK  = 동(東)
 * - HWA  = 남(南)
 * - TO   = 중(中)
 * - GEUM = 서(西)
 * - SU   = 북(北)
 */
export const OHHAENG_DIRECTION: Record<Ohhaeng, string> = {
  MOK:  '동(東)',
  HWA:  '남(南)',
  TO:   '중(中)',
  GEUM: '서(西)',
  SU:   '북(北)',
};

/**
 * 오행 계절 배속(季節配屬)
 *
 * - MOK  = 봄(春)
 * - HWA  = 여름(夏)
 * - TO   = 사계말(四季末) — 각 계절의 끝 18일간
 * - GEUM = 가을(秋)
 * - SU   = 겨울(冬)
 */
export const OHHAENG_SEASON: Record<Ohhaeng, string> = {
  MOK:  '봄(春)',
  HWA:  '여름(夏)',
  TO:   '사계말(四季末)',
  GEUM: '가을(秋)',
  SU:   '겨울(冬)',
};

/**
 * 오행 색깔 배속(色配屬)
 *
 * - MOK  = 청(靑)
 * - HWA  = 적(赤)
 * - TO   = 황(黃)
 * - GEUM = 백(白)
 * - SU   = 흑(黑)
 */
export const OHHAENG_COLOR: Record<Ohhaeng, string> = {
  MOK:  '청(靑)',
  HWA:  '적(赤)',
  TO:   '황(黃)',
  GEUM: '백(白)',
  SU:   '흑(黑)',
};

/**
 * 오행 숫자 배속(數配屬)
 *
 * 하도(河圖) 생수(生數)·성수(成數) 체계 기반:
 * - MOK  = [3, 8]  (생수 3, 성수 8)
 * - HWA  = [2, 7]  (생수 2, 성수 7)
 * - TO   = [5, 10] (생수 5, 성수 10)
 * - GEUM = [4, 9]  (생수 4, 성수 9)
 * - SU   = [1, 6]  (생수 1, 성수 6)
 */
export const OHHAENG_NUMBER: Record<Ohhaeng, number[]> = {
  MOK:  [3, 8],
  HWA:  [2, 7],
  TO:   [5, 10],
  GEUM: [4, 9],
  SU:   [1, 6],
};

/**
 * 오행 맛 배속(味配屬)
 *
 * - MOK  = 신(酸) — 신맛
 * - HWA  = 쓴(苦) — 쓴맛
 * - TO   = 단(甘) — 단맛
 * - GEUM = 매운(辛) — 매운맛
 * - SU   = 짠(鹹) — 짠맛
 */
export const OHHAENG_TASTE: Record<Ohhaeng, string> = {
  MOK:  '신(酸)',
  HWA:  '쓴(苦)',
  TO:   '단(甘)',
  GEUM: '매운(辛)',
  SU:   '짠(鹹)',
};

/**
 * 오행 장기 배속(臟腑配屬)
 *
 * 음(陰) 장기(臟)와 양(陽) 부기(腑)를 함께 표기:
 * - MOK  = 간담(肝膽)       — 간(간장) + 담(쓸개)
 * - HWA  = 심소장(心小腸)   — 심(심장) + 소장
 * - TO   = 비위(脾胃)       — 비(비장) + 위(위장)
 * - GEUM = 폐대장(肺大腸)   — 폐(허파) + 대장
 * - SU   = 신방광(腎膀胱)   — 신(콩팥) + 방광
 */
export const OHHAENG_ORGAN: Record<Ohhaeng, string> = {
  MOK:  '간담(肝膽)',
  HWA:  '심소장(心小腸)',
  TO:   '비위(脾胃)',
  GEUM: '폐대장(肺大腸)',
  SU:   '신방광(腎膀胱)',
};

// ---------------------------------------------------------------------------
// 오행 성격 특성(特性) 테이블
// ---------------------------------------------------------------------------

/**
 * 오행 성격 특성 인터페이스
 *
 * 각 오행이 배속된 천간·지지 및 핵심 성질 기술을 담는다.
 */
export interface OhhaengCharacteristic {
  /** 오행 식별자 */
  ohhaeng: Ohhaeng;
  /** 오행 한글 이름 및 한자 */
  natureKo: string;
  /** 양간(陽干) 로마자 — 예: 甲(GAP) */
  yangStem: string;
  /** 음간(陰干) 로마자 — 예: 乙(EUL) */
  yinStem: string;
  /** 양지(陽支) 로마자 — 예: 寅(IN) */
  yangBranch: string;
  /** 음지(陰支) 로마자 — 예: 卯(MYO) */
  yinBranch: string;
  /**
   * 왕지(旺地) — 해당 오행이 가장 강하게 발현되는 지지
   *
   * 사령(司令)하는 본기(本氣) 지지를 가리킨다.
   */
  wangBranch: string;
  /** 오행 성질 설명 (한글) */
  description: string;
}

/**
 * 오행별 성격 특성 목록
 *
 * 오행 순서: 木 → 火 → 土 → 金 → 水 (상생 순)
 */
export const OHHAENG_CHARACTERISTICS: OhhaengCharacteristic[] = [
  {
    ohhaeng:    'MOK',
    natureKo:   '목(木)',
    yangStem:   'GAP(甲)',   // 甲 — 양목(陽木), 큰 나무
    yinStem:    'EUL(乙)',   // 乙 — 음목(陰木), 풀·덩굴
    yangBranch: 'IN(寅)',    // 寅 — 양목지(陽木支)
    yinBranch:  'MYO(卯)',   // 卯 — 음목지(陰木支), 목왕지
    wangBranch: 'MYO(卯)',   // 卯月에 木이 왕(旺)
    description:
      '생장(生長)·발전(發展)·인(仁)·직선적 상승의 기운. ' +
      '봄의 기운으로 새싹이 땅을 뚫고 올라오듯 강한 생명력과 진취성을 지닌다.',
  },
  {
    ohhaeng:    'HWA',
    natureKo:   '화(火)',
    yangStem:   'BYEONG(丙)', // 丙 — 양화(陽火), 태양·큰 불
    yinStem:    'JEONG(丁)',  // 丁 — 음화(陰火), 촛불·등불
    yangBranch: 'SA(巳)',     // 巳 — 양화지(陽火支)
    yinBranch:  'O(午)',      // 午 — 음화지(陰火支), 화왕지
    wangBranch: 'O(午)',      // 午月에 火가 왕(旺)
    description:
      '광명(光明)·열정(熱情)·예(禮)·확산의 기운. ' +
      '여름의 기운으로 사방을 밝히며 빠르게 번져나가는 활발함과 표현력을 지닌다.',
  },
  {
    ohhaeng:    'TO',
    natureKo:   '토(土)',
    yangStem:   'MU(戊)',    // 戊 — 양토(陽土), 큰 산·들판
    yinStem:    'GI(己)',    // 己 — 음토(陰土), 논밭·습지
    yangBranch: 'JIN(辰)',   // 辰 — 양토지(陽土支)
    yinBranch:  'MI(未)',    // 未 — 음토지(陰土支)
    wangBranch: 'JIN(辰)',   // 辰·戌·丑·未 — 사고지(四庫地), 대표: 辰
    description:
      '중화(中和)·포용(包容)·신(信)·저장의 기운. ' +
      '사계절 각 마지막 18일간을 다스리며 만물을 품고 조화롭게 중재하는 역할을 한다.',
  },
  {
    ohhaeng:    'GEUM',
    natureKo:   '금(金)',
    yangStem:   'GYEONG(庚)', // 庚 — 양금(陽金), 원석·큰 쇠
    yinStem:    'SIN(辛)',    // 辛 — 음금(陰金), 가공된 금속·보석
    yangBranch: 'SHIN(申)',   // 申 — 양금지(陽金支)
    yinBranch:  'YU(酉)',     // 酉 — 음금지(陰金支), 금왕지
    wangBranch: 'YU(酉)',     // 酉月에 金이 왕(旺)
    description:
      '숙살(肅殺)·결단(決斷)·의(義)·수렴의 기운. ' +
      '가을의 기운으로 불필요한 것을 잘라내고 핵심을 남기는 예리함과 의리를 지닌다.',
  },
  {
    ohhaeng:    'SU',
    natureKo:   '수(水)',
    yangStem:   'IM(壬)',    // 壬 — 양수(陽水), 큰 강·바다
    yinStem:    'GYE(癸)',   // 癸 — 음수(陰水), 빗물·샘물
    yangBranch: 'JA(子)',    // 子 — 양수지(陽水支), 수왕지
    yinBranch:  'HAE(亥)',   // 亥 — 음수지(陰水支)
    wangBranch: 'JA(子)',    // 子月에 水가 왕(旺)
    description:
      '지혜(智慧)·유연(柔軟)·지(智)·하강·저장의 기운. ' +
      '겨울의 기운으로 모든 것을 깊은 곳에 저장하며 아래로 흐르는 지혜와 깊이를 지닌다.',
  },
];

// ---------------------------------------------------------------------------
// 오행 계절 왕쇠(旺衰)
// ---------------------------------------------------------------------------

/**
 * 오행 왕쇠(旺衰) 강도 단계
 *
 * - WANG = 旺(왕) — 해당 계절의 주인, 기운이 가장 강함
 * - SANG = 相(상) — 왕(旺)을 돕는 기운, 두 번째로 강함
 * - HYU  = 休(휴) — 휴식 상태, 보통
 * - SU   = 囚(수) — 갇힌 상태, 약함
 * - GYU  = 囚(귀) — 무덤에 든 상태, 가장 약함 (일부 유파에서 '死'로 표기)
 */
export type OhhaengStrength = 'WANG' | 'SANG' | 'HYU' | 'SU' | 'GYU';

/**
 * 계절별 오행 왕쇠(旺衰) 테이블
 *
 * 키: 'SPRING' | 'SUMMER' | 'LATE_SUMMER' | 'FALL' | 'WINTER'
 *
 * 왕쇠 법칙:
 * - 봄(SPRING):       木旺 水相 金休 火囚 土囚
 * - 여름(SUMMER):     火旺 木相 水休 金囚 土囚
 * - 사계말(LATE_SUMMER): 土旺 火相 木休 水囚 金囚
 * - 가을(FALL):       金旺 土相 火休 木囚 水囚
 * - 겨울(WINTER):     水旺 金相 土休 火囚 木囚
 */
export const SEASONAL_STRENGTH: Record<string, Record<Ohhaeng, OhhaengStrength>> = {
  /** 봄(春) — 인묘진(寅卯辰)월: 木이 사령(司令) */
  SPRING: {
    MOK:  'WANG', // 木旺: 봄의 주인
    HWA:  'SU',   // 火囚: 木이 강하면 火는 잠시 갇힘 (木이 火를 생하지만 아직 계절 아님)
    TO:   'GYU',  // 土囚(귀): 木이 土를 극(剋)하므로 가장 쇠약
    GEUM: 'HYU',  // 金休: 金의 계절이 지나 휴식
    SU:   'SANG', // 水相: 水가 木을 생하므로 두 번째로 강함
  },
  /** 여름(夏) — 사오미(巳午未)월: 火가 사령(司令) */
  SUMMER: {
    MOK:  'SANG', // 木相: 木이 火를 생하므로 두 번째로 강함
    HWA:  'WANG', // 火旺: 여름의 주인
    TO:   'SU',   // 土囚: 火生土지만 아직 土의 계절이 아님
    GEUM: 'GYU',  // 金囚(귀): 火가 金을 극(剋)하므로 가장 쇠약
    SU:   'HYU',  // 水休: 水의 계절이 지나 휴식
  },
  /** 사계말(四季末) — 辰·戌·丑·未월(각 계절 끝 18일): 土가 사령(司令) */
  LATE_SUMMER: {
    MOK:  'HYU',  // 木休: 봄이 지나 휴식
    HWA:  'SANG', // 火相: 火가 土를 생하므로 두 번째로 강함
    TO:   'WANG', // 土旺: 사계말의 주인
    GEUM: 'SU',   // 金囚: 土生金이지만 아직 金의 계절이 아님
    SU:   'GYU',  // 水囚(귀): 土가 水를 극(剋)하므로 가장 쇠약
  },
  /** 가을(秋) — 신유술(申酉戌)월: 金이 사령(司令) */
  FALL: {
    MOK:  'GYU',  // 木囚(귀): 金이 木을 극(剋)하므로 가장 쇠약
    HWA:  'HYU',  // 火休: 여름이 지나 휴식
    TO:   'SANG', // 土相: 土가 金을 생하므로 두 번째로 강함
    GEUM: 'WANG', // 金旺: 가을의 주인
    SU:   'SU',   // 水囚: 金生水지만 아직 水의 계절이 아님
  },
  /** 겨울(冬) — 해자축(亥子丑)월: 水가 사령(司令) */
  WINTER: {
    MOK:  'SU',   // 木囚: 水生木이지만 아직 木의 계절이 아님
    HWA:  'GYU',  // 火囚(귀): 水가 火를 극(剋)하므로 가장 쇠약
    TO:   'HYU',  // 土休: 사계말이 지나 휴식
    GEUM: 'SANG', // 金相: 金이 水를 생하므로 두 번째로 강함
    SU:   'WANG', // 水旺: 겨울의 주인
  },
};

// ---------------------------------------------------------------------------
// 유틸리티 함수
// ---------------------------------------------------------------------------

/**
 * Element(영문) → Ohhaeng(한글 로마자) 변환 함수
 *
 * @param element - core/cycle.ts 의 Element 값
 * @returns 대응하는 Ohhaeng 값
 *
 * @example
 * ohhaengOf('WOOD') // 'MOK'
 */
export function ohhaengOf(element: Element): Ohhaeng {
  return ELEMENT_TO_OHHAENG[element];
}

/**
 * Ohhaeng(한글 로마자) → Element(영문) 변환 함수
 *
 * @param ohhaeng - Ohhaeng 값
 * @returns 대응하는 Element 값
 *
 * @example
 * elementOf('MOK') // 'WOOD'
 */
export function elementOf(ohhaeng: Ohhaeng): Element {
  return OHHAENG_TO_ELEMENT[ohhaeng];
}

/**
 * 내가 생(生)하는 오행 반환 (상생 순방향)
 *
 * @param ohhaeng - 기준 오행
 * @returns 기준 오행이 생하는 오행
 *
 * @example
 * saengsaengTarget('MOK') // 'HWA' (목생화)
 */
export function saengsaengTarget(ohhaeng: Ohhaeng): Ohhaeng {
  return SAENGSAENG[ohhaeng];
}

/**
 * 내가 극(剋)하는 오행 반환 (상극 순방향)
 *
 * @param ohhaeng - 기준 오행
 * @returns 기준 오행이 극하는 오행
 *
 * @example
 * sanggeukTarget('MOK') // 'TO' (목극토)
 */
export function sanggeukTarget(ohhaeng: Ohhaeng): Ohhaeng {
  return SANGGEUK[ohhaeng];
}

/**
 * 나를 생(生)하는 오행 반환 (상생 역방향)
 *
 * @param ohhaeng - 기준 오행
 * @returns 기준 오행을 생하는 오행
 *
 * @example
 * saengsaengSource('MOK') // 'SU' (수생목)
 */
export function saengsaengSource(ohhaeng: Ohhaeng): Ohhaeng {
  return SAENGSAENG_REVERSE[ohhaeng];
}

/**
 * 나를 극(剋)하는 오행 반환 (상극 역방향)
 *
 * @param ohhaeng - 기준 오행
 * @returns 기준 오행을 극하는 오행
 *
 * @example
 * sanggeukSource('MOK') // 'GEUM' (금극목)
 */
export function sanggeukSource(ohhaeng: Ohhaeng): Ohhaeng {
  return SANGGEUK_REVERSE[ohhaeng];
}
