import { describe, it, expect } from 'vitest';
import { Cheongan, CHEONGAN_INFO, CHEONGAN_VALUES } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../../src/domain/Jiji.js';
import { Ohaeng, OhaengRelations } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import { Sipseong, SIPSEONG_VALUES } from '../../../src/domain/Sipseong.js';
import { HiddenStemVariant } from '../../../src/domain/HiddenStem.js';
import { TenGodCalculator } from '../../../src/engine/analysis/TenGodCalculator.js';

/**
 * Ported from DefaultTenGodCalculatorTest.kt
 *
 * Tests the TenGodCalculator (십성 계산기) against reference logic,
 * verifying the full 10x10 matrix, branch calculations, pillar analysis,
 * and hidden stem variant behaviour.
 */

// ── Reference logic (independent implementation for cross-validation) ──

function expectedTenGod(dayMaster: Cheongan, target: Cheongan): Sipseong {
  const dayInfo = CHEONGAN_INFO[dayMaster];
  const targetInfo = CHEONGAN_INFO[target];
  const sameParity = dayInfo.eumyang === targetInfo.eumyang;
  const dayElement = dayInfo.ohaeng;
  const targetElement = targetInfo.ohaeng;

  if (dayElement === targetElement) {
    return sameParity ? Sipseong.BI_GYEON : Sipseong.GYEOB_JAE;
  }
  if (produces(dayElement, targetElement)) {
    return sameParity ? Sipseong.SIK_SIN : Sipseong.SANG_GWAN;
  }
  if (controls(dayElement, targetElement)) {
    return sameParity ? Sipseong.PYEON_JAE : Sipseong.JEONG_JAE;
  }
  if (controls(targetElement, dayElement)) {
    return sameParity ? Sipseong.PYEON_GWAN : Sipseong.JEONG_GWAN;
  }
  return sameParity ? Sipseong.PYEON_IN : Sipseong.JEONG_IN;
}

function produces(from: Ohaeng, to: Ohaeng): boolean {
  return OhaengRelations.generates(from) === to;
}

function controls(from: Ohaeng, to: Ohaeng): boolean {
  return OhaengRelations.controls(from) === to;
}

// ==================================================================
// Full 10x10 matrix
// ==================================================================
describe('TenGodCalculator', () => {
  describe('fullTenByTenMatrixMatchesReferenceLogic', () => {
    it('every dayMaster x target pair matches independent reference logic', () => {
      for (const dayMaster of CHEONGAN_VALUES) {
        for (const target of CHEONGAN_VALUES) {
          const expected = expectedTenGod(dayMaster, target);
          const actual = TenGodCalculator.calculate(dayMaster, target);
          expect(actual).toBe(expected);
        }
      }
    });
  });

  // ==================================================================
  // Branch ten god uses principal stem
  // ==================================================================
  describe('branchTenGodUsesPrincipalStem', () => {
    it('GAP vs HAE principal (IM) gives PYEON_IN', () => {
      // For day master GAP and branch HAE:
      // principal stem in STANDARD is IM, so GAP vs IM == PYEON_IN.
      const sipseong = TenGodCalculator.calculateForBranch(
        Cheongan.GAP, Jiji.HAE, HiddenStemVariant.STANDARD,
      );
      expect(sipseong).toBe(Sipseong.PYEON_IN);
    });
  });

  // ==================================================================
  // Pillar analysis includes hidden stem breakdown
  // ==================================================================
  describe('pillarAnalysisIncludesHiddenStemBreakdown', () => {
    it('month pillar has non-empty hidden stems and matching sipseong count', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.HAE),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.MU, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );
      const analysis = TenGodCalculator.analyzePillars(
        Cheongan.MU, pillars, HiddenStemVariant.STANDARD,
      );
      const month = analysis.byPosition[PillarPosition.MONTH]!;

      expect(Object.keys(analysis.byPosition).length).toBe(4);
      expect(month.hiddenStems.length).toBeGreaterThan(0);
      expect(month.hiddenStemSipseong.length).toBe(month.hiddenStems.length);
    });
  });

  // ==================================================================
  // All branches have principal-based ten god in both variants
  // ==================================================================
  describe('allBranchesHavePrincipalBasedTenGodInBothHiddenStemVariants', () => {
    it('every dayMaster x branch in STANDARD and NO_RESIDUAL_EARTH returns valid sipseong', () => {
      for (const dayMaster of CHEONGAN_VALUES) {
        for (const branch of JIJI_VALUES) {
          const standard = TenGodCalculator.calculateForBranch(
            dayMaster, branch, HiddenStemVariant.STANDARD,
          );
          const noResidual = TenGodCalculator.calculateForBranch(
            dayMaster, branch, HiddenStemVariant.NO_RESIDUAL_EARTH,
          );
          expect(SIPSEONG_VALUES).toContain(standard);
          expect(SIPSEONG_VALUES).toContain(noResidual);
        }
      }
    });
  });

  // ==================================================================
  // analyzePillars always returns four positions for all day masters
  // ==================================================================
  describe('analyzePillarsAlwaysReturnsFourPositionsForAllDayMasters', () => {
    it('all 10 day masters produce exactly 4 positions', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.EUL, Jiji.CHUK),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.JEONG, Jiji.MYO),
      );
      for (const dayMaster of CHEONGAN_VALUES) {
        const analysis = TenGodCalculator.analyzePillars(
          dayMaster, pillars, HiddenStemVariant.STANDARD,
        );
        const positions = Object.keys(analysis.byPosition);
        expect(positions.length).toBe(4);
        expect(analysis.byPosition[PillarPosition.YEAR]).toBeDefined();
        expect(analysis.byPosition[PillarPosition.MONTH]).toBeDefined();
        expect(analysis.byPosition[PillarPosition.DAY]).toBeDefined();
        expect(analysis.byPosition[PillarPosition.HOUR]).toBeDefined();
      }
    });
  });

  // ==================================================================
  // NO_RESIDUAL_EARTH variant changes hidden stem count
  // ==================================================================
  describe('noResidualEarthVariantChangesInBranchHiddenStemCount', () => {
    it('STANDARD has more total hidden stems than NO_RESIDUAL_EARTH for 생지 branches', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.MU, Jiji.SIN),
        new Pillar(Cheongan.GYEONG, Jiji.HAE),
      );

      const standard = TenGodCalculator.analyzePillars(
        Cheongan.GAP, pillars, HiddenStemVariant.STANDARD,
      );
      const variant = TenGodCalculator.analyzePillars(
        Cheongan.GAP, pillars, HiddenStemVariant.NO_RESIDUAL_EARTH,
      );

      const standardTotal = Object.values(standard.byPosition)
        .reduce((sum, p) => sum + (p?.hiddenStems.length ?? 0), 0);
      const variantTotal = Object.values(variant.byPosition)
        .reduce((sum, p) => sum + (p?.hiddenStems.length ?? 0), 0);

      expect(standardTotal).toBeGreaterThan(variantTotal);
    });
  });
});
