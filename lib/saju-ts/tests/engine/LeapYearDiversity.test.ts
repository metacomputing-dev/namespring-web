import { describe, it, expect } from 'vitest';
import { calculatePillars, SajuPillarResult } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { configFromPreset, SchoolPreset } from '../../src/config/CalculationConfig.js';
import { Pillar } from '../../src/domain/Pillar.js';
import { cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { jijiOrdinal } from '../../src/domain/Jiji.js';

/**
 * T-02: Leap year diversity test suite.
 *
 * Verifies saju calculation correctness across different leap year types
 * and the February/March boundary:
 * 1. Century non-leap years (1900: divisible by 100 but not 400)
 * 2. Century leap years (2000: divisible by 400)
 * 3. Standard leap years (2024: divisible by 4)
 * 4. Non-leap years (1999: not divisible by 4)
 */

const SEOUL_LONGITUDE = 126.978;
const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

function analyze(year: number, month: number, day: number, hour = 12, minute = 0): SajuPillarResult {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender: Gender.MALE, longitude: SEOUL_LONGITUDE,
    name: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  });
  return calculatePillars(input, config);
}

/**
 * Calculates the sexagenary (60-day) cycle difference between two day pillars.
 * Returns the positive step count from pillar1 to pillar2 via CRT.
 */
function calculateSexagenaryDifference(pillar1: Pillar, pillar2: Pillar): number {
  const stemDiff = (cheonganOrdinal(pillar2.cheongan) - cheonganOrdinal(pillar1.cheongan) + 10) % 10;
  const branchDiff = (jijiOrdinal(pillar2.jiji) - jijiOrdinal(pillar1.jiji) + 12) % 12;

  // Verify parity constraint
  if (stemDiff % 2 !== branchDiff % 2) {
    throw new Error(
      `Stem diff (${stemDiff}) and branch diff (${branchDiff}) have mismatched parity`,
    );
  }

  // CRT: k = (6 * stemDiff - 5 * branchDiff) mod 60
  return ((6 * stemDiff - 5 * branchDiff) % 60 + 60) % 60;
}

function assertValidPillars(result: SajuPillarResult, context: string) {
  expect(result.pillars.year, `${context}: Year pillar`).toBeDefined();
  expect(result.pillars.month, `${context}: Month pillar`).toBeDefined();
  expect(result.pillars.day, `${context}: Day pillar`).toBeDefined();
  expect(result.pillars.hour, `${context}: Hour pillar`).toBeDefined();
  expect(result.pillars.year.cheongan, `${context}: Year stem`).toBeDefined();
  expect(result.pillars.year.jiji, `${context}: Year branch`).toBeDefined();
  expect(result.pillars.month.cheongan, `${context}: Month stem`).toBeDefined();
  expect(result.pillars.month.jiji, `${context}: Month branch`).toBeDefined();
  expect(result.pillars.day.cheongan, `${context}: Day stem`).toBeDefined();
  expect(result.pillars.day.jiji, `${context}: Day branch`).toBeDefined();
  expect(result.pillars.hour.cheongan, `${context}: Hour stem`).toBeDefined();
  expect(result.pillars.hour.jiji, `${context}: Hour branch`).toBeDefined();
}

describe('LeapYearDiversity', () => {

  // =================================================================
  // 1900: Century non-leap year (not divisible by 400)
  // =================================================================

  describe('Year 1900 (century non-leap)', () => {
    it('Feb 28, 1900 calculates correctly', () => {
      const result = analyze(1900, 2, 28);
      assertValidPillars(result, '1900-02-28');
    });

    it('Mar 1, 1900 calculates correctly', () => {
      const result = analyze(1900, 3, 1);
      assertValidPillars(result, '1900-03-01');
    });

    it('Feb 28 to Mar 1, 1900 day pillar advances by 1', () => {
      const feb28 = analyze(1900, 2, 28);
      const mar1 = analyze(1900, 3, 1);
      const diff = calculateSexagenaryDifference(feb28.pillars.day, mar1.pillars.day);
      expect(diff).toBe(1);
    });

    it('1900 at table boundary works for full analysis', () => {
      const result = analyze(1900, 6, 15);
      assertValidPillars(result, '1900-06-15');
    });
  });

  // =================================================================
  // 1999: Regular non-leap year (not divisible by 4)
  // =================================================================

  describe('Year 1999 (regular non-leap)', () => {
    it('Feb 28, 1999 calculates correctly', () => {
      const result = analyze(1999, 2, 28);
      assertValidPillars(result, '1999-02-28');
    });

    it('Mar 1, 1999 calculates correctly', () => {
      const result = analyze(1999, 3, 1);
      assertValidPillars(result, '1999-03-01');
    });

    it('Feb 28 to Mar 1, 1999 day pillar advances by 1', () => {
      const feb28 = analyze(1999, 2, 28);
      const mar1 = analyze(1999, 3, 1);
      const diff = calculateSexagenaryDifference(feb28.pillars.day, mar1.pillars.day);
      expect(diff).toBe(1);
    });
  });

  // =================================================================
  // 2000: Century leap year (divisible by 400)
  // =================================================================

  describe('Year 2000 (century leap)', () => {
    it('Feb 28, 2000 calculates correctly', () => {
      const result = analyze(2000, 2, 28);
      assertValidPillars(result, '2000-02-28');
    });

    it('Feb 29, 2000 calculates correctly (leap day)', () => {
      const result = analyze(2000, 2, 29);
      assertValidPillars(result, '2000-02-29');
    });

    it('Mar 1, 2000 calculates correctly', () => {
      const result = analyze(2000, 3, 1);
      assertValidPillars(result, '2000-03-01');
    });

    it('Feb 28 to Feb 29, 2000 day pillar advances by 1', () => {
      const feb28 = analyze(2000, 2, 28);
      const feb29 = analyze(2000, 2, 29);
      const diff = calculateSexagenaryDifference(feb28.pillars.day, feb29.pillars.day);
      expect(diff).toBe(1);
    });

    it('Feb 29 to Mar 1, 2000 day pillar advances by 1', () => {
      const feb29 = analyze(2000, 2, 29);
      const mar1 = analyze(2000, 3, 1);
      const diff = calculateSexagenaryDifference(feb29.pillars.day, mar1.pillars.day);
      expect(diff).toBe(1);
    });
  });

  // =================================================================
  // 2024: Standard leap year (divisible by 4)
  // =================================================================

  describe('Year 2024 (standard leap)', () => {
    it('Feb 28, 2024 calculates correctly', () => {
      const result = analyze(2024, 2, 28);
      assertValidPillars(result, '2024-02-28');
    });

    it('Feb 29, 2024 calculates correctly (leap day)', () => {
      const result = analyze(2024, 2, 29);
      assertValidPillars(result, '2024-02-29');
    });

    it('Mar 1, 2024 calculates correctly', () => {
      const result = analyze(2024, 3, 1);
      assertValidPillars(result, '2024-03-01');
    });

    it('Feb 28 to Feb 29, 2024 day pillar advances by 1', () => {
      const feb28 = analyze(2024, 2, 28);
      const feb29 = analyze(2024, 2, 29);
      const diff = calculateSexagenaryDifference(feb28.pillars.day, feb29.pillars.day);
      expect(diff).toBe(1);
    });

    it('Feb 29 to Mar 1, 2024 day pillar advances by 1', () => {
      const feb29 = analyze(2024, 2, 29);
      const mar1 = analyze(2024, 3, 1);
      const diff = calculateSexagenaryDifference(feb29.pillars.day, mar1.pillars.day);
      expect(diff).toBe(1);
    });
  });

  // =================================================================
  // Comparative leap year tests
  // =================================================================

  describe('Comparative leap year tests', () => {
    it('all leap years Feb 29 produce valid pillars', () => {
      for (const year of [2000, 2024]) {
        const result = analyze(year, 2, 29);
        assertValidPillars(result, `${year}-02-29`);
      }
    });

    it('non-leap years: Feb 28 to Mar 1 day pillar advances', () => {
      for (const year of [1900, 1999]) {
        const feb28 = analyze(year, 2, 28);
        const mar1 = analyze(year, 3, 1);
        const diff = calculateSexagenaryDifference(feb28.pillars.day, mar1.pillars.day);
        expect(diff).toBe(1);
      }
    });

    it('century non-leap (1900) vs century leap (2000): February days count', () => {
      const feb28_1900 = analyze(1900, 2, 28);
      const mar1_1900 = analyze(1900, 3, 1);

      const feb28_2000 = analyze(2000, 2, 28);
      const feb29_2000 = analyze(2000, 2, 29);
      const mar1_2000 = analyze(2000, 3, 1);

      // 1900: Feb 28 -> Mar 1 = 1 step (no Feb 29)
      expect(calculateSexagenaryDifference(feb28_1900.pillars.day, mar1_1900.pillars.day)).toBe(1);

      // 2000: Feb 28 -> Feb 29 = 1 step, Feb 29 -> Mar 1 = 1 step
      expect(calculateSexagenaryDifference(feb28_2000.pillars.day, feb29_2000.pillars.day)).toBe(1);
      expect(calculateSexagenaryDifference(feb29_2000.pillars.day, mar1_2000.pillars.day)).toBe(1);
    });
  });
});
