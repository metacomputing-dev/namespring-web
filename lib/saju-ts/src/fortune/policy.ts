import type { EngineConfig } from '../api/types.js';
import { assertKnownEngineConfig } from '../api/configValidation.js';
import type { FortunePolicy, StartAgeMethodSpec } from './types.js';
import {
  FORTUNE_HORIZON_LIMITS,
} from './policyContract.js';

export { FORTUNE_HORIZON_LIMITS } from './policyContract.js';

const DEFAULT_POLICY: FortunePolicy = {
  directionRule: 'sex_yearStemYinYang',
  startBoundary: 'jie',
  startAgeMethod: 'threeDaysOneYear',
  startAgeRounding: 'round1down2up',
  minStartAge: 1,
  firstDecadeOffsetSteps: 1,
  decadeLengthYears: 10,
  maxDecades: 10,
  maxYears: 120,
  maxMonths: 24,
  maxDays: 0,
  ageDisplay: 'continuousFromBirth',
  axis: 'ageOnly',
};

function compileStartAgeMethod(
  value: unknown,
  fallback: StartAgeMethodSpec,
): StartAgeMethodSpec {
  if (value === undefined) return fallback;
  if (typeof value === 'string') return value as StartAgeMethodSpec;
  const raw = value as Record<string, unknown>;
  if (raw.kind === 'ratioDaysPerYear') {
    return {
      kind: 'ratioDaysPerYear',
      daysPerYear: raw.daysPerYear as number,
      ...(raw.label === undefined ? {} : { label: raw.label as string }),
    };
  }
  return {
    kind: 'ratioMsPerYear',
    msPerYear: raw.msPerYear as number,
    ...(raw.label === undefined ? {} : { label: raw.label as string }),
  };
}

function boundedNonNegativeInteger(value: unknown, fallback: number, max: number, label: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new RangeError(`${label} must be a finite integer`);
  }
  if (value < 0 || value > max) {
    throw new RangeError(`${label} must be between 0 and ${max}`);
  }
  return value;
}

export function assertFortuneHorizonPolicy(policy: FortunePolicy): void {
  const checks: ReadonlyArray<readonly [keyof typeof FORTUNE_HORIZON_LIMITS, unknown]> = [
    ['maxDecades', policy.maxDecades],
    ['maxYears', policy.maxYears],
    ['maxMonths', policy.maxMonths],
    ['maxDays', policy.maxDays],
  ];
  for (const [key, value] of checks) {
    boundedNonNegativeInteger(value, 0, FORTUNE_HORIZON_LIMITS[key], `fortune.${key}`);
  }
}

export function readFortunePolicy(config: EngineConfig): FortunePolicy {
  // normalizeConfig validates this earlier in the public engine. Keep the
  // compiler defensive for direct/internal callers so malformed explicit
  // values can never turn into a successful default-policy calculation.
  assertKnownEngineConfig(config);
  const raw: any = (config.strategies as any)?.fortune ?? {};

  const maxDecades = boundedNonNegativeInteger(raw.maxDecades, DEFAULT_POLICY.maxDecades, FORTUNE_HORIZON_LIMITS.maxDecades, 'fortune.maxDecades');
  const maxYears = boundedNonNegativeInteger(raw.maxYears, DEFAULT_POLICY.maxYears, FORTUNE_HORIZON_LIMITS.maxYears, 'fortune.maxYears');
  const maxMonths = boundedNonNegativeInteger(raw.maxMonths, DEFAULT_POLICY.maxMonths, FORTUNE_HORIZON_LIMITS.maxMonths, 'fortune.maxMonths');
  const maxDays = boundedNonNegativeInteger(raw.maxDays, DEFAULT_POLICY.maxDays, FORTUNE_HORIZON_LIMITS.maxDays, 'fortune.maxDays');
  const startAgeMethod = compileStartAgeMethod(
    raw.startAgeMethod ?? raw.startAge,
    DEFAULT_POLICY.startAgeMethod,
  );

  const policy: FortunePolicy = {
    ...DEFAULT_POLICY,
    directionRule: raw.directionRule ?? DEFAULT_POLICY.directionRule,
    startBoundary: raw.startBoundary ?? DEFAULT_POLICY.startBoundary,
    axis: raw.axis ?? DEFAULT_POLICY.axis,
    maxDecades,
    maxYears,
    maxMonths,
    maxDays,
    ageDisplay: raw.ageDisplay ?? DEFAULT_POLICY.ageDisplay,
    decadeLengthYears: raw.decadeLengthYears ?? DEFAULT_POLICY.decadeLengthYears,
    firstDecadeOffsetSteps:
      raw.firstDecadeOffsetSteps ?? DEFAULT_POLICY.firstDecadeOffsetSteps,
    startAgeMethod,
    startAgeRounding:
      raw.startAgeRounding ?? DEFAULT_POLICY.startAgeRounding,
    minStartAge: raw.minStartAge ?? DEFAULT_POLICY.minStartAge,
  };
  assertFortuneHorizonPolicy(policy);
  return policy;
}
