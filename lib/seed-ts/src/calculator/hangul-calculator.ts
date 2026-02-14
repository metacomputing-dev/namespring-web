import { CHOSUNG_ELEMENT, DEFAULT_POLARITY_BY_BIT, YANG_VOWELS } from "../core/constants.js";
import { extractChosung, extractJungsung } from "../core/hangul.js";
import type { Element, Energy, HanjaEntry, Polarity } from "../core/types.js";
import { NameSequenceCalculator } from "./name-sequence-calculator.js";

export interface SoundChar {
  readonly char: string;
  readonly hanja: string;
  readonly position: number;
  readonly entry: HanjaEntry;
  energy: Energy | null;
}

function bitToPolarity(value: number): Polarity {
  return DEFAULT_POLARITY_BY_BIT[(Math.abs(value) % 2) as 0 | 1];
}

function resolveElement(entry: HanjaEntry): Element {
  if (entry.pronunciationElement) {
    return entry.pronunciationElement;
  }
  const onset = extractChosung(entry.hangul);
  return (CHOSUNG_ELEMENT[onset] ?? "\u6C34") as Element;
}

function resolvePolarity(entry: HanjaEntry): Polarity {
  if (entry.pronunciationPolarityBit === 0 || entry.pronunciationPolarityBit === 1) {
    return bitToPolarity(entry.pronunciationPolarityBit);
  }
  const vowel = extractJungsung(entry.hangul);
  return YANG_VOWELS.has(vowel) ? "\u967D" : "\u9670";
}

function toEnergy(element: Element, polarity: Polarity): Energy {
  return { element, polarity };
}

export class HangulCalculator extends NameSequenceCalculator<SoundChar> {
  public readonly type = "Sound";

  protected createItem(entry: HanjaEntry, position: number): SoundChar {
    return {
      char: entry.hangul,
      hanja: entry.hanja,
      position,
      entry,
      energy: null,
    };
  }

  protected resolveEnergy(item: SoundChar): Energy {
    return toEnergy(resolveElement(item.entry), resolvePolarity(item.entry));
  }

  public getSoundChars(): readonly SoundChar[] {
    return this.getItems();
  }

  public getPronunciationElementArrangement(): Element[] {
    return this.getItems().map((item) => resolveElement(item.entry));
  }

  public getPronunciationPolarityArrangement(): Polarity[] {
    return this.getItems().map((item) => resolvePolarity(item.entry));
  }
}