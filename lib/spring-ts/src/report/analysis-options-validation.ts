import { validateSajuRequestOptions } from '../saju-request-policy.js';

const PRECISION_BOOLEAN_KEYS = new Set([
  'useSchoolPreset', 'unknownHourGuard', 'surfaceNameTrend',
  'surfacePhoneticEvidence', 'surfaceNamingScoreVector',
  'paretoFrontierCandidates', 'surfacePalace', 'surfaceNaeum', 'surfaceJohu',
  'surfaceSubDomains', 'surfaceTieredMatrix', 'surfaceInsightFacts',
]);

const PRECISION_ENUMS: Readonly<Record<string, ReadonlySet<string>>> = {
  balanceMode: new Set(['mathematical', 'yongshin_first', 'classical_jonggyeok_aware']),
  yongshinMode: new Set(['classical_blend', 'chengbai_strict', 'consensus_aware']),
  strengthMode: new Set(['binary', 'continuous']),
  tenGodMode: new Set(['simple_count', 'positional_weighted', 'positional_weighted_v2']),
  gyeokgukMode: new Set(['jonggyeok_only', 'multi_special', 'chengbai_strict']),
  gyeokgukSelectionRule: new Set(['monthly_main', 'jungki_transparent']),
  fortuneCascadeMode: new Set(['simple', 'jie_based', 'full_5layer']),
  sajuPriorityCurve: new Set(['linear', 'tanh']),
  hanjaPool: new Set(['curated', 'inmyeongyong_full']),
  pureHangulSchema: new Set(['auto', 'classic_phonetic', 'modern_korean', 'expanded']),
  pureHangulPolarityModel: new Set(['binary', 'ternary']),
  nameElementStrategy: new Set(['legacy', 'safeFallback']),
  lunarConversionSource: new Set(['builtin', 'kasi']),
  narrativeStyle: new Set(['expert', 'plain', 'counselor', 'sideBySide']),
  readingFocus: new Set([
    'auto', 'full', 'career', 'wealth', 'relationship', 'study_document',
    'expression_children', 'health_stress', 'movement', 'family',
  ]),
  saryeongScheme: new Set(['classical', 'scaled']),
  aberrationModel: new Set(['constant', 'rCorrected']),
  solarPrecision: new Set(['classical', 'iau1980_top10', 'iau1980_full']),
  evaluatorMode: new Set(['single', 'multi_axis']),
};

const PRECISION_KEYS = new Set([
  ...PRECISION_BOOLEAN_KEYS,
  ...Object.keys(PRECISION_ENUMS),
  'unknownTimeSajuDamp', 'pureHangulSignalCap', 'sajuSchoolId',
]);

export class AnalysisOptionsContractError extends Error {
  constructor(
    readonly detail: string,
    readonly kind: 'UNKNOWN_FIELD' | 'INVALID_VALUE' | 'REMOTE_FORBIDDEN' = 'INVALID_VALUE',
  ) {
    super(detail);
    this.name = 'AnalysisOptionsContractError';
  }
}

function fail(
  detail: string,
  kind: AnalysisOptionsContractError['kind'] = 'INVALID_VALUE',
): never {
  throw new AnalysisOptionsContractError(detail, kind);
}

function assertPlainObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(label);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(label);
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  keys: ReadonlySet<string>,
  label: string,
): void {
  const unknown = Object.keys(value).find((key) => !keys.has(key));
  if (unknown) fail(`${label}.${unknown}`, 'UNKNOWN_FIELD');
}

export function assertAnalysisOptionsContractV1(
  value: unknown,
  birthYear: number,
  policy: { readonly allowRemoteLunarConversion: boolean },
): void {
  assertPlainObject(value, 'options');
  assertAllowedKeys(value, new Set([
    'schoolPreset', 'sajuTimePolicy', 'sajuOptions', 'pureHangulNameMode',
    'useSurnameHanjaInPureHangul', 'precisionConfig',
  ]), 'options');

  if (value.schoolPreset !== undefined
    && (typeof value.schoolPreset !== 'string'
      || !['korean', 'chinese', 'modern', 'korean_modern', 'classical_text', 'naming_safe']
        .includes(value.schoolPreset))) {
    fail('options.schoolPreset');
  }
  if (value.pureHangulNameMode !== undefined
    && (typeof value.pureHangulNameMode !== 'string'
      || !['auto', 'on', 'off'].includes(value.pureHangulNameMode))) {
    fail('options.pureHangulNameMode');
  }
  if (value.useSurnameHanjaInPureHangul !== undefined
    && typeof value.useSurnameHanjaInPureHangul !== 'boolean') {
    fail('options.useSurnameHanjaInPureHangul');
  }

  if (value.sajuTimePolicy !== undefined) {
    assertPlainObject(value.sajuTimePolicy, 'options.sajuTimePolicy');
    assertAllowedKeys(value.sajuTimePolicy, new Set([
      'trueSolarTime', 'longitudeCorrection', 'longitudeReference', 'yaza', 'yazaMode',
    ]), 'options.sajuTimePolicy');
    for (const key of ['trueSolarTime', 'longitudeCorrection', 'yaza'] as const) {
      const raw = value.sajuTimePolicy[key];
      if (raw !== undefined && raw !== 'on' && raw !== 'off') {
        fail(`options.sajuTimePolicy.${key}`);
      }
    }
    if (value.sajuTimePolicy.longitudeReference !== undefined
      && (typeof value.sajuTimePolicy.longitudeReference !== 'string'
        || !['civilOffsetMeridian', 'legacyPreset']
          .includes(value.sajuTimePolicy.longitudeReference))) {
      fail('options.sajuTimePolicy.longitudeReference');
    }
    if (value.sajuTimePolicy.yazaMode !== undefined
      && (typeof value.sajuTimePolicy.yazaMode !== 'string'
        || !['23:00', '23:30'].includes(value.sajuTimePolicy.yazaMode))) {
      fail('options.sajuTimePolicy.yazaMode');
    }
  }

  if (value.sajuOptions !== undefined) {
    assertPlainObject(value.sajuOptions, 'options.sajuOptions');
    assertAllowedKeys(value.sajuOptions, new Set([
      'daeunCount', 'saeunStartYear', 'saeunYearCount',
      'wolunStartYear', 'wolunMonthCount',
    ]), 'options.sajuOptions');
    try {
      validateSajuRequestOptions(value.sajuOptions, birthYear);
    } catch {
      fail('options.sajuOptions');
    }
  }

  if (value.precisionConfig !== undefined) {
    assertPlainObject(value.precisionConfig, 'options.precisionConfig');
    assertAllowedKeys(value.precisionConfig, PRECISION_KEYS, 'options.precisionConfig');
    for (const key of PRECISION_BOOLEAN_KEYS) {
      if (value.precisionConfig[key] !== undefined
        && typeof value.precisionConfig[key] !== 'boolean') {
        fail(`options.precisionConfig.${key}`);
      }
    }
    for (const [key, allowed] of Object.entries(PRECISION_ENUMS)) {
      const raw = value.precisionConfig[key];
      if (raw !== undefined && (typeof raw !== 'string' || !allowed.has(raw))) {
        fail(`options.precisionConfig.${key}`);
      }
    }
    if (!policy.allowRemoteLunarConversion
      && value.precisionConfig.lunarConversionSource === 'kasi') {
      fail('options.precisionConfig.lunarConversionSource', 'REMOTE_FORBIDDEN');
    }
    for (const key of ['unknownTimeSajuDamp', 'pureHangulSignalCap'] as const) {
      const raw = value.precisionConfig[key];
      if (raw !== undefined
        && (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 1)) {
        fail(`options.precisionConfig.${key}`);
      }
    }
    const schoolId = value.precisionConfig.sajuSchoolId;
    if (schoolId !== undefined
      && (typeof schoolId !== 'string'
        || schoolId.length < 1
        || schoolId.length > 128
        || schoolId !== schoolId.trim())) {
      fail('options.precisionConfig.sajuSchoolId');
    }
  }
}
