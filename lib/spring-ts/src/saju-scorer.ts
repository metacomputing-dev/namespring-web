/**
 * saju-scorer.ts
 *
 * Scores how well a name's elemental makeup fits a person's saju (四柱) chart.
 * The final score blends four sub-scores, each measuring a different aspect
 * of compatibility, then subtracts penalties for harmful elements.
 *
 * ── Scoring Pipeline ────────────────────────────────────────────────────
 *
 *   1. BALANCE  — Does the name fill gaps in the chart's five-element spread?
 *   2. YONGSHIN — Does the name contain the helpful element (yongshin)?
 *   3. STRENGTH — Does the name counterbalance day-master strength/weakness?
 *   4. TEN GOD  — Does the name compensate for ten-god group imbalances?
 *
 *   finalScore = weighted(balance, yongshin, strength, tenGod)
 *                + deficiency bonus
 *                - gisin penalty        (harmful element present)
 *                - gusin penalty        (most harmful element present)
 *                - gyeokguk penalty     (breaks jonggyeok pattern)
 *
 * Ported from feature branch's saju-calculator.ts, removing the
 * NameCalculator class inheritance and keeping only pure functions.
 */

import type { SajuOutputSummary, SajuYongshinSummary } from './types.js';
import { elementFromSajuCode } from './saju-adapter.js';
import {
  type ElementKey,
  ELEMENT_KEYS,
  clamp,
  elementCount,
  totalCount,
  weightedElementAverage,
  normalizeSignedScore,
  generatedBy,
} from './scoring.js';

// ---------------------------------------------------------------------------
//  Configuration — loaded from JSON so non-programmers can adjust the tuning
// ---------------------------------------------------------------------------
import scoringConfig from '../config/saju-scoring.json';

/** How much weight each yongshin recommendation type carries (1.0 = strongest). */
const YONGSHIN_TYPE_WEIGHTS: Record<string, number> = scoringConfig.yongshinTypeWeights;

/** Fallback weight when the recommendation type is not in the table. */
const DEFAULT_TYPE_WEIGHT: number = scoringConfig.defaultTypeWeight;

/** Fallback confidence when the saju engine does not report one. */
const DEFAULT_CONFIDENCE: number = scoringConfig.defaultConfidence;

/** Recommendation types that get contextual priority (school-specific methods). */
const CONTEXTUAL_TYPES: readonly string[] = scoringConfig.contextualTypes;

/** The five ten-god groups: friend, output, wealth, authority, resource. */
const TEN_GOD_GROUPS: readonly string[] = scoringConfig.tenGodGroupNames;

// Destructure the nested config sections for easier access
const {
  balanceScoring:   BALANCE,
  yongshinScoring:  YONGSHIN,
  strengthScoring:  STRENGTH,
  tenGodScoring:    TEN_GOD,
  adaptiveWeights:  ADAPTIVE,
  penalties:        PENALTY,
  deficiencyBonus:  DEFICIENCY,
  passing:          PASSING,
} = scoringConfig;

// ---------------------------------------------------------------------------
//  Public interface — the shape of a saju name score result
// ---------------------------------------------------------------------------

export interface SajuNameScoreResult {
  score: number;
  isPassed: boolean;
  combined: Record<ElementKey, number>;
  breakdown: {
    balance: number; yongshin: number; strength: number; tenGod: number;
    penalties: { gisin: number; gusin: number; gyeokguk: number; total: number };
    deficiencyBonus: number;
    elementMatches: { yongshin: number; heesin: number; gisin: number; gusin: number };
  };
}

// =========================================================================
//  1. BALANCE SCORE
//     Measures how evenly the five elements are distributed after
//     combining the saju chart distribution with the name's root elements.
// =========================================================================

/**
 * Computes the "optimal" sorted distribution given an initial sorted array
 * and a budget of extra counts to distribute.  The algorithm fills from the
 * bottom up: it raises the lowest values to the next level, then spreads
 * any remaining budget equally.
 */
function computeOptimalSorted(initialCounts: number[], resourceCount: number): number[] {
  const sortedCounts = [...initialCounts].sort((a, b) => a - b);
  let remaining = resourceCount;
  let level = 0;

  // Phase 1: raise the lowest elements up to match higher ones
  while (level < ELEMENT_KEYS.length - 1 && remaining > 0) {
    const gapToNextLevel = sortedCounts[level + 1] - sortedCounts[level];
    const elementsAtThisLevel = level + 1;

    if (gapToNextLevel === 0) { level++; continue; }

    const costToLevelUp = gapToNextLevel * elementsAtThisLevel;
    if (remaining >= costToLevelUp) {
      for (let index = 0; index <= level; index++) sortedCounts[index] += gapToNextLevel;
      remaining -= costToLevelUp;
      level++;
    } else {
      const equalShare = Math.floor(remaining / elementsAtThisLevel);
      const leftover   = remaining % elementsAtThisLevel;
      for (let index = 0; index <= level; index++) sortedCounts[index] += equalShare;
      for (let index = 0; index < leftover; index++) sortedCounts[index] += 1;
      remaining = 0;
    }
  }

  // Phase 2: spread any remaining budget evenly across all 5 elements
  if (remaining > 0) {
    const equalShare = Math.floor(remaining / 5);
    const leftover   = remaining % 5;
    for (let index = 0; index < 5; index++) sortedCounts[index] += equalShare;
    for (let index = 0; index < leftover; index++) sortedCounts[index] += 1;
  }

  return sortedCounts;
}

/**
 * Balance score: how close is the combined (saju + name) distribution
 * to the mathematically optimal distribution?
 */
function computeBalanceScore(
  sajuDist: Record<ElementKey, number>,
  rootDist: Record<ElementKey, number>,
): { score: number; isPassed: boolean; combined: Record<ElementKey, number> } {

  const initialDistribution = ELEMENT_KEYS.map(key => sajuDist[key] ?? 0);
  const rootCounts          = ELEMENT_KEYS.map(key => rootDist[key] ?? 0);
  const finalDistribution   = ELEMENT_KEYS.map((_, index) => initialDistribution[index] + rootCounts[index]);

  const rootTotal           = rootCounts.reduce((sum, count) => sum + count, 0);
  const optimalDistribution = computeOptimalSorted(initialDistribution, rootTotal);

  const finalSorted     = [...finalDistribution].sort((a, b) => a - b);
  const isOptimal       = finalSorted.every((value, index) => value === optimalDistribution[index]);

  const finalZeroCount   = finalDistribution.filter(value => value === 0).length;
  const optimalZeroCount = optimalDistribution.filter(value => value === 0).length;
  const finalSpread      = Math.max(...finalDistribution)   - Math.min(...finalDistribution);
  const optimalSpread    = Math.max(...optimalDistribution)  - Math.min(...optimalDistribution);

  let score: number;
  if (isOptimal) {
    score = 100;
  } else {
    const manhattanDistance = finalSorted.reduce((sum, value, index) => sum + Math.abs(value - optimalDistribution[index]), 0);
    score = clamp(
      100
        - BALANCE.penaltyPerMismatch   * Math.floor(manhattanDistance / 2)
        - BALANCE.penaltyPerExtraZero  * Math.max(0, finalZeroCount - optimalZeroCount)
        - BALANCE.penaltyPerExtraSpread * Math.max(0, finalSpread - optimalSpread),
      0, 100,
    );
  }

  return {
    score,
    isPassed: isOptimal || (finalZeroCount <= optimalZeroCount && finalSpread <= optimalSpread && score >= BALANCE.minPassingScore),
    combined: Object.fromEntries(ELEMENT_KEYS.map((key, index) => [key, finalDistribution[index]])) as Record<ElementKey, number>,
  };
}

// =========================================================================
//  2. YONGSHIN SCORE
//     Measures how strongly the name's elements align with the recommended
//     yongshin (helpful) and heesin (supporting) elements, while penalizing
//     gisin (harmful) and gusin (most harmful).
// =========================================================================

function computeRecommendationScore(
  rootDist: Record<ElementKey, number>,
  yongshinData: SajuYongshinSummary,
): { score: number; contextualPriority: number } | null {
  if (yongshinData.recommendations.length === 0) return null;

  let weightedSum     = 0;
  let totalWeight     = 0;
  let contextWeight   = 0;

  for (const recommendation of yongshinData.recommendations) {
    const primaryElement   = elementFromSajuCode(recommendation.primaryElement);
    const secondaryElement = elementFromSajuCode(recommendation.secondaryElement);
    if (!primaryElement && !secondaryElement) continue;

    const confidence      = Number.isFinite(recommendation.confidence)
      ? clamp(recommendation.confidence, 0, 1)
      : YONGSHIN.recommendationScoring.fallbackConfidence;
    const typeWeight      = Math.max(
      YONGSHIN.recommendationScoring.minWeight,
      confidence * (YONGSHIN_TYPE_WEIGHTS[recommendation.type] ?? DEFAULT_TYPE_WEIGHT),
    );

    weightedSum += weightedElementAverage(rootDist, element => {
      if (primaryElement   && element === primaryElement)   return YONGSHIN.recommendationScoring.primaryWeight;
      if (secondaryElement && element === secondaryElement) return YONGSHIN.recommendationScoring.secondaryWeight;
      return 0;
    }) * typeWeight;

    totalWeight += typeWeight;
    if (CONTEXTUAL_TYPES.includes(recommendation.type)) contextWeight += typeWeight;
  }

  if (totalWeight <= 0) return null;
  return {
    score:              clamp((weightedSum / totalWeight) * 100, 0, 100),
    contextualPriority: clamp(contextWeight / totalWeight, 0, 1),
  };
}

function computeYongshinScore(
  rootDist: Record<ElementKey, number>,
  yongshinData: SajuYongshinSummary | null,
) {
  if (!yongshinData) return {
    score: 50, confidence: 0, contextualPriority: 0,
    gisinPenalty: 0, gusinPenalty: 0, gusinRatio: 0,
    elementMatches: { yongshin: 0, heesin: 0, gisin: 0, gusin: 0 },
  };

  const yongshinElement = elementFromSajuCode(yongshinData.finalYongshin);
  const heesinElement   = elementFromSajuCode(yongshinData.finalHeesin);
  const gisinElement    = elementFromSajuCode(yongshinData.gisin);
  const gusinElement    = elementFromSajuCode(yongshinData.gusin);

  const confidence = Number.isFinite(yongshinData.finalConfidence)
    ? clamp(yongshinData.finalConfidence, 0, 1)
    : DEFAULT_CONFIDENCE;

  // Step 1: Affinity — weighted average of how each name element aligns
  const affinityWeights = YONGSHIN.affinityWeights;
  const affinityValue = weightedElementAverage(rootDist, element => {
    if (gusinElement    && element === gusinElement)    return affinityWeights.gusin;
    if (gisinElement    && element === gisinElement)    return affinityWeights.gisin;
    if (yongshinElement && element === yongshinElement) return affinityWeights.yongshin;
    if (heesinElement   && element === heesinElement)   return affinityWeights.heesin;
    return 0;
  });

  // Step 2: Blend affinity with recommendation scores
  const recommendationResult = computeRecommendationScore(rootDist, yongshinData);
  const affinityScore        = normalizeSignedScore(affinityValue);
  const blendedRawScore      = recommendationResult === null
    ? affinityScore
    : YONGSHIN.recommendationBlend.affinityRatio        * affinityScore
    + YONGSHIN.recommendationBlend.recommendationRatio  * recommendationResult.score;

  // Step 3: Scale by confidence
  const confidenceScaled = YONGSHIN.confidenceImpact.baseRatio + confidence * YONGSHIN.confidenceImpact.variableRatio;
  const score = clamp(50 + (blendedRawScore - 50) * confidenceScaled, 0, 100);

  // Step 4: Compute gisin/gusin penalties
  const totalElements = totalCount(rootDist);
  const gisinCount    = elementCount(rootDist, gisinElement);
  const gusinCount    = elementCount(rootDist, gusinElement);
  const gisinRatio    = totalElements > 0 ? gisinCount / totalElements : 0;
  const gusinRatio    = totalElements > 0 ? gusinCount / totalElements : 0;

  const penaltyScale = YONGSHIN.penalties.penaltyScaleBase + YONGSHIN.penalties.penaltyScaleVariable * confidence;

  return {
    score,
    confidence,
    contextualPriority: recommendationResult?.contextualPriority ?? 0,
    gisinPenalty: Math.round(gisinRatio * YONGSHIN.penalties.gisinMultiplier * penaltyScale),
    gusinPenalty: Math.round(gusinRatio * YONGSHIN.penalties.gusinMultiplier * penaltyScale),
    gusinRatio,
    elementMatches: {
      yongshin: elementCount(rootDist, yongshinElement),
      heesin:   elementCount(rootDist, heesinElement),
      gisin:    gisinCount,
      gusin:    gusinCount,
    },
  };
}

// =========================================================================
//  3. STRENGTH SCORE
//     If the day master is "strong", the name should weaken it (and vice versa).
// =========================================================================

function computeStrengthScore(
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): number {
  const strengthData  = sajuOutput?.strength;
  const dayMasterElement = sajuOutput?.dayMaster?.element;
  if (!strengthData || !dayMasterElement) return 50;

  const balanceDirection = normalizeSignedScore(
    weightedElementAverage(rootDist, element => {
      const supportsStrength = (element === dayMasterElement || element === generatedBy(dayMasterElement));
      return (supportsStrength === strengthData.isStrong) ? -1 : 1;
    }),
  );

  const support   = Math.abs(strengthData.totalSupport);
  const oppose    = Math.abs(strengthData.totalOppose);
  const totalMagnitude = support + oppose;
  const intensity = totalMagnitude > 0
    ? clamp(Math.abs(support - oppose) / totalMagnitude, 0, 1)
    : STRENGTH.defaultIntensity;

  return clamp(
    50 + (balanceDirection - 50) * (STRENGTH.confidenceImpact.baseRatio + intensity * STRENGTH.confidenceImpact.variableRatio),
    0, 100,
  );
}

// =========================================================================
//  4. TEN GOD SCORE
//     Rewards names whose elements compensate for under-represented
//     ten-god groups in the chart.
// =========================================================================

function computeTenGodScore(
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): number {
  const tenGodData       = sajuOutput?.tenGod;
  const dayMasterElement = sajuOutput?.dayMaster?.element;
  if (!tenGodData || !dayMasterElement) return 50;

  const groupCounts = tenGodData.groupCounts;
  const totalGroups = TEN_GOD_GROUPS.reduce((sum, group) => sum + (groupCounts[group] ?? 0), 0);
  if (totalGroups <= 0) return 50;

  const averageCount = totalGroups / TEN_GOD_GROUPS.length;

  const elementWeights: Record<ElementKey, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  for (const group of TEN_GOD_GROUPS) {
    const deviation = (averageCount - (groupCounts[group] ?? 0)) / Math.max(averageCount, 1);
    const targetElement = ELEMENT_KEYS[(ELEMENT_KEYS.indexOf(dayMasterElement) + TEN_GOD_GROUPS.indexOf(group)) % 5];
    elementWeights[targetElement] += deviation >= 0 ? deviation : deviation * TEN_GOD.negativeScale;
  }

  return clamp(
    50 + weightedElementAverage(rootDist, element => clamp(elementWeights[element], -1, 1)) * TEN_GOD.maxInfluence,
    0, 100,
  );
}

// =========================================================================
//  ADAPTIVE WEIGHT RESOLUTION
// =========================================================================

function resolveAdaptiveWeights(
  balanceScore: number,
  yongshinInfo: { score: number; confidence: number; contextualPriority: number },
): { balance: number; yongshin: number; strength: number; tenGod: number } {

  const yongshinSurplusRatio = clamp((yongshinInfo.score - balanceScore) / ADAPTIVE.shiftDivisor, 0, 1);
  const confidenceBound      = clamp(yongshinInfo.confidence, 0, 1);

  const weightShift =
    ADAPTIVE.baseShiftRatio * yongshinSurplusRatio * (ADAPTIVE.baseConfidenceRatio + ADAPTIVE.confidenceWeight * confidenceBound)
    + ADAPTIVE.confidenceBoost * confidenceBound * clamp(yongshinInfo.contextualPriority, 0, 1);

  return {
    balance:  clamp(ADAPTIVE.balanceBase  - weightShift, ADAPTIVE.balanceMin,  ADAPTIVE.balanceMax),
    yongshin: clamp(ADAPTIVE.yongshinBase + weightShift, ADAPTIVE.yongshinMin, ADAPTIVE.yongshinMax),
    strength: ADAPTIVE.strengthFixed,
    tenGod:   ADAPTIVE.tenGodFixed,
  };
}

// =========================================================================
//  PENALTIES & BONUSES
// =========================================================================

function computeGyeokgukPenalty(
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): number {
  const gyeokgukData = sajuOutput?.gyeokguk;
  if (!gyeokgukData || gyeokgukData.category !== PENALTY.jonggyeokCategory || gyeokgukData.confidence < PENALTY.gyeokgukMinConfidence) return 0;

  const gisinElement = elementFromSajuCode(sajuOutput?.yongshin?.gisin);
  const gusinElement = elementFromSajuCode(sajuOutput?.yongshin?.gusin);
  if (!gisinElement && !gusinElement) return 0;

  const totalElements = totalCount(rootDist);
  if (totalElements === 0) return 0;

  const gisinCount      = elementCount(rootDist, gisinElement);
  const gusinCount      = elementCount(rootDist, gusinElement);
  const harmfulRatio    = (gisinCount + gusinCount) / totalElements;

  return Math.round(harmfulRatio * PENALTY.gyeokgukMaxPenalty * clamp(gyeokgukData.confidence, 0.5, 1));
}

function computeDeficiencyBonus(
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): number {
  const deficientElements = sajuOutput?.deficientElements;
  if (!deficientElements?.length) return 0;

  const yongshinElement = elementFromSajuCode(sajuOutput?.yongshin?.finalYongshin);
  const heesinElement   = elementFromSajuCode(sajuOutput?.yongshin?.finalHeesin);

  let bonus = 0;
  for (const deficient of deficientElements) {
    const elementKey = elementFromSajuCode(deficient);
    if (!elementKey || elementCount(rootDist, elementKey) === 0) continue;

    if (elementKey === yongshinElement)    bonus += DEFICIENCY.yongshinMatch;
    else if (elementKey === heesinElement) bonus += DEFICIENCY.heesinMatch;
  }
  return Math.min(bonus, DEFICIENCY.maxBonus);
}

// =========================================================================
//  MAIN SCORING FUNCTION — composes all sub-scores into a final result
// =========================================================================

export function computeSajuNameScore(
  sajuDist: Record<ElementKey, number>,
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): SajuNameScoreResult {

  // --- Compute the four sub-scores ---
  const balanceResult   = computeBalanceScore(sajuDist, rootDist);
  const yongshinResult  = computeYongshinScore(rootDist, sajuOutput?.yongshin ?? null);
  const strengthScore   = computeStrengthScore(rootDist, sajuOutput);
  const tenGodScore     = computeTenGodScore(rootDist, sajuOutput);

  // --- Resolve adaptive weights (balance vs. yongshin trade-off) ---
  const weight = resolveAdaptiveWeights(balanceResult.score, yongshinResult);

  // --- Weighted blend of all four sub-scores ---
  const weightedBaseScore = clamp(
    weight.balance  * balanceResult.score
    + weight.yongshin * yongshinResult.score
    + weight.strength * strengthScore
    + weight.tenGod   * tenGodScore,
    0, 100,
  );

  // --- Add deficiency bonus ---
  const deficiencyBonus = computeDeficiencyBonus(rootDist, sajuOutput);
  const adjustedScore   = clamp(weightedBaseScore + deficiencyBonus, 0, 100);

  // --- Subtract penalties ---
  const gyeokgukPenalty = computeGyeokgukPenalty(rootDist, sajuOutput);
  const totalPenalty    = yongshinResult.gisinPenalty + yongshinResult.gusinPenalty + gyeokgukPenalty;
  const score           = clamp(adjustedScore - totalPenalty, 0, 100);

  // --- Pass/fail determination ---
  const isPassed =
    score >= PASSING.minScore
    && balanceResult.score >= PASSING.minBalanceScore
    && (sajuOutput?.yongshin == null || (yongshinResult.score >= PASSING.minYongshinScore && yongshinResult.gusinRatio < PASSING.maxGusinRatio));

  return {
    score,
    isPassed,
    combined: balanceResult.combined,
    breakdown: {
      balance:  balanceResult.score,
      yongshin: yongshinResult.score,
      strength: strengthScore,
      tenGod:   tenGodScore,
      penalties: {
        gisin:    yongshinResult.gisinPenalty,
        gusin:    yongshinResult.gusinPenalty,
        gyeokguk: gyeokgukPenalty,
        total:    totalPenalty,
      },
      deficiencyBonus,
      elementMatches: yongshinResult.elementMatches,
    },
  };
}
