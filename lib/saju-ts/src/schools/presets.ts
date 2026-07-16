import type { EngineConfig } from '../api/types.js';
import { assertKnownEngineConfig } from '../api/configValidation.js';
import { deepClone, deepFreeze, deepMerge } from '../utils/deepMerge.js';

import type { SchoolPreset, SchoolPresetPack } from './packTypes.js';
import { buildPresetIndex, concatRuleSpecs, extractUserPresetPacks, materializePreset } from './packLoader.js';

// Built-in pack (data-only). This keeps the core engine clean and allows
// “schools” (유파) to be swapped/extended without touching code.
//
// NOTE: JSON module import requires a TS config that enables resolveJsonModule
// (and NodeNext module resolution in typical ESM setups).
import builtinPackRaw from './packs/builtin.pack.json' with { type: 'json' };

const BUILTIN_PACK: SchoolPresetPack = deepFreeze(deepClone(builtinPackRaw as SchoolPresetPack));

// Canonical list (exclude aliases) for discovery UIs.
const BUILTIN_PRESETS: SchoolPreset[] = deepFreeze(
  (BUILTIN_PACK.presets ?? []).map((d) => materializePreset(d as any, BUILTIN_PACK)),
);

// Fast lookup for built-in ids + aliases.
const BUILTIN_INDEX: Record<string, { preset: SchoolPreset; packId: string }> = deepFreeze(
  buildPresetIndex([BUILTIN_PACK]),
);

export type { SchoolPreset, SchoolPresetPack } from './packTypes.js';

/**
 * Raised when a caller explicitly selects a school preset that cannot be
 * resolved from the built-in and caller-provided preset packs.
 *
 * Keeping this as a structured error lets API consumers distinguish a
 * configuration mistake from an analysis/runtime failure.
 */
export class UnknownSchoolPresetError extends Error {
  readonly code = 'SAJU_UNKNOWN_SCHOOL_PRESET';
  readonly presetId: string;
  readonly availablePresetIds: string[];

  constructor(presetId: string, availablePresetIds: string[]) {
    super(`Unknown school preset: ${JSON.stringify(presetId)}`);
    this.name = 'UnknownSchoolPresetError';
    this.presetId = presetId;
    this.availablePresetIds = [...availablePresetIds];
  }
}

export function listSchoolPresets(): SchoolPreset[] {
  return deepClone(BUILTIN_PRESETS);
}

export function getSchoolPreset(id: string): SchoolPreset | null {
  if (!id) return null;
  const preset = BUILTIN_INDEX[id]?.preset;
  return preset ? deepClone(preset) : null;
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
  return [BUILTIN_PACK, ...deepClone(user)];
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

function listAvailablePresetIds(packs: SchoolPresetPack[]): string[] {
  return [...new Set(
    packs.flatMap((pack) => (pack.presets ?? [])
      .flatMap((preset) => [preset?.id, ...(preset?.aliases ?? [])])
      .filter((id): id is string => typeof id === 'string' && id.length > 0)),
  )].sort();
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
  assertKnownEngineConfig(baseConfig);
  const resolvedPacks = packs?.length ? packs : [BUILTIN_PACK];
  const p = resolvePresetFromPacks(presetId, resolvedPacks);
  if (!p) {
    throw new UnknownSchoolPresetError(presetId, listAvailablePresetIds(resolvedPacks));
  }

  assertKnownEngineConfig(p.overlay);
  const baseRuleSpecs = (baseConfig.extensions as any)?.ruleSpecs;
  const overlayRuleSpecs = (p.overlay.extensions as any)?.ruleSpecs;

  const merged = deepMerge(baseConfig, p.overlay) as EngineConfig;

  // Important: allow *composition* of school packs via "a+b" by concatenating ruleSpecs.
  // Without this, presets would overwrite each other's DSL packs due to array replacement semantics.
  const combined = concatRuleSpecsLocal(baseRuleSpecs, overlayRuleSpecs);
  if (combined != null) {
    const ext = ((merged.extensions as any) ?? {}) as any;
    merged.extensions = ext;
    ext.ruleSpecs = deepClone(combined);
  }

  assertKnownEngineConfig(merged);
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
