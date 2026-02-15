/**
 * rules.ts -- Shared scoring rule functions extracted from evaluator.
 * Pure functions: no side-effects, no I/O.
 */
import {
  type ElementKey, ELEMENT_KEYS,
  isSangSaeng, isSangGeuk, clamp,
} from './element-cycle.js';
import {
  ELEMENT_ARRAY_BASE_SCORE, ELEMENT_ARRAY_SANG_SAENG_BONUS,
  ELEMENT_ARRAY_SANG_GEUK_PENALTY, ELEMENT_ARRAY_SAME_PENALTY,
  ELEMENT_BALANCE_BRACKETS, ELEMENT_BALANCE_FLOOR,
  ELEMENT_SANG_SAENG_MIN_RATIO, ELEMENT_MAX_CONSECUTIVE_SAME,
  POLARITY_RATIO_BRACKETS, POLARITY_RATIO_FLOOR, POLARITY_BASE_SCORE,
  FORTUNE_BUCKET_TOP, FORTUNE_BUCKET_HIGH, FORTUNE_BUCKET_GOOD,
  FORTUNE_BUCKET_WORST, FORTUNE_BUCKET_BAD, FORTUNE_BUCKET_DEFAULT,
} from './constants.js';

export type PolarityValue = 'Positive' | 'Negative';

/** Element array adjacency scoring. */
export function calculateArrayScore(
  arrangement: readonly ElementKey[], surnameLength = 1,
): number {
  if (arrangement.length < 2) return 100;
  let sangSaeng = 0, sangGeuk = 0, same = 0;
  for (let i = 0; i < arrangement.length - 1; i++) {
    if (surnameLength === 2 && i === 0) continue;
    const a = arrangement[i], b = arrangement[i + 1];
    if (isSangSaeng(a, b)) sangSaeng++;
    else if (isSangGeuk(a, b)) sangGeuk++;
    else if (a === b) same++;
  }
  return clamp(
    ELEMENT_ARRAY_BASE_SCORE
      + sangSaeng * ELEMENT_ARRAY_SANG_SAENG_BONUS
      - sangGeuk * ELEMENT_ARRAY_SANG_GEUK_PENALTY
      - same * ELEMENT_ARRAY_SAME_PENALTY,
    0, 100,
  );
}

/** Element balance scoring with bracket thresholds. */
export function calculateBalanceScore(
  distribution: Readonly<Record<ElementKey, number>>,
): number {
  const total = ELEMENT_KEYS.reduce((acc, key) => acc + (distribution[key] ?? 0), 0);
  if (total === 0) return 0;
  const avg = total / 5;
  let deviation = 0;
  for (const key of ELEMENT_KEYS) deviation += Math.abs((distribution[key] ?? 0) - avg);
  for (const [threshold, score] of ELEMENT_BALANCE_BRACKETS) {
    if (deviation <= threshold) return score;
  }
  return ELEMENT_BALANCE_FLOOR;
}

/** Element sang-saeng harmony check. */
export function checkElementSangSaeng(
  arrangement: readonly ElementKey[], surnameLength: number,
): boolean {
  if (arrangement.length < 2) return true;
  const startIdx = surnameLength === 2 ? 1 : 0;
  for (let i = startIdx; i < arrangement.length - 1; i++) {
    if (isSangGeuk(arrangement[i], arrangement[i + 1])) return false;
  }
  const consecutiveStart = surnameLength === 2 ? 2 : 1;
  let consecutive = 1;
  for (let i = consecutiveStart; i < arrangement.length; i++) {
    if (arrangement[i] === arrangement[i - 1]) {
      consecutive++;
      if (consecutive >= ELEMENT_MAX_CONSECUTIVE_SAME) return false;
    } else {
      consecutive = 1;
    }
  }
  if (!(surnameLength === 2 && arrangement.length === 3)) {
    if (isSangGeuk(arrangement[0], arrangement[arrangement.length - 1])) return false;
  }
  let relationCount = 0, sangSaengCount = 0;
  for (let i = 0; i < arrangement.length - 1; i++) {
    if (surnameLength === 2 && i === 0) continue;
    const a = arrangement[i], b = arrangement[i + 1];
    if (a === b) continue;
    relationCount++;
    if (isSangSaeng(a, b)) sangSaengCount++;
  }
  if (relationCount > 0 && sangSaengCount / relationCount < ELEMENT_SANG_SAENG_MIN_RATIO) return false;
  return true;
}

/** Four-frame suri element validation. */
export function checkFourFrameSuriElement(
  arrangement: readonly ElementKey[], givenNameLength: number,
): boolean {
  const checked =
    givenNameLength === 1 && arrangement.length === 3
      ? arrangement.slice(0, 2)
      : arrangement.slice();
  if (checked.length < 2) return false;
  for (let i = 0; i < checked.length - 1; i++) {
    if (isSangGeuk(checked[i], checked[i + 1])) return false;
  }
  if (isSangGeuk(checked[checked.length - 1], checked[0])) return false;
  return new Set(checked).size > 1;
}

/** Dominant element check -- true when any single element is majority. */
export function countDominant(distribution: Record<ElementKey, number>): boolean {
  const total = ELEMENT_KEYS.reduce((acc, key) => acc + distribution[key], 0);
  const threshold = Math.floor(total / 2) + 1;
  return ELEMENT_KEYS.some((key) => distribution[key] >= threshold);
}

/** Polarity harmony check. */
export function checkPolarityHarmony(
  arrangement: readonly PolarityValue[], surnameLength: number,
): boolean {
  if (arrangement.length < 2) return true;
  const neg = arrangement.filter(v => v === 'Negative').length;
  const pos = arrangement.length - neg;
  if (neg === 0 || pos === 0) return false;
  if (surnameLength === 1 && arrangement[0] === arrangement[arrangement.length - 1]) return false;
  return true;
}

/** Polarity ratio scoring. */
export function polarityScore(negCount: number, posCount: number): number {
  const total = Math.max(0, negCount + posCount);
  if (total === 0) return 0;
  const minSide = Math.min(negCount, posCount);
  const ratio = minSide / total;
  let ratioScore = POLARITY_RATIO_FLOOR;
  for (const [threshold, score] of POLARITY_RATIO_BRACKETS) {
    if (ratio >= threshold) { ratioScore = score; break; }
  }
  return POLARITY_BASE_SCORE + ratioScore;
}

/** Fortune string to bucket score. */
export function bucketFromFortune(fortune: string): number {
  const f = fortune ?? '';
  if (f.includes('최상운수') || f.includes('최상')) return FORTUNE_BUCKET_TOP;
  if (f.includes('상운수')  || f.includes('상'))  return FORTUNE_BUCKET_HIGH;
  if (f.includes('양운수')  || f.includes('양'))  return FORTUNE_BUCKET_GOOD;
  if (f.includes('최흉운수') || f.includes('최흉')) return FORTUNE_BUCKET_WORST;
  if (f.includes('흉운수')  || f.includes('흉'))  return FORTUNE_BUCKET_BAD;
  return FORTUNE_BUCKET_DEFAULT;
}
