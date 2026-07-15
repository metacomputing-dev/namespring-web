import { EnergyCalculator, type EnergyVisitor } from './energy-calculator.js';
import { Energy } from '../model/energy.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import { SeedCalculationError } from '../errors.js';

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

  public readonly hanjaNameBlocks: InstanceType<typeof HanjaCalculator.NameBlock>[];
  public polarityScore: number = 0;
  public elementScore: number = 0;

  /**
   * Initializes Hanja units from provided HanjaEntry arrays.
   * @param surnameEntries Array of Hanja entries for the surname
   * @param firstNameEntries Array of Hanja entries for the first name
   */
  constructor(surnameEntries: readonly HanjaEntry[], firstNameEntries: readonly HanjaEntry[]) {
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
    if (!this.shouldCalculate()) return;
    const visitor = new HanjaCalculator.CalculationVisitor();
    this.accept(visitor);
    this.markReady();
  }

  public getScore(): number {
    const calculationStatus = this.requireReadyOrExcluded('hanja.nameBlocks');
    if (calculationStatus === 'excluded') return 0;

    const energies = this.hanjaNameBlocks
      .map(block => block.energy)
      .filter((energy): energy is Energy => energy !== null);
    if (energies.length !== this.hanjaNameBlocks.length) {
      throw new SeedCalculationError(
        'EMPTY_ENERGY_SET',
        'All Hanja energies must be calculated before scoring.',
        'hanja.nameBlocks',
        { blockCount: this.hanjaNameBlocks.length, energyCount: energies.length },
      );
    }
    return Energy.getScore(energies);
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
        const energies = calculator.getNameBlocks().map(b => b.energy).filter((e): e is Energy => e !== null);
        calculator.polarityScore = Energy.getPolarityScore(energies);
        calculator.elementScore = Energy.getElementScore(energies);
      }
    }

    public postVisit(calculator: EnergyCalculator): void {
      // Logic after processing
    }
  }
}
