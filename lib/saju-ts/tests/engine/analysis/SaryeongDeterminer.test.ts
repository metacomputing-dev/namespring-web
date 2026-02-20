/**
 * SaryeongDeterminer test -- 지장간 사령(司令) determination engine.
 *
 * Tests cover:
 * - Per-branch phase transitions for IN, JA, MYO, O, CHUK, YU, HAE
 * - commandingStem() simplified accessor
 * - phases() full schedule without active day
 * - All 12 branches validation at day 1 and day 30
 * - Phase transition precision for all 12 branches
 * - Overflow behavior (day > 30)
 * - Invalid input (day < 1)
 * - Reasoning text content
 * - SaryeongResult structure validation
 * - NO_RESIDUAL_EARTH variant
 */
import { describe, it, expect } from 'vitest';

import { Cheongan, CHEONGAN_INFO } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, JIJI_INFO } from '../../../src/domain/Jiji.js';
import { HiddenStemRole, HiddenStemVariant } from '../../../src/domain/HiddenStem.js';
import { SaryeongDeterminer } from '../../../src/engine/analysis/SaryeongDeterminer.js';

/** Helper to get the ROLE_ORDINAL equivalent for comparison. */
const ROLE_ORDINAL: Record<HiddenStemRole, number> = {
  [HiddenStemRole.YEOGI]: 0,
  [HiddenStemRole.JUNGGI]: 1,
  [HiddenStemRole.JEONGGI]: 2,
};

describe('SaryeongDeterminer', () => {
  // =========================================================================
  // 인월(寅) -- 3-phase: 무(7) -> 병(7) -> 갑(16)
  // =========================================================================

  describe('IN month -- 3-phase: MU(7) -> BYEONG(7) -> GAP(16)', () => {
    it('day 1 -- MU is saryeong (yeogi, first day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.IN, 1);
      expect(result.commandingStem).toBe(Cheongan.MU);
      expect(result.commandingRole).toBe(HiddenStemRole.YEOGI);
      expect(result.dayInMonth).toBe(1);
      expect(result.branch).toBe(Jiji.IN);
    });

    it('day 7 -- MU is saryeong (yeogi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.IN, 7);
      expect(result.commandingStem).toBe(Cheongan.MU);
      expect(result.commandingRole).toBe(HiddenStemRole.YEOGI);
    });

    it('day 8 -- BYEONG is saryeong (junggi, first day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.IN, 8);
      expect(result.commandingStem).toBe(Cheongan.BYEONG);
      expect(result.commandingRole).toBe(HiddenStemRole.JUNGGI);
    });

    it('day 14 -- BYEONG is saryeong (junggi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.IN, 14);
      expect(result.commandingStem).toBe(Cheongan.BYEONG);
      expect(result.commandingRole).toBe(HiddenStemRole.JUNGGI);
    });

    it('day 15 -- GAP is saryeong (jeonggi, first day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.IN, 15);
      expect(result.commandingStem).toBe(Cheongan.GAP);
      expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
    });

    it('day 30 -- GAP is saryeong (jeonggi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.IN, 30);
      expect(result.commandingStem).toBe(Cheongan.GAP);
      expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
    });
  });

  // =========================================================================
  // 자월(子) -- 2-phase: 임(10) -> 계(20)
  // =========================================================================

  describe('JA month -- 2-phase: IM(10) -> GYE(20)', () => {
    it('day 1 -- IM is saryeong (yeogi)', () => {
      const result = SaryeongDeterminer.determine(Jiji.JA, 1);
      expect(result.commandingStem).toBe(Cheongan.IM);
      expect(result.commandingRole).toBe(HiddenStemRole.YEOGI);
    });

    it('day 10 -- IM is saryeong (yeogi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.JA, 10);
      expect(result.commandingStem).toBe(Cheongan.IM);
      expect(result.commandingRole).toBe(HiddenStemRole.YEOGI);
    });

    it('day 11 -- GYE is saryeong (jeonggi, first day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.JA, 11);
      expect(result.commandingStem).toBe(Cheongan.GYE);
      expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
    });

    it('day 30 -- GYE is saryeong (jeonggi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.JA, 30);
      expect(result.commandingStem).toBe(Cheongan.GYE);
      expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
    });
  });

  // =========================================================================
  // 묘월(卯) -- 2-phase: 갑(10) -> 을(20)
  // =========================================================================

  describe('MYO month -- 2-phase: GAP(10) -> EUL(20)', () => {
    it('day 1 -- GAP is saryeong (yeogi)', () => {
      const result = SaryeongDeterminer.determine(Jiji.MYO, 1);
      expect(result.commandingStem).toBe(Cheongan.GAP);
      expect(result.commandingRole).toBe(HiddenStemRole.YEOGI);
    });

    it('day 10 -- GAP is saryeong (yeogi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.MYO, 10);
      expect(result.commandingStem).toBe(Cheongan.GAP);
      expect(result.commandingRole).toBe(HiddenStemRole.YEOGI);
    });

    it('day 11 -- EUL is saryeong (jeonggi, first day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.MYO, 11);
      expect(result.commandingStem).toBe(Cheongan.EUL);
      expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
    });
  });

  // =========================================================================
  // 오월(午) -- 3-phase: 병(10) -> 기(9) -> 정(11)
  // =========================================================================

  describe('O month -- 3-phase: BYEONG(10) -> GI(9) -> JEONG(11)', () => {
    it('day 10 -- BYEONG is saryeong (yeogi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.O, 10);
      expect(result.commandingStem).toBe(Cheongan.BYEONG);
      expect(result.commandingRole).toBe(HiddenStemRole.YEOGI);
    });

    it('day 11 -- GI is saryeong (junggi, first day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.O, 11);
      expect(result.commandingStem).toBe(Cheongan.GI);
      expect(result.commandingRole).toBe(HiddenStemRole.JUNGGI);
    });

    it('day 19 -- GI is saryeong (junggi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.O, 19);
      expect(result.commandingStem).toBe(Cheongan.GI);
      expect(result.commandingRole).toBe(HiddenStemRole.JUNGGI);
    });

    it('day 20 -- JEONG is saryeong (jeonggi, first day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.O, 20);
      expect(result.commandingStem).toBe(Cheongan.JEONG);
      expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
    });

    it('day 30 -- JEONG is saryeong (jeonggi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.O, 30);
      expect(result.commandingStem).toBe(Cheongan.JEONG);
      expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
    });
  });

  // =========================================================================
  // 축월(丑) -- 3-phase: 계(9) -> 신(3) -> 기(18)
  // =========================================================================

  describe('CHUK month -- 3-phase: GYE(9) -> SIN(3) -> GI(18)', () => {
    it('day 9 -- GYE is saryeong (yeogi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.CHUK, 9);
      expect(result.commandingStem).toBe(Cheongan.GYE);
      expect(result.commandingRole).toBe(HiddenStemRole.YEOGI);
    });

    it('day 10 -- SIN is saryeong (junggi, first day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.CHUK, 10);
      expect(result.commandingStem).toBe(Cheongan.SIN);
      expect(result.commandingRole).toBe(HiddenStemRole.JUNGGI);
    });

    it('day 12 -- SIN is saryeong (junggi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.CHUK, 12);
      expect(result.commandingStem).toBe(Cheongan.SIN);
      expect(result.commandingRole).toBe(HiddenStemRole.JUNGGI);
    });

    it('day 13 -- GI is saryeong (jeonggi, first day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.CHUK, 13);
      expect(result.commandingStem).toBe(Cheongan.GI);
      expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
    });
  });

  // =========================================================================
  // 유월(酉) -- 2-phase: 경(10) -> 신(20)
  // =========================================================================

  describe('YU month -- 2-phase: GYEONG(10) -> SIN(20)', () => {
    it('day 10 -- GYEONG is saryeong (yeogi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.YU, 10);
      expect(result.commandingStem).toBe(Cheongan.GYEONG);
      expect(result.commandingRole).toBe(HiddenStemRole.YEOGI);
    });

    it('day 11 -- SIN is saryeong (jeonggi, first day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.YU, 11);
      expect(result.commandingStem).toBe(Cheongan.SIN);
      expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
    });
  });

  // =========================================================================
  // 해월(亥) -- 3-phase: 무(7) -> 갑(7) -> 임(16)
  // =========================================================================

  describe('HAE month -- 3-phase: MU(7) -> GAP(7) -> IM(16)', () => {
    it('day 7 -- MU is saryeong (yeogi, last day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.HAE, 7);
      expect(result.commandingStem).toBe(Cheongan.MU);
      expect(result.commandingRole).toBe(HiddenStemRole.YEOGI);
    });

    it('day 8 -- GAP is saryeong (junggi, first day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.HAE, 8);
      expect(result.commandingStem).toBe(Cheongan.GAP);
      expect(result.commandingRole).toBe(HiddenStemRole.JUNGGI);
    });

    it('day 15 -- IM is saryeong (jeonggi, first day)', () => {
      const result = SaryeongDeterminer.determine(Jiji.HAE, 15);
      expect(result.commandingStem).toBe(Cheongan.IM);
      expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
    });
  });

  // =========================================================================
  // commandingStem() -- simplified accessor
  // =========================================================================

  describe('commandingStem() simplified accessor', () => {
    it('returns only the stem without full result', () => {
      expect(SaryeongDeterminer.commandingStem(Jiji.IN, 1)).toBe(Cheongan.MU);
      expect(SaryeongDeterminer.commandingStem(Jiji.IN, 8)).toBe(Cheongan.BYEONG);
      expect(SaryeongDeterminer.commandingStem(Jiji.IN, 15)).toBe(Cheongan.GAP);
    });
  });

  // =========================================================================
  // phases() -- full schedule without active day
  // =========================================================================

  describe('phases()', () => {
    it('returns correct start and end days for IN', () => {
      const phases = SaryeongDeterminer.phases(Jiji.IN);
      expect(phases.length).toBe(3);

      expect(phases[0]!.stem).toBe(Cheongan.MU);
      expect(phases[0]!.role).toBe(HiddenStemRole.YEOGI);
      expect(phases[0]!.startDay).toBe(1);
      expect(phases[0]!.endDay).toBe(7);

      expect(phases[1]!.stem).toBe(Cheongan.BYEONG);
      expect(phases[1]!.role).toBe(HiddenStemRole.JUNGGI);
      expect(phases[1]!.startDay).toBe(8);
      expect(phases[1]!.endDay).toBe(14);

      expect(phases[2]!.stem).toBe(Cheongan.GAP);
      expect(phases[2]!.role).toBe(HiddenStemRole.JEONGGI);
      expect(phases[2]!.startDay).toBe(15);
      expect(phases[2]!.endDay).toBe(30);
    });

    it('returns correct start and end days for JA', () => {
      const phases = SaryeongDeterminer.phases(Jiji.JA);
      expect(phases.length).toBe(2);

      expect(phases[0]!.stem).toBe(Cheongan.IM);
      expect(phases[0]!.startDay).toBe(1);
      expect(phases[0]!.endDay).toBe(10);

      expect(phases[1]!.stem).toBe(Cheongan.GYE);
      expect(phases[1]!.startDay).toBe(11);
      expect(phases[1]!.endDay).toBe(30);
    });

    it('has no active phase when no day is targeted', () => {
      for (const branch of JIJI_VALUES) {
        const phases = SaryeongDeterminer.phases(branch);
        expect(phases.some(p => p.isActive)).toBe(false);
      }
    });

    it('phases cover contiguous day range from 1 to 30', () => {
      for (const branch of JIJI_VALUES) {
        const phases = SaryeongDeterminer.phases(branch);

        expect(phases[0]!.startDay).toBe(1);

        for (let i = 1; i < phases.length; i++) {
          expect(phases[i]!.startDay).toBe(phases[i - 1]!.endDay + 1);
        }

        expect(phases[phases.length - 1]!.endDay).toBe(30);
      }
    });
  });

  // =========================================================================
  // All 12 branches validation
  // =========================================================================

  describe('all 12 branches validation', () => {
    it('all 12 branches return valid results at day 1', () => {
      for (const branch of JIJI_VALUES) {
        const result = SaryeongDeterminer.determine(branch, 1);
        expect(result.branch).toBe(branch);
        expect(result.dayInMonth).toBe(1);
        expect(result.commandingRole).toBe(HiddenStemRole.YEOGI);
        expect(result.allStems.length).toBeGreaterThan(0);
        expect(result.allStems.filter(p => p.isActive).length).toBe(1);
      }
    });

    it('all 12 branches return valid results at day 30', () => {
      for (const branch of JIJI_VALUES) {
        const result = SaryeongDeterminer.determine(branch, 30);
        expect(result.branch).toBe(branch);
        expect(result.dayInMonth).toBe(30);
        expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
      }
    });

    it('all 12 branches produce exactly one active phase per query', () => {
      for (const branch of JIJI_VALUES) {
        for (let day = 1; day <= 30; day++) {
          const result = SaryeongDeterminer.determine(branch, day);
          const activeCount = result.allStems.filter(p => p.isActive).length;
          expect(activeCount).toBe(1);
        }
      }
    });
  });

  // =========================================================================
  // Phase transition precision for all 12 branches
  // =========================================================================

  describe('phase transition precision for all 12 branches', () => {
    interface BranchExpectation {
      branch: Jiji;
      transitions: Array<{ range: [number, number]; stem: Cheongan }>;
    }

    const expectations: BranchExpectation[] = [
      { branch: Jiji.JA, transitions: [
        { range: [1, 10], stem: Cheongan.IM },
        { range: [11, 30], stem: Cheongan.GYE },
      ]},
      { branch: Jiji.CHUK, transitions: [
        { range: [1, 9], stem: Cheongan.GYE },
        { range: [10, 12], stem: Cheongan.SIN },
        { range: [13, 30], stem: Cheongan.GI },
      ]},
      { branch: Jiji.IN, transitions: [
        { range: [1, 7], stem: Cheongan.MU },
        { range: [8, 14], stem: Cheongan.BYEONG },
        { range: [15, 30], stem: Cheongan.GAP },
      ]},
      { branch: Jiji.MYO, transitions: [
        { range: [1, 10], stem: Cheongan.GAP },
        { range: [11, 30], stem: Cheongan.EUL },
      ]},
      { branch: Jiji.JIN, transitions: [
        { range: [1, 9], stem: Cheongan.EUL },
        { range: [10, 12], stem: Cheongan.GYE },
        { range: [13, 30], stem: Cheongan.MU },
      ]},
      { branch: Jiji.SA, transitions: [
        { range: [1, 7], stem: Cheongan.MU },
        { range: [8, 14], stem: Cheongan.GYEONG },
        { range: [15, 30], stem: Cheongan.BYEONG },
      ]},
      { branch: Jiji.O, transitions: [
        { range: [1, 10], stem: Cheongan.BYEONG },
        { range: [11, 19], stem: Cheongan.GI },
        { range: [20, 30], stem: Cheongan.JEONG },
      ]},
      { branch: Jiji.MI, transitions: [
        { range: [1, 9], stem: Cheongan.JEONG },
        { range: [10, 12], stem: Cheongan.EUL },
        { range: [13, 30], stem: Cheongan.GI },
      ]},
      { branch: Jiji.SIN, transitions: [
        { range: [1, 7], stem: Cheongan.MU },
        { range: [8, 14], stem: Cheongan.IM },
        { range: [15, 30], stem: Cheongan.GYEONG },
      ]},
      { branch: Jiji.YU, transitions: [
        { range: [1, 10], stem: Cheongan.GYEONG },
        { range: [11, 30], stem: Cheongan.SIN },
      ]},
      { branch: Jiji.SUL, transitions: [
        { range: [1, 9], stem: Cheongan.SIN },
        { range: [10, 12], stem: Cheongan.JEONG },
        { range: [13, 30], stem: Cheongan.MU },
      ]},
      { branch: Jiji.HAE, transitions: [
        { range: [1, 7], stem: Cheongan.MU },
        { range: [8, 14], stem: Cheongan.GAP },
        { range: [15, 30], stem: Cheongan.IM },
      ]},
    ];

    for (const expectation of expectations) {
      const bi = JIJI_INFO[expectation.branch];
      it(`${bi.hangul}(${bi.hanja}) phase transitions are precise`, () => {
        for (const { range: [start, end], stem: expectedStem } of expectation.transitions) {
          for (let day = start; day <= end; day++) {
            const actualStem = SaryeongDeterminer.commandingStem(expectation.branch, day);
            expect(actualStem).toBe(expectedStem);
          }
        }
      });
    }
  });

  // =========================================================================
  // Overflow
  // =========================================================================

  describe('overflow behavior', () => {
    it('day exceeding total defaults to last phase (jeonggi)', () => {
      const result = SaryeongDeterminer.determine(Jiji.IN, 31);
      expect(result.commandingStem).toBe(Cheongan.GAP);
      expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
    });

    it('day far exceeding total still returns jeonggi', () => {
      const result = SaryeongDeterminer.determine(Jiji.JA, 100);
      expect(result.commandingStem).toBe(Cheongan.GYE);
      expect(result.commandingRole).toBe(HiddenStemRole.JEONGGI);
    });
  });

  // =========================================================================
  // Invalid input
  // =========================================================================

  describe('invalid input', () => {
    it('dayInMonth of zero throws', () => {
      expect(() => SaryeongDeterminer.determine(Jiji.IN, 0)).toThrow();
    });

    it('negative dayInMonth throws', () => {
      expect(() => SaryeongDeterminer.determine(Jiji.IN, -1)).toThrow();
    });
  });

  // =========================================================================
  // Reasoning string
  // =========================================================================

  describe('reasoning', () => {
    it('reasoning is non-empty Korean text', () => {
      for (const branch of JIJI_VALUES) {
        const result = SaryeongDeterminer.determine(branch, 15);
        expect(result.reasoning.length).toBeGreaterThan(0);
        expect(result.reasoning).toContain('사령');
        expect(result.reasoning).toContain(JIJI_INFO[branch].hangul);
      }
    });

    it('reasoning for IN day 5 mentions MU and yeogi', () => {
      const result = SaryeongDeterminer.determine(Jiji.IN, 5);
      expect(result.reasoning).toContain('무');
      expect(result.reasoning).toContain('여기');
      expect(result.reasoning).toContain('인');
    });

    it('overflow reasoning mentions the overflow condition', () => {
      const result = SaryeongDeterminer.determine(Jiji.IN, 35);
      expect(result.reasoning).toContain('초과');
      expect(result.reasoning).toContain('정기');
    });
  });

  // =========================================================================
  // SaryeongResult structure validation
  // =========================================================================

  describe('result structure', () => {
    it('commandingEntry matches commanding stem and role', () => {
      for (const branch of JIJI_VALUES) {
        const result = SaryeongDeterminer.determine(branch, 1);
        expect(result.commandingEntry.stem).toBe(result.commandingStem);
        expect(result.commandingEntry.role).toBe(result.commandingRole);
      }
    });

    it('allStems phases are in role order', () => {
      for (const branch of JIJI_VALUES) {
        const result = SaryeongDeterminer.determine(branch, 15);
        const roles = result.allStems.map(p => p.role);
        for (let i = 1; i < roles.length; i++) {
          expect(ROLE_ORDINAL[roles[i]!]).toBeGreaterThanOrEqual(ROLE_ORDINAL[roles[i - 1]!]);
        }
      }
    });
  });

  // =========================================================================
  // NO_RESIDUAL_EARTH variant
  // =========================================================================

  describe('NO_RESIDUAL_EARTH variant', () => {
    it('IN starts with junggi when NO_RESIDUAL_EARTH', () => {
      const result = SaryeongDeterminer.determine(
        Jiji.IN, 1, HiddenStemVariant.NO_RESIDUAL_EARTH,
      );
      expect(result.commandingStem).toBe(Cheongan.BYEONG);
      expect(result.commandingRole).toBe(HiddenStemRole.JUNGGI);
    });

    it('IN has 2 phases with NO_RESIDUAL_EARTH', () => {
      const phases = SaryeongDeterminer.phases(Jiji.IN, HiddenStemVariant.NO_RESIDUAL_EARTH);
      expect(phases.length).toBe(2);

      expect(phases[0]!.stem).toBe(Cheongan.BYEONG);
      expect(phases[0]!.role).toBe(HiddenStemRole.JUNGGI);
      expect(phases[0]!.startDay).toBe(1);
      expect(phases[0]!.endDay).toBe(7);

      expect(phases[1]!.stem).toBe(Cheongan.GAP);
      expect(phases[1]!.role).toBe(HiddenStemRole.JEONGGI);
      expect(phases[1]!.startDay).toBe(8);
      expect(phases[1]!.endDay).toBe(23);
    });

    it('NO_RESIDUAL_EARTH does not affect non-corner branches', () => {
      const standardPhases = SaryeongDeterminer.phases(Jiji.JA, HiddenStemVariant.STANDARD);
      const noResidualPhases = SaryeongDeterminer.phases(Jiji.JA, HiddenStemVariant.NO_RESIDUAL_EARTH);

      expect(standardPhases.length).toBe(noResidualPhases.length);
      for (let i = 0; i < standardPhases.length; i++) {
        expect(standardPhases[i]!.stem).toBe(noResidualPhases[i]!.stem);
        expect(standardPhases[i]!.startDay).toBe(noResidualPhases[i]!.startDay);
        expect(standardPhases[i]!.endDay).toBe(noResidualPhases[i]!.endDay);
      }
    });

    it('all four corner branches remove yeogi with NO_RESIDUAL_EARTH', () => {
      const corners = [Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.HAE];
      for (const branch of corners) {
        const phases = SaryeongDeterminer.phases(branch, HiddenStemVariant.NO_RESIDUAL_EARTH);
        expect(phases.some(p => p.role === HiddenStemRole.YEOGI)).toBe(false);
        expect(phases[0]!.startDay).toBe(1);
      }
    });
  });
});
