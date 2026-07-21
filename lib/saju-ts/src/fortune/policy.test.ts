import { describe, expect, it } from 'vitest';

import { InvalidEngineConfigError } from '../api/config.js';
import { createEngine } from '../api/engine.js';
import {
  FORTUNE_HORIZON_LIMITS,
  assertFortuneHorizonPolicy,
  readFortunePolicy,
} from './policy.js';

function config(fortune: Record<string, unknown>): any {
  return { strategies: { fortune } };
}

describe('fortune horizon policy', () => {
  it('accepts the documented finite caps', () => {
    const policy = readFortunePolicy(config({
      maxDecades: FORTUNE_HORIZON_LIMITS.maxDecades,
      maxYears: FORTUNE_HORIZON_LIMITS.maxYears,
      maxMonths: FORTUNE_HORIZON_LIMITS.maxMonths,
      maxDays: FORTUNE_HORIZON_LIMITS.maxDays,
    }));
    expect(policy.maxMonths).toBe(1_600);
    expect(() => assertFortuneHorizonPolicy(policy)).not.toThrow();
  });

  it.each([
    ['maxDecades', 11],
    ['maxYears', FORTUNE_HORIZON_LIMITS.maxYears + 1],
    ['maxMonths', 1_601],
    ['maxDays', 3_661],
    ['maxMonths', -1],
    ['maxMonths', 1.5],
    ['maxMonths', Number.NaN],
    ['maxMonths', Number.POSITIVE_INFINITY],
    ['maxMonths', '24'],
    ['maxMonths', true],
  ])('rejects invalid %s=%s before allocation', (key, value) => {
    expect(() => readFortunePolicy(config({ [key]: value }))).toThrow(
      InvalidEngineConfigError,
    );
  });

  it('rejects a directly supplied invalid runtime policy', () => {
    const policy = readFortunePolicy(config({}));
    expect(() => assertFortuneHorizonPolicy({ ...policy, maxMonths: 1_601 })).toThrow(RangeError);
  });
});

describe('fortune policy runtime contract', () => {
  it.each([
    ['directionRule', 'fixedBackwards'],
    ['startBoundary', 'lichun'],
    ['startAgeRounding', 'round'],
    ['ageDisplay', 'countingAge'],
    ['axis', 'gregorian'],
  ])('rejects an explicit unsupported %s instead of selecting a default', (key, value) => {
    expect(() => readFortunePolicy(config({ [key]: value }))).toThrow(
      InvalidEngineConfigError,
    );
  });

  it.each([
    ['decadeLengthYears', '5'],
    ['decadeLengthYears', 0],
    ['decadeLengthYears', 1.9],
    ['decadeLengthYears', 123],
    ['minStartAge', -1],
    ['minStartAge', 2.9],
    ['minStartAge', Number.NaN],
    ['firstDecadeOffsetSteps', Number.POSITIVE_INFINITY],
    ['firstDecadeOffsetSteps', -1],
    ['firstDecadeOffsetSteps', 60],
  ])('rejects an invalid explicit numeric policy %s=%s', (key, value) => {
    expect(() => readFortunePolicy(config({ [key]: value }))).toThrow(
      InvalidEngineConfigError,
    );
  });

  it.each([
    [{ kind: 'ratioDaysPerYear', daysPerYear: 0 }],
    [{ kind: 'ratioDaysPerYear', daysPerYear: Number.NaN }],
    [{ kind: 'ratioMsPerYear', msPerYear: Number.POSITIVE_INFINITY }],
    [{ kind: 'ratioMsPerYear', msPerYear: 86_400_000, extra: true }],
    [{ kind: 'unknown', daysPerYear: 3 }],
    [null],
  ])('rejects a malformed custom start-age method %#', (startAgeMethod) => {
    expect(() => readFortunePolicy(config({ startAgeMethod }))).toThrow(
      InvalidEngineConfigError,
    );
  });

  it('fails closed when a positive custom ratio still produces a non-finite age', () => {
    const engine = createEngine(config({
      startAgeMethod: {
        kind: 'ratioMsPerYear',
        msPerYear: Number.MIN_VALUE,
      },
    }));

    expect(() => engine.analyze({
      birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' },
      sex: 'M',
    })).toThrowError(/calculated fortune start age/);
  });

  it('rejects unknown fields and ambiguous legacy aliases', () => {
    expect(() => readFortunePolicy(config({ directionRules: 'fixedBackward' })))
      .toThrow(InvalidEngineConfigError);
    expect(() => readFortunePolicy(config({
      startAgeMethod: 'threeDaysOneYear',
      startAge: 'oneDayFourMonths',
    }))).toThrow(InvalidEngineConfigError);
  });

  it('preserves every supported policy value without coercion', () => {
    const policy = readFortunePolicy(config({
      directionRule: 'fixedBackward',
      startBoundary: 'jie',
      startAgeMethod: {
        kind: 'ratioDaysPerYear',
        daysPerYear: 3,
        label: 'three-day ratio',
      },
      startAgeRounding: 'ceil',
      minStartAge: 0,
      firstDecadeOffsetSteps: 59,
      decadeLengthYears: 122,
      maxDecades: 0,
      maxYears: 0,
      maxMonths: 0,
      maxDays: 0,
      ageDisplay: 'koreanCountingAge',
      axis: 'utcByGregorianYear',
    }));

    expect(policy).toMatchObject({
      directionRule: 'fixedBackward',
      startBoundary: 'jie',
      startAgeMethod: {
        kind: 'ratioDaysPerYear',
        daysPerYear: 3,
        label: 'three-day ratio',
      },
      startAgeRounding: 'ceil',
      minStartAge: 0,
      firstDecadeOffsetSteps: 59,
      decadeLengthYears: 122,
      maxDecades: 0,
      maxYears: 0,
      maxMonths: 0,
      maxDays: 0,
      ageDisplay: 'koreanCountingAge',
      axis: 'utcByGregorianYear',
    });
  });

  it('keeps the legacy runtime startAge alias but never lets it compete with the canonical key', () => {
    expect(readFortunePolicy(config({
      startAge: { kind: 'ratioMsPerYear', msPerYear: 259_200_000 },
    })).startAgeMethod).toEqual({
      kind: 'ratioMsPerYear',
      msPerYear: 259_200_000,
    });
  });
});
