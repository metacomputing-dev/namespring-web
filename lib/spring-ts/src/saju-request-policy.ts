import type { SajuAnalysisReasonCode, SajuRequestOptions } from './types.js';
import {
  FortuneTargetDateInvalidError,
  resolveFortuneTargetDate,
} from './report/report-input-contract.js';
import { targetCalendarParts } from './target-date.js';

export const SAJU_REQUEST_LIMITS = Object.freeze({
  daeunCount: 10,
  saeunYearCount: 120,
  maxYears: 122,
  wolunMonthCount: 120,
  futureYearsFromBirth: 120,
  maxMonths: 1_600,
  maxDays: 3_660,
});

const FORTUNE_POLICY_KEYS = [
  'directionRule',
  'startBoundary',
  'startAgeMethod',
  'startAge',
  'startAgeRounding',
  'minStartAge',
  'firstDecadeOffsetSteps',
  'decadeLengthYears',
  'maxDecades',
  'maxYears',
  'maxMonths',
  'maxDays',
  'ageDisplay',
  'axis',
] as const;

const FORTUNE_ENUMS = Object.freeze({
  directionRule: ['sex_yearStemYinYang', 'fixedForward', 'fixedBackward'],
  startBoundary: ['jie'],
  startAgeRounding: ['round1down2up', 'threshold8months', 'floor', 'ceil', 'none'],
  ageDisplay: ['continuousFromBirth', 'koreanCountingAge'],
  axis: ['ageOnly', 'utcByGregorianYear'],
} satisfies Record<string, readonly string[]>);

const START_AGE_METHODS = ['threeDaysOneYear', 'oneDayFourMonths'] as const;

export class SajuRequestValidationError extends RangeError {
  readonly code = 'SAJU_REQUEST_INVALID' as const;
  readonly reasonCode?: SajuAnalysisReasonCode;

  constructor(message: string, reasonCode?: SajuAnalysisReasonCode) {
    super(message);
    this.name = 'SajuRequestValidationError';
    this.reasonCode = reasonCode;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assertIntegerInRange(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new SajuRequestValidationError(`${label} must be a safe integer`);
  }
  if (value < min || value > max) {
    throw new SajuRequestValidationError(`${label} must be between ${min} and ${max}`);
  }
  return value;
}

function assertKnownKeys(
  value: Record<string, unknown>,
  label: string,
  allowed: readonly string[],
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new SajuRequestValidationError(`${label}.${key} is not supported`);
    }
  }
}

function assertOptionalEnum(
  value: Record<string, unknown>,
  key: string,
  label: string,
  allowed: readonly string[],
): void {
  if (value[key] === undefined) return;
  if (typeof value[key] !== 'string' || !allowed.includes(value[key] as string)) {
    throw new SajuRequestValidationError(
      `${label} must be one of ${allowed.map((entry) => JSON.stringify(entry)).join(', ')}`,
    );
  }
}

function assertPositiveFiniteNumber(value: unknown, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new SajuRequestValidationError(`${label} must be a positive finite number`);
  }
}

function validateStartAgeMethod(value: unknown, label: string): void {
  if (typeof value === 'string' && START_AGE_METHODS.includes(
    value as (typeof START_AGE_METHODS)[number],
  )) return;
  if (!isRecord(value)) {
    throw new SajuRequestValidationError(
      `${label} must be one of ${START_AGE_METHODS.map((entry) => JSON.stringify(entry)).join(', ')}, or a ratio object`,
    );
  }
  if (value.label !== undefined && typeof value.label !== 'string') {
    throw new SajuRequestValidationError(`${label}.label must be a string`);
  }
  if (value.kind === 'ratioDaysPerYear') {
    assertKnownKeys(value, label, ['kind', 'daysPerYear', 'label']);
    assertPositiveFiniteNumber(value.daysPerYear, `${label}.daysPerYear`);
    return;
  }
  if (value.kind === 'ratioMsPerYear') {
    assertKnownKeys(value, label, ['kind', 'msPerYear', 'label']);
    assertPositiveFiniteNumber(value.msPerYear, `${label}.msPerYear`);
    return;
  }
  throw new SajuRequestValidationError(
    `${label}.kind must be one of "ratioDaysPerYear", "ratioMsPerYear"`,
  );
}

function assertOptionalCount(
  value: unknown,
  label: string,
  max: number,
): void {
  if (value === undefined) return;
  assertIntegerInRange(value, label, 1, max);
}

function assertOptionalStartYear(value: unknown, label: string, birthYear: number): void {
  if (value === undefined || value === null) return;
  assertIntegerInRange(
    value,
    label,
    birthYear - 1,
    birthYear + SAJU_REQUEST_LIMITS.futureYearsFromBirth,
  );
}

export function validateSajuRequestOptions(
  options: SajuRequestOptions | undefined,
  birthYear: number,
): void {
  if (options === undefined) return;
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new SajuRequestValidationError('sajuOptions must be an object');
  }
  assertIntegerInRange(birthYear, 'birthYear', 1, 9_999);
  assertOptionalCount(options.daeunCount, 'sajuOptions.daeunCount', SAJU_REQUEST_LIMITS.daeunCount);
  assertOptionalCount(options.saeunYearCount, 'sajuOptions.saeunYearCount', SAJU_REQUEST_LIMITS.saeunYearCount);
  assertOptionalCount(options.wolunMonthCount, 'sajuOptions.wolunMonthCount', SAJU_REQUEST_LIMITS.wolunMonthCount);
  assertOptionalStartYear(options.saeunStartYear, 'sajuOptions.saeunStartYear', birthYear);
  assertOptionalStartYear(options.wolunStartYear, 'sajuOptions.wolunStartYear', birthYear);

  const maxYear = birthYear + SAJU_REQUEST_LIMITS.futureYearsFromBirth;
  const saeunStart = typeof options.saeunStartYear === 'number' ? options.saeunStartYear : birthYear;
  const saeunCount = options.saeunYearCount;
  if (typeof saeunCount === 'number' && saeunStart + saeunCount - 1 > maxYear) {
    throw new SajuRequestValidationError(`sajuOptions saeun window must end by ${maxYear}`);
  }

  const wolunStart = typeof options.wolunStartYear === 'number' ? options.wolunStartYear : birthYear;
  const wolunCount = options.wolunMonthCount;
  if (typeof wolunCount === 'number') {
    const lastSolarYear = wolunStart + Math.ceil(wolunCount / 12) - 1;
    if (lastSolarYear > maxYear) {
      throw new SajuRequestValidationError(`sajuOptions wolun window must end by ${maxYear}`);
    }
  }
}

/**
 * Mirror the saju-ts engine-owned fortune-policy contract at the Spring
 * boundary. This intentionally runs before dynamic module loading/database
 * initialization; saju-ts remains the authoritative second line of defense.
 */
export function validateSajuConfigFortunePolicy(config: Record<string, unknown> | undefined): void {
  if (config === undefined) return;
  if (!isRecord(config)) {
    throw new SajuRequestValidationError('sajuConfig must be an object');
  }
  const strategies = config.strategies;
  if (strategies === undefined) return;
  if (!isRecord(strategies)) {
    throw new SajuRequestValidationError('sajuConfig.strategies must be an object');
  }
  const fortune = strategies.fortune;
  if (fortune === undefined) return;
  if (!isRecord(fortune)) {
    throw new SajuRequestValidationError('sajuConfig.strategies.fortune must be an object');
  }
  const raw = fortune;
  const path = 'sajuConfig.strategies.fortune';
  assertKnownKeys(raw, path, FORTUNE_POLICY_KEYS);
  for (const [key, allowed] of Object.entries(FORTUNE_ENUMS)) {
    assertOptionalEnum(raw, key, `${path}.${key}`, allowed);
  }

  const hasStartAgeMethod = raw.startAgeMethod !== undefined;
  const hasStartAgeAlias = raw.startAge !== undefined;
  if (hasStartAgeMethod && hasStartAgeAlias) {
    throw new SajuRequestValidationError(
      `${path}.startAge must be omitted when startAgeMethod is supplied`,
    );
  }
  if (hasStartAgeMethod) {
    validateStartAgeMethod(raw.startAgeMethod, `${path}.startAgeMethod`);
  }
  if (hasStartAgeAlias) {
    validateStartAgeMethod(raw.startAge, `${path}.startAge`);
  }

  const limits: ReadonlyArray<readonly [string, number]> = [
    ['maxDecades', SAJU_REQUEST_LIMITS.daeunCount],
    ['maxYears', SAJU_REQUEST_LIMITS.maxYears],
    ['maxMonths', SAJU_REQUEST_LIMITS.maxMonths],
    ['maxDays', SAJU_REQUEST_LIMITS.maxDays],
  ];
  for (const [key, max] of limits) {
    if (raw[key] !== undefined) assertIntegerInRange(raw[key], `${path}.${key}`, 0, max);
  }
  if (raw.minStartAge !== undefined) {
    assertIntegerInRange(raw.minStartAge, `${path}.minStartAge`, 0, SAJU_REQUEST_LIMITS.maxYears);
  }
  if (raw.firstDecadeOffsetSteps !== undefined) {
    assertIntegerInRange(raw.firstDecadeOffsetSteps, `${path}.firstDecadeOffsetSteps`, 0, 59);
  }
  if (raw.decadeLengthYears !== undefined) {
    assertIntegerInRange(raw.decadeLengthYears, `${path}.decadeLengthYears`, 1, SAJU_REQUEST_LIMITS.maxYears);
  }
}

export function requiredMaxYearsForRequest(
  options: SajuRequestOptions | undefined,
  birthYear: number,
): number | null {
  validateSajuRequestOptions(options, birthYear);
  const startYear = options?.saeunStartYear;
  const count = options?.saeunYearCount;
  if (typeof startYear !== 'number' && typeof count !== 'number') return null;
  const effectiveStart = typeof startYear === 'number' ? startYear : birthYear;
  const requestedCount = typeof count === 'number' ? count : 1;
  const required = effectiveStart - (birthYear - 1) + requestedCount;
  if (required > SAJU_REQUEST_LIMITS.maxYears) {
    throw new SajuRequestValidationError(`computed maxYears exceeds ${SAJU_REQUEST_LIMITS.maxYears}`);
  }
  return required;
}

export function requiredMaxMonthsForRequest(
  options: SajuRequestOptions | undefined,
  birthYear: number,
): number | null {
  validateSajuRequestOptions(options, birthYear);
  const startYear = options?.wolunStartYear;
  const count = options?.wolunMonthCount;
  if (typeof startYear !== 'number' && typeof count !== 'number') return null;
  const requestedMonthCount = typeof count === 'number' ? count : 12;
  const offsetMonths = typeof startYear === 'number'
    ? Math.max(0, startYear - (birthYear - 1)) * 12
    : 0;
  const required = Math.max(24, offsetMonths + requestedMonthCount);
  if (required > SAJU_REQUEST_LIMITS.maxMonths) {
    throw new SajuRequestValidationError(`computed maxMonths exceeds ${SAJU_REQUEST_LIMITS.maxMonths}`);
  }
  return required;
}

interface BirthDateLike {
  readonly year?: unknown;
  readonly month?: unknown;
  readonly day?: unknown;
}

interface CalendarDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function assertCalendarDate(
  parts: CalendarDateParts,
  label: string,
  reasonCode?: SajuAnalysisReasonCode,
): void {
  if (!Number.isInteger(parts.year) || !Number.isInteger(parts.month) || !Number.isInteger(parts.day)
    || parts.year < 1 || parts.year > 9_999 || parts.month < 1 || parts.month > 12
    || parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) {
    throw new SajuRequestValidationError(`${label} must be a valid calendar date`, reasonCode);
  }
}

function compareCalendarDate(a: CalendarDateParts, b: CalendarDateParts): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function parseFortuneTargetDate(raw: string | undefined, birth: BirthDateLike): Date {
  const birthDate = {
    year: birth?.year,
    month: birth?.month,
    day: birth?.day,
  } as CalendarDateParts;
  assertCalendarDate(birthDate, 'birth date', 'BIRTH_DATE_INVALID');

  let parsed: Date;
  try {
    parsed = resolveFortuneTargetDate(raw);
  } catch (error) {
    if (error instanceof FortuneTargetDateInvalidError) {
      throw new SajuRequestValidationError(
        'targetDate must be ISO YYYY-MM-DD or include an explicit timezone',
      );
    }
    throw error;
  }
  const targetDate = targetCalendarParts(parsed);
  const maxYear = birthDate.year + SAJU_REQUEST_LIMITS.futureYearsFromBirth;
  const maxDate = {
    year: maxYear,
    month: birthDate.month,
    day: Math.min(birthDate.day, daysInMonth(maxYear, birthDate.month)),
  };
  if (compareCalendarDate(targetDate, birthDate) < 0 || compareCalendarDate(targetDate, maxDate) > 0) {
    throw new SajuRequestValidationError(
      `targetDate must be between the birth date and its ${SAJU_REQUEST_LIMITS.futureYearsFromBirth}-year anniversary`,
    );
  }
  return parsed;
}
