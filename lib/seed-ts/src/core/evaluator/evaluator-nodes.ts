import {
  flattenSignals,
  type CalculatorNode,
  type CalculatorSignal,
} from "../../calculator/index.js";
import type { Element, Frame, Polarity } from "../types.js";
import { clamp } from "../utils.js";
import {
  SIGNAL_WEIGHT_MAJOR,
  SIGNAL_WEIGHT_MINOR,
  createInsight,
  createSignal,
  distributionFromArrangement,
  type EvaluationPipelineContext,
  mustInsight,
  setInsight,
} from "./evaluator-context.js";
import {
  bucketFromFortune,
  calculateArrayScore,
  calculateBalanceScore,
  checkElementSangSaeng,
  checkFourFrameSuriElement,
  checkPolarityHarmony,
  countDominant,
  levelToFortune,
  polarityScore,
} from "./evaluator-rules.js";
import { computeSajuNameScore } from "./evaluator-saju.js";
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
} from "./scoring-constants.js";

// ── Element Node Factory ──

interface ElementNodeConfig {
  id: string;
  frame: Frame;
  signalWeight: number;
  getArrangement: (ctx: EvaluationPipelineContext) => Element[];
  computePass: (ctx: EvaluationPipelineContext, distribution: Record<Element, number>, adjacencyScore: number, balanceScore: number, score: number) => boolean;
}

function createElementNode(config: ElementNodeConfig): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: config.id,
    visit(ctx): void {
      const arrangement = config.getArrangement(ctx);
      const distribution = distributionFromArrangement(arrangement);
      const adjacencyScore = calculateArrayScore(arrangement, ctx.surnameLength);
      const balanceScore = calculateBalanceScore(distribution);
      const score = (balanceScore + adjacencyScore) / 2;
      const isPassed = config.computePass(ctx, distribution, adjacencyScore, balanceScore, score);
      const insight = createInsight(config.frame, score, isPassed, arrangement.join("-"), {
        distribution,
        adjacencyScore,
        balanceScore,
      });
      setInsight(ctx, insight);
    },
    backward(ctx): { nodeId: string; signals: CalculatorSignal[] } {
      if (config.signalWeight === 0) {
        return { nodeId: config.id, signals: [] };
      }
      const insight = mustInsight(ctx, config.frame);
      return {
        nodeId: config.id,
        signals: [createSignal(config.frame, insight, config.signalWeight)],
      };
    },
  };
}

// ── Polarity Node Factory ──

interface PolarityNodeConfig {
  id: string;
  frame: Frame;
  signalWeight: number;
  getArrangement: (ctx: EvaluationPipelineContext) => Polarity[];
}

function createPolarityNode(config: PolarityNodeConfig): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: config.id,
    visit(ctx): void {
      const arrangement = config.getArrangement(ctx);
      const eumCount = arrangement.filter((value) => value === "\u9670").length;
      const yangCount = arrangement.length - eumCount;
      const score = polarityScore(eumCount, yangCount);
      const isPassed = checkPolarityHarmony(arrangement, ctx.surnameLength);
      const insight = createInsight(config.frame, score, isPassed, arrangement.join(""), {
        arrangementList: arrangement,
      });
      setInsight(ctx, insight);
    },
    backward(ctx): { nodeId: string; signals: CalculatorSignal[] } {
      const insight = mustInsight(ctx, config.frame);
      return {
        nodeId: config.id,
        signals: [createSignal(config.frame, insight, config.signalWeight)],
      };
    },
  };
}

// ── Concrete Nodes via Factory ──

function createStrokeElementNode(): CalculatorNode<EvaluationPipelineContext> {
  return createElementNode({
    id: "stroke-element",
    frame: "HOEKSU_OHAENG",
    signalWeight: 0,
    getArrangement: (ctx) => ctx.hanjaCalculator.getStrokeElementArrangement(),
    computePass: (_ctx, _dist, _adj, balanceScore) => balanceScore >= NODE_STROKE_ELEMENT_PASS,
  });
}

function createFourFrameElementNode(): CalculatorNode<EvaluationPipelineContext> {
  return createElementNode({
    id: "four-frame-element",
    frame: "SAGYEOK_OHAENG",
    signalWeight: SIGNAL_WEIGHT_MINOR,
    getArrangement: (ctx) => ctx.fourFrameCalculator.getCompatibilityElementArrangement(),
    computePass: (ctx, distribution, adjacencyScore, _balanceScore, score) => {
      const adjacencyThreshold = ctx.surnameLength === 2 ? NODE_ADJACENCY_THRESHOLD_TWO_CHAR : NODE_ADJACENCY_THRESHOLD_SINGLE_CHAR;
      return (
        checkFourFrameSuriElement(ctx.fourFrameCalculator.getCompatibilityElementArrangement(), ctx.givenLength) &&
        !countDominant(distribution) &&
        adjacencyScore >= adjacencyThreshold &&
        score >= NODE_FOUR_FRAME_ELEMENT_PASS
      );
    },
  });
}

function createPronunciationElementNode(): CalculatorNode<EvaluationPipelineContext> {
  return createElementNode({
    id: "pronunciation-element",
    frame: "BALEUM_OHAENG",
    signalWeight: SIGNAL_WEIGHT_MINOR,
    getArrangement: (ctx) => ctx.hangulCalculator.getPronunciationElementArrangement(),
    computePass: (ctx, distribution, adjacencyScore, _balanceScore, score) => {
      const adjacencyThreshold = ctx.surnameLength === 2 ? NODE_ADJACENCY_THRESHOLD_TWO_CHAR : NODE_ADJACENCY_THRESHOLD_SINGLE_CHAR;
      const arrangement = ctx.hangulCalculator.getPronunciationElementArrangement();
      return (
        checkElementSangSaeng(arrangement, ctx.surnameLength) &&
        !countDominant(distribution) &&
        adjacencyScore >= adjacencyThreshold &&
        score >= NODE_PRONUNCIATION_ELEMENT_PASS
      );
    },
  });
}

function createStrokePolarityNode(): CalculatorNode<EvaluationPipelineContext> {
  return createPolarityNode({
    id: "stroke-polarity",
    frame: "HOEKSU_EUMYANG",
    signalWeight: SIGNAL_WEIGHT_MINOR,
    getArrangement: (ctx) => ctx.hanjaCalculator.getStrokePolarityArrangement(),
  });
}

function createPronunciationPolarityNode(): CalculatorNode<EvaluationPipelineContext> {
  return createPolarityNode({
    id: "pronunciation-polarity",
    frame: "BALEUM_EUMYANG",
    signalWeight: SIGNAL_WEIGHT_MINOR,
    getArrangement: (ctx) => ctx.hangulCalculator.getPronunciationPolarityArrangement(),
  });
}

// ── Unique Nodes ──

function createFourFrameNumberNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: "four-frame-number",
    visit(ctx): void {
      const fourFrameNumbers = ctx.fourFrameCalculator.getFrameNumbers();
      const wonFortune = levelToFortune(ctx.luckyMap.get(fourFrameNumbers.won) ?? "\uBBF8\uC815");
      const hyeongFortune = levelToFortune(ctx.luckyMap.get(fourFrameNumbers.hyeong) ?? "\uBBF8\uC815");
      const iFortune = levelToFortune(ctx.luckyMap.get(fourFrameNumbers.i) ?? "\uBBF8\uC815");
      const jeongFortune = levelToFortune(ctx.luckyMap.get(fourFrameNumbers.jeong) ?? "\uBBF8\uC815");

      const buckets = [bucketFromFortune(wonFortune), bucketFromFortune(hyeongFortune)];
      if (ctx.givenLength > 1) {
        buckets.push(bucketFromFortune(iFortune));
      }
      buckets.push(bucketFromFortune(jeongFortune));

      const score = buckets.reduce((a, b) => a + b, 0);
      const isPassed = buckets.length > 0 && buckets.every((value) => value >= NODE_FORTUNE_BUCKET_PASS);
      const insight = createInsight(
        "SAGYEOK_SURI",
        score,
        isPassed,
        `${fourFrameNumbers.won}/${wonFortune}-${fourFrameNumbers.hyeong}/${hyeongFortune}-${fourFrameNumbers.i}/${iFortune}-${fourFrameNumbers.jeong}/${jeongFortune}`,
        {
          won: fourFrameNumbers.won,
          hyeong: fourFrameNumbers.hyeong,
          i: fourFrameNumbers.i,
          jeong: fourFrameNumbers.jeong,
        },
      );
      setInsight(ctx, insight);
    },
    backward(ctx): { nodeId: string; signals: CalculatorSignal[] } {
      const insight = mustInsight(ctx, "SAGYEOK_SURI");
      return {
        nodeId: "four-frame-number",
        signals: [createSignal("SAGYEOK_SURI", insight, SIGNAL_WEIGHT_MAJOR)],
      };
    },
  };
}

function createSajuBalanceNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: "saju-balance",
    visit(ctx): void {
      const rootElementArrangement = ctx.resolved.given.map((entry) => entry.rootElement);
      const rootElementDistribution = distributionFromArrangement(rootElementArrangement);
      const sajuNameScore = computeSajuNameScore(
        ctx.sajuDistribution,
        rootElementDistribution,
        ctx.sajuOutput,
      );
      const insight = createInsight(
        "SAJU_JAWON_BALANCE",
        sajuNameScore.score,
        sajuNameScore.isPassed,
        "SAJU+JAWON",
        {
          sajuDistribution: ctx.sajuDistribution,
          sajuDistributionSource: ctx.sajuDistributionSource,
          jawonDistribution: rootElementDistribution,
          sajuJawonDistribution: sajuNameScore.combined,
          sajuScoring: sajuNameScore.breakdown,
          requestedBirth: ctx.birth,
          requestedGender: ctx.gender,
          sajuInput: ctx.sajuInput,
          sajuOutput: ctx.sajuOutput,
          sajuCalculationError: ctx.sajuCalculationError,
        },
      );
      setInsight(ctx, insight);
    },
    backward(ctx): { nodeId: string; signals: CalculatorSignal[] } {
      const insight = mustInsight(ctx, "SAJU_JAWON_BALANCE");
      return {
        nodeId: "saju-balance",
        signals: [createSignal("SAJU_JAWON_BALANCE", insight, SIGNAL_WEIGHT_MAJOR)],
      };
    },
  };
}

function createStatisticsNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: "statistics",
    visit(ctx): void {
      const statsScore = ctx.stats ? clamp(NODE_STATS_BASE_SCORE + ctx.stats.similarNames.length, 0, 100) : 0;
      const insight = createInsight(
        "STATISTICS",
        statsScore,
        true,
        "stats",
        { found: ctx.stats !== null },
      );
      setInsight(ctx, insight);
    },
    backward(): { nodeId: string; signals: CalculatorSignal[] } {
      return { nodeId: "statistics", signals: [] };
    },
  };
}

// ── Root Node ──

type RelaxableFrame = "SAGYEOK_SURI" | "HOEKSU_EUMYANG" | "BALEUM_OHAENG" | "BALEUM_EUMYANG" | "SAGYEOK_OHAENG";

const RELAXABLE_FRAMES = new Set<RelaxableFrame>([
  "SAGYEOK_SURI",
  "HOEKSU_EUMYANG",
  "BALEUM_OHAENG",
  "BALEUM_EUMYANG",
  "SAGYEOK_OHAENG",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function frameWeightMultiplier(frame: string, priority: number): number {
  if (frame === "SAJU_JAWON_BALANCE") {
    return 1 + priority * NODE_SAJU_WEIGHT_BOOST;
  }
  if (RELAXABLE_FRAMES.has(frame as RelaxableFrame)) {
    return 1 - priority * NODE_RELAXABLE_WEIGHT_REDUCTION;
  }
  return 1;
}

function extractSajuPriority(ctx: EvaluationPipelineContext): number {
  const sajuInsight = ctx.insights.SAJU_JAWON_BALANCE;
  if (!sajuInsight) {
    return 0;
  }

  const details = asRecord(sajuInsight.details);
  const sajuScoring = asRecord(details?.sajuScoring);
  if (!sajuScoring) {
    return 0;
  }

  const balance = asFiniteNumber(sajuScoring.balance, 0);
  const yongshin = asFiniteNumber(sajuScoring.yongshin, 0);
  const penalties = asRecord(sajuScoring.penalties);
  const penaltyTotal = asFiniteNumber(penalties?.total, 0);
  const sajuOutput = asRecord(details?.sajuOutput);
  const yongshinOutput = asRecord(sajuOutput?.yongshin);
  const confidence = clamp(asFiniteNumber(yongshinOutput?.finalConfidence, SAJU_DEFAULT_CONFIDENCE), 0, 1);

  const signal = ((balance + yongshin) / 200) * (NODE_PRIORITY_SIGNAL_BASE + confidence * NODE_PRIORITY_SIGNAL_CONFIDENCE);
  const penalty = Math.min(1, penaltyTotal / NODE_PRIORITY_PENALTY_DIVISOR) * NODE_PRIORITY_PENALTY_WEIGHT;
  return clamp(signal - penalty, 0, 1);
}

const SAJU_DEFAULT_CONFIDENCE = 0.65;

export function createRootNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: "root",
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
    backward(ctx, childPackets): { nodeId: string; signals: CalculatorSignal[] } {
      const weightedSignals = flattenSignals(childPackets).filter((signal) => signal.weight > 0);
      const sajuPriority = extractSajuPriority(ctx);
      const adaptiveMode = sajuPriority >= NODE_ADAPTIVE_MODE_THRESHOLD;
      const allowedFailures = adaptiveMode ? (sajuPriority >= NODE_ADAPTIVE_TWO_FAILURES_THRESHOLD ? 2 : 1) : 0;
      const threshold = adaptiveMode ? NODE_STRICT_PASS_THRESHOLD - NODE_ADAPTIVE_THRESHOLD_REDUCTION * sajuPriority : NODE_STRICT_PASS_THRESHOLD;

      const adjustedSignals = weightedSignals.map((signal) => {
        const multiplier = frameWeightMultiplier(signal.frame, sajuPriority);
        const adjustedWeight = signal.weight * multiplier;
        return {
          ...signal,
          adjustedWeight,
          adjustedWeighted: signal.score * adjustedWeight,
        };
      });

      const totalAdjustedWeight = adjustedSignals.reduce((acc, signal) => acc + signal.adjustedWeight, 0);
      const weightedScore =
        totalAdjustedWeight > 0
          ? adjustedSignals.reduce((acc, signal) => acc + signal.adjustedWeighted, 0) / totalAdjustedWeight
          : 0;

      const fourFrameNumberInsight = mustInsight(ctx, "SAGYEOK_SURI");
      const sajuInsight = mustInsight(ctx, "SAJU_JAWON_BALANCE");
      const strokePolarityInsight = mustInsight(ctx, "HOEKSU_EUMYANG");
      const pronunciationElementInsight = mustInsight(ctx, "BALEUM_OHAENG");
      const pronunciationPolarityInsight = mustInsight(ctx, "BALEUM_EUMYANG");
      const fourFrameElementInsight = mustInsight(ctx, "SAGYEOK_OHAENG");
      const strictPassed =
        fourFrameNumberInsight.isPassed &&
        sajuInsight.isPassed &&
        strokePolarityInsight.isPassed &&
        pronunciationElementInsight.isPassed &&
        pronunciationPolarityInsight.isPassed &&
        fourFrameElementInsight.isPassed &&
        weightedScore >= NODE_STRICT_PASS_THRESHOLD;

      const relaxableFailures = adjustedSignals.filter(
        (signal) => RELAXABLE_FRAMES.has(signal.frame as RelaxableFrame) && !signal.isPassed,
      );
      const severeRelaxableFailure = relaxableFailures.some((signal) => signal.score < NODE_SEVERE_FAILURE_THRESHOLD);
      const mandatoryGate = sajuInsight.isPassed && fourFrameNumberInsight.score >= NODE_MANDATORY_GATE_SCORE;
      const adaptivePassed =
        mandatoryGate &&
        weightedScore >= threshold &&
        !severeRelaxableFailure &&
        relaxableFailures.length <= allowedFailures;

      const rootPassed = adaptiveMode ? adaptivePassed : strictPassed;

      const failedFrames = adjustedSignals
        .filter((signal) => !signal.isPassed)
        .map((signal) => signal.frame);
      const contributions = Object.fromEntries(
        adjustedSignals.map((signal) => [
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

      const seongmyeonghak = createInsight(
        "SEONGMYEONGHAK",
        weightedScore,
        rootPassed,
        "ROOT",
        {
          contributions,
          failedFrames,
          adaptivePolicy: {
            mode: adaptiveMode ? "adaptive" : "strict",
            sajuPriority,
            allowedFailures,
            threshold,
            relaxableFailures: relaxableFailures.map((signal) => signal.frame),
          },
        },
      );
      setInsight(ctx, seongmyeonghak);

      return {
        nodeId: "root",
        signals: [createSignal("SEONGMYEONGHAK", seongmyeonghak, 0)],
      };
    },
  };
}
