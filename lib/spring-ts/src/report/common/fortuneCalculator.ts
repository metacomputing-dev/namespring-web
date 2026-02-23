/**
 * fortuneCalculator.ts -- 세운/월운/일운 간지 계산 엔진
 *
 * 사주명리학의 만세력(萬歲曆) 산출 핵심 모듈.
 * 수학적으로 정확한 60갑자 순환 계산을 제공합니다.
 *
 * 사용 공식:
 *   - 세운 (연간지):  (서기년 - 4) mod 60
 *   - 월 천간 (오호기법): ((yearStemIdx % 5) * 2 + 2 + monthIdx) % 10
 *   - 월 지지:       인(寅)=1월 ~ 축(丑)=12월 고정
 *   - 일진 (일간지):  줄리안 데이 기반, 기준일 2000-01-07 = 甲子 (JD 2451551)
 *
 * 참고:
 *   - https://en.wikipedia.org/wiki/Sexagenary_cycle
 *   - https://quasar.as.utexas.edu/BillInfo/JulianDatesG.html
 *   - 오호기법(五虎遁法) 전통 산출법
 */

import type { ElementCode, BranchCode } from '../types.js';

import {
  GANZHI_60,
  yearToGanzhiIndex,
  julianDayToGanzhiIndex,
  BRANCHES,
  BRANCH_BY_CODE,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_GENERATES,
} from './elementMaps.js';

/** 오행 한자 매핑 (로컬 전용) */
const ELEMENT_HANJA: Record<ElementCode, string> = {
  WOOD: '木', FIRE: '火', EARTH: '土', METAL: '金', WATER: '水',
};

import type { StemInfo, BranchInfo } from './elementMaps.js';


// =============================================================================
//  공통 타입 정의
// =============================================================================

/** 간지 운세 정보 (세운/월운/일운 공통) */
export interface FortuneGanzhi {
  /** 60갑자 인덱스 (0~59) */
  readonly ganzhiIndex: number;
  /** 천간 인덱스 (0~9) */
  readonly stemIndex: number;
  /** 지지 인덱스 (0~11) */
  readonly branchIndex: number;
  /** 천간 정보 */
  readonly stem: StemInfo;
  /** 지지 정보 */
  readonly branch: BranchInfo;
  /** 간지 한글 표기 (예: "갑자") */
  readonly ganzhiHangul: string;
  /** 간지 한자 표기 (예: "甲子") */
  readonly ganzhiHanja: string;
  /** 천간 오행 */
  readonly stemElement: ElementCode;
  /** 지지 오행 */
  readonly branchElement: ElementCode;
}

/** 세운(年運) 정보 */
export interface YearlyFortune extends FortuneGanzhi {
  /** 서기 연도 */
  readonly year: number;
}

/** 월운(月運) 정보 */
interface MonthlyFortune extends FortuneGanzhi {
  /** 서기 연도 */
  readonly year: number;
  /** 월 (1~12, 절기 기준 음력 월) */
  readonly month: number;
  /** 절기 기준 양력 대략적 시작월 (참고용) */
  readonly solarMonthApprox: number;
}

/** 일운(日運) 정보 */
export interface DailyFortune extends FortuneGanzhi {
  /** 날짜 */
  readonly date: Date;
  /** 줄리안 데이 넘버 */
  readonly julianDay: number;
  /** 요일 (0=일, 1=월, ..., 6=토) */
  readonly dayOfWeek: number;
}

/** 합충형파해 관계 유형 */
type FortuneRelationType =
  | 'YUKHAP'     // 육합
  | 'SAMHAP'     // 삼합
  | 'BANGHAP'    // 방합
  | 'CHUNG'      // 충
  | 'HYEONG'     // 형
  | 'PA'         // 파
  | 'HAE'        // 해
  | 'WONJIN';    // 원진

/** 운의 합충 관계 정보 */
interface FortuneRelation {
  /** 관계 유형 */
  readonly type: FortuneRelationType;
  /** 관련 지지들 */
  readonly branches: BranchCode[];
  /** 한국어 설명 */
  readonly description: string;
  /** 관계의 긍/부정 톤 */
  readonly tone: 'positive' | 'negative' | 'neutral';
  /** 결과 오행 (합의 경우) */
  readonly resultElement?: ElementCode;
}


// =============================================================================
//  1. 줄리안 데이 계산 (Gregorian Calendar -> Julian Day Number)
// =============================================================================

/**
 * 그레고리력 날짜를 줄리안 데이 넘버(JDN)로 변환합니다.
 *
 * 알고리즘: U.S. Naval Observatory / Meeus 공식
 * 참고: https://quasar.as.utexas.edu/BillInfo/JulianDatesG.html
 *
 * @param year  서기 연도
 * @param month 월 (1~12)
 * @param day   일 (1~31)
 * @returns 줄리안 데이 넘버 (정수, 정오 기준)
 *
 * @example
 * toJulianDay(2000, 1, 7) // => 2451551 (甲子 기준일)
 * toJulianDay(2024, 1, 1) // => 2460310
 */
function toJulianDay(year: number, month: number, day: number): number {
  // 1월과 2월을 전년도 13월, 14월로 처리
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }

  // 그레고리력 보정 (1582년 10월 15일 이후)
  const A = Math.floor(y / 100);
  const B = Math.floor(A / 4);
  const C = 2 - A + B;

  // 줄리안 데이 계산
  const E = Math.floor(365.25 * (y + 4716));
  const F = Math.floor(30.6001 * (m + 1));

  // JD는 정오 기준이므로 0.5를 빼서 자정 기준 정수 JDN을 구한다
  const JD = C + day + E + F - 1524.5;

  // 정수 JDN으로 반올림 (자정 기준)
  return Math.floor(JD + 0.5);
}

/**
 * Date 객체를 줄리안 데이 넘버로 변환합니다.
 * UTC 기준이 아닌 로컬 시간 기준으로 날짜를 추출합니다.
 *
 * @param date Date 객체
 * @returns 줄리안 데이 넘버
 */
function dateToJulianDay(date: Date): number {
  return toJulianDay(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
}


// =============================================================================
//  2. 60갑자 간지 조회 헬퍼
// =============================================================================

/**
 * 60갑자 인덱스에서 FortuneGanzhi 기본 데이터를 생성합니다.
 *
 * @param ganzhiIndex 60갑자 인덱스 (0~59)
 * @returns FortuneGanzhi 기본 정보
 */
function buildFortuneGanzhi(ganzhiIndex: number): FortuneGanzhi {
  // 인덱스를 0~59 범위로 정규화
  const idx = ((ganzhiIndex % 60) + 60) % 60;
  const entry = GANZHI_60[idx];

  return {
    ganzhiIndex: idx,
    stemIndex: entry.stemIndex,
    branchIndex: entry.branchIndex,
    stem: entry.stem,
    branch: entry.branch,
    ganzhiHangul: `${entry.stem.hangul}${entry.branch.hangul}`,
    ganzhiHanja: `${entry.stem.hanja}${entry.branch.hanja}`,
    stemElement: entry.stem.element,
    branchElement: entry.branch.element,
  };
}

/**
 * 천간 인덱스와 지지 인덱스에서 60갑자 인덱스를 산출합니다.
 *
 * 60갑자는 천간(10주기)과 지지(12주기)의 최소공배수(60)로 구성됩니다.
 * 천간과 지지의 음양이 맞아야 유효한 조합이 됩니다 (짝수-짝수, 홀수-홀수).
 *
 * @param stemIndex   천간 인덱스 (0~9)
 * @param branchIndex 지지 인덱스 (0~11)
 * @returns 60갑자 인덱스 (0~59), 유효하지 않은 조합이면 -1
 */
function stemBranchToGanzhiIndex(stemIndex: number, branchIndex: number): number {
  // 음양이 맞지 않으면 (홀짝이 다르면) 유효하지 않은 조합
  if ((stemIndex % 2) !== (branchIndex % 2)) {
    return -1;
  }

  for (let i = 0; i < 60; i++) {
    if (i % 10 === stemIndex && i % 12 === branchIndex) {
      return i;
    }
  }
  return -1;
}


// =============================================================================
//  3. 세운(年運) 계산 -- 연간지 산출
// =============================================================================

/**
 * 특정 연도의 세운(年運) 간지를 산출합니다.
 *
 * 공식: (서기년 - 4) mod 60
 *   - 서기 4년이 甲子年이므로 4를 빼서 인덱스 0(甲子)에 맞춤
 *   - 예: 2024년 → (2024 - 4) % 60 = 2020 % 60 = 40 → 甲辰
 *
 * 주의: 절기 기준으로 입춘(立春) 이전은 전년도로 처리해야 하나,
 *       이 함수는 순수 산술 계산만 수행합니다. 절기 판단은 호출부 책임.
 *
 * @param year 서기 연도
 * @returns YearlyFortune 세운 간지 정보
 *
 * @example
 * getYearlyFortune(2024)
 * // => { year: 2024, ganzhiHangul: '갑진', stemElement: 'WOOD', ... }
 *
 * getYearlyFortune(2025)
 * // => { year: 2025, ganzhiHangul: '을사', stemElement: 'WOOD', ... }
 */
export function getYearlyFortune(year: number): YearlyFortune {
  const ganzhiIndex = yearToGanzhiIndex(year);
  const base = buildFortuneGanzhi(ganzhiIndex);

  return {
    ...base,
    year,
  };
}


// =============================================================================
//  4. 월운(月運) 계산 -- 월간지 산출
// =============================================================================

/**
 * 절기 기준 월(月) 인덱스 매핑.
 *
 * 공식: branchIndex = (month + 1) % 12
 *
 * @param month 절기 기준 월 (1~12, 인월=1)
 * @returns 지지 인덱스 (0~11)
 */
function monthToBranchIndex(month: number): number {
  return (month + 1) % 12;
}

/**
 * 월 천간 산출 -- 오호기법(五虎遁法)
 *
 * 일반화 공식:
 *   monthStemIdx = ((yearStemIdx % 5) * 2 + 2 + monthIdx) % 10
 *
 * @param yearStemIndex 연 천간 인덱스 (0~9)
 * @param month         절기 기준 월 (1~12)
 * @returns 월 천간 인덱스 (0~9)
 */
function monthStemIndex(yearStemIndex: number, month: number): number {
  const monthIdx = month - 1; // 0-based
  return ((yearStemIndex % 5) * 2 + 2 + monthIdx) % 10;
}

/**
 * 절기 기준 월에 대응하는 양력 대략적 월을 반환합니다 (참고용).
 *
 * @param month 절기 기준 월 (1~12)
 * @returns 양력 대략적 월 (1~12)
 */
function monthToSolarApprox(month: number): number {
  return month === 12 ? 1 : month + 1;
}

/**
 * 양력 월에서 절기 기준 월로 변환합니다 (근사치).
 *
 * @param solarMonth 양력 월 (1~12)
 * @returns 절기 기준 월 (1~12)
 */
function solarMonthToFortuneMonth(solarMonth: number): number {
  return solarMonth === 1 ? 12 : solarMonth - 1;
}

/**
 * 특정 연월의 월운(月運) 간지를 산출합니다.
 *
 * @param year  서기 연도 (세운 기준)
 * @param month 절기 기준 월 (1~12, 인월=1)
 * @returns MonthlyFortune 월운 간지 정보
 */
function getMonthlyFortune(year: number, month: number): MonthlyFortune {
  // 연 천간 인덱스 산출
  const yearGanzhiIdx = yearToGanzhiIndex(year);
  const yearStemIdx = yearGanzhiIdx % 10;

  // 월 천간 인덱스 (오호기법)
  const mStemIdx = monthStemIndex(yearStemIdx, month);

  // 월 지지 인덱스 (인=2, 묘=3, ..., 자=0, 축=1)
  const mBranchIdx = monthToBranchIndex(month);

  // 60갑자 인덱스 산출
  const ganzhiIdx = stemBranchToGanzhiIndex(mStemIdx, mBranchIdx);
  const base = buildFortuneGanzhi(ganzhiIdx >= 0 ? ganzhiIdx : 0);

  return {
    ...base,
    year,
    month,
    solarMonthApprox: monthToSolarApprox(month),
  };
}

/**
 * 양력 연도와 양력 월로부터 월운 간지를 산출합니다 (편의 함수).
 *
 * 양력 월을 절기 기준 월로 근사 변환하여 계산합니다.
 * 절기 입절일(보통 양력 5~7일경) 전후의 정확한 판단이 필요한 경우
 * 별도의 절기 데이터를 활용해야 합니다.
 *
 * @param solarYear  양력 연도
 * @param solarMonth 양력 월 (1~12)
 * @returns MonthlyFortune 월운 간지 정보
 */
export function getMonthlyFortuneSolar(solarYear: number, solarMonth: number): MonthlyFortune {
  const fortuneMonth = solarMonthToFortuneMonth(solarMonth);

  // 양력 1월은 전년도 축월(12월)이므로 연도를 조정
  const fortuneYear = solarMonth === 1 ? solarYear - 1 : solarYear;

  return getMonthlyFortune(fortuneYear, fortuneMonth);
}


// =============================================================================
//  5. 일운(日運) 계산 -- 일진(日辰) 간지 산출
// =============================================================================

/**
 * 특정 날짜의 일진(日辰) 간지를 산출합니다.
 *
 * 기준일: 2000년 1월 7일 (양력) = 甲子日 = JD 2451551
 *
 * 일진은 절기와 무관하게 연속으로 60갑자가 순환합니다.
 * 60갑자 인덱스 = (JD - 기준JD) mod 60
 *
 * @param date Date 객체 (양력)
 * @returns DailyFortune 일진 간지 정보
 *
 * @example
 * getDailyFortune(new Date(2000, 0, 7))
 * // => { ganzhiHangul: '갑자', stemElement: 'WOOD', branchElement: 'WATER', ... }
 *
 * getDailyFortune(new Date(2024, 0, 1))
 * // => 2024년 1월 1일의 일진
 */
export function getDailyFortune(date: Date): DailyFortune {
  const jd = dateToJulianDay(date);
  const ganzhiIdx = julianDayToGanzhiIndex(jd);
  const base = buildFortuneGanzhi(ganzhiIdx);

  return {
    ...base,
    date,
    julianDay: jd,
    dayOfWeek: date.getDay(),
  };
}

/**
 * 특정 날짜부터 7일간의 일진 목록을 생성합니다.
 *
 * @param startDate 시작일
 * @returns DailyFortune 배열 (7일분)
 *
 * @example
 * getWeeklyFortunes(new Date(2024, 0, 1))
 * // => [1/1, 1/2, 1/3, 1/4, 1/5, 1/6, 1/7] 의 일진 배열
 */
export function getWeeklyFortunes(startDate: Date): DailyFortune[] {
  const result: DailyFortune[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    result.push(getDailyFortune(d));
  }

  return result;
}


// =============================================================================
//  6. 용신 부합도 계산
// =============================================================================

/**
 * 운의 오행과 용신/희신/기신을 비교하여 부합도 등급(1~5)을 산출합니다.
 *
 * 등급 규칙:
 *   운 오행 = 용신 → 5 (최고)
 *   운 오행 = 희신 → 4 (좋음)
 *   운 오행 = 위 모두 아님 & 기신 아님 → 3 (보통)
 *   운 오행 = 기신을 생함(生) → 2 (주의)
 *   운 오행 = 기신 → 1 (나쁨)
 *
 * 보다 정밀한 5신(용신/희신/한신/구신/기신) 체계는
 * elementMaps.ts의 getYongshinMatchGrade를 사용하세요.
 *
 * @param fortuneElement 운의 오행 (천간 기준)
 * @param yongshin       용신 오행
 * @param heeshin        희신 오행 (선택)
 * @param gishin         기신 오행 (선택)
 * @returns 1~5 등급
 *
 * @example
 * getFortuneGrade('WOOD', 'WOOD')              // => 5 (운=용신)
 * getFortuneGrade('WATER', 'WOOD')             // => 4 (수생목: 희신)
 * getFortuneGrade('METAL', 'WOOD', null, 'METAL') // => 1 (운=기신)
 */
export function getFortuneGrade(
  fortuneElement: ElementCode,
  yongshin: ElementCode,
  heeshin?: ElementCode | null,
  gishin?: ElementCode | null,
): number {
  // 운 오행 = 용신 → 최고 등급
  if (fortuneElement === yongshin) return 5;

  // 희신 체크 (명시적 희신 또는 용신을 생하는 오행)
  const effectiveHeeshin = heeshin ?? null;
  if (effectiveHeeshin && fortuneElement === effectiveHeeshin) return 4;

  // 희신이 명시되지 않은 경우, 용신을 생하는(生) 오행을 희신으로 추정
  if (!effectiveHeeshin) {
    const generatesYongshin = Object.entries(ELEMENT_GENERATES).find(
      ([, target]) => target === yongshin,
    );
    if (generatesYongshin && generatesYongshin[0] === fortuneElement) return 4;
  }

  // 기신 체크
  if (gishin && fortuneElement === gishin) return 1;

  // 기신을 생하는 오행 → 구신 (주의)
  if (gishin) {
    const generatesGishin = Object.entries(ELEMENT_GENERATES).find(
      ([, target]) => target === gishin,
    );
    if (generatesGishin && generatesGishin[0] === fortuneElement) return 2;
  }

  // 나머지 → 보통
  return 3;
}


// =============================================================================
//  7. 운과 원국의 합충형파해 대조
// =============================================================================

/**
 * 지지 육합(六合) 테이블.
 * 두 지지가 결합하여 새로운 오행을 생성합니다.
 *
 * 子丑合化土, 寅亥合化木, 卯戌合化火, 辰酉合化金, 巳申合化水, 午未合化火/土
 */
const YUKHAP_TABLE: readonly {
  readonly a: number;
  readonly b: number;
  readonly result: ElementCode;
}[] = [
  { a: 0,  b: 1,  result: 'EARTH' }, // 子丑合化土
  { a: 2,  b: 11, result: 'WOOD'  }, // 寅亥合化木
  { a: 3,  b: 10, result: 'FIRE'  }, // 卯戌合化火
  { a: 4,  b: 9,  result: 'METAL' }, // 辰酉合化金
  { a: 5,  b: 8,  result: 'WATER' }, // 巳申合化水
  { a: 6,  b: 7,  result: 'FIRE'  }, // 午未合化火(일설 토)
];

/**
 * 지지 삼합(三合) 테이블.
 * 세 지지가 결합하여 하나의 오행 국(局)을 형성합니다.
 *
 * 申子辰=水局, 寅午戌=火局, 巳酉丑=金局, 亥卯未=木局
 */
const SAMHAP_TABLE: readonly {
  readonly branches: readonly [number, number, number];
  readonly result: ElementCode;
}[] = [
  { branches: [8, 0, 4],   result: 'WATER' }, // 申子辰 水局
  { branches: [2, 6, 10],  result: 'FIRE'  }, // 寅午戌 火局
  { branches: [5, 9, 1],   result: 'METAL' }, // 巳酉丑 金局
  { branches: [11, 3, 7],  result: 'WOOD'  }, // 亥卯未 木局
];

/**
 * 지지 방합(方合) 테이블.
 * 같은 방위의 세 지지가 결합합니다.
 *
 * 寅卯辰=東方木, 巳午未=南方火, 申酉戌=西方金, 亥子丑=北方水
 */
const BANGHAP_TABLE: readonly {
  readonly branches: readonly [number, number, number];
  readonly result: ElementCode;
}[] = [
  { branches: [2, 3, 4],   result: 'WOOD'  }, // 寅卯辰 東方木
  { branches: [5, 6, 7],   result: 'FIRE'  }, // 巳午未 南方火
  { branches: [8, 9, 10],  result: 'METAL' }, // 申酉戌 西方金
  { branches: [11, 0, 1],  result: 'WATER' }, // 亥子丑 北方水
];

/**
 * 지지 충(冲) 테이블.
 * 정반대 방위의 두 지지가 충돌합니다.
 *
 * 子午冲, 丑未冲, 寅申冲, 卯酉冲, 辰戌冲, 巳亥冲
 */
const CHUNG_TABLE: readonly [number, number][] = [
  [0, 6],   // 子午冲
  [1, 7],   // 丑未冲
  [2, 8],   // 寅申冲
  [3, 9],   // 卯酉冲
  [4, 10],  // 辰戌冲
  [5, 11],  // 巳亥冲
];

/**
 * 지지 형(刑) 테이블.
 *
 * 삼형: 寅巳申(무은지형), 丑戌未(지세지형)
 * 자형: 辰辰, 午午, 酉酉, 亥亥
 * 상형: 子卯
 */
const HYEONG_TABLE: readonly {
  readonly branches: readonly number[];
  readonly name: string;
}[] = [
  { branches: [2, 5, 8],  name: '무은지형(無恩之刑)' },     // 寅巳申
  { branches: [1, 10, 7], name: '지세지형(恃勢之刑)' },     // 丑戌未
  { branches: [0, 3],     name: '무례지형(無禮之刑)' },     // 子卯
  { branches: [4, 4],     name: '자형(自刑)' },            // 辰辰
  { branches: [6, 6],     name: '자형(自刑)' },            // 午午
  { branches: [9, 9],     name: '자형(自刑)' },            // 酉酉
  { branches: [11, 11],   name: '자형(自刑)' },            // 亥亥
];

/**
 * 지지 파(破) 테이블.
 *
 * 子酉破, 丑辰破, 寅亥破, 卯午破, 巳申破, 未戌破
 */
const PA_TABLE: readonly [number, number][] = [
  [0, 9],   // 子酉破
  [1, 4],   // 丑辰破
  [2, 11],  // 寅亥破
  [3, 6],   // 卯午破
  [5, 8],   // 巳申破
  [7, 10],  // 未戌破
];

/**
 * 지지 해(害) 테이블.
 * 육합을 방해하는 충 관계에서 파생됩니다.
 *
 * 子未害, 丑午害, 寅巳害, 卯辰害, 申亥害, 酉戌害
 */
const HAE_TABLE: readonly [number, number][] = [
  [0, 7],   // 子未害
  [1, 6],   // 丑午害
  [2, 5],   // 寅巳害
  [3, 4],   // 卯辰害
  [8, 11],  // 申亥害
  [9, 10],  // 酉戌害
];

/**
 * 지지 원진(怨嗔) 테이블.
 * 상극적이면서 미묘한 불화를 일으키는 관계.
 *
 * 子未, 丑午, 寅酉, 卯申, 辰亥, 巳戌
 * (일부 학파에서는 해와 동일하거나 다르게 정의하기도 함)
 */
const WONJIN_TABLE: readonly [number, number][] = [
  [0, 7],   // 子未
  [1, 6],   // 丑午
  [2, 9],   // 寅酉
  [3, 8],   // 卯申
  [4, 11],  // 辰亥
  [5, 10],  // 巳戌
];

/**
 * 운의 지지와 원국 4지지의 합충형파해를 대조합니다.
 *
 * 운(세운/월운/일운)의 지지가 원국의 연/월/일/시 지지와
 * 어떤 관계(육합/삼합/방합/충/형/파/해/원진)를 형성하는지 분석합니다.
 *
 * @param fortuneBranch   운의 지지 코드 (예: 'JA', 'IN', ...)
 * @param natalBranches   원국 4지지 코드 배열 (연/월/일/시 순서)
 * @returns FortuneRelation 배열 (발견된 모든 관계)
 *
 * @example
 * checkFortuneRelations('O', ['JA', 'IN', 'SA', 'HAE'])
 * // => [
 * //   { type: 'CHUNG', branches: ['O', 'JA'], description: '충(冲): 오(午)↔자(子)' },
 * //   { type: 'SAMHAP', branches: ['IN', 'O'], description: '삼합(三合) 부분: 인(寅)↔오(午)' },
 * //   ...
 * // ]
 */
export function checkFortuneRelations(
  fortuneBranch: BranchCode,
  natalBranches: BranchCode[],
): FortuneRelation[] {
  const results: FortuneRelation[] = [];

  // 운의 지지 인덱스
  const fortuneInfo = BRANCH_BY_CODE[fortuneBranch];
  if (!fortuneInfo) return results;
  const fIdx = fortuneInfo.index;

  // 원국 지지 인덱스 배열
  const natalIndices: { index: number; code: BranchCode; info: BranchInfo }[] = [];
  for (const code of natalBranches) {
    const info = BRANCH_BY_CODE[code];
    if (info) {
      natalIndices.push({ index: info.index, code, info });
    }
  }

  // 헬퍼: 지지 인덱스 → 한글 표기
  const bName = (idx: number): string => BRANCHES[idx]?.hangul ?? '?';

  // -- 1. 육합(六合) 체크 --
  for (const hap of YUKHAP_TABLE) {
    for (const natal of natalIndices) {
      if ((fIdx === hap.a && natal.index === hap.b) ||
          (fIdx === hap.b && natal.index === hap.a)) {
        results.push({
          type: 'YUKHAP',
          branches: [fortuneBranch, natal.code],
          description: `육합(六合): ${bName(fIdx)}(${fortuneInfo.hanja})↔${bName(natal.index)}(${natal.info.hanja}) → ${ELEMENT_KOREAN_SHORT[hap.result]}(${ELEMENT_HANJA[hap.result]})`,
          tone: 'positive',
          resultElement: hap.result,
        });
      }
    }
  }

  // -- 2. 삼합(三合) 부분 체크 --
  // 운의 지지 + 원국 1~2개 지지로 삼합 부분 또는 전체 성립 여부
  for (const samhap of SAMHAP_TABLE) {
    const [a, b, c] = samhap.branches;
    const inFortune = fIdx === a || fIdx === b || fIdx === c;

    if (!inFortune) continue;

    // 원국에서 삼합 구성원 찾기
    const matchingNatal = natalIndices.filter(
      n => (n.index === a || n.index === b || n.index === c) && n.index !== fIdx,
    );

    if (matchingNatal.length >= 1) {
      const allMembers = [fIdx, ...matchingNatal.map(n => n.index)];
      const isFull = [a, b, c].every(x => allMembers.includes(x));
      const branchCodes: BranchCode[] = [fortuneBranch, ...matchingNatal.map(n => n.code)];

      const memberNames = allMembers.map(i => `${bName(i)}(${BRANCHES[i]?.hanja})`).join('·');
      const desc = isFull
        ? `삼합(三合) 완성: ${memberNames} → ${ELEMENT_KOREAN_SHORT[samhap.result]}(${ELEMENT_HANJA[samhap.result]})국`
        : `삼합(三合) 부분: ${memberNames} (${ELEMENT_KOREAN_SHORT[samhap.result]}국 지향)`;

      results.push({
        type: 'SAMHAP',
        branches: branchCodes,
        description: desc,
        tone: 'positive',
        resultElement: samhap.result,
      });
    }
  }

  // -- 3. 방합(方合) 부분 체크 --
  for (const banghap of BANGHAP_TABLE) {
    const [a, b, c] = banghap.branches;
    const inFortune = fIdx === a || fIdx === b || fIdx === c;

    if (!inFortune) continue;

    const matchingNatal = natalIndices.filter(
      n => (n.index === a || n.index === b || n.index === c) && n.index !== fIdx,
    );

    if (matchingNatal.length >= 1) {
      const allMembers = [fIdx, ...matchingNatal.map(n => n.index)];
      const isFull = [a, b, c].every(x => allMembers.includes(x));
      const branchCodes: BranchCode[] = [fortuneBranch, ...matchingNatal.map(n => n.code)];

      const memberNames = allMembers.map(i => `${bName(i)}(${BRANCHES[i]?.hanja})`).join('·');
      const desc = isFull
        ? `방합(方合) 완성: ${memberNames} → ${ELEMENT_KOREAN_SHORT[banghap.result]}(${ELEMENT_HANJA[banghap.result]})`
        : `방합(方合) 부분: ${memberNames} (${ELEMENT_KOREAN_SHORT[banghap.result]} 지향)`;

      results.push({
        type: 'BANGHAP',
        branches: branchCodes,
        description: desc,
        tone: 'positive',
        resultElement: banghap.result,
      });
    }
  }

  // -- 4. 충(冲) 체크 --
  for (const [a, b] of CHUNG_TABLE) {
    for (const natal of natalIndices) {
      if ((fIdx === a && natal.index === b) || (fIdx === b && natal.index === a)) {
        results.push({
          type: 'CHUNG',
          branches: [fortuneBranch, natal.code],
          description: `충(冲): ${bName(fIdx)}(${fortuneInfo.hanja})↔${bName(natal.index)}(${natal.info.hanja})`,
          tone: 'negative',
        });
      }
    }
  }

  // -- 5. 형(刑) 체크 --
  for (const hyeong of HYEONG_TABLE) {
    const members = hyeong.branches;

    // 자형(自刑) 특수 처리: 같은 지지끼리
    if (members.length === 2 && members[0] === members[1]) {
      if (fIdx === members[0]) {
        for (const natal of natalIndices) {
          if (natal.index === fIdx) {
            results.push({
              type: 'HYEONG',
              branches: [fortuneBranch, natal.code],
              description: `${hyeong.name}: ${bName(fIdx)}(${fortuneInfo.hanja})↔${bName(natal.index)}(${natal.info.hanja})`,
              tone: 'negative',
            });
          }
        }
      }
      continue;
    }

    // 일반 형: 운의 지지가 형 구성원이고, 원국에도 구성원이 있는 경우
    const inFortune = members.includes(fIdx);
    if (!inFortune) continue;

    for (const natal of natalIndices) {
      if (members.includes(natal.index) && natal.index !== fIdx) {
        results.push({
          type: 'HYEONG',
          branches: [fortuneBranch, natal.code],
          description: `${hyeong.name}: ${bName(fIdx)}(${fortuneInfo.hanja})↔${bName(natal.index)}(${natal.info.hanja})`,
          tone: 'negative',
        });
      }
    }
  }

  // -- 6. 파(破) 체크 --
  for (const [a, b] of PA_TABLE) {
    for (const natal of natalIndices) {
      if ((fIdx === a && natal.index === b) || (fIdx === b && natal.index === a)) {
        results.push({
          type: 'PA',
          branches: [fortuneBranch, natal.code],
          description: `파(破): ${bName(fIdx)}(${fortuneInfo.hanja})↔${bName(natal.index)}(${natal.info.hanja})`,
          tone: 'negative',
        });
      }
    }
  }

  // -- 7. 해(害) 체크 --
  for (const [a, b] of HAE_TABLE) {
    for (const natal of natalIndices) {
      if ((fIdx === a && natal.index === b) || (fIdx === b && natal.index === a)) {
        results.push({
          type: 'HAE',
          branches: [fortuneBranch, natal.code],
          description: `해(害): ${bName(fIdx)}(${fortuneInfo.hanja})↔${bName(natal.index)}(${natal.info.hanja})`,
          tone: 'negative',
        });
      }
    }
  }

  // -- 8. 원진(怨嗔) 체크 --
  for (const [a, b] of WONJIN_TABLE) {
    for (const natal of natalIndices) {
      if ((fIdx === a && natal.index === b) || (fIdx === b && natal.index === a)) {
        results.push({
          type: 'WONJIN',
          branches: [fortuneBranch, natal.code],
          description: `원진(怨嗔): ${bName(fIdx)}(${fortuneInfo.hanja})↔${bName(natal.index)}(${natal.info.hanja})`,
          tone: 'negative',
        });
      }
    }
  }

  return results;
}
