/**
 * preset-loader.ts
 *
 * Loads school-specific weight presets from config/presets/<school>.json.
 * Used only when SpringOptions.precisionConfig.useSchoolPreset is true.
 *
 * The 'korean' preset mirrors the values in saju-scoring.json exactly, so
 * useSchoolPreset:true with schoolPreset='korean' (or unset) is a no-op.
 * Other presets are deterministic doctrine lenses that operators can compare
 * without promoting any one school to default truth.
 */
import koreanPreset from '../config/presets/korean.json';
import chinesePreset from '../config/presets/chinese.json';
import modernPreset from '../config/presets/modern.json';
import koreanModernPreset from '../config/presets/korean_modern.json';
import classicalTextPreset from '../config/presets/classical_text.json';
import namingSafePreset from '../config/presets/naming_safe.json';

export type SchoolPresetName =
  | 'korean'
  | 'chinese'
  | 'modern'
  | 'korean_modern'
  | 'classical_text'
  | 'naming_safe';

export type SchoolPresetSelectionSource = 'request' | 'default' | 'fallback';

export interface SchoolPresetData {
  readonly schoolName: string;
  readonly description: string;
  readonly yongshinTypeWeights: Readonly<Record<string, number>>;
  readonly adaptiveWeights: Readonly<Record<string, number>>;
}

export interface SchoolPresetMetadata {
  readonly selected: SchoolPresetName;
  readonly source: SchoolPresetSelectionSource;
  readonly useSchoolPreset: boolean;
  readonly label: string;
  readonly doctrine: string;
  readonly tradeoffs: readonly string[];
  readonly scoringEffect: 'active' | 'inactive';
}

export const SCHOOL_PRESET_ORDER: readonly SchoolPresetName[] = [
  'korean',
  'chinese',
  'modern',
  'korean_modern',
  'classical_text',
  'naming_safe',
];

const PRESETS: Readonly<Record<SchoolPresetName, SchoolPresetData>> = {
  korean: koreanPreset,
  chinese: chinesePreset,
  modern: modernPreset,
  korean_modern: koreanModernPreset,
  classical_text: classicalTextPreset,
  naming_safe: namingSafePreset,
};

const PRESET_DOCTRINE: Readonly<Record<SchoolPresetName, string>> = {
  korean: 'mainstream_korean_default',
  chinese: 'traditional_chinese_structure',
  modern: 'modern_integrated_climate',
  korean_modern: 'contemporary_korean_naming',
  classical_text: 'public_classical_text_rule_lens',
  naming_safe: 'conservative_name_safety',
};

const PRESET_TRADEOFFS: Readonly<Record<SchoolPresetName, readonly string[]>> = {
  korean: [
    'Default-compatible baseline; best for regression comparison.',
    'Does not emphasize one doctrine axis beyond current production scoring.',
  ],
  chinese: [
    'Raises structure and command-rule influence relative to the default.',
    'Can reduce climate-driven naming recommendations.',
  ],
  modern: [
    'Raises climate and seasonal balance in contemporary integrated readings.',
    'Can down-weight classical structure compared with text-first presets.',
  ],
  korean_modern: [
    'Fits contemporary Korean naming-service practice and Hangul-era expectations.',
    'Can diverge from strict classical text readings.',
  ],
  classical_text: [
    'Highlights source-text rule features such as gyeokguk, disease-remedy, and bridge logic.',
    'Runtime deltas are comparison signals only, not authority accuracy.',
  ],
  naming_safe: [
    'Prefers balance and conflict avoidance over aggressive reinforcement.',
    'May rank bold doctrine-specific choices lower than specialist presets.',
  ],
};

export function isSchoolPresetName(name: unknown): name is SchoolPresetName {
  return typeof name === 'string' && (SCHOOL_PRESET_ORDER as readonly string[]).includes(name);
}

export function resolveSchoolPresetName(name: unknown): SchoolPresetName {
  return isSchoolPresetName(name) ? name : 'korean';
}

/**
 * Resolves a SchoolPresetName to its preset data. An unknown or undefined
 * name defaults to 'korean' (= current saju-scoring.json defaults), so a
 * caller that only opts in via `useSchoolPreset:true` without choosing a
 * school still sees zero behavior change.
 */
export function loadPreset(name: SchoolPresetName | undefined): SchoolPresetData {
  return PRESETS[resolveSchoolPresetName(name)];
}

export function resolveSchoolPresetMetadata(
  name: unknown,
  useSchoolPreset: boolean,
): SchoolPresetMetadata {
  const selected = resolveSchoolPresetName(name);
  const source: SchoolPresetSelectionSource = name == null
    ? 'default'
    : isSchoolPresetName(name) ? 'request' : 'fallback';
  return {
    selected,
    source,
    useSchoolPreset,
    label: PRESETS[selected].schoolName,
    doctrine: PRESET_DOCTRINE[selected],
    tradeoffs: PRESET_TRADEOFFS[selected],
    scoringEffect: useSchoolPreset ? 'active' : 'inactive',
  };
}
