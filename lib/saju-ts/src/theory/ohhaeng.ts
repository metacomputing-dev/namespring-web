/**
 * 오행론(五行論) 이론 모듈
 *
 * 木(목/MOK), 火(화/HWA), 土(토/TO), 金(금/GEUM), 水(수/SU)
 *
 * 오행은 우주 만물을 구성하는 다섯 가지 기운으로,
 * 상생(相生)·상극(相剋) 관계를 통해 순환한다.
 *
 * 오행의 여섯 가지 작용 — 생극제화설모(生剋制化泄耗):
 *   1. 생(生): 나를 낳아주는 관계 (인성 관계)
 *   2. 극(剋): 나를 억누르는 관계 (관성 관계)
 *   3. 제(制): 극이 적절하여 균형을 잡는 관계
 *   4. 화(化): 극이 전환되어 조화를 이루는 관계
 *   5. 설(泄): 내가 생해주어 기운이 빠지는 관계 (식상 관계)
 *   6. 모(耗): 내가 극하여 기운을 소모하는 관계 (재성 관계)
 *
 * 근거 문헌: 子平眞詮(자평진전), 滴天髓(적천수), 三命通會(삼명통회)
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
// 생극제화설모(生剋制化泄耗) 완전 체계
// ---------------------------------------------------------------------------

/**
 * 오행 간의 여섯 가지 관계 유형
 *
 * - SAENG = 생(生): 상대가 나를 생해준다 (인성). 나를 보양하고 강하게 한다.
 * - GEUK  = 극(剋): 상대가 나를 극한다 (관성). 나를 억제하고 통제한다.
 * - JE    = 제(制): 극이 적절하여 균형이 잡힌 상태. 극이 과하지 않아 조절의 역할.
 * - HWA   = 화(化): 극이 전환되어 새로운 기운을 생성. 합화(合化)를 통한 변화.
 * - SEOL  = 설(泄): 내가 상대를 생해주어 나의 기운이 빠진다 (식상). 에너지 소모.
 * - MO    = 모(耗): 내가 상대를 극하여 나의 기운을 소모한다 (재성). 힘의 소진.
 */
export type SaenggeukGwangye = 'SAENG' | 'GEUK' | 'JE' | 'HWA_HWA' | 'SEOL' | 'MO';

/**
 * 생극제화설모(生剋制化泄耗) 상세 설명 인터페이스
 */
export interface SaenggeukJehwaSeolmo {
  /** 관계 유형 */
  gwangye: SaenggeukGwangye;
  /** 한자 표기 */
  hanja: string;
  /** 한글 이름 */
  hangul: string;
  /** 정의 */
  definition: string;
  /** 사주 해석에서의 의미 */
  haeseokeUimi: string;
  /** 예시 */
  yesi: string;
}

/**
 * 생극제화설모(生剋制化泄耗) 완전 체계 테이블
 *
 * 오행 간의 관계를 단순한 상생·상극을 넘어 여섯 가지로 세분화한 체계.
 * 자평진전(子平眞詮)과 적천수(滴天髓)에 근거한다.
 *
 * 일간(日干)을 기준으로 나머지 오행과의 관계:
 * - 생아(生我): 나를 생하는 오행 → 인성(印星)
 * - 극아(剋我): 나를 극하는 오행 → 관성(官星)
 * - 아생(我生): 내가 생하는 오행 → 식상(食傷) — 나에게는 설기(泄氣)
 * - 아극(我剋): 내가 극하는 오행 → 재성(財星) — 나에게는 모기(耗氣)
 * - 비화(比和): 나와 같은 오행 → 비겁(比劫)
 */
export const SAENGGEUK_JEHWA_SEOLMO: SaenggeukJehwaSeolmo[] = [
  {
    gwangye:      'SAENG',
    hanja:        '生',
    hangul:       '생',
    definition:
      '생(生)이란 한 오행이 다른 오행을 낳아 기르는 관계이다. ' +
      '어머니가 자식을 보양하듯, 생하는 오행은 상대의 기운을 강화한다.',
    haeseokeUimi:
      '사주에서 생(生)의 관계는 인성(印星)에 해당한다. ' +
      '인성이 적절하면 학문·교육·보호의 의미이며, ' +
      '과다하면 의존적이고 게으른 경향이 생긴다.',
    yesi:
      '水生木: 水가 木을 생한다. 물이 나무를 키우는 이치. ' +
      '사주에서 일간이 木일 때 水는 인성(印星)이 된다.',
  },
  {
    gwangye:      'GEUK',
    hanja:        '剋',
    hangul:       '극',
    definition:
      '극(剋)이란 한 오행이 다른 오행을 억누르고 제약하는 관계이다. ' +
      '극하는 오행이 강하면 상대를 손상시키고, 약하면 오히려 역극(逆剋)을 당한다.',
    haeseokeUimi:
      '사주에서 극(剋)의 관계는 관성(官星) 또는 칠살(七殺)에 해당한다. ' +
      '적절한 극은 규율과 질서를 의미하며, ' +
      '과도한 극은 압박·질병·재난의 의미가 된다.',
    yesi:
      '金剋木: 金이 木을 극한다. 도끼로 나무를 베는 이치. ' +
      '사주에서 일간이 木일 때 金은 관성(官星)이 된다.',
  },
  {
    gwangye:      'JE',
    hanja:        '制',
    hangul:       '제',
    definition:
      '제(制)란 극(剋)이 적절하여 상대를 해치지 않으면서 균형을 잡는 상태이다. ' +
      '극의 힘이 과하지 않고, 극을 받는 쪽도 어느 정도 힘이 있어 ' +
      '서로 견제하며 조화를 이루는 관계.',
    haeseokeUimi:
      '사주에서 제(制)는 가장 이상적인 관계 중 하나이다. ' +
      '관성(官星)이 일간을 적절히 제어하면 출세·명예를 얻고, ' +
      '편관(偏官)이 식신(食神)에 의해 제압되면 칠살(七殺)이 순화된다. ' +
      '이것이 식신제살(食神制殺)의 원리이다.',
    yesi:
      '일간이 木이고 金(관성)이 있을 때, 火(식신)가 金을 제어하면 ' +
      '극의 힘이 적절해져 일간이 안정된다.',
  },
  {
    gwangye:      'HWA_HWA',
    hanja:        '化',
    hangul:       '화',
    definition:
      '화(化)란 극(剋)의 관계가 합(合)을 통해 전환되어 ' +
      '새로운 오행의 기운이 생성되는 현상이다. ' +
      '천간합(天干合)이 대표적이며, 두 오행이 만나 제3의 오행으로 변한다.',
    haeseokeUimi:
      '사주에서 화(化)는 갈등이 해소되고 새로운 국면이 열리는 것을 의미한다. ' +
      '천간합화(天干合化)가 성공하면 합화된 오행의 기운이 사주를 지배한다. ' +
      '예: 甲己合化土 — 甲(木)과 己(土)가 합하여 土로 변화.',
    yesi:
      '甲己合化土: 甲(양목)과 己(음토)가 합하면 土로 변한다. ' +
      '원래 목극토(木剋土)의 관계가 합화를 통해 협력 관계로 전환.',
  },
  {
    gwangye:      'SEOL',
    hanja:        '泄',
    hangul:       '설',
    definition:
      '설(泄)이란 내가 상대를 생(生)해주면서 나의 기운이 빠져나가는 관계이다. ' +
      '어머니가 자식을 키우느라 자신의 기력이 소진되는 것과 같다. ' +
      '설기(泄氣)라고도 하며, 상생의 이면이다.',
    haeseokeUimi:
      '사주에서 설(泄)은 식상(食傷) 관계에 해당한다. ' +
      '적절한 설기는 재능 발휘·표현력·창작을 의미하며, ' +
      '과도한 설기는 기력 소진·체력 저하·정신적 불안을 초래한다.',
    yesi:
      '木生火에서 木의 입장: 木이 火를 생하므로 木의 기운이 설기(泄氣)된다. ' +
      '일간이 木일 때 火(식상)가 많으면 기운이 과도하게 빠진다.',
  },
  {
    gwangye:      'MO',
    hanja:        '耗',
    hangul:       '모',
    definition:
      '모(耗)란 내가 상대를 극(剋)하면서 나의 기운을 소모하는 관계이다. ' +
      '나무를 베려면 도끼질에 힘이 드는 것과 같다. ' +
      '극하는 측도 에너지를 소비하므로 모기(耗氣)가 발생한다.',
    haeseokeUimi:
      '사주에서 모(耗)는 재성(財星) 관계에 해당한다. ' +
      '적절한 모기는 재물 획득·사업 성공을 의미하며, ' +
      '과도한 모기는 재물에 끌려 건강·명예를 잃는 것을 의미한다. ' +
      '신약(身弱)한 사주에 재성이 많으면 재다신약(財多身弱)이라 한다.',
    yesi:
      '木剋土에서 木의 입장: 木이 土를 극하므로 木의 기운이 모기(耗氣)된다. ' +
      '일간이 木일 때 土(재성)가 많으면 힘이 소진된다.',
  },
];

/**
 * 일간 기준 오행 관계 전체 맵
 *
 * 일간(日干) 오행을 기준으로 나머지 다섯 오행과의 관계를 한눈에 보여준다.
 *
 * - bigyeop:  비겁(比劫) — 나와 같은 오행
 * - siksang:  식상(食傷) — 내가 생하는 오행 (설기)
 * - jaeseong: 재성(財星) — 내가 극하는 오행 (모기)
 * - gwanseong: 관성(官星) — 나를 극하는 오행
 * - inseong:  인성(印星) — 나를 생하는 오행
 */
export const OHHAENG_GWANGYE_MAP: Record<Ohhaeng, {
  bigyeop: Ohhaeng;
  siksang: Ohhaeng;
  jaeseong: Ohhaeng;
  gwanseong: Ohhaeng;
  inseong: Ohhaeng;
}> = {
  MOK: {
    bigyeop:   'MOK',  // 木 = 비겁
    siksang:   'HWA',  // 木生火: 식상 (설기)
    jaeseong:  'TO',   // 木剋土: 재성 (모기)
    gwanseong: 'GEUM', // 金剋木: 관성
    inseong:   'SU',   // 水生木: 인성
  },
  HWA: {
    bigyeop:   'HWA',
    siksang:   'TO',   // 火生土: 식상
    jaeseong:  'GEUM', // 火剋金: 재성
    gwanseong: 'SU',   // 水剋火: 관성
    inseong:   'MOK',  // 木生火: 인성
  },
  TO: {
    bigyeop:   'TO',
    siksang:   'GEUM', // 土生金: 식상
    jaeseong:  'SU',   // 土剋水: 재성
    gwanseong: 'MOK',  // 木剋土: 관성
    inseong:   'HWA',  // 火生土: 인성
  },
  GEUM: {
    bigyeop:   'GEUM',
    siksang:   'SU',   // 金生水: 식상
    jaeseong:  'MOK',  // 金剋木: 재성
    gwanseong: 'HWA',  // 火剋金: 관성
    inseong:   'TO',   // 土生金: 인성
  },
  SU: {
    bigyeop:   'SU',
    siksang:   'MOK',  // 水生木: 식상
    jaeseong:  'HWA',  // 水剋火: 재성
    gwanseong: 'TO',   // 土剋水: 관성
    inseong:   'GEUM', // 金生水: 인성
  },
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
 * - MOK  = 청(靑) / 녹(綠)
 * - HWA  = 적(赤) / 홍(紅)
 * - TO   = 황(黃)
 * - GEUM = 백(白)
 * - SU   = 흑(黑) / 남(藍)
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
 *
 * 하도(河圖) 원리:
 *   "천일생수(天一生水), 지이생화(地二生火), 천삼생목(天三生木),
 *    지사생금(地四生金), 천오생토(天五生土)"
 *   생수(1~5)에 5를 더하면 성수(6~10)가 된다.
 */
export const OHHAENG_NUMBER: Record<Ohhaeng, [number, number]> = {
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
 * 오행 감정 배속(情配屬)
 *
 * 한의학 칠정(七情) 중 오장(五臟)에 대응하는 감정:
 * - MOK  = 노(怒) — 분노
 * - HWA  = 희(喜) — 기쁨
 * - TO   = 사(思) — 근심·생각
 * - GEUM = 비(悲) — 슬픔
 * - SU   = 공(恐) — 두려움
 */
export const OHHAENG_EMOTION: Record<Ohhaeng, string> = {
  MOK:  '노(怒)',
  HWA:  '희(喜)',
  TO:   '사(思)',
  GEUM: '비(悲)',
  SU:   '공(恐)',
};

/**
 * 오행 덕목(五常) 배속
 *
 * 유교의 오상(五常)과 오행의 대응:
 * - MOK  = 인(仁) — 어질음
 * - HWA  = 예(禮) — 예의
 * - TO   = 신(信) — 믿음
 * - GEUM = 의(義) — 의로움
 * - SU   = 지(智) — 지혜
 */
export const OHHAENG_VIRTUE: Record<Ohhaeng, string> = {
  MOK:  '인(仁)',
  HWA:  '예(禮)',
  TO:   '신(信)',
  GEUM: '의(義)',
  SU:   '지(智)',
};

// ---------------------------------------------------------------------------
// 오행과 건강 — 장부(臟腑) 상세
// ---------------------------------------------------------------------------

/**
 * 오행 장부(臟腑) 상세 인터페이스
 *
 * 각 오행에 대응하는 음장(陰臟)과 양부(陽腑), 관련 신체 부위,
 * 과다/부족 시 나타나는 건강 문제를 상세히 기술한다.
 */
export interface OhhaengJangbu {
  /** 오행 */
  ohhaeng: Ohhaeng;
  /** 음장(陰臟) — 간·심·비·폐·신 */
  eumJang: string;
  /** 양부(陽腑) — 담·소장·위·대장·방광 */
  yangBu: string;
  /** 관련 신체 부위 */
  gwanryeonBuwi: string;
  /** 오관(五官) — 눈·혀·입·코·귀 */
  ogwan: string;
  /** 오체(五體) — 근·혈맥·살·피모·뼈 */
  oche: string;
  /** 해당 오행 과다 시 건강 문제 */
  gwadaSi: string;
  /** 해당 오행 부족 시 건강 문제 */
  bujokSi: string;
}

/**
 * 오행별 장부(臟腑) 상세 테이블
 *
 * 황제내경(黃帝內經) 및 한의학 기본 이론에 근거한
 * 오행과 장부의 대응 관계 및 건강 해석.
 */
export const OHHAENG_JANGBU: Record<Ohhaeng, OhhaengJangbu> = {
  MOK: {
    ohhaeng:       'MOK',
    eumJang:       '간(肝)',
    yangBu:        '담(膽)',
    gwanryeonBuwi: '눈(目)·근육(筋)·손톱·발톱',
    ogwan:         '눈(目) — 간이 건강하면 시력이 좋고, 간에 열이 있으면 눈이 충혈된다.',
    oche:          '근(筋) — 힘줄과 인대. 간의 기운이 근육의 유연성과 수축을 관장한다.',
    gwadaSi:
      '목(木) 과다: 간화(肝火) 상승으로 두통·눈 충혈·어지러움·근육 경련이 나타날 수 있다. ' +
      '성격이 급하고 화를 잘 내며 혈압이 올라갈 수 있다. ' +
      '간양상항(肝陽上亢)·중풍(中風) 위험.',
    bujokSi:
      '목(木) 부족: 간혈(肝血) 부족으로 시력 저하·근육 경련·손발 저림·빈혈이 나타날 수 있다. ' +
      '결단력이 부족하고 두려움이 많아지며, 손톱이 잘 부러진다.',
  },
  HWA: {
    ohhaeng:       'HWA',
    eumJang:       '심(心)',
    yangBu:        '소장(小腸)',
    gwanryeonBuwi: '혀(舌)·혈맥(血脈)·얼굴색(面色)',
    ogwan:         '혀(舌) — 심의 상태가 혀에 나타난다. 심열(心熱)이 있으면 혀끝이 빨갛다.',
    oche:          '혈맥(脈) — 심장이 혈액을 운행한다. 심의 기운이 혈액 순환을 관장한다.',
    gwadaSi:
      '화(火) 과다: 심화(心火) 항성으로 불면증·가슴 두근거림·구내염·설염이 나타날 수 있다. ' +
      '조급하고 흥분이 잘 되며 얼굴이 붉어진다. ' +
      '심혈관 질환·부정맥 위험.',
    bujokSi:
      '화(火) 부족: 심양(心陽) 부족으로 냉증·저혈압·어지러움·무기력이 나타날 수 있다. ' +
      '의욕이 없고 우울하며, 얼굴색이 창백하다. 수족냉증이 심하다.',
  },
  TO: {
    ohhaeng:       'TO',
    eumJang:       '비(脾)',
    yangBu:        '위(胃)',
    gwanryeonBuwi: '입(口)·입술(唇)·근육(肌肉)·사지(四肢)',
    ogwan:         '입(口) — 비의 상태가 입술에 나타난다. 비가 허하면 입술이 창백하다.',
    oche:          '기육(肌肉) — 살. 비장이 영양 흡수를 관장하여 근육을 형성한다.',
    gwadaSi:
      '토(土) 과다: 비습(脾濕) 정체로 몸이 무겁고 부종·소화불량·복부팽만이 나타날 수 있다. ' +
      '걱정이 많고 집착이 강하며, 비만 경향이 있다. ' +
      '당뇨·위장 질환 위험.',
    bujokSi:
      '토(土) 부족: 비기(脾氣) 허약으로 식욕부진·만성 설사·영양실조·근육 위축이 나타날 수 있다. ' +
      '체력이 약하고 피로하며, 사지가 무력하다.',
  },
  GEUM: {
    ohhaeng:       'GEUM',
    eumJang:       '폐(肺)',
    yangBu:        '대장(大腸)',
    gwanryeonBuwi: '코(鼻)·피부(皮毛)·체모(體毛)',
    ogwan:         '코(鼻) — 폐의 상태가 코에 나타난다. 폐가 허하면 비염·후각 장애가 생긴다.',
    oche:          '피모(皮毛) — 피부와 체모. 폐의 기운이 피부의 방어 기능을 관장한다.',
    gwadaSi:
      '금(金) 과다: 폐열(肺熱) 또는 폐조(肺燥)로 기침·피부 건조·변비가 나타날 수 있다. ' +
      '지나치게 결벽하고 비판적이며, 호흡기 질환·알레르기 위험.',
    bujokSi:
      '금(金) 부족: 폐기(肺氣) 허약으로 잦은 감기·천식·만성 기침·피부 트러블이 나타날 수 있다. ' +
      '결단력이 부족하고 의지가 약하며, 면역력이 떨어진다.',
  },
  SU: {
    ohhaeng:       'SU',
    eumJang:       '신(腎)',
    yangBu:        '방광(膀胱)',
    gwanryeonBuwi: '귀(耳)·뼈(骨)·치아(齒)·머리카락(髮)·허리(腰)',
    ogwan:         '귀(耳) — 신의 상태가 귀에 나타난다. 신이 허하면 이명·난청이 생긴다.',
    oche:          '골(骨) — 뼈. 신장이 골수를 생성하고 뼈의 건강을 관장한다.',
    gwadaSi:
      '수(水) 과다: 수습(水濕) 정체로 부종·빈뇨·냉대하·허리 통증이 나타날 수 있다. ' +
      '두려움이 많고 의심이 강하며, 신장·비뇨기 질환 위험.',
    bujokSi:
      '수(水) 부족: 신음(腎陰) 부족으로 허리 통증·골다공증·이명·탈모가 나타날 수 있다. ' +
      '기력이 떨어지고 노화가 빠르며, 생식 기능이 약해진다.',
  },
};

/**
 * 오행 장기 배속(臟腑配屬) — 간략 맵
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
// 오행과 직업
// ---------------------------------------------------------------------------

/**
 * 오행별 적합 직업군 인터페이스
 */
export interface OhhaengJikeop {
  /** 오행 */
  ohhaeng: Ohhaeng;
  /** 핵심 키워드 */
  keyword: string;
  /** 적합 직업군 */
  jikeopgun: string[];
  /** 적합 산업 분야 */
  saneop: string;
}

/**
 * 오행별 적합 직업군 테이블
 *
 * 각 오행의 성질에 부합하는 직업과 산업 분야를 기술한다.
 * 용신(用神)이나 희신(喜神)에 해당하는 오행의 직업군이
 * 사주 주인에게 유리한 경우가 많다.
 */
export const OHHAENG_JIKEOP: Record<Ohhaeng, OhhaengJikeop> = {
  MOK: {
    ohhaeng: 'MOK',
    keyword: '생장·교육·문화·나무·식물',
    jikeopgun: [
      '교육자(교사·교수)',
      '문화예술인(작가·화가)',
      '의류·패션',
      '출판·인쇄·언론',
      '농업·임업·원예',
      '가구·목재 산업',
      '한의학·약초',
      '사회복지·상담',
    ],
    saneop:
      '성장하고 뻗어나가는 성질의 산업. ' +
      '교육·문화·콘텐츠·출판·농림업·환경·건강식품 등.',
  },
  HWA: {
    ohhaeng: 'HWA',
    keyword: '빛·열·에너지·예술·전자',
    jikeopgun: [
      '연예인·방송인',
      'IT·전자·반도체',
      '에너지(전력·원자력·태양광)',
      '요식업·음식점',
      '화학·석유화학',
      '광고·홍보·마케팅',
      '미용·화장품',
      '조명·인테리어',
    ],
    saneop:
      '빛나고 확산하는 성질의 산업. ' +
      '전자·IT·미디어·광고·에너지·요식·화학·미용 등.',
  },
  TO: {
    ohhaeng: 'TO',
    keyword: '부동산·건설·중재·저장·신뢰',
    jikeopgun: [
      '부동산·건축·건설',
      '공무원·행정',
      '보험·신탁',
      '창고·물류·유통',
      '농업·축산업',
      '세라믹·시멘트·벽돌',
      '중재·조정·컨설팅',
      '종교인·철학자',
    ],
    saneop:
      '저장하고 중재하는 성질의 산업. ' +
      '부동산·건설·물류·공공행정·농축산·광업 등.',
  },
  GEUM: {
    ohhaeng: 'GEUM',
    keyword: '금속·기계·금융·법률·결단',
    jikeopgun: [
      '금융·은행·증권',
      '법률·법조인(변호사·판사)',
      '군인·경찰·무술인',
      '기계·자동차·조선',
      '보석·귀금속',
      '외과의사·치과의사',
      '철강·제련',
      '회계·세무',
    ],
    saneop:
      '자르고 결단하는 성질의 산업. ' +
      '금융·법률·군경·기계·금속·의료(외과)·회계 등.',
  },
  SU: {
    ohhaeng: 'SU',
    keyword: '물·유통·지혜·소통·유동',
    jikeopgun: [
      '무역·수출입',
      '해운·수산업',
      '음료·주류',
      '관광·여행·호텔',
      '학자·연구원',
      '철학·종교·명리학',
      '수도·정수·환경',
      '물류·유통·운송',
    ],
    saneop:
      '흐르고 소통하는 성질의 산업. ' +
      '무역·해운·수산·관광·연구·유통·음료·환경 등.',
  },
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
 *
 * NOTE: 지지의 양음(陽陰)은 인덱스 홀짝에 의해 결정된다.
 * 짝수 인덱스 = 양지, 홀수 인덱스 = 음지.
 * - 木: 寅(2, 양)·卯(3, 음)
 * - 火: 午(6, 양)·巳(5, 음)
 * - 土: 辰(4, 양)·丑(1, 음)·戌(10, 양)·未(7, 음) — 사고지(四庫地)
 * - 金: 申(8, 양)·酉(9, 음)
 * - 水: 子(0, 양)·亥(11, 음)
 */
export const OHHAENG_CHARACTERISTICS: OhhaengCharacteristic[] = [
  {
    ohhaeng:    'MOK',
    natureKo:   '목(木)',
    yangStem:   'GAP(甲)',   // 甲 — 양목(陽木), 큰 나무
    yinStem:    'EUL(乙)',   // 乙 — 음목(陰木), 풀·덩굴
    yangBranch: 'IN(寅)',    // 寅(2, 짝수) — 양목지(陽木支)
    yinBranch:  'MYO(卯)',   // 卯(3, 홀수) — 음목지(陰木支), 목왕지
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
    yangBranch: 'O(午)',      // 午(6, 짝수) — 양화지(陽火支), 화왕지
    yinBranch:  'SA(巳)',     // 巳(5, 홀수) — 음화지(陰火支)
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
    yangBranch: 'JIN(辰)',   // 辰(4, 짝수) — 양토지(陽土支)
    yinBranch:  'MI(未)',    // 未(7, 홀수) — 음토지(陰土支)
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
    yangBranch: 'SHIN(申)',   // 申(8, 짝수) — 양금지(陽金支)
    yinBranch:  'YU(酉)',     // 酉(9, 홀수) — 음금지(陰金支), 금왕지
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
    yangBranch: 'JA(子)',    // 子(0, 짝수) — 양수지(陽水支), 수왕지
    yinBranch:  'HAE(亥)',   // 亥(11, 홀수) — 음수지(陰水支)
    wangBranch: 'JA(子)',    // 子月에 水가 왕(旺)
    description:
      '지혜(智慧)·유연(柔軟)·지(智)·하강·저장의 기운. ' +
      '겨울의 기운으로 모든 것을 깊은 곳에 저장하며 아래로 흐르는 지혜와 깊이를 지닌다.',
  },
];

// ---------------------------------------------------------------------------
// 오행 과다/부족 해석
// ---------------------------------------------------------------------------

/**
 * 오행 과다·부족 해석 인터페이스
 *
 * 사주에서 특정 오행이 과다하거나 부족할 때의 성격·건강·운세 해석.
 */
export interface OhhaengGwadaBujok {
  /** 오행 */
  ohhaeng: Ohhaeng;
  /** 과다 시 성격 */
  gwadaSeonggyeok: string;
  /** 과다 시 건강 */
  gwadaGeongang: string;
  /** 과다 시 운세 경향 */
  gwadaUnse: string;
  /** 부족 시 성격 */
  bujokSeonggyeok: string;
  /** 부족 시 건강 */
  bujokGeongang: string;
  /** 부족 시 운세 경향 */
  bujokUnse: string;
}

/**
 * 오행별 과다·부족 해석 테이블
 *
 * 사주 원국(原局)에서 특정 오행이 3개 이상이면 과다, 0개이면 부족으로 본다.
 * (천간·지지의 본기 오행 기준, 지장간은 별도 판단)
 */
export const OHHAENG_GWADA_BUJOK: Record<Ohhaeng, OhhaengGwadaBujok> = {
  MOK: {
    ohhaeng: 'MOK',
    gwadaSeonggyeok:
      '고집이 세고 자기주장이 강하다. 남을 잘 배려하지 못하고 독선적이 될 수 있다. ' +
      '지나친 경쟁심과 질투심이 생길 수 있다.',
    gwadaGeongang:
      '간(肝)에 열이 올라 두통·눈 충혈·고혈압에 유의해야 한다. ' +
      '화를 잘 내고 스트레스를 받으면 간 기능이 저하된다.',
    gwadaUnse:
      '초반에 추진력이 강하지만 과욕으로 좌절하기 쉽다. ' +
      '금(金) 운이 올 때 제어가 되어 안정을 찾는다.',
    bujokSeonggyeok:
      '결단력이 부족하고 우유부단하다. 시작하는 힘이 약하고 진취성이 떨어진다. ' +
      '자신감이 부족하여 남의 눈치를 많이 본다.',
    bujokGeongang:
      '간(肝)·담(膽)이 허약하여 피로감이 크고 시력이 떨어진다. ' +
      '근육·인대가 약하여 쉽게 삐거나 다친다.',
    bujokUnse:
      '새로운 일을 시작하기 어렵고 발전이 더디다. ' +
      '수(水) 운이 올 때 수생목(水生木)으로 목의 기운이 보충된다.',
  },
  HWA: {
    ohhaeng: 'HWA',
    gwadaSeonggyeok:
      '성격이 급하고 조급하다. 화려함을 추구하고 과시욕이 강하다. ' +
      '감정 기복이 심하고 인내심이 부족하다.',
    gwadaGeongang:
      '심장(心)에 열이 올라 불면증·심계항진·구내염에 유의해야 한다. ' +
      '혈압이 높아지고 심혈관 질환 위험이 있다.',
    gwadaUnse:
      '화려하게 시작하지만 지속력이 약하다. 재물이 쉽게 들어왔다 나간다. ' +
      '수(水) 운이 올 때 수극화(水剋火)로 조절이 된다.',
    bujokSeonggyeok:
      '자기 표현이 부족하고 소심하다. 사교성이 떨어지고 감정 표현이 서투르다. ' +
      '열정이 부족하여 무기력해지기 쉽다.',
    bujokGeongang:
      '심장(心)·소장(小腸)이 허약하여 혈액순환이 원활하지 않다. ' +
      '수족냉증·저혈압·어지러움이 나타날 수 있다.',
    bujokUnse:
      '명예와 인기를 얻기 어렵고 사회적 활동이 위축된다. ' +
      '목(木) 운이 올 때 목생화(木生火)로 화의 기운이 보충된다.',
  },
  TO: {
    ohhaeng: 'TO',
    gwadaSeonggyeok:
      '고지식하고 변화를 싫어한다. 걱정이 많고 집착이 강하다. ' +
      '융통성이 부족하고 보수적인 성향이 지나치다.',
    gwadaGeongang:
      '비(脾)·위(胃)에 습(濕)이 정체되어 소화불량·비만·부종에 유의해야 한다. ' +
      '몸이 무겁고 나른하며, 당뇨 위험이 있다.',
    gwadaUnse:
      '안정적이나 발전이 더디다. 부동산·재물이 정체되기 쉽다. ' +
      '목(木) 운이 올 때 목극토(木剋土)로 토의 과다가 해소된다.',
    bujokSeonggyeok:
      '신뢰감이 부족하고 약속을 잘 지키지 못한다. 중심이 없어 이리저리 흔들린다. ' +
      '포용력이 부족하고 편협한 경향이 있다.',
    bujokGeongang:
      '비(脾)·위(胃)가 허약하여 소화 기능이 떨어진다. ' +
      '영양 흡수가 불량하고 체력이 약하다. 입술이 잘 트인다.',
    bujokUnse:
      '기반이 불안정하고 안정감이 부족하다. 거주지·직장이 자주 바뀐다. ' +
      '화(火) 운이 올 때 화생토(火生土)로 토의 기운이 보충된다.',
  },
  GEUM: {
    ohhaeng: 'GEUM',
    gwadaSeonggyeok:
      '지나치게 원리원칙적이고 냉정하다. 타인에게 가혹하고 비판적이다. ' +
      '의리는 있으나 융통성이 없어 관계가 경직된다.',
    gwadaGeongang:
      '폐(肺)·대장(大腸)이 과항하여 기침·천식·피부 건조·변비에 유의해야 한다. ' +
      '호흡기 알레르기·아토피 위험이 있다.',
    gwadaUnse:
      '결단력은 있으나 지나친 숙살(肅殺) 기운으로 파괴적이 될 수 있다. ' +
      '화(火) 운이 올 때 화극금(火剋金)으로 금의 과다가 순화된다.',
    bujokSeonggyeok:
      '결단력이 부족하고 우유부단하다. 의리와 원칙이 약하여 쉽게 타협한다. ' +
      '정의감이 부족하고 불의에 눈을 감는 경향이 있다.',
    bujokGeongang:
      '폐(肺)·대장(大腸)이 허약하여 호흡기 질환에 잘 걸린다. ' +
      '피부가 약하고 면역력이 떨어지며, 잔병치레가 잦다.',
    bujokUnse:
      '재물 관리가 어렵고 결단의 시기를 놓치기 쉽다. ' +
      '토(土) 운이 올 때 토생금(土生金)으로 금의 기운이 보충된다.',
  },
  SU: {
    ohhaeng: 'SU',
    gwadaSeonggyeok:
      '지나치게 교활하고 변덕이 심하다. 두려움이 많고 의심이 강하다. ' +
      '머리는 좋으나 잔꾀를 부리고 일관성이 부족하다.',
    gwadaGeongang:
      '신(腎)·방광(膀胱)이 과항하여 냉증·부종·빈뇨에 유의해야 한다. ' +
      '허리가 약하고 관절이 시리며, 비뇨기 질환 위험이 있다.',
    gwadaUnse:
      '유동적이고 변화가 많지만 안정감이 부족하다. 낭비가 심할 수 있다. ' +
      '토(土) 운이 올 때 토극수(土剋水)로 수의 과다가 억제된다.',
    bujokSeonggyeok:
      '지혜와 유연성이 부족하다. 고정관념이 강하고 적응력이 떨어진다. ' +
      '깊이가 부족하고 표면적으로 사고한다.',
    bujokGeongang:
      '신(腎)·방광(膀胱)이 허약하여 허리 통증·이명·탈모에 유의해야 한다. ' +
      '뼈가 약하고 치아가 쉽게 상하며, 노화가 빠르다.',
    bujokUnse:
      '학업·연구에 어려움이 있고 지혜를 발휘하기 어렵다. ' +
      '금(金) 운이 올 때 금생수(金生水)로 수의 기운이 보충된다.',
  },
};

// ---------------------------------------------------------------------------
// 오행 계절 왕쇠(旺衰) — 왕상휴수사(旺相休囚死)
// ---------------------------------------------------------------------------

/**
 * 오행 왕쇠(旺衰) 강도 단계
 *
 * 왕상휴수사(旺相休囚死) 5단계:
 * - WANG = 旺(왕) — 해당 계절의 주인, 기운이 가장 강함
 * - SANG = 相(상) — 왕(旺)을 생하는 기운, 두 번째로 강함 (생아生我 관계)
 * - HYU  = 休(휴) — 왕이 생하는 기운, 쉬는 상태 (아생我生 관계)
 * - SU   = 囚(수) — 왕을 극하는 기운, 갇힌 상태 (극아剋我 관계)
 * - SA   = 死(사) — 왕에게 극 당하는 기운, 가장 약함 (아극我剋 관계)
 *
 * 왕상휴수사의 결정 원리:
 *   해당 계절 오행을 X라 하면,
 *   - X 자신 = 旺(WANG)
 *   - X를 생하는 오행 = 相(SANG)
 *   - X가 생하는 오행 = 休(HYU)
 *   - X를 극하는 오행 = 囚(SU)
 *   - X가 극하는 오행 = 死(SA)
 */
export type OhhaengStrength = 'WANG' | 'SANG' | 'HYU' | 'SU' | 'SA';

/**
 * 왕상휴수사(旺相休囚死) 강도 점수
 *
 * 수치화하여 연산에 활용할 때 사용한다.
 */
export const OHHAENG_STRENGTH_SCORE: Record<OhhaengStrength, number> = {
  WANG: 5, // 旺: 최강
  SANG: 4, // 相: 강
  HYU:  2, // 休: 중간
  SU:   1, // 囚: 약
  SA:   0, // 死: 최약
};

/**
 * 계절별 오행 왕쇠(旺衰) 테이블
 *
 * 키: 'SPRING' | 'SUMMER' | 'LATE_SUMMER' | 'FALL' | 'WINTER'
 *
 * 왕상휴수사 법칙 (계절 오행 X 기준):
 *   X = 旺, 생아(生我) = 相, 아생(我生) = 休, 극아(剋我) = 囚, 아극(我剋) = 死
 *
 * - 봄(SPRING):        木旺 火休 土死 金囚 水相
 * - 여름(SUMMER):      火旺 土休 金死 水囚 木相
 * - 사계말(LATE_SUMMER): 土旺 金休 水死 木囚 火相
 * - 가을(FALL):        金旺 水休 木死 火囚 土相
 * - 겨울(WINTER):      水旺 木休 火死 土囚 金相
 */
export const SEASONAL_STRENGTH: Record<string, Record<Ohhaeng, OhhaengStrength>> = {
  /** 봄(春) — 인묘진(寅卯辰)월: 木이 사령(司令)
   *  木旺, 水相(생아), 火休(아생), 金囚(극아), 土死(아극)
   */
  SPRING: {
    MOK:  'WANG', // 木旺: 봄의 주인
    HWA:  'HYU',  // 火休: 木이 火를 생하므로(아생) 휴식
    TO:   'SA',   // 土死: 木이 土를 극하므로(아극) 가장 쇠약
    GEUM: 'SU',   // 金囚: 金이 木을 극하지만(극아) 木이 왕하므로 갇힘
    SU:   'SANG', // 水相: 水가 木을 생하므로(생아) 두 번째로 강함
  },
  /** 여름(夏) — 사오미(巳午未)월: 火가 사령(司令)
   *  火旺, 木相(생아), 土休(아생), 水囚(극아), 金死(아극)
   */
  SUMMER: {
    MOK:  'SANG', // 木相: 木이 火를 생하므로(생아) 두 번째로 강함
    HWA:  'WANG', // 火旺: 여름의 주인
    TO:   'HYU',  // 土休: 火가 土를 생하므로(아생) 휴식
    GEUM: 'SA',   // 金死: 火가 金을 극하므로(아극) 가장 쇠약
    SU:   'SU',   // 水囚: 水가 火를 극하지만(극아) 火가 왕하므로 갇힘
  },
  /** 사계말(四季末) — 辰·戌·丑·未월(각 계절 끝 18일): 土가 사령(司令)
   *  土旺, 火相(생아), 金休(아생), 木囚(극아), 水死(아극)
   */
  LATE_SUMMER: {
    MOK:  'SU',   // 木囚: 木이 土를 극하지만(극아) 土가 왕하므로 갇힘
    HWA:  'SANG', // 火相: 火가 土를 생하므로(생아) 두 번째로 강함
    TO:   'WANG', // 土旺: 사계말의 주인
    GEUM: 'HYU',  // 金休: 土가 金을 생하므로(아생) 휴식
    SU:   'SA',   // 水死: 土가 水를 극하므로(아극) 가장 쇠약
  },
  /** 가을(秋) — 신유술(申酉戌)월: 金이 사령(司令)
   *  金旺, 土相(생아), 水休(아생), 火囚(극아), 木死(아극)
   */
  FALL: {
    MOK:  'SA',   // 木死: 金이 木을 극하므로(아극) 가장 쇠약
    HWA:  'SU',   // 火囚: 火가 金을 극하지만(극아) 金이 왕하므로 갇힘
    TO:   'SANG', // 土相: 土가 金을 생하므로(생아) 두 번째로 강함
    GEUM: 'WANG', // 金旺: 가을의 주인
    SU:   'HYU',  // 水休: 金이 水를 생하므로(아생) 휴식
  },
  /** 겨울(冬) — 해자축(亥子丑)월: 水가 사령(司令)
   *  水旺, 金相(생아), 木休(아생), 土囚(극아), 火死(아극)
   */
  WINTER: {
    MOK:  'HYU',  // 木休: 水가 木을 생하므로(아생) 휴식
    HWA:  'SA',   // 火死: 水가 火를 극하므로(아극) 가장 쇠약
    TO:   'SU',   // 土囚: 土가 水를 극하지만(극아) 水가 왕하므로 갇힘
    GEUM: 'SANG', // 金相: 金이 水를 생하므로(생아) 두 번째로 강함
    SU:   'WANG', // 水旺: 겨울의 주인
  },
};

/**
 * 지지(月支) 인덱스 → 계절(Season) 키 변환 맵
 *
 * 월지 인덱스로부터 SEASONAL_STRENGTH의 키를 결정할 때 사용한다.
 *
 * NOTE: 辰(4)·戌(10)·丑(1)·未(7)은 사고지(四庫地)로 토(土)의 계절이지만,
 * 실전에서는 해당 계절의 영향도 함께 고려해야 한다.
 * 이 맵은 가장 단순한 분류 기준을 제공한다.
 *
 * - 寅(2)·卯(3)·辰(4) = SPRING
 * - 巳(5)·午(6)·未(7) = SUMMER
 * - 申(8)·酉(9)·戌(10) = FALL
 * - 亥(11)·子(0)·丑(1) = WINTER
 */
export const BRANCH_TO_SEASON: Record<number, string> = {
  0:  'WINTER',  // 子(JA)
  1:  'WINTER',  // 丑(CHUK) — 실전에서는 LATE_SUMMER(토왕지)도 고려
  2:  'SPRING',  // 寅(IN)
  3:  'SPRING',  // 卯(MYO)
  4:  'SPRING',  // 辰(JIN) — 실전에서는 LATE_SUMMER(토왕지)도 고려
  5:  'SUMMER',  // 巳(SA)
  6:  'SUMMER',  // 午(O)
  7:  'SUMMER',  // 未(MI) — 실전에서는 LATE_SUMMER(토왕지)도 고려
  8:  'FALL',    // 申(SHIN)
  9:  'FALL',    // 酉(YU)
  10: 'FALL',    // 戌(SUL) — 실전에서는 LATE_SUMMER(토왕지)도 고려
  11: 'WINTER',  // 亥(HAE)
};

// ---------------------------------------------------------------------------
// 오행 통합 배속(配屬) 테이블
// ---------------------------------------------------------------------------

/**
 * 오행 통합 배속 인터페이스
 *
 * 하나의 오행에 대한 모든 배속 정보를 한 곳에서 조회할 수 있도록 한다.
 */
export interface OhhaengBaesok {
  /** 오행 */
  ohhaeng: Ohhaeng;
  /** 방위 */
  bangwi: string;
  /** 계절 */
  gyejeol: string;
  /** 색깔 */
  saek: string;
  /** 하도 생수·성수 */
  suri: [number, number];
  /** 맛 */
  mat: string;
  /** 감정 */
  gamjeong: string;
  /** 장부 */
  jangbu: string;
  /** 덕목(오상) */
  deokmok: string;
  /** 오관 */
  ogwan: string;
  /** 오체 */
  oche: string;
}

/**
 * 오행 통합 배속 테이블
 *
 * 방위·계절·색·수리·맛·감정·장부·덕목·오관·오체를 한 레코드로 통합한다.
 * 개별 배속 맵(OHHAENG_DIRECTION, OHHAENG_SEASON 등)은 기존과 호환을 위해 유지하며,
 * 이 테이블은 일괄 조회용으로 제공한다.
 */
export const OHHAENG_BAESOK: Record<Ohhaeng, OhhaengBaesok> = {
  MOK: {
    ohhaeng:  'MOK',
    bangwi:   '동(東)',
    gyejeol:  '봄(春)',
    saek:     '청(靑)',
    suri:     [3, 8],
    mat:      '신(酸)',
    gamjeong: '노(怒)',
    jangbu:   '간담(肝膽)',
    deokmok:  '인(仁)',
    ogwan:    '눈(目)',
    oche:     '근(筋)',
  },
  HWA: {
    ohhaeng:  'HWA',
    bangwi:   '남(南)',
    gyejeol:  '여름(夏)',
    saek:     '적(赤)',
    suri:     [2, 7],
    mat:      '쓴(苦)',
    gamjeong: '희(喜)',
    jangbu:   '심소장(心小腸)',
    deokmok:  '예(禮)',
    ogwan:    '혀(舌)',
    oche:     '맥(脈)',
  },
  TO: {
    ohhaeng:  'TO',
    bangwi:   '중(中)',
    gyejeol:  '사계말(四季末)',
    saek:     '황(黃)',
    suri:     [5, 10],
    mat:      '단(甘)',
    gamjeong: '사(思)',
    jangbu:   '비위(脾胃)',
    deokmok:  '신(信)',
    ogwan:    '입(口)',
    oche:     '육(肉)',
  },
  GEUM: {
    ohhaeng:  'GEUM',
    bangwi:   '서(西)',
    gyejeol:  '가을(秋)',
    saek:     '백(白)',
    suri:     [4, 9],
    mat:      '매운(辛)',
    gamjeong: '비(悲)',
    jangbu:   '폐대장(肺大腸)',
    deokmok:  '의(義)',
    ogwan:    '코(鼻)',
    oche:     '피모(皮毛)',
  },
  SU: {
    ohhaeng:  'SU',
    bangwi:   '북(北)',
    gyejeol:  '겨울(冬)',
    saek:     '흑(黑)',
    suri:     [1, 6],
    mat:      '짠(鹹)',
    gamjeong: '공(恐)',
    jangbu:   '신방광(腎膀胱)',
    deokmok:  '지(智)',
    ogwan:    '귀(耳)',
    oche:     '골(骨)',
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
 * 내가 생(生)하는 오행 반환 (상생 순방향 / 설기)
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
 * 내가 극(剋)하는 오행 반환 (상극 순방향 / 모기)
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
 * 나를 생(生)하는 오행 반환 (상생 역방향 / 인성)
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
 * 나를 극(剋)하는 오행 반환 (상극 역방향 / 관성)
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

/**
 * 특정 계절에서 주어진 오행의 왕상휴수사 강도를 반환한다
 *
 * @param ohhaeng - 오행
 * @param season - 계절 키 ('SPRING' | 'SUMMER' | 'LATE_SUMMER' | 'FALL' | 'WINTER')
 * @returns 왕상휴수사 강도, 유효하지 않은 계절이면 undefined
 *
 * @example
 * getSeasonalStrength('MOK', 'SPRING') // 'WANG' (봄에 木은 왕)
 * getSeasonalStrength('MOK', 'FALL')   // 'SA' (가을에 木은 사)
 */
export function getSeasonalStrength(
  ohhaeng: Ohhaeng,
  season: string,
): OhhaengStrength | undefined {
  return SEASONAL_STRENGTH[season]?.[ohhaeng];
}

/**
 * 월지(月支) 인덱스로부터 해당 계절에서의 오행 강도를 반환한다
 *
 * @param ohhaeng - 오행
 * @param monthBranchIdx - 월지(月支) 인덱스 (0-11)
 * @returns 왕상휴수사 강도
 *
 * @example
 * getStrengthByMonth('MOK', 2) // 'WANG' — 寅(인)월은 봄, 木 왕
 * getStrengthByMonth('MOK', 8) // 'SA'   — 申(신)월은 가을, 木 사
 */
export function getStrengthByMonth(
  ohhaeng: Ohhaeng,
  monthBranchIdx: number,
): OhhaengStrength | undefined {
  const season = BRANCH_TO_SEASON[monthBranchIdx];
  if (!season) return undefined;
  return SEASONAL_STRENGTH[season]?.[ohhaeng];
}

/**
 * 두 오행 간의 관계를 판별한다
 *
 * 일간(subject) 기준으로 대상(target) 오행이 어떤 관계인지 반환한다.
 *
 * @param subject - 주체 오행 (일간)
 * @param target - 대상 오행
 * @returns 관계 식별자
 *
 * @example
 * getOhhaengRelation('MOK', 'HWA')  // 'SIKSANG' (목생화: 식상)
 * getOhhaengRelation('MOK', 'TO')   // 'JAESEONG' (목극토: 재성)
 * getOhhaengRelation('MOK', 'GEUM') // 'GWANSEONG' (금극목: 관성)
 * getOhhaengRelation('MOK', 'SU')   // 'INSEONG' (수생목: 인성)
 * getOhhaengRelation('MOK', 'MOK')  // 'BIGYEOP' (동오행: 비겁)
 */
export function getOhhaengRelation(
  subject: Ohhaeng,
  target: Ohhaeng,
): 'BIGYEOP' | 'SIKSANG' | 'JAESEONG' | 'GWANSEONG' | 'INSEONG' {
  const rel = OHHAENG_GWANGYE_MAP[subject];
  if (target === rel.bigyeop) return 'BIGYEOP';
  if (target === rel.siksang) return 'SIKSANG';
  if (target === rel.jaeseong) return 'JAESEONG';
  if (target === rel.gwanseong) return 'GWANSEONG';
  return 'INSEONG';
}
