import { FourFrameCalculator } from '../calculator/frame-calculator.js';
import { HangulCalculator } from '../calculator/hangul-calculator.js';
import { HanjaCalculator } from '../calculator/hanja-calculator.js';
import { executeCalculatorNode } from '../calculator/calculator-graph.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { ElementKey } from './element-cycle.js';
import { emptyDistribution, ELEMENT_KEYS } from './element-cycle.js';
import type { SajuOutputSummary } from './strength-scorer.js';
import {
  type EvalFrame,
  type EvaluationPipelineContext,
  type FrameInsight,
  mustInsight,
} from './evaluator-context.js';
import { createRootNode } from './evaluator-nodes.js';

/** Ordered frames for the categories array in the response */
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

export interface EvaluationResult {
  /** 성명학 종합 점수 (0-100) */
  score: number;
  /** 합격 여부 */
  isPassed: boolean;
  /** 상태 문자열 */
  status: 'POSITIVE' | 'NEGATIVE';
  /** 프레임별 상세 인사이트 */
  categoryMap: Record<string, FrameInsight>;
  /** 정렬된 카테고리 배열 */
  categories: FrameInsight[];
}

export class NameEvaluator {
  private readonly luckyMap: Map<number, string>;
  private readonly sajuFallbackDistribution: Record<ElementKey, number>;

  constructor(
    luckyMap: Map<number, string>,
    sajuBaseDistribution?: Partial<Record<ElementKey, number>>,
  ) {
    this.luckyMap = luckyMap;
    this.sajuFallbackDistribution = createSajuBaseDistribution(sajuBaseDistribution);
  }

  evaluate(
    surnameEntries: HanjaEntry[],
    givenNameEntries: HanjaEntry[],
    sajuDistribution?: Record<ElementKey, number>,
    sajuOutput?: SajuOutputSummary | null,
  ): EvaluationResult {
    const fourFrameCalculator = new FourFrameCalculator(surnameEntries, givenNameEntries);
    const hanjaCalculator = new HanjaCalculator(surnameEntries, givenNameEntries);
    const hangulCalculator = new HangulCalculator(surnameEntries, givenNameEntries);
    fourFrameCalculator.calculate();
    hanjaCalculator.calculate();
    hangulCalculator.calculate();

    const ctx: EvaluationPipelineContext = {
      surnameLength: surnameEntries.length,
      givenLength: givenNameEntries.length,
      luckyMap: this.luckyMap,
      sajuDistribution: sajuDistribution ?? this.sajuFallbackDistribution,
      sajuDistributionSource: sajuDistribution ? 'saju-ts' : 'fallback',
      sajuOutput: sajuOutput ?? null,
      fourFrameCalculator,
      hanjaCalculator,
      hangulCalculator,
      insights: {},
    };

    executeCalculatorNode(createRootNode(), ctx);

    const categoryMap: Record<string, FrameInsight> = {};
    for (const frame of UNIQUE_FRAMES) {
      categoryMap[frame] = mustInsight(ctx, frame);
    }
    for (const [alias, target] of FRAME_ALIASES) {
      categoryMap[alias] = categoryMap[target];
    }

    const seongmyeonghak = categoryMap.SEONGMYEONGHAK;
    const categories = ORDERED_FRAMES.map(frame => categoryMap[frame]);

    return {
      score: seongmyeonghak.score,
      isPassed: seongmyeonghak.isPassed,
      status: seongmyeonghak.isPassed ? 'POSITIVE' : 'NEGATIVE',
      categoryMap,
      categories,
    };
  }
}

function createSajuBaseDistribution(
  partial?: Partial<Record<ElementKey, number>>,
): Record<ElementKey, number> {
  const dist = emptyDistribution();
  if (partial) {
    for (const key of ELEMENT_KEYS) {
      if (partial[key] !== undefined) dist[key] = partial[key]!;
    }
  }
  return dist;
}
