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
  // PR-Q-24 (K-5 full wire): optional confidence cap on hangul signals.
  // chinese 학파의 발음오행 confidence 하향 doctrine.
  private readonly signalCap: number;
  // PR-Q-25 (K-6 full wire): polarity model selection.
  // 'binary' (default): yang vs yin, ㅣ→Yang ㅡ→Yin (현재 동작)
  // 'ternary': ㅡ/ㅣ 중성모음 분류 후 polarity arrangement 에서 제외 (한국 모던 작명 표준)
  private readonly polarityModel: 'binary' | 'ternary';

  constructor(
    surnameEntries: HanjaEntry[],
    givenNameEntries: HanjaEntry[],
    signalCap: number = 1.0,
    polarityModel: 'binary' | 'ternary' = 'binary',
  ) {
    super(surnameEntries, givenNameEntries);
    // Clamp to [0, 1] to prevent unintentional amplification or negative weights.
    this.signalCap = Math.max(0, Math.min(1, Number(signalCap) || 1));
    this.polarityModel = polarityModel;
  }

  visit(ctx: EvalContext): void {
    this.calculate();

    const blocks = this.getNameBlocks();
    const elementArrangement = blocks
      .map((block) => block.energy?.element.english as ElementKey)
      .filter((element): element is ElementKey => !!element);

    // PR-Q-25 K-6: ternary polarity model — ㅡ/ㅣ 중성모음 (가중치 0) 처리.
    // 한국 모던 작명 표준 (좋은이름닷컴 등): vertical(ㅏㅑㅗㅛ) Yang, horizontal
    // (ㅓㅕㅜㅠ) Yin, neutral (ㅡㅣ) 중성. 본 wire 는 중성 블록을 polarity
    // arrangement 에서 제외하여 균형 측정에 영향 0.
    const NEUTRAL_NUCLEI = new Set(['ㅡ', 'ㅣ']);
    const polarityArrangement = blocks
      .filter((block) => {
        if (this.polarityModel === 'binary') return true;
        // ternary: drop ㅡ/ㅣ blocks from arrangement
        return !NEUTRAL_NUCLEI.has(String(block.entry.nucleus ?? ''));
      })
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
        createSignal('HANGUL_ELEMENT', ctx, ELEMENT_SIGNAL_WEIGHT * this.signalCap),
        createSignal('HANGUL_POLARITY', ctx, POLARITY_SIGNAL_WEIGHT * this.signalCap),
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

