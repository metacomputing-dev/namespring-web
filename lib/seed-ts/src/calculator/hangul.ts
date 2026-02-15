import { NameCalculator, type EvalContext, type AnalysisDetail, type CalculatorPacket } from './evaluator.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import { Energy } from '../model/energy.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { HangulAnalysis } from '../model/types.js';
import {
  type ElementKey, type PolarityValue,
  distributionFromArrangement, calculateArrayScore, calculateBalanceScore,
  checkElementSangSaeng, countDominant, computePolarityResult,
} from './scoring.js';

const SIGNAL_WEIGHT_MINOR = 0.6;

const YANG_VOWELS: ReadonlySet<string> = new Set([
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅣ',
]);

const ONSET_TO_ELEMENT: ReadonlyMap<number, Element> = new Map([
  [0, Element.Wood], [1, Element.Wood], [15, Element.Wood],
  [2, Element.Fire], [3, Element.Fire], [4, Element.Fire], [5, Element.Fire], [16, Element.Fire],
  [11, Element.Earth], [18, Element.Earth],
  [9, Element.Metal], [10, Element.Metal], [12, Element.Metal], [13, Element.Metal], [14, Element.Metal],
]);

function polarityFromVowel(nucleus: string): Polarity {
  return YANG_VOWELS.has(nucleus) ? Polarity.Positive : Polarity.Negative;
}

function elementFromOnset(char: string): Element {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return Element.Water;
  return ONSET_TO_ELEMENT.get(Math.floor(code / 588)) ?? Element.Water;
}

interface HangulBlock {
  readonly entry: HanjaEntry;
  energy: Energy | null;
}

export class HangulCalculator extends NameCalculator {
  readonly id = 'hangul';
  private readonly blocks: HangulBlock[];
  private elemArrangement: ElementKey[] = [];
  private polArrangement: PolarityValue[] = [];
  private elScore = 0;
  private polScore = 0;

  constructor(
    private surnameEntries: HanjaEntry[],
    private givenNameEntries: HanjaEntry[],
  ) {
    super();
    this.blocks = [...surnameEntries, ...givenNameEntries].map(entry => ({ entry, energy: null }));
  }

  visit(ctx: EvalContext): void {
    for (const b of this.blocks) {
      b.energy = new Energy(polarityFromVowel(b.entry.nucleus), elementFromOnset(b.entry.hangul));
    }
    this.elemArrangement = this.blocks.map(b => elementFromOnset(b.entry.hangul).english as ElementKey);
    this.polArrangement = this.blocks.map(b => polarityFromVowel(b.entry.nucleus).english as PolarityValue);

    const distribution = distributionFromArrangement(this.elemArrangement);
    const adjacencyScore = calculateArrayScore(this.elemArrangement, ctx.surnameLength);
    const balance = calculateBalanceScore(distribution);
    const elemScore = (balance + adjacencyScore) / 2;
    const threshold = ctx.surnameLength === 2 ? 65 : 60;
    const elemPassed =
      checkElementSangSaeng(this.elemArrangement, ctx.surnameLength) &&
      !countDominant(distribution) && adjacencyScore >= threshold && elemScore >= 70;

    this.elScore = elemScore;
    this.putInsight(ctx, 'BALEUM_OHAENG', elemScore, elemPassed,
      this.elemArrangement.join('-'), { distribution, adjacencyScore, balanceScore: balance });

    const pol = computePolarityResult(this.polArrangement, ctx.surnameLength);
    this.polScore = pol.score;
    this.putInsight(ctx, 'BALEUM_EUMYANG', pol.score, pol.isPassed,
      this.polArrangement.join(''), { arrangementList: this.polArrangement });
  }

  backward(_ctx: EvalContext): CalculatorPacket {
    return {
      nodeId: this.id,
      signals: [
        this.signal('BALEUM_OHAENG', _ctx, SIGNAL_WEIGHT_MINOR),
        this.signal('BALEUM_EUMYANG', _ctx, SIGNAL_WEIGHT_MINOR),
      ],
    };
  }

  getAnalysis(): AnalysisDetail<HangulAnalysis> {
    const energies = this.blocks.map(b => b.energy).filter((e): e is Energy => e !== null);
    return {
      type: this.id,
      score: Energy.getScore(energies),
      polarityScore: this.polScore,
      elementScore: this.elScore,
      data: {
        blocks: this.blocks.map(b => ({
          hangul: b.entry.hangul, onset: b.entry.onset, nucleus: b.entry.nucleus,
          element: b.energy?.element.english ?? '',
          polarity: b.energy?.polarity.english ?? '',
        })),
        polarityScore: this.polScore,
        elementScore: this.elScore,
      },
    };
  }

  getNameBlocks(): ReadonlyArray<{ readonly entry: HanjaEntry; energy: Energy | null }> {
    return this.blocks;
  }

}
