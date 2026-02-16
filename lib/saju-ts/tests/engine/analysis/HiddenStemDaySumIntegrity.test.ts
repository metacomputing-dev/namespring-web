/**
 * ACC-4: Hidden Stem Day Sum Integrity Test.
 *
 * Exhaustively verifies that the hidden stem day allocations satisfy the
 * fundamental invariant of the 지장간(藏干) system: each earthly branch
 * partitions a 30-day period among its hidden stems without remainder.
 *
 * Tested for BOTH classical variants:
 * - 연해자평(淵海子平): the modern Korean standard
 * - 삼명통회(三命通會): the Ming dynasty encyclopedic alternative
 *
 * Structural invariants verified per branch:
 * 1. Sum of all hidden stem days equals exactly 30
 * 2. Every individual stem has days > 0 (no zero-weight stems)
 * 3. The 정기(正氣/principal stem) always has the highest day count
 *
 * Distribution pattern invariants verified against classical sources:
 * - 연해자평: 생지(7+7+16=30), 왕지(10+20=30), 고지(9+3+18=30), 午예외(10+9+11=30)
 * - 삼명통회: 생지(5+5+20=30), 왕지(7+23=30), 고지(7+5+18=30), 巳예외(7+5+18=30)
 */
import { describe, it, expect } from 'vitest';

import { Cheongan, CHEONGAN_INFO } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, JIJI_INFO } from '../../../src/domain/Jiji.js';
import {
  HiddenStemDayAllocation,
  HiddenStemRole,
  HiddenStemTable,
  HiddenStemVariant,
  type HiddenStemEntry,
} from '../../../src/domain/HiddenStem.js';

const YH = HiddenStemDayAllocation.YEONHAE_JAPYEONG;
const ST = HiddenStemDayAllocation.SAMMYEONG_TONGHOE;
const ALL_ALLOCATIONS = [YH, ST];

function stems(branch: Jiji, allocation: HiddenStemDayAllocation): readonly HiddenStemEntry[] {
  return HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, allocation);
}

describe('HiddenStem day sum integrity (ACC-4)', () => {
  // =========================================================================
  // 1. Universal invariant: day sum = 30 for ALL branches in BOTH allocations
  // =========================================================================

  describe('1. day sum = 30', () => {
    it('YEONHAE_JAPYEONG -- all 12 branches sum to exactly 30 days', () => {
      for (const branch of JIJI_VALUES) {
        const allStems = stems(branch, YH);
        const sum = allStems.reduce((acc, e) => acc + e.days, 0);
        expect(sum).toBe(30);
      }
    });

    it('SAMMYEONG_TONGHOE -- all 12 branches sum to exactly 30 days', () => {
      for (const branch of JIJI_VALUES) {
        const allStems = stems(branch, ST);
        const sum = allStems.reduce((acc, e) => acc + e.days, 0);
        expect(sum).toBe(30);
      }
    });
  });

  // =========================================================================
  // 2. Positivity invariant: every stem has days > 0
  // =========================================================================

  describe('2. positivity -- every stem has days > 0', () => {
    it('YEONHAE_JAPYEONG -- every stem has strictly positive day count', () => {
      for (const branch of JIJI_VALUES) {
        for (const entry of stems(branch, YH)) {
          expect(entry.days).toBeGreaterThan(0);
        }
      }
    });

    it('SAMMYEONG_TONGHOE -- every stem has strictly positive day count', () => {
      for (const branch of JIJI_VALUES) {
        for (const entry of stems(branch, ST)) {
          expect(entry.days).toBeGreaterThan(0);
        }
      }
    });
  });

  // =========================================================================
  // 3. Principal stem dominance: 정기 always has the most days
  // =========================================================================

  describe('3. principal stem dominance', () => {
    it('YEONHAE_JAPYEONG -- jeonggi has the highest day count', () => {
      for (const branch of JIJI_VALUES) {
        const allStems = stems(branch, YH);
        const jeonggi = allStems.find(e => e.role === HiddenStemRole.JEONGGI)!;
        const maxDays = Math.max(...allStems.map(e => e.days));
        expect(jeonggi.days).toBe(maxDays);
      }
    });

    it('SAMMYEONG_TONGHOE -- jeonggi has the highest day count', () => {
      for (const branch of JIJI_VALUES) {
        const allStems = stems(branch, ST);
        const jeonggi = allStems.find(e => e.role === HiddenStemRole.JEONGGI)!;
        const maxDays = Math.max(...allStems.map(e => e.days));
        expect(jeonggi.days).toBe(maxDays);
      }
    });
  });

  // =========================================================================
  // 4. 연해자평 -- known distribution patterns
  // =========================================================================

  describe('4. YEONHAE distribution patterns', () => {
    it('saengji (IN, SA, SIN, HAE) follow 7+7+16 pattern', () => {
      const saengji = [Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.HAE];
      for (const branch of saengji) {
        const days = stems(branch, YH).map(e => e.days);
        expect(days).toEqual([7, 7, 16]);
        expect(days.reduce((a, b) => a + b, 0)).toBe(30);
      }
    });

    it('wangji (JA, MYO, YU) follow 10+20 pattern', () => {
      const wangji = [Jiji.JA, Jiji.MYO, Jiji.YU];
      for (const branch of wangji) {
        const days = stems(branch, YH).map(e => e.days);
        expect(days).toEqual([10, 20]);
        expect(days.reduce((a, b) => a + b, 0)).toBe(30);
      }
    });

    it('O (午) exception follows 10+9+11 pattern', () => {
      const days = stems(Jiji.O, YH).map(e => e.days);
      expect(days).toEqual([10, 9, 11]);
      expect(days.reduce((a, b) => a + b, 0)).toBe(30);
    });

    it('goji (JIN, SUL, CHUK, MI) follow 9+3+18 pattern', () => {
      const goji = [Jiji.JIN, Jiji.SUL, Jiji.CHUK, Jiji.MI];
      for (const branch of goji) {
        const days = stems(branch, YH).map(e => e.days);
        expect(days).toEqual([9, 3, 18]);
        expect(days.reduce((a, b) => a + b, 0)).toBe(30);
      }
    });
  });

  // =========================================================================
  // 5. 삼명통회 -- known distribution patterns
  // =========================================================================

  describe('5. SAMMYEONG distribution patterns', () => {
    it('saengji (IN, SIN, HAE) follow 5+5+20 pattern', () => {
      const saengjiExceptSa = [Jiji.IN, Jiji.SIN, Jiji.HAE];
      for (const branch of saengjiExceptSa) {
        const days = stems(branch, ST).map(e => e.days);
        expect(days).toEqual([5, 5, 20]);
        expect(days.reduce((a, b) => a + b, 0)).toBe(30);
      }
    });

    it('wangji (JA, MYO, O, YU) follow 7+23 pattern', () => {
      const wangji = [Jiji.JA, Jiji.MYO, Jiji.O, Jiji.YU];
      for (const branch of wangji) {
        const days = stems(branch, ST).map(e => e.days);
        expect(days).toEqual([7, 23]);
        expect(days.reduce((a, b) => a + b, 0)).toBe(30);
      }
    });

    it('goji (JIN, SUL, CHUK, MI) follow 7+5+18 pattern', () => {
      const goji = [Jiji.JIN, Jiji.SUL, Jiji.CHUK, Jiji.MI];
      for (const branch of goji) {
        const days = stems(branch, ST).map(e => e.days);
        expect(days).toEqual([7, 5, 18]);
        expect(days.reduce((a, b) => a + b, 0)).toBe(30);
      }
    });

    it('SA (巳) exception follows 7+5+18 pattern (goji-like)', () => {
      const days = stems(Jiji.SA, ST).map(e => e.days);
      expect(days).toEqual([7, 5, 18]);
      expect(days.reduce((a, b) => a + b, 0)).toBe(30);
    });
  });

  // =========================================================================
  // 6. Cross-allocation integrity
  // =========================================================================

  describe('6. cross-allocation integrity', () => {
    it('all allocations x all branches -- day sum is exactly 30', () => {
      for (const allocation of ALL_ALLOCATIONS) {
        for (const branch of JIJI_VALUES) {
          const allStems = stems(branch, allocation);
          const sum = allStems.reduce((acc, e) => acc + e.days, 0);
          expect(sum).toBe(30);
        }
      }
    });

    it('all allocations x all branches -- every stem day count is positive', () => {
      for (const allocation of ALL_ALLOCATIONS) {
        for (const branch of JIJI_VALUES) {
          for (const entry of stems(branch, allocation)) {
            expect(entry.days).toBeGreaterThan(0);
          }
        }
      }
    });

    it('all allocations x all branches -- jeonggi has the maximum day count', () => {
      for (const allocation of ALL_ALLOCATIONS) {
        for (const branch of JIJI_VALUES) {
          const allStems = stems(branch, allocation);
          const jeonggi = allStems.find(e => e.role === HiddenStemRole.JEONGGI)!;
          for (const other of allStems) {
            if (other.role !== HiddenStemRole.JEONGGI) {
              expect(jeonggi.days).toBeGreaterThan(other.days);
            }
          }
        }
      }
    });
  });

  // =========================================================================
  // 7. Stem identity verification for known classical references
  // =========================================================================

  describe('7. stem identity verification', () => {
    function assertStemIdentities(
      branch: Jiji,
      allocation: HiddenStemDayAllocation,
      expectedStems: Cheongan[],
      description: string,
    ) {
      const actualStems = stems(branch, allocation).map(e => e.stem);
      expect(actualStems).toEqual(expectedStems);
    }

    it('YEONHAE -- saengji stem identities match classical reference', () => {
      assertStemIdentities(Jiji.IN, YH,
        [Cheongan.MU, Cheongan.BYEONG, Cheongan.GAP],
        '寅: 戊(여기) + 丙(중기) + 甲(정기)');
      assertStemIdentities(Jiji.SA, YH,
        [Cheongan.MU, Cheongan.GYEONG, Cheongan.BYEONG],
        '巳: 戊(여기) + 庚(중기) + 丙(정기)');
      assertStemIdentities(Jiji.SIN, YH,
        [Cheongan.MU, Cheongan.IM, Cheongan.GYEONG],
        '申: 戊(여기) + 壬(중기) + 庚(정기)');
      assertStemIdentities(Jiji.HAE, YH,
        [Cheongan.MU, Cheongan.GAP, Cheongan.IM],
        '亥: 戊(여기) + 甲(중기) + 壬(정기)');
    });

    it('SAMMYEONG -- goji stem identities show yang junggi divergence', () => {
      assertStemIdentities(Jiji.JIN, ST,
        [Cheongan.EUL, Cheongan.IM, Cheongan.MU],
        '辰: 乙(여기) + 壬(중기, 양수) + 戊(정기)');
      assertStemIdentities(Jiji.MI, ST,
        [Cheongan.JEONG, Cheongan.GAP, Cheongan.GI],
        '未: 丁(여기) + 甲(중기, 양목) + 己(정기)');
      assertStemIdentities(Jiji.SUL, ST,
        [Cheongan.SIN, Cheongan.BYEONG, Cheongan.MU],
        '戌: 辛(여기) + 丙(중기, 양화) + 戊(정기)');
      assertStemIdentities(Jiji.CHUK, ST,
        [Cheongan.GYE, Cheongan.GYEONG, Cheongan.GI],
        '丑: 癸(여기) + 庚(중기, 양금) + 己(정기)');
    });

    it('SAMMYEONG -- SIN yeogi is GI (己) not MU (戊)', () => {
      const sinStems = stems(Jiji.SIN, ST);
      const yeogi = sinStems.find(e => e.role === HiddenStemRole.YEOGI)!;
      expect(yeogi.stem).toBe(Cheongan.GI);
    });
  });
});
