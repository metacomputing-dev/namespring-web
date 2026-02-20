import { describe, it, expect } from 'vitest';
import { JeolBoundaryTable } from '../../src/calendar/solar/JeolBoundaryTable.js';
import { Vsop87dFallback } from '../../src/calendar/solar/Vsop87dFallback.js';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { Gender } from '../../src/domain/Gender.js';
import { Jiji, JIJI_VALUES, jijiOrdinal } from '../../src/domain/Jiji.js';

/**
 * Ported from JeolBoundary2050to2051ContinuityTest.kt (ACC-5)
 *
 * Verifies continuity across the precomputed table boundary (1900-2050)
 * and the VSOP87D runtime fallback (outside that range).
 *
 * Key invariants:
 * 1. Births within the table range (1900-2050) are calculable
 * 2. Births just outside the range (2051, 1899) fall back gracefully to VSOP87D
 * 3. Month pillars at the table/fallback seam are seasonally consistent
 * 4. The jeol boundary sequence across years maintains astronomical monotonicity
 */

const testConfig = createConfig({
  dayCutMode: DayCutMode.MIDNIGHT_00,
  applyDstHistory: false,
  includeEquationOfTime: false,
  lmtBaselineLongitude: 135.0,
});

function calcPillars(year: number, month: number, day: number, hour: number, minute: number) {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender: Gender.MALE,
    longitude: 135.0, latitude: 37.5665,
  });
  return calculatePillars(input, testConfig);
}

describe('JeolBoundary 2050-2051 Continuity', () => {

  // =========================================================================
  // 1. Within-table calculations (2050): must succeed with exact table
  // =========================================================================

  describe('within table (2050)', () => {
    it('2050-12-15 12:00 KST -- month pillar is calculable and is JA (ja-wol)', () => {
      const result = calcPillars(2050, 12, 15, 12, 0);
      expect(result.pillars.month).toBeDefined();
      // Mid-December is always in ja-wol (JA) after daeseol boundary
      expect(result.pillars.month.jiji).toBe(Jiji.JA);
    });

    it('2050-06-15 -- summer month pillar is O (o-wol)', () => {
      const result = calcPillars(2050, 6, 15, 12, 0);
      expect(result.pillars.month).toBeDefined();
      expect(result.pillars.month.jiji).toBe(Jiji.O);
    });
  });

  // =========================================================================
  // 2. Outside-table calculations (2051): must succeed via VSOP87D fallback
  // =========================================================================

  describe('outside table (2051) via VSOP87D', () => {
    it('2051 Vsop87dFallback produces 12 boundaries', () => {
      const boundaries = Vsop87dFallback.boundariesOfYear(2051);
      expect(boundaries.length).toBe(12);
    });

    it('2051-01-15 -- CHUK via VSOP87D fallback sajuMonthIndexAt', () => {
      // Mid-January is in chuk-wol (CHUK) after sohan boundary
      const monthIndex = Vsop87dFallback.sajuMonthIndexAt(2051, 1, 15, 12, 0);
      expect(monthIndex).toBe(12); // sajuMonthIndex=12 = CHUK
    });

    it('2051-06-15 -- O via VSOP87D fallback', () => {
      const monthIndex = Vsop87dFallback.sajuMonthIndexAt(2051, 6, 15, 12, 0);
      expect(monthIndex).toBe(5); // sajuMonthIndex=5 = O
    });
  });

  // =========================================================================
  // 3. Cross-boundary consistency: late 2050 vs early 2051
  // =========================================================================

  describe('cross-boundary consistency', () => {
    it('late Dec 2050 and early Jan 2051 -- both in ja-wol before sohan', () => {
      const dec2050 = calcPillars(2050, 12, 15, 12, 0);
      // For 2051, use VSOP87D fallback directly
      const jan2051Index = Vsop87dFallback.sajuMonthIndexAt(2051, 1, 3, 12, 0);

      expect(dec2050.pillars.month.jiji).toBe(Jiji.JA);
      // sajuMonthIndex=11 is JA
      expect(jan2051Index).toBe(11);
    });

    it('mid Jan 2051 after sohan -- transitions to chuk-wol', () => {
      const midJan2051Index = Vsop87dFallback.sajuMonthIndexAt(2051, 1, 15, 12, 0);
      expect(midJan2051Index).toBe(12); // CHUK
    });

    it('same calendar date in 2050 vs 2051 -- month branches match for mid-month dates', () => {
      // June 15 is well within o-wol in both years
      const june2050 = calcPillars(2050, 6, 15, 12, 0);
      const june2051Index = Vsop87dFallback.sajuMonthIndexAt(2051, 6, 15, 12, 0);
      // sajuMonthIndex=5 = O
      expect(june2050.pillars.month.jiji).toBe(Jiji.O);
      expect(june2051Index).toBe(5);

      // March 15 is well within myo-wol
      const march2050 = calcPillars(2050, 3, 15, 12, 0);
      const march2051Index = Vsop87dFallback.sajuMonthIndexAt(2051, 3, 15, 12, 0);
      expect(march2050.pillars.month.jiji).toBe(Jiji.MYO);
      expect(march2051Index).toBe(2);

      // September 15 is well within yu-wol
      const sept2050 = calcPillars(2050, 9, 15, 12, 0);
      const sept2051Index = Vsop87dFallback.sajuMonthIndexAt(2051, 9, 15, 12, 0);
      expect(sept2050.pillars.month.jiji).toBe(Jiji.YU);
      expect(sept2051Index).toBe(8);
    });

    it('same calendar date across 2050-2051 -- branch difference is at most 1', () => {
      // Map sajuMonthIndex to Jiji ordinal for comparison
      const monthIndexToJijiOrdinal: Record<number, number> = {
        1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7,
        7: 8, 8: 9, 9: 10, 10: 11, 11: 0, 12: 1,
      };

      const testDates = [
        [1, 8], [4, 7], [7, 10], [10, 10],
      ];

      for (const [month, day] of testDates) {
        const result2050 = calcPillars(2050, month, day, 12, 0);
        const ordinal2050 = jijiOrdinal(result2050.pillars.month.jiji);
        const index2051 = Vsop87dFallback.sajuMonthIndexAt(2051, month, day, 12, 0);
        const ordinal2051 = monthIndexToJijiOrdinal[index2051] ?? -1;
        const ordinalDiff = Math.abs(ordinal2050 - ordinal2051);
        const wrappedDiff = Math.min(ordinalDiff, 12 - ordinalDiff);
        expect(wrappedDiff).toBeLessThanOrEqual(1);
      }
    });
  });

  // =========================================================================
  // 4. Lower boundary: 1900 (within table)
  // =========================================================================

  describe('lower boundary (1900)', () => {
    it('1900-01-15 -- month pillar is calculable and is CHUK', () => {
      const result = calcPillars(1900, 1, 15, 12, 0);
      expect(result.pillars.month).toBeDefined();
      expect(result.pillars.month.jiji).toBe(Jiji.CHUK);
    });
  });

  // =========================================================================
  // 5. Below-range boundary: 1899 (VSOP87D fallback)
  // =========================================================================

  describe('below-range (1899)', () => {
    it('1899 VSOP87D fallback produces 12 boundaries', () => {
      const boundaries = Vsop87dFallback.boundariesOfYear(1899);
      expect(boundaries.length).toBe(12);
    });

    it('1899-12-15 -- month branch is seasonally correct (JA)', () => {
      const monthIndex = Vsop87dFallback.sajuMonthIndexAt(1899, 12, 15, 12, 0);
      expect(monthIndex).toBe(11); // JA
    });
  });

  // =========================================================================
  // 6. JeolBoundaryTable API direct checks
  // =========================================================================

  describe('JeolBoundaryTable API edge range', () => {
    it('reports 2050 as supported year', () => {
      expect(JeolBoundaryTable.isSupportedYear(2050)).toBe(true);
    });

    it('reports 2051 as NOT supported year', () => {
      expect(JeolBoundaryTable.isSupportedYear(2051)).toBe(false);
    });

    it('reports 1900 as supported year', () => {
      expect(JeolBoundaryTable.isSupportedYear(1900)).toBe(true);
    });

    it('reports 1899 as NOT supported year', () => {
      expect(JeolBoundaryTable.isSupportedYear(1899)).toBe(false);
    });
  });

  // =========================================================================
  // 7. Ipchun continuity across the boundary
  // =========================================================================

  describe('ipchun continuity', () => {
    it('ipchun for 2050 and 2051 are both available and astronomically consistent', () => {
      const ipchun2050 = JeolBoundaryTable.ipchunOf(2050);
      expect(ipchun2050).toBeDefined();
      expect(ipchun2050!.month).toBe(2);
      expect(ipchun2050!.day).toBeGreaterThanOrEqual(3);
      expect(ipchun2050!.day).toBeLessThanOrEqual(5);

      const ipchun2051 = Vsop87dFallback.ipchunOf(2051);
      expect(ipchun2051).toBeDefined();
      expect(ipchun2051.month).toBe(2);
      expect(ipchun2051.day).toBeGreaterThanOrEqual(3);
      expect(ipchun2051.day).toBeLessThanOrEqual(5);

      // Day difference should be at most 2
      const dayDiff = Math.abs(ipchun2050!.day - ipchun2051.day);
      expect(dayDiff).toBeLessThanOrEqual(2);
    });
  });
});
