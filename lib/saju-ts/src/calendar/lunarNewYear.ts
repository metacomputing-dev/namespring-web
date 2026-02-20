import { utcMsToJulianDay, julianDayToUtcMs } from './julian.js';
import { solarTermUtcMsForLongitude, type SolarTermMethod } from './solarTerms.js';

/**
 * Lunar New Year boundary helper (설날/춘절).
 *
 * Policy:
 * - Find winter solstice (Sun apparent longitude 270°) of the previous year.
 * - Find the 2nd astronomical new moon after that winter solstice.
 * - The boundary is local midnight (00:00) of that lunar new year day.
 *
 * Notes / limitations:
 * - Traditional Chinese/Korean lunisolar calendars can, in rare cases, place Lunar New Year on
 *   the **third** new moon after winter solstice if an intercalary month occurs around that period.
 *   For most years this “2nd new moon after winter solstice” rule matches published calendars.
 * - We treat TT≈UTC (ΔT ignored) because we only need the *day* boundary for pillar calculations.
 *   This introduces at most ~1 minute error in recent centuries, which is acceptable for date-level boundaries.
 */

const SYNODIC_MONTH_DAYS = 29.530588853;
const NEW_MOON_BASE_JDE = 2451550.09765; // Meeus (2000-01-06) new moon reference (TT)

export interface LunarNewYearBoundary {
  /** Gregorian year whose Lunar New Year day is being computed. */
  localYear: number;
  /** Offset minutes for the local civil time zone. */
  offsetMinutes: number;
  /** Solar-term computation method used for the winter-solstice anchor. */
  method: SolarTermMethod;

  /** Winter solstice instant (UTC, ms). */
  winterSolsticeUtcMs: number;
  /** 2nd new moon instant after winter solstice (UTC, ms; TT≈UTC). */
  newMoonUtcMs: number;

  /** Lunar New Year day in local civil calendar (y,m,d). */
  localDate: { y: number; m: number; d: number };

  /** Boundary instant in UTC (ms): localDate at 00:00 in the given offsetMinutes zone. */
  boundaryUtcMs: number;

  /** Algorithm identifier. */
  algorithm: 'secondNewMoonAfterWinterSolstice';
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function mod360(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/**
 * Meeus Ch. 49 — true new moon in Julian Ephemeris Day (TT).
 * Ported from the vendored cal/astro implementation to keep this repo self-contained.
 */
export function trueNewMoonJDE(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  let jde = NEW_MOON_BASE_JDE + SYNODIC_MONTH_DAYS * k;
  jde += 0.0001337 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;

  const M = toRad(mod360(2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3));
  const M1 = toRad(
    mod360(
      201.5643 +
        385.81693528 * k +
        0.0107582 * T2 +
        0.00001238 * T3 -
        0.000000058 * T4,
    ),
  );
  const F = toRad(
    mod360(
      160.7108 +
        390.67050284 * k -
        0.0016118 * T2 -
        0.00000227 * T3 +
        0.000000011 * T4,
    ),
  );
  const om = toRad(mod360(124.7746 - 1.5637558 * k + 0.0020691 * T2 + 0.00000215 * T3));

  const E = 1.0 - 0.002516 * T - 0.0000074 * T2;

  const corr =
    -0.4072 * Math.sin(M1) +
    0.17241 * E * Math.sin(M) +
    0.01608 * Math.sin(2 * M1) +
    0.01039 * Math.sin(2 * F) +
    0.00739 * E * Math.sin(M1 - M) -
    0.00514 * E * Math.sin(M1 + M) +
    0.00208 * E * E * Math.sin(2 * M) -
    0.00111 * Math.sin(M1 - 2 * F) -
    0.00057 * Math.sin(M1 + 2 * F) +
    0.00056 * E * Math.sin(2 * M1 + M) -
    0.00042 * Math.sin(3 * M1) +
    0.00042 * E * Math.sin(M + 2 * F) +
    0.00038 * E * Math.sin(M - 2 * F) -
    0.00024 * E * Math.sin(2 * M1 - M) -
    0.00017 * Math.sin(om) -
    0.00007 * Math.sin(M1 + 2 * M) +
    0.00004 * Math.sin(2 * M1 - 2 * F) +
    0.00004 * Math.sin(3 * M) +
    0.00003 * Math.sin(M1 + M - 2 * F) +
    0.00003 * Math.sin(2 * M1 + 2 * F) -
    0.00003 * Math.sin(M1 + M + 2 * F) +
    0.00003 * Math.sin(M1 - M + 2 * F) -
    0.00002 * Math.sin(M1 - M - 2 * F) -
    0.00002 * Math.sin(3 * M1 + M) +
    0.00002 * Math.sin(4 * M1);

  // Additional small corrections (planetary arguments)
  const A1 = toRad(mod360(299.77 + 0.107408 * k - 0.009173 * T2));
  const A2 = toRad(mod360(251.88 + 0.016321 * k));
  const A3 = toRad(mod360(251.83 + 26.651886 * k));
  const A4 = toRad(mod360(349.42 + 36.412478 * k));
  const A5 = toRad(mod360(84.66 + 18.206239 * k));
  const A6 = toRad(mod360(141.74 + 53.303771 * k));
  const A7 = toRad(mod360(207.14 + 2.453732 * k));
  const A8 = toRad(mod360(154.84 + 7.30686 * k));
  const A9 = toRad(mod360(34.52 + 27.261239 * k));
  const A10 = toRad(mod360(207.19 + 0.121824 * k));
  const A11 = toRad(mod360(291.34 + 1.844379 * k));
  const A12 = toRad(mod360(161.72 + 24.198154 * k));
  const A13 = toRad(mod360(239.56 + 25.513099 * k));
  const A14 = toRad(mod360(331.55 + 3.592518 * k));

  const corr2 =
    0.000325 * Math.sin(A1) +
    0.000165 * Math.sin(A2) +
    0.000164 * Math.sin(A3) +
    0.000126 * Math.sin(A4) +
    0.00011 * Math.sin(A5) +
    0.000062 * Math.sin(A6) +
    0.00006 * Math.sin(A7) +
    0.000056 * Math.sin(A8) +
    0.000047 * Math.sin(A9) +
    0.000042 * Math.sin(A10) +
    0.00004 * Math.sin(A11) +
    0.000037 * Math.sin(A12) +
    0.000035 * Math.sin(A13) +
    0.000023 * Math.sin(A14);

  return jde + corr + corr2;
}

function newMoonIndexNear(jd: number): number {
  return Math.floor((jd - NEW_MOON_BASE_JDE) / SYNODIC_MONTH_DAYS);
}

function newMoonOnOrAfterJd(jd: number): { k: number; jde: number } {
  let k = newMoonIndexNear(jd);
  let nm = trueNewMoonJDE(k);
  if (nm < jd) {
    k += 1;
    nm = trueNewMoonJDE(k);
  }
  return { k, jde: nm };
}

/**
 * Compute Lunar New Year boundary for a given local civil year.
 */
export function computeLunarNewYearBoundary(
  localYear: number,
  offsetMinutes: number,
  method: SolarTermMethod,
): LunarNewYearBoundary {
  // Winter solstice (270°) occurs in Dec of (localYear-1).
  const winterSolsticeUtcMs = solarTermUtcMsForLongitude(localYear - 1, 270, method);
  const wsJd = utcMsToJulianDay(winterSolsticeUtcMs);

  const first = newMoonOnOrAfterJd(wsJd);
  const secondJde = trueNewMoonJDE(first.k + 1);

  const newMoonUtcMs = Math.round(julianDayToUtcMs(secondJde));

  // Convert the new moon instant to local civil date by applying offsetMinutes.
  const localMs = newMoonUtcMs + offsetMinutes * 60_000;
  const dt = new Date(localMs);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  const d = dt.getUTCDate();

  const boundaryUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMinutes * 60_000;

  return {
    localYear,
    offsetMinutes,
    method,
    winterSolsticeUtcMs,
    newMoonUtcMs,
    localDate: { y, m, d },
    boundaryUtcMs,
    algorithm: 'secondNewMoonAfterWinterSolstice',
  };
}
