/**
 * Timezone conversion primitives used by the legacy Spring compatibility
 * adapter. This module owns only civil-time/offset concerns; saju policy and
 * calculations remain in springLegacy.ts.
 */

import { utcMsFromParts } from '../calendar/utc.js';

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

/**
 * Raised when the host ICU/tzdb cannot satisfy the historical timezone
 * contract required by the legacy compatibility adapter.
 *
 * Deliberately does not retain the probe failure as `cause`: runtime-specific
 * Intl errors must not escape through the public error object.
 */
export class LegacyTimezoneDataUnsupportedError extends Error {
  readonly code = 'SAJU_LEGACY_TIMEZONE_DATA_UNSUPPORTED' as const;

  constructor() {
    super('Required historical timezone data is unavailable in this runtime');
    this.name = 'LegacyTimezoneDataUnsupportedError';
  }
}

export type LegacyCivilTimeErrorCode =
  | 'SAJU_LEGACY_TIME_NONEXISTENT'
  | 'SAJU_LEGACY_TIME_AMBIGUOUS';

/**
 * Base class for civil times that cannot identify exactly one IANA instant.
 * Fixed-offset inputs never use this error path because their mapping is
 * unique by definition.
 */
export class LegacyCivilTimeError<
  Code extends LegacyCivilTimeErrorCode = LegacyCivilTimeErrorCode,
> extends Error {
  readonly code: Code;
  readonly timeZone: string;
  readonly civil: Readonly<CivilDateTime>;

  protected constructor(
    code: Code,
    message: string,
    timeZone: string,
    civil: CivilDateTime,
  ) {
    super(message);
    this.name = 'LegacyCivilTimeError';
    this.code = code;
    this.timeZone = timeZone;
    this.civil = Object.freeze({ ...civil });
  }
}

export class LegacyNonexistentTimeError extends LegacyCivilTimeError<
  'SAJU_LEGACY_TIME_NONEXISTENT'
> {
  constructor(timeZone: string, civil: CivilDateTime) {
    super(
      'SAJU_LEGACY_TIME_NONEXISTENT',
      `Nonexistent legacy civil time in ${timeZone}: ${formatCivil(civil)}`,
      timeZone,
      civil,
    );
    this.name = 'LegacyNonexistentTimeError';
  }
}

export class LegacyAmbiguousTimeError extends LegacyCivilTimeError<
  'SAJU_LEGACY_TIME_AMBIGUOUS'
> {
  constructor(timeZone: string, civil: CivilDateTime) {
    super(
      'SAJU_LEGACY_TIME_AMBIGUOUS',
      `Ambiguous legacy civil time in ${timeZone}: ${formatCivil(civil)}`,
      timeZone,
      civil,
    );
    this.name = 'LegacyAmbiguousTimeError';
  }
}

// Exported for the standard-time transition fixtures
// (springLegacyTimezone.test.ts, audit B10/A15a).
export function parseOffsetToken(token: string): number | null {
  const s = token.trim().toUpperCase();
  if (s === 'GMT' || s === 'UTC') return 0;

  // Include seconds: pre-1908 Seoul LMT is formatted as GMT+8:27:52.
  const match = s.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?(?::(\d{2}))?$/);
  if (!match) return null;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  if (
    !Number.isFinite(hours)
    || !Number.isFinite(minutes)
    || !Number.isFinite(seconds)
    || hours > 14
    || minutes > 59
    || seconds > 59
    || (hours === 14 && (minutes !== 0 || seconds !== 0))
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

interface LegacyTimezoneDataProbe {
  readonly utcMs: number;
  readonly timeZone: string;
  readonly expectedOffsetMinutes: number;
}

export type LegacyTimezoneOffsetLookup = (
  utcMs: number,
  timeZone: string,
) => number;

/**
 * Small, deterministic tzdb capability contract. These probes cover the
 * historical Korean offsets used by saju calculations, a modern DST zone,
 * and the positive edge of the supported civil-offset range.
 */
const REQUIRED_TIMEZONE_DATA_PROBES: readonly LegacyTimezoneDataProbe[] = [
  {
    // Pre-1908 Seoul local mean time: GMT+08:27:52, normalized to the
    // public minute contract with the same nearest-minute rule as parsing.
    utcMs: Date.UTC(1907, 5, 15, 0, 0, 0),
    timeZone: 'Asia/Seoul',
    expectedOffsetMinutes: 508,
  },
  {
    utcMs: Date.UTC(1954, 6, 1, 0, 0, 0),
    timeZone: 'Asia/Seoul',
    expectedOffsetMinutes: 510,
  },
  {
    utcMs: Date.UTC(1988, 6, 15, 0, 0, 0),
    timeZone: 'Asia/Seoul',
    expectedOffsetMinutes: 600,
  },
  {
    utcMs: Date.UTC(2024, 0, 15, 0, 0, 0),
    timeZone: 'America/New_York',
    expectedOffsetMinutes: -300,
  },
  {
    utcMs: Date.UTC(2024, 6, 15, 0, 0, 0),
    timeZone: 'America/New_York',
    expectedOffsetMinutes: -240,
  },
  {
    utcMs: Date.UTC(2024, 6, 15, 0, 0, 0),
    timeZone: 'Pacific/Kiritimati',
    expectedOffsetMinutes: 840,
  },
];

/** Pure validator kept injectable so reduced-ICU failure is testable. */
export function supportsRequiredLegacyTimezoneData(
  offsetLookup: LegacyTimezoneOffsetLookup,
): boolean {
  try {
    return REQUIRED_TIMEZONE_DATA_PROBES.every(
      ({ utcMs, timeZone, expectedOffsetMinutes }) =>
        offsetLookup(utcMs, timeZone) === expectedOffsetMinutes,
    );
  } catch {
    return false;
  }
}

/**
 * Builds a synchronous, one-shot guard. Both success and failure are cached so
 * an unsupported host cannot repeatedly pay for or partially bypass probes.
 */
export function createLegacyTimezoneDataGuard(
  offsetLookup: LegacyTimezoneOffsetLookup,
): () => void {
  let supported: boolean | undefined;

  return () => {
    supported ??= supportsRequiredLegacyTimezoneData(offsetLookup);
    if (!supported) throw new LegacyTimezoneDataUnsupportedError();
  };
}

// Keep this outside offsetAtUtcMs: the canary calls that primitive directly,
// avoiding recursive guard evaluation.
const assertRequiredLegacyTimezoneData = createLegacyTimezoneDataGuard(
  offsetAtUtcMs,
);

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
  if (parseOffsetToken(timeZone) != null) return 0;
  assertRequiredLegacyTimezoneData();

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

const CIVIL_OFFSET_PROBE_WINDOW_MS = 36 * 60 * 60 * 1000;

export function civilDateTimeToUtcMs(civil: CivilDateTime, seconds = 0): number {
  return utcMsFromParts(
    civil.y,
    civil.m - 1,
    civil.d,
    civil.h,
    civil.min,
    seconds,
  );
}

function formatCivil(civil: CivilDateTime): string {
  const year = String(civil.y).padStart(4, '0');
  const month = String(civil.m).padStart(2, '0');
  const day = String(civil.d).padStart(2, '0');
  const hour = String(civil.h).padStart(2, '0');
  const minute = String(civil.min).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function civilFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  } catch (cause) {
    throw new LegacyTimezoneError(timeZone, cause);
  }
}

function numericPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
  timeZone: string,
): number {
  const value = parts.find((part) => part.type === type)?.value;
  const parsed = value == null ? Number.NaN : Number(value);
  if (!Number.isInteger(parsed)) throw new LegacyTimezoneError(timeZone);
  return parsed;
}

function roundTripsToCivil(
  utcMs: number,
  expected: CivilDateTime,
  formatter: Intl.DateTimeFormat,
  timeZone: string,
): boolean {
  const parts = formatter.formatToParts(new Date(utcMs));
  const actual: CivilDateTime = {
    y: numericPart(parts, 'year', timeZone),
    m: numericPart(parts, 'month', timeZone),
    d: numericPart(parts, 'day', timeZone),
    h: numericPart(parts, 'hour', timeZone),
    min: numericPart(parts, 'minute', timeZone),
  };
  const seconds = numericPart(parts, 'second', timeZone);

  // ICU can expose historical local-mean-time offsets with seconds (for
  // example Seoul GMT+08:27:52), while the public contract is minute-based.
  // Compare after the same nearest-minute normalization as parseOffsetToken.
  const roundedActual = Math.floor(
    (civilDateTimeToUtcMs(actual, seconds) + 30_000) / 60_000,
  ) * 60_000;
  return roundedActual === civilDateTimeToUtcMs(expected);
}

function candidateOffsetsAtCivil(
  utcGuess: number,
  timeZone: string,
): ReadonlySet<number> {
  // A local civil instant differs from its UTC instant by at most the timezone
  // offset. Probing both sides of a fixed 36-hour window captures the offsets
  // immediately before and after a nearby transition without minute scanning.
  return new Set([
    offsetAtUtcMs(utcGuess - CIVIL_OFFSET_PROBE_WINDOW_MS, timeZone),
    offsetAtUtcMs(utcGuess, timeZone),
    offsetAtUtcMs(utcGuess + CIVIL_OFFSET_PROBE_WINDOW_MS, timeZone),
  ]);
}

export function resolveOffsetMinutes(
  timeZone: string,
  civil: CivilDateTime,
): number {
  const parsedFromToken = parseOffsetToken(timeZone);
  if (parsedFromToken != null) return parsedFromToken;
  assertRequiredLegacyTimezoneData();

  const utcGuess = civilDateTimeToUtcMs(civil);
  const formatter = civilFormatter(timeZone);
  const validOffsets: number[] = [];

  for (const offset of candidateOffsetsAtCivil(utcGuess, timeZone)) {
    const candidateUtc = utcGuess - offset * 60_000;
    if (
      offsetAtUtcMs(candidateUtc, timeZone) === offset
      && roundTripsToCivil(candidateUtc, civil, formatter, timeZone)
    ) {
      validOffsets.push(offset);
    }
  }

  if (validOffsets.length === 1) return validOffsets[0]!;
  if (validOffsets.length === 0) {
    throw new LegacyNonexistentTimeError(timeZone, civil);
  }
  throw new LegacyAmbiguousTimeError(timeZone, civil);
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

  const utcMs = civilDateTimeToUtcMs(civil);
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
