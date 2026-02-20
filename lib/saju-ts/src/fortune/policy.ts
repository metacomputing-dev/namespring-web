import type { EngineConfig } from '../api/types.js';
import type { FortunePolicy, StartAgeMethodSpec } from './types.js';

const DEFAULT_POLICY: FortunePolicy = {
  directionRule: 'sex_yearStemYinYang',
  startBoundary: 'jie',
  startAgeMethod: 'threeDaysOneYear',
  firstDecadeOffsetSteps: 1,
  decadeLengthYears: 10,
  maxDecades: 10,
  maxYears: 120,
  maxMonths: 24,
  maxDays: 0,
  axis: 'ageOnly',
};

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

export function readFortunePolicy(config: EngineConfig): FortunePolicy {
  const raw: any = (config.strategies as any)?.fortune ?? {};

  const directionRule =
    raw.directionRule === 'fixedForward' || raw.directionRule === 'fixedBackward' || raw.directionRule === 'sex_yearStemYinYang'
      ? raw.directionRule
      : DEFAULT_POLICY.directionRule;

  const axis = raw.axis === 'utcByGregorianYear' || raw.axis === 'ageOnly' ? raw.axis : DEFAULT_POLICY.axis;

  const maxDecades = Math.max(0, Math.floor(asNumber(raw.maxDecades, DEFAULT_POLICY.maxDecades)));
  const maxYears = Math.max(0, Math.floor(asNumber(raw.maxYears, DEFAULT_POLICY.maxYears)));

  const maxMonths = Math.max(0, Math.floor(asNumber(raw.maxMonths, DEFAULT_POLICY.maxMonths)));
  const maxDays = Math.max(0, Math.floor(asNumber(raw.maxDays, DEFAULT_POLICY.maxDays)));

  const decadeLengthYears = Math.max(1, Math.floor(asNumber(raw.decadeLengthYears, DEFAULT_POLICY.decadeLengthYears)));
  const firstDecadeOffsetSteps = Math.floor(asNumber(raw.firstDecadeOffsetSteps, DEFAULT_POLICY.firstDecadeOffsetSteps));

  const startAgeMethod = asStartAgeMethod(raw.startAgeMethod ?? raw.startAge, DEFAULT_POLICY.startAgeMethod);

  return {
    ...DEFAULT_POLICY,
    directionRule,
    axis,
    maxDecades,
    maxYears,
    maxMonths,
    maxDays,
    decadeLengthYears,
    firstDecadeOffsetSteps,
    startAgeMethod,
  };
}
