import { Polarity } from "./polarity";
import type { Element } from "./element";

export class Energy {
  public polarity: Polarity;
  public element: Element;

  constructor(polarity: Polarity, element: Element) {
    this.polarity = polarity;
    this.element = element;
  }

  public static getScore(energies: Energy[]): number {
    return getPolarityScore(energies) * 0.5 + getElementScore(energies) * 0.5;
  }

  public static getPolarityScore(energies: Energy[]): number {
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
  
  
  public static getElementScore(energies: Energy[]): number {
    let scoreSum = 0;
    let blocks = calculator.getNameBlocks();
    let energies = blocks.map(b => b.energy).filter((e): e is Energy => e !== null);

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

    return clamp(70 + genCount * 15 - overCount * 20 - sameCount * 5, 0, 100);
  }
}
