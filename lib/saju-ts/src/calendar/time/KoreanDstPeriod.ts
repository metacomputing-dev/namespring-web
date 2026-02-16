export interface DstPeriod {
  readonly startYear: number;
  readonly startMonth: number;
  readonly startDay: number;
  readonly endYear: number;
  readonly endMonth: number;
  readonly endDay: number;
  readonly offsetMinutes: number;
}

export const KOREAN_DST_RANGES: readonly DstPeriod[] = [
  { startYear: 1948, startMonth: 6,  startDay: 1,  endYear: 1948, endMonth: 9,  endDay: 13, offsetMinutes: 60 },
  { startYear: 1949, startMonth: 4,  startDay: 3,  endYear: 1949, endMonth: 9,  endDay: 11, offsetMinutes: 60 },
  { startYear: 1950, startMonth: 4,  startDay: 1,  endYear: 1950, endMonth: 9,  endDay: 10, offsetMinutes: 60 },
  { startYear: 1951, startMonth: 5,  startDay: 6,  endYear: 1951, endMonth: 9,  endDay: 9,  offsetMinutes: 60 },
  { startYear: 1955, startMonth: 5,  startDay: 5,  endYear: 1955, endMonth: 9,  endDay: 8,  offsetMinutes: 60 },
  { startYear: 1956, startMonth: 5,  startDay: 20, endYear: 1956, endMonth: 9,  endDay: 30, offsetMinutes: 60 },
  { startYear: 1957, startMonth: 5,  startDay: 5,  endYear: 1957, endMonth: 9,  endDay: 22, offsetMinutes: 60 },
  { startYear: 1958, startMonth: 5,  startDay: 4,  endYear: 1958, endMonth: 9,  endDay: 21, offsetMinutes: 60 },
  { startYear: 1959, startMonth: 5,  startDay: 3,  endYear: 1959, endMonth: 9,  endDay: 20, offsetMinutes: 60 },
  { startYear: 1960, startMonth: 5,  startDay: 1,  endYear: 1960, endMonth: 9,  endDay: 18, offsetMinutes: 60 },
  { startYear: 1987, startMonth: 5,  startDay: 10, endYear: 1987, endMonth: 10, endDay: 11, offsetMinutes: 60 },
  { startYear: 1988, startMonth: 5,  startDay: 8,  endYear: 1988, endMonth: 10, endDay: 9,  offsetMinutes: 60 },
] as const;

function dateKey(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day;
}

export function koreanDstOffsetMinutes(year: number, month: number, day: number): number {
  const key = dateKey(year, month, day);
  for (const period of KOREAN_DST_RANGES) {
    const start = dateKey(period.startYear, period.startMonth, period.startDay);
    const end = dateKey(period.endYear, period.endMonth, period.endDay);
    if (key >= start && key < end) {
      return period.offsetMinutes;
    }
  }
  return 0;
}

