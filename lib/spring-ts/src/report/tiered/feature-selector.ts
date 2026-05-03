/**
 * feature-selector.ts -- Build a FeatureVector from saju + birth + targetDate
 *
 * One vector shape shared by every (category × period × depth) cell so the
 * fragment-selector can apply the fallback chain consistently. The vector
 * is the single source of gating attributes.
 */

import type { SajuSummary, BirthInfo } from '../../types.js';
import type { ElementCode } from '../types.js';
import type { TieredAgeBand } from '../types.js';

export type TieredAgePhase =
  | 'child_0_9' | 'early_teen' | 'late_teen'
  | 'early_20s' | 'late_20s'
  | 'early_30s' | 'late_30s'
  | 'early_40s' | 'late_40s'
  | 'early_50s' | 'late_50s'
  | 'early_60s' | 'late_60s'
  | '70s' | '80s' | '90_plus';

export type TieredSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type TieredPolarity = 'YANG' | 'YIN' | 'neutral';

const AGE_PHASE_ORDINAL: Record<TieredAgePhase, number> = {
  child_0_9: 1,
  early_teen: 2,
  late_teen: 3,
  early_20s: 4,
  late_20s: 5,
  early_30s: 6,
  late_30s: 7,
  early_40s: 8,
  late_40s: 9,
  early_50s: 10,
  late_50s: 11,
  early_60s: 12,
  late_60s: 13,
  '70s': 14,
  '80s': 15,
  '90_plus': 16,
};

const SEASON_ORDINAL: Record<TieredSeason, number> = {
  spring: 1,
  summer: 2,
  autumn: 3,
  winter: 4,
};

const ELEMENT_ORDINAL: Record<ElementCode, number> = {
  WOOD: 1,
  FIRE: 2,
  EARTH: 3,
  METAL: 4,
  WATER: 5,
};

const GENDER_ORDINAL: Record<FeatureVector['gender'], number> = {
  male: 1,
  female: 2,
  neutral: 3,
};

const STRENGTH_ORDINAL: Record<FeatureVector['dayMasterStrength'], number> = {
  EXTREME_WEAK: 1,
  WEAK: 2,
  BALANCED: 3,
  STRONG: 4,
  EXTREME_STRONG: 5,
};

const STEM_TO_ELEMENT: Record<string, ElementCode> = {
  GAP: 'WOOD', EUL: 'WOOD',
  BYEONG: 'FIRE', JEONG: 'FIRE',
  MU: 'EARTH', GI: 'EARTH',
  GYEONG: 'METAL', SIN: 'METAL',
  IM: 'WATER', GYE: 'WATER',
};

const KOREAN_ELEMENT_TO_CODE: Record<string, ElementCode> = {
  '木': 'WOOD', '나무': 'WOOD',
  '火': 'FIRE', '불': 'FIRE',
  '土': 'EARTH', '흙': 'EARTH',
  '金': 'METAL', '쇠': 'METAL',
  '水': 'WATER', '물': 'WATER',
};

// saju-adapter's formatGyeokgukTypeDisplay returns Korean labels (e.g. '정인격')
// or — when the saju engine emits an unmapped raw code — strings like 'JEONG_IN'.
// Phase 2 fragment authors gate on lowercase-English transliterations such as
// 'jeongingyeok'. Without this normalisation every gyeokguk-gated fragment is
// dead in selection because dimMatch compares the runtime Korean string with
// the lowercase-English allow-list and never succeeds. Map Korean label and
// English code to one canonical lowercase-English token. New gyeokguk types
// authored under data/narrative/<category>/**/expert.fragments.json MUST extend
// this map (and document the canonical form in their fragment-bundle README).
const GYEOKGUK_KO_TO_CANONICAL: Record<string, string> = {
  '정인격': 'jeongingyeok',
  '편인격': 'pyeoningyeok',
  '식신격': 'sikshingyeok',
  '상관격': 'sanggwangyeok',
  '정관격': 'jeonggwangyeok',
  '편관격': 'pyeongwangyeok',
  '정재격': 'jeongjaegyeok',
  '편재격': 'pyeonjaegyeok',
  '비견격': 'bigyeongyeok',
  '겁재격': 'geobjaegyeok',
  '화기격': 'hwagigyeok',
  '전왕격': 'jeonwanggyeok',
  '종격': 'jonggyeok',
  '종재격': 'jongjaegyeok',
  '종관격': 'jonggwangyeok',
  '종살격': 'jongsalgyeok',
  '종아격': 'jongagyeok',
  '종인격': 'jongingyeok',
  '종비격': 'jongbigyeok',
};
const GYEOKGUK_CODE_TO_CANONICAL: Record<string, string> = {
  JEONG_IN: 'jeongingyeok',
  PYEON_IN: 'pyeoningyeok',
  SIK_SIN: 'sikshingyeok',
  SANG_GWAN: 'sanggwangyeok',
  JEONG_GWAN: 'jeonggwangyeok',
  PYEON_GWAN: 'pyeongwangyeok',
  JEONG_JAE: 'jeongjaegyeok',
  PYEON_JAE: 'pyeonjaegyeok',
  BI_GYEON: 'bigyeongyeok',
  GYEOB_JAE: 'geobjaegyeok',
  HUA_QI: 'hwagigyeok',
  ZHUAN_WANG: 'jeonwanggyeok',
  CONG_GE: 'jonggyeok',
  CONG_CAI: 'jongjaegyeok',
  CONG_GUAN: 'jonggwangyeok',
  CONG_SHA: 'jongsalgyeok',
  CONG_ER: 'jongagyeok',
  CONG_YIN: 'jongingyeok',
  CONG_BI: 'jongbigyeok',
};

const GYEOKGUK_ORDINAL: Record<string, number> = {
  jeongingyeok: 1,
  pyeoningyeok: 2,
  sikshingyeok: 3,
  sanggwangyeok: 4,
  jeonggwangyeok: 5,
  pyeongwangyeok: 6,
  jeongjaegyeok: 7,
  pyeonjaegyeok: 8,
  bigyeongyeok: 9,
  geobjaegyeok: 10,
  hwagigyeok: 11,
  jeonwanggyeok: 12,
  jonggyeok: 13,
  jongjaegyeok: 14,
  jonggwangyeok: 15,
  jongsalgyeok: 16,
  jongagyeok: 17,
  jongingyeok: 18,
  jongbigyeok: 19,
};

function ordinalOrZero(value: string | null, table: Record<string, number>): number {
  return value ? (table[value] ?? 0) : 0;
}

function toGyeokgukCanonical(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const koMatch = GYEOKGUK_KO_TO_CANONICAL[trimmed];
  if (koMatch) return koMatch;
  const codeMatch = GYEOKGUK_CODE_TO_CANONICAL[trimmed.toUpperCase()];
  if (codeMatch) return codeMatch;
  // Already-canonical lowercase tokens (Wave A authored form) pass through.
  if (/^[a-z][a-z0-9_]*gyeok$/.test(trimmed)) return trimmed;
  return null;
}

function toElement(value: unknown): ElementCode | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (upper === 'WOOD' || upper === 'FIRE' || upper === 'EARTH' || upper === 'METAL' || upper === 'WATER') {
    return upper;
  }
  if (STEM_TO_ELEMENT[upper]) return STEM_TO_ELEMENT[upper];
  if (KOREAN_ELEMENT_TO_CODE[value.trim()]) return KOREAN_ELEMENT_TO_CODE[value.trim()];
  return null;
}

function toAgeBand(age: number): TieredAgeBand {
  if (age < 10) return '0-9';
  if (age < 20) return '10-19';
  if (age < 30) return '20-29';
  if (age < 40) return '30-39';
  if (age < 55) return '40-54';
  if (age < 70) return '55-69';
  return '70+';
}

function toAgePhase(age: number): TieredAgePhase {
  if (age < 10) return 'child_0_9';
  if (age < 15) return 'early_teen';
  if (age < 20) return 'late_teen';
  if (age < 25) return 'early_20s';
  if (age < 30) return 'late_20s';
  if (age < 35) return 'early_30s';
  if (age < 40) return 'late_30s';
  if (age < 45) return 'early_40s';
  if (age < 50) return 'late_40s';
  if (age < 55) return 'early_50s';
  if (age < 60) return 'late_50s';
  if (age < 65) return 'early_60s';
  if (age < 70) return 'late_60s';
  if (age < 80) return '70s';
  if (age < 90) return '80s';
  return '90_plus';
}

function toSeason(month: number | null | undefined): TieredSeason {
  if (month === 2 || month === 3 || month === 4) return 'spring';
  if (month === 5 || month === 6 || month === 7) return 'summer';
  if (month === 8 || month === 9 || month === 10) return 'autumn';
  return 'winter';
}

function toGender(gender: BirthInfo['gender'] | undefined): 'male' | 'female' | 'neutral' {
  if (gender === 'male' || gender === 'female') return gender;
  return 'neutral';
}

function toPolarity(value: unknown): TieredPolarity {
  if (typeof value !== 'string') return 'neutral';
  const text = value.trim();
  const upper = text.toUpperCase();
  if (upper === 'YANG' || upper === 'POSITIVE' || text.includes('\uC591')) return 'YANG';
  if (upper === 'YIN' || upper === 'NEGATIVE' || text.includes('\uC74C')) return 'YIN';
  return 'neutral';
}

function toStrengthBand(saju: SajuSummary): 'EXTREME_STRONG' | 'STRONG' | 'BALANCED' | 'WEAK' | 'EXTREME_WEAK' {
  const lvl = String(saju.strength?.level ?? '').trim();
  if (/극왕|극강|극신왕/.test(lvl)) return 'EXTREME_STRONG';
  if (/신왕|신강/.test(lvl)) return 'STRONG';
  if (/중화|평형|균형/.test(lvl)) return 'BALANCED';
  if (/극약|극신약/.test(lvl)) return 'EXTREME_WEAK';
  if (/신약/.test(lvl)) return 'WEAK';
  return saju.strength?.isStrong ? 'STRONG' : 'WEAK';
}

function toYongshinAlignment(
  yongshin: ElementCode | null,
  dayMaster: ElementCode | null,
): 'aligned' | 'neutral' | 'conflicting' {
  if (!yongshin || !dayMaster) return 'neutral';
  if (yongshin === dayMaster) return 'aligned';
  return 'neutral';
}

export interface FeatureVector {
  readonly ageYears: number;
  readonly agePhaseOrdinal: number;
  readonly dayMasterElement: ElementCode | null;
  readonly dayMasterElementOrdinal: number;
  readonly dayMasterStrength: 'EXTREME_STRONG' | 'STRONG' | 'BALANCED' | 'WEAK' | 'EXTREME_WEAK';
  readonly dayMasterStrengthOrdinal: number;
  readonly yongshinElement: ElementCode | null;
  readonly yongshinElementOrdinal: number;
  readonly heeshinElement: ElementCode | null;
  readonly gishinElement: ElementCode | null;
  readonly yongshinAlignment: 'aligned' | 'neutral' | 'conflicting';
  readonly gyeokguk: string | null;
  readonly gyeokgukOrdinal: number;
  readonly ageBand: TieredAgeBand;
  readonly agePhase: TieredAgePhase;
  readonly gender: 'male' | 'female' | 'neutral';
  readonly genderOrdinal: number;
  readonly birthSeason: TieredSeason;
  readonly birthSeasonOrdinal: number;
  readonly currentSeason: TieredSeason;
  readonly currentSeasonOrdinal: number;
  readonly dayMasterPolarity: TieredPolarity;
}

export function buildFeatureVector(
  saju: SajuSummary,
  birth: BirthInfo,
  targetDate: Date,
): FeatureVector {
  const dayMasterElement = toElement(saju.dayMaster?.element ?? null);
  const yongshinElement = toElement(saju.yongshin?.element ?? null);
  const heeshinElement = toElement(saju.yongshin?.heeshin ?? null);
  const gishinElement = toElement(saju.yongshin?.gishin ?? null);
  const birthYear = saju.timeCorrection?.standardYear ?? birth.year ?? targetDate.getFullYear();
  const birthMonth = saju.timeCorrection?.standardMonth ?? birth.month ?? null;
  const age = Math.max(0, targetDate.getFullYear() - (birthYear ?? targetDate.getFullYear()));
  const agePhase = toAgePhase(age);
  const birthSeason = toSeason(birthMonth);
  const currentSeason = toSeason(targetDate.getMonth() + 1);
  const dayMasterStrength = toStrengthBand(saju);
  const gyeokguk = toGyeokgukCanonical(saju.gyeokguk?.type ?? null);
  const gender = toGender(birth.gender);
  return {
    ageYears: age,
    agePhaseOrdinal: AGE_PHASE_ORDINAL[agePhase],
    dayMasterElement,
    dayMasterElementOrdinal: dayMasterElement ? ELEMENT_ORDINAL[dayMasterElement] : 0,
    dayMasterStrength,
    dayMasterStrengthOrdinal: STRENGTH_ORDINAL[dayMasterStrength],
    yongshinElement,
    yongshinElementOrdinal: yongshinElement ? ELEMENT_ORDINAL[yongshinElement] : 0,
    heeshinElement,
    gishinElement,
    yongshinAlignment: toYongshinAlignment(yongshinElement, dayMasterElement),
    gyeokguk,
    gyeokgukOrdinal: ordinalOrZero(gyeokguk, GYEOKGUK_ORDINAL),
    ageBand: toAgeBand(age),
    agePhase,
    gender,
    genderOrdinal: GENDER_ORDINAL[gender],
    birthSeason,
    birthSeasonOrdinal: SEASON_ORDINAL[birthSeason],
    currentSeason,
    currentSeasonOrdinal: SEASON_ORDINAL[currentSeason],
    dayMasterPolarity: toPolarity(saju.dayMaster?.polarity ?? null),
  };
}
