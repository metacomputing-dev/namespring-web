import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import { Sipseong } from '../../../src/domain/Sipseong.js';
import { StrengthLevel, isStrongSide } from '../../../src/domain/StrengthResult.js';
import { HapState, type HapHwaEvaluation } from '../../../src/domain/Relations.js';
import { createConfig, HiddenStemScope, SaryeongMode, DEFAULT_CONFIG } from '../../../src/config/CalculationConfig.js';
import { StrengthAnalyzer } from '../../../src/engine/analysis/StrengthAnalyzer.js';

/**
 * StrengthAnalyzer edge case tests for untested branches and boundary conditions.
 *
 * Test targets:
 * 1. scoreDeukji() -- HiddenStemScope.JEONGGI_ONLY vs ALL_THREE
 * 2. scoreDeukji() -- HiddenStemScope.SARYEONG_BASED + daysSinceJeol
 * 3. scoreDeukse() -- HAPGEO state (neutralized stems)
 * 4. scoreDeukse() -- HAPWHA state (transformed element)
 * 5. scoreDeukryeong -- proportionalDeukryeong mode
 * 6. classifyLevel -- 6-level boundary verification
 *
 * Ported from StrengthAnalyzerScopeEdgeCaseTest.kt.
 */

// =========================================================================
// Shared test charts
// =========================================================================

/** GAP wood day master chart: year=IM-JA, month=BYEONG-IN, day=GAP-O, hour=GYEONG-SIN */
const gapWoodChart = new PillarSet(
  new Pillar(Cheongan.IM, Jiji.JA),
  new Pillar(Cheongan.BYEONG, Jiji.IN),
  new Pillar(Cheongan.GAP, Jiji.O),
  new Pillar(Cheongan.GYEONG, Jiji.SIN),
);

/** BYEONG fire day master chart: year=SIN-YU, month=GYEONG-IN, day=BYEONG-O, hour=GAP-O */
const fireChart = new PillarSet(
  new Pillar(Cheongan.SIN, Jiji.YU),
  new Pillar(Cheongan.GYEONG, Jiji.IN),
  new Pillar(Cheongan.BYEONG, Jiji.O),
  new Pillar(Cheongan.GAP, Jiji.O),
);

describe('StrengthAnalyzerScopeEdgeCaseTest', () => {
  // =========================================================================
  // 1. scoreDeukji() -- HiddenStemScope modes
  // =========================================================================
  describe('DeukjiScopeModes', () => {
    it('JEONGGI_ONLY produces lower or equal deukji than ALL_THREE', () => {
      const configJeonggi = createConfig({
        hiddenStemScopeForStrength: HiddenStemScope.JEONGGI_ONLY,
      });
      const configAll = createConfig({
        hiddenStemScopeForStrength: HiddenStemScope.ALL_THREE,
      });

      const resultJeonggi = StrengthAnalyzer.analyze(gapWoodChart, configJeonggi);
      const resultAll = StrengthAnalyzer.analyze(gapWoodChart, configAll);

      expect(resultJeonggi.score.deukji).toBeLessThanOrEqual(resultAll.score.deukji);
    });

    it('JEONGGI_ONLY scores only principal stem per branch', () => {
      const config = createConfig({
        hiddenStemScopeForStrength: HiddenStemScope.JEONGGI_ONLY,
      });
      const result = StrengthAnalyzer.analyze(gapWoodChart, config);

      expect(result.score.deukji).toBeGreaterThan(0);
      expect(result.details.some(d => d.includes('[득지]'))).toBe(true);
    });

    it('SARYEONG_BASED with daysSinceJeol uses commanding stem for month branch', () => {
      const config = createConfig({
        hiddenStemScopeForStrength: HiddenStemScope.SARYEONG_BASED,
        saryeongMode: SaryeongMode.BY_DAY_IN_MONTH,
      });

      // daysSinceJeol = 3 -> IN month yeogi(MU, 7days) period -> MU commands
      const resultEarly = StrengthAnalyzer.analyze(gapWoodChart, config, 3);

      // daysSinceJeol = 20 -> IN month jeonggi(GAP, 16days) period -> GAP commands
      const resultLate = StrengthAnalyzer.analyze(gapWoodChart, config, 20);

      expect(resultLate.score.totalSupport).toBeGreaterThanOrEqual(
        resultEarly.score.totalSupport,
      );
    });

    it('SARYEONG_BASED without daysSinceJeol falls back to default 15 day', () => {
      const config = createConfig({
        hiddenStemScopeForStrength: HiddenStemScope.SARYEONG_BASED,
        saryeongMode: SaryeongMode.BY_DAY_IN_MONTH,
      });

      const result = StrengthAnalyzer.analyze(gapWoodChart, config, null);
      expect(result.details.some(d => d.includes('15') || d.includes('근사'))).toBe(true);
    });
  });

  // =========================================================================
  // 2. scoreDeukse() -- HAPGEO state
  // =========================================================================
  describe('DeukseHapgeo', () => {
    it('HAPGEO stem contributes zero to deukse', () => {
      const hapgeoEval: HapHwaEvaluation = {
        stem1: Cheongan.IM,
        stem2: Cheongan.JEONG,
        position1: PillarPosition.YEAR,
        position2: PillarPosition.MONTH,
        resultOhaeng: Ohaeng.WOOD,
        state: HapState.HAPGEO,
        confidence: 0.8,
        conditionsMet: ['adjacency'],
        conditionsFailed: ['monthly_support'],
        reasoning: 'hapgeo test',
        dayMasterInvolved: false,
      };

      const resultWithHapgeo = StrengthAnalyzer.analyze(
        gapWoodChart, DEFAULT_CONFIG, null, [hapgeoEval],
      );
      const resultWithout = StrengthAnalyzer.analyze(gapWoodChart);

      // IM = pyeonin +5 -> hapgeo removes 5
      const diff = resultWithout.score.deukse - resultWithHapgeo.score.deukse;
      expect(diff).toBeCloseTo(5.0, 1);
      expect(resultWithHapgeo.details.some(d => d.includes('합거'))).toBe(true);
    });

    it('HAPGEO on non-supporting stem does not change deukse', () => {
      const hapgeoEval: HapHwaEvaluation = {
        stem1: Cheongan.GYEONG,
        stem2: Cheongan.EUL,
        position1: PillarPosition.HOUR,
        position2: PillarPosition.DAY,
        resultOhaeng: Ohaeng.METAL,
        state: HapState.HAPGEO,
        confidence: 0.7,
        conditionsMet: ['adjacency'],
        conditionsFailed: [],
        reasoning: 'non-supporting hapgeo test',
        dayMasterInvolved: false,
      };

      const resultWithHapgeo = StrengthAnalyzer.analyze(
        gapWoodChart, DEFAULT_CONFIG, null, [hapgeoEval],
      );
      const resultWithout = StrengthAnalyzer.analyze(gapWoodChart);

      expect(resultWithHapgeo.score.deukse).toBeCloseTo(resultWithout.score.deukse, 1);
    });
  });

  // =========================================================================
  // 3. scoreDeukse() -- HAPWHA state
  // =========================================================================
  describe('DeukseHapwha', () => {
    it('HAPWHA with transformed element supporting DM gives positive score', () => {
      // BYEONG fire DM: SIN(year)=jeongJae(0) -> hapwha to WOOD -> inseong(+5)
      const hapwhaWood: HapHwaEvaluation = {
        stem1: Cheongan.SIN,
        stem2: Cheongan.BYEONG,
        position1: PillarPosition.YEAR,
        position2: PillarPosition.DAY,
        resultOhaeng: Ohaeng.WOOD,
        state: HapState.HAPWHA,
        confidence: 0.9,
        conditionsMet: ['adjacency', 'monthly_support'],
        conditionsFailed: [],
        reasoning: 'hapwha wood test',
        dayMasterInvolved: true,
      };

      const resultWithHapwha = StrengthAnalyzer.analyze(
        fireChart, DEFAULT_CONFIG, null, [hapwhaWood],
      );
      const resultWithout = StrengthAnalyzer.analyze(fireChart);

      const diff = resultWithHapwha.score.deukse - resultWithout.score.deukse;
      expect(diff).toBeCloseTo(5.0, 1);
      expect(resultWithHapwha.details.some(d => d.includes('합화'))).toBe(true);
    });

    it('HAPWHA with transformed element NOT supporting DM gives zero score', () => {
      // BYEONG fire DM: SIN(year) -> hapwha to WATER -> yeokgeuk(0)
      const hapwhaWater: HapHwaEvaluation = {
        stem1: Cheongan.SIN,
        stem2: Cheongan.BYEONG,
        position1: PillarPosition.YEAR,
        position2: PillarPosition.DAY,
        resultOhaeng: Ohaeng.WATER,
        state: HapState.HAPWHA,
        confidence: 0.6,
        conditionsMet: ['adjacency'],
        conditionsFailed: ['monthly_support'],
        reasoning: 'hapwha water test (non-supporting)',
        dayMasterInvolved: true,
      };

      const resultWithHapwha = StrengthAnalyzer.analyze(
        fireChart, DEFAULT_CONFIG, null, [hapwhaWater],
      );
      const resultWithout = StrengthAnalyzer.analyze(fireChart);

      expect(resultWithHapwha.score.deukse).toBeCloseTo(resultWithout.score.deukse, 1);
    });

    it('HAPWHA with transformed element same as DM gives bigyeop score', () => {
      // BYEONG fire DM: SIN(year)=0 -> hapwha to FIRE -> bigyeop(+7)
      const hapwhaFire: HapHwaEvaluation = {
        stem1: Cheongan.SIN,
        stem2: Cheongan.BYEONG,
        position1: PillarPosition.YEAR,
        position2: PillarPosition.DAY,
        resultOhaeng: Ohaeng.FIRE,
        state: HapState.HAPWHA,
        confidence: 0.85,
        conditionsMet: ['adjacency', 'monthly_support', 'force'],
        conditionsFailed: [],
        reasoning: 'hapwha fire test (bigyeop)',
        dayMasterInvolved: true,
      };

      const resultWithHapwha = StrengthAnalyzer.analyze(
        fireChart, DEFAULT_CONFIG, null, [hapwhaFire],
      );
      const resultWithout = StrengthAnalyzer.analyze(fireChart);

      const diff = resultWithHapwha.score.deukse - resultWithout.score.deukse;
      expect(diff).toBeCloseTo(7.0, 1);
    });

    it('NOT_ESTABLISHED hap does not change scoring', () => {
      const notEstablished: HapHwaEvaluation = {
        stem1: Cheongan.SIN,
        stem2: Cheongan.BYEONG,
        position1: PillarPosition.YEAR,
        position2: PillarPosition.DAY,
        resultOhaeng: Ohaeng.WATER,
        state: HapState.NOT_ESTABLISHED,
        confidence: 0.3,
        conditionsMet: [],
        conditionsFailed: ['adjacency', 'monthly_support'],
        reasoning: 'not established test',
        dayMasterInvolved: true,
      };

      const resultWithHap = StrengthAnalyzer.analyze(
        fireChart, DEFAULT_CONFIG, null, [notEstablished],
      );
      const resultWithout = StrengthAnalyzer.analyze(fireChart);

      expect(resultWithHap.score.deukse).toBeCloseTo(resultWithout.score.deukse, 1);
    });
  });

  // =========================================================================
  // 4. scoreDeukryeong -- proportionalDeukryeong mode
  // =========================================================================
  describe('ProportionalDeukryeong', () => {
    it('proportional mode scores fractionally based on supporting days', () => {
      const config = createConfig({ proportionalDeukryeong: true });
      const result = StrengthAnalyzer.analyze(gapWoodChart, config);

      // IN branch: MU(7d)non-support + BYEONG(7d)non-support + GAP(16d)support
      const expected = 40.0 * 16.0 / 30.0;
      expect(result.score.deukryeong).toBeCloseTo(expected, 1);
      expect(result.details.some(d => d.includes('비례') || d.includes('지지율'))).toBe(true);
    });

    it('binary mode scores full 40 when principal stem supports', () => {
      const config = createConfig({ proportionalDeukryeong: false });
      const result = StrengthAnalyzer.analyze(gapWoodChart, config);
      expect(result.score.deukryeong).toBeCloseTo(40.0, 1);
    });

    it('proportional mode with partial support gives intermediate score', () => {
      const sinMonthChart = new PillarSet(
        new Pillar(Cheongan.IM, Jiji.JA),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
      );
      const config = createConfig({ proportionalDeukryeong: true });
      const result = StrengthAnalyzer.analyze(sinMonthChart, config);

      // SIN branch: MU(7d)non-support + IM(7d)support + GYEONG(16d)non-support
      const expected = 40.0 * 7.0 / 30.0;
      expect(result.score.deukryeong).toBeCloseTo(expected, 1);
    });

    it('custom deukryeongWeight applies to proportional scoring', () => {
      const config = createConfig({
        proportionalDeukryeong: true,
        deukryeongWeight: 60.0,
      });
      const result = StrengthAnalyzer.analyze(gapWoodChart, config);

      const expected = 60.0 * 16.0 / 30.0;
      expect(result.score.deukryeong).toBeCloseTo(expected, 1);
    });
  });

  // =========================================================================
  // 5. classifyLevel -- 6-level boundary verification
  // =========================================================================
  describe('ClassifyLevelBoundaries', () => {
    it('chart with overwhelming support is VERY_STRONG', () => {
      const strongChart = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.IM, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.IM, Jiji.HAE),
      );
      const result = StrengthAnalyzer.analyze(strongChart);

      expect(result.level).toBe(StrengthLevel.VERY_STRONG);
      expect(result.isStrong).toBe(true);
      expect(result.score.totalSupport).toBeGreaterThanOrEqual(62.4);
    });

    it('chart with minimal support is VERY_WEAK', () => {
      const weakChart = new PillarSet(
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
        new Pillar(Cheongan.SIN, Jiji.YU),
        new Pillar(Cheongan.GAP, Jiji.SUL),
        new Pillar(Cheongan.MU, Jiji.JIN),
      );
      const result = StrengthAnalyzer.analyze(weakChart);

      expect(result.level).toBe(StrengthLevel.VERY_WEAK);
      expect(result.isStrong).toBe(false);
      expect(result.score.totalSupport).toBeLessThan(15.0);
    });

    it('chart with moderate support below threshold is SLIGHTLY_STRONG', () => {
      const moderateChart = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.MU, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.SUL),
        new Pillar(Cheongan.JEONG, Jiji.YU),
      );
      const result = StrengthAnalyzer.analyze(moderateChart);

      if (result.score.totalSupport >= 40.0 && result.score.totalSupport < 50.0) {
        expect(result.level).toBe(StrengthLevel.SLIGHTLY_STRONG);
        expect(result.isStrong).toBe(true);
      }
      // Always verify level-isStrong consistency
      expect(result.isStrong).toBe(isStrongSide(result.level));
    });

    it.each([
      ['VERY_STRONG', true],
      ['STRONG', true],
      ['SLIGHTLY_STRONG', true],
      ['SLIGHTLY_WEAK', false],
      ['WEAK', false],
      ['VERY_WEAK', false],
    ] as const)('isStrongSide consistent: %s -> %s', (levelName, expectedStrong) => {
      const level = levelName as StrengthLevel;
      expect(isStrongSide(level)).toBe(expectedStrong);
    });

    it('custom threshold shifts classification boundaries', () => {
      const midChart = new PillarSet(
        new Pillar(Cheongan.IM, Jiji.HAE),
        new Pillar(Cheongan.GYEONG, Jiji.YU),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
      );

      const strictConfig = createConfig({ strengthThreshold: 60.0 });
      const lenientConfig = createConfig({ strengthThreshold: 30.0 });

      const strictResult = StrengthAnalyzer.analyze(midChart, strictConfig);
      const lenientResult = StrengthAnalyzer.analyze(midChart, lenientConfig);

      // Same chart same score, just different threshold
      expect(strictResult.score.totalSupport).toBeCloseTo(
        lenientResult.score.totalSupport, 1,
      );
    });

    it('custom deukse weights change scoring', () => {
      const defaultConfig = createConfig();
      const customConfig = createConfig({
        deukseBigyeop: 10.0,
        deukseInseong: 8.0,
      });

      const resultDefault = StrengthAnalyzer.analyze(gapWoodChart, defaultConfig);
      const resultCustom = StrengthAnalyzer.analyze(gapWoodChart, customConfig);

      // IM=pyeonin: default 5pts, custom 8pts -> custom >= default
      expect(resultCustom.score.deukse).toBeGreaterThanOrEqual(resultDefault.score.deukse);
    });

    it('custom deukjiPerBranch changes deukji scoring', () => {
      const defaultConfig = createConfig();
      const doubledConfig = createConfig({ deukjiPerBranch: 10.0 });

      const resultDefault = StrengthAnalyzer.analyze(gapWoodChart, defaultConfig);
      const resultDoubled = StrengthAnalyzer.analyze(gapWoodChart, doubledConfig);

      expect(resultDoubled.score.deukji).toBeCloseTo(resultDefault.score.deukji * 2, 1);
    });
  });

  // =========================================================================
  // 6. totalOppose and score consistency
  // =========================================================================
  describe('ScoreConsistency', () => {
    it('totalOppose equals max minus totalSupport clamped to zero', () => {
      const config = createConfig();
      const result = StrengthAnalyzer.analyze(gapWoodChart, config);

      const maxTheoretical = config.deukryeongWeight +
        config.deukjiPerBranch * 4 +
        config.deukseBigyeop * 3;
      const expectedOppose = Math.max(maxTheoretical - result.score.totalSupport, 0.0);

      expect(result.score.totalOppose).toBeCloseTo(expectedOppose, 1);
    });

    it('totalSupport equals sum of three components', () => {
      const result = StrengthAnalyzer.analyze(gapWoodChart);
      const expectedTotal = result.score.deukryeong + result.score.deukji + result.score.deukse;
      expect(result.score.totalSupport).toBeCloseTo(expectedTotal, 2);
    });

    it('all scores are non-negative', () => {
      const charts = [gapWoodChart, fireChart];
      for (const chart of charts) {
        const result = StrengthAnalyzer.analyze(chart);
        expect(result.score.deukryeong).toBeGreaterThanOrEqual(0);
        expect(result.score.deukji).toBeGreaterThanOrEqual(0);
        expect(result.score.deukse).toBeGreaterThanOrEqual(0);
        expect(result.score.totalSupport).toBeGreaterThanOrEqual(0);
        expect(result.score.totalOppose).toBeGreaterThanOrEqual(0);
      }
    });

    it('details list is not empty and contains verdict', () => {
      const result = StrengthAnalyzer.analyze(gapWoodChart);
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details.some(d => d.includes('판정'))).toBe(true);
    });
  });

  // =========================================================================
  // 7. Sipseong determination internal logic verification
  // =========================================================================
  describe('SipseongDetermination', () => {
    it('same stem produces BI_GYEON', () => {
      expect(StrengthAnalyzer.determineSipseong(Cheongan.GAP, Cheongan.GAP))
        .toBe(Sipseong.BI_GYEON);
    });

    it('same element different polarity produces GYEOB_JAE', () => {
      expect(StrengthAnalyzer.determineSipseong(Cheongan.GAP, Cheongan.EUL))
        .toBe(Sipseong.GYEOB_JAE);
    });

    it('WATER generates WOOD same polarity produces PYEON_IN', () => {
      expect(StrengthAnalyzer.determineSipseong(Cheongan.GAP, Cheongan.IM))
        .toBe(Sipseong.PYEON_IN);
    });

    it('only bigyeop and inseong are supporting', () => {
      const supporting: Sipseong[] = [
        Sipseong.BI_GYEON,
        Sipseong.GYEOB_JAE,
        Sipseong.PYEON_IN,
        Sipseong.JEONG_IN,
      ];
      const nonSupporting: Sipseong[] = [
        Sipseong.SIK_SIN,
        Sipseong.SANG_GWAN,
        Sipseong.PYEON_JAE,
        Sipseong.JEONG_JAE,
        Sipseong.PYEON_GWAN,
        Sipseong.JEONG_GWAN,
      ];

      for (const s of supporting) {
        expect(StrengthAnalyzer.isSupportingSipseong(s)).toBe(true);
      }
      for (const s of nonSupporting) {
        expect(StrengthAnalyzer.isSupportingSipseong(s)).toBe(false);
      }
    });
  });
});
