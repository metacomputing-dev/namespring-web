import { Polarity } from './polarity.js';
import type { Element } from './element.js';
export class Energy {
  constructor(public readonly polarity: Polarity, public readonly element: Element) {}

  static getPolarityScore(energies: Energy[]): number {
    let sum = 0;
    for (const e of energies) sum += e.polarity === Polarity.Positive ? 1 : -1;
    return (energies.length - Math.abs(sum)) * 100 / energies.length;
  }

  static getElementScore(energies: Energy[]): number {
    let gen = 0, over = 0, same = 0;
    for (let i = 0; i < energies.length - 1; i++) {
      const cur = energies[i], nxt = energies[i + 1];
      if (cur.element.isGenerating(nxt.element)) gen++;
      else if (cur.element.isOvercoming(nxt.element)) over++;
      else if (cur.element === nxt.element) same++;
    }
    return Math.min(100, Math.max(0, 70 + gen * 15 - over * 20 - same * 5));
  }
}
