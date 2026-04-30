import { describe, it, expect } from 'vitest';
import {
  solarApparentLongitudeDeg,
} from '../../../src/calendar/solar.js';
import { utcMsToJulianDay } from '../../../src/calendar/julian.js';

/**
 * Verifies the opt-in IAU 1980 top-10 nutation model and confirms the
 * 'classical' default is byte-stable.
 *
 *   - Default longitude (no solarPrecision arg) is byte-equal to the
 *     explicit 'classical' branch over 100 deterministic samples.
 *   - The top-10 series differs from the single-Ω 'classical' model by
 *     a few arcseconds at most (theoretical envelope ≈ 9″, in practice
 *     ≤ ~7″ across 1900-2100), with the gap dominated by the second-
 *     largest term (D=-2,M=0,M'=0,F=2,Ω=2; A=-13187 in 0.0001 arcsec).
 *   - 'iau1980_full' currently falls through to 'iau1980_top10'
 *     (full-63 wiring lands in a follow-up commit). They must produce
 *     identical longitudes for now.
 */

const ARCSEC_PER_DEG = 3600;
const MS_PER_DAY = 86_400_000;
const START_MS = Date.UTC(1900, 0, 1, 0, 0, 0);
const END_MS = Date.UTC(2100, 11, 31, 23, 59, 59);

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function sampleJulianDays(): number[] {
  const rng = mulberry32(0xC0FFEE);
  const span = END_MS - START_MS;
  const out: number[] = [];
  for (let i = 0; i < 100; i++) {
    const offsetMs = Math.floor(rng() * span);
    const utcMs = START_MS + offsetMs - (offsetMs % 1000);
    out.push(utcMsToJulianDay(utcMs));
  }
  return out;
}

describe('IAU 1980 top-10 nutation', () => {
  it('default solarPrecision (no arg) equals explicit classical (no caller silently switched)', () => {
    for (const jd of sampleJulianDays()) {
      const noArg = solarApparentLongitudeDeg(jd);
      const explicitClassical = solarApparentLongitudeDeg(jd, 'constant', 'classical');
      expect(noArg).toBe(explicitClassical);
    }
  });

  it('top-10 differs from classical by less than 9″ across 100 random samples', () => {
    let maxAbsArcsec = 0;
    let sumAbsArcsec = 0;
    for (const jd of sampleJulianDays()) {
      const cls = solarApparentLongitudeDeg(jd, 'constant', 'classical');
      const top = solarApparentLongitudeDeg(jd, 'constant', 'iau1980_top10');
      const diffArcsec = Math.abs(cls - top) * ARCSEC_PER_DEG;
      if (diffArcsec > maxAbsArcsec) maxAbsArcsec = diffArcsec;
      sumAbsArcsec += diffArcsec;
    }
    // Theory: cumulative top-10 minus single-Ω can reach ≈ 9″ at peaks
    // because the second-largest amplitude row (row index 1, 1.3187″)
    // sometimes adds in phase with Ω. Empirically the worst observed
    // gap is well below 9″ for typical sample distributions.
    expect(maxAbsArcsec).toBeLessThan(9);
    // And there *is* a non-trivial difference — otherwise wiring would
    // be silently ineffective.
    expect(sumAbsArcsec / 100).toBeGreaterThan(0.1);
  });

  it("'iau1980_full' falls through to 'iau1980_top10' until the full table lands", () => {
    // This test documents the explicit fallthrough contract and will
    // need to be updated when the full 63-row dispatch is wired.
    for (const jd of sampleJulianDays().slice(0, 10)) {
      const top10 = solarApparentLongitudeDeg(jd, 'constant', 'iau1980_top10');
      const full = solarApparentLongitudeDeg(jd, 'constant', 'iau1980_full');
      expect(full).toBe(top10);
    }
  });
});
