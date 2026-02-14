import { DEFAULT_POLARITY_BY_BIT } from "../core/constants.js";
import type { Element, Energy, HanjaEntry, Polarity } from "../core/types.js";
import { EnergyCalculator } from "./energy-calculator.js";
import { lastEnergy, mergeNameEntries } from "./support.js";

export interface HanjaChar {
  readonly hangul: string;
  readonly hanja: string;
  readonly position: number;
  readonly entry: HanjaEntry;
  energy: Energy | null;
}

function bitToPolarity(value: number): Polarity {
  return DEFAULT_POLARITY_BY_BIT[(Math.abs(value) % 2) as 0 | 1];
}

function toEnergy(element: Element, polarity: Polarity): Energy {
  return { element, polarity };
}

export class HanjaCalculator extends EnergyCalculator {
  public readonly type = "Hanja";
  private readonly chars: HanjaChar[];

  constructor(surnameEntries: readonly HanjaEntry[], givenEntries: readonly HanjaEntry[]) {
    super();
    this.chars = mergeNameEntries(surnameEntries, givenEntries).map((entry, position) => ({
      hangul: entry.hangul,
      hanja: entry.hanja,
      position,
      entry,
      energy: null,
    }));
  }

  public calculate(): void {
    for (const item of this.chars) {
      if (item.energy) {
        continue;
      }
      item.energy = toEnergy(item.entry.rootElement, bitToPolarity(item.entry.strokePolarityBit));
    }

    const energy = lastEnergy(this.chars);
    if (energy) {
      this.setEnergy(energy);
    }
  }

  public getNameChars(): readonly HanjaChar[] {
    return this.chars;
  }

  public getStrokeElementArrangement(): Element[] {
    return this.chars.map((item) => item.entry.strokeElement);
  }

  public getRootElementArrangement(): Element[] {
    return this.chars.map((item) => item.entry.rootElement);
  }

  public getStrokePolarityArrangement(): Polarity[] {
    return this.chars.map((item) => bitToPolarity(item.entry.strokePolarityBit));
  }
}