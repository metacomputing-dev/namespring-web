import type { LunarDate, SolarDate } from './LunarDate.js';
import { KOREAN_LUNAR_DATA } from './KoreanLunarYearData.js';


const BASE_YEAR = 1000;
const SOLAR_LUNAR_DAY_DIFF = 43;

export const MIN_LUNAR_YEAR = 1899;
export const MAX_LUNAR_YEAR = 2050;

export const MIN_SOLAR_YEAR = 1900;
export const MIN_SOLAR_MONTH = 1;
export const MIN_SOLAR_DAY = 1;
export const MAX_SOLAR_YEAR = 2050;
export const MAX_SOLAR_MONTH = 12;
export const MAX_SOLAR_DAY = 31;

const SMALL_MONTH = 29;
const BIG_MONTH = 30;
const SMALL_YEAR_DAYS = 365;
const BIG_YEAR_DAYS = 366;
const SOLAR_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 29] as const;
const YEAR_DATA_TABLE = KOREAN_LUNAR_DATA;


function yearData(year: number): number {
  return YEAR_DATA_TABLE[year - BASE_YEAR]!;
}

function leapMonthOf(data: number): number {
  return (data >>> 12) & 0x000F;
}

function totalLunarDays(data: number): number {
  return (data >>> 17) & 0x01FF;
}

function leapMonthDays(data: number): number {
  return ((data >>> 16) & 0x01) > 0 ? BIG_MONTH : SMALL_MONTH;
}

function monthDays(data: number, month: number): number {
  return ((data >>> (12 - month)) & 0x01) > 0 ? BIG_MONTH : SMALL_MONTH;
}

function isSolarLeapYear(data: number): boolean {
  return ((data >>> 30) & 0x01) > 0;
}


function lunarAbsDays(
  year: number,
  month: number,
  day: number,
  isIntercalation: boolean,
): number {
  let days = 0;
  for (let y = BASE_YEAR; y < year; y++) {
    days += totalLunarDays(yearData(y));
  }
  const data = yearData(year);
  for (let m = 1; m < month; m++) {
    days += monthDays(data, m);
  }
  const leapMonth = leapMonthOf(data);
  if (leapMonth >= 1 && leapMonth < month) {
    days += leapMonthDays(data);
  }
  if (isIntercalation && leapMonth === month) {
    days += monthDays(data, month);
  }
  days += day;
  return days;
}

function solarAbsDays(year: number, month: number, day: number): number {
  let days = 0;
  for (let y = BASE_YEAR; y < year; y++) {
    const data = yearData(y);
    days += isSolarLeapYear(data) ? BIG_YEAR_DAYS : SMALL_YEAR_DAYS;
  }
  const data = yearData(year);
  for (let m = 1; m < month; m++) {
    days += (m === 2 && isSolarLeapYear(data))
      ? SOLAR_MONTH_DAYS[12]!
      : SOLAR_MONTH_DAYS[m - 1]!;
  }
  days += day;
  days -= SOLAR_LUNAR_DAY_DIFF;
  return days;
}


function isValidLunarDate(ld: LunarDate): boolean {
  const data = yearData(ld.year);
  let maxDay: number;
  if (ld.isLeapMonth && leapMonthOf(data) === ld.month) {
    maxDay = leapMonthDays(data);
  } else if (!ld.isLeapMonth) {
    maxDay = monthDays(data, ld.month);
  } else {
    return false; // requested leap month doesn't exist
  }
  return ld.day <= maxDay;
}

function isSolarInRange(year: number, month: number, day: number): boolean {
  const minVal = MIN_SOLAR_YEAR * 10000 + MIN_SOLAR_MONTH * 100 + MIN_SOLAR_DAY;
  const maxVal = MAX_SOLAR_YEAR * 10000 + MAX_SOLAR_MONTH * 100 + MAX_SOLAR_DAY;
  const val = year * 10000 + month * 100 + day;
  return val >= minVal && val <= maxVal;
}


export function lunarToSolar(lunarDate: LunarDate): SolarDate | null {
  if (lunarDate.year < MIN_LUNAR_YEAR || lunarDate.year > MAX_LUNAR_YEAR) return null;
  if (!isValidLunarDate(lunarDate)) return null;

  const absDays = lunarAbsDays(
    lunarDate.year,
    lunarDate.month,
    lunarDate.day,
    lunarDate.isLeapMonth,
  );

  const solarYear = absDays < solarAbsDays(lunarDate.year + 1, 1, 1)
    ? lunarDate.year
    : lunarDate.year + 1;

  for (let month = 12; month >= 1; month--) {
    const absByMonth = solarAbsDays(solarYear, month, 1);
    if (absDays >= absByMonth) {
      const solarDay = absDays - absByMonth + 1;
      return { year: solarYear, month, day: solarDay };
    }
  }
  return null;
}

export function solarToLunar(solarDate: SolarDate): LunarDate | null {
  if (!isSolarInRange(solarDate.year, solarDate.month, solarDate.day)) return null;

  const absDays = solarAbsDays(solarDate.year, solarDate.month, solarDate.day);

  const lunarYear = absDays >= lunarAbsDays(solarDate.year, 1, 1, false)
    ? solarDate.year
    : solarDate.year - 1;

  for (let month = 12; month >= 1; month--) {
    const absByMonth = lunarAbsDays(lunarYear, month, 1, false);
    if (absDays >= absByMonth) {
      const data = yearData(lunarYear);
      const intercalationMonth = leapMonthOf(data);
      const isIntercalation = intercalationMonth === month
        && absDays >= lunarAbsDays(lunarYear, month, 1, true);

      const day = absDays - lunarAbsDays(lunarYear, month, 1, isIntercalation) + 1;
      return { year: lunarYear, month, day, isLeapMonth: isIntercalation };
    }
  }
  return null;
}

export const KoreanLunarAlgorithmicConverter = {
  lunarToSolar,
  solarToLunar,
  MIN_LUNAR_YEAR,
  MAX_LUNAR_YEAR,
  MIN_SOLAR_YEAR,
  MAX_SOLAR_YEAR,
} as const;

