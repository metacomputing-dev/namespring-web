import { describe, it, expect } from 'vitest';
import {
  hiddenStemsOfBranch,
  type HiddenStem,
} from '../../../src/core/hiddenStems.js';
import { hiddenStemsForChart } from '../../../src/core/wollyul.js';

/**
 * Backward-compatibility guarantees for the saryeongScheme work:
 *
 *   1. `hiddenStemsOfBranch(branch, policy?)` retains its original
 *      pure (branch, policy?) signature — adding a JieData parameter
 *      to it would have rippled through every internal caller and
 *      broken the "API contract" promise. The new chart-time
 *      computation lives in the sibling `hiddenStemsForChart`.
 *   2. `hiddenStemsForChart(branch, jieData, policy)` with no
 *      `policy.saryeongScheme` returns *exactly* the same array as
 *      `hiddenStemsOfBranch(branch, policy)` — the dispatch falls
 *      through to the pure path so existing schemes are byte-stable.
 *   3. Every static scheme combination (default, 'standard', 'equal',
 *      and the 'standard' overrides) keeps producing the exact same
 *      weights for every branch, regardless of jieData.
 *
 * These checks are the "no silent drift" wall around the static
 * code paths: if any future commit accidentally re-routes an
 * existing caller through the saryeong path, one of these tests
 * will fire.
 */

const BRANCHES = Array.from({ length: 12 }, (_, i) => i);

const SAMPLE_JIE_DATA = [
  { elapsedDays: 0, monthLengthDays: 30 },
  { elapsedDays: 5, monthLengthDays: 30 },
  { elapsedDays: 10, monthLengthDays: 30 },
  { elapsedDays: 15, monthLengthDays: 30 },
  { elapsedDays: 25, monthLengthDays: 30 },
  { elapsedDays: 12.5, monthLengthDays: 29.5 }, // shorter month
  { elapsedDays: 28, monthLengthDays: 30.5 },   // longer month
];

function arraysEqual(a: HiddenStem[], b: HiddenStem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].stem !== b[i].stem) return false;
    if (a[i].role !== b[i].role) return false;
    if (a[i].weight !== b[i].weight) return false;
  }
  return true;
}

describe('hiddenStemsOfBranch backward compatibility', () => {
  it('default policy returns the same shape it always did (1/2/3 stems by branch)', () => {
    const expectedSizes = [1, 3, 3, 1, 3, 3, 2, 3, 3, 1, 3, 2];
    for (const b of BRANCHES) {
      const out = hiddenStemsOfBranch(b);
      expect(out.length).toBe(expectedSizes[b]);
    }
  });

  it('default policy weights remain (1) / (0.7,0.3) / (0.6,0.3,0.1)', () => {
    for (const b of BRANCHES) {
      const out = hiddenStemsOfBranch(b);
      const weights = out.map((x) => x.weight);
      const sum = weights.reduce((s, w) => s + w, 0);
      // weights are normalized to 1
      expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
      if (out.length === 1) {
        expect(weights[0]).toBe(1);
      } else if (out.length === 2) {
        expect(weights[0]).toBeCloseTo(0.7, 9);
        expect(weights[1]).toBeCloseTo(0.3, 9);
      } else {
        expect(weights[0]).toBeCloseTo(0.6, 9);
        expect(weights[1]).toBeCloseTo(0.3, 9);
        expect(weights[2]).toBeCloseTo(0.1, 9);
      }
    }
  });
});

describe("hiddenStemsForChart fallthrough when saryeongScheme is unset", () => {
  it('byte-equals hiddenStemsOfBranch for every (branch × jieData × policy) sample', () => {
    const policies = [
      undefined,
      { scheme: 'standard' as const },
      { scheme: 'equal' as const },
      {
        scheme: 'standard' as const,
        standard: {
          one: 1,
          two: { main: 0.6, residual: 0.4 },
          three: { main: 0.5, middle: 0.3, residual: 0.2 },
        },
      },
    ];

    for (const b of BRANCHES) {
      for (const jd of SAMPLE_JIE_DATA) {
        for (const p of policies) {
          const expected = hiddenStemsOfBranch(b, p);
          const actual = hiddenStemsForChart(b, jd, p);
          expect(arraysEqual(actual, expected)).toBe(true);
        }
      }
    }
  });

  it('explicit saryeongScheme=undefined behaves like the field being absent', () => {
    for (const b of BRANCHES) {
      const expected = hiddenStemsOfBranch(b);
      const actual = hiddenStemsForChart(
        b,
        { elapsedDays: 5, monthLengthDays: 30 },
        { saryeongScheme: undefined },
      );
      expect(arraysEqual(actual, expected)).toBe(true);
    }
  });
});
