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
    this.sajuBaseDistribution = createSajuBaseDistribution(sajuBaseDistribution);
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

    executeCalculatorNode(createRootNode(), ctx);

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
