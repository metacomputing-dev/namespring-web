import scoringRules from '../../config/scoring-rules.json';

const MIN_PASSING_SCORE: number = scoringRules.evaluation.minPassingScore;

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

export interface EvaluableCalculator {
  readonly id: string;
  visit(ctx: EvalContext): void;
  backward(ctx: EvalContext): CalculatorPacket;
  getAnalysis(): AnalysisDetail;
}

export type NameCalculator = EvaluableCalculator;

function lookupInsight(ctx: EvalContext, frameName: string): FrameInsight {
  return ctx.insights[frameName] ?? {
    frame: frameName,
    score: 0,
    isPassed: false,
    label: 'MISSING',
    details: {},
  };
}

export function putInsight(
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

export function createSignal(frame: string, ctx: EvalContext, weight: number): CalculatorSignal {
  const insight = lookupInsight(ctx, frame);
  return {
    frame,
    score: insight.score,
    isPassed: insight.isPassed,
    weight,
  };
}

export const STRICT_FRAMES: readonly EvalFrame[] = ALL_FRAMES.slice(1, 6) as EvalFrame[];

export function evaluateName(
  calculators: EvaluableCalculator[],
  ctx: EvalContext,
): EvaluationResult {
  const signals: CalculatorSignal[] = calculators
    .flatMap((calculator) => {
      calculator.visit(ctx);
      return calculator.backward(ctx).signals;
    })
    .filter((signal) => signal.weight > 0);

  const totalWeight = signals.reduce((accumulator, signal) => accumulator + signal.weight, 0);
  const weightedScore = totalWeight > 0
    ? signals.reduce((accumulator, signal) => accumulator + signal.score * signal.weight, 0) / totalWeight
    : 0;

  const allSignalsPassed = signals.every((signal) => signal.isPassed);
  const isPassed = allSignalsPassed && weightedScore >= MIN_PASSING_SCORE;

  const contributingFrames = [...new Set(signals.map((signal) => signal.frame))];

  const contributions = Object.fromEntries(
    signals.map((signal) => [
      signal.frame,
      { rawScore: signal.score, weight: signal.weight, isPassed: signal.isPassed },
    ]),
  );

  const failedFrames = signals
    .filter((signal) => !signal.isPassed)
    .map((signal) => signal.frame);

  (ctx.insights as Record<string, FrameInsight>)['TOTAL'] = {
    frame: 'TOTAL',
    score: weightedScore,
    isPassed,
    label: 'ROOT',
    details: { contributions, failedFrames },
  };

  const categoryMap: Record<string, FrameInsight> = {};
  categoryMap['TOTAL'] = lookupInsight(ctx, 'TOTAL');

  for (const frameName of contributingFrames) {
    categoryMap[frameName] = lookupInsight(ctx, frameName);
  }

  return {
    score: categoryMap['TOTAL'].score,
    isPassed: categoryMap['TOTAL'].isPassed,
    categoryMap,
    categories: contributingFrames.map((frameName) => categoryMap[frameName]),
  };
}
