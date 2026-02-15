import { type ElementKey, clamp } from './scoring.js';
import type { SajuOutputSummary } from './saju.js';

export interface CalculatorSignal {
  key: string;
  frame: string;
  score: number;
  isPassed: boolean;
  weight: number;
}

export interface CalculatorPacket {
  nodeId: string;
  signals: CalculatorSignal[];
}

export interface AnalysisDetail<T = unknown> {
  readonly type: string;
  readonly score: number;
  readonly polarityScore: number;
  readonly elementScore: number;
  readonly data: T;
}

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

function getInsight(ctx: EvalContext, frame: EvalFrame): FrameInsight {
  return ctx.insights[frame] ?? { frame, score: 0, isPassed: false, label: 'MISSING', details: {} };
}

export abstract class NameCalculator {
  abstract readonly id: string;
  abstract visit(ctx: EvalContext): void;
  abstract backward(ctx: EvalContext): CalculatorPacket;
  abstract getAnalysis(): AnalysisDetail;

  protected putInsight(
    ctx: EvalContext,
    frame: EvalFrame,
    score: number,
    isPassed: boolean,
    label: string,
    details: Record<string, unknown> = {},
  ): void {
    (ctx.insights as Record<string, FrameInsight>)[frame] = { frame, score, isPassed, label, details };
  }

  protected signal(frame: EvalFrame, ctx: EvalContext, weight: number): CalculatorSignal {
    const ins = getInsight(ctx, frame);
    return { key: frame, frame, score: ins.score, isPassed: ins.isPassed, weight };
  }
}

const RELAXABLE = new Set<EvalFrame>([
  'SAGYEOK_SURI', 'HOEKSU_EUMYANG', 'BALEUM_OHAENG', 'BALEUM_EUMYANG', 'SAGYEOK_OHAENG',
]);

const STRICT_FRAMES: EvalFrame[] = [
  'SAGYEOK_SURI', 'SAJU_JAWON_BALANCE', 'HOEKSU_EUMYANG',
  'BALEUM_OHAENG', 'BALEUM_EUMYANG', 'SAGYEOK_OHAENG',
];

function extractSajuPriority(ctx: EvalContext): number {
  const si = ctx.insights.SAJU_JAWON_BALANCE;
  if (!si) return 0;

  const d = si.details as Record<string, any>;
  const ss = d?.sajuScoring as Record<string, any> | undefined;
  if (!ss) return 0;

  const bal = Number(ss.balance) || 0;
  const yv = Number(ss.yongshin) || 0;
  const pt = Number((ss.penalties as Record<string, any>)?.total) || 0;
  const yo = (d?.sajuOutput as Record<string, any>)?.yongshin as Record<string, any> | undefined;
  const confRaw = yo?.finalConfidence;
  const conf = clamp(typeof confRaw === 'number' ? confRaw : 0.65, 0, 1);
  const sig = ((bal + yv) / 200) * (0.55 + conf * 0.45);

  return clamp(sig - Math.min(1, pt / 20) * 0.25, 0, 1);
}

function frameWeightMultiplier(frame: string, sp: number): number {
  if (frame === 'SAJU_JAWON_BALANCE') return 1 + sp * 0.45;
  if (RELAXABLE.has(frame as EvalFrame)) return 1 - sp * 0.3;
  return 1;
}

export function evaluateName(
  calculators: NameCalculator[],
  ctx: EvalContext,
): EvaluationResult {
  (ctx.insights as Record<string, FrameInsight>)['STATISTICS'] =
    { frame: 'STATISTICS', score: 60, isPassed: true, label: 'stats', details: { found: false } };

  const signals = calculators.flatMap(c => {
    c.visit(ctx);
    return c.backward(ctx).signals;
  }).filter(s => s.weight > 0);

  const sp = extractSajuPriority(ctx);
  const adjusted = signals.map(s => {
    const aw = s.weight * frameWeightMultiplier(s.frame, sp);
    return { ...s, adjustedWeight: aw, adjustedWeighted: s.score * aw };
  });
  const totalWeight = adjusted.reduce((a, s) => a + s.adjustedWeight, 0);
  const score = totalWeight > 0
    ? adjusted.reduce((a, s) => a + s.adjustedWeighted, 0) / totalWeight
    : 0;

  const adaptive = sp >= 0.55;
  const relaxableFailures = adjusted.filter(s => RELAXABLE.has(s.frame as EvalFrame) && !s.isPassed);
  const allowedFailures = adaptive ? (sp >= 0.78 ? 2 : 1) : 0;
  const threshold = adaptive ? 60 - 8 * sp : 60;

  let isPassed: boolean;
  if (adaptive) {
    const sI = getInsight(ctx, 'SAJU_JAWON_BALANCE');
    const fI = getInsight(ctx, 'SAGYEOK_SURI');
    isPassed = sI.isPassed
      && fI.score >= 35
      && score >= threshold
      && !relaxableFailures.some(s => s.score < 45)
      && relaxableFailures.length <= allowedFailures;
  } else {
    isPassed = STRICT_FRAMES.every(f => getInsight(ctx, f).isPassed) && score >= 60;
  }

  (ctx.insights as Record<string, FrameInsight>)['SEONGMYEONGHAK'] = {
    frame: 'SEONGMYEONGHAK', score, isPassed, label: 'ROOT',
    details: {
      contributions: Object.fromEntries(adjusted.map(s => [s.frame, {
        rawScore: s.score,
        weight: s.weight,
        weightMultiplier: s.weight > 0 ? s.adjustedWeight / s.weight : 1,
        adjustedWeight: s.adjustedWeight,
        weighted: s.adjustedWeighted,
        isPassed: s.isPassed,
      }])),
      failedFrames: adjusted.filter(s => !s.isPassed).map(s => s.frame),
      adaptivePolicy: {
        mode: adaptive ? 'adaptive' : 'strict',
        sajuPriority: sp,
        allowedFailures,
        threshold,
        relaxableFailures: relaxableFailures.map(s => s.frame),
      },
    },
  };

  const cm: Record<string, FrameInsight> = {};
  for (const f of [
    'SEONGMYEONGHAK', 'SAGYEOK_SURI', 'SAJU_JAWON_BALANCE',
    'HOEKSU_EUMYANG', 'BALEUM_OHAENG', 'BALEUM_EUMYANG',
    'SAGYEOK_OHAENG', 'HOEKSU_OHAENG', 'STATISTICS',
  ] as EvalFrame[]) cm[f] = getInsight(ctx, f);
  cm['JAWON_OHAENG'] = cm['HOEKSU_OHAENG'];
  cm['EUMYANG'] = cm['HOEKSU_EUMYANG'];

  const sm = cm['SEONGMYEONGHAK'];
  return {
    score: sm.score,
    isPassed: sm.isPassed,
    status: sm.isPassed ? 'POSITIVE' : 'NEGATIVE',
    categoryMap: cm,
    categories: ([
      'SEONGMYEONGHAK', 'SAGYEOK_SURI', 'SAJU_JAWON_BALANCE',
      'HOEKSU_EUMYANG', 'BALEUM_OHAENG', 'BALEUM_EUMYANG', 'SAGYEOK_OHAENG',
    ] as EvalFrame[]).map(f => cm[f]),
  };
}
