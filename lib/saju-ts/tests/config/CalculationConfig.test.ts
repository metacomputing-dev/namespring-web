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

/**
 * Comprehensive tests for CalculationConfig, SchoolPreset presets,
 * and all school-configuration enums.
 * Ported from Kotlin CalculationConfigTest.kt.
 */

describe('CalculationConfigTest', () => {

  // =========================================================================
  // Preset: KOREAN_MAINSTREAM
  // =========================================================================

  describe('Korean Mainstream Preset', () => {
    const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

    it('day cut mode is YAZA_23_30', () => {
      expect(config.dayCutMode).toBe(DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY);
    });

    it('DST history is applied', () => {
      expect(config.applyDstHistory).toBe(true);
    });

    it('equation of time is disabled', () => {
      expect(config.includeEquationOfTime).toBe(false);
    });

    it('LMT baseline is 135 degrees (modern KST)', () => {
      expect(config.lmtBaselineLongitude).toBe(135.0);
    });

    it('jeolgi precision is approximate', () => {
      expect(config.jeolgiPrecision).toBe(JeolgiPrecision.APPROXIMATE);
    });

    it('hidden stem variant is standard', () => {
      expect(config.hiddenStemVariant).toBe(HiddenStemVariant.STANDARD);
    });

    it('hidden stem day allocation is Yeonhae Japyeong', () => {
      expect(config.hiddenStemDayAllocation).toBe(HiddenStemDayAllocation.YEONHAE_JAPYEONG);
    });

    it('saryeong mode is always jeonggi', () => {
      expect(config.saryeongMode).toBe(SaryeongMode.ALWAYS_JEONGGI);
    });

    it('earth life stage rule follows fire', () => {
      expect(config.earthLifeStageRule).toBe(EarthLifeStageRule.FOLLOW_FIRE);
    });

    it('yin reversal is enabled', () => {
      expect(config.yinReversalEnabled).toBe(true);
    });

    it('deukryeong weight is 40', () => {
      expect(config.deukryeongWeight).toBe(40.0);
    });

    it('strength threshold is 50', () => {
      expect(config.strengthThreshold).toBe(50.0);
    });

    it('hidden stem scope includes all three', () => {
      expect(config.hiddenStemScopeForStrength).toBe(HiddenStemScope.ALL_THREE);
    });

    it('yongshin priority is johu first', () => {
      expect(config.yongshinPriority).toBe(YongshinPriority.JOHU_FIRST);
    });

    it('jonggyeok yongshin follows dominant', () => {
      expect(config.jonggyeokYongshinMode).toBe(JonggyeokYongshinMode.FOLLOW_DOMINANT);
    });

    it('hap hwa strictness is strict five conditions', () => {
      expect(config.hapHwaStrictness).toBe(HapHwaStrictness.STRICT_FIVE_CONDITIONS);
    });

    it('banhap is allowed', () => {
      expect(config.allowBanhap).toBe(true);
    });

    it('day master never hap geo', () => {
      expect(config.dayMasterNeverHapGeo).toBe(true);
    });

    it('gwiin table is Korean mainstream', () => {
      expect(config.gwiiinTable).toBe(GwiiinTableVariant.KOREAN_MAINSTREAM);
    });

    it('shinsal reference branch is day and year', () => {
      expect(config.shinsalReferenceBranch).toBe(ShinsalReferenceBranch.DAY_AND_YEAR);
    });
  });

  // =========================================================================
  // Preset: TRADITIONAL_CHINESE
  // =========================================================================

  describe('Traditional Chinese Preset', () => {
    const config = configFromPreset(SchoolPreset.TRADITIONAL_CHINESE);

    it('DST history is NOT applied', () => {
      expect(config.applyDstHistory).toBe(false);
    });

    it('LMT baseline is 120 degrees (Chinese CST)', () => {
      expect(config.lmtBaselineLongitude).toBe(120.0);
    });

    it('saryeong mode is by day in month', () => {
      expect(config.saryeongMode).toBe(SaryeongMode.BY_DAY_IN_MONTH);
    });

    it('deukryeong weight is higher at 50', () => {
      expect(config.deukryeongWeight).toBe(50.0);
    });

    it('hidden stem scope is jeonggi only (conservative)', () => {
      expect(config.hiddenStemScopeForStrength).toBe(HiddenStemScope.JEONGGI_ONLY);
    });

    it('yongshin priority is eokbu first', () => {
      expect(config.yongshinPriority).toBe(YongshinPriority.EOKBU_FIRST);
    });

    it('banhap is NOT allowed (strict samhap)', () => {
      expect(config.allowBanhap).toBe(false);
    });

    it('day master CAN be hap geo (Chinese position)', () => {
      expect(config.dayMasterNeverHapGeo).toBe(false);
    });

    it('gwiin table is Chinese traditional', () => {
      expect(config.gwiiinTable).toBe(GwiiinTableVariant.CHINESE_TRADITIONAL);
    });

    it('shinsal reference branch is day only', () => {
      expect(config.shinsalReferenceBranch).toBe(ShinsalReferenceBranch.DAY_ONLY);
    });

    it('differs from Korean mainstream on multiple options', () => {
      const korean = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);
      expect(config.applyDstHistory).not.toBe(korean.applyDstHistory);
      expect(config.lmtBaselineLongitude).not.toBe(korean.lmtBaselineLongitude);
      expect(config.saryeongMode).not.toBe(korean.saryeongMode);
      expect(config.deukryeongWeight).not.toBe(korean.deukryeongWeight);
      expect(config.hiddenStemScopeForStrength).not.toBe(korean.hiddenStemScopeForStrength);
      expect(config.yongshinPriority).not.toBe(korean.yongshinPriority);
      expect(config.allowBanhap).not.toBe(korean.allowBanhap);
      expect(config.dayMasterNeverHapGeo).not.toBe(korean.dayMasterNeverHapGeo);
      expect(config.gwiiinTable).not.toBe(korean.gwiiinTable);
      expect(config.shinsalReferenceBranch).not.toBe(korean.shinsalReferenceBranch);
    });
  });

  // =========================================================================
  // Preset: MODERN_INTEGRATED
  // =========================================================================

  describe('Modern Integrated Preset', () => {
    const config = configFromPreset(SchoolPreset.MODERN_INTEGRATED);

    it('day cut mode is JOJA_SPLIT', () => {
      expect(config.dayCutMode).toBe(DayCutMode.JOJA_SPLIT);
    });

    it('equation of time is enabled', () => {
      expect(config.includeEquationOfTime).toBe(true);
    });

    it('jeolgi precision is VSOP87D exact', () => {
      expect(config.jeolgiPrecision).toBe(JeolgiPrecision.VSOP87D_EXACT);
    });

    it('saryeong mode is by day in month', () => {
      expect(config.saryeongMode).toBe(SaryeongMode.BY_DAY_IN_MONTH);
    });

    it('yongshin priority is equal weight', () => {
      expect(config.yongshinPriority).toBe(YongshinPriority.EQUAL_WEIGHT);
    });

    it('hap hwa strictness is moderate', () => {
      expect(config.hapHwaStrictness).toBe(HapHwaStrictness.MODERATE);
    });

    it('DST history is applied', () => {
      expect(config.applyDstHistory).toBe(true);
    });

    it('banhap is allowed', () => {
      expect(config.allowBanhap).toBe(true);
    });

    it('day master never hap geo (maintained)', () => {
      expect(config.dayMasterNeverHapGeo).toBe(true);
    });

    it('differs from Korean mainstream on specific options', () => {
      const korean = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);
      expect(config.dayCutMode).not.toBe(korean.dayCutMode);
      expect(config.includeEquationOfTime).not.toBe(korean.includeEquationOfTime);
      expect(config.jeolgiPrecision).not.toBe(korean.jeolgiPrecision);
      expect(config.saryeongMode).not.toBe(korean.saryeongMode);
      expect(config.yongshinPriority).not.toBe(korean.yongshinPriority);
      expect(config.hapHwaStrictness).not.toBe(korean.hapHwaStrictness);
    });
  });

  // =========================================================================
  // Enum correctness
  // =========================================================================

  describe('Enum Values', () => {

    it('SaryeongMode has correct entries', () => {
      const values = Object.values(SaryeongMode);
      expect(values.length).toBe(2);
      expect(values).toContain(SaryeongMode.ALWAYS_JEONGGI);
      expect(values).toContain(SaryeongMode.BY_DAY_IN_MONTH);
    });

    it('EarthLifeStageRule has correct entries', () => {
      const values = Object.values(EarthLifeStageRule);
      expect(values.length).toBe(3);
      expect(values).toContain(EarthLifeStageRule.FOLLOW_FIRE);
      expect(values).toContain(EarthLifeStageRule.FOLLOW_WATER);
      expect(values).toContain(EarthLifeStageRule.INDEPENDENT);
    });

    it('HiddenStemScope has correct entries', () => {
      const values = Object.values(HiddenStemScope);
      expect(values.length).toBe(3);
      expect(values).toContain(HiddenStemScope.ALL_THREE);
      expect(values).toContain(HiddenStemScope.JEONGGI_ONLY);
      expect(values).toContain(HiddenStemScope.SARYEONG_BASED);
    });

    it('YongshinPriority has correct entries', () => {
      const values = Object.values(YongshinPriority);
      expect(values.length).toBe(3);
      expect(values).toContain(YongshinPriority.JOHU_FIRST);
      expect(values).toContain(YongshinPriority.EOKBU_FIRST);
      expect(values).toContain(YongshinPriority.EQUAL_WEIGHT);
    });

    it('JonggyeokYongshinMode has correct entries', () => {
      const values = Object.values(JonggyeokYongshinMode);
      expect(values.length).toBe(2);
      expect(values).toContain(JonggyeokYongshinMode.FOLLOW_DOMINANT);
      expect(values).toContain(JonggyeokYongshinMode.COUNTER_DOMINANT);
    });

    it('HapHwaStrictness has correct entries', () => {
      const values = Object.values(HapHwaStrictness);
      expect(values.length).toBe(3);
      expect(values).toContain(HapHwaStrictness.STRICT_FIVE_CONDITIONS);
      expect(values).toContain(HapHwaStrictness.MODERATE);
      expect(values).toContain(HapHwaStrictness.LENIENT);
    });

    it('GwiiinTableVariant has correct entries', () => {
      const values = Object.values(GwiiinTableVariant);
      expect(values.length).toBe(2);
      expect(values).toContain(GwiiinTableVariant.KOREAN_MAINSTREAM);
      expect(values).toContain(GwiiinTableVariant.CHINESE_TRADITIONAL);
    });

    it('ShinsalReferenceBranch has correct entries', () => {
      const values = Object.values(ShinsalReferenceBranch);
      expect(values.length).toBe(3);
      expect(values).toContain(ShinsalReferenceBranch.DAY_ONLY);
      expect(values).toContain(ShinsalReferenceBranch.YEAR_ONLY);
      expect(values).toContain(ShinsalReferenceBranch.DAY_AND_YEAR);
    });

    it('JeolgiPrecision has correct entries', () => {
      const values = Object.values(JeolgiPrecision);
      expect(values.length).toBe(2);
      expect(values).toContain(JeolgiPrecision.APPROXIMATE);
      expect(values).toContain(JeolgiPrecision.VSOP87D_EXACT);
    });

    it('SchoolPreset has three entries', () => {
      expect(Object.values(SchoolPreset).length).toBe(3);
    });

    it('DayCutMode has four entries', () => {
      expect(Object.values(DayCutMode).length).toBe(4);
    });
  });

  // =========================================================================
  // Validation (TS uses createConfig, no runtime validation by default --
  // these tests verify the interface contract is preserved)
  // =========================================================================

  describe('Default Config', () => {
    it('default constructor produces valid config', () => {
      const config = DEFAULT_CONFIG;
      expect(config.dayCutMode).toBe(DayCutMode.YAZA_23_TO_01_NEXTDAY);
      expect(config.deukryeongWeight).toBe(40.0);
      expect(config.strengthThreshold).toBe(50.0);
    });

    it('valid edge values are accepted', () => {
      // These should not throw
      createConfig({ deukryeongWeight: 0.0 });
      createConfig({ deukryeongWeight: 100.0 });
      createConfig({ strengthThreshold: 0.0 });
      createConfig({ strengthThreshold: 200.0 });
      createConfig({ lmtBaselineLongitude: -180.0 });
      createConfig({ lmtBaselineLongitude: 360.0 });
    });
  });

  // =========================================================================
  // Copy / customization
  // =========================================================================

  describe('Copy Customization', () => {
    it('preset can be customized via spread', () => {
      const base = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);
      const custom: CalculationConfig = {
        ...base,
        deukryeongWeight: 45.0,
        yongshinPriority: YongshinPriority.EOKBU_FIRST,
      };

      // Changed values
      expect(custom.deukryeongWeight).toBe(45.0);
      expect(custom.yongshinPriority).toBe(YongshinPriority.EOKBU_FIRST);

      // Unchanged values remain from Korean mainstream
      expect(custom.dayCutMode).toBe(DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY);
      expect(custom.applyDstHistory).toBe(true);
      expect(custom.hiddenStemVariant).toBe(HiddenStemVariant.STANDARD);
      expect(custom.allowBanhap).toBe(true);
    });
  });

  // =========================================================================
  // Cross-preset consistency
  // =========================================================================

  describe('Cross Preset Consistency', () => {
    const ALL_PRESETS = [
      SchoolPreset.KOREAN_MAINSTREAM,
      SchoolPreset.TRADITIONAL_CHINESE,
      SchoolPreset.MODERN_INTEGRATED,
    ];

    it('all presets share same yin reversal setting', () => {
      for (const preset of ALL_PRESETS) {
        const config = configFromPreset(preset);
        expect(config.yinReversalEnabled).toBe(true);
      }
    });

    it('all presets share same earth life stage rule', () => {
      for (const preset of ALL_PRESETS) {
        const config = configFromPreset(preset);
        expect(config.earthLifeStageRule).toBe(EarthLifeStageRule.FOLLOW_FIRE);
      }
    });

    it('all presets share same strength threshold', () => {
      for (const preset of ALL_PRESETS) {
        const config = configFromPreset(preset);
        expect(config.strengthThreshold).toBe(50.0);
      }
    });

    it('all presets use standard hidden stem variant', () => {
      for (const preset of ALL_PRESETS) {
        const config = configFromPreset(preset);
        expect(config.hiddenStemVariant).toBe(HiddenStemVariant.STANDARD);
      }
    });

    it('all presets use Yeonhae Japyeong day allocation', () => {
      for (const preset of ALL_PRESETS) {
        const config = configFromPreset(preset);
        expect(config.hiddenStemDayAllocation).toBe(HiddenStemDayAllocation.YEONHAE_JAPYEONG);
      }
    });

    it('each preset produces a distinct configuration', () => {
      const configs = ALL_PRESETS.map(p => configFromPreset(p));
      // All three must be different from each other on at least one field
      expect(configs[0]!.dayCutMode !== configs[2]!.dayCutMode
        || configs[0]!.yongshinPriority !== configs[2]!.yongshinPriority).toBe(true);
      expect(configs[0]!.applyDstHistory !== configs[1]!.applyDstHistory
        || configs[0]!.lmtBaselineLongitude !== configs[1]!.lmtBaselineLongitude).toBe(true);
      expect(configs[1]!.includeEquationOfTime !== configs[2]!.includeEquationOfTime
        || configs[1]!.hapHwaStrictness !== configs[2]!.hapHwaStrictness).toBe(true);
    });
  });
});
