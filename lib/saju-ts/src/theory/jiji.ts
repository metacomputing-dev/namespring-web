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
      { stem: JEONG, role: 'MAIN',     days: 20 }, // 丁(본기)
      { stem: GI,    role: 'RESIDUAL', days: 10 }, // 己(여기) — 중기 없음
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
      { stem: IM,  role: 'MAIN',     days: 20 }, // 壬(본기)
      { stem: GAP, role: 'RESIDUAL', days: 10 }, // 甲(여기) — 중기 없음
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
 * 辰(木묘)·戌(火묘)·丑(金묘)·未(木묘)
 *
 * 辰=水·木의 고, 戌=火·土의 고, 丑=金·水의 고, 未=木·火의 고
 */
export const MYO_JI: BranchName[] = ['JIN', 'SUL', 'CHUK', 'MI'];

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
