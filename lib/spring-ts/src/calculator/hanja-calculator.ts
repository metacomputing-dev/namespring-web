import { HanjaCalculator as SeedHanjaCalculator } from '../../../seed-ts/src/calculator/hanja-calculator.js';
import type { HanjaEntry } from '../../../seed-ts/src/database/hanja-repository.js';
import type { HanjaAnalysis } from '../core/model-types.js';
import type { AnalysisDetail, CalculatorPacket, EvalContext, EvaluableCalculator } from '../core/evaluator.js';
import { putInsight, createSignal } from '../core/evaluator.js';
import { type ElementKey, type PolarityValue, distributionFromArrangement, calculateArrayScore, calculateBalanceScore, computePolarityResult } from '../core/scoring.js';
import scoringRules from '../../config/scoring-rules.json';

const STROKE_POLARITY_SIGNAL_WEIGHT = scoringRules.strokePolarity.signalWeight;

export class HanjaCalculator extends SeedHanjaCalculator implements EvaluableCalculator {
  readonly id = 'hanja';

  constructor(surnameEntries: HanjaEntry[], givenNameEntries: HanjaEntry[]) {
    super(surnameEntries, givenNameEntries);
  }

  visit(ctx: EvalContext): void {
    this.calculate();

    const blocks = this.getNameBlocks();
    const elementArrangement = blocks
      .map((block) => block.entry.stroke_element as ElementKey)
      .filter((element): element is ElementKey => !!element);

    const elementDistribution = distributionFromArrangement(elementArrangement);
    const adjacencyScore = calculateArrayScore(elementArrangement, ctx.surnameLength);
    const balanceScore = calculateBalanceScore(elementDistribution);
    this.elementScore = (balanceScore + adjacencyScore) / 2;

    putInsight(
      ctx,
      'STROKE_ELEMENT',
      this.elementScore,
      balanceScore >= 60,
      elementArrangement.join('-'),
      { distribution: elementDistribution, adjacencyScore, balanceScore },
    );

    const polarityArrangement = blocks
      .map((block) => block.energy?.polarity.english as PolarityValue)
      .filter((polarity): polarity is PolarityValue => !!polarity);

    const polarityResult = computePolarityResult(polarityArrangement, ctx.surnameLength);
    this.polarityScore = polarityResult.score;

    putInsight(
      ctx,
      'STROKE_POLARITY',
      polarityResult.score,
      polarityResult.isPassed,
      polarityArrangement.join(''),
      { arrangementList: polarityArrangement },
    );
  }

  backward(ctx: EvalContext): CalculatorPacket {
    return {
      signals: [
        createSignal('STROKE_POLARITY', ctx, STROKE_POLARITY_SIGNAL_WEIGHT),
      ],
    };
  }

  getAnalysis(): AnalysisDetail<HanjaAnalysis> {
    return {
      type: this.id,
      score: this.getScore(),
      polarityScore: this.polarityScore,
      elementScore: this.elementScore,
      data: {
        blocks: this.getNameBlocks().map((block) => ({
          hanja: block.entry.hanja,
          hangul: block.entry.hangul,
          strokes: block.entry.strokes,
          resourceElement: block.entry.resource_element,
          strokeElement: block.entry.stroke_element,
          polarity: block.energy?.polarity.english ?? '',
        })),
        polarityScore: this.polarityScore,
        elementScore: this.elementScore,
      },
    };
  }
}

