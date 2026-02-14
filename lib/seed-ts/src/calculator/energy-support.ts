import { DEFAULT_POLARITY_BY_BIT } from "../core/constants.js";
import type { Element, Energy, Polarity } from "../core/types.js";

export function isPolarityBit(value: number): value is 0 | 1 {
  return value === 0 || value === 1;
}

export function polarityFromBit(value: number): Polarity {
  return DEFAULT_POLARITY_BY_BIT[(Math.abs(value) % 2) as 0 | 1];
}

export function toEnergy(element: Element, polarity: Polarity): Energy {
  return { element, polarity };
}

export function toEnergyFromBit(element: Element, polarityBit: number): Energy {
  return toEnergy(element, polarityFromBit(polarityBit));
}
