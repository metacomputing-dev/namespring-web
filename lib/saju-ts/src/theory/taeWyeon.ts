/**
 * 태원·명궁·태식론(胎元·命宮·胎息論)
 *
 * 연해자평(渊海子平)·삼명통회(三命通会) 기반의 태원(胎元)·명궁(命宮)·태식(胎息) 이론.
 *
 * 태원(胎元)은 수태(受胎)된 달의 간지(干支)로, 월주(月柱) 기준으로 역산한다.
 * 명궁(命宮)은 생월(生月)과 생시(生時)를 결합하여 구하는 인생의 핵심 궁(宮)이다.
 * 태식(胎息)은 일주(日柱) 기준으로 구하는 수태 시점의 간지이다.
 *
 * 근거 문헌: 渊海子平(연해자평), 三命通会(삼명통회), 子平眞詮(자평진전),
 *            命理探源(명리탐원), 窮通寶鑑(궁통보감)
 */

import type { StemIdx, BranchIdx } from '../core/cycle.js';
import type { TenGod } from '../core/tenGod.js';
import { tenGodOf } from '../core/tenGod.js';
import { getNabeum } from './nabeumohhaeng.js';
import type { NabeumEntry } from './nabeumohhaeng.js';
import { isGongmang } from './gongmang.js';
import { getJijanggan } from './jijanggan.js';
import type { JijangganEntry } from './jijanggan.js';
import { isHap, getHapResult } from './cheonganHap.js';
import type { Ohhaeng } from './ohhaeng.js';

// ---------------------------------------------------------------------------
// 기본 상수
// ---------------------------------------------------------------------------

const STEM_NAMES = ['GAP','EUL','BYEONG','JEONG','MU','GI','GYEONG','SIN','IM','GYE'] as const;
const BRANCH_NAMES = ['JA','CHUK','IN','MYO','JIN','SA','O','MI','SHIN','YU','SUL','HAE'] as const;
const STEM_HANJA  = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'] as const;
const BRANCH_HANJA = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'] as const;

/**
 * 지지 육충(六沖) 테이블
 *
 * 인덱스 i의 충 상대는 (i + 6) % 12이다.
 * 子午沖, 丑未沖, 寅申沖, 卯酉沖, 辰戌沖, 巳亥沖
 */
function getChungPartner(branchIdx: BranchIdx): BranchIdx {
  return ((branchIdx + 6) % 12) as BranchIdx;
}

/**
 * 지지 육합(六合) 테이블
 *
 * 子丑合(0-1), 寅亥合(2-11), 卯戌合(3-10), 辰酉合(4-9), 巳申合(5-8), 午未合(6-7)
 */
const YUKAP_PAIRS: [BranchIdx, BranchIdx][] = [
  [0, 1],   // 子丑合
  [2, 11],  // 寅亥合
  [3, 10],  // 卯戌合
  [4, 9],   // 辰酉合
  [5, 8],   // 巳申合
  [6, 7],   // 午未合
];

/** 지지 육합(六合) 상대를 반환한다. */
function getYukhapPartner(branchIdx: BranchIdx): BranchIdx {
  for (const [a, b] of YUKAP_PAIRS) {
    if (a === branchIdx) return b as BranchIdx;
    if (b === branchIdx) return a as BranchIdx;
  }
  return branchIdx; // fallback (이론상 도달 불가)
}

/**
 * 연간 인덱스로부터 정월(寅月) 월간 시작 인덱스를 구한다.
 *
 * 연상기월법(年上起月法): 갑기(甲己)년 → 丙(2), 을경(乙庚)년 → 戊(4),
 * 병신(丙辛)년 → 庚(6), 정임(丁壬)년 → 壬(8), 무계(戊癸)년 → 甲(0)
 *
 * 수학적 표현: 정월 월간 = (연간 인덱스 % 5) * 2 + 2, mod 10
 */
function getMonthStemStart(yearStemIdx: StemIdx): StemIdx {
  return (((yearStemIdx % 5) * 2 + 2) % 10) as StemIdx;
}

/**
 * 생월번호(1=寅월~12=丑월)와 연간(年干)으로부터 월간(月干)을 산출한다.
 *
 * @param yearStemIdx - 연간 인덱스 (0=甲 ~ 9=癸)
 * @param monthNum    - 생월번호 (1=寅월 ~ 12=丑월)
 * @returns 월간 인덱스 (0-9)
 */
function getMonthStem(yearStemIdx: StemIdx, monthNum: number): StemIdx {
  const start = getMonthStemStart(yearStemIdx);
  return ((start + monthNum - 1) % 10) as StemIdx;
}

// ═══════════════════════════════════════════════════════════════════════════
// 태원(胎元)
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// 태원 인터페이스
// ---------------------------------------------------------------------------

/**
 * 태원(胎元) 데이터
 */
export interface TaeWyeonData {
  /** 태원 천간 인덱스 (0-9) */
  stemIdx: StemIdx;
  /** 태원 지지 인덱스 (0-11) */
  branchIdx: BranchIdx;
  /** 태원 천간 로마자 */
  stemName: string;
  /** 태원 지지 로마자 */
  branchName: string;
  /** 태원 한자 표기 (예: '庚卯') */
  hanja: string;
}

/**
 * 태원(胎元)의 십신 분석 결과
 */
export interface TaeWyeonSipsinAnalysis {
  /** 태원 천간이 일간에 대한 십신 */
  sipsin: TenGod;
  /** 십신 한자 표기 */
  sipsinHanja: string;
  /** 해석 설명 */
  interpretation: string;
}

/**
 * 태원과 일주의 합/충 관계 분석 결과
 */
export interface TaeWyeonRelationAnalysis {
  /** 천간합 여부 */
  cheonganHap: boolean;
  /** 천간합 결과 오행 (합일 경우) */
  hapResultOhhaeng: Ohhaeng | null;
  /** 지지충 여부 */
  jijiChung: boolean;
  /** 지지합 여부 */
  jijiHap: boolean;
  /** 종합 해석 */
  interpretation: string;
}

/**
 * 태원 공망 분석 결과
 */
export interface TaeWyeonGongmangAnalysis {
  /** 태원 지지가 일주 기준 공망인지 여부 */
  isGongmang: boolean;
  /** 해석 설명 */
  interpretation: string;
}

/**
 * 태원 납음오행 분석 결과
 */
export interface TaeWyeonNabeumAnalysis {
  /** 납음오행 항목 (유효한 60갑자 조합이 아니면 null) */
  nabeum: NabeumEntry | null;
  /** 해석 설명 */
  interpretation: string;
}

/**
 * 태원 종합 해석 결과
 */
export interface TaeWyeonFullAnalysis {
  /** 태원 기본 데이터 */
  taeWyeon: TaeWyeonData;
  /** 십신 분석 */
  sipsin: TaeWyeonSipsinAnalysis;
  /** 합/충 관계 분석 */
  relation: TaeWyeonRelationAnalysis;
  /** 공망 분석 */
  gongmang: TaeWyeonGongmangAnalysis;
  /** 납음오행 분석 */
  nabeum: TaeWyeonNabeumAnalysis;
}

// ---------------------------------------------------------------------------
// 태원 이론 설명
// ---------------------------------------------------------------------------

/**
 * 태원(胎元) 이론 설명
 *
 * 태원은 임신 10개월(음력) 전의 간지(干支)로,
 * 수태(受胎) 시점의 천지 기운을 나타낸다.
 *
 * 계산법:
 * - 월간(月干) + 4 (mod 10) = 태원 천간
 * - 월지(月支) + 1 (mod 12) = 태원 지지 (※ 이전 일부 유파는 +3)
 *
 * 예: 월주가 丙寅이면 -> 천간: 丙(2)+4=庚(6), 지지: 寅(2)+1=卯(3) -> 태원 = 庚卯
 */
export const TAEWON_THEORY = {
  definition:
    '태원(胎元)은 수태월(受胎月)의 천간·지지로, 태아가 잉태된 시점의 천지 기운을 나타낸다. ' +
    '월주(月柱)를 기준으로 역산하여 구한다.',
  calcMethod:
    '태원 천간 = (월간 인덱스 + 4) mod 10\n' +
    '태원 지지 = (월지 인덱스 + 1) mod 12',
  interpretation: [
    '태원이 일주(日柱)와 합(合)하면 부모 덕이 있고 출생 환경이 좋다.',
    '태원이 일주와 충(沖)하면 출생 과정에 어려움이 있었거나 유아기가 순탄치 않다.',
    '태원이 공망(空亡)에 해당하면 수태 환경이 불안정하여 건강에 유의해야 한다.',
    '태원의 천간이 일간과 같은 오행이면 선천적 체질이 강건하다.',
    '태원의 십신(十神)을 통해 태아기·유아기의 환경과 부모의 상황을 유추한다.',
  ],
} as const;

/**
 * 태원 십신별 상세 해석 테이블
 *
 * 태원 천간이 일간(日干)에 대해 어떤 십신인지에 따라
 * 수태 환경과 선천적 기질을 추론한다.
 */
export const TAEWON_SIPSIN_MEANINGS: Record<TenGod, string> = {
  BI_GYEON:
    '태원 비견(比肩): 수태 당시 부모가 독립적이고 안정된 환경에 있었다. ' +
    '선천적으로 자립심과 독립심이 강하며, 형제자매와 비슷한 환경에서 성장한다.',
  GEOB_JAE:
    '태원 겁재(劫財): 수태 당시 경쟁적인 환경이었을 가능성이 있다. ' +
    '선천적으로 추진력이 강하나 형제간 재물 분쟁이나 부모의 경제적 변동이 있었을 수 있다.',
  SIK_SHIN:
    '태원 식신(食神): 수태 당시 의식주가 풍족한 환경이었다. ' +
    '선천적으로 먹복(食福)이 있고 낙천적인 기질을 타고난다. 어머니의 건강이 양호했다.',
  SANG_GWAN:
    '태원 상관(傷官): 수태 당시 부모의 상황에 변화가 있었을 수 있다. ' +
    '선천적으로 총명하고 재능이 뛰어나나, 출산 과정이 순탄치 않았을 가능성이 있다.',
  PYEON_JAE:
    '태원 편재(偏財): 수태 당시 아버지의 경제 활동이 활발했다. ' +
    '선천적으로 재물 감각이 있고, 아버지의 영향을 많이 받는다.',
  JEONG_JAE:
    '태원 정재(正財): 수태 당시 가정의 경제 상황이 안정적이었다. ' +
    '선천적으로 근면 성실한 기질을 타고나며, 안정된 가정 환경에서 출생한다.',
  PYEON_GWAN:
    '태원 편관(偏官): 수태 당시 부모에게 압박이나 긴장이 있었을 수 있다. ' +
    '선천적으로 강인한 기질을 타고나며, 어린 시절 엄격한 환경에서 성장할 수 있다.',
  JEONG_GWAN:
    '태원 정관(正官): 수태 당시 부모의 사회적 지위가 안정적이었다. ' +
    '선천적으로 명예를 중시하고 예의 바른 기질을 타고난다. 출생 환경이 양호하다.',
  PYEON_IN:
    '태원 편인(偏印): 수태 당시 특수한 환경이거나 어머니에게 변화가 있었다. ' +
    '선천적으로 독창적인 사고력을 타고나며, 특수 재능이 있을 수 있다.',
  JEONG_IN:
    '태원 정인(正印): 수태 당시 어머니의 건강과 정서가 안정적이었다. ' +
    '선천적으로 학문적 기질이 있고, 어머니의 보살핌이 충분한 환경에서 출생한다.',
};

/**
 * 태원과 일주의 합/충 관계별 상세 해석
 */
export const TAEWON_RELATION_INTERPRETATIONS = {
  /** 태원 천간과 일간이 천간합(天干合)을 이룰 때 */
  cheonganHap:
    '태원 천간과 일간이 천간합(天干合)을 이루면 수태 시점과 출생 후 인생 방향이 조화롭다. ' +
    '부모의 의지와 본인의 인생이 연결되어 있으며, 선천적 복(福)이 있다. ' +
    '합화(合化) 결과 오행이 일간에 유리하면 더욱 길하다.',
  /** 태원 지지와 일지가 지지충(地支沖)일 때 */
  jijiChung:
    '태원 지지와 일지가 육충(六沖)이면 수태 환경과 출생 후 환경 사이에 단절이 있다. ' +
    '출산 과정에 어려움이 있었거나 유아기에 거주지 변동·가정 변화가 있었을 수 있다. ' +
    '충(沖)은 변동과 이동을 의미하므로 어린 시절 이사가 잦을 수 있다.',
  /** 태원 지지와 일지가 지지합(地支合)일 때 */
  jijiHap:
    '태원 지지와 일지가 육합(六合)이면 수태 환경과 출생 후 환경이 자연스럽게 연결된다. ' +
    '부모의 보살핌 아래 안정적으로 성장하며, 유아기가 순탄하다. ' +
    '합(合)은 결합과 조화를 의미하므로 가정 환경이 화목하다.',
  /** 태원과 일주 사이에 특별한 합/충이 없을 때 */
  neutral:
    '태원과 일주 사이에 특별한 합(合)·충(沖)이 없으면 수태 환경과 출생 후 환경이 ' +
    '독립적으로 작용한다. 선천적 기질은 태원의 오행·십신을 중심으로 분석한다.',
  /** 천간합과 지지충이 동시에 발생할 때 */
  hapAndChung:
    '태원과 일주 사이에 천간합(天干合)과 지지충(地支沖)이 동시에 발생하면 ' +
    '선천적 복(福)은 있으나 외부 환경의 변동이 크다. ' +
    '상반된 기운이 동시에 작용하여 길흉이 교차하는 구조이다.',
} as const;

/**
 * 태원 공망 관련 상세 해석
 */
export const TAEWON_GONGMANG_INTERPRETATIONS = {
  /** 태원 지지가 공망일 때 */
  isGongmang:
    '태원 지지가 일주(日柱) 기준 공망(空亡)에 해당하면 수태 환경이 불안정했거나 ' +
    '임신 과정에 어려움이 있었을 수 있다. 선천적 건강이 약할 수 있으므로 ' +
    '유아기 건강 관리에 유의해야 한다. 태원의 지장간 기운이 공허해지므로 ' +
    '태원이 나타내는 십신의 작용이 약화된다.',
  /** 태원 지지가 공망이 아닐 때 */
  notGongmang:
    '태원 지지가 공망에 해당하지 않으므로 수태 환경의 기운이 온전하게 작용한다. ' +
    '태원의 천간·지지가 나타내는 선천적 기질이 정상적으로 발현된다.',
} as const;

// ---------------------------------------------------------------------------
// 태원 계산 함수
// ---------------------------------------------------------------------------

/**
 * 태원(胎元) 계산 함수
 *
 * @param monthStemIdx  - 월간(月干) 인덱스 (0=甲 ~ 9=癸)
 * @param monthBranchIdx - 월지(月支) 인덱스 (0=子 ~ 11=亥)
 * @returns 태원 데이터
 *
 * @example
 * calcTaeWyeon(2, 2) // 丙寅월 -> 庚卯
 */
export function calcTaeWyeon(monthStemIdx: StemIdx, monthBranchIdx: BranchIdx): TaeWyeonData {
  const s = ((monthStemIdx + 4) % 10) as StemIdx;
  const b = ((monthBranchIdx + 1) % 12) as BranchIdx;
  return {
    stemIdx: s,
    branchIdx: b,
    stemName: STEM_NAMES[s],
    branchName: BRANCH_NAMES[b],
    hanja: `${STEM_HANJA[s]}${BRANCH_HANJA[b]}`,
  };
}

/**
 * 태원 천간의 십신(十神) 분석
 *
 * 태원 천간이 일간(日干)에 대해 어떤 십신인지를 산출하고
 * 그에 따른 수태 환경·선천적 기질 해석을 반환한다.
 *
 * @param dayStemIdx    - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param taeWyeonData  - 태원 데이터
 * @returns 태원 십신 분석 결과
 */
export function analyzeTaeWyeonSipsin(
  dayStemIdx: StemIdx,
  taeWyeonData: TaeWyeonData,
): TaeWyeonSipsinAnalysis {
  const sipsin = tenGodOf(dayStemIdx, taeWyeonData.stemIdx);
  const SIPSIN_HANJA: Record<TenGod, string> = {
    BI_GYEON: '比肩', GEOB_JAE: '劫財',
    SIK_SHIN: '食神', SANG_GWAN: '傷官',
    PYEON_JAE: '偏財', JEONG_JAE: '正財',
    PYEON_GWAN: '偏官', JEONG_GWAN: '正官',
    PYEON_IN: '偏印', JEONG_IN: '正印',
  };
  return {
    sipsin,
    sipsinHanja: SIPSIN_HANJA[sipsin],
    interpretation: TAEWON_SIPSIN_MEANINGS[sipsin],
  };
}

/**
 * 태원과 일주의 합(合)/충(沖) 관계 분석
 *
 * 태원의 천간·지지가 일주의 천간·지지와 어떤 관계(합·충·무관)인지 판별하고
 * 종합 해석을 반환한다.
 *
 * @param dayStemIdx    - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param dayBranchIdx  - 일지 인덱스 (0=子 ~ 11=亥)
 * @param taeWyeonData  - 태원 데이터
 * @returns 합/충 관계 분석 결과
 */
export function analyzeTaeWyeonRelation(
  dayStemIdx: StemIdx,
  dayBranchIdx: BranchIdx,
  taeWyeonData: TaeWyeonData,
): TaeWyeonRelationAnalysis {
  const cheonganHap = isHap(dayStemIdx, taeWyeonData.stemIdx);
  const hapResultOhhaeng = cheonganHap ? getHapResult(dayStemIdx, taeWyeonData.stemIdx) : null;
  const jijiChung = getChungPartner(dayBranchIdx) === taeWyeonData.branchIdx;
  const jijiHap = getYukhapPartner(dayBranchIdx) === taeWyeonData.branchIdx;

  let interpretation: string;
  if (cheonganHap && jijiChung) {
    interpretation = TAEWON_RELATION_INTERPRETATIONS.hapAndChung;
  } else if (cheonganHap) {
    interpretation = TAEWON_RELATION_INTERPRETATIONS.cheonganHap;
  } else if (jijiChung) {
    interpretation = TAEWON_RELATION_INTERPRETATIONS.jijiChung;
  } else if (jijiHap) {
    interpretation = TAEWON_RELATION_INTERPRETATIONS.jijiHap;
  } else {
    interpretation = TAEWON_RELATION_INTERPRETATIONS.neutral;
  }

  return { cheonganHap, hapResultOhhaeng, jijiChung, jijiHap, interpretation };
}

/**
 * 태원 지지의 공망(空亡) 분석
 *
 * 일주(日柱) 기준으로 태원 지지가 공망에 해당하는지 판단하고 해석을 반환한다.
 *
 * @param dayStemIdx    - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param dayBranchIdx  - 일지 인덱스 (0=子 ~ 11=亥)
 * @param taeWyeonData  - 태원 데이터
 * @returns 공망 분석 결과
 */
export function analyzeTaeWyeonGongmang(
  dayStemIdx: StemIdx,
  dayBranchIdx: BranchIdx,
  taeWyeonData: TaeWyeonData,
): TaeWyeonGongmangAnalysis {
  const gm = isGongmang(dayStemIdx, dayBranchIdx, taeWyeonData.branchIdx);
  return {
    isGongmang: gm,
    interpretation: gm
      ? TAEWON_GONGMANG_INTERPRETATIONS.isGongmang
      : TAEWON_GONGMANG_INTERPRETATIONS.notGongmang,
  };
}

/**
 * 태원의 납음오행(納音五行) 분석
 *
 * 태원 간지(干支)의 납음오행을 조회하고 그 의미를 해석한다.
 *
 * @param taeWyeonData - 태원 데이터
 * @returns 납음오행 분석 결과
 */
export function analyzeTaeWyeonNabeum(taeWyeonData: TaeWyeonData): TaeWyeonNabeumAnalysis {
  const nabeum = getNabeum(taeWyeonData.stemIdx, taeWyeonData.branchIdx) ?? null;
  let interpretation: string;
  if (nabeum) {
    interpretation =
      `태원의 납음오행은 ${nabeum.hanja}(${nabeum.name})이다. ` +
      `${nabeum.description} ` +
      '납음오행은 선천적으로 타고난 기운의 본질적 성격을 나타내며, ' +
      '태아기에 형성된 근본적 기질과 잠재력을 상징한다.';
  } else {
    interpretation =
      '태원 간지가 유효한 60갑자 조합이 아니므로 납음오행을 산출할 수 없다.';
  }
  return { nabeum, interpretation };
}

/**
 * 태원 종합 분석
 *
 * 태원의 십신·합충관계·공망·납음오행을 한 번에 분석하여 종합 결과를 반환한다.
 *
 * @param dayStemIdx     - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param dayBranchIdx   - 일지 인덱스 (0=子 ~ 11=亥)
 * @param monthStemIdx   - 월간 인덱스 (0=甲 ~ 9=癸)
 * @param monthBranchIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 태원 종합 분석 결과
 *
 * @example
 * analyzeTaeWyeon(0, 0, 2, 2) // 甲子일주, 丙寅월 -> 태원 庚卯 종합 분석
 */
export function analyzeTaeWyeon(
  dayStemIdx: StemIdx,
  dayBranchIdx: BranchIdx,
  monthStemIdx: StemIdx,
  monthBranchIdx: BranchIdx,
): TaeWyeonFullAnalysis {
  const taeWyeon = calcTaeWyeon(monthStemIdx, monthBranchIdx);
  return {
    taeWyeon,
    sipsin: analyzeTaeWyeonSipsin(dayStemIdx, taeWyeon),
    relation: analyzeTaeWyeonRelation(dayStemIdx, dayBranchIdx, taeWyeon),
    gongmang: analyzeTaeWyeonGongmang(dayStemIdx, dayBranchIdx, taeWyeon),
    nabeum: analyzeTaeWyeonNabeum(taeWyeon),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 태식(胎息) — 일주 기준의 태원
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 태식(胎息) 데이터
 *
 * 태식은 일주(日柱) 기준의 태원이다.
 * 일간(日干)에 4를 더하면 태식 천간, 일지(日支)에 1을 더하면 태식 지지가 된다.
 *
 * 태원이 월주 기준으로 수태월의 천지 기운을 나타내듯,
 * 태식은 일주 기준으로 사주 주체의 가장 근원적인 잠재 기운을 나타낸다.
 *
 * 근거: 삼명통회(三命通会) "태식(胎息)은 일주에서 태원을 역산한 것과 같다"
 */
export interface TaeSikData {
  /** 태식 천간 인덱스 (0-9) */
  stemIdx: StemIdx;
  /** 태식 지지 인덱스 (0-11) */
  branchIdx: BranchIdx;
  /** 태식 천간 로마자 */
  stemName: string;
  /** 태식 지지 로마자 */
  branchName: string;
  /** 태식 한자 표기 */
  hanja: string;
}

/**
 * 태식(胎息) 이론 설명
 *
 * 태식은 일주(日柱) 기준의 태원 개념으로,
 * 사주 주체의 근원적·잠재적 기운을 나타낸다.
 */
export const TAESIK_THEORY = {
  definition:
    '태식(胎息)은 일주(日柱) 기준으로 역산하는 태원(胎元)의 변형이다. ' +
    '태원이 월주 기준의 수태월 기운을 나타내는 반면, 태식은 일주 자체에서 ' +
    '도출되는 근원적인 잠재 기운을 상징한다.',
  calcMethod:
    '태식 천간 = (일간 인덱스 + 4) mod 10\n' +
    '태식 지지 = (일지 인덱스 + 1) mod 12',
  interpretation: [
    '태식은 사주 주체의 가장 깊은 내면에 잠재된 기운을 나타낸다.',
    '태원과 태식이 같은 오행이면 선천적 기질이 더욱 강화된다.',
    '태식의 천간이 일간에 대한 십신을 분석하여 내면의 잠재적 성향을 파악한다.',
    '태식과 태원을 함께 비교하면 외부(태원)와 내부(태식) 기운의 조화를 볼 수 있다.',
  ],
} as const;

/**
 * 태식(胎息) 계산 함수
 *
 * @param dayStemIdx   - 일간(日干) 인덱스 (0=甲 ~ 9=癸)
 * @param dayBranchIdx - 일지(日支) 인덱스 (0=子 ~ 11=亥)
 * @returns 태식 데이터
 *
 * @example
 * calcTaeSik(0, 0) // 甲子일주 -> 태식 戊丑
 */
export function calcTaeSik(dayStemIdx: StemIdx, dayBranchIdx: BranchIdx): TaeSikData {
  const s = ((dayStemIdx + 4) % 10) as StemIdx;
  const b = ((dayBranchIdx + 1) % 12) as BranchIdx;
  return {
    stemIdx: s,
    branchIdx: b,
    stemName: STEM_NAMES[s],
    branchName: BRANCH_NAMES[b],
    hanja: `${STEM_HANJA[s]}${BRANCH_HANJA[b]}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 명궁(命宮)
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// 명궁 인터페이스
// ---------------------------------------------------------------------------

/**
 * 명궁(命宮) 데이터
 */
export interface MyeonggungData {
  /** 명궁 천간 인덱스 (0-9) */
  stemIdx: StemIdx;
  /** 명궁 천간 로마자 */
  stemName: string;
  /** 명궁 천간 한자 */
  stemHanja: string;
  /** 명궁 지지 인덱스 (0-11) */
  branchIdx: BranchIdx;
  /** 명궁 지지 로마자 */
  branchName: string;
  /** 명궁 지지 한자 */
  branchHanja: string;
  /** 명궁 간지 한자 표기 (예: '庚寅') */
  hanja: string;
  /** 명궁의 의미 설명 */
  meaning: string;
}

/**
 * 명궁 지장간 분석 결과
 */
export interface MyeonggungJijangganAnalysis {
  /** 명궁 지지의 지장간 목록 */
  jijanggan: JijangganEntry[];
  /** 각 지장간이 일간에 대한 십신 */
  sipsinList: Array<{
    /** 지장간 천간 인덱스 */
    stemIdx: StemIdx;
    /** 지장간 천간 한자 */
    stemHanja: string;
    /** 지장간 역할 (본기/중기/여기) */
    role: string;
    /** 일간에 대한 십신 */
    sipsin: TenGod;
  }>;
  /** 해석 설명 */
  interpretation: string;
}

/**
 * 명궁과 일주의 관계 분석 결과
 */
export interface MyeonggungRelationAnalysis {
  /** 명궁 천간과 일간의 천간합 여부 */
  cheonganHap: boolean;
  /** 천간합 결과 오행 */
  hapResultOhhaeng: Ohhaeng | null;
  /** 명궁 지지와 일지의 지지충 여부 */
  jijiChung: boolean;
  /** 명궁 지지와 일지의 지지합 여부 */
  jijiHap: boolean;
  /** 명궁 천간이 일간에 대한 십신 */
  stemSipsin: TenGod;
  /** 종합 해석 */
  interpretation: string;
}

/**
 * 명궁 종합 분석 결과
 */
export interface MyeonggungFullAnalysis {
  /** 명궁 기본 데이터 */
  myeonggung: MyeonggungData;
  /** 지장간 분석 */
  jijanggan: MyeonggungJijangganAnalysis;
  /** 일주와의 관계 분석 */
  relation: MyeonggungRelationAnalysis;
}

// ---------------------------------------------------------------------------
// 명궁 이론 설명
// ---------------------------------------------------------------------------

/**
 * 명궁(命宮) 이론 설명
 *
 * 명궁은 생월(生月)과 생시(生時)를 결합하여 구하는 인생의 핵심 궁위(宮位)이다.
 * 사주 원국(原局)의 보완적 정보를 제공하며,
 * 특히 일간(日干)의 성격·재능·인생 방향을 보조적으로 판단하는 데 쓰인다.
 *
 * 계산법 (연해자평 기준):
 * 명궁 지지 = (14 - 생월번호 - 생시지지인덱스) mod 12
 *
 * ※ 생월번호: 寅월=1, 卯월=2, ..., 丑월=12
 * ※ 생시지지: 子=0, 丑=1, ..., 亥=11
 *
 * 명궁 천간 산출 (연상기월법과 동일 원리):
 * 명궁 지지가 결정되면 연간(年干)과 연상기월법(年上起月法)을 적용하여
 * 명궁 천간을 산출할 수 있다.
 * 명궁의 생월번호 = (명궁 지지 인덱스 - 1 + 12) % 12, 단 0이면 12
 * 명궁 천간 = 연상기월법의 해당 월 천간
 */
export const MYEONGGUNG_THEORY = {
  definition:
    '명궁(命宮)은 사주팔자 사기둥(四柱) 외에 추가로 구하는 보조 궁위(宮位)로, ' +
    '인생의 큰 틀과 잠재된 성격·재능을 나타낸다.',
  calcMethod:
    '명궁 지지 = (14 - 생월번호 - 생시 지지 인덱스) mod 12\n' +
    '※ 생월번호: 寅월=1 ~ 丑월=12\n' +
    '※ 생시 지지 인덱스: 子=0 ~ 亥=11\n\n' +
    '명궁 천간: 연상기월법(年上起月法) 적용\n' +
    '명궁 지지가 특정 월의 지지와 같으므로,\n' +
    '그 월에 해당하는 천간을 연간 기준으로 산출한다.',
  interpretation: [
    '명궁의 지지에 따라 성격·재능·인생 방향이 달라진다.',
    '명궁의 천간은 연상기월법(年上起月法)으로 산출하며, 천간·지지 조합이 명궁의 완전한 정보를 구성한다.',
    '명궁의 지장간(支藏干)이 일간에 대해 어떤 십신인지 분석하면 잠재된 재능과 성향을 파악할 수 있다.',
    '명궁이 일주와 합(合)하면 인생의 방향이 안정적이다.',
    '명궁이 일주와 충(沖)하면 인생의 변화가 잦다.',
    '명궁 천간이 일간에 대한 십신을 분석하면 인생의 주된 지향점을 알 수 있다.',
  ],
} as const;

/**
 * 명궁 12궁 의미 테이블 (상세 해석)
 *
 * 각 궁(宮)별로 성격·재능·인생 방향·건강·대인관계를 포괄하는 상세 해석.
 */
export const MYEONGGUNG_MEANINGS: Record<string, string> = {
  JA:
    '자궁(子宮) — 수(水) 기운. ' +
    '지혜롭고 총명하며 깊은 사고력을 지닌다. ' +
    '내면이 깊고 분석적이며 학문·연구에 재능이 있다. ' +
    '감정을 겉으로 잘 드러내지 않아 신비로운 인상을 줄 수 있다. ' +
    '밤(子시)의 기운으로 직관력이 뛰어나며 정신적 활동이 활발하다.',
  CHUK:
    '축궁(丑宮) — 토(土) 기운(금묘지). ' +
    '인내심과 끈기가 매우 강하고 재물 축적 능력이 뛰어나다. ' +
    '묵묵히 실력을 쌓아 만년에 결실을 보는 대기만성형이다. ' +
    '보수적이고 안정을 추구하며 한 분야에서 깊이를 추구한다. ' +
    '겨울의 끝자리로 차갑지만 내면에 금(金)의 잠재력을 품고 있다.',
  IN:
    '인궁(寅宮) — 목(木) 기운(생지). ' +
    '진취적이고 리더십이 있으며 큰 포부를 품는다. ' +
    '봄의 시작 기운으로 새로운 일을 시작하는 개척자 기질이 강하다. ' +
    '자신감과 추진력이 넘치며 조직을 이끄는 능력이 탁월하다. ' +
    '다만 성급함과 독단적 성향을 주의해야 하며, 지지 내 화(丙)와 토(戊)의 조화가 중요하다.',
  MYO:
    '묘궁(卯宮) — 목(木) 기운(왕지). ' +
    '친화력과 예술적 감각이 뛰어나며 부드러운 카리스마가 있다. ' +
    '순수한 목(木)의 기운으로 창의성과 감수성이 풍부하다. ' +
    '대인관계가 원만하고 협력적이며, 외교적 능력이 있다. ' +
    '유연하고 적응력이 뛰어나나 결단력이 약할 수 있으므로 추진력 보완이 필요하다.',
  JIN:
    '진궁(辰宮) — 토(土) 기운(수묘지). ' +
    '이상이 높고 포용력이 넓으며 다재다능한 성격이다. ' +
    '용(龍)의 상징으로 신비롭고 스케일이 크며, 큰 꿈을 품고 도전한다. ' +
    '내부에 수(癸)와 목(乙)의 기운을 품어 지적이고 감성적인 면이 공존한다. ' +
    '이상과 현실의 괴리를 주의해야 하며, 실행력을 갖추면 크게 성공한다.',
  SA:
    '사궁(巳宮) — 화(火) 기운(생지). ' +
    '집중력·통찰력이 뛰어나고 지략이 깊으며 내면이 열정적이다. ' +
    '뱀(蛇)의 상징으로 날카로운 관찰력과 은밀한 지혜를 지닌다. ' +
    '내부에 금(庚)과 토(戊)를 품어 실용적 판단력과 재물 감각이 있다. ' +
    '지식욕이 강하고 연구직·전문직에 적합하나, 의심과 질투를 경계해야 한다.',
  O:
    '오궁(午宮) — 화(火) 기운(왕지). ' +
    '활동적이고 열정적이며 표현력이 강하고 화끈한 성격이다. ' +
    '한낮(午시)의 기운으로 밝고 에너지가 넘치며 리더형 성격이다. ' +
    '내부에 토(己)를 품어 중심을 잡는 힘도 있다. ' +
    '성급함과 과열을 주의해야 하며, 수(水)의 기운으로 균형을 잡으면 크게 발전한다.',
  MI:
    '미궁(未宮) — 토(土) 기운(목묘지). ' +
    '온순하고 감성이 풍부하며 예술적 재능이 돋보인다. ' +
    '여름의 끝자리로 내면에 화(丁)의 여운과 목(乙)의 유연함을 품고 있다. ' +
    '심미적 감각이 뛰어나 예술·디자인·문학 분야에서 재능을 발휘한다. ' +
    '다만 우유부단하고 결정을 미루는 경향이 있어 결단력 보완이 필요하다.',
  SHIN:
    '신궁(申宮) — 금(金) 기운(생지). ' +
    '재치와 기민함이 뛰어나고 변화에 대한 적응력이 탁월하다. ' +
    '원숭이(猴)의 상징으로 영리하고 다재다능하며 학습 능력이 빠르다. ' +
    '내부에 수(壬)와 토(戊)를 품어 지적 능력과 현실 감각이 균형 잡혀 있다. ' +
    '지나친 잔재주와 경박함을 주의해야 하며, 깊이 있는 전문성을 갖추면 성공한다.',
  YU:
    '유궁(酉宮) — 금(金) 기운(왕지). ' +
    '예리한 통찰력·완벽주의·뛰어난 미감을 지닌다. ' +
    '순수한 금(金)의 기운으로 날카롭고 세련되며 정밀한 분석력이 있다. ' +
    '예술·기술·법률 분야에서 탁월한 능력을 발휘한다. ' +
    '비판적 성향이 강해 대인관계에서 마찰이 생길 수 있으므로 관용이 필요하다.',
  SUL:
    '술궁(戌宮) — 토(土) 기운(화묘지). ' +
    '충직·의리가 강하고 신뢰를 중시하며 강직한 성격이다. ' +
    '개(犬)의 상징으로 충성심과 정의감이 뛰어나다. ' +
    '내부에 화(丁)의 중기와 금(辛)의 여기를 품어 내면에 열정과 실리를 겸비한다. ' +
    '고집이 세고 타협을 잘 못하는 점을 주의해야 하며, 유연성을 갖추면 크게 성공한다.',
  HAE:
    '해궁(亥宮) — 수(水) 기운(생지). ' +
    '포용력이 넓고 자유로우며 직관력이 발달한다. ' +
    '겨울의 시작으로 깊고 넓은 수(水)의 기운을 품어 사고가 광대하다. ' +
    '내부에 목(甲)을 품어 수생목(水生木)의 생장력을 잠재하고 있다. ' +
    '종교·철학·학문 분야에 적성이 있으며, 현실 감각을 보완하면 이상을 현실화할 수 있다.',
};

/**
 * 명궁과 일주의 관계별 해석
 */
export const MYEONGGUNG_RELATION_INTERPRETATIONS = {
  cheonganHap:
    '명궁 천간과 일간이 천간합(天干合)을 이루면 인생의 잠재적 방향과 실제 성격이 조화롭다. ' +
    '타고난 기질과 인생의 지향점이 일치하여 자연스러운 삶의 흐름을 만든다.',
  jijiChung:
    '명궁 지지와 일지가 육충(六沖)이면 인생의 방향에 큰 변동과 전환이 잦다. ' +
    '잠재된 기질과 현실의 환경이 충돌하여 갈등이 있을 수 있으나, ' +
    '이를 극복하면 오히려 역동적인 인생을 살 수 있다.',
  jijiHap:
    '명궁 지지와 일지가 육합(六合)이면 인생의 방향이 안정적이고 순조롭다. ' +
    '잠재된 기질이 현실에서 자연스럽게 발현되며, 대인관계가 원만하다.',
  neutral:
    '명궁과 일주 사이에 특별한 합·충이 없으면 잠재된 기질과 현실이 독립적으로 작용한다. ' +
    '명궁의 지장간과 천간의 십신을 중심으로 인생의 방향을 분석한다.',
  hapAndChung:
    '명궁과 일주 사이에 천간합과 지지충이 동시에 발생하면 내면의 조화와 ' +
    '외부 환경의 변동이 공존한다. 복잡한 인생 구조로 기복이 있으나 ' +
    '합(合)의 힘으로 결국 안정을 찾는 경향이 있다.',
} as const;

// ---------------------------------------------------------------------------
// 명궁 계산 함수
// ---------------------------------------------------------------------------

/**
 * 명궁(命宮) 계산 함수
 *
 * 생월(生月)·생시(生時)·연간(年干)으로부터 명궁의 천간과 지지를 모두 산출한다.
 *
 * 명궁 지지 계산:
 *   idx = (14 - birthMonthNum - birthHourBranchIdx) mod 12
 *
 * 명궁 천간 계산 (연상기월법 원리):
 *   명궁 지지가 특정 월의 지지에 해당하므로,
 *   해당 월의 천간을 연간 기준 연상기월법(年上起月法)으로 산출한다.
 *   생월번호(명궁) = (명궁 지지 인덱스 - 2 + 12) % 12 + 1
 *   → 寅=2 -> monthNum=1, 卯=3 -> monthNum=2, ..., 丑=1 -> monthNum=12
 *
 * @param birthMonthNum      - 생월 번호 (寅월=1, 卯월=2, ..., 丑월=12)
 * @param birthHourBranchIdx - 생시 지지 인덱스 (子=0 ~ 亥=11)
 * @param yearStemIdx         - 연간(年干) 인덱스 (0=甲 ~ 9=癸)
 * @returns 명궁 데이터 (천간·지지 모두 포함)
 *
 * @example
 * calcMyeonggung(1, 2, 0) // 寅월, 寅시, 甲년 -> 명궁 산출
 */
export function calcMyeonggung(
  birthMonthNum: number,
  birthHourBranchIdx: BranchIdx,
  yearStemIdx: StemIdx,
): MyeonggungData {
  // 명궁 지지 산출
  const branchIdx = (((14 - birthMonthNum - birthHourBranchIdx) % 12 + 12) % 12) as BranchIdx;

  // 명궁 천간 산출 (연상기월법)
  // 명궁 지지 인덱스 -> 해당 월번호 (寅=2 -> 1, 卯=3 -> 2, ..., 丑=1 -> 12)
  const mgMonthNum = ((branchIdx - 2 + 12) % 12) + 1;
  const stemIdx = getMonthStem(yearStemIdx, mgMonthNum);

  const name = BRANCH_NAMES[branchIdx];
  return {
    stemIdx,
    stemName: STEM_NAMES[stemIdx],
    stemHanja: STEM_HANJA[stemIdx],
    branchIdx,
    branchName: name,
    branchHanja: BRANCH_HANJA[branchIdx],
    hanja: `${STEM_HANJA[stemIdx]}${BRANCH_HANJA[branchIdx]}`,
    meaning: MYEONGGUNG_MEANINGS[name] ?? '',
  };
}

/**
 * 명궁 지장간 분석
 *
 * 명궁 지지의 지장간(支藏干) 각각이 일간(日干)에 대해 어떤 십신인지 분석한다.
 * 명궁의 지장간 십신을 통해 잠재된 재능·성향·인생 방향을 파악한다.
 *
 * @param dayStemIdx     - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param myeonggungData - 명궁 데이터
 * @returns 지장간 분석 결과
 */
export function analyzeMyeonggungJijanggan(
  dayStemIdx: StemIdx,
  myeonggungData: MyeonggungData,
): MyeonggungJijangganAnalysis {
  const jjgData = getJijanggan(myeonggungData.branchIdx);
  const stems = jjgData.stems;

  const sipsinList = stems.map((entry) => ({
    stemIdx: entry.stemIdx,
    stemHanja: entry.stemHanja,
    role: entry.role,
    sipsin: tenGodOf(dayStemIdx, entry.stemIdx),
  }));

  // 본기(BONGI) 중심 해석 생성
  const bongiEntry = sipsinList.find((e) => e.role === 'BONGI');
  const SIPSIN_HANGUL: Record<TenGod, string> = {
    BI_GYEON: '비견', GEOB_JAE: '겁재',
    SIK_SHIN: '식신', SANG_GWAN: '상관',
    PYEON_JAE: '편재', JEONG_JAE: '정재',
    PYEON_GWAN: '편관', JEONG_GWAN: '정관',
    PYEON_IN: '편인', JEONG_IN: '정인',
  };

  let interpretation = `명궁 ${myeonggungData.branchHanja}(${myeonggungData.branchName})의 지장간 분석: `;
  for (const entry of sipsinList) {
    const hangul = SIPSIN_HANGUL[entry.sipsin];
    const roleLabel = entry.role === 'BONGI' ? '본기' : entry.role === 'JUNGGI' ? '중기' : '여기';
    interpretation += `${roleLabel} ${entry.stemHanja}는 ${hangul}(${entry.sipsin}), `;
  }
  interpretation = interpretation.replace(/, $/, '. ');

  if (bongiEntry) {
    const bongiHangul = SIPSIN_HANGUL[bongiEntry.sipsin];
    interpretation +=
      `본기가 ${bongiHangul}이므로 명궁의 주된 기운은 ${bongiHangul}의 성격을 띤다.`;
  }

  return { jijanggan: stems, sipsinList, interpretation };
}

/**
 * 명궁과 일주의 관계 분석
 *
 * 명궁의 천간·지지가 일주의 천간·지지와 어떤 관계(합·충·무관)인지 판별하고
 * 종합 해석을 반환한다.
 *
 * @param dayStemIdx     - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param dayBranchIdx   - 일지 인덱스 (0=子 ~ 11=亥)
 * @param myeonggungData - 명궁 데이터
 * @returns 관계 분석 결과
 */
export function analyzeMyeonggungRelation(
  dayStemIdx: StemIdx,
  dayBranchIdx: BranchIdx,
  myeonggungData: MyeonggungData,
): MyeonggungRelationAnalysis {
  const cheonganHap = isHap(dayStemIdx, myeonggungData.stemIdx);
  const hapResultOhhaeng = cheonganHap ? getHapResult(dayStemIdx, myeonggungData.stemIdx) : null;
  const jijiChung = getChungPartner(dayBranchIdx) === myeonggungData.branchIdx;
  const jijiHap = getYukhapPartner(dayBranchIdx) === myeonggungData.branchIdx;
  const stemSipsin = tenGodOf(dayStemIdx, myeonggungData.stemIdx);

  let interpretation: string;
  if (cheonganHap && jijiChung) {
    interpretation = MYEONGGUNG_RELATION_INTERPRETATIONS.hapAndChung;
  } else if (cheonganHap) {
    interpretation = MYEONGGUNG_RELATION_INTERPRETATIONS.cheonganHap;
  } else if (jijiChung) {
    interpretation = MYEONGGUNG_RELATION_INTERPRETATIONS.jijiChung;
  } else if (jijiHap) {
    interpretation = MYEONGGUNG_RELATION_INTERPRETATIONS.jijiHap;
  } else {
    interpretation = MYEONGGUNG_RELATION_INTERPRETATIONS.neutral;
  }

  return { cheonganHap, hapResultOhhaeng, jijiChung, jijiHap, stemSipsin, interpretation };
}

/**
 * 명궁 종합 분석
 *
 * 명궁의 천간·지지·지장간·일주 관계를 한 번에 분석하여 종합 결과를 반환한다.
 *
 * @param dayStemIdx          - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param dayBranchIdx        - 일지 인덱스 (0=子 ~ 11=亥)
 * @param birthMonthNum       - 생월번호 (1=寅월 ~ 12=丑월)
 * @param birthHourBranchIdx  - 생시 지지 인덱스 (0=子 ~ 11=亥)
 * @param yearStemIdx          - 연간 인덱스 (0=甲 ~ 9=癸)
 * @returns 명궁 종합 분석 결과
 *
 * @example
 * analyzeMyeonggung(0, 0, 1, 2, 0) // 甲子일주, 寅월, 寅시, 甲년
 */
export function analyzeMyeonggung(
  dayStemIdx: StemIdx,
  dayBranchIdx: BranchIdx,
  birthMonthNum: number,
  birthHourBranchIdx: BranchIdx,
  yearStemIdx: StemIdx,
): MyeonggungFullAnalysis {
  const myeonggung = calcMyeonggung(birthMonthNum, birthHourBranchIdx, yearStemIdx);
  return {
    myeonggung,
    jijanggan: analyzeMyeonggungJijanggan(dayStemIdx, myeonggung),
    relation: analyzeMyeonggungRelation(dayStemIdx, dayBranchIdx, myeonggung),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 태원·명궁·태식 종합 분석
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 태원·명궁·태식 종합 분석 결과
 */
export interface TaeWyeonMyeonggungSynthesis {
  /** 태원 종합 분석 */
  taeWyeon: TaeWyeonFullAnalysis;
  /** 태식 데이터 */
  taeSik: TaeSikData;
  /** 명궁 종합 분석 */
  myeonggung: MyeonggungFullAnalysis;
  /** 태원·태식 오행 일치 여부 */
  taeWyeonTaeSikSameElement: boolean;
  /** 종합 해석 */
  synthesis: string;
}

/**
 * 종합 분석 이론 설명
 */
export const SYNTHESIS_THEORY = {
  definition:
    '태원(胎元)·명궁(命宮)·태식(胎息)은 사주 원국(四柱原局)의 보조 정보로서 ' +
    '사주만으로는 파악하기 어려운 선천적 기질·잠재 능력·인생 방향을 보완적으로 분석한다.',
  method: [
    '1단계: 태원(胎元) 분석 — 수태 환경·선천적 체질·유아기 환경을 파악한다.',
    '2단계: 태식(胎息) 분석 — 일주 기반의 근원적 잠재 기운을 분석한다.',
    '3단계: 명궁(命宮) 분석 — 인생의 큰 틀·잠재된 성격·재능·방향을 분석한다.',
    '4단계: 태원과 태식의 비교 — 외부(태원)와 내부(태식) 기운의 조화 여부를 확인한다.',
    '5단계: 명궁과 일주의 관계 — 잠재 기질과 현실 성격의 조화·충돌을 분석한다.',
    '6단계: 종합 — 세 가지를 함께 고려하여 사주 원국의 해석을 보완한다.',
  ],
  principles: [
    '태원·명궁·태식은 사주 원국의 보조 정보이며, 원국을 대체하지 않는다.',
    '합(合)·충(沖) 관계는 길흉 판단의 핵심이므로 반드시 확인한다.',
    '십신(十神) 분석을 통해 수태 환경·잠재 기질·인생 방향을 연결한다.',
    '납음오행(納音五行)은 선천적 기운의 본질적 성격을 보충적으로 드러낸다.',
    '공망(空亡) 분석은 기운의 약화 여부를 판단하는 데 활용한다.',
  ],
} as const;

/**
 * 태원·명궁·태식 종합 분석 함수
 *
 * 사주 원국의 보조 정보인 태원·명궁·태식을 한 번에 산출하고
 * 종합 해석을 생성한다.
 *
 * @param dayStemIdx          - 일간(日干) 인덱스 (0=甲 ~ 9=癸)
 * @param dayBranchIdx        - 일지(日支) 인덱스 (0=子 ~ 11=亥)
 * @param monthStemIdx        - 월간(月干) 인덱스 (0=甲 ~ 9=癸)
 * @param monthBranchIdx      - 월지(月支) 인덱스 (0=子 ~ 11=亥)
 * @param birthMonthNum       - 생월번호 (1=寅월 ~ 12=丑월)
 * @param birthHourBranchIdx  - 생시 지지 인덱스 (子=0 ~ 亥=11)
 * @param yearStemIdx          - 연간(年干) 인덱스 (0=甲 ~ 9=癸)
 * @returns 종합 분석 결과
 *
 * @example
 * synthesizeAnalysis(0, 0, 2, 2, 1, 2, 0)
 * // 甲子일주, 丙寅월(1월), 寅시, 甲년 -> 태원·명궁·태식 종합
 */
export function synthesizeAnalysis(
  dayStemIdx: StemIdx,
  dayBranchIdx: BranchIdx,
  monthStemIdx: StemIdx,
  monthBranchIdx: BranchIdx,
  birthMonthNum: number,
  birthHourBranchIdx: BranchIdx,
  yearStemIdx: StemIdx,
): TaeWyeonMyeonggungSynthesis {
  const twAnalysis = analyzeTaeWyeon(dayStemIdx, dayBranchIdx, monthStemIdx, monthBranchIdx);
  const tsData = calcTaeSik(dayStemIdx, dayBranchIdx);
  const mgAnalysis = analyzeMyeonggung(
    dayStemIdx, dayBranchIdx, birthMonthNum, birthHourBranchIdx, yearStemIdx,
  );

  // 태원·태식의 천간 오행 일치 여부 확인
  // 오행 쌍: 0-1(목), 2-3(화), 4-5(토), 6-7(금), 8-9(수)
  const twElement = Math.floor(twAnalysis.taeWyeon.stemIdx / 2);
  const tsElement = Math.floor(tsData.stemIdx / 2);
  const taeWyeonTaeSikSameElement = twElement === tsElement;

  // 종합 해석 생성
  const parts: string[] = [];

  // 태원 요약
  parts.push(
    `태원(胎元)은 ${twAnalysis.taeWyeon.hanja}로, ` +
    `일간에 대해 ${twAnalysis.sipsin.sipsinHanja}에 해당한다.`,
  );

  // 태원 합/충
  if (twAnalysis.relation.cheonganHap || twAnalysis.relation.jijiChung || twAnalysis.relation.jijiHap) {
    if (twAnalysis.relation.cheonganHap) {
      parts.push('태원 천간과 일간이 천간합(天干合)을 이루어 선천적 복(福)이 있다.');
    }
    if (twAnalysis.relation.jijiChung) {
      parts.push('태원 지지와 일지가 육충(六沖)으로 유아기에 변동이 있었을 수 있다.');
    }
    if (twAnalysis.relation.jijiHap) {
      parts.push('태원 지지와 일지가 육합(六合)으로 유아기가 순탄하다.');
    }
  }

  // 태원 공망
  if (twAnalysis.gongmang.isGongmang) {
    parts.push('태원이 공망(空亡)에 해당하여 수태 환경의 기운이 약화되어 있다.');
  }

  // 태식 요약
  parts.push(`태식(胎息)은 ${tsData.hanja}이다.`);
  if (taeWyeonTaeSikSameElement) {
    parts.push('태원과 태식의 천간 오행이 일치하여 선천적 기질이 더욱 강화된다.');
  }

  // 명궁 요약
  parts.push(
    `명궁(命宮)은 ${mgAnalysis.myeonggung.hanja}로, ` +
    `${mgAnalysis.myeonggung.branchHanja}궁의 기운을 지닌다.`,
  );

  // 명궁 관계
  if (mgAnalysis.relation.cheonganHap) {
    parts.push('명궁 천간과 일간이 천간합을 이루어 인생 방향이 조화롭다.');
  }
  if (mgAnalysis.relation.jijiChung) {
    parts.push('명궁 지지와 일지가 육충으로 인생에 변동이 잦을 수 있다.');
  }
  if (mgAnalysis.relation.jijiHap) {
    parts.push('명궁 지지와 일지가 육합으로 인생의 방향이 안정적이다.');
  }

  return {
    taeWyeon: twAnalysis,
    taeSik: tsData,
    myeonggung: mgAnalysis,
    taeWyeonTaeSikSameElement,
    synthesis: parts.join(' '),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 유틸리티
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 음력 월번호를 월지(月支) 인덱스로 변환
 *
 * 寅월(1) -> 인덱스 2, 卯월(2) -> 3, ..., 丑월(12) -> 1
 *
 * @param monthNum - 음력 월번호 (1=寅월 ~ 12=丑월)
 * @returns 월지 인덱스 (0-11)
 */
export function monthNumToBranchIdx(monthNum: number): BranchIdx {
  return ((monthNum + 1) % 12) as BranchIdx;
}

/**
 * 월지(月支) 인덱스를 생월번호로 변환
 *
 * 인덱스 2(寅) -> 1, 3(卯) -> 2, ..., 1(丑) -> 12
 *
 * @param branchIdx - 월지 인덱스 (0-11)
 * @returns 생월번호 (1-12)
 */
export function branchIdxToMonthNum(branchIdx: BranchIdx): number {
  return ((branchIdx - 2 + 12) % 12) + 1;
}
