import { describe, it, expect } from 'vitest';
import { JeolBoundaryTable, type JeolBoundary } from '../../src/calendar/solar/JeolBoundaryTable.js';
import { Vsop87dFallback } from '../../src/calendar/solar/Vsop87dFallback.js';

/**
 * Ported from JeolBoundaryTableVsVsopContinuityTest.kt (calendar-level)
 *
 * Purely calendar-level tests verifying consistency between the precomputed
 * JeolBoundaryTable and the VSOP87D runtime fallback. No engine-level
 * calculations -- just table and fallback boundary data comparisons.
 *
 * Key invariants:
 * 1. Table and VSOP87D agree on boundary times within tight tolerance
 * 2. Both produce 12 boundaries per year with correct month index coverage
 * 3. Boundary ordering is maintained across the table/fallback seam
 */

function minutesBetween(a: JeolBoundary, b: JeolBoundary): number {
  const dA = new Date(Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute));
  const dB = new Date(Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute));
  return Math.round((dB.getTime() - dA.getTime()) / 60000);
}

function bKey(b: JeolBoundary): number {
  return b.year * 100_000_000 + b.month * 1_000_000 + b.day * 10_000 + b.hour * 100 + b.minute;
}

describe('JeolBoundaryTable vs Vsop87d Calendar Continuity', () => {

  // =========================================================================
  // 1. Table and VSOP87D overlap comparison for sample years
  // =========================================================================

  describe('table vs VSOP87D overlap', () => {
    // Modern years where delta-T polynomial is well-calibrated (tight tolerance)
    const modernYears = [2000, 2024, 2050];

    for (const year of modernYears) {
      it(`year=${year}: all 12 boundaries agree within 2 minutes`, () => {
        const tableMap = JeolBoundaryTable.boundariesForYear(year)!;
        expect(tableMap.size).toBe(12);

        const vsopBoundaries = Vsop87dFallback.boundariesOfYear(year);
        expect(vsopBoundaries.length).toBe(12);

        for (const vsop of vsopBoundaries) {
          const tbl = tableMap.get(vsop.sajuMonthIndex)!;
          const diff = Math.abs(minutesBetween(tbl, vsop));
          expect(diff).toBeLessThanOrEqual(2);

          // Metadata must match exactly
          expect(tbl.solarLongitude).toBe(vsop.solarLongitude);
          expect(tbl.branch).toBe(vsop.branch);
          expect(tbl.sajuMonthIndex).toBe(vsop.sajuMonthIndex);
        }
      });
    }

    // Early years where delta-T polynomial has larger residuals (wider tolerance)
    const earlyYears = [1900, 1950];

    for (const year of earlyYears) {
      it(`year=${year}: all 12 boundaries agree within 90 minutes (delta-T era)`, () => {
        const tableMap = JeolBoundaryTable.boundariesForYear(year)!;
        expect(tableMap.size).toBe(12);

        const vsopBoundaries = Vsop87dFallback.boundariesOfYear(year);
        expect(vsopBoundaries.length).toBe(12);

        for (const vsop of vsopBoundaries) {
          const tbl = tableMap.get(vsop.sajuMonthIndex)!;
          const diff = Math.abs(minutesBetween(tbl, vsop));
          // Wider tolerance for early years due to delta-T polynomial divergence
          expect(diff).toBeLessThanOrEqual(90);

          // Metadata must still match exactly
          expect(tbl.solarLongitude).toBe(vsop.solarLongitude);
          expect(tbl.branch).toBe(vsop.branch);
          expect(tbl.sajuMonthIndex).toBe(vsop.sajuMonthIndex);
        }
      });
    }
  });

  // =========================================================================
  // 2. Fallback produces correct structure for outside-range years
  // =========================================================================

  describe('fallback structural validity', () => {
    const outsideYears = [1895, 1899, 2051, 2060, 2100];

    for (const year of outsideYears) {
      it(`year=${year}: produces 12 sequential boundaries with all month indexes`, () => {
        expect(JeolBoundaryTable.isSupportedYear(year)).toBe(false);

        const boundaries = Vsop87dFallback.boundariesOfYear(year);
        expect(boundaries.length).toBe(12);

        // Sequential ordering
        for (let i = 1; i < boundaries.length; i++) {
          expect(bKey(boundaries[i]!)).toBeGreaterThan(bKey(boundaries[i - 1]!));
        }

        // All 12 month indexes present
        const indices = new Set(boundaries.map(b => b.sajuMonthIndex));
        for (let i = 1; i <= 12; i++) {
          expect(indices.has(i)).toBe(true);
        }

        // Month index sequence should be [12, 1, 2, ..., 11]
        const expected = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        expect(boundaries.map(b => b.sajuMonthIndex)).toEqual(expected);
      });
    }
  });

  // =========================================================================
  // 3. Boundary seam: 2050 (table) to 2051 (fallback)
  // =========================================================================

  describe('2050-2051 seam', () => {
    it('last boundary of 2050 table < first boundary of 2051 fallback', () => {
      const table2050 = Array.from(JeolBoundaryTable.boundariesForYear(2050)!.values())
        .sort((a, b) => bKey(a) - bKey(b));
      const fallback2051 = Vsop87dFallback.boundariesOfYear(2051);

      const lastOf2050 = table2050[table2050.length - 1]!;
      const firstOf2051 = fallback2051[0]!;

      expect(bKey(firstOf2051)).toBeGreaterThan(bKey(lastOf2050));
    });

    it('corresponding monthly boundaries are ~365 days apart', () => {
      const table2050 = JeolBoundaryTable.boundariesForYear(2050)!;
      const fallback2051 = Vsop87dFallback.boundariesOfYear(2051);
      const map2051 = new Map(fallback2051.map(b => [b.sajuMonthIndex, b]));

      for (let monthIndex = 1; monthIndex <= 12; monthIndex++) {
        const b2050 = table2050.get(monthIndex)!;
        const b2051 = map2051.get(monthIndex)!;

        const dA = new Date(Date.UTC(b2050.year, b2050.month - 1, b2050.day, b2050.hour, b2050.minute));
        const dB = new Date(Date.UTC(b2051.year, b2051.month - 1, b2051.day, b2051.hour, b2051.minute));
        const daysBetween = Math.round((dB.getTime() - dA.getTime()) / (24 * 3600 * 1000));

        expect(daysBetween).toBeGreaterThanOrEqual(363);
        expect(daysBetween).toBeLessThanOrEqual(368);
      }
    });
  });

  // =========================================================================
  // 4. Boundary seam: 1899 (fallback) to 1900 (table)
  // =========================================================================

  describe('1899-1900 seam', () => {
    it('last boundary of 1899 fallback < first boundary of 1900 table', () => {
      const fallback1899 = Vsop87dFallback.boundariesOfYear(1899);
      const table1900 = Array.from(JeolBoundaryTable.boundariesForYear(1900)!.values())
        .sort((a, b) => bKey(a) - bKey(b));

      const lastOf1899 = fallback1899[fallback1899.length - 1]!;
      const firstOf1900 = table1900[0]!;

      expect(bKey(firstOf1900)).toBeGreaterThan(bKey(lastOf1899));
    });

    it('ipchun 1899 and 1900 are ~365 days apart', () => {
      const ipchun1899 = Vsop87dFallback.ipchunOf(1899);
      const ipchun1900 = JeolBoundaryTable.ipchunOf(1900)!;

      const dA = new Date(Date.UTC(ipchun1899.year, ipchun1899.month - 1, ipchun1899.day, ipchun1899.hour, ipchun1899.minute));
      const dB = new Date(Date.UTC(ipchun1900.year, ipchun1900.month - 1, ipchun1900.day, ipchun1900.hour, ipchun1900.minute));
      const daysBetween = Math.round((dB.getTime() - dA.getTime()) / (24 * 3600 * 1000));

      expect(daysBetween).toBeGreaterThanOrEqual(364);
      expect(daysBetween).toBeLessThanOrEqual(367);
    });
  });

  // =========================================================================
  // 5. Solar longitude consistency
  // =========================================================================

  describe('solar longitude consistency', () => {
    it('VSOP87D boundaries use same solar longitudes as table', () => {
      // The 12 jeol terms have fixed solar longitudes
      const expectedLongitudes = new Set([
        285, 315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255,
      ]);

      const vsop2051 = Vsop87dFallback.boundariesOfYear(2051);
      for (const b of vsop2051) {
        expect(expectedLongitudes.has(b.solarLongitude)).toBe(true);
      }

      const vsop1895 = Vsop87dFallback.boundariesOfYear(1895);
      for (const b of vsop1895) {
        expect(expectedLongitudes.has(b.solarLongitude)).toBe(true);
      }
    });
  });
});
