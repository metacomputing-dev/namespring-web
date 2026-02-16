import scoringRules from '../../config/scoring-rules.json';

// ---------------------------------------------------------------------------
// The minimum weighted-average score a name must reach to be considered
// "passing".  Loaded from config/scoring-rules.json so every threshold lives
// in one central place.
// ---------------------------------------------------------------------------
const MIN_PASSING_SCORE: number = scoringRules.evaluation.minPassingScore;

// ═══════════════════════════════════════════════════════════════════════════
//  Data types — unchanged public API
// ═══════════════════════════════════════════════════════════════════════════

export interface CalculatorSignal {
  frame: string;
  score: number;
  isPassed: boolean;
  weight: number;
}

export interface CalculatorPacket { signals: CalculatorSignal[] }

export interface AnalysisDetail<T = unknown> {
  readonly type: string;
  readonly score: number;
  readonly polarityScore: number;
  readonly elementScore: number;
  readonly data: T;
}

export type EvalFrame =
  | 'TOTAL'
  | 'FOURFRAME_LUCK'
  | 'STROKE_POLARITY'
  | 'HANGUL_ELEMENT'
  | 'HANGUL_POLARITY'
  | 'FOURFRAME_ELEMENT'
  | 'STROKE_ELEMENT';

export const ALL_FRAMES: readonly EvalFrame[] = [
  'TOTAL', 'FOURFRAME_LUCK', 'STROKE_POLARITY',
  'HANGUL_ELEMENT', 'HANGUL_POLARITY', 'FOURFRAME_ELEMENT', 'STROKE_ELEMENT',
] as const;

export interface FrameInsight {
  frame: string;
  score: number;
  isPassed: boolean;
  label: string;
  details: Record<string, unknown>;
}

export interface EvalContext {
  readonly surnameLength: number;
  readonly givenLength: number;
  readonly luckyMap: Map<number, string>;
  readonly insights: Record<string, FrameInsight>;
}

export interface EvaluationResult {
  score: number;
  isPassed: boolean;
  categoryMap: Record<string, FrameInsight>;
  categories: FrameInsight[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieve the insight that a calculator stored for `frameName`.
 * If no insight exists yet, return a safe placeholder so downstream code
 * never has to deal with `undefined`.
 */
function lookupInsight(ctx: EvalContext, frameName: string): FrameInsight {
  return ctx.insights[frameName] ?? {
    frame: frameName,
    score: 0,
    isPassed: false,
    label: 'MISSING',
    details: {},
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  Abstract base class for every calculator
// ═══════════════════════════════════════════════════════════════════════════

export abstract class NameCalculator {
  /** Unique key that identifies this calculator (e.g. "hangul", "frame"). */
  abstract readonly id: string;

  /** Phase 1 — analyse the name and store insights into the context. */
  abstract visit(ctx: EvalContext): void;

  /** Phase 2 — read back insights and return weighted signals. */
  abstract backward(ctx: EvalContext): CalculatorPacket;

  /** Return a typed analysis summary for external consumers. */
  abstract getAnalysis(): AnalysisDetail;

  /**
   * Store an insight into the shared evaluation context.
   *
   * Subclasses call this during `visit()` to record what they found for a
   * particular evaluation frame (e.g. "HANGUL_ELEMENT").
   */
  protected putInsight(
    ctx: EvalContext,
    frame: string,
    score: number,
    isPassed: boolean,
    label: string,
    details: Record<string, unknown> = {},
  ): void {
    (ctx.insights as Record<string, FrameInsight>)[frame] = {
      frame,
      score,
      isPassed,
      label,
      details,
    };
  }

  /**
   * Build a single signal by looking up a previously stored insight and
   * attaching the given weight.
   *
   * Subclasses call this during `backward()` to turn an insight into a
   * weighted signal that feeds the final score.
   */
  protected signal(frame: string, ctx: EvalContext, weight: number): CalculatorSignal {
    const insight = lookupInsight(ctx, frame);
    return {
      frame,
      score: insight.score,
      isPassed: insight.isPassed,
      weight,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════════════

/** The five "strict" frames that every name is scored on (excludes TOTAL). */
export const STRICT_FRAMES: readonly EvalFrame[] = ALL_FRAMES.slice(1, 6) as EvalFrame[];

// ═══════════════════════════════════════════════════════════════════════════
//  Main evaluation pipeline
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score a name by running every calculator and combining their signals.
 *
 * The pipeline has five steps:
 *   1. Visit      — each calculator analyses the name and stores insights
 *   2. Collect    — gather all weighted signals from every calculator
 *   3. Aggregate  — compute the weighted average score
 *   4. Decide     — check whether the name passes (all signals pass AND
 *                   the average meets the minimum threshold)
 *   5. Package    — build the final result with per-frame breakdowns
 */
export function evaluateName(
  calculators: NameCalculator[],
  ctx: EvalContext,
): EvaluationResult {

  // -----------------------------------------------------------------------
  // Step 1 + 2: Visit each calculator, then collect its signals.
  //             Keep only signals whose weight is positive (zero-weight
  //             signals are intentionally excluded from the average).
  // -----------------------------------------------------------------------
  const signals: CalculatorSignal[] = calculators
    .flatMap(calculator => {
      calculator.visit(ctx);
      return calculator.backward(ctx).signals;
    })
    .filter(signal => signal.weight > 0);

  // -----------------------------------------------------------------------
  // Step 3: Compute the weighted average score.
  //         If there are no signals at all, the score defaults to 0.
  // -----------------------------------------------------------------------
  const totalWeight = signals.reduce(
    (accumulator, signal) => accumulator + signal.weight,
    0,
  );

  const weightedScore = totalWeight > 0
    ? signals.reduce(
        (accumulator, signal) => accumulator + signal.score * signal.weight,
        0,
      ) / totalWeight
    : 0;

  // -----------------------------------------------------------------------
  // Step 4: A name passes only when BOTH conditions are true:
  //           a) every individual signal passed on its own
  //           b) the weighted average meets the minimum passing score
  // -----------------------------------------------------------------------
  const allSignalsPassed = signals.every(signal => signal.isPassed);
  const isPassed = allSignalsPassed && weightedScore >= MIN_PASSING_SCORE;

  // -----------------------------------------------------------------------
  // Step 5: Package the result.
  //         - Record a TOTAL insight with contribution details
  //         - Build a category map keyed by frame name
  //         - Return a flat categories array for easy iteration
  // -----------------------------------------------------------------------

  // 5a. Identify which frames contributed and which ones failed.
  const contributingFrames = [...new Set(signals.map(signal => signal.frame))];

  const contributions = Object.fromEntries(
    signals.map(signal => [
      signal.frame,
      { rawScore: signal.score, weight: signal.weight, isPassed: signal.isPassed },
    ]),
  );

  const failedFrames = signals
    .filter(signal => !signal.isPassed)
    .map(signal => signal.frame);

  // 5b. Store the TOTAL insight so it can be looked up like any other frame.
  (ctx.insights as Record<string, FrameInsight>)['TOTAL'] = {
    frame: 'TOTAL',
    score: weightedScore,
    isPassed,
    label: 'ROOT',
    details: { contributions, failedFrames },
  };

  // 5c. Assemble the category map: TOTAL first, then every contributing frame.
  const categoryMap: Record<string, FrameInsight> = {};
  categoryMap['TOTAL'] = lookupInsight(ctx, 'TOTAL');

  for (const frameName of contributingFrames) {
    categoryMap[frameName] = lookupInsight(ctx, frameName);
  }

  // 5d. Return the final evaluation result.
  return {
    score: categoryMap['TOTAL'].score,
    isPassed: categoryMap['TOTAL'].isPassed,
    categoryMap,
    categories: contributingFrames.map(frameName => categoryMap[frameName]),
  };
}
