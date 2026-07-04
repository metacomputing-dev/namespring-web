/**
 * class-axes.ts -- κ: map a runtime person to a generated CLASS id.
 *
 * The reduction formula (docs/REDUCTION_FORMULA.md) authors one article per
 * equivalence class; at runtime this function coarsens the person's real
 * FeatureVector + SajuCompatibility into the class coordinates and formats the
 * classId EXACTLY as tools/generation/generate-manifest.ts did. Returns null
 * when a class axis is unresolvable (→ selector falls back to the base pool),
 * so the frontend degrades gracefully as generation fills in.
 */
import type { SajuCompatibility } from '../../types.js';
import type { FeatureVector } from './feature-selector.js';

export type StrengthCoarse = 'weak' | 'balanced' | 'strong';
export type GyeokgukFamily = 'inseong' | 'siksang' | 'jaeseong' | 'gwanseong' | 'bigeop' | 'special';
export type NameEffect = 'boost_strong' | 'boost_mild' | 'neutral' | 'adverse';

/** Categories where the reading genuinely diverges by gender (관성=남편/자식 …). */
export const GENDER_SENSITIVE = new Set(['romance', 'family', 'career']);

function strengthToCoarse(s: FeatureVector['dayMasterStrength']): StrengthCoarse {
  if (s === 'EXTREME_WEAK' || s === 'WEAK') return 'weak';
  if (s === 'STRONG' || s === 'EXTREME_STRONG') return 'strong';
  return 'balanced';
}

const GYEOKGUK_FAMILY: Record<string, GyeokgukFamily> = {
  jeongingyeok: 'inseong', pyeoningyeok: 'inseong', jongingyeok: 'inseong',
  sikshingyeok: 'siksang', sanggwangyeok: 'siksang', jongagyeok: 'siksang',
  jeongjaegyeok: 'jaeseong', pyeonjaegyeok: 'jaeseong', jongjaegyeok: 'jaeseong',
  jeonggwangyeok: 'gwanseong', pyeongwangyeok: 'gwanseong', jonggwangyeok: 'gwanseong', jongsalgyeok: 'gwanseong',
  bigyeongyeok: 'bigeop', geobjaegyeok: 'bigeop', jongbigyeok: 'bigeop',
  hwagigyeok: 'special', jeonwanggyeok: 'special', jonggyeok: 'special',
};

function gyeokgukToFamily(gyeokguk: string | null): GyeokgukFamily | null {
  return gyeokguk ? (GYEOKGUK_FAMILY[gyeokguk] ?? null) : null;
}

/** nameEffect from the name↔saju compatibility — sign-aware (good vs harmful).
 *  adverse: the name feeds 기신 more than 용신. */
export function nameEffectFrom(compat: SajuCompatibility | null | undefined): NameEffect {
  if (!compat) return 'neutral';
  const y = Number.isFinite(compat.yongshinMatchCount) ? compat.yongshinMatchCount : 0;
  const g = Number.isFinite(compat.gishinMatchCount) ? compat.gishinMatchCount : 0;
  if (g > y && g >= 1) return 'adverse';
  if (y >= 2) return 'boost_strong';
  if (y === 1) return 'boost_mild';
  return 'neutral';
}

function genderToken(category: string, gender: FeatureVector['gender']): string | null {
  if (!GENDER_SENSITIVE.has(category)) return 'x';
  if (gender === 'male' || gender === 'female') return gender;
  return null; // neutral gender in a gender-sensitive category → no class → fallback
}

/**
 * Build the generated classId for one cell, or null to fall back to the base
 * pool. Format matches generate-manifest.ts caseId exactly.
 */
export function computeClassId(
  category: string,
  period: string,
  audience: string,
  band: string,
  feature: FeatureVector,
  compat: SajuCompatibility | null | undefined,
): string | null {
  const family = gyeokgukToFamily(feature.gyeokguk);
  if (!family) return null;
  const gender = genderToken(category, feature.gender);
  if (gender === null) return null;
  const gangyak = strengthToCoarse(feature.dayMasterStrength);
  const nameEffect = nameEffectFrom(compat);
  return [category, period, audience, band, gangyak, family, nameEffect, gender].join('.');
}
