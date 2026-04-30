import { describe, it, expect } from 'vitest';
import {
  equationOfTimeMinutesPrecise,
} from '../../../src/calendar/solar.js';
import {
  equationOfTimeMinutesApprox,
  computeTrueSolarTimeCorrection,
} from '../../../src/calendar/trueSolarTime.js';
import { utcMsToJulianDay } from '../../../src/calendar/julian.js';

/**
 * Verifies the precise Equation-of-Time path:
 *
 *   - Known annual extrema (early Feb minimum ≈ -14.2 min, mid-May
 *     near-zero crossing, late-July minimum ≈ -6.5 min, early Nov
 *     maximum ≈ +16.4 min) match the precise formula to within a
 *     fraction of a minute.
 *   - Across an evenly-spaced sample of a year, |precise - approx|
 *     stays inside the NOAA approximation's documented residual of
 *     about 30 seconds.
 *   - The trueSolarTime dispatch routes 'precise' to the new path
 *     (method='precise', non-zero equationOfTimeMinutes) while the
 *     'approx' and 'off' branches stay byte-stable.
 */

const MIN_EXTREMA = [
  // (date UTC noon-ish, expected EoT in minutes, tolerance in minutes)
  // Source: USNO / NOAA published "highlights of the year" for EoT.
  { iso: '2024-02-11T12:00:00Z', expectedMin: -14.24, tolMin: 0.5 },
  { iso: '2024-05-14T12:00:00Z', expectedMin: 3.66, tolMin: 0.5 },
  { iso: '2024-07-26T12:00:00Z', expectedMin: -6.49, tolMin: 0.5 },
  { iso: '2024-11-03T12:00:00Z', expectedMin: 16.46, tolMin: 0.5 },
];

describe('Precise Equation of Time', () => {
  it('reproduces the four canonical 2024 EoT extrema within 0.5 minute', () => {
    for (const c of MIN_EXTREMA) {
      const jdUtc = utcMsToJulianDay(new Date(c.iso).getTime());
      const eot = equationOfTimeMinutesPrecise(jdUtc);
      expect(Math.abs(eot - c.expectedMin)).toBeLessThan(c.tolMin);
    }
  });

  it('precise vs approx stays within NOAA residual (~30 sec) over a 2024 year sweep', () => {
    let maxAbsSec = 0;
    const startMs = Date.UTC(2024, 0, 1);
    for (let dayOffset = 0; dayOffset < 366; dayOffset += 5) {
      const utcMs = startMs + dayOffset * 86_400_000;
      const approxMin = equationOfTimeMinutesApprox(utcMs);
      const preciseMin = equationOfTimeMinutesPrecise(utcMsToJulianDay(utcMs));
      const diffSec = Math.abs(approxMin - preciseMin) * 60;
      if (diffSec > maxAbsSec) maxAbsSec = diffSec;
    }
    // NOAA approximation is documented at ≈ ±30 sec residual; allow
    // some headroom for our particular sampling cadence.
    expect(maxAbsSec).toBeLessThan(45);
    // Also assert the two are not silently identical.
    expect(maxAbsSec).toBeGreaterThan(0.1);
  });
});

describe('trueSolarTime dispatch — equationOfTime: off | approx | precise', () => {
  const baseArgs = {
    utcMs: Date.UTC(2024, 5, 21, 12, 0, 0),
    offsetMinutes: 9 * 60,
    location: { lat: 37.5665, lon: 126.978 },
  } as const;

  it("'off' yields zero EoT and method='none'", () => {
    const r = computeTrueSolarTimeCorrection({
      ...baseArgs,
      policy: { enabled: true, equationOfTime: 'off' },
    });
    expect(r.applied).toBe(true);
    expect(r.method).toBe('none');
    expect(r.equationOfTimeMinutes).toBe(0);
  });

  it("'approx' uses the NOAA approximation and method='approx'", () => {
    const r = computeTrueSolarTimeCorrection({
      ...baseArgs,
      policy: { enabled: true, equationOfTime: 'approx' },
    });
    expect(r.method).toBe('approx');
    const expectApproxMin = equationOfTimeMinutesApprox(baseArgs.utcMs);
    expect(r.equationOfTimeMinutes).toBe(expectApproxMin);
  });

  it("'precise' routes through equationOfTimeMinutesPrecise", () => {
    const r = computeTrueSolarTimeCorrection({
      ...baseArgs,
      policy: { enabled: true, equationOfTime: 'precise' },
    });
    expect(r.method).toBe('precise');
    const expectPreciseMin = equationOfTimeMinutesPrecise(
      utcMsToJulianDay(baseArgs.utcMs),
    );
    expect(r.equationOfTimeMinutes).toBe(expectPreciseMin);
  });

  it("'approx' and 'precise' agree to within ~30 sec at the test instant", () => {
    const a = computeTrueSolarTimeCorrection({
      ...baseArgs,
      policy: { enabled: true, equationOfTime: 'approx' },
    });
    const p = computeTrueSolarTimeCorrection({
      ...baseArgs,
      policy: { enabled: true, equationOfTime: 'precise' },
    });
    const diffSec = Math.abs(
      (a.equationOfTimeMinutes ?? 0) - (p.equationOfTimeMinutes ?? 0),
    ) * 60;
    expect(diffSec).toBeLessThan(30);
  });
});
