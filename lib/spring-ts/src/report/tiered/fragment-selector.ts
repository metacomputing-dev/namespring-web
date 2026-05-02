/**
 * fragment-selector.ts -- Deterministic fragment pick + fallback chain
 *
 * Picks one fragment from the registry for a given (cell × feature) pair.
 * Selection is deterministic: a hash of (birth + targetDate + axis) keys
 * the variant choice. When no fragment matches all gating fields, the
 * leftmost dimension of the fallback priority list is relaxed first.
 */

import type {
  TieredCategoryId,
  TieredPeriodKind,
  TieredDepth,
} from '../types.js';
import type { FeatureVector } from './feature-selector.js';
import type { NarrativeFragment, FragmentRegistry } from './fragment-registry.js';

/** Fallback chain priority — relax the leftmost dimension first when no
 *  fragment matches all gating fields. Mirrors data/narrative/_contract/v1.json. */
const FALLBACK_DIMENSIONS = [
  'gender',
  'ageBand',
  'dayMasterStrength',
  'yongshinAlignment',
  'dayMasterElement',
  'yongshinElement',
  'gyeokguk',
] as const;

type Dim = typeof FALLBACK_DIMENSIONS[number];

function dimMatch(frag: NarrativeFragment, dim: Dim, feature: FeatureVector): boolean {
  const allow = (frag.gating as Record<string, readonly string[] | undefined>)[dim];
  if (!allow || allow.length === 0) return true; // wildcard
  const value = (feature as unknown as Record<string, unknown>)[dim];
  if (typeof value !== 'string') return false;
  return allow.includes(value);
}

function fragmentMatchesUntil(
  frag: NarrativeFragment,
  feature: FeatureVector,
  relaxBefore: number,
): boolean {
  for (let i = relaxBefore; i < FALLBACK_DIMENSIONS.length; i += 1) {
    if (!dimMatch(frag, FALLBACK_DIMENSIONS[i], feature)) return false;
  }
  return true;
}

/** FNV-1a 32-bit hash for deterministic selection. */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface SelectionContext {
  readonly seedKey: string;
}

export function selectFragment(
  registry: FragmentRegistry,
  category: 'overall' | TieredCategoryId,
  period: TieredPeriodKind,
  depth: TieredDepth,
  feature: FeatureVector,
  ctx: SelectionContext,
): NarrativeFragment | null {
  const candidates = registry.get(category, period, depth);
  if (candidates.length === 0) return null;

  // Try strictest match first, then relax the leftmost gating dimension.
  for (let relaxBefore = 0; relaxBefore <= FALLBACK_DIMENSIONS.length; relaxBefore += 1) {
    const matched = candidates.filter((frag) => fragmentMatchesUntil(frag, feature, relaxBefore));
    if (matched.length === 0) continue;
    const seed = fnv1a(`${ctx.seedKey}|${category}|${period}|${depth}`);
    return matched[seed % matched.length];
  }
  return null;
}

/** Build the seed key used by selectFragment.
 *  Inputs are joined in a fixed order: birth + target date + nothing else;
 *  the axis tuple is appended inside selectFragment per cell. */
export function buildSelectionSeed(
  birth: { year?: number | null; month?: number | null; day?: number | null; hour?: number | null; minute?: number | null; gender: string },
  targetDate: Date,
): string {
  return [
    birth.year ?? 0,
    birth.month ?? 0,
    birth.day ?? 0,
    birth.hour ?? 0,
    birth.minute ?? 0,
    birth.gender,
    targetDate.toISOString(),
  ].join('|');
}
