import type { SajuRequest } from '../api/types.js';
import type { ParsedInstant } from './iso.js';

// Optional dev-time helper:
//
// This adapter delegates to the vendored /cal package **if it is built**.
// The core engine does NOT depend on /cal for normal operation.
//
// Why this is dynamic:
// - The repository may be used without building /cal.
// - Static import would crash module loading when cal/dist is missing.
//
// Node >=20 supports top-level await in ESM.
type CalculateSajuPillarsFn = (args: any) => any;

let calculateSajuPillars: CalculateSajuPillarsFn | null = null;
let calLoadError: unknown = null;

try {
  // @ts-ignore optional module may not exist until /cal is built.
  const mod: any = await import('../../cal/dist/src/index.js');
  calculateSajuPillars = mod?.calculateSajuPillars as CalculateSajuPillarsFn;
} catch (err) {
  calLoadError = err;
}

type CalGender = 'MALE' | 'FEMALE';

export type CalSolarTimeMode = 'NONE' | 'LMT' | 'APPARENT';

export interface CalTimeAdapterOptions {
  /**
   * How to treat local solar time when converting the birth instant.
   *
   * - NONE: no shift (standard civil time)
   * - LMT: apply longitude correction only (Local Mean Time)
   * - APPARENT: longitude correction + equation of time (apparent solar time)
   *
   * Default: 'LMT' (backward-compatible with the previous hardcoded behavior).
   */
  solarTimeMode?: CalSolarTimeMode;

  /**
   * If true, throw when location.lat/lon is missing and solarTimeMode is not NONE.
   * Default: true (avoid silently assuming a fallback location).
   */
  requireLocation?: boolean;
}

interface CalConversionResult {
  normalized: {
    datetime: {
      toISO(opts?: { suppressMilliseconds?: boolean }): string | null;
    };
  };
}

function parseSecond(instant: string): number {
  const m = instant.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!m) return 0;
  return m[6] ? Number(m[6]) : 0;
}

function toUtcOffsetZone(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'UTC';

  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return `UTC${sign}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function toCalGender(sex: SajuRequest['sex']): CalGender {
  return sex === 'F' ? 'FEMALE' : 'MALE';
}

function resolveLocation(location: SajuRequest['location']): { lat: number; lon: number; name?: string } | null {
  if (location && Number.isFinite(location.lat) && Number.isFinite(location.lon)) {
    return { lat: location.lat, lon: location.lon, name: location.name };
  }
  return null;
}

export function adjustInstantWithCal(input: SajuRequest, parsed: ParsedInstant, opts: CalTimeAdapterOptions = {}): string {
  if (!calculateSajuPillars) {
    const hint = 'calTimeAdapter requires the optional ./cal package to be built (npm -C cal ci && npm -C cal run build)';
    const cause = (calLoadError instanceof Error)
      ? calLoadError.message
      : (calLoadError ? String(calLoadError) : 'unknown');
    throw new Error(`${hint}. Import error: ${cause}`);
  }

  const mode: CalSolarTimeMode = opts.solarTimeMode ?? 'LMT';

  if (mode === 'NONE') return input.birth.instant;

  const loc = resolveLocation(input.location);
  if (!loc) {
    if (opts.requireLocation ?? true) {
      throw new Error('cal time adapter requires location.lat/lon when solarTimeMode is not NONE');
    }
    // No location: cannot apply LMT/APPARENT; return as-is.
    return input.birth.instant;
  }

  const second = parseSecond(input.birth.instant);
  const zoneId = toUtcOffsetZone(parsed.offsetMinutes);
  const local = parsed.localDateTime;

  const result = calculateSajuPillars({
    year: local.date.y,
    month: local.date.m,
    day: local.date.d,
    hour: local.time.h,
    minute: local.time.min,
    second,
    zoneId,
    latitude: loc.lat,
    longitude: loc.lon,
    gender: toCalGender(input.sex),
    solarTimeMode: mode,
  }) as CalConversionResult;

  const adjustedIso = result.normalized.datetime.toISO({ suppressMilliseconds: true });
  if (!adjustedIso) {
    throw new Error('cal time adapter produced empty adjusted datetime');
  }
  return adjustedIso;
}
