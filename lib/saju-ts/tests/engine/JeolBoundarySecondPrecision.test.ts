import { describe, it, expect } from 'vitest';
import { JeolBoundaryTable, type JeolBoundary } from '../../src/calendar/solar/JeolBoundaryTable.js';
import { Vsop87dFallback } from '../../src/calendar/solar/Vsop87dFallback.js';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';

/**
 * Ported from JeolBoundarySecondPrecisionTest.kt (CX-P3-3)
 *
 * Second-level jeol boundary precision test.
 * The table stores minute-level precision while VSOP87D computes sub-second.
 *
 * Tests:
 * 1. Table and VSOP fallback agree within +/-2 minutes
 * 2. 12 boundaries in 2024 agree within +/-2 minutes
 * 3. Ipchun boundaries are monotonically increasing across years
 * 4. Minute boundary strictly separates year pillars at ipchun
 * 5. VSOP fallback produces valid boundaries for years outside table
 * 6. Solar longitudes are at standard 30-degree intervals
 */

/** Compute difference in minutes between two boundaries. */
function minutesBetween(a: JeolBoundary, b: JeolBoundary): number {
  const dA = new Date(Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute));
  const dB = new Date(Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute));
  return Math.round((dB.getTime() - dA.getTime()) / 60000);
}

/** Compute approximate days between two boundaries. */
function daysBetween(a: JeolBoundary, b: JeolBoundary): number {
  const dA = new Date(Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute));
  const dB = new Date(Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute));
  return Math.round((dB.getTime() - dA.getTime()) / (24 * 3600 * 1000));
}

/** Boundary key for ordering comparison. */
function bKey(b: JeolBoundary): number {
  return b.year * 100_000_000 + b.month * 1_000_000 + b.day * 10_000 + b.hour * 100 + b.minute;
}

describe('JeolBoundarySecondPrecision', () => {

  // =========================================================================
  // 1. Table and VSOP fallback ipchun differ by at most 2 minutes
  // =========================================================================

  it('table and VSOP fallback ipchun differ by at most 2 minutes for modern years', () => {
    // Modern years where delta-T polynomial is well-calibrated
    const modernYears = [1950, 1970, 2000, 2024, 2050];
    for (const year of modernYears) {
      const tableIpchun = JeolBoundaryTable.ipchunOf(year);
      expect(tableIpchun).toBeDefined();

      const vsopIpchun = Vsop87dFallback.ipchunOf(year);
      const diffMinutes = Math.abs(minutesBetween(tableIpchun!, vsopIpchun));
      expect(diffMinutes).toBeLessThanOrEqual(2);
    }
  });

  it('table and VSOP fallback ipchun differ by at most 60 minutes for early years', () => {
    // Early years where the delta-T polynomial has larger residuals
    const earlyYears = [1900, 1920];
    for (const year of earlyYears) {
      const tableIpchun = JeolBoundaryTable.ipchunOf(year);
      expect(tableIpchun).toBeDefined();

      const vsopIpchun = Vsop87dFallback.ipchunOf(year);
      const diffMinutes = Math.abs(minutesBetween(tableIpchun!, vsopIpchun));
      // Wider tolerance for early years due to delta-T polynomial divergence
      expect(diffMinutes).toBeLessThanOrEqual(60);
    }
  });

  // =========================================================================
  // 2. Table and VSOP agree for all 12 boundaries in 2024
  // =========================================================================

  it('table and VSOP fallback agree for all 12 jeol boundaries in 2024', () => {
    const tableMap = JeolBoundaryTable.boundariesForYear(2024);
    expect(tableMap).toBeDefined();
    expect(tableMap!.size).toBe(12);

    const vsopBoundaries = Vsop87dFallback.boundariesOfYear(2024);
    expect(vsopBoundaries.length).toBe(12);

    for (const vsop of vsopBoundaries) {
      const tbl = tableMap!.get(vsop.sajuMonthIndex);
      expect(tbl).toBeDefined();

      const diffMinutes = Math.abs(minutesBetween(tbl!, vsop));
      expect(diffMinutes).toBeLessThanOrEqual(2);
    }
  });

  // =========================================================================
  // 3. Ipchun boundaries are monotonically increasing across years
  // =========================================================================

  it('ipchun boundaries are monotonically increasing across 1900-2050', () => {
    let prev = JeolBoundaryTable.ipchunOf(1900)!;
    for (let year = 1901; year <= 2050; year++) {
      const current = JeolBoundaryTable.ipchunOf(year);
      if (!current) continue;

      // current must be chronologically after prev
      expect(bKey(current)).toBeGreaterThan(bKey(prev));

      // Roughly 365-366 days apart (within a week tolerance)
      const days = daysBetween(prev, current);
      expect(days).toBeGreaterThanOrEqual(360);
      expect(days).toBeLessThanOrEqual(372);

      prev = current;
    }
  });

  // =========================================================================
  // 4. Minute boundary strictly separates year pillars at ipchun
  // =========================================================================

  it('minute boundary strictly separates year pillars at ipchun 2024', () => {
    const ipchun2024 = JeolBoundaryTable.ipchunOf(2024)!;

    // 1 minute before ipchun
    const beforeDate = new Date(
      Date.UTC(ipchun2024.year, ipchun2024.month - 1, ipchun2024.day, ipchun2024.hour, ipchun2024.minute),
    );
    beforeDate.setUTCMinutes(beforeDate.getUTCMinutes() - 1);
    const beforeInput = createBirthInput({
      birthYear: beforeDate.getUTCFullYear(),
      birthMonth: beforeDate.getUTCMonth() + 1,
      birthDay: beforeDate.getUTCDate(),
      birthHour: beforeDate.getUTCHours(),
      birthMinute: beforeDate.getUTCMinutes(),
      gender: Gender.MALE,
    });
    const beforeResult = calculatePillars(beforeInput);

    // 1 minute after ipchun
    const afterDate = new Date(
      Date.UTC(ipchun2024.year, ipchun2024.month - 1, ipchun2024.day, ipchun2024.hour, ipchun2024.minute),
    );
    afterDate.setUTCMinutes(afterDate.getUTCMinutes() + 1);
    const afterInput = createBirthInput({
      birthYear: afterDate.getUTCFullYear(),
      birthMonth: afterDate.getUTCMonth() + 1,
      birthDay: afterDate.getUTCDate(),
      birthHour: afterDate.getUTCHours(),
      birthMinute: afterDate.getUTCMinutes(),
      gender: Gender.MALE,
    });
    const afterResult = calculatePillars(afterInput);

    // Year pillar should change at ipchun boundary
    expect(beforeResult.pillars.year.equals(afterResult.pillars.year)).toBe(false);
  });

  // =========================================================================
  // 5. VSOP fallback produces valid boundaries for years outside table
  // =========================================================================

  it('VSOP fallback produces valid boundaries for years outside table', () => {
    for (const year of [1895, 1899, 2051, 2060]) {
      const boundaries = Vsop87dFallback.boundariesOfYear(year);
      expect(boundaries.length).toBeGreaterThan(0);

      // Boundaries should be chronologically ordered
      for (let i = 1; i < boundaries.length; i++) {
        expect(bKey(boundaries[i]!)).toBeGreaterThan(bKey(boundaries[i - 1]!));
      }
    }
  });

  // =========================================================================
  // 6. Solar longitude values are at standard 30-degree intervals
  // =========================================================================

  it('solar longitude values are at standard 30-degree intervals', () => {
    const tableMap = JeolBoundaryTable.boundariesForYear(2024)!;

    // Expected longitudes in sajuMonthIndex order (1-12):
    // 1=315(ipchun), 2=345, 3=15, 4=45, 5=75, 6=105, 7=135, 8=165, 9=195, 10=225, 11=255, 12=285
    const expectedLongitudes = [315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285];
    const actualLongitudes: number[] = [];
    for (let i = 1; i <= 12; i++) {
      actualLongitudes.push(tableMap.get(i)!.solarLongitude);
    }
    expect(actualLongitudes).toEqual(expectedLongitudes);
  });
});
