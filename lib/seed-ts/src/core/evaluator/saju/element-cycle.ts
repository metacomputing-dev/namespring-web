import type { Element } from "../../types.js";
import { clamp } from "../../utils.js";
import { ELEMENT_KEYS } from "../evaluator-context.js";

export function elementFromSajuCode(value: string | null | undefined): Element | null {
  switch (value) {
    case "WOOD":
      return "\u6728";
    case "FIRE":
      return "\u706B";
    case "EARTH":
      return "\u571F";
    case "METAL":
      return "\u91D1";
    case "WATER":
      return "\u6C34";
    default:
      return null;
  }
}

export function cycleNext(element: Element, offset: number): Element {
  const idx = ELEMENT_KEYS.indexOf(element);
  const next = (idx + offset + ELEMENT_KEYS.length) % ELEMENT_KEYS.length;
  return ELEMENT_KEYS[next]!;
}

export function generatedBy(element: Element): Element {
  return cycleNext(element, -1);
}

export function generates(element: Element): Element {
  return cycleNext(element, 1);
}

export function controls(element: Element): Element {
  return cycleNext(element, 2);
}

export function controlledBy(element: Element): Element {
  return cycleNext(element, -2);
}

export function elementCount(distribution: Record<Element, number>, element: Element | null): number {
  if (!element) {
    return 0;
  }
  return distribution[element] ?? 0;
}

export function totalCount(distribution: Record<Element, number>): number {
  return ELEMENT_KEYS.reduce((acc, key) => acc + (distribution[key] ?? 0), 0);
}

export function weightedElementAverage(
  distribution: Record<Element, number>,
  selector: (element: Element) => number,
): number {
  const total = totalCount(distribution);
  if (total <= 0) {
    return 0;
  }
  let weighted = 0;
  for (const element of ELEMENT_KEYS) {
    const count = distribution[element] ?? 0;
    if (count <= 0) {
      continue;
    }
    weighted += selector(element) * count;
  }
  return weighted / total;
}

export function normalizeSignedScore(value: number): number {
  return clamp((value + 1) * 50, 0, 100);
}
