import { CHOSUNG_ELEMENT, YANG_VOWELS } from "../core/constants.js";
import { extractChosung, extractJungsung } from "../core/hangul.js";
import type { Element, Energy, HanjaEntry, Polarity } from "../core/types.js";
import { isPolarityBit, polarityFromBit, toEnergy } from "./energy-support.js";
import { NameSequenceCalculator, type SequenceItemBase } from "./name-sequence-calculator.js";

export interface SoundChar extends SequenceItemBase {
  readonly char: string;
  readonly hanja: string;
  readonly position: number;
}

function resolveElement(entry: HanjaEntry): Element {
  if (entry.pronunciationElement) {
    return entry.pronunciationElement;
  }
  const onset = extractChosung(entry.hangul);
  return (CHOSUNG_ELEMENT[onset] ?? "\u6C34") as Element;
}

function resolvePolarity(entry: HanjaEntry): Polarity {
  if (isPolarityBit(entry.pronunciationPolarityBit)) {
    return polarityFromBit(entry.pronunciationPolarityBit);
  }
  const vowel = extractJungsung(entry.hangul);
  return YANG_VOWELS.has(vowel) ? "\u967D" : "\u9670";
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
