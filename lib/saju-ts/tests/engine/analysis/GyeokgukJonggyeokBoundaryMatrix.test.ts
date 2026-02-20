import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { StrengthLevel } from '../../../src/domain/StrengthResult.js';
import type { StrengthResult } from '../../../src/domain/StrengthResult.js';
import {
  GyeokgukType,
  GyeokgukCategory,
} from '../../../src/domain/Gyeokguk.js';
import { GyeokgukDeterminer } from '../../../src/engine/analysis/GyeokgukDeterminer.js';
import { createConfig } from '../../../src/config/CalculationConfig.js';
import type { CalculationConfig } from '../../../src/config/CalculationConfig.js';

/**
 * Ported from GyeokgukJonggyeokBoundaryMatrixTest.kt (2 tests)
 *
 * Tests the threshold boundary conditions for jonggyeok gating and
 * the weak-jong subtype boundary matrix.
 */

// ===================================================================
// Helpers
// ===================================================================

function strengthWithScore(dayMaster: Cheongan, totalSupport: number): StrengthResult {
  const isStrong = totalSupport >= 50.0;
  return {
    dayMaster,
    level: isStrong ? StrengthLevel.VERY_STRONG : StrengthLevel.VERY_WEAK,
    score: {
      deukryeong: totalSupport * 0.5,
      deukji: totalSupport * 0.25,
      deukse: totalSupport * 0.25,
      totalSupport,
      totalOppose: 100.0 - totalSupport,
    },
    isStrong,
    details: [`boundary-matrix score=${totalSupport}`],
  };
}

// --- Strong (jonggang) profiles (day master: GAP) ---

function jongGangQualifyingPillars(): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, Jiji.IN),
    new Pillar(Cheongan.EUL, Jiji.MYO),
    new Pillar(Cheongan.GAP, Jiji.SA),
    new Pillar(Cheongan.BYEONG, Jiji.O),
  );
}

function jongGangBigyeopThreePillars(): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, Jiji.IN),
    new Pillar(Cheongan.BYEONG, Jiji.SA),
    new Pillar(Cheongan.GAP, Jiji.SA),
    new Pillar(Cheongan.EUL, Jiji.O),
  );
}

function jongGangWithJaegwanLeakPillars(): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, Jiji.IN),
    new Pillar(Cheongan.EUL, Jiji.MYO),
    new Pillar(Cheongan.GAP, Jiji.JIN),
    new Pillar(Cheongan.BYEONG, Jiji.SA),
  );
}

// --- Weak (jongyak) profiles (day master: IM) ---

function jongSalQualifyingPillars(): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.MU, Jiji.JIN),
    new Pillar(Cheongan.MU, Jiji.SUL),
    new Pillar(Cheongan.IM, Jiji.JIN),
    new Pillar(Cheongan.GI, Jiji.CHUK),
  );
}

function jongAThreeVsTwoTwoPillars(): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, Jiji.IN),
    new Pillar(Cheongan.MU, Jiji.MYO),
    new Pillar(Cheongan.IM, Jiji.JIN),
    new Pillar(Cheongan.BYEONG, Jiji.SA),
  );
}

function jongJaeThreeVsTwoTwoPillars(): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.BYEONG, Jiji.SA),
    new Pillar(Cheongan.MU, Jiji.O),
    new Pillar(Cheongan.IM, Jiji.JIN),
    new Pillar(Cheongan.GAP, Jiji.IN),
  );
}

function tieThreeThreeOnePillars(): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, Jiji.IN),
    new Pillar(Cheongan.BYEONG, Jiji.SA),
    new Pillar(Cheongan.IM, Jiji.MYO),
    new Pillar(Cheongan.MU, Jiji.O),
  );
}

function weakWithSelfSupportPillars(): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, Jiji.IN),
    new Pillar(Cheongan.BYEONG, Jiji.SA),
    new Pillar(Cheongan.IM, Jiji.YU),
    new Pillar(Cheongan.GYEONG, Jiji.O),
  );
}

function jongSalWithSelfSupportPillars(): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.MU, Jiji.JIN),
    new Pillar(Cheongan.GYEONG, Jiji.YU),
    new Pillar(Cheongan.IM, Jiji.JIN),
    new Pillar(Cheongan.GI, Jiji.CHUK),
  );
}

function jongSalWithSiksangLeakPillars(): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.MU, Jiji.JIN),
    new Pillar(Cheongan.GAP, Jiji.IN),
    new Pillar(Cheongan.IM, Jiji.SUL),
    new Pillar(Cheongan.BYEONG, Jiji.SA),
  );
}

// ===================================================================
// Tests
// ===================================================================

describe('GyeokgukJonggyeokBoundaryMatrix', () => {

  it('threshold boundary matrix for jonggyeok gating', () => {
    interface Case {
      name: string;
      pillars: PillarSet;
      score: number;
      config: CalculationConfig;
      expectedCategory: GyeokgukCategory | null;
      expectedType?: GyeokgukType;
    }

    const strongPillars = jongGangQualifyingPillars();
    const weakPillars = jongSalQualifyingPillars();

    const cases: Case[] = [
      {
        name: 'strong-below-threshold',
        pillars: strongPillars,
        score: 79.9,
        config: createConfig({ jonggyeokStrongThreshold: 80.0, jonggyeokWeakThreshold: 15.0 }),
        expectedCategory: null,
      },
      {
        name: 'strong-at-threshold',
        pillars: strongPillars,
        score: 80.0,
        config: createConfig({ jonggyeokStrongThreshold: 80.0, jonggyeokWeakThreshold: 15.0 }),
        expectedCategory: GyeokgukCategory.JONGGYEOK,
        expectedType: GyeokgukType.JONGGANG,
      },
      {
        name: 'strong-above-threshold',
        pillars: strongPillars,
        score: 80.1,
        config: createConfig({ jonggyeokStrongThreshold: 80.0, jonggyeokWeakThreshold: 15.0 }),
        expectedCategory: GyeokgukCategory.JONGGYEOK,
        expectedType: GyeokgukType.JONGGANG,
      },
      {
        name: 'weak-above-threshold',
        pillars: weakPillars,
        score: 10.1,
        config: createConfig({ jonggyeokStrongThreshold: 62.4, jonggyeokWeakThreshold: 10.0 }),
        expectedCategory: null,
      },
      {
        name: 'weak-at-threshold',
        pillars: weakPillars,
        score: 10.0,
        config: createConfig({ jonggyeokStrongThreshold: 62.4, jonggyeokWeakThreshold: 10.0 }),
        expectedCategory: GyeokgukCategory.JONGGYEOK,
        expectedType: GyeokgukType.JONGSAL,
      },
      {
        name: 'weak-below-threshold',
        pillars: weakPillars,
        score: 9.9,
        config: createConfig({ jonggyeokStrongThreshold: 62.4, jonggyeokWeakThreshold: 10.0 }),
        expectedCategory: GyeokgukCategory.JONGGYEOK,
        expectedType: GyeokgukType.JONGSAL,
      },
    ];

    for (const c of cases) {
      const result = GyeokgukDeterminer.determine(
        c.pillars,
        strengthWithScore(c.pillars.day.cheongan, c.score),
        [],
        c.config,
      );

      if (c.expectedCategory == null) {
        expect(result.category, `case=${c.name}: expected jonggyeok gate to stay closed`)
          .not.toBe(GyeokgukCategory.JONGGYEOK);
      } else {
        expect(result.category, `case=${c.name}`).toBe(c.expectedCategory);
        if (c.expectedType != null) {
          expect(result.type, `case=${c.name}`).toBe(c.expectedType);
        }
      }
    }
  });

  it('weak jong subtype boundary matrix', () => {
    interface SubtypeCase {
      name: string;
      pillars: PillarSet;
      expectedType: GyeokgukType | null;
    }

    const cases: SubtypeCase[] = [
      {
        name: 'jonggang-qualifies-when-bigyeop-at-least-4-and-jaegwan-zero',
        pillars: jongGangQualifyingPillars(),
        expectedType: GyeokgukType.JONGGANG,
      },
      {
        name: 'jonggang-blocked-when-bigyeop-below-4',
        pillars: jongGangBigyeopThreePillars(),
        expectedType: null,
      },
      {
        name: 'jonggang-blocked-when-jaegwan-nonzero',
        pillars: jongGangWithJaegwanLeakPillars(),
        expectedType: null,
      },
      {
        name: 'jonga-min-boundary-three-vs-two-vs-two',
        pillars: jongAThreeVsTwoTwoPillars(),
        expectedType: GyeokgukType.JONGA,
      },
      {
        name: 'jonga-blocked-when-tied-with-jae',
        pillars: tieThreeThreeOnePillars(),
        expectedType: GyeokgukType.JONGSE,
      },
      {
        name: 'jongjae-min-boundary-three-vs-two-vs-two',
        pillars: jongJaeThreeVsTwoTwoPillars(),
        expectedType: GyeokgukType.JONGJAE,
      },
      {
        name: 'jongjae-blocked-when-tied-with-siksang',
        pillars: tieThreeThreeOnePillars(),
        expectedType: GyeokgukType.JONGSE,
      },
      {
        name: 'jongse-selected-on-balanced-opposition',
        pillars: tieThreeThreeOnePillars(),
        expectedType: GyeokgukType.JONGSE,
      },
      {
        name: 'weak-jong-disabled-when-self-support-present',
        pillars: weakWithSelfSupportPillars(),
        expectedType: null,
      },
      {
        name: 'jongsal-qualifies-on-extreme-gwan-dominance',
        pillars: jongSalQualifyingPillars(),
        expectedType: GyeokgukType.JONGSAL,
      },
      {
        name: 'jongsal-blocked-when-self-support-present',
        pillars: jongSalWithSelfSupportPillars(),
        expectedType: null,
      },
      {
        name: 'jongsal-blocked-when-siksang-present',
        pillars: jongSalWithSiksangLeakPillars(),
        expectedType: GyeokgukType.JONGSE,
      },
    ];

    for (const c of cases) {
      const isStrongCandidate = c.name.startsWith('jonggang');
      const score = isStrongCandidate ? 80.0 : 0.0;
      const result = GyeokgukDeterminer.determine(
        c.pillars,
        strengthWithScore(c.pillars.day.cheongan, score),
      );

      if (c.expectedType == null) {
        expect(result.category, `case=${c.name}: expected non-jonggyeok`)
          .not.toBe(GyeokgukCategory.JONGGYEOK);
      } else {
        expect(result.category, `case=${c.name}`).toBe(GyeokgukCategory.JONGGYEOK);
        expect(result.type, `case=${c.name}`).toBe(c.expectedType);
      }
    }
  });
});
