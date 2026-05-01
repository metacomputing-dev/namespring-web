import { EnergyCalculator, type EnergyVisitor } from './energy-calculator';
import { Energy } from '../model/energy';
import { Element } from '../model/element';
import { Polarity } from '../model/polarity';
import type { HanjaEntry } from '../database/hanja-repository';

/**
 * PR-Q-26 (Phase K-3): ONSET → Element lookup table (dedup + drift hazard 제거).
 *
 * Source doctrine (Wun-hae version of 훈민정음 해례 5음 배속):
 *   index 0~18 = Hangul 초성 (choseong) Unicode order:
 *     0=ㄱ  1=ㄲ  2=ㄴ  3=ㄷ  4=ㄸ  5=ㄹ  6=ㅁ  7=ㅂ  8=ㅃ  9=ㅅ
 *    10=ㅆ 11=ㅇ 12=ㅈ 13=ㅉ 14=ㅊ 15=ㅋ 16=ㅌ 17=ㅍ 18=ㅎ
 *
 * Element mapping per Wun-hae:
 *   Wood (木):  아음 (velar): ㄱ ㄲ ㅋ                        — indices 0, 1, 15
 *   Fire (火):  설음 (lingual): ㄴ ㄷ ㄸ ㄹ ㅌ                — indices 2, 3, 4, 5, 16
 *   Earth (土): 후음 (laryngeal): ㅇ ㅎ                       — indices 11, 18
 *   Metal (金): 치음 (sibilant): ㅅ ㅆ ㅈ ㅉ ㅊ                — indices 9, 10, 12, 13, 14
 *   Water (水): 순음 (labial): ㅁ ㅂ ㅃ ㅍ                     — indices 6, 7, 8, 17
 *
 * 19-entry lookup table replaces the 5 inline literal arrays in
 * calculateElementFromOnset() — single source of truth, drift-proof.
 */
const ONSET_TO_ELEMENT: ReadonlyArray<Element> = [
  Element.Wood,   //  0: ㄱ
  Element.Wood,   //  1: ㄲ
  Element.Fire,   //  2: ㄴ
  Element.Fire,   //  3: ㄷ
  Element.Fire,   //  4: ㄸ
  Element.Fire,   //  5: ㄹ
  Element.Water,  //  6: ㅁ
  Element.Water,  //  7: ㅂ
  Element.Water,  //  8: ㅃ
  Element.Metal,  //  9: ㅅ
  Element.Metal,  // 10: ㅆ
  Element.Earth,  // 11: ㅇ
  Element.Metal,  // 12: ㅈ
  Element.Metal,  // 13: ㅉ
  Element.Metal,  // 14: ㅊ
  Element.Wood,   // 15: ㅋ
  Element.Fire,   // 16: ㅌ
  Element.Water,  // 17: ㅍ
  Element.Earth,  // 18: ㅎ
];

/**
 * Calculator for the Hangul (Korean Alphabet) Five Elements and Yin-Yang based on pronunciation.
 * Analyzes phonetic attributes of Hangul characters provided via HanjaEntry.
 * Polarity is determined by the vowel (Nucleus) structure, and Element by the Onset.
 */
export class HangulCalculator extends EnergyCalculator {
  public readonly type = "Hangul";

  /**
   * Represents an individual Hangul unit within the name.
   */
  public static NameBlock = class {
    public energy: Energy | null = null;

    constructor(
      public readonly entry: HanjaEntry, // Holds the full data entry including the Hangul character and its components
      public readonly position: number   // Zero-based index in the full name string
    ) {}
  };
  
  public readonly hangulNameBlocks: InstanceType<typeof HangulCalculator.NameBlock>[];
  public polarityScore: number = 0;
  public elementScore: number = 0;

  /**
   * Initializes Hangul units using HanjaEntry arrays for consistency.
   * @param surnameEntries Array of entries for the surname
   * @param firstNameEntries Array of entries for the first name
   */
  constructor(surnameEntries: HanjaEntry[], firstNameEntries: HanjaEntry[]) {
    super();

    const fullEntries = [...surnameEntries, ...firstNameEntries];
    this.hangulNameBlocks = fullEntries.map((entry, index) => {
      return new HangulCalculator.NameBlock(entry, index);
    });
  }

  /**
   * Triggers the energy calculation process for all Hangul name blocks.
   */
  public calculate(): void {
    const needsCalculation = this.hangulNameBlocks.some(block => block.energy === null);

    if (needsCalculation) {
      const visitor = new HangulCalculator.CalculationVisitor();
      this.accept(visitor);
    }
  }

  public getScore(): number {
    return Energy.getScore(this.hangulNameBlocks.map(b => b.energy).filter((e): e is Energy => e !== null));
  }

  /**
   * Provides access to the list of Hangul name blocks.
   */
  public getNameBlocks() {
    return this.hangulNameBlocks;
  }

  /**
   * Internal visitor class that implements the actual calculation logic for Hangul energy.
   */
  public static CalculationVisitor = class implements EnergyVisitor {
    public preVisit(calculator: EnergyCalculator): void {
      // Entry preparation logic
    }

    public visit(calculator: EnergyCalculator): void {
      if (calculator instanceof HangulCalculator) {
        calculator.getNameBlocks().forEach(block => {
          const entry = block.entry;
          
          block.energy = {
            polarity: this.calculatePolarityFromVowel(entry.nucleus),
            element: this.calculateElementFromOnset(entry.hangul)
          };
        });
        const energies = calculator.getNameBlocks().map(b => b.energy).filter((e): e is Energy => e !== null);
        calculator.polarityScore = Energy.getPolarityScore(energies);
        calculator.elementScore = Energy.getElementScore(energies);
      }
    }

    public postVisit(calculator: EnergyCalculator): void {
      // Finalization logic
    }

    /**
     * Determines Polarity based on the vowel (Nucleus) structure in Naming Theory.
     * Yang (Positive): Vertical or Outward (ㅏ, ㅐ, ㅑ, ㅒ, ㅗ, ㅘ, ㅙ, ㅚ, ㅛ, ㅣ)
     * Yin (Negative): Horizontal or Inward (ㅓ, ㅔ, ㅕ, ㅖ, ㅜ, ㅝ, ㅞ, ㅟ, ㅠ, ㅡ)
     * @param nucleus The Hangul vowel character.
     */
    public calculatePolarityFromVowel(nucleus: string): Polarity {
      const yangVowels = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅣ'];
      
      // If the nucleus is in the yang list, return Positive, else return Negative.
      return yangVowels.includes(nucleus) ? Polarity.Positive : Polarity.Negative;
    }

    /**
     * Determines the Element based on the initial consonant (Onset) classification.
     * Uses the ONSET_TO_ELEMENT lookup table (PR-Q-26 K-3 dedup) for a single
     * source of truth — comments and indices can no longer drift.
     * @param char The full Hangul character to extract onset from.
     */
    public calculateElementFromOnset(char: string): Element {
      const code = char.charCodeAt(0) - 0xAC00;
      if (code < 0 || code > 11171) return Element.Water;

      const initialIdx = Math.floor(code / 588);
      // Indices 0..18 → ONSET_TO_ELEMENT lookup. Out-of-range falls back to Water
      // (preserves legacy behavior for malformed input).
      return ONSET_TO_ELEMENT[initialIdx] ?? Element.Water;
    }
  }
}

function clamp(arg0: number, arg1: number, arg2: number): number {
  throw new Error('Function not implemented.');
}
