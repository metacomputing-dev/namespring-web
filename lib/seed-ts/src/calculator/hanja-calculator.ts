import type { HanjaEntry } from "../database/hanja-repository.js";
import { createEnergy, type Energy } from "../model/energy.js";
import { polarityFromStrokeCount } from "../model/polarity.js";
import { EnergyCalculator } from "./energy-calculator.js";
import { lastEnergy, mergeNameEntries } from "./support.js";

export interface HanjaChar {
  readonly hangul: string;
  readonly hanja: string;
  readonly position: number;
  readonly entry: HanjaEntry;
  energy: Energy | null;
}

export class HanjaCalculator extends EnergyCalculator {
  public readonly type = "Hanja";
  private readonly chars: HanjaChar[];

  constructor(surnameEntries: HanjaEntry[], givenEntries: HanjaEntry[]) {
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
      const polarity = item.entry.strokePolarity ?? polarityFromStrokeCount(item.entry.strokes);
      item.energy = createEnergy(item.entry.resourceElement, polarity);
    }

    const energy = lastEnergy(this.chars);
    if (energy) {
      this.setEnergy(energy);
    }
  }

  public getNameChars(): readonly HanjaChar[] {
    return this.chars;
  }
}
