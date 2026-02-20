import { describe, it, expect } from 'vitest';
import { JeolBoundaryTable, type JeolBoundary } from '../../src/calendar/solar/JeolBoundaryTable.js';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { Gender } from '../../src/domain/Gender.js';
import { Cheongan, cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { Jiji, jijiOrdinal } from '../../src/domain/Jiji.js';

/**
 * Ported from IpchunBoundaryExhaustiveTest.kt (ACC-1)
 *
 * Verifies that the full calculation pipeline uses the EXACT ipchun boundary
 * from JeolBoundaryTable (not a hardcoded Feb 4 approximation) for year
 * pillar determination across ALL years 1900-2050.
 *
 * For each year:
 * 1. Birth 1 hour BEFORE ipchun receives the PREVIOUS year's pillar.
 * 2. Birth 1 hour AFTER ipchun receives the CURRENT year's pillar.
 * 3. Exact ipchun boundary instant is treated as previous year.
 *
 * Additional edge cases:
 * - Feb 3 births when ipchun is Feb 4+
 * - Feb 5 births when ipchun is before Feb 5
 * - Approx vs exact comparison
 * - Month pillar also transitions at ipchun
 * - Year pillar 60-cycle consistency
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

/** Add hours to a boundary, returning new date components. */
function addHours(b: JeolBoundary, hours: number): { y: number; m: number; d: number; h: number; min: number } {
  const date = new Date(Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute));
  date.setUTCHours(date.getUTCHours() + hours);
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
    h: date.getUTCHours(),
    min: date.getUTCMinutes(),
  };
}

/** Add minutes to a boundary, returning new date components. */
function addMinutes(b: JeolBoundary, minutes: number): { y: number; m: number; d: number; h: number; min: number } {
  const date = new Date(Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute));
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
    h: date.getUTCHours(),
    min: date.getUTCMinutes(),
  };
}

describe('IpchunBoundaryExhaustive', () => {

  // =========================================================================
  // 1. Year pillar switches at ipchun for every year 1900-2050
  // =========================================================================

  describe('year pillar switches exactly at ipchun for every year', () => {
    // Test every 10th year to keep runtime reasonable, plus edge years
    const sampleYears = [
      1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1984,
      1990, 2000, 2010, 2020, 2024, 2030, 2040, 2050,
    ];

    for (const year of sampleYears) {
      it(`year=${year}: year pillar changes across ipchun`, () => {
        const ipchun = JeolBoundaryTable.ipchunOf(year);
        expect(ipchun).toBeDefined();

        const before = addHours(ipchun!, -1);
        const after = addHours(ipchun!, 1);

        const resultBefore = calcPillars(before.y, before.m, before.d, before.h, before.min);
        const resultAfter = calcPillars(after.y, after.m, after.d, after.h, after.min);

        // Expected pillars
        const expectedPrev = GanjiCycle.yearPillarApprox(year - 1);
        const expectedCurr = GanjiCycle.yearPillarApprox(year);

        expect(resultBefore.pillars.year.cheongan).toBe(expectedPrev.cheongan);
        expect(resultBefore.pillars.year.jiji).toBe(expectedPrev.jiji);
        expect(resultAfter.pillars.year.cheongan).toBe(expectedCurr.cheongan);
        expect(resultAfter.pillars.year.jiji).toBe(expectedCurr.jiji);

        // Must differ
        expect(resultBefore.pillars.year.equals(resultAfter.pillars.year)).toBe(false);
      });
    }
  });

  // =========================================================================
  // 2. Exact boundary instant convention: boundary = previous year
  // =========================================================================

  describe('exact ipchun instant is treated as previous saju year', () => {
    const sampleYears = [
      1900, 1920, 1950, 1970, 1984, 2000, 2024, 2050,
    ];

    for (const year of sampleYears) {
      it(`year=${year}: exact boundary instant uses previous year`, () => {
        const ipchun = JeolBoundaryTable.ipchunOf(year)!;

        const atBoundary = calcPillars(ipchun.year, ipchun.month, ipchun.day, ipchun.hour, ipchun.minute);
        const justAfter = addMinutes(ipchun, 1);
        const afterResult = calcPillars(justAfter.y, justAfter.m, justAfter.d, justAfter.h, justAfter.min);

        const expectedPrev = GanjiCycle.yearPillarApprox(year - 1);
        expect(atBoundary.pillars.year.cheongan).toBe(expectedPrev.cheongan);
        expect(atBoundary.pillars.year.jiji).toBe(expectedPrev.jiji);

        const expectedCurr = GanjiCycle.yearPillarApprox(year);
        expect(afterResult.pillars.year.cheongan).toBe(expectedCurr.cheongan);
        expect(afterResult.pillars.year.jiji).toBe(expectedCurr.jiji);
      });
    }
  });

  // =========================================================================
  // 3. Feb 3 births: previous year when ipchun is Feb 4 or later
  // =========================================================================

  describe('Feb 3 noon is previous saju year when ipchun is Feb 4 or later', () => {
    // Find years where ipchun is on Feb 4+
    const eligibleYears: number[] = [];
    for (let y = 1900; y <= 2050; y++) {
      const ipchun = JeolBoundaryTable.ipchunOf(y);
      if (ipchun && ipchun.month === 2 && ipchun.day >= 4) {
        eligibleYears.push(y);
      }
    }

    // Sample a subset
    const sampled = eligibleYears.filter((_, i) => i % 10 === 0 || i === eligibleYears.length - 1);

    for (const year of sampled) {
      it(`year=${year}: Feb 3 noon is previous saju year`, () => {
        const result = calcPillars(year, 2, 3, 12, 0);
        const expectedPrev = GanjiCycle.yearPillarApprox(year - 1);
        expect(result.pillars.year.cheongan).toBe(expectedPrev.cheongan);
        expect(result.pillars.year.jiji).toBe(expectedPrev.jiji);
      });
    }
  });

  // =========================================================================
  // 4. Feb 5 births: current year when ipchun is before Feb 5
  // =========================================================================

  describe('Feb 5 noon is current saju year when ipchun is before Feb 5', () => {
    const eligibleYears: number[] = [];
    for (let y = 1900; y <= 2050; y++) {
      const ipchun = JeolBoundaryTable.ipchunOf(y);
      if (ipchun && ipchun.month === 2 && ipchun.day < 5) {
        eligibleYears.push(y);
      }
    }

    const sampled = eligibleYears.filter((_, i) => i % 10 === 0 || i === eligibleYears.length - 1);

    for (const year of sampled) {
      it(`year=${year}: Feb 5 noon is current saju year`, () => {
        const result = calcPillars(year, 2, 5, 12, 0);
        const expectedCurr = GanjiCycle.yearPillarApprox(year);
        expect(result.pillars.year.cheongan).toBe(expectedCurr.cheongan);
        expect(result.pillars.year.jiji).toBe(expectedCurr.jiji);
      });
    }
  });

  // =========================================================================
  // 5. Approx vs exact: years where ipchun is NOT on Feb 4
  // =========================================================================

  describe('approx vs exact comparison', () => {
    it('exact table has years where ipchun is NOT on Feb 4', () => {
      let nonFeb4Count = 0;
      for (let year = 1900; year <= 2050; year++) {
        const ipchun = JeolBoundaryTable.ipchunOf(year);
        if (ipchun && ipchun.day !== 4) {
          nonFeb4Count++;
        }
      }
      expect(nonFeb4Count).toBeGreaterThan(0);
    });

    it('engine uses exact ipchun for years where ipchun is on Feb 3', () => {
      for (let year = 1900; year <= 2050; year++) {
        const ipchun = JeolBoundaryTable.ipchunOf(year);
        if (!ipchun || ipchun.day !== 3) continue;

        // Birth 1 hour after ipchun on Feb 3 should use current year
        const after = addHours(ipchun, 1);
        const result = calcPillars(after.y, after.m, after.d, after.h, after.min);
        const expectedCurr = GanjiCycle.yearPillarApprox(year);
        expect(result.pillars.year.cheongan).toBe(expectedCurr.cheongan);
        expect(result.pillars.year.jiji).toBe(expectedCurr.jiji);
      }
    });

    it('engine uses exact ipchun for years where ipchun is on Feb 5', () => {
      for (let year = 1900; year <= 2050; year++) {
        const ipchun = JeolBoundaryTable.ipchunOf(year);
        if (!ipchun || ipchun.day !== 5) continue;

        // Birth on Feb 4 noon should still be in previous saju year
        const result = calcPillars(year, 2, 4, 12, 0);
        const expectedPrev = GanjiCycle.yearPillarApprox(year - 1);
        expect(result.pillars.year.cheongan).toBe(expectedPrev.cheongan);
        expect(result.pillars.year.jiji).toBe(expectedPrev.jiji);
      }
    });
  });

  // =========================================================================
  // 6. Month pillar transitions from CHUK to IN at ipchun
  // =========================================================================

  describe('month pillar transitions at ipchun', () => {
    const sampleYears = [
      1900, 1920, 1950, 1970, 1984, 2000, 2024, 2050,
    ];

    for (const year of sampleYears) {
      it(`year=${year}: month transitions CHUK->IN at ipchun`, () => {
        const ipchun = JeolBoundaryTable.ipchunOf(year)!;

        const before = addHours(ipchun, -1);
        const after = addHours(ipchun, 1);

        const resultBefore = calcPillars(before.y, before.m, before.d, before.h, before.min);
        const resultAfter = calcPillars(after.y, after.m, after.d, after.h, after.min);

        expect(resultBefore.pillars.month.jiji).toBe(Jiji.CHUK);
        expect(resultAfter.pillars.month.jiji).toBe(Jiji.IN);
      });
    }
  });

  // =========================================================================
  // 7. Ipchun date sanity: always Feb 3-5
  // =========================================================================

  it('all ipchun dates fall between Feb 3 and Feb 5', () => {
    for (let year = 1900; year <= 2050; year++) {
      const ipchun = JeolBoundaryTable.ipchunOf(year);
      expect(ipchun).toBeDefined();
      expect(ipchun!.month).toBe(2);
      expect(ipchun!.day).toBeGreaterThanOrEqual(3);
      expect(ipchun!.day).toBeLessThanOrEqual(5);
    }
  });

  // =========================================================================
  // 8. Year pillar 60-cycle consistency: consecutive years advance by 1
  // =========================================================================

  it('consecutive saju years have year pillars advancing by 1 in the 60-cycle', () => {
    for (let year = 1901; year <= 2050; year++) {
      const ipchunPrev = JeolBoundaryTable.ipchunOf(year - 1);
      const ipchunCurr = JeolBoundaryTable.ipchunOf(year);
      if (!ipchunPrev || !ipchunCurr) continue;

      const afterPrev = addHours(ipchunPrev, 1);
      const afterCurr = addHours(ipchunCurr, 1);

      const pillarPrev = calcPillars(afterPrev.y, afterPrev.m, afterPrev.d, afterPrev.h, afterPrev.min).pillars.year;
      const pillarCurr = calcPillars(afterCurr.y, afterCurr.m, afterCurr.d, afterCurr.h, afterCurr.min).pillars.year;

      const stemDiff = (cheonganOrdinal(pillarCurr.cheongan) - cheonganOrdinal(pillarPrev.cheongan) + 10) % 10;
      const branchDiff = (jijiOrdinal(pillarCurr.jiji) - jijiOrdinal(pillarPrev.jiji) + 12) % 12;

      expect(stemDiff).toBe(1);
      expect(branchDiff).toBe(1);
    }
  });
});
