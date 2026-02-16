/**
 * saju-calculator.ts
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
 * ── Glossary ────────────────────────────────────────────────────────────
 *  Yongshin (용신)  — the "helpful god" element the chart needs most
 *  Heesin (희신)    — the supporting element that assists yongshin
 *  Gisin (기신)     — a harmful element that weakens the chart
 *  Gusin (구신)     — the MOST harmful element (worse than gisin)
 *  Gyeokguk (격국)  — the structural pattern of the birth chart
 *  Jonggyeok (종격) — a special gyeokguk where harmful elements break it
 *  Ohaeng (오행)    — the Five Elements (Wood, Fire, Earth, Metal, Water)
 * ─────────────────────────────────────────────────────────────────────────
 */
import { type EvalContext, type AnalysisDetail, type CalculatorPacket, type EvaluableCalculator, putInsight, createSignal } from './core/evaluator.js';
import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import type { SajuCompatibility, SajuOutputSummary, SajuYongshinSummary } from './types.js';
import { elementFromSajuCode } from './saju-adapter.js';
import { SAJU_FRAME } from './spring-evaluator.js';
import {
  type ElementKey,
  ELEMENT_KEYS,
  clamp,
  elementCount,
  totalCount,
  weightedElementAverage,
  normalizeSignedScore,
  generatedBy,
  distributionFromArrangement,
} from './core/scoring.js';

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
 *
 * - 100 = perfectly optimal
 * - Loses points for: mismatch distance, extra zeros, extra spread
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

/**
 * Scores how well the name matches the detailed recommendations from the
 * saju engine (e.g., EOKBU, JOHU, TONGGWAN — various analysis methods).
 * Each recommendation has its own confidence and method-type weight.
 */
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

/**
 * Computes the full yongshin sub-score by:
 *   1. Calculating an "affinity" value — how much the name's elements lean
 *      toward helpful vs. harmful gods
 *   2. Blending with detailed recommendation scores (if available)
 *   3. Scaling the result by the saju engine's confidence
 *   4. Computing penalties for gisin/gusin presence
 */
function computeYongshinScore(
  rootDist: Record<ElementKey, number>,
  yongshinData: SajuYongshinSummary | null,
) {
  if (!yongshinData) return {
    score: 50, confidence: 0, contextualPriority: 0,
    gisinPenalty: 0, gusinPenalty: 0, gusinRatio: 0,
    elementMatches: { yongshin: 0, heesin: 0, gisin: 0, gusin: 0 },
  };

  // Resolve the four key elements from the yongshin analysis
  const yongshinElement = elementFromSajuCode(yongshinData.finalYongshin);
  const heesinElement   = elementFromSajuCode(yongshinData.finalHeesin);
  const gisinElement    = elementFromSajuCode(yongshinData.gisin);
  const gusinElement    = elementFromSajuCode(yongshinData.gusin);

  const confidence = Number.isFinite(yongshinData.finalConfidence)
    ? clamp(yongshinData.finalConfidence, 0, 1)
    : DEFAULT_CONFIDENCE;

  // Step 1: Affinity — weighted average of how each name element aligns
  //   yongshin = +1, heesin = +0.65, gisin = -0.65, gusin = -1
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

  // Step 3: Scale by confidence — higher confidence = more impact on the score
  const confidenceScaled = YONGSHIN.confidenceImpact.baseRatio + confidence * YONGSHIN.confidenceImpact.variableRatio;
  const score = clamp(50 + (blendedRawScore - 50) * confidenceScaled, 0, 100);

  // Step 4: Compute gisin/gusin penalties
  const totalElements = totalCount(rootDist);
  const gisinCount    = elementCount(rootDist, gisinElement);
  const gusinCount    = elementCount(rootDist, gusinElement);
  const gisinRatio    = totalElements > 0 ? gisinCount / totalElements : 0;
  const gusinRatio    = totalElements > 0 ? gusinCount / totalElements : 0;

  // Penalty scale: higher confidence = stricter penalty
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
//     This score measures whether the name's elements push in the right direction.
// =========================================================================

function computeStrengthScore(
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): number {
  const strengthData  = sajuOutput?.strength;
  const dayMasterElement = sajuOutput?.dayMaster?.element;
  if (!strengthData || !dayMasterElement) return 50;

  // For each name element, check if it supports or opposes the day master.
  // If the day master is already strong, supporting elements are BAD (-1),
  // and opposing elements are GOOD (+1).  Vice versa if the master is weak.
  const balanceDirection = normalizeSignedScore(
    weightedElementAverage(rootDist, element => {
      const supportsStrength = (element === dayMasterElement || element === generatedBy(dayMasterElement));
      return (supportsStrength === strengthData.isStrong) ? -1 : 1;
    }),
  );

  // Intensity: how lopsided is the support/oppose ratio?
  const support   = Math.abs(strengthData.totalSupport);
  const oppose    = Math.abs(strengthData.totalOppose);
  const totalMagnitude = support + oppose;
  const intensity = totalMagnitude > 0
    ? clamp(Math.abs(support - oppose) / totalMagnitude, 0, 1)
    : STRENGTH.defaultIntensity;

  // Final score: centered at 50, scaled by intensity
  return clamp(
    50 + (balanceDirection - 50) * (STRENGTH.confidenceImpact.baseRatio + intensity * STRENGTH.confidenceImpact.variableRatio),
    0, 100,
  );
}

// =========================================================================
//  4. TEN GOD SCORE
//     The ten gods form five groups (friend, output, wealth, authority, resource).
//     This score rewards names whose elements compensate for under-represented
//     groups in the chart.
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

  // For each ten-god group, compute how deficient it is relative to the average.
  // Map that deficiency to the corresponding element (based on cycle position).
  const elementWeights: Record<ElementKey, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  for (const group of TEN_GOD_GROUPS) {
    const deviation = (averageCount - (groupCounts[group] ?? 0)) / Math.max(averageCount, 1);
    const targetElement = ELEMENT_KEYS[(ELEMENT_KEYS.indexOf(dayMasterElement) + TEN_GOD_GROUPS.indexOf(group)) % 5];
    // Positive deviation = group is under-represented, so its element is desirable.
    // Negative deviation (over-represented) is scaled down to avoid over-penalizing.
    elementWeights[targetElement] += deviation >= 0 ? deviation : deviation * TEN_GOD.negativeScale;
  }

  return clamp(
    50 + weightedElementAverage(rootDist, element => clamp(elementWeights[element], -1, 1)) * TEN_GOD.maxInfluence,
    0, 100,
  );
}

// =========================================================================
//  ADAPTIVE WEIGHT RESOLUTION
//  The four sub-scores are not weighted equally.  When yongshin data is
//  highly confident and diverges from the balance score, we shift weight
//  from balance toward yongshin.
// =========================================================================

function resolveAdaptiveWeights(
  balanceScore: number,
  yongshinInfo: { score: number; confidence: number; contextualPriority: number },
): { balance: number; yongshin: number; strength: number; tenGod: number } {

  // How much the yongshin score exceeds the balance score (normalized)
  const yongshinSurplusRatio = clamp((yongshinInfo.score - balanceScore) / ADAPTIVE.shiftDivisor, 0, 1);
  const confidenceBound      = clamp(yongshinInfo.confidence, 0, 1);

  // The "weight shift" moves budget from balance to yongshin when warranted
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

/**
 * Gyeokguk penalty: in a "jonggyeok" (종격) chart, using gisin/gusin
 * elements breaks the structural pattern and incurs an extra penalty.
 * This penalty intentionally stacks with the gisin/gusin penalties above
 * because in jonggyeok, harmful elements cause a "破格" (broken pattern).
 */
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

/**
 * Deficiency bonus: if the saju chart is deficient in an element and the
 * name provides it, and that element happens to be yongshin or heesin,
 * the name gets a small bonus.  This rewards names that serve double duty.
 */
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
  // Note: gyeokguk penalty intentionally stacks with gisin/gusin penalties.
  // In jonggyeok charts, using gisin triggers a "破格" (broken pattern).
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

// =========================================================================
//  SajuCalculator — plugs into the name-ts evaluator framework
// =========================================================================

export class SajuCalculator implements EvaluableCalculator {
  readonly id = 'saju';
  private scoreResult: SajuNameScoreResult | null = null;

  constructor(
    private surnameEntries: HanjaEntry[],
    private givenNameEntries: HanjaEntry[],
    private sajuDistribution: Record<ElementKey, number>,
    private sajuOutput: SajuOutputSummary | null,
  ) {}

  visit(ctx: EvalContext): void {
    const rootDist = distributionFromArrangement(
      [...this.surnameEntries, ...this.givenNameEntries].map(entry => entry.resource_element as ElementKey),
    );
    this.scoreResult = computeSajuNameScore(this.sajuDistribution, rootDist, this.sajuOutput);
    putInsight(ctx, SAJU_FRAME, this.scoreResult.score, this.scoreResult.isPassed, 'SAJU+ELEMENT', {
      sajuDistribution: this.sajuDistribution,
      distributionSource: this.sajuOutput ? 'saju-ts' : 'fallback',
      elementDistribution: rootDist,
      combinedDistribution: this.scoreResult.combined,
      scoring: this.scoreResult.breakdown,
      analysisOutput: this.sajuOutput,
    });
  }

  backward(ctx: EvalContext): CalculatorPacket {
    return { signals: [createSignal(SAJU_FRAME, ctx, 1.0)] };
  }

  getCombinedDistribution(): Record<ElementKey, number> {
    if (this.scoreResult) return this.scoreResult.combined;
    return Object.fromEntries(
      ELEMENT_KEYS.map((key) => [key, 0]),
    ) as Record<ElementKey, number>;
  }

  getAnalysis(): AnalysisDetail<SajuCompatibility> {
    const breakdown     = this.scoreResult?.breakdown;
    const elementMatches = breakdown?.elementMatches;
    const yongshinData  = this.sajuOutput?.yongshin;
    return {
      type: 'Saju',
      score: this.scoreResult?.score ?? 0,
      polarityScore: 0,
      elementScore: this.scoreResult?.score ?? 0,
      data: {
        yongshinElement:       elementFromSajuCode(yongshinData?.finalYongshin) ?? '',
        heeshinElement:        elementFromSajuCode(yongshinData?.finalHeesin) ?? null,
        gishinElement:         elementFromSajuCode(yongshinData?.gisin) ?? null,
        nameElements:          this.givenNameEntries.map(entry => entry.resource_element),
        yongshinMatchCount:    elementMatches?.yongshin ?? 0,
        gishinMatchCount:      elementMatches?.gisin ?? 0,
        dayMasterSupportScore: breakdown?.strength ?? 0,
        affinityScore:         this.scoreResult?.score ?? 0,
      },
    };
  }
}
