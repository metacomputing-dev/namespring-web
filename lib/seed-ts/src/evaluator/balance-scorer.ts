import type { ElementKey } from './element-cycle.js';
import {
  ELEMENT_KEYS,
  emptyDistribution,
  clamp,
} from './element-cycle.js';
import {
  SAJU_BALANCE_MOVE_PENALTY,
  SAJU_BALANCE_ZERO_PENALTY,
  SAJU_BALANCE_SPREAD_PENALTY,
  SAJU_BALANCE_PASS_THRESHOLD,
} from './scoring-constants.js';

export interface BalanceScoreResult {
  score: number;
  isPassed: boolean;
  combined: Record<ElementKey, number>;
}

export function computeSajuRootBalanceScore(
  sajuDistribution: Record<ElementKey, number>,
  rootElementDistribution: Record<ElementKey, number>,
): BalanceScoreResult {
  const initial = ELEMENT_KEYS.map(key => sajuDistribution[key] ?? 0);
  const rootElementCounts = ELEMENT_KEYS.map(key => rootElementDistribution[key] ?? 0);
  const finalArr = ELEMENT_KEYS.map((_, idx) => initial[idx] + rootElementCounts[idx]);
  const rootElementTotal = rootElementCounts.reduce((a, b) => a + b, 0);

  const elementDeltas = finalArr.map((value, idx) => value - initial[idx]);
  if (elementDeltas.some(v => v < 0)) {
    return { score: 0, isPassed: false, combined: emptyDistribution() };
  }
  if (elementDeltas.reduce((a, b) => a + b, 0) !== rootElementTotal) {
    return { score: 0, isPassed: false, combined: emptyDistribution() };
  }

  const optimal = computeOptimalSorted(initial, rootElementTotal);
  const finalSorted = [...finalArr].sort((a, b) => a - b);
  const isOptimal = finalSorted.every((value, idx) => value === optimal[idx]);
  const finalZero = finalArr.filter(v => v === 0).length;
  const optZero = optimal.filter(v => v === 0).length;
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
  const combined = Object.fromEntries(
    ELEMENT_KEYS.map((key, idx) => [key, finalArr[idx] ?? 0]),
  ) as Record<ElementKey, number>;

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
      level++;
      continue;
    }
    const cost = diff * width;
    if (remaining >= cost) {
      for (let k = 0; k <= level; k++) {
        sortedCounts[k] = (sortedCounts[k] ?? 0) + diff;
      }
      remaining -= cost;
      level++;
    } else {
      const evenShare = Math.floor(remaining / width);
      const remainder = remaining % width;
      for (let k = 0; k <= level; k++) {
        sortedCounts[k] = (sortedCounts[k] ?? 0) + evenShare;
      }
      for (let k = 0; k < remainder; k++) {
        sortedCounts[k] = (sortedCounts[k] ?? 0) + 1;
      }
      remaining = 0;
    }
  }
  if (remaining > 0) {
    const evenShare = Math.floor(remaining / 5);
    const remainder = remaining % 5;
    for (let k = 0; k < 5; k++) {
      sortedCounts[k] = (sortedCounts[k] ?? 0) + evenShare;
    }
    for (let k = 0; k < remainder; k++) {
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
