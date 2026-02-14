import type { Element } from "../types.js";
import { clamp } from "../utils.js";
import { distributionFromArrangement, ELEMENT_KEYS } from "./evaluator-context.js";

export function computeSajuRootBalanceScore(
  sajuDistribution: Record<Element, number>,
  rootElementDistribution: Record<Element, number>,
): { score: number; isPassed: boolean; combined: Record<Element, number> } {
  const initial = ELEMENT_KEYS.map((key) => sajuDistribution[key] ?? 0);
  const rootElementCounts = ELEMENT_KEYS.map((key) => rootElementDistribution[key] ?? 0);
  const finalArr = ELEMENT_KEYS.map((_, idx) => initial[idx] + rootElementCounts[idx]);
  const r = rootElementCounts.reduce((a, b) => a + b, 0);

  const delta = finalArr.map((value, idx) => value - initial[idx]);
  if (delta.some((value) => value < 0)) {
    return {
      score: 0,
      isPassed: false,
      combined: distributionFromArrangement([]),
    };
  }
  if (delta.reduce((a, b) => a + b, 0) !== r) {
    return {
      score: 0,
      isPassed: false,
      combined: distributionFromArrangement([]),
    };
  }

  const optimal = computeOptimalSorted(initial, r);
  const finalSorted = [...finalArr].sort((a, b) => a - b);
  const isOptimal = finalSorted.every((value, idx) => value === optimal[idx]);
  const finalZero = finalArr.filter((value) => value === 0).length;
  const optZero = optimal.filter((value) => value === 0).length;
  const spread = spreadOf(finalArr);
  const optSpread = spreadOf(optimal);
  const l1 = finalSorted.reduce((acc, value, idx) => acc + Math.abs(value - optimal[idx]), 0);
  const moves = Math.floor(l1 / 2);

  let score = 0;
  if (r === 0 && finalArr.every((value, idx) => value === initial[idx])) {
    score = 100;
  } else if (isOptimal) {
    score = 100;
  } else {
    score = 100 - 20 * moves - 10 * Math.max(0, finalZero - optZero) - 5 * Math.max(0, spread - optSpread);
    score = clamp(score, 0, 100);
  }

  const isPassed = isOptimal || (finalZero <= optZero && spread <= optSpread && score >= 70);
  const combined: Record<Element, number> = {
    "\u6728": finalArr[0] ?? 0,
    "\u706B": finalArr[1] ?? 0,
    "\u571F": finalArr[2] ?? 0,
    "\u91D1": finalArr[3] ?? 0,
    "\u6C34": finalArr[4] ?? 0,
  };

  return { score, isPassed, combined };
}

function computeOptimalSorted(initial: number[], resourceCount: number): number[] {
  const s = [...initial].sort((a, b) => a - b);
  let rem = resourceCount;
  let i = 0;
  while (i < 4 && rem > 0) {
    const curr = s[i] ?? 0;
    const next = s[i + 1] ?? curr;
    const width = i + 1;
    const diff = next - curr;
    if (diff === 0) {
      i += 1;
      continue;
    }
    const cost = diff * width;
    if (rem >= cost) {
      for (let k = 0; k <= i; k += 1) {
        s[k] = (s[k] ?? 0) + diff;
      }
      rem -= cost;
      i += 1;
    } else {
      const q = Math.floor(rem / width);
      const r = rem % width;
      for (let k = 0; k <= i; k += 1) {
        s[k] = (s[k] ?? 0) + q;
      }
      for (let k = 0; k < r; k += 1) {
        s[k] = (s[k] ?? 0) + 1;
      }
      rem = 0;
    }
  }
  if (rem > 0) {
    const q = Math.floor(rem / 5);
    const r = rem % 5;
    for (let k = 0; k < 5; k += 1) {
      s[k] = (s[k] ?? 0) + q;
    }
    for (let k = 0; k < r; k += 1) {
      s[k] = (s[k] ?? 0) + 1;
    }
  }
  return s;
}

function spreadOf(values: number[]): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max - min;
}
