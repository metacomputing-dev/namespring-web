import { describe, it, expect } from 'vitest';
import { JeolBoundaryTable } from '../../src/calendar/solar/JeolBoundaryTable.js';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { Gender } from '../../src/domain/Gender.js';

/**
 * Ported from JeolBoundaryYearEdgeIntegrationTest.kt
 *
 * Integration test verifying year-edge behavior at the table boundaries
 * (1900 and 2050) for:
 * 1. Exact table mode reporting for edge years
 * 2. VSOP fallback mode for outside-range years
 * 3. Strict ipchun minute boundary at edge years
 */

const testConfig = createConfig({
  dayCutMode: DayCutMode.MIDNIGHT_00,
  applyDstHistory: false,
  includeEquationOfTime: false,
  lmtBaselineLongitude: 135.0,
});

function calcPillars(year: number, month: number, day: number, hour: number, minute: number) {
  return calculatePillars(createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender: Gender.MALE,
    longitude: 135.0, latitude: 37.5665,
  }), testConfig);
}

describe('JeolBoundaryYearEdgeIntegration', () => {

  // =========================================================================
  // 1. Year edges 1900 and 2050 use exact table
  // =========================================================================

  it('year edges 1900 and 2050 are supported by exact table', () => {
    expect(JeolBoundaryTable.isSupportedYear(1900)).toBe(true);
    expect(JeolBoundaryTable.isSupportedYear(2050)).toBe(true);

    // Both should produce valid pillars
    const at1900 = calcPillars(1900, 2, 10, 12, 0);
    const at2050 = calcPillars(2050, 2, 10, 12, 0);
    expect(at1900.pillars.month).toBeDefined();
    expect(at2050.pillars.month).toBeDefined();
  });

  // =========================================================================
  // 2. Outside range 1899 and 2051 use VSOP fallback
  // =========================================================================

  it('outside range 1899 and 2051 are NOT in exact table', () => {
    expect(JeolBoundaryTable.isSupportedYear(1899)).toBe(false);
    expect(JeolBoundaryTable.isSupportedYear(2051)).toBe(false);
  });

  // =========================================================================
  // 3. Ipchun minute boundary remains strict at 1900 and 2050
  // =========================================================================

  function assertStrictBoundaryForYear(year: number) {
    const ipchun = JeolBoundaryTable.ipchunOf(year);
    expect(ipchun).toBeDefined();

    // -1 minute from ipchun
    const beforeDate = new Date(
      Date.UTC(ipchun!.year, ipchun!.month - 1, ipchun!.day, ipchun!.hour, ipchun!.minute),
    );
    beforeDate.setUTCMinutes(beforeDate.getUTCMinutes() - 1);
    const before = calcPillars(
      beforeDate.getUTCFullYear(), beforeDate.getUTCMonth() + 1, beforeDate.getUTCDate(),
      beforeDate.getUTCHours(), beforeDate.getUTCMinutes(),
    );

    // Exact boundary
    const atBoundary = calcPillars(ipchun!.year, ipchun!.month, ipchun!.day, ipchun!.hour, ipchun!.minute);

    // +1 minute from ipchun
    const afterDate = new Date(
      Date.UTC(ipchun!.year, ipchun!.month - 1, ipchun!.day, ipchun!.hour, ipchun!.minute),
    );
    afterDate.setUTCMinutes(afterDate.getUTCMinutes() + 1);
    const after = calcPillars(
      afterDate.getUTCFullYear(), afterDate.getUTCMonth() + 1, afterDate.getUTCDate(),
      afterDate.getUTCHours(), afterDate.getUTCMinutes(),
    );

    // Exact boundary instant stays in previous saju year/month
    expect(before.pillars.year.cheongan).toBe(atBoundary.pillars.year.cheongan);
    expect(before.pillars.year.jiji).toBe(atBoundary.pillars.year.jiji);
    expect(before.pillars.month.cheongan).toBe(atBoundary.pillars.month.cheongan);
    expect(before.pillars.month.jiji).toBe(atBoundary.pillars.month.jiji);

    // One minute after boundary switches
    expect(atBoundary.pillars.year.cheongan).not.toBe(after.pillars.year.cheongan);
    expect(atBoundary.pillars.month.jiji).not.toBe(after.pillars.month.jiji);
  }

  it('ipchun minute boundary remains strict at 1900', () => {
    assertStrictBoundaryForYear(1900);
  });

  it('ipchun minute boundary remains strict at 2050', () => {
    assertStrictBoundaryForYear(2050);
  });
});
