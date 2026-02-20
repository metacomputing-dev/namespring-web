import { julianDayToUtcMs, utcMsToJulianDay } from './julian.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function mod360(x: number): number {
  const r = x % 360;
  return r < 0 ? r + 360 : r;
}

function sinDeg(xDeg: number): number {
  return Math.sin(xDeg * DEG2RAD);
}

function radToDeg(rad: number): number {
  return rad * RAD2DEG;
}

type VsopTerm = readonly [number, number, number];

// VSOP87 Earth heliocentric longitude periodic terms (L0..L5)
//
// These coefficients match the ones used by NREL's SPA (Solar Position Algorithm)
// and pvlib's Python implementation.
//
// We embed only the L-terms because for 24절기 we only need the Sun's
// apparent ecliptic longitude; the dominant accuracy gain comes from
// replacing the low-order mean longitude/anomaly approximation with VSOP87.
//
// References:
// - Reda & Andreas, "Solar Position Algorithm for Solar Radiation Applications"
//   (NREL/TP-560-34302)
// - pvlib-python (BSD-3-Clause), module pvlib.spa
const L0: readonly VsopTerm[] = [
  [175347046.0, 0.0, 0.0],
  [3341656.0, 4.6692568, 6283.07585],
  [34894.0, 4.6261, 12566.1517],
  [3497.0, 2.7441, 5753.3849],
  [3418.0, 2.8289, 3.5231],
  [3136.0, 3.6277, 77713.7715],
  [2676.0, 4.4181, 7860.4194],
  [2343.0, 6.1352, 3930.2097],
  [1324.0, 0.7425, 11506.7698],
  [1273.0, 2.0371, 529.691],
  [1199.0, 1.1096, 1577.3435],
  [990.0, 5.233, 5884.927],
  [902.0, 2.045, 26.298],
  [857.0, 3.508, 398.149],
  [780.0, 1.179, 5223.694],
  [753.0, 2.533, 5507.553],
  [505.0, 4.583, 18849.228],
  [492.0, 4.205, 775.523],
  [357.0, 2.92, 0.067],
  [317.0, 5.849, 11790.629],
  [284.0, 1.899, 796.298],
  [271.0, 0.315, 10977.079],
  [243.0, 0.345, 5486.778],
  [206.0, 4.806, 2544.314],
  [205.0, 1.869, 5573.143],
  [202.0, 2.458, 6069.777],
  [156.0, 0.833, 213.299],
  [132.0, 3.411, 2942.463],
  [126.0, 1.083, 20.775],
  [115.0, 0.645, 0.98],
  [103.0, 0.636, 4694.003],
  [102.0, 0.976, 15720.839],
  [102.0, 4.267, 7.114],
  [99.0, 6.21, 2146.17],
  [98.0, 0.68, 155.42],
  [86.0, 5.98, 161000.69],
  [85.0, 1.3, 6275.96],
  [85.0, 3.67, 71430.7],
  [80.0, 1.81, 17260.15],
  [79.0, 3.04, 12036.46],
  [75.0, 1.76, 5088.63],
  [74.0, 3.5, 3154.69],
  [74.0, 4.68, 801.82],
  [70.0, 0.83, 9437.76],
  [62.0, 3.98, 8827.39],
  [61.0, 1.82, 7084.9],
  [57.0, 2.78, 6286.6],
  [56.0, 4.39, 14143.5],
  [56.0, 3.47, 6279.55],
  [52.0, 0.19, 12139.55],
  [52.0, 1.33, 1748.02],
  [51.0, 0.28, 5856.48],
  [49.0, 0.49, 1194.45],
  [41.0, 5.37, 8429.24],
  [41.0, 2.4, 19651.05],
  [39.0, 6.17, 10447.39],
  [37.0, 6.04, 10213.29],
  [37.0, 2.57, 1059.38],
  [36.0, 1.71, 2352.87],
  [36.0, 1.78, 6812.77],
  [33.0, 0.59, 17789.85],
  [30.0, 0.44, 83996.85],
  [30.0, 2.74, 1349.87],
  [25.0, 3.16, 4690.48],
];

const L1: readonly VsopTerm[] = [
  [628331966747.0, 0.0, 0.0],
  [206059.0, 2.678235, 6283.07585],
  [4303.0, 2.6351, 12566.1517],
  [425.0, 1.59, 3.523],
  [119.0, 5.796, 26.298],
  [109.0, 2.966, 1577.344],
  [93.0, 2.59, 18849.23],
  [72.0, 1.14, 529.69],
  [68.0, 1.87, 398.15],
  [67.0, 4.41, 5507.55],
  [59.0, 2.89, 5223.69],
  [56.0, 2.17, 155.42],
  [45.0, 0.4, 796.3],
  [36.0, 0.47, 775.52],
  [29.0, 2.65, 7.11],
  [21.0, 5.34, 0.98],
  [19.0, 1.85, 5486.78],
  [19.0, 4.97, 213.3],
  [17.0, 2.99, 6275.96],
  [16.0, 0.03, 2544.31],
  [16.0, 1.43, 2146.17],
  [15.0, 1.21, 10977.08],
  [12.0, 2.83, 1748.02],
  [12.0, 3.26, 5088.63],
  [12.0, 5.27, 1194.45],
  [12.0, 2.08, 4694.0],
  [11.0, 0.77, 553.57],
  [10.0, 1.3, 6286.6],
  [10.0, 4.24, 1349.87],
  [9.0, 2.7, 242.73],
  [9.0, 5.64, 951.72],
  [8.0, 5.3, 2352.87],
  [6.0, 2.65, 9437.76],
  [6.0, 4.67, 4690.48],
];

const L2: readonly VsopTerm[] = [
  [52919.0, 0.0, 0.0],
  [8720.0, 1.0721, 6283.0758],
  [309.0, 0.867, 12566.152],
  [27.0, 0.05, 3.52],
  [16.0, 5.19, 26.3],
  [16.0, 3.68, 155.42],
  [10.0, 0.76, 18849.23],
  [9.0, 2.06, 77713.77],
  [7.0, 0.83, 775.52],
  [5.0, 4.66, 1577.34],
  [4.0, 1.03, 7.11],
  [4.0, 3.44, 5573.14],
  [3.0, 5.14, 796.3],
  [3.0, 6.05, 5507.55],
  [3.0, 1.19, 242.73],
  [3.0, 6.12, 529.69],
  [3.0, 0.31, 398.15],
  [3.0, 2.28, 553.57],
  [2.0, 4.38, 5223.69],
  [2.0, 3.75, 0.98],
];

const L3: readonly VsopTerm[] = [
  [289.0, 5.844, 6283.076],
  [35.0, 0.0, 0.0],
  [17.0, 5.49, 12566.15],
  [3.0, 5.2, 155.42],
  [1.0, 4.72, 3.52],
  [1.0, 5.3, 18849.23],
  [1.0, 5.97, 242.73],
];

const L4: readonly VsopTerm[] = [
  [114.0, 3.142, 0.0],
  [8.0, 4.13, 6283.08],
  [1.0, 3.84, 12566.15],
];

const L5: readonly VsopTerm[] = [[1.0, 3.14, 0.0]];

function sumVsopTerms(terms: readonly VsopTerm[], x: number): number {
  let s = 0;
  for (let i = 0; i < terms.length; i++) {
    const [A, B, C] = terms[i];
    s += A * Math.cos(B + C * x);
  }
  return s;
}

function earthHeliocentricLongitudeDeg(jme: number): number {
  const l0 = sumVsopTerms(L0, jme);
  const l1 = sumVsopTerms(L1, jme);
  const l2 = sumVsopTerms(L2, jme);
  const l3 = sumVsopTerms(L3, jme);
  const l4 = sumVsopTerms(L4, jme);
  const l5 = sumVsopTerms(L5, jme);

  const lRad =
    (l0 + l1 * jme + l2 * jme ** 2 + l3 * jme ** 3 + l4 * jme ** 4 + l5 * jme ** 5) /
    1e8;

  return mod360(radToDeg(lRad));
}

/**
 * Approximate ΔT (TT − UT1) in seconds.
 *
 * Polynomial pieces from NASA's eclipse.gsfc ΔT polynomials
 * (same family used by pvlib.spa.calculate_deltat).
 *
 * For our use (solar-term boundary timing), a few-second error in ΔT translates to
 * a few-second error in the resulting UTC timestamp; the dominant accuracy factor is
 * the solar longitude model.
 */
function deltaTSeconds(year: number, month: number): number {
  const y = year + (month - 0.5) / 12;

  if (year < -500) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (year < 500) {
    const u = y / 100;
    return (
      10583.6 -
      1014.41 * u +
      33.78311 * u ** 2 -
      5.952053 * u ** 3 -
      0.1798452 * u ** 4 +
      0.022174192 * u ** 5 +
      0.0090316521 * u ** 6
    );
  }
  if (year < 1600) {
    const u = (y - 1000) / 100;
    return (
      1574.2 -
      556.01 * u +
      71.23472 * u ** 2 +
      0.319781 * u ** 3 -
      0.8503463 * u ** 4 -
      0.005050998 * u ** 5 +
      0.0083572073 * u ** 6
    );
  }
  if (year < 1700) {
    const t = y - 1600;
    return 120 - 0.9808 * t - 0.01532 * t ** 2 + t ** 3 / 7129;
  }
  if (year < 1800) {
    const t = y - 1700;
    return 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3 - t ** 4 / 1174000;
  }
  if (year < 1860) {
    const t = y - 1800;
    return (
      13.72 -
      0.332447 * t +
      0.0068612 * t ** 2 +
      0.0041116 * t ** 3 -
      0.00037436 * t ** 4 +
      0.0000121272 * t ** 5 -
      0.0000001699 * t ** 6 +
      0.000000000875 * t ** 7
    );
  }
  if (year < 1900) {
    const t = y - 1860;
    return (
      7.62 +
      0.5737 * t -
      0.251754 * t ** 2 +
      0.01680668 * t ** 3 -
      0.0004473624 * t ** 4 +
      t ** 5 / 233174
    );
  }
  if (year < 1920) {
    const t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (year < 1941) {
    const t = y - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (year < 1961) {
    const t = y - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (year < 1986) {
    const t = y - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (year < 2005) {
    const t = y - 2000;
    return (
      63.86 +
      0.3345 * t -
      0.060374 * t ** 2 +
      0.0017275 * t ** 3 +
      0.000651814 * t ** 4 +
      0.00002373599 * t ** 5
    );
  }
  if (year < 2050) {
    const t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  }
  if (year < 2150) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u - 0.5628 * (2150 - y);
  }

  const u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}

function deltaTSecondsFromJulianDayUtc(jdUtc: number): number {
  const ms = julianDayToUtcMs(jdUtc);
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  return deltaTSeconds(year, month);
}

/**
 * Signed angular difference (a - b) wrapped to [-180, 180).
 */
export function angleDiffDeg(aDeg: number, bDeg: number): number {
  let d = mod360(aDeg - bDeg);
  if (d >= 180) d -= 360;
  return d;
}

/**
 * Apparent solar ecliptic longitude (degrees) for a given Julian Day.
 *
 * Input is interpreted as Julian Day in UT (UTC approximation). Internally we:
 * 1) convert to TT using ΔT polynomials (good to a few seconds)
 * 2) compute Earth's heliocentric longitude via VSOP87 periodic terms (SPA)
 * 3) convert to Sun's geocentric longitude (add 180°)
 * 4) apply small aberration + nutation correction using the dominant Ω term
 */
export function solarApparentLongitudeDeg(jdUtc: number): number {
  // Convert to Terrestrial Time (TT) as required by the VSOP87 series.
  const dT = deltaTSecondsFromJulianDayUtc(jdUtc);
  const jdTT = jdUtc + dT / 86400;

  // Julian centuries & millennia from J2000.0 (TT)
  const T = (jdTT - 2451545.0) / 36525.0;
  const jme = (jdTT - 2451545.0) / 365250.0;

  // Earth heliocentric longitude (deg)
  const L = earthHeliocentricLongitudeDeg(jme);

  // Sun geocentric longitude (deg)
  const theta = mod360(L + 180.0);

  // Ω: longitude of ascending node of the Moon's mean orbit on the ecliptic.
  // Dominant nutation term: Δψ ≈ -0.00478 sin Ω (degrees)
  const omega = 125.04 - 1934.136 * T;

  // Aberration (approx, assuming R≈1 AU): -20.4898" ≈ -0.00569°
  const lambda = theta - 0.00569 - 0.00478 * sinDeg(omega);

  return mod360(lambda);
}

export function solarLongitudeAtUtcMsDeg(utcMs: number): number {
  return solarApparentLongitudeDeg(utcMsToJulianDay(utcMs));
}
