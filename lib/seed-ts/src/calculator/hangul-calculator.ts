import { CHOSUNG_ELEMENT, YANG_VOWELS } from "../core/constants.js";
import { extractChosung, extractJungsung } from "../core/hangul.js";
import type { Element as CoreElementSymbol } from "../core/types.js";
import type { HanjaEntry } from "../database/hanja-repository.js";
import { elementFromCoreSymbol } from "../model/element.js";
import { createEnergy, type Energy } from "../model/energy.js";
import type { Polarity } from "../model/polarity.js";
import { EnergyCalculator } from "./energy-calculator.js";
import { lastEnergy, mergeNameEntries } from "./support.js";

export interface SoundChar {
  readonly char: string;
  readonly hanja: string;
  readonly position: number;
  readonly entry: HanjaEntry;
  energy: Energy | null;
}

function resolveOnset(entry: HanjaEntry): string {
  if (entry.onset && entry.onset.length > 0) {
    return entry.onset;
  }
  return extractChosung(entry.hangul);
}

function resolveVowel(entry: HanjaEntry): string {
  if (entry.nucleus && entry.nucleus.length > 0) {
    return entry.nucleus;
  }
  return extractJungsung(entry.hangul);
}

function resolveElement(entry: HanjaEntry) {
  const onset = resolveOnset(entry);
  const coreElementSymbol = (CHOSUNG_ELEMENT[onset] ?? "水") as CoreElementSymbol;
  return elementFromCoreSymbol(coreElementSymbol);
}

function resolvePolarity(entry: HanjaEntry): Polarity {
  const vowel = resolveVowel(entry);
  return YANG_VOWELS.has(vowel) ? "Positive" : "Negative";
}

export class HangulCalculator extends EnergyCalculator {
  public readonly type = "Sound";
  private readonly chars: SoundChar[];

  constructor(surnameEntries: HanjaEntry[], givenEntries: HanjaEntry[]) {
    super();
    this.chars = mergeNameEntries(surnameEntries, givenEntries).map((entry, position) => ({
      char: entry.hangul,
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
      item.energy = createEnergy(resolveElement(item.entry), resolvePolarity(item.entry));
    }

    const energy = lastEnergy(this.chars);
    if (energy) {
      this.setEnergy(energy);
    }
  }

  public getSoundChars(): readonly SoundChar[] {
    return this.chars;
  }
}
