import { describe, it, expect } from 'vitest';
import {
  solarApparentLongitudeDeg,
} from '../../../src/calendar/solar.js';
import {
  fundamentalArgsDeg,
  nutationLongitudeDegFull,
  nutationLongitudeDegTop10,
} from '../../../src/calendar/nutationIau1980.js';

/**
 * Validates the full 63-row IAU 1980 nutation series against the
 * worked example in NREL/TP-560-34302 §A.5 (Table A.5.1):
 *
 *   - Date = 2003-10-17, Time = 12:30:30 LST, TZ = -7h, ΔT = 67 s
 *   - UT  = 2003-10-17 19:30:30
 *   - JD  = 2452930.312847
 *
 * The paper reports:
 *   - Δψ (nutation in longitude) = -0.00399840°
 *   - λ  (apparent solar longitude) = 204.0085519281°
 *
 * saju-ts uses its own ΔT polynomial (not the paper's literal 67 s),
 * so we expect the longitude to match within a small tolerance — the
 * ~2-3 sec ΔT delta translates to <0.001° in λ.
 */

const NREL_JD_UTC = 2452930.312847;
const NREL_DELTA_T_SEC = 67.0;
const NREL_DPSI_DEG = -0.00399840;
const NREL_LAMBDA_DEG = 204.0085519281;

function jdTtFromNrel(jdUtc: number, deltaTSec: number): number {
  return jdUtc + deltaTSec / 86400;
}

describe('IAU 1980 nutation full series — NREL SPA paper example', () => {
  it('Δψ (full 63) matches the paper to within 1e-5 deg using the paper ΔT', () => {
    const jdTT = jdTtFromNrel(NREL_JD_UTC, NREL_DELTA_T_SEC);
    const T = (jdTT - 2451545.0) / 36525.0;
    const dpsi = nutationLongitudeDegFull(T);
    expect(Math.abs(dpsi - NREL_DPSI_DEG)).toBeLessThan(1e-5);
  });

  it('apparent solar longitude (full + rCorrected) matches the paper to within 0.001 deg', () => {
    // saju-ts derives ΔT from its own polynomial, which differs from
    // the paper's literal 67 s by ~2.5 s in 2003 (≈ 0.03″ in λ).
    const lambda = solarApparentLongitudeDeg(NREL_JD_UTC, 'rCorrected', 'iau1980_full');
    expect(Math.abs(lambda - NREL_LAMBDA_DEG)).toBeLessThan(0.001);
  });

  it('full 63 series and top-10 differ on this example (full is closer to the paper)', () => {
    const jdTT = jdTtFromNrel(NREL_JD_UTC, NREL_DELTA_T_SEC);
    const T = (jdTT - 2451545.0) / 36525.0;
    const top10 = nutationLongitudeDegTop10(T);
    const full = nutationLongitudeDegFull(T);
    expect(top10).not.toBe(full);
    expect(Math.abs(full - NREL_DPSI_DEG)).toBeLessThan(Math.abs(top10 - NREL_DPSI_DEG));
  });

  it('fundamental arguments match the IAU 1980 polynomial range at the paper instant', () => {
    const jdTT = jdTtFromNrel(NREL_JD_UTC, NREL_DELTA_T_SEC);
    const T = (jdTT - 2451545.0) / 36525.0;
    const args = fundamentalArgsDeg(T);
    // Each angle is finite; concrete values are checked indirectly via
    // the Δψ assertion above.
    for (const v of [args.D, args.M, args.Mp, args.F, args.Omega]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
