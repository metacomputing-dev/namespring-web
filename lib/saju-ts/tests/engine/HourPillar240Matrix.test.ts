import { describe, it, expect } from 'vitest';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { Cheongan, CHEONGAN_VALUES, cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, jijiOrdinal } from '../../src/domain/Jiji.js';
import { Pillar } from '../../src/domain/Pillar.js';

/**
 * P-04: Hour pillar 240 combination exhaustive matrix (24 hours x 10 day stems).
 *
 * Ported from HourPillar240MatrixTest.kt.
 *
 * Verifies every one of the 240 (dayStem, hour24) combinations against the
 * closed-form formula:
 *
 *   Branch index:  floor((hour24 + 1) / 2) % 12
 *   Stem:          ojawonStart(dayStem).ordinal + branchIndex, mod 10
 *
 * The ojawon mapping:
 *   GAP/GI     -> GAP      EUL/GYEONG -> BYEONG
 *   BYEONG/SIN -> MU       JEONG/IM   -> GYEONG
 *   MU/GYE     -> IM
 *
 * In addition to the full matrix, the suite includes:
 *   - Cross-validation: two consecutive hours in the same branch produce the same pillar
 *   - Transition validation: odd-hour boundaries show branch changes
 *   - Full cycle verification: each day stem yields 12 distinct hour pillars
 *   - Mathematical property: contiguous cycle of 12 within the 60-pillar cycle
 *   - Paired day stem redundancy: both stems in a group yield identical results
 *   - Oracle self-consistency checks
 */

// =========================================================================
// Reference oracle: independent formula (no dependency on GanjiCycle)
// =========================================================================

/**
 * The ojawon starting stem at JA for each of the 10 day stems.
 * Indexed by cheonganOrdinal.
 */
const OJAWON_START: readonly Cheongan[] = [
  Cheongan.GAP,     // GAP(0)
  Cheongan.BYEONG,  // EUL(1)
  Cheongan.MU,      // BYEONG(2)
  Cheongan.GYEONG,  // JEONG(3)
  Cheongan.IM,      // MU(4)
  Cheongan.GAP,     // GI(5)
  Cheongan.BYEONG,  // GYEONG(6)
  Cheongan.MU,      // SIN(7)
  Cheongan.GYEONG,  // IM(8)
  Cheongan.IM,      // GYE(9)
] as const;

/** Oracle branch index from hour. */
function branchIndex(hour24: number): number {
  return Math.floor((hour24 + 1) / 2) % 12;
}

/** Oracle: expected pillar for a given day stem and hour. */
function oracle(dayStem: Cheongan, hour24: number): Pillar {
  const bi = branchIndex(hour24);
  const branch = JIJI_VALUES[bi]!;
  const stemStart = OJAWON_START[cheonganOrdinal(dayStem)]!;
  const stem = CHEONGAN_VALUES[(cheonganOrdinal(stemStart) + bi) % 10]!;
  return new Pillar(stem, branch);
}

/**
 * Computes the unique sexagenary index i in [0,59] for a (stem, branch) pair
 * by iterating 0..59 and checking the congruences:
 *   i % 10 === stem.ordinal
 *   i % 12 === branch.ordinal
 */
function sexagenaryIndex(pillar: Pillar): number {
  const s = cheonganOrdinal(pillar.cheongan);
  const b = jijiOrdinal(pillar.jiji);
  for (let i = 0; i < 60; i++) {
    if (i % 10 === s && i % 12 === b) return i;
  }
  throw new Error(`No sexagenary index for ${pillar.label}`);
}

/** Greatest common divisor. */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** All 12 transition boundaries: (evenHour, nextOddHour). */
const TRANSITION_BOUNDARIES: readonly [number, number][] = [
  [0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11],
  [12, 13], [14, 15], [16, 17], [18, 19], [20, 21], [22, 23],
] as const;

/**
 * Same-block pairs: two consecutive hours that share a branch.
 * Pair (23, 0) is special: both map to JA.
 */
const SAME_BLOCK_PAIRS: readonly [number, number][] = [
  [23, 0],   // both JA
  [1, 2],    // both CHUK
  [3, 4],    // both IN
  [5, 6],    // both MYO
  [7, 8],    // both JIN
  [9, 10],   // both SA
  [11, 12],  // both O
  [13, 14],  // both MI
  [15, 16],  // both SIN
  [17, 18],  // both YU
  [19, 20],  // both SUL
  [21, 22],  // both HAE
] as const;

/** One representative hour per branch for 12-branch sampling. */
const REPRESENTATIVE_HOURS = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21] as const;

/** One stem per group for 5-group sampling. */
const GROUP_REP_STEMS: readonly Cheongan[] = [
  Cheongan.GAP,     // GAP/GI
  Cheongan.EUL,     // EUL/GYEONG
  Cheongan.BYEONG,  // BYEONG/SIN
  Cheongan.JEONG,   // JEONG/IM
  Cheongan.MU,      // MU/GYE
] as const;

/** Paired stems in each ojawon group. */
const PAIRED_STEMS: readonly [Cheongan, Cheongan][] = [
  [Cheongan.GAP, Cheongan.GI],
  [Cheongan.EUL, Cheongan.GYEONG],
  [Cheongan.BYEONG, Cheongan.SIN],
  [Cheongan.JEONG, Cheongan.IM],
  [Cheongan.MU, Cheongan.GYE],
] as const;

// =========================================================================
// Tests
// =========================================================================

describe('P-04: HourPillar240Matrix', () => {

  // =========================================================================
  // 1. Full 240-combination matrix
  // =========================================================================

  describe('1. Full 240-combination matrix verification', () => {
    // Generate all 240 test cases
    const allCases: { dayStemLabel: string; dayStem: Cheongan; hour: number }[] = [];
    for (const dayStem of CHEONGAN_VALUES) {
      for (let h = 0; h < 24; h++) {
        allCases.push({
          dayStemLabel: dayStem,
          dayStem,
          hour: h,
        });
      }
    }

    it.each(allCases)(
      '$dayStemLabel h=$hour matches oracle',
      ({ dayStem, hour }) => {
        const expected = oracle(dayStem, hour);
        const actual = GanjiCycle.hourPillar(dayStem, hour);

        expect(actual.cheongan).toBe(expected.cheongan);
        expect(actual.jiji).toBe(expected.jiji);
      },
    );
  });

  // =========================================================================
  // 2. Same-block cross-validation: two hours in same branch produce same pillar
  // =========================================================================

  describe('2. Same-block same-pillar cross-validation', () => {
    it('two hours in the same branch produce identical pillars for all day stems', () => {
      for (const dayStem of CHEONGAN_VALUES) {
        for (const [h1, h2] of SAME_BLOCK_PAIRS) {
          const p1 = GanjiCycle.hourPillar(dayStem, h1);
          const p2 = GanjiCycle.hourPillar(dayStem, h2);
          expect(p1.equals(p2)).toBe(true);
        }
      }
    });
  });

  // =========================================================================
  // 3. Transition validation: branch changes at every odd-hour boundary
  // =========================================================================

  describe('3. Transition validation', () => {
    it('branch changes at every odd-hour boundary for all day stems', () => {
      for (const dayStem of CHEONGAN_VALUES) {
        for (const [evenHour, oddHour] of TRANSITION_BOUNDARIES) {
          const pBefore = GanjiCycle.hourPillar(dayStem, evenHour);
          const pAfter = GanjiCycle.hourPillar(dayStem, oddHour);
          expect(pBefore.jiji).not.toBe(pAfter.jiji);
        }
      }
    });

    it('branch advances by exactly one at each transition', () => {
      const dayStem = Cheongan.GAP; // branch is independent of day stem
      for (const [evenHour, oddHour] of TRANSITION_BOUNDARIES) {
        const biBefore = branchIndex(evenHour);
        const biAfter = branchIndex(oddHour);
        expect(biAfter).toBe((biBefore + 1) % 12);
      }
    });

    it('HAE->JA transition (hour 22->23) wraps correctly for all day stems', () => {
      for (const dayStem of CHEONGAN_VALUES) {
        const atHae = GanjiCycle.hourPillar(dayStem, 22);
        const atJa = GanjiCycle.hourPillar(dayStem, 23);
        expect(atHae.jiji).toBe(Jiji.HAE);
        expect(atJa.jiji).toBe(Jiji.JA);
      }
    });
  });

  // =========================================================================
  // 4. Full cycle: each day stem yields 12 distinct hour pillars
  // =========================================================================

  describe('4. Full cycle verification', () => {
    it('each day stem yields 12 distinct hour pillars', () => {
      for (const dayStem of CHEONGAN_VALUES) {
        const labels = new Set(
          REPRESENTATIVE_HOURS.map(h => GanjiCycle.hourPillar(dayStem, h).label),
        );
        expect(labels.size).toBe(12);
      }
    });

    it('twelve pillars cover all twelve branches for each day stem', () => {
      const allBranches = new Set(JIJI_VALUES);

      for (const dayStem of CHEONGAN_VALUES) {
        const branches = new Set(
          REPRESENTATIVE_HOURS.map(h => GanjiCycle.hourPillar(dayStem, h).jiji),
        );
        expect(branches).toEqual(allBranches);
      }
    });

    it('5 groups x 12 branches = full 60-pillar sexagenary cycle', () => {
      const allLabels = new Set<string>();
      for (const dayStem of GROUP_REP_STEMS) {
        for (const hour of REPRESENTATIVE_HOURS) {
          allLabels.add(GanjiCycle.hourPillar(dayStem, hour).label);
        }
      }
      expect(allLabels.size).toBe(60);
    });
  });

  // =========================================================================
  // 5. Mathematical property: contiguous cycle of 12 within 60
  // =========================================================================

  describe('5. Mathematical properties', () => {
    it('twelve hour pillars form contiguous sexagenary cycle segment', () => {
      for (const dayStem of CHEONGAN_VALUES) {
        const indices = Array.from({ length: 12 }, (_, bi) => {
          const hour = bi === 0 ? 0 : bi * 2 - 1;
          const pillar = GanjiCycle.hourPillar(dayStem, hour);
          return sexagenaryIndex(pillar);
        });

        // Check that consecutive indices differ by exactly 1 (mod 60)
        for (let k = 0; k < 11; k++) {
          const diff = (indices[k + 1]! - indices[k]! + 60) % 60;
          expect(diff).toBe(1);
        }
      }
    });

    it('paired day stems share same sexagenary start index at JA', () => {
      for (const [s1, s2] of PAIRED_STEMS) {
        const p1 = GanjiCycle.hourPillar(s1, 0);
        const p2 = GanjiCycle.hourPillar(s2, 0);
        expect(sexagenaryIndex(p1)).toBe(sexagenaryIndex(p2));
      }
    });

    it('five group start indices are multiples of 12: {0, 12, 24, 36, 48}', () => {
      const startIndices = new Set(
        GROUP_REP_STEMS.map(stem => sexagenaryIndex(GanjiCycle.hourPillar(stem, 0))),
      );
      expect(startIndices).toEqual(new Set([0, 12, 24, 36, 48]));
    });

    it('gcd(10,12)=2 and lcm(10,12)=60', () => {
      const g = gcd(10, 12);
      expect(g).toBe(2);
      const lcm = (10 * 12) / g;
      expect(lcm).toBe(60);
    });
  });

  // =========================================================================
  // 6. Paired day stems produce identical results (redundancy check)
  // =========================================================================

  describe('6. Paired day stem redundancy', () => {
    it('paired day stems yield identical pillars for all 24 hours (5 x 24 = 120 checks)', () => {
      for (const [s1, s2] of PAIRED_STEMS) {
        for (let h = 0; h < 24; h++) {
          const p1 = GanjiCycle.hourPillar(s1, h);
          const p2 = GanjiCycle.hourPillar(s2, h);
          expect(p1.equals(p2)).toBe(true);
        }
      }
    });
  });

  // =========================================================================
  // 7. Oracle self-consistency check
  // =========================================================================

  describe('7. Oracle self-consistency', () => {
    it('oracle matches classical spot-check values', () => {
      // GAP day, JA = GAP-JA
      expect(oracle(Cheongan.GAP, 0).cheongan).toBe(Cheongan.GAP);
      expect(oracle(Cheongan.GAP, 0).jiji).toBe(Jiji.JA);

      // EUL day, JA = BYEONG-JA
      expect(oracle(Cheongan.EUL, 0).cheongan).toBe(Cheongan.BYEONG);
      expect(oracle(Cheongan.EUL, 0).jiji).toBe(Jiji.JA);

      // BYEONG day, JA = MU-JA
      expect(oracle(Cheongan.BYEONG, 0).cheongan).toBe(Cheongan.MU);
      expect(oracle(Cheongan.BYEONG, 0).jiji).toBe(Jiji.JA);

      // JEONG day, JA = GYEONG-JA
      expect(oracle(Cheongan.JEONG, 0).cheongan).toBe(Cheongan.GYEONG);
      expect(oracle(Cheongan.JEONG, 0).jiji).toBe(Jiji.JA);

      // MU day, JA = IM-JA
      expect(oracle(Cheongan.MU, 0).cheongan).toBe(Cheongan.IM);
      expect(oracle(Cheongan.MU, 0).jiji).toBe(Jiji.JA);

      // GAP day, MYO (h=5) = JEONG-MYO
      expect(oracle(Cheongan.GAP, 5).cheongan).toBe(Cheongan.JEONG);
      expect(oracle(Cheongan.GAP, 5).jiji).toBe(Jiji.MYO);

      // EUL day, O (h=11) = IM-O
      expect(oracle(Cheongan.EUL, 11).cheongan).toBe(Cheongan.IM);
      expect(oracle(Cheongan.EUL, 11).jiji).toBe(Jiji.O);

      // JEONG day, HAE (h=21) = SIN-HAE
      expect(oracle(Cheongan.JEONG, 21).cheongan).toBe(Cheongan.SIN);
      expect(oracle(Cheongan.JEONG, 21).jiji).toBe(Jiji.HAE);

      // MU day, SIN (h=15) = GYEONG-SIN
      expect(oracle(Cheongan.MU, 15).cheongan).toBe(Cheongan.GYEONG);
      expect(oracle(Cheongan.MU, 15).jiji).toBe(Jiji.SIN);

      // GYEONG day, SA (h=9) = SIN-SA
      expect(oracle(Cheongan.GYEONG, 9).cheongan).toBe(Cheongan.SIN);
      expect(oracle(Cheongan.GYEONG, 9).jiji).toBe(Jiji.SA);
    });
  });

  // =========================================================================
  // 8. Coverage summary assertion
  // =========================================================================

  describe('8. Coverage summary', () => {
    it('total combination count is 240', () => {
      let count = 0;
      for (const dayStem of CHEONGAN_VALUES) {
        for (let h = 0; h < 24; h++) {
          const actual = GanjiCycle.hourPillar(dayStem, h);
          const expected = oracle(dayStem, h);
          expect(actual.cheongan).toBe(expected.cheongan);
          expect(actual.jiji).toBe(expected.jiji);
          count++;
        }
      }
      expect(count).toBe(240);
    });
  });
});
