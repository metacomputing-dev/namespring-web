import { EnergyCalculator, type AnalysisDetail } from './energy-calculator.js';
import { Energy } from '../model/energy.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { HangulAnalysis } from '../types.js';

// ── Constants ─────────────────────────────────────────────────

const YANG_VOWELS: ReadonlySet<string> = new Set([
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅣ',
]);

/** Onset index → Element mapping (운해 version). */
const ONSET_TO_ELEMENT: ReadonlyMap<number, Element> = new Map([
  // Wood (木): ㄱ, ㅋ
  [0, Element.Wood], [1, Element.Wood], [15, Element.Wood],
  // Fire (火): ㄴ, ㄷ, ㄹ, ㅌ
  [2, Element.Fire], [3, Element.Fire], [4, Element.Fire], [5, Element.Fire], [16, Element.Fire],
  // Earth (土): ㅇ, ㅎ
  [11, Element.Earth], [18, Element.Earth],
  // Metal (金): ㅅ, ㅈ, ㅊ
  [9, Element.Metal], [10, Element.Metal], [12, Element.Metal], [13, Element.Metal], [14, Element.Metal],
  // Water (水): ㅁ, ㅂ, ㅍ → default fallback
]);

// ── Pure helper functions ─────────────────────────────────────

function polarityFromVowel(nucleus: string): Polarity {
  return YANG_VOWELS.has(nucleus) ? Polarity.Positive : Polarity.Negative;
}

function elementFromOnset(char: string): Element {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return Element.Water;

  const initialIdx = Math.floor(code / 588);
  return ONSET_TO_ELEMENT.get(initialIdx) ?? Element.Water;
}

// ── NameBlock ─────────────────────────────────────────────────

export class HangulNameBlock {
  public energy: Energy | null = null;

  constructor(
    public readonly entry: HanjaEntry,
    public readonly position: number,
  ) {}
}

// ── HangulCalculator ──────────────────────────────────────────

export class HangulCalculator extends EnergyCalculator {
  public readonly type = 'Hangul';
  public readonly hangulNameBlocks: HangulNameBlock[];
  public polarityScore: number = 0;
  public elementScore: number = 0;

  constructor(surnameEntries: HanjaEntry[], firstNameEntries: HanjaEntry[]) {
    super();
    const fullEntries = [...surnameEntries, ...firstNameEntries];
    this.hangulNameBlocks = fullEntries.map(
      (entry, index) => new HangulNameBlock(entry, index),
    );
  }

  protected doCalculate(): void {
    for (const block of this.hangulNameBlocks) {
      block.energy = new Energy(
        polarityFromVowel(block.entry.nucleus),
        elementFromOnset(block.entry.hangul),
      );
    }

    const energies = this.hangulNameBlocks
      .map(b => b.energy)
      .filter((e): e is Energy => e !== null);
    this.polarityScore = Energy.getPolarityScore(energies);
    this.elementScore = Energy.getElementScore(energies);
  }

  public getScore(): number {
    return Energy.getScore(
      this.hangulNameBlocks.map(b => b.energy).filter((e): e is Energy => e !== null),
    );
  }

  public getNameBlocks(): HangulNameBlock[] {
    return this.hangulNameBlocks;
  }

  /** Get pronunciation element arrangement as string keys */
  public getPronunciationElementArrangement(): string[] {
    return this.hangulNameBlocks.map(b => {
      const el = elementFromOnset(b.entry.hangul);
      return el.english;
    });
  }

  /** Get pronunciation polarity arrangement as string values */
  public getPronunciationPolarityArrangement(): string[] {
    return this.hangulNameBlocks.map(b => {
      const pol = polarityFromVowel(b.entry.nucleus);
      return pol.english;
    });
  }

  public getAnalysis(): AnalysisDetail<HangulAnalysis> {
    const energies = this.hangulNameBlocks
      .map(b => b.energy)
      .filter((e): e is Energy => e !== null);

    return {
      type: this.type,
      score: this.getScore(),
      polarityScore: this.polarityScore,
      elementScore: this.elementScore,
      data: {
        blocks: this.hangulNameBlocks.map(b => ({
          hangul: b.entry.hangul,
          onset: b.entry.onset,
          nucleus: b.entry.nucleus,
          element: b.energy?.element.english ?? '',
          polarity: b.energy?.polarity.english ?? '',
        })),
        polarityScore: this.polarityScore,
        elementScore: this.elementScore,
      },
    };
  }
}
