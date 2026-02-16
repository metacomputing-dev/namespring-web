import { describe, it, expect } from 'vitest';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { Cheongan, CHEONGAN_VALUES, cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, jijiOrdinal } from '../../src/domain/Jiji.js';
import { Pillar } from '../../src/domain/Pillar.js';

/**
 * A-01: Exhaustive verification of the day pillar JDN formula: (jdn + 49) % 60.
 *
 * Ported from DayPillarJdnExhaustiveTest.kt.
 *
 * This formula is the mathematical foundation of ALL saju day pillar calculations.
 * If this formula is wrong, every chart produced by the engine is wrong. Therefore,
 * this test suite applies two independent verification layers:
 *
 * 1. Manual JDN computation -- the standard astronomical Julian Day Number formula
 *    applied to known dates, verifying (jdn + 49) % 60 yields the correct
 *    sexagenary index.
 *
 * 2. GanjiCycle.dayPillarByJdn() -- the engine's internal day pillar function,
 *    verified against the expected pillar for each date.
 *
 * Anchor: 2024-01-01 = GAP-JA (index 0).
 * Verified against external mansereyok references and confirmed by the engine.
 * From this anchor, 60 consecutive dates cover every unique pillar in the
 * sexagenary cycle exactly once.
 *
 * Constant: JDN_UNIX_EPOCH = 2440588 (1970-01-01)
 * Day pillar formula: (JDN + 49) mod 60 = sexagenary index
 */

// =========================================================================
// Constants
// =========================================================================

/** Julian Day Number of the Unix epoch (1970-01-01 12:00 UT). */
const JDN_UNIX_EPOCH = 2440588;

/** Anchor date: 2024-01-01 is verified to be GAP-JA (index 0). */
const ANCHOR_YEAR = 2024;
const ANCHOR_MONTH = 1;
const ANCHOR_DAY = 1;
const ANCHOR_INDEX = 0;

// =========================================================================
// Helper functions
// =========================================================================

/**
 * Computes epoch day (days since 1970-01-01) for a given UTC date.
 * Matches Java's LocalDate.toEpochDay().
 */
function toEpochDay(year: number, month: number, day: number): number {
  const d = Date.UTC(year, month - 1, day);
  return Math.floor(d / 86_400_000);
}

/**
 * Computes the Julian Day Number from a date using the epoch day offset.
 * Independent of GanjiCycle -- serves as a separate verification path.
 */
function jdnOf(year: number, month: number, day: number): number {
  return toEpochDay(year, month, day) + JDN_UNIX_EPOCH;
}

/**
 * Computes the sexagenary index from a Julian Day Number using the
 * canonical day pillar formula. Always returns 0..59.
 */
function sexagenaryIndex(jdn: number): number {
  return ((jdn + 49) % 60 + 60) % 60;
}

/**
 * Adds N days to a (year, month, day) triple. Returns [year, month, day].
 */
function addDays(year: number, month: number, day: number, offset: number): [number, number, number] {
  const d = new Date(Date.UTC(year, month - 1, day + offset));
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

/**
 * The complete sexagenary cycle (60 pillars) in canonical order.
 * Each entry is the Pillar at the given sexagenary index.
 */
const SEXAGENARY_CYCLE: Pillar[] = Array.from({ length: 60 }, (_, i) => {
  return new Pillar(CHEONGAN_VALUES[i % 10]!, JIJI_VALUES[i % 12]!);
});

// =========================================================================
// Test 1: Full 60-day cycle -- manual JDN formula verification
// =========================================================================

describe('A-01: DayPillarJdnExhaustive', () => {
  describe('Test 1: Full 60-day cycle -- manual JDN formula', () => {
    it('produces correct sexagenary indices for all 60 consecutive dates from anchor', () => {
      for (let offset = 0; offset < 60; offset++) {
        const [y, m, d] = addDays(ANCHOR_YEAR, ANCHOR_MONTH, ANCHOR_DAY, offset);
        const jdn = jdnOf(y, m, d);
        const actualIndex = sexagenaryIndex(jdn);
        const expectedIndex = (ANCHOR_INDEX + offset) % 60;

        expect(actualIndex).toBe(
          expectedIndex,
          // message for debugging
        );
      }
    });

    it('covers all 60 unique sexagenary indices', () => {
      const indices = new Set<number>();
      for (let offset = 0; offset < 60; offset++) {
        const [y, m, d] = addDays(ANCHOR_YEAR, ANCHOR_MONTH, ANCHOR_DAY, offset);
        indices.add(sexagenaryIndex(jdnOf(y, m, d)));
      }

      expect(indices.size).toBe(60);
      for (let i = 0; i < 60; i++) {
        expect(indices.has(i)).toBe(true);
      }
    });
  });

  // =========================================================================
  // Test 2: Full 60-day cycle -- GanjiCycle.dayPillarByJdn verification
  // =========================================================================

  describe('Test 2: Full 60-day cycle -- GanjiCycle.dayPillarByJdn', () => {
    it('matches expected pillars for all 60 consecutive dates', () => {
      for (let offset = 0; offset < 60; offset++) {
        const [y, m, d] = addDays(ANCHOR_YEAR, ANCHOR_MONTH, ANCHOR_DAY, offset);
        const expectedPillar = SEXAGENARY_CYCLE[(ANCHOR_INDEX + offset) % 60]!;
        const actualPillar = GanjiCycle.dayPillarByJdn(y, m, d);

        expect(actualPillar.cheongan).toBe(expectedPillar.cheongan);
        expect(actualPillar.jiji).toBe(expectedPillar.jiji);
      }
    });

    it('anchor 2024-01-01 is GAP-JA', () => {
      const pillar = GanjiCycle.dayPillarByJdn(2024, 1, 1);
      expect(pillar.cheongan).toBe(Cheongan.GAP);
      expect(pillar.jiji).toBe(Jiji.JA);
    });
  });

  // =========================================================================
  // Test 4: Consecutive day invariant -- sexagenary index advances by exactly 1
  // =========================================================================

  describe('Test 4: Consecutive day invariant', () => {
    it('sexagenary index advances by exactly 1 over one year (365 days)', () => {
      for (let day = 0; day < 365; day++) {
        const [y1, m1, d1] = addDays(2024, 1, 1, day);
        const [y2, m2, d2] = addDays(2024, 1, 1, day + 1);

        const todayIndex = sexagenaryIndex(jdnOf(y1, m1, d1));
        const tomorrowIndex = sexagenaryIndex(jdnOf(y2, m2, d2));

        expect(tomorrowIndex).toBe((todayIndex + 1) % 60);
      }
    });

    it('GanjiCycle pillars advance in order over one year (365 days)', () => {
      for (let day = 0; day < 365; day++) {
        const [y1, m1, d1] = addDays(2024, 1, 1, day);
        const [y2, m2, d2] = addDays(2024, 1, 1, day + 1);

        const todayPillar = GanjiCycle.dayPillarByJdn(y1, m1, d1);
        const tomorrowPillar = GanjiCycle.dayPillarByJdn(y2, m2, d2);

        const todayStemIndex = cheonganOrdinal(todayPillar.cheongan);
        const todayBranchIndex = jijiOrdinal(todayPillar.jiji);
        const tomorrowStemIndex = cheonganOrdinal(tomorrowPillar.cheongan);
        const tomorrowBranchIndex = jijiOrdinal(tomorrowPillar.jiji);

        expect(tomorrowStemIndex).toBe((todayStemIndex + 1) % 10);
        expect(tomorrowBranchIndex).toBe((todayBranchIndex + 1) % 12);
      }
    });
  });

  // =========================================================================
  // Test 5: Year boundary edge cases
  // =========================================================================

  describe('Test 5: Year boundary edge cases', () => {
    it('2023-12-31 -> 2024-01-01 continuity', () => {
      const dec31Pillar = GanjiCycle.dayPillarByJdn(2023, 12, 31);
      const jan01Pillar = GanjiCycle.dayPillarByJdn(2024, 1, 1);

      // jan01 is GAP-JA (index 0), so dec31 must be GYE-HAE (index 59)
      expect(dec31Pillar.cheongan).toBe(Cheongan.GYE);
      expect(dec31Pillar.jiji).toBe(Jiji.HAE);
      expect(jan01Pillar.cheongan).toBe(Cheongan.GAP);
      expect(jan01Pillar.jiji).toBe(Jiji.JA);

      // Verify consecutive advancement
      const dec31Index = sexagenaryIndex(jdnOf(2023, 12, 31));
      const jan01Index = sexagenaryIndex(jdnOf(2024, 1, 1));
      expect(jan01Index).toBe((dec31Index + 1) % 60);
    });

    it.each([2000, 2010, 2020, 2024, 2025, 2030, 2050])(
      'year boundary %i-1 -> %i is continuous',
      (year) => {
        const dec31Index = sexagenaryIndex(jdnOf(year - 1, 12, 31));
        const jan01Index = sexagenaryIndex(jdnOf(year, 1, 1));
        expect(jan01Index).toBe((dec31Index + 1) % 60);
      },
    );
  });

  // =========================================================================
  // Test 6: Month boundary edge cases
  // =========================================================================

  describe('Test 6: Month boundary edge cases', () => {
    it('all 11 month boundaries in 2024 (leap year) are continuous', () => {
      for (let month = 1; month <= 11; month++) {
        // Last day of the month
        const lastDay = new Date(Date.UTC(2024, month, 0)); // day 0 of next month = last day
        const lastY = lastDay.getUTCFullYear();
        const lastM = lastDay.getUTCMonth() + 1;
        const lastD = lastDay.getUTCDate();

        // First day of next month
        const [firstY, firstM, firstD] = [2024, month + 1, 1];

        const lastIndex = sexagenaryIndex(jdnOf(lastY, lastM, lastD));
        const firstIndex = sexagenaryIndex(jdnOf(firstY, firstM, firstD));

        expect(firstIndex).toBe((lastIndex + 1) % 60);
      }
    });

    it('leap year 2024: Feb 28 -> Feb 29 -> Mar 1 continuous', () => {
      const idx28 = sexagenaryIndex(jdnOf(2024, 2, 28));
      const idx29 = sexagenaryIndex(jdnOf(2024, 2, 29));
      const idxM1 = sexagenaryIndex(jdnOf(2024, 3, 1));

      expect(idx29).toBe((idx28 + 1) % 60);
      expect(idxM1).toBe((idx29 + 1) % 60);

      // Verify specific indices from known anchor
      // feb28 is offset 58 from anchor (2024-01-01), feb29 is offset 59
      expect(idx28).toBe(58);
      expect(idx29).toBe(59);
      expect(idxM1).toBe(0);
    });

    it('non-leap year 2023: Feb 28 -> Mar 1 continuous (no Feb 29)', () => {
      const idx28 = sexagenaryIndex(jdnOf(2023, 2, 28));
      const idxM1 = sexagenaryIndex(jdnOf(2023, 3, 1));
      expect(idxM1).toBe((idx28 + 1) % 60);
    });
  });

  // =========================================================================
  // Test 7: Historical dates
  // =========================================================================

  describe('Test 7: Historical dates', () => {
    it('1900-01-01: JDN=2415021, index=10, GAP-SUL', () => {
      const jdn = jdnOf(1900, 1, 1);

      expect(jdn).toBe(2415021);

      const expectedIndex = ((2415021 + 49) % 60 + 60) % 60;
      expect(expectedIndex).toBe(10);

      const pillar = GanjiCycle.dayPillarByJdn(1900, 1, 1);
      expect(pillar.cheongan).toBe(Cheongan.GAP);
      expect(pillar.jiji).toBe(Jiji.SUL);
    });

    it('1950-06-15: JDN=2433448, index=17, SIN-SA', () => {
      const jdn = jdnOf(1950, 6, 15);
      const expectedIndex = sexagenaryIndex(jdn);

      expect(jdn).toBe(2433448);
      expect(expectedIndex).toBe(17);

      const pillar = GanjiCycle.dayPillarByJdn(1950, 6, 15);
      expect(pillar.cheongan).toBe(Cheongan.SIN);
      expect(pillar.jiji).toBe(Jiji.SA);
    });
  });

  // =========================================================================
  // Test 8: Future date
  // =========================================================================

  describe('Test 8: Future date', () => {
    it('2050-12-31 matches manual formula', () => {
      const jdn = jdnOf(2050, 12, 31);
      const expectedIndex = sexagenaryIndex(jdn);

      const pillar = GanjiCycle.dayPillarByJdn(2050, 12, 31);
      const expectedPillar = SEXAGENARY_CYCLE[expectedIndex]!;

      expect(pillar.cheongan).toBe(expectedPillar.cheongan);
      expect(pillar.jiji).toBe(expectedPillar.jiji);

      // Verify consecutive day invariant around this date
      const dec30Index = sexagenaryIndex(jdnOf(2050, 12, 30));
      expect(expectedIndex).toBe((dec30Index + 1) % 60);
    });
  });

  // =========================================================================
  // Test 9: Mathematical properties of the JDN formula
  // =========================================================================

  describe('Test 9: Mathematical properties', () => {
    it('JDN_UNIX_EPOCH constant is correct (1970-01-01 epochDay=0, JDN=2440588)', () => {
      const epochDay = toEpochDay(1970, 1, 1);
      expect(epochDay).toBe(0);
      expect(jdnOf(1970, 1, 1)).toBe(2440588);
    });

    it('sexagenary cycle has period exactly 60', () => {
      for (let offset = 0; offset < 60; offset++) {
        const [y, m, d] = addDays(2024, 1, 1, offset);
        const [y60, m60, d60] = addDays(2024, 1, 1, offset + 60);
        const [y120, m120, d120] = addDays(2024, 1, 1, offset + 120);

        const pillar = GanjiCycle.dayPillarByJdn(y, m, d);
        const pillarPlus60 = GanjiCycle.dayPillarByJdn(y60, m60, d60);
        const pillarPlus120 = GanjiCycle.dayPillarByJdn(y120, m120, d120);

        expect(pillar.equals(pillarPlus60)).toBe(true);
        expect(pillar.equals(pillarPlus120)).toBe(true);
      }
    });

    it('no sub-period: all 60 consecutive day pillars are distinct', () => {
      const allPillars = Array.from({ length: 60 }, (_, i) => {
        const [y, m, d] = addDays(2024, 1, 1, i);
        return GanjiCycle.dayPillarByJdn(y, m, d);
      });

      const uniqueLabels = new Set(allPillars.map(p => p.label));
      expect(uniqueLabels.size).toBe(60);

      // No pillar before day 60 repeats the base pillar
      const basePillar = allPillars[0]!;
      for (let offset = 1; offset < 60; offset++) {
        expect(basePillar.equals(allPillars[offset]!)).toBe(false);
      }
    });

    it('stem and branch always share the same parity', () => {
      for (let offset = 0; offset < 60; offset++) {
        const [y, m, d] = addDays(2024, 1, 1, offset);
        const pillar = GanjiCycle.dayPillarByJdn(y, m, d);

        const stemIndex = cheonganOrdinal(pillar.cheongan);
        const branchIndex = jijiOrdinal(pillar.jiji);

        expect(stemIndex % 2).toBe(branchIndex % 2);
      }
    });
  });

  // =========================================================================
  // Test 11: Specific known pillar spot-checks from mansereyok references
  // =========================================================================

  describe('Test 11: Known pillar spot-checks', () => {
    const knownPillars: { y: number; m: number; d: number; stem: Cheongan; branch: Jiji; label: string }[] = [
      { y: 2024, m: 1, d: 1,  stem: Cheongan.GAP, branch: Jiji.JA,  label: 'index 0' },
      { y: 2024, m: 1, d: 11, stem: Cheongan.GAP, branch: Jiji.SUL, label: 'index 10' },
      { y: 2024, m: 1, d: 21, stem: Cheongan.GAP, branch: Jiji.SIN, label: 'index 20' },
      { y: 2024, m: 1, d: 31, stem: Cheongan.GAP, branch: Jiji.O,   label: 'index 30' },
      { y: 2024, m: 2, d: 10, stem: Cheongan.GAP, branch: Jiji.JIN, label: 'index 40' },
      { y: 2024, m: 2, d: 20, stem: Cheongan.GAP, branch: Jiji.IN,  label: 'index 50' },
      { y: 1900, m: 1, d: 1,  stem: Cheongan.GAP, branch: Jiji.SUL, label: 'index 10 (1900)' },
    ];

    it.each(knownPillars)(
      '$y-$m-$d ($label) has correct stem and branch',
      ({ y, m, d, stem, branch }) => {
        const pillar = GanjiCycle.dayPillarByJdn(y, m, d);
        expect(pillar.cheongan).toBe(stem);
        expect(pillar.jiji).toBe(branch);
      },
    );
  });

  // =========================================================================
  // Test 12: Long-range consecutive advancement over 10 years
  // =========================================================================

  describe('Test 12: Long-range 10-year consecutive advancement', () => {
    it('no consecutive advancement violations over 3653 days (2020-2030)', () => {
      const startJdn = jdnOf(2020, 1, 1);
      const endJdn = jdnOf(2030, 1, 1);
      const totalDays = endJdn - startJdn;

      let violations = 0;
      let previousIndex = sexagenaryIndex(startJdn);

      for (let day = 1; day <= totalDays; day++) {
        const currentIndex = sexagenaryIndex(startJdn + day);
        if ((previousIndex + 1) % 60 !== currentIndex) {
          violations++;
        }
        previousIndex = currentIndex;
      }

      expect(violations).toBe(0);
    });
  });

  // =========================================================================
  // Test 13: GanjiCycle and manual formula always agree across centuries
  // =========================================================================

  describe('Test 13: GanjiCycle and manual formula agreement', () => {
    const sampleDates: [number, number, number][] = [
      [1900, 1, 1],
      [1900, 12, 31],
      [1923, 7, 15],
      [1945, 8, 15],
      [1950, 6, 25],
      [1970, 1, 1],     // Unix epoch
      [1984, 2, 4],     // GAP-JA year ipchun
      [1988, 9, 17],    // Seoul Olympics opening
      [2000, 1, 1],     // Y2K
      [2000, 2, 29],    // Leap day (century year % 400 == 0)
      [2024, 1, 1],     // Anchor date
      [2024, 2, 29],    // Leap day 2024
      [2038, 1, 19],    // Unix 32-bit overflow date
      [2050, 6, 15],
      [2050, 12, 31],
    ];

    it.each(sampleDates)(
      '%i-%i-%i: GanjiCycle matches manual formula',
      (y, m, d) => {
        const jdn = jdnOf(y, m, d);
        const manualIndex = sexagenaryIndex(jdn);
        const manualPillar = SEXAGENARY_CYCLE[manualIndex]!;

        const enginePillar = GanjiCycle.dayPillarByJdn(y, m, d);

        expect(enginePillar.cheongan).toBe(manualPillar.cheongan);
        expect(enginePillar.jiji).toBe(manualPillar.jiji);
      },
    );
  });
});
