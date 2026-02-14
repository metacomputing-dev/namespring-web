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
import { computeSajuRootBalanceScore } from "./evaluator-saju.js";

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
      const sajuRootBalance = computeSajuRootBalanceScore(ctx.sajuBaseDistribution, rootElementDistribution);
      const insight = createInsight(
        "SAJU_JAWON_BALANCE",
        ctx.includeSaju ? sajuRootBalance.score : sajuRootBalance.score,
        sajuRootBalance.isPassed,
        "SAJU+JAWON",
        {
          sajuDistribution: ctx.sajuBaseDistribution,
          rootElementDistribution,
          combinedDistribution: sajuRootBalance.combined,
          birth: ctx.birth,
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
      const weightedScore = weightedSignals.reduce((acc, signal) => acc + signal.score * signal.weight, 0);

      const fourFrameNumberInsight = mustInsight(ctx, "SAGYEOK_SURI");
      const sajuInsight = mustInsight(ctx, "SAJU_JAWON_BALANCE");
      const strokePolarityInsight = mustInsight(ctx, "HOEKSU_EUMYANG");
      const pronunciationElementInsight = mustInsight(ctx, "BALEUM_OHAENG");
      const pronunciationPolarityInsight = mustInsight(ctx, "BALEUM_EUMYANG");
      const fourFrameElementInsight = mustInsight(ctx, "SAGYEOK_OHAENG");

      const rootPassed =
        fourFrameNumberInsight.isPassed &&
        sajuInsight.isPassed &&
        strokePolarityInsight.isPassed &&
        pronunciationElementInsight.isPassed &&
        pronunciationPolarityInsight.isPassed &&
        fourFrameElementInsight.isPassed &&
        weightedScore >= 60;

      const failedFrames = weightedSignals
        .filter((signal) => !signal.isPassed)
        .map((signal) => signal.frame);
      const contributions = Object.fromEntries(
        weightedSignals.map((signal) => [
          signal.frame,
          {
            rawScore: signal.score,
            weight: signal.weight,
            weighted: signal.score * signal.weight,
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
