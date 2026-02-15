import type { CalculatorNode, CalculatorPacket, CalculatorSignal } from './graph.js';
import type { ElementKey } from './element-cycle.js';
import type { SajuOutputSummary } from './saju-scorer.js';

// ── Analysis Detail (replaces energy-calculator.ts) ─────────────
export interface AnalysisDetail<T = unknown> {
  readonly type: string;
  readonly score: number;
  readonly polarityScore: number;
  readonly elementScore: number;
  readonly data: T;
}

// ── Evaluation Types ────────────────────────────────────────────
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

export interface FrameInsight {
  frame: EvalFrame;
  score: number;
  isPassed: boolean;
  label: string;
  details: Record<string, unknown>;
}

export interface EvalContext {
  readonly surnameLength: number;
  readonly givenLength: number;
  readonly luckyMap: Map<number, string>;
  readonly sajuDistribution: Record<ElementKey, number>;
  readonly sajuOutput: SajuOutputSummary | null;
  readonly insights: Partial<Record<EvalFrame, FrameInsight>>;
}

export interface EvaluationResult {
  score: number;
  isPassed: boolean;
  status: 'POSITIVE' | 'NEGATIVE';
  categoryMap: Record<string, FrameInsight>;
  categories: FrameInsight[];
}

// ── NameCalculator abstract base ────────────────────────────────
// Each calculator IS a DAG node. It extracts data, scores its own
// frames, and emits signals for the root to compose.
export abstract class NameCalculator implements CalculatorNode<EvalContext> {
  abstract readonly id: string;

  abstract visit(ctx: EvalContext): void;

  abstract backward(
    ctx: EvalContext,
    childPackets?: readonly CalculatorPacket[],
  ): CalculatorPacket;

  abstract getAnalysis(): AnalysisDetail;

  protected setInsight(ctx: EvalContext, insight: FrameInsight): void {
    (ctx.insights as Record<string, FrameInsight>)[insight.frame] = insight;
  }

  protected insight(ctx: EvalContext, frame: EvalFrame): FrameInsight {
    return (
      ctx.insights[frame] ?? {
        frame,
        score: 0,
        isPassed: false,
        label: 'MISSING',
        details: {},
      }
    );
  }

  protected signal(
    frame: EvalFrame,
    ctx: EvalContext,
    weight: number,
  ): CalculatorSignal {
    const i = this.insight(ctx, frame);
    return { key: frame, frame, score: i.score, isPassed: i.isPassed, weight };
  }

  protected static createInsight(
    frame: EvalFrame,
    score: number,
    isPassed: boolean,
    label: string,
    details: Record<string, unknown> = {},
  ): FrameInsight {
    return { frame, score, isPassed, label, details };
  }
}
