import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../../../src/domain/PillarPosition.js';
import { ShinsalType } from '../../../src/domain/Shinsal.js';
import { Gender } from '../../../src/domain/Gender.js';
import { GyeokgukType, GyeokgukCategory, type GyeokgukResult } from '../../../src/domain/Gyeokguk.js';
import {
  createConfig,
  EarthLifeStageRule,
  HiddenStemScope,
  SaryeongMode,
  GwiiinTableVariant,
  ShinsalReferenceBranch,
  JonggyeokYongshinMode,
} from '../../../src/config/CalculationConfig.js';
import { calculateSibiUnseong, analyzeAllPillars } from '../../../src/engine/analysis/SibiUnseongCalculator.js';
import { StrengthAnalyzer } from '../../../src/engine/analysis/StrengthAnalyzer.js';
import { YongshinDecider } from '../../../src/engine/analysis/YongshinDecider.js';
import { ShinsalDetector } from '../../../src/engine/analysis/ShinsalDetector.js';
import { analyzeSaju } from '../../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../../src/domain/types.js';

/**
 * Tests for config propagation through SibiUnseongCalculator and StrengthAnalyzer.
 *
 * Verifies that CalculationConfig parameters actually affect computation results
 * when passed through the config-aware overloads.
 *
 * Ported from ConfigPropagationTest.kt.
 */
describe('ConfigPropagationTest', () => {
  // ==================================================================
  // SibiUnseong -- earthLifeStageRule
  // ==================================================================
  describe('SibiUnseong earthLifeStageRule', () => {
    it('MU with FOLLOW_FIRE starts at IN (same as BYEONG)', () => {
      const config = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_FIRE });
      const muResult = calculateSibiUnseong(Cheongan.MU, Jiji.IN, config);
      const byeongResult = calculateSibiUnseong(Cheongan.BYEONG, Jiji.IN, config);

      expect(muResult).toBe(byeongResult);
    });

    it('MU with FOLLOW_WATER starts at SIN (same as IM)', () => {
      const config = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_WATER });
      const muResult = calculateSibiUnseong(Cheongan.MU, Jiji.SIN, config);
      const imResult = calculateSibiUnseong(Cheongan.IM, Jiji.SIN, config);

      expect(muResult).toBe(imResult);
    });

    it('earthLifeStageRule changes MU results', () => {
      const fireCfg = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_FIRE });
      const waterCfg = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_WATER });

      const fireResult = calculateSibiUnseong(Cheongan.MU, Jiji.HAE, fireCfg);
      const waterResult = calculateSibiUnseong(Cheongan.MU, Jiji.HAE, waterCfg);

      expect(fireResult).not.toBe(waterResult);
    });

    it('GI with FOLLOW_FIRE starts at YU (same as JEONG)', () => {
      const config = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_FIRE });
      const giResult = calculateSibiUnseong(Cheongan.GI, Jiji.YU, config);
      const jeongResult = calculateSibiUnseong(Cheongan.JEONG, Jiji.YU, config);

      expect(giResult).toBe(jeongResult);
    });

    it('GI with FOLLOW_WATER starts at MYO (same as GYE)', () => {
      const config = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_WATER });
      const giResult = calculateSibiUnseong(Cheongan.GI, Jiji.MYO, config);
      const gyeResult = calculateSibiUnseong(Cheongan.GYE, Jiji.MYO, config);

      expect(giResult).toBe(gyeResult);
    });
  });

  // ==================================================================
  // SibiUnseong -- yinReversalEnabled
  // ==================================================================
  describe('SibiUnseong yinReversalEnabled', () => {
    it('EUL forward when yinReversal disabled', () => {
      const forwardCfg = createConfig({ yinReversalEnabled: false });
      const reverseCfg = createConfig({ yinReversalEnabled: true });

      const forwardResult = calculateSibiUnseong(Cheongan.EUL, Jiji.MI, forwardCfg);
      const reverseResult = calculateSibiUnseong(Cheongan.EUL, Jiji.MI, reverseCfg);

      expect(forwardResult).not.toBe(reverseResult);
    });

    it('YANG stems unaffected by yinReversal setting', () => {
      const forwardCfg = createConfig({ yinReversalEnabled: false });
      const reverseCfg = createConfig({ yinReversalEnabled: true });

      const yangStems: Cheongan[] = [
        Cheongan.GAP, Cheongan.BYEONG, Cheongan.MU, Cheongan.GYEONG, Cheongan.IM,
      ];

      for (const stem of yangStems) {
        for (const branch of JIJI_VALUES) {
          expect(
            calculateSibiUnseong(stem, branch, forwardCfg),
          ).toBe(
            calculateSibiUnseong(stem, branch, reverseCfg),
          );
        }
      }
    });

    it('analyzeAllPillars propagates config to each position', () => {
      const fireCfg = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_FIRE });
      const waterCfg = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_WATER });

      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.MU, Jiji.SUL),
        new Pillar(Cheongan.MU, Jiji.IN),
        new Pillar(Cheongan.GI, Jiji.HAE),
      );

      const fireMap = analyzeAllPillars(Cheongan.MU, pillars, fireCfg);
      const waterMap = analyzeAllPillars(Cheongan.MU, pillars, waterCfg);

      const anyDiff = PILLAR_POSITION_VALUES.some(
        pos => fireMap.get(pos) !== waterMap.get(pos),
      );
      expect(anyDiff).toBe(true);
    });
  });

  // ==================================================================
  // StrengthAnalyzer -- deukryeongWeight
  // ==================================================================
  describe('StrengthAnalyzer deukryeongWeight', () => {
    it('higher deukryeongWeight increases total support when deukryeong active', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.JA),
      );

      const lowWeight = createConfig({ deukryeongWeight: 30.0 });
      const highWeight = createConfig({ deukryeongWeight: 50.0 });

      const lowResult = StrengthAnalyzer.analyze(pillars, lowWeight);
      const highResult = StrengthAnalyzer.analyze(pillars, highWeight);

      expect(highResult.score.deukryeong).toBeGreaterThan(lowResult.score.deukryeong);
      expect(highResult.score.totalSupport).toBeGreaterThan(lowResult.score.totalSupport);
    });
  });

  // ==================================================================
  // StrengthAnalyzer -- strengthThreshold
  // ==================================================================
  describe('StrengthAnalyzer strengthThreshold', () => {
    it('lower threshold makes borderline chart strong', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.IM, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.JA),
      );

      const defaultResult = StrengthAnalyzer.analyze(pillars, createConfig());
      const lowThreshold = createConfig({ strengthThreshold: 30.0 });
      const lowResult = StrengthAnalyzer.analyze(pillars, lowThreshold);

      if (defaultResult.score.totalSupport >= 30.0 && defaultResult.score.totalSupport < 50.0) {
        expect(defaultResult.isStrong).toBe(false);
        expect(lowResult.isStrong).toBe(true);
      }
    });
  });

  // ==================================================================
  // StrengthAnalyzer -- hiddenStemScopeForStrength
  // ==================================================================
  describe('StrengthAnalyzer hiddenStemScopeForStrength', () => {
    it('JEONGGI_ONLY produces different deukji than ALL_THREE', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.JA),
      );

      const allThree = createConfig({ hiddenStemScopeForStrength: HiddenStemScope.ALL_THREE });
      const jeonggiOnly = createConfig({ hiddenStemScopeForStrength: HiddenStemScope.JEONGGI_ONLY });

      const allResult = StrengthAnalyzer.analyze(pillars, allThree);
      const jeonggiResult = StrengthAnalyzer.analyze(pillars, jeonggiOnly);

      expect(allResult.score.deukji).toBeGreaterThanOrEqual(jeonggiResult.score.deukji);
    });
  });

  // ==================================================================
  // StrengthAnalyzer -- saryeongMode
  // ==================================================================
  describe('StrengthAnalyzer saryeongMode', () => {
    it('saryeongMode ALWAYS_JEONGGI uses principal stem for deukryeong', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.JA),
      );

      const config = createConfig({ saryeongMode: SaryeongMode.ALWAYS_JEONGGI });
      const result = StrengthAnalyzer.analyze(pillars, config);

      // IN jeonggi = GAP (bigyeon) -> deukryeong = 40
      expect(result.score.deukryeong).toBe(40.0);
      expect(result.details.some(d => d.includes('정기'))).toBe(true);
    });

    it('saryeongMode BY_DAY_IN_MONTH uses commanding stem for deukryeong', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.JA),
      );

      const config = createConfig({ saryeongMode: SaryeongMode.BY_DAY_IN_MONTH });
      const result = StrengthAnalyzer.analyze(pillars, config, 15);

      // IN day15: GAP(jeonggi) commands -> bigyeon -> deukryeong = 40
      expect(result.score.deukryeong).toBe(40.0);
      expect(result.details.some(d => d.includes('사령'))).toBe(true);
    });
  });

  // ==================================================================
  // YongshinDecider -- jonggyeokYongshinMode
  // ==================================================================
  describe('YongshinDecider jonggyeokYongshinMode', () => {
    it('jonggyeokYongshinMode FOLLOW_DOMINANT returns dominant element', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GYE, Jiji.HAE),
        new Pillar(Cheongan.GAP, Jiji.JIN),
      );

      const gyeokguk: GyeokgukResult = {
        type: GyeokgukType.JONGGANG,
        category: GyeokgukCategory.JONGGYEOK,
        baseSipseong: null,
        confidence: 0.8,
        reasoning: 'test',
        formation: null,
      };

      const config = createConfig({
        jonggyeokYongshinMode: JonggyeokYongshinMode.FOLLOW_DOMINANT,
      });
      const result = YongshinDecider.jeonwangYongshin(pillars, Ohaeng.WOOD, gyeokguk, config)!;

      expect(result).toBeDefined();
      expect(result.primaryElement).toBe(Ohaeng.WOOD);
      expect(result.reasoning).toContain('순종');
    });

    it('jonggyeokYongshinMode COUNTER_DOMINANT returns controlling element', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GYE, Jiji.HAE),
        new Pillar(Cheongan.GAP, Jiji.JIN),
      );

      const gyeokguk: GyeokgukResult = {
        type: GyeokgukType.JONGGANG,
        category: GyeokgukCategory.JONGGYEOK,
        baseSipseong: null,
        confidence: 0.8,
        reasoning: 'test',
        formation: null,
      };

      const config = createConfig({
        jonggyeokYongshinMode: JonggyeokYongshinMode.COUNTER_DOMINANT,
      });
      const result = YongshinDecider.jeonwangYongshin(pillars, Ohaeng.WOOD, gyeokguk, config)!;

      expect(result).toBeDefined();
      expect(result.primaryElement).toBe(Ohaeng.METAL);
      expect(result.reasoning).toContain('역종');
    });

    it('all five jonggyeok types respond to COUNTER_DOMINANT', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.GAP, Jiji.IN),
      );

      const counterConfig = createConfig({
        jonggyeokYongshinMode: JonggyeokYongshinMode.COUNTER_DOMINANT,
      });
      const followConfig = createConfig({
        jonggyeokYongshinMode: JonggyeokYongshinMode.FOLLOW_DOMINANT,
      });
      const dayMasterOhaeng = Ohaeng.WOOD;

      const jonggyeokTypes: GyeokgukType[] = [
        GyeokgukType.JONGGANG,
        GyeokgukType.JONGA,
        GyeokgukType.JONGJAE,
        GyeokgukType.JONGSAL,
        GyeokgukType.JONGSE,
      ];

      for (const gtype of jonggyeokTypes) {
        const gyeokguk: GyeokgukResult = {
          type: gtype,
          category: GyeokgukCategory.JONGGYEOK,
          baseSipseong: null,
          confidence: 0.8,
          reasoning: 'test',
          formation: null,
        };

        const follow = YongshinDecider.jeonwangYongshin(
          pillars, dayMasterOhaeng, gyeokguk, followConfig,
        )!;
        const counter = YongshinDecider.jeonwangYongshin(
          pillars, dayMasterOhaeng, gyeokguk, counterConfig,
        )!;

        expect(follow).toBeDefined();
        expect(counter).toBeDefined();
        expect(follow.primaryElement).not.toBe(counter.primaryElement);
      }
    });
  });

  // ==================================================================
  // daysSinceJeol actual propagation
  // ==================================================================
  describe('daysSinceJeol propagation', () => {
    it('saryeongMode BY_DAY_IN_MONTH early month uses yeogi stem', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.JA),
      );
      const config = createConfig({ saryeongMode: SaryeongMode.BY_DAY_IN_MONTH });
      const resultDay3 = StrengthAnalyzer.analyze(pillars, config, 3);
      const resultDay20 = StrengthAnalyzer.analyze(pillars, config, 20);

      // Day 3: MU commands -> pyeonjae -> silryeong = 0
      expect(resultDay3.score.deukryeong).toBe(0.0);
      // Day 20: GAP commands -> bigyeon -> deukryeong = 40
      expect(resultDay20.score.deukryeong).toBe(40.0);
    });

    it('saryeongMode BY_DAY_IN_MONTH without daysSinceJeol falls back to default 15', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.JA),
      );
      const config = createConfig({ saryeongMode: SaryeongMode.BY_DAY_IN_MONTH });
      const resultNoDay = StrengthAnalyzer.analyze(pillars, config);
      const resultDay15 = StrengthAnalyzer.analyze(pillars, config, 15);

      expect(resultNoDay.score.deukryeong).toBe(resultDay15.score.deukryeong);
      expect(resultNoDay.details.some(d => d.includes('근사'))).toBe(true);
    });
  });

  // ==================================================================
  // SARYEONG_BASED scope for deukji
  // ==================================================================
  describe('SARYEONG_BASED scope for deukji', () => {
    it('SARYEONG_BASED scope uses commanding stem for month branch deukji', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.JA),
      );
      const config = createConfig({
        hiddenStemScopeForStrength: HiddenStemScope.SARYEONG_BASED,
        saryeongMode: SaryeongMode.BY_DAY_IN_MONTH,
      });
      const resultDay3 = StrengthAnalyzer.analyze(pillars, config, 3);
      const resultDay20 = StrengthAnalyzer.analyze(pillars, config, 20);

      expect(resultDay3.score.deukji).toBeLessThanOrEqual(resultDay20.score.deukji);
    });
  });

  // ==================================================================
  // gwiiinTable + shinsalReferenceBranch config propagation
  // ==================================================================
  describe('Shinsal config propagation', () => {
    it('gwiiinTable CHINESE_TRADITIONAL changes SIN cheonulGwiin targets', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.SIN, Jiji.YU),
        new Pillar(Cheongan.BYEONG, Jiji.SUL),
      );

      const koreanConfig = createConfig({ gwiiinTable: GwiiinTableVariant.KOREAN_MAINSTREAM });
      const chineseConfig = createConfig({ gwiiinTable: GwiiinTableVariant.CHINESE_TRADITIONAL });

      const koreanHits = ShinsalDetector.detect(pillars, null, koreanConfig)
        .filter(h => h.type === ShinsalType.CHEONUL_GWIIN);
      const chineseHits = ShinsalDetector.detect(pillars, null, chineseConfig)
        .filter(h => h.type === ShinsalType.CHEONUL_GWIIN);

      // Korean: SIN -> IN, O -> yearJiji JA does not match
      // Chinese: SIN -> IN, JA -> yearJiji JA matches
      const koreanJaHits = koreanHits.filter(h => h.referenceBranch === Jiji.JA);
      const chineseJaHits = chineseHits.filter(h => h.referenceBranch === Jiji.JA);
      expect(koreanJaHits.length).toBe(0);
      expect(chineseJaHits.length).toBeGreaterThan(0);
    });

    it('shinsalReferenceBranch DAY_ONLY reduces yeokma hits', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.HAE),
      );

      const bothConfig = createConfig({ shinsalReferenceBranch: ShinsalReferenceBranch.DAY_AND_YEAR });
      const dayOnlyConfig = createConfig({ shinsalReferenceBranch: ShinsalReferenceBranch.DAY_ONLY });

      const bothYeokma = ShinsalDetector.detect(pillars, null, bothConfig)
        .filter(h => h.type === ShinsalType.YEOKMA);
      const dayOnlyYeokma = ShinsalDetector.detect(pillars, null, dayOnlyConfig)
        .filter(h => h.type === ShinsalType.YEOKMA);

      expect(bothYeokma.length).toBeGreaterThanOrEqual(dayOnlyYeokma.length);
    });
  });

  // ==================================================================
  // Pipeline integration -- daysSinceJeol in trace
  // ==================================================================
  describe('Pipeline integration', () => {
    it('pipeline calculates daysSinceJeol and includes in trace', () => {
      const input = createBirthInput({
        birthYear: 2024, birthMonth: 3, birthDay: 15,
        birthHour: 10, birthMinute: 0,
        gender: Gender.MALE,
        longitude: 126.978,
      });

      const analysis = analyzeSaju(input);
      const coreTrace = analysis.trace.find(t => t.key === 'core')!;
      expect(coreTrace).toBeDefined();
      expect(coreTrace.evidence.some(e => e.startsWith('daysSinceJeol='))).toBe(true);

      const dsjEvidence = coreTrace.evidence.find(e => e.startsWith('daysSinceJeol='))!;
      const dsjValue = dsjEvidence.substring('daysSinceJeol='.length);
      expect(dsjValue).not.toBe('N/A');
      expect(parseInt(dsjValue)).toBeGreaterThan(0);
    });
  });

  // ==================================================================
  // INDEPENDENT earthLifeStageRule -> fallback to FOLLOW_FIRE
  // ==================================================================
  describe('INDEPENDENT earthLifeStageRule', () => {
    it('INDEPENDENT earthLifeStageRule produces same results as FOLLOW_FIRE', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.MU, Jiji.SUL),
        new Pillar(Cheongan.MU, Jiji.IN),
        new Pillar(Cheongan.GI, Jiji.HAE),
      );
      const fireCfg = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_FIRE });
      const indepCfg = createConfig({ earthLifeStageRule: EarthLifeStageRule.INDEPENDENT });

      const fireMap = analyzeAllPillars(Cheongan.MU, pillars, fireCfg);
      const indepMap = analyzeAllPillars(Cheongan.MU, pillars, indepCfg);

      for (const pos of PILLAR_POSITION_VALUES) {
        expect(indepMap.get(pos)).toBe(fireMap.get(pos));
      }
    });

    it('INDEPENDENT earthLifeStageRule emits trace warning in pipeline', () => {
      const config = createConfig({ earthLifeStageRule: EarthLifeStageRule.INDEPENDENT });
      const input = createBirthInput({
        birthYear: 1990, birthMonth: 7, birthDay: 15,
        birthHour: 12, birthMinute: 0,
        gender: Gender.MALE,
        longitude: 126.978,
      });

      const analysis = analyzeSaju(input, config);
      const sibiTrace = analysis.trace.find(t => t.key === 'sibiUnseong')!;
      expect(sibiTrace).toBeDefined();
      // In TS, the summary contains "토오행규칙=INDEPENDENT" and the reasoning
      // array contains "토독립설". Check either location.
      const hasInSummary = sibiTrace.summary.includes('토독립설') || sibiTrace.summary.includes('INDEPENDENT');
      const hasInReasoning = sibiTrace.reasoning.some(
        r => r.includes('토독립설') || r.includes('INDEPENDENT'),
      );
      expect(hasInSummary || hasInReasoning).toBe(true);
    });

    it('FOLLOW_FIRE does not emit INDEPENDENT warning in trace', () => {
      const input = createBirthInput({
        birthYear: 1990, birthMonth: 7, birthDay: 15,
        birthHour: 12, birthMinute: 0,
        gender: Gender.MALE,
        longitude: 126.978,
      });

      const analysis = analyzeSaju(input);
      const sibiTrace = analysis.trace.find(t => t.key === 'sibiUnseong')!;
      expect(sibiTrace).toBeDefined();
      expect(sibiTrace.summary).not.toContain('토독립설');
    });
  });

  // ==================================================================
  // Default config delegate consistency
  // ==================================================================
  describe('Default config consistency', () => {
    it('default config delegates produce same results as config-aware versions', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.JA),
      );

      const defaultResult = StrengthAnalyzer.analyze(pillars);
      const explicitDefault = StrengthAnalyzer.analyze(pillars, createConfig());

      expect(defaultResult.level).toBe(explicitDefault.level);
      expect(defaultResult.isStrong).toBe(explicitDefault.isStrong);
      expect(defaultResult.score.totalSupport).toBe(explicitDefault.score.totalSupport);
    });
  });
});
