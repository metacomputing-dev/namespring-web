import {
  FourFrameCalculator,
  HanjaCalculator,
  HangulCalculator,
  executeCalculatorNode,
} from "../../calculator/index.js";
import type {
  BirthInfo,
  Element,
  Frame,
  FrameInsight,
  Gender,
  LuckyLevel,
  NameInput,
  ResolvedName,
  SeedResponse,
  StatsRepository,
} from "../types.js";
import {
  createSajuBaseDistribution,
  mustInsight,
  type EvaluationPipelineContext,
} from "./evaluator-context.js";
import { createRootNode } from "./evaluator-nodes.js";
import {
  resolveSajuDistribution,
  type SajuDistributionResolution,
} from "./saju-distribution-resolver.js";

const UNIQUE_FRAMES: Frame[] = [
  "SEONGMYEONGHAK", "SAGYEOK_SURI", "SAJU_JAWON_BALANCE",
  "HOEKSU_EUMYANG", "BALEUM_OHAENG", "BALEUM_EUMYANG",
  "SAGYEOK_OHAENG", "HOEKSU_OHAENG", "STATISTICS",
];

const FRAME_ALIASES: [Frame, Frame][] = [
  ["JAWON_OHAENG", "HOEKSU_OHAENG"],
  ["EUMYANG", "HOEKSU_EUMYANG"],
];

const ORDERED_FRAMES: Frame[] = [
  "SEONGMYEONGHAK", "SAGYEOK_SURI", "SAJU_JAWON_BALANCE",
  "HOEKSU_EUMYANG", "BALEUM_OHAENG", "BALEUM_EUMYANG", "SAGYEOK_OHAENG",
];

function buildBirthCacheKey(birth: BirthInfo | undefined, gender: Gender | undefined): string | null {
  if (!birth) {
    return null;
  }
  const normalizedGender = (gender ?? "NONE").toUpperCase();
  return `${birth.year}-${birth.month}-${birth.day}-${birth.hour}-${birth.minute}|${normalizedGender}`;
}

export class NameEvaluator {
  private readonly luckyMap: Map<number, LuckyLevel>;
  private readonly statsRepository: StatsRepository | null;
  private readonly sajuFallbackDistribution: Record<Element, number>;
  private readonly sajuDistributionCache = new Map<string, SajuDistributionResolution>();

  constructor(
    luckyMap: Map<number, LuckyLevel>,
    statsRepository: StatsRepository | null,
    _includeSajuDefault: boolean,
    sajuBaseDistribution?: Partial<Record<Element, number>>,
  ) {
    this.luckyMap = luckyMap;
    this.statsRepository = statsRepository;
    this.sajuFallbackDistribution = createSajuBaseDistribution(sajuBaseDistribution);
  }

  private resolveSajuDistribution(birth?: BirthInfo, gender?: Gender): SajuDistributionResolution {
    const cacheKey = buildBirthCacheKey(birth, gender);
    if (!cacheKey) {
      return resolveSajuDistribution(birth, gender, this.sajuFallbackDistribution);
    }

    const cached = this.sajuDistributionCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const resolved = resolveSajuDistribution(birth, gender, this.sajuFallbackDistribution);
    this.sajuDistributionCache.set(cacheKey, resolved);
    return resolved;
  }

  evaluate(
    name: NameInput,
    resolved: ResolvedName,
    birth?: BirthInfo,
    _includeSaju?: boolean,
    gender?: Gender,
  ): SeedResponse {
    const fourFrameCalculator = new FourFrameCalculator(resolved.surname, resolved.given);
    const hanjaCalculator = new HanjaCalculator(resolved.surname, resolved.given);
    const hangulCalculator = new HangulCalculator(resolved.surname, resolved.given);
    fourFrameCalculator.calculate();
    hanjaCalculator.calculate();
    hangulCalculator.calculate();

    const sajuResolution = this.resolveSajuDistribution(birth, gender);
    const stats = this.statsRepository?.findByName(name.firstNameHangul) ?? null;
    const ctx: EvaluationPipelineContext = {
      name,
      resolved,
      surnameLength: resolved.surname.length,
      givenLength: resolved.given.length,
      includeSaju: true,
      birth,
      gender,
      luckyMap: this.luckyMap,
      sajuDistribution: sajuResolution.distribution,
      sajuDistributionSource: sajuResolution.source,
      sajuInput: sajuResolution.input,
      sajuOutput: sajuResolution.output,
      sajuCalculationError: sajuResolution.error,
      stats,
      fourFrameCalculator,
      hanjaCalculator,
      hangulCalculator,
      insights: {},
    };

    executeCalculatorNode(createRootNode(), ctx);

    const categoryMap = Object.fromEntries(
      UNIQUE_FRAMES.map((frame) => [frame, mustInsight(ctx, frame)]),
    ) as Record<Frame, FrameInsight>;
    for (const [alias, target] of FRAME_ALIASES) {
      categoryMap[alias] = categoryMap[target];
    }

    const seongmyeonghak = categoryMap.SEONGMYEONGHAK;
    const orderedCategories = ORDERED_FRAMES.map((frame) => categoryMap[frame]);

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
