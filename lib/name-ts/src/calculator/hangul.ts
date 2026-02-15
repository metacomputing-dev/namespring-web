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

const YANG_VOWELS: ReadonlySet<string> = new Set([
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅣ',
]);

const { Wood, Fire, Earth, Metal, Water: W } = Element;
const ONSET_EL: readonly Element[] = [
  Wood, Wood, Fire, Fire, Fire, Fire, W, W, W, Metal, Metal, Earth, Metal, Metal, Metal, Wood, Fire, W, Earth,
];

function polarityFromVowel(nucleus: string): Polarity {
  return YANG_VOWELS.has(nucleus) ? Polarity.Positive : Polarity.Negative;
}

function elementFromOnset(char: string): Element {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return W;
  return ONSET_EL[Math.floor(code / 588)] ?? W;
}

export class HangulCalculator extends NameCalculator {
  readonly id = 'hangul';
  private readonly blocks: { readonly entry: HanjaEntry; energy: Energy | null }[];
  private elemArrangement: ElementKey[] = [];
  private polArrangement: PolarityValue[] = [];
  public elementScore = 0;
  public polarityScore = 0;

  constructor(surnameEntries: HanjaEntry[], givenNameEntries: HanjaEntry[]) {
    super();
    this.blocks = [...surnameEntries, ...givenNameEntries].map(entry => ({ entry, energy: null }));
  }

  visit(ctx: EvalContext): void {
    for (const b of this.blocks) {
      const el = elementFromOnset(b.entry.hangul);
      const pol = polarityFromVowel(b.entry.nucleus);
      b.energy = new Energy(pol, el);
      this.elemArrangement.push(el.english as ElementKey);
      this.polArrangement.push(pol.english as PolarityValue);
    }

    const distribution = distributionFromArrangement(this.elemArrangement);
    const adjacencyScore = calculateArrayScore(this.elemArrangement, ctx.surnameLength);
    const balance = calculateBalanceScore(distribution);
    const elemScore = (balance + adjacencyScore) / 2;
    const threshold = ctx.surnameLength === 2 ? 65 : 60;
    const elemPassed =
      checkElementSangSaeng(this.elemArrangement, ctx.surnameLength) &&
      !countDominant(distribution) && adjacencyScore >= threshold && elemScore >= 70;

    this.elementScore = elemScore;
    this.putInsight(ctx, 'HANGUL_ELEMENT', elemScore, elemPassed,
      this.elemArrangement.join('-'), { distribution, adjacencyScore, balanceScore: balance });

    const polResult = computePolarityResult(this.polArrangement, ctx.surnameLength);
    this.polarityScore = polResult.score;
    this.putInsight(ctx, 'HANGUL_POLARITY', polResult.score, polResult.isPassed,
      this.polArrangement.join(''), { arrangementList: this.polArrangement });
  }

  backward(ctx: EvalContext): CalculatorPacket {
    return {
      signals: [this.signal('HANGUL_ELEMENT', ctx, 0.6), this.signal('HANGUL_POLARITY', ctx, 0.6)],
    };
  }

  getAnalysis(): AnalysisDetail<HangulAnalysis> {
    const energies = this.blocks.map(b => b.energy).filter((e): e is Energy => e !== null);
    const ps = this.polarityScore, es = this.elementScore;
    return {
      type: this.id,
      score: Energy.getPolarityScore(energies) * 0.5 + Energy.getElementScore(energies) * 0.5,
      polarityScore: ps,
      elementScore: es,
      data: {
        blocks: this.blocks.map(b => ({
          hangul: b.entry.hangul, onset: b.entry.onset, nucleus: b.entry.nucleus,
          element: b.energy?.element.english ?? '',
          polarity: b.energy?.polarity.english ?? '',
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
    return this.blocks;
  }
}
