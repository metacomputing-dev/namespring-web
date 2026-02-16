import { describe, it, expect } from 'vitest';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig, configFromPreset, SchoolPreset } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';

/**
 * Ported from DefaultSajuCalculatorTest.kt
 *
 * Tests day-cut mode boundary behavior, DST correction,
 * longitude correction, equation of time, and Ipchun boundary.
 */

function mainstream(opts: {
  dayCutMode: DayCutMode;
  applyDstHistory?: boolean;
  includeEquationOfTime?: boolean;
}) {
  return createConfig({
    ...configFromPreset(SchoolPreset.KOREAN_MAINSTREAM),
    dayCutMode: opts.dayCutMode,
    applyDstHistory: opts.applyDstHistory ?? false,
    includeEquationOfTime: opts.includeEquationOfTime ?? false,
    lmtBaselineLongitude: 135.0,
  });
}

function calc(
  year: number, month: number, day: number, hour: number, minute: number,
  config: ReturnType<typeof createConfig>,
  longitude = 126.978,
  latitude = 37.5665,
) {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender: Gender.MALE,
    longitude,
    latitude,
  });
  return calculatePillars(input, config);
}

describe('DefaultSajuCalculator', () => {
  // =========================================================================
  // Day cut mode tests
  // =========================================================================

  it('MIDNIGHT_00 changes day at calendar midnight', () => {
    const config = mainstream({ dayCutMode: DayCutMode.MIDNIGHT_00 });
    const before = calc(2024, 8, 7, 23, 59, config, 135.0);
    const after = calc(2024, 8, 8, 0, 0, config, 135.0);

    expect(before.pillars.day.equals(after.pillars.day)).toBe(false);
  });

  it('YAZA policy rolls day at 23:00', () => {
    const config = mainstream({ dayCutMode: DayCutMode.YAZA_23_TO_01_NEXTDAY });
    const before = calc(2024, 8, 7, 22, 59, config, 135.0);
    const atBoundary = calc(2024, 8, 7, 23, 0, config, 135.0);

    expect(before.pillars.day.equals(atBoundary.pillars.day)).toBe(false);
  });

  it('YAZA_23_30 policy rolls only after 23:30', () => {
    const config = mainstream({ dayCutMode: DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY });
    const before = calc(2024, 8, 7, 23, 29, config, 135.0);
    const atBoundary = calc(2024, 8, 7, 23, 30, config, 135.0);

    expect(before.pillars.day.equals(atBoundary.pillars.day)).toBe(false);
  });

  it('JOJA_SPLIT keeps current day during 23:xx', () => {
    const config = mainstream({ dayCutMode: DayCutMode.JOJA_SPLIT });
    const before = calc(2024, 8, 7, 22, 59, config, 135.0);
    const lateNight = calc(2024, 8, 7, 23, 40, config, 135.0);

    expect(before.pillars.day.equals(lateNight.pillars.day)).toBe(true);
  });

  // =========================================================================
  // Ipchun boundary
  // =========================================================================

  it('Ipchun boundary switches year and month after boundary minute', () => {
    const config = mainstream({ dayCutMode: DayCutMode.MIDNIGHT_00 });
    const before = calc(2021, 2, 3, 23, 58, config, 135.0);
    const atBoundary = calc(2021, 2, 3, 23, 59, config, 135.0);
    const after = calc(2021, 2, 4, 0, 0, config, 135.0);

    // Before and at boundary should share year/month
    expect(before.pillars.year.equals(atBoundary.pillars.year)).toBe(true);
    expect(before.pillars.month.equals(atBoundary.pillars.month)).toBe(true);

    // At boundary and after should differ in year and month
    expect(atBoundary.pillars.year.equals(after.pillars.year)).toBe(false);
    expect(atBoundary.pillars.month.equals(after.pillars.month)).toBe(false);
  });

  // =========================================================================
  // DST correction
  // =========================================================================

  it('DST correction applies during 1988 summer time', () => {
    const config = mainstream({
      dayCutMode: DayCutMode.MIDNIGHT_00,
      applyDstHistory: true,
    });
    const result = calc(1988, 6, 1, 0, 30, config);

    // Standard time should be shifted back by 60 minutes
    // 0:30 - 60min = previous day 23:30
    expect(result.standardHour).toBe(23);
    expect(result.standardMinute).toBe(30);
    expect(result.standardDay).toBe(31); // May 31
    expect(result.dstCorrectionMinutes).toBe(60);
  });

  it('DST toggle changes effective time near midnight', () => {
    const withDst = mainstream({
      dayCutMode: DayCutMode.YAZA_23_TO_01_NEXTDAY,
      applyDstHistory: true,
    });
    const withoutDst = mainstream({
      dayCutMode: DayCutMode.YAZA_23_TO_01_NEXTDAY,
      applyDstHistory: false,
    });
    const a = calc(1988, 6, 1, 0, 30, withDst);
    const b = calc(1988, 6, 1, 0, 30, withoutDst);

    // Standard moments should differ when DST is toggled
    expect(a.standardHour).not.toBe(b.standardHour);
  });

  // =========================================================================
  // Longitude (LMT) correction
  // =========================================================================

  it('longitude correction can shift hour pillar near midnight', () => {
    const config = mainstream({ dayCutMode: DayCutMode.MIDNIGHT_00 });
    const seoulLon = calc(2010, 1, 1, 0, 15, config, 126.978);
    const base135 = calc(2010, 1, 1, 0, 15, config, 135.0);

    // Seoul (126.978) has LMT = -32 minutes; 135.0 has LMT = 0
    // 0:15 - 32 = previous day 23:43 for Seoul
    // 0:15 - 0 = 0:15 for 135.0
    // Different adjusted hours means different hour pillars
    expect(seoulLon.pillars.hour.equals(base135.pillars.hour)).toBe(false);
    expect(seoulLon.longitudeCorrectionMinutes).toBe(-32);
  });

  // =========================================================================
  // Equation of Time
  // =========================================================================

  it('equation of time toggle changes adjusted solar moment', () => {
    const off = mainstream({
      dayCutMode: DayCutMode.MIDNIGHT_00,
      includeEquationOfTime: false,
    });
    const on = mainstream({
      dayCutMode: DayCutMode.MIDNIGHT_00,
      includeEquationOfTime: true,
    });
    const r1 = calc(2024, 11, 3, 12, 0, off, 135.0);
    const r2 = calc(2024, 11, 3, 12, 0, on, 135.0);

    expect(r1.equationOfTimeMinutes).toBe(0);
    expect(r2.equationOfTimeMinutes).not.toBe(0);
    // Adjusted minutes should differ when EoT is enabled
    expect(r1.adjustedMinute).not.toBe(r2.adjustedMinute);
  });
});
