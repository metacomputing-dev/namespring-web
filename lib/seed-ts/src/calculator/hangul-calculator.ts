import { EnergyCalculator, type EnergyVisitor } from './energy-calculator';
import { Energy } from '../model/energy';
import { Element } from '../model/element';
import { Polarity } from '../model/polarity';
import type { HanjaEntry } from '../database/hanja-repository';

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
     * @param char The full Hangul character to extract onset from.
     */
    public calculateElementFromOnset(char: string): Element {
      const code = char.charCodeAt(0) - 0xAC00;
      if (code < 0 || code > 11171) return Element.Water;

      const initialIdx = Math.floor(code / 588);
      
      // Traditional Onset Five Elements Mapping (Wun-hae version)
      // Wood (木): ㄱ, ㅋ
      if ([0, 1, 15].includes(initialIdx)) return Element.Wood;
      // Fire (火): ㄴ, ㄷ, ㄹ, ㅌ
      if ([2, 3, 4, 5, 16].includes(initialIdx)) return Element.Fire;
      // Earth (土): ㅇ, ㅎ
      if ([11, 18].includes(initialIdx)) return Element.Earth;
      // Metal (金): ㅅ, ㅈ, ㅊ
      if ([9, 10, 12, 13, 14].includes(initialIdx)) return Element.Metal;
      // Water (水): ㅁ, ㅂ, ㅍ
      return Element.Water;
    }
  }
}

function clamp(arg0: number, arg1: number, arg2: number): number {
  throw new Error('Function not implemented.');
}
