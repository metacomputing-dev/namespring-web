import { describe, it, expect } from 'vitest';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { DaeunCalculator } from '../../src/engine/luck/DaeunCalculator.js';
import { StrengthAnalyzer } from '../../src/engine/analysis/StrengthAnalyzer.js';
import { Cheongan, CHEONGAN_VALUES, cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, jijiOrdinal } from '../../src/domain/Jiji.js';
import { Pillar } from '../../src/domain/Pillar.js';
import { PillarSet } from '../../src/domain/PillarSet.js';

/**
 * Mathematical Invariant Tests (I-01) for the Saju engine.
 *
 * Verifies fundamental mathematical properties that must hold
 * unconditionally regardless of input data. Failure of any invariant
 * indicates a structural defect in the core algorithms.
 *
 * Three invariant classes:
 *   INV-02: Ganji index <-> Pillar round-trip identity for all 60 sexagenary pairs.
 *   INV-03: Strength score bounded-range and budget conservation.
 *   INV-07: Parity constraint (stem.ordinal % 2 == branch.ordinal % 2) on all output pillars.
 *
 * Ported from MathematicalInvariantTest.kt
 */

// =========================================================================
// INV-02: Ganji Index <-> Pillar Round-Trip
// =========================================================================

describe('INV-02: Ganji Index <-> Pillar Round-Trip', () => {
  /**
   * For every sexagenary index i in [0, 59]:
   *   GanjiCycle.fromSexagenaryIndex(i) -> DaeunCalculator.sexagenaryIndex(pillar) == i
   *
   * This verifies that the forward and reverse mappings are perfect inverses.
   */
  it.each(Array.from({ length: 60 }, (_, i) => i))(
    'round-trip index %i',
    (index) => {
      const pillar = GanjiCycle.fromSexagenaryIndex(index);
      const recovered = DaeunCalculator.sexagenaryIndex(pillar);
      expect(recovered).toBe(
        index,
        `Round-trip failed: index=${index} -> pillar=${pillar.cheongan}/${pillar.jiji} -> recovered=${recovered}`,
      );
    },
  );

  it('all 60 pillars are distinct', () => {
    const pillars = Array.from({ length: 60 }, (_, i) =>
      GanjiCycle.fromSexagenaryIndex(i),
    );
    const labels = new Set(pillars.map((p) => p.label));
    expect(labels.size).toBe(60);
  });

  /**
   * Mathematical invariant: a (stem, branch) pair is valid if and only if
   * stem.ordinal and branch.ordinal share the same parity.
   *
   * Combinatorial proof: 5 even stems x 6 even branches + 5 odd stems x 6 odd branches = 60.
   * No opposite-parity pair should appear in the generated set.
   */
  it('valid pairs are exactly same-parity combinations', () => {
    const generatedLabels = new Set(
      Array.from({ length: 60 }, (_, i) =>
        GanjiCycle.fromSexagenaryIndex(i),
      ).map((p) => `${p.cheongan}|${p.jiji}`),
    );

    let sameParityCount = 0;
    let oppositeParityCount = 0;

    for (const stem of CHEONGAN_VALUES) {
      for (const branch of JIJI_VALUES) {
        const key = `${stem}|${branch}`;
        const sameParity = cheonganOrdinal(stem) % 2 === jijiOrdinal(branch) % 2;
        if (sameParity) {
          sameParityCount++;
          expect(generatedLabels.has(key)).toBe(
            true,
            `Same-parity pair ${stem}/${branch} missing from generated set`,
          );
        } else {
          oppositeParityCount++;
          expect(generatedLabels.has(key)).toBe(
            false,
            `Opposite-parity pair ${stem}/${branch} found in generated set`,
          );
        }
      }
    }

    // Combinatorial verification: 5*6 + 5*6 = 60 same-parity pairs
    expect(sameParityCount).toBe(60);
    expect(oppositeParityCount).toBe(60);
  });

  /**
   * Verify the mathematical formula underlying sexagenaryIndex:
   * For index i, stem = ordered[i % 10], branch = ordered[i % 12].
   * The reverse must satisfy: i % 10 == stem.ordinal AND i % 12 == branch.ordinal.
   *
   * This is a system of two congruences solvable by CRT (Chinese Remainder Theorem)
   * over moduli 10 and 12. Since gcd(10, 12) = 2, a solution exists iff
   * stem.ordinal === branch.ordinal (mod 2), i.e., same parity.
   * The unique solution modulo lcm(10, 12) = 60 is guaranteed.
   */
  it('sexagenary index satisfies congruence system (CRT)', () => {
    for (let i = 0; i < 60; i++) {
      const pillar = GanjiCycle.fromSexagenaryIndex(i);
      const s = cheonganOrdinal(pillar.cheongan);
      const b = jijiOrdinal(pillar.jiji);

      expect(i % 10).toBe(s);
      expect(i % 12).toBe(b);

      // CRT prerequisite: same parity
      expect(s % 2).toBe(b % 2);
    }
  });

  /**
   * Verify negative and out-of-range indices wrap correctly via mod 60.
   */
  it('out-of-range indices wrap via mod 60', () => {
    for (let i = 0; i < 60; i++) {
      const baseline = GanjiCycle.fromSexagenaryIndex(i);

      // Positive overflow
      const positive = GanjiCycle.fromSexagenaryIndex(i + 60);
      expect(baseline.equals(positive)).toBe(
        true,
        `Index ${i + 60} should wrap to same pillar as ${i}`,
      );

      const positive2 = GanjiCycle.fromSexagenaryIndex(i + 120);
      expect(baseline.equals(positive2)).toBe(
        true,
        `Index ${i + 120} should wrap to same pillar as ${i}`,
      );

      // Negative wrap
      const negative = GanjiCycle.fromSexagenaryIndex(i - 60);
      expect(baseline.equals(negative)).toBe(
        true,
        `Index ${i - 60} should wrap to same pillar as ${i}`,
      );
    }
  });
});

// =========================================================================
// INV-03: Strength Score Bounded Range
// =========================================================================

describe('INV-03: Strength Score Bounded Range', () => {
  /**
   * Default scoring budget constants (from StrengthAnalyzer):
   *   deukryeong: 0 or 40 (binary)
   *   deukji: [0, 20]  (4 branches x 5 pts each)
   *   deukse: [0, 21]  (3 stems x max(7, 5) = 7 pts each)
   *   maxBudget: 40 + 20 + 21 = 81
   *   totalSupport + totalOppose = maxBudget = 81
   */
  const DEFAULT_MAX_BUDGET = 81.0;
  const DEUKRYEONG_VALUES = new Set([0.0, 40.0]);
  const DEUKJI_MAX = 20.0;
  const DEUKSE_MAX = 21.0;

  /**
   * Generate representative birth pillar sets spanning diverse day masters
   * and month branches to exercise diverse strength scoring paths.
   */
  const strengthTestCases: Array<{
    label: string;
    year: number;
    month: number;
    day: number;
    hour: number;
  }> = [
    { label: '1960-3-15 8h', year: 1960, month: 3, day: 15, hour: 8 },
    { label: '1965-7-22 14h', year: 1965, month: 7, day: 22, hour: 14 },
    { label: '1970-1-5 2h', year: 1970, month: 1, day: 5, hour: 2 },
    { label: '1975-11-30 20h', year: 1975, month: 11, day: 30, hour: 20 },
    { label: '1980-5-10 6h', year: 1980, month: 5, day: 10, hour: 6 },
    { label: '1984-2-4 12h', year: 1984, month: 2, day: 4, hour: 12 },
    { label: '1986-8-18 16h', year: 1986, month: 8, day: 18, hour: 16 },
    { label: '1990-4-25 10h', year: 1990, month: 4, day: 25, hour: 10 },
    { label: '1992-12-1 23h', year: 1992, month: 12, day: 1, hour: 23 },
    { label: '1995-6-14 4h', year: 1995, month: 6, day: 14, hour: 4 },
    { label: '1998-9-8 18h', year: 1998, month: 9, day: 8, hour: 18 },
    { label: '2000-10-20 0h', year: 2000, month: 10, day: 20, hour: 0 },
    { label: '2003-3-3 7h', year: 2003, month: 3, day: 3, hour: 7 },
    { label: '2005-7-7 11h', year: 2005, month: 7, day: 7, hour: 11 },
    { label: '2008-1-28 15h', year: 2008, month: 1, day: 28, hour: 15 },
    { label: '2010-11-11 22h', year: 2010, month: 11, day: 11, hour: 22 },
    { label: '2012-5-5 3h', year: 2012, month: 5, day: 5, hour: 3 },
    { label: '2015-8-21 9h', year: 2015, month: 8, day: 21, hour: 9 },
    { label: '2018-2-14 13h', year: 2018, month: 2, day: 14, hour: 13 },
    { label: '2020-6-30 17h', year: 2020, month: 6, day: 30, hour: 17 },
  ];

  /** Build a PillarSet from date components using GanjiCycle approximations. */
  function buildPillars(y: number, m: number, d: number, h: number): PillarSet {
    const yearPillar = GanjiCycle.yearPillarByIpchunApprox(y, m, d);
    const monthPillar = GanjiCycle.monthPillarByJeolApprox(yearPillar.cheongan, y, m, d);
    const dayPillar = GanjiCycle.dayPillarByJdn(y, m, d);
    const hourPillar = GanjiCycle.hourPillar(dayPillar.cheongan, h);
    return new PillarSet(yearPillar, monthPillar, dayPillar, hourPillar);
  }

  it.each(strengthTestCases)(
    'strength bounds: $label',
    ({ year, month, day, hour }) => {
      const pillars = buildPillars(year, month, day, hour);
      const result = StrengthAnalyzer.analyze(pillars);
      const score = result.score;

      // INV-03a: deukryeong is binary {0, 40}
      expect(DEUKRYEONG_VALUES.has(score.deukryeong)).toBe(
        true,
        `deukryeong=${score.deukryeong} is not in {0, 40}`,
      );

      // INV-03b: deukji in [0, 20]
      expect(score.deukji).toBeGreaterThanOrEqual(0.0);
      expect(score.deukji).toBeLessThanOrEqual(DEUKJI_MAX);

      // INV-03c: deukse in [0, 21]
      expect(score.deukse).toBeGreaterThanOrEqual(0.0);
      expect(score.deukse).toBeLessThanOrEqual(DEUKSE_MAX);

      // INV-03d: totalSupport in [0, 81]
      expect(score.totalSupport).toBeGreaterThanOrEqual(0.0);
      expect(score.totalSupport).toBeLessThanOrEqual(DEFAULT_MAX_BUDGET);

      // INV-03e: totalOppose in [0, 81]
      expect(score.totalOppose).toBeGreaterThanOrEqual(0.0);
      expect(score.totalOppose).toBeLessThanOrEqual(DEFAULT_MAX_BUDGET);

      // INV-03f: Budget conservation: totalSupport + totalOppose = maxBudget
      const budgetSum = score.totalSupport + score.totalOppose;
      expect(budgetSum).toBeCloseTo(DEFAULT_MAX_BUDGET, 2);

      // INV-03g: Additive decomposition: totalSupport = deukryeong + deukji + deukse
      const decomposition = score.deukryeong + score.deukji + score.deukse;
      expect(decomposition).toBeCloseTo(score.totalSupport, 2);
    },
  );

  it('all 10 day masters are covered in test cases', () => {
    const observedDayMasters = new Set<Cheongan>();
    for (const tc of strengthTestCases) {
      const pillars = buildPillars(tc.year, tc.month, tc.day, tc.hour);
      const result = StrengthAnalyzer.analyze(pillars);
      observedDayMasters.add(result.dayMaster);
    }
    expect(observedDayMasters.size).toBe(10);
    for (const stem of CHEONGAN_VALUES) {
      expect(observedDayMasters.has(stem)).toBe(
        true,
        `Day master ${stem} not covered in test cases`,
      );
    }
  });
});

// =========================================================================
// INV-07: Parity Constraint on All Output Pillars
// =========================================================================

describe('INV-07: Parity Constraint on All Output Pillars', () => {
  /** Asserts the parity constraint: stem.ordinal % 2 == branch.ordinal % 2. */
  function assertParity(pillar: Pillar, context: string): void {
    const stemParity = cheonganOrdinal(pillar.cheongan) % 2;
    const branchParity = jijiOrdinal(pillar.jiji) % 2;
    expect(stemParity).toBe(
      branchParity,
      `Parity violation in ${context}: ${pillar.cheongan}(ordinal=${cheonganOrdinal(pillar.cheongan)}) % 2 = ${stemParity}, ` +
        `${pillar.jiji}(ordinal=${jijiOrdinal(pillar.jiji)}) % 2 = ${branchParity}`,
    );
  }

  /**
   * Exhaustive parity check on all 60 pillars produced by GanjiCycle directly.
   */
  it('GanjiCycle always produces parity-correct pillars', () => {
    for (let i = 0; i < 60; i++) {
      const pillar = GanjiCycle.fromSexagenaryIndex(i);
      assertParity(pillar, `GanjiCycle.fromSexagenaryIndex(${i})`);
    }
  });

  /**
   * Verify that day pillars for 365 consecutive days all satisfy parity.
   */
  it('day pillar parity holds for 365 consecutive days', () => {
    for (let offset = 0; offset < 365; offset++) {
      const d = new Date(Date.UTC(2024, 0, 1 + offset));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      const pillar = GanjiCycle.dayPillarByJdn(y, m, day);
      assertParity(pillar, `dayPillar for ${y}-${m}-${day}`);
    }
  });

  /**
   * Verify that hour pillars for all 24 hours x 10 day stems satisfy parity.
   * Exhaustive check of the hour pillar formula.
   */
  it('hour pillar parity exhaustive (10 stems x 24 hours)', () => {
    for (const dayStem of CHEONGAN_VALUES) {
      for (let hour = 0; hour <= 23; hour++) {
        const pillar = GanjiCycle.hourPillar(dayStem, hour);
        assertParity(pillar, `hourPillar(${dayStem}, ${hour})`);
      }
    }
  });

  /**
   * Verify that month pillars for all 10 year stems x 12 saju month indices
   * satisfy parity. Exhaustive check of the month pillar formula.
   */
  it('month pillar parity exhaustive (10 stems x 12 months)', () => {
    for (const yearStem of CHEONGAN_VALUES) {
      for (let monthIndex = 1; monthIndex <= 12; monthIndex++) {
        const pillar = GanjiCycle.monthPillarBySajuMonthIndex(yearStem, monthIndex);
        assertParity(pillar, `monthPillar(${yearStem}, monthIndex=${monthIndex})`);
      }
    }
  });

  /**
   * Diverse birth dates: verify all natal pillars satisfy parity.
   */
  const parityDates = [
    [1940, 6, 15, 3], [1950, 1, 1, 0], [1955, 8, 20, 23],
    [1960, 12, 31, 12], [1965, 4, 10, 6], [1970, 9, 5, 18],
    [1975, 2, 28, 9], [1980, 7, 4, 15], [1984, 1, 1, 0],
    [1986, 11, 22, 21], [1990, 3, 17, 4], [1992, 5, 5, 12],
    [1995, 10, 10, 8], [1997, 7, 7, 16], [2000, 2, 29, 10],
    [2003, 8, 15, 14], [2005, 12, 25, 7], [2008, 4, 1, 22],
    [2010, 6, 21, 11], [2012, 9, 30, 5], [2015, 1, 15, 19],
    [2017, 3, 8, 2], [2018, 11, 11, 13], [2020, 5, 20, 17],
    [2022, 8, 8, 1], [2024, 2, 4, 10], [2024, 7, 15, 20],
    [2025, 10, 1, 6], [2030, 4, 30, 16], [2040, 12, 12, 23],
  ] as const;

  it.each(parityDates)(
    'natal pillars satisfy parity: %i-%i-%i %ih',
    (year, month, day, hour) => {
      const yearPillar = GanjiCycle.yearPillarByIpchunApprox(year, month, day);
      const monthPillar = GanjiCycle.monthPillarByJeolApprox(yearPillar.cheongan, year, month, day);
      const dayPillar = GanjiCycle.dayPillarByJdn(year, month, day);
      const hourPillar = GanjiCycle.hourPillar(dayPillar.cheongan, hour);

      const label = `${year}-${month}-${day} ${hour}h`;
      assertParity(yearPillar, `year pillar (${label})`);
      assertParity(monthPillar, `month pillar (${label})`);
      assertParity(dayPillar, `day pillar (${label})`);
      assertParity(hourPillar, `hour pillar (${label})`);
    },
  );

  it('daeun pillars satisfy parity for representative births', () => {
    const cases = [
      { year: 1985, month: 3, day: 20, hour: 14 },
      { year: 2000, month: 7, day: 4, hour: 15 },
      { year: 1960, month: 12, day: 31, hour: 12 },
    ];

    for (const c of cases) {
      const yearPillar = GanjiCycle.yearPillarByIpchunApprox(c.year, c.month, c.day);
      const monthPillar = GanjiCycle.monthPillarByJeolApprox(
        yearPillar.cheongan, c.year, c.month, c.day,
      );
      const dayPillar = GanjiCycle.dayPillarByJdn(c.year, c.month, c.day);
      const hourPillar = GanjiCycle.hourPillar(dayPillar.cheongan, c.hour);
      const pillars = new PillarSet(yearPillar, monthPillar, dayPillar, hourPillar);

      const daeunInfo = DaeunCalculator.calculateWithStartAge(pillars, 'MALE' as any, 5, 8);
      for (const dp of daeunInfo.daeunPillars) {
        assertParity(dp.pillar, `daeun order=${dp.order} (${c.year}-${c.month}-${c.day})`);
      }
    }
  });
});
