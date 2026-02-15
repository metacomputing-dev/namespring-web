import { EnergyCalculator, type EnergyVisitor } from './energy-calculator';
import { Energy } from '../model/energy';
import { Element } from '../model/element';
import { Polarity } from '../model/polarity';
import type { HanjaEntry } from '../database/hanja-repository';
import { FourframeRepository, type FourframeMeaningEntry } from '../database/fourframe-repository';

/**
 * Calculator for the Four Frames (Won, Hyung, Lee, Jung) in naming theory.
 * Manages numerical stroke sums and their corresponding energies derived from Hanja entries.
 * Aligned with the pattern used in Hanja and Hangul calculators.
 */
export class FourFrameCalculator extends EnergyCalculator {
  public readonly type = "FourFrame";
  private surnameStrokes: number[] = [];
  private firstNameStrokes: number[] = [];
  
  /**
   * Represents an individual frame (Sagyuk) with its calculated stroke sum and energy.
   */
  public static Frame = class {
    public static repository: FourframeRepository | null = null;
    public static repositoryInitPromise: Promise<void> | null = null;

    // Stores the calculated energy (Polarity and Element)
    public energy: Energy | null = null;
    public luckLevel: number = -1;
    public entry: FourframeMeaningEntry | null = null;
    
    constructor(
      public readonly type: 'won' | 'hyung' | 'lee' | 'jung',
      public readonly strokeSum: number // Total stroke count for this frame
    ) {
      void this.getLuckLevel(strokeSum);
    }

    public async getLuckLevel(index: number): Promise<number> {
      if (this.luckLevel >= 0) {
        return this.luckLevel;
      }
      
      if (!FourFrameCalculator.Frame.repository) {
        FourFrameCalculator.Frame.repository = new FourframeRepository();
      }
      if (!FourFrameCalculator.Frame.repositoryInitPromise) {
        FourFrameCalculator.Frame.repositoryInitPromise = FourFrameCalculator.Frame.repository.init();
      }

      await FourFrameCalculator.Frame.repositoryInitPromise;
      const entry = await FourFrameCalculator.Frame.repository.findByNumber(this.strokeSum);
      this.entry = entry;
      const parsed = Number.parseInt(entry?.lucky_level ?? '0', 10);
      this.luckLevel = Number.isNaN(parsed) ? 0 : parsed;
      
      return this.luckLevel;
    }

  };

  public frames: InstanceType<typeof FourFrameCalculator.Frame>[];
  public luckScore: number = 0;

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
    this.surnameStrokes = surnameEntries.map(e => e.strokes);
    this.firstNameStrokes = firstNameEntries.map(e => e.strokes);

    // Calculate basic sums for internal logic
    const totalSurname = this.surnameStrokes.reduce((acc, val) => acc + val, 0);
    const totalFirstName = this.firstNameStrokes.reduce((acc, val) => acc + val, 0);
    const firstCharOfName = this.firstNameStrokes[0] || 0;
    const lastCharOfName = this.firstNameStrokes.length > 0 
      ? this.firstNameStrokes[this.firstNameStrokes.length - 1] 
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

  public getScore(): number {
    return Energy.getScore(this.frames.map(f => f.energy).filter((e): e is Energy => e !== null));
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
        this.calculateFourFrameNumbersFromStrokes(calculator, 
          calculator.surnameStrokes, 
          calculator.firstNameStrokes);

        // Calculate energy attributes for every frame in the calculator
        calculator.getFrames().forEach(frame => {
          frame.energy = {
            // Use the static Polarity getter for stroke sums
            polarity: Polarity.get(frame.strokeSum),
            element: this.calculateElementFromDigit(frame.strokeSum)
          };
        });
        
        // TODO Implement calculation model in future.
        const frameScore = this.calculateFourFrameElementScore(calculator.getFrames()) * 50;
        let localLuckScoreSum = 0;
        let avrFrameLuckScore = 0;
        calculator.getFrames().forEach(frame => {
          localLuckScoreSum += frame.luckLevel * 10;
        });
        avrFrameLuckScore = localLuckScoreSum / calculator.getFrames().length;
        calculator.luckScore = frameScore + avrFrameLuckScore;
      }
    }

    public postVisit(calculator: EnergyCalculator): void {
      // Finalization after all frames are processed
    }

    // TODO temporal logic
    public calculateFourFrameElementScore(frames: InstanceType<typeof FourFrameCalculator.Frame>[]): number {
      let energies = frames.map(b => b.energy).filter((e): e is Energy => e !== null);

      // loop energies in 0 .. length-2 to calculate element score based on the relationship between adjacent blocks
      for(let i = 0; i < energies.length - 1; i++) {
        const current = energies[i];
        const next = energies[i + 1];
        
        if (current.element.isOvercoming(next.element)) {
          return 0;
        }
      }

      const first = energies[0].element;
      const last = energies[energies.length - 1].element;
      if (first.isOvercoming(last)) {
        return 0;
      }

      return 1;
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
