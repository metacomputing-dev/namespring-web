import { DEFAULT_POLARITY_BY_BIT } from "../core/constants.js";
import type { Element, Energy, HanjaEntry, Polarity } from "../core/types.js";
import { NameSequenceCalculator } from "./name-sequence-calculator.js";

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
    return toEnergy(item.entry.rootElement, bitToPolarity(item.entry.strokePolarityBit));
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
    return this.getItems().map((item) => bitToPolarity(item.entry.strokePolarityBit));
  }
}
