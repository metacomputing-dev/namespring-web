import type { EngineConfig } from '../api/types.js';
import type { AgeDisplayMode, FortunePolicy, StartAgeMethodSpec, StartAgeRounding } from './types.js';

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

export const FORTUNE_HORIZON_LIMITS = Object.freeze({
  maxDecades: 10,
  maxYears: 122,
  maxMonths: 1_600,
  maxDays: 3_660,
});

const START_AGE_ROUNDINGS: readonly StartAgeRounding[] = ['round1down2up', 'threshold8months', 'floor', 'ceil', 'none'];
const AGE_DISPLAY_MODES: readonly AgeDisplayMode[] = ['continuousFromBirth', 'koreanCountingAge'];

function asNumber(x: unknown, fallback: number): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback;
}

function asStartAgeMethod(x: unknown, fallback: StartAgeMethodSpec): StartAgeMethodSpec {
  if (x === 'threeDaysOneYear' || x === 'oneDayFourMonths') return x;
  if (x && typeof x === 'object' && !Array.isArray(x)) {
    const o: any = x;
    if (o.kind === 'ratioDaysPerYear') {
      const dpy = asNumber(o.daysPerYear, NaN);
      if (Number.isFinite(dpy) && dpy > 0) return { kind: 'ratioDaysPerYear', daysPerYear: dpy, label: typeof o.label === 'string' ? o.label : undefined };
    }
    if (o.kind === 'ratioMsPerYear') {
      const mpy = asNumber(o.msPerYear, NaN);
      if (Number.isFinite(mpy) && mpy > 0) return { kind: 'ratioMsPerYear', msPerYear: mpy, label: typeof o.label === 'string' ? o.label : undefined };
    }
  }
  return fallback;
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
  const raw: any = (config.strategies as any)?.fortune ?? {};

  const directionRule =
    raw.directionRule === 'fixedForward' || raw.directionRule === 'fixedBackward' || raw.directionRule === 'sex_yearStemYinYang'
      ? raw.directionRule
      : DEFAULT_POLICY.directionRule;

  const axis = raw.axis === 'utcByGregorianYear' || raw.axis === 'ageOnly' ? raw.axis : DEFAULT_POLICY.axis;

  const maxDecades = boundedNonNegativeInteger(raw.maxDecades, DEFAULT_POLICY.maxDecades, FORTUNE_HORIZON_LIMITS.maxDecades, 'fortune.maxDecades');
  const maxYears = boundedNonNegativeInteger(raw.maxYears, DEFAULT_POLICY.maxYears, FORTUNE_HORIZON_LIMITS.maxYears, 'fortune.maxYears');
  const maxMonths = boundedNonNegativeInteger(raw.maxMonths, DEFAULT_POLICY.maxMonths, FORTUNE_HORIZON_LIMITS.maxMonths, 'fortune.maxMonths');
  const maxDays = boundedNonNegativeInteger(raw.maxDays, DEFAULT_POLICY.maxDays, FORTUNE_HORIZON_LIMITS.maxDays, 'fortune.maxDays');
  const ageDisplay = AGE_DISPLAY_MODES.includes(raw.ageDisplay)
    ? (raw.ageDisplay as AgeDisplayMode)
    : DEFAULT_POLICY.ageDisplay;

  const decadeLengthYears = Math.max(1, Math.floor(asNumber(raw.decadeLengthYears, DEFAULT_POLICY.decadeLengthYears)));
  const firstDecadeOffsetSteps = Math.floor(asNumber(raw.firstDecadeOffsetSteps, DEFAULT_POLICY.firstDecadeOffsetSteps));

  const startAgeMethod = asStartAgeMethod(raw.startAgeMethod ?? raw.startAge, DEFAULT_POLICY.startAgeMethod);

  const startAgeRounding = START_AGE_ROUNDINGS.includes(raw.startAgeRounding)
    ? (raw.startAgeRounding as StartAgeRounding)
    : DEFAULT_POLICY.startAgeRounding;
  const minStartAge = Math.max(0, Math.floor(asNumber(raw.minStartAge, DEFAULT_POLICY.minStartAge ?? 1)));

  const policy: FortunePolicy = {
    ...DEFAULT_POLICY,
    directionRule,
    axis,
    maxDecades,
    maxYears,
    maxMonths,
    maxDays,
    ageDisplay,
    decadeLengthYears,
    firstDecadeOffsetSteps,
    startAgeMethod,
    startAgeRounding,
    minStartAge,
  };
  assertFortuneHorizonPolicy(policy);
  return policy;
}
