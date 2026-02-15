import { NameCalculator, type EvalContext, type EvalFrame, type FrameInsight, type EvaluationResult } from './base.js';
import type { CalculatorNode, CalculatorPacket, CalculatorSignal } from './graph.js';
import { executeCalculatorNode, flattenSignals } from './graph.js';
import type { ElementKey } from './element-cycle.js';
import { clamp } from './element-cycle.js';
import {
  SAJU_DEFAULT_CONFIDENCE,
  NODE_ADAPTIVE_MODE_THRESHOLD, NODE_ADAPTIVE_TWO_FAILURES_THRESHOLD,
  NODE_STRICT_PASS_THRESHOLD, NODE_ADAPTIVE_THRESHOLD_REDUCTION,
  NODE_SEVERE_FAILURE_THRESHOLD, NODE_MANDATORY_GATE_SCORE,
  NODE_SAJU_WEIGHT_BOOST, NODE_RELAXABLE_WEIGHT_REDUCTION,
  NODE_PRIORITY_SIGNAL_BASE, NODE_PRIORITY_SIGNAL_CONFIDENCE,
  NODE_PRIORITY_PENALTY_DIVISOR, NODE_PRIORITY_PENALTY_WEIGHT,
  NODE_STATS_BASE_SCORE,
} from './constants.js';

// ── Internal types ──────────────────────────────────────────────

type RelaxableFrame = 'SAGYEOK_SURI' | 'HOEKSU_EUMYANG' | 'BALEUM_OHAENG' | 'BALEUM_EUMYANG' | 'SAGYEOK_OHAENG';

const RELAXABLE_FRAMES = new Set<RelaxableFrame>([
  'SAGYEOK_SURI', 'HOEKSU_EUMYANG', 'BALEUM_OHAENG', 'BALEUM_EUMYANG', 'SAGYEOK_OHAENG',
]);

const STRICT_FRAMES: EvalFrame[] = [
  'SAGYEOK_SURI', 'SAJU_JAWON_BALANCE', 'HOEKSU_EUMYANG', 'BALEUM_OHAENG', 'BALEUM_EUMYANG', 'SAGYEOK_OHAENG',
];

// ── Helpers ─────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function frameWeightMultiplier(frame: string, priority: number): number {
  if (frame === 'SAJU_JAWON_BALANCE') return 1 + priority * NODE_SAJU_WEIGHT_BOOST;
  if (RELAXABLE_FRAMES.has(frame as RelaxableFrame)) return 1 - priority * NODE_RELAXABLE_WEIGHT_REDUCTION;
  return 1;
}

function extractSajuPriority(ctx: EvalContext): number {
  const sajuInsight = ctx.insights.SAJU_JAWON_BALANCE;
  if (!sajuInsight) return 0;
  const details = asRecord(sajuInsight.details);
  const sajuScoring = asRecord(details?.sajuScoring);
  if (!sajuScoring) return 0;
  const balance = asFiniteNumber(sajuScoring.balance, 0);
  const yongshinVal = asFiniteNumber(sajuScoring.yongshin, 0);
  const penalties = asRecord(sajuScoring.penalties);
  const penaltyTotal = asFiniteNumber(penalties?.total, 0);
  const sajuOutput = asRecord(details?.sajuOutput);
  const yongshinOutput = asRecord(sajuOutput?.yongshin);
  const confidence = clamp(asFiniteNumber(yongshinOutput?.finalConfidence, SAJU_DEFAULT_CONFIDENCE), 0, 1);
  const signal = ((balance + yongshinVal) / 200) * (NODE_PRIORITY_SIGNAL_BASE + confidence * NODE_PRIORITY_SIGNAL_CONFIDENCE);
  const penalty = Math.min(1, penaltyTotal / NODE_PRIORITY_PENALTY_DIVISOR) * NODE_PRIORITY_PENALTY_WEIGHT;
  return clamp(signal - penalty, 0, 1);
}

interface AdjustedSignal extends CalculatorSignal { adjustedWeight: number; adjustedWeighted: number; }

function adjustSignals(signals: CalculatorSignal[], sajuPriority: number): AdjustedSignal[] {
  return signals.map(s => {
    const multiplier = frameWeightMultiplier(s.frame, sajuPriority);
    const adjustedWeight = s.weight * multiplier;
    return { ...s, adjustedWeight, adjustedWeighted: s.score * adjustedWeight };
  });
}

function computeWeightedScore(signals: AdjustedSignal[]): number {
  const totalWeight = signals.reduce((acc, s) => acc + s.adjustedWeight, 0);
  return totalWeight > 0 ? signals.reduce((acc, s) => acc + s.adjustedWeighted, 0) / totalWeight : 0;
}

function insight(ctx: EvalContext, frame: EvalFrame): FrameInsight {
  return ctx.insights[frame] ?? { frame, score: 0, isPassed: false, label: 'MISSING', details: {} };
}

function setInsight(ctx: EvalContext, ins: FrameInsight): void {
  (ctx.insights as Record<string, FrameInsight>)[ins.frame] = ins;
}

function createInsight(
  frame: EvalFrame, score: number, isPassed: boolean, label: string, details: Record<string, unknown> = {},
): FrameInsight {
  return { frame, score, isPassed, label, details };
}

function createSignal(frame: EvalFrame, ins: FrameInsight, weight: number): CalculatorSignal {
  return { key: frame, frame, score: ins.score, isPassed: ins.isPassed, weight };
}

// ── RootCalculator ──────────────────────────────────────────────

class RootCalculator implements CalculatorNode<EvalContext> {
  readonly id = 'root';

  constructor(private calculators: NameCalculator[]) {}

  createChildren(): CalculatorNode<EvalContext>[] {
    return this.calculators;
  }

  visit(ctx: EvalContext): void {
    setInsight(ctx, createInsight('STATISTICS', NODE_STATS_BASE_SCORE, true, 'stats', { found: false }));
  }

  backward(ctx: EvalContext, childPackets: readonly CalculatorPacket[]): CalculatorPacket {
    const weightedSignals = flattenSignals(childPackets).filter(s => s.weight > 0);
    const sajuPriority = extractSajuPriority(ctx);
    const adjusted = adjustSignals(weightedSignals, sajuPriority);
    const weightedScore = computeWeightedScore(adjusted);

    const adaptiveMode = sajuPriority >= NODE_ADAPTIVE_MODE_THRESHOLD;
    const relaxableFailures = adjusted.filter(s => RELAXABLE_FRAMES.has(s.frame as RelaxableFrame) && !s.isPassed);
    const allowedFailures = adaptiveMode ? (sajuPriority >= NODE_ADAPTIVE_TWO_FAILURES_THRESHOLD ? 2 : 1) : 0;
    const threshold = adaptiveMode
      ? NODE_STRICT_PASS_THRESHOLD - NODE_ADAPTIVE_THRESHOLD_REDUCTION * sajuPriority
      : NODE_STRICT_PASS_THRESHOLD;

    let isPassed: boolean;
    if (adaptiveMode) {
      const sajuI = insight(ctx, 'SAJU_JAWON_BALANCE');
      const fourFrameI = insight(ctx, 'SAGYEOK_SURI');
      isPassed = sajuI.isPassed && fourFrameI.score >= NODE_MANDATORY_GATE_SCORE &&
        weightedScore >= threshold &&
        !relaxableFailures.some(s => s.score < NODE_SEVERE_FAILURE_THRESHOLD) &&
        relaxableFailures.length <= allowedFailures;
    } else {
      isPassed = STRICT_FRAMES.every(frame => insight(ctx, frame).isPassed) && weightedScore >= NODE_STRICT_PASS_THRESHOLD;
    }

    setInsight(ctx, createInsight('SEONGMYEONGHAK', weightedScore, isPassed, 'ROOT', {
      contributions: Object.fromEntries(adjusted.map(s => [s.frame, {
        rawScore: s.score, weight: s.weight,
        weightMultiplier: s.weight > 0 ? s.adjustedWeight / s.weight : 1,
        adjustedWeight: s.adjustedWeight, weighted: s.adjustedWeighted, isPassed: s.isPassed,
      }])),
      failedFrames: adjusted.filter(s => !s.isPassed).map(s => s.frame),
      adaptivePolicy: {
        mode: adaptiveMode ? 'adaptive' : 'strict', sajuPriority,
        allowedFailures, threshold, relaxableFailures: relaxableFailures.map(s => s.frame),
      },
    }));

    return { nodeId: 'root', signals: [createSignal('SEONGMYEONGHAK', insight(ctx, 'SEONGMYEONGHAK'), 0)] };
  }
}

// ── Frame ordering constants ────────────────────────────────────

const ORDERED_FRAMES: EvalFrame[] = [
  'SEONGMYEONGHAK', 'SAGYEOK_SURI', 'SAJU_JAWON_BALANCE',
  'HOEKSU_EUMYANG', 'BALEUM_OHAENG', 'BALEUM_EUMYANG', 'SAGYEOK_OHAENG',
];

const UNIQUE_FRAMES: EvalFrame[] = [
  'SEONGMYEONGHAK', 'SAGYEOK_SURI', 'SAJU_JAWON_BALANCE',
  'HOEKSU_EUMYANG', 'BALEUM_OHAENG', 'BALEUM_EUMYANG',
  'SAGYEOK_OHAENG', 'HOEKSU_OHAENG', 'STATISTICS',
];

const FRAME_ALIASES: [EvalFrame, EvalFrame][] = [
  ['JAWON_OHAENG', 'HOEKSU_OHAENG'],
  ['EUMYANG', 'HOEKSU_EUMYANG'],
];

// ── Public API ──────────────────────────────────────────────────

export function evaluateName(calculators: NameCalculator[], ctx: EvalContext): EvaluationResult {
  const root = new RootCalculator(calculators);
  executeCalculatorNode(root, ctx);

  const categoryMap: Record<string, FrameInsight> = {};
  for (const frame of UNIQUE_FRAMES) {
    categoryMap[frame] = insight(ctx, frame);
  }
  for (const [alias, target] of FRAME_ALIASES) {
    categoryMap[alias] = categoryMap[target];
  }

  const seongmyeonghak = categoryMap.SEONGMYEONGHAK;
  return {
    score: seongmyeonghak.score,
    isPassed: seongmyeonghak.isPassed,
    status: seongmyeonghak.isPassed ? 'POSITIVE' : 'NEGATIVE',
    categoryMap,
    categories: ORDERED_FRAMES.map(f => categoryMap[f]),
  };
}
