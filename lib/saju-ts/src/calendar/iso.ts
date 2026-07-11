import { utcMsFromParts } from './utc.js';

export interface LocalDate {
  y: number;
  m: number;
  d: number;
}

export interface LocalTime {
  h: number;
  min: number;
}

export interface LocalDateTime {
  date: LocalDate;
  time: LocalTime;
  /** offset minutes from UTC (e.g. +09:00 => 540) */
  offsetMinutes: number;
}

export interface ParsedInstant {
  utcMs: number;
  offsetMinutes: number;
  localDateTime: LocalDateTime;
}

export class InvalidIsoInstantError extends Error {
  readonly code = 'SAJU_INVALID_ISO_INSTANT';
  readonly instant: string;
  readonly reason: string;

  constructor(instant: string, reason: string) {
    super(`Invalid ISO instant: ${reason}`);
    this.name = 'InvalidIsoInstantError';
    this.instant = instant;
    this.reason = reason;
  }
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseOffsetMinutes(tz: string): number {
  const match = tz.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    throw new InvalidIsoInstantError(tz, 'offset shape is invalid');
  }
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (
    hours > 14 ||
    minutes > 59 ||
    (hours === 14 && minutes !== 0)
  ) {
    throw new InvalidIsoInstantError(tz, 'offset is outside +/-14:00');
  }
  return sign * (hours * 60 + minutes);
}

/**
 * Parse an ISO-8601 instant with an explicit offset or Z.
 * Impossible calendar dates and clock times are rejected before Date.parse can
 * normalize them into a different instant.
 */
export function parseIsoInstant(instant: string): ParsedInstant {
  const match = instant.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) {
    throw new InvalidIsoInstantError(
      instant,
      'explicit offset and minute precision are required',
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const millisecond = Number(String(match[7] ?? '').padEnd(3, '0') || 0);

  if (year < 1 || month < 1 || month > 12) {
    throw new InvalidIsoInstantError(
      instant,
      'date is outside the supported range',
    );
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new InvalidIsoInstantError(instant, 'calendar date does not exist');
  }
  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    throw new InvalidIsoInstantError(instant, 'clock time does not exist');
  }

  const timezone = match[8];
  const offsetMinutes = timezone === 'Z'
    ? 0
    : parseOffsetMinutes(timezone);
  const utcMs = utcMsFromParts(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  ) - offsetMinutes * 60_000;
  if (!Number.isFinite(utcMs)) {
    throw new InvalidIsoInstantError(
      instant,
      'runtime date conversion failed',
    );
  }

  return {
    utcMs,
    offsetMinutes,
    localDateTime: {
      date: { y: year, m: month, d: day },
      time: { h: hour, min: minute },
      offsetMinutes,
    },
  };
}
