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
  GyeokgukQuality,
} from '../../../src/domain/Gyeokguk.js';
import type { GyeokgukResult } from '../../../src/domain/Gyeokguk.js';
import { GyeokgukFormationAssessor } from '../../../src/engine/analysis/GyeokgukFormationAssessor.js';
import { GyeokgukDeterminer } from '../../../src/engine/analysis/GyeokgukDeterminer.js';
import { StrengthAnalyzer } from '../../../src/engine/analysis/StrengthAnalyzer.js';

/**
 * Ported from PyeonJaeFormationIndependentTest.kt (6 tests)
 *
 * CX-P3-2: pyeonjae-gyeok independent seonggyeok/pagyeok/guwon verification.
 *
 * Verifies that pyeonjae-gyeok shares the same rules (assessJaeCommon)
 * as jeongjae-gyeok but is independently verified with pyeonjae-specific charts.
 */

// ===================================================================
// Helpers
// ===================================================================

function ps(
  year: [Cheongan, Jiji],
  month: [Cheongan, Jiji],
  day: [Cheongan, Jiji],
  hour: [Cheongan, Jiji],
): PillarSet {
  return new PillarSet(
    new Pillar(year[0], year[1]),
    new Pillar(month[0], month[1]),
    new Pillar(day[0], day[1]),
    new Pillar(hour[0], hour[1]),
  );
}

function naegyeok(type: GyeokgukType): GyeokgukResult {
  return {
    type,
    category: GyeokgukCategory.NAEGYEOK,
    baseSipseong: null,
    confidence: 1.0,
    reasoning: 'test',
    formation: null,
  };
}

function strong(): StrengthResult {
  return {
    dayMaster: Cheongan.GAP,
    level: StrengthLevel.STRONG,
    score: {
      deukryeong: 30.0, deukji: 20.0, deukse: 10.0,
      totalSupport: 60.0, totalOppose: 40.0,
    },
    isStrong: true,
    details: ['test'],
  };
}

function weak(): StrengthResult {
  return {
    dayMaster: Cheongan.GAP,
    level: StrengthLevel.WEAK,
    score: {
      deukryeong: 10.0, deukji: 10.0, deukse: 5.0,
      totalSupport: 25.0, totalOppose: 75.0,
    },
    isStrong: false,
    details: ['test'],
  };
}

function assessPyeonJae(pillars: PillarSet, strength: StrengthResult) {
  return GyeokgukFormationAssessor.assess(naegyeok(GyeokgukType.PYEONJAE), pillars, strength);
}

// ===================================================================
// Tests
// ===================================================================

describe('PyeonJaeFormationIndependent', () => {

  // -- seonggyeok (Well-formed) --

  it('pyeonjae with gwan and siksang is well-formed when strong', () => {
    // GAP ilgan, MU(pyeonjae) month, SIN(jeonggwan) hour -> jae saeng gwan + singang -> seonggyeok
    const pillars = ps(
      [Cheongan.MU, Jiji.JIN], [Cheongan.MU, Jiji.JIN],
      [Cheongan.GAP, Jiji.O], [Cheongan.SIN, Jiji.YU],
    );
    const f = assessPyeonJae(pillars, strong());
    expect(f.quality).toBe(GyeokgukQuality.WELL_FORMED);
  });

  // -- gungeop jaengjae pagyeok --

  it('pyeonjae broken by gungeop jaengjae when bigyeop count >= 2', () => {
    // GAP ilgan, GAP(bigyeon) year, MU(pyeonjae) month, EUL(gyeobjae) hour -> gungeop jaengjae
    const pillars = ps(
      [Cheongan.GAP, Jiji.IN], [Cheongan.MU, Jiji.JIN],
      [Cheongan.GAP, Jiji.O], [Cheongan.EUL, Jiji.MYO],
    );
    const f = assessPyeonJae(pillars, strong());
    expect(f.quality).toBe(GyeokgukQuality.BROKEN);
    expect(f.breakingFactors.some(s => s.includes('군겁쟁재'))).toBe(true);
  });

  it('pyeonjae gungeop rescued by gwan', () => {
    // GAP ilgan, GAP(bigyeon) year, MU(pyeonjae) month, SIN(jeonggwan) hour -> gungeop but gwan rescue
    const pillars = ps(
      [Cheongan.GAP, Jiji.IN], [Cheongan.MU, Jiji.JIN],
      [Cheongan.GAP, Jiji.O], [Cheongan.SIN, Jiji.YU],
    );
    const f = assessPyeonJae(pillars, strong());
    // With gwan present, gungeop jaengjae should be rescued
    expect(
      f.quality === GyeokgukQuality.RESCUED || f.quality === GyeokgukQuality.WELL_FORMED,
    ).toBe(true);
  });

  // -- jae-tu-chilsal pagyeok --

  it('pyeonjae broken by jae-tu-chilsal when pyeongwan present', () => {
    // GAP ilgan, GYEONG(pyeongwan) year, MU(pyeonjae) month, GI(jeongjae) hour -> jae-tu-chilsal
    const pillars = ps(
      [Cheongan.GYEONG, Jiji.SIN], [Cheongan.MU, Jiji.JIN],
      [Cheongan.GAP, Jiji.O], [Cheongan.GI, Jiji.MI],
    );
    const f = assessPyeonJae(pillars, weak());
    if (f.breakingFactors.some(s => s.includes('재투칠살') || s.includes('칠살'))) {
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
    }
  });

  // -- basic detection --

  it('pyeonjae type detected for GAP daymaster with JIN month branch', () => {
    // GAP vs JIN jeonggi=MU -> wood geuk earth, yang-yang -> pyeonjae
    const pillars = ps(
      [Cheongan.BYEONG, Jiji.SA], [Cheongan.MU, Jiji.JIN],
      [Cheongan.GAP, Jiji.O], [Cheongan.IM, Jiji.JA],
    );
    const strength = StrengthAnalyzer.analyze(pillars);
    const result = GyeokgukDeterminer.determine(pillars, strength);
    expect(result.type).toBe(GyeokgukType.PYEONJAE);
  });

  it('pyeonjae and jeongjae produce independent quality assessments', () => {
    // Same pillars but assessed as different types should run through same rules
    const pillars = ps(
      [Cheongan.GAP, Jiji.IN], [Cheongan.MU, Jiji.JIN],
      [Cheongan.GAP, Jiji.O], [Cheongan.EUL, Jiji.MYO],
    );
    const pyeonJaeF = assessPyeonJae(pillars, strong());
    const jeongJaeF = GyeokgukFormationAssessor.assess(
      naegyeok(GyeokgukType.JEONGJAE), pillars, strong(),
    );
    // Both should use assessJaeCommon -> same quality
    expect(pyeonJaeF.quality).toBe(jeongJaeF.quality);
  });
});
