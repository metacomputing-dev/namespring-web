/**
 * 지지론(地支論) — 십이지지(十二地支)의 성질과 특성
 *
 * 십이지지는 자(子)·축(丑)·인(寅)·묘(卯)·진(辰)·사(巳)·오(午)·미(未)·
 * 신(申)·유(酉)·술(戌)·해(亥)의 열두 가지 지지로,
 * 오행·음양·계절·방위·시간대·지장간 등 여러 속성을 지닌다.
 */

import type { BranchIdx } from '../core/cycle.js';

// ---------------------------------------------------------------------------
// 지지 이름 타입
// ---------------------------------------------------------------------------

/**
 * 십이지지 로마자 식별자.
 *
 * 자(子)=JA, 축(丑)=CHUK, 인(寅)=IN, 묘(卯)=MYO, 진(辰)=JIN, 사(巳)=SA,
 * 오(午)=O, 미(未)=MI, 신(申)=SHIN, 유(酉)=YU, 술(戌)=SUL, 해(亥)=HAE
 */
export type BranchName =
  | 'JA'
  | 'CHUK'
  | 'IN'
  | 'MYO'
  | 'JIN'
  | 'SA'
  | 'O'
  | 'MI'
  | 'SHIN'
  | 'YU'
  | 'SUL'
  | 'HAE';

// ---------------------------------------------------------------------------
// 인덱스 ↔ 이름 변환 테이블
// ---------------------------------------------------------------------------

/**
 * 지지 인덱스(0~11) 순서대로 나열한 로마자 이름 배열.
 * 인덱스 0=자(子), 1=축(丑), ..., 11=해(亥).
 */
export const BRANCH_NAMES: readonly BranchName[] = [
  'JA',   // 0  子
  'CHUK', // 1  丑
  'IN',   // 2  寅
  'MYO',  // 3  卯
  'JIN',  // 4  辰
  'SA',   // 5  巳
  'O',    // 6  午
  'MI',   // 7  未
  'SHIN', // 8  申
  'YU',   // 9  酉
  'SUL',  // 10 戌
  'HAE',  // 11 亥
] as const;

/** 로마자 이름 → 인덱스(0~11) 변환 맵 */
export const BRANCH_NAME_TO_IDX: Record<BranchName, BranchIdx> = {
  JA:   0,
  CHUK: 1,
  IN:   2,
  MYO:  3,
  JIN:  4,
  SA:   5,
  O:    6,
  MI:   7,
  SHIN: 8,
  YU:   9,
  SUL:  10,
  HAE:  11,
} as const;

/** 인덱스(0~11) → 로마자 이름 변환 맵 */
export const BRANCH_IDX_TO_NAME: Record<BranchIdx, BranchName> = Object.fromEntries(
  BRANCH_NAMES.map((name, idx) => [idx, name]),
) as Record<BranchIdx, BranchName>;

// ---------------------------------------------------------------------------
// 지지론 데이터 인터페이스
// ---------------------------------------------------------------------------

/** 지장간(地藏干) 항목 */
export interface JijangganEntry {
  /** 천간 로마자 (GABO·EULLUL·BYEONG·JEONG·MU·GI·GYEONG·SHIN·IM·GYE) */
  stem: string;
  /** 사령 역할: MAIN=본기, MIDDLE=중기, RESIDUAL=여기 */
  role: 'MAIN' | 'MIDDLE' | 'RESIDUAL';
  /** 사령일수(司令日數) */
  days: number;
}

/**
 * 지지론(地支論) 단일 지지의 완전한 이론 데이터.
 *
 * 각 지지는 오행·음양·계절·방위·시간대·지장간 등의 속성을 가진다.
 */
export interface JijiData {
  /** 지지 인덱스 (0=子 … 11=亥) */
  idx: BranchIdx;
  /** 로마자 식별자 */
  name: BranchName;
  /** 한자 */
  hanja: string;
  /** 한글 이름 */
  hangul: string;
  /** 십이지 동물 한자 (참고용) */
  animal: string;
  /** 십이지 동물 한글 이름 */
  animalKo: string;
  /** 오행: MOK(木)·HWA(火)·TO(土)·GEUM(金)·SU(水) */
  ohhaeng: string;
  /** 음양: YANG(陽)·YIN(陰) */
  eumyang: string;
  /** 해당 계절 */
  season: string;
  /**
   * 음력 월.
   * 자(子)=11월, 축(丑)=12월, 인(寅)=1월, …, 해(亥)=10월.
   */
  month: number;
  /** 방위 (한글) */
  direction: string;
  /** 대응 시간대 */
  timeRange: string;
  /**
   * 지장간(地藏干) 목록.
   * 본기(MAIN)·중기(MIDDLE)·여기(RESIDUAL) 순으로 수록.
   */
  jijanggan: JijangganEntry[];
  /** 지지의 성정(性情) 간략 설명 */
  nature: string;
  /** 신체 대응 부위 */
  bodyPart: string;
}

// ---------------------------------------------------------------------------
// 지장간 천간 로마자 상수 (가독성용)
// ---------------------------------------------------------------------------

/** 甲=목양 */
const GAP = 'GAP';
/** 乙=목음 */
const EUL = 'EUL';
/** 丙=화양 */
const BYEONG = 'BYEONG';
/** 丁=화음 */
const JEONG = 'JEONG';
/** 戊=토양 */
const MU = 'MU';
/** 己=토음 */
const GI = 'GI';
/** 庚=금양 */
const GYEONG = 'GYEONG';
/** 辛=금음 */
const SIN = 'SIN';
/** 壬=수양 */
const IM = 'IM';
/** 癸=수음 */
const GYE = 'GYE';

// ---------------------------------------------------------------------------
// 십이지지 이론 데이터 테이블
// ---------------------------------------------------------------------------

/**
 * 십이지지(十二地支) 이론 데이터 테이블.
 *
 * 인덱스 순서: 子(0)·丑(1)·寅(2)·卯(3)·辰(4)·巳(5)·午(6)·未(7)·申(8)·酉(9)·戌(10)·亥(11)
 */
export const JIJI_TABLE: JijiData[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 0. 子(JA) — 쥐, 水, 陽, 11월, 23~01시, 북(北)
  // ─────────────────────────────────────────────────────────────────────────
  {
    idx: 0,
    name: 'JA',
    hanja: '子',
    hangul: '자',
    animal: '鼠',
    animalKo: '쥐',
    ohhaeng: 'SU',    // 水
    eumyang: 'YANG',  // 陽
    season: '겨울',
    month: 11,
    direction: '북(北)',
    timeRange: '23~01시',
    jijanggan: [
      { stem: GYE, role: 'MAIN', days: 30 }, // 癸(본기)
    ],
    nature: '자수(子水)는 만물이 씨앗 속에 잠든 때이다. 지혜롭고 민첩하며 총명하지만 변화무쌍한 기질을 지닌다.',
    bodyPart: '신장(腎臟)·방광(膀胱)·귀(耳)',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 1. 丑(CHUK) — 소, 土, 陰, 12월, 01~03시, 북동(北東)
  // ─────────────────────────────────────────────────────────────────────────
  {
    idx: 1,
    name: 'CHUK',
    hanja: '丑',
    hangul: '축',
    animal: '牛',
    animalKo: '소',
    ohhaeng: 'TO',   // 土
    eumyang: 'YIN',  // 陰
    season: '겨울',
    month: 12,
    direction: '북동(北東)',
    timeRange: '01~03시',
    jijanggan: [
      { stem: GI,   role: 'MAIN',     days: 18 }, // 己(본기)
      { stem: GYE,  role: 'MIDDLE',   days: 9  }, // 癸(중기)
      { stem: SIN,  role: 'RESIDUAL', days: 3  }, // 辛(여기)
    ],
    nature: '축토(丑土)는 엄동의 냉기를 머금은 습토(濕土)다. 인내심이 강하고 꾸준하나 우직한 면이 있다.',
    bodyPart: '비장(脾臟)·위(胃)·다리·발',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. 寅(IN) — 호랑이, 木, 陽, 1월, 03~05시, 동북(東北)
  // ─────────────────────────────────────────────────────────────────────────
  {
    idx: 2,
    name: 'IN',
    hanja: '寅',
    hangul: '인',
    animal: '虎',
    animalKo: '호랑이',
    ohhaeng: 'MOK',  // 木
    eumyang: 'YANG', // 陽
    season: '봄',
    month: 1,
    direction: '동북(東北)',
    timeRange: '03~05시',
    jijanggan: [
      { stem: GAP,   role: 'MAIN',     days: 16 }, // 甲(본기)
      { stem: BYEONG, role: 'MIDDLE',  days: 7  }, // 丙(중기)
      { stem: MU,    role: 'RESIDUAL', days: 7  }, // 戊(여기)
    ],
    nature: '인목(寅木)은 봄의 여명처럼 힘차게 솟아오르는 기운이다. 진취적이고 용감하며 리더십이 강하다.',
    bodyPart: '간(肝)·담(膽)·손·발',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. 卯(MYO) — 토끼, 木, 陰, 2월, 05~07시, 동(東)
  // ─────────────────────────────────────────────────────────────────────────
  {
    idx: 3,
    name: 'MYO',
    hanja: '卯',
    hangul: '묘',
    animal: '兎',
    animalKo: '토끼',
    ohhaeng: 'MOK',  // 木
    eumyang: 'YIN',  // 陰
    season: '봄',
    month: 2,
    direction: '동(東)',
    timeRange: '05~07시',
    jijanggan: [
      { stem: EUL, role: 'MAIN', days: 30 }, // 乙(본기)
    ],
    nature: '묘목(卯木)은 봄의 전성기로 초목이 무성히 자라는 형상이다. 유연하고 친화력이 뛰어나며 예민하다.',
    bodyPart: '간(肝)·담(膽)·손가락·발가락·신경',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. 辰(JIN) — 용, 土, 陽, 3월, 07~09시, 동남(東南)
  // ─────────────────────────────────────────────────────────────────────────
  {
    idx: 4,
    name: 'JIN',
    hanja: '辰',
    hangul: '진',
    animal: '龍',
    animalKo: '용',
    ohhaeng: 'TO',   // 土
    eumyang: 'YANG', // 陽
    season: '봄',
    month: 3,
    direction: '동남(東南)',
    timeRange: '07~09시',
    jijanggan: [
      { stem: MU,  role: 'MAIN',     days: 18 }, // 戊(본기)
      { stem: EUL, role: 'MIDDLE',   days: 9  }, // 乙(중기)
      { stem: GYE, role: 'RESIDUAL', days: 3  }, // 癸(여기)
    ],
    nature: '진토(辰土)는 봄기운을 담뿍 머금은 습토다. 신비롭고 이상이 높으며 포용력이 넓다.',
    bodyPart: '위(胃)·피부(皮膚)·어깨·가슴',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. 巳(SA) — 뱀, 火, 陰, 4월, 09~11시, 남동(南東)
  // ─────────────────────────────────────────────────────────────────────────
  {
    idx: 5,
    name: 'SA',
    hanja: '巳',
    hangul: '사',
    animal: '蛇',
    animalKo: '뱀',
    ohhaeng: 'HWA',  // 火
    eumyang: 'YIN',  // 陰
    season: '여름',
    month: 4,
    direction: '남동(南東)',
    timeRange: '09~11시',
    jijanggan: [
      { stem: BYEONG, role: 'MAIN',     days: 16 }, // 丙(본기)
      { stem: GYEONG, role: 'MIDDLE',   days: 7  }, // 庚(중기)
      { stem: MU,     role: 'RESIDUAL', days: 7  }, // 戊(여기)
    ],
    nature: '사화(巳火)는 음화(陰火)로서 지열(地熱)처럼 내부에 축적된 에너지다. 집중력·통찰력이 뛰어나며 지략이 깊다.',
    bodyPart: '심장(心臟)·소장(小腸)·눈(目)·인후(咽喉)',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. 午(O) — 말, 火, 陽, 5월, 11~13시, 남(南)
  // ─────────────────────────────────────────────────────────────────────────
  {
    idx: 6,
    name: 'O',
    hanja: '午',
    hangul: '오',
    animal: '馬',
    animalKo: '말',
    ohhaeng: 'HWA',  // 火
    eumyang: 'YANG', // 陽
    season: '여름',
    month: 5,
    direction: '남(南)',
    timeRange: '11~13시',
    jijanggan: [
      { stem: JEONG, role: 'MAIN',     days: 21 }, // 丁(본기)
      { stem: GI,    role: 'RESIDUAL', days: 9  }, // 己(여기) — 중기 없음
    ],
    nature: '오화(午火)는 한낮의 태양처럼 왕성한 양기(陽氣)다. 열정적이고 활동적이며 화끈한 성격을 지닌다.',
    bodyPart: '심장(心臟)·소장(小腸)·눈(目)·혈액(血液)',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. 未(MI) — 양, 土, 陰, 6월, 13~15시, 남서(南西)
  // ─────────────────────────────────────────────────────────────────────────
  {
    idx: 7,
    name: 'MI',
    hanja: '未',
    hangul: '미',
    animal: '羊',
    animalKo: '양',
    ohhaeng: 'TO',  // 土
    eumyang: 'YIN', // 陰
    season: '여름',
    month: 6,
    direction: '남서(南西)',
    timeRange: '13~15시',
    jijanggan: [
      { stem: GI,    role: 'MAIN',     days: 18 }, // 己(본기)
      { stem: JEONG, role: 'MIDDLE',   days: 9  }, // 丁(중기)
      { stem: EUL,   role: 'RESIDUAL', days: 3  }, // 乙(여기)
    ],
    nature: '미토(未土)는 여름 더위를 머금은 조토(燥土)다. 온순하고 예술·심미 감각이 뛰어나며 감성이 풍부하다.',
    bodyPart: '비장(脾臟)·위(胃)·복부(腹部)·입술',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. 申(SHIN) — 원숭이, 金, 陽, 7월, 15~17시, 서북(西北)
  // ─────────────────────────────────────────────────────────────────────────
  {
    idx: 8,
    name: 'SHIN',
    hanja: '申',
    hangul: '신',
    animal: '猴',
    animalKo: '원숭이',
    ohhaeng: 'GEUM',  // 金
    eumyang: 'YANG',  // 陽
    season: '가을',
    month: 7,
    direction: '서북(西北)',
    timeRange: '15~17시',
    jijanggan: [
      { stem: GYEONG, role: 'MAIN',     days: 16 }, // 庚(본기)
      { stem: IM,     role: 'MIDDLE',   days: 7  }, // 壬(중기)
      { stem: MU,     role: 'RESIDUAL', days: 7  }, // 戊(여기)
    ],
    nature: '신금(申金)은 가을 초입의 서늘한 금기(金氣)다. 기민하고 재치 있으며 변화 적응력이 뛰어나다.',
    bodyPart: '폐(肺)·대장(大腸)·뼈(骨)·경락(經絡)',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9. 酉(YU) — 닭, 金, 陰, 8월, 17~19시, 서(西)
  // ─────────────────────────────────────────────────────────────────────────
  {
    idx: 9,
    name: 'YU',
    hanja: '酉',
    hangul: '유',
    animal: '鷄',
    animalKo: '닭',
    ohhaeng: 'GEUM', // 金
    eumyang: 'YIN',  // 陰
    season: '가을',
    month: 8,
    direction: '서(西)',
    timeRange: '17~19시',
    jijanggan: [
      { stem: SIN, role: 'MAIN', days: 30 }, // 辛(본기)
    ],
    nature: '유금(酉金)은 순수하게 응축된 금기(金氣)다. 날카로운 통찰력과 완벽주의적 성향, 예리한 미감을 지닌다.',
    bodyPart: '폐(肺)·대장(大腸)·이빨(齒)·피부(皮膚)',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10. 戌(SUL) — 개, 土, 陽, 9월, 19~21시, 서북(西北)
  // ─────────────────────────────────────────────────────────────────────────
  {
    idx: 10,
    name: 'SUL',
    hanja: '戌',
    hangul: '술',
    animal: '犬',
    animalKo: '개',
    ohhaeng: 'TO',   // 土
    eumyang: 'YANG', // 陽
    season: '가을',
    month: 9,
    direction: '서북(西北)',
    timeRange: '19~21시',
    jijanggan: [
      { stem: MU,    role: 'MAIN',     days: 18 }, // 戊(본기)
      { stem: SIN,   role: 'MIDDLE',   days: 9  }, // 辛(중기)
      { stem: JEONG, role: 'RESIDUAL', days: 3  }, // 丁(여기)
    ],
    nature: '술토(戌土)는 가을의 메마른 조토(燥土)다. 충직하고 의리가 강하며 신뢰를 중시한다.',
    bodyPart: '위(胃)·비장(脾臟)·발목·무릎',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 11. 亥(HAE) — 돼지, 水, 陰, 10월, 21~23시, 북서(北西)
  // ─────────────────────────────────────────────────────────────────────────
  {
    idx: 11,
    name: 'HAE',
    hanja: '亥',
    hangul: '해',
    animal: '豕',
    animalKo: '돼지',
    ohhaeng: 'SU',  // 水
    eumyang: 'YIN', // 陰
    season: '겨울',
    month: 10,
    direction: '북서(北西)',
    timeRange: '21~23시',
    jijanggan: [
      { stem: IM,  role: 'MAIN',     days: 23 }, // 壬(본기)
      { stem: GAP, role: 'RESIDUAL', days: 7  }, // 甲(여기) — 중기 없음
    ],
    nature: '해수(亥水)는 만물이 귀장(歸藏)하는 음수(陰水)다. 포용력이 넓고 자유로우며 직관이 발달해 있다.',
    bodyPart: '신장(腎臟)·방광(膀胱)·두뇌(頭腦)·자궁',
  },
];

// ---------------------------------------------------------------------------
// 합(合)·충(沖) 관계 데이터
// ---------------------------------------------------------------------------

/**
 * 삼합(三合) 그룹.
 *
 * 삼합은 생지(生地)·왕지(旺地)·묘지(墓地)의 세 지지가 합하여
 * 하나의 오행 국(局)을 이루는 관계다.
 *
 * - 申子辰 水局
 * - 亥卯未 木局
 * - 寅午戌 火局
 * - 巳酉丑 金局
 */
export const SAMHAP_GROUPS: Array<{
  branches: [BranchName, BranchName, BranchName];
  resultOhhaeng: string;
  description: string;
}> = [
  {
    branches: ['SHIN', 'JA', 'JIN'],   // 申子辰
    resultOhhaeng: 'SU',               // 水局
    description: '신자진 수국(申子辰 水局) — 생지(申)·왕지(子)·묘지(辰)가 합하여 水 기운을 이룬다.',
  },
  {
    branches: ['HAE', 'MYO', 'MI'],    // 亥卯未
    resultOhhaeng: 'MOK',              // 木局
    description: '해묘미 목국(亥卯未 木局) — 생지(亥)·왕지(卯)·묘지(未)가 합하여 木 기운을 이룬다.',
  },
  {
    branches: ['IN', 'O', 'SUL'],      // 寅午戌
    resultOhhaeng: 'HWA',              // 火局
    description: '인오술 화국(寅午戌 火局) — 생지(寅)·왕지(午)·묘지(戌)가 합하여 火 기운을 이룬다.',
  },
  {
    branches: ['SA', 'YU', 'CHUK'],    // 巳酉丑
    resultOhhaeng: 'GEUM',             // 金局
    description: '사유축 금국(巳酉丑 金局) — 생지(巳)·왕지(酉)·묘지(丑)가 합하여 金 기운을 이룬다.',
  },
];

/**
 * 방합(方合) 그룹.
 *
 * 방합은 같은 방위에 위치한 세 지지가 합하여 해당 계절의 오행을 강화하는 관계다.
 *
 * - 寅卯辰 木方(동방·봄)
 * - 巳午未 火方(남방·여름)
 * - 申酉戌 金方(서방·가을)
 * - 亥子丑 水方(북방·겨울)
 */
export const BANGHAP_GROUPS: Array<{
  branches: [BranchName, BranchName, BranchName];
  direction: string;
  ohhaeng: string;
}> = [
  {
    branches: ['IN', 'MYO', 'JIN'],    // 寅卯辰
    direction: '동방(東方)',
    ohhaeng: 'MOK',                    // 木方
  },
  {
    branches: ['SA', 'O', 'MI'],       // 巳午未
    direction: '남방(南方)',
    ohhaeng: 'HWA',                    // 火方
  },
  {
    branches: ['SHIN', 'YU', 'SUL'],   // 申酉戌
    direction: '서방(西方)',
    ohhaeng: 'GEUM',                   // 金方
  },
  {
    branches: ['HAE', 'JA', 'CHUK'],   // 亥子丑
    direction: '북방(北方)',
    ohhaeng: 'SU',                     // 水方
  },
];

/**
 * 육합(六合) 쌍.
 *
 * 육합은 음양이 상응하는 두 지지가 짝을 이루어 합화(合化)하는 관계다.
 * 子+丑=土, 寅+亥=木, 卯+戌=火, 辰+酉=金, 巳+申=水, 午+未=土(火 기운 동반)
 */
export const YUKHAP_PAIRS: Array<{
  a: BranchName;
  b: BranchName;
  resultOhhaeng: string;
}> = [
  { a: 'JA',   b: 'CHUK', resultOhhaeng: 'TO'   }, // 子丑 합토(合土)
  { a: 'IN',   b: 'HAE',  resultOhhaeng: 'MOK'  }, // 寅亥 합목(合木)
  { a: 'MYO',  b: 'SUL',  resultOhhaeng: 'HWA'  }, // 卯戌 합화(合火)
  { a: 'JIN',  b: 'YU',   resultOhhaeng: 'GEUM' }, // 辰酉 합금(合金)
  { a: 'SA',   b: 'SHIN', resultOhhaeng: 'SU'   }, // 巳申 합수(合水)
  { a: 'O',    b: 'MI',   resultOhhaeng: 'TO'   }, // 午未 합토(合土, 火 기운 포함)
];

/**
 * 충(沖) 쌍.
 *
 * 충은 서로 정반대에 위치한 두 지지가 충돌하는 관계다.
 * 각 쌍은 인덱스 차이가 6(정반대)이다.
 *
 * 子↔午, 丑↔未, 寅↔申, 卯↔酉, 辰↔戌, 巳↔亥
 */
export const CHUNG_PAIRS: Array<[BranchName, BranchName]> = [
  ['JA',   'O'   ], // 子午충
  ['CHUK', 'MI'  ], // 丑未충
  ['IN',   'SHIN'], // 寅申충
  ['MYO',  'YU'  ], // 卯酉충
  ['JIN',  'SUL' ], // 辰戌충
  ['SA',   'HAE' ], // 巳亥충
];

// ---------------------------------------------------------------------------
// 계절 그룹
// ---------------------------------------------------------------------------

/**
 * 지지 계절 그룹.
 *
 * 각 계절을 대표하는 세 지지를 묶은 맵.
 * - SPRING(봄): 寅·卯·辰
 * - SUMMER(여름): 巳·午·未
 * - FALL(가을): 申·酉·戌
 * - WINTER(겨울): 亥·子·丑
 */
export const SEASON_BRANCHES: Record<string, BranchName[]> = {
  SPRING: ['IN', 'MYO', 'JIN'],    // 봄: 寅·卯·辰
  SUMMER: ['SA', 'O',  'MI' ],     // 여름: 巳·午·未
  FALL:   ['SHIN', 'YU', 'SUL'],   // 가을: 申·酉·戌
  WINTER: ['HAE', 'JA', 'CHUK'],   // 겨울: 亥·子·丑
} as const;

// ---------------------------------------------------------------------------
// 왕지·생지·묘지 (사정·사생·사고)
// ---------------------------------------------------------------------------

/**
 * 왕지(旺地) / 사정지(四正地).
 *
 * 각 계절의 정점, 즉 해당 오행의 기운이 가장 왕성한 지지.
 * 午(火왕)·子(水왕)·卯(木왕)·酉(金왕)
 */
export const WANG_JI: BranchName[] = ['O', 'JA', 'MYO', 'YU'];

/**
 * 생지(生地) / 사장생지(四長生地).
 *
 * 각 계절의 시작, 즉 해당 오행이 새로 생하는 지지.
 * 寅(木생)·巳(火생)·申(金생)·亥(水생)
 */
export const SAENG_JI: BranchName[] = ['IN', 'SA', 'SHIN', 'HAE'];

/**
 * 묘지(墓地) / 사고지(四庫地).
 *
 * 각 오행이 저장·입고(入庫)되는 지지.
 * 辰(水묘)·戌(火묘)·丑(金묘)·未(木묘)
 *
 * 辰=水의 고(庫), 戌=火의 고(庫), 丑=金의 고(庫), 未=木의 고(庫)
 */
export const MYO_JI: BranchName[] = ['JIN', 'SUL', 'CHUK', 'MI'];

// ---------------------------------------------------------------------------
// 원진(怨嗔) 관계
// ---------------------------------------------------------------------------

/**
 * 원진(怨嗔) 쌍.
 *
 * 원진은 두 지지가 서로 미워하고 원망하는 관계로,
 * 겉으로는 드러나지 않지만 내면적으로 갈등과 불화를 일으킨다.
 * 충(沖)이 외부적·급격한 충돌이라면, 원진은 내면적·지속적 불화이다.
 *
 * 원진의 원리: 각 지지에서 4칸째(순방향)와 역으로 4칸째가 원진 관계를 이룬다.
 * 즉, 인덱스 차이가 4 또는 8(= 12-4)인 쌍이 원진이다.
 *
 * 子↔卯(원진이 아님, 이것은 형), 실제 원진:
 * 子↔未, 丑↔午, 寅↔酉, 卯↔申, 辰↔亥, 巳↔戌
 *
 * 근거: 각 지지에서 시계방향으로 7번째 지지가 원진(또는 귀문 기준).
 * 학파에 따라 차이가 있으나, 가장 널리 사용되는 기준을 채택한다.
 */
export const WONJIN_PAIRS: Array<{
  a: BranchName;
  b: BranchName;
  description: string;
}> = [
  {
    a: 'JA',  b: 'MI',
    description: '자미원진(子未怨嗔) — 子水와 未土는 토극수(土剋水)의 극 관계가 내재. ' +
                 '子는 북방 水, 未는 남서 土로 성질이 상반되어 내면적 갈등이 지속된다.',
  },
  {
    a: 'CHUK', b: 'O',
    description: '축오원진(丑午怨嗔) — 丑土(습토)와 午火가 원진. ' +
                 '丑의 차가운 습기가 午의 뜨거운 불기운을 억누르며 서로 불편한 관계.',
  },
  {
    a: 'IN',  b: 'YU',
    description: '인유원진(寅酉怨嗔) — 寅木과 酉金은 금극목(金剋木)의 관계. ' +
                 '寅의 진취적 목기(木氣)를 酉의 숙살(肅殺) 금기(金氣)가 꺾어 마찰을 일으킨다.',
  },
  {
    a: 'MYO', b: 'SHIN',
    description: '묘신원진(卯申怨嗔) — 卯木과 申金은 금극목(金剋木)의 관계. ' +
                 '卯의 유연한 목기(木氣)를 申의 강건한 금기(金氣)가 억압하여 불화가 생긴다.',
  },
  {
    a: 'JIN', b: 'HAE',
    description: '진해원진(辰亥怨嗔) — 辰土와 亥水는 토극수(土剋水)의 관계. ' +
                 '辰의 습토가 亥의 수기(水氣)를 가두어 서로 답답함과 원망이 쌓인다.',
  },
  {
    a: 'SA',  b: 'SUL',
    description: '사술원진(巳戌怨嗔) — 巳火와 戌土는 화생토(火生土) 상생이지만 원진. ' +
                 '巳의 화기(火氣)가 戌의 조토(燥土)를 더욱 메마르게 하여 피로와 소진을 일으킨다.',
  },
];

// ---------------------------------------------------------------------------
// 반합(半合) 관계
// ---------------------------------------------------------------------------

/**
 * 반합(半合) 쌍.
 *
 * 반합은 삼합(三合)의 세 지지 중 두 지지만 있을 때 성립하는 불완전한 합이다.
 * 삼합만큼 강하지는 않지만 해당 오행으로의 기운 변화가 부분적으로 발생한다.
 *
 * 분류:
 * - 생왕반합(生旺半合): 생지(生地) + 왕지(旺地) — 합력이 상대적으로 강하다.
 *   기운이 생하여 왕성해지는 흐름이므로 에너지가 상승하는 방향.
 * - 왕묘반합(旺墓半合): 왕지(旺地) + 묘지(墓地) — 합력이 상대적으로 약하다.
 *   기운이 왕성한 상태에서 저장(입고)되는 흐름이므로 에너지가 수렴하는 방향.
 * - 생묘반합(生墓半合): 생지(生地) + 묘지(墓地) — 왕지가 빠져 합력이 가장 약하다.
 *   일부 학파에서는 이를 반합으로 인정하지 않기도 한다.
 */
export const BANHAP_PAIRS: Array<{
  branches: [BranchName, BranchName];
  type: 'SAENGWANG' | 'WANGMYO' | 'SAENGMYO';
  resultOhhaeng: string;
  description: string;
}> = [
  // ── 水局 반합 (申子辰) ────────────────────────────────────────────────
  {
    branches: ['SHIN', 'JA'],
    type: 'SAENGWANG',
    resultOhhaeng: 'SU',
    description: '신자 생왕반합(申子 生旺半合) — 水의 생지(申)와 왕지(子)가 합하여 水 기운이 부분적으로 형성된다.',
  },
  {
    branches: ['JA', 'JIN'],
    type: 'WANGMYO',
    resultOhhaeng: 'SU',
    description: '자진 왕묘반합(子辰 旺墓半合) — 水의 왕지(子)와 묘지(辰)가 합하여 水 기운이 부분적으로 저장된다.',
  },
  {
    branches: ['SHIN', 'JIN'],
    type: 'SAENGMYO',
    resultOhhaeng: 'SU',
    description: '신진 생묘반합(申辰 生墓半合) — 水의 생지(申)와 묘지(辰). 왕지(子) 없이 합력이 가장 약하다.',
  },
  // ── 木局 반합 (亥卯未) ────────────────────────────────────────────────
  {
    branches: ['HAE', 'MYO'],
    type: 'SAENGWANG',
    resultOhhaeng: 'MOK',
    description: '해묘 생왕반합(亥卯 生旺半合) — 木의 생지(亥)와 왕지(卯)가 합하여 木 기운이 부분적으로 형성된다.',
  },
  {
    branches: ['MYO', 'MI'],
    type: 'WANGMYO',
    resultOhhaeng: 'MOK',
    description: '묘미 왕묘반합(卯未 旺墓半合) — 木의 왕지(卯)와 묘지(未)가 합하여 木 기운이 부분적으로 저장된다.',
  },
  {
    branches: ['HAE', 'MI'],
    type: 'SAENGMYO',
    resultOhhaeng: 'MOK',
    description: '해미 생묘반합(亥未 生墓半合) — 木의 생지(亥)와 묘지(未). 왕지(卯) 없이 합력이 가장 약하다.',
  },
  // ── 火局 반합 (寅午戌) ────────────────────────────────────────────────
  {
    branches: ['IN', 'O'],
    type: 'SAENGWANG',
    resultOhhaeng: 'HWA',
    description: '인오 생왕반합(寅午 生旺半合) — 火의 생지(寅)와 왕지(午)가 합하여 火 기운이 부분적으로 형성된다.',
  },
  {
    branches: ['O', 'SUL'],
    type: 'WANGMYO',
    resultOhhaeng: 'HWA',
    description: '오술 왕묘반합(午戌 旺墓半合) — 火의 왕지(午)와 묘지(戌)가 합하여 火 기운이 부분적으로 저장된다.',
  },
  {
    branches: ['IN', 'SUL'],
    type: 'SAENGMYO',
    resultOhhaeng: 'HWA',
    description: '인술 생묘반합(寅戌 生墓半合) — 火의 생지(寅)와 묘지(戌). 왕지(午) 없이 합력이 가장 약하다.',
  },
  // ── 金局 반합 (巳酉丑) ────────────────────────────────────────────────
  {
    branches: ['SA', 'YU'],
    type: 'SAENGWANG',
    resultOhhaeng: 'GEUM',
    description: '사유 생왕반합(巳酉 生旺半合) — 金의 생지(巳)와 왕지(酉)가 합하여 金 기운이 부분적으로 형성된다.',
  },
  {
    branches: ['YU', 'CHUK'],
    type: 'WANGMYO',
    resultOhhaeng: 'GEUM',
    description: '유축 왕묘반합(酉丑 旺墓半合) — 金의 왕지(酉)와 묘지(丑)가 합하여 金 기운이 부분적으로 저장된다.',
  },
  {
    branches: ['SA', 'CHUK'],
    type: 'SAENGMYO',
    resultOhhaeng: 'GEUM',
    description: '사축 생묘반합(巳丑 生墓半合) — 金의 생지(巳)와 묘지(丑). 왕지(酉) 없이 합력이 가장 약하다.',
  },
];

// ---------------------------------------------------------------------------
// 지지 암합(暗合) 관계
// ---------------------------------------------------------------------------

/**
 * 지지 암합(暗合).
 *
 * 암합이란 두 지지가 겉으로는 합 관계가 아니지만,
 * 각 지지의 지장간(地藏干) 사이에 천간합(天干合)이 성립하여
 * 내면적으로 합의 작용이 발생하는 관계이다.
 *
 * 암합의 특징:
 * - 육합(六合)처럼 드러나는 합이 아니라 숨겨진 합이다.
 * - 인간관계에서는 겉으로 드러나지 않는 은밀한 인연·교류를 상징한다.
 * - 암합의 힘은 육합보다 약하지만, 발견되면 의미 있는 작용을 한다.
 *
 * 지장간 본기(本氣) 사이의 천간합:
 * - 寅(甲본기)과 丑(己본기): 甲己合 → 암합
 * - 卯(乙본기)과 申(庚본기 경유, 실제 庚중기 아님): 학파에 따라 논란
 * - 午(丁본기)과 亥(壬본기): 丁壬合 → 암합
 *
 * 아래는 가장 널리 인정되는 지지 암합 쌍을 수록한다.
 */
export const AMHAP_PAIRS: Array<{
  a: BranchName;
  b: BranchName;
  stemPairA: string;
  stemPairB: string;
  hapType: string;
  description: string;
}> = [
  {
    a: 'IN',  b: 'CHUK',
    stemPairA: 'GAP(甲)',
    stemPairB: 'GI(己)',
    hapType: '甲己合土',
    description: '인축암합(寅丑暗合) — 寅의 본기 甲과 丑의 본기 己가 甲己合을 이루어 암합 성립. ' +
                 '겉으로는 상관없어 보이는 관계에서 내면적으로 강한 결합이 발생한다.',
  },
  {
    a: 'O',   b: 'HAE',
    stemPairA: 'JEONG(丁)',
    stemPairB: 'IM(壬)',
    hapType: '丁壬合木',
    description: '오해암합(午亥暗合) — 午의 본기 丁과 亥의 본기 壬이 丁壬合을 이루어 암합 성립. ' +
                 '子午충 대신 午亥 사이에 은밀한 결합이 형성되는 특수한 관계.',
  },
  {
    a: 'MYO', b: 'SHIN',
    stemPairA: 'EUL(乙)',
    stemPairB: 'GYEONG(庚)',
    hapType: '乙庚合金',
    description: '묘신암합(卯申暗合) — 卯의 본기 乙과 申의 본기 庚이 乙庚合을 이루어 암합 성립. ' +
                 '卯酉충 관계가 아닌 卯申 사이에서 지장간으로 합이 형성된다.',
  },
  {
    a: 'SA',  b: 'SUL',
    stemPairA: 'BYEONG(丙)',
    stemPairB: 'SIN(辛)',
    hapType: '丙辛合水',
    description: '사술암합(巳戌暗合) — 巳의 본기 丙과 戌의 중기 辛이 丙辛合을 이루어 암합 성립. ' +
                 '원진 관계이면서 동시에 지장간 암합도 형성하는 복합적 관계.',
  },
  {
    a: 'JIN', b: 'YU',
    stemPairA: 'GYE(癸)',
    stemPairB: 'SIN(辛)',
    hapType: '(여기/중기 통한 부분 암합)',
    description: '진유암합(辰酉暗合) — 辰과 酉는 이미 육합(合金) 관계이므로, ' +
                 '지장간의 추가적 암합은 육합의 힘을 더욱 강화시키는 역할을 한다.',
  },
];

/**
 * 암합(暗合) 이론 원칙
 */
export const AMHAP_THEORY: {
  definition: string;
  significance: string;
  strength: string;
} = {
  definition:
    '암합(暗合)은 두 지지의 지장간(地藏干) 사이에 천간합(天干合)이 성립하여 ' +
    '겉으로 드러나지 않는 내밀한 합의 작용이 발생하는 관계이다. ' +
    '특히 본기(本氣)끼리 합하는 경우가 가장 강력하다.',
  significance:
    '사주에서 암합은 외부로 드러나지 않는 인연·비밀스러운 관계·감춰진 재능 등을 상징한다. ' +
    '남녀 관계에서는 은밀한 인연이나 내밀한 감정 교류를 나타내며, ' +
    '사업에서는 숨겨진 협력 관계나 뒷거래를 의미하기도 한다.',
  strength:
    '암합의 강도: 본기 간 합 > 본기-중기 간 합 > 중기-중기 간 합 > 여기 관련 합. ' +
    '육합(六合)보다 작용력이 약하지만, 충(沖)이나 형(刑)에 의해 쉽게 깨지지 않는 ' +
    '숨겨진 힘이라는 특성이 있다.',
};

// ---------------------------------------------------------------------------
// 충(沖) 이론 상세
// ---------------------------------------------------------------------------

/**
 * 충(沖) 이론 원칙
 *
 * 충은 지지 관계 중 가장 작용력이 강한 상호 충돌 관계로,
 * 변동·이동·이별·파괴 등의 급격한 변화를 일으킨다.
 */
export const CHUNG_THEORY: {
  definition: string;
  types: Array<{
    pair: string;
    nature: string;
    effect: string;
  }>;
  principles: string[];
} = {
  definition:
    '충(沖)은 인덱스 차이가 6인(정반대 위치) 두 지지가 서로 충돌하는 관계로, ' +
    '지지 관계 중 가장 강력한 작용력을 가진다. ' +
    '충은 급격한 변동·이동·분리·파괴를 일으키며, 원국과 운에서 모두 중요하게 작용한다.',
  types: [
    {
      pair: '子午충(JA-O)',
      nature: '수화충(水火沖) — 水와 火의 정면 충돌. 감정과 이성의 대립.',
      effect: '심장·신장 질환, 감정 기복, 이사·이동, 직업 변동과 연관. 왕지끼리의 충으로 작용력이 매우 강하다.',
    },
    {
      pair: '丑未충(CHUK-MI)',
      nature: '토토충(土土沖) — 습토(丑)와 조토(未)의 충돌. 같은 오행끼리 성질이 반대인 충.',
      effect: '비장·위장 질환, 부동산 분쟁, 고집 충돌, 묘지(庫地) 개고(開庫) 작용과 연관.',
    },
    {
      pair: '寅申충(IN-SHIN)',
      nature: '목금충(木金沖) — 木과 金의 정면 충돌. 금극목(金剋木)의 극(剋) 관계.',
      effect: '간담·폐 질환, 교통사고, 이동·이사, 직업 변동과 연관. 생지끼리의 충으로 역마(驛馬) 작용이 강하다.',
    },
    {
      pair: '卯酉충(MYO-YU)',
      nature: '목금충(木金沖) — 木과 金의 순수한 충돌. 왕지끼리의 충으로 더욱 격렬하다.',
      effect: '간담·폐·대장 질환, 인간관계 단절, 법적 분쟁, 예리한 갈등과 연관.',
    },
    {
      pair: '辰戌충(JIN-SUL)',
      nature: '토토충(土土沖) — 습토(辰)와 조토(戌)의 충돌. 창고(庫)끼리의 충으로 개고(開庫) 작용.',
      effect: '위장·피부 질환, 부동산 변동, 종교·학문 관련 변화, 묘지(庫地) 개고 작용과 연관.',
    },
    {
      pair: '巳亥충(SA-HAE)',
      nature: '수화충(水火沖) — 火와 水의 충돌. 생지끼리의 충으로 역마(驛馬) 성질이 강하다.',
      effect: '심장·신장 질환, 해외 이동, 장거리 이사, 학업·연구 변동과 연관.',
    },
  ],
  principles: [
    '충의 강도: 왕지충(子午·卯酉) > 생지충(寅申·巳亥) > 묘지충(辰戌·丑未). ' +
    '왕지는 순수한 단일 기운이므로 충의 충격이 가장 크다.',
    '생지충(寅申·巳亥)은 역마(驛馬) 성질이 강하여 이동·변동·출장·이사와 관련이 깊다.',
    '묘지충(辰戌·丑未)은 창고(庫)를 여는 개고(開庫) 작용을 하여 ' +
    '저장된 기운이 밖으로 나오는 효과가 있다.',
    '충이 용신(用神) 지지를 해치면 대흉(大凶), 기신(忌神) 지지를 해치면 대길(大吉)이다.',
    '원국에 충이 있으면 해당 기운의 불안정성이 평생 지속되며, ' +
    '운(運)에서 충이 발동하면 해당 시기에 급격한 변동이 발생한다.',
  ],
};

// ---------------------------------------------------------------------------
// 조회 함수
// ---------------------------------------------------------------------------

/**
 * 지지 인덱스(0~11)로 지지 데이터를 조회한다.
 *
 * @param idx - 지지 인덱스 (0=子, 1=丑, …, 11=亥)
 * @returns 해당 지지의 {@link JijiData}
 * @throws {RangeError} 인덱스가 0~11 범위를 벗어난 경우
 *
 * @example
 * const ja = getJijiByIdx(0);  // 子(자)
 * console.log(ja.hanja);       // '子'
 */
export function getJijiByIdx(idx: BranchIdx): JijiData {
  const data = JIJI_TABLE[idx];
  if (data === undefined) {
    throw new RangeError(`지지 인덱스 ${idx}는 유효하지 않습니다. 0~11 범위여야 합니다.`);
  }
  return data;
}

/**
 * 지지 로마자 이름으로 지지 데이터를 조회한다.
 *
 * @param name - 지지 로마자 이름 (예: 'JA', 'CHUK', …, 'HAE')
 * @returns 해당 지지의 {@link JijiData}
 * @throws {RangeError} 유효하지 않은 이름인 경우
 *
 * @example
 * const in_ = getJijiByName('IN');  // 寅(인)
 * console.log(in_.animalKo);         // '호랑이'
 */
export function getJijiByName(name: BranchName): JijiData {
  const idx = BRANCH_NAME_TO_IDX[name];
  return getJijiByIdx(idx);
}

/**
 * 두 지지가 충(沖) 관계인지 확인한다.
 *
 * 충 관계는 인덱스 차이가 정확히 6인 두 지지 사이에 성립한다.
 * (천간충은 cheonganHap.ts의 isChung을 사용하라.)
 *
 * @param a - 첫 번째 지지 로마자
 * @param b - 두 번째 지지 로마자
 * @returns 충 관계이면 true
 *
 * @example
 * isJijiChung('JA', 'O')    // true  -- 子午충
 * isJijiChung('IN', 'SHIN') // true  -- 寅申충
 * isJijiChung('JA', 'MYO')  // false
 */
export function isJijiChung(a: BranchName, b: BranchName): boolean {
  return CHUNG_PAIRS.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}

/**
 * 주어진 지지의 충(沖) 상대 지지를 반환한다.
 *
 * 충은 인덱스 차이가 6이므로, (idx + 6) % 12 로 산출할 수 있다.
 * (천간충 상대는 cheonganHap.ts의 getChungPartner를 사용하라.)
 *
 * @param branch - 지지 로마자
 * @returns 충 상대 지지 로마자
 *
 * @example
 * getJijiChungPartner('JA')   // 'O'
 * getJijiChungPartner('IN')   // 'SHIN'
 */
export function getJijiChungPartner(branch: BranchName): BranchName {
  const idx = BRANCH_NAME_TO_IDX[branch];
  const partnerIdx = ((idx + 6) % 12) as BranchIdx;
  return BRANCH_NAMES[partnerIdx];
}

/**
 * 두 지지가 육합(六合) 관계인지 확인한다.
 *
 * @param a - 첫 번째 지지 로마자
 * @param b - 두 번째 지지 로마자
 * @returns 육합 관계이면 true
 *
 * @example
 * isYukhap('JA', 'CHUK')  // true  -- 子丑합토
 * isYukhap('IN', 'HAE')   // true  -- 寅亥합목
 * isYukhap('JA', 'IN')    // false
 */
export function isYukhap(a: BranchName, b: BranchName): boolean {
  return YUKHAP_PAIRS.some(
    (pair) => (pair.a === a && pair.b === b) || (pair.a === b && pair.b === a),
  );
}

/**
 * 두 지지가 원진(怨嗔) 관계인지 확인한다.
 *
 * @param a - 첫 번째 지지 로마자
 * @param b - 두 번째 지지 로마자
 * @returns 원진 관계이면 true
 *
 * @example
 * isWonjin('JA', 'MI')    // true  -- 자미원진
 * isWonjin('IN', 'YU')    // true  -- 인유원진
 * isWonjin('JA', 'CHUK')  // false
 */
export function isWonjin(a: BranchName, b: BranchName): boolean {
  return WONJIN_PAIRS.some(
    (pair) => (pair.a === a && pair.b === b) || (pair.a === b && pair.b === a),
  );
}

/**
 * 주어진 지지의 원진(怨嗔) 상대 지지를 반환한다.
 *
 * @param branch - 지지 로마자
 * @returns 원진 상대 지지 (없으면 null -- 이론상 모든 지지에 원진이 있으므로 null은 발생하지 않음)
 *
 * @example
 * getWonjinPartner('JA')   // 'MI'
 * getWonjinPartner('IN')   // 'YU'
 */
export function getWonjinPartner(branch: BranchName): BranchName | null {
  for (const pair of WONJIN_PAIRS) {
    if (pair.a === branch) return pair.b;
    if (pair.b === branch) return pair.a;
  }
  return null;
}

/**
 * 두 지지가 반합(半合) 관계인지 확인한다.
 *
 * @param a - 첫 번째 지지 로마자
 * @param b - 두 번째 지지 로마자
 * @returns 반합 관계이면 해당 반합 데이터, 아니면 null
 *
 * @example
 * getBanhap('SHIN', 'JA')  // { type: 'SAENGWANG', resultOhhaeng: 'SU', ... }
 * getBanhap('JA', 'MYO')   // null
 */
export function getBanhap(a: BranchName, b: BranchName): typeof BANHAP_PAIRS[number] | null {
  return BANHAP_PAIRS.find(
    (pair) =>
      (pair.branches[0] === a && pair.branches[1] === b) ||
      (pair.branches[0] === b && pair.branches[1] === a),
  ) ?? null;
}

/**
 * 두 지지가 암합(暗合) 관계인지 확인한다.
 *
 * @param a - 첫 번째 지지 로마자
 * @param b - 두 번째 지지 로마자
 * @returns 암합 관계이면 true
 *
 * @example
 * isAmhap('IN', 'CHUK')  // true  -- 인축암합 (甲己合)
 * isAmhap('O', 'HAE')    // true  -- 오해암합 (丁壬合)
 * isAmhap('JA', 'O')     // false
 */
export function isAmhap(a: BranchName, b: BranchName): boolean {
  return AMHAP_PAIRS.some(
    (pair) => (pair.a === a && pair.b === b) || (pair.a === b && pair.b === a),
  );
}

/**
 * 세 지지가 삼합(三合)을 이루는지 확인한다.
 *
 * @param a - 첫 번째 지지 로마자
 * @param b - 두 번째 지지 로마자
 * @param c - 세 번째 지지 로마자
 * @returns 삼합이면 합화 결과 오행, 아니면 null
 *
 * @example
 * getSamhap('SHIN', 'JA', 'JIN')  // 'SU' -- 申子辰 水局
 * getSamhap('IN', 'O', 'SUL')     // 'HWA' -- 寅午戌 火局
 * getSamhap('JA', 'IN', 'O')      // null
 */
export function getSamhap(a: BranchName, b: BranchName, c: BranchName): string | null {
  const input = new Set([a, b, c]);
  if (input.size !== 3) return null;
  for (const group of SAMHAP_GROUPS) {
    const groupSet = new Set(group.branches);
    if ([...input].every((x) => groupSet.has(x))) {
      return group.resultOhhaeng;
    }
  }
  return null;
}
