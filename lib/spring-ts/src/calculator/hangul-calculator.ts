import { HangulCalculator as SeedHangulCalculator } from '../../../seed-ts/src/calculator/hangul-calculator.js';
import type { HanjaEntry } from '../../../seed-ts/src/database/hanja-repository.js';
import type { HangulAnalysis } from '../core/model-types.js';
import type { AnalysisDetail, CalculatorPacket, EvalContext, EvaluableCalculator } from '../core/evaluator.js';
import { putInsight, createSignal } from '../core/evaluator.js';
import {
  type ElementKey, type PolarityValue,
  distributionFromArrangement, calculateArrayScore, calculateBalanceScore,
  checkElementGenerating, countDominant, computePolarityResult,
} from '../core/scoring.js';
import scoringRules from '../../config/scoring-rules.json';

const elementRules = scoringRules.hangulElement;
const polarityRules = scoringRules.hangulPolarity;

const DOUBLE_SURNAME_ADJACENCY_THRESHOLD = elementRules.doubleSurnameThreshold;
const SINGLE_SURNAME_ADJACENCY_THRESHOLD = elementRules.singleSurnameThreshold;
const MIN_ELEMENT_PASSING_SCORE = elementRules.minPassingScore;
const ELEMENT_SIGNAL_WEIGHT = elementRules.signalWeight;
const POLARITY_SIGNAL_WEIGHT = polarityRules.signalWeight;

export class HangulCalculator extends SeedHangulCalculator implements EvaluableCalculator {
  readonly id = 'hangul';

  constructor(surnameEntries: HanjaEntry[], givenNameEntries: HanjaEntry[]) {
    super(surnameEntries, givenNameEntries);
  }

  visit(ctx: EvalContext): void {
    this.calculate();

    const blocks = this.getNameBlocks();
    const elementArrangement = blocks
      .map((block) => block.energy?.element.english as ElementKey)
      .filter((element): element is ElementKey => !!element);
    const polarityArrangement = blocks
      .map((block) => block.energy?.polarity.english as PolarityValue)
      .filter((polarity): polarity is PolarityValue => !!polarity);

    const elementDistribution = distributionFromArrangement(elementArrangement);
    const adjacencyScore = calculateArrayScore(elementArrangement, ctx.surnameLength);
    const balanceScore = calculateBalanceScore(elementDistribution);
    const combinedElementScore = (balanceScore + adjacencyScore) / 2;

    const adjacencyThreshold = ctx.surnameLength === 2
      ? DOUBLE_SURNAME_ADJACENCY_THRESHOLD
      : SINGLE_SURNAME_ADJACENCY_THRESHOLD;

    const noClashingNeighbours = checkElementGenerating(elementArrangement, ctx.surnameLength);
    const noSingleDominant = !countDominant(elementDistribution);
    const adjacencyIsStrong = adjacencyScore >= adjacencyThreshold;
    const overallScoreIsHigh = combinedElementScore >= MIN_ELEMENT_PASSING_SCORE;

    const elementPassed =
      noClashingNeighbours &&
      noSingleDominant &&
      adjacencyIsStrong &&
      overallScoreIsHigh;

    this.elementScore = combinedElementScore;

    putInsight(
      ctx,
      'HANGUL_ELEMENT',
      combinedElementScore,
      elementPassed,
      elementArrangement.join('-'),
      { distribution: elementDistribution, adjacencyScore, balanceScore },
    );

    const polarityResult = computePolarityResult(polarityArrangement, ctx.surnameLength);
    this.polarityScore = polarityResult.score;

    putInsight(
      ctx,
      'HANGUL_POLARITY',
      polarityResult.score,
      polarityResult.isPassed,
      polarityArrangement.join(''),
      { arrangementList: polarityArrangement },
    );
  }

  backward(ctx: EvalContext): CalculatorPacket {
    return {
      signals: [
        createSignal('HANGUL_ELEMENT', ctx, ELEMENT_SIGNAL_WEIGHT),
        createSignal('HANGUL_POLARITY', ctx, POLARITY_SIGNAL_WEIGHT),
      ],
    };
  }

  getAnalysis(): AnalysisDetail<HangulAnalysis> {
    return {
      type: this.id,
      score: this.getScore(),
      polarityScore: this.polarityScore,
      elementScore: this.elementScore,
      data: {
        blocks: this.getNameBlocks().map((block) => ({
          hangul: block.entry.hangul,
          onset: block.entry.onset,
          nucleus: block.entry.nucleus,
          element: block.energy?.element.english ?? '',
          polarity: block.energy?.polarity.english ?? '',
        })),
        polarityScore: this.polarityScore,
        elementScore: this.elementScore,
      },
    };
  }
}

