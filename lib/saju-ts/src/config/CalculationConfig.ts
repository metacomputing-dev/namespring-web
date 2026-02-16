import { DayCutMode } from '../calendar/time/DayCutMode.js';
import { HiddenStemVariant, HiddenStemDayAllocation } from '../domain/HiddenStem.js';


export enum SaryeongMode {
  ALWAYS_JEONGGI = 'ALWAYS_JEONGGI',
  BY_DAY_IN_MONTH = 'BY_DAY_IN_MONTH',
}

export enum EarthLifeStageRule {
  FOLLOW_FIRE = 'FOLLOW_FIRE',
  FOLLOW_WATER = 'FOLLOW_WATER',
  INDEPENDENT = 'INDEPENDENT',
}

export enum HiddenStemScope {
  ALL_THREE = 'ALL_THREE',
  JEONGGI_ONLY = 'JEONGGI_ONLY',
  SARYEONG_BASED = 'SARYEONG_BASED',
}

export enum YongshinPriority {
  JOHU_FIRST = 'JOHU_FIRST',
  EOKBU_FIRST = 'EOKBU_FIRST',
  EQUAL_WEIGHT = 'EQUAL_WEIGHT',
}

export enum JonggyeokYongshinMode {
  FOLLOW_DOMINANT = 'FOLLOW_DOMINANT',
  COUNTER_DOMINANT = 'COUNTER_DOMINANT',
}

export enum HapHwaStrictness {
  STRICT_FIVE_CONDITIONS = 'STRICT_FIVE_CONDITIONS',
  MODERATE = 'MODERATE',
  LENIENT = 'LENIENT',
}

export enum GwiiinTableVariant {
  KOREAN_MAINSTREAM = 'KOREAN_MAINSTREAM',
  CHINESE_TRADITIONAL = 'CHINESE_TRADITIONAL',
}

export enum ShinsalReferenceBranch {
  DAY_ONLY = 'DAY_ONLY',
  YEAR_ONLY = 'YEAR_ONLY',
  DAY_AND_YEAR = 'DAY_AND_YEAR',
}

export enum JeolgiPrecision {
  APPROXIMATE = 'APPROXIMATE',
  VSOP87D_EXACT = 'VSOP87D_EXACT',
}

export enum SchoolPreset {
  KOREAN_MAINSTREAM = 'KOREAN_MAINSTREAM',
  TRADITIONAL_CHINESE = 'TRADITIONAL_CHINESE',
  MODERN_INTEGRATED = 'MODERN_INTEGRATED',
}


export interface CalculationConfig {
  readonly dayCutMode: DayCutMode;
  readonly applyDstHistory: boolean;
  readonly includeEquationOfTime: boolean;
  readonly lmtBaselineLongitude: number;
  readonly jeolgiPrecision: JeolgiPrecision;

  readonly hiddenStemVariant: HiddenStemVariant;
  readonly hiddenStemDayAllocation: HiddenStemDayAllocation;
  readonly saryeongMode: SaryeongMode;

  readonly earthLifeStageRule: EarthLifeStageRule;
  readonly yinReversalEnabled: boolean;

  readonly deukryeongWeight: number;
  readonly proportionalDeukryeong: boolean;
  readonly strengthThreshold: number;
  readonly hiddenStemScopeForStrength: HiddenStemScope;
  readonly deukjiPerBranch: number;
  readonly deukseBigyeop: number;
  readonly deukseInseong: number;

  readonly yongshinPriority: YongshinPriority;
  readonly jonggyeokYongshinMode: JonggyeokYongshinMode;
  readonly jonggyeokWeakThreshold: number;
  readonly jonggyeokStrongThreshold: number;

  readonly hapHwaStrictness: HapHwaStrictness;
  readonly allowBanhap: boolean;
  readonly dayMasterNeverHapGeo: boolean;

  readonly gwiiinTable: GwiiinTableVariant;
  readonly shinsalReferenceBranch: ShinsalReferenceBranch;
}

type CalculationConfigOverrides = Readonly<Partial<CalculationConfig>>;

export const DEFAULT_CONFIG: CalculationConfig = {
  dayCutMode: DayCutMode.YAZA_23_TO_01_NEXTDAY,
  applyDstHistory: true,
  includeEquationOfTime: false,
  lmtBaselineLongitude: 135.0,
  jeolgiPrecision: JeolgiPrecision.APPROXIMATE,
  hiddenStemVariant: HiddenStemVariant.STANDARD,
  hiddenStemDayAllocation: HiddenStemDayAllocation.YEONHAE_JAPYEONG,
  saryeongMode: SaryeongMode.ALWAYS_JEONGGI,
  earthLifeStageRule: EarthLifeStageRule.FOLLOW_FIRE,
  yinReversalEnabled: true,
  deukryeongWeight: 40.0,
  proportionalDeukryeong: false,
  strengthThreshold: 50.0,
  hiddenStemScopeForStrength: HiddenStemScope.ALL_THREE,
  deukjiPerBranch: 5.0,
  deukseBigyeop: 7.0,
  deukseInseong: 5.0,
  yongshinPriority: YongshinPriority.JOHU_FIRST,
  jonggyeokYongshinMode: JonggyeokYongshinMode.FOLLOW_DOMINANT,
  jonggyeokWeakThreshold: 15.0,
  jonggyeokStrongThreshold: 62.4,
  hapHwaStrictness: HapHwaStrictness.STRICT_FIVE_CONDITIONS,
  allowBanhap: true,
  dayMasterNeverHapGeo: true,
  gwiiinTable: GwiiinTableVariant.KOREAN_MAINSTREAM,
  shinsalReferenceBranch: ShinsalReferenceBranch.DAY_AND_YEAR,
};

export function createConfig(overrides?: Partial<CalculationConfig>): CalculationConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(overrides ?? {}),
  };
}

const COMMON_YAZA_23_30_NEXTDAY: CalculationConfigOverrides = {
  dayCutMode: DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY,
};

function withCommonDayCutMode(overrides?: CalculationConfigOverrides): CalculationConfigOverrides {
  return { ...COMMON_YAZA_23_30_NEXTDAY, ...overrides };
}

const TRADITIONAL_CHINESE_PRESET_OVERRIDES: CalculationConfigOverrides = {
  applyDstHistory: false,
  lmtBaselineLongitude: 120.0,
  saryeongMode: SaryeongMode.BY_DAY_IN_MONTH,
  deukryeongWeight: 50.0,
  proportionalDeukryeong: true,
  hiddenStemScopeForStrength: HiddenStemScope.JEONGGI_ONLY,
  yongshinPriority: YongshinPriority.EOKBU_FIRST,
  hapHwaStrictness: HapHwaStrictness.STRICT_FIVE_CONDITIONS,
  allowBanhap: false,
  dayMasterNeverHapGeo: false,
  gwiiinTable: GwiiinTableVariant.CHINESE_TRADITIONAL,
  shinsalReferenceBranch: ShinsalReferenceBranch.DAY_ONLY,
};

const MODERN_INTEGRATED_PRESET_OVERRIDES: CalculationConfigOverrides = {
  dayCutMode: DayCutMode.JOJA_SPLIT,
  includeEquationOfTime: true,
  jeolgiPrecision: JeolgiPrecision.VSOP87D_EXACT,
  saryeongMode: SaryeongMode.BY_DAY_IN_MONTH,
  proportionalDeukryeong: true,
  yongshinPriority: YongshinPriority.EQUAL_WEIGHT,
  jonggyeokWeakThreshold: 20.0,
  jonggyeokStrongThreshold: 58.0,
  hapHwaStrictness: HapHwaStrictness.MODERATE,
};

const PRESET_OVERRIDES = {
  [SchoolPreset.KOREAN_MAINSTREAM]: withCommonDayCutMode(),
  [SchoolPreset.TRADITIONAL_CHINESE]: withCommonDayCutMode(TRADITIONAL_CHINESE_PRESET_OVERRIDES),
  [SchoolPreset.MODERN_INTEGRATED]: MODERN_INTEGRATED_PRESET_OVERRIDES,
} as const satisfies Readonly<Record<SchoolPreset, CalculationConfigOverrides>>;

export function configFromPreset(preset: SchoolPreset): CalculationConfig {
  return createConfig(PRESET_OVERRIDES[preset]);
}

