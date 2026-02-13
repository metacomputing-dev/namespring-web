import { EnergyCalculator, type EnergyVisitor } from './energy-calculator';
import type { Energy } from '../model/energy';
import { Element } from '../model/element';
import { Polarity } from '../model/polarity';

/**
 * Calculator for the Hangul (Korean Alphabet) Five Elements and Yin-Yang based on pronunciation.
 * Analyzes initial consonants (Onsets) and stroke counts of Hangul characters.
 */
export class HangulCalculator extends EnergyCalculator {
  public readonly type = "Hangul";

  /**
   * Represents an individual Hangul character unit within the name.
   */
  public static Hangul = class {
    public energy: Energy | null = null;

    constructor(
      public readonly char: string,     // The Hangul character
      public readonly position: number  // Zero-based index in the full name string
    ) {}
  };

  private readonly hanguls: InstanceType<typeof HangulCalculator.Hangul>[];

  /**
   * Initializes Hangul units for each character in the provided surname and first name.
   * @param surname Surname string in Hangul
   * @param firstName Given name string in Hangul
   */
  constructor(surname: string, firstName: string) {
    super();

    const fullText = surname + firstName;
    this.hanguls = fullText.split('').map((char, index) => {
      return new HangulCalculator.Hangul(char, index);
    });
  }

  /**
   * Triggers the energy calculation process for all Hangul units.
   * Skips execution if all units already have calculated energy data.
   */
  public calculate(): void {
    const needsCalculation = this.hanguls.some(unit => unit.energy === null);

    if (needsCalculation) {
      const visitor = new HangulCalculator.CalculationVisitor();
      this.accept(visitor);
    }
  }

  /**
   * Provides access to the list of Hangul units managed by this calculator.
   */
  public getHanguls() {
    return this.hanguls;
  }

  /**
   * Internal visitor class that implements the actual calculation logic for Hangul energy.
   */
  public static CalculationVisitor = class implements EnergyVisitor {
    public preVisit(calculator: EnergyCalculator): void {
      // Preparation logic before visiting units
    }

    public visit(calculator: EnergyCalculator): void {
      if (calculator instanceof HangulCalculator) {
        calculator.getHanguls().forEach(unit => {
          unit.energy = {
            polarity: this.calculatePolarity(unit.char),
            element: this.calculateElement(unit.char)
          };
        });
      }
    }

    public postVisit(calculator: EnergyCalculator): void {
      // Finalization logic after processing all units
    }

    /**
     * Determines Polarity (Yin-Yang) based on the parity of Hangul stroke counts.
     */
    public calculatePolarity(char: string): Polarity {
      const strokeCount = this.getHangulStrokeCount(char);
      return strokeCount % 2 === 1 ? Polarity.Positive : Polarity.Negative;
    }

    /**
     * Determines the Element based on the initial consonant (Onset) classification.
     */
    public calculateElement(char: string): Element {
      const code = char.charCodeAt(0) - 0xAC00;
      // Return Water as default for non-Hangul range characters
      if (code < 0 || code > 11171) return Element.Water;

      const initialIdx = Math.floor(code / 588);
      
      // Traditional Onset Five Elements Mapping
      // Wood (木): ㄱ, ㅋ
      if ([0, 1, 15].includes(initialIdx)) return Element.Wood;
      // Fire (火): ㄴ, ㄷ, ㄹ, ㅌ
      if ([2, 3, 4, 5, 16].includes(initialIdx)) return Element.Fire;
      // Earth (土): ㅇ, ㅎ
      if ([11, 18].includes(initialIdx)) return Element.Earth;
      // Metal (金): ㅅ, ㅈ, ㅊ
      if ([9, 10, 12, 13, 14].includes(initialIdx)) return Element.Metal;
      // Water (水): ㅁ, ㅂ, ㅍ
      return Element.Water; // Indices: 6, 7, 8, 17
    }

    /**
     * Retrieves the stroke count for a Hangul character using a predefined mapping or fallback.
     */
    public getHangulStrokeCount(char: string): number {
      const strokeMap: Record<string, number> = {
        'ㄱ': 2, 'ㄴ': 2, 'ㄷ': 3, 'ㄹ': 5, 'ㅁ': 4, 'ㅂ': 4, 'ㅅ': 2, 'ㅇ': 1,
        'ㅈ': 3, 'ㅊ': 4, 'ㅋ': 3, 'ㅌ': 4, 'ㅍ': 4, 'ㅎ': 3
      };
      
      // Use mapped value if available, otherwise fallback to Unicode code point for parity
      return strokeMap[char] || char.charCodeAt(0);
    }
  }
}