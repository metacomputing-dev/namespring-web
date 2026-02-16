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

export function createLunarDate(
  year: number,
  month: number,
  day: number,
  isLeapMonth: boolean = false,
): LunarDate {
  if (month < 1 || month > 12) {
    throw new RangeError(`month must be 1-12, was ${month}`);
  }
  if (day < 1 || day > 30) {
    throw new RangeError(`day must be 1-30, was ${day}`);
  }
  return { year, month, day, isLeapMonth };
}

export function formatLunarDate(ld: LunarDate): string {
  const leapMarker = ld.isLeapMonth ? '\uc724' : ''; // 윤
  return `\uc74c\ub825 ${ld.year}\ub144 ${leapMarker}${ld.month}\uc6d4 ${ld.day}\uc77c`;
}

export function lunarDateEquals(a: LunarDate, b: LunarDate): boolean {
  return a.year === b.year
    && a.month === b.month
    && a.day === b.day
    && a.isLeapMonth === b.isLeapMonth;
}

