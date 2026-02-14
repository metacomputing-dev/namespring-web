import { FourFrameCalculator, HanjaCalculator, HangulCalculator } from "../calculator/index.js";
import {
  DEFAULT_POLARITY_BY_BIT,
  ELEMENT_INDEX,
} from "./constants.js";
import { executeEvaluationNode, flattenSignals, type EvaluationNode, type EvaluationSignal } from "./evaluation-node.js";
import type {
  BirthInfo,
  Element,
  Frame,
  FrameInsight,
  LuckyLevel,
  NameInput,
  NameStatistics,
  Polarity,
  ResolvedName,
  SeedResponse,
  StatsRepository,
  Status,
} from "./types.js";
import { clamp } from "./utils.js";

const W_MAJOR = 0.2;
const W_MINOR = 0.15;

const FORTUNE_TOP = "\uCD5C\uC0C1\uC6B4\uC218";
const FORTUNE_HIGH = "\uC0C1\uC6B4\uC218";
const FORTUNE_GOOD = "\uC591\uC6B4\uC218";
const FORTUNE_WORST = "\uCD5C\uD749\uC6B4\uC218";
const FORTUNE_BAD = "\uD749\uC6B4\uC218";

const ELEMENT_KEYS: Element[] = ["\u6728", "\u706B", "\u571F", "\u91D1", "\u6C34"];

interface SajuContext {
  sajuDistribution: Record<Element, number>;
}

interface EvaluationPipelineContext {
  name: NameInput;
  resolved: ResolvedName;
  surnameLength: number;
  givenLength: number;
  includeSaju: boolean;
  birth?: BirthInfo;
  luckyMap: Map<number, LuckyLevel>;
  sajuBaseDistribution: Record<Element, number>;
  stats: NameStatistics | null;
  fourFrameCalculator: FourFrameCalculator;
  hanjaCalculator: HanjaCalculator;
  hangulCalculator: HangulCalculator;
  insights: Partial<Record<Frame, FrameInsight>>;
}

function statusFromPass(pass: boolean): Status {
  return pass ? "POSITIVE" : "NEGATIVE";
}

function createInsight(
  frame: Frame,
  score: number,
  isPassed: boolean,
  arrangement: string,
  details: Record<string, unknown> = {},
): FrameInsight {
  const normalizedScore = Math.trunc(clamp(score, 0, 100));
  return {
    frame,
    score: normalizedScore,
    isPassed,
    status: statusFromPass(isPassed),
    arrangement,
    details,
  };
}

function setInsight(ctx: EvaluationPipelineContext, insight: FrameInsight): void {
  ctx.insights[insight.frame] = insight;
}

function mustInsight(ctx: EvaluationPipelineContext, frame: Frame): FrameInsight {
  const insight = ctx.insights[frame];
  if (!insight) {
    throw new Error(`missing insight for frame: ${frame}`);
  }
  return insight;
}

function createSignal(frame: Frame, insight: FrameInsight, weight: number): EvaluationSignal {
  return {
    key: frame,
    frame,
    score: insight.score,
    isPassed: insight.isPassed,
    weight,
  };
}

function distributionFromArrangement(arrangement: readonly Element[]): Record<Element, number> {
  const out: Record<Element, number> = {
    "\u6728": 0,
    "\u706B": 0,
    "\u571F": 0,
    "\u91D1": 0,
    "\u6C34": 0,
  };
  for (const value of arrangement) {
    out[value] += 1;
  }
  return out;
}

export function isSangSaeng(first: Element, second: Element): boolean {
  return (ELEMENT_INDEX[first] + 1) % 5 === ELEMENT_INDEX[second];
}

export function isSangGeuk(first: Element, second: Element): boolean {
  const a = ELEMENT_INDEX[first];
  const b = ELEMENT_INDEX[second];
  return (a + 2) % 5 === b || (b + 2) % 5 === a;
}

export function calculateArrayScore(arrangement: readonly Element[], surnameLength = 1): number {
  if (arrangement.length < 2) {
    return 100;
  }
  let sangSaeng = 0;
  let sangGeuk = 0;
  let same = 0;
  for (let i = 0; i < arrangement.length - 1; i += 1) {
    if (surnameLength === 2 && i === 0) {
      continue;
    }
    const a = arrangement[i] as Element;
    const b = arrangement[i + 1] as Element;
    if (isSangSaeng(a, b)) {
      sangSaeng += 1;
    } else if (isSangGeuk(a, b)) {
      sangGeuk += 1;
    } else if (a === b) {
      same += 1;
    }
  }
  return clamp(70 + sangSaeng * 15 - sangGeuk * 20 - same * 5, 0, 100);
}

export function calculateBalanceScore(distribution: Readonly<Record<Element, number>>): number {
  const total = ELEMENT_KEYS.reduce((acc, key) => acc + (distribution[key] ?? 0), 0);
  if (total === 0) {
    return 0;
  }
  const avg = total / 5;
  let deviation = 0;
  for (const key of ELEMENT_KEYS) {
    deviation += Math.abs((distribution[key] ?? 0) - avg);
  }
  if (deviation <= 2) return 100;
  if (deviation <= 4) return 85;
  if (deviation <= 6) return 70;
  if (deviation <= 8) return 55;
  if (deviation <= 10) return 40;
  return 25;
}

export function checkPolarityHarmony(arrangement: readonly Polarity[], surnameLength: number): boolean {
  if (arrangement.length < 2) {
    return true;
  }
  const eum = arrangement.filter((value) => value === "\u9670").length;
  const yang = arrangement.length - eum;
  if (eum === 0 || yang === 0) {
    return false;
  }
  if (surnameLength === 1 && arrangement[0] === arrangement[arrangement.length - 1]) {
    return false;
  }
  return true;
}

export function checkElementSangSaeng(arrangement: readonly Element[], surnameLength: number): boolean {
  if (arrangement.length < 2) {
    return true;
  }

  const startIdx = surnameLength === 2 ? 1 : 0;
  for (let i = startIdx; i < arrangement.length - 1; i += 1) {
    if (isSangGeuk(arrangement[i] as Element, arrangement[i + 1] as Element)) {
      return false;
    }
  }

  const consecutiveStart = surnameLength === 2 ? 2 : 1;
  let consecutive = 1;
  for (let i = consecutiveStart; i < arrangement.length; i += 1) {
    if (arrangement[i] === arrangement[i - 1]) {
      consecutive += 1;
      if (consecutive >= 3) {
        return false;
      }
    } else {
      consecutive = 1;
    }
  }

  if (!(surnameLength === 2 && arrangement.length === 3)) {
    if (isSangGeuk(arrangement[0] as Element, arrangement[arrangement.length - 1] as Element)) {
      return false;
    }
  }

  let relationCount = 0;
  let sangSaengCount = 0;
  for (let i = 0; i < arrangement.length - 1; i += 1) {
    if (surnameLength === 2 && i === 0) {
      continue;
    }
    const a = arrangement[i] as Element;
    const b = arrangement[i + 1] as Element;
    if (a === b) {
      continue;
    }
    relationCount += 1;
    if (isSangSaeng(a, b)) {
      sangSaengCount += 1;
    }
  }

  if (relationCount > 0 && sangSaengCount / relationCount < 0.6) {
    return false;
  }
  return true;
}

export function checkFourFrameSuriElement(arrangement: readonly Element[], givenNameLength: number): boolean {
  const checked =
    givenNameLength === 1 && arrangement.length === 3
      ? arrangement.slice(0, 2)
      : arrangement.slice();
  if (checked.length < 2) {
    return false;
  }
  for (let i = 0; i < checked.length - 1; i += 1) {
    if (isSangGeuk(checked[i] as Element, checked[i + 1] as Element)) {
      return false;
    }
  }
  if (isSangGeuk(checked[checked.length - 1] as Element, checked[0] as Element)) {
    return false;
  }
  return new Set(checked).size > 1;
}

function bucketFromFortune(fortune: string): number {
  const f = fortune ?? "";
  if (f.includes(FORTUNE_TOP) || f.includes("\uCD5C\uC0C1")) return 25;
  if (f.includes(FORTUNE_HIGH) || f.includes("\uC0C1")) return 20;
  if (f.includes(FORTUNE_GOOD) || f.includes("\uC591")) return 15;
  if (f.includes(FORTUNE_WORST) || f.includes("\uCD5C\uD749")) return 0;
  if (f.includes(FORTUNE_BAD) || f.includes("\uD749")) return 5;
  return 10;
}

function levelToFortune(level: LuckyLevel): string {
  return level;
}

function computeSajuRootBalanceScore(
  sajuDistribution: Record<Element, number>,
  rootElementDistribution: Record<Element, number>,
): { score: number; isPassed: boolean; combined: Record<Element, number> } {
  const initial = ELEMENT_KEYS.map((key) => sajuDistribution[key] ?? 0);
  const rootElementCounts = ELEMENT_KEYS.map((key) => rootElementDistribution[key] ?? 0);
  const finalArr = ELEMENT_KEYS.map((_, idx) => initial[idx] + rootElementCounts[idx]);
  const r = rootElementCounts.reduce((a, b) => a + b, 0);

  const delta = finalArr.map((value, idx) => value - initial[idx]);
  if (delta.some((value) => value < 0)) {
    return {
      score: 0,
      isPassed: false,
      combined: distributionFromArrangement([]),
    };
  }
  if (delta.reduce((a, b) => a + b, 0) !== r) {
    return {
      score: 0,
      isPassed: false,
      combined: distributionFromArrangement([]),
    };
  }

  const optimal = computeOptimalSorted(initial, r);
  const finalSorted = [...finalArr].sort((a, b) => a - b);
  const isOptimal = finalSorted.every((value, idx) => value === optimal[idx]);
  const finalZero = finalArr.filter((value) => value === 0).length;
  const optZero = optimal.filter((value) => value === 0).length;
  const spread = spreadOf(finalArr);
  const optSpread = spreadOf(optimal);
  const l1 = finalSorted.reduce((acc, value, idx) => acc + Math.abs(value - optimal[idx]), 0);
  const moves = Math.floor(l1 / 2);

  let score = 0;
  if (r === 0 && finalArr.every((value, idx) => value === initial[idx])) {
    score = 100;
  } else if (isOptimal) {
    score = 100;
  } else {
    score = 100 - 20 * moves - 10 * Math.max(0, finalZero - optZero) - 5 * Math.max(0, spread - optSpread);
    score = clamp(score, 0, 100);
  }

  const isPassed = isOptimal || (finalZero <= optZero && spread <= optSpread && score >= 70);
  const combined: Record<Element, number> = {
    "\u6728": finalArr[0] ?? 0,
    "\u706B": finalArr[1] ?? 0,
    "\u571F": finalArr[2] ?? 0,
    "\u91D1": finalArr[3] ?? 0,
    "\u6C34": finalArr[4] ?? 0,
  };

  return { score, isPassed, combined };
}

function computeOptimalSorted(initial: number[], resourceCount: number): number[] {
  const s = [...initial].sort((a, b) => a - b);
  let rem = resourceCount;
  let i = 0;
  while (i < 4 && rem > 0) {
    const curr = s[i] ?? 0;
    const next = s[i + 1] ?? curr;
    const width = i + 1;
    const diff = next - curr;
    if (diff === 0) {
      i += 1;
      continue;
    }
    const cost = diff * width;
    if (rem >= cost) {
      for (let k = 0; k <= i; k += 1) {
        s[k] = (s[k] ?? 0) + diff;
      }
      rem -= cost;
      i += 1;
    } else {
      const q = Math.floor(rem / width);
      const r = rem % width;
      for (let k = 0; k <= i; k += 1) {
        s[k] = (s[k] ?? 0) + q;
      }
      for (let k = 0; k < r; k += 1) {
        s[k] = (s[k] ?? 0) + 1;
      }
      rem = 0;
    }
  }
  if (rem > 0) {
    const q = Math.floor(rem / 5);
    const r = rem % 5;
    for (let k = 0; k < 5; k += 1) {
      s[k] = (s[k] ?? 0) + q;
    }
    for (let k = 0; k < r; k += 1) {
      s[k] = (s[k] ?? 0) + 1;
    }
  }
  return s;
}

function spreadOf(values: number[]): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max - min;
}

function countDominant(distribution: Record<Element, number>): boolean {
  const total = ELEMENT_KEYS.reduce((acc, key) => acc + distribution[key], 0);
  const threshold = Math.floor(total / 2) + 1;
  return ELEMENT_KEYS.some((key) => distribution[key] >= threshold);
}

function bitToPolarity(value: number): Polarity {
  return DEFAULT_POLARITY_BY_BIT[(Math.abs(value) % 2) as 0 | 1];
}

function polarityScore(eumCount: number, yangCount: number): number {
  const total = Math.max(0, eumCount + yangCount);
  if (total === 0) {
    return 0;
  }
  const minSide = Math.min(eumCount, yangCount);
  const ratio = minSide / total;
  const ratioScore = ratio >= 0.4 ? 50 : ratio >= 0.3 ? 35 : ratio >= 0.2 ? 20 : 10;
  return 40 + ratioScore;
}

function createFourFrameNumberNode(): EvaluationNode<EvaluationPipelineContext> {
  return {
    id: "four-frame-number",
    forward(ctx): void {
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
    backward(ctx): { nodeId: string; signals: EvaluationSignal[] } {
      const insight = mustInsight(ctx, "SAGYEOK_SURI");
      return {
        nodeId: "four-frame-number",
        signals: [createSignal("SAGYEOK_SURI", insight, W_MAJOR)],
      };
    },
  };
}

function createStrokeElementNode(): EvaluationNode<EvaluationPipelineContext> {
  return {
    id: "stroke-element",
    forward(ctx): void {
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
    backward(): { nodeId: string; signals: EvaluationSignal[] } {
      return {
        nodeId: "stroke-element",
        signals: [],
      };
    },
  };
}

function createFourFrameElementNode(): EvaluationNode<EvaluationPipelineContext> {
  return {
    id: "four-frame-element",
    forward(ctx): void {
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
    backward(ctx): { nodeId: string; signals: EvaluationSignal[] } {
      const insight = mustInsight(ctx, "SAGYEOK_OHAENG");
      return {
        nodeId: "four-frame-element",
        signals: [createSignal("SAGYEOK_OHAENG", insight, W_MINOR)],
      };
    },
  };
}

function createPronunciationElementNode(): EvaluationNode<EvaluationPipelineContext> {
  return {
    id: "pronunciation-element",
    forward(ctx): void {
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
    backward(ctx): { nodeId: string; signals: EvaluationSignal[] } {
      const insight = mustInsight(ctx, "BALEUM_OHAENG");
      return {
        nodeId: "pronunciation-element",
        signals: [createSignal("BALEUM_OHAENG", insight, W_MINOR)],
      };
    },
  };
}

function createStrokePolarityNode(): EvaluationNode<EvaluationPipelineContext> {
  return {
    id: "stroke-polarity",
    forward(ctx): void {
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
    backward(ctx): { nodeId: string; signals: EvaluationSignal[] } {
      const insight = mustInsight(ctx, "HOEKSU_EUMYANG");
      return {
        nodeId: "stroke-polarity",
        signals: [createSignal("HOEKSU_EUMYANG", insight, W_MINOR)],
      };
    },
  };
}

function createPronunciationPolarityNode(): EvaluationNode<EvaluationPipelineContext> {
  return {
    id: "pronunciation-polarity",
    forward(ctx): void {
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
    backward(ctx): { nodeId: string; signals: EvaluationSignal[] } {
      const insight = mustInsight(ctx, "BALEUM_EUMYANG");
      return {
        nodeId: "pronunciation-polarity",
        signals: [createSignal("BALEUM_EUMYANG", insight, W_MINOR)],
      };
    },
  };
}

function createSajuBalanceNode(): EvaluationNode<EvaluationPipelineContext> {
  return {
    id: "saju-balance",
    forward(ctx): void {
      const rootElementArrangement = ctx.resolved.given.map((entry) => entry.rootElement);
      const rootElementDistribution = distributionFromArrangement(rootElementArrangement);
      const sajuCtx: SajuContext = {
        sajuDistribution: ctx.sajuBaseDistribution,
      };
      const sajuRootBalance = computeSajuRootBalanceScore(sajuCtx.sajuDistribution, rootElementDistribution);
      const insight = createInsight(
        "SAJU_JAWON_BALANCE",
        ctx.includeSaju ? sajuRootBalance.score : sajuRootBalance.score,
        sajuRootBalance.isPassed,
        "SAJU+JAWON",
        {
          sajuDistribution: sajuCtx.sajuDistribution,
          rootElementDistribution,
          combinedDistribution: sajuRootBalance.combined,
          birth: ctx.birth,
        },
      );
      setInsight(ctx, insight);
    },
    backward(ctx): { nodeId: string; signals: EvaluationSignal[] } {
      const insight = mustInsight(ctx, "SAJU_JAWON_BALANCE");
      return {
        nodeId: "saju-balance",
        signals: [createSignal("SAJU_JAWON_BALANCE", insight, W_MAJOR)],
      };
    },
  };
}

function createStatisticsNode(): EvaluationNode<EvaluationPipelineContext> {
  return {
    id: "statistics",
    forward(ctx): void {
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
    backward(): { nodeId: string; signals: EvaluationSignal[] } {
      return {
        nodeId: "statistics",
        signals: [],
      };
    },
  };
}

function createRootNode(): EvaluationNode<EvaluationPipelineContext> {
  return {
    id: "root",
    createChildren(): EvaluationNode<EvaluationPipelineContext>[] {
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
    backward(ctx, childPackets): { nodeId: string; signals: EvaluationSignal[] } {
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

export class NameEvaluator {
  private readonly luckyMap: Map<number, LuckyLevel>;
  private readonly statsRepository: StatsRepository | null;
  private readonly includeSajuDefault: boolean;
  private readonly sajuBaseDistribution: Record<Element, number>;

  constructor(
    luckyMap: Map<number, LuckyLevel>,
    statsRepository: StatsRepository | null,
    includeSajuDefault: boolean,
    sajuBaseDistribution?: Partial<Record<Element, number>>,
  ) {
    this.luckyMap = luckyMap;
    this.statsRepository = statsRepository;
    this.includeSajuDefault = includeSajuDefault;
    this.sajuBaseDistribution = {
      "\u6728": sajuBaseDistribution?.["\u6728"] ?? 3,
      "\u706B": sajuBaseDistribution?.["\u706B"] ?? 1,
      "\u571F": sajuBaseDistribution?.["\u571F"] ?? 2,
      "\u91D1": sajuBaseDistribution?.["\u91D1"] ?? 0,
      "\u6C34": sajuBaseDistribution?.["\u6C34"] ?? 2,
    };
  }

  evaluate(name: NameInput, resolved: ResolvedName, birth?: BirthInfo, includeSaju?: boolean): SeedResponse {
    const fourFrameCalculator = new FourFrameCalculator(resolved.surname, resolved.given);
    const hanjaCalculator = new HanjaCalculator(resolved.surname, resolved.given);
    const hangulCalculator = new HangulCalculator(resolved.surname, resolved.given);
    fourFrameCalculator.calculate();
    hanjaCalculator.calculate();
    hangulCalculator.calculate();

    const stats = this.statsRepository?.findByName(name.firstNameHangul) ?? null;
    const ctx: EvaluationPipelineContext = {
      name,
      resolved,
      surnameLength: resolved.surname.length,
      givenLength: resolved.given.length,
      includeSaju: includeSaju ?? this.includeSajuDefault,
      birth,
      luckyMap: this.luckyMap,
      sajuBaseDistribution: this.sajuBaseDistribution,
      stats,
      fourFrameCalculator,
      hanjaCalculator,
      hangulCalculator,
      insights: {},
    };

    executeEvaluationNode(createRootNode(), ctx);

    const seongmyeonghak = mustInsight(ctx, "SEONGMYEONGHAK");
    const fourFrameNumberInsight = mustInsight(ctx, "SAGYEOK_SURI");
    const sajuInsight = mustInsight(ctx, "SAJU_JAWON_BALANCE");
    const strokePolarityInsight = mustInsight(ctx, "HOEKSU_EUMYANG");
    const pronunciationElementInsight = mustInsight(ctx, "BALEUM_OHAENG");
    const pronunciationPolarityInsight = mustInsight(ctx, "BALEUM_EUMYANG");
    const fourFrameElementInsight = mustInsight(ctx, "SAGYEOK_OHAENG");
    const strokeElementInsight = mustInsight(ctx, "HOEKSU_OHAENG");
    const statistics = mustInsight(ctx, "STATISTICS");

    const categoryMap: Record<Frame, FrameInsight> = {
      SEONGMYEONGHAK: seongmyeonghak,
      SAGYEOK_SURI: fourFrameNumberInsight,
      SAGYEOK_OHAENG: fourFrameElementInsight,
      HOEKSU_OHAENG: strokeElementInsight,
      HOEKSU_EUMYANG: strokePolarityInsight,
      BALEUM_OHAENG: pronunciationElementInsight,
      BALEUM_EUMYANG: pronunciationPolarityInsight,
      SAJU_JAWON_BALANCE: sajuInsight,
      STATISTICS: statistics,
      JAWON_OHAENG: strokeElementInsight,
      EUMYANG: strokePolarityInsight,
    };

    const orderedCategories: FrameInsight[] = [
      seongmyeonghak,
      fourFrameNumberInsight,
      sajuInsight,
      strokePolarityInsight,
      pronunciationElementInsight,
      pronunciationPolarityInsight,
      fourFrameElementInsight,
    ];

    return {
      name,
      interpretation: {
        score: seongmyeonghak.score,
        isPassed: seongmyeonghak.isPassed,
        status: seongmyeonghak.status,
        categories: orderedCategories,
      },
      categoryMap,
      statistics: stats,
    };
  }
}

export function buildInterpretationText(response: SeedResponse): string {
  const c = response.categoryMap;
  return [
    `SAGYEOK_SURI:${c.SAGYEOK_SURI.score}/${c.SAGYEOK_SURI.isPassed ? "Y" : "N"}`,
    `SAJU_JAWON_BALANCE:${c.SAJU_JAWON_BALANCE.score}/${c.SAJU_JAWON_BALANCE.isPassed ? "Y" : "N"}`,
    `HOEKSU_EUMYANG:${c.HOEKSU_EUMYANG.score}/${c.HOEKSU_EUMYANG.isPassed ? "Y" : "N"}`,
    `BALEUM_OHAENG:${c.BALEUM_OHAENG.score}/${c.BALEUM_OHAENG.isPassed ? "Y" : "N"}`,
    `BALEUM_EUMYANG:${c.BALEUM_EUMYANG.score}/${c.BALEUM_EUMYANG.isPassed ? "Y" : "N"}`,
    `SAGYEOK_OHAENG:${c.SAGYEOK_OHAENG.score}/${c.SAGYEOK_OHAENG.isPassed ? "Y" : "N"}`,
  ].join(" | ");
}

export function sortResponsesByScore(items: SeedResponse[]): SeedResponse[] {
  return items.sort((a, b) => b.interpretation.score - a.interpretation.score);
}
