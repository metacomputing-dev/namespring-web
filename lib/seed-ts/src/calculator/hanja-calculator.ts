import type { Element, Energy, HanjaEntry, Polarity } from "../core/types.js";
import { polarityFromBit, toEnergyFromBit } from "./energy-support.js";
import { NameSequenceCalculator, type SequenceItemBase } from "./name-sequence-calculator.js";

export interface HanjaChar extends SequenceItemBase {
  readonly hangul: string;
  readonly hanja: string;
  readonly position: number;
}

export class HanjaCalculator extends NameSequenceCalculator<HanjaChar> {
  public readonly type = "Hanja";
  protected createItem(entry: HanjaEntry, position: number): HanjaChar {
    return {
      hangul: entry.hangul,
      hanja: entry.hanja,
      position,
      entry,
      energy: null,
    };
  }

  protected resolveEnergy(item: HanjaChar): Energy {
    return toEnergyFromBit(item.entry.rootElement, item.entry.strokePolarityBit);
  }

  public getNameChars(): readonly HanjaChar[] {
    return this.getItems();
  }

  public getStrokeElementArrangement(): Element[] {
    return this.getItems().map((item) => item.entry.strokeElement);
  }

  public getRootElementArrangement(): Element[] {
    return this.getItems().map((item) => item.entry.rootElement);
  }

  public getStrokePolarityArrangement(): Polarity[] {
    return this.getItems().map((item) => polarityFromBit(item.entry.strokePolarityBit));
  }
}
