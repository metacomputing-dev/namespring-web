import { describe, it, expect } from 'vitest';
import { JeolBoundaryTable, type JeolBoundary } from '../../src/calendar/solar/JeolBoundaryTable.js';
import { Vsop87dFallback } from '../../src/calendar/solar/Vsop87dFallback.js';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { Gender } from '../../src/domain/Gender.js';
import { Jiji } from '../../src/domain/Jiji.js';

/**
 * Ported from Vsop87dFallbackAccuracyTest.kt (ACC-3)
 *
 * Verifies VSOP87D runtime fallback accuracy for dates outside the
 * precomputed JeolBoundaryTable range (1900-2050).
 *
 * Sections:
 * 1. Table vs Fallback Comparison (2050)
 * 2. Fallback-Only Years (2051-2100)
 * 3. Pre-1900 Fallback
 * 4. Cross-Year Consistency
 * 5. Seasonal Month Branch Consistency
 */

/** Compute difference in minutes between two boundaries. */
function minutesBetween(a: JeolBoundary, b: JeolBoundary): number {
  const dA = new Date(Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute));
  const dB = new Date(Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute));
  return Math.round((dB.getTime() - dA.getTime()) / 60000);
}

/** Compute days between two boundaries. */
function daysBetween(a: JeolBoundary, b: JeolBoundary): number {
  const dA = new Date(Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute));
  const dB = new Date(Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute));
  return Math.round((dB.getTime() - dA.getTime()) / (24 * 3600 * 1000));
}

function bKey(b: JeolBoundary): number {
  return b.year * 100_000_000 + b.month * 1_000_000 + b.day * 10_000 + b.hour * 100 + b.minute;
}

const testConfig = createConfig({
  dayCutMode: DayCutMode.MIDNIGHT_00,
  applyDstHistory: false,
  includeEquationOfTime: false,
  lmtBaselineLongitude: 135.0,
});

// Term checks: subset of 12 solar terms for comparison
const termsToCompare = [
  { name: 'Ipchun', solarLongitude: 315, sajuMonthIndex: 1 },
  { name: 'Gyeongchip', solarLongitude: 345, sajuMonthIndex: 2 },
  { name: 'Cheongmyeong', solarLongitude: 15, sajuMonthIndex: 3 },
  { name: 'Ipha', solarLongitude: 45, sajuMonthIndex: 4 },
  { name: 'Soseo', solarLongitude: 105, sajuMonthIndex: 6 },
  { name: 'Ipchu', solarLongitude: 135, sajuMonthIndex: 7 },
];

describe('Vsop87dFallbackAccuracy', () => {

  // =========================================================================
  // Section 1: Table vs Fallback Comparison (2050)
  // =========================================================================

  describe('Section 1: Table vs Fallback comparison (2050)', () => {
    it('table vs fallback boundaries for 2050 match within 5 minutes (6 terms)', () => {
      const tableBoundaries = JeolBoundaryTable.boundariesForYear(2050);
      expect(tableBoundaries).toBeDefined();

      const fallbackBoundaries = Vsop87dFallback.boundariesOfYear(2050);
      expect(fallbackBoundaries.length).toBeGreaterThan(0);

      for (const term of termsToCompare) {
        const tableEntry = tableBoundaries!.get(term.sajuMonthIndex);
        expect(tableEntry).toBeDefined();

        const fallbackEntry = fallbackBoundaries.find(b => b.sajuMonthIndex === term.sajuMonthIndex);
        expect(fallbackEntry).toBeDefined();

        const diffMinutes = Math.abs(minutesBetween(tableEntry!, fallbackEntry!));
        expect(diffMinutes).toBeLessThanOrEqual(5);

        // Solar longitude and branch must match exactly
        expect(tableEntry!.solarLongitude).toBe(fallbackEntry!.solarLongitude);
        expect(tableEntry!.branch).toBe(fallbackEntry!.branch);
      }
    });

    it('all 12 table boundaries for 2050 match fallback within 5 minutes', () => {
      const tableBoundaries = JeolBoundaryTable.boundariesForYear(2050)!;
      const fallbackBoundaries = Vsop87dFallback.boundariesOfYear(2050);

      expect(tableBoundaries.size).toBe(12);
      expect(fallbackBoundaries.length).toBe(12);

      for (const [sajuMonthIndex, tableEntry] of tableBoundaries) {
        const fallbackEntry = fallbackBoundaries.find(b => b.sajuMonthIndex === sajuMonthIndex)!;
        const diffMinutes = Math.abs(minutesBetween(tableEntry, fallbackEntry));
        expect(diffMinutes).toBeLessThanOrEqual(5);
      }
    });
  });

  // =========================================================================
  // Section 2: Fallback-Only Years (2051-2100)
  // =========================================================================

  const fallbackOnlyYears = [2051, 2055, 2075, 2100];

  describe('Section 2: Fallback-only years', () => {
    it('fallback produces exactly 12 boundaries per year', () => {
      for (const year of fallbackOnlyYears) {
        expect(JeolBoundaryTable.isSupportedYear(year)).toBe(false);
        const boundaries = Vsop87dFallback.boundariesOfYear(year);
        expect(boundaries.length).toBe(12);
      }
    });

    it('solar term moments are strictly sequential within each year', () => {
      for (const year of fallbackOnlyYears) {
        const boundaries = Vsop87dFallback.boundariesOfYear(year);
        for (let i = 1; i < boundaries.length; i++) {
          expect(bKey(boundaries[i]!)).toBeGreaterThan(bKey(boundaries[i - 1]!));
        }
      }
    });

    it('ipchun falls in late January or February for all fallback years', () => {
      for (const year of fallbackOnlyYears) {
        const boundaries = Vsop87dFallback.boundariesOfYear(year);
        const ipchun = boundaries.find(b => b.sajuMonthIndex === 1)!;

        // Ipchun: typically February 3-5; allow January 20 through February 10
        const isPlausible =
          (ipchun.month === 1 && ipchun.day >= 20) ||
          (ipchun.month === 2 && ipchun.day <= 10);
        expect(isPlausible).toBe(true);
      }
    });

    it('all 12 jeol terms span roughly 300-365 days within each year', () => {
      for (const year of fallbackOnlyYears) {
        const boundaries = Vsop87dFallback.boundariesOfYear(year);
        const first = boundaries[0]!;
        const last = boundaries[boundaries.length - 1]!;
        const spanDays = daysBetween(first, last);
        expect(spanDays).toBeGreaterThanOrEqual(300);
        expect(spanDays).toBeLessThanOrEqual(365);
      }
    });

    it('all 12 distinct sajuMonthIndex values are present', () => {
      for (const year of fallbackOnlyYears) {
        const boundaries = Vsop87dFallback.boundariesOfYear(year);
        const indices = new Set(boundaries.map(b => b.sajuMonthIndex));
        expect(indices.size).toBe(12);
        for (let i = 1; i <= 12; i++) {
          expect(indices.has(i)).toBe(true);
        }
      }
    });
  });

  // =========================================================================
  // Section 3: Pre-1900 Fallback
  // =========================================================================

  const pre1900Years = [1890, 1895, 1899];

  describe('Section 3: Pre-1900 fallback', () => {
    it('pre-1900 years are outside table range', () => {
      for (const year of pre1900Years) {
        expect(JeolBoundaryTable.isSupportedYear(year)).toBe(false);
      }
    });

    it('pre-1900 fallback produces 12 sequential boundaries', () => {
      for (const year of pre1900Years) {
        const boundaries = Vsop87dFallback.boundariesOfYear(year);
        expect(boundaries.length).toBe(12);
        for (let i = 1; i < boundaries.length; i++) {
          expect(bKey(boundaries[i]!)).toBeGreaterThan(bKey(boundaries[i - 1]!));
        }
      }
    });

    it('July 1895 month index is MI (sajuMonthIndex=6) or O (sajuMonthIndex=5)', () => {
      // July 15 after soseo (sajuMonthIndex=6) and before ipchu (sajuMonthIndex=7)
      const monthIndex = Vsop87dFallback.sajuMonthIndexAt(1895, 7, 15, 12, 0);
      // MI (index 6) is expected; O (index 5) acceptable if near boundary
      expect([5, 6]).toContain(monthIndex);
    });

    it('pre-1900 ipchun falls in expected date range', () => {
      for (const year of pre1900Years) {
        const boundaries = Vsop87dFallback.boundariesOfYear(year);
        const ipchun = boundaries.find(b => b.sajuMonthIndex === 1)!;
        const isPlausible =
          (ipchun.month === 1 && ipchun.day >= 20) ||
          (ipchun.month === 2 && ipchun.day <= 10);
        expect(isPlausible).toBe(true);
      }
    });

    it('1890 has all sajuMonthIndex 1 through 12', () => {
      const boundaries = Vsop87dFallback.boundariesOfYear(1890);
      const indices = new Set(boundaries.map(b => b.sajuMonthIndex));
      expect(indices.size).toBe(12);
      for (let i = 1; i <= 12; i++) {
        expect(indices.has(i)).toBe(true);
      }
    });
  });

  // =========================================================================
  // Section 4: Cross-Year Consistency
  // =========================================================================

  describe('Section 4: Cross-year consistency', () => {
    it('ipchun dates 2049-2052 advance by roughly 365 days each year', () => {
      const years = [2049, 2050, 2051, 2052];

      // 2049, 2050 are table years; 2051, 2052 are fallback years
      expect(JeolBoundaryTable.isSupportedYear(2049)).toBe(true);
      expect(JeolBoundaryTable.isSupportedYear(2050)).toBe(true);
      expect(JeolBoundaryTable.isSupportedYear(2051)).toBe(false);
      expect(JeolBoundaryTable.isSupportedYear(2052)).toBe(false);

      const ipchunDates: JeolBoundary[] = years.map(year => {
        if (JeolBoundaryTable.isSupportedYear(year)) {
          return JeolBoundaryTable.ipchunOf(year)!;
        }
        return Vsop87dFallback.ipchunOf(year);
      });

      for (let i = 1; i < ipchunDates.length; i++) {
        const gapDays = daysBetween(ipchunDates[i - 1]!, ipchunDates[i]!);
        expect(gapDays).toBeGreaterThanOrEqual(363);
        expect(gapDays).toBeLessThanOrEqual(368);
      }
    });

    it('ipchun deviation from 365.25-day mean is under 3 days', () => {
      const years = [2049, 2050, 2051, 2052];
      const ipchunDates: JeolBoundary[] = years.map(year => {
        if (JeolBoundaryTable.isSupportedYear(year)) {
          return JeolBoundaryTable.ipchunOf(year)!;
        }
        return Vsop87dFallback.ipchunOf(year);
      });

      for (let i = 1; i < ipchunDates.length; i++) {
        const gapDays = daysBetween(ipchunDates[i - 1]!, ipchunDates[i]!);
        const deviation = Math.abs(gapDays - 365.25);
        expect(deviation).toBeLessThan(3.0);
      }
    });

    it('all ipchun dates fall in February', () => {
      for (const year of [2049, 2050, 2051, 2052]) {
        let ipchun: JeolBoundary;
        if (JeolBoundaryTable.isSupportedYear(year)) {
          ipchun = JeolBoundaryTable.ipchunOf(year)!;
        } else {
          ipchun = Vsop87dFallback.ipchunOf(year);
        }
        expect(ipchun.month).toBe(2);
      }
    });
  });

  // =========================================================================
  // Section 5: Seasonal Month Branch Consistency
  // =========================================================================

  describe('Section 5: Seasonal month branch consistency for fallback years', () => {
    const analysisCases = [
      { year: 1895, month: 7, day: 15, expectedIndex: 6, label: '1895 summer (mi-wol)' },
      { year: 2055, month: 3, day: 20, expectedIndex: 2, label: '2055 spring (myo-wol)' },
      { year: 2055, month: 9, day: 15, expectedIndex: 8, label: '2055 autumn (yu-wol)' },
      { year: 2100, month: 6, day: 15, expectedIndex: 5, label: '2100 summer (o-wol)' },
    ];

    it('month index matches expected seasonal position for fallback years', () => {
      for (const tc of analysisCases) {
        const monthIndex = Vsop87dFallback.sajuMonthIndexAt(tc.year, tc.month, tc.day, 12, 0);
        expect(monthIndex).toBe(tc.expectedIndex);
      }
    });
  });
});
