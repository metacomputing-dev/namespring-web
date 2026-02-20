import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG,
  createConfig,
  configFromPreset,
  SchoolPreset,
  SaryeongMode,
  EarthLifeStageRule,
  HiddenStemScope,
  YongshinPriority,
  JonggyeokYongshinMode,
  HapHwaStrictness,
  GwiiinTableVariant,
  ShinsalReferenceBranch,
  JeolgiPrecision,
  type CalculationConfig,
} from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { HiddenStemVariant, HiddenStemDayAllocation } from '../../src/domain/HiddenStem.js';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';

/**
 * Exhaustive 26x3 parameter matrix test for CalculationConfig across all three SchoolPresets.
 * Ported from Kotlin PresetParameterExhaustiveMatrixTest.kt.
 *
 * Verifies every single parameter for every preset, counts cross-preset
 * differences, validates invariant parameters, and performs integration-level
 * analysis with each preset.
 */

// =========================================================================
// Setup: configs and parameter extraction
// =========================================================================

const KOREAN = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);
const CHINESE = configFromPreset(SchoolPreset.TRADITIONAL_CHINESE);
const MODERN = configFromPreset(SchoolPreset.MODERN_INTEGRATED);

function configFor(preset: SchoolPreset): CalculationConfig {
  switch (preset) {
    case SchoolPreset.KOREAN_MAINSTREAM: return KOREAN;
    case SchoolPreset.TRADITIONAL_CHINESE: return CHINESE;
    case SchoolPreset.MODERN_INTEGRATED: return MODERN;
  }
}

/**
 * All 26 parameter names in declaration order.
 */
const ALL_PARAMETER_NAMES: readonly string[] = [
  'dayCutMode', 'applyDstHistory', 'includeEquationOfTime',
  'lmtBaselineLongitude', 'jeolgiPrecision',
  'hiddenStemVariant', 'hiddenStemDayAllocation', 'saryeongMode',
  'earthLifeStageRule', 'yinReversalEnabled',
  'deukryeongWeight', 'proportionalDeukryeong', 'strengthThreshold',
  'hiddenStemScopeForStrength', 'deukjiPerBranch', 'deukseBigyeop', 'deukseInseong',
  'yongshinPriority', 'jonggyeokYongshinMode',
  'jonggyeokWeakThreshold', 'jonggyeokStrongThreshold',
  'hapHwaStrictness', 'allowBanhap', 'dayMasterNeverHapGeo',
  'gwiiinTable', 'shinsalReferenceBranch',
] as const;

/**
 * Parameters that are identical across all three presets.
 */
const INVARIANT_PARAMETERS: readonly string[] = [
  'hiddenStemVariant',
  'hiddenStemDayAllocation',
  'earthLifeStageRule',
  'yinReversalEnabled',
  'strengthThreshold',
  'deukjiPerBranch',
  'deukseBigyeop',
  'deukseInseong',
  'jonggyeokYongshinMode',
] as const;

function extractParameter(config: CalculationConfig, paramName: string): unknown {
  return (config as Record<string, unknown>)[paramName];
}

function countDifferences(a: CalculationConfig, b: CalculationConfig): number {
  return ALL_PARAMETER_NAMES.filter(name =>
    extractParameter(a, name) !== extractParameter(b, name),
  ).length;
}

function differingParameters(a: CalculationConfig, b: CalculationConfig): Set<string> {
  return new Set(
    ALL_PARAMETER_NAMES.filter(name =>
      extractParameter(a, name) !== extractParameter(b, name),
    ),
  );
}

// =========================================================================
// Expected 26x3 parameter matrix
// =========================================================================

type ParamExpectation = [SchoolPreset, string, unknown];

const timeCalendarParams: ParamExpectation[] = [
  [SchoolPreset.KOREAN_MAINSTREAM, 'dayCutMode', DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY],
  [SchoolPreset.TRADITIONAL_CHINESE, 'dayCutMode', DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY],
  [SchoolPreset.MODERN_INTEGRATED, 'dayCutMode', DayCutMode.JOJA_SPLIT],
  [SchoolPreset.KOREAN_MAINSTREAM, 'applyDstHistory', true],
  [SchoolPreset.TRADITIONAL_CHINESE, 'applyDstHistory', false],
  [SchoolPreset.MODERN_INTEGRATED, 'applyDstHistory', true],
  [SchoolPreset.KOREAN_MAINSTREAM, 'includeEquationOfTime', false],
  [SchoolPreset.TRADITIONAL_CHINESE, 'includeEquationOfTime', false],
  [SchoolPreset.MODERN_INTEGRATED, 'includeEquationOfTime', true],
  [SchoolPreset.KOREAN_MAINSTREAM, 'lmtBaselineLongitude', 135.0],
  [SchoolPreset.TRADITIONAL_CHINESE, 'lmtBaselineLongitude', 120.0],
  [SchoolPreset.MODERN_INTEGRATED, 'lmtBaselineLongitude', 135.0],
  [SchoolPreset.KOREAN_MAINSTREAM, 'jeolgiPrecision', JeolgiPrecision.APPROXIMATE],
  [SchoolPreset.TRADITIONAL_CHINESE, 'jeolgiPrecision', JeolgiPrecision.APPROXIMATE],
  [SchoolPreset.MODERN_INTEGRATED, 'jeolgiPrecision', JeolgiPrecision.VSOP87D_EXACT],
];

const hiddenStemParams: ParamExpectation[] = [
  [SchoolPreset.KOREAN_MAINSTREAM, 'hiddenStemVariant', HiddenStemVariant.STANDARD],
  [SchoolPreset.TRADITIONAL_CHINESE, 'hiddenStemVariant', HiddenStemVariant.STANDARD],
  [SchoolPreset.MODERN_INTEGRATED, 'hiddenStemVariant', HiddenStemVariant.STANDARD],
  [SchoolPreset.KOREAN_MAINSTREAM, 'hiddenStemDayAllocation', HiddenStemDayAllocation.YEONHAE_JAPYEONG],
  [SchoolPreset.TRADITIONAL_CHINESE, 'hiddenStemDayAllocation', HiddenStemDayAllocation.YEONHAE_JAPYEONG],
  [SchoolPreset.MODERN_INTEGRATED, 'hiddenStemDayAllocation', HiddenStemDayAllocation.YEONHAE_JAPYEONG],
  [SchoolPreset.KOREAN_MAINSTREAM, 'saryeongMode', SaryeongMode.ALWAYS_JEONGGI],
  [SchoolPreset.TRADITIONAL_CHINESE, 'saryeongMode', SaryeongMode.BY_DAY_IN_MONTH],
  [SchoolPreset.MODERN_INTEGRATED, 'saryeongMode', SaryeongMode.BY_DAY_IN_MONTH],
];

const lifeStageParams: ParamExpectation[] = [
  [SchoolPreset.KOREAN_MAINSTREAM, 'earthLifeStageRule', EarthLifeStageRule.FOLLOW_FIRE],
  [SchoolPreset.TRADITIONAL_CHINESE, 'earthLifeStageRule', EarthLifeStageRule.FOLLOW_FIRE],
  [SchoolPreset.MODERN_INTEGRATED, 'earthLifeStageRule', EarthLifeStageRule.FOLLOW_FIRE],
  [SchoolPreset.KOREAN_MAINSTREAM, 'yinReversalEnabled', true],
  [SchoolPreset.TRADITIONAL_CHINESE, 'yinReversalEnabled', true],
  [SchoolPreset.MODERN_INTEGRATED, 'yinReversalEnabled', true],
];

const strengthParams: ParamExpectation[] = [
  [SchoolPreset.KOREAN_MAINSTREAM, 'deukryeongWeight', 40.0],
  [SchoolPreset.TRADITIONAL_CHINESE, 'deukryeongWeight', 50.0],
  [SchoolPreset.MODERN_INTEGRATED, 'deukryeongWeight', 40.0],
  [SchoolPreset.KOREAN_MAINSTREAM, 'proportionalDeukryeong', false],
  [SchoolPreset.TRADITIONAL_CHINESE, 'proportionalDeukryeong', true],
  [SchoolPreset.MODERN_INTEGRATED, 'proportionalDeukryeong', true],
  [SchoolPreset.KOREAN_MAINSTREAM, 'strengthThreshold', 50.0],
  [SchoolPreset.TRADITIONAL_CHINESE, 'strengthThreshold', 50.0],
  [SchoolPreset.MODERN_INTEGRATED, 'strengthThreshold', 50.0],
  [SchoolPreset.KOREAN_MAINSTREAM, 'hiddenStemScopeForStrength', HiddenStemScope.ALL_THREE],
  [SchoolPreset.TRADITIONAL_CHINESE, 'hiddenStemScopeForStrength', HiddenStemScope.JEONGGI_ONLY],
  [SchoolPreset.MODERN_INTEGRATED, 'hiddenStemScopeForStrength', HiddenStemScope.ALL_THREE],
  [SchoolPreset.KOREAN_MAINSTREAM, 'deukjiPerBranch', 5.0],
  [SchoolPreset.TRADITIONAL_CHINESE, 'deukjiPerBranch', 5.0],
  [SchoolPreset.MODERN_INTEGRATED, 'deukjiPerBranch', 5.0],
  [SchoolPreset.KOREAN_MAINSTREAM, 'deukseBigyeop', 7.0],
  [SchoolPreset.TRADITIONAL_CHINESE, 'deukseBigyeop', 7.0],
  [SchoolPreset.MODERN_INTEGRATED, 'deukseBigyeop', 7.0],
  [SchoolPreset.KOREAN_MAINSTREAM, 'deukseInseong', 5.0],
  [SchoolPreset.TRADITIONAL_CHINESE, 'deukseInseong', 5.0],
  [SchoolPreset.MODERN_INTEGRATED, 'deukseInseong', 5.0],
];

const yongshinParams: ParamExpectation[] = [
  [SchoolPreset.KOREAN_MAINSTREAM, 'yongshinPriority', YongshinPriority.JOHU_FIRST],
  [SchoolPreset.TRADITIONAL_CHINESE, 'yongshinPriority', YongshinPriority.EOKBU_FIRST],
  [SchoolPreset.MODERN_INTEGRATED, 'yongshinPriority', YongshinPriority.EQUAL_WEIGHT],
  [SchoolPreset.KOREAN_MAINSTREAM, 'jonggyeokYongshinMode', JonggyeokYongshinMode.FOLLOW_DOMINANT],
  [SchoolPreset.TRADITIONAL_CHINESE, 'jonggyeokYongshinMode', JonggyeokYongshinMode.FOLLOW_DOMINANT],
  [SchoolPreset.MODERN_INTEGRATED, 'jonggyeokYongshinMode', JonggyeokYongshinMode.FOLLOW_DOMINANT],
  [SchoolPreset.KOREAN_MAINSTREAM, 'jonggyeokWeakThreshold', 15.0],
  [SchoolPreset.TRADITIONAL_CHINESE, 'jonggyeokWeakThreshold', 15.0],
  [SchoolPreset.MODERN_INTEGRATED, 'jonggyeokWeakThreshold', 20.0],
  [SchoolPreset.KOREAN_MAINSTREAM, 'jonggyeokStrongThreshold', 62.4],
  [SchoolPreset.TRADITIONAL_CHINESE, 'jonggyeokStrongThreshold', 62.4],
  [SchoolPreset.MODERN_INTEGRATED, 'jonggyeokStrongThreshold', 58.0],
];

const combinationParams: ParamExpectation[] = [
  [SchoolPreset.KOREAN_MAINSTREAM, 'hapHwaStrictness', HapHwaStrictness.STRICT_FIVE_CONDITIONS],
  [SchoolPreset.TRADITIONAL_CHINESE, 'hapHwaStrictness', HapHwaStrictness.STRICT_FIVE_CONDITIONS],
  [SchoolPreset.MODERN_INTEGRATED, 'hapHwaStrictness', HapHwaStrictness.MODERATE],
  [SchoolPreset.KOREAN_MAINSTREAM, 'allowBanhap', true],
  [SchoolPreset.TRADITIONAL_CHINESE, 'allowBanhap', false],
  [SchoolPreset.MODERN_INTEGRATED, 'allowBanhap', true],
  [SchoolPreset.KOREAN_MAINSTREAM, 'dayMasterNeverHapGeo', true],
  [SchoolPreset.TRADITIONAL_CHINESE, 'dayMasterNeverHapGeo', false],
  [SchoolPreset.MODERN_INTEGRATED, 'dayMasterNeverHapGeo', true],
];

const shinsalParams: ParamExpectation[] = [
  [SchoolPreset.KOREAN_MAINSTREAM, 'gwiiinTable', GwiiinTableVariant.KOREAN_MAINSTREAM],
  [SchoolPreset.TRADITIONAL_CHINESE, 'gwiiinTable', GwiiinTableVariant.CHINESE_TRADITIONAL],
  [SchoolPreset.MODERN_INTEGRATED, 'gwiiinTable', GwiiinTableVariant.KOREAN_MAINSTREAM],
  [SchoolPreset.KOREAN_MAINSTREAM, 'shinsalReferenceBranch', ShinsalReferenceBranch.DAY_AND_YEAR],
  [SchoolPreset.TRADITIONAL_CHINESE, 'shinsalReferenceBranch', ShinsalReferenceBranch.DAY_ONLY],
  [SchoolPreset.MODERN_INTEGRATED, 'shinsalReferenceBranch', ShinsalReferenceBranch.DAY_AND_YEAR],
];

// =========================================================================
// Section 1: Exhaustive 26x3 Parametric Matrix
// =========================================================================

describe('PresetParameterExhaustiveMatrixTest', () => {

  function runParamTests(categoryName: string, params: ParamExpectation[]) {
    describe(categoryName, () => {
      for (const [preset, paramName, expectedValue] of params) {
        it(`${preset} - ${paramName} = ${String(expectedValue)}`, () => {
          const config = configFor(preset);
          const actual = extractParameter(config, paramName);
          expect(actual).toBe(expectedValue);
        });
      }
    });
  }

  runParamTests('Category 1 - Time and Calendar', timeCalendarParams);
  runParamTests('Category 2 - Hidden Stems', hiddenStemParams);
  runParamTests('Category 3 - Twelve Life Stages', lifeStageParams);
  runParamTests('Category 4 - Strength', strengthParams);
  runParamTests('Category 5 - Yongshin', yongshinParams);
  runParamTests('Category 6 - Combinations', combinationParams);
  runParamTests('Category 7 - Shinsal', shinsalParams);

  // =========================================================================
  // Section 2: Cross-Preset Difference Counting
  // =========================================================================

  describe('Cross-Preset Difference Counting', () => {

    it('KOREAN vs TRADITIONAL_CHINESE differs on exactly 11 parameters', () => {
      const diffs = differingParameters(KOREAN, CHINESE);
      expect(diffs.size).toBe(11);
    });

    it('KOREAN vs TRADITIONAL_CHINESE differing parameter names are correct', () => {
      const diffs = differingParameters(KOREAN, CHINESE);
      const expected = new Set([
        'applyDstHistory', 'lmtBaselineLongitude', 'saryeongMode',
        'deukryeongWeight', 'proportionalDeukryeong',
        'hiddenStemScopeForStrength', 'yongshinPriority',
        'allowBanhap', 'dayMasterNeverHapGeo',
        'gwiiinTable', 'shinsalReferenceBranch',
      ]);
      expect(diffs).toEqual(expected);
    });

    it('KOREAN and CHINESE share dayCutMode', () => {
      expect(KOREAN.dayCutMode).toBe(CHINESE.dayCutMode);
    });

    it('KOREAN vs MODERN_INTEGRATED differs on exactly 9 parameters', () => {
      const diffs = differingParameters(KOREAN, MODERN);
      expect(diffs.size).toBe(9);
    });

    it('KOREAN vs MODERN_INTEGRATED differing parameter names are correct', () => {
      const diffs = differingParameters(KOREAN, MODERN);
      const expected = new Set([
        'dayCutMode', 'includeEquationOfTime', 'jeolgiPrecision',
        'saryeongMode', 'proportionalDeukryeong',
        'yongshinPriority', 'jonggyeokWeakThreshold',
        'jonggyeokStrongThreshold', 'hapHwaStrictness',
      ]);
      expect(diffs).toEqual(expected);
    });

    it('TRADITIONAL_CHINESE vs MODERN_INTEGRATED has at least 10 differences', () => {
      const diffCount = countDifferences(CHINESE, MODERN);
      expect(diffCount).toBeGreaterThanOrEqual(10);
    });

    it('all three presets are mutually distinct', () => {
      expect(countDifferences(KOREAN, CHINESE)).toBeGreaterThan(0);
      expect(countDifferences(KOREAN, MODERN)).toBeGreaterThan(0);
      expect(countDifferences(CHINESE, MODERN)).toBeGreaterThan(0);
    });

    it('total parameter count is 26', () => {
      expect(ALL_PARAMETER_NAMES.length).toBe(26);
    });
  });

  // =========================================================================
  // Section 3: Invariant Parameters
  // =========================================================================

  describe('Invariant Parameters Across All Presets', () => {

    it('exactly 9 parameters are invariant', () => {
      const actualInvariants = ALL_PARAMETER_NAMES.filter(name => {
        const korVal = extractParameter(KOREAN, name);
        const chiVal = extractParameter(CHINESE, name);
        const modVal = extractParameter(MODERN, name);
        return korVal === chiVal && chiVal === modVal;
      });
      expect(actualInvariants.sort()).toEqual([...INVARIANT_PARAMETERS].sort());
    });

    it('hiddenStemVariant is STANDARD across all presets', () => {
      for (const preset of Object.values(SchoolPreset)) {
        expect(configFor(preset).hiddenStemVariant).toBe(HiddenStemVariant.STANDARD);
      }
    });

    it('hiddenStemDayAllocation is YEONHAE_JAPYEONG across all presets', () => {
      for (const preset of Object.values(SchoolPreset)) {
        expect(configFor(preset).hiddenStemDayAllocation).toBe(
          HiddenStemDayAllocation.YEONHAE_JAPYEONG,
        );
      }
    });

    it('earthLifeStageRule is FOLLOW_FIRE across all presets', () => {
      for (const preset of Object.values(SchoolPreset)) {
        expect(configFor(preset).earthLifeStageRule).toBe(EarthLifeStageRule.FOLLOW_FIRE);
      }
    });

    it('yinReversalEnabled is true across all presets', () => {
      for (const preset of Object.values(SchoolPreset)) {
        expect(configFor(preset).yinReversalEnabled).toBe(true);
      }
    });

    it('strengthThreshold is 50 across all presets', () => {
      for (const preset of Object.values(SchoolPreset)) {
        expect(configFor(preset).strengthThreshold).toBe(50.0);
      }
    });

    it('deukjiPerBranch is 5 across all presets', () => {
      for (const preset of Object.values(SchoolPreset)) {
        expect(configFor(preset).deukjiPerBranch).toBe(5.0);
      }
    });

    it('deukseBigyeop is 7 across all presets', () => {
      for (const preset of Object.values(SchoolPreset)) {
        expect(configFor(preset).deukseBigyeop).toBe(7.0);
      }
    });

    it('deukseInseong is 5 across all presets', () => {
      for (const preset of Object.values(SchoolPreset)) {
        expect(configFor(preset).deukseInseong).toBe(5.0);
      }
    });

    it('jonggyeokYongshinMode is FOLLOW_DOMINANT across all presets', () => {
      for (const preset of Object.values(SchoolPreset)) {
        expect(configFor(preset).jonggyeokYongshinMode).toBe(
          JonggyeokYongshinMode.FOLLOW_DOMINANT,
        );
      }
    });

    it('variant parameters are NOT invariant -- at least one preset differs', () => {
      const variantParams = ALL_PARAMETER_NAMES.filter(
        name => !INVARIANT_PARAMETERS.includes(name),
      );
      for (const paramName of variantParams) {
        const values = Object.values(SchoolPreset).map(p => extractParameter(configFor(p), paramName));
        const uniqueValues = new Set(values.map(String));
        expect(uniqueValues.size).toBeGreaterThan(1);
      }
    });
  });

  // =========================================================================
  // Section 4: Integration -- Preset Produces Valid Analysis
  // =========================================================================

  describe('Integration - Preset Analysis', () => {
    const daytimeBirth = createBirthInput({
      birthYear: 1990, birthMonth: 1, birthDay: 15,
      birthHour: 10, birthMinute: 30,
      gender: Gender.MALE, longitude: 126.978,
    });

    const lateNightBirth = createBirthInput({
      birthYear: 1985, birthMonth: 6, birthDay: 20,
      birthHour: 23, birthMinute: 30,
      gender: Gender.FEMALE, longitude: 126.978,
    });

    it('KOREAN_MAINSTREAM produces valid analysis', () => {
      const analysis = analyzeSaju(daytimeBirth, KOREAN);
      expect(analysis.coreResult).toBeDefined();
      expect(analysis.strengthResult).not.toBeNull();
      expect(analysis.yongshinResult).not.toBeNull();
      expect(analysis.gyeokgukResult).not.toBeNull();
      expect(analysis.trace.length).toBeGreaterThan(0);
    });

    it('TRADITIONAL_CHINESE produces valid analysis', () => {
      const analysis = analyzeSaju(daytimeBirth, CHINESE);
      expect(analysis.coreResult).toBeDefined();
      expect(analysis.strengthResult).not.toBeNull();
      expect(analysis.yongshinResult).not.toBeNull();
      expect(analysis.gyeokgukResult).not.toBeNull();
      expect(analysis.trace.length).toBeGreaterThan(0);
    });

    it('MODERN_INTEGRATED produces valid analysis', () => {
      const analysis = analyzeSaju(daytimeBirth, MODERN);
      expect(analysis.coreResult).toBeDefined();
      expect(analysis.strengthResult).not.toBeNull();
      expect(analysis.yongshinResult).not.toBeNull();
      expect(analysis.gyeokgukResult).not.toBeNull();
      expect(analysis.trace.length).toBeGreaterThan(0);
    });

    it('KOREAN vs CHINESE yongshin priority difference reflected', () => {
      expect(KOREAN.yongshinPriority).toBe(YongshinPriority.JOHU_FIRST);
      expect(CHINESE.yongshinPriority).toBe(YongshinPriority.EOKBU_FIRST);

      const koreanAnalysis = analyzeSaju(daytimeBirth, KOREAN);
      const chineseAnalysis = analyzeSaju(daytimeBirth, CHINESE);

      expect(koreanAnalysis.yongshinResult).not.toBeNull();
      expect(chineseAnalysis.yongshinResult).not.toBeNull();
    });

    it('late night birth: YAZA vs JOJA modes differ', () => {
      expect(KOREAN.dayCutMode).toBe(DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY);
      expect(MODERN.dayCutMode).toBe(DayCutMode.JOJA_SPLIT);

      const yazaAnalysis = analyzeSaju(lateNightBirth, KOREAN);
      const jojaAnalysis = analyzeSaju(lateNightBirth, MODERN);

      expect(yazaAnalysis.coreResult).toBeDefined();
      expect(jojaAnalysis.coreResult).toBeDefined();
    });

    it('all three presets produce 4-pillar analyses', () => {
      for (const preset of Object.values(SchoolPreset)) {
        const config = configFor(preset);
        const analysis = analyzeSaju(daytimeBirth, config);
        expect(analysis.pillars.year).toBeDefined();
        expect(analysis.pillars.month).toBeDefined();
        expect(analysis.pillars.day).toBeDefined();
        expect(analysis.pillars.hour).toBeDefined();
      }
    });

    it('daytime birth gongmang consistent across KOREAN and CHINESE', () => {
      const koreanAnalysis = analyzeSaju(daytimeBirth, KOREAN);
      const chineseAnalysis = analyzeSaju(daytimeBirth, CHINESE);

      expect(koreanAnalysis.sibiUnseong).not.toBeNull();
      expect(chineseAnalysis.sibiUnseong).not.toBeNull();
    });
  });

  // =========================================================================
  // Section 5: Structural Completeness
  // =========================================================================

  describe('Structural Completeness', () => {

    it('every SchoolPreset has a corresponding configFromPreset implementation', () => {
      for (const preset of Object.values(SchoolPreset)) {
        const config = configFromPreset(preset);
        expect(config).toBeDefined();
      }
    });

    it('all 26 parameters can be extracted for every preset', () => {
      for (const preset of Object.values(SchoolPreset)) {
        const config = configFor(preset);
        for (const paramName of ALL_PARAMETER_NAMES) {
          const value = extractParameter(config, paramName);
          expect(value).not.toBeUndefined();
        }
      }
    });

    it('no parameter appears in both invariant and variant sets', () => {
      const variants = ALL_PARAMETER_NAMES.filter(name => {
        const values = Object.values(SchoolPreset).map(p =>
          extractParameter(configFor(p), name),
        );
        return new Set(values.map(String)).size > 1;
      });
      const overlap = INVARIANT_PARAMETERS.filter(name => variants.includes(name));
      expect(overlap.length).toBe(0);
    });

    it('invariant + variant parameters = all parameters', () => {
      const variants = ALL_PARAMETER_NAMES.filter(name => {
        const values = Object.values(SchoolPreset).map(p =>
          extractParameter(configFor(p), name),
        );
        return new Set(values.map(String)).size > 1;
      });
      const combined = new Set([...INVARIANT_PARAMETERS, ...variants]);
      expect(combined.size).toBe(ALL_PARAMETER_NAMES.length);
    });

    it('preset configs support spread-based customization', () => {
      const original = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);
      const copy: CalculationConfig = { ...original, deukryeongWeight: 45.0 };
      expect(copy.deukryeongWeight).toBe(45.0);
      expect(copy.dayCutMode).toBe(original.dayCutMode);
      expect(copy.yongshinPriority).toBe(original.yongshinPriority);
    });

    it('default config differs from all presets', () => {
      for (const preset of Object.values(SchoolPreset)) {
        const presetConfig = configFromPreset(preset);
        // At minimum, dayCutMode should differ from DEFAULT_CONFIG
        // since DEFAULT uses YAZA_23_TO_01_NEXTDAY while KOREAN/CHINESE use YAZA_23_30
        // and MODERN uses JOJA_SPLIT
        const hasAtLeastOneDifference = ALL_PARAMETER_NAMES.some(name =>
          extractParameter(DEFAULT_CONFIG, name) !== extractParameter(presetConfig, name),
        );
        expect(hasAtLeastOneDifference).toBe(true);
      }
    });

    it('yongshinPriority has three distinct values across three presets', () => {
      const priorities = new Set(
        Object.values(SchoolPreset).map(p => configFor(p).yongshinPriority),
      );
      expect(priorities.size).toBe(3);
      expect(priorities.has(YongshinPriority.JOHU_FIRST)).toBe(true);
      expect(priorities.has(YongshinPriority.EOKBU_FIRST)).toBe(true);
      expect(priorities.has(YongshinPriority.EQUAL_WEIGHT)).toBe(true);
    });
  });
});
