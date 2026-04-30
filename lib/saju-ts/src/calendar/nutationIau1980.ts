/**
 * IAU 1980 Theory of Nutation — fundamental lunar/solar arguments.
 *
 * The five Delaunay-style angles below are the inputs every nutation
 * series since IAU 1980 builds on (Δψ and Δε in particular). They are
 * polynomials in `T`, the number of Julian centuries from J2000.0 in
 * Terrestrial Time:
 *
 *   T = (jdTT − 2451545.0) / 36525
 *
 * The polynomials below match NREL/TP-560-34302 Tables 4-3..4-6 (which
 * cite IAU 1980 / Meeus, Astronomical Algorithms 2nd ed., Ch. 22).
 *
 * Output is in degrees and is NOT reduced modulo 360 — `sin`/`cos`
 * handle the wrap, and skipping the mod call avoids unnecessary loss
 * of precision in long T values.
 *
 * This module is currently library-only: the functions are exported
 * but no production code path reaches them yet. Subsequent commits add
 * (a) the IAU 1980 longitude term tables, (b) a `solarPrecision`
 * config flag, and (c) the dispatch from `solarApparentLongitudeDeg`.
 */

export interface FundamentalArgsDeg {
  /** Mean elongation of the Moon from the Sun (D). */
  D: number;
  /** Mean anomaly of the Sun (M). */
  M: number;
  /** Mean anomaly of the Moon (M'). */
  Mp: number;
  /** Moon's argument of latitude (F). */
  F: number;
  /** Longitude of the ascending node of the Moon's mean orbit (Ω). */
  Omega: number;
}

/**
 * IAU 1980 fundamental arguments (D, M, M', F, Ω) at the given
 * Terrestrial-Time Julian centuries `T` from J2000.0.
 */
export function fundamentalArgsDeg(T: number): FundamentalArgsDeg {
  const T2 = T * T;
  const T3 = T2 * T;
  return {
    D: 297.85036 + 445267.111480 * T - 0.0019142 * T2 + T3 / 189474,
    M: 357.52772 + 35999.050340 * T - 0.0001603 * T2 - T3 / 300000,
    Mp: 134.96298 + 477198.867398 * T + 0.0086972 * T2 + T3 / 56250,
    F: 93.27191 + 483202.017538 * T - 0.0036825 * T2 + T3 / 327270,
    Omega: 125.04452 - 1934.136261 * T + 0.0020708 * T2 + T3 / 450000,
  };
}
