import { FourFrameCalculator as SeedFourFrameCalculator } from '../../../seed-ts/src/calculator/frame-calculator.js';
import type { HanjaEntry } from '../../../seed-ts/src/database/hanja-repository.js';
import { Energy } from '../../../seed-ts/src/model/energy.js';
import type { FourFrameAnalysis } from '../core/model-types.js';
import type { AnalysisDetail, CalculatorPacket, EvalContext, EvaluableCalculator } from '../core/evaluator.js';
import { putInsight, createSignal } from '../core/evaluator.js';
import { type ElementKey, adjustTo81, distributionFromArrangement, calculateArrayScore, calculateBalanceScore, checkFourFrameSuriElement, countDominant, bucketFromFortune } from '../core/scoring.js';
import scoringRules from '../../config/scoring-rules.json';

export type Frame = InstanceType<typeof SeedFourFrameCalculator.Frame>;

const LUCK_SIGNAL_WEIGHT = scoringRules.fourframeLuck.signalWeight;
const ELEMENT_SIGNAL_WEIGHT = scoringRules.fourframeElement.signalWeight;
const DOUBLE_SURNAME_ADJACENCY_THRESHOLD = scoringRules.fourframeElement.doubleSurnameThreshold;
const SINGLE_SURNAME_ADJACENCY_THRESHOLD = scoringRules.fourframeElement.singleSurnameThreshold;
const MIN_ELEMENT_PASSING_SCORE = scoringRules.fourframeElement.minPassingScore;

export class FrameCalculator extends SeedFourFrameCalculator implements EvaluableCalculator {
  readonly id = 'frame';
  private frameElementScore = 0;
  private frameLuckScore = 0;
  private readonly enabled: boolean;

  constructor(surnameEntries: HanjaEntry[], givenNameEntries: HanjaEntry[], enabled: boolean = true) {
    super(surnameEntries, givenNameEntries);
    this.enabled = enabled;
  }

  async ensureEntriesLoaded(): Promise<void> {
    await Promise.all((this.getFrames() as Frame[]).map((frame) => frame.getLuckLevel(frame.strokeSum)));
  }

  visit(ctx: EvalContext): void {
    if (!this.enabled) {
      this.frameElementScore = 0;
      this.frameLuckScore = 0;

      putInsight(
        ctx,
        'FOURFRAME_LUCK',
        100,
        true,
        'DISABLED',
        { disabled: true, reason: 'fourframe-evaluation-disabled' },
      );
      putInsight(
        ctx,
        'FOURFRAME_ELEMENT',
        100,
        true,
        'DISABLED',
        { disabled: true, reason: 'fourframe-evaluation-disabled' },
      );
      return;
    }

    this.calculate();
    this.scoreFourframeLuck(ctx);
    this.scoreFourframeElement(ctx);
  }

  backward(ctx: EvalContext): CalculatorPacket {
    if (!this.enabled) {
      return { signals: [] };
    }

    return {
      signals: [
        createSignal('FOURFRAME_LUCK', ctx, LUCK_SIGNAL_WEIGHT),
        createSignal('FOURFRAME_ELEMENT', ctx, ELEMENT_SIGNAL_WEIGHT),
      ],
    };
  }

  getAnalysis(): AnalysisDetail<FourFrameAnalysis> {
    const energies = (this.getFrames() as Frame[])
      .map((frame) => frame.energy)
      .filter((energy): energy is Energy => energy !== null);

    return {
      type: this.id,
      score: (this.frameElementScore + this.frameLuckScore) / 2,
      polarityScore: energies.length > 0 ? Energy.getPolarityScore(energies) : 0,
      elementScore: this.frameElementScore,
      data: {
        frames: (this.getFrames() as Frame[]).map((frame) => ({
          type: frame.type,
          strokeSum: frame.strokeSum,
          element: frame.energy?.element.english ?? '',
          polarity: frame.energy?.polarity.english ?? '',
          luckyLevel: frame.luckLevel,
        })),
        elementScore: this.frameElementScore,
        luckScore: this.frameLuckScore,
      },
    };
  }

  private scoreFourframeLuck(ctx: EvalContext): void {
    const frames = this.getFrames() as Frame[];
    const [wonFrame, hyungFrame, leeFrame, jungFrame] = frames;
    const fortuneLabels = frames.map((frame) => ctx.luckyMap.get(frame.strokeSum) ?? '');

    const luckBuckets = [
      bucketFromFortune(fortuneLabels[0]),
      bucketFromFortune(fortuneLabels[1]),
    ];
    if (ctx.givenLength > 1) {
      luckBuckets.push(bucketFromFortune(fortuneLabels[2]));
    }
    luckBuckets.push(bucketFromFortune(fortuneLabels[3]));

    const score = luckBuckets.reduce((total, bucket) => total + bucket, 0);
    const allFramesLucky = luckBuckets.length > 0 && luckBuckets.every((bucket) => bucket >= 15);

    this.frameLuckScore = score;

    putInsight(
      ctx,
      'FOURFRAME_LUCK',
      score,
      allFramesLucky,
      frames.map((frame, index) => `${frame.strokeSum}/${fortuneLabels[index]}`).join('-'),
      { won: wonFrame.strokeSum, hyeong: hyungFrame.strokeSum, i: leeFrame.strokeSum, jeong: jungFrame.strokeSum },
    );
  }

  private scoreFourframeElement(ctx: EvalContext): void {
    const [wonFrame, hyungFrame, leeFrame] = this.getFrames() as Frame[];
    const arrangement: ElementKey[] = [
      this.elementFromStrokeSum(leeFrame.strokeSum),
      this.elementFromStrokeSum(hyungFrame.strokeSum),
      this.elementFromStrokeSum(wonFrame.strokeSum),
    ];

    const distribution = distributionFromArrangement(arrangement);
    const adjacencyScore = calculateArrayScore(arrangement, ctx.surnameLength);
    const balanceScore = calculateBalanceScore(distribution);
    const score = (balanceScore + adjacencyScore) / 2;

    const adjacencyThreshold = ctx.surnameLength === 2
      ? DOUBLE_SURNAME_ADJACENCY_THRESHOLD
      : SINGLE_SURNAME_ADJACENCY_THRESHOLD;

    const isPassed =
      checkFourFrameSuriElement(arrangement, ctx.givenLength) &&
      !countDominant(distribution) &&
      adjacencyScore >= adjacencyThreshold &&
      score >= MIN_ELEMENT_PASSING_SCORE;

    this.frameElementScore = score;

    putInsight(
      ctx,
      'FOURFRAME_ELEMENT',
      score,
      isPassed,
      arrangement.join('-'),
      { distribution, adjacencyScore, balanceScore },
    );
  }

  private elementFromStrokeSum(strokeSum: number): ElementKey {
    const value = adjustTo81(strokeSum) % 10;
    if (value === 1 || value === 2) return 'Wood';
    if (value === 3 || value === 4) return 'Fire';
    if (value === 5 || value === 6) return 'Earth';
    if (value === 7 || value === 8) return 'Metal';
    return 'Water';
  }
}
