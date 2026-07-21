/**
 * Builds a proleptic-Gregorian UTC timestamp without Date.UTC's special
 * interpretation of years 0..99 as 1900..1999.
 */
export function utcMsFromParts(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): number {
  const date = new Date(0);
  date.setUTCFullYear(year, monthIndex, day);
  date.setUTCHours(hour, minute, second, millisecond);
  return date.getTime();
}
