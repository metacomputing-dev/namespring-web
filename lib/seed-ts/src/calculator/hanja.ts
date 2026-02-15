import { NameCalculator, type EvalContext, type AnalysisDetail, type CalculatorPacket } from './evaluator.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import { Energy } from '../model/energy.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { HanjaAnalysis } from '../model/types.js';
import {
  type ElementKey, type PolarityValue,
  distributionFromArrangement, calculateArrayScore, calculateBalanceScore,
  computePolarityResult,
} from './scoring.js';

export class HanjaCalculator extends NameCalculator {
  readonly id = 'hanja';
  private readonly entries: HanjaEntry[];
  private energies: Energy[] = [];
  private ohaengScore = 0;
  private eumyangScore = 0;

  constructor(
    private surnameEntries: HanjaEntry[],
    private givenNameEntries: HanjaEntry[],
  ) {
    super();
    this.entries = [...surnameEntries, ...givenNameEntries];
  }

  visit(ctx: EvalContext): void {
    this.energies = this.entries.map(
      e => new Energy(Polarity.get(e.strokes), Element.get(e.resource_element)),
    );

    const elArr = this.getStrokeElementArrangement() as ElementKey[];
    const distribution = distributionFromArrangement(elArr);
    const adjacencyScore = calculateArrayScore(elArr, ctx.surnameLength);
    const balanceScore = calculateBalanceScore(distribution);
    this.ohaengScore = (balanceScore + adjacencyScore) / 2;

    this.putInsight(ctx, 'HOEKSU_OHAENG', this.ohaengScore, balanceScore >= 60,
      elArr.join('-'), { distribution, adjacencyScore, balanceScore });

    const polArr = this.getStrokePolarityArrangement() as PolarityValue[];
    const pol = computePolarityResult(polArr, ctx.surnameLength);
    this.eumyangScore = pol.score;

    this.putInsight(ctx, 'HOEKSU_EUMYANG', pol.score, pol.isPassed,
      polArr.join(''), { arrangementList: polArr });
  }

  backward(ctx: EvalContext): CalculatorPacket {
    return {
      nodeId: this.id,
      signals: [this.signal('HOEKSU_EUMYANG', ctx, 0.6)],
    };
  }

  getAnalysis(): AnalysisDetail<HanjaAnalysis> {
    return {
      type: 'Hanja',
      score: (this.ohaengScore + this.eumyangScore) / 2,
      polarityScore: this.eumyangScore,
      elementScore: this.ohaengScore,
      data: {
        blocks: this.entries.map((e, i) => ({
          hanja: e.hanja, hangul: e.hangul, strokes: e.strokes,
          resourceElement: e.resource_element, strokeElement: e.stroke_element,
          polarity: this.energies[i]?.polarity.english ?? '',
        })),
        polarityScore: this.eumyangScore,
        elementScore: this.ohaengScore,
      },
    };
  }

  getNameBlocks(): ReadonlyArray<{ readonly entry: HanjaEntry; energy: Energy | null }> {
    return this.entries.map((entry, i) => ({ entry, energy: this.energies[i] ?? null }));
  }

  getStrokeElementArrangement(): string[] {
    return this.entries.map(e => e.stroke_element);
  }

  getRootElementArrangement(): string[] {
    return this.entries.map(e => e.resource_element);
  }

  getStrokePolarityArrangement(): string[] {
    return this.entries.map(e => Polarity.get(e.strokes).english);
  }
}
