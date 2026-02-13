import { EnergyCalculator, type EnergyVisitor } from './energy-calculator';
import type { Energy } from '../model/energy';
import { Element } from '../model/element';
import { Polarity } from '../model/polarity';

/**
 * Calculator for the Four Frames (Won, Hyung, Lee, Jung) in naming theory.
 * Manages numerical stroke sums and their corresponding energies.
 */
export class FourFrameCalculator extends EnergyCalculator {
  public readonly type = "FourFrame";
  
  /**
   * Represents an individual frame with its stroke sum and calculated energy.
   */
  public static Frame = class {
    // Stores the calculated energy (Polarity and Element)
    public energy: Energy | null = null;
    
    constructor(
      public readonly type: 'won' | 'hyung' | 'lee' | 'jung',
      public readonly strokeSum: number // Total stroke count for this frame
    ) {}
  };

  private readonly frames: InstanceType<typeof FourFrameCalculator.Frame>[];

  /**
   * Constructor that calculates the four frames internally from stroke arrays.
   * Supports multi-character surnames and names of varying lengths.
   * @param surnameStrokes Array of stroke counts for each character in the surname
   * @param firstNameStrokes Array of stroke counts for each character in the given name
   */
  constructor(surnameStrokes: number[], firstNameStrokes: number[]) {
    super();
    
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
   * Triggers the energy calculation for all frames using the internal visitor.
   * Execution is skipped if all frames have already been calculated.
   */
  public calculate(): void {
    // Check if any frame still requires calculation to avoid redundant processing
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
            polarity: this.calculatePolarity(frame.strokeSum),
            element: this.calculateElement(frame.strokeSum)
          };
        });
      }
    }

    public postVisit(calculator: EnergyCalculator): void {
      // Finalization after all frames are processed
    }

    /**
     * Determines the Polarity based on whether the stroke sum is odd or even.
     */
    public calculatePolarity(strokeSum: number): Polarity {
      return strokeSum % 2 === 1 ? Polarity.Positive : Polarity.Negative;
    }

    /**
     * Determines the Element based on the last digit of the stroke sum.
     */
    public calculateElement(strokeSum: number): Element {
      const lastDigit = strokeSum % 10;
      switch (lastDigit) {
        case 1: case 2: return Element.Wood;
        case 3: case 4: return Element.Fire;
        case 5: case 6: return Element.Earth;
        case 7: case 8: return Element.Metal;
        default: return Element.Water; // Covers 9 and 0
      }
    }
  }
}