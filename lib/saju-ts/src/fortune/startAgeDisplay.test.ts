import { describe, expect, it } from 'vitest';

import { createEngine } from '../api/engine.js';

const MS_PER_DAY = 86_400_000;
const REQUEST = {
  birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' },
  sex: 'M',
} as const;

function fortune(fortunePolicy: Record<string, unknown> = {}) {
  const bundle = createEngine({
    strategies: {
      fortune: {
        maxDecades: 1,
        maxYears: 0,
        maxMonths: 0,
        maxDays: 0,
        ...fortunePolicy,
      },
    },
  }).analyze(REQUEST as any);
  return bundle.summary.fortune!;
}

function policyForRemainderMs(
  deltaMs: number,
  remainderMs: number,
  startAgeRounding: string,
) {
  const msPerYear = deltaMs - remainderMs;
  expect(msPerYear).toBeGreaterThan(0);
  return {
    startAgeMethod: { kind: 'ratioMsPerYear', msPerYear },
    startAgeRounding,
    minStartAge: 0,
  };
}

describe('fortune start-age display policy boundaries', () => {
  const probe = fortune({ minStartAge: 0 });
  const deltaMs = probe.start.deltaMs;

  it.each([
    ['round1down2up', 2 * MS_PER_DAY - 1, 1],
    ['round1down2up', 2 * MS_PER_DAY, 2],
    ['round1down2up', 2 * MS_PER_DAY + 1, 2],
    ['threshold8months', 2 * MS_PER_DAY - 1, 1],
    ['threshold8months', 2 * MS_PER_DAY, 1],
    ['threshold8months', 2 * MS_PER_DAY + 1, 2],
  ])('%s at the exact two-day boundary (%d ms) displays %d', (rounding, remainderMs, expected) => {
    const result = fortune(policyForRemainderMs(deltaMs, remainderMs, rounding));
    expect(result.start.startAgeDisplay).toBe(expected);
    expect(result.decades[0]?.displayStartAge).toBe(expected);
  });

  it.each([
    ['floor', 1],
    ['none', 1],
    ['ceil', 2],
  ])('%s characterizes the same fractional continuous start age', (rounding, expected) => {
    const result = fortune(policyForRemainderMs(deltaMs, 2 * MS_PER_DAY, rounding));
    expect(result.start.startAgeDisplay).toBe(expected);
    expect(result.decades[0]?.displayStartAge).toBe(expected);
  });

  it('changes only integer display fields, not the continuous timeline', () => {
    const results = ['round1down2up', 'threshold8months', 'floor', 'ceil', 'none']
      .map((startAgeRounding) => fortune(
        policyForRemainderMs(deltaMs, 2 * MS_PER_DAY, startAgeRounding),
      ));
    const reference = results[0]!;

    for (const result of results.slice(1)) {
      expect(result.start.deltaMs).toBe(reference.start.deltaMs);
      expect(result.start.startAgeYears).toBe(reference.start.startAgeYears);
      expect(result.decades[0]?.startAgeYears).toBe(reference.decades[0]?.startAgeYears);
      expect(result.decades[0]?.endAgeYears).toBe(reference.decades[0]?.endAgeYears);
    }
  });

  it.each([
    [0, 0],
    [1, 1],
    [2.9, 2],
    [-1, 0],
  ])('normalizes minStartAge=%s to the documented integer lower bound %d', (minStartAge, expected) => {
    const result = fortune({
      startAgeMethod: { kind: 'ratioMsPerYear', msPerYear: deltaMs * 2 },
      startAgeRounding: 'floor',
      minStartAge,
    });
    expect(result.start.startAgeYears).toBe(0.5);
    expect(result.start.startAgeDisplay).toBe(expected);
    expect(result.decades[0]?.startAgeYears).toBe(0.5);
    expect(result.decades[0]?.displayStartAge).toBe(expected);
  });
});
