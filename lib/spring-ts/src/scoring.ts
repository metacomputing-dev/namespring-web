/**
 * scoring.ts -- Shared scoring utilities for spring-ts.
 *
 * Pure mathematical functions with no external dependencies.
 * Ported from name-ts/calculator/scoring.ts for standalone use.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ElementKey = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';

export const ELEMENT_KEYS: readonly ElementKey[] = [
  'Wood', 'Fire', 'Earth', 'Metal', 'Water',
] as const;

// ---------------------------------------------------------------------------
// General Math Helpers
// ---------------------------------------------------------------------------

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const normalizeSignedScore = (value: number): number =>
  clamp((value + 1) * 50, 0, 100);

// ---------------------------------------------------------------------------
// Distribution Helpers
// ---------------------------------------------------------------------------

export const emptyDistribution = (): Record<ElementKey, number> =>
  ({ Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 });

export function distributionFromArrangement(
  arrangement: readonly ElementKey[],
): Record<ElementKey, number> {
  const distribution = emptyDistribution();
  for (const element of arrangement) distribution[element]++;
  return distribution;
}

export const elementCount = (
  distribution: Record<ElementKey, number>,
  element: ElementKey | null,
): number =>
  element ? (distribution[element] ?? 0) : 0;

export const totalCount = (distribution: Record<ElementKey, number>): number =>
  ELEMENT_KEYS.reduce((sum, key) => sum + (distribution[key] ?? 0), 0);

export function weightedElementAverage(
  distribution: Record<ElementKey, number>,
  selector: (element: ElementKey) => number,
): number {
  const total = totalCount(distribution);
  if (total <= 0) return 0;
  const weightedSum = ELEMENT_KEYS.reduce(
    (accumulated, element) => accumulated + selector(element) * (distribution[element] ?? 0),
    0,
  );
  return weightedSum / total;
}

// ---------------------------------------------------------------------------
// Five-Element Cycle Helpers
// ---------------------------------------------------------------------------

export const generatedBy = (element: ElementKey): ElementKey =>
  ELEMENT_KEYS[(ELEMENT_KEYS.indexOf(element) + 4) % 5];

// ---------------------------------------------------------------------------
// Stroke-sum normalization (81-cycle)
// ---------------------------------------------------------------------------

export const adjustTo81 = (value: number): number =>
  value <= 81 ? value : ((value - 1) % 81) + 1;

// ---------------------------------------------------------------------------
// Fortune Bucket Lookup
// ---------------------------------------------------------------------------

const FORTUNE_BUCKETS: { keyword: string; score: number }[] = [
  { keyword: '최상', score: 10 },
  { keyword: '상',   score: 8 },
  { keyword: '양',   score: 6 },
  { keyword: '흉',   score: 2 },
];
const FORTUNE_DEFAULT_SCORE = 4;

export function bucketFromFortune(fortune: string): number {
  const text = fortune ?? '';
  for (const bucket of FORTUNE_BUCKETS) {
    if (text.includes(bucket.keyword)) return bucket.score;
  }
  return FORTUNE_DEFAULT_SCORE;
}
