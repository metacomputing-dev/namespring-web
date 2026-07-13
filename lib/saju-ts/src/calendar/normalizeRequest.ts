import type { EngineConfig, SajuRequest } from '../api/types.js';
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
  const sex = record.sex;
  const location = record.location;
  let normalizedLocation: SajuRequest['location'] | undefined;
  const issues: string[] = [];

  if (typeof birth.instant !== 'string' || birth.instant.trim().length === 0) {
    issues.push('birth.instant must be a non-empty string');
  }
  if (birth.calendar !== undefined && birth.calendar !== 'gregorian') {
    issues.push('birth.calendar must be gregorian');
  }
  if (
    typeof sex !== 'string'
    || !['M', 'F', 'U'].includes(sex)
  ) {
    issues.push('sex must be M, F, or U');
  }
  if (location !== undefined) {
    if (!isRecord(location)) {
      issues.push('location must be an object');
    } else {
      const issueCountBeforeLocation = issues.length;
      const lat = location.lat;
      const lon = location.lon;
      const altitudeM = location.altitudeM;
      const name = location.name;
      if (!isFiniteNumberWithin(lat, -90, 90)) {
        issues.push('location.lat must be a finite number within [-90, 90]');
      }
      if (!isFiniteNumberWithin(lon, -180, 180)) {
        issues.push('location.lon must be a finite number within [-180, 180]');
      }
      if (
        altitudeM !== undefined &&
        (
          typeof altitudeM !== 'number'
          || !Number.isFinite(altitudeM)
        )
      ) {
        issues.push('location.altitudeM must be finite when provided');
      }
      if (name !== undefined && typeof name !== 'string') {
        issues.push('location.name must be a string when provided');
      }
      if (issues.length === issueCountBeforeLocation) {
        normalizedLocation = {
          lat: lat as number,
          lon: lon as number,
          ...(name !== undefined ? { name: name as string } : {}),
          ...(altitudeM !== undefined ? { altitudeM: altitudeM as number } : {}),
        };
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
    sex: sex as SajuRequest['sex'],
    ...(normalizedLocation ? { location: normalizedLocation } : {}),
    ...(isRecord(record.meta) ? { meta: { ...record.meta } } : {}),
    ...(isRecord(record.overrides)
      ? { overrides: { ...record.overrides } }
      : {}),
  };

  return { request, parsed };
}

/**
 * Enforces request fields whose necessity depends on the normalized engine
 * policy. Pure EoT mode does not need a location; longitude correction does.
 */
export function assertRequestMeetsCalendarPolicy(
  request: SajuRequest,
  config: EngineConfig,
): void {
  const trueSolarTime = config.calendar.trueSolarTime;
  const requiresLongitude =
    trueSolarTime.enabled
    && trueSolarTime.longitudeCorrectionPolicy.mode !== 'off';
  if (!requiresLongitude) return;

  if (
    !request.location
    || typeof request.location.lon !== 'number'
    || !Number.isFinite(request.location.lon)
  ) {
    throw new SajuRequestValidationError([
      'location.lon is required when true-solar longitude correction is enabled',
    ]);
  }
}
