import type { SajuAnalysisReasonCode } from '../types.js';

export type BirthInputRuntimeFailureCode = Extract<
  SajuAnalysisReasonCode,
  | 'BIRTH_INPUT_INVALID'
  | 'BIRTH_DATE_INVALID'
  | 'BIRTH_TIME_INVALID'
  | 'BIRTH_LOCATION_INVALID'
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isOptionalBoundedInteger(
  value: unknown,
  min: number,
  max: number,
): boolean {
  return value === undefined
    || value === null
    || (
      typeof value === 'number'
      && Number.isFinite(value)
      && Number.isInteger(value)
      && value >= min
      && value <= max
    );
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalCoordinate(
  value: unknown,
  min: number,
  max: number,
): boolean {
  return value === undefined
    || (
      typeof value === 'number'
      && Number.isFinite(value)
      && value >= min
      && value <= max
    );
}

/**
 * Validates the runtime shape of public birth data before module loading or
 * astronomical calculation. TypeScript declarations do not protect callers
 * that enter through JavaScript, decoded JSON, or unchecked persistence.
 */
export function validateBirthInputRuntimeContract(
  value: unknown,
): BirthInputRuntimeFailureCode | null {
  if (!isRecord(value)) return 'BIRTH_INPUT_INVALID';

  if (
    !isOptionalBoundedInteger(value.year, 1, 9999)
    || !isOptionalBoundedInteger(value.month, 1, 12)
    || !isOptionalBoundedInteger(value.day, 1, 31)
  ) {
    return 'BIRTH_DATE_INVALID';
  }

  if (
    !isOptionalBoundedInteger(value.hour, 0, 23)
    || !isOptionalBoundedInteger(value.minute, 0, 59)
  ) {
    return 'BIRTH_TIME_INVALID';
  }

  if (
    value.gender !== 'male'
    && value.gender !== 'female'
    && value.gender !== 'neutral'
  ) {
    return 'BIRTH_INPUT_INVALID';
  }

  if (
    value.calendarType !== undefined
    && value.calendarType !== 'solar'
    && value.calendarType !== 'lunar'
  ) {
    return 'BIRTH_INPUT_INVALID';
  }

  if (
    value.isLeapMonth !== undefined
    && typeof value.isLeapMonth !== 'boolean'
  ) {
    return 'BIRTH_INPUT_INVALID';
  }

  for (const key of ['region', 'city', 'birthPlace', 'timezone'] as const) {
    if (!isOptionalString(value[key])) return 'BIRTH_LOCATION_INVALID';
  }

  if (
    !isOptionalCoordinate(value.latitude, -90, 90)
    || !isOptionalCoordinate(value.longitude, -180, 180)
  ) {
    return 'BIRTH_LOCATION_INVALID';
  }

  if (!isOptionalString(value.name)) return 'BIRTH_INPUT_INVALID';
  return null;
}
