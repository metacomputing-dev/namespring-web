import { describe, it, expect } from 'vitest';
import { JeolBoundaryTable, type JeolBoundary } from '../../src/calendar/solar/JeolBoundaryTable.js';
import { DaeunCalculator } from '../../src/engine/luck/DaeunCalculator.js';
import { SaeunCalculator } from '../../src/engine/luck/SaeunCalculator.js';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { Gender } from '../../src/domain/Gender.js';
import { PillarSet } from '../../src/domain/PillarSet.js';

/**
 * Temporal Monotonicity Invariant Test Suite (I-03)
 *
 * Verifies three critical temporal invariants:
 *
 * - INV-05: Jeol boundary within-year monotonicity (1900-2050)
 * - INV-06: Daeun age sequence strict monotonicity
 * - INV-04: Monthly luck 12-month full coverage (no gaps, no overlaps)
 *
 * Ported from TemporalMonotonicityInvariantTest.kt
 */

/** Pack year/month/day/hour/minute into a single comparable number. */
function momentKey(y: number, m: number, d: number, h: number, min: number): number {
  return y * 100_000_000 + m * 1_000_000 + d * 10_000 + h * 100 + min;
}

function boundaryToKey(b: JeolBoundary): number {
  return momentKey(b.year, b.month, b.day, b.hour, b.minute);
}

/** Build a PillarSet from date components. */
function buildPillars(y: number, m: number, d: number, h: number): PillarSet {
  const yearPillar = GanjiCycle.yearPillarByIpchunApprox(y, m, d);
  const monthPillar = GanjiCycle.monthPillarByJeolApprox(yearPillar.cheongan, y, m, d);
  const dayPillar = GanjiCycle.dayPillarByJdn(y, m, d);
  const hourPillar = GanjiCycle.hourPillar(dayPillar.cheongan, h);
  return new PillarSet(yearPillar, monthPillar, dayPillar, hourPillar);
}

// =========================================================================
// INV-05: Jeol Boundary Within-Year Monotonicity
// =========================================================================

describe('INV-05: Jeol Boundary Within-Year Monotonicity', () => {
  /** All 151 years from 1900 to 2050. */
  const jeolYears = Array.from({ length: 151 }, (_, i) => 1900 + i);

  describe('jeol boundaries are strictly ascending within year', () => {
    /**
     * For every year, all 12 jeol boundaries when sorted chronologically
     * must satisfy: t(b_i) < t(b_{i+1}) for all i.
     */
    it.each(jeolYears)('year %i', (year) => {
      const boundaryMap = JeolBoundaryTable.boundariesForYear(year);
      expect(boundaryMap).toBeDefined();
      expect(boundaryMap!.size).toBe(12);

      // Sort boundaries chronologically by moment key
      const sorted = [...boundaryMap!.values()].sort(
        (a, b) => boundaryToKey(a) - boundaryToKey(b),
      );

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!;
        const curr = sorted[i]!;
        expect(boundaryToKey(prev)).toBeLessThan(
          boundaryToKey(curr),
        );
      }
    });
  });

  describe('jeol boundary moments are distinct within year', () => {
    it.each(jeolYears)('year %i', (year) => {
      const boundaryMap = JeolBoundaryTable.boundariesForYear(year)!;
      const keys = [...boundaryMap.values()].map(boundaryToKey);
      const distinct = new Set(keys);
      expect(keys.length).toBe(distinct.size);
    });
  });

  describe('jeol boundaries cover all 12 sajuMonthIndex values', () => {
    it.each(jeolYears)('year %i', (year) => {
      const boundaryMap = JeolBoundaryTable.boundariesForYear(year)!;
      const expected = new Set(Array.from({ length: 12 }, (_, i) => i + 1));
      const actual = new Set(boundaryMap.keys());
      expect(actual).toEqual(expected);
    });
  });

  /** 150 consecutive year pairs for cross-year monotonicity. */
  const consecutivePairs = Array.from({ length: 150 }, (_, i) => [1900 + i, 1901 + i]);

  describe('cross-year boundaries are monotonic', () => {
    it.each(consecutivePairs)('year %i -> %i', (year, nextYear) => {
      const current = JeolBoundaryTable.boundariesForYear(year)!;
      const next = JeolBoundaryTable.boundariesForYear(nextYear)!;

      const lastCurrent = Math.max(...[...current.values()].map(boundaryToKey));
      const firstNext = Math.min(...[...next.values()].map(boundaryToKey));

      expect(lastCurrent).toBeLessThan(firstNext);
    });
  });
});

// =========================================================================
// INV-06: Daeun Age Sequence Monotonicity
// =========================================================================

describe('INV-06: Daeun Age Sequence Monotonicity', () => {
  const representativeBirths: Array<{
    label: string;
    year: number;
    month: number;
    day: number;
    hour: number;
    gender: Gender;
  }> = [
    // Early 20th century
    { label: '1900-M-Jan', year: 1900, month: 1, day: 15, hour: 6, gender: Gender.MALE },
    { label: '1905-F-Mar', year: 1905, month: 3, day: 8, hour: 10, gender: Gender.FEMALE },
    { label: '1920-M-Jul', year: 1920, month: 7, day: 22, hour: 14, gender: Gender.MALE },
    { label: '1935-F-Nov', year: 1935, month: 11, day: 3, hour: 20, gender: Gender.FEMALE },
    // Mid 20th century
    { label: '1950-M-Feb', year: 1950, month: 2, day: 5, hour: 0, gender: Gender.MALE },
    { label: '1955-F-May', year: 1955, month: 5, day: 18, hour: 8, gender: Gender.FEMALE },
    { label: '1960-M-Aug', year: 1960, month: 8, day: 12, hour: 12, gender: Gender.MALE },
    { label: '1968-F-Dec', year: 1968, month: 12, day: 25, hour: 23, gender: Gender.FEMALE },
    // Late 20th century
    { label: '1975-M-Apr', year: 1975, month: 4, day: 1, hour: 3, gender: Gender.MALE },
    { label: '1980-F-Jun', year: 1980, month: 6, day: 15, hour: 9, gender: Gender.FEMALE },
    { label: '1985-M-Sep', year: 1985, month: 9, day: 30, hour: 16, gender: Gender.MALE },
    { label: '1990-F-ipchun', year: 1990, month: 2, day: 4, hour: 11, gender: Gender.FEMALE },
    // Turn of century
    { label: '1995-M-Oct', year: 1995, month: 10, day: 10, hour: 7, gender: Gender.MALE },
    { label: '2000-F-midnight', year: 2000, month: 1, day: 1, hour: 0, gender: Gender.FEMALE },
    { label: '2000-M-Jul', year: 2000, month: 7, day: 4, hour: 15, gender: Gender.MALE },
    // 21st century
    { label: '2005-F-Mar', year: 2005, month: 3, day: 21, hour: 5, gender: Gender.FEMALE },
    { label: '2010-M-Jun', year: 2010, month: 6, day: 6, hour: 18, gender: Gender.MALE },
    { label: '2015-F-Sep', year: 2015, month: 9, day: 15, hour: 22, gender: Gender.FEMALE },
    { label: '2020-M-Feb', year: 2020, month: 2, day: 1, hour: 4, gender: Gender.MALE },
    { label: '2024-F-Aug', year: 2024, month: 8, day: 8, hour: 13, gender: Gender.FEMALE },
    // Boundary
    { label: '2025-M-ipchun', year: 2025, month: 2, day: 3, hour: 23, gender: Gender.MALE },
    { label: '2030-F-Dec', year: 2030, month: 12, day: 31, hour: 11, gender: Gender.FEMALE },
    { label: '2040-M-May', year: 2040, month: 5, day: 5, hour: 5, gender: Gender.MALE },
    { label: '2050-F-Jan', year: 2050, month: 1, day: 20, hour: 8, gender: Gender.FEMALE },
  ];

  /** Compute daeun for a birth date. */
  function computeDaeun(
    year: number, month: number, day: number, hour: number, gender: Gender,
  ) {
    const pillars = buildPillars(year, month, day, hour);
    return DaeunCalculator.calculate(pillars, gender, year, month, day, hour, 0, 8);
  }

  describe('daeun start ages are strictly increasing', () => {
    it.each(representativeBirths)(
      '$label',
      ({ year, month, day, hour, gender }) => {
        const daeunInfo = computeDaeun(year, month, day, hour, gender);
        const dps = daeunInfo.daeunPillars;
        expect(dps.length).toBeGreaterThanOrEqual(2);

        for (let i = 1; i < dps.length; i++) {
          expect(dps[i - 1]!.startAge).toBeLessThan(dps[i]!.startAge);
        }
      },
    );
  });

  describe('consecutive daeun age difference is exactly 10', () => {
    it.each(representativeBirths)(
      '$label',
      ({ year, month, day, hour, gender }) => {
        const daeunInfo = computeDaeun(year, month, day, hour, gender);
        const dps = daeunInfo.daeunPillars;

        for (let i = 1; i < dps.length; i++) {
          const diff = dps[i]!.startAge - dps[i - 1]!.startAge;
          expect(diff).toBe(10);
        }
      },
    );
  });

  describe('daeun order is sequential (1, 2, 3, ...)', () => {
    it.each(representativeBirths)(
      '$label',
      ({ year, month, day, hour, gender }) => {
        const daeunInfo = computeDaeun(year, month, day, hour, gender);
        daeunInfo.daeunPillars.forEach((dp, index) => {
          expect(dp.order).toBe(index + 1);
        });
      },
    );
  });

  describe('daeun endAge = startAge + 9', () => {
    it.each(representativeBirths)(
      '$label',
      ({ year, month, day, hour, gender }) => {
        const daeunInfo = computeDaeun(year, month, day, hour, gender);
        for (const dp of daeunInfo.daeunPillars) {
          expect(dp.endAge).toBe(dp.startAge + 9);
        }
      },
    );
  });

  describe('daeun periods are contiguous (no age gaps)', () => {
    it.each(representativeBirths)(
      '$label',
      ({ year, month, day, hour, gender }) => {
        const daeunInfo = computeDaeun(year, month, day, hour, gender);
        const dps = daeunInfo.daeunPillars;

        for (let i = 1; i < dps.length; i++) {
          expect(dps[i - 1]!.endAge + 1).toBe(dps[i]!.startAge);
        }
      },
    );
  });

  describe('firstDaeunStartAge >= 1', () => {
    it.each(representativeBirths)(
      '$label',
      ({ year, month, day, hour, gender }) => {
        const daeunInfo = computeDaeun(year, month, day, hour, gender);
        expect(daeunInfo.firstDaeunStartAge).toBeGreaterThanOrEqual(1);
      },
    );
  });
});

// =========================================================================
// INV-04: Monthly Luck 12-Month Full Coverage
// =========================================================================

describe('INV-04: Monthly Luck 12-Month Full Coverage', () => {
  const monthlyLuckYears = [
    1900, 1924, 1950, 1960, 1975, 1984, 1990,
    2000, 2010, 2024, 2025, 2050,
    // Outside JeolBoundaryTable range (pillar calculation still works)
    1800, 2100,
  ];

  const supportedYears = [
    1900, 1924, 1950, 1975, 1984,
    2000, 2010, 2024, 2025, 2040, 2050,
  ];

  describe('monthly luck has exactly 12 entries', () => {
    it.each(monthlyLuckYears)('year %i', (year) => {
      const monthly = SaeunCalculator.monthlyLuck(year);
      expect(monthly.length).toBe(12);
    });
  });

  describe('monthly luck covers all 12 months', () => {
    it.each(monthlyLuckYears)('year %i', (year) => {
      const monthly = SaeunCalculator.monthlyLuck(year);
      const indices = monthly.map((w) => w.sajuMonthIndex);
      const expected = Array.from({ length: 12 }, (_, i) => i + 1);
      expect(indices).toEqual(expected);
    });
  });

  describe('no duplicate month indices', () => {
    it.each(monthlyLuckYears)('year %i', (year) => {
      const monthly = SaeunCalculator.monthlyLuck(year);
      const indices = monthly.map((w) => w.sajuMonthIndex);
      const distinct = new Set(indices);
      expect(indices.length).toBe(distinct.size);
    });
  });

  describe('monthly luck in calendar order', () => {
    it.each(monthlyLuckYears)('year %i', (year) => {
      const monthly = SaeunCalculator.monthlyLuck(year);
      for (let i = 1; i < monthly.length; i++) {
        expect(monthly[i - 1]!.sajuMonthIndex).toBeLessThan(
          monthly[i]!.sajuMonthIndex,
        );
      }
    });
  });

  describe('boundary moments chronological for months 1 through 11 (supported years)', () => {
    it.each(supportedYears)('year %i', (year) => {
      const monthly = SaeunCalculator.monthlyLuck(year);
      // Months 1-11 (indices 0-10) should have strictly ascending boundary moments
      for (let i = 0; i < 10; i++) {
        const curr = monthly[i]!.boundaryMoment;
        const next = monthly[i + 1]!.boundaryMoment;
        if (curr !== undefined && next !== undefined) {
          const currKey = momentKey(curr.year, curr.month, curr.day, curr.hour, curr.minute);
          const nextKey = momentKey(next.year, next.month, next.day, next.hour, next.minute);
          expect(currKey).toBeLessThan(nextKey);
        }
      }
    });
  });

  describe('month 12 boundary precedes month 1 boundary (supported years)', () => {
    it.each(supportedYears)('year %i', (year) => {
      const monthly = SaeunCalculator.monthlyLuck(year);
      const month1 = monthly.find((w) => w.sajuMonthIndex === 1)!;
      const month12 = monthly.find((w) => w.sajuMonthIndex === 12)!;

      if (month1.boundaryMoment && month12.boundaryMoment) {
        const key1 = momentKey(
          month1.boundaryMoment.year, month1.boundaryMoment.month,
          month1.boundaryMoment.day, month1.boundaryMoment.hour, month1.boundaryMoment.minute,
        );
        const key12 = momentKey(
          month12.boundaryMoment.year, month12.boundaryMoment.month,
          month12.boundaryMoment.day, month12.boundaryMoment.hour, month12.boundaryMoment.minute,
        );
        expect(key12).toBeLessThan(key1);
      }
    });
  });

  describe('all monthly pillars are non-null', () => {
    it.each(monthlyLuckYears)('year %i', (year) => {
      const monthly = SaeunCalculator.monthlyLuck(year);
      for (const wolun of monthly) {
        expect(wolun.pillar).toBeDefined();
        expect(wolun.pillar.cheongan).toBeDefined();
        expect(wolun.pillar.jiji).toBeDefined();
      }
    });
  });

  describe('wolun year field matches requested year', () => {
    it.each(monthlyLuckYears)('year %i', (year) => {
      const monthly = SaeunCalculator.monthlyLuck(year);
      for (const wolun of monthly) {
        expect(wolun.year).toBe(year);
      }
    });
  });
});
