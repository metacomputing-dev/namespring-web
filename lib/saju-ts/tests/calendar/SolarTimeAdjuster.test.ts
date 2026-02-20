import { describe, it, expect } from 'vitest';
import {
  adjustSolarTime,
  standardMeridianDegrees,
  lmtOffsetMinutes,
  equationOfTimeMinutes,
} from '../../src/calendar/time/SolarTimeAdjuster.js';

/**
 * Ported from SolarTimeAdjusterTest.kt
 *
 * Tests:
 * 1. LMT offset for multiple cities
 * 2. DST correction subtracted before LMT
 * 3. Standard meridian uses standard offset even in DST period
 * 4. LMT baseline override
 * 5. DST on/off produces different adjusted moments
 * 6. Equation of time varies across seasons
 * 7. EoT toggle changes adjusted solar moment
 */

describe('SolarTimeAdjuster', () => {
  // =========================================================================
  // LMT offset for multiple cities
  // =========================================================================

  it('LMT offset matches expected corrections for multiple cities', () => {
    interface LmtCase {
      timezone: string;
      longitude: number;
      expectedMinutes: number;
      label: string;
    }

    const cases: LmtCase[] = [
      { timezone: 'Asia/Seoul',        longitude: 126.978,  expectedMinutes: -32, label: 'Seoul' },
      { timezone: 'Asia/Seoul',        longitude: 129.075,  expectedMinutes: -24, label: 'Busan' },
      { timezone: 'Asia/Seoul',        longitude: 126.705,  expectedMinutes: -33, label: 'Incheon' },
      { timezone: 'Asia/Seoul',        longitude: 126.531,  expectedMinutes: -34, label: 'Jeju' },
      { timezone: 'Asia/Seoul',        longitude: 128.591,  expectedMinutes: -26, label: 'Sokcho' },
      { timezone: 'Asia/Seoul',        longitude: 128.601,  expectedMinutes: -26, label: 'Daegu' },
      { timezone: 'Asia/Tokyo',        longitude: 139.690,  expectedMinutes: 19,  label: 'Tokyo' },
      { timezone: 'America/New_York',  longitude: -74.006,  expectedMinutes: 4,   label: 'NYC' },
      { timezone: 'Europe/London',     longitude: 0.0,      expectedMinutes: 0,   label: 'London' },
      { timezone: 'Asia/Shanghai',     longitude: 116.407,  expectedMinutes: -14, label: 'Beijing' },
    ];

    for (const c of cases) {
      const stdMeridian = standardMeridianDegrees(c.timezone);
      const correction = lmtOffsetMinutes(c.longitude, stdMeridian);
      expect(correction).toBe(
        c.expectedMinutes,
        // Note: vitest expect().toBe() doesn't support message param;
        // this is for documentation purposes in test output
      );
    }
    expect(cases.length).toBeGreaterThanOrEqual(10);
  });

  // =========================================================================
  // DST correction is subtracted before LMT adjustment
  // =========================================================================

  it('DST correction is subtracted before LMT adjustment', () => {
    // 1988-07-01 00:30 KST during DST period
    const adjusted = adjustSolarTime({
      year: 1988, month: 7, day: 1,
      hour: 0, minute: 30,
      timezone: 'Asia/Seoul',
      longitudeDeg: 126.978,
      applyDstHistory: true,
      includeEquationOfTime: false,
    });

    expect(adjusted.dstCorrectionMinutes).toBe(60);
    // Standard moment: 0:30 - 60min = previous day 23:30
    expect(adjusted.standardHour).toBe(23);
    expect(adjusted.standardMinute).toBe(30);
  });

  // =========================================================================
  // Standard meridian uses standard offset even in DST period
  // =========================================================================

  it('standard meridian uses standard offset even in DST period', () => {
    // All Korean timezones use 135.0 as standard meridian, regardless of DST
    expect(standardMeridianDegrees('Asia/Seoul')).toBe(135.0);
    expect(standardMeridianDegrees('Asia/Tokyo')).toBe(135.0);
    expect(standardMeridianDegrees('America/New_York')).toBe(-75.0);
  });

  // =========================================================================
  // LMT baseline override
  // =========================================================================

  it('adjust supports LMT baseline override', () => {
    const base = { year: 2024, month: 2, day: 4, hour: 12, minute: 0,
      timezone: 'Asia/Seoul', longitudeDeg: 126.978,
      applyDstHistory: false, includeEquationOfTime: false };

    const defaultBaseline = adjustSolarTime({ ...base });
    const chineseBaseline = adjustSolarTime({ ...base, lmtBaselineOverride: 120.0 });
    const colonialBaseline = adjustSolarTime({ ...base, lmtBaselineOverride: 127.5 });

    expect(defaultBaseline.longitudeCorrectionMinutes).toBe(-32);
    expect(chineseBaseline.longitudeCorrectionMinutes).toBe(28);
    expect(colonialBaseline.longitudeCorrectionMinutes).toBe(-2);
  });

  // =========================================================================
  // DST on/off produces different adjusted solar moments
  // =========================================================================

  it('DST on and off produce different adjusted solar moments', () => {
    const base = { year: 1988, month: 6, day: 1, hour: 0, minute: 30,
      timezone: 'Asia/Seoul', longitudeDeg: 126.978,
      includeEquationOfTime: false };

    const withDst = adjustSolarTime({ ...base, applyDstHistory: true });
    const withoutDst = adjustSolarTime({ ...base, applyDstHistory: false });

    expect(withDst.dstCorrectionMinutes).toBe(60);
    expect(withoutDst.dstCorrectionMinutes).toBe(0);

    // Adjusted hours should differ
    const withDstKey = withDst.adjustedYear * 100000000 + withDst.adjustedMonth * 1000000 +
      withDst.adjustedDay * 10000 + withDst.adjustedHour * 100 + withDst.adjustedMinute;
    const withoutDstKey = withoutDst.adjustedYear * 100000000 + withoutDst.adjustedMonth * 1000000 +
      withoutDst.adjustedDay * 10000 + withoutDst.adjustedHour * 100 + withoutDst.adjustedMinute;
    expect(withDstKey).not.toBe(withoutDstKey);
  });

  // =========================================================================
  // Equation of time varies across seasons
  // =========================================================================

  it('equation of time varies across seasons', () => {
    // Day of year for each season
    // Jan 1 = 1, Apr 1 ~ 92, Jul 1 ~ 183, Nov 1 ~ 306
    const values = [
      equationOfTimeMinutes(1),   // winter (Jan 1)
      equationOfTimeMinutes(92),  // spring (Apr 1)
      equationOfTimeMinutes(183), // summer (Jul 1)
      equationOfTimeMinutes(306), // autumn (Nov 1)
    ];

    expect(values.some(v => v > 0)).toBe(true);
    expect(values.some(v => v < 0)).toBe(true);
  });

  // =========================================================================
  // EoT toggle changes adjusted solar moment
  // =========================================================================

  it('adjust includes equation of time when enabled', () => {
    const base = { year: 2024, month: 11, day: 1, hour: 12, minute: 0,
      timezone: 'Asia/Seoul', longitudeDeg: 135.0,
      applyDstHistory: false };

    const disabled = adjustSolarTime({ ...base, includeEquationOfTime: false });
    const enabled = adjustSolarTime({ ...base, includeEquationOfTime: true });

    // Longitude 135.0 matches Asia/Seoul standard meridian -> LMT = 0
    expect(disabled.longitudeCorrectionMinutes).toBe(0);
    expect(enabled.longitudeCorrectionMinutes).toBe(0);

    expect(disabled.equationOfTimeMinutes).toBe(0);
    expect(enabled.equationOfTimeMinutes).not.toBe(0);

    // Adjusted moments should differ
    const disKey = disabled.adjustedHour * 100 + disabled.adjustedMinute;
    const enKey = enabled.adjustedHour * 100 + enabled.adjustedMinute;
    expect(disKey).not.toBe(enKey);
  });
});
