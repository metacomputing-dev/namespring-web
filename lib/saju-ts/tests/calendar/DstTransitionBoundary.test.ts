import { describe, it, expect } from 'vitest';
import { koreanDstOffsetMinutes, KOREAN_DST_RANGES } from '../../src/calendar/time/KoreanDstPeriod.js';
import { adjustSolarTime } from '../../src/calendar/time/SolarTimeAdjuster.js';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig, DEFAULT_CONFIG } from '../../src/config/CalculationConfig.js';

/**
 * Ported from DstTransitionBoundaryTest.kt
 *
 * DST transition boundary tests verifying:
 * 1. KoreanDstPeriod boundary behavior
 * 2. SolarTimeAdjuster DST correction
 * 3. Pipeline integration (DST affecting hour pillar)
 * 4. All DST periods boundary consistency
 * 5. Non-DST years
 * 6. Period count
 */

function createInput(
  year: number, month: number, day: number,
  hour: number, minute: number,
) {
  return createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender: Gender.MALE,
    longitude: 126.978,
  });
}

describe('DstTransitionBoundary', () => {
  // =========================================================================
  // KoreanDstPeriod boundary verification
  // =========================================================================

  it('DST offset is 60 at start of 1988 DST period', () => {
    // 1988-05-08 = DST start
    expect(koreanDstOffsetMinutes(1988, 5, 8)).toBe(60);
  });

  it('DST offset is 0 just before 1988 DST start', () => {
    // 1988-05-07 is the day before DST start
    expect(koreanDstOffsetMinutes(1988, 5, 7)).toBe(0);
  });

  it('DST offset is 60 just before 1988 DST end', () => {
    // 1988-10-08 is the last day of DST (endExclusive is 1988-10-09)
    expect(koreanDstOffsetMinutes(1988, 10, 8)).toBe(60);
  });

  it('DST offset is 0 at exact 1988 DST end', () => {
    // 1988-10-09 = DST end (exclusive)
    expect(koreanDstOffsetMinutes(1988, 10, 9)).toBe(0);
  });

  // =========================================================================
  // All DST periods boundary consistency
  // =========================================================================

  it('all DST periods have correct boundary behavior', () => {
    for (const period of KOREAN_DST_RANGES) {
      // At start: offset = 60
      expect(koreanDstOffsetMinutes(
        period.startYear, period.startMonth, period.startDay,
      )).toBe(60);

      // Day before start: offset = 0
      // Compute the day before by subtracting one day
      const beforeStart = new Date(Date.UTC(
        period.startYear, period.startMonth - 1, period.startDay - 1,
      ));
      expect(koreanDstOffsetMinutes(
        beforeStart.getUTCFullYear(), beforeStart.getUTCMonth() + 1, beforeStart.getUTCDate(),
      )).toBe(0);

      // Day before end: offset = 60
      const beforeEnd = new Date(Date.UTC(
        period.endYear, period.endMonth - 1, period.endDay - 1,
      ));
      expect(koreanDstOffsetMinutes(
        beforeEnd.getUTCFullYear(), beforeEnd.getUTCMonth() + 1, beforeEnd.getUTCDate(),
      )).toBe(60);

      // At end: offset = 0 (exclusive end)
      expect(koreanDstOffsetMinutes(
        period.endYear, period.endMonth, period.endDay,
      )).toBe(0);
    }
  });

  // =========================================================================
  // SolarTimeAdjuster DST correction verification
  // =========================================================================

  it('SolarTimeAdjuster applies DST correction during 1988 summer', () => {
    // 1988-07-15 14:30 KDT (= 13:30 KST after DST correction)
    const result = adjustSolarTime({
      year: 1988, month: 7, day: 15,
      hour: 14, minute: 30,
      timezone: 'Asia/Seoul',
      longitudeDeg: 126.978,
      applyDstHistory: true,
      includeEquationOfTime: false,
    });

    expect(result.dstCorrectionMinutes).toBe(60);
    expect(result.standardHour).toBe(13);
  });

  it('SolarTimeAdjuster no DST correction outside DST period', () => {
    // 1988-01-15 14:30 KST (not DST period)
    const result = adjustSolarTime({
      year: 1988, month: 1, day: 15,
      hour: 14, minute: 30,
      timezone: 'Asia/Seoul',
      longitudeDeg: 126.978,
      applyDstHistory: true,
      includeEquationOfTime: false,
    });

    expect(result.dstCorrectionMinutes).toBe(0);
  });

  it('SolarTimeAdjuster skips DST when disabled', () => {
    const result = adjustSolarTime({
      year: 1988, month: 7, day: 15,
      hour: 14, minute: 30,
      timezone: 'Asia/Seoul',
      longitudeDeg: 126.978,
      applyDstHistory: false,
      includeEquationOfTime: false,
    });

    expect(result.dstCorrectionMinutes).toBe(0);
  });

  // =========================================================================
  // Pipeline integration: DST can change hour pillar
  // =========================================================================

  it('DST correction can change hour pillar for boundary birth time', () => {
    // 1988-07-15 02:00 KDT -> after DST(-60): 01:00 KST -> LMT(-32): 00:28 -> 자시(子時)
    // Without DST: 02:00 KST -> LMT(-32): 01:28 -> 축시(丑時)
    const inputWithDst = createInput(1988, 7, 15, 2, 0);
    const resultWithDst = calculatePillars(inputWithDst, createConfig({
      applyDstHistory: true,
    }));

    const inputNoDst = createInput(1988, 7, 15, 2, 0);
    const resultNoDst = calculatePillars(inputNoDst, createConfig({
      applyDstHistory: false,
    }));

    // DST correction should move across 丑/子 boundary
    expect(resultWithDst.pillars.hour.equals(resultNoDst.pillars.hour)).toBe(false);
  });

  // =========================================================================
  // Pipeline valid results for each DST era
  // =========================================================================

  it('pipeline produces valid results for births during each DST era', () => {
    const dstSamples = [
      [1948, 7, 15],  // 1948-1951 era
      [1955, 7, 15],  // 1955-1960 era
      [1987, 7, 15],  // 1987 standalone
      [1988, 7, 15],  // 1988 standalone (Olympics)
    ] as const;

    for (const [year, month, day] of dstSamples) {
      const input = createInput(year, month, day, 14, 30);
      const result = calculatePillars(input);

      // All four pillars should be present
      expect(result.pillars.year).toBeDefined();
      expect(result.pillars.month).toBeDefined();
      expect(result.pillars.day).toBeDefined();
      expect(result.pillars.hour).toBeDefined();
    }
  });

  // =========================================================================
  // 1948 first Korean DST period boundary
  // =========================================================================

  it('1948 first Korean DST period boundary is correct', () => {
    expect(koreanDstOffsetMinutes(1948, 6, 1)).toBe(60);
    expect(koreanDstOffsetMinutes(1948, 5, 31)).toBe(0);
  });

  // =========================================================================
  // No DST for years without Korean DST
  // =========================================================================

  it('no DST for years without Korean DST (1952-1954, 1961-1986, 1989+)', () => {
    const nonDstDates = [
      [1952, 7, 15],
      [1970, 7, 15],
      [1989, 7, 15],
      [2024, 7, 15],
    ] as const;

    for (const [year, month, day] of nonDstDates) {
      expect(koreanDstOffsetMinutes(year, month, day)).toBe(0);
    }
  });

  // =========================================================================
  // 12 historical DST periods count
  // =========================================================================

  it('KoreanDstPeriod has exactly 12 historical periods', () => {
    expect(KOREAN_DST_RANGES.length).toBe(12);
  });
});
