/**
 * Timezone conversion primitives used by the legacy Spring compatibility
 * adapter. This module owns only civil-time/offset concerns; saju policy and
 * calculations remain in springLegacy.ts.
 */

export interface CivilDateTime {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
}

export class LegacyTimezoneError extends Error {
  readonly code = 'SAJU_LEGACY_TIMEZONE_INVALID';
  readonly timeZone: string;

  constructor(timeZone: string, cause?: unknown) {
    super(`Invalid or unsupported legacy timezone: ${timeZone}`, { cause });
    this.name = 'LegacyTimezoneError';
    this.timeZone = timeZone;
  }
}

// Exported for the standard-time transition fixtures
// (springLegacyTimezone.test.ts, audit B10/A15a).
export function parseOffsetToken(token: string): number | null {
  const s = token.trim().toUpperCase().replace('UTC', 'GMT');
  if (s === 'GMT' || s === 'GMT+0' || s === 'GMT+00' || s === 'GMT+00:00') return 0;

  // Include seconds: pre-1908 Seoul LMT is formatted as GMT+8:27:52.
  const match = s.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?(?::(\d{2}))?$/);
  if (!match) return null;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  if (
    !Number.isFinite(hours)
    || !Number.isFinite(minutes)
    || !Number.isFinite(seconds)
  ) {
    return null;
  }

  return sign * Math.round(hours * 60 + minutes + seconds / 60);
}

let warnedOffsetFailure = false;

function offsetAtUtcMs(utcMs: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcMs));

    const zoneName = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+00:00';
    const parsed = parseOffsetToken(zoneName);
    if (parsed == null && !warnedOffsetFailure) {
      warnedOffsetFailure = true;
      // A silent +09:00 fallback can hide roughly 32 minutes of historical
      // error, so expose the failure at least once before rejecting.
      console.warn(
        `[saju-ts/springLegacy] failed to parse tz offset token "${zoneName}" (${timeZone}); rejecting input`,
      );
    }
    if (parsed == null) throw new LegacyTimezoneError(timeZone);
    return parsed;
  } catch (cause) {
    if (cause instanceof LegacyTimezoneError) throw cause;
    if (!warnedOffsetFailure) {
      warnedOffsetFailure = true;
      console.warn(
        `[saju-ts/springLegacy] Intl offset lookup failed for tz "${timeZone}"; rejecting input`,
      );
    }
    throw new LegacyTimezoneError(timeZone, cause);
  }
}

function longZoneNameAtUtcMs(utcMs: number, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'long' })
      .formatToParts(new Date(utcMs));
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

const DST_SCAN_STEP_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Measures daylight-saving adjustment at a UTC instant.
 *
 * 1) ICU long names containing Standard mean zero; Daylight/Summer confirm DST.
 * 2) Where historical Korean display names are unavailable, samples on both
 *    sides distinguish temporary DST from one-sided standard-meridian changes.
 */
export function dstMinutesAtUtcMs(utcMs: number, timeZone: string): number {
  const name = longZoneNameAtUtcMs(utcMs, timeZone);
  if (/standard/i.test(name)) return 0;
  const isNamedDst = /daylight|summer/i.test(name);
  const offset = offsetAtUtcMs(utcMs, timeZone);
  let minBefore = offset;
  let minAfter = offset;
  for (let sample = 1; sample <= 9; sample++) {
    minBefore = Math.min(
      minBefore,
      offsetAtUtcMs(utcMs - sample * DST_SCAN_STEP_MS, timeZone),
    );
    minAfter = Math.min(
      minAfter,
      offsetAtUtcMs(utcMs + sample * DST_SCAN_STEP_MS, timeZone),
    );
  }
  const excess = Math.max(0, offset - Math.max(minBefore, minAfter));
  return isNamedDst ? (excess || 60) : excess;
}

export function resolveOffsetMinutes(
  timeZone: string,
  civil: CivilDateTime,
): number {
  const parsedFromToken = parseOffsetToken(timeZone);
  if (parsedFromToken != null) return parsedFromToken;

  const utcGuess = Date.UTC(civil.y, civil.m - 1, civil.d, civil.h, civil.min, 0);
  try {
    const probeParts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcGuess));
    const probeToken = probeParts
      .find((part) => part.type === 'timeZoneName')
      ?.value ?? '';
    if (parseOffsetToken(probeToken) == null) {
      throw new LegacyTimezoneError(timeZone);
    }
  } catch (cause) {
    if (cause instanceof LegacyTimezoneError) throw cause;
    throw new LegacyTimezoneError(timeZone, cause);
  }
  const first = offsetAtUtcMs(utcGuess, timeZone);
  const correctedUtc = utcGuess - first * 60_000;
  const second = offsetAtUtcMs(correctedUtc, timeZone);
  return second;
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const absolute = Math.abs(minutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
  const remainder = String(absolute % 60).padStart(2, '0');
  return `${sign}${hours}:${remainder}`;
}

export function addCivilMinutes(
  civil: CivilDateTime,
  deltaMinutes: number,
): CivilDateTime {
  if (!deltaMinutes) return { ...civil };

  const utcMs = Date.UTC(civil.y, civil.m - 1, civil.d, civil.h, civil.min, 0);
  const shifted = new Date(utcMs + deltaMinutes * 60_000);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    min: shifted.getUTCMinutes(),
  };
}

export function civilToIsoInstant(
  civil: CivilDateTime,
  offsetMinutes: number,
): string {
  const year = String(civil.y).padStart(4, '0');
  const month = String(civil.m).padStart(2, '0');
  const day = String(civil.d).padStart(2, '0');
  const hour = String(civil.h).padStart(2, '0');
  const minute = String(civil.min).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:00${formatOffset(offsetMinutes)}`;
}
