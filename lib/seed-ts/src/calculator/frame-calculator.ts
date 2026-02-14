import { EnergyCalculator, type EnergyVisitor } from './energy-calculator';
import type { Energy } from '../model/energy';
import { Element } from '../model/element';
import { Polarity } from '../model/polarity';
import type { HanjaEntry } from '../database/hanja-repository';

/**
 * Calculator for the Four Frames (Won, Hyung, Lee, Jung) in naming theory.
 * Manages numerical stroke sums and their corresponding energies derived from Hanja entries.
 * Aligned with the pattern used in Hanja and Hangul calculators.
 */
export class FourFrameCalculator extends EnergyCalculator {
  public readonly type = "FourFrame";
  
  /**
   * Represents an individual frame (Sagyuk) with its calculated stroke sum and energy.
   */
  public static Frame = class {
    // Stores the calculated energy (Polarity and Element)
    public energy: Energy | null = null;
    
    constructor(
      public readonly type: 'won' | 'hyung' | 'lee' | 'jung',
      public readonly strokeSum: number // Total stroke count for this frame
    ) {}
  };

  public frames: InstanceType<typeof FourFrameCalculator.Frame>[];

  /**
   * Initializes the four frames using Hanja entries to derive total stroke counts.
   * Supports multi-character surnames and names of varying lengths.
   * @param surnameEntries Array of Hanja entries for the surname
   * @param firstNameEntries Array of Hanja entries for the first name
   */
  constructor(surnameEntries: HanjaEntry[], firstNameEntries: HanjaEntry[]) {
    super();
    // TODO replace it to a new visitor future
    // Extract stroke counts from the database entries
    const surnameStrokes = surnameEntries.map(e => e.strokes);
    const firstNameStrokes = firstNameEntries.map(e => e.strokes);

    // Calculate basic sums for internal logic
    const totalSurname = surnameStrokes.reduce((acc, val) => acc + val, 0);
    const totalFirstName = firstNameStrokes.reduce((acc, val) => acc + val, 0);
    const firstCharOfName = firstNameStrokes[0] || 0;
    const lastCharOfName = firstNameStrokes.length > 0 
      ? firstNameStrokes[firstNameStrokes.length - 1] 
      : 0;

    // Internal calculation logic for Sagyuk (Four Frames)
    // Won (元): Initial luck (Sum of all first name characters)
    const won = totalFirstName;
    // Hyung (亨): Middle luck (Sum of surname + first character of name)
    const hyung = totalSurname + firstCharOfName;
    // Lee (利): Adult luck (Sum of surname + last character of name)
    const lee = totalSurname + lastCharOfName;
    // Jung (貞): Total luck (Sum of all characters)
    const jung = totalSurname + totalFirstName;

    // Initialize frames with calculated stroke sums
    this.frames = [
      new FourFrameCalculator.Frame('won', won),
      new FourFrameCalculator.Frame('hyung', hyung),
      new FourFrameCalculator.Frame('lee', lee),
      new FourFrameCalculator.Frame('jung', jung)
    ];
  }

  /**
   * Triggers the energy calculation for all Sagyuk frames using the internal visitor.
   * Execution is skipped if all frames have already been calculated.
   */
  public calculate(): void {
    const needsCalculation = this.frames.some(frame => frame.energy === null);
    
    if (needsCalculation) {
      const visitor = new FourFrameCalculator.CalculationVisitor();
      this.accept(visitor);
    }
  }

  /**
   * Returns the list of all frames.
   */
  public getFrames() {
    return this.frames;
  }

  /**
   * Retrieves a specific frame by its type identifier.
   */
  public getFrame(type: 'won' | 'hyung' | 'lee' | 'jung') {
    return this.frames.find(f => f.type === type);
  }

  /**
   * Internal visitor class responsible for calculating energy for each frame.
   */
  public static CalculationVisitor = class implements EnergyVisitor {
    public preVisit(calculator: EnergyCalculator): void {
      // Preparation before processing frames
    }

    public visit(calculator: EnergyCalculator): void {
      if (calculator instanceof FourFrameCalculator) {
        // Calculate energy attributes for every frame in the calculator
        calculator.getFrames().forEach(frame => {
          frame.energy = {
            // Use the static Polarity getter for stroke sums
            polarity: Polarity.get(frame.strokeSum),
            element: this.calculateElementFromDigit(frame.strokeSum)
          };
        });
      }
    }

    public postVisit(calculator: EnergyCalculator): void {
      // Finalization after all frames are processed
    }

    /**
     * Determines the Element based on the last digit of the stroke sum.
     * Follows the 1,2: Wood / 3,4: Fire / 5,6: Earth / 7,8: Metal / 9,0: Water rule.
     */
    public calculateElementFromDigit(strokeSum: number): Element {
      const lastDigit = strokeSum % 10;
      switch (lastDigit) {
        case 1: case 2: return Element.Wood;
        case 3: case 4: return Element.Fire;
        case 5: case 6: return Element.Earth;
        case 7: case 8: return Element.Metal;
        default: return Element.Water; // Covers 9 and 0
      }
    }

    public calculateFourFrameNumbersFromStrokes(
      calculator: FourFrameCalculator,
      surnameStrokeCounts: readonly number[],
      givenStrokeCounts: readonly number[],
    ) {
      const padded = [...givenStrokeCounts];
      if (padded.length === 1) {
        padded.push(0);
      }
      const mid = Math.floor(padded.length / 2);
      const givenUpperSum = this.sum(padded.slice(0, mid));
      const givenLowerSum = this.sum(padded.slice(mid));
      const surnameTotal = this.sum(surnameStrokeCounts);
      const givenTotal = this.sum(givenStrokeCounts);

      calculator.frames = [
        new FourFrameCalculator.Frame('won', this.sum(padded)),
        new FourFrameCalculator.Frame('hyung', this.adjustTo81(surnameTotal + givenUpperSum)),
        new FourFrameCalculator.Frame('lee', this.adjustTo81(surnameTotal + givenLowerSum)),
        new FourFrameCalculator.Frame('jung', this.adjustTo81(surnameTotal + givenTotal))
      ];
    }

    public adjustTo81(value: number): number {
      if (value <= 81) {
        return value;
      }
      return ((value - 1) % 81) + 1;
    }

    public sum(values: readonly number[]): number {
      let out = 0;
      for (const value of values) {
        out += value;
      }
      return out;
    }
  }
}