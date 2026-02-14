import {
  flattenSignals,
  type CalculatorNode,
  type CalculatorSignal,
} from "../../calculator/index.js";
import { clamp } from "../utils.js";
import {
  W_MAJOR,
  W_MINOR,
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
      const isPassed = buckets.length > 0 && buckets.every((value) => value >= 15);
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
        signals: [createSignal("SAGYEOK_SURI", insight, W_MAJOR)],
      };
    },
  };
}

function createStrokeElementNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: "stroke-element",
    visit(ctx): void {
      const arrangement = ctx.hanjaCalculator.getStrokeElementArrangement();
      const distribution = distributionFromArrangement(arrangement);
      const adjacencyScore = calculateArrayScore(arrangement, ctx.surnameLength);
      const balanceScore = calculateBalanceScore(distribution);
      const insight = createInsight(
        "HOEKSU_OHAENG",
        balanceScore,
        balanceScore >= 60,
        arrangement.join("-"),
        {
          distribution,
          adjacencyScore,
        },
      );
      setInsight(ctx, insight);
    },
    backward(): { nodeId: string; signals: CalculatorSignal[] } {
      return {
        nodeId: "stroke-element",
        signals: [],
      };
    },
  };
}

function createFourFrameElementNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: "four-frame-element",
    visit(ctx): void {
      const arrangement = ctx.fourFrameCalculator.getCompatibilityElementArrangement();
      const distribution = distributionFromArrangement(arrangement);
      const adjacencyScore = calculateArrayScore(arrangement, ctx.surnameLength);
      const balanceScore = calculateBalanceScore(distribution);
      const score = (balanceScore + adjacencyScore) / 2;
      const dominant = countDominant(distribution);
      const adjacencyThreshold = ctx.surnameLength === 2 ? 65 : 60;
      const isPassed =
        checkFourFrameSuriElement(arrangement, ctx.givenLength) &&
        !dominant &&
        adjacencyScore >= adjacencyThreshold &&
        score >= 65;

      const insight = createInsight(
        "SAGYEOK_OHAENG",
        score,
        isPassed,
        arrangement.join("-"),
        {
          distribution,
          adjacencyScore,
          balanceScore,
        },
      );
      setInsight(ctx, insight);
    },
    backward(ctx): { nodeId: string; signals: CalculatorSignal[] } {
      const insight = mustInsight(ctx, "SAGYEOK_OHAENG");
      return {
        nodeId: "four-frame-element",
        signals: [createSignal("SAGYEOK_OHAENG", insight, W_MINOR)],
      };
    },
  };
}

function createPronunciationElementNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: "pronunciation-element",
    visit(ctx): void {
      const arrangement = ctx.hangulCalculator.getPronunciationElementArrangement();
      const distribution = distributionFromArrangement(arrangement);
      const adjacencyScore = calculateArrayScore(arrangement, ctx.surnameLength);
      const balanceScore = calculateBalanceScore(distribution);
      const score = (balanceScore + adjacencyScore) / 2;
      const adjacencyThreshold = ctx.surnameLength === 2 ? 65 : 60;
      const isPassed =
        checkElementSangSaeng(arrangement, ctx.surnameLength) &&
        !countDominant(distribution) &&
        adjacencyScore >= adjacencyThreshold &&
        score >= 70;

      const insight = createInsight(
        "BALEUM_OHAENG",
        score,
        isPassed,
        arrangement.join("-"),
        {
          distribution,
          adjacencyScore,
          balanceScore,
        },
      );
      setInsight(ctx, insight);
    },
    backward(ctx): { nodeId: string; signals: CalculatorSignal[] } {
      const insight = mustInsight(ctx, "BALEUM_OHAENG");
      return {
        nodeId: "pronunciation-element",
        signals: [createSignal("BALEUM_OHAENG", insight, W_MINOR)],
      };
    },
  };
}

function createStrokePolarityNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: "stroke-polarity",
    visit(ctx): void {
      const arrangement = ctx.hanjaCalculator.getStrokePolarityArrangement();
      const eumCount = arrangement.filter((value) => value === "\u9670").length;
      const yangCount = arrangement.length - eumCount;
      const score = polarityScore(eumCount, yangCount);
      const isPassed = checkPolarityHarmony(arrangement, ctx.surnameLength);

      const insight = createInsight(
        "HOEKSU_EUMYANG",
        score,
        isPassed,
        arrangement.join(""),
        {
          arrangementList: arrangement,
        },
      );
      setInsight(ctx, insight);
    },
    backward(ctx): { nodeId: string; signals: CalculatorSignal[] } {
      const insight = mustInsight(ctx, "HOEKSU_EUMYANG");
      return {
        nodeId: "stroke-polarity",
        signals: [createSignal("HOEKSU_EUMYANG", insight, W_MINOR)],
      };
    },
  };
}

function createPronunciationPolarityNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: "pronunciation-polarity",
    visit(ctx): void {
      const arrangement = ctx.hangulCalculator.getPronunciationPolarityArrangement();
      const eumCount = arrangement.filter((value) => value === "\u9670").length;
      const yangCount = arrangement.length - eumCount;
      const score = polarityScore(eumCount, yangCount);
      const isPassed = checkPolarityHarmony(arrangement, ctx.surnameLength);

      const insight = createInsight(
        "BALEUM_EUMYANG",
        score,
        isPassed,
        arrangement.join(""),
        {
          arrangementList: arrangement,
        },
      );
      setInsight(ctx, insight);
    },
    backward(ctx): { nodeId: string; signals: CalculatorSignal[] } {
      const insight = mustInsight(ctx, "BALEUM_EUMYANG");
      return {
        nodeId: "pronunciation-polarity",
        signals: [createSignal("BALEUM_EUMYANG", insight, W_MINOR)],
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
        signals: [createSignal("SAJU_JAWON_BALANCE", insight, W_MAJOR)],
      };
    },
  };
}

function createStatisticsNode(): CalculatorNode<EvaluationPipelineContext> {
  return {
    id: "statistics",
    visit(ctx): void {
      const statsScore = ctx.stats ? clamp(60 + ctx.stats.similarNames.length, 0, 100) : 0;
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
      return {
        nodeId: "statistics",
        signals: [],
      };
    },
  };
}

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
    return 1 + priority * 0.45;
  }
  if (RELAXABLE_FRAMES.has(frame as RelaxableFrame)) {
    return 1 - priority * 0.3;
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
  const confidence = clamp(asFiniteNumber(yongshinOutput?.finalConfidence, 0.65), 0, 1);

  const signal = ((balance + yongshin) / 200) * (0.55 + confidence * 0.45);
  const penalty = Math.min(1, penaltyTotal / 20) * 0.25;
  return clamp(signal - penalty, 0, 1);
}

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
      const adaptiveMode = sajuPriority >= 0.55;
      const allowedFailures = adaptiveMode ? (sajuPriority >= 0.78 ? 2 : 1) : 0;
      const threshold = adaptiveMode ? 60 - 8 * sajuPriority : 60;

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
        weightedScore >= 60;

      const relaxableFailures = adjustedSignals.filter(
        (signal) => RELAXABLE_FRAMES.has(signal.frame as RelaxableFrame) && !signal.isPassed,
      );
      const severeRelaxableFailure = relaxableFailures.some((signal) => signal.score < 45);
      const mandatoryGate = sajuInsight.isPassed && fourFrameNumberInsight.score >= 35;
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
