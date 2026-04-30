import { describe, it, expect } from 'vitest';
import {
  earthDistanceAU,
  solarApparentLongitudeDeg,
} from '../../../src/calendar/solar.js';
import {
  solarTermUtcMsForLongitude,
} from '../../../src/calendar/solarTerms.js';
import { utcMsToJulianDay } from '../../../src/calendar/julian.js';

/**
 * Verifies the opt-in R-corrected aberration model:
 *
 *   - earthDistanceAU(jme) is in [0.98, 1.02] AU at sample dates and
 *     reproduces the perihelion-near-January / aphelion-near-July split.
 *   - solarApparentLongitudeDeg(jd, 'rCorrected') differs from the
 *     default 'constant' branch by at most ~0.34″ across a year, with
 *     the maximum near perihelion / aphelion.
 *   - The default branch (no aberrationModel arg) still produces the
 *     original -0.00569° aberration — i.e. existing callers are
 *     untouched.
 *   - Solar-term timing under 'rCorrected' differs from 'constant' by
 *     at most a few seconds (≈ ±1.4 sec at peak).
 */

const J2000_JD = 2451545.0; // 2000-01-01 12:00 TT
const ARCSEC_PER_DEG = 3600;

function jdAt(iso: string): number {
  return utcMsToJulianDay(new Date(iso).getTime());
}

describe('Earth-Sun distance R(t)', () => {
  it('is in [0.98, 1.02] AU at J2000.0', () => {
    // J2000.0 = 2000-01-01 12:00 TT, ≈ 2 days before perihelion, so
    // R ≈ 0.9833 AU there (not 1.0). The R-series only equals 1.0 by
    // chance around the equinoxes, never at jme = 0.
    const r = earthDistanceAU(0);
    expect(r).toBeGreaterThan(0.98);
    expect(r).toBeLessThan(1.02);
  });

  it('is < 1 near January perihelion and > 1 near July aphelion (year 2000)', () => {
    const perihelion = earthDistanceAU(
      (jdAt('2000-01-04T00:00:00Z') - J2000_JD) / 365250,
    );
    const aphelion = earthDistanceAU(
      (jdAt('2000-07-04T00:00:00Z') - J2000_JD) / 365250,
    );
    expect(perihelion).toBeGreaterThan(0.98);
    expect(perihelion).toBeLessThan(1.0);
    expect(aphelion).toBeGreaterThan(1.0);
    expect(aphelion).toBeLessThan(1.02);
    expect(aphelion - perihelion).toBeGreaterThan(0.03); // ≈ 2e on a unit AU
  });
});

describe('Aberration model: constant vs rCorrected', () => {
  it('default longitude equals explicit constant (existing callers untouched)', () => {
    const sampleJds = [
      jdAt('1980-03-20T00:00:00Z'),
      jdAt('2000-06-21T00:00:00Z'),
      jdAt('2024-09-22T00:00:00Z'),
      jdAt('2027-12-22T00:00:00Z'),
    ];
    for (const jd of sampleJds) {
      const noArg = solarApparentLongitudeDeg(jd);
      const explicitConstant = solarApparentLongitudeDeg(jd, 'constant');
      expect(noArg).toBe(explicitConstant);
    }
  });

  it('peak |constant − rCorrected| over 2024 is roughly 0.34″ (within ±0.1″ tolerance)', () => {
    let maxAbsArcsec = 0;
    // Sample one point per ~5 days across 2024.
    const startJd = jdAt('2024-01-01T00:00:00Z');
    for (let dayOffset = 0; dayOffset < 366; dayOffset += 5) {
      const jd = startJd + dayOffset;
      const cnst = solarApparentLongitudeDeg(jd, 'constant');
      const rcor = solarApparentLongitudeDeg(jd, 'rCorrected');
      const diffDeg = cnst - rcor;
      const diffArcsec = Math.abs(diffDeg) * ARCSEC_PER_DEG;
      if (diffArcsec > maxAbsArcsec) maxAbsArcsec = diffArcsec;
    }
    // Theory: -0.00569 (constant, R=1) vs -20.4898/R/3600. Peak |Δ| at
    // R=0.9833 (perihelion) ≈ 0.348″ and at R=1.0167 (aphelion) ≈ 0.336″.
    expect(maxAbsArcsec).toBeGreaterThan(0.25);
    expect(maxAbsArcsec).toBeLessThan(0.45);
  });

  it('R-corrected is more negative than constant near perihelion (R<1) and less negative near aphelion (R>1)', () => {
    // At perihelion R<1 → -20.4898/R is more negative than -0.00569
    //   so rCorrected < constant (more subtraction)
    // At aphelion  R>1 → -20.4898/R is less negative than -0.00569
    //   so rCorrected > constant (less subtraction)
    const perihelionJd = jdAt('2024-01-03T00:00:00Z');
    const aphelionJd = jdAt('2024-07-05T00:00:00Z');

    const cP = solarApparentLongitudeDeg(perihelionJd, 'constant');
    const rP = solarApparentLongitudeDeg(perihelionJd, 'rCorrected');
    expect(rP).toBeLessThan(cP);

    const cA = solarApparentLongitudeDeg(aphelionJd, 'constant');
    const rA = solarApparentLongitudeDeg(aphelionJd, 'rCorrected');
    expect(rA).toBeGreaterThan(cA);
  });
});

describe('Solar-term timing under rCorrected', () => {
  it('differs from constant by at most ~10 sec at sample terms', () => {
    // Theory: aberration delta is at most 0.34″, and 1″ of solar
    // longitude corresponds to ~24.4 sec of clock time at the Sun's
    // mean motion of 0.9856°/day, so peak |Δ| is ≈ 8.3 sec. Add the
    // bisection ±500 ms termination band → ~10 sec safety margin.
    const samples = [
      [2024, 0],   // 春分
      [2024, 90],  // 夏至
      [2024, 180], // 秋分
      [2024, 270], // 冬至
      [2024, 315], // 立春
    ] as const;
    for (const [year, deg] of samples) {
      const cnst = solarTermUtcMsForLongitude(year, deg, 'meeus', 'bisection', 'constant');
      const rcor = solarTermUtcMsForLongitude(year, deg, 'meeus', 'bisection', 'rCorrected');
      const deltaSec = (rcor - cnst) / 1000;
      expect(Math.abs(deltaSec)).toBeLessThan(10);
    }
  });
});
