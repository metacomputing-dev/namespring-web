import { Jiji } from '../../domain/Jiji.js';
import { VSOP87D_L_TERMS, VSOP87D_R_TERMS } from './Vsop87dTerms.js';
import type { JeolBoundary } from './JeolBoundaryTable.js';
import {
  dayOfYear,
  daysInYear,
  jdUtcToKst,
  kstToJdUtc,
  roundToNearestMinute,
} from './Vsop87dFallbackTimeUtils.js';
import {
  norm180,
  toDegrees,
  toRadians,
  wrap360,
} from './Vsop87dFallbackMathUtils.js';


const J2000 = 2451545.0;
const NEWTON_STEP_DEG_PER_DAY = 0.98564736;
const MAX_NEWTON_ITERATION = 24;
const MAX_TT_UTC_FIXPOINT_ITERATION = 8;

interface JeolTermSpec {
  readonly solarLongitude: number;
  readonly sajuMonthIndex: number;
  readonly branch: Jiji;
  readonly guessMonth: number;
  readonly guessDay: number;
}

const TERM_SPECS: readonly JeolTermSpec[] = [
  { solarLongitude: 285, sajuMonthIndex: 12, branch: Jiji.CHUK, guessMonth: 1, guessDay: 6 },
  { solarLongitude: 315, sajuMonthIndex: 1,  branch: Jiji.IN,   guessMonth: 2, guessDay: 4 },
  { solarLongitude: 345, sajuMonthIndex: 2,  branch: Jiji.MYO,  guessMonth: 3, guessDay: 6 },
  { solarLongitude: 15,  sajuMonthIndex: 3,  branch: Jiji.JIN,  guessMonth: 4, guessDay: 5 },
  { solarLongitude: 45,  sajuMonthIndex: 4,  branch: Jiji.SA,   guessMonth: 5, guessDay: 6 },
  { solarLongitude: 75,  sajuMonthIndex: 5,  branch: Jiji.O,    guessMonth: 6, guessDay: 6 },
  { solarLongitude: 105, sajuMonthIndex: 6,  branch: Jiji.MI,   guessMonth: 7, guessDay: 7 },
  { solarLongitude: 135, sajuMonthIndex: 7,  branch: Jiji.SIN,  guessMonth: 8, guessDay: 8 },
  { solarLongitude: 165, sajuMonthIndex: 8,  branch: Jiji.YU,   guessMonth: 9, guessDay: 8 },
  { solarLongitude: 195, sajuMonthIndex: 9,  branch: Jiji.SUL,  guessMonth: 10, guessDay: 8 },
  { solarLongitude: 225, sajuMonthIndex: 10, branch: Jiji.HAE,  guessMonth: 11, guessDay: 7 },
  { solarLongitude: 255, sajuMonthIndex: 11, branch: Jiji.JA,   guessMonth: 12, guessDay: 7 },
];

const boundaryCache = new Map<number, JeolBoundary[]>();


function evalSeries(
  series: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>>,
  tau: number,
): number {
  let out = 0;
  let tn = 1;
  for (let n = 0; n <= 5; n++) {
    const terms = series[n];
    if (!terms) continue;
    let sub = 0;
    for (let i = 0; i < terms.length; i++) {
      const term = terms[i];
      if (!term) continue;
      sub += term[0] * Math.cos(term[1] + term[2] * tau);
    }
    out += sub * tn;
    tn *= tau;
  }
  return out;
}




function nutation1980Arcsec(T: number): [number, number] {
  const ls2 = 2 * (280.4665 + 36000.7698 * T);
  const lm2 = 2 * (218.3165 + 481267.8813 * T);
  const om = 125.04452 - 1934.136261 * T;
  const om2 = 2 * om;

  const dpsi = -17.20 * Math.sin(toRadians(om))
    - 1.32 * Math.sin(toRadians(ls2))
    - 0.23 * Math.sin(toRadians(lm2))
    + 0.21 * Math.sin(toRadians(om2));

  const deps = 9.20 * Math.cos(toRadians(om))
    + 0.57 * Math.cos(toRadians(ls2))
    + 0.10 * Math.cos(toRadians(lm2))
    - 0.09 * Math.cos(toRadians(om2));

  return [dpsi, deps];
}


function apparentLongitudeDeg(jdTt: number): number {
  const tau = (jdTt - J2000) / 365250;
  const l = evalSeries(VSOP87D_L_TERMS, tau);
  const r = evalSeries(VSOP87D_R_TERMS, tau);

  const lambdaDeg = toDegrees(l + Math.PI);
  const T = (jdTt - J2000) / 36525;
  const [dpsiArcsec] = nutation1980Arcsec(T);
  const aberrDeg = -20.4898 / 3600 / r;
  return wrap360(lambdaDeg + dpsiArcsec / 3600 + aberrDeg);
}


function deltaTSeconds(
  year: number, month: number, day: number,
  hour: number, minute: number,
): number {
  const doy = dayOfYear(year, month, day) + (hour + minute / 60) / 24;
  const dinY = daysInYear(year);
  const y = year + (doy - 0.5) / dinY;

  if (y < 1900) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (y < 1986) {
    const t = y - 1900;
    return -2.79
      + 1.494119 * t
      - 0.0598939 * t ** 2
      + 0.0061966 * t ** 3
      - 0.000197 * t ** 4;
  }
  if (y < 2005) {
    const t = y - 2000;
    return 63.86
      + 0.3345 * t
      - 0.060374 * t ** 2
      + 0.0017275 * t ** 3
      + 0.000651814 * t ** 4
      + 0.00002373599 * t ** 5;
  }
  if (y <= 2050) {
    const t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  }
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}


function solveJdUtc(
  guessYear: number, guessMonth: number, guessDay: number,
  targetLongitude: number,
): number {
  const jdUtcGuess = kstToJdUtc(guessYear, guessMonth, guessDay, 12, 0, 0);
  const dtSec = deltaTSeconds(guessYear, guessMonth, guessDay, 12, 0);
  let jdTt = jdUtcGuess + dtSec / 86400;

  for (let i = 0; i < MAX_NEWTON_ITERATION; i++) {
    const lon = apparentLongitudeDeg(jdTt);
    const delta = norm180(targetLongitude - lon);
    jdTt += delta / NEWTON_STEP_DEG_PER_DAY;
    if (Math.abs(delta) < 1e-9) break;
  }

  let jdUtc = jdTt;
  for (let i = 0; i < MAX_TT_UTC_FIXPOINT_ITERATION; i++) {
    const cal = jdUtcToKst(jdUtc);
    const dt = deltaTSeconds(cal.year, cal.month, cal.day, cal.hour, cal.minute);
    jdUtc = jdTt - dt / 86400;
  }

  return jdUtc;
}




function solveBoundary(year: number, term: JeolTermSpec): JeolBoundary {
  const jdUtc = solveJdUtc(year, term.guessMonth, term.guessDay, term.solarLongitude);
  const kst = jdUtcToKst(jdUtc);
  const rounded = roundToNearestMinute(kst);

  return {
    year: rounded.year,
    month: rounded.month,
    day: rounded.day,
    hour: rounded.hour,
    minute: rounded.minute,
    solarLongitude: term.solarLongitude,
    sajuMonthIndex: term.sajuMonthIndex,
    branch: term.branch,
  };
}


function momentKey(y: number, m: number, d: number, h: number, min: number): number {
  return y * 100_000_000 + m * 1_000_000 + d * 10_000 + h * 100 + min;
}

function boundaryToKey(b: JeolBoundary): number {
  return momentKey(b.year, b.month, b.day, b.hour, b.minute);
}

function compareBoundaries(a: JeolBoundary, b: JeolBoundary): number {
  return boundaryToKey(a) - boundaryToKey(b);
}

function sortedBoundaries(years: readonly number[]): JeolBoundary[] {
  return years
    .flatMap((y) => Vsop87dFallback.boundariesOfYear(y))
    .sort(compareBoundaries);
}

function findLastBoundaryByKey(
  boundaries: readonly JeolBoundary[],
  key: number,
  inclusive: boolean,
): JeolBoundary | undefined {
  let result: JeolBoundary | undefined;
  for (const boundary of boundaries) {
    const match = inclusive ? boundaryToKey(boundary) <= key : boundaryToKey(boundary) < key;
    if (match) {
      result = boundary;
    }
  }
  return result;
}


export const Vsop87dFallback = {
  ipchunOf(year: number): JeolBoundary {
    const boundaries = this.boundariesOfYear(year);
    const ipchun = boundaries.find(b => b.sajuMonthIndex === 1);
    if (!ipchun) {
      throw new Error(`Failed to compute Ipchun for year ${year}`);
    }
    return ipchun;
  },

  sajuMonthIndexAt(
    year: number, month: number, day: number, hour: number, minute: number,
  ): number {
    const allBoundaries = sortedBoundaries([year - 1, year]);

    const key = momentKey(year, month, day, hour, minute);
    let result = findLastBoundaryByKey(allBoundaries, key, false);
    if (!result) {
      result = this.boundariesOfYear(year - 1).at(-1);
    }
    if (!result) {
      throw new Error(`Cannot determine saju month index for ${year}-${month}-${day}`);
    }
    return result.sajuMonthIndex;
  },

  nextBoundaryAfter(
    year: number, month: number, day: number, hour: number, minute: number,
  ): JeolBoundary {
    const allBoundaries = sortedBoundaries([year, year + 1]);

    const key = momentKey(year, month, day, hour, minute);
    const result = allBoundaries.find((boundary) => boundaryToKey(boundary) > key);
    if (!result) {
      const fallback = this.boundariesOfYear(year + 1).at(-1);
      if (!fallback) {
        throw new Error(`No boundaries found for year ${year + 1}`);
      }
      return fallback;
    }
    return result;
  },

  previousBoundaryAtOrBefore(
    year: number, month: number, day: number, hour: number, minute: number,
  ): JeolBoundary {
    const allBoundaries = sortedBoundaries([year - 1, year]);

    const key = momentKey(year, month, day, hour, minute);
    let result = findLastBoundaryByKey(allBoundaries, key, true);
    if (!result) {
      const fallback = this.boundariesOfYear(year - 1)[0];
      if (!fallback) {
        throw new Error(`No boundaries found for year ${year - 1}`);
      }
      return fallback;
    }
    return result;
  },

  boundariesOfYear(year: number): JeolBoundary[] {
    let cached = boundaryCache.get(year);
    if (cached) return cached;

    const boundaries = TERM_SPECS.map(spec => solveBoundary(year, spec));
    boundaries.sort(compareBoundaries);
    boundaryCache.set(year, boundaries);
    return boundaries;
  },
} as const;
