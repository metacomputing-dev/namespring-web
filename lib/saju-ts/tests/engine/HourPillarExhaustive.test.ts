import { describe, it, expect } from 'vitest';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { Cheongan, CHEONGAN_VALUES, cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, jijiOrdinal } from '../../src/domain/Jiji.js';
import { Pillar } from '../../src/domain/Pillar.js';

/**
 * A-02: Exhaustive hour pillar verification test.
 *
 * Ported from HourPillarExhaustiveTest.kt.
 *
 * Verifies the correctness of hour pillar calculation across all 12
 * earthly branches and multiple day stems, ensuring that:
 *
 * 1. The hour-to-branch mapping follows the classical formula:
 *    branchIndex = floor((hour24 + 1) / 2) % 12
 *
 * 2. The hour stem cycle follows the classical day-stem-to-hour-stem rule
 *    (ojawon / Five Rat Formula):
 *    GAP/GI   -> GAP-JA start
 *    EUL/GYEONG -> BYEONG-JA start
 *    BYEONG/SIN -> MU-JA start
 *    JEONG/IM -> GYEONG-JA start
 *    MU/GYE   -> IM-JA start
 *
 * 3. Boundary hours are correctly assigned
 *
 * 4. Mathematical properties of the formula hold
 */

// =========================================================================
// Constants and helpers
// =========================================================================

/** Day stem groups with the ojawon starting stem at JA for each group. */
interface DayStemGroup {
  readonly name: string;
  readonly stems: readonly [Cheongan, Cheongan];
  readonly hourStemAtJa: Cheongan;
}

const DAY_STEM_GROUPS: readonly DayStemGroup[] = [
  { name: 'GAP/GI',       stems: [Cheongan.GAP, Cheongan.GI],       hourStemAtJa: Cheongan.GAP },
  { name: 'EUL/GYEONG',   stems: [Cheongan.EUL, Cheongan.GYEONG],   hourStemAtJa: Cheongan.BYEONG },
  { name: 'BYEONG/SIN',   stems: [Cheongan.BYEONG, Cheongan.SIN],   hourStemAtJa: Cheongan.MU },
  { name: 'JEONG/IM',     stems: [Cheongan.JEONG, Cheongan.IM],     hourStemAtJa: Cheongan.GYEONG },
  { name: 'MU/GYE',       stems: [Cheongan.MU, Cheongan.GYE],       hourStemAtJa: Cheongan.IM },
] as const;

/**
 * Computes the expected hour pillar from first principles, independent of GanjiCycle.
 *
 * Branch:  index = floor((hour24 + 1) / 2) % 12
 * Stem:    stemStart.ordinal + branchIndex, mod 10
 */
function expectedHourPillar(dayStem: Cheongan, hour24: number): Pillar {
  const branchIndex = Math.floor((hour24 + 1) / 2) % 12;
  const branch = JIJI_VALUES[branchIndex]!;

  let stemStartOrdinal: number;
  switch (dayStem) {
    case Cheongan.GAP: case Cheongan.GI:
      stemStartOrdinal = cheonganOrdinal(Cheongan.GAP); break;
    case Cheongan.EUL: case Cheongan.GYEONG:
      stemStartOrdinal = cheonganOrdinal(Cheongan.BYEONG); break;
    case Cheongan.BYEONG: case Cheongan.SIN:
      stemStartOrdinal = cheonganOrdinal(Cheongan.MU); break;
    case Cheongan.JEONG: case Cheongan.IM:
      stemStartOrdinal = cheonganOrdinal(Cheongan.GYEONG); break;
    case Cheongan.MU: case Cheongan.GYE:
      stemStartOrdinal = cheonganOrdinal(Cheongan.IM); break;
  }
  const stem = CHEONGAN_VALUES[(stemStartOrdinal + branchIndex) % 10]!;
  return new Pillar(stem, branch);
}

// =========================================================================
// Section 1: GanjiCycle.hourPillar -- unit-level exhaustive verification
// =========================================================================

describe('A-02: HourPillarExhaustive', () => {
  describe('Section 1: Hour branch mapping for all 24 hours', () => {
    const expectedBranches: [number, Jiji][] = [
      [0,  Jiji.JA],
      [1,  Jiji.CHUK],
      [2,  Jiji.CHUK],
      [3,  Jiji.IN],
      [4,  Jiji.IN],
      [5,  Jiji.MYO],
      [6,  Jiji.MYO],
      [7,  Jiji.JIN],
      [8,  Jiji.JIN],
      [9,  Jiji.SA],
      [10, Jiji.SA],
      [11, Jiji.O],
      [12, Jiji.O],
      [13, Jiji.MI],
      [14, Jiji.MI],
      [15, Jiji.SIN],
      [16, Jiji.SIN],
      [17, Jiji.YU],
      [18, Jiji.YU],
      [19, Jiji.SUL],
      [20, Jiji.SUL],
      [21, Jiji.HAE],
      [22, Jiji.HAE],
      [23, Jiji.JA],
    ];

    it.each(expectedBranches)(
      'hour %i maps to branch %s',
      (hour, expectedBranch) => {
        const pillar = GanjiCycle.hourPillar(Cheongan.GAP, hour);
        expect(pillar.jiji).toBe(expectedBranch);
      },
    );

    it('hour branch is independent of day stem', () => {
      for (let hour = 0; hour <= 23; hour++) {
        const branches = new Set(
          CHEONGAN_VALUES.map(stem => GanjiCycle.hourPillar(stem, hour).jiji),
        );
        expect(branches.size).toBe(1);
      }
    });
  });

  // =========================================================================
  // Section 2: Hour stem cycle -- all 5 day-stem groups x 12 branches
  // =========================================================================

  describe('Section 2: Hour stem cycle for all 5 groups x 12 branches', () => {
    it('hour stem cycle matches classical rule for all five groups', () => {
      for (const group of DAY_STEM_GROUPS) {
        const dayStem = group.stems[0];

        for (let hourBranchIndex = 0; hourBranchIndex <= 11; hourBranchIndex++) {
          // Map branchIndex back to a representative hour in that branch's range
          const representativeHour = hourBranchIndex === 0 ? 0 : hourBranchIndex * 2 - 1;
          const pillar = GanjiCycle.hourPillar(dayStem, representativeHour);

          const expectedStemOrdinal = (cheonganOrdinal(group.hourStemAtJa) + hourBranchIndex) % 10;
          const expectedStem = CHEONGAN_VALUES[expectedStemOrdinal]!;
          const expectedBranch = JIJI_VALUES[hourBranchIndex]!;

          expect(pillar.jiji).toBe(expectedBranch);
          expect(pillar.cheongan).toBe(expectedStem);
        }
      }
    });

    it('paired day stems produce identical hour pillars', () => {
      for (const group of DAY_STEM_GROUPS) {
        const stem1 = group.stems[0];
        const stem2 = group.stems[1];
        for (let hour = 0; hour <= 23; hour++) {
          const pillar1 = GanjiCycle.hourPillar(stem1, hour);
          const pillar2 = GanjiCycle.hourPillar(stem2, hour);
          expect(pillar1.equals(pillar2)).toBe(true);
        }
      }
    });

    it('all 60 hour pillars are distinct across five groups', () => {
      const allLabels = new Set<string>();
      for (const group of DAY_STEM_GROUPS) {
        for (let hourBranchIndex = 0; hourBranchIndex <= 11; hourBranchIndex++) {
          const hour = hourBranchIndex === 0 ? 0 : hourBranchIndex * 2 - 1;
          const pillar = GanjiCycle.hourPillar(group.stems[0], hour);
          allLabels.add(pillar.label);
        }
      }
      expect(allLabels.size).toBe(60);
    });
  });

  // =========================================================================
  // Section 3: Named hour stem spot checks (classical reference)
  // =========================================================================

  describe('Section 3: Classical JA-hour spot checks', () => {
    it('GAP day, JA hour = GAP-JA', () => {
      const p = GanjiCycle.hourPillar(Cheongan.GAP, 0);
      expect(p.cheongan).toBe(Cheongan.GAP);
      expect(p.jiji).toBe(Jiji.JA);
    });

    it('EUL day, JA hour = BYEONG-JA', () => {
      const p = GanjiCycle.hourPillar(Cheongan.EUL, 0);
      expect(p.cheongan).toBe(Cheongan.BYEONG);
      expect(p.jiji).toBe(Jiji.JA);
    });

    it('BYEONG day, JA hour = MU-JA', () => {
      const p = GanjiCycle.hourPillar(Cheongan.BYEONG, 0);
      expect(p.cheongan).toBe(Cheongan.MU);
      expect(p.jiji).toBe(Jiji.JA);
    });

    it('JEONG day, JA hour = GYEONG-JA', () => {
      const p = GanjiCycle.hourPillar(Cheongan.JEONG, 0);
      expect(p.cheongan).toBe(Cheongan.GYEONG);
      expect(p.jiji).toBe(Jiji.JA);
    });

    it('MU day, JA hour = IM-JA', () => {
      const p = GanjiCycle.hourPillar(Cheongan.MU, 0);
      expect(p.cheongan).toBe(Cheongan.IM);
      expect(p.jiji).toBe(Jiji.JA);
    });
  });

  describe('Section 3: Additional non-JA hour spot checks', () => {
    it('GAP day, MYO hour (05:00) = JEONG-MYO', () => {
      const p = GanjiCycle.hourPillar(Cheongan.GAP, 5);
      expect(p.cheongan).toBe(Cheongan.JEONG);
      expect(p.jiji).toBe(Jiji.MYO);
    });

    it('EUL day, O hour (11:00) = IM-O', () => {
      const p = GanjiCycle.hourPillar(Cheongan.EUL, 11);
      expect(p.cheongan).toBe(Cheongan.IM);
      expect(p.jiji).toBe(Jiji.O);
    });

    it('JEONG day, HAE hour (21:00) = SIN-HAE', () => {
      const p = GanjiCycle.hourPillar(Cheongan.JEONG, 21);
      expect(p.cheongan).toBe(Cheongan.SIN);
      expect(p.jiji).toBe(Jiji.HAE);
    });

    it('MU day, SIN hour (15:00) = GYEONG-SIN', () => {
      const p = GanjiCycle.hourPillar(Cheongan.MU, 15);
      expect(p.cheongan).toBe(Cheongan.GYEONG);
      expect(p.jiji).toBe(Jiji.SIN);
    });

    it('GYEONG day, SA hour (09:00) = SIN-SA', () => {
      const p = GanjiCycle.hourPillar(Cheongan.GYEONG, 9);
      expect(p.cheongan).toBe(Cheongan.SIN);
      expect(p.jiji).toBe(Jiji.SA);
    });
  });

  // =========================================================================
  // Section 4: Boundary tests -- both sides of every branch transition
  // =========================================================================

  describe('Section 4: Hour branch boundaries', () => {
    const boundaries: { beforeHour: number; beforeBranch: Jiji; afterHour: number; afterBranch: Jiji }[] = [
      { beforeHour: 0,  beforeBranch: Jiji.JA,   afterHour: 1,  afterBranch: Jiji.CHUK },
      { beforeHour: 2,  beforeBranch: Jiji.CHUK,  afterHour: 3,  afterBranch: Jiji.IN },
      { beforeHour: 4,  beforeBranch: Jiji.IN,    afterHour: 5,  afterBranch: Jiji.MYO },
      { beforeHour: 6,  beforeBranch: Jiji.MYO,   afterHour: 7,  afterBranch: Jiji.JIN },
      { beforeHour: 8,  beforeBranch: Jiji.JIN,   afterHour: 9,  afterBranch: Jiji.SA },
      { beforeHour: 10, beforeBranch: Jiji.SA,    afterHour: 11, afterBranch: Jiji.O },
      { beforeHour: 12, beforeBranch: Jiji.O,     afterHour: 13, afterBranch: Jiji.MI },
      { beforeHour: 14, beforeBranch: Jiji.MI,    afterHour: 15, afterBranch: Jiji.SIN },
      { beforeHour: 16, beforeBranch: Jiji.SIN,   afterHour: 17, afterBranch: Jiji.YU },
      { beforeHour: 18, beforeBranch: Jiji.YU,    afterHour: 19, afterBranch: Jiji.SUL },
      { beforeHour: 20, beforeBranch: Jiji.SUL,   afterHour: 21, afterBranch: Jiji.HAE },
      { beforeHour: 22, beforeBranch: Jiji.HAE,   afterHour: 23, afterBranch: Jiji.JA },
    ];

    it.each(boundaries)(
      'hour $beforeHour ($beforeBranch) -> hour $afterHour ($afterBranch)',
      ({ beforeHour, beforeBranch, afterHour, afterBranch }) => {
        const dayStem = Cheongan.GAP;
        const beforePillar = GanjiCycle.hourPillar(dayStem, beforeHour);
        const afterPillar = GanjiCycle.hourPillar(dayStem, afterHour);

        expect(beforePillar.jiji).toBe(beforeBranch);
        expect(afterPillar.jiji).toBe(afterBranch);
      },
    );
  });

  // =========================================================================
  // Section 5: Full integration -- 5 day stems x 12 hours via GanjiCycle
  // =========================================================================

  describe('Section 5: Full verification -- 5 groups x 12 branches via independent formula', () => {
    it('GanjiCycle matches independent formula for all 5 groups x 12 branches', () => {
      // Find 5 dates covering the 5 day-stem groups (stems cycle every 10 days)
      // Start from 2024-07-01 and find one date per group
      const groupRepresentatives = new Map<string, { y: number; m: number; d: number }>();

      for (let offset = 0; offset < 10; offset++) {
        const dt = new Date(Date.UTC(2024, 6, 1 + offset));
        const y = dt.getUTCFullYear();
        const m = dt.getUTCMonth() + 1;
        const d = dt.getUTCDate();
        const dayPillar = GanjiCycle.dayPillarByJdn(y, m, d);
        const group = DAY_STEM_GROUPS.find(g => g.stems.includes(dayPillar.cheongan))!;
        if (!groupRepresentatives.has(group.name)) {
          groupRepresentatives.set(group.name, { y, m, d });
        }
        if (groupRepresentatives.size === 5) break;
      }

      expect(groupRepresentatives.size).toBe(5);

      // Representative hours: one per branch (0 for JA, then odd hours for the rest)
      const representativeHours = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];

      for (const [groupName, date] of groupRepresentatives) {
        const dayPillar = GanjiCycle.dayPillarByJdn(date.y, date.m, date.d);

        for (const hour of representativeHours) {
          const actual = GanjiCycle.hourPillar(dayPillar.cheongan, hour);
          const expected = expectedHourPillar(dayPillar.cheongan, hour);

          expect(actual.cheongan).toBe(expected.cheongan);
          expect(actual.jiji).toBe(expected.jiji);
        }
      }
    });
  });

  // =========================================================================
  // Section 7: Consistency between GanjiCycle.hourPillar and formula
  // =========================================================================

  describe('Section 7: GanjiCycle.hourPillar vs independent formula consistency', () => {
    it('agrees for all 10 day stems x all 12 representative hours', () => {
      const testHours = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];

      for (const dayStem of CHEONGAN_VALUES) {
        for (const hour of testHours) {
          const unitResult = GanjiCycle.hourPillar(dayStem, hour);
          const formulaResult = expectedHourPillar(dayStem, hour);

          expect(unitResult.cheongan).toBe(formulaResult.cheongan);
          expect(unitResult.jiji).toBe(formulaResult.jiji);
        }
      }
    });
  });

  // =========================================================================
  // Section 8: Edge cases
  // =========================================================================

  describe('Section 8: Edge cases', () => {
    it('hour 0 and hour 23 both map to JA branch', () => {
      const dayStem = Cheongan.GAP;
      const h0 = GanjiCycle.hourPillar(dayStem, 0);
      const h23 = GanjiCycle.hourPillar(dayStem, 23);

      expect(h0.jiji).toBe(Jiji.JA);
      expect(h23.jiji).toBe(Jiji.JA);
      // Same day stem -> same hour pillar (both JA with same day stem)
      expect(h0.equals(h23)).toBe(true);
    });

    it('branch formula ((h+1)/2)%12 produces 12 distinct values, each appearing twice', () => {
      const indexCounts = new Map<number, number>();
      for (let h = 0; h <= 23; h++) {
        const idx = Math.floor((h + 1) / 2) % 12;
        indexCounts.set(idx, (indexCounts.get(idx) ?? 0) + 1);
      }

      expect(indexCounts.size).toBe(12);
      for (const [idx, count] of indexCounts) {
        expect(count).toBe(2);
      }
    });
  });
});
