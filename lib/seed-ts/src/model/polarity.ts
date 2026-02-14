import type { Polarity as CorePolarity } from "../core/types.js";

export const POLARITIES = ["Negative", "Positive"] as const;
export type Polarity = (typeof POLARITIES)[number];

export type PolarityRelation = "Same" | "Opposite";

export function oppositePolarity(value: Polarity): Polarity {
  return value === "Positive" ? "Negative" : "Positive";
}

export function polarityFromStrokeCount(strokeCount: number): Polarity {
  return Math.abs(strokeCount) % 2 === 0 ? "Negative" : "Positive";
}

export function polarityRelation(left: Polarity, right: Polarity): PolarityRelation {
  return left === right ? "Same" : "Opposite";
}

export function toCorePolarity(value: Polarity): CorePolarity {
  return value === "Positive" ? "陽" : "陰";
}

export function toPolarityFromCore(value: CorePolarity): Polarity {
  return value === "陽" ? "Positive" : "Negative";
}
