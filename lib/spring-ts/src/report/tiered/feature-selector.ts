/**
 * feature-selector.ts -- Build a FeatureVector from saju + birth + targetDate
 *
 * One vector shape shared by every (category × period × depth) cell so the
 * fragment-selector can apply the fallback chain consistently. The vector
 * is the single source of gating attributes.
 */

import type { SajuSummary, BirthInfo } from '../../types.js';
import { pointsToRatio } from '../../saju/confidence-units.js';
import type { ElementCode } from '../types.js';
import type { TieredAgeBand } from '../types.js';
import { targetCalendarMonth, targetCalendarYear } from '../../target-date.js';

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
  // 감사 B4: 건록/양인/월겁 — 글로서리 기존 id(geonrokgyeok/yangingyeok)와 일치.
  '건록격': 'geonrokgyeok',
  '양인격': 'yangingyeok',
  '월겁격': 'wolgeobgyeok',
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
  // 감사 B4
  GEONROK: 'geonrokgyeok',
  YANGIN: 'yangingyeok',
  WOLGEOB: 'wolgeobgyeok',
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
  // 감사 B4
  geonrokgyeok: 20,
  yangingyeok: 21,
  wolgeobgyeok: 22,
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

const POLARITY_ORDINAL: Record<TieredPolarity, number> = {
  neutral: 0,
  YANG: 1,
  YIN: 2,
};

function finiteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/** Parse a raw deficient/excessive element list (Korean/Hanja/English/stem
 *  labels) into canonical engine codes, de-duplicated and order-preserving.
 *  Unresolvable entries are dropped so downstream naming stays clean. */
function parseElementList(value: unknown): readonly ElementCode[] {
  if (!Array.isArray(value)) return [];
  const out: ElementCode[] = [];
  for (const raw of value) {
    const code = toElement(raw);
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

function elementDistributionCount(
  distribution: SajuSummary['elementDistribution'] | undefined,
  element: ElementCode,
): number {
  if (!distribution) return 0;
  // Probe both English and Korean keys — different upstream paths surface
  // either depending on options. Engine codes (WOOD/FIRE/...) are the modern
  // shape; Korean labels (나무/불/...) still appear in legacy adapters.
  const upperKey = element;
  const lowerKey = element.toLowerCase();
  const koreanKey = (
    element === 'WOOD' ? '나무' :
    element === 'FIRE' ? '불' :
    element === 'EARTH' ? '흙' :
    element === 'METAL' ? '쇠' :
    element === 'WATER' ? '물' :
    null
  );
  const hanjaKey = (
    element === 'WOOD' ? '木' :
    element === 'FIRE' ? '火' :
    element === 'EARTH' ? '土' :
    element === 'METAL' ? '金' :
    element === 'WATER' ? '水' :
    null
  );
  for (const key of [upperKey, lowerKey, koreanKey, hanjaKey]) {
    if (key && key in distribution) {
      const v = distribution[key];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
  }
  return 0;
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
  /** Heeshin ordinal — 0 when unresolved; otherwise 1..5 mirroring
   *  ELEMENT_ORDINAL. Lets fragment authors reference 희신 오행 순번
   *  as numeric evidence parallel to yongshinElementOrdinal. */
  readonly heeshinElementOrdinal: number;
  readonly gishinElement: ElementCode | null;
  /** Gishin ordinal — see heeshinElementOrdinal. */
  readonly gishinElementOrdinal: number;
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
  /** Polarity ordinal — neutral=0, YANG=1, YIN=2. Stable enumeration so a
   *  fragment can attach a numeric backing for `feature.dayMasterPolarityOrdinal`. */
  readonly dayMasterPolarityOrdinal: number;

  // ─── Additive numeric axes (Phase 3 Agent A16) ──────────────────────────
  // These widen the set of feature paths a fragment-author can address via
  // numericalEvidence.valueExpression (contract regex
  // `^(feature|cell)(\.[A-Za-z_][A-Za-z0-9_]*)+$`). Each defaults to 0
  // when the underlying SajuSummary field is absent so the resolver in
  // `numerical-evidence.ts` always returns a finite number.
  /** Total support score from the strength analysis (`saju.strength.totalSupport`). */
  readonly strengthTotalSupport: number;
  /** Total oppose score (`saju.strength.totalOppose`). */
  readonly strengthTotalOppose: number;
  /** 득령 score: month-branch alignment with the day-master. */
  readonly strengthDeukryeong: number;
  /** 득지 score: same-element root in day branch. */
  readonly strengthDeukji: number;
  /** 득세 score: same-element presence across the chart. */
  readonly strengthDeukse: number;
  /** Score-facing confidence ratio converted from SajuSummary's 0..100 points. */
  readonly yongshinConfidence: number;
  /** Engine confidence in the surfaced 격국 (0..1). */
  readonly gyeokgukConfidence: number;
  /** Number of 신살 hits surfaced for this chart. */
  readonly shinsalCount: number;
  /** Count of 부족 오행 (deficient elements) reported by the engine. */
  readonly deficientElementCount: number;
  /** Count of 과다 오행 (excessive elements). */
  readonly excessiveElementCount: number;
  /** Deficient five-element identities (parsed to engine codes) — parallel to
   *  deficientElementCount but usable to NAME the element in plain Korean
   *  (물/불/…). Empty when the chart reports none. Enables conditional
   *  "부족한 물 기운" phrasing without the jargon term 부족오행. */
  readonly deficientElements: readonly ElementCode[];
  /** Excessive five-element identities (parsed to engine codes). */
  readonly excessiveElements: readonly ElementCode[];
  /** Count of 천간 (heavenly-stem) relations. */
  readonly cheonganRelationCount: number;
  /** Count of 지지 (earthly-branch) relations. */
  readonly jijiRelationCount: number;
  /** 1..12 month from the saju time-correction (preferred over civil month). */
  readonly birthMonth: number;
  /** 1..12 calendar month of `targetDate`. */
  readonly currentMonth: number;
  /** Element-distribution counts (frequencies of each five-element across the
   *  chart's stems and branches). 0 when the engine did not surface a count
   *  for that element. */
  readonly woodCount: number;
  readonly fireCount: number;
  readonly earthCount: number;
  readonly metalCount: number;
  readonly waterCount: number;
}

function buildFeatureVectorInternal(
  saju: SajuSummary,
  birth: BirthInfo,
  targetDate: Date,
  ageYearsOverride?: number,
): FeatureVector {
  const dayMasterElement = toElement(saju.dayMaster?.element ?? null);
  const yongshinElement = toElement(saju.yongshin?.element ?? null);
  const heeshinElement = toElement(saju.yongshin?.heeshin ?? null);
  const gishinElement = toElement(saju.yongshin?.gishin ?? null);
  const targetYear = targetCalendarYear(targetDate);
  const birthYear = saju.timeCorrection?.standardYear ?? birth.year ?? targetYear;
  const birthMonth = saju.timeCorrection?.standardMonth ?? birth.month ?? null;
  const inferredAge = targetYear - (birthYear ?? targetYear);
  const age = Math.max(0, ageYearsOverride ?? inferredAge);
  const agePhase = toAgePhase(age);
  const birthSeason = toSeason(birthMonth);
  const currentSeason = toSeason(targetCalendarMonth(targetDate));
  const dayMasterStrength = toStrengthBand(saju);
  const gyeokguk = toGyeokgukCanonical(saju.gyeokguk?.type ?? null);
  const gender = toGender(birth.gender);
  const dayMasterPolarity = toPolarity(saju.dayMaster?.polarity ?? null);
  const elementDistribution = saju.elementDistribution;
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
    heeshinElementOrdinal: heeshinElement ? ELEMENT_ORDINAL[heeshinElement] : 0,
    gishinElement,
    gishinElementOrdinal: gishinElement ? ELEMENT_ORDINAL[gishinElement] : 0,
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
    dayMasterPolarity,
    dayMasterPolarityOrdinal: POLARITY_ORDINAL[dayMasterPolarity],
    strengthTotalSupport: finiteNumber(saju.strength?.totalSupport),
    strengthTotalOppose: finiteNumber(saju.strength?.totalOppose),
    strengthDeukryeong: finiteNumber(saju.strength?.deukryeong),
    strengthDeukji: finiteNumber(saju.strength?.deukji),
    strengthDeukse: finiteNumber(saju.strength?.deukse),
    yongshinConfidence: pointsToRatio(saju.yongshin?.confidence),
    gyeokgukConfidence: finiteNumber(saju.gyeokguk?.confidence),
    shinsalCount: arrayLength(saju.shinsalHits),
    deficientElementCount: arrayLength(saju.deficientElements),
    excessiveElementCount: arrayLength(saju.excessiveElements),
    deficientElements: parseElementList(saju.deficientElements),
    excessiveElements: parseElementList(saju.excessiveElements),
    cheonganRelationCount: arrayLength(saju.cheonganRelations),
    jijiRelationCount: arrayLength(saju.jijiRelations),
    birthMonth: birthMonth ?? 0,
    currentMonth: targetCalendarMonth(targetDate),
    woodCount: elementDistributionCount(elementDistribution, 'WOOD'),
    fireCount: elementDistributionCount(elementDistribution, 'FIRE'),
    earthCount: elementDistributionCount(elementDistribution, 'EARTH'),
    metalCount: elementDistributionCount(elementDistribution, 'METAL'),
    waterCount: elementDistributionCount(elementDistribution, 'WATER'),
  };
}

export function buildFeatureVector(
  saju: SajuSummary,
  birth: BirthInfo,
  targetDate: Date,
): FeatureVector {
  return buildFeatureVectorInternal(saju, birth, targetDate);
}

export function buildFeatureVectorForAge(
  saju: SajuSummary,
  birth: BirthInfo,
  targetDate: Date,
  ageYears: number,
): FeatureVector {
  return buildFeatureVectorInternal(saju, birth, targetDate, ageYears);
}
