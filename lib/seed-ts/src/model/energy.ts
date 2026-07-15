import { Polarity } from './polarity.js';
import type { Element } from './element.js';
import { SeedCalculationError } from '../errors.js';

export class Energy {
  public polarity: Polarity;
  public element: Element;

  constructor(polarity: Polarity, element: Element) {
    this.polarity = polarity;
    this.element = element;
  }

  public static getScore(energies: readonly Energy[]): number {
    Energy.assertNonEmpty(energies);
    return Energy.getPolarityScore(energies) * 0.5 + Energy.getElementScore(energies) * 0.5;
  }

  public static getPolarityScore(energies: readonly Energy[]): number {
    Energy.assertNonEmpty(energies);
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
    Energy.assertNonEmpty(energies);
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
        sameCount += 1; // Bonus for same element
      }
    }

    const score = 70 + genCount * 15 - overCount * 20 - sameCount * 5;
    return Math.min(100, Math.max(0, score));
  }

  private static assertNonEmpty(energies: readonly Energy[]): void {
    if (energies.length === 0) {
      throw new SeedCalculationError(
        'EMPTY_ENERGY_SET',
        'At least one calculated energy is required for scoring.',
        'energies',
        energies,
      );
    }
  }
}
