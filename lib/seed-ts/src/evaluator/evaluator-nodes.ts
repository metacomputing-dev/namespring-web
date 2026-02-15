import {
  flattenSignals,
  type CalculatorNode,
  type CalculatorSignal,
} from '../calculator/calculator-graph.js';
import type { ElementKey } from './element-cycle.js';
import { clamp, distributionFromArrangement } from './element-cycle.js';
import {
  type EvalFrame,
  type EvaluationPipelineContext,
  type FrameInsight,
  SIGNAL_WEIGHT_MAJOR,
  SIGNAL_WEIGHT_MINOR,
  createInsight,
  createSignal,
  mustInsight,
  setInsight,
} from './evaluator-context.js';
import {
  calculateArrayScore,
  calculateBalanceScore,
  checkElementSangSaeng,
  checkFourFrameSuriElement,
  checkPolarityHarmony,
  countDominant,
  polarityScore,
  bucketFromFortune,
  levelToFortune,
  type PolarityValue,
} from './rules.js';
import { computeSajuNameScore } from './saju-name-scorer.js';
import {
  NODE_FORTUNE_BUCKET_PASS,
  NODE_STROKE_ELEMENT_PASS,
  NODE_ADJACENCY_THRESHOLD_TWO_CHAR,
  NODE_ADJACENCY_THRESHOLD_SINGLE_CHAR,
  NODE_FOUR_FRAME_ELEMENT_PASS,
  NODE_PRONUNCIATION_ELEMENT_PASS,
  NODE_ADAPTIVE_MODE_THRESHOLD,
  NODE_ADAPTIVE_TWO_FAILURES_THRESHOLD,
  NODE_STRICT_PASS_THRESHOLD,
  NODE_ADAPTIVE_THRESHOLD_REDUCTION,
  NODE_SEVERE_FAILURE_THRESHOLD,
  NODE_MANDATORY_GATE_SCORE,
  NODE_SAJU_WEIGHT_BOOST,
  NODE_RELAXABLE_WEIGHT_REDUCTION,
  NODE_PRIORITY_SIGNAL_BASE,
  NODE_PRIORITY_SIGNAL_CONFIDENCE,
  NODE_PRIORITY_PENALTY_DIVISOR,
  NODE_PRIORITY_PENALTY_WEIGHT,
  NODE_STATS_BASE_SCORE,
  SAJU_DEFAULT_CONFIDENCE,
} from './scoring-constants.js';

// ── Element Node Factory ──

function createElementNode(config: {
  id: string;
  frame: EvalFrame;
  signalWeight: number;
  getArrangement: (ctx: EvaluationPipelineContext) => ElementKey[];
  computePass: (ctx: EvaluationPipelineContext, distribution: Record<ElementKey, number>, adjacencyScore: number, balanceScore: number, score: number) => boolean;
}): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: config.id,
    visit(ctx) {
      const arrangement = config.getArrangement(ctx);
      const distribution = distributionFromArrangement(arrangement);
      const adjacencyScore = calculateArrayScore(arrangement, ctx.surnameLength);
      const balance = calculateBalanceScore(distribution);
      const score = (balance + adjacencyScore) / 2;
      const isPassed = config.computePass(ctx, distribution, adjacencyScore, balance, score);
      setInsight(ctx, createInsight(config.frame, score, isPassed, arrangement.join('-'), {
        distribution, adjacencyScore, balanceScore: balance,
      }));
    },
    backward(ctx) {
      if (config.signalWeight === 0) return { nodeId: config.id, signals: [] };
      const insight = mustInsight(ctx, config.frame);
      return { nodeId: config.id, signals: [createSignal(config.frame, insight, config.signalWeight)] };
    },
  };
}

// ── Polarity Node Factory ──

function createPolarityNode(config: {
  id: string;
  frame: EvalFrame;
  signalWeight: number;
  getArrangement: (ctx: EvaluationPipelineContext) => PolarityValue[];
}): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: config.id,
    visit(ctx) {
      const arrangement = config.getArrangement(ctx);
      const negCount = arrangement.filter(v => v === 'Negative').length;
      const posCount = arrangement.length - negCount;
      const score = polarityScore(negCount, posCount);
      const isPassed = checkPolarityHarmony(arrangement, ctx.surnameLength);
      setInsight(ctx, createInsight(config.frame, score, isPassed, arrangement.join(''), { arrangementList: arrangement }));
    },
    backward(ctx) {
      const insight = mustInsight(ctx, config.frame);
      return { nodeId: config.id, signals: [createSignal(config.frame, insight, config.signalWeight)] };
    },
  };
}

// ── Concrete Nodes ──

function createStrokeElementNode(): CalculatorNode<EvaluationPipelineContext> {
  return createElementNode({
    id: 'stroke-element',
    frame: 'HOEKSU_OHAENG',
    signalWeight: 0,
    getArrangement: (ctx) => ctx.hanjaCalculator.getStrokeElementArrangement() as ElementKey[],
    computePass: (_ctx, _dist, _adj, balanceScore) => balanceScore >= NODE_STROKE_ELEMENT_PASS,
  });
}

function createFourFrameElementNode(): CalculatorNode<EvaluationPipelineContext> {
  return createElementNode({
    id: 'four-frame-element',
    frame: 'SAGYEOK_OHAENG',
    signalWeight: SIGNAL_WEIGHT_MINOR,
    getArrangement: (ctx) => ctx.fourFrameCalculator.getCompatibilityElementArrangement() as ElementKey[],
    computePass: (ctx, distribution, adjacencyScore, _balanceScore, score) => {
      const threshold = ctx.surnameLength === 2 ? NODE_ADJACENCY_THRESHOLD_TWO_CHAR : NODE_ADJACENCY_THRESHOLD_SINGLE_CHAR;
      return (
        checkFourFrameSuriElement(ctx.fourFrameCalculator.getCompatibilityElementArrangement() as ElementKey[], ctx.givenLength) &&
        !countDominant(distribution) &&
        adjacencyScore >= threshold &&
        score >= NODE_FOUR_FRAME_ELEMENT_PASS
      );
    },
  });
}

function createPronunciationElementNode(): CalculatorNode<EvaluationPipelineContext> {
  return createElementNode({
    id: 'pronunciation-element',
    frame: 'BALEUM_OHAENG',
    signalWeight: SIGNAL_WEIGHT_MINOR,
    getArrangement: (ctx) => ctx.hangulCalculator.getPronunciationElementArrangement() as ElementKey[],
    computePass: (ctx, distribution, adjacencyScore, _balanceScore, score) => {
      const threshold = ctx.surnameLength === 2 ? NODE_ADJACENCY_THRESHOLD_TWO_CHAR : NODE_ADJACENCY_THRESHOLD_SINGLE_CHAR;
      const arrangement = ctx.hangulCalculator.getPronunciationElementArrangement() as ElementKey[];
      return (
        checkElementSangSaeng(arrangement, ctx.surnameLength) &&
        !countDominant(distribution) &&
        adjacencyScore >= threshold &&
        score >= NODE_PRONUNCIATION_ELEMENT_PASS
      );
    },
  });
}

function createStrokePolarityNode(): CalculatorNode<EvaluationPipelineContext> {
  return createPolarityNode({
    id: 'stroke-polarity',
    frame: 'HOEKSU_EUMYANG',
    signalWeight: SIGNAL_WEIGHT_MINOR,
    getArrangement: (ctx) => ctx.hanjaCalculator.getStrokePolarityArrangement() as PolarityValue[],
  });
}

function createPronunciationPolarityNode(): CalculatorNode<EvaluationPipelineContext> {
  return createPolarityNode({
    id: 'pronunciation-polarity',
    frame: 'BALEUM_EUMYANG',
    signalWeight: SIGNAL_WEIGHT_MINOR,
    getArrangement: (ctx) => ctx.hangulCalculator.getPronunciationPolarityArrangement() as PolarityValue[],
  });
}

// ── Four Frame Number (사격수리) ──

function createFourFrameNumberNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: 'four-frame-number',
    visit(ctx) {
      const nums = ctx.fourFrameCalculator.getFrameNumbers();
      const getLucky = (num: number) => levelToFortune(ctx.luckyMap.get(num) ?? '');
      const wonF = getLucky(nums.won);
      const hyeongF = getLucky(nums.hyeong);
      const iF = getLucky(nums.i);
      const jeongF = getLucky(nums.jeong);
      const buckets = [bucketFromFortune(wonF), bucketFromFortune(hyeongF)];
      if (ctx.givenLength > 1) buckets.push(bucketFromFortune(iF));
      buckets.push(bucketFromFortune(jeongF));
      const score = buckets.reduce((a, b) => a + b, 0);
      const isPassed = buckets.length > 0 && buckets.every(v => v >= NODE_FORTUNE_BUCKET_PASS);
      setInsight(ctx, createInsight('SAGYEOK_SURI', score, isPassed,
        `${nums.won}/${wonF}-${nums.hyeong}/${hyeongF}-${nums.i}/${iF}-${nums.jeong}/${jeongF}`,
        { won: nums.won, hyeong: nums.hyeong, i: nums.i, jeong: nums.jeong }));
    },
    backward(ctx) {
      const insight = mustInsight(ctx, 'SAGYEOK_SURI');
      return { nodeId: 'four-frame-number', signals: [createSignal('SAGYEOK_SURI', insight, SIGNAL_WEIGHT_MAJOR)] };
    },
  };
}

// ── Saju Balance Node ──

function createSajuBalanceNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: 'saju-balance',
    visit(ctx) {
      const rootArr = ctx.hanjaCalculator.getRootElementArrangement() as ElementKey[];
      const rootDist = distributionFromArrangement(rootArr);
      const sajuNameScore = computeSajuNameScore(ctx.sajuDistribution, rootDist, ctx.sajuOutput);
      setInsight(ctx, createInsight('SAJU_JAWON_BALANCE', sajuNameScore.score, sajuNameScore.isPassed, 'SAJU+JAWON', {
        sajuDistribution: ctx.sajuDistribution,
        sajuDistributionSource: ctx.sajuDistributionSource,
        jawonDistribution: rootDist,
        sajuJawonDistribution: sajuNameScore.combined,
        sajuScoring: sajuNameScore.breakdown,
        sajuOutput: ctx.sajuOutput,
      }));
    },
    backward(ctx) {
      const insight = mustInsight(ctx, 'SAJU_JAWON_BALANCE');
      return { nodeId: 'saju-balance', signals: [createSignal('SAJU_JAWON_BALANCE', insight, SIGNAL_WEIGHT_MAJOR)] };
    },
  };
}

// ── Statistics Node (placeholder) ──

function createStatisticsNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: 'statistics',
    visit(ctx) {
      setInsight(ctx, createInsight('STATISTICS', NODE_STATS_BASE_SCORE, true, 'stats', { found: false }));
    },
    backward() {
      return { nodeId: 'statistics', signals: [] };
    },
  };
}

// ── Root Node (성명학 종합) ──

type RelaxableFrame = 'SAGYEOK_SURI' | 'HOEKSU_EUMYANG' | 'BALEUM_OHAENG' | 'BALEUM_EUMYANG' | 'SAGYEOK_OHAENG';
const RELAXABLE_FRAMES = new Set<RelaxableFrame>(['SAGYEOK_SURI', 'HOEKSU_EUMYANG', 'BALEUM_OHAENG', 'BALEUM_EUMYANG', 'SAGYEOK_OHAENG']);
const STRICT_FRAMES: EvalFrame[] = ['SAGYEOK_SURI', 'SAJU_JAWON_BALANCE', 'HOEKSU_EUMYANG', 'BALEUM_OHAENG', 'BALEUM_EUMYANG', 'SAGYEOK_OHAENG'];

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

function extractSajuPriority(ctx: EvaluationPipelineContext): number {
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

export function createRootNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: 'root',
    createChildren(): CalculatorNode<EvaluationPipelineContext>[] {
      return [
        createFourFrameNumberNode(),
        createStrokeElementNode(),
        createFourFrameElementNode(),
        createPronunciationElementNode(),
        createStrokePolarityNode(),
        createPronunciationPolarityNode(),
        createSajuBalanceNode(),
        createStatisticsNode(),
      ];
    },
    backward(ctx, childPackets) {
      const weightedSignals = flattenSignals(childPackets).filter(s => s.weight > 0);
      const sajuPriority = extractSajuPriority(ctx);
      const adjusted = adjustSignals(weightedSignals, sajuPriority);
      const weightedScore = computeWeightedScore(adjusted);

      // Adaptive pass policy
      const adaptiveMode = sajuPriority >= NODE_ADAPTIVE_MODE_THRESHOLD;
      const relaxableFailures = adjusted.filter(s => RELAXABLE_FRAMES.has(s.frame as RelaxableFrame) && !s.isPassed);
      const allowedFailures = adaptiveMode ? (sajuPriority >= NODE_ADAPTIVE_TWO_FAILURES_THRESHOLD ? 2 : 1) : 0;
      const threshold = adaptiveMode ? NODE_STRICT_PASS_THRESHOLD - NODE_ADAPTIVE_THRESHOLD_REDUCTION * sajuPriority : NODE_STRICT_PASS_THRESHOLD;
      let isPassed: boolean;
      if (adaptiveMode) {
        const sajuI = mustInsight(ctx, 'SAJU_JAWON_BALANCE');
        const fourFrameI = mustInsight(ctx, 'SAGYEOK_SURI');
        isPassed = sajuI.isPassed && fourFrameI.score >= NODE_MANDATORY_GATE_SCORE &&
          weightedScore >= threshold &&
          !relaxableFailures.some(s => s.score < NODE_SEVERE_FAILURE_THRESHOLD) &&
          relaxableFailures.length <= allowedFailures;
      } else {
        isPassed = STRICT_FRAMES.every(frame => mustInsight(ctx, frame).isPassed) && weightedScore >= NODE_STRICT_PASS_THRESHOLD;
      }

      setInsight(ctx, createInsight('SEONGMYEONGHAK', weightedScore, isPassed, 'ROOT', {
        contributions: Object.fromEntries(adjusted.map(s => [s.frame, {
          rawScore: s.score, weight: s.weight,
          weightMultiplier: s.weight > 0 ? s.adjustedWeight / s.weight : 1,
          adjustedWeight: s.adjustedWeight, weighted: s.adjustedWeighted, isPassed: s.isPassed,
        }])),
        failedFrames: adjusted.filter(s => !s.isPassed).map(s => s.frame),
        adaptivePolicy: { mode: adaptiveMode ? 'adaptive' : 'strict', sajuPriority, allowedFailures, threshold, relaxableFailures: relaxableFailures.map(s => s.frame) },
      }));

      return { nodeId: 'root', signals: [createSignal('SEONGMYEONGHAK', mustInsight(ctx, 'SEONGMYEONGHAK'), 0)] };
    },
  };
}
