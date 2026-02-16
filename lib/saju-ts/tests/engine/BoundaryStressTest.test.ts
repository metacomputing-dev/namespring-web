import { describe, it, expect } from 'vitest';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';

/**
 * Boundary stress test: verifies engine stability and correctness at
 * critical boundary conditions.
 *
 * Covers:
 * - Ipchun minute boundary (strict-after rule)
 * - Yaza boundary policy (day pillar rollover at 23:00)
 * - Month transition boundary (minute-accurate jeol)
 * - LMT shift near year turn
 * - DST boundary and toggle behavior (1988 Korean DST)
 * - Leap day handling
 * - Century boundary saju year continuity
 */

// ---- Helpers ----

function mainstream(dayCutMode: DayCutMode, applyDstHistory: boolean) {
  return createConfig({
    dayCutMode,
    applyDstHistory,
    includeEquationOfTime: false,
    lmtBaselineLongitude: 135.0,
  });
}

function calc(
  year: number, month: number, day: number,
  hour: number, minute: number,
  config: ReturnType<typeof createConfig>,
  longitude = 126.978,
) {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender: Gender.MALE, timezone: 'Asia/Seoul',
    longitude, latitude: 37.5665,
  });
  return calculatePillars(input, config);
}

// ====================================================================
// Tests
// ====================================================================

describe('BoundaryStressTest', () => {

  it('ipchun minute boundary uses strict-after rule', () => {
    const config = mainstream(DayCutMode.MIDNIGHT_00, false);

    // Ipchun 2021 = 2021-02-03 23:59 KST (based on jeol table)
    const before = calc(2021, 2, 3, 23, 58, config, 135.0);
    const atBoundary = calc(2021, 2, 3, 23, 59, config, 135.0);
    const after = calc(2021, 2, 4, 0, 0, config, 135.0);

    // Exact ipchun instant must still use previous saju year
    expect(
      before.pillars.year.equals(atBoundary.pillars.year),
    ).toBe(true);
    expect(
      before.pillars.month.equals(atBoundary.pillars.month),
    ).toBe(true);
    // One minute after boundary must switch saju year
    expect(
      atBoundary.pillars.year.equals(after.pillars.year),
    ).toBe(false);
  });

  it('yaza boundary changes day pillar by policy', () => {
    const midnight = mainstream(DayCutMode.MIDNIGHT_00, false);
    const yaza = mainstream(DayCutMode.YAZA_23_TO_01_NEXTDAY, false);

    const t2259Mid = calc(2024, 8, 7, 22, 59, midnight, 135.0);
    const t2300Mid = calc(2024, 8, 7, 23, 0, midnight, 135.0);
    const t2259Yaza = calc(2024, 8, 7, 22, 59, yaza, 135.0);
    const t2300Yaza = calc(2024, 8, 7, 23, 0, yaza, 135.0);
    const t2301Yaza = calc(2024, 8, 7, 23, 1, yaza, 135.0);

    // MIDNIGHT mode should NOT roll over at 23:00
    expect(t2259Mid.pillars.day.equals(t2300Mid.pillars.day)).toBe(true);
    // YAZA mode should roll over at 23:00
    expect(t2259Yaza.pillars.day.equals(t2300Yaza.pillars.day)).toBe(false);
    // YAZA rollover should remain stable inside 23:xx
    expect(t2300Yaza.pillars.day.equals(t2301Yaza.pillars.day)).toBe(true);
  });

  it('month transition boundary is minute-accurate', () => {
    const config = mainstream(DayCutMode.MIDNIGHT_00, false);

    // Gyeongchip 2024 = 2024-03-05 11:23 KST
    const before = calc(2024, 3, 5, 11, 22, config, 135.0);
    const atBoundary = calc(2024, 3, 5, 11, 23, config, 135.0);
    const after = calc(2024, 3, 5, 11, 24, config, 135.0);

    // Exact jeol instant should stay in previous month pillar (strictly-after)
    expect(before.pillars.month.equals(atBoundary.pillars.month)).toBe(true);
    // After boundary instant should switch month pillar
    expect(atBoundary.pillars.month.equals(after.pillars.month)).toBe(false);
  });

  it('LMT shift is visible near year turn', () => {
    const config = mainstream(DayCutMode.YAZA_23_TO_01_NEXTDAY, false);
    const reference135 = calc(2010, 1, 1, 1, 10, config, 135.0);
    const seoulLongitude = calc(2010, 1, 1, 1, 10, config, 126.978);

    // Longitude correction should shift hour pillar near midnight
    expect(reference135.pillars.hour.equals(seoulLongitude.pillars.hour)).toBe(false);
    // Engine should report different LMT corrections
    expect(reference135.longitudeCorrectionMinutes).toBe(0);
    expect(seoulLongitude.longitudeCorrectionMinutes).not.toBe(0);
  });

  it('DST boundary and toggle behave consistently', () => {
    const withDst = mainstream(DayCutMode.YAZA_23_TO_01_NEXTDAY, true);
    const withoutDst = mainstream(DayCutMode.YAZA_23_TO_01_NEXTDAY, false);

    const preStart = calc(1988, 5, 7, 23, 59, withDst);
    const atStart = calc(1988, 5, 8, 0, 0, withDst);
    const duringDstOn = calc(1988, 6, 1, 0, 30, withDst);
    const duringDstOff = calc(1988, 6, 1, 0, 30, withoutDst);

    // Before DST start, correction must be zero
    expect(preStart.dstCorrectionMinutes).toBe(0);
    // DST start instant must apply +60m correction
    expect(atStart.dstCorrectionMinutes).toBe(60);
    // Inside DST range, correction must remain +60m
    expect(duringDstOn.dstCorrectionMinutes).toBe(60);
    // When disabled, DST correction must stay zero
    expect(duringDstOff.dstCorrectionMinutes).toBe(0);
    // DST toggle should affect effective day near midnight
    expect(duringDstOn.pillars.day.equals(duringDstOff.pillars.day)).toBe(false);
  });

  it('leap day input is handled and day advances normally', () => {
    const config = mainstream(DayCutMode.MIDNIGHT_00, false);
    const leapDay = calc(2000, 2, 29, 12, 0, config, 135.0);
    const nextDay = calc(2000, 3, 1, 12, 0, config, 135.0);

    // Day pillar must advance across leap day boundary
    expect(leapDay.pillars.day.equals(nextDay.pillars.day)).toBe(false);
    // Pillars must be valid
    expect(leapDay.pillars.year.cheongan).toBeDefined();
    expect(nextDay.pillars.year.cheongan).toBeDefined();
  });

  it('century boundary keeps saju year until ipchun', () => {
    const config = mainstream(DayCutMode.MIDNIGHT_00, false);
    const before = calc(1999, 12, 31, 23, 59, config, 135.0);
    const after = calc(2000, 1, 1, 0, 0, config, 135.0);

    // Day pillar must change across Gregorian midnight
    expect(before.pillars.day.equals(after.pillars.day)).toBe(false);
    // Saju year should remain unchanged before ipchun (both in 1999 saju year)
    expect(before.pillars.year.equals(after.pillars.year)).toBe(true);
  });
});
