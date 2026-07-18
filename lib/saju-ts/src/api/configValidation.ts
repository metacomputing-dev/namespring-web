import type { LongitudeCorrectionPolicy } from './types.js';
import {
  FORTUNE_AGE_DISPLAY_MODES,
  FORTUNE_AXES,
  FORTUNE_DIRECTION_RULES,
  FORTUNE_HORIZON_LIMITS,
  FORTUNE_POLICY_KEYS,
  FORTUNE_POLICY_LIMITS,
  FORTUNE_START_AGE_METHODS,
  FORTUNE_START_AGE_ROUNDINGS,
  FORTUNE_START_BOUNDARIES,
} from '../fortune/policyContract.js';

/** Raised when a known engine-config field contains an unsupported runtime value. */
export class InvalidEngineConfigError extends TypeError {
  readonly code = 'SAJU_INVALID_ENGINE_CONFIG';
  readonly path: string;

  constructor(path: string, expected: string) {
    super(`Invalid engine configuration at ${path}: expected ${expected}.`);
    this.name = 'InvalidEngineConfigError';
    this.path = path;
  }
}

/** Raised when a configured longitude-correction policy is not well formed. */
export class InvalidLongitudeCorrectionPolicyError extends Error {
  readonly code = 'SAJU_INVALID_LONGITUDE_CORRECTION_POLICY';

  constructor() {
    super(
      "trueSolarTime.longitudeCorrectionPolicy must be off, civilOffsetMeridian, or a finite fixedMeridian.",
    );
    this.name = 'InvalidLongitudeCorrectionPolicyError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function assertEngineConfigObject(
  config: unknown,
): asserts config is Record<string, unknown> {
  if (!isRecord(config)) {
    throw new InvalidEngineConfigError('config', 'an object');
  }
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function assertKnownKeys(
  record: Record<string, unknown>,
  path: string,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) {
      throw new InvalidEngineConfigError(`${path}.${key}`, 'a supported field');
    }
  }
}

function readOptionalRecord(
  parent: Record<string, unknown>,
  key: string,
  path: string,
): Record<string, unknown> | undefined {
  if (!hasOwn(parent, key) || parent[key] === undefined) return undefined;
  const value = parent[key];
  if (!isRecord(value)) throw new InvalidEngineConfigError(path, 'an object');
  return value;
}

function assertEnumValue(
  parent: Record<string, unknown>,
  key: string,
  path: string,
  allowed: readonly string[],
): void {
  if (!hasOwn(parent, key) || parent[key] === undefined) return;
  if (typeof parent[key] !== 'string' || !allowed.includes(parent[key] as string)) {
    throw new InvalidEngineConfigError(
      path,
      `one of ${allowed.map((value) => JSON.stringify(value)).join(', ')}`,
    );
  }
}

function assertBooleanValue(
  parent: Record<string, unknown>,
  key: string,
  path: string,
): void {
  if (!hasOwn(parent, key) || parent[key] === undefined) return;
  if (typeof parent[key] !== 'boolean') {
    throw new InvalidEngineConfigError(path, 'a boolean');
  }
}

function assertFiniteNumberValue(
  parent: Record<string, unknown>,
  key: string,
  path: string,
): void {
  if (!hasOwn(parent, key) || parent[key] === undefined) return;
  if (typeof parent[key] !== 'number' || !Number.isFinite(parent[key])) {
    throw new InvalidEngineConfigError(path, 'a finite number');
  }
}

function assertIntegerInRangeValue(
  parent: Record<string, unknown>,
  key: string,
  path: string,
  min: number,
  max: number,
): void {
  if (!hasOwn(parent, key) || parent[key] === undefined) return;
  const value = parent[key];
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < min
    || value > max
  ) {
    throw new InvalidEngineConfigError(
      path,
      `a safe integer between ${min} and ${max}`,
    );
  }
}

function assertPositiveFiniteNumberValue(
  parent: Record<string, unknown>,
  key: string,
  path: string,
): void {
  if (
    !hasOwn(parent, key)
    || typeof parent[key] !== 'number'
    || !Number.isFinite(parent[key])
    || parent[key] <= 0
  ) {
    throw new InvalidEngineConfigError(path, 'a positive finite number');
  }
}

function assertOptionalStringValue(
  parent: Record<string, unknown>,
  key: string,
  path: string,
): void {
  if (!hasOwn(parent, key) || parent[key] === undefined) return;
  if (typeof parent[key] !== 'string') {
    throw new InvalidEngineConfigError(path, 'a string');
  }
}

function assertNonNegativeFiniteNumberValue(
  parent: Record<string, unknown>,
  key: string,
  path: string,
): void {
  if (!hasOwn(parent, key) || parent[key] === undefined) return;
  if (
    typeof parent[key] !== 'number'
    || !Number.isFinite(parent[key])
    || parent[key] < 0
  ) {
    throw new InvalidEngineConfigError(path, 'a non-negative finite number');
  }
}

function assertLongitudeCorrectionPolicy(
  policy: unknown,
): asserts policy is LongitudeCorrectionPolicy {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new InvalidLongitudeCorrectionPolicyError();
  }

  const candidate = policy as Record<string, unknown>;
  if (candidate.mode === 'off' || candidate.mode === 'civilOffsetMeridian') {
    if (Object.keys(candidate).some((key) => key !== 'mode')) {
      throw new InvalidLongitudeCorrectionPolicyError();
    }
    return;
  }
  if (
    candidate.mode === 'fixedMeridian'
    && typeof candidate.meridianDeg === 'number'
    && Number.isFinite(candidate.meridianDeg)
    && Object.keys(candidate).every((key) => key === 'mode' || key === 'meridianDeg')
  ) return;

  throw new InvalidLongitudeCorrectionPolicyError();
}

const TOGGLE_KEYS = [
  'pillars',
  'relations',
  'tenGods',
  'hiddenStems',
  'elementDistribution',
  'fortune',
  'rules',
  'lifeStages',
  'stemRelations',
] as const;

const CONFIG_KEYS = [
  'schemaVersion',
  'school',
  'calendar',
  'toggles',
  'weights',
  'strategies',
  'extensions',
] as const;

const CALENDAR_KEYS = [
  'yearBoundary',
  'monthBoundary',
  'dayBoundary',
  'hourStemDayBoundary',
  'hourBoundary',
  'dayCutShiftMinutes',
  'solarTerms',
  'aberrationModel',
  'solarPrecision',
  'trueSolarTime',
] as const;

const SOLAR_TERM_KEYS = ['method', 'alwaysCompute', 'algorithm'] as const;
const TRUE_SOLAR_TIME_KEYS = [
  'enabled',
  'longitudeCorrectionPolicy',
  'equationOfTime',
  'applyTo',
] as const;

const HIDDEN_STEM_WEIGHT_KEYS = ['scheme', 'standard', 'saryeongScheme'] as const;
const HIDDEN_STEM_STANDARD_KEYS = ['one', 'two', 'three'] as const;
const HIDDEN_STEM_TWO_KEYS = ['main', 'residual'] as const;
const HIDDEN_STEM_THREE_KEYS = ['main', 'middle', 'residual'] as const;
const ELEMENT_DISTRIBUTION_WEIGHT_KEYS = [
  'heavenStemWeight',
  'branchTotalWeight',
  'positionWeights',
  'heavenPositionWeights',
  'branchPositionWeights',
] as const;
const ELEMENT_DISTRIBUTION_POSITIONS = ['year', 'month', 'day', 'hour'] as const;

function assertStartAgeMethod(value: unknown, path: string): void {
  if (
    typeof value === 'string'
    && FORTUNE_START_AGE_METHODS.includes(
      value as (typeof FORTUNE_START_AGE_METHODS)[number],
    )
  ) return;
  if (!isRecord(value)) {
    throw new InvalidEngineConfigError(
      path,
      `one of ${FORTUNE_START_AGE_METHODS.map((entry) => JSON.stringify(entry)).join(', ')}, or a ratio object`,
    );
  }

  assertOptionalStringValue(value, 'label', `${path}.label`);
  if (value.kind === 'ratioDaysPerYear') {
    assertKnownKeys(value, path, ['kind', 'daysPerYear', 'label']);
    assertPositiveFiniteNumberValue(value, 'daysPerYear', `${path}.daysPerYear`);
    return;
  }
  if (value.kind === 'ratioMsPerYear') {
    assertKnownKeys(value, path, ['kind', 'msPerYear', 'label']);
    assertPositiveFiniteNumberValue(value, 'msPerYear', `${path}.msPerYear`);
    return;
  }
  throw new InvalidEngineConfigError(
    `${path}.kind`,
    'one of "ratioDaysPerYear", "ratioMsPerYear"',
  );
}

function assertKnownFortunePolicy(fortune: Record<string, unknown>): void {
  const path = 'strategies.fortune';
  assertKnownKeys(fortune, path, FORTUNE_POLICY_KEYS);
  assertEnumValue(
    fortune,
    'directionRule',
    `${path}.directionRule`,
    FORTUNE_DIRECTION_RULES,
  );
  assertEnumValue(
    fortune,
    'startBoundary',
    `${path}.startBoundary`,
    FORTUNE_START_BOUNDARIES,
  );
  assertEnumValue(
    fortune,
    'startAgeRounding',
    `${path}.startAgeRounding`,
    FORTUNE_START_AGE_ROUNDINGS,
  );
  assertEnumValue(
    fortune,
    'ageDisplay',
    `${path}.ageDisplay`,
    FORTUNE_AGE_DISPLAY_MODES,
  );
  assertEnumValue(fortune, 'axis', `${path}.axis`, FORTUNE_AXES);

  const hasStartAgeMethod = hasOwn(fortune, 'startAgeMethod')
    && fortune.startAgeMethod !== undefined;
  const hasStartAgeAlias = hasOwn(fortune, 'startAge')
    && fortune.startAge !== undefined;
  if (hasStartAgeMethod && hasStartAgeAlias) {
    throw new InvalidEngineConfigError(
      `${path}.startAge`,
      'omitted when startAgeMethod is supplied',
    );
  }
  if (hasStartAgeMethod) {
    assertStartAgeMethod(fortune.startAgeMethod, `${path}.startAgeMethod`);
  }
  if (hasStartAgeAlias) {
    assertStartAgeMethod(fortune.startAge, `${path}.startAge`);
  }

  assertIntegerInRangeValue(
    fortune,
    'minStartAge',
    `${path}.minStartAge`,
    0,
    FORTUNE_POLICY_LIMITS.minStartAge,
  );
  assertIntegerInRangeValue(
    fortune,
    'firstDecadeOffsetSteps',
    `${path}.firstDecadeOffsetSteps`,
    0,
    FORTUNE_POLICY_LIMITS.firstDecadeOffsetSteps,
  );
  assertIntegerInRangeValue(
    fortune,
    'decadeLengthYears',
    `${path}.decadeLengthYears`,
    1,
    FORTUNE_POLICY_LIMITS.decadeLengthYears,
  );
  for (const [key, max] of Object.entries(FORTUNE_HORIZON_LIMITS)) {
    assertIntegerInRangeValue(fortune, key, `${path}.${key}`, 0, max);
  }
}

function assertKnownEngineStrategies(strategies: Record<string, unknown>): void {
  const fortune = readOptionalRecord(
    strategies,
    'fortune',
    'strategies.fortune',
  );
  if (fortune) assertKnownFortunePolicy(fortune);
}

function assertPositionWeights(
  parent: Record<string, unknown>,
  key: string,
  path: string,
): void {
  const weights = readOptionalRecord(parent, key, path);
  if (!weights) return;
  assertKnownKeys(weights, path, ELEMENT_DISTRIBUTION_POSITIONS);
  for (const position of ELEMENT_DISTRIBUTION_POSITIONS) {
    assertNonNegativeFiniteNumberValue(weights, position, `${path}.${position}`);
  }
}

function assertHiddenStemWeights(weights: Record<string, unknown>): void {
  assertKnownKeys(weights, 'weights.hiddenStems', HIDDEN_STEM_WEIGHT_KEYS);
  assertEnumValue(
    weights,
    'scheme',
    'weights.hiddenStems.scheme',
    ['standard', 'equal'],
  );
  assertEnumValue(
    weights,
    'saryeongScheme',
    'weights.hiddenStems.saryeongScheme',
    ['classical', 'scaled'],
  );

  const standard = readOptionalRecord(
    weights,
    'standard',
    'weights.hiddenStems.standard',
  );
  if (!standard) return;
  assertKnownKeys(
    standard,
    'weights.hiddenStems.standard',
    HIDDEN_STEM_STANDARD_KEYS,
  );
  assertNonNegativeFiniteNumberValue(
    standard,
    'one',
    'weights.hiddenStems.standard.one',
  );

  const two = readOptionalRecord(
    standard,
    'two',
    'weights.hiddenStems.standard.two',
  );
  if (two) {
    assertKnownKeys(
      two,
      'weights.hiddenStems.standard.two',
      HIDDEN_STEM_TWO_KEYS,
    );
    assertNonNegativeFiniteNumberValue(
      two,
      'main',
      'weights.hiddenStems.standard.two.main',
    );
    assertNonNegativeFiniteNumberValue(
      two,
      'residual',
      'weights.hiddenStems.standard.two.residual',
    );
  }

  const three = readOptionalRecord(
    standard,
    'three',
    'weights.hiddenStems.standard.three',
  );
  if (three) {
    assertKnownKeys(
      three,
      'weights.hiddenStems.standard.three',
      HIDDEN_STEM_THREE_KEYS,
    );
    assertNonNegativeFiniteNumberValue(
      three,
      'main',
      'weights.hiddenStems.standard.three.main',
    );
    assertNonNegativeFiniteNumberValue(
      three,
      'middle',
      'weights.hiddenStems.standard.three.middle',
    );
    assertNonNegativeFiniteNumberValue(
      three,
      'residual',
      'weights.hiddenStems.standard.three.residual',
    );
  }
}

function assertElementDistributionWeights(weights: Record<string, unknown>): void {
  assertKnownKeys(
    weights,
    'weights.elementDistribution',
    ELEMENT_DISTRIBUTION_WEIGHT_KEYS,
  );
  assertNonNegativeFiniteNumberValue(
    weights,
    'heavenStemWeight',
    'weights.elementDistribution.heavenStemWeight',
  );
  assertNonNegativeFiniteNumberValue(
    weights,
    'branchTotalWeight',
    'weights.elementDistribution.branchTotalWeight',
  );
  assertPositionWeights(
    weights,
    'positionWeights',
    'weights.elementDistribution.positionWeights',
  );
  assertPositionWeights(
    weights,
    'heavenPositionWeights',
    'weights.elementDistribution.heavenPositionWeights',
  );
  assertPositionWeights(
    weights,
    'branchPositionWeights',
    'weights.elementDistribution.branchPositionWeights',
  );
}

function assertKnownEngineWeights(weights: Record<string, unknown>): void {
  const hiddenStems = readOptionalRecord(
    weights,
    'hiddenStems',
    'weights.hiddenStems',
  );
  if (hiddenStems) assertHiddenStemWeights(hiddenStems);

  const elementDistribution = readOptionalRecord(
    weights,
    'elementDistribution',
    'weights.elementDistribution',
  );
  if (elementDistribution) {
    assertElementDistributionWeights(elementDistribution);
  }
}

/**
 * Validate only the closed, engine-owned portion of the public config.
 *
 * strategies/extensions/weights remain open-ended data-first surfaces except
 * for engine-owned nested contracts such as strategies.fortune. Undefined
 * values retain their historical "omitted" behavior, while explicit invalid
 * values fail before calculation instead of selecting a fallback branch by
 * accident.
 */
export function assertKnownEngineConfig(config: unknown): void {
  assertEngineConfigObject(config);
  assertKnownKeys(config, 'config', CONFIG_KEYS);
  const weights = readOptionalRecord(config, 'weights', 'weights');
  if (weights) assertKnownEngineWeights(weights);
  const strategies = readOptionalRecord(config, 'strategies', 'strategies');
  if (strategies) assertKnownEngineStrategies(strategies);
  readOptionalRecord(config, 'extensions', 'extensions');

  const calendar = readOptionalRecord(config, 'calendar', 'calendar');
  if (calendar) {
    assertKnownKeys(calendar, 'calendar', CALENDAR_KEYS);
    assertEnumValue(
      calendar,
      'yearBoundary',
      'calendar.yearBoundary',
      ['liChun', 'lunarNewYear', 'jan1'],
    );
    assertEnumValue(
      calendar,
      'monthBoundary',
      'calendar.monthBoundary',
      ['jieqi', 'gregorianMonth'],
    );
    assertEnumValue(
      calendar,
      'dayBoundary',
      'calendar.dayBoundary',
      ['midnight', 'ziSplit23'],
    );
    assertEnumValue(
      calendar,
      'hourStemDayBoundary',
      'calendar.hourStemDayBoundary',
      ['midnight', 'ziSplit23'],
    );
    assertEnumValue(
      calendar,
      'hourBoundary',
      'calendar.hourBoundary',
      ['doubleHour'],
    );
    assertFiniteNumberValue(
      calendar,
      'dayCutShiftMinutes',
      'calendar.dayCutShiftMinutes',
    );
    assertEnumValue(
      calendar,
      'aberrationModel',
      'calendar.aberrationModel',
      ['constant', 'rCorrected'],
    );
    assertEnumValue(
      calendar,
      'solarPrecision',
      'calendar.solarPrecision',
      ['classical', 'iau1980_top10', 'iau1980_full'],
    );

    const solarTerms = readOptionalRecord(
      calendar,
      'solarTerms',
      'calendar.solarTerms',
    );
    if (solarTerms) {
      assertKnownKeys(solarTerms, 'calendar.solarTerms', SOLAR_TERM_KEYS);
      assertEnumValue(
        solarTerms,
        'method',
        'calendar.solarTerms.method',
        ['meeus', 'approx'],
      );
      assertBooleanValue(
        solarTerms,
        'alwaysCompute',
        'calendar.solarTerms.alwaysCompute',
      );
      assertEnumValue(
        solarTerms,
        'algorithm',
        'calendar.solarTerms.algorithm',
        ['bisection', 'newton'],
      );
    }

    const trueSolarTime = readOptionalRecord(
      calendar,
      'trueSolarTime',
      'calendar.trueSolarTime',
    );
    if (trueSolarTime) {
      assertKnownKeys(
        trueSolarTime,
        'calendar.trueSolarTime',
        TRUE_SOLAR_TIME_KEYS,
      );
      assertBooleanValue(
        trueSolarTime,
        'enabled',
        'calendar.trueSolarTime.enabled',
      );
      assertEnumValue(
        trueSolarTime,
        'equationOfTime',
        'calendar.trueSolarTime.equationOfTime',
        ['off', 'approx', 'precise'],
      );
      assertEnumValue(
        trueSolarTime,
        'applyTo',
        'calendar.trueSolarTime.applyTo',
        ['hourOnly', 'dayAndHour'],
      );
      if (
        hasOwn(trueSolarTime, 'longitudeCorrectionPolicy')
        && trueSolarTime.longitudeCorrectionPolicy !== undefined
      ) {
        assertLongitudeCorrectionPolicy(trueSolarTime.longitudeCorrectionPolicy);
      }
    }
  }

  const toggles = readOptionalRecord(config, 'toggles', 'toggles');
  if (toggles) {
    assertKnownKeys(toggles, 'toggles', TOGGLE_KEYS);
    for (const key of TOGGLE_KEYS) {
      assertBooleanValue(toggles, key, `toggles.${key}`);
    }
  }
}
