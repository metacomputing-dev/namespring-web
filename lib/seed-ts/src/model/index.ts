export type { Element, ElementRelation } from "./element.js";
export {
  ELEMENTS,
  elementFromCoreSymbol,
  elementFromStrokeLastDigit,
  elementRelation,
  elementToCoreSymbol,
  isGenerating,
  isOvercoming,
} from "./element.js";

export type { Energy, EnergyInput } from "./energy.js";
export { createEnergy, normalizeEnergy } from "./energy.js";

export type { Polarity, PolarityRelation } from "./polarity.js";
export {
  POLARITIES,
  oppositePolarity,
  polarityFromStrokeCount,
  polarityRelation,
  toCorePolarity,
  toPolarityFromCore,
} from "./polarity.js";

export type { Char, HangulChar, HanjaChar, NamePart, Sound } from "./terms.js";
