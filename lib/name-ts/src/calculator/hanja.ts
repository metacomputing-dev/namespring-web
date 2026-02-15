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
  public elementScore = 0;
  public polarityScore = 0;

  constructor(surnameEntries: HanjaEntry[], givenNameEntries: HanjaEntry[]) {
    super();
    this.entries = [...surnameEntries, ...givenNameEntries];
  }

  visit(ctx: EvalContext): void {
    this.energies = this.entries.map(e => new Energy(Polarity.get(e.strokes), Element.get(e.resource_element)));
    const elArr = this.entries.map(e => e.stroke_element) as ElementKey[];
    const distribution = distributionFromArrangement(elArr);
    const adjacencyScore = calculateArrayScore(elArr, ctx.surnameLength);
    const balanceScore = calculateBalanceScore(distribution);
    this.elementScore = (balanceScore + adjacencyScore) / 2;
    this.putInsight(ctx, 'STROKE_ELEMENT', this.elementScore, balanceScore >= 60,
      elArr.join('-'), { distribution, adjacencyScore, balanceScore });
    const polArr = this.entries.map(e => Polarity.get(e.strokes).english) as PolarityValue[];
    const pol = computePolarityResult(polArr, ctx.surnameLength);
    this.polarityScore = pol.score;
    this.putInsight(ctx, 'STROKE_POLARITY', pol.score, pol.isPassed,
      polArr.join(''), { arrangementList: polArr });
  }

  backward(ctx: EvalContext): CalculatorPacket {
    return { signals: [this.signal('STROKE_POLARITY', ctx, 0.6)] };
  }

  getAnalysis(): AnalysisDetail<HanjaAnalysis> {
    const ps = this.polarityScore, es = this.elementScore;
    return {
      type: 'Hanja',
      score: (es + ps) / 2,
      polarityScore: ps,
      elementScore: es,
      data: {
        blocks: this.entries.map((e, i) => ({
          hanja: e.hanja, hangul: e.hangul, strokes: e.strokes,
          resourceElement: e.resource_element, strokeElement: e.stroke_element,
          polarity: this.energies[i]?.polarity.english ?? '',
        })),
        polarityScore: ps,
        elementScore: es,
      },
    };
  }

  getScore(): number {
    return this.getAnalysis().score;
  }

  getNameBlocks(): ReadonlyArray<{ readonly entry: HanjaEntry; energy: Energy | null }> {
    return this.entries.map((entry, i) => ({ entry, energy: this.energies[i] ?? null }));
  }
}
