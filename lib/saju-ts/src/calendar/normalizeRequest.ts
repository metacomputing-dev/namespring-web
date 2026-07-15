import type { SajuRequest } from '../api/types.js';
import { parseIsoInstant, type ParsedInstant } from './iso.js';

export interface NormalizedRequestInternal {
  request: SajuRequest;
  parsed: ParsedInstant;
}

export class SajuRequestValidationError extends Error {
  readonly code = 'SAJU_REQUEST_INVALID';
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid SajuRequest: ${issues.join('; ')}`);
    this.name = 'SajuRequestValidationError';
    this.issues = [...issues];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumberWithin(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= minimum
    && value <= maximum
  );
}

export function normalizeRequest(input: SajuRequest): NormalizedRequestInternal {
  const value = input as unknown;
  const record = isRecord(value) ? value : {};
  const birth = isRecord(record.birth) ? record.birth : {};
  const location = record.location;
  const issues: string[] = [];

  if (typeof birth.instant !== 'string' || birth.instant.trim().length === 0) {
    issues.push('birth.instant must be a non-empty string');
  }
  if (birth.calendar !== undefined && birth.calendar !== 'gregorian') {
    issues.push('birth.calendar must be gregorian');
  }
  if (
    typeof record.sex !== 'string'
    || !['M', 'F', 'U'].includes(record.sex)
  ) {
    issues.push('sex must be M, F, or U');
  }
  if (location !== undefined) {
    if (!isRecord(location)) {
      issues.push('location must be an object');
    } else {
      if (!isFiniteNumberWithin(location.lat, -90, 90)) {
        issues.push('location.lat must be finite and within [-90, 90]');
      }
      if (!isFiniteNumberWithin(location.lon, -180, 180)) {
        issues.push('location.lon must be finite and within [-180, 180]');
      }
      if (
        location.altitudeM !== undefined &&
        (
          typeof location.altitudeM !== 'number'
          || !Number.isFinite(location.altitudeM)
        )
      ) {
        issues.push('location.altitudeM must be finite when provided');
      }
      if (location.name !== undefined && typeof location.name !== 'string') {
        issues.push('location.name must be a string when provided');
      }
    }
  }
  if (record.meta !== undefined && !isRecord(record.meta)) {
    issues.push('meta must be an object when provided');
  }
  if (record.overrides !== undefined && !isRecord(record.overrides)) {
    issues.push('overrides must be an object when provided');
  }
  if (issues.length > 0) {
    throw new SajuRequestValidationError(issues);
  }

  const instant = birth.instant as string;
  const parsed = parseIsoInstant(instant);
  const request: SajuRequest = {
    birth: {
      instant,
      calendar: 'gregorian',
    },
    sex: record.sex as SajuRequest['sex'],
    ...(isRecord(location)
      ? { location: { ...location } as SajuRequest['location'] }
      : {}),
    ...(isRecord(record.meta) ? { meta: { ...record.meta } } : {}),
    ...(isRecord(record.overrides)
      ? { overrides: { ...record.overrides } }
      : {}),
  };

  return { request, parsed };
}
