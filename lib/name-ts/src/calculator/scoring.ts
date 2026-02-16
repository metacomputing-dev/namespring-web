/**
 * scoring.ts -- Shared scoring utilities for Korean name analysis.
 *
 * This file contains the core mathematical functions used to evaluate how
 * "harmonious" a Korean name is, based on the Five Elements (Oh-Haeng)
 * and Yin/Yang polarity.
 *
 * All tunable thresholds, weights, and fortune-bucket definitions live in
 * the external config file `config/scoring-rules.json` so that domain
 * experts can adjust them without touching code.
 */

import scoringRules from '../../config/scoring-rules.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One of the Five Elements used in East-Asian naming analysis. */
export type ElementKey = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';

/** Yin-Yang polarity of a syllable. */
export type PolarityValue = 'Positive' | 'Negative';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The five elements in their canonical cycle order. */
export const ELEMENT_KEYS: readonly ElementKey[] = [
  'Wood', 'Fire', 'Earth', 'Metal', 'Water',
] as const;

// ---------------------------------------------------------------------------
// Five-Element Cycle Helpers
// ---------------------------------------------------------------------------

/**
 * Look up an element at a given offset from the starting element,
 * wrapping around the five-element cycle.
 *
 * Example: getElementAtCycleOffset('Wood', 1) => 'Fire'  (next in cycle)
 *          getElementAtCycleOffset('Wood', 4) => 'Water' (previous in cycle)
 */
function getElementAtCycleOffset(element: ElementKey, offset: number): ElementKey {
  const currentIndex = ELEMENT_KEYS.indexOf(element);
  const wrappedIndex = (currentIndex + offset) % 5;
  return ELEMENT_KEYS[wrappedIndex];
}

/**
 * Return the element that this element GENERATES (feeds).
 * In the cycle, each element generates the one immediately after it.
 *
 * Wood -> Fire -> Earth -> Metal -> Water -> Wood
 */
function getGeneratingTarget(element: ElementKey): ElementKey {
  return getElementAtCycleOffset(element, 1);
}

/**
 * Return the element that GENERATES (feeds) this element.
 * This is the element immediately before it in the cycle.
 *
 * Example: generatedBy('Fire') => 'Wood'  (wood fuels fire)
 */
export const generatedBy = (element: ElementKey): ElementKey =>
  getElementAtCycleOffset(element, 4);

/**
 * Return the element that this element OVERCOMES (weakens).
 * In the cycle, each element overcomes the one two steps ahead.
 *
 * Example: getOvercomingTarget('Wood') => 'Earth'  (roots break soil)
 */
function getOvercomingTarget(element: ElementKey): ElementKey {
  return getElementAtCycleOffset(element, 2);
}

/**
 * Check whether two elements are in an overcoming (clashing) relationship
 * -- i.e., one overcomes the other.
 */
export const isOvercoming = (a: ElementKey, b: ElementKey): boolean =>
  getOvercomingTarget(a) === b || getOvercomingTarget(b) === a;

/**
 * Alias: check whether two elements clash.
 * (Same logic as isOvercoming, provided for readability in internal code.)
 */
const areElementsClashing = isOvercoming;

// ---------------------------------------------------------------------------
// Distribution Helpers
// ---------------------------------------------------------------------------

/** Return the count for a specific element in a distribution, or 0 if null. */
export const elementCount = (
  distribution: Record<ElementKey, number>,
  element: ElementKey | null,
): number =>
  element ? (distribution[element] ?? 0) : 0;

/** Sum all element counts in a distribution. */
export const totalCount = (distribution: Record<ElementKey, number>): number =>
  ELEMENT_KEYS.reduce((sum, key) => sum + (distribution[key] ?? 0), 0);

/** Create a fresh distribution with every element count set to zero. */
export const emptyDistribution = (): Record<ElementKey, number> =>
  ({ Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 });

/** Build a distribution by counting each element's occurrences in an array. */
export function distributionFromArrangement(
  arrangement: readonly ElementKey[],
): Record<ElementKey, number> {
  const distribution = emptyDistribution();
  for (const element of arrangement) distribution[element]++;
  return distribution;
}

/**
 * Compute a weighted average over the five elements, where each element's
 * contribution is scaled by its share of the total count.
 */
export function weightedElementAverage(
  distribution: Record<ElementKey, number>,
  selector: (element: ElementKey) => number,
): number {
  const total = totalCount(distribution);
  if (total <= 0) return 0;

  const weightedSum = ELEMENT_KEYS.reduce(
    (accumulated, element) => accumulated + selector(element) * (distribution[element] ?? 0),
    0,
  );
  return weightedSum / total;
}

// ---------------------------------------------------------------------------
// General Math Helpers
// ---------------------------------------------------------------------------

/** Restrict a number to the inclusive range [min, max]. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Convert a signed value in the range [-1, +1] to a 0..100 score.
 *
 *   -1  ->   0
 *    0  ->  50
 *   +1  -> 100
 */
export const normalizeSignedScore = (value: number): number =>
  clamp((value + 1) * 50, 0, 100);

/** Sum all numbers in an array. */
export const sum = (values: readonly number[]): number =>
  values.reduce((accumulated, current) => accumulated + current, 0);

/**
 * Reduce a stroke-sum to the 1..81 range used by Suri (numerological)
 * fortune lookup tables.  Values above 81 wrap around cyclically.
 */
export const adjustTo81 = (value: number): number =>
  value <= scoringRules.maxStrokeSum
    ? value
    : ((value - 1) % scoringRules.maxStrokeSum) + 1;

// ---------------------------------------------------------------------------
// Adjacency Scoring  (calculateArrayScore)
// ---------------------------------------------------------------------------

/**
 * Score how well adjacent elements in an arrangement cooperate.
 *
 * Walk through each consecutive pair of elements and tally:
 *   - Generating pairs  -> bonus points
 *   - Overcoming (clashing) pairs  -> penalty points
 *   - Same-element pairs             -> small penalty
 *
 * For double-surname names, the pair between the two surname characters
 * is skipped because they are fixed and cannot be chosen.
 *
 * The final score starts from a base and is clamped to [0, 100].
 */
export function calculateArrayScore(
  arrangement: readonly ElementKey[],
  surnameLength = 1,
): number {
  if (arrangement.length < 2) return scoringRules.adjacencyScoring.maxScore;

  const { baseScore, generatingBonus, overcomingPenalty, sameElementPenalty,
          minScore, maxScore } = scoringRules.adjacencyScoring;

  let generatingCount = 0;
  let overcomingCount = 0;
  let sameCount       = 0;

  for (let index = 0; index < arrangement.length - 1; index++) {
    // Skip the pair between two surname characters (they are pre-determined).
    const isDoubleSurname = surnameLength === 2;
    if (isDoubleSurname && index === 0) continue;

    const current = arrangement[index];
    const next    = arrangement[index + 1];

    if (getGeneratingTarget(current) === next) {
      generatingCount++;
    } else if (areElementsClashing(current, next)) {
      overcomingCount++;
    } else if (current === next) {
      sameCount++;
    }
  }

  const rawScore = baseScore
    + generatingCount * generatingBonus
    + overcomingCount * overcomingPenalty
    + sameCount       * sameElementPenalty;

  return clamp(rawScore, minScore, maxScore);
}

// ---------------------------------------------------------------------------
// Balance Scoring  (calculateBalanceScore)
// ---------------------------------------------------------------------------

/**
 * Score how evenly the five elements are distributed.
 *
 * A perfectly balanced name (equal counts of every element) scores 100.
 * As the distribution becomes more lopsided, the score drops in steps,
 * but never below the configured minimum floor.
 *
 * Algorithm:
 *   1. Compute the ideal average count (total / 5).
 *   2. Sum the absolute deviations from the average.
 *   3. Subtract a penalty for each step of excess deviation.
 */
export function calculateBalanceScore(
  distribution: Readonly<Record<ElementKey, number>>,
): number {
  const total = totalCount(distribution);
  if (total === 0) return 0;

  const { maxScore, minScore, penaltyPerStep, excessThreshold } =
    scoringRules.balanceScoring;

  const idealAverage    = total / 5;
  let   totalDeviation  = 0;

  for (const key of ELEMENT_KEYS) {
    totalDeviation += Math.abs((distribution[key] ?? 0) - idealAverage);
  }

  // Only penalize deviation that exceeds the "free" threshold,
  // and count in discrete steps (ceil).
  const excessDeviation  = Math.max(0, totalDeviation - excessThreshold);
  const penaltySteps     = Math.ceil(excessDeviation / 2);
  const score            = maxScore - penaltyPerStep * penaltySteps;

  return Math.max(minScore, score);
}

// ---------------------------------------------------------------------------
// Element Generating (Harmony) Check
// ---------------------------------------------------------------------------

/*
 * The following four helper functions each test one specific condition
 * that can disqualify a name arrangement.  They are combined by the
 * main `checkElementGenerating` function below.
 */

/**
 * Check 1 -- Adjacent clash.
 * Return TRUE if any adjacent pair of elements clashes (overcoming).
 * For double-surname names, skip the pair between the two surname chars.
 */
function hasAdjacentOvercoming(
  arrangement: readonly ElementKey[],
  firstCheckableIndex: number,
): boolean {
  for (let index = firstCheckableIndex; index < arrangement.length - 1; index++) {
    if (areElementsClashing(arrangement[index], arrangement[index + 1])) {
      return true;
    }
  }
  return false;
}

/**
 * Check 2 -- Excessive consecutive repetition.
 * Return TRUE if three or more identical elements appear in a row,
 * starting from the position after the first checkable pair.
 */
function hasExcessiveConsecutive(
  arrangement: readonly ElementKey[],
  firstCheckableIndex: number,
): boolean {
  const maxAllowed = scoringRules.hangulElement.maxConsecutiveSame;
  const startIndex = firstCheckableIndex + 1;
  let consecutiveCount = 1;

  for (let index = startIndex; index < arrangement.length; index++) {
    consecutiveCount =
      arrangement[index] === arrangement[index - 1]
        ? consecutiveCount + 1
        : 1;

    if (consecutiveCount >= maxAllowed) return true;
  }
  return false;
}

/**
 * Check 3 -- Circular clash.
 * Return TRUE if the FIRST and LAST elements in the arrangement clash,
 * forming a disharmonious loop.
 *
 * Exception: for a double-surname with exactly 3 characters, the
 * first-to-last wrap-around check is skipped because there is only
 * one "real" (choosable) transition.
 */
function hasCircularOvercoming(
  arrangement: readonly ElementKey[],
  isDoubleSurname: boolean,
): boolean {
  // Skip the circular check for double-surname 3-char names.
  if (isDoubleSurname && arrangement.length === 3) return false;

  return areElementsClashing(
    arrangement[0],
    arrangement[arrangement.length - 1],
  );
}

/**
 * Check 4 -- Sufficient generating ratio.
 * Among all adjacent pairs that are NOT identical elements, at least
 * 60% (configurable) must be "generating" relationships.
 *
 * Returns TRUE if the ratio is sufficient (or there are no distinct pairs).
 */
function hasSufficientGenerating(
  arrangement: readonly ElementKey[],
  isDoubleSurname: boolean,
): boolean {
  const minimumRatio = scoringRules.hangulElement.generatingMinRatio;

  let relationCount      = 0;  // pairs where the two elements differ
  let generatingRelCount = 0;  // of those, pairs that are generating

  for (let index = 0; index < arrangement.length - 1; index++) {
    // Skip the double-surname pair.
    if (isDoubleSurname && index === 0) continue;

    // Skip identical-element pairs (they are neutral, not generating or clashing).
    if (arrangement[index] === arrangement[index + 1]) continue;

    relationCount++;
    if (getGeneratingTarget(arrangement[index]) === arrangement[index + 1]) {
      generatingRelCount++;
    }
  }

  // If there are no distinct-element pairs, there is nothing to fail on.
  if (relationCount === 0) return true;

  return generatingRelCount / relationCount >= minimumRatio;
}

/**
 * Master harmony check for a Hangul element arrangement.
 *
 * A name passes if ALL of the following hold:
 *   1. No adjacent elements clash.
 *   2. No three (or more) identical elements appear in a row.
 *   3. The first and last elements do not clash (circular check).
 *   4. At least 60% of distinct-element adjacencies are generating.
 */
export function checkElementGenerating(
  arrangement: readonly ElementKey[],
  surnameLength: number,
): boolean {
  if (arrangement.length < 2) return true;

  const isDoubleSurname    = surnameLength === 2;
  const firstCheckableIndex = isDoubleSurname ? 1 : 0;

  // Check 1: No adjacent clashes
  if (hasAdjacentOvercoming(arrangement, firstCheckableIndex)) return false;

  // Check 2: No excessive consecutive repetition
  if (hasExcessiveConsecutive(arrangement, firstCheckableIndex)) return false;

  // Check 3: No circular (first-to-last) clash
  if (hasCircularOvercoming(arrangement, isDoubleSurname)) return false;

  // Check 4: Sufficient generating ratio
  return hasSufficientGenerating(arrangement, isDoubleSurname);
}

// ---------------------------------------------------------------------------
// Four-Frame Suri Element Check
// ---------------------------------------------------------------------------

/**
 * Validate the element arrangement derived from the four-frame
 * (Won/Hyung/Lee/Jung) stroke sums.
 *
 * A valid arrangement must:
 *   - Have no adjacent clashing pairs.
 *   - Have no circular (last-to-first) clash.
 *   - Contain at least two distinct elements.
 *
 * For single-character given names with a 3-element arrangement,
 * only the first 2 elements are checked (the third is a padding artifact).
 */
export function checkFourFrameSuriElement(
  arrangement: readonly ElementKey[],
  givenNameLength: number,
): boolean {
  const effectiveLength =
    givenNameLength === 1 && arrangement.length === 3 ? 2 : arrangement.length;

  if (effectiveLength < 2) return false;

  // No adjacent clashes
  for (let index = 0; index < effectiveLength - 1; index++) {
    if (areElementsClashing(arrangement[index], arrangement[index + 1])) {
      return false;
    }
  }

  // No circular clash
  if (areElementsClashing(arrangement[effectiveLength - 1], arrangement[0])) {
    return false;
  }

  // At least two distinct elements
  const uniqueElements = new Set(arrangement.slice(0, effectiveLength));
  return uniqueElements.size > 1;
}

// ---------------------------------------------------------------------------
// Dominant Element Check
// ---------------------------------------------------------------------------

/**
 * Return TRUE if any single element accounts for more than half the total
 * count in the distribution (i.e., one element dominates).
 */
export function countDominant(distribution: Record<ElementKey, number>): boolean {
  const total = totalCount(distribution);
  return ELEMENT_KEYS.some(key => distribution[key] > total / 2);
}

// ---------------------------------------------------------------------------
// Polarity Scoring  (computePolarityResult)
// ---------------------------------------------------------------------------

/**
 * Given the minority ratio (smaller of positive/negative fractions),
 * look up the corresponding bonus from the tier table in config.
 *
 * The tiers are checked top-down; the first tier whose minRatio is met wins.
 * Example tiers:  >= 0.4 -> 50,  >= 0.3 -> 35,  >= 0.2 -> 20,  else -> 10
 */
function lookupPolarityTierBonus(minorityRatio: number): number {
  for (const tier of scoringRules.polarityScoring.ratioTiers) {
    if (minorityRatio >= tier.minRatio) return tier.bonus;
  }
  // Fallback (should not happen if config includes a 0.0 tier).
  return scoringRules.polarityScoring.ratioTiers.at(-1)?.bonus ?? 0;
}

/**
 * Determine whether a polarity arrangement is "balanced enough" to pass.
 *
 * To pass, ALL of these must hold:
 *   - The arrangement has at least 2 syllables.
 *   - There is at least one Negative AND at least one Positive.
 *   - For single-surname names, the first and last polarities must differ
 *     (otherwise the name "loops" on the same polarity).
 */
function isPolarityBalanced(
  arrangement: readonly PolarityValue[],
  surnameLength: number,
): boolean {
  if (arrangement.length < 2) return false;

  const negativeCount = arrangement.filter(value => value === 'Negative').length;
  const hasAtLeastOneOfEach = negativeCount > 0 && negativeCount < arrangement.length;
  if (!hasAtLeastOneOfEach) return false;

  // For single-surname names, the first and last must differ.
  const isSingleSurname = surnameLength === 1;
  if (isSingleSurname && arrangement[0] === arrangement[arrangement.length - 1]) {
    return false;
  }

  return true;
}

/**
 * Score the Yin/Yang polarity balance of a name's syllable arrangement.
 *
 * Steps:
 *   1. Count positive vs. negative syllables.
 *   2. Compute the "minority ratio" (fraction of whichever polarity is rarer).
 *   3. Look up the tier bonus based on how balanced the ratio is.
 *   4. Add the bonus to the base score.
 *   5. Separately determine pass/fail based on structural balance rules.
 */
export function computePolarityResult(
  arrangement: readonly PolarityValue[],
  surnameLength: number,
): { score: number; isPassed: boolean } {
  if (arrangement.length === 0) return { score: 0, isPassed: true };

  // Step 1: Count negatives
  const negativeCount = arrangement.filter(value => value === 'Negative').length;

  // Step 2: Minority ratio -- how close to a 50/50 split?
  const minorityCount = Math.min(negativeCount, arrangement.length - negativeCount);
  const minorityRatio = minorityCount / arrangement.length;

  // Step 3: Look up tier bonus
  const tierBonus = lookupPolarityTierBonus(minorityRatio);

  // Step 4: Compute final score
  const score = scoringRules.polarityScoring.baseScore + tierBonus;

  // Step 5: Structural pass/fail
  const isPassed = isPolarityBalanced(arrangement, surnameLength);

  return { score, isPassed };
}

// ---------------------------------------------------------------------------
// Fortune Bucket Lookup
// ---------------------------------------------------------------------------

/**
 * Map a Korean fortune description string (e.g. "대길 최상") to a numeric
 * score by scanning for known keywords.
 *
 * The keywords and their associated scores are defined in config.
 * If no keyword matches, a default score is returned.
 */
export function bucketFromFortune(fortune: string): number {
  const text = fortune ?? '';

  for (const bucket of scoringRules.fortuneBuckets) {
    if (text.includes(bucket.keyword)) return bucket.score;
  }

  return scoringRules.fortuneDefaultScore;
}
