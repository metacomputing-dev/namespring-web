import type { Element } from "../../types.js";
import { clamp } from "../../utils.js";
import type { SajuYongshinSummary } from "../saju-distribution-resolver.js";
import {
  SAJU_GUSIN_AFFINITY,
  SAJU_GISIN_AFFINITY,
  SAJU_YONGSHIN_AFFINITY,
  SAJU_HEESIN_AFFINITY,
  SAJU_AFFINITY_WEIGHT,
  SAJU_RECOMMENDATION_WEIGHT,
  SAJU_CONFIDENCE_BASE,
  SAJU_CONFIDENCE_MULTIPLIER,
  SAJU_DEFAULT_CONFIDENCE,
  SAJU_DEFAULT_RECOMMENDATION_CONFIDENCE,
  SAJU_SECONDARY_ELEMENT_WEIGHT,
  SAJU_GISIN_PENALTY_MULTIPLIER,
  SAJU_GUSIN_PENALTY_MULTIPLIER,
  SAJU_PENALTY_BASE_FACTOR,
  SAJU_PENALTY_CONFIDENCE_FACTOR,
  YONGSHIN_TYPE_WEIGHT,
  YONGSHIN_TYPE_WEIGHT_DEFAULT,
  CONTEXTUAL_YONGSHIN_TYPES,
} from "../scoring-constants.js";
import {
  elementFromSajuCode,
  elementCount,
  totalCount,
  weightedElementAverage,
  normalizeSignedScore,
} from "./element-cycle.js";

export interface YongshinScoreResult {
  score: number;
  confidence: number;
  contextualPriority: number;
  gisinPenalty: number;
  gusinPenalty: number;
  gisinRatio: number;
  gusinRatio: number;
  elementMatches: {
    yongshin: number;
    heesin: number;
    gisin: number;
    gusin: number;
  };
}

export function computeYongshinScore(
  rootElementDistribution: Record<Element, number>,
  yongshin: SajuYongshinSummary | null,
): YongshinScoreResult {
  if (!yongshin) {
    return {
      score: 50,
      confidence: 0,
      contextualPriority: 0,
      gisinPenalty: 0,
      gusinPenalty: 0,
      gisinRatio: 0,
      gusinRatio: 0,
      elementMatches: { yongshin: 0, heesin: 0, gisin: 0, gusin: 0 },
    };
  }

  const yongshinElement = elementFromSajuCode(yongshin.finalYongshin);
  const heesinElement = elementFromSajuCode(yongshin.finalHeesin);
  const gisinElement = elementFromSajuCode(yongshin.gisin);
  const gusinElement = elementFromSajuCode(yongshin.gusin);
  const confidence = Number.isFinite(yongshin.finalConfidence)
    ? clamp(yongshin.finalConfidence, 0, 1)
    : SAJU_DEFAULT_CONFIDENCE;

  const affinity = weightedElementAverage(rootElementDistribution, (element) => {
    if (gusinElement && element === gusinElement) return SAJU_GUSIN_AFFINITY;
    if (gisinElement && element === gisinElement) return SAJU_GISIN_AFFINITY;
    if (yongshinElement && element === yongshinElement) return SAJU_YONGSHIN_AFFINITY;
    if (heesinElement && element === heesinElement) return SAJU_HEESIN_AFFINITY;
    return 0;
  });

  const affinityScore = normalizeSignedScore(affinity);
  const recommendationScore = computeRecommendationScore(rootElementDistribution, yongshin);
  const raw =
    recommendationScore === null
      ? affinityScore
      : SAJU_AFFINITY_WEIGHT * affinityScore + SAJU_RECOMMENDATION_WEIGHT * recommendationScore.score;
  const score = clamp(
    50 + (raw - 50) * (SAJU_CONFIDENCE_BASE + confidence * SAJU_CONFIDENCE_MULTIPLIER),
    0,
    100,
  );

  const total = totalCount(rootElementDistribution);
  const gisinCount = elementCount(rootElementDistribution, gisinElement);
  const gusinCount = elementCount(rootElementDistribution, gusinElement);
  const gisinRatio = total > 0 ? gisinCount / total : 0;
  const gusinRatio = total > 0 ? gusinCount / total : 0;
  const gisinPenalty = Math.round(
    gisinRatio * SAJU_GISIN_PENALTY_MULTIPLIER * (SAJU_PENALTY_BASE_FACTOR + SAJU_PENALTY_CONFIDENCE_FACTOR * confidence),
  );
  const gusinPenalty = Math.round(
    gusinRatio * SAJU_GUSIN_PENALTY_MULTIPLIER * (SAJU_PENALTY_BASE_FACTOR + SAJU_PENALTY_CONFIDENCE_FACTOR * confidence),
  );

  return {
    score,
    confidence,
    contextualPriority: recommendationScore?.contextualPriority ?? 0,
    gisinPenalty,
    gusinPenalty,
    gisinRatio,
    gusinRatio,
    elementMatches: {
      yongshin: elementCount(rootElementDistribution, yongshinElement),
      heesin: elementCount(rootElementDistribution, heesinElement),
      gisin: gisinCount,
      gusin: gusinCount,
    },
  };
}

export function computeRecommendationScore(
  rootElementDistribution: Record<Element, number>,
  yongshin: SajuYongshinSummary,
): { score: number; contextualPriority: number } | null {
  if (yongshin.recommendations.length === 0) {
    return null;
  }

  let weightedScore = 0;
  let totalWeight = 0;
  let contextualWeight = 0;
  for (const recommendation of yongshin.recommendations) {
    const primary = elementFromSajuCode(recommendation.primaryElement);
    const secondary = elementFromSajuCode(recommendation.secondaryElement);
    if (!primary && !secondary) {
      continue;
    }

    const recConfidence = Number.isFinite(recommendation.confidence)
      ? clamp(recommendation.confidence, 0, 1)
      : SAJU_DEFAULT_RECOMMENDATION_CONFIDENCE;
    const typeWeight = YONGSHIN_TYPE_WEIGHT[recommendation.type] ?? YONGSHIN_TYPE_WEIGHT_DEFAULT;
    const weight = Math.max(0.1, recConfidence * typeWeight);
    const match = weightedElementAverage(rootElementDistribution, (element) => {
      if (primary && element === primary) return 1;
      if (secondary && element === secondary) return SAJU_SECONDARY_ELEMENT_WEIGHT;
      return 0;
    });

    weightedScore += match * weight;
    totalWeight += weight;
    if (CONTEXTUAL_YONGSHIN_TYPES.has(recommendation.type)) {
      contextualWeight += weight;
    }
  }

  if (totalWeight <= 0) {
    return null;
  }
  return {
    score: clamp((weightedScore / totalWeight) * 100, 0, 100),
    contextualPriority: clamp(contextualWeight / totalWeight, 0, 1),
  };
}
