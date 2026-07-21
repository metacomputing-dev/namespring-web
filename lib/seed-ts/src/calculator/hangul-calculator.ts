import { EnergyCalculator, type EnergyVisitor } from './energy-calculator.js';
import { Energy } from '../model/energy.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import { SeedCalculationError, SeedValidationError } from '../errors.js';
import { countCodePointsUpTo } from '../utils/bounded-code-point-count.js';

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

const YANG_VOWELS = new Set([
  '\u314f', '\u3150', '\u3151', '\u3152', '\u3157',
  '\u3158', '\u3159', '\u315a', '\u315b', '\u3163',
]);
const YIN_VOWELS = new Set([
  '\u3153', '\u3154', '\u3155', '\u3156', '\u315c',
  '\u315d', '\u315e', '\u315f', '\u3160', '\u3161', '\u3162',
]);

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
  constructor(surnameEntries: readonly HanjaEntry[], firstNameEntries: readonly HanjaEntry[]) {
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
    if (!this.shouldCalculate()) return;
    const visitor = new HangulCalculator.CalculationVisitor();
    this.accept(visitor);
    this.markReady();
  }

  public getScore(): number {
    const calculationStatus = this.requireReadyOrExcluded('hangul.nameBlocks');
    if (calculationStatus === 'excluded') return 0;

    const energies = this.hangulNameBlocks
      .map(block => block.energy)
      .filter((energy): energy is Energy => energy !== null);
    if (energies.length !== this.hangulNameBlocks.length) {
      throw new SeedCalculationError(
        'EMPTY_ENERGY_SET',
        'All Hangul energies must be calculated before scoring.',
        'hangul.nameBlocks',
        { blockCount: this.hangulNameBlocks.length, energyCount: energies.length },
      );
    }
    return Energy.getScore(energies);
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
      if (YANG_VOWELS.has(nucleus)) return Polarity.Positive;
      if (YIN_VOWELS.has(nucleus)) return Polarity.Negative;
      throw new SeedValidationError(
        'INVALID_NUCLEUS',
        'Nucleus must be a valid modern Hangul vowel.',
        'nucleus',
        nucleus,
      );
    }

    /**
     * Determines the Element based on the initial consonant (Onset) classification.
     * Uses the ONSET_TO_ELEMENT lookup table (PR-Q-26 K-3 dedup) for a single
     * source of truth — comments and indices can no longer drift.
     * @param char The full Hangul character to extract onset from.
     */
    public calculateElementFromOnset(char: string): Element {
      const charLength = typeof char === 'string' ? countCodePointsUpTo(char, 1) : 0;
      const code = charLength === 1 ? char.charCodeAt(0) - 0xAC00 : -1;
      if (charLength !== 1 || code < 0 || code > 11171) {
        throw new SeedValidationError(
          'INVALID_HANGUL_SYLLABLE',
          'Element calculation requires exactly one precomposed Hangul syllable.',
          'hangul',
          char,
        );
      }

      const initialIdx = Math.floor(code / 588);
      // Indices 0..18 map to ONSET_TO_ELEMENT; malformed input fails closed.
      const element = ONSET_TO_ELEMENT[initialIdx];
      if (!element) {
        throw new SeedValidationError(
          'INVALID_ONSET',
          'Unable to derive a valid onset element from the Hangul syllable.',
          'hangul',
          char,
        );
      }
      return element;
    }
  }
}
