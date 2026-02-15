import type { CalculatorSignal } from '../calculator/calculator-graph.js';
import type { FourFrameCalculator } from '../calculator/frame-calculator.js';
import type { HangulCalculator } from '../calculator/hangul-calculator.js';
import type { HanjaCalculator } from '../calculator/hanja-calculator.js';
import type { ElementKey } from './element-cycle.js';
import { ELEMENT_KEYS, distributionFromArrangement, emptyDistribution } from './element-cycle.js';
import type { SajuOutputSummary } from './strength-scorer.js';

/** Frame identifier matching namespring-web's evaluation frames */
export type EvalFrame =
  | 'SEONGMYEONGHAK'
  | 'SAGYEOK_SURI'
  | 'SAJU_JAWON_BALANCE'
  | 'HOEKSU_EUMYANG'
  | 'BALEUM_OHAENG'
  | 'BALEUM_EUMYANG'
  | 'SAGYEOK_OHAENG'
  | 'HOEKSU_OHAENG'
  | 'JAWON_OHAENG'
  | 'EUMYANG'
  | 'STATISTICS';

/** Insight produced by evaluating a single frame */
export interface FrameInsight {
  frame: EvalFrame;
  score: number;
  isPassed: boolean;
  label: string;
  details: Record<string, unknown>;
}

export const SIGNAL_WEIGHT_MAJOR = 1.0;
export const SIGNAL_WEIGHT_MINOR = 0.6;

/** Evaluation pipeline context shared across all nodes */
export interface EvaluationPipelineContext {
  surnameLength: number;
  givenLength: number;
  luckyMap: Map<number, string>;
  sajuDistribution: Record<ElementKey, number>;
  sajuDistributionSource: string;
  sajuOutput: SajuOutputSummary | null;
  fourFrameCalculator: FourFrameCalculator;
  hanjaCalculator: HanjaCalculator;
  hangulCalculator: HangulCalculator;
  insights: Partial<Record<EvalFrame, FrameInsight>>;
}

export function createInsight(
  frame: EvalFrame,
  score: number,
  isPassed: boolean,
  label: string,
  details: Record<string, unknown> = {},
): FrameInsight {
  return { frame, score, isPassed, label, details };
}

export function setInsight(ctx: EvaluationPipelineContext, insight: FrameInsight): void {
  ctx.insights[insight.frame] = insight;
}

export function mustInsight(ctx: EvaluationPipelineContext, frame: EvalFrame): FrameInsight {
  const insight = ctx.insights[frame];
  if (!insight) {
    return { frame, score: 0, isPassed: false, label: 'MISSING', details: {} };
  }
  return insight;
}

export function createSignal(
  frame: EvalFrame,
  insight: FrameInsight,
  weight: number,
): CalculatorSignal {
  return {
    key: frame,
    frame,
    score: insight.score,
    isPassed: insight.isPassed,
    weight,
  };
}

export function createSajuBaseDistribution(
  partial?: Partial<Record<ElementKey, number>>,
): Record<ElementKey, number> {
  const dist = emptyDistribution();
  if (partial) {
    for (const key of ELEMENT_KEYS) {
      if (partial[key] !== undefined) dist[key] = partial[key]!;
    }
  }
  return dist;
}

export { distributionFromArrangement, ELEMENT_KEYS };
