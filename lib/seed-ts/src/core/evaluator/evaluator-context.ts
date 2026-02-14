import type {
  CalculatorSignal,
  FourFrameCalculator,
  HanjaCalculator,
  HangulCalculator,
} from "../../calculator/index.js";
import { clamp } from "../utils.js";
import type {
  BirthInfo,
  Element,
  Frame,
  FrameInsight,
  Gender,
  LuckyLevel,
  NameInput,
  NameStatistics,
  ResolvedName,
  Status,
} from "../types.js";
import type {
  SajuCalculationInputSummary,
  SajuCalculationOutputSummary,
  SajuDistributionSource,
} from "./saju-distribution-resolver.js";

export const SIGNAL_WEIGHT_MAJOR = 0.2;
export const SIGNAL_WEIGHT_MINOR = 0.15;
/** @deprecated Use SIGNAL_WEIGHT_MAJOR */
export const W_MAJOR = SIGNAL_WEIGHT_MAJOR;
/** @deprecated Use SIGNAL_WEIGHT_MINOR */
export const W_MINOR = SIGNAL_WEIGHT_MINOR;

export const ELEMENT_KEYS: Element[] = ["\u6728", "\u706B", "\u571F", "\u91D1", "\u6C34"];

export interface EvaluationPipelineContext {
  name: NameInput;
  resolved: ResolvedName;
  surnameLength: number;
  givenLength: number;
  includeSaju: boolean;
  birth?: BirthInfo;
  gender?: Gender;
  luckyMap: Map<number, LuckyLevel>;
  sajuDistribution: Record<Element, number>;
  sajuDistributionSource: SajuDistributionSource;
  sajuInput: SajuCalculationInputSummary | null;
  sajuOutput: SajuCalculationOutputSummary | null;
  sajuCalculationError: string | null;
  stats: NameStatistics | null;
  fourFrameCalculator: FourFrameCalculator;
  hanjaCalculator: HanjaCalculator;
  hangulCalculator: HangulCalculator;
  insights: Partial<Record<Frame, FrameInsight>>;
}

function statusFromPass(pass: boolean): Status {
  return pass ? "POSITIVE" : "NEGATIVE";
}

export function createInsight(
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

export function setInsight(ctx: EvaluationPipelineContext, insight: FrameInsight): void {
  ctx.insights[insight.frame] = insight;
}

export function mustInsight(ctx: EvaluationPipelineContext, frame: Frame): FrameInsight {
  const insight = ctx.insights[frame];
  if (!insight) {
    throw new Error(`missing insight for frame: ${frame}`);
  }
  return insight;
}

export function createSignal(frame: Frame, insight: FrameInsight, weight: number): CalculatorSignal {
  return {
    key: frame,
    frame,
    score: insight.score,
    isPassed: insight.isPassed,
    weight,
  };
}

export function distributionFromArrangement(arrangement: readonly Element[]): Record<Element, number> {
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

export const SAJU_FALLBACK_DISTRIBUTION: readonly number[] = [3, 1, 2, 0, 2];

export function createSajuBaseDistribution(
  sajuBaseDistribution?: Partial<Record<Element, number>>,
): Record<Element, number> {
  return {
    "\u6728": sajuBaseDistribution?.["\u6728"] ?? SAJU_FALLBACK_DISTRIBUTION[0]!,
    "\u706B": sajuBaseDistribution?.["\u706B"] ?? SAJU_FALLBACK_DISTRIBUTION[1]!,
    "\u571F": sajuBaseDistribution?.["\u571F"] ?? SAJU_FALLBACK_DISTRIBUTION[2]!,
    "\u91D1": sajuBaseDistribution?.["\u91D1"] ?? SAJU_FALLBACK_DISTRIBUTION[3]!,
    "\u6C34": sajuBaseDistribution?.["\u6C34"] ?? SAJU_FALLBACK_DISTRIBUTION[4]!,
  };
}
