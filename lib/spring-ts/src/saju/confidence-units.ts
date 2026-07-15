/**
 * Explicit confidence-unit conversions at the saju/Spring boundary.
 *
 * Public legacy yongshin confidence is expressed as 0..100 points, while
 * scoring and consensus contracts use 0..1 ratios. Callers must select the
 * helper that matches their field contract; no value-based unit guessing is
 * performed here.
 */

/** Clamp a contractually point-based confidence to the closed interval 0..100. */
export function clampPoints(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/** Convert a contractually point-based (0..100) confidence to a 0..1 ratio. */
export function pointsToRatio(value: unknown): number {
  return clampPoints(value) / 100;
}

/** Clamp a contractually ratio-based confidence without guessing its unit. */
export function clampRatio(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
