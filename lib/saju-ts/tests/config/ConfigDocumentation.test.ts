import { describe, it, expect } from 'vitest';
import {
  ConfigDocumentation,
  ConfigOption,
  ConfigDifference,
} from '../../src/config/ConfigDocumentation.js';
import {
  CalculationConfig,
  configFromPreset,
  createConfig,
  DEFAULT_CONFIG,
  SchoolPreset,
  EarthLifeStageRule,
  GwiiinTableVariant,
  HapHwaStrictness,
  HiddenStemScope,
  JeolgiPrecision,
  JonggyeokYongshinMode,
  SaryeongMode,
  ShinsalReferenceBranch,
  YongshinPriority,
} from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { HiddenStemVariant, HiddenStemDayAllocation } from '../../src/domain/HiddenStem.js';

// =========================================================================
// ConfigDocumentation
// =========================================================================
describe('ConfigDocumentation', () => {
  describe('allOptions', () => {
    it('returns at least 17 options', () => {
      const options = ConfigDocumentation.allOptions();
      expect(options.length).toBeGreaterThanOrEqual(17);
    });

    it('returns exactly 23 options (full catalogue)', () => {
      const options = ConfigDocumentation.allOptions();
      expect(options.length).toBe(23);
    });

    it('all options have non-blank fields', () => {
      for (const option of ConfigDocumentation.allOptions()) {
        expect(option.key.trim()).not.toBe('');
        expect(option.koreanName.trim()).not.toBe('');
        expect(option.description.trim()).not.toBe('');
        expect(option.defaultValue.trim()).not.toBe('');
        expect(option.possibleValues.length).toBeGreaterThan(0);
        expect(option.affectedCalculation.trim()).not.toBe('');
      }
    });

    it('all option keys are unique', () => {
      const keys = ConfigDocumentation.allOptions().map((o) => o.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it('all option keys correspond to CalculationConfig properties', () => {
      const configKeys = Object.keys(DEFAULT_CONFIG);
      for (const option of ConfigDocumentation.allOptions()) {
        expect(configKeys).toContain(option.key);
      }
    });

    it('defaultValue is included in possibleValues for enum options', () => {
      for (const option of ConfigDocumentation.allOptions()) {
        expect(option.possibleValues).toContain(option.defaultValue);
      }
    });
  });

  // =========================================================================
  // presetDifferences
  // =========================================================================
  describe('presetDifferences', () => {
    it('KOREAN_MAINSTREAM returns empty', () => {
      const diffs = ConfigDocumentation.presetDifferences(SchoolPreset.KOREAN_MAINSTREAM);
      expect(diffs).toHaveLength(0);
    });

    it('TRADITIONAL_CHINESE returns non-empty with at least 8 differences', () => {
      const diffs = ConfigDocumentation.presetDifferences(SchoolPreset.TRADITIONAL_CHINESE);
      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs.length).toBeGreaterThanOrEqual(8);
    });

    it('MODERN_INTEGRATED returns non-empty with at least 5 differences', () => {
      const diffs = ConfigDocumentation.presetDifferences(SchoolPreset.MODERN_INTEGRATED);
      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs.length).toBeGreaterThanOrEqual(5);
    });

    it('TRADITIONAL_CHINESE contains expected keys', () => {
      const keys = new Set(
        ConfigDocumentation.presetDifferences(SchoolPreset.TRADITIONAL_CHINESE).map((d) => d.key),
      );

      expect(keys.has('applyDstHistory')).toBe(true);
      expect(keys.has('lmtBaselineLongitude')).toBe(true);
      expect(keys.has('yongshinPriority')).toBe(true);
      expect(keys.has('gwiiinTable')).toBe(true);
      expect(keys.has('allowBanhap')).toBe(true);
      expect(keys.has('proportionalDeukryeong')).toBe(true);
    });

    it('MODERN_INTEGRATED contains expected keys', () => {
      const keys = new Set(
        ConfigDocumentation.presetDifferences(SchoolPreset.MODERN_INTEGRATED).map((d) => d.key),
      );

      expect(keys.has('dayCutMode')).toBe(true);
      expect(keys.has('includeEquationOfTime')).toBe(true);
      expect(keys.has('yongshinPriority')).toBe(true);
      expect(keys.has('hapHwaStrictness')).toBe(true);
      expect(keys.has('proportionalDeukryeong')).toBe(true);
      expect(keys.has('jonggyeokWeakThreshold')).toBe(true);
      expect(keys.has('jonggyeokStrongThreshold')).toBe(true);
    });

    it('all differences have non-blank reasoning and distinct values', () => {
      for (const preset of [SchoolPreset.TRADITIONAL_CHINESE, SchoolPreset.MODERN_INTEGRATED]) {
        const diffs = ConfigDocumentation.presetDifferences(preset);
        for (const diff of diffs) {
          expect(diff.reasoning.trim()).not.toBe('');
          expect(diff.koreanMainstreamValue.trim()).not.toBe('');
          expect(diff.presetValue.trim()).not.toBe('');
          expect(diff.koreanMainstreamValue).not.toBe(diff.presetValue);
        }
      }
    });
  });
});

// =========================================================================
// Preset: KOREAN_MAINSTREAM
// =========================================================================
describe('KoreanMainstreamPreset', () => {
  const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

  it('day cut mode is YAZA 23-30', () => {
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
describe('TraditionalChinesePreset', () => {
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
    expect(korean.applyDstHistory).not.toBe(config.applyDstHistory);
    expect(korean.lmtBaselineLongitude).not.toBe(config.lmtBaselineLongitude);
    expect(korean.saryeongMode).not.toBe(config.saryeongMode);
    expect(korean.deukryeongWeight).not.toBe(config.deukryeongWeight);
    expect(korean.hiddenStemScopeForStrength).not.toBe(config.hiddenStemScopeForStrength);
    expect(korean.yongshinPriority).not.toBe(config.yongshinPriority);
    expect(korean.allowBanhap).not.toBe(config.allowBanhap);
    expect(korean.dayMasterNeverHapGeo).not.toBe(config.dayMasterNeverHapGeo);
    expect(korean.gwiiinTable).not.toBe(config.gwiiinTable);
    expect(korean.shinsalReferenceBranch).not.toBe(config.shinsalReferenceBranch);
  });
});

// =========================================================================
// Preset: MODERN_INTEGRATED
// =========================================================================
describe('ModernIntegratedPreset', () => {
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
    expect(korean.dayCutMode).not.toBe(config.dayCutMode);
    expect(korean.includeEquationOfTime).not.toBe(config.includeEquationOfTime);
    expect(korean.jeolgiPrecision).not.toBe(config.jeolgiPrecision);
    expect(korean.saryeongMode).not.toBe(config.saryeongMode);
    expect(korean.yongshinPriority).not.toBe(config.yongshinPriority);
    expect(korean.hapHwaStrictness).not.toBe(config.hapHwaStrictness);
  });
});

// =========================================================================
// Enum values
// =========================================================================
describe('EnumValues', () => {
  it('DayCutMode has four entries', () => {
    expect(Object.values(DayCutMode)).toHaveLength(4);
  });

  it('SchoolPreset has three entries', () => {
    expect(Object.values(SchoolPreset)).toHaveLength(3);
  });

  it('SaryeongMode has correct entries', () => {
    const values = Object.values(SaryeongMode);
    expect(values).toHaveLength(2);
    expect(values).toContain(SaryeongMode.ALWAYS_JEONGGI);
    expect(values).toContain(SaryeongMode.BY_DAY_IN_MONTH);
  });

  it('EarthLifeStageRule has correct entries', () => {
    const values = Object.values(EarthLifeStageRule);
    expect(values).toHaveLength(3);
    expect(values).toContain(EarthLifeStageRule.FOLLOW_FIRE);
    expect(values).toContain(EarthLifeStageRule.FOLLOW_WATER);
    expect(values).toContain(EarthLifeStageRule.INDEPENDENT);
  });

  it('HiddenStemScope has correct entries', () => {
    const values = Object.values(HiddenStemScope);
    expect(values).toHaveLength(3);
    expect(values).toContain(HiddenStemScope.ALL_THREE);
    expect(values).toContain(HiddenStemScope.JEONGGI_ONLY);
    expect(values).toContain(HiddenStemScope.SARYEONG_BASED);
  });

  it('YongshinPriority has correct entries', () => {
    const values = Object.values(YongshinPriority);
    expect(values).toHaveLength(3);
    expect(values).toContain(YongshinPriority.JOHU_FIRST);
    expect(values).toContain(YongshinPriority.EOKBU_FIRST);
    expect(values).toContain(YongshinPriority.EQUAL_WEIGHT);
  });

  it('JonggyeokYongshinMode has correct entries', () => {
    const values = Object.values(JonggyeokYongshinMode);
    expect(values).toHaveLength(2);
    expect(values).toContain(JonggyeokYongshinMode.FOLLOW_DOMINANT);
    expect(values).toContain(JonggyeokYongshinMode.COUNTER_DOMINANT);
  });

  it('HapHwaStrictness has correct entries', () => {
    const values = Object.values(HapHwaStrictness);
    expect(values).toHaveLength(3);
    expect(values).toContain(HapHwaStrictness.STRICT_FIVE_CONDITIONS);
    expect(values).toContain(HapHwaStrictness.MODERATE);
    expect(values).toContain(HapHwaStrictness.LENIENT);
  });

  it('GwiiinTableVariant has correct entries', () => {
    const values = Object.values(GwiiinTableVariant);
    expect(values).toHaveLength(2);
    expect(values).toContain(GwiiinTableVariant.KOREAN_MAINSTREAM);
    expect(values).toContain(GwiiinTableVariant.CHINESE_TRADITIONAL);
  });

  it('ShinsalReferenceBranch has correct entries', () => {
    const values = Object.values(ShinsalReferenceBranch);
    expect(values).toHaveLength(3);
    expect(values).toContain(ShinsalReferenceBranch.DAY_ONLY);
    expect(values).toContain(ShinsalReferenceBranch.YEAR_ONLY);
    expect(values).toContain(ShinsalReferenceBranch.DAY_AND_YEAR);
  });

  it('JeolgiPrecision has correct entries', () => {
    const values = Object.values(JeolgiPrecision);
    expect(values).toHaveLength(2);
    expect(values).toContain(JeolgiPrecision.APPROXIMATE);
    expect(values).toContain(JeolgiPrecision.VSOP87D_EXACT);
  });

  it('HiddenStemVariant has correct entries', () => {
    const values = Object.values(HiddenStemVariant);
    expect(values).toHaveLength(2);
    expect(values).toContain(HiddenStemVariant.STANDARD);
    expect(values).toContain(HiddenStemVariant.NO_RESIDUAL_EARTH);
  });

  it('HiddenStemDayAllocation has correct entries', () => {
    const values = Object.values(HiddenStemDayAllocation);
    expect(values).toHaveLength(2);
    expect(values).toContain(HiddenStemDayAllocation.YEONHAE_JAPYEONG);
    expect(values).toContain(HiddenStemDayAllocation.SAMMYEONG_TONGHOE);
  });
});

// =========================================================================
// Cross-preset consistency
// =========================================================================
describe('CrossPresetConsistency', () => {
  const allPresets = Object.values(SchoolPreset);

  it('all presets share same yin reversal setting', () => {
    for (const preset of allPresets) {
      const config = configFromPreset(preset);
      expect(config.yinReversalEnabled).toBe(true);
    }
  });

  it('all presets share same earth life stage rule', () => {
    for (const preset of allPresets) {
      const config = configFromPreset(preset);
      expect(config.earthLifeStageRule).toBe(EarthLifeStageRule.FOLLOW_FIRE);
    }
  });

  it('all presets share same strength threshold', () => {
    for (const preset of allPresets) {
      const config = configFromPreset(preset);
      expect(config.strengthThreshold).toBe(50.0);
    }
  });

  it('all presets use standard hidden stem variant', () => {
    for (const preset of allPresets) {
      const config = configFromPreset(preset);
      expect(config.hiddenStemVariant).toBe(HiddenStemVariant.STANDARD);
    }
  });

  it('all presets use Yeonhae Japyeong day allocation', () => {
    for (const preset of allPresets) {
      const config = configFromPreset(preset);
      expect(config.hiddenStemDayAllocation).toBe(HiddenStemDayAllocation.YEONHAE_JAPYEONG);
    }
  });

  it('each preset produces a distinct configuration', () => {
    const configs = allPresets.map((p) => configFromPreset(p));
    // All three must be different from each other
    expect(configs[0]).not.toEqual(configs[1]);
    expect(configs[0]).not.toEqual(configs[2]);
    expect(configs[1]).not.toEqual(configs[2]);
  });
});

// =========================================================================
// createConfig / DEFAULT_CONFIG
// =========================================================================
describe('createConfig', () => {
  it('default config produces valid values', () => {
    expect(DEFAULT_CONFIG.dayCutMode).toBe(DayCutMode.YAZA_23_TO_01_NEXTDAY);
    expect(DEFAULT_CONFIG.deukryeongWeight).toBe(40.0);
    expect(DEFAULT_CONFIG.strengthThreshold).toBe(50.0);
  });

  it('overrides are applied correctly', () => {
    const custom = createConfig({
      deukryeongWeight: 45.0,
      yongshinPriority: YongshinPriority.EOKBU_FIRST,
    });

    // Changed values
    expect(custom.deukryeongWeight).toBe(45.0);
    expect(custom.yongshinPriority).toBe(YongshinPriority.EOKBU_FIRST);

    // Unchanged values remain defaults
    expect(custom.dayCutMode).toBe(DayCutMode.YAZA_23_TO_01_NEXTDAY);
    expect(custom.applyDstHistory).toBe(true);
    expect(custom.hiddenStemVariant).toBe(HiddenStemVariant.STANDARD);
    expect(custom.allowBanhap).toBe(true);
  });
});
