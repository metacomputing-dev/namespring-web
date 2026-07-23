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
  // 감사 B4: 건록/양인/월겁 → 비겁 family (기존 *.bigeop.* 코퍼스를 재생성 없이 그대로 탄다).
  geonrokgyeok: 'bigeop', yangingyeok: 'bigeop', wolgeobgyeok: 'bigeop',
  hwagigyeok: 'special', jeonwanggyeok: 'special', jonggyeok: 'special',
};

export function gyeokgukToFamily(gyeokguk: string | null): GyeokgukFamily | null {
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
  const key = packKeyFor(category, feature, compat);
  if (!key) return null;
  return [category, period, audience, band, key].join('.');
}

/** 미성년형 오디언스 — 매니페스트(generate-manifest.ts isMinor)가 축을 접는 대상. */
function isMinorTypeAudience(audience: string): boolean {
  return audience === 'child' || audience === 'teen' || audience.startsWith('stage-');
}

/**
 * 미성년형 오디언스의 사람축 키. 매니페스트의 축 축소 규칙을 미러링한다:
 * gender는 항상 'x', 강약은 weak|strong만(balanced 클래스 없음), nameEffect는
 * adverse 클래스 없음. 축이 없는 조합은 null → 베이스 폴백 (adverse를 neutral로
 * 뭉개는 매핑은 이름효과 정직성 위반이라 하지 않는다).
 */
export function minorPackKeyFor(
  feature: FeatureVector,
  compat: SajuCompatibility | null | undefined,
): string | null {
  const family = gyeokgukToFamily(feature.gyeokguk);
  if (!family) return null;
  const gangyak = strengthToCoarse(feature.dayMasterStrength);
  if (gangyak === 'balanced') return null;
  const nameEffect = nameEffectFrom(compat);
  if (nameEffect === 'adverse') return null;
  return `${gangyak}.${family}.${nameEffect}.x`;
}

/**
 * 생성 클래스 조회 후보 목록 (순서대로 시도).
 * - 성인 오디언스: [정확 classId] 1개.
 * - 미성년형(child/teen/stage-*): 매니페스트 축 축소를 미러링한 키로
 *   [요청 band, 'any' band] 2단 후보 — stage 코퍼스가 band별로 채워지기 전에는
 *   'any'가, 채워진 뒤에는 정확 band가 잡힌다 (점진 충전과 호환).
 */
export function computeClassIdCandidates(
  category: string,
  period: string,
  audience: string,
  band: string,
  feature: FeatureVector,
  compat: SajuCompatibility | null | undefined,
): string[] {
  if (!isMinorTypeAudience(audience)) {
    const id = computeClassId(category, period, audience, band, feature, compat);
    return id ? [id] : [];
  }
  const key = minorPackKeyFor(feature, compat);
  if (!key) return [];
  const ids = [[category, period, audience, band, key].join('.')];
  // 등급-텍스트 정합 보장: 생애단계(stage-*) 셀의 순풍/역풍(high/low) 구간은
  // 등급 중립(any) 재생성으로 내려가지 않는다 — 셀렉터가 등급 인지 베이스
  // 문안으로 폴백해, 표시되는 별점과 글의 톤이 항상 일치한다. 평탄(mid)만
  // any(중립=평탄)로 폴백. S4 등급 충전 후에는 exact가 잡혀 개인화까지 회복.
  // child/teen(미성년 기간 표면)은 등급 베이스가 없어 any 유지(비모순 확인됨).
  const isStage = audience.startsWith('stage-');
  if (band !== 'any' && (!isStage || band === 'mid')) {
    ids.push([category, period, audience, 'any', key].join('.'));
  }
  return ids;
}

/** All 11 content categories (packed-bundle preload iterates these). */
export const ALL_CATEGORIES: readonly string[] = [
  'overall', 'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
];

/**
 * The person-fixed axis key `강약.격국.nameEffect.성별` — the last 4 parts of
 * every classId this person can match in `category`. The browser fetches ONE
 * packed bundle per (category, key). null when a class axis is unresolvable.
 */
export function packKeyFor(
  category: string,
  feature: FeatureVector,
  compat: SajuCompatibility | null | undefined,
): string | null {
  const family = gyeokgukToFamily(feature.gyeokguk);
  if (!family) return null;
  const gender = genderToken(category, feature.gender);
  if (gender === null) return null;
  const gangyak = strengthToCoarse(feature.dayMasterStrength);
  const nameEffect = nameEffectFrom(compat);
  return `${gangyak}.${family}.${nameEffect}.${gender}`;
}
