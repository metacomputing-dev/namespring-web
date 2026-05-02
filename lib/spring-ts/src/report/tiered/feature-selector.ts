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

function toGender(gender: BirthInfo['gender'] | undefined): 'male' | 'female' | 'neutral' {
  if (gender === 'male' || gender === 'female') return gender;
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
  readonly dayMasterElement: ElementCode | null;
  readonly dayMasterStrength: 'EXTREME_STRONG' | 'STRONG' | 'BALANCED' | 'WEAK' | 'EXTREME_WEAK';
  readonly yongshinElement: ElementCode | null;
  readonly heeshinElement: ElementCode | null;
  readonly gishinElement: ElementCode | null;
  readonly yongshinAlignment: 'aligned' | 'neutral' | 'conflicting';
  readonly gyeokguk: string | null;
  readonly ageBand: TieredAgeBand;
  readonly gender: 'male' | 'female' | 'neutral';
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
  const age = Math.max(0, targetDate.getFullYear() - (birthYear ?? targetDate.getFullYear()));
  return {
    dayMasterElement,
    dayMasterStrength: toStrengthBand(saju),
    yongshinElement,
    heeshinElement,
    gishinElement,
    yongshinAlignment: toYongshinAlignment(yongshinElement, dayMasterElement),
    gyeokguk: toGyeokgukCanonical(saju.gyeokguk?.type ?? null),
    ageBand: toAgeBand(age),
    gender: toGender(birth.gender),
  };
}
