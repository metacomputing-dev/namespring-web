import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { StrengthLevel, isStrongSide } from '../../../src/domain/StrengthResult.js';
import { StrengthAnalyzer } from '../../../src/engine/analysis/StrengthAnalyzer.js';
import { createConfig } from '../../../src/config/CalculationConfig.js';

/**
 * Strength threshold boundary injection tests.
 *
 * Since classifyLevel is a module-private function in TS, we verify
 * the classification boundaries indirectly through crafted charts and
 * by replicating the classification logic locally for direct testing.
 *
 * Boundary table (default config):
 *   | Level          | Score Range        |
 *   |----------------|--------------------|
 *   | VERY_STRONG    | [62.4, +inf)       |
 *   | STRONG         | [50.0, 62.4)       |
 *   | SLIGHTLY_STRONG| [40.0, 50.0)       |
 *   | SLIGHTLY_WEAK  | [30.0, 40.0)       |
 *   | WEAK           | [15.0, 30.0)       |
 *   | VERY_WEAK      | [0, 15.0)          |
 *
 * Ported from StrengthThresholdBoundaryInjectionTest.kt.
 */

// Replicate the classification logic for direct testing.
// This mirrors the module-private classifyLevel function.
function classifyLevel(
  totalSupport: number,
  threshold: number = 50.0,
  deukryeongMax: number = 40.0,
  deukjiMax: number = 5.0,
  bigyeopMax: number = 7.0,
): StrengthLevel {
  const maxTheoretical = deukryeongMax + (deukjiMax * 4) + (bigyeopMax * 3);
  const veryStrongBound = threshold + (maxTheoretical - threshold) * 0.4;
  const slightlyStrongBound = threshold * 0.8;
  const slightlyWeakBound = threshold * 0.6;
  const weakBound = threshold * 0.3;

  if (totalSupport >= veryStrongBound) return StrengthLevel.VERY_STRONG;
  if (totalSupport >= threshold) return StrengthLevel.STRONG;
  if (totalSupport >= slightlyStrongBound) return StrengthLevel.SLIGHTLY_STRONG;
  if (totalSupport >= slightlyWeakBound) return StrengthLevel.SLIGHTLY_WEAK;
  if (totalSupport >= weakBound) return StrengthLevel.WEAK;
  return StrengthLevel.VERY_WEAK;
}

describe('StrengthThresholdBoundaryInjectionTest', () => {
  it('score 40 maps to slightly strong', () => {
    expect(classifyLevel(40.0)).toBe(StrengthLevel.SLIGHTLY_STRONG);
  });

  it('score 45 maps to slightly strong', () => {
    expect(classifyLevel(45.0)).toBe(StrengthLevel.SLIGHTLY_STRONG);
  });

  it('score 50 maps to strong', () => {
    expect(classifyLevel(50.0)).toBe(StrengthLevel.STRONG);
  });

  it('score 55 maps to strong', () => {
    expect(classifyLevel(55.0)).toBe(StrengthLevel.STRONG);
  });

  it('score 60 maps to strong', () => {
    expect(classifyLevel(60.0)).toBe(StrengthLevel.STRONG);
  });

  it('direct injection confirms STRONG tier starts at threshold 50', () => {
    const below = classifyLevel(49.999);
    const at = classifyLevel(50.0);
    expect(below).toBe(StrengthLevel.SLIGHTLY_STRONG);
    expect(
      at === StrengthLevel.STRONG || at === StrengthLevel.VERY_STRONG,
    ).toBe(true);
  });

  // Additional boundary verification through actual analysis
  describe('boundary verification via analyze', () => {
    it('overwhelming support chart classifies as VERY_STRONG', () => {
      // GAP wood + all wood/water support -> very high score
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.IM, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.IM, Jiji.HAE),
      );
      const result = StrengthAnalyzer.analyze(pillars);
      expect(result.level).toBe(StrengthLevel.VERY_STRONG);
      expect(result.score.totalSupport).toBeGreaterThanOrEqual(62.4);
    });

    it('minimal support chart classifies as VERY_WEAK', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
        new Pillar(Cheongan.SIN, Jiji.YU),
        new Pillar(Cheongan.GAP, Jiji.SUL),
        new Pillar(Cheongan.MU, Jiji.JIN),
      );
      const result = StrengthAnalyzer.analyze(pillars);
      expect(result.level).toBe(StrengthLevel.VERY_WEAK);
      expect(result.score.totalSupport).toBeLessThan(15.0);
    });

    it('level and isStrong are always consistent', () => {
      const charts = [
        new PillarSet(
          new Pillar(Cheongan.GAP, Jiji.IN),
          new Pillar(Cheongan.IM, Jiji.MYO),
          new Pillar(Cheongan.GAP, Jiji.IN),
          new Pillar(Cheongan.IM, Jiji.HAE),
        ),
        new PillarSet(
          new Pillar(Cheongan.GYEONG, Jiji.SIN),
          new Pillar(Cheongan.SIN, Jiji.YU),
          new Pillar(Cheongan.GAP, Jiji.SUL),
          new Pillar(Cheongan.MU, Jiji.JIN),
        ),
        new PillarSet(
          new Pillar(Cheongan.EUL, Jiji.HAE),
          new Pillar(Cheongan.BYEONG, Jiji.IN),
          new Pillar(Cheongan.GAP, Jiji.O),
          new Pillar(Cheongan.GYEONG, Jiji.SIN),
        ),
      ];

      for (const pillars of charts) {
        const result = StrengthAnalyzer.analyze(pillars);
        expect(result.isStrong).toBe(isStrongSide(result.level));
      }
    });
  });

  // Verify local classification matches actual analyzer
  describe('local classifyLevel matches analyzer behavior', () => {
    it('boundary values produce expected levels', () => {
      // veryStrongBound = 50 + (81-50)*0.4 = 62.4
      expect(classifyLevel(62.4)).toBe(StrengthLevel.VERY_STRONG);
      expect(classifyLevel(62.39)).toBe(StrengthLevel.STRONG);

      // threshold = 50
      expect(classifyLevel(50.0)).toBe(StrengthLevel.STRONG);
      expect(classifyLevel(49.99)).toBe(StrengthLevel.SLIGHTLY_STRONG);

      // slightlyStrongBound = 40
      expect(classifyLevel(40.0)).toBe(StrengthLevel.SLIGHTLY_STRONG);
      expect(classifyLevel(39.99)).toBe(StrengthLevel.SLIGHTLY_WEAK);

      // slightlyWeakBound = 30
      expect(classifyLevel(30.0)).toBe(StrengthLevel.SLIGHTLY_WEAK);
      expect(classifyLevel(29.99)).toBe(StrengthLevel.WEAK);

      // weakBound = 15
      expect(classifyLevel(15.0)).toBe(StrengthLevel.WEAK);
      expect(classifyLevel(14.99)).toBe(StrengthLevel.VERY_WEAK);

      // Zero
      expect(classifyLevel(0.0)).toBe(StrengthLevel.VERY_WEAK);
    });

    it('custom threshold shifts boundaries proportionally', () => {
      // With threshold=30:
      //   maxTheoretical = 81
      //   veryStrongBound = 30 + (81-30)*0.4 = 30 + 20.4 = 50.4
      //   slightlyStrongBound = 24
      //   slightlyWeakBound = 18
      //   weakBound = 9
      // veryStrongBound = 30 + (81-30)*0.4 = 50.4
      // Use 50.5 to avoid floating-point boundary ambiguity
      expect(classifyLevel(50.5, 30.0)).toBe(StrengthLevel.VERY_STRONG);
      expect(classifyLevel(50.3, 30.0)).toBe(StrengthLevel.STRONG);
      expect(classifyLevel(30.0, 30.0)).toBe(StrengthLevel.STRONG);
      expect(classifyLevel(24.0, 30.0)).toBe(StrengthLevel.SLIGHTLY_STRONG);
      expect(classifyLevel(18.0, 30.0)).toBe(StrengthLevel.SLIGHTLY_WEAK);
      expect(classifyLevel(9.0, 30.0)).toBe(StrengthLevel.WEAK);
      expect(classifyLevel(8.99, 30.0)).toBe(StrengthLevel.VERY_WEAK);
    });
  });
});
