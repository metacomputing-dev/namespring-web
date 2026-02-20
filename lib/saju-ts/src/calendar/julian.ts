import type { LocalDate } from './iso.js';

const MS_PER_DAY = 86_400_000;

/**
 * Julian Day (JD) of Unix epoch 1970-01-01T00:00:00Z.
 *
 * JD is defined to start at noon, so midnight corresponds to .5.
 */
const JD_UNIX_EPOCH = 2_440_587.5;

/**
 * Proleptic Gregorian calendar → Julian Day Number (JDN).
 * Returns the integer JDN that corresponds to noon-based day count.
 */
export function gregorianToJdn(date: LocalDate): number {
  const y = date.y;
  const m = date.m;
  const d = date.d;

  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;

  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045
  );
}

/**
 * UTC milliseconds → Julian Day (JD).
 *
 * - JD is a continuous day count (with fractional day).
 * - JD 2440587.5 corresponds to 1970-01-01T00:00:00Z.
 */
export function utcMsToJulianDay(utcMs: number): number {
  return utcMs / MS_PER_DAY + JD_UNIX_EPOCH;
}

/**
 * Julian Day (JD) → UTC milliseconds.
 */
export function julianDayToUtcMs(jd: number): number {
  return (jd - JD_UNIX_EPOCH) * MS_PER_DAY;
}
