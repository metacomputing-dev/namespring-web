import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import { Sipseong, SIPSEONG_VALUES } from '../../../src/domain/Sipseong.js';
import { HapState } from '../../../src/domain/Relations.js';
import type { HapHwaEvaluation } from '../../../src/domain/Relations.js';
import { StrengthLevel } from '../../../src/domain/StrengthResult.js';
import type { StrengthResult, StrengthScore } from '../../../src/domain/StrengthResult.js';
import {
  GyeokgukType,
  GyeokgukCategory,
  gyeokgukFromSipseong,
} from '../../../src/domain/Gyeokguk.js';
import { GyeokgukDeterminer } from '../../../src/engine/analysis/GyeokgukDeterminer.js';
import { DEFAULT_CONFIG, createConfig, configFromPreset, SchoolPreset } from '../../../src/config/CalculationConfig.js';
import type { CalculationConfig } from '../../../src/config/CalculationConfig.js';

/**
 * Ported from GyeokgukDeterminerTest.kt
 *
 * Tests the GyeokgukDeterminer (격국 판별기) -- a 4-phase detection pipeline
 * for determining the fundamental structural pattern of a saju chart.
 */

// ── Test helpers ────────────────────────────────────────────────

/**
 * Creates a PillarSet with the given day master and month branch.
 * Year, day branch, and hour are filled with 정(丁/JEONG) stems which
 * do not accidentally 투출-match non-정기 hidden stems of any of the
 * 10 standard test branches (인~해).
 */
function pillarsWithMonthBranch(dayMaster: Cheongan, monthBranch: Jiji): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.JEONG, Jiji.JA),
    new Pillar(Cheongan.JEONG, monthBranch),
    new Pillar(dayMaster, Jiji.O),
    new Pillar(Cheongan.JEONG, Jiji.SIN),
  );
}

function veryStrongStrength(dayMaster: Cheongan): StrengthResult {
  return {
    dayMaster,
    level: StrengthLevel.VERY_STRONG,
    score: { deukryeong: 40.0, deukji: 20.0, deukse: 20.0, totalSupport: 80.0, totalOppose: 20.0 },
    isStrong: true,
    details: ['극신강 판단'],
  };
}

function veryWeakStrength(dayMaster: Cheongan): StrengthResult {
  return {
    dayMaster,
    level: StrengthLevel.VERY_WEAK,
    score: { deukryeong: 0.0, deukji: 0.0, deukse: 0.0, totalSupport: 0.0, totalOppose: 100.0 },
    isStrong: false,
    details: ['극신약 판단'],
  };
}

function strengthWithScore(
  dayMaster: Cheongan,
  totalSupport: number,
  isStrong: boolean,
): StrengthResult {
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
    details: [`테스트용 점수 ${totalSupport}`],
  };
}

function makeHapHwa(
  ohaeng: Ohaeng,
  state: HapState,
  confidence: number = 0.80,
): HapHwaEvaluation {
  return {
    stem1: Cheongan.GAP,
    stem2: Cheongan.GI,
    position1: PillarPosition.YEAR,
    position2: PillarPosition.MONTH,
    resultOhaeng: ohaeng,
    state,
    confidence,
    conditionsMet: ['테스트'],
    conditionsFailed: [],
    reasoning: '테스트용 합화 평가',
    dayMasterInvolved: false,
  };
}

function hapHwaAt(
  stem1: Cheongan, pos1: PillarPosition,
  stem2: Cheongan, pos2: PillarPosition,
  state: HapState, resultOhaeng: Ohaeng,
): HapHwaEvaluation {
  return {
    stem1, stem2,
    position1: pos1, position2: pos2,
    resultOhaeng,
    state,
    confidence: 0.80,
    conditionsMet: ['테스트'],
    conditionsFailed: [],
    reasoning: '테스트용 합화/합거 평가',
    dayMasterInvolved: false,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

describe('GyeokgukDeterminer', () => {

  // ── monthBranchSipseong ──────────────────────────────────────

  describe('monthBranchSipseong', () => {
    it('GAP day master + IN month -- principal stem GAP is BI_GYEON', () => {
      expect(GyeokgukDeterminer.monthBranchSipseong(Cheongan.GAP, Jiji.IN))
        .toBe(Sipseong.BI_GYEON);
    });

    it('GAP day master + MYO month -- principal stem EUL is GYEOB_JAE', () => {
      expect(GyeokgukDeterminer.monthBranchSipseong(Cheongan.GAP, Jiji.MYO))
        .toBe(Sipseong.GYEOB_JAE);
    });

    it('GAP day master + YU month -- principal stem SIN is JEONG_GWAN', () => {
      expect(GyeokgukDeterminer.monthBranchSipseong(Cheongan.GAP, Jiji.YU))
        .toBe(Sipseong.JEONG_GWAN);
    });

    it('GAP day master + JA month -- principal stem GYE is JEONG_IN', () => {
      expect(GyeokgukDeterminer.monthBranchSipseong(Cheongan.GAP, Jiji.JA))
        .toBe(Sipseong.JEONG_IN);
    });

    it('EUL day master + O month -- principal stem JEONG is SIK_SIN', () => {
      expect(GyeokgukDeterminer.monthBranchSipseong(Cheongan.EUL, Jiji.O))
        .toBe(Sipseong.SIK_SIN);
    });
  });

  // ── 내격 (standard pattern) determination ────────────────────

  describe('naegyeok determination', () => {
    it('GAP day master + IN month branch yields GEONROK pattern', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.GAP, Jiji.IN);
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.type).toBe(GyeokgukType.GEONROK);
      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
      expect(result.baseSipseong).toBe(Sipseong.BI_GYEON);
      expect(result.confidence).toBe(1.0);
    });

    it('GAP day master + MYO month branch yields YANGIN pattern', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.GAP, Jiji.MYO);
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.type).toBe(GyeokgukType.YANGIN);
      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
      expect(result.baseSipseong).toBe(Sipseong.GYEOB_JAE);
    });

    it('GAP day master + YU month branch yields JEONGGWAN pattern', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.GAP, Jiji.YU);
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.type).toBe(GyeokgukType.JEONGGWAN);
      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
      expect(result.baseSipseong).toBe(Sipseong.JEONG_GWAN);
    });

    it('GAP day master + JA month branch yields JEONGIN pattern', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.GAP, Jiji.JA);
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.type).toBe(GyeokgukType.JEONGIN);
      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
      expect(result.baseSipseong).toBe(Sipseong.JEONG_IN);
    });

    it('EUL day master + O month branch yields SIKSIN pattern', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.EUL, Jiji.O);
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.type).toBe(GyeokgukType.SIKSIN);
      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
      expect(result.baseSipseong).toBe(Sipseong.SIK_SIN);
    });
  });

  // ── All 10 sipseong-to-naegyeok mappings ─────────────────────

  describe('all ten sipseong-to-naegyeok mappings', () => {
    it('all ten sipseong values map to distinct naegyeok types', () => {
      const cases: [Cheongan, Jiji, GyeokgukType][] = [
        [Cheongan.GAP, Jiji.IN,   GyeokgukType.GEONROK],
        [Cheongan.GAP, Jiji.MYO,  GyeokgukType.YANGIN],
        [Cheongan.GAP, Jiji.SA,   GyeokgukType.SIKSIN],
        [Cheongan.GAP, Jiji.O,    GyeokgukType.SANGGWAN],
        [Cheongan.GAP, Jiji.JIN,  GyeokgukType.PYEONJAE],
        [Cheongan.GAP, Jiji.CHUK, GyeokgukType.JEONGJAE],
        [Cheongan.GAP, Jiji.SIN,  GyeokgukType.PYEONGWAN],
        [Cheongan.GAP, Jiji.YU,   GyeokgukType.JEONGGWAN],
        [Cheongan.GAP, Jiji.HAE,  GyeokgukType.PYEONIN],
        [Cheongan.GAP, Jiji.JA,   GyeokgukType.JEONGIN],
      ];

      const producedTypes = new Set<GyeokgukType>();
      for (const [dayMaster, monthBranch, expectedType] of cases) {
        const pillars = pillarsWithMonthBranch(dayMaster, monthBranch);
        const result = GyeokgukDeterminer.determine(pillars);
        expect(result.type).toBe(expectedType);
        expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
        producedTypes.add(result.type);
      }

      expect(producedTypes.size).toBe(10);
    });
  });

  // ── GAP sipseong across all 12 branches ──────────────────────

  describe('GAP day master sipseong across all 12 month branches', () => {
    const expected: [Jiji, Sipseong][] = [
      [Jiji.JA,   Sipseong.JEONG_IN],
      [Jiji.CHUK, Sipseong.JEONG_JAE],
      [Jiji.IN,   Sipseong.BI_GYEON],
      [Jiji.MYO,  Sipseong.GYEOB_JAE],
      [Jiji.JIN,  Sipseong.PYEON_JAE],
      [Jiji.SA,   Sipseong.SIK_SIN],
      [Jiji.O,    Sipseong.SANG_GWAN],
      [Jiji.MI,   Sipseong.JEONG_JAE],
      [Jiji.SIN,  Sipseong.PYEON_GWAN],
      [Jiji.YU,   Sipseong.JEONG_GWAN],
      [Jiji.SUL,  Sipseong.PYEON_JAE],
      [Jiji.HAE,  Sipseong.PYEON_IN],
    ];

    it.each(expected)('GAP vs %s yields correct sipseong', (branch, expectedSipseong) => {
      const actual = GyeokgukDeterminer.monthBranchSipseong(Cheongan.GAP, branch);
      expect(actual).toBe(expectedSipseong);
    });
  });

  // ── 종격 (following patterns) ────────────────────────────────

  describe('jonggyeok detection', () => {
    it('VERY_STRONG with dominant bigyeop and no jaegwan yields JONGGANG', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );
      const strength = veryStrongStrength(Cheongan.GAP);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGGANG);
      expect(result.category).toBe(GyeokgukCategory.JONGGYEOK);
    });

    it('VERY_STRONG without qualifying profile falls back to naegyeok', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GYEONG, Jiji.YU),  // metal = 관성
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.EUL, Jiji.IN),
      );
      const strength = veryStrongStrength(Cheongan.GAP);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
    });

    it('VERY_WEAK with dominant gwan and no self-support yields JONGSAL', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.MU, Jiji.SUL),
        new Pillar(Cheongan.IM, Jiji.JIN),
        new Pillar(Cheongan.GI, Jiji.CHUK),
      );
      const strength = veryWeakStrength(Cheongan.IM);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGSAL);
      expect(result.category).toBe(GyeokgukCategory.JONGGYEOK);
    });

    it('no strength info yields naegyeok regardless of chart composition', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.MU, Jiji.SUL),
        new Pillar(Cheongan.IM, Jiji.JIN),
        new Pillar(Cheongan.GI, Jiji.CHUK),
      );
      const result = GyeokgukDeterminer.determine(pillars, null);

      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
    });

    it('moderate strength levels never produce jonggyeok', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.GAP, Jiji.IN);

      const moderateLevels = [
        StrengthLevel.STRONG,
        StrengthLevel.SLIGHTLY_STRONG,
        StrengthLevel.SLIGHTLY_WEAK,
        StrengthLevel.WEAK,
      ];

      for (const level of moderateLevels) {
        const isStrong = level === StrengthLevel.STRONG || level === StrengthLevel.SLIGHTLY_STRONG;
        const strength: StrengthResult = {
          dayMaster: Cheongan.GAP,
          level,
          score: { deukryeong: 40.0, deukji: 15.0, deukse: 10.0, totalSupport: 65.0, totalOppose: 35.0 },
          isStrong,
          details: [],
        };
        // NOTE: totalSupport=65 is >= 62.4, but we need moderate-range scores
        // The test expects NAEGYEOK because the profile won't match 종강 conditions
        // (the pillar has non-wood stems, so bigyeop < 4 or jae+gwan > 0).
        // Use the same pillars as Kotlin: pillarsWithMonthBranch uses JEONG stems.
        const result = GyeokgukDeterminer.determine(pillars, strength);
        expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
      }
    });
  });

  // ── Reasoning string validation ──────────────────────────────

  describe('reasoning', () => {
    it('naegyeok reasoning contains key domain terms', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.GAP, Jiji.YU);
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning).toContain('갑');
      expect(result.reasoning).toContain('유');
      expect(result.reasoning).toContain('신');
      expect(result.reasoning).toContain('정관');
      expect(result.reasoning).toContain('정관격');
    });
  });

  // ── gyeokgukFromSipseong mapping ─────────────────────────────

  describe('gyeokgukFromSipseong', () => {
    it('covers all sipseong values without exception', () => {
      for (const sipseong of SIPSEONG_VALUES) {
        const type = gyeokgukFromSipseong(sipseong);
        expect(type).toBeDefined();
      }
    });

    it('produces 10 distinct types', () => {
      const types = new Set(SIPSEONG_VALUES.map(s => gyeokgukFromSipseong(s)));
      expect(types.size).toBe(10);
    });
  });

  // ── Edge cases with different day masters ────────────────────

  describe('edge cases', () => {
    it('JEONG day master + JA month -- PYEONGWAN pattern', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.JEONG, Jiji.JA);
      const result = GyeokgukDeterminer.determine(pillars);
      expect(result.type).toBe(GyeokgukType.PYEONGWAN);
    });

    it('GYEONG day master + IN month -- PYEONJAE pattern', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.GYEONG, Jiji.IN);
      const result = GyeokgukDeterminer.determine(pillars);
      expect(result.type).toBe(GyeokgukType.PYEONJAE);
      expect(result.baseSipseong).toBe(Sipseong.PYEON_JAE);
    });

    it('IM day master + SA month -- PYEONJAE pattern', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.IM, Jiji.SA);
      const result = GyeokgukDeterminer.determine(pillars);
      expect(result.type).toBe(GyeokgukType.PYEONJAE);
      expect(result.baseSipseong).toBe(Sipseong.PYEON_JAE);
    });
  });

  // ── 화격 (Transformation Pattern) ───────────────────────────

  describe('hwagyeok (transformation pattern)', () => {
    it('hapwha evaluation with HAPWHA state yields HWAGYEOK category', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.GAP, Jiji.JIN);
      const hapwha = [makeHapHwa(Ohaeng.EARTH, HapState.HAPWHA)];
      const result = GyeokgukDeterminer.determine(pillars, null, hapwha);

      expect(result.type).toBe(GyeokgukType.HAPWHA_EARTH);
      expect(result.category).toBe(GyeokgukCategory.HWAGYEOK);
    });

    it('each ohaeng maps to correct HAPWHA type', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.GAP, Jiji.IN);
      const expected: [Ohaeng, GyeokgukType][] = [
        [Ohaeng.WOOD,  GyeokgukType.HAPWHA_WOOD],
        [Ohaeng.FIRE,  GyeokgukType.HAPWHA_FIRE],
        [Ohaeng.EARTH, GyeokgukType.HAPWHA_EARTH],
        [Ohaeng.METAL, GyeokgukType.HAPWHA_METAL],
        [Ohaeng.WATER, GyeokgukType.HAPWHA_WATER],
      ];
      for (const [ohaeng, expectedType] of expected) {
        const hapwha = [makeHapHwa(ohaeng, HapState.HAPWHA)];
        const result = GyeokgukDeterminer.determine(pillars, null, hapwha);
        expect(result.type).toBe(expectedType);
        expect(result.category).toBe(GyeokgukCategory.HWAGYEOK);
      }
    });

    it('hapgeo evaluation does not yield HWAGYEOK', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.GAP, Jiji.JIN);
      const hapgeo = [makeHapHwa(Ohaeng.EARTH, HapState.HAPGEO)];
      const result = GyeokgukDeterminer.determine(pillars, null, hapgeo);

      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
    });

    it('not_established evaluation does not yield HWAGYEOK', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.GAP, Jiji.JIN);
      const notEst = [makeHapHwa(Ohaeng.EARTH, HapState.NOT_ESTABLISHED)];
      const result = GyeokgukDeterminer.determine(pillars, null, notEst);

      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
    });

    it('hwagyeok takes priority over jonggyeok when both could apply', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );
      const strength = veryStrongStrength(Cheongan.GAP);
      const hapwha = [makeHapHwa(Ohaeng.FIRE, HapState.HAPWHA)];
      const result = GyeokgukDeterminer.determine(pillars, strength, hapwha);

      expect(result.category).toBe(GyeokgukCategory.HWAGYEOK);
      expect(result.type).toBe(GyeokgukType.HAPWHA_FIRE);
    });

    it('hwagyeok reasoning contains Korean explanation', () => {
      const pillars = pillarsWithMonthBranch(Cheongan.GAP, Jiji.JIN);
      const hapwha = [makeHapHwa(Ohaeng.EARTH, HapState.HAPWHA)];
      const result = GyeokgukDeterminer.determine(pillars, null, hapwha);

      expect(result.reasoning).toContain('합화');
      expect(result.reasoning).toContain('토');
    });
  });

  // ── 일행득기격 (Single-Element Dominance) ────────────────────

  describe('ilhaengDeukgi (single-element dominance)', () => {
    it('all wood branches with wood day master yields GOKJIK', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
      );
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.type).toBe(GyeokgukType.GOKJIK);
      expect(result.category).toBe(GyeokgukCategory.ILHAENG);
    });

    it('all fire branches with fire day master yields YEOMSANG', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.MI),
        new Pillar(Cheongan.JEONG, Jiji.SA),
      );
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.type).toBe(GyeokgukType.YEOMSANG);
      expect(result.category).toBe(GyeokgukCategory.ILHAENG);
    });

    it('all metal branches with metal day master yields JONGHYEOK', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
        new Pillar(Cheongan.SIN, Jiji.YU),
        new Pillar(Cheongan.GYEONG, Jiji.SUL),
        new Pillar(Cheongan.SIN, Jiji.SIN),
      );
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.type).toBe(GyeokgukType.JONGHYEOK);
      expect(result.category).toBe(GyeokgukCategory.ILHAENG);
    });

    it('all water branches with water day master yields YUNHA', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.IM, Jiji.HAE),
        new Pillar(Cheongan.GYE, Jiji.JA),
        new Pillar(Cheongan.IM, Jiji.CHUK),
        new Pillar(Cheongan.GYE, Jiji.HAE),
      );
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.type).toBe(GyeokgukType.YUNHA);
      expect(result.category).toBe(GyeokgukCategory.ILHAENG);
    });

    it('all earth branches with earth day master yields GASAEK', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.GI, Jiji.SUL),
        new Pillar(Cheongan.MU, Jiji.CHUK),
        new Pillar(Cheongan.GI, Jiji.MI),
      );
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.type).toBe(GyeokgukType.GASAEK);
      expect(result.category).toBe(GyeokgukCategory.ILHAENG);
    });

    it('ilhaeng blocked by controlling stem in heavenly stems', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GYEONG, Jiji.MYO),  // METAL stem blocks 일행득기
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
      );
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
    });

    it('ilhaeng requires at least 3 matching branches', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.O),     // FIRE, not WOOD
        new Pillar(Cheongan.EUL, Jiji.SA),     // FIRE, not WOOD
      );
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
    });

    it('jonggyeok takes priority over ilhaeng when strength provided', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );
      const strength = veryStrongStrength(Cheongan.GAP);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).toBe(GyeokgukCategory.JONGGYEOK);
      expect(result.type).toBe(GyeokgukType.JONGGANG);
    });

    it('ilhaeng confidence is 0.90 for 4 matching branches', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
      );
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.confidence).toBe(0.90);
    });

    it('ilhaeng confidence is 0.75 for 3 matching branches', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.O),   // FIRE, not WOOD
      );
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.confidence).toBe(0.75);
      expect(result.type).toBe(GyeokgukType.GOKJIK);
    });

    it('ilhaeng reasoning mentions branch count and element', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
      );
      const result = GyeokgukDeterminer.determine(pillars);

      expect(result.reasoning).toContain('목');
      expect(result.reasoning).toMatch(/[34]/);
      expect(result.reasoning).toContain('곡직격');
    });
  });

  // ── 종격 threshold config ────────────────────────────────────

  describe('jonggyeok threshold config', () => {
    const jongGangPillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.EUL, Jiji.MYO),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.EUL, Jiji.MYO),
    );

    const jongSalPillars = new PillarSet(
      new Pillar(Cheongan.MU, Jiji.JIN),
      new Pillar(Cheongan.MU, Jiji.SUL),
      new Pillar(Cheongan.IM, Jiji.JIN),
      new Pillar(Cheongan.GI, Jiji.CHUK),
    );

    it('default config uses standard thresholds and produces JONGGANG', () => {
      const strength = strengthWithScore(Cheongan.GAP, 80.0, true);
      const result = GyeokgukDeterminer.determine(jongGangPillars, strength);
      expect(result.type).toBe(GyeokgukType.JONGGANG);
    });

    it('raising strong threshold above score blocks JONGGANG', () => {
      const config = createConfig({ jonggyeokStrongThreshold: 85.0 });
      const strength = strengthWithScore(Cheongan.GAP, 80.0, true);
      const result = GyeokgukDeterminer.determine(jongGangPillars, strength, [], config);
      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });

    it('lowering strong threshold below score allows JONGGANG', () => {
      const config = createConfig({ jonggyeokStrongThreshold: 60.0 });
      const strength = strengthWithScore(Cheongan.GAP, 65.0, true);
      const result = GyeokgukDeterminer.determine(jongGangPillars, strength, [], config);
      expect(result.type).toBe(GyeokgukType.JONGGANG);
    });

    it('default config produces JONGSAL for extreme weak chart', () => {
      const strength = strengthWithScore(Cheongan.IM, 0.0, false);
      const result = GyeokgukDeterminer.determine(jongSalPillars, strength);
      expect(result.type).toBe(GyeokgukType.JONGSAL);
    });

    it('lowering weak threshold below score blocks JONGSAL', () => {
      const config = createConfig({ jonggyeokWeakThreshold: 3.0 });
      const strength = strengthWithScore(Cheongan.IM, 5.0, false);
      const result = GyeokgukDeterminer.determine(jongSalPillars, strength, [], config);
      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
    });

    it('raising weak threshold above score allows JONGSAL', () => {
      const config = createConfig({ jonggyeokWeakThreshold: 15.0 });
      const strength = strengthWithScore(Cheongan.IM, 10.0, false);
      const result = GyeokgukDeterminer.determine(jongSalPillars, strength, [], config);
      expect(result.type).toBe(GyeokgukType.JONGSAL);
    });

    it('score exactly at strong threshold triggers JONGGANG check', () => {
      const config = createConfig({ jonggyeokStrongThreshold: 70.0 });
      const strength = strengthWithScore(Cheongan.GAP, 70.0, true);
      const result = GyeokgukDeterminer.determine(jongGangPillars, strength, [], config);
      expect(result.type).toBe(GyeokgukType.JONGGANG);
    });

    it('score exactly at weak threshold triggers weak jong check', () => {
      const config = createConfig({ jonggyeokWeakThreshold: 5.0 });
      const strength = strengthWithScore(Cheongan.IM, 5.0, false);
      const result = GyeokgukDeterminer.determine(jongSalPillars, strength, [], config);
      expect(result.type).toBe(GyeokgukType.JONGSAL);
    });

    it('modern integrated preset uses lenient thresholds', () => {
      const config = configFromPreset(SchoolPreset.MODERN_INTEGRATED);
      expect(config.jonggyeokWeakThreshold).toBe(20.0);
      expect(config.jonggyeokStrongThreshold).toBe(58.0);
    });

    it('korean mainstream preset uses conservative thresholds', () => {
      const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);
      expect(config.jonggyeokWeakThreshold).toBe(15.0);
      expect(config.jonggyeokStrongThreshold).toBe(62.4);
    });
  });

  // ── HapHwa/HapGeo propagation ────────────────────────────────

  describe('hapHwa propagation', () => {
    it('ilhaeng not blocked when controlling stem is hapgeo', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GYEONG, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
      );
      const hapHwa = [hapHwaAt(
        Cheongan.GYEONG, PillarPosition.MONTH,
        Cheongan.EUL, PillarPosition.HOUR,
        HapState.HAPGEO, Ohaeng.METAL,
      )];

      const result = GyeokgukDeterminer.determine(pillars, null, hapHwa);
      expect(result.category).toBe(GyeokgukCategory.ILHAENG);
    });

    it('ilhaeng blocked without hapgeo when controlling stem present', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GYEONG, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
      );

      const result = GyeokgukDeterminer.determine(pillars);
      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
    });

    it('jonggang possible when blocking gwan stem is hapgeo', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYEONG, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.IN),
      );
      const strength = veryStrongStrength(Cheongan.GAP);

      // Without hapgeo: gwan=1 (GYEONG) -> NOT 종강격
      const resultWithout = GyeokgukDeterminer.determine(pillars, strength);
      expect(resultWithout.type).not.toBe(GyeokgukType.JONGGANG);

      // With GYEONG+EUL hapgeo'd: gwan=0 -> 종강격 possible
      const hapHwa = [hapHwaAt(
        Cheongan.GYEONG, PillarPosition.YEAR,
        Cheongan.EUL, PillarPosition.MONTH,
        HapState.HAPGEO, Ohaeng.METAL,
      )];
      const resultWith = GyeokgukDeterminer.determine(pillars, strength, hapHwa);
      expect(resultWith.type).toBe(GyeokgukType.JONGGANG);
    });

    it('not-established hap does not affect ilhaeng blocking', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GYEONG, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
      );
      const hapHwa = [hapHwaAt(
        Cheongan.GYEONG, PillarPosition.MONTH,
        Cheongan.EUL, PillarPosition.HOUR,
        HapState.NOT_ESTABLISHED, Ohaeng.METAL,
      )];

      const result = GyeokgukDeterminer.determine(pillars, null, hapHwa);
      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
    });
  });
});
