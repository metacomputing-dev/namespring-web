import type {
  EngineConfig,
  LongitudeCorrectionPolicy,
  SajuRequest,
} from '../api/types.js';
import type { LocalDateTime } from './iso.js';
import { addDays } from './pillars.js';
import { equationOfTimeMinutesPrecise } from './solar.js';
import { utcMsToJulianDay } from './julian.js';
import { utcMsFromParts } from './utc.js';

const MS_PER_DAY = 86_400_000;

/**
 * True solar time correction = longitude correction (LMST vs local standard time)
 * + equation of time (AST vs MST).
 *
 * This module is intentionally compact and “math-first”:
 * - Longitude correction: 4 minutes per degree difference from the zone meridian.
 * - Equation of time: NOAA-style trigonometric approximation (minutes).
 *
 * References:
 * - NOAA Solar Calculator equations (gamma / EoT)
 * - Standard definition: EoT = Apparent Solar Time - Mean Solar Time
 */
export interface TrueSolarTimeCorrection {
  enabled: boolean;
  applied: boolean;

  /** Reason if not applied even though enabled. */
  reason?: string;

  method: 'none' | 'approx' | 'precise';

  longitudeDeg?: number;
  standardMeridianDeg?: number;
  longitudeCorrectionPolicy?: LongitudeCorrectionPolicy['mode'];

  longitudeCorrectionMinutes?: number;
  equationOfTimeMinutes?: number;
  totalCorrectionMinutes?: number;

  formula?: string;
}

/**
 * NOAA-style approximation of equation of time (minutes).
 * Good enough for “hour pillar boundary” use cases.
 */
export function equationOfTimeMinutesApprox(utcMs: number): number {
  const d = new Date(utcMs);
  const year = d.getUTCFullYear();

  const dayStartUtc = utcMsFromParts(year, d.getUTCMonth(), d.getUTCDate());
  const yearStartUtc = utcMsFromParts(year, 0, 1);
  const doy = Math.floor((dayStartUtc - yearStartUtc) / MS_PER_DAY) + 1;

  const hour =
    d.getUTCHours() +
    d.getUTCMinutes() / 60 +
    d.getUTCSeconds() / 3600 +
    d.getUTCMilliseconds() / 3_600_000;

  const gamma = (2 * Math.PI / 365) * (doy - 1 + (hour - 12) / 24);

  const eot =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  return eot;
}

/** Shortest signed angular distance from a reference meridian, in [-180, 180). */
export function shortestSignedLongitudeDeltaDeg(
  longitudeDeg: number,
  referenceMeridianDeg: number,
): number {
  if (!Number.isFinite(longitudeDeg) || !Number.isFinite(referenceMeridianDeg)) {
    throw new TypeError('Longitude and reference meridian must be finite numbers.');
  }

  const wrapped = ((longitudeDeg - referenceMeridianDeg + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

/** Longitude correction against an explicit reference meridian. */
export function longitudeCorrectionMinutesFromMeridian(
  longitudeDeg: number,
  referenceMeridianDeg: number,
): number {
  return 4 * shortestSignedLongitudeDeltaDeg(longitudeDeg, referenceMeridianDeg);
}

/**
 * Backward-compatible helper using the civil UTC-offset meridian.
 *
 * LST = UTC + offsetHours
 * LMST = UTC + lon/15
 * LMST - LST = 4 * shortestDelta(lon, 15 * offsetHours) minutes
 */
export function longitudeCorrectionMinutes(offsetMinutes: number, longitudeDeg: number): number {
  const standardMeridianDeg = (offsetMinutes / 60) * 15;
  return longitudeCorrectionMinutesFromMeridian(longitudeDeg, standardMeridianDeg);
}

export function computeTrueSolarTimeCorrection(args: {
  utcMs: number;
  offsetMinutes: number;
  location: SajuRequest['location'] | undefined;
  policy: EngineConfig['calendar']['trueSolarTime'];
  /**
   * 엔진의 calendar 정밀도 설정 — 'precise' EoT가 절기 계산과 동일한
   * solarPrecision/aberrationModel을 상속하도록 전달한다 (감사 A15f.
   * 미전달 시 solar.ts 기본값으로 계산).
   */
  precision?: {
    solarPrecision?: EngineConfig['calendar']['solarPrecision'];
    aberrationModel?: EngineConfig['calendar']['aberrationModel'];
  };
}): TrueSolarTimeCorrection {
  const { utcMs, offsetMinutes, location, policy, precision } = args;

  if (!policy?.enabled) {
    return {
      enabled: false,
      applied: false,
      method: 'none',
      totalCorrectionMinutes: 0,
      reason: 'disabled',
      formula: 'Δ = 0 (trueSolarTime.disabled)',
    };
  }

  const longitudePolicy = policy.longitudeCorrectionPolicy
    ?? { mode: 'civilOffsetMeridian' as const };
  const lon = location?.lon;
  const requiresLongitude = longitudePolicy.mode !== 'off';
  if (requiresLongitude && (typeof lon !== 'number' || !Number.isFinite(lon))) {
    return {
      enabled: true,
      applied: false,
      method: 'none',
      longitudeCorrectionPolicy: longitudePolicy.mode,
      totalCorrectionMinutes: 0,
      reason: 'location.lon missing',
      formula: 'Δ = 0 (no longitude)',
    };
  }

  let stdMer: number | undefined;
  let lonCorr = 0;
  if (longitudePolicy.mode === 'civilOffsetMeridian') {
    stdMer = (offsetMinutes / 60) * 15;
    lonCorr = longitudeCorrectionMinutesFromMeridian(lon as number, stdMer);
  } else if (longitudePolicy.mode === 'fixedMeridian') {
    if (!Number.isFinite(longitudePolicy.meridianDeg)) {
      throw new TypeError('fixedMeridian.meridianDeg must be a finite number.');
    }
    stdMer = longitudePolicy.meridianDeg;
    lonCorr = longitudeCorrectionMinutesFromMeridian(lon as number, stdMer);
  } else if (longitudePolicy.mode !== 'off') {
    throw new TypeError(`Unsupported longitude correction policy: ${String((longitudePolicy as any).mode)}`);
  }

  let eot: number;
  let method: TrueSolarTimeCorrection['method'];
  if (policy.equationOfTime === 'precise') {
    eot = equationOfTimeMinutesPrecise(
      utcMsToJulianDay(utcMs),
      precision?.aberrationModel,
      precision?.solarPrecision,
    );
    method = 'precise';
  } else if (policy.equationOfTime === 'approx') {
    eot = equationOfTimeMinutesApprox(utcMs);
    method = 'approx';
  } else {
    eot = 0;
    method = 'none';
  }

  const total = lonCorr + eot;

  return {
    enabled: true,
    applied: true,
    method,
    longitudeCorrectionPolicy: longitudePolicy.mode,
    ...(typeof lon === 'number' && Number.isFinite(lon) ? { longitudeDeg: lon } : {}),
    standardMeridianDeg: stdMer,
    longitudeCorrectionMinutes: lonCorr,
    equationOfTimeMinutes: eot,
    totalCorrectionMinutes: total,
    formula: longitudePolicy.mode === 'off'
      ? 'T_solar = T_civil + EoT (longitude correction off)'
      : 'T_solar = T_civil + 4*shortestDelta(lon,stdMeridian) + EoT',
  };
}

/**
 * Apply a minute offset to a LocalDateTime (used for true solar time representation).
 *
 * This does NOT change the underlying instant; it only adjusts the local “clock reading”
 * used for pillar boundary classification.
 */
export function applyMinuteOffsetToLocalDateTime(ldt: LocalDateTime, deltaMinutes: number): LocalDateTime {
  const total = ldt.time.h * 60 + ldt.time.min + deltaMinutes;

  // Math.floor works as desired for negative totals (e.g. -10 min => -1 day).
  const dayDelta = Math.floor(total / 1440);
  const rem = total - dayDelta * 1440; // in [0,1440)

  const hh = Math.floor(rem / 60);
  const mm = Math.floor(rem - hh * 60);

  return {
    date: addDays(ldt.date, dayDelta),
    time: { h: hh, min: mm },
    offsetMinutes: ldt.offsetMinutes,
  };
}
