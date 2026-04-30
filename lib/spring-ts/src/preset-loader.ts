/**
 * preset-loader.ts
 *
 * Loads school-specific weight presets from config/presets/<school>.json.
 * Used only when SpringOptions.precisionConfig.useSchoolPreset is true.
 *
 * The 'korean' preset mirrors the values in saju-scoring.json exactly, so
 * useSchoolPreset:true with schoolPreset='korean' (or unset) is a no-op.
 * 'chinese' and 'modern' apply documented school differences (see each
 * preset's description field, plus spring-info/06_external_refs/
 * 03_korean_schools.md §2 for citations).
 */
import koreanPreset from '../config/presets/korean.json';
import chinesePreset from '../config/presets/chinese.json';
import modernPreset from '../config/presets/modern.json';

export type SchoolPresetName = 'korean' | 'chinese' | 'modern';

export interface SchoolPresetData {
  readonly schoolName: string;
  readonly description: string;
  readonly yongshinTypeWeights: Readonly<Record<string, number>>;
  readonly adaptiveWeights: Readonly<Record<string, number>>;
}

const PRESETS: Readonly<Record<SchoolPresetName, SchoolPresetData>> = {
  korean: koreanPreset,
  chinese: chinesePreset,
  modern: modernPreset,
};

/**
 * Resolves a SchoolPresetName to its preset data. An unknown or undefined
 * name defaults to 'korean' (= current saju-scoring.json defaults), so a
 * caller that only opts in via `useSchoolPreset:true` without choosing a
 * school still sees zero behavior change.
 */
export function loadPreset(name: SchoolPresetName | undefined): SchoolPresetData {
  if (name === 'chinese' || name === 'modern') return PRESETS[name];
  return PRESETS.korean;
}
