import { describe, expect, it } from 'vitest';

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
    expect(() => readFortunePolicy(config({ [key]: value }))).toThrow(RangeError);
  });

  it('rejects a directly supplied invalid runtime policy', () => {
    const policy = readFortunePolicy(config({}));
    expect(() => assertFortuneHorizonPolicy({ ...policy, maxMonths: 1_601 })).toThrow(RangeError);
  });
});
