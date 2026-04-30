import { mod } from '../core/mod.js';
import { julianDayToUtcMs, utcMsToJulianDay } from './julian.js';
import {
  solarApparentLongitudeDeg,
  solarLongitudeRateDegPerDay,
  type AberrationModel,
} from './solar.js';

/**
 * Solar-term utilities.
 *
 * Goals:
 * - Math-first (longitude roots) rather than lookup tables
 * - Minimal, explicit data only for (id ↔ longitude ↔ rough bracket date)
 * - Cache by (method, year)
 */

export type SolarTermMethod = 'approx' | 'meeus';
export type SolarTermAlgorithm = 'bisection' | 'newton';

const DEFAULT_ALGORITHM: SolarTermAlgorithm = 'bisection';
const DEFAULT_ABERRATION: AberrationModel = 'constant';

/**
 * 24절기(二十四節氣) — identified by the target longitude (deg) of Sun's
 * apparent ecliptic longitude λ.
 */
export type SolarTermId =
  | 'XIAOHAN'
  | 'DAHAN'
  | 'LICHUN'
  | 'YUSHUI'
  | 'JINGZHE'
  | 'CHUNFEN'
  | 'QINGMING'
  | 'GUYU'
  | 'LIXIA'
  | 'XIAOMAN'
  | 'MANGZHONG'
  | 'XIAZHI'
  | 'XIAOSHU'
  | 'DASHU'
  | 'LIQIU'
  | 'CHUSHU'
  | 'BAILU'
  | 'QIUFEN'
  | 'HANLU'
  | 'SHUANGJIANG'
  | 'LIDONG'
  | 'XIAOXUE'
  | 'DAXUE'
  | 'DONGZHI';

/**
 * 12절(節) — used as month boundaries in many Four Pillars schools.
 *
 * This is the “odd 15° multiples” subset of the 24 solar terms.
 */
export type JieTermId =
  | 'XIAOHAN'
  | 'LICHUN'
  | 'JINGZHE'
  | 'QINGMING'
  | 'LIXIA'
  | 'MANGZHONG'
  | 'XIAOSHU'
  | 'LIQIU'
  | 'BAILU'
  | 'HANLU'
  | 'LIDONG'
  | 'DAXUE';

export interface SolarTermInstant {
  id: SolarTermId;
  /** Gregorian year used to compute this term */
  year: number;
  /** target longitude (deg) */
  longitude: number;
  /** boundary instant in UTC (epoch ms) */
  utcMs: number;
}

export interface SolarTermsAround {
  baseYear: number;
  method: SolarTermMethod;
  /** Combined (baseYear-1, baseYear, baseYear+1) terms sorted by utcMs. */
  terms: SolarTermInstant[];
}

export interface JieBoundariesAround {
  baseYear: number;
  method: SolarTermMethod;
  /** Combined (baseYear-1, baseYear, baseYear+1) boundaries sorted by utcMs. */
  terms: SolarTermInstant[];
}

interface TermSpec {
  id: SolarTermId;
  longitude: number;
  /** rough Gregorian guess in UTC for bracketing */
  approx: { m: number; d: number };
}

const SOLAR_TERMS_24: readonly TermSpec[] = [
  // Winter → Spring
  { id: 'XIAOHAN', longitude: 285, approx: { m: 1, d: 6 } },
  { id: 'DAHAN', longitude: 300, approx: { m: 1, d: 20 } },
  { id: 'LICHUN', longitude: 315, approx: { m: 2, d: 4 } },
  { id: 'YUSHUI', longitude: 330, approx: { m: 2, d: 19 } },
  { id: 'JINGZHE', longitude: 345, approx: { m: 3, d: 6 } },
  { id: 'CHUNFEN', longitude: 0, approx: { m: 3, d: 20 } },
  { id: 'QINGMING', longitude: 15, approx: { m: 4, d: 5 } },
  { id: 'GUYU', longitude: 30, approx: { m: 4, d: 20 } },

  // Spring → Summer
  { id: 'LIXIA', longitude: 45, approx: { m: 5, d: 5 } },
  { id: 'XIAOMAN', longitude: 60, approx: { m: 5, d: 21 } },
  { id: 'MANGZHONG', longitude: 75, approx: { m: 6, d: 6 } },
  { id: 'XIAZHI', longitude: 90, approx: { m: 6, d: 21 } },
  { id: 'XIAOSHU', longitude: 105, approx: { m: 7, d: 7 } },
  { id: 'DASHU', longitude: 120, approx: { m: 7, d: 23 } },

  // Summer → Autumn
  { id: 'LIQIU', longitude: 135, approx: { m: 8, d: 7 } },
  { id: 'CHUSHU', longitude: 150, approx: { m: 8, d: 23 } },
  { id: 'BAILU', longitude: 165, approx: { m: 9, d: 8 } },
  { id: 'QIUFEN', longitude: 180, approx: { m: 9, d: 23 } },
  { id: 'HANLU', longitude: 195, approx: { m: 10, d: 8 } },
  { id: 'SHUANGJIANG', longitude: 210, approx: { m: 10, d: 23 } },

  // Autumn → Winter
  { id: 'LIDONG', longitude: 225, approx: { m: 11, d: 7 } },
  { id: 'XIAOXUE', longitude: 240, approx: { m: 11, d: 22 } },
  { id: 'DAXUE', longitude: 255, approx: { m: 12, d: 7 } },
  { id: 'DONGZHI', longitude: 270, approx: { m: 12, d: 21 } },
];

const SPEC_BY_ID = new Map<SolarTermId, TermSpec>(SOLAR_TERMS_24.map((s) => [s.id, s]));
const APPROX_BY_LONGITUDE = new Map<number, { m: number; d: number }>(SOLAR_TERMS_24.map((s) => [modDeg(s.longitude), s.approx]));

const JIE_IDS: readonly JieTermId[] = [
  'XIAOHAN',
  'LICHUN',
  'JINGZHE',
  'QINGMING',
  'LIXIA',
  'MANGZHONG',
  'XIAOSHU',
  'LIQIU',
  'BAILU',
  'HANLU',
  'LIDONG',
  'DAXUE',
];

const JIE_SET = new Set<SolarTermId>(JIE_IDS);

const MS_PER_DAY = 86_400_000;

function modDeg(deg: number): number {
  return mod(deg, 360);
}

/**
 * Smallest signed difference (a - b) in degrees, in (-180, 180].
 */
function angleDiffDeg(a: number, b: number): number {
  const d = modDeg(a - b + 180) - 180;
  return d <= -180 ? d + 360 : d;
}

/**
 * Keep the legacy export name for compatibility; delegate to shared solar model.
 */
export function sunApparentLongitudeDeg(
  jd: number,
  aberrationModel: AberrationModel = DEFAULT_ABERRATION,
): number {
  return solarApparentLongitudeDeg(jd, aberrationModel);
}

/** Re-exported for convenience (and backward-compat). */
export { utcMsToJulianDay, julianDayToUtcMs };

export function solarTermLongitude(id: SolarTermId): number {
  const spec = SPEC_BY_ID.get(id);
  if (!spec) throw new Error(`Unknown solar term id: ${id}`);
  return modDeg(spec.longitude);
}

export function isJieTermId(id: SolarTermId): id is JieTermId {
  return JIE_SET.has(id);
}

/**
 * 12절(節)의 "월 차수"(0..11) — 寅월(立春)부터 시작.
 *
 * Formula: m = floor(((λ - 315) mod 360) / 30).
 */
export function jieTermMonthOrder(id: JieTermId): number {
  const lon = solarTermLongitude(id);
  return Math.floor(modDeg(lon - 315) / 30);
}

function roughApproxDateForLongitude(year: number, longitude: number): { m: number; d: number } {
  // Very rough mapping: assume longitude increases ~360° per tropical year.
  // For bracketing we just need a guess within ±30 days.
  // Map 0° (~春分) to Mar 20.
  const base = Date.UTC(year, 2, 20, 0, 0, 0); // Mar 20
  const days = Math.round((modDeg(longitude) / 360) * 365.2422);
  const ms = base + days * MS_PER_DAY;
  const dt = new Date(ms);
  return { m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function findBracketForLongitude(
  year: number,
  targetLongitude: number,
  approx: { m: number; d: number },
  aberrationModel: AberrationModel = DEFAULT_ABERRATION,
): { aJd: number; bJd: number } {
  // Start from a rough UTC guess and scan for a sign change.
  const guessUtcMs = Date.UTC(year, approx.m - 1, approx.d, 0, 0, 0);
  const guessJd = utcMsToJulianDay(guessUtcMs);

  const windowDays = 30; // conservative
  let prevJd = guessJd - windowDays;
  let prevF = angleDiffDeg(sunApparentLongitudeDeg(prevJd, aberrationModel), targetLongitude);

  for (let k = 1; k <= windowDays * 2; k++) {
    const jd = guessJd - windowDays + k;
    const f = angleDiffDeg(sunApparentLongitudeDeg(jd, aberrationModel), targetLongitude);

    if (prevF === 0) return { aJd: prevJd, bJd: prevJd };
    if (f === 0) return { aJd: jd, bJd: jd };

    if (prevF * f < 0) {
      return { aJd: prevJd, bJd: jd };
    }

    prevJd = jd;
    prevF = f;
  }

  throw new Error(
    `Unable to bracket solar term for year=${year}, target=${targetLongitude}° within ±${windowDays} days of ${approx.m}/${approx.d}.`,
  );
}

/**
 * Newton-Raphson longitude root finder.
 *
 * Returns a JD whose apparent solar longitude equals `targetLongitude`,
 * starting from `jd0` and using the analytic-ish derivative provided by
 * {@link solarLongitudeRateDegPerDay}. Converges in roughly 5 iterations
 * for solar-term targets because λ(t) is locally near-linear at the
 * sub-day scale.
 *
 * Failure modes (degenerate derivative, non-finite values) cause the
 * function to return its current best estimate rather than throw, so
 * the caller can layer a robust fallback (e.g. bisection) around it.
 *
 * Tolerance is fixed at ~1e-7° (≈ 0.0004″), well below the engine's
 * underlying solar-longitude precision.
 *
 * Note: not yet wired into the engine; an upcoming commit will let the
 * caller dispatch between bisection and this function via config.
 */
function newtonLongitudeRoot(
  jd0: number,
  targetLongitude: number,
  aberrationModel: AberrationModel = DEFAULT_ABERRATION,
): number {
  const maxIter = 10;
  const tolDeg = 1e-7;
  let jd = jd0;

  for (let i = 0; i < maxIter; i++) {
    const f = angleDiffDeg(sunApparentLongitudeDeg(jd, aberrationModel), targetLongitude);
    if (Math.abs(f) < tolDeg) return jd;

    const dfdt = solarLongitudeRateDegPerDay(jd, aberrationModel);
    if (!Number.isFinite(dfdt) || Math.abs(dfdt) < 1e-9) {
      return jd;
    }

    jd -= f / dfdt;
  }

  return jd;
}

function bisectLongitudeRoot(
  aJd: number,
  bJd: number,
  targetLongitude: number,
  aberrationModel: AberrationModel = DEFAULT_ABERRATION,
): number {
  if (aJd === bJd) return aJd;

  let a = aJd;
  let b = bJd;
  let fa = angleDiffDeg(sunApparentLongitudeDeg(a, aberrationModel), targetLongitude);
  let fb = angleDiffDeg(sunApparentLongitudeDeg(b, aberrationModel), targetLongitude);

  if (fa === 0) return a;
  if (fb === 0) return b;

  // In rare numeric edge cases, fall back to “closest” instead of throwing.
  if (fa * fb > 0) {
    return Math.abs(fa) < Math.abs(fb) ? a : b;
  }

  for (let i = 0; i < 64; i++) {
    const mid = (a + b) / 2;
    const fm = angleDiffDeg(sunApparentLongitudeDeg(mid, aberrationModel), targetLongitude);

    if (fm === 0) return mid;

    if (fa * fm < 0) {
      b = mid;
      fb = fm;
    } else {
      a = mid;
      fa = fm;
    }

    // Stop when interval < ~1 second.
    if ((b - a) * MS_PER_DAY < 1000) break;
  }

  return (a + b) / 2;
}

/**
 * Core solver: find UTC ms when the Sun's apparent longitude reaches a target value.
 */
export function solarTermUtcMsForLongitude(
  year: number,
  longitude: number,
  method: SolarTermMethod,
  algorithm: SolarTermAlgorithm = DEFAULT_ALGORITHM,
  aberrationModel: AberrationModel = DEFAULT_ABERRATION,
): number {
  const normalized = modDeg(longitude);
  const approx = APPROX_BY_LONGITUDE.get(normalized) ?? roughApproxDateForLongitude(year, normalized);

  if (method === 'approx') {
    return Date.UTC(year, approx.m - 1, approx.d, 0, 0, 0);
  }

  const { aJd, bJd } = findBracketForLongitude(year, normalized, approx, aberrationModel);
  const rootJd =
    algorithm === 'newton'
      ? newtonLongitudeRoot((aJd + bJd) / 2, normalized, aberrationModel)
      : bisectLongitudeRoot(aJd, bJd, normalized, aberrationModel);
  return Math.round(julianDayToUtcMs(rootJd));
}

const cacheSolar = new Map<string, SolarTermInstant[]>();
const cacheJie = new Map<string, SolarTermInstant[]>();

export function getSolarTerms(
  year: number,
  method: SolarTermMethod,
  algorithm: SolarTermAlgorithm = DEFAULT_ALGORITHM,
  aberrationModel: AberrationModel = DEFAULT_ABERRATION,
): SolarTermInstant[] {
  const key = `${method}:${algorithm}:${aberrationModel}:${year}`;
  const cached = cacheSolar.get(key);
  if (cached) return cached;

  const out: SolarTermInstant[] = SOLAR_TERMS_24.map((spec) => ({
    id: spec.id,
    year,
    longitude: modDeg(spec.longitude),
    utcMs: solarTermUtcMsForLongitude(year, spec.longitude, method, algorithm, aberrationModel),
  })).sort((a, b) => a.utcMs - b.utcMs);

  cacheSolar.set(key, out);
  return out;
}

export function getJieBoundaries(
  year: number,
  method: SolarTermMethod,
  algorithm: SolarTermAlgorithm = DEFAULT_ALGORITHM,
  aberrationModel: AberrationModel = DEFAULT_ABERRATION,
): SolarTermInstant[] {
  const key = `${method}:${algorithm}:${aberrationModel}:${year}`;
  const cached = cacheJie.get(key);
  if (cached) return cached;

  const out = getSolarTerms(year, method, algorithm, aberrationModel)
    .filter((t) => isJieTermId(t.id))
    .sort((a, b) => a.utcMs - b.utcMs);

  cacheJie.set(key, out);
  return out;
}

export function getSolarTermsAround(
  baseYear: number,
  method: SolarTermMethod,
  algorithm: SolarTermAlgorithm = DEFAULT_ALGORITHM,
  aberrationModel: AberrationModel = DEFAULT_ABERRATION,
): SolarTermsAround {
  const terms = [
    ...getSolarTerms(baseYear - 1, method, algorithm, aberrationModel),
    ...getSolarTerms(baseYear, method, algorithm, aberrationModel),
    ...getSolarTerms(baseYear + 1, method, algorithm, aberrationModel),
  ].sort((a, b) => a.utcMs - b.utcMs);

  return { baseYear, method, terms };
}

export function getJieBoundariesAround(
  baseYear: number,
  method: SolarTermMethod,
  algorithm: SolarTermAlgorithm = DEFAULT_ALGORITHM,
  aberrationModel: AberrationModel = DEFAULT_ABERRATION,
): JieBoundariesAround {
  const terms = [
    ...getJieBoundaries(baseYear - 1, method, algorithm, aberrationModel),
    ...getJieBoundaries(baseYear, method, algorithm, aberrationModel),
    ...getJieBoundaries(baseYear + 1, method, algorithm, aberrationModel),
  ].sort((a, b) => a.utcMs - b.utcMs);

  return { baseYear, method, terms };
}

export function getLiChunUtcMs(
  year: number,
  method: SolarTermMethod,
  algorithm: SolarTermAlgorithm = DEFAULT_ALGORITHM,
  aberrationModel: AberrationModel = DEFAULT_ABERRATION,
): number {
  const terms = getJieBoundaries(year, method, algorithm, aberrationModel);
  const liChun = terms.find((t) => t.id === 'LICHUN');
  if (!liChun) throw new Error('Invariant: LICHUN missing from Jie terms');
  return liChun.utcMs;
}

// --- Optional conveniences

export function listJieTermIds(): readonly JieTermId[] {
  return JIE_IDS;
}
