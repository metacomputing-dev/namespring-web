import { describe, it, expect } from 'vitest';
import {
  solarTermUtcMsForLongitude,
  getJieBoundaries,
} from '../../../src/calendar/solarTerms.js';

/**
 * Newton-Raphson root finder regression and equivalence test.
 *
 * - Default behavior (no algorithm argument) must equal explicit
 *   'bisection' — this protects every existing caller.
 * - When the caller opts into 'newton', the resulting instant must
 *   agree with bisection to within the bisection termination band
 *   (~1 second; bisection stops once the JD interval is below 1 sec
 *   so it carries up to ~500 ms of intrinsic ambiguity, while the
 *   Newton solver tightens to sub-microsecond and is then rounded to
 *   ms — the difference therefore lives below 1 sec, not below 1 ms).
 *
 * The deltas are also recorded as a snapshot so a future commit that
 * sharpens or loosens either algorithm shows up in code review.
 */

const SAMPLE_YEARS = [1980, 2000, 2024, 2027, 2050];
const SAMPLE_DEGREES = [0, 90, 180, 270, 315]; // 춘분/하지/추분/동지/입춘
const EQUIVALENCE_TOL_MS = 1000;

describe('Newton root finder', () => {
  it('default algorithm equals explicit bisection (no caller is silently switched)', () => {
    for (const year of SAMPLE_YEARS) {
      for (const deg of SAMPLE_DEGREES) {
        const noAlgo = solarTermUtcMsForLongitude(year, deg, 'meeus');
        const explicitBs = solarTermUtcMsForLongitude(year, deg, 'meeus', 'bisection');
        expect(noAlgo).toBe(explicitBs);
      }
    }
  });

  it('agrees with bisection within 1 sec at sample (year, degree) pairs', () => {
    for (const year of SAMPLE_YEARS) {
      for (const deg of SAMPLE_DEGREES) {
        const bs = solarTermUtcMsForLongitude(year, deg, 'meeus', 'bisection');
        const nw = solarTermUtcMsForLongitude(year, deg, 'meeus', 'newton');
        expect(Math.abs(nw - bs)).toBeLessThanOrEqual(EQUIVALENCE_TOL_MS);
      }
    }
  });

  it('all 12 jie of 2024 agree between algorithms (id and instant)', () => {
    const bs = getJieBoundaries(2024, 'meeus', 'bisection');
    const nw = getJieBoundaries(2024, 'meeus', 'newton');
    expect(bs.length).toBe(12);
    expect(nw.length).toBe(12);
    for (let i = 0; i < 12; i++) {
      expect(nw[i].id).toBe(bs[i].id);
      expect(Math.abs(nw[i].utcMs - bs[i].utcMs)).toBeLessThanOrEqual(EQUIVALENCE_TOL_MS);
    }
  });

  it('records max abs delta across the 25 sample pairs (snapshot)', () => {
    let maxAbs = 0;
    let worst: { year: number; deg: number; bs: number; nw: number } | null = null;
    for (const year of SAMPLE_YEARS) {
      for (const deg of SAMPLE_DEGREES) {
        const bs = solarTermUtcMsForLongitude(year, deg, 'meeus', 'bisection');
        const nw = solarTermUtcMsForLongitude(year, deg, 'meeus', 'newton');
        const abs = Math.abs(nw - bs);
        if (abs > maxAbs) {
          maxAbs = abs;
          worst = { year, deg, bs, nw };
        }
      }
    }
    expect({ maxAbsDeltaMs: maxAbs, worst }).toMatchSnapshot();
  });
});
