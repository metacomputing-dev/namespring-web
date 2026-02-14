import type { Element } from "./element.js";
import type { Polarity } from "./polarity.js";

export interface Energy {
  element: Element;
  polarity: Polarity;
}

export interface EnergyInput {
  element: Element;
  polarity?: Polarity;
}

export function createEnergy(element: Element, polarity: Polarity): Energy {
  return {
    element,
    polarity,
  };
}

export function normalizeEnergy(input: EnergyInput): Energy {
  return createEnergy(input.element, input.polarity ?? "Negative");
}
