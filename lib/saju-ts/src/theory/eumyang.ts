/**
 * 음양론(陰陽論) 이론 모듈
 *
 * 음(陰)과 양(陽)은 우주 만물을 이루는 두 가지 상반된 기운으로,
 * 사주명리학에서 천간과 지지 각각에 배속되어 운동 방향과 성질을 결정한다.
 *
 * 양(陽): 하늘·빛·움직임·확산·남성적 기운 → 순행(順行)
 * 음(陰): 땅·어둠·고요함·수렴·여성적 기운 → 역행(逆行)
 *
 * 음양의 핵심 원리:
 *   1. 상호대립(相互對立): 음과 양은 서로 대립하되 공존한다.
 *   2. 상호의존(相互依存): 음이 없으면 양이 없고, 양이 없으면 음이 없다.
 *   3. 상호소장(相互消長): 양이 극에 달하면 음이 생기고, 음이 극에 달하면 양이 생긴다.
 *   4. 상호전화(相互轉化): 일정 조건이 충족되면 음은 양으로, 양은 음으로 전환한다.
 *
 * 근거 문헌: 周易(주역), 黃帝內經(황제내경), 子平眞詮(자평진전)
 */

import type { YinYang, StemIdx, BranchIdx } from '../core/cycle.js';

// ---------------------------------------------------------------------------
// 기본 타입
// ---------------------------------------------------------------------------

/**
 * 음양 한글 로마자 표기
 *
 * core/cycle.ts 의 {@link YinYang} 타입과 동일한 값 집합이다.
 * 이 모듈에서는 음양론 맥락을 명확히 하기 위해 별도 타입으로 재선언한다.
 *
 * - YANG = 양(陽)
 * - YIN  = 음(陰)
 */
export type Eumyang = 'YANG' | 'YIN';

/**
 * 성별 타입
 *
 * 음양순역(陰陽順逆) 판단에서 성별이 필요하다.
 */
export type Seongbyeol = 'MALE' | 'FEMALE';

// ---------------------------------------------------------------------------
// 천간 음양 배속(天干陰陽配屬)
// ---------------------------------------------------------------------------

/**
 * 천간(天干) 음양 배속 맵
 *
 * 10천간은 짝수 인덱스가 양(陽), 홀수 인덱스가 음(陰)이다.
 *
 * | 인덱스 | 천간 | 로마자  | 음양 |
 * |--------|------|---------|------|
 * | 0      | 甲   | GAP     | YANG |
 * | 1      | 乙   | EUL     | YIN  |
 * | 2      | 丙   | BYEONG  | YANG |
 * | 3      | 丁   | JEONG   | YIN  |
 * | 4      | 戊   | MU      | YANG |
 * | 5      | 己   | GI      | YIN  |
 * | 6      | 庚   | GYEONG  | YANG |
 * | 7      | 辛   | SIN     | YIN  |
 * | 8      | 壬   | IM      | YANG |
 * | 9      | 癸   | GYE     | YIN  |
 */
export const STEM_EUMYANG: Record<number, Eumyang> = {
  0: 'YANG', // 甲(GAP)  — 양목(陽木)
  1: 'YIN',  // 乙(EUL)  — 음목(陰木)
  2: 'YANG', // 丙(BYEONG) — 양화(陽火)
  3: 'YIN',  // 丁(JEONG) — 음화(陰火)
  4: 'YANG', // 戊(MU)   — 양토(陽土)
  5: 'YIN',  // 己(GI)   — 음토(陰土)
  6: 'YANG', // 庚(GYEONG) — 양금(陽金)
  7: 'YIN',  // 辛(SIN)  — 음금(陰金)
  8: 'YANG', // 壬(IM)   — 양수(陽水)
  9: 'YIN',  // 癸(GYE)  — 음수(陰水)
};

// ---------------------------------------------------------------------------
// 지지 음양 배속(地支陰陽配屬)
// ---------------------------------------------------------------------------

/**
 * 지지(地支) 음양 배속 맵
 *
 * 12지지도 짝수 인덱스가 양(陽), 홀수 인덱스가 음(陰)이다.
 *
 * | 인덱스 | 지지 | 로마자 | 음양 |
 * |--------|------|--------|------|
 * | 0      | 子   | JA     | YANG |
 * | 1      | 丑   | CHUK   | YIN  |
 * | 2      | 寅   | IN     | YANG |
 * | 3      | 卯   | MYO    | YIN  |
 * | 4      | 辰   | JIN    | YANG |
 * | 5      | 巳   | SA     | YIN  |
 * | 6      | 午   | O      | YANG |
 * | 7      | 未   | MI     | YIN  |
 * | 8      | 申   | SHIN   | YANG |
 * | 9      | 酉   | YU     | YIN  |
 * | 10     | 戌   | SUL    | YANG |
 * | 11     | 亥   | HAE    | YIN  |
 */
export const BRANCH_EUMYANG: Record<number, Eumyang> = {
  0:  'YANG', // 子(JA)   — 양수(陽水)
  1:  'YIN',  // 丑(CHUK) — 음토(陰土)
  2:  'YANG', // 寅(IN)   — 양목(陽木)
  3:  'YIN',  // 卯(MYO)  — 음목(陰木)
  4:  'YANG', // 辰(JIN)  — 양토(陽土)
  5:  'YIN',  // 巳(SA)   — 음화(陰火)
  6:  'YANG', // 午(O)    — 양화(陽火)
  7:  'YIN',  // 未(MI)   — 음토(陰土)
  8:  'YANG', // 申(SHIN) — 양금(陽金)
  9:  'YIN',  // 酉(YU)   — 음금(陰金)
  10: 'YANG', // 戌(SUL)  — 양토(陽土)
  11: 'YIN',  // 亥(HAE)  — 음수(陰水)
};

// ---------------------------------------------------------------------------
// 음양 조화(陰陽調和) 이론
// ---------------------------------------------------------------------------

/**
 * 음양 조화(陰陽調和) 이론 인터페이스
 *
 * 음양 각각의 동·정(動靜), 방향성, 표현 양식을 상세 기술한다.
 */
export interface EumyangJohwa {
  /** 음양 식별자 */
  eumyang: Eumyang;
  /** 동정(動靜): 양은 동(動), 음은 정(靜) */
  dongjjeong: string;
  /** 방향성: 양은 외향(外向)·확산(擴散), 음은 내향(內向)·수렴(收斂) */
  banghyang: string;
  /** 형태: 양은 무형(無形)·기(氣), 음은 유형(有形)·질(質) */
  hyeongtae: string;
  /** 시간: 양은 낮·봄여름, 음은 밤·가을겨울 */
  sigan: string;
  /** 온도: 양은 온(溫)·열(熱), 음은 량(涼)·한(寒) */
  ondo: string;
  /** 위치: 양은 상(上)·외(外)·좌(左), 음은 하(下)·내(內)·우(右) */
  wichi: string;
  /** 수리: 양은 홀수(奇數), 음은 짝수(偶數) */
  suri: string;
}

/**
 * 음양 조화 이론 테이블
 *
 * 양은 동적(動的)·외향(外向)·확산(擴散)의 속성을 가지며,
 * 음은 정적(靜的)·내향(內向)·수렴(收斂)의 속성을 가진다.
 *
 * 만물은 음양의 조화(調和)로 존재하며, 한쪽으로 치우치면 병(病)이 된다.
 * 사주에서도 음양의 균형이 이상적이며, 편중(偏重)은 성격·건강·운세에 영향을 준다.
 */
export const EUMYANG_JOHWA: Record<Eumyang, EumyangJohwa> = {
  YANG: {
    eumyang:    'YANG',
    dongjjeong: '동(動) — 움직이고 변화하며 끊임없이 활동하려는 속성. 양은 정지하지 않는다.',
    banghyang:  '외향(外向)·확산(擴散) — 안에서 밖으로 뻗어나가며, 위로 상승하고, 넓게 퍼지려 한다.',
    hyeongtae:  '무형(無形)·기(氣) — 양은 형체가 없는 기(氣)의 성질로, 에너지·열·빛에 해당한다.',
    sigan:      '낮(晝)·봄(春)·여름(夏) — 하루 중 낮, 계절 중 봄·여름은 양의 시간이다.',
    ondo:       '온(溫)·열(熱) — 따뜻하고 뜨거운 것은 양에 속한다.',
    wichi:      '상(上)·외(外)·좌(左) — 위쪽·바깥쪽·왼쪽은 양의 위치이다.',
    suri:       '홀수(奇數): 1·3·5·7·9 — 양은 홀수에 배속된다.',
  },
  YIN: {
    eumyang:    'YIN',
    dongjjeong: '정(靜) — 고요하고 안정되며 현상을 유지하려는 속성. 음은 변화를 억제한다.',
    banghyang:  '내향(內向)·수렴(收斂) — 밖에서 안으로 모이며, 아래로 하강하고, 응축하려 한다.',
    hyeongtae:  '유형(有形)·질(質) — 음은 형체가 있는 물질의 성질로, 신체·물체·대지에 해당한다.',
    sigan:      '밤(夜)·가을(秋)·겨울(冬) — 하루 중 밤, 계절 중 가을·겨울은 음의 시간이다.',
    ondo:       '량(涼)·한(寒) — 서늘하고 차가운 것은 음에 속한다.',
    wichi:      '하(下)·내(內)·우(右) — 아래쪽·안쪽·오른쪽은 음의 위치이다.',
    suri:       '짝수(偶數): 2·4·6·8·10 — 음은 짝수에 배속된다.',
  },
};

// ---------------------------------------------------------------------------
// 음양 특성(陰陽特性) 기술
// ---------------------------------------------------------------------------

/**
 * 음양 특성 인터페이스
 */
export interface EumyangCharacteristic {
  /** 음양 식별자 */
  eumyang: Eumyang;
  /** 성질 — 기본 속성 설명 */
  nature: string;
  /** 운동성 — 순행(順) 또는 역행(逆) */
  motion: string;
  /** 경향 — 성격·행동 경향 */
  tendency: string;
}

/**
 * 음양 특성 테이블
 *
 * 음양의 기본 성질, 운동 방향, 성격 경향을 기술한다.
 */
export const EUMYANG_CHARACTERISTICS: Record<Eumyang, EumyangCharacteristic> = {
  YANG: {
    eumyang:  'YANG',
    nature:   '하늘(天)·빛·열·동(動)·강(剛)·남성적 기운. 위로 오르고 바깥으로 뻗어나가려는 속성.',
    motion:   '순행(順行) — 시계 방향으로 전진하며 생장(生長)·발산(發散)의 방향으로 운동.',
    tendency: '적극적·외향적·진취적·주도적. 변화를 일으키고 새로운 것을 향해 나아가는 경향.',
  },
  YIN: {
    eumyang:  'YIN',
    nature:   '땅(地)·어둠·냉·정(靜)·유(柔)·여성적 기운. 아래로 내려오고 안으로 모이려는 속성.',
    motion:   '역행(逆行) — 반시계 방향으로 수렴하며 수장(收藏)·응집(凝集)의 방향으로 운동.',
    tendency: '소극적·내향적·신중적·보조적. 기존 것을 보존하고 안정을 추구하는 경향.',
  },
};

// ---------------------------------------------------------------------------
// 양간·음간·양지·음지 목록
// ---------------------------------------------------------------------------

/**
 * 양간(陽干) 인덱스 목록
 *
 * 10천간 중 양(陽)에 해당하는 5간의 인덱스:
 * 甲(0)·丙(2)·戊(4)·庚(6)·壬(8)
 */
export const YANG_STEMS: StemIdx[] = [0, 2, 4, 6, 8];

/**
 * 음간(陰干) 인덱스 목록
 *
 * 10천간 중 음(陰)에 해당하는 5간의 인덱스:
 * 乙(1)·丁(3)·己(5)·辛(7)·癸(9)
 */
export const YIN_STEMS: StemIdx[] = [1, 3, 5, 7, 9];

/**
 * 양지(陽支) 인덱스 목록
 *
 * 12지지 중 양(陽)에 해당하는 6지의 인덱스:
 * 子(0)·寅(2)·辰(4)·午(6)·申(8)·戌(10)
 */
export const YANG_BRANCHES: BranchIdx[] = [0, 2, 4, 6, 8, 10];

/**
 * 음지(陰支) 인덱스 목록
 *
 * 12지지 중 음(陰)에 해당하는 6지의 인덱스:
 * 丑(1)·卯(3)·巳(5)·未(7)·酉(9)·亥(11)
 */
export const YIN_BRANCHES: BranchIdx[] = [1, 3, 5, 7, 9, 11];

// ---------------------------------------------------------------------------
// 양일간(陽日干) vs 음일간(陰日干) 실전 해석
// ---------------------------------------------------------------------------

/**
 * 일간 음양 실전 해석 인터페이스
 *
 * 양일간(陽日干)과 음일간(陰日干)의 성격·행동·운세 차이를
 * 실전 명리학 관점에서 기술한다.
 */
export interface IlganEumyangHaeseok {
  /** 음양 식별자 */
  eumyang: Eumyang;
  /** 성격 특성 */
  seonggyeok: string;
  /** 대인관계 */
  daeinGwangye: string;
  /** 직업 경향 */
  jikeopGyeonghyang: string;
  /** 건강 경향 */
  geongangGyeonghyang: string;
  /** 배우자 관계 */
  baeujaGwangye: string;
  /** 해당 천간 목록 (한자) */
  cheonganMokrok: string;
}

/**
 * 양일간(陽日干) vs 음일간(陰日干) 실전 해석 테이블
 *
 * 일간(日干)의 음양은 사주 해석의 가장 기본적인 출발점이다.
 * 양일간은 갑(甲)·병(丙)·무(戊)·경(庚)·임(壬),
 * 음일간은 을(乙)·정(丁)·기(己)·신(辛)·계(癸)이다.
 *
 * 양간은 강하고 직접적이며 능동적인 성향을 띠고,
 * 음간은 부드럽고 간접적이며 수용적인 성향을 띤다.
 */
export const ILGAN_EUMYANG_HAESEOK: Record<Eumyang, IlganEumyangHaeseok> = {
  YANG: {
    eumyang: 'YANG',
    seonggyeok:
      '강직(剛直)하고 결단력이 있으며, 추진력과 지도력이 강하다. ' +
      '주관이 뚜렷하고 자기 표현이 직접적이다. ' +
      '때로 고집이 세고 융통성이 부족할 수 있다.',
    daeinGwangye:
      '사교적이고 주도적으로 관계를 이끈다. ' +
      '의리를 중시하고 대범하나, 상대의 감정을 세밀히 살피지 못할 수 있다. ' +
      '리더 역할을 자연스럽게 맡는 편이다.',
    jikeopGyeonghyang:
      '독립적 사업·경영·관리직에 적합하다. ' +
      '개척자적 역할, 의사결정이 빠른 직종에서 두각을 나타낸다.',
    geongangGyeonghyang:
      '양(陽)의 기운이 강해 열(熱)과 관련된 증상에 유의해야 한다. ' +
      '과로·스트레스로 인한 급성 질환에 노출되기 쉽다. ' +
      '체력은 강하나 무리하는 경향이 있다.',
    baeujaGwangye:
      '양일간 남성은 재성(財星)을 적극적으로 구하며 배우자에 대한 소유욕이 강하다. ' +
      '양일간 여성은 관성(官星)에 대해 당당하며 강한 배우자를 선호한다.',
    cheonganMokrok: '甲(갑)·丙(병)·戊(무)·庚(경)·壬(임)',
  },
  YIN: {
    eumyang: 'YIN',
    seonggyeok:
      '유연(柔軟)하고 섬세하며, 적응력과 관찰력이 뛰어나다. ' +
      '내면이 깊고 감수성이 풍부하다. ' +
      '때로 우유부단하고 의존적이 될 수 있다.',
    daeinGwangye:
      '상대의 감정을 잘 읽고 배려심이 깊다. ' +
      '갈등을 피하려는 경향이 있으며, 보조적 역할에서 안정을 느낀다. ' +
      '깊고 오래가는 관계를 중시한다.',
    jikeopGyeonghyang:
      '협력적 환경, 전문직, 예술·학문 분야에 적합하다. ' +
      '세밀함이 요구되는 직종, 서비스업, 상담·교육 분야에서 능력을 발휘한다.',
    geongangGyeonghyang:
      '음(陰)의 기운이 강해 한(寒)·습(濕)과 관련된 증상에 유의해야 한다. ' +
      '만성 피로·소화 장애·냉증에 노출되기 쉽다. ' +
      '체력이 약해 보이나 지구력은 있다.',
    baeujaGwangye:
      '음일간 남성은 재성(財星)을 다정하게 대하며 배우자에게 헌신적이다. ' +
      '음일간 여성은 관성(官星)에 순응하는 편이나 내면에 자기만의 기준이 있다.',
    cheonganMokrok: '乙(을)·丁(정)·己(기)·辛(신)·癸(계)',
  },
};

// ---------------------------------------------------------------------------
// 양지(陽支) vs 음지(陰支) 실전 해석
// ---------------------------------------------------------------------------

/**
 * 양지·음지 실전 해석 인터페이스
 *
 * 지지(地支)의 음양에 따른 해석 차이를 기술한다.
 */
export interface JijiEumyangHaeseok {
  /** 음양 식별자 */
  eumyang: Eumyang;
  /** 지지 목록 (한자) */
  jijiMokrok: string;
  /** 기운 특성 */
  giunTeukseong: string;
  /** 월지로 올 때의 해석 */
  woljiHaeseok: string;
  /** 일지로 올 때의 해석 */
  iljiHaeseok: string;
}

/**
 * 양지(陽支) vs 음지(陰支) 실전 해석 테이블
 *
 * 지지의 음양은 그 자리에 따라 월지(月支)·일지(日支)·시지(時支) 등에서
 * 다른 맥락의 해석을 낳는다.
 *
 * 양지(陽支): 子·寅·辰·午·申·戌 -- 기운이 활발하고 변화가 빠르다.
 * 음지(陰支): 丑·卯·巳·未·酉·亥 -- 기운이 안정적이고 축적하는 성질이다.
 */
export const JIJI_EUMYANG_HAESEOK: Record<Eumyang, JijiEumyangHaeseok> = {
  YANG: {
    eumyang: 'YANG',
    jijiMokrok: '子(자)·寅(인)·辰(진)·午(오)·申(신)·戌(술)',
    giunTeukseong:
      '양지는 기운이 동적(動的)이고 발산적이다. ' +
      '변화의 시작과 전환을 주관하며, 활발한 에너지를 가진다. ' +
      '양지 중 子·午·卯·酉를 사정(四正)이라 하고, 寅·申·巳·亥를 사생(四生)이라 하며, ' +
      '辰·戌·丑·未를 사고(四庫)라 한다.',
    woljiHaeseok:
      '월지가 양지이면 그 달의 기운이 활발하게 작용하여 ' +
      '일간에 대한 영향력이 직접적이고 강하다.',
    iljiHaeseok:
      '일지가 양지이면 배우자궁(配偶者宮)의 기운이 활발하여 ' +
      '배우자가 적극적이고 사회적 활동이 많은 편이다.',
  },
  YIN: {
    eumyang: 'YIN',
    jijiMokrok: '丑(축)·卯(묘)·巳(사)·未(미)·酉(유)·亥(해)',
    giunTeukseong:
      '음지는 기운이 정적(靜的)이고 수렴적이다. ' +
      '축적과 저장을 주관하며, 안정된 에너지를 가진다. ' +
      '음지는 내면의 깊이와 실속을 나타내며, 양지에 비해 변화가 완만하다.',
    woljiHaeseok:
      '월지가 음지이면 그 달의 기운이 은근하게 작용하여 ' +
      '일간에 대한 영향이 간접적이지만 지속적이다.',
    iljiHaeseok:
      '일지가 음지이면 배우자궁(配偶者宮)의 기운이 안정적이어서 ' +
      '배우자가 내조적이고 가정 중심적인 편이다.',
  },
};

// ---------------------------------------------------------------------------
// 양순음역(陽順陰逆) 원칙 — 음양순역(陰陽順逆)
// ---------------------------------------------------------------------------

/**
 * 양순음역(陽順陰逆) 원칙
 *
 * 대운(大運) 및 세운(歲運) 계산에서 핵심적으로 사용되는 음양 운동 원칙.
 * - 양남음녀(陽男陰女)는 순행(順行): 생일 이후 다음 절기(節氣)까지의 날수로 대운 계산
 * - 음남양녀(陰男陽女)는 역행(逆行): 생일 이전 직전 절기까지의 날수로 대운 계산
 */
export const YANG_SUN_EUM_YEOK: {
  principle: string;
  yangRule: string;
  yinRule: string;
} = {
  principle:
    '양순음역(陽順陰逆): 양(陽)은 순행(順行)하고 음(陰)은 역행(逆行)한다. ' +
    '사주명리학의 대운(大運) 방향을 결정하는 핵심 원칙으로, ' +
    '일간(日干)의 음양과 성별(性別)의 조합으로 대운의 진행 방향을 정한다.',
  yangRule:
    '양간(陽干) 남성·음간(陰干) 여성은 순행(順行): ' +
    '생일(生日) 이후 다음 절기(節氣)까지의 날수를 3으로 나누어 대운(大運) 시작 나이를 구한다. ' +
    '대운은 甲→乙→丙... 순서로 진행한다.',
  yinRule:
    '음간(陰干) 남성·양간(陽干) 여성은 역행(逆行): ' +
    '생일(生日) 이전 직전 절기(節氣)까지의 날수를 3으로 나누어 대운(大運) 시작 나이를 구한다. ' +
    '대운은 癸→壬→辛... 역순으로 진행한다.',
};

/**
 * 음양순역(陰陽順逆) 상세 원리 인터페이스
 *
 * 대운 방향 결정의 네 가지 경우를 명확히 기술한다.
 */
export interface EumyangSunyeokCase {
  /** 경우 명칭 (한글) */
  caseName: string;
  /** 일간 음양 */
  ilganEumyang: Eumyang;
  /** 성별 */
  seongbyeol: Seongbyeol;
  /** 대운 방향 */
  daewunBanghyang: 'SUNHAENG' | 'YEOKHAENG';
  /** 절기 기준 설명 */
  jeolgiGijun: string;
}

/**
 * 음양순역(陰陽順逆) 4가지 경우 테이블
 *
 * 일간(日干)의 음양과 성별의 조합에 따른 대운 방향:
 * 1. 양간(陽干) + 남(男) = 순행(順行)
 * 2. 양간(陽干) + 여(女) = 역행(逆行)
 * 3. 음간(陰干) + 남(男) = 역행(逆行)
 * 4. 음간(陰干) + 여(女) = 순행(順行)
 *
 * 원리: 양(陽)은 남성과 동류이므로 양간 남성은 본래 방향(순행)을 따르고,
 * 양간 여성은 음양이 교차하므로 역행한다. 음간도 같은 논리로 적용된다.
 */
export const EUMYANG_SUNYEOK_CASES: EumyangSunyeokCase[] = [
  {
    caseName:        '양남순행(陽男順行)',
    ilganEumyang:    'YANG',
    seongbyeol:      'MALE',
    daewunBanghyang: 'SUNHAENG',
    jeolgiGijun:
      '생일(生日)부터 다음 절기(節氣)까지의 날수를 센다. ' +
      '절기(節)는 입춘·경칩·청명·입하·망종·소서·입추·백로·한로·입동·대설·소한의 12절이다.',
  },
  {
    caseName:        '양녀역행(陽女逆行)',
    ilganEumyang:    'YANG',
    seongbyeol:      'FEMALE',
    daewunBanghyang: 'YEOKHAENG',
    jeolgiGijun:
      '생일(生日)부터 직전(이전) 절기(節氣)까지의 날수를 역으로 센다.',
  },
  {
    caseName:        '음남역행(陰男逆行)',
    ilganEumyang:    'YIN',
    seongbyeol:      'MALE',
    daewunBanghyang: 'YEOKHAENG',
    jeolgiGijun:
      '생일(生日)부터 직전(이전) 절기(節氣)까지의 날수를 역으로 센다.',
  },
  {
    caseName:        '음녀순행(陰女順行)',
    ilganEumyang:    'YIN',
    seongbyeol:      'FEMALE',
    daewunBanghyang: 'SUNHAENG',
    jeolgiGijun:
      '생일(生日)부터 다음 절기(節氣)까지의 날수를 센다.',
  },
];

// ---------------------------------------------------------------------------
// 음양 편중(陰陽偏重) 판단
// ---------------------------------------------------------------------------

/**
 * 음양 편중 해석 인터페이스
 *
 * 사주 팔자(八字) 중 양과 음의 비율이 치우쳤을 때의 해석을 기술한다.
 */
export interface EumyangPyeonjungHaeseok {
  /** 편중 유형 */
  yuheong: string;
  /** 성격 경향 */
  seonggyeok: string;
  /** 건강 경향 */
  geongang: string;
  /** 대인관계 경향 */
  daeinGwangye: string;
  /** 개선 방향 (용신적 관점) */
  gaeseonBanghyang: string;
}

/**
 * 음양 편중(陰陽偏重) 판단 및 해석 테이블
 *
 * 사주 8자(년·월·일·시의 천간·지지) 중 양과 음의 비율을 통해
 * 음양 편중을 판단한다. 일반적으로 양 4~5개 : 음 3~4개가 균형이며,
 * 양 또는 음이 6개 이상이면 편중으로 본다.
 *
 * 판단 기준:
 * - 양과다(陽過多): 8자 중 양이 6개 이상
 * - 음과다(陰過多): 8자 중 음이 6개 이상
 * - 균형(均衡): 양 3~5개, 음 3~5개
 * - 극양(極陽): 8자 전부 양 (극히 드묾)
 * - 극음(極陰): 8자 전부 음 (극히 드묾)
 */
export const EUMYANG_PYEONJUNG: Record<string, EumyangPyeonjungHaeseok> = {
  /** 양이 사주에서 과다할 때 (6개 이상) */
  YANG_GWADA: {
    yuheong: '양과다(陽過多)',
    seonggyeok:
      '성격이 급하고 공격적이며 자기주장이 매우 강하다. ' +
      '참을성이 부족하고 타인의 의견을 경시하는 경향이 있다. ' +
      '행동이 앞서고 사려 깊지 못한 면이 있다.',
    geongang:
      '양기(陽氣) 과다로 열(熱)이 많아 두통·고혈압·심장 질환·염증에 유의해야 한다. ' +
      '간화(肝火)가 올라 눈이 충혈되거나 화를 잘 내는 증상이 나타날 수 있다.',
    daeinGwangye:
      '지배적이고 강압적인 태도로 인해 갈등이 잦다. ' +
      '리더십은 있으나 독단적으로 흐르기 쉽다. ' +
      '부부관계에서 일방적인 모습이 나타날 수 있다.',
    gaeseonBanghyang:
      '음(陰)의 기운을 보충해야 한다. ' +
      '수(水)·금(金) 오행이 용신이 되는 경우가 많다. ' +
      '서늘한 환경, 명상, 독서 등 정적인 활동이 도움이 된다.',
  },
  /** 음이 사주에서 과다할 때 (6개 이상) */
  EUM_GWADA: {
    yuheong: '음과다(陰過多)',
    seonggyeok:
      '성격이 소극적이고 우유부단하며 의존적인 경향이 강하다. ' +
      '걱정이 많고 비관적으로 흐르기 쉽다. ' +
      '내성적이어서 자기 표현이 부족하다.',
    geongang:
      '음기(陰氣) 과다로 한(寒)·습(濕)이 많아 냉증·소화불량·부종·관절 질환에 유의해야 한다. ' +
      '비위(脾胃)가 허약해지고 기력이 떨어지기 쉽다.',
    daeinGwangye:
      '수동적이고 자기 의사를 잘 표현하지 못해 오해를 사기 쉽다. ' +
      '깊은 관계를 맺지만 새로운 인연을 여는 데 어려움이 있다. ' +
      '부부관계에서 배우자에게 지나치게 맞추는 경향이 있다.',
    gaeseonBanghyang:
      '양(陽)의 기운을 보충해야 한다. ' +
      '화(火)·목(木) 오행이 용신이 되는 경우가 많다. ' +
      '활동적인 운동, 사교 활동, 밝은 환경이 도움이 된다.',
  },
  /** 양과 음이 균형을 이룰 때 */
  GYUNHYEONG: {
    yuheong: '균형(均衡)',
    seonggyeok:
      '강함과 부드러움을 때에 맞게 조절할 수 있다. ' +
      '상황에 대한 적응력이 뛰어나고 편향되지 않는다.',
    geongang:
      '음양의 조화로 체질이 비교적 안정되어 있다. ' +
      '다만 다른 요인(오행 편중 등)에 따라 건강 문제가 발생할 수 있다.',
    daeinGwangye:
      '관계에서 균형 잡힌 태도를 보인다. ' +
      '리더와 조력자 역할을 상황에 맞게 전환할 수 있다.',
    gaeseonBanghyang:
      '음양 균형 자체는 좋으나, 오행(五行)의 편중 여부를 함께 살펴야 한다.',
  },
  /** 극양: 8자 모두 양 (극히 드묾) */
  GEUK_YANG: {
    yuheong: '극양(極陽)',
    seonggyeok:
      '양의 극단적 발현으로 매우 강렬하고 독단적인 성격. ' +
      '타협을 모르고 자기 뜻대로 밀어붙인다. ' +
      '그러나 양극즉음생(陽極卽陰生)의 원리에 따라 ' +
      '어느 순간 극적인 전환이 올 수 있다.',
    geongang:
      '극도의 열증(熱證)에 주의. 뇌혈관·심혈관 질환 위험이 높다. ' +
      '양극즉음(陽極卽陰)으로 갑작스러운 탈진·허탈이 올 수 있다.',
    daeinGwangye:
      '극도로 지배적이어서 주변과의 마찰이 심하다. ' +
      '혼자 모든 것을 해결하려 하며 고독해지기 쉽다.',
    gaeseonBanghyang:
      '음(陰)의 기운을 강하게 보충해야 한다. ' +
      '수(水) 오행이 절실하며, 환경과 생활습관의 전환이 중요하다.',
  },
  /** 극음: 8자 모두 음 (극히 드묾) */
  GEUK_EUM: {
    yuheong: '극음(極陰)',
    seonggyeok:
      '음의 극단적 발현으로 매우 수동적이고 내향적인 성격. ' +
      '결단을 내리지 못하고 위축되어 있다. ' +
      '그러나 음극즉양생(陰極卽陽生)의 원리에 따라 ' +
      '어느 순간 폭발적인 전환이 올 수 있다.',
    geongang:
      '극도의 한증(寒證)에 주의. 면역력 저하, 만성 질환 위험이 높다. ' +
      '음극즉양(陰極卽陽)으로 갑작스러운 열증이 올 수 있다.',
    daeinGwangye:
      '극도로 수동적이어서 사회적 고립에 빠지기 쉽다. ' +
      '타인에게 지나치게 의존하며 자립이 어렵다.',
    gaeseonBanghyang:
      '양(陽)의 기운을 강하게 보충해야 한다. ' +
      '화(火) 오행이 절실하며, 적극적인 사회 참여와 신체 활동이 중요하다.',
  },
};

// ---------------------------------------------------------------------------
// 유틸리티 함수
// ---------------------------------------------------------------------------

/**
 * 주어진 천간 또는 지지 인덱스가 양(陽)인지 판별한다
 *
 * 천간·지지 모두 짝수 인덱스 = 양(陽), 홀수 인덱스 = 음(陰)이라는
 * 규칙을 따르므로, 내부적으로 인덱스의 홀짝을 판별하면 된다.
 * 다만 STEM_EUMYANG / BRANCH_EUMYANG 맵 기반으로 일관성을 유지한다.
 *
 * @param stemOrBranchIdx - 천간(0-9) 또는 지지(0-11) 인덱스
 * @param type - 'STEM'(천간) 또는 'BRANCH'(지지) 구분
 * @returns 양(陽)이면 true, 음(陰)이면 false
 *
 * @example
 * isYang(0, 'STEM')   // true  — 甲(GAP)은 양간
 * isYang(1, 'STEM')   // false — 乙(EUL)은 음간
 * isYang(0, 'BRANCH') // true  — 子(JA)는 양지
 * isYang(1, 'BRANCH') // false — 丑(CHUK)은 음지
 */
export function isYang(stemOrBranchIdx: number, type: 'STEM' | 'BRANCH'): boolean {
  if (type === 'STEM') {
    return STEM_EUMYANG[stemOrBranchIdx] === 'YANG';
  }
  return BRANCH_EUMYANG[stemOrBranchIdx] === 'YANG';
}

/**
 * 주어진 천간 또는 지지 인덱스가 음(陰)인지 판별한다
 *
 * @param stemOrBranchIdx - 천간(0-9) 또는 지지(0-11) 인덱스
 * @param type - 'STEM'(천간) 또는 'BRANCH'(지지) 구분
 * @returns 음(陰)이면 true, 양(陽)이면 false
 *
 * @example
 * isYin(1, 'STEM')   // true  — 乙(EUL)은 음간
 * isYin(0, 'STEM')   // false — 甲(GAP)은 양간
 * isYin(3, 'BRANCH') // true  — 卯(MYO)는 음지
 */
export function isYin(stemOrBranchIdx: number, type: 'STEM' | 'BRANCH'): boolean {
  return !isYang(stemOrBranchIdx, type);
}

/**
 * 두 천간 또는 두 지지의 음양 극성(極性)이 같은지 판별한다
 *
 * 합화(合化) 조건 확인, 음양 배합 판단 등에 활용한다.
 *
 * @param a - 첫 번째 천간(0-9) 또는 지지(0-11) 인덱스
 * @param b - 두 번째 천간(0-9) 또는 지지(0-11) 인덱스
 * @param type - 'STEM'(천간) 또는 'BRANCH'(지지) 구분
 * @returns 두 인덱스의 음양이 같으면 true, 다르면 false
 *
 * @example
 * isSamePolarity(0, 2, 'STEM')  // true  — 甲(0, YANG)과 丙(2, YANG)은 같은 양
 * isSamePolarity(0, 1, 'STEM')  // false — 甲(0, YANG)과 乙(1, YIN)은 다른 극성
 * isSamePolarity(0, 6, 'BRANCH') // true — 子(0, YANG)과 午(6, YANG)은 같은 양
 */
export function isSamePolarity(a: number, b: number, type: 'STEM' | 'BRANCH'): boolean {
  return isYang(a, type) === isYang(b, type);
}

/**
 * 음양순역(陰陽順逆) 방향을 결정한다
 *
 * 일간(日干)의 음양과 성별을 조합하여 대운의 진행 방향을 판단한다.
 * - 양간 남성 / 음간 여성 → 순행(SUNHAENG)
 * - 음간 남성 / 양간 여성 → 역행(YEOKHAENG)
 *
 * @param ilganIdx - 일간 천간 인덱스 (甲=0 ... 癸=9)
 * @param seongbyeol - 성별 ('MALE' | 'FEMALE')
 * @returns 'SUNHAENG'(순행) 또는 'YEOKHAENG'(역행)
 *
 * @example
 * getEumyangDirection(0, 'MALE')   // 'SUNHAENG'  — 양간(甲) + 남 = 순행
 * getEumyangDirection(0, 'FEMALE') // 'YEOKHAENG' — 양간(甲) + 여 = 역행
 * getEumyangDirection(1, 'MALE')   // 'YEOKHAENG' — 음간(乙) + 남 = 역행
 * getEumyangDirection(1, 'FEMALE') // 'SUNHAENG'  — 음간(乙) + 여 = 순행
 */
export function getEumyangDirection(
  ilganIdx: StemIdx,
  seongbyeol: Seongbyeol,
): 'SUNHAENG' | 'YEOKHAENG' {
  const yangGan = isYang(ilganIdx, 'STEM');
  const male = seongbyeol === 'MALE';
  // 양간+남 또는 음간+여 = 순행; 양간+여 또는 음간+남 = 역행
  return (yangGan === male) ? 'SUNHAENG' : 'YEOKHAENG';
}

/**
 * 사주 8자에서 양·음 개수를 세어 편중 상태를 판단한다
 *
 * 입력: 4개 천간 인덱스 + 4개 지지 인덱스 (연·월·일·시)
 * 출력: 양 개수, 음 개수, 편중 판단 키
 *
 * @param stems - 4개 천간 인덱스 배열 [연간, 월간, 일간, 시간]
 * @param branches - 4개 지지 인덱스 배열 [연지, 월지, 일지, 시지]
 * @returns 양 개수, 음 개수, 편중 유형 키(EUMYANG_PYEONJUNG의 키)
 *
 * @example
 * analyzeEumyangBalance([0, 2, 4, 6], [0, 2, 4, 6])
 * // { yangCount: 8, eumCount: 0, pyeonjungKey: 'GEUK_YANG' }
 */
export function analyzeEumyangBalance(
  stems: StemIdx[],
  branches: BranchIdx[],
): { yangCount: number; eumCount: number; pyeonjungKey: string } {
  let yangCount = 0;

  for (const s of stems) {
    if (isYang(s, 'STEM')) yangCount++;
  }
  for (const b of branches) {
    if (isYang(b, 'BRANCH')) yangCount++;
  }

  const total = stems.length + branches.length;
  const eumCount = total - yangCount;

  let pyeonjungKey: string;
  if (yangCount === total) {
    pyeonjungKey = 'GEUK_YANG';
  } else if (eumCount === total) {
    pyeonjungKey = 'GEUK_EUM';
  } else if (yangCount >= 6) {
    pyeonjungKey = 'YANG_GWADA';
  } else if (eumCount >= 6) {
    pyeonjungKey = 'EUM_GWADA';
  } else {
    pyeonjungKey = 'GYUNHYEONG';
  }

  return { yangCount, eumCount, pyeonjungKey };
}

/**
 * 주어진 인덱스의 음양(Eumyang) 값을 반환한다
 *
 * @param stemOrBranchIdx - 천간(0-9) 또는 지지(0-11) 인덱스
 * @param type - 'STEM'(천간) 또는 'BRANCH'(지지) 구분
 * @returns 'YANG' 또는 'YIN'
 *
 * @example
 * getEumyang(0, 'STEM')   // 'YANG' — 甲(GAP)은 양간
 * getEumyang(1, 'BRANCH') // 'YIN'  — 丑(CHUK)은 음지
 */
export function getEumyang(stemOrBranchIdx: number, type: 'STEM' | 'BRANCH'): Eumyang {
  return isYang(stemOrBranchIdx, type) ? 'YANG' : 'YIN';
}
