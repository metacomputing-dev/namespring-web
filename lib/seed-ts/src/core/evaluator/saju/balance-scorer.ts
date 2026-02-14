import type { Element } from "../../types.js";
import { clamp } from "../../utils.js";
import { distributionFromArrangement, ELEMENT_KEYS } from "../evaluator-context.js";
import {
  SAJU_BALANCE_MOVE_PENALTY,
  SAJU_BALANCE_ZERO_PENALTY,
  SAJU_BALANCE_SPREAD_PENALTY,
  SAJU_BALANCE_PASS_THRESHOLD,
} from "../scoring-constants.js";

export function computeSajuRootBalanceScore(
  sajuDistribution: Record<Element, number>,
  rootElementDistribution: Record<Element, number>,
): { score: number; isPassed: boolean; combined: Record<Element, number> } {
  const initial = ELEMENT_KEYS.map((key) => sajuDistribution[key] ?? 0);
  const rootElementCounts = ELEMENT_KEYS.map((key) => rootElementDistribution[key] ?? 0);
  const finalArr = ELEMENT_KEYS.map((_, idx) => initial[idx] + rootElementCounts[idx]);
  const rootElementTotal = rootElementCounts.reduce((a, b) => a + b, 0);

  const elementDeltas = finalArr.map((value, idx) => value - initial[idx]);
  if (elementDeltas.some((value) => value < 0)) {
    return { score: 0, isPassed: false, combined: distributionFromArrangement([]) };
  }
  if (elementDeltas.reduce((a, b) => a + b, 0) !== rootElementTotal) {
    return { score: 0, isPassed: false, combined: distributionFromArrangement([]) };
  }

  const optimal = computeOptimalSorted(initial, rootElementTotal);
  const finalSorted = [...finalArr].sort((a, b) => a - b);
  const isOptimal = finalSorted.every((value, idx) => value === optimal[idx]);
  const finalZero = finalArr.filter((value) => value === 0).length;
  const optZero = optimal.filter((value) => value === 0).length;
  const spread = spreadOf(finalArr);
  const optSpread = spreadOf(optimal);
  const manhattanDistance = finalSorted.reduce((acc, value, idx) => acc + Math.abs(value - optimal[idx]), 0);
  const moves = Math.floor(manhattanDistance / 2);

  let score = 0;
  if (rootElementTotal === 0 && finalArr.every((value, idx) => value === initial[idx])) {
    score = 100;
  } else if (isOptimal) {
    score = 100;
  } else {
    score =
      100 -
      SAJU_BALANCE_MOVE_PENALTY * moves -
      SAJU_BALANCE_ZERO_PENALTY * Math.max(0, finalZero - optZero) -
      SAJU_BALANCE_SPREAD_PENALTY * Math.max(0, spread - optSpread);
    score = clamp(score, 0, 100);
  }

  const isPassed = isOptimal || (finalZero <= optZero && spread <= optSpread && score >= SAJU_BALANCE_PASS_THRESHOLD);
  const combined: Record<Element, number> = {
    "\u6728": finalArr[0] ?? 0,
    "\u706B": finalArr[1] ?? 0,
    "\u571F": finalArr[2] ?? 0,
    "\u91D1": finalArr[3] ?? 0,
    "\u6C34": finalArr[4] ?? 0,
  };

  return { score, isPassed, combined };
}

export function computeOptimalSorted(initial: number[], resourceCount: number): number[] {
  const sortedCounts = [...initial].sort((a, b) => a - b);
  let remaining = resourceCount;
  let level = 0;
  while (level < ELEMENT_KEYS.length - 1 && remaining > 0) {
    const curr = sortedCounts[level] ?? 0;
    const next = sortedCounts[level + 1] ?? curr;
    const width = level + 1;
    const diff = next - curr;
    if (diff === 0) {
      level += 1;
      continue;
    }
    const cost = diff * width;
    if (remaining >= cost) {
      for (let k = 0; k <= level; k += 1) {
        sortedCounts[k] = (sortedCounts[k] ?? 0) + diff;
      }
      remaining -= cost;
      level += 1;
    } else {
      const evenShare = Math.floor(remaining / width);
      const remainder = remaining % width;
      for (let k = 0; k <= level; k += 1) {
        sortedCounts[k] = (sortedCounts[k] ?? 0) + evenShare;
      }
      for (let k = 0; k < remainder; k += 1) {
        sortedCounts[k] = (sortedCounts[k] ?? 0) + 1;
      }
      remaining = 0;
    }
  }
  if (remaining > 0) {
    const evenShare = Math.floor(remaining / 5);
    const remainder = remaining % 5;
    for (let k = 0; k < 5; k += 1) {
      sortedCounts[k] = (sortedCounts[k] ?? 0) + evenShare;
    }
    for (let k = 0; k < remainder; k += 1) {
      sortedCounts[k] = (sortedCounts[k] ?? 0) + 1;
    }
  }
  return sortedCounts;
}

export function spreadOf(values: number[]): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max - min;
}
