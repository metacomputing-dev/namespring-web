import {
  type EvalContext, type FrameInsight, type EvaluationResult,
  type EvaluableCalculator, type CalculatorSignal,
} from './core/evaluator.js';
import { clamp } from './core/scoring.js';
import evaluatorPolicy from '../config/evaluator-policy.json';

// ---------------------------------------------------------------------------
//  Configuration (loaded from config/evaluator-policy.json)
//
//  Every numeric threshold, weight, and frame list lives in the config file.
//  Nothing in this module should contain a "magic number".
// ---------------------------------------------------------------------------

const {
  sajuPriority: SAJU_PRIORITY_CONFIG,
  weightMultipliers: WEIGHT_MULTIPLIER_CONFIG,
  adaptiveMode: ADAPTIVE_CONFIG,
  strictMode: STRICT_CONFIG,
  nameFrames: NAME_FRAMES,
  sajuFrameId: SAJU_FRAME_ID,
} = evaluatorPolicy;

// ---------------------------------------------------------------------------
//  Public constants (unchanged API)
// ---------------------------------------------------------------------------

export const SAJU_FRAME = SAJU_FRAME_ID;

const RELAXABLE_FRAMES = new Set<string>(NAME_FRAMES);

// ---------------------------------------------------------------------------
//  Internal type for a signal enriched with adaptive-weight data
// ---------------------------------------------------------------------------

interface WeightedSignal extends CalculatorSignal {
  adjustedWeight: number;
  adjustedWeighted: number;
}

// =========================================================================
//  Helper: look up a frame insight, returning a safe placeholder if missing
// =========================================================================

function getInsight(ctx: EvalContext, frame: string): FrameInsight {
  return ctx.insights[frame] ?? {
    frame,
    score: 0,
    isPassed: false,
    label: 'MISSING',
    details: {},
  };
}

// =========================================================================
//  Step 1 of 4 -- Collect calculator signals
//
//  Run every calculator's two-phase pipeline (visit then backward) and
//  gather the resulting signals. Signals with zero weight are discarded
//  because they do not contribute to the final score.
// =========================================================================

function collectCalculatorSignals(
  calculators: EvaluableCalculator[],
  ctx: EvalContext,
): CalculatorSignal[] {
  return calculators
    .flatMap(calculator => {
      calculator.visit(ctx);
      return calculator.backward(ctx).signals;
    })
    .filter(signal => signal.weight > 0);
}

// =========================================================================
//  Saju priority extraction
//
//  The saju priority level is a 0..1 number that quantifies how strongly
//  the birth-chart (saju) analysis should influence the overall evaluation.
//  A higher value means the saju data is unusually clear and reliable, so
//  the evaluator will switch to "adaptive" mode and relax non-saju frames.
//
//  The calculation proceeds in three steps:
//    1. Read raw scoring data from the saju frame's stored insight
//    2. Compute a "signal strength" from balance + yongshin, scaled by
//       how confident the analysis engine was
//    3. Subtract a penalty factor so that noisy saju data gets demoted
// =========================================================================

function extractSajuPriority(ctx: EvalContext): number {
  // -- Step 1: Retrieve the raw scoring data from the saju insight ----------

  const sajuInsight = ctx.insights[SAJU_FRAME];
  if (!sajuInsight) return 0;

  const details    = sajuInsight.details as Record<string, any>;
  const scoringData = details?.scoring as Record<string, any> | undefined;
  if (!scoringData) return 0;

  const balanceScore  = Number(scoringData.balance) || 0;
  const yongshinValue = Number(scoringData.yongshin) || 0;
  const penaltyTotal  = Number((scoringData.penalties as Record<string, any>)?.total) || 0;

  // -- Step 2: Compute signal strength from balance + yongshin --------------
  //
  //  The raw sum (balance + yongshin) is normalised by the configured
  //  balance weight. Confidence acts as a multiplier: even a high raw sum
  //  is scaled down when the analysis engine was uncertain.

  const analysisOutput = details?.analysisOutput as Record<string, any> | undefined;
  const rawConfidence  = analysisOutput?.yongshin?.finalConfidence;

  const confidence = clamp(
    typeof rawConfidence === 'number'
      ? rawConfidence
      : SAJU_PRIORITY_CONFIG.defaultConfidence,
    0,
    1,
  );

  const confidenceMultiplier =
    SAJU_PRIORITY_CONFIG.confidenceBaseRatio
    + confidence * SAJU_PRIORITY_CONFIG.confidenceVariableRatio;

  const signalStrength =
    ((balanceScore + yongshinValue) / SAJU_PRIORITY_CONFIG.balanceWeight)
    * confidenceMultiplier;

  // -- Step 3: Subtract a penalty factor ------------------------------------
  //
  //  Penalties reduce the signal. The penalty fraction is capped at 1 so
  //  that extremely large penalty totals do not produce negative values.

  const penaltyFraction = Math.min(1, penaltyTotal / SAJU_PRIORITY_CONFIG.penaltyDivisor);
  const penaltyDeduction = penaltyFraction * SAJU_PRIORITY_CONFIG.maxPenaltyImpact;

  return clamp(signalStrength - penaltyDeduction, 0, 1);
}

// =========================================================================
//  Step 2 of 4 -- Compute the adaptive weighted score
//
//  Each signal's weight is adjusted according to the saju priority level:
//    - The saju frame gets a BOOST so it counts for more
//    - Relaxable (name-based) frames get a REDUCTION so they count for less
//    - All other frames keep their original weight
//
//  The final score is the weighted average of all adjusted signals.
// =========================================================================

function computeFrameWeightMultiplier(frame: string, sajuPriorityLevel: number): number {
  if (frame === SAJU_FRAME) {
    return WEIGHT_MULTIPLIER_CONFIG.sajuBoostBase
         + sajuPriorityLevel * WEIGHT_MULTIPLIER_CONFIG.sajuBoostFactor;
  }
  if (RELAXABLE_FRAMES.has(frame)) {
    return WEIGHT_MULTIPLIER_CONFIG.relaxReductionBase
         - sajuPriorityLevel * WEIGHT_MULTIPLIER_CONFIG.relaxReductionFactor;
  }
  return 1;
}

function computeAdaptiveWeightedScore(
  signals: CalculatorSignal[],
  sajuPriorityLevel: number,
): { weightedSignals: WeightedSignal[]; score: number } {

  const weightedSignals: WeightedSignal[] = signals.map(signal => {
    const adjustedWeight = signal.weight * computeFrameWeightMultiplier(signal.frame, sajuPriorityLevel);
    return {
      ...signal,
      adjustedWeight,
      adjustedWeighted: signal.score * adjustedWeight,
    };
  });

  const totalWeight = weightedSignals.reduce(
    (sum, signal) => sum + signal.adjustedWeight, 0,
  );

  const score = totalWeight > 0
    ? weightedSignals.reduce((sum, signal) => sum + signal.adjustedWeighted, 0) / totalWeight
    : 0;

  return { weightedSignals, score };
}

// =========================================================================
//  Step 3 of 4 -- Determine pass/fail (adaptive vs strict policy)
//
//  This is the core decision logic of the evaluator.
//
//  STRICT MODE (default):
//    Every single frame must pass AND the score must meet the minimum.
//    No exceptions.
//
//  ADAPTIVE MODE (activated when saju data is strong):
//    The evaluator relaxes name-based frame requirements because we trust
//    the saju analysis more. Specifically, five conditions must ALL hold:
//      1. The saju frame itself passed
//      2. The four-frame luck score is above a minimum threshold
//      3. The overall score is above a (lowered) threshold
//      4. No relaxable frame failed catastrophically (below a floor score)
//      5. The total number of relaxable-frame failures is within a limit
//
//  Which mode to use is determined by a single test:
//    "Is the saju priority level at or above the activation threshold?"
// =========================================================================

function determinePassStatus(
  weightedSignals: WeightedSignal[],
  ctx: EvalContext,
  sajuPriorityLevel: number,
  score: number,
): boolean {
  const useAdaptivePolicy = sajuPriorityLevel >= ADAPTIVE_CONFIG.activationThreshold;

  if (useAdaptivePolicy) {
    return evaluateAdaptivePolicy(weightedSignals, ctx, sajuPriorityLevel, score);
  }
  return evaluateStrictPolicy(ctx, score);
}

// -- Adaptive policy (saju-informed relaxed evaluation) --------------------

function evaluateAdaptivePolicy(
  weightedSignals: WeightedSignal[],
  ctx: EvalContext,
  sajuPriorityLevel: number,
  score: number,
): boolean {
  // Condition 1: The saju frame itself must have passed.
  const sajuFrameInsight     = getInsight(ctx, SAJU_FRAME);
  const sajuFramePassed      = sajuFrameInsight.isPassed;

  // Condition 2: Four-frame luck must reach a minimum quality bar.
  const fourframeLuckInsight  = getInsight(ctx, 'FOURFRAME_LUCK');
  const fourframeLuckSufficient = fourframeLuckInsight.score >= ADAPTIVE_CONFIG.minFourframeLuckScore;

  // Condition 3: The adaptive threshold is lower than the strict one,
  //   scaled down proportionally to how strong the saju signal is.
  const adaptiveThreshold     = ADAPTIVE_CONFIG.basePassingScore
                              - ADAPTIVE_CONFIG.scoreReductionFactor * sajuPriorityLevel;
  const scoreAboveThreshold   = score >= adaptiveThreshold;

  // Condition 4: No relaxable frame may have failed so badly that its
  //   score falls below the minimum acceptable floor.
  const relaxableFailures     = weightedSignals.filter(
    signal => RELAXABLE_FRAMES.has(signal.frame) && !signal.isPassed,
  );
  const noSevereFrameFailures = !relaxableFailures.some(
    signal => signal.score < ADAPTIVE_CONFIG.minRelaxableFrameScore,
  );

  // Condition 5: The total number of relaxable-frame failures must stay
  //   within the allowed limit. A very high saju priority permits more.
  const isHighPriority        = sajuPriorityLevel >= ADAPTIVE_CONFIG.highPriorityThreshold;
  const allowedFailures       = isHighPriority
    ? ADAPTIVE_CONFIG.highPriorityAllowedFailures
    : ADAPTIVE_CONFIG.lowPriorityAllowedFailures;
  const failureCountAcceptable = relaxableFailures.length <= allowedFailures;

  return sajuFramePassed
      && fourframeLuckSufficient
      && scoreAboveThreshold
      && noSevereFrameFailures
      && failureCountAcceptable;
}

// -- Strict policy (all frames must independently pass) --------------------

function evaluateStrictPolicy(ctx: EvalContext, score: number): boolean {
  const allFrames = [...NAME_FRAMES, SAJU_FRAME];
  const everyFramePassed = allFrames.every(frame => getInsight(ctx, frame).isPassed);
  return everyFramePassed && score >= STRICT_CONFIG.passingScore;
}

// =========================================================================
//  Step 4 of 4 -- Build the final evaluation result
//
//  Assembles the result object and writes a TOTAL insight into the context
//  so that downstream consumers can inspect the evaluation breakdown.
// =========================================================================

function buildEvaluationResult(
  weightedSignals: WeightedSignal[],
  ctx: EvalContext,
  score: number,
  isPassed: boolean,
  sajuPriorityLevel: number,
): EvaluationResult {

  // -- Compute diagnostic metadata for the TOTAL insight --------------------

  const useAdaptivePolicy = sajuPriorityLevel >= ADAPTIVE_CONFIG.activationThreshold;
  const isHighPriority    = sajuPriorityLevel >= ADAPTIVE_CONFIG.highPriorityThreshold;

  const allowedFailures = useAdaptivePolicy
    ? (isHighPriority
        ? ADAPTIVE_CONFIG.highPriorityAllowedFailures
        : ADAPTIVE_CONFIG.lowPriorityAllowedFailures)
    : 0;

  const threshold = useAdaptivePolicy
    ? ADAPTIVE_CONFIG.basePassingScore - ADAPTIVE_CONFIG.scoreReductionFactor * sajuPriorityLevel
    : STRICT_CONFIG.passingScore;

  const relaxableFailures = weightedSignals.filter(
    signal => RELAXABLE_FRAMES.has(signal.frame) && !signal.isPassed,
  );

  const contributions = Object.fromEntries(
    weightedSignals.map(signal => [
      signal.frame,
      {
        rawScore: signal.score,
        weight: signal.weight,
        weightMultiplier: signal.weight > 0 ? signal.adjustedWeight / signal.weight : 1,
        adjustedWeight: signal.adjustedWeight,
        weighted: signal.adjustedWeighted,
        isPassed: signal.isPassed,
      },
    ]),
  );

  const failedFrames = weightedSignals
    .filter(signal => !signal.isPassed)
    .map(signal => signal.frame);

  // -- Store the TOTAL insight into the context -----------------------------

  (ctx.insights as Record<string, FrameInsight>)['TOTAL'] = {
    frame: 'TOTAL',
    score,
    isPassed,
    label: 'ROOT',
    details: {
      contributions,
      failedFrames,
      adaptivePolicy: {
        mode: useAdaptivePolicy ? 'adaptive' : 'strict',
        sajuPriority: sajuPriorityLevel,
        allowedFailures,
        threshold,
        relaxableFailures: relaxableFailures.map(signal => signal.frame),
      },
    },
  };

  // -- Build the category map and return ------------------------------------

  const contributingFrames = [...new Set(weightedSignals.map(signal => signal.frame))];

  const categoryMap: Record<string, FrameInsight> = {};
  categoryMap['TOTAL'] = getInsight(ctx, 'TOTAL');
  for (const frame of contributingFrames) {
    categoryMap[frame] = getInsight(ctx, frame);
  }

  return {
    score: categoryMap['TOTAL'].score,
    isPassed: categoryMap['TOTAL'].isPassed,
    categoryMap,
    categories: contributingFrames.map(frame => categoryMap[frame]),
  };
}

// =========================================================================
//  Public API -- springEvaluateName
//
//  Evaluates a candidate name by running four stages:
//    1. Collect signals from every calculator
//    2. Compute the weighted score (boosting saju, reducing name frames)
//    3. Decide pass/fail using either adaptive or strict policy
//    4. Package the result with full diagnostic data
//
//  The function signature is intentionally unchanged.
// =========================================================================

export function springEvaluateName(
  calculators: EvaluableCalculator[],
  ctx: EvalContext,
): EvaluationResult {

  // Stage 1: Run calculators and gather their signals.
  const signals = collectCalculatorSignals(calculators, ctx);

  // Stage 2: Determine how strongly saju data should influence the result,
  //          then compute an adjusted weighted-average score.
  const sajuPriorityLevel = extractSajuPriority(ctx);
  const { weightedSignals, score } = computeAdaptiveWeightedScore(signals, sajuPriorityLevel);

  // Stage 3: Apply the pass/fail policy (adaptive if saju is strong,
  //          strict otherwise).
  const isPassed = determinePassStatus(weightedSignals, ctx, sajuPriorityLevel, score);

  // Stage 4: Assemble and return the evaluation result.
  return buildEvaluationResult(weightedSignals, ctx, score, isPassed, sajuPriorityLevel);
}
