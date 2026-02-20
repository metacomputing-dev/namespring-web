import type { BranchIdx, StemIdx } from './cycle.js';
import { mod } from './mod.js';

/** 본기/중기/여기 */
export type HiddenStemRole = 'MAIN' | 'MIDDLE' | 'RESIDUAL';

export interface HiddenStemBase {
  stem: StemIdx;
  role: HiddenStemRole;
}

export interface HiddenStem extends HiddenStemBase {
  /** Branch-internal weight. In `scheme='standard'`, sums to 1. */
  weight: number;
}

export type HiddenStemWeightScheme = 'standard' | 'equal';

export interface HiddenStemWeightPolicy {
  /**
   * Weight scheme within a branch.
   * - `standard`: (1), (0.7/0.3), (0.6/0.3/0.1)
   * - `equal`: 1/n for each hidden stem
   */
  scheme?: HiddenStemWeightScheme;

  /** Optional override for the `standard` scheme. Values are normalized per branch. */
  standard?: {
    one?: number;
    two?: { main: number; residual: number };
    three?: { main: number; middle: number; residual: number };
  };
}

const M: HiddenStemRole = 'MAIN';
const MD: HiddenStemRole = 'MIDDLE';
const R: HiddenStemRole = 'RESIDUAL';

const e = (stem: StemIdx, role: HiddenStemRole): HiddenStemBase => ({ stem, role });

/**
 * Minimal “raw” hidden-stem table (12 branches × up to 3 stems).
 *
 * Order per branch is significant:
 * - 1 stem: [MAIN]
 * - 2 stems: [MAIN, RESIDUAL]
 * - 3 stems: [MAIN, MIDDLE, RESIDUAL]
 */
export const rawHiddenStemsTable: ReadonlyArray<readonly HiddenStemBase[]> = [
  /* 子 */ [e(9, M)],
  /* 丑 */ [e(5, M), e(9, MD), e(7, R)],
  /* 寅 */ [e(0, M), e(2, MD), e(4, R)],
  /* 卯 */ [e(1, M)],
  /* 辰 */ [e(4, M), e(1, MD), e(9, R)],
  /* 巳 */ [e(2, M), e(6, MD), e(4, R)],
  /* 午 */ [e(3, M), e(5, R)],
  /* 未 */ [e(5, M), e(3, MD), e(1, R)],
  /* 申 */ [e(6, M), e(8, MD), e(4, R)],
  /* 酉 */ [e(7, M)],
  /* 戌 */ [e(4, M), e(7, MD), e(3, R)],
  /* 亥 */ [e(8, M), e(0, R)],
] as const;

function weightsForCount(n: number, scheme: HiddenStemWeightScheme, std?: HiddenStemWeightPolicy['standard']): number[] {
  if (n <= 0) return [];
  if (scheme === 'equal') return Array.from({ length: n }, () => 1 / n);

  // standard
  if (n === 1) return [std?.one ?? 1];
  if (n === 2) return [std?.two?.main ?? 0.7, std?.two?.residual ?? 0.3];
  return [std?.three?.main ?? 0.6, std?.three?.middle ?? 0.3, std?.three?.residual ?? 0.1];
}

function normalize(xs: number[]): number[] {
  const s = xs.reduce((a, x) => a + (Number.isFinite(x) ? x : 0), 0);
  if (s <= 0) return xs.map(() => 0);
  return xs.map((x) => x / s);
}

/**
 * Get hidden stems of a branch with weights.
 *
 * - Table is fixed (small) and expressed as indices.
 * - Weights are “policy”, not “data”: by default, `standard` uses (1), (0.7/0.3), (0.6/0.3/0.1).
 */
export function hiddenStemsOfBranch(branch: BranchIdx, policy: HiddenStemWeightPolicy = { scheme: 'standard' }): HiddenStem[] {
  const b = mod(branch, 12);
  const base = rawHiddenStemsTable[b] ?? [];
  const wRaw = weightsForCount(base.length, policy.scheme ?? 'standard', policy.standard);
  const w = normalize(wRaw);
  return base.map((x, i) => ({ ...x, weight: w[i] ?? 0 }));
}
