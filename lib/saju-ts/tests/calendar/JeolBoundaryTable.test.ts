import { describe, it, expect } from 'vitest';
import { JeolBoundaryTable } from '../../src/calendar/solar/JeolBoundaryTable.js';
import { Jiji } from '../../src/domain/Jiji.js';

/**
 * Ported from JeolBoundaryTableTest.kt
 */

describe('JeolBoundaryTable', () => {
  // =========================================================================
  // Table coverage
  // =========================================================================
  it('supports years 1900-2050', () => {
    expect(JeolBoundaryTable.isSupportedYear(1900)).toBe(true);
    expect(JeolBoundaryTable.isSupportedYear(2024)).toBe(true);
    expect(JeolBoundaryTable.isSupportedYear(2050)).toBe(true);
    expect(JeolBoundaryTable.isSupportedYear(1899)).toBe(false);
    expect(JeolBoundaryTable.isSupportedYear(2051)).toBe(false);
  });

  // =========================================================================
  // Ipchun lookup
  // =========================================================================
  it('exposes Ipchun for supported year', () => {
    const ipchun = JeolBoundaryTable.ipchunOf(2021);
    expect(ipchun).toBeDefined();
    expect(ipchun!.year).toBe(2021);
    expect(ipchun!.month).toBe(2);
    expect(ipchun!.day).toBe(3);
    expect(ipchun!.hour).toBe(23);
    expect(ipchun!.minute).toBe(59);
    expect(ipchun!.sajuMonthIndex).toBe(1);
    expect(ipchun!.branch).toBe(Jiji.IN);
  });

  it('returns undefined for unsupported year', () => {
    expect(JeolBoundaryTable.ipchunOf(2051)).toBeUndefined();
  });

  // =========================================================================
  // sajuMonthIndexAt: strict-after boundary rule
  // =========================================================================
  it('month index uses strict-after boundary rule', () => {
    // 2025 Ipchun: 2025-02-03 23:10
    const atBoundary = JeolBoundaryTable.sajuMonthIndexAt(2025, 2, 3, 23, 10);
    const rightAfter = JeolBoundaryTable.sajuMonthIndexAt(2025, 2, 3, 23, 11);

    expect(atBoundary).toBe(12); // at boundary = still previous month
    expect(rightAfter).toBe(1);  // after boundary = new month
  });

  it('January lookup uses previous year boundary when needed', () => {
    // 1916 소한: 1916-01-07 00:28
    const beforeSohan = JeolBoundaryTable.sajuMonthIndexAt(1916, 1, 6, 23, 59);
    const atSohan = JeolBoundaryTable.sajuMonthIndexAt(1916, 1, 7, 0, 28);
    const rightAfter = JeolBoundaryTable.sajuMonthIndexAt(1916, 1, 7, 0, 29);

    expect(beforeSohan).toBe(11);
    expect(atSohan).toBe(11);
    expect(rightAfter).toBe(12);
  });

  // =========================================================================
  // boundariesForYear
  // =========================================================================
  it('each supported year has exactly 12 boundaries', () => {
    for (const year of [1900, 1950, 2000, 2024, 2050]) {
      const bounds = JeolBoundaryTable.boundariesForYear(year);
      expect(bounds).toBeDefined();
      expect(bounds!.size).toBe(12);
    }
  });

  it('boundaries cover all 12 saju month indices', () => {
    const bounds = JeolBoundaryTable.boundariesForYear(2024)!;
    for (let i = 1; i <= 12; i++) {
      expect(bounds.has(i)).toBe(true);
    }
  });

  it('returns undefined for unsupported year', () => {
    expect(JeolBoundaryTable.boundariesForYear(2051)).toBeUndefined();
  });

  // =========================================================================
  // nextBoundaryAfter
  // =========================================================================
  it('nextBoundaryAfter finds next jeol', () => {
    // Just after 2024 Ipchun (2024-02-04 at some time)
    const next = JeolBoundaryTable.nextBoundaryAfter(2024, 2, 5, 0, 0);
    expect(next).toBeDefined();
    expect(next!.sajuMonthIndex).toBe(2); // 경칩 (MYO month)
    expect(next!.branch).toBe(Jiji.MYO);
  });

  // =========================================================================
  // previousBoundaryAtOrBefore
  // =========================================================================
  it('previousBoundaryAtOrBefore finds previous jeol', () => {
    // Before 2024 Ipchun
    const prev = JeolBoundaryTable.previousBoundaryAtOrBefore(2024, 2, 1, 0, 0);
    expect(prev).toBeDefined();
    expect(prev!.sajuMonthIndex).toBe(12); // 소한 (CHUK month)
    expect(prev!.branch).toBe(Jiji.CHUK);
  });

  // =========================================================================
  // Structural invariants
  // =========================================================================
  it('boundaries are chronologically ordered within each year', () => {
    for (const year of [1900, 1950, 2000, 2024, 2050]) {
      const bounds = JeolBoundaryTable.boundariesForYear(year)!;
      const values = Array.from(bounds.values());
      for (let i = 1; i < values.length; i++) {
        const prev = values[i - 1]!;
        const curr = values[i]!;
        const prevKey = prev.year * 100_000_000 + prev.month * 1_000_000 + prev.day * 10_000 + prev.hour * 100 + prev.minute;
        const currKey = curr.year * 100_000_000 + curr.month * 1_000_000 + curr.day * 10_000 + curr.hour * 100 + curr.minute;
        // sajuMonthIndex ordering: 12 comes first (Jan), then 1-11
        // but chronological order should hold
        expect(prevKey).toBeLessThan(currKey);
      }
    }
  });

  it('solar longitude follows 30-degree cycle', () => {
    const bounds = JeolBoundaryTable.boundariesForYear(2024)!;
    const longitudes = Array.from(bounds.values()).map(b => b.solarLongitude);
    // All longitudes should be multiples of 15 (odd multiples: 15, 45, 75, ...)
    // The 12 jeol use solar longitudes: 285, 315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255
    for (const lon of longitudes) {
      expect(lon % 15).toBe(0);
    }
    // Should have 12 distinct values (one per month)
    expect(new Set(longitudes).size).toBe(12);
  });

  it('correct branch mapping for all 12 months', () => {
    const expectedBranches: Record<number, Jiji> = {
      1: Jiji.IN, 2: Jiji.MYO, 3: Jiji.JIN, 4: Jiji.SA,
      5: Jiji.O, 6: Jiji.MI, 7: Jiji.SIN, 8: Jiji.YU,
      9: Jiji.SUL, 10: Jiji.HAE, 11: Jiji.JA, 12: Jiji.CHUK,
    };
    const bounds = JeolBoundaryTable.boundariesForYear(2024)!;
    for (const [idx, expectedBranch] of Object.entries(expectedBranches)) {
      const boundary = bounds.get(Number(idx));
      expect(boundary).toBeDefined();
      expect(boundary!.branch).toBe(expectedBranch);
    }
  });

  // =========================================================================
  // Cross-year coverage
  // =========================================================================
  it('all 151 years (1900-2050) have 12 boundaries each', () => {
    for (let year = 1900; year <= 2050; year++) {
      const bounds = JeolBoundaryTable.boundariesForYear(year);
      expect(bounds).toBeDefined();
      expect(bounds!.size).toBe(12);
    }
  });
});
