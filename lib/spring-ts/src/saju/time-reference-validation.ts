export interface CivilDateTimeForReference {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

export const LEGACY_PRESET_REFERENCE_MERIDIANS = Object.freeze({
  KOREAN_MAINSTREAM: 135,
  TRADITIONAL_CHINESE: 120,
  MODERN_INTEGRATED: 135,
} as const);

export type LegacyPresetReferenceCode =
  keyof typeof LEGACY_PRESET_REFERENCE_MERIDIANS;

export function isLegacyPresetReferenceCode(
  value: unknown,
): value is LegacyPresetReferenceCode {
  return typeof value === 'string'
    && Object.hasOwn(LEGACY_PRESET_REFERENCE_MERIDIANS, value);
}

export function normalizeReferenceMeridianDegrees(value: number): number {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function parseOffsetToken(value: string): number | null {
  const token = value.trim().toUpperCase();
  if (token === 'GMT' || token === 'UTC') return 0;
  const match = token.match(
    /^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?(?::(\d{2}))?$/u,
  );
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  if (!Number.isSafeInteger(hours)
    || !Number.isSafeInteger(minutes)
    || !Number.isSafeInteger(seconds)
    || hours > 14
    || minutes > 59
    || seconds > 59
    || (hours === 14 && (minutes !== 0 || seconds !== 0))) {
    return null;
  }
  const sign = match[1] === '-' ? -1 : 1;
  return sign * Math.round(hours * 60 + minutes + seconds / 60);
}

function civilUtcMilliseconds(
  value: CivilDateTimeForReference,
  seconds = 0,
): number {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(value.year, value.month - 1, value.day);
  date.setUTCHours(value.hour, value.minute, seconds, 0);
  return date.getTime();
}

function offsetAtUtcMilliseconds(
  utcMilliseconds: number,
  timezone: string,
): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcMilliseconds));
    const token = parts.find((part) => part.type === 'timeZoneName')?.value;
    return token === undefined ? null : parseOffsetToken(token);
  } catch {
    return null;
  }
}

function numericPart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number | null {
  const raw = parts.find((part) => part.type === type)?.value;
  if (raw === undefined) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function roundTripsToCivil(
  utcMilliseconds: number,
  expected: CivilDateTimeForReference,
  formatter: Intl.DateTimeFormat,
): boolean {
  const parts = formatter.formatToParts(new Date(utcMilliseconds));
  const year = numericPart(parts, 'year');
  const month = numericPart(parts, 'month');
  const day = numericPart(parts, 'day');
  const hour = numericPart(parts, 'hour');
  const minute = numericPart(parts, 'minute');
  const second = numericPart(parts, 'second');
  if (year === null
    || month === null
    || day === null
    || hour === null
    || minute === null
    || second === null) {
    return false;
  }
  const actual = { year, month, day, hour, minute };
  // Historical local-mean-time offsets may include seconds while the public
  // contract is minute based. Compare after the same nearest-minute rounding
  // used by the engine's offset-token parser.
  const roundedActual = Math.floor(
    (civilUtcMilliseconds(actual, second) + 30_000) / 60_000,
  ) * 60_000;
  return roundedActual === civilUtcMilliseconds(expected);
}

/**
 * Independently resolves the UTC offset for a civil time so delivery
 * validation can bind a civil-offset reference meridian to its timezone and
 * date. Null means invalid timezone data, a gap, or an ambiguous fold.
 */
export function resolveCivilOffsetMinutesForValidation(
  timezone: string,
  civil: CivilDateTimeForReference,
): number | null {
  const fixedOffset = parseOffsetToken(timezone);
  if (fixedOffset !== null) return fixedOffset;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
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
  } catch {
    return null;
  }

  const utcGuess = civilUtcMilliseconds(civil);
  const probeWindow = 36 * 60 * 60 * 1000;
  const offsets = new Set<number>(
    [
      offsetAtUtcMilliseconds(utcGuess - probeWindow, timezone),
      offsetAtUtcMilliseconds(utcGuess, timezone),
      offsetAtUtcMilliseconds(utcGuess + probeWindow, timezone),
    ].filter((offset): offset is number => offset !== null),
  );

  const validOffsets = new Set<number>();
  for (const offset of offsets) {
    const candidateUtc = utcGuess - offset * 60_000;
    if (offsetAtUtcMilliseconds(candidateUtc, timezone) === offset
      && roundTripsToCivil(candidateUtc, civil, formatter)) {
      validOffsets.add(offset);
    }
  }
  return validOffsets.size === 1 ? [...validOffsets][0]! : null;
}
