import { describe, it, expect } from 'vitest';
import { JeolBoundaryTable } from '../../src/calendar/solar/JeolBoundaryTable.js';
import { JEOL_BOUNDARY_DATA } from '../../src/calendar/solar/JeolBoundaryData.js';

/**
 * Ported from JeolBoundaryTableCoverageAuditTest.kt
 *
 * Verifies the structural integrity of the JeolBoundaryTable:
 * - Correct row count (1812 = 151 years * 12 terms)
 * - Year coverage 1900-2050
 * - 12 boundaries per year
 * - Chronological ordering and uniqueness
 * - Ipchun lookup consistency
 * - Edge range lookups
 */

describe('JeolBoundaryTableCoverageAudit', () => {

  // =========================================================================
  // 1. Embedded data has expected rows and year coverage
  // =========================================================================

  it('embedded data has 1812 rows covering 151 years', () => {
    expect(JEOL_BOUNDARY_DATA.length).toBe(1812);

    // Extract unique years
    const years = [...new Set(JEOL_BOUNDARY_DATA.map(row => row[0]))].sort((a, b) => a - b);
    expect(years.length).toBe(151);
    expect(years[0]).toBe(1900);
    expect(years[years.length - 1]).toBe(2050);

    // Each year must have exactly 12 boundaries
    const yearCounts = new Map<number, number>();
    for (const row of JEOL_BOUNDARY_DATA) {
      yearCounts.set(row[0], (yearCounts.get(row[0]) ?? 0) + 1);
    }
    for (let year = 1900; year <= 2050; year++) {
      expect(yearCounts.get(year)).toBe(12);
    }
  });

  // =========================================================================
  // 2. Supported year range is exactly 1900-2050
  // =========================================================================

  it('supported year range is exactly 1900-2050', () => {
    expect(JeolBoundaryTable.isSupportedYear(1899)).toBe(false);
    expect(JeolBoundaryTable.isSupportedYear(1900)).toBe(true);
    expect(JeolBoundaryTable.isSupportedYear(2024)).toBe(true);
    expect(JeolBoundaryTable.isSupportedYear(2050)).toBe(true);
    expect(JeolBoundaryTable.isSupportedYear(2051)).toBe(false);
  });

  // =========================================================================
  // 3. Boundaries for every supported year are complete
  // =========================================================================

  it('boundaries for every supported year have 12 entries with month indexes 1-12', () => {
    for (let year = 1900; year <= 2050; year++) {
      const boundaries = JeolBoundaryTable.boundariesForYear(year);
      expect(boundaries).toBeDefined();
      expect(boundaries!.size).toBe(12);

      // Verify all 12 month indexes are present
      for (let idx = 1; idx <= 12; idx++) {
        expect(boundaries!.has(idx)).toBe(true);
      }
    }
  });

  // =========================================================================
  // 4. Yearly boundaries are chronological and unique by moment
  // =========================================================================

  it('yearly boundaries are strictly increasing and unique', () => {
    for (let year = 1900; year <= 2050; year++) {
      const boundaries = JeolBoundaryTable.boundariesForYear(year)!;
      const moments = Array.from(boundaries.values())
        .map(b => b.year * 100_000_000 + b.month * 1_000_000 + b.day * 10_000 + b.hour * 100 + b.minute)
        .sort((a, b) => a - b);

      expect(moments.length).toBe(12);
      expect(new Set(moments).size).toBe(12);

      for (let i = 1; i < moments.length; i++) {
        expect(moments[i]).toBeGreaterThan(moments[i - 1]!);
      }
    }
  });

  // =========================================================================
  // 5. Ipchun lookup matches monthIndex=1 boundary
  // =========================================================================

  it('ipchunOf matches sajuMonthIndex=1 boundary for every year', () => {
    for (let year = 1900; year <= 2050; year++) {
      const boundaries = JeolBoundaryTable.boundariesForYear(year)!;
      const ipchun = JeolBoundaryTable.ipchunOf(year);
      expect(ipchun).toBeDefined();

      const monthIndex1 = boundaries.get(1)!;
      expect(ipchun!.year).toBe(monthIndex1.year);
      expect(ipchun!.month).toBe(monthIndex1.month);
      expect(ipchun!.day).toBe(monthIndex1.day);
      expect(ipchun!.hour).toBe(monthIndex1.hour);
      expect(ipchun!.minute).toBe(monthIndex1.minute);
    }
  });

  // =========================================================================
  // 6. Edge range lookups return boundaries
  // =========================================================================

  it('edge range lookups return valid boundaries', () => {
    // First moment of the range
    const nextAtStart = JeolBoundaryTable.nextBoundaryAfter(1900, 1, 1, 0, 0);
    expect(nextAtStart).toBeDefined();

    // Last moment of the range
    const previousAtEnd = JeolBoundaryTable.previousBoundaryAtOrBefore(2050, 12, 31, 23, 59);
    expect(previousAtEnd).toBeDefined();

    const ipchun1900 = JeolBoundaryTable.ipchunOf(1900);
    const ipchun2050 = JeolBoundaryTable.ipchunOf(2050);
    expect(ipchun1900).toBeDefined();
    expect(ipchun2050).toBeDefined();
  });

  // =========================================================================
  // 7. January previousBoundary uses prior year
  // =========================================================================

  it('January 1 previousBoundary comes from prior year', () => {
    const sampleYears = [1901, 1948, 1988, 2024, 2050];
    for (const year of sampleYears) {
      const previous = JeolBoundaryTable.previousBoundaryAtOrBefore(year, 1, 1, 0, 0);
      expect(previous).toBeDefined();
      expect(previous!.year).toBe(year - 1);
    }
  });
});
