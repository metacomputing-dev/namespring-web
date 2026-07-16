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
import { deepFreeze } from '../../seed-ts/src/utils/deep-freeze.js';

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

export const SCHOOL_PRESET_ORDER: readonly SchoolPresetName[] = deepFreeze([
  'korean',
  'chinese',
  'modern',
  'korean_modern',
  'classical_text',
  'naming_safe',
]);

const PRESETS: Readonly<Record<SchoolPresetName, SchoolPresetData>> = deepFreeze({
  korean: koreanPreset,
  chinese: chinesePreset,
  modern: modernPreset,
  korean_modern: koreanModernPreset,
  classical_text: classicalTextPreset,
  naming_safe: namingSafePreset,
});

const PRESET_DOCTRINE: Readonly<Record<SchoolPresetName, string>> = deepFreeze({
  korean: 'mainstream_korean_default',
  chinese: 'traditional_chinese_structure',
  modern: 'modern_integrated_climate',
  korean_modern: 'contemporary_korean_naming',
  classical_text: 'public_classical_text_rule_lens',
  naming_safe: 'conservative_name_safety',
});

const PRESET_TRADEOFFS: Readonly<Record<SchoolPresetName, readonly string[]>> = deepFreeze({
  korean: [
    '현재 기본 점수 체계와 동일해서 회귀 비교 기준으로 쓰기 좋아요.',
    '특정 학파 기준을 더 강하게 밀지 않고 현재 서비스 기본값을 유지해요.',
  ],
  chinese: [
    '기본값보다 격국과 월령 중심의 구조 판단 비중을 높여요.',
    '계절과 조후 중심 추천은 상대적으로 약해질 수 있어요.',
  ],
  modern: [
    '현대 통합 해석에서 계절과 조후 균형을 더 크게 봐요.',
    '문헌 중심 격국 판단은 상대적으로 낮아질 수 있어요.',
  ],
  korean_modern: [
    '현대 한국 작명 서비스와 한글 이름 사용 환경에 맞춘 관점이에요.',
    '엄격한 고전 문헌식 해석과는 일부 결과가 달라질 수 있어요.',
  ],
  classical_text: [
    '격국, 병약, 통관 같은 문헌식 규칙 특징을 더 강조해요.',
    '런타임 점수 차이는 비교 신호일 뿐 권위 있는 정답으로 보지 않아요.',
  ],
  naming_safe: [
    '강한 보강보다 균형과 충돌 회피를 우선해요.',
    '특정 학파에서 과감하게 좋게 보는 후보는 낮게 평가될 수 있어요.',
  ],
});

export function isSchoolPresetName(name: unknown): name is SchoolPresetName {
  return typeof name === 'string' && Object.hasOwn(PRESETS, name);
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
