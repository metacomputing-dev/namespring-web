import type { ElementKey } from './element-cycle.js';
import { clamp } from './element-cycle.js';
import type { SajuOutputSummary } from './strength-scorer.js';
import { computeSajuRootBalanceScore } from './balance-scorer.js';
import { computeYongshinScore, type YongshinScoreResult, type SajuYongshinSummary } from './yongshin-scorer.js';
import { computeStrengthScore } from './strength-scorer.js';
import { computeTenGodScore } from './ten-god-scorer.js';
import {
  SAJU_WEIGHT_BALANCE_DEFAULT,
  SAJU_WEIGHT_YONGSHIN_DEFAULT,
  SAJU_WEIGHT_STRENGTH,
  SAJU_WEIGHT_TEN_GOD,
  SAJU_WEIGHT_SHIFT_CONTRAST,
  SAJU_WEIGHT_SHIFT_CONFIDENCE_BASE,
  SAJU_WEIGHT_SHIFT_CONFIDENCE_MULT,
  SAJU_WEIGHT_SHIFT_CONTEXT,
  SAJU_WEIGHT_BALANCE_MIN,
  SAJU_WEIGHT_BALANCE_MAX,
  SAJU_WEIGHT_YONGSHIN_MIN,
  SAJU_WEIGHT_YONGSHIN_MAX,
  SAJU_WEIGHT_CONTRAST_DIVISOR,
  SAJU_PASS_MIN_SCORE,
  SAJU_PASS_MIN_BALANCE,
  SAJU_PASS_MIN_YONGSHIN,
  SAJU_SEVERE_CONFLICT_GUSIN_RATIO,
} from './scoring-constants.js';

export interface SajuNameScoreBreakdown {
  balance: number;
  yongshin: number;
  strength: number;
  tenGod: number;
  weights: {
    balance: number;
    yongshin: number;
    strength: number;
    tenGod: number;
  };
  weightedBeforePenalty: number;
  penalties: {
    gisin: number;
    gusin: number;
    total: number;
  };
  elementMatches: {
    yongshin: number;
    heesin: number;
    gisin: number;
    gusin: number;
  };
}

export interface SajuNameScoreResult {
  score: number;
  isPassed: boolean;
  combined: Record<ElementKey, number>;
  breakdown: SajuNameScoreBreakdown;
}

export function computeSajuNameScore(
  sajuDistribution: Record<ElementKey, number>,
  rootElementDistribution: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): SajuNameScoreResult {
  const balance = computeSajuRootBalanceScore(sajuDistribution, rootElementDistribution);
  const yongshinSummary: SajuYongshinSummary | null = sajuOutput?.yongshin ?? null;
  const yongshin = computeYongshinScore(rootElementDistribution, yongshinSummary);
  const strength = computeStrengthScore(rootElementDistribution, sajuOutput);
  const tenGod = computeTenGodScore(rootElementDistribution, sajuOutput);
  const weights = resolveAdaptiveWeights(balance.score, yongshin);

  const weightedBeforePenalty = clamp(
    weights.balance * balance.score +
      weights.yongshin * yongshin.score +
      weights.strength * strength +
      weights.tenGod * tenGod,
    0, 100,
  );
  const totalPenalty = yongshin.gisinPenalty + yongshin.gusinPenalty;
  const score = clamp(weightedBeforePenalty - totalPenalty, 0, 100);

  const hasYongshin = sajuOutput?.yongshin !== null && sajuOutput?.yongshin !== undefined;
  const severeConflict = yongshin.gusinRatio >= SAJU_SEVERE_CONFLICT_GUSIN_RATIO;
  const isPassed =
    score >= SAJU_PASS_MIN_SCORE &&
    balance.score >= SAJU_PASS_MIN_BALANCE &&
    (!hasYongshin || (yongshin.score >= SAJU_PASS_MIN_YONGSHIN && !severeConflict));

  return {
    score,
    isPassed,
    combined: balance.combined,
    breakdown: {
      balance: balance.score,
      yongshin: yongshin.score,
      strength,
      tenGod,
      weights,
      weightedBeforePenalty,
      penalties: {
        gisin: yongshin.gisinPenalty,
        gusin: yongshin.gusinPenalty,
        total: totalPenalty,
      },
      elementMatches: yongshin.elementMatches,
    },
  };
}

export function resolveAdaptiveWeights(
  balanceScore: number,
  yongshin: Pick<YongshinScoreResult, 'score' | 'confidence' | 'contextualPriority'>,
): { balance: number; yongshin: number; strength: number; tenGod: number } {
  let balanceWeight = SAJU_WEIGHT_BALANCE_DEFAULT;
  let yongshinWeight = SAJU_WEIGHT_YONGSHIN_DEFAULT;
  const strengthWeight = SAJU_WEIGHT_STRENGTH;
  const tenGodWeight = SAJU_WEIGHT_TEN_GOD;

  const contrast = clamp((yongshin.score - balanceScore) / SAJU_WEIGHT_CONTRAST_DIVISOR, 0, 1);
  const confidenceBoost = clamp(yongshin.confidence, 0, 1);
  const contextBoost = clamp(yongshin.contextualPriority, 0, 1);
  const shift =
    SAJU_WEIGHT_SHIFT_CONTRAST * contrast *
      (SAJU_WEIGHT_SHIFT_CONFIDENCE_BASE + SAJU_WEIGHT_SHIFT_CONFIDENCE_MULT * confidenceBoost) +
    SAJU_WEIGHT_SHIFT_CONTEXT * confidenceBoost * contextBoost;

  balanceWeight = clamp(balanceWeight - shift, SAJU_WEIGHT_BALANCE_MIN, SAJU_WEIGHT_BALANCE_MAX);
  yongshinWeight = clamp(yongshinWeight + shift, SAJU_WEIGHT_YONGSHIN_MIN, SAJU_WEIGHT_YONGSHIN_MAX);

  const total = balanceWeight + yongshinWeight + strengthWeight + tenGodWeight;
  return {
    balance: balanceWeight / total,
    yongshin: yongshinWeight / total,
    strength: strengthWeight / total,
    tenGod: tenGodWeight / total,
  };
}
