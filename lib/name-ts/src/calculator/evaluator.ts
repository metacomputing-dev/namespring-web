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

function getInsight(ctx: EvalContext, frame: string): FrameInsight {
  return ctx.insights[frame] ?? { frame, score: 0, isPassed: false, label: 'MISSING', details: {} };
}

export abstract class NameCalculator {
  abstract readonly id: string;
  abstract visit(ctx: EvalContext): void;
  abstract backward(ctx: EvalContext): CalculatorPacket;
  abstract getAnalysis(): AnalysisDetail;

  protected putInsight(
    ctx: EvalContext,
    frame: string,
    score: number,
    isPassed: boolean,
    label: string,
    details: Record<string, unknown> = {},
  ): void {
    (ctx.insights as Record<string, FrameInsight>)[frame] = { frame, score, isPassed, label, details };
  }

  protected signal(frame: string, ctx: EvalContext, weight: number): CalculatorSignal {
    const ins = getInsight(ctx, frame);
    return { frame, score: ins.score, isPassed: ins.isPassed, weight };
  }
}

export const STRICT_FRAMES: readonly EvalFrame[] = ALL_FRAMES.slice(1, 6) as EvalFrame[];

export function evaluateName(
  calculators: NameCalculator[],
  ctx: EvalContext,
): EvaluationResult {
  const signals = calculators.flatMap(c => {
    c.visit(ctx);
    return c.backward(ctx).signals;
  }).filter(s => s.weight > 0);

  const totalWeight = signals.reduce((a, s) => a + s.weight, 0);
  const score = totalWeight > 0
    ? signals.reduce((a, s) => a + s.score * s.weight, 0) / totalWeight
    : 0;

  const isPassed = signals.every(s => s.isPassed) && score >= 60;

  const frames = [...new Set(signals.map(s => s.frame))];

  (ctx.insights as Record<string, FrameInsight>)['TOTAL'] = {
    frame: 'TOTAL', score, isPassed, label: 'ROOT',
    details: {
      contributions: Object.fromEntries(signals.map(s => [s.frame, {
        rawScore: s.score, weight: s.weight, isPassed: s.isPassed,
      }])),
      failedFrames: signals.filter(s => !s.isPassed).map(s => s.frame),
    },
  };

  const cm: Record<string, FrameInsight> = {};
  cm['TOTAL'] = getInsight(ctx, 'TOTAL');
  for (const f of frames) cm[f] = getInsight(ctx, f);

  return {
    score: cm['TOTAL'].score,
    isPassed: cm['TOTAL'].isPassed,
    categoryMap: cm,
    categories: frames.map(f => cm[f]),
  };
}
