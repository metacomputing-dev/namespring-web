/**
 * fortuneCalculator.ts -- 세운/월운/일운/시운 간지 계산 엔진
 *
 * 사주명리학의 만세력(萬歲曆) 산출 핵심 모듈.
 * 수학적으로 정확한 60갑자 순환 계산을 제공합니다.
 *
 * 사용 공식:
 *   - 세운 (연간지):  (서기년 - 4) mod 60
 *   - 월 천간 (오호기법): ((yearStemIdx % 5) * 2 + 2 + monthIdx) % 10
 *   - 월 지지:       인(寅)=1월 ~ 축(丑)=12월 고정
 *   - 일진 (일간지):  줄리안 데이 기반, 기준일 2000-01-07 = 甲子 (JD 2451551)
 *   - 시 천간 (오자기법): ((dayStemIdx % 5) * 2 + branchIdx) % 10
 *   - 시 지지:       자(子)=23~01시 ~ 해(亥)=21~23시 고정
 *
 * 참고:
 *   - https://en.wikipedia.org/wiki/Sexagenary_cycle
 *   - https://quasar.as.utexas.edu/BillInfo/JulianDatesG.html
 *   - 오호기법(五虎遁法), 오자기법(五鼠遁法) 전통 산출법
 */

import type { ElementCode, StemCode, BranchCode } from '../types.js';

import {
  GANZHI_60,
  yearToGanzhiIndex,
  julianDayToGanzhiIndex,
  STEMS,
  BRANCHES,
  BRANCH_BY_CODE,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_HANJA,
  ELEMENT_GENERATES,
} from './elementMaps.js';

import type { StemInfo, BranchInfo } from './elementMaps.js';


// =============================================================================
//  공통 타입 정의
// =============================================================================

/** 간지 운세 정보 (세운/월운/일운/시운 공통) */
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
export interface MonthlyFortune extends FortuneGanzhi {
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

/** 시운(時運) 정보 */
export interface HourlyFortune extends FortuneGanzhi {
  /** 시진 이름 (자시, 축시, ...) */
  readonly timeName: string;
  /** 시간 범위 문자열 */
  readonly timeRange: string;
  /** 시작 시각 (0~23) */
  readonly startHour: number;
  /** 종료 시각 (1~24, 25는 다음날 01시) */
  readonly endHour: number;
}

/** 용신 부합도 등급 결과 */
export interface FortuneGradeResult {
  /** 부합도 등급 (1~5) */
  readonly grade: number;
  /** 등급 설명 */
  readonly description: string;
  /** 별표 표시 */
  readonly stars: string;
}

/** 운의 합충 관계 정보 */
export interface FortuneRelation {
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

/** 합충형파해 관계 유형 */
export type FortuneRelationType =
  | 'YUKHAP'     // 육합
  | 'SAMHAP'     // 삼합
  | 'BANGHAP'    // 방합
  | 'CHUNG'      // 충
  | 'HYEONG'     // 형
  | 'PA'         // 파
  | 'HAE'        // 해
  | 'WONJIN';    // 원진


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
export function toJulianDay(year: number, month: number, day: number): number {
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
export function dateToJulianDay(date: Date): number {
  return toJulianDay(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
}

/**
 * 줄리안 데이 넘버를 그레고리력 날짜로 역변환합니다.
 *
 * @param jd 줄리안 데이 넘버
 * @returns { year, month, day } 그레고리력 날짜
 */
export function julianDayToGregorian(jd: number): { year: number; month: number; day: number } {
  const z = jd;
  const w = Math.floor((z - 1867216.25) / 36524.25);
  const x = Math.floor(w / 4);
  const a = z + 1 + w - x;
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;

  return { year, month, day };
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
 * 수학적으로: 10과 12의 중국나머지정리(CRT) 적용
 *   ganzhiIndex = stemIndex + 10 * k  (단, ganzhiIndex % 12 === branchIndex)
 *
 * 간편 공식: 아래 루프로 60개 중에서 매칭
 *
 * @param stemIndex   천간 인덱스 (0~9)
 * @param branchIndex 지지 인덱스 (0~11)
 * @returns 60갑자 인덱스 (0~59), 유효하지 않은 조합이면 -1
 */
export function stemBranchToGanzhiIndex(stemIndex: number, branchIndex: number): number {
  // 음양이 맞지 않으면 (홀짝이 다르면) 유효하지 않은 조합
  if ((stemIndex % 2) !== (branchIndex % 2)) {
    return -1;
  }

  // CRT 기반 직접 계산:
  // ganzhiIndex 는 stemIndex (mod 10) 이고 branchIndex (mod 12) 를 동시에 만족해야 한다.
  // 해: ganzhiIndex = (stemIndex * 6 + branchIndex * (-5)) mod 60
  //   = (6 * stemIndex - 5 * branchIndex) mod 60
  // 검증: (6s - 5b) mod 10 = 6s mod 10 - 5b mod 10 = 6s mod 10 (∵ b even↔s even)
  //        실제로는 다른 방식이 안전하므로 테이블 방식으로 한다.
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

/**
 * 현재 연도를 기준으로 과거 N년 ~ 미래 N년의 세운 목록을 생성합니다.
 *
 * @param currentYear 기준 연도
 * @param before      과거 몇 년 (기본 5)
 * @param after       미래 몇 년 (기본 5)
 * @returns YearlyFortune 배열 (시간순 정렬)
 *
 * @example
 * getYearlyFortuneRange(2024, 3, 3)
 * // => [2021, 2022, 2023, 2024, 2025, 2026, 2027] 의 세운 배열
 */
export function getYearlyFortuneRange(
  currentYear: number,
  before: number = 5,
  after: number = 5,
): YearlyFortune[] {
  const result: YearlyFortune[] = [];
  const startYear = currentYear - Math.abs(before);
  const endYear = currentYear + Math.abs(after);

  for (let y = startYear; y <= endYear; y++) {
    result.push(getYearlyFortune(y));
  }

  return result;
}


// =============================================================================
//  4. 월운(月運) 계산 -- 월간지 산출
// =============================================================================

/**
 * 절기 기준 월(月) 인덱스 매핑.
 *
 * 사주명리학에서 월은 절기 기준이며, 인월(寅月)이 1월입니다.
 * 지지 배열에서의 인덱스 매핑:
 *   1월(인) = BRANCHES[2]  (index 2)
 *   2월(묘) = BRANCHES[3]  (index 3)
 *   ...
 *   11월(자) = BRANCHES[0] (index 0)
 *   12월(축) = BRANCHES[1] (index 1)
 *
 * 공식: branchIndex = (month + 1) % 12
 *   - month=1 → (1+1)%12 = 2 (인)
 *   - month=2 → (2+1)%12 = 3 (묘)
 *   - month=11 → (11+1)%12 = 0 (자)
 *   - month=12 → (12+1)%12 = 1 (축)
 */
function monthToBranchIndex(month: number): number {
  // month: 1~12 (절기 기준 인월=1)
  return (month + 1) % 12;
}

/**
 * 월 천간 산출 — 오호기법(五虎遁法)
 *
 * 연 천간에 따라 1월(인월)의 천간이 결정되는 규칙:
 *   甲(0)/己(5)년 → 1월 천간 = 丙(2)  — 병인월
 *   乙(1)/庚(6)년 → 1월 천간 = 戊(4)  — 무인월
 *   丙(2)/辛(7)년 → 1월 천간 = 庚(6)  — 경인월
 *   丁(3)/壬(8)년 → 1월 천간 = 壬(8)  — 임인월
 *   戊(4)/癸(9)년 → 1월 천간 = 甲(0)  — 갑인월
 *
 * 일반화 공식:
 *   monthStemIdx = ((yearStemIdx % 5) * 2 + 2 + monthIdx) % 10
 *
 *   여기서 monthIdx = month - 1 (0-based: 인월=0, 묘월=1, ..., 축월=11)
 *
 * 검증:
 *   갑(0)년 1월: ((0%5)*2 + 2 + 0) % 10 = 2 → 丙(병) --- 맞음
 *   을(1)년 1월: ((1%5)*2 + 2 + 0) % 10 = 4 → 戊(무) --- 맞음
 *   병(2)년 1월: ((2%5)*2 + 2 + 0) % 10 = 6 → 庚(경) --- 맞음
 *   정(3)년 1월: ((3%5)*2 + 2 + 0) % 10 = 8 → 壬(임) --- 맞음
 *   무(4)년 1월: ((4%5)*2 + 2 + 0) % 10 = 0 → 甲(갑) --- 맞음
 *   갑(0)년 2월: ((0%5)*2 + 2 + 1) % 10 = 3 → 丁(정) --- 맞음 (정묘월)
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
 * 절기 기준:
 *   1월(인) ≈ 양력 2월 (입춘~경칩)
 *   2월(묘) ≈ 양력 3월 (경칩~청명)
 *   ...
 *   12월(축) ≈ 양력 1월 (소한~입춘)
 *
 * @param month 절기 기준 월 (1~12)
 * @returns 양력 대략적 월 (1~12)
 */
function monthToSolarApprox(month: number): number {
  // 인월(1) ≈ 양력 2월, 묘월(2) ≈ 양력 3월, ..., 축월(12) ≈ 양력 1월
  return month === 12 ? 1 : month + 1;
}

/**
 * 양력 월에서 절기 기준 월로 변환합니다 (근사치).
 *
 * 정확한 변환은 절기 시각 테이블이 필요하지만,
 * 일반적으로 양력 N월의 절기 입절일(5~7일경) 이후를 해당 절기월로 봅니다.
 *
 * 근사 규칙: 양력 2월 → 인월(1), 양력 3월 → 묘월(2), ..., 양력 1월 → 축월(12)
 *
 * @param solarMonth 양력 월 (1~12)
 * @returns 절기 기준 월 (1~12)
 */
export function solarMonthToFortuneMonth(solarMonth: number): number {
  // 양력 1월 → 축월(12), 양력 2월 → 인월(1), ..., 양력 12월 → 해월(11)
  return solarMonth === 1 ? 12 : solarMonth - 1;
}

/**
 * 특정 연월의 월운(月運) 간지를 산출합니다.
 *
 * @param year  서기 연도 (세운 기준)
 * @param month 절기 기준 월 (1~12, 인월=1)
 * @returns MonthlyFortune 월운 간지 정보
 *
 * @example
 * getMonthlyFortune(2024, 1)
 * // => { year: 2024, month: 1, ganzhiHangul: '병인', ... }
 * //    2024년=갑진년, 1월=인월, 갑(0)년이므로 monthStem = 병(2)
 *
 * getMonthlyFortune(2024, 3)
 * // => { year: 2024, month: 3, ganzhiHangul: '무진', ... }
 * //    갑(0)년 3월: ((0%5)*2 + 2 + 2) % 10 = 4 → 무(戊), 지지=진(辰)
 */
export function getMonthlyFortune(year: number, month: number): MonthlyFortune {
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
 * 특정 연도의 12개월 간지 캘린더를 생성합니다.
 *
 * @param year 서기 연도
 * @returns MonthlyFortune 배열 (1월~12월, 절기 기준)
 *
 * @example
 * getMonthlyCalendar(2024)
 * // => [
 * //   { month: 1, ganzhiHangul: '병인', ... },  // 인월
 * //   { month: 2, ganzhiHangul: '정묘', ... },  // 묘월
 * //   ...
 * //   { month: 12, ganzhiHangul: '정축', ... }, // 축월
 * // ]
 */
export function getMonthlyCalendar(year: number): MonthlyFortune[] {
  const result: MonthlyFortune[] = [];
  for (let m = 1; m <= 12; m++) {
    result.push(getMonthlyFortune(year, m));
  }
  return result;
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
 * 연/월/일 정수값으로 일진 간지를 산출합니다.
 *
 * @param year  서기 연도
 * @param month 양력 월 (1~12)
 * @param day   양력 일 (1~31)
 * @returns DailyFortune 일진 간지 정보
 */
export function getDailyFortuneByDate(year: number, month: number, day: number): DailyFortune {
  const date = new Date(year, month - 1, day);
  return getDailyFortune(date);
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

/**
 * 특정 날짜부터 N일간의 일진 목록을 생성합니다.
 *
 * @param startDate 시작일
 * @param days      일수 (기본 7)
 * @returns DailyFortune 배열
 */
export function getDailyFortuneRange(startDate: Date, days: number = 7): DailyFortune[] {
  const result: DailyFortune[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    result.push(getDailyFortune(d));
  }

  return result;
}


// =============================================================================
//  6. 시운(時運) 계산 -- 시진(時辰) 간지 산출
// =============================================================================

/**
 * 12시진 지지 매핑 테이블.
 *
 * 시진은 하루를 12등분하여 각 구간에 지지를 배정합니다.
 * 자시(子時) 23:00~01:00 부터 해시(亥時) 21:00~23:00 까지.
 */
const TIME_BRANCHES: readonly {
  readonly branchIndex: number;
  readonly name: string;
  readonly timeRange: string;
  readonly startHour: number;
  readonly endHour: number;
}[] = [
  { branchIndex: 0,  name: '자시(子時)', timeRange: '23:00~01:00', startHour: 23, endHour: 1  },
  { branchIndex: 1,  name: '축시(丑時)', timeRange: '01:00~03:00', startHour: 1,  endHour: 3  },
  { branchIndex: 2,  name: '인시(寅時)', timeRange: '03:00~05:00', startHour: 3,  endHour: 5  },
  { branchIndex: 3,  name: '묘시(卯時)', timeRange: '05:00~07:00', startHour: 5,  endHour: 7  },
  { branchIndex: 4,  name: '진시(辰時)', timeRange: '07:00~09:00', startHour: 7,  endHour: 9  },
  { branchIndex: 5,  name: '사시(巳時)', timeRange: '09:00~11:00', startHour: 9,  endHour: 11 },
  { branchIndex: 6,  name: '오시(午時)', timeRange: '11:00~13:00', startHour: 11, endHour: 13 },
  { branchIndex: 7,  name: '미시(未時)', timeRange: '13:00~15:00', startHour: 13, endHour: 15 },
  { branchIndex: 8,  name: '신시(申時)', timeRange: '15:00~17:00', startHour: 15, endHour: 17 },
  { branchIndex: 9,  name: '유시(酉時)', timeRange: '17:00~19:00', startHour: 17, endHour: 19 },
  { branchIndex: 10, name: '술시(戌時)', timeRange: '19:00~21:00', startHour: 19, endHour: 21 },
  { branchIndex: 11, name: '해시(亥時)', timeRange: '21:00~23:00', startHour: 21, endHour: 23 },
];

/**
 * 시각(0~23)을 시진 지지 인덱스(0~11)로 변환합니다.
 *
 * 매핑:
 *   23:00~00:59 → 자시(子) = 0
 *   01:00~02:59 → 축시(丑) = 1
 *   03:00~04:59 → 인시(寅) = 2
 *   ...
 *   21:00~22:59 → 해시(亥) = 11
 *
 * @param hour 시각 (0~23)
 * @returns 시진 지지 인덱스 (0~11)
 */
export function hourToBranchIndex(hour: number): number {
  // 23시와 0시는 모두 자시(0)
  // 1~2시 → 축시(1), 3~4시 → 인시(2), ...
  const h = ((hour % 24) + 24) % 24;
  if (h === 23) return 0;             // 23시: 자시
  return Math.floor((h + 1) / 2);     // 0시→0, 1시→1, 2시→1, 3시→2, ...
}

/**
 * 시 천간 산출 — 오자기법(五鼠遁法)
 *
 * 일간에 따라 자시(子時)의 천간이 결정되는 규칙:
 *   甲(0)/己(5)일 → 자시 천간 = 甲(0)  — 갑자시
 *   乙(1)/庚(6)일 → 자시 천간 = 丙(2)  — 병자시
 *   丙(2)/辛(7)일 → 자시 천간 = 戊(4)  — 무자시
 *   丁(3)/壬(8)일 → 자시 천간 = 庚(6)  — 경자시
 *   戊(4)/癸(9)일 → 자시 천간 = 壬(8)  — 임자시
 *
 * 일반화 공식:
 *   hourStemIdx = ((dayStemIdx % 5) * 2 + branchIdx) % 10
 *
 * 검증:
 *   갑(0)일 자시(0): ((0%5)*2 + 0) % 10 = 0 → 甲(갑) --- 맞음
 *   을(1)일 자시(0): ((1%5)*2 + 0) % 10 = 2 → 丙(병) --- 맞음
 *   병(2)일 자시(0): ((2%5)*2 + 0) % 10 = 4 → 戊(무) --- 맞음
 *   정(3)일 자시(0): ((3%5)*2 + 0) % 10 = 6 → 庚(경) --- 맞음
 *   무(4)일 자시(0): ((4%5)*2 + 0) % 10 = 8 → 壬(임) --- 맞음
 *   갑(0)일 인시(2): ((0%5)*2 + 2) % 10 = 2 → 丙(병) --- 맞음 (병인시)
 *   갑(0)일 오시(6): ((0%5)*2 + 6) % 10 = 6 → 庚(경) --- 맞음 (경오시)
 *
 * @param dayStemIndex  일간(日干) 천간 인덱스 (0~9)
 * @param branchIndex   시진 지지 인덱스 (0~11)
 * @returns 시 천간 인덱스 (0~9)
 */
function hourStemIndex(dayStemIndex: number, branchIndex: number): number {
  return ((dayStemIndex % 5) * 2 + branchIndex) % 10;
}

/**
 * 특정 일진의 특정 시각에 대한 시운(時運) 간지를 산출합니다.
 *
 * @param dayStemIndex 일간(日干) 천간 인덱스 (0~9)
 * @param hour         시각 (0~23)
 * @returns HourlyFortune 시운 간지 정보
 *
 * @example
 * getHourlyFortune(0, 23)
 * // => { ganzhiHangul: '갑자', timeName: '자시(子時)', ... }
 * //    갑일 자시: hourStem = ((0%5)*2 + 0) % 10 = 0 → 갑(甲)
 *
 * getHourlyFortune(0, 5)
 * // => { ganzhiHangul: '정묘', timeName: '묘시(卯時)', ... }
 * //    갑일 묘시: hourStem = ((0%5)*2 + 3) % 10 = 3 → 정(丁), 지지=묘(3)
 */
export function getHourlyFortune(dayStemIndex: number, hour: number): HourlyFortune {
  const branchIdx = hourToBranchIndex(hour);
  const hStemIdx = hourStemIndex(dayStemIndex, branchIdx);

  const ganzhiIdx = stemBranchToGanzhiIndex(hStemIdx, branchIdx);
  const base = buildFortuneGanzhi(ganzhiIdx >= 0 ? ganzhiIdx : 0);

  const timeBranch = TIME_BRANCHES[branchIdx];

  return {
    ...base,
    timeName: timeBranch.name,
    timeRange: timeBranch.timeRange,
    startHour: timeBranch.startHour,
    endHour: timeBranch.endHour,
  };
}

/**
 * 특정 일진의 12시진 전체 간지를 산출합니다.
 *
 * @param dayStemIndex 일간(日干) 천간 인덱스 (0~9)
 * @returns HourlyFortune 배열 (12시진, 자시~해시)
 *
 * @example
 * getHourlyCalendar(0)
 * // => [갑자, 을축, 병인, 정묘, 무진, 기사, 경오, 신미, 임신, 계유, 갑술, 을해]
 * //    (갑일의 12시진)
 */
export function getHourlyCalendar(dayStemIndex: number): HourlyFortune[] {
  const result: HourlyFortune[] = [];

  for (let i = 0; i < 12; i++) {
    const timeBranch = TIME_BRANCHES[i];
    const hStemIdx = hourStemIndex(dayStemIndex, i);
    const ganzhiIdx = stemBranchToGanzhiIndex(hStemIdx, i);
    const base = buildFortuneGanzhi(ganzhiIdx >= 0 ? ganzhiIdx : 0);

    result.push({
      ...base,
      timeName: timeBranch.name,
      timeRange: timeBranch.timeRange,
      startHour: timeBranch.startHour,
      endHour: timeBranch.endHour,
    });
  }

  return result;
}

/**
 * Date 객체에서 바로 시운을 산출하는 편의 함수.
 *
 * @param date Date 객체
 * @returns HourlyFortune 시운 간지 정보
 */
export function getHourlyFortuneFromDate(date: Date): HourlyFortune {
  const daily = getDailyFortune(date);
  return getHourlyFortune(daily.stemIndex, date.getHours());
}


// =============================================================================
//  7. 용신 부합도 계산
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

/**
 * FortuneGradeResult 전체 객체를 반환하는 확장 버전.
 *
 * @param fortuneElement 운의 오행
 * @param yongshin       용신 오행
 * @param heeshin        희신 오행 (선택)
 * @param gishin         기신 오행 (선택)
 * @returns FortuneGradeResult 등급 + 설명 + 별표
 */
export function getFortuneGradeDetailed(
  fortuneElement: ElementCode,
  yongshin: ElementCode,
  heeshin?: ElementCode | null,
  gishin?: ElementCode | null,
): FortuneGradeResult {
  const grade = getFortuneGrade(fortuneElement, yongshin, heeshin, gishin);

  const DESCRIPTIONS: Record<number, string> = {
    5: '최고로 좋은 기운',
    4: '아주 좋은 기운',
    3: '보통 수준의 기운',
    2: '다소 주의가 필요한 기운',
    1: '조심해야 할 기운',
  };

  const STARS: Record<number, string> = {
    5: '★★★★★',
    4: '★★★★☆',
    3: '★★★☆☆',
    2: '★★☆☆☆',
    1: '★☆☆☆☆',
  };

  return {
    grade,
    description: DESCRIPTIONS[grade] ?? '보통 수준의 기운',
    stars: STARS[grade] ?? '★★★☆☆',
  };
}


// =============================================================================
//  8. 운과 원국의 합충형파해 대조
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
 * 한국어 관계 유형명 매핑
 */
const RELATION_TYPE_NAMES: Record<FortuneRelationType, string> = {
  YUKHAP:  '육합(六合)',
  SAMHAP:  '삼합(三合)',
  BANGHAP: '방합(方合)',
  CHUNG:   '충(冲)',
  HYEONG:  '형(刑)',
  PA:      '파(破)',
  HAE:     '해(害)',
  WONJIN:  '원진(怨嗔)',
};

/**
 * 관계 유형별 톤 매핑
 */
const RELATION_TYPE_TONE: Record<FortuneRelationType, 'positive' | 'negative' | 'neutral'> = {
  YUKHAP:  'positive',
  SAMHAP:  'positive',
  BANGHAP: 'positive',
  CHUNG:   'negative',
  HYEONG:  'negative',
  PA:      'negative',
  HAE:     'negative',
  WONJIN:  'negative',
};

/**
 * 운의 지지와 원국 4지지의 합충형파해를 대조합니다.
 *
 * 운(세운/월운/일운/시운)의 지지가 원국의 연/월/일/시 지지와
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

  // ── 1. 육합(六合) 체크 ──
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

  // ── 2. 삼합(三合) 부분 체크 ──
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

  // ── 3. 방합(方合) 부분 체크 ──
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

  // ── 4. 충(冲) 체크 ──
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

  // ── 5. 형(刑) 체크 ──
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

  // ── 6. 파(破) 체크 ──
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

  // ── 7. 해(害) 체크 ──
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

  // ── 8. 원진(怨嗔) 체크 ──
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


// =============================================================================
//  9. 종합 운세 산출 (한 날짜의 세운+월운+일운+시운 전체)
// =============================================================================

/** 종합 운세 정보 */
export interface ComprehensiveFortune {
  /** 세운 (연운) */
  readonly yearly: YearlyFortune;
  /** 월운 */
  readonly monthly: MonthlyFortune;
  /** 일운 */
  readonly daily: DailyFortune;
  /** 시운 (hour가 제공된 경우) */
  readonly hourly: HourlyFortune | null;
}

/**
 * 특정 시점의 세운+월운+일운+시운을 한번에 산출합니다.
 *
 * @param date Date 객체
 * @param hour 시각 (0~23, 선택)
 * @returns ComprehensiveFortune 종합 운세 정보
 *
 * @example
 * getComprehensiveFortune(new Date(2024, 2, 15), 14)
 * // => {
 * //   yearly: { ganzhiHangul: '갑진', ... },
 * //   monthly: { ganzhiHangul: '정묘', ... },  // 2024년 양력 3월 ≈ 묘월
 * //   daily: { ganzhiHangul: '...', ... },
 * //   hourly: { ganzhiHangul: '...', timeName: '미시', ... },
 * // }
 */
export function getComprehensiveFortune(date: Date, hour?: number): ComprehensiveFortune {
  // 양력 연도/월
  const solarYear = date.getFullYear();
  const solarMonth = date.getMonth() + 1;

  // 세운: 양력 연도 기준 (절기 기준 정밀 판단은 생략, 근사)
  const yearly = getYearlyFortune(solarYear);

  // 월운: 양력→절기 근사 변환
  const monthly = getMonthlyFortuneSolar(solarYear, solarMonth);

  // 일운
  const daily = getDailyFortune(date);

  // 시운
  const effectiveHour = hour ?? date.getHours();
  const hourly = effectiveHour != null
    ? getHourlyFortune(daily.stemIndex, effectiveHour)
    : null;

  return { yearly, monthly, daily, hourly };
}


// =============================================================================
//  10. 운세 포맷팅 유틸리티
// =============================================================================

/**
 * FortuneGanzhi를 한 줄 문자열로 포맷팅합니다.
 *
 * @param fortune FortuneGanzhi 객체
 * @returns 예: "갑자(甲子) — 목(木)/수(水)"
 */
export function formatFortuneGanzhi(fortune: FortuneGanzhi): string {
  const stemEl = ELEMENT_KOREAN_SHORT[fortune.stemElement] ?? '?';
  const branchEl = ELEMENT_KOREAN_SHORT[fortune.branchElement] ?? '?';
  const stemHanja = ELEMENT_HANJA[fortune.stemElement] ?? '?';
  const branchHanja = ELEMENT_HANJA[fortune.branchElement] ?? '?';

  return `${fortune.ganzhiHangul}(${fortune.ganzhiHanja}) — ${stemEl}(${stemHanja})/${branchEl}(${branchHanja})`;
}

/**
 * 요일을 한국어로 변환합니다.
 *
 * @param dayOfWeek 요일 인덱스 (0=일, 1=월, ..., 6=토)
 * @returns 한국어 요일명
 */
export function dayOfWeekKorean(dayOfWeek: number): string {
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  return DAYS[dayOfWeek % 7] + '요일';
}

/**
 * DailyFortune을 한 줄 문자열로 포맷팅합니다.
 *
 * @param fortune DailyFortune 객체
 * @returns 예: "2024.01.01(월) 갑자(甲子) — 목(木)/수(水)"
 */
export function formatDailyFortune(fortune: DailyFortune): string {
  const d = fortune.date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dow = dayOfWeekKorean(fortune.dayOfWeek);

  return `${y}.${m}.${day}(${dow.charAt(0)}) ${formatFortuneGanzhi(fortune)}`;
}

/**
 * HourlyFortune을 한 줄 문자열로 포맷팅합니다.
 *
 * @param fortune HourlyFortune 객체
 * @returns 예: "자시(23:00~01:00) 갑자(甲子) — 목(木)/수(水)"
 */
export function formatHourlyFortune(fortune: HourlyFortune): string {
  return `${fortune.timeName}(${fortune.timeRange}) ${formatFortuneGanzhi(fortune)}`;
}


// =============================================================================
//  11. 검증 유틸리티
// =============================================================================

/**
 * 60갑자 전체 테이블의 정합성을 검증합니다.
 *
 * @returns { valid: boolean, errors: string[] }
 */
export function validateGanzhiTable(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < 60; i++) {
    const entry = GANZHI_60[i];

    // 인덱스 일치 검증
    if (entry.index !== i) {
      errors.push(`GANZHI_60[${i}].index = ${entry.index}, expected ${i}`);
    }

    // 천간 인덱스 검증: i % 10
    if (entry.stemIndex !== i % 10) {
      errors.push(`GANZHI_60[${i}].stemIndex = ${entry.stemIndex}, expected ${i % 10}`);
    }

    // 지지 인덱스 검증: i % 12
    if (entry.branchIndex !== i % 12) {
      errors.push(`GANZHI_60[${i}].branchIndex = ${entry.branchIndex}, expected ${i % 12}`);
    }

    // 음양 일치 검증 (천간과 지지의 음양이 같아야 함)
    if (entry.stem.yinYang !== entry.branch.yinYang) {
      errors.push(
        `GANZHI_60[${i}] 음양 불일치: stem=${entry.stem.yinYang}, branch=${entry.branch.yinYang}`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 줄리안 데이 기준일 검증.
 *
 * 2000-01-07 = JD 2451551 = 甲子日 인지 확인합니다.
 *
 * @returns { valid: boolean, details: string }
 */
export function validateJulianDayReference(): { valid: boolean; details: string } {
  const jd = toJulianDay(2000, 1, 7);
  const ganzhiIdx = julianDayToGanzhiIndex(jd);
  const entry = GANZHI_60[ganzhiIdx];

  const expectedJD = 2451551;
  const expectedGanzhi = '갑자';

  const jdMatch = jd === expectedJD;
  const ganzhiMatch = entry && `${entry.stem.hangul}${entry.branch.hangul}` === expectedGanzhi;

  return {
    valid: jdMatch && ganzhiMatch,
    details: `JD(2000-01-07) = ${jd} (expected ${expectedJD}), ` +
             `간지 = ${entry ? `${entry.stem.hangul}${entry.branch.hangul}` : '?'} (expected ${expectedGanzhi})`,
  };
}

/**
 * 오호기법(월 천간) 전체 검증.
 *
 * 갑/기년 → 병인, 을/경년 → 무인, 병/신년 → 경인, 정/임년 → 임인, 무/계년 → 갑인
 *
 * @returns { valid: boolean, errors: string[] }
 */
export function validateMonthStemFormula(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 연 천간(0~9) × 월(1~12) 전체 검증
  // 기대값: 5쌍의 시작 천간이 맞는지
  const expectedFirstMonthStems: Record<number, number> = {
    0: 2,  // 갑(0) → 병인(2)
    5: 2,  // 기(5) → 병인(2) (같은 쌍)
    1: 4,  // 을(1) → 무인(4)
    6: 4,  // 경(6) → 무인(4)
    2: 6,  // 병(2) → 경인(6)
    7: 6,  // 신(7) → 경인(6)
    3: 8,  // 정(3) → 임인(8)
    8: 8,  // 임(8) → 임인(8)
    4: 0,  // 무(4) → 갑인(0)
    9: 0,  // 계(9) → 갑인(0)
  };

  for (let yearStem = 0; yearStem < 10; yearStem++) {
    const mStemIdx = monthStemIndex(yearStem, 1); // 1월(인월)
    const expected = expectedFirstMonthStems[yearStem];
    if (mStemIdx !== expected) {
      errors.push(
        `yearStem=${yearStem}(${STEMS[yearStem].hangul}), month=1: ` +
        `got stem=${mStemIdx}(${STEMS[mStemIdx].hangul}), ` +
        `expected ${expected}(${STEMS[expected].hangul})`,
      );
    }
  }

  // 연속성 검증: 각 월은 이전 월보다 천간이 1씩 증가해야 함
  for (let yearStem = 0; yearStem < 10; yearStem++) {
    for (let m = 2; m <= 12; m++) {
      const curr = monthStemIndex(yearStem, m);
      const prev = monthStemIndex(yearStem, m - 1);
      if (curr !== (prev + 1) % 10) {
        errors.push(
          `yearStem=${yearStem}, month=${m}: ` +
          `stem=${curr} != (prev ${prev} + 1) % 10 = ${(prev + 1) % 10}`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 오자기법(시 천간) 전체 검증.
 *
 * 갑/기일 → 갑자, 을/경일 → 병자, 병/신일 → 무자, 정/임일 → 경자, 무/계일 → 임자
 *
 * @returns { valid: boolean, errors: string[] }
 */
export function validateHourStemFormula(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const expectedZiHourStems: Record<number, number> = {
    0: 0,  // 갑(0)일 → 갑자(0)시
    5: 0,  // 기(5)일 → 갑자(0)시
    1: 2,  // 을(1)일 → 병자(2)시
    6: 2,  // 경(6)일 → 병자(2)시
    2: 4,  // 병(2)일 → 무자(4)시
    7: 4,  // 신(7)일 → 무자(4)시
    3: 6,  // 정(3)일 → 경자(6)시
    8: 6,  // 임(8)일 → 경자(6)시
    4: 8,  // 무(4)일 → 임자(8)시
    9: 8,  // 계(9)일 → 임자(8)시
  };

  for (let dayStem = 0; dayStem < 10; dayStem++) {
    const hStemIdx = hourStemIndex(dayStem, 0); // 자시(0)
    const expected = expectedZiHourStems[dayStem];
    if (hStemIdx !== expected) {
      errors.push(
        `dayStem=${dayStem}(${STEMS[dayStem].hangul}), hour=자시: ` +
        `got stem=${hStemIdx}(${STEMS[hStemIdx].hangul}), ` +
        `expected ${expected}(${STEMS[expected].hangul})`,
      );
    }
  }

  // 연속성 검증: 각 시진은 이전 시진보다 천간이 1씩 증가해야 함
  for (let dayStem = 0; dayStem < 10; dayStem++) {
    for (let b = 1; b < 12; b++) {
      const curr = hourStemIndex(dayStem, b);
      const prev = hourStemIndex(dayStem, b - 1);
      if (curr !== (prev + 1) % 10) {
        errors.push(
          `dayStem=${dayStem}, branch=${b}: ` +
          `stem=${curr} != (prev ${prev} + 1) % 10 = ${(prev + 1) % 10}`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 모든 검증을 한번에 실행합니다.
 *
 * @returns 전체 검증 결과
 */
export function validateAll(): {
  ganzhiTable: { valid: boolean; errors: string[] };
  julianDay: { valid: boolean; details: string };
  monthStem: { valid: boolean; errors: string[] };
  hourStem: { valid: boolean; errors: string[] };
  allValid: boolean;
} {
  const ganzhiTable = validateGanzhiTable();
  const julianDay = validateJulianDayReference();
  const monthStem = validateMonthStemFormula();
  const hourStem = validateHourStemFormula();

  return {
    ganzhiTable,
    julianDay,
    monthStem,
    hourStem,
    allValid: ganzhiTable.valid && julianDay.valid && monthStem.valid && hourStem.valid,
  };
}
