import type { EngineConfig } from '../api/types.js';
import { deepMerge } from '../utils/deepMerge.js';

import type { SchoolPreset, SchoolPresetPack } from './packTypes.js';
import { buildPresetIndex, concatRuleSpecs, extractUserPresetPacks, materializePreset } from './packLoader.js';

// Built-in pack (data-only). This keeps the core engine clean and allows
// “schools” (유파) to be swapped/extended without touching code.
//
// NOTE: JSON module import requires a TS config that enables resolveJsonModule
// (and NodeNext module resolution in typical ESM setups).
import builtinPackRaw from './packs/builtin.pack.json' with { type: 'json' };

const BUILTIN_PACK: SchoolPresetPack = builtinPackRaw as any;

// Canonical list (exclude aliases) for discovery UIs.
const BUILTIN_PRESETS: SchoolPreset[] = (BUILTIN_PACK.presets ?? []).map((d) => materializePreset(d as any, BUILTIN_PACK));

// Fast lookup for built-in ids + aliases.
const BUILTIN_INDEX: Record<string, { preset: SchoolPreset; packId: string }> = buildPresetIndex([BUILTIN_PACK]);

export type { SchoolPreset, SchoolPresetPack } from './packTypes.js';

export function listSchoolPresets(): SchoolPreset[] {
  return [...BUILTIN_PRESETS];
}

export function getSchoolPreset(id: string): SchoolPreset | null {
  if (!id) return null;
  return BUILTIN_INDEX[id]?.preset ?? null;
}

/**
 * Combine built-in pack with user-provided packs embedded in config.
 *
 * User packs can be provided (soft locations):
 * - config.extensions.presetPacks
 * - config.extensions.schoolPacks
 * - config.extensions.schools.packs
 */
export function resolveSchoolPresetPacks(config: EngineConfig): SchoolPresetPack[] {
  const user = extractUserPresetPacks(config);
  return [BUILTIN_PACK, ...user];
}

function resolvePresetFromPacks(presetId: string, packs: SchoolPresetPack[]): SchoolPreset | null {
  if (!presetId) return null;

  // Fast-path: if packs is exactly [BUILTIN_PACK], use the static index.
  if (packs.length === 1 && packs[0] === BUILTIN_PACK) {
    return BUILTIN_INDEX[presetId]?.preset ?? null;
  }

  // Build a local index so aliases work across packs.
  const idx = buildPresetIndex(packs);
  return idx[presetId]?.preset ?? null;
}

function concatRuleSpecsLocal(baseRuleSpecs: any, overlayRuleSpecs: any): any {
  // Re-exported helper, but keep a local wrapper to avoid leaking 'any' at call sites.
  return concatRuleSpecs(baseRuleSpecs, overlayRuleSpecs);
}

/**
 * Apply a preset overlay on top of a base config.
 *
 * - Uses deepMerge so nested config doesn't get erased
 * - Concatenates extensions.ruleSpecs buckets to allow composition ("a+b")
 */
export function applySchoolPreset(baseConfig: EngineConfig, presetId: string, packs?: SchoolPresetPack[]): EngineConfig {
  const p = resolvePresetFromPacks(presetId, packs?.length ? packs : [BUILTIN_PACK]);
  if (!p) return baseConfig;

  const baseRuleSpecs = (baseConfig.extensions as any)?.ruleSpecs;
  const overlayRuleSpecs = (p.overlay.extensions as any)?.ruleSpecs;

  const merged = deepMerge(baseConfig, p.overlay) as EngineConfig;

  // Important: allow *composition* of school packs via "a+b" by concatenating ruleSpecs.
  // Without this, presets would overwrite each other's DSL packs due to array replacement semantics.
  const combined = concatRuleSpecsLocal(baseRuleSpecs, overlayRuleSpecs);
  if (combined != null) {
    const ext = ((merged.extensions as any) ?? {}) as any;
    merged.extensions = ext;
    ext.ruleSpecs = combined;
  }

  return merged;
}

/**
 * Utility: apply multiple presets in order.
 * (Used internally by config normalization, but kept exported for power-users.)
 */
export function applySchoolPresets(baseConfig: EngineConfig, presetIds: string[], packs?: SchoolPresetPack[]): EngineConfig {
  let out = baseConfig;
  const ps = packs?.length ? packs : [BUILTIN_PACK];
  for (const id of presetIds ?? []) {
    out = applySchoolPreset(out, id, ps);
  }
  return out;
}
