/**
 * korean-lunar-calendar.ts — 한국 음양력(음력↔양력) 변환 (감사 B1 · 결정③).
 *
 * 알고리즘은 usingsky/korean_lunar_calendar_js (MIT License,
 * https://github.com/usingsky/korean_lunar_calendar_js)의 절대일수 방식 클린 포팅.
 * 데이터(KOREAN_LUNAR_DATA)는 KASI/KARI 한국 음양력 표준 기반 — korean-lunar-data.ts 참조.
 *
 * 지원 범위: 음력 1000-01-01 ~ 2050-11-18, 양력 1000-02-13 ~ 2050-12-31.
 * 제품 보장 범위는 1900~2050 (data/kasi-lunar-solar 오라클 + 설날/윤달 앵커 픽스처로 검증).
 * 범위 밖 입력은 null 반환 — 호출자(saju-adapter)가 KASI API 옵션 또는 비활성 처리로 폴백.
 *
 * 주의: 한국 음력은 KST 자정 기준 합삭 판정이라 중국 음력과 일부 날짜가 다르다 —
 * 중국 기준 테이블로 검증하지 말 것.
 */
import { KOREAN_LUNAR_BASE_YEAR, KOREAN_LUNAR_DATA } from './korean-lunar-data.js';

export interface LunarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly isLeapMonth: boolean;
}

export interface SolarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const KOREAN_LUNAR_MIN_VALUE = 1000_01_01;
const KOREAN_LUNAR_MAX_VALUE = 2050_11_18;
const KOREAN_SOLAR_MIN_VALUE = 1000_02_13;
const KOREAN_SOLAR_MAX_VALUE = 2050_12_31;

/** 절대일수 정렬 오프셋: 음력 1000-01-01 = 양력 1000-02-13 (43일). */
const SOLAR_LUNAR_DAY_DIFF = 43;
const LUNAR_SMALL_MONTH_DAY = 29;
const LUNAR_BIG_MONTH_DAY = 30;
const SOLAR_SMALL_YEAR_DAY = 365;
const SOLAR_BIG_YEAR_DAY = 366;
/** 월별 일수 (index 12 = 윤년 2월). */
const SOLAR_DAYS: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 29];

const cumulativeLunarYearDays = new Map<number, number>();
const cumulativeSolarYearDays = new Map<number, number>();

function getLunarData(year: number): number {
  return KOREAN_LUNAR_DATA[year - KOREAN_LUNAR_BASE_YEAR] ?? 0;
}

/** 윤달 월 번호 (0 = 윤달 없음). */
function lunarIntercalationMonth(data: number): number {
  return (data >> 12) & 0xf;
}

function lunarYearDays(year: number): number {
  return (getLunarData(year) >> 17) & 0x1ff;
}

function lunarMonthDays(year: number, month: number, isLeapMonth: boolean): number {
  const data = getLunarData(year);
  const big = isLeapMonth && lunarIntercalationMonth(data) === month
    ? ((data >> 16) & 0x1) > 0
    : ((data >> (12 - month)) & 0x1) > 0;
  return big ? LUNAR_BIG_MONTH_DAY : LUNAR_SMALL_MONTH_DAY;
}

function accumulateYearDays(year: number, cache: Map<number, number>, perYear: (y: number) => number): number {
  const hit = cache.get(year);
  if (hit !== undefined) return hit;
  const prev = cache.get(year - 1);
  let sum = 0;
  if (prev !== undefined && year > KOREAN_LUNAR_BASE_YEAR) {
    sum = prev + perYear(year);
  } else {
    for (let y = KOREAN_LUNAR_BASE_YEAR; y <= year; y++) sum += perYear(y);
  }
  cache.set(year, sum);
  return sum;
}

function lunarDaysBeforeBaseYear(year: number): number {
  if (year < KOREAN_LUNAR_BASE_YEAR) return 0;
  return accumulateYearDays(year, cumulativeLunarYearDays, lunarYearDays);
}

function lunarDaysBeforeBaseMonth(year: number, month: number, includeLeap: boolean): number {
  let days = 0;
  if (year >= KOREAN_LUNAR_BASE_YEAR && month > 0) {
    for (let m = 1; m <= month; m++) days += lunarMonthDays(year, m, false);
    if (includeLeap) {
      const leap = lunarIntercalationMonth(getLunarData(year));
      if (leap > 0 && leap <= month) days += lunarMonthDays(year, leap, true);
    }
  }
  return days;
}

function lunarAbsDays(year: number, month: number, day: number, isLeapMonth: boolean): number {
  let days = lunarDaysBeforeBaseYear(year - 1) + lunarDaysBeforeBaseMonth(year, month - 1, true) + day;
  if (isLeapMonth && lunarIntercalationMonth(getLunarData(year)) === month) {
    days += lunarMonthDays(year, month, false);
  }
  return days;
}

function isSolarLeapYear(data: number): boolean {
  return ((data >> 30) & 0x1) > 0;
}

function solarYearDays(year: number): number {
  return isSolarLeapYear(getLunarData(year)) ? SOLAR_BIG_YEAR_DAY : SOLAR_SMALL_YEAR_DAY;
}

function solarMonthDays(year: number, month: number): number {
  if (month === 2 && isSolarLeapYear(getLunarData(year))) return SOLAR_DAYS[12]!;
  return SOLAR_DAYS[month - 1]!;
}

function solarDaysBeforeBaseYear(year: number): number {
  if (year < KOREAN_LUNAR_BASE_YEAR) return 0;
  return accumulateYearDays(year, cumulativeSolarYearDays, solarYearDays);
}

function solarDaysBeforeBaseMonth(year: number, month: number): number {
  let days = 0;
  for (let m = 1; m <= month; m++) days += solarMonthDays(year, m);
  return days;
}

function solarAbsDays(year: number, month: number, day: number): number {
  return solarDaysBeforeBaseYear(year - 1) + solarDaysBeforeBaseMonth(year, month - 1) + day - SOLAR_LUNAR_DAY_DIFF;
}

function checkValidDate(isLunar: boolean, isLeapMonth: boolean, year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const dateValue = year * 10000 + month * 100 + day;
  const min = isLunar ? KOREAN_LUNAR_MIN_VALUE : KOREAN_SOLAR_MIN_VALUE;
  const max = isLunar ? KOREAN_LUNAR_MAX_VALUE : KOREAN_SOLAR_MAX_VALUE;
  if (dateValue < min || dateValue > max || month < 1 || month > 12 || day < 1) return false;
  if (isLunar && isLeapMonth && lunarIntercalationMonth(getLunarData(year)) !== month) return false;
  const maxDay = isLunar ? lunarMonthDays(year, month, isLeapMonth) : solarMonthDays(year, month);
  // 그레고리력 개력 공백(1582-10-05~14)은 존재하지 않는 양력 날짜.
  if (!isLunar && year === 1582 && month === 10 && day > 4 && day < 15) return false;
  return day <= maxDay;
}

/** 해당 음력 연도의 윤달 월 번호 (0 = 윤달 없음). 범위 밖이면 null. */
export function leapMonthOfLunarYear(year: number): number | null {
  if (year < KOREAN_LUNAR_BASE_YEAR || year > 2050) return null;
  return lunarIntercalationMonth(getLunarData(year));
}

/**
 * 음력 → 양력 변환. 유효하지 않은 입력(범위 밖, 없는 윤달, 없는 날짜)은 null.
 */
export function lunarToSolar(lunar: LunarDate): SolarDate | null {
  const { year, month, day, isLeapMonth } = lunar;
  if (!checkValidDate(true, isLeapMonth, year, month, day)) return null;

  const absDays = lunarAbsDays(year, month, day, isLeapMonth);
  const solarYear = absDays < solarAbsDays(year + 1, 1, 1) ? year : year + 1;
  for (let m = 12; m > 0; m--) {
    const monthStart = solarAbsDays(solarYear, m, 1);
    if (absDays >= monthStart) {
      return { year: solarYear, month: m, day: absDays - monthStart + 1 };
    }
  }
  return null;
}

/**
 * 양력 → 음력 변환. 유효하지 않은 입력은 null.
 */
export function solarToLunar(solar: SolarDate): LunarDate | null {
  const { year, month, day } = solar;
  if (!checkValidDate(false, false, year, month, day)) return null;

  const absDays = solarAbsDays(year, month, day);
  const lunarYear = absDays >= lunarAbsDays(year, 1, 1, false) ? year : year - 1;
  for (let m = 12; m > 0; m--) {
    const monthStart = lunarAbsDays(lunarYear, m, 1, false);
    if (absDays >= monthStart) {
      const leap = lunarIntercalationMonth(getLunarData(lunarYear)) === m
        && absDays >= lunarAbsDays(lunarYear, m, 1, true);
      return {
        year: lunarYear,
        month: m,
        day: absDays - lunarAbsDays(lunarYear, m, 1, leap) + 1,
        isLeapMonth: leap,
      };
    }
  }
  return null;
}
