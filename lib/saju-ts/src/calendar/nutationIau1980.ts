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

/**
 * One row of the IAU 1980 nutation-in-longitude series.
 *
 * Each row contributes (A + A'·T)·sin(Σ multiplier·argument) to Δψ,
 * where the amplitudes A, A' are stored in 1e-4 arcsec for parity with
 * NREL/TP-560-34302 Table 4-7 and pvlib.spa's NUTATION_ABCD_ARRAY.
 */
interface NutLongTerm {
  D: number;
  M: number;
  Mp: number;
  F: number;
  Omega: number;
  /** Amplitude in 0.0001 arcsec. */
  A: number;
  /** First-order time variation in 0.0001 arcsec / century. */
  Ap: number;
}

/**
 * Top 10 amplitude rows of the IAU 1980 nutation-in-longitude series.
 *
 * Sufficient for ≈ 1″ precision on Δψ (full series has 63 rows and is
 * added in a later commit). Single-Ω-only would be roughly 9″.
 */
const NUTATION_LONGITUDE_TOP10: readonly NutLongTerm[] = [
  { D:  0, M:  0, Mp:  0, F:  0, Omega: 1, A: -171996, Ap: -174.2 },
  { D: -2, M:  0, Mp:  0, F:  2, Omega: 2, A:  -13187, Ap:   -1.6 },
  { D:  0, M:  0, Mp:  0, F:  2, Omega: 2, A:   -2274, Ap:   -0.2 },
  { D:  0, M:  0, Mp:  0, F:  0, Omega: 2, A:    2062, Ap:    0.2 },
  { D:  0, M:  1, Mp:  0, F:  0, Omega: 0, A:    1426, Ap:   -3.4 },
  { D:  0, M:  0, Mp:  1, F:  0, Omega: 0, A:     712, Ap:    0.1 },
  { D: -2, M:  1, Mp:  0, F:  2, Omega: 2, A:    -517, Ap:    1.2 },
  { D:  0, M:  0, Mp:  0, F:  2, Omega: 1, A:    -386, Ap:   -0.4 },
  { D:  0, M:  0, Mp:  1, F:  2, Omega: 2, A:    -301, Ap:    0.0 },
  { D: -2, M: -1, Mp:  0, F:  2, Omega: 2, A:     217, Ap:   -0.5 },
];

const DEG_PER_ARCSEC = 1 / 3600;
const RAD_PER_DEG = Math.PI / 180;

function evaluateNutationLongitudeSeries(T: number, terms: readonly NutLongTerm[]): number {
  const args = fundamentalArgsDeg(T);
  let dpsiUnits = 0; // accumulated in 0.0001 arcsec
  for (const t of terms) {
    const argDeg =
      t.D * args.D +
      t.M * args.M +
      t.Mp * args.Mp +
      t.F * args.F +
      t.Omega * args.Omega;
    dpsiUnits += (t.A + t.Ap * T) * Math.sin(argDeg * RAD_PER_DEG);
  }
  // 0.0001 arcsec → degrees
  return dpsiUnits * 1e-4 * DEG_PER_ARCSEC;
}

/**
 * Δψ (nutation in ecliptic longitude) using the top 10 IAU 1980
 * amplitude rows. Returned in degrees.
 *
 * Suitable for Phase-5 'iau1980_top10' precision; the full 63-row
 * version is added in a later commit. Not yet wired into
 * solarApparentLongitudeDeg.
 */
export function nutationLongitudeDegTop10(T: number): number {
  return evaluateNutationLongitudeSeries(T, NUTATION_LONGITUDE_TOP10);
}

/**
 * Full IAU 1980 nutation-in-longitude series — all 63 rows from
 * NREL/TP-560-34302 Table A.4.3 (= IERS 1980 / Wahr 1981 series).
 *
 * Listed in the same order and with the same amplitudes as the table.
 * Amplitudes a, b are stored as 0.0001 arcsec / 0.0001 arcsec per
 * century, exactly as printed.
 */
const NUTATION_LONGITUDE_FULL: readonly NutLongTerm[] = [
  // Rows 1-16 (NREL Table A.4.3, page A-13)
  { D:  0, M:  0, Mp:  0, F:  0, Omega: 1, A: -171996, Ap: -174.2 },
  { D: -2, M:  0, Mp:  0, F:  2, Omega: 2, A:  -13187, Ap:   -1.6 },
  { D:  0, M:  0, Mp:  0, F:  2, Omega: 2, A:   -2274, Ap:   -0.2 },
  { D:  0, M:  0, Mp:  0, F:  0, Omega: 2, A:    2062, Ap:    0.2 },
  { D:  0, M:  1, Mp:  0, F:  0, Omega: 0, A:    1426, Ap:   -3.4 },
  { D:  0, M:  0, Mp:  1, F:  0, Omega: 0, A:     712, Ap:    0.1 },
  { D: -2, M:  1, Mp:  0, F:  2, Omega: 2, A:    -517, Ap:    1.2 },
  { D:  0, M:  0, Mp:  0, F:  2, Omega: 1, A:    -386, Ap:   -0.4 },
  { D:  0, M:  0, Mp:  1, F:  2, Omega: 2, A:    -301, Ap:    0.0 },
  { D: -2, M: -1, Mp:  0, F:  2, Omega: 2, A:     217, Ap:   -0.5 },
  { D: -2, M:  0, Mp:  1, F:  0, Omega: 0, A:    -158, Ap:    0.0 },
  { D: -2, M:  0, Mp:  0, F:  2, Omega: 1, A:     129, Ap:    0.1 },
  { D:  0, M:  0, Mp: -1, F:  2, Omega: 2, A:     123, Ap:    0.0 },
  { D:  2, M:  0, Mp:  0, F:  0, Omega: 0, A:      63, Ap:    0.0 },
  { D:  0, M:  0, Mp:  1, F:  0, Omega: 1, A:      63, Ap:    0.1 },
  { D:  2, M:  0, Mp: -1, F:  2, Omega: 2, A:     -59, Ap:    0.0 },
  // Rows 17-49 (NREL Table A.4.3, page A-14)
  { D:  0, M:  0, Mp: -1, F:  0, Omega: 1, A:     -58, Ap:   -0.1 },
  { D:  0, M:  0, Mp:  1, F:  2, Omega: 1, A:     -51, Ap:    0.0 },
  { D: -2, M:  0, Mp:  2, F:  0, Omega: 0, A:      48, Ap:    0.0 },
  { D:  0, M:  0, Mp: -2, F:  2, Omega: 1, A:      46, Ap:    0.0 },
  { D:  2, M:  0, Mp:  0, F:  2, Omega: 2, A:     -38, Ap:    0.0 },
  { D:  0, M:  0, Mp:  2, F:  2, Omega: 2, A:     -31, Ap:    0.0 },
  { D:  0, M:  0, Mp:  2, F:  0, Omega: 0, A:      29, Ap:    0.0 },
  { D: -2, M:  0, Mp:  1, F:  2, Omega: 2, A:      29, Ap:    0.0 },
  { D:  0, M:  0, Mp:  0, F:  2, Omega: 0, A:      26, Ap:    0.0 },
  { D: -2, M:  0, Mp:  0, F:  2, Omega: 0, A:     -22, Ap:    0.0 },
  { D:  0, M:  0, Mp: -1, F:  2, Omega: 1, A:      21, Ap:    0.0 },
  { D:  0, M:  2, Mp:  0, F:  0, Omega: 0, A:      17, Ap:   -0.1 },
  { D:  2, M:  0, Mp: -1, F:  0, Omega: 1, A:      16, Ap:    0.0 },
  { D: -2, M:  2, Mp:  0, F:  2, Omega: 2, A:     -16, Ap:    0.1 },
  { D:  0, M:  1, Mp:  0, F:  0, Omega: 1, A:     -15, Ap:    0.0 },
  { D: -2, M:  0, Mp:  1, F:  0, Omega: 1, A:     -13, Ap:    0.0 },
  { D:  0, M: -1, Mp:  0, F:  0, Omega: 1, A:     -12, Ap:    0.0 },
  { D:  0, M:  0, Mp:  2, F: -2, Omega: 0, A:      11, Ap:    0.0 },
  { D:  2, M:  0, Mp: -1, F:  2, Omega: 1, A:     -10, Ap:    0.0 },
  { D:  2, M:  0, Mp:  1, F:  2, Omega: 2, A:      -8, Ap:    0.0 },
  { D:  0, M:  1, Mp:  0, F:  2, Omega: 2, A:       7, Ap:    0.0 },
  { D: -2, M:  1, Mp:  1, F:  0, Omega: 0, A:      -7, Ap:    0.0 },
  { D:  0, M: -1, Mp:  0, F:  2, Omega: 2, A:      -7, Ap:    0.0 },
  { D:  2, M:  0, Mp:  0, F:  2, Omega: 1, A:      -7, Ap:    0.0 },
  { D:  2, M:  0, Mp:  1, F:  0, Omega: 0, A:       6, Ap:    0.0 },
  { D: -2, M:  0, Mp:  2, F:  2, Omega: 2, A:       6, Ap:    0.0 },
  { D: -2, M:  0, Mp:  1, F:  2, Omega: 1, A:       6, Ap:    0.0 },
  { D:  2, M:  0, Mp: -2, F:  0, Omega: 1, A:      -6, Ap:    0.0 },
  { D:  2, M:  0, Mp:  0, F:  0, Omega: 1, A:      -6, Ap:    0.0 },
  { D:  0, M: -1, Mp:  1, F:  0, Omega: 0, A:       5, Ap:    0.0 },
  { D: -2, M: -1, Mp:  0, F:  2, Omega: 1, A:      -5, Ap:    0.0 },
  { D: -2, M:  0, Mp:  0, F:  0, Omega: 1, A:      -5, Ap:    0.0 },
  { D:  0, M:  0, Mp:  2, F:  2, Omega: 1, A:      -5, Ap:    0.0 },
  { D: -2, M:  0, Mp:  2, F:  0, Omega: 1, A:       4, Ap:    0.0 },
  // Rows 50-63 (NREL Table A.4.3, page A-15)
  { D: -2, M:  1, Mp:  0, F:  2, Omega: 1, A:       4, Ap:    0.0 },
  { D:  0, M:  0, Mp:  1, F: -2, Omega: 0, A:       4, Ap:    0.0 },
  { D: -1, M:  0, Mp:  1, F:  0, Omega: 0, A:      -4, Ap:    0.0 },
  { D: -2, M:  1, Mp:  0, F:  0, Omega: 0, A:      -4, Ap:    0.0 },
  { D:  1, M:  0, Mp:  0, F:  0, Omega: 0, A:      -4, Ap:    0.0 },
  { D:  0, M:  0, Mp:  1, F:  2, Omega: 0, A:       3, Ap:    0.0 },
  { D:  0, M:  0, Mp: -2, F:  2, Omega: 2, A:      -3, Ap:    0.0 },
  { D: -1, M: -1, Mp:  1, F:  0, Omega: 0, A:      -3, Ap:    0.0 },
  { D:  0, M:  1, Mp:  1, F:  0, Omega: 0, A:      -3, Ap:    0.0 },
  { D:  0, M: -1, Mp:  1, F:  2, Omega: 2, A:      -3, Ap:    0.0 },
  { D:  2, M: -1, Mp: -1, F:  2, Omega: 2, A:      -3, Ap:    0.0 },
  { D:  0, M:  0, Mp:  3, F:  2, Omega: 2, A:      -3, Ap:    0.0 },
  { D:  2, M: -1, Mp:  0, F:  2, Omega: 2, A:      -3, Ap:    0.0 },
];

/**
 * Δψ (nutation in ecliptic longitude) using the full 63-row IAU 1980
 * series. Returned in degrees. Suitable for Phase-5 'iau1980_full'
 * precision (≈ ±0.1″ residual); the dispatch hookup follows in a later
 * commit.
 */
export function nutationLongitudeDegFull(T: number): number {
  return evaluateNutationLongitudeSeries(T, NUTATION_LONGITUDE_FULL);
}
