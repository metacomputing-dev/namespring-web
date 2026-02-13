import { EnergyCalculator, type EnergyVisitor } from './energy-calculator';
import type { Energy } from '../model/energy';
import { Element } from '../model/element';
import { Polarity } from '../model/polarity';

/**
 * Data structure for Hanja character information required for calculations.
 */
export interface HanjaData {
  char: string;
  strokes: number;
  resourceElement: Element;
}

/**
 * Calculator for the Hanja (Chinese Character) Resource Five Elements and Yin-Yang.
 * Processes characters based on their intrinsic resource elements and stroke counts.
 */
export class HanjaCalculator extends EnergyCalculator {
  public readonly type = "Hanja";

  /**
   * Represents an individual Hanja character's energy in the name.
   */
  public static Hanja = class {
    public energy: Energy | null = null;

    constructor(
      public readonly char: string,
      public readonly strokeCount: number,
      public readonly resourceElement: Element,
      public readonly position: number
    ) {}
  };

  private readonly hanjas: InstanceType<typeof HanjaCalculator.Hanja>[];

  /**
   * Constructor that initializes Hanja units from provided data arrays.
   * @param surnameData Array of Hanja data for the surname
   * @param firstNameData Array of Hanja data for the first name
   */
  constructor(surnameData: HanjaData[], firstNameData: HanjaData[]) {
    super();

    const fullData = [...surnameData, ...firstNameData];
    this.hanjas = fullData.map((data, index) => {
      return new HanjaCalculator.Hanja(
        data.char,
        data.strokes,
        data.resourceElement,
        index
      );
    });
  }

  /**
   * Triggers the energy calculation for all Hanja units.
   * Execution is skipped if all units are already calculated.
   */
  public calculate(): void {
    const needsCalculation = this.hanjas.some(h => h.energy === null);

    if (needsCalculation) {
      const visitor = new HanjaCalculator.CalculationVisitor();
      this.accept(visitor);
    }
  }

  /**
   * Returns the list of all Hanja units.
   */
  public getHanjas() {
    return this.hanjas;
  }

  /**
   * Internal visitor class responsible for calculating energy for Hanja.
   */
  public static CalculationVisitor = class implements EnergyVisitor {
    public preVisit(calculator: EnergyCalculator): void {
      // Logic before processing Hanja attributes
    }

    public visit(calculator: EnergyCalculator): void {
      // TODO Implement Hanja energy calculation logic based on sqlite data.
      if (calculator instanceof HanjaCalculator) {
        calculator.getHanjas().forEach(hanja => {
          hanja.energy = {
            polarity: this.calculatePolarity(hanja.strokeCount),
            element: hanja.resourceElement // Resource element is intrinsic to the Hanja
          };
        });
      }
    }

    public postVisit(calculator: EnergyCalculator): void {
      // Finalization after Hanja energy calculation
    }

    /**
     * Determines Polarity based on the Hanja stroke count (Odd: Positive, Even: Negative).
     */
    public calculatePolarity(strokeCount: number): Polarity {
      return strokeCount % 2 === 1 ? Polarity.Positive : Polarity.Negative;
    }
  }
}