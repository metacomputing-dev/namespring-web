import { EnergyCalculator, type EnergyVisitor } from './energy-calculator';
import type { Energy } from '../model/energy';
import { Element } from '../model/element';
import { Polarity } from '../model/polarity';
import type { HanjaEntry } from '../database/hanja-repository';

/**
 * Calculator for the Hanja (Chinese Character) Resource Five Elements and Yin-Yang.
 * Uses HanjaEntry from the repository to process characters based on their 
 * stored resource elements and stroke counts.
 */
export class HanjaCalculator extends EnergyCalculator {
  public readonly type = "Hanja";

  /**
   * Represents an individual Hanja character's energy in the name.
   */
  public static NameBlock = class {
    public energy: Energy | null = null;

    constructor(
      public readonly entry: HanjaEntry,
      public readonly position: number
    ) {}
  };

  private readonly hanjaNameBlocks: InstanceType<typeof HanjaCalculator.NameBlock>[];

  /**
   * Initializes Hanja units from provided HanjaEntry arrays.
   * @param surnameEntries Array of Hanja entries for the surname
   * @param firstNameEntries Array of Hanja entries for the first name
   */
  constructor(surnameEntries: HanjaEntry[], firstNameEntries: HanjaEntry[]) {
    super();

    const fullEntries = [...surnameEntries, ...firstNameEntries];
    this.hanjaNameBlocks = fullEntries.map((entry, index) => {
      return new HanjaCalculator.NameBlock(entry, index);
    });
  }

  /**
   * Triggers the energy calculation for all Hanja units.
   */
  public calculate(): void {
    const needsCalculation = this.hanjaNameBlocks.some(h => h.energy === null);

    if (needsCalculation) {
      const visitor = new HanjaCalculator.CalculationVisitor();
      this.accept(visitor);
    }
  }

  /**
   * Returns the list of all Hanja units.
   */
  public getNameBlocks() {
    return this.hanjaNameBlocks;
  }

  /**
   * Internal visitor class responsible for calculating energy for Hanja.
   */
  public static CalculationVisitor = class implements EnergyVisitor {
    public preVisit(calculator: EnergyCalculator): void {
      // Entry logic before processing
    }

    public visit(calculator: EnergyCalculator): void {
      if (calculator instanceof HanjaCalculator) {
        calculator.getNameBlocks().forEach(block => {
          const entry = block.entry;
          
          block.energy = {
            polarity: Polarity.get(entry.strokes),
            element: Element.get(entry.resource_element)
          };
        });
      }
    }

    public postVisit(calculator: EnergyCalculator): void {
      // Logic after processing
    }
  }
}