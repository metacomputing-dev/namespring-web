import { Polarity } from './polarity.js';
import { Element } from './element.js';
import { SeedCalculationError, SeedValidationError } from '../errors.js';
import {
  calculateElementRelationScore,
  combineEnergyScores,
} from '../scoring-policy.js';

export class Energy {
  public polarity: Polarity;
  public element: Element;

  constructor(polarity: Polarity, element: Element) {
    Energy.assertPolarity(polarity, 'polarity');
    Energy.assertElement(element, 'element');
    this.polarity = polarity;
    this.element = element;
  }

  public static getScore(energies: readonly Energy[]): number {
    Energy.assertValidSet(energies);
    return combineEnergyScores(
      Energy.getPolarityScore(energies),
      Energy.getElementScore(energies),
    );
  }

  public static getPolarityScore(energies: readonly Energy[]): number {
    Energy.assertValidSet(energies);
    let scoreSum = 0;

    energies.forEach(e => {
      if(e.polarity === Polarity.Positive) {
        scoreSum += 1;
      } else {
        scoreSum -= 1;
      }
    });
    return (energies.length - Math.abs(scoreSum)) * 100 / energies.length;
  }
  
  
  public static getElementScore(energies: readonly Energy[]): number {
    Energy.assertValidSet(energies);
    let genCount = 0;
    let overCount = 0;
    let sameCount = 0;
    // loop energies in 0 .. length-2 to calculate element score based on the relationship between adjacent blocks
    for(let i = 0; i < energies.length - 1; i++) {
      const current = energies[i];
      const next = energies[i + 1];

      
      if (current.element.isGenerating(next.element)) {
        genCount += 1;
      } else if (current.element.isOvercoming(next.element)) {
        overCount += 1;
      } else if (current.element.isSameAs(next.element)) {
        // v1 preserves the historical -5 adjustment; see the expert-review warning in the policy.
        sameCount += 1;
      }
    }

    return calculateElementRelationScore({
      generating: genCount,
      overcoming: overCount,
      same: sameCount,
    });
  }

  private static assertValidSet(energies: readonly Energy[]): void {
    if (!Array.isArray(energies)) {
      throw new SeedValidationError(
        'INVALID_ENERGY',
        'Energies must be an array.',
        'energies',
        energies,
      );
    }
    if (energies.length === 0) {
      throw new SeedCalculationError(
        'EMPTY_ENERGY_SET',
        'At least one calculated energy is required for scoring.',
        'energies',
        energies,
      );
    }
    energies.forEach((energy, index) => {
      if (
        typeof energy !== 'object'
        || energy === null
        || Array.isArray(energy)
        || !Object.hasOwn(energy, 'polarity')
        || !Object.hasOwn(energy, 'element')
      ) {
        throw new SeedValidationError(
          'INVALID_ENERGY',
          'Each energy must contain polarity and element fields.',
          `energies[${index}]`,
          energy,
        );
      }
      Energy.assertPolarity(energy.polarity, `energies[${index}].polarity`);
      Energy.assertElement(energy.element, `energies[${index}].element`);
    });
  }

  private static assertPolarity(value: unknown, path: string): asserts value is Polarity {
    if (value !== Polarity.Positive && value !== Polarity.Negative) {
      throw new SeedValidationError(
        'INVALID_POLARITY',
        'Polarity must be the exported Positive or Negative singleton.',
        path,
        value,
      );
    }
  }

  private static assertElement(value: unknown, path: string): asserts value is Element {
    if (!Element.values().some((element) => element === value)) {
      throw new SeedValidationError(
        'INVALID_ELEMENT',
        'Element must be one of the exported element singletons.',
        path,
        value,
      );
    }
  }
}
