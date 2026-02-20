import { describe, it, expect } from 'vitest';
import { calculatePillars, SajuPillarResult } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { configFromPreset, SchoolPreset } from '../../src/config/CalculationConfig.js';
import { cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { jijiOrdinal } from '../../src/domain/Jiji.js';

/**
 * TST-3: Date range boundary tests.
 *
 * Verifies pipeline behavior at the boundaries of the supported date range:
 * - Precise table range: 1900-2050 (JeolBoundaryTable)
 * - Beyond range: approximate/fallback calculation
 */

const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

function analyze(
  year: number, month: number, day: number,
  hour: number, minute: number,
  gender: Gender = Gender.MALE,
): SajuPillarResult {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender, longitude: 126.978,
    name: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  });
  return calculatePillars(input, config);
}

describe('DateRangeBoundary', () => {

  // =================================================================
  // Table minimum boundary: 1900
  // =================================================================

  describe('Year 1900 (table minimum boundary)', () => {
    it('Jan 1, 1900 produces valid pillars', () => {
      const result = analyze(1900, 1, 1, 12, 0);
      expect(result.pillars.year).toBeDefined();
      expect(result.pillars.month).toBeDefined();
      expect(result.pillars.day).toBeDefined();
      expect(result.pillars.hour).toBeDefined();
    });

    it('Feb 4, 1900 ipchun boundary: year pillar changes', () => {
      const before = analyze(1900, 2, 3, 12, 0);
      const after = analyze(1900, 2, 5, 12, 0);

      // Year pillar should differ across ipchun boundary
      const yearBefore = before.pillars.year;
      const yearAfter = after.pillars.year;
      expect(
        yearBefore.cheongan !== yearAfter.cheongan || yearBefore.jiji !== yearAfter.jiji,
      ).toBe(true);
    });

    it('Jun 15, 1900 full calculation completes', () => {
      const result = analyze(1900, 6, 15, 14, 30, Gender.FEMALE);
      expect(result.pillars.year).toBeDefined();
      expect(result.pillars.month).toBeDefined();
      expect(result.pillars.day).toBeDefined();
      expect(result.pillars.hour).toBeDefined();
    });

    it('Dec 31, 1900 last day of year works', () => {
      const result = analyze(1900, 12, 31, 23, 0);
      expect(result.pillars).toBeDefined();
    });
  });

  // =================================================================
  // Table maximum boundary: 2050
  // =================================================================

  describe('Year 2050 (table maximum boundary)', () => {
    it('Jan 1, 2050 produces valid pillars', () => {
      const result = analyze(2050, 1, 1, 12, 0);
      expect(result.pillars.year).toBeDefined();
      expect(result.pillars.month).toBeDefined();
      expect(result.pillars.day).toBeDefined();
      expect(result.pillars.hour).toBeDefined();
    });

    it('Jun 15, 2050 mid-year works', () => {
      const result = analyze(2050, 6, 15, 10, 0, Gender.FEMALE);
      expect(result.pillars.year).toBeDefined();
      expect(result.pillars.month).toBeDefined();
    });

    it('Dec 31, 2050 last day in table works', () => {
      const result = analyze(2050, 12, 31, 12, 0);
      expect(result.pillars).toBeDefined();
    });
  });

  // =================================================================
  // Beyond table: 2051+ (fallback)
  // =================================================================

  describe('Post-2050 fallback', () => {
    it('Jan 15, 2051 fallback calculation produces valid pillars', () => {
      const result = analyze(2051, 1, 15, 12, 0);
      expect(result.pillars.year).toBeDefined();
      expect(result.pillars.month).toBeDefined();
      expect(result.pillars.day).toBeDefined();
      expect(result.pillars.hour).toBeDefined();
    });

    it('Jun 15, 2051 fallback full calculation', () => {
      const result = analyze(2051, 6, 15, 14, 0, Gender.FEMALE);
      expect(result.pillars).toBeDefined();
    });

    it('table to fallback transition: both produce valid month pillars', () => {
      // 2050-12-15 (table) vs 2051-06-15 (fallback)
      // Both should produce valid month pillars
      const dec2050 = analyze(2050, 12, 15, 12, 0);
      const jun2051 = analyze(2051, 6, 15, 12, 0);

      expect(dec2050.pillars.month).toBeDefined();
      expect(dec2050.pillars.month.cheongan).toBeDefined();
      expect(dec2050.pillars.month.jiji).toBeDefined();
      expect(jun2051.pillars.month).toBeDefined();
      expect(jun2051.pillars.month.cheongan).toBeDefined();
      expect(jun2051.pillars.month.jiji).toBeDefined();
    });

    it('within table: Dec 2050 and Jan 2050 have different month branches', () => {
      // Both within the table range: month branches must differ
      const dec2050 = analyze(2050, 12, 15, 12, 0);
      const jan2050 = analyze(2050, 1, 15, 12, 0);

      expect(dec2050.pillars.month.jiji).not.toBe(jan2050.pillars.month.jiji);
    });

    it('same date different year 2050 vs 2051: day pillar differs', () => {
      const y2050 = analyze(2050, 3, 15, 12, 0);
      const y2051 = analyze(2051, 3, 15, 12, 0);

      // 365 days apart => day pillar differs (365 % 60 = 5)
      expect(y2050.pillars.day.equals(y2051.pillars.day)).toBe(false);
    });
  });

  // =================================================================
  // Far future / far past (safe handling)
  // =================================================================

  describe('Extreme dates', () => {
    it('2100 still calculates', () => {
      const result = analyze(2100, 6, 15, 12, 0);
      expect(result.pillars.day).toBeDefined();
      expect(result.pillars.hour).toBeDefined();
    });

    it('1850 historical date works', () => {
      const result = analyze(1850, 7, 1, 12, 0, Gender.FEMALE);
      expect(result.pillars.day).toBeDefined();
      expect(result.pillars.hour).toBeDefined();
    });

    it('day pillar consistency across centuries', () => {
      const years = [1850, 1900, 1950, 2000, 2050, 2100];
      for (const year of years) {
        const result = analyze(year, 1, 1, 12, 0);
        expect(result.pillars.day, `Day pillar for ${year}`).toBeDefined();
        expect(result.pillars.day.cheongan, `Day stem for ${year}`).toBeDefined();
        expect(result.pillars.day.jiji, `Day branch for ${year}`).toBeDefined();
      }
    });

    it('consecutive days across 2050-2051 boundary: day pillar advances by 1', () => {
      const dec31 = analyze(2050, 12, 31, 12, 0);
      const jan01 = analyze(2051, 1, 1, 12, 0);

      const stemDiff = (cheonganOrdinal(jan01.pillars.day.cheongan) - cheonganOrdinal(dec31.pillars.day.cheongan) + 10) % 10;
      const branchDiff = (jijiOrdinal(jan01.pillars.day.jiji) - jijiOrdinal(dec31.pillars.day.jiji) + 12) % 12;

      expect(stemDiff).toBe(1);
      expect(branchDiff).toBe(1);
    });
  });
});
