import { describe, it, expect } from 'vitest';
import { calculatePillars, SajuPillarResult } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { configFromPreset, SchoolPreset } from '../../src/config/CalculationConfig.js';
import { cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { jijiOrdinal } from '../../src/domain/Jiji.js';

/**
 * P-05: Leap year February boundary day pillar tests.
 *
 * Verifies day pillar calculation across leap year transitions at the
 * February/March boundary. Mathematical properties:
 * - Day stem uses a 10-cycle: (jdn + 49) % 60, modulo 10 for stem index
 * - Day branch uses a 12-cycle: (jdn + 49) % 60, modulo 12 for branch index
 * - Consecutive calendar days MUST always advance the day pillar by exactly 1
 * - Leap year rule: divisible by 4, except centuries unless divisible by 400
 */

const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

function analyzeDate(year: number, month: number, day: number): SajuPillarResult {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: 12, birthMinute: 0, gender: Gender.MALE,
    longitude: 126.978,
    name: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  });
  return calculatePillars(input, config);
}

function assertDayPillarAdvancesByOne(
  prev: SajuPillarResult, next: SajuPillarResult, label: string,
) {
  const stemDiff = (cheonganOrdinal(next.pillars.day.cheongan) - cheonganOrdinal(prev.pillars.day.cheongan) + 10) % 10;
  const branchDiff = (jijiOrdinal(next.pillars.day.jiji) - jijiOrdinal(prev.pillars.day.jiji) + 12) % 12;
  expect(stemDiff, `${label}: day stem should advance by 1`).toBe(1);
  expect(branchDiff, `${label}: day branch should advance by 1`).toBe(1);
}

describe('LeapYearBoundaryDayPillar', () => {

  // =================================================================
  // 1. Year 2000 (leap year): Feb 28 -> Feb 29 -> Mar 1
  // =================================================================

  describe('Year 2000 (leap year)', () => {
    it('Feb 28 -> Feb 29 -> Mar 1 day pillar advances correctly', () => {
      const feb28 = analyzeDate(2000, 2, 28);
      const feb29 = analyzeDate(2000, 2, 29);
      const mar01 = analyzeDate(2000, 3, 1);

      assertDayPillarAdvancesByOne(feb28, feb29, '2000 Feb28->Feb29');
      assertDayPillarAdvancesByOne(feb29, mar01, '2000 Feb29->Mar01');

      // Total from Feb 28 to Mar 1 should be exactly 2 steps
      const stemDiff2 = (cheonganOrdinal(mar01.pillars.day.cheongan) - cheonganOrdinal(feb28.pillars.day.cheongan) + 10) % 10;
      const branchDiff2 = (jijiOrdinal(mar01.pillars.day.jiji) - jijiOrdinal(feb28.pillars.day.jiji) + 12) % 12;
      expect(stemDiff2).toBe(2);
      expect(branchDiff2).toBe(2);
    });
  });

  // =================================================================
  // 2. Year 1900 (NOT leap year): Feb 28 -> Mar 1 (no Feb 29)
  // =================================================================

  describe('Year 1900 (not leap year)', () => {
    it('Feb 28 -> Mar 1 day pillar advances by exactly 1', () => {
      const feb28 = analyzeDate(1900, 2, 28);
      const mar01 = analyzeDate(1900, 3, 1);
      assertDayPillarAdvancesByOne(feb28, mar01, '1900 Feb28->Mar01 (not leap)');
    });
  });

  // =================================================================
  // 3. Year 2100 (NOT leap year): Feb 28 -> Mar 1
  // =================================================================

  describe('Year 2100 (not leap year)', () => {
    it('Feb 28 -> Mar 1 day pillar advances by exactly 1', () => {
      const feb28 = analyzeDate(2100, 2, 28);
      const mar01 = analyzeDate(2100, 3, 1);
      assertDayPillarAdvancesByOne(feb28, mar01, '2100 Feb28->Mar01 (not leap)');
    });
  });

  // =================================================================
  // 4. Year 2024 (leap year): Feb 29 produces valid pillars
  // =================================================================

  describe('Year 2024 (leap year)', () => {
    it('Feb 29, 2024 full calculation completes', () => {
      const feb29 = analyzeDate(2024, 2, 29);
      expect(feb29.pillars.year).toBeDefined();
      expect(feb29.pillars.month).toBeDefined();
      expect(feb29.pillars.day).toBeDefined();
      expect(feb29.pillars.hour).toBeDefined();
    });
  });

  // =================================================================
  // 5. All 4 pillars valid on Feb 29 across multiple leap years
  // =================================================================

  describe('All pillars valid on Feb 29', () => {
    it.each([2000, 2004, 2008, 2012, 2016, 2020, 2024])(
      'all four pillars non-null on %i-02-29',
      (year) => {
        const result = analyzeDate(year, 2, 29);
        expect(result.pillars.year.cheongan).toBeDefined();
        expect(result.pillars.month.cheongan).toBeDefined();
        expect(result.pillars.day.cheongan).toBeDefined();
        expect(result.pillars.hour.cheongan).toBeDefined();
      },
    );
  });

  // =================================================================
  // 6. Day stem advances by 1: Feb 28 -> Feb 29
  // =================================================================

  describe('Day stem advances across leap day', () => {
    it.each([2000, 2004, 2008, 2012, 2016, 2020, 2024])(
      '%i: day stem advances by exactly 1 from Feb 28 to Feb 29',
      (year) => {
        const feb28 = analyzeDate(year, 2, 28);
        const feb29 = analyzeDate(year, 2, 29);
        const stemDiff = (cheonganOrdinal(feb29.pillars.day.cheongan) - cheonganOrdinal(feb28.pillars.day.cheongan) + 10) % 10;
        expect(stemDiff).toBe(1);
      },
    );
  });

  // =================================================================
  // 7. Day branch advances by 1: Feb 28 -> Feb 29
  // =================================================================

  describe('Day branch advances across leap day', () => {
    it.each([2000, 2004, 2008, 2012, 2016, 2020, 2024])(
      '%i: day branch advances by exactly 1 from Feb 28 to Feb 29',
      (year) => {
        const feb28 = analyzeDate(year, 2, 28);
        const feb29 = analyzeDate(year, 2, 29);
        const branchDiff = (jijiOrdinal(feb29.pillars.day.jiji) - jijiOrdinal(feb28.pillars.day.jiji) + 12) % 12;
        expect(branchDiff).toBe(1);
      },
    );
  });

  // =================================================================
  // 8. Century rule: 1900/2100 no crash on Feb 28 and Mar 1
  // =================================================================

  describe('Century rule tests', () => {
    it.each([1900, 2100])(
      '%i (century non-leap): Feb 28 and Mar 1 compute without crash',
      (year) => {
        const feb28 = analyzeDate(year, 2, 28);
        const mar01 = analyzeDate(year, 3, 1);
        expect(feb28.pillars.day).toBeDefined();
        expect(mar01.pillars.day).toBeDefined();
        assertDayPillarAdvancesByOne(feb28, mar01, `${year} century non-leap`);
      },
    );

    it('2000 (century leap) has valid Feb 29', () => {
      const feb29 = analyzeDate(2000, 2, 29);
      expect(feb29.pillars.day).toBeDefined();
    });
  });

  // =================================================================
  // 9. Month pillar at Feb/Mar boundary: before gyeongchip, same month
  // =================================================================

  describe('Month pillar at Feb/Mar boundary', () => {
    it.each([1990, 2000, 2010, 2020, 2024])(
      '%i: Feb 28 and Mar 1 share same month pillar (both before gyeongchip)',
      (year) => {
        const feb28 = analyzeDate(year, 2, 28);
        const mar01 = analyzeDate(year, 3, 1);
        expect(feb28.pillars.month.cheongan).toBe(mar01.pillars.month.cheongan);
        expect(feb28.pillars.month.jiji).toBe(mar01.pillars.month.jiji);
      },
    );
  });

  // =================================================================
  // 10. Consecutive 60 days across Feb: full 60-day cycle
  // =================================================================

  describe('Full 60-day cycle across February', () => {
    function addDays(year: number, month: number, day: number, offset: number): { y: number; m: number; d: number } {
      const date = new Date(Date.UTC(year, month - 1, day + offset));
      return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
    }

    it('60 consecutive days in 2024 (leap year) all advance by 1', () => {
      const analyses = Array.from({ length: 60 }, (_, i) => {
        const { y, m, d } = addDays(2024, 1, 30, i);
        return analyzeDate(y, m, d);
      });

      for (let i = 0; i < 59; i++) {
        assertDayPillarAdvancesByOne(analyses[i]!, analyses[i + 1]!, `2024 day ${i + 1}`);
      }

      // After 60 days the cycle should return to same pillar
      const { y, m, d } = addDays(2024, 1, 30, 60);
      const day60 = analyzeDate(y, m, d);
      expect(analyses[0]!.pillars.day.cheongan).toBe(day60.pillars.day.cheongan);
      expect(analyses[0]!.pillars.day.jiji).toBe(day60.pillars.day.jiji);
    });

    it('60 consecutive days in 2000 (century leap year) all advance by 1', () => {
      const analyses = Array.from({ length: 60 }, (_, i) => {
        const { y, m, d } = addDays(2000, 1, 30, i);
        return analyzeDate(y, m, d);
      });

      for (let i = 0; i < 59; i++) {
        assertDayPillarAdvancesByOne(analyses[i]!, analyses[i + 1]!, `2000 day ${i + 1}`);
      }

      const { y, m, d } = addDays(2000, 1, 30, 60);
      const day60 = analyzeDate(y, m, d);
      expect(analyses[0]!.pillars.day.cheongan).toBe(day60.pillars.day.cheongan);
      expect(analyses[0]!.pillars.day.jiji).toBe(day60.pillars.day.jiji);
    });

    it('60 consecutive days in 1900 (non-leap year) all advance by 1', () => {
      const analyses = Array.from({ length: 60 }, (_, i) => {
        const { y, m, d } = addDays(1900, 1, 30, i);
        return analyzeDate(y, m, d);
      });

      for (let i = 0; i < 59; i++) {
        assertDayPillarAdvancesByOne(analyses[i]!, analyses[i + 1]!, `1900 day ${i + 1}`);
      }

      const { y, m, d } = addDays(1900, 1, 30, 60);
      const day60 = analyzeDate(y, m, d);
      expect(analyses[0]!.pillars.day.cheongan).toBe(day60.pillars.day.cheongan);
      expect(analyses[0]!.pillars.day.jiji).toBe(day60.pillars.day.jiji);
    });
  });
});
