import { describe, it, expect } from 'vitest';
import { JeolBoundaryTable, type JeolBoundary } from '../../src/calendar/solar/JeolBoundaryTable.js';
import { Vsop87dFallback } from '../../src/calendar/solar/Vsop87dFallback.js';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { Gender } from '../../src/domain/Gender.js';
import { Jiji, jijiOrdinal } from '../../src/domain/Jiji.js';

/**
 * Ported from JeolBoundaryTableVsVsopContinuityTest.kt (TST-3)
 *
 * Verifies consistency between the precomputed JeolBoundaryTable (1900-2050)
 * and the VSOP87D runtime fallback at the 2050/2051 boundary.
 *
 * Key invariants:
 * 1. Ipchun 2050 (table) vs 2051 (fallback): ~365 days apart
 * 2. All 12 jeol boundaries: each term ~365 days apart
 * 3. Sequential ordering preserved
 * 4. Month pillar transition at boundary +/- 1 hour
 * 5. sajuMonthIndexAt consistency
 * 6. Seasonal consistency: same date produces same branch
 */

/** Helper: pack a JeolBoundary into a comparable key. */
function boundaryKey(b: JeolBoundary): number {
  return b.year * 100_000_000 + b.month * 1_000_000 + b.day * 10_000 + b.hour * 100 + b.minute;
}

/** Approximate number of days between two boundaries (using minute-level data). */
function approxDaysBetween(a: JeolBoundary, b: JeolBoundary): number {
  const dA = new Date(Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute));
  const dB = new Date(Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute));
  return Math.round((dB.getTime() - dA.getTime()) / (24 * 3600 * 1000));
}

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

describe('JeolBoundaryTable vs VSOP87D Continuity', () => {

  // =========================================================================
  // 1. Ipchun continuity: 2050 (table) vs 2051 (fallback)
  // =========================================================================

  describe('Ipchun continuity', () => {
    it('ipchun 2050 is available from table and falls in February 3-5', () => {
      const ipchun2050 = JeolBoundaryTable.ipchunOf(2050);
      expect(ipchun2050).toBeDefined();
      expect(ipchun2050!.month).toBe(2);
      expect(ipchun2050!.day).toBeGreaterThanOrEqual(3);
      expect(ipchun2050!.day).toBeLessThanOrEqual(5);
    });

    it('ipchun 2051 is available from VSOP87D fallback and falls in February 3-5', () => {
      const ipchun2051 = Vsop87dFallback.ipchunOf(2051);
      expect(ipchun2051).toBeDefined();
      expect(ipchun2051.month).toBe(2);
      expect(ipchun2051.day).toBeGreaterThanOrEqual(3);
      expect(ipchun2051.day).toBeLessThanOrEqual(5);
    });

    it('ipchun 2050 and 2051 are approximately 365 days apart', () => {
      const ipchun2050 = JeolBoundaryTable.ipchunOf(2050)!;
      const ipchun2051 = Vsop87dFallback.ipchunOf(2051);
      const daysBetween = approxDaysBetween(ipchun2050, ipchun2051);
      expect(daysBetween).toBeGreaterThanOrEqual(364);
      expect(daysBetween).toBeLessThanOrEqual(367);
    });

    it('ipchun day-of-month difference between 2050 and 2051 is at most 2', () => {
      const ipchun2050 = JeolBoundaryTable.ipchunOf(2050)!;
      const ipchun2051 = Vsop87dFallback.ipchunOf(2051);
      const dayDiff = Math.abs(ipchun2050.day - ipchun2051.day);
      expect(dayDiff).toBeLessThanOrEqual(2);
    });
  });

  // =========================================================================
  // 2. All 12 jeol boundaries: 2050 (table) vs 2051 (fallback)
  // =========================================================================

  describe('all 12 boundary continuity', () => {
    it('each jeol boundary in 2050 vs 2051 is approximately 365 days apart', () => {
      const boundaries2050 = JeolBoundaryTable.boundariesForYear(2050)!;
      const boundaries2051 = Vsop87dFallback.boundariesOfYear(2051);
      const map2051 = new Map(boundaries2051.map(b => [b.sajuMonthIndex, b]));

      for (let monthIndex = 1; monthIndex <= 12; monthIndex++) {
        const b2050 = boundaries2050.get(monthIndex)!;
        const b2051 = map2051.get(monthIndex)!;

        const daysBetween = approxDaysBetween(b2050, b2051);
        expect(daysBetween).toBeGreaterThanOrEqual(363);
        expect(daysBetween).toBeLessThanOrEqual(368);

        // Solar longitude and branch must match
        expect(b2050.solarLongitude).toBe(b2051.solarLongitude);
        expect(b2050.branch).toBe(b2051.branch);
      }
    });

    it('2050 table boundaries are in ascending chronological order', () => {
      const boundaries = JeolBoundaryTable.boundariesForYear(2050)!;
      const sorted = Array.from(boundaries.values()).sort((a, b) => boundaryKey(a) - boundaryKey(b));
      for (let i = 1; i < sorted.length; i++) {
        expect(boundaryKey(sorted[i]!)).toBeGreaterThan(boundaryKey(sorted[i - 1]!));
      }
    });

    it('2051 fallback boundaries are in ascending chronological order', () => {
      const boundaries = Vsop87dFallback.boundariesOfYear(2051);
      for (let i = 1; i < boundaries.length; i++) {
        expect(boundaryKey(boundaries[i]!)).toBeGreaterThan(boundaryKey(boundaries[i - 1]!));
      }
    });

    it('2050 and 2051 jeol sequence both follow [12, 1, 2, ..., 11]', () => {
      const expectedSequence = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

      const sorted2050 = Array.from(JeolBoundaryTable.boundariesForYear(2050)!.values())
        .sort((a, b) => boundaryKey(a) - boundaryKey(b))
        .map(b => b.sajuMonthIndex);
      expect(sorted2050).toEqual(expectedSequence);

      const sequence2051 = Vsop87dFallback.boundariesOfYear(2051).map(b => b.sajuMonthIndex);
      expect(sequence2051).toEqual(expectedSequence);
    });
  });

  // =========================================================================
  // 3. Month pillar at boundary +/- 1 hour: correct transition
  // =========================================================================

  describe('month pillar boundary transitions (2050 table)', () => {
    it('month pillar transitions correctly at every 2050 jeol boundary', () => {
      const boundaries = JeolBoundaryTable.boundariesForYear(2050)!;
      const sorted = Array.from(boundaries.values()).sort((a, b) => boundaryKey(a) - boundaryKey(b));

      for (const boundary of sorted) {
        // 1 hour after boundary
        const afterDate = new Date(
          Date.UTC(boundary.year, boundary.month - 1, boundary.day, boundary.hour, boundary.minute),
        );
        afterDate.setUTCHours(afterDate.getUTCHours() + 1);
        const resultAfter = calcPillars(
          afterDate.getUTCFullYear(), afterDate.getUTCMonth() + 1, afterDate.getUTCDate(),
          afterDate.getUTCHours(), afterDate.getUTCMinutes(),
        );
        expect(resultAfter.pillars.month.jiji).toBe(boundary.branch);

        // 1 hour before boundary
        const beforeDate = new Date(
          Date.UTC(boundary.year, boundary.month - 1, boundary.day, boundary.hour, boundary.minute),
        );
        beforeDate.setUTCHours(beforeDate.getUTCHours() - 1);
        const resultBefore = calcPillars(
          beforeDate.getUTCFullYear(), beforeDate.getUTCMonth() + 1, beforeDate.getUTCDate(),
          beforeDate.getUTCHours(), beforeDate.getUTCMinutes(),
        );
        expect(resultBefore.pillars.month.jiji).not.toBe(resultAfter.pillars.month.jiji);
      }
    });
  });

  // =========================================================================
  // 4. sajuMonthIndexAt consistency across table-to-fallback
  // =========================================================================

  describe('sajuMonthIndex consistency', () => {
    it('mid-month dates produce consistent sajuMonthIndex between 2050 and 2051', () => {
      for (let month = 1; month <= 12; month++) {
        const index2050 = JeolBoundaryTable.sajuMonthIndexAt(2050, month, 15, 12, 0);
        const index2051 = Vsop87dFallback.sajuMonthIndexAt(2051, month, 15, 12, 0);
        expect(index2050).toBeDefined();
        expect(index2050).toBe(index2051);
      }
    });

    it('sajuMonthIndexAt returns expected values for 2051 mid-month dates', () => {
      // Expected: Jan=12, Feb=1, Mar=2, ..., Dec=11
      const expected: Record<number, number> = {
        1: 12, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
        7: 6, 8: 7, 9: 8, 10: 9, 11: 10, 12: 11,
      };

      for (const [month, expectedIndex] of Object.entries(expected)) {
        const actualIndex = Vsop87dFallback.sajuMonthIndexAt(2051, Number(month), 15, 12, 0);
        expect(actualIndex).toBe(expectedIndex);
      }
    });
  });

  // =========================================================================
  // 5. Seasonal consistency: same date, same branch
  // =========================================================================

  describe('seasonal consistency', () => {
    it('same mid-month date in 2050 and 2051 produces identical month branch', () => {
      // Map sajuMonthIndex -> Jiji
      const monthIndexToBranch: Record<number, Jiji> = {
        1: Jiji.IN, 2: Jiji.MYO, 3: Jiji.JIN, 4: Jiji.SA,
        5: Jiji.O, 6: Jiji.MI, 7: Jiji.SIN, 8: Jiji.YU,
        9: Jiji.SUL, 10: Jiji.HAE, 11: Jiji.JA, 12: Jiji.CHUK,
      };

      for (let month = 1; month <= 12; month++) {
        const result2050 = calcPillars(2050, month, 15, 12, 0);
        const index2051 = Vsop87dFallback.sajuMonthIndexAt(2051, month, 15, 12, 0);
        const branch2051 = monthIndexToBranch[index2051]!;
        expect(result2050.pillars.month.jiji).toBe(branch2051);
      }
    });

    it('near-boundary dates across 2050 and 2051 have branch ordinal difference at most 1', () => {
      const monthIndexToBranch: Record<number, Jiji> = {
        1: Jiji.IN, 2: Jiji.MYO, 3: Jiji.JIN, 4: Jiji.SA,
        5: Jiji.O, 6: Jiji.MI, 7: Jiji.SIN, 8: Jiji.YU,
        9: Jiji.SUL, 10: Jiji.HAE, 11: Jiji.JA, 12: Jiji.CHUK,
      };

      const nearBoundaryDates = [
        [1, 6], [2, 4], [3, 6], [4, 5], [5, 6], [6, 6],
        [7, 7], [8, 8], [9, 8], [10, 8], [11, 7], [12, 7],
      ];

      for (const [month, day] of nearBoundaryDates) {
        const branch2050 = calcPillars(2050, month, day, 12, 0).pillars.month.jiji;
        const index2051 = Vsop87dFallback.sajuMonthIndexAt(2051, month, day, 12, 0);
        const branch2051 = monthIndexToBranch[index2051]!;

        const ordinal2050 = jijiOrdinal(branch2050);
        const ordinal2051 = jijiOrdinal(branch2051);
        const ordinalDiff = Math.abs(ordinal2050 - ordinal2051);
        const wrappedDiff = Math.min(ordinalDiff, 12 - ordinalDiff);

        expect(wrappedDiff).toBeLessThanOrEqual(1);
      }
    });
  });

  // =========================================================================
  // 6. Lower boundary continuity: 1899 (fallback) vs 1900 (table)
  // =========================================================================

  describe('lower boundary continuity', () => {
    it('ipchun 1900 from table and 1899 from fallback are ~365 days apart', () => {
      const ipchun1900 = JeolBoundaryTable.ipchunOf(1900);
      expect(ipchun1900).toBeDefined();

      const ipchun1899 = Vsop87dFallback.ipchunOf(1899);
      expect(ipchun1899).toBeDefined();

      const daysBetween = approxDaysBetween(ipchun1899, ipchun1900!);
      expect(daysBetween).toBeGreaterThanOrEqual(364);
      expect(daysBetween).toBeLessThanOrEqual(367);
    });

    it('mid-month month branches match between 1899 fallback and 1900 table', () => {
      const monthIndexToBranch: Record<number, Jiji> = {
        1: Jiji.IN, 2: Jiji.MYO, 3: Jiji.JIN, 4: Jiji.SA,
        5: Jiji.O, 6: Jiji.MI, 7: Jiji.SIN, 8: Jiji.YU,
        9: Jiji.SUL, 10: Jiji.HAE, 11: Jiji.JA, 12: Jiji.CHUK,
      };

      for (let month = 1; month <= 12; month++) {
        const result1900 = calcPillars(1900, month, 15, 12, 0);
        const index1899 = Vsop87dFallback.sajuMonthIndexAt(1899, month, 15, 12, 0);
        const branch1899 = monthIndexToBranch[index1899]!;

        expect(result1900.pillars.month.jiji).toBe(branch1899);
      }
    });
  });
});
