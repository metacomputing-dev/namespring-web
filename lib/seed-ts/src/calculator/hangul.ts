import { NameCalculator, type EvalContext, type AnalysisDetail } from './base.js';
import type { CalculatorPacket } from './graph.js';
import { Energy } from '../model/energy.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { HangulAnalysis } from '../types.js';
import type { ElementKey } from './element-cycle.js';
import { distributionFromArrangement } from './element-cycle.js';
import {
  calculateArrayScore, calculateBalanceScore, checkElementSangSaeng,
  countDominant, checkPolarityHarmony, polarityScore, type PolarityValue,
} from './rules.js';
import {
  NODE_ADJACENCY_THRESHOLD_SINGLE_CHAR, NODE_ADJACENCY_THRESHOLD_TWO_CHAR,
  NODE_PRONUNCIATION_ELEMENT_PASS,
} from './constants.js';

// ── Module-private constants & helpers ──────────────────────────

const SIGNAL_WEIGHT_MINOR = 0.6;

const YANG_VOWELS: ReadonlySet<string> = new Set([
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅣ',
]);

/** Onset index -> Element mapping (운해 version). */
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
  const initialIdx = Math.floor(code / 588);
  return ONSET_TO_ELEMENT.get(initialIdx) ?? Element.Water;
}

// ── Block data ──────────────────────────────────────────────────

interface HangulBlock {
  readonly entry: HanjaEntry;
  energy: Energy | null;
}

// ── HangulCalculator ────────────────────────────────────────────

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
    this.blocks = [...surnameEntries, ...givenNameEntries].map(
      (entry) => ({ entry, energy: null }),
    );
  }

  visit(ctx: EvalContext): void {
    // 1. Compute energies per block
    for (const b of this.blocks) {
      b.energy = new Energy(
        polarityFromVowel(b.entry.nucleus),
        elementFromOnset(b.entry.hangul),
      );
    }

    // 2. Build arrangements
    this.elemArrangement = this.blocks.map(b => elementFromOnset(b.entry.hangul).english as ElementKey);
    this.polArrangement = this.blocks.map(b => polarityFromVowel(b.entry.nucleus).english as PolarityValue);

    // 3. Score BALEUM_OHAENG (pronunciation element) -- exact evaluator logic
    const distribution = distributionFromArrangement(this.elemArrangement);
    const adjacencyScore = calculateArrayScore(this.elemArrangement, ctx.surnameLength);
    const balance = calculateBalanceScore(distribution);
    const elemScore = (balance + adjacencyScore) / 2;
    const threshold = ctx.surnameLength === 2
      ? NODE_ADJACENCY_THRESHOLD_TWO_CHAR
      : NODE_ADJACENCY_THRESHOLD_SINGLE_CHAR;
    const elemPassed =
      checkElementSangSaeng(this.elemArrangement, ctx.surnameLength) &&
      !countDominant(distribution) &&
      adjacencyScore >= threshold &&
      elemScore >= NODE_PRONUNCIATION_ELEMENT_PASS;
    this.elScore = elemScore;

    this.setInsight(ctx, NameCalculator.createInsight(
      'BALEUM_OHAENG', elemScore, elemPassed, this.elemArrangement.join('-'),
      { distribution, adjacencyScore, balanceScore: balance },
    ));

    // 4. Score BALEUM_EUMYANG (pronunciation polarity) -- exact evaluator logic
    const negCount = this.polArrangement.filter(v => v === 'Negative').length;
    const posCount = this.polArrangement.length - negCount;
    const polScoreVal = polarityScore(negCount, posCount);
    const polPassed = checkPolarityHarmony(this.polArrangement, ctx.surnameLength);
    this.polScore = polScoreVal;

    this.setInsight(ctx, NameCalculator.createInsight(
      'BALEUM_EUMYANG', polScoreVal, polPassed, this.polArrangement.join(''),
      { arrangementList: this.polArrangement },
    ));
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
          hangul: b.entry.hangul,
          onset: b.entry.onset,
          nucleus: b.entry.nucleus,
          element: b.energy?.element.english ?? '',
          polarity: b.energy?.polarity.english ?? '',
        })),
        polarityScore: this.polScore,
        elementScore: this.elScore,
      },
    };
  }

  getPronunciationElementArrangement(): ElementKey[] {
    return this.elemArrangement;
  }

  getPronunciationPolarityArrangement(): PolarityValue[] {
    return this.polArrangement;
  }
}
