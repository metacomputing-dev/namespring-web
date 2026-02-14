import type { Element as CoreElementSymbol } from "../core/types.js";

export const ELEMENTS = ["Wood", "Fire", "Earth", "Metal", "Water"] as const;
export type Element = (typeof ELEMENTS)[number];

export type ElementRelation = "Comparison" | "Generating" | "Overcoming" | "Neutral";

const CORE_SYMBOL_TO_ELEMENT: Record<CoreElementSymbol, Element> = {
  "木": "Wood",
  "火": "Fire",
  "土": "Earth",
  "金": "Metal",
  "水": "Water",
};

const ELEMENT_TO_CORE_SYMBOL: Record<Element, CoreElementSymbol> = {
  Wood: "木",
  Fire: "火",
  Earth: "土",
  Metal: "金",
  Water: "水",
};

const GENERATING_TARGET: Record<Element, Element> = {
  Wood: "Fire",
  Fire: "Earth",
  Earth: "Metal",
  Metal: "Water",
  Water: "Wood",
};

const OVERCOMING_TARGET: Record<Element, Element> = {
  Wood: "Earth",
  Fire: "Metal",
  Earth: "Water",
  Metal: "Wood",
  Water: "Fire",
};

export function elementFromCoreSymbol(value: CoreElementSymbol): Element {
  return CORE_SYMBOL_TO_ELEMENT[value];
}

export function elementToCoreSymbol(value: Element): CoreElementSymbol {
  return ELEMENT_TO_CORE_SYMBOL[value];
}

export function elementFromStrokeLastDigit(strokeCount: number): Element {
  const digit = Math.abs(strokeCount) % 10;
  if (digit === 1 || digit === 2) return "Wood";
  if (digit === 3 || digit === 4) return "Fire";
  if (digit === 5 || digit === 6) return "Earth";
  if (digit === 7 || digit === 8) return "Metal";
  return "Water";
}

export function isGenerating(from: Element, to: Element): boolean {
  return GENERATING_TARGET[from] === to;
}

export function isOvercoming(from: Element, to: Element): boolean {
  return OVERCOMING_TARGET[from] === to;
}

export function elementRelation(from: Element, to: Element): ElementRelation {
  if (from === to) return "Comparison";
  if (isGenerating(from, to)) return "Generating";
  if (isOvercoming(from, to)) return "Overcoming";
  return "Neutral";
}
