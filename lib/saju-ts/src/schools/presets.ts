import type { EngineConfig } from '../api/types.js';
import {
  assertKnownEngineConfig,
  InvalidEngineConfigError,
} from '../api/configValidation.js';
import { deepClone, deepFreeze, deepMerge } from '../utils/deepMerge.js';

import type { SchoolPreset, SchoolPresetPack } from './packTypes.js';
import { buildPresetIndex, concatRuleSpecs, extractUserPresetPacks, materializePreset } from './packLoader.js';
import {
  assertUniqueCompiledRuleIds,
  assertValidSchoolPresetPack,
  InvalidSchoolPresetPackError,
} from './schoolPackValidation.js';

// Built-in pack (data-only). This keeps the core engine clean and allows
// “schools” (유파) to be swapped/extended without touching code.
//
// NOTE: JSON module import requires a TS config that enables resolveJsonModule
// (and NodeNext module resolution in typical ESM setups).
import builtinPackRaw from './packs/builtin.pack.json' with { type: 'json' };

const builtinPackSnapshot = deepClone(builtinPackRaw as SchoolPresetPack);
assertValidSchoolPresetPack(builtinPackSnapshot, 'builtinSchoolPresetPack');
const BUILTIN_PACK: SchoolPresetPack = deepFreeze(builtinPackSnapshot);

// Canonical list (exclude aliases) for discovery UIs.
const BUILTIN_PRESETS: SchoolPreset[] = deepFreeze(
  (BUILTIN_PACK.presets ?? []).map((d) => materializePreset(d as any, BUILTIN_PACK)),
);

// Fast lookup for built-in ids + aliases.
const BUILTIN_INDEX: Record<string, { preset: SchoolPreset; packId: string }> = deepFreeze(
  buildPresetIndex([BUILTIN_PACK]),
);

export type { SchoolPreset, SchoolPresetPack } from './packTypes.js';
export { InvalidSchoolPresetPackError };

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
  const packs = [BUILTIN_PACK, ...deepClone(user)];
  const packIds = new Set<string>();
  for (let index = 0; index < packs.length; index += 1) {
    const pack = packs[index]!;
    if (packIds.has(pack.id)) {
      throw new InvalidSchoolPresetPackError(
        `schoolPresetPacks[${index}].id`,
        'a unique pack id including the built-in pack',
        pack.id,
      );
    }
    packIds.add(pack.id);
  }
  return packs;
}

function resolvePresetFromPacks(
  presetId: string,
  packs: SchoolPresetPack[],
): { preset: SchoolPreset; packId: string } | null {
  if (!presetId) return null;

  // Fast-path: if packs is exactly [BUILTIN_PACK], use the static index.
  if (packs.length === 1 && packs[0] === BUILTIN_PACK) {
    return BUILTIN_INDEX[presetId] ?? null;
  }

  // Build a local index so aliases work across packs.
  const idx = buildPresetIndex(packs);
  return idx[presetId] ?? null;
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

function assertConfigRuleSpecs(ruleSpecs: unknown): void {
  try {
    assertUniqueCompiledRuleIds(
      ruleSpecs,
      'config.extensions.ruleSpecs',
    );
  } catch (error) {
    if (error instanceof InvalidSchoolPresetPackError) {
      const path = error.path.startsWith('config.')
        ? error.path.slice('config.'.length)
        : error.path;
      throw new InvalidEngineConfigError(
        path,
        'valid school rule specifications with unique compiled rule ids',
      );
    }
    throw error;
  }
}

function resolvePackArgument(packs: SchoolPresetPack[] | undefined): SchoolPresetPack[] {
  if (packs === undefined) return [BUILTIN_PACK];
  if (!Array.isArray(packs)) {
    throw new InvalidSchoolPresetPackError(
      'schoolPresetPacks',
      'an array',
    );
  }
  if (packs.length === 0) return [BUILTIN_PACK];

  const snapshot: SchoolPresetPack[] = [];
  for (let index = 0; index < packs.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(packs, String(index));
    if (!descriptor || !('value' in descriptor)) {
      throw new InvalidSchoolPresetPackError(
        `schoolPresetPacks[${index}]`,
        'a data property containing a school preset pack',
      );
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function applySchoolPresetFromPacks(
  baseConfig: EngineConfig,
  presetId: string,
  resolvedPacks: SchoolPresetPack[],
): EngineConfig {
  const baseSnapshot = deepClone(baseConfig);
  assertKnownEngineConfig(baseSnapshot);
  const resolved = resolvePresetFromPacks(presetId, resolvedPacks);
  if (!resolved) {
    throw new UnknownSchoolPresetError(
      presetId,
      listAvailablePresetIds(resolvedPacks),
    );
  }
  const { preset: p, packId } = resolved;

  assertKnownEngineConfig(p.overlay);
  const baseRuleSpecs = (baseSnapshot.extensions as any)?.ruleSpecs;
  const overlayRuleSpecs = (p.overlay.extensions as any)?.ruleSpecs;
  assertConfigRuleSpecs(baseRuleSpecs);
  assertUniqueCompiledRuleIds(
    overlayRuleSpecs,
    'schoolPreset.overlay.extensions.ruleSpecs',
    packId,
  );

  const merged = deepMerge(baseSnapshot, p.overlay) as EngineConfig;

  // Allow composition by concatenating rule specs rather than replacing arrays.
  const combined = concatRuleSpecsLocal(baseRuleSpecs, overlayRuleSpecs);
  if (combined != null) {
    const ext = ((merged.extensions as any) ?? {}) as any;
    merged.extensions = ext;
    ext.ruleSpecs = deepClone(combined);
    assertUniqueCompiledRuleIds(
      ext.ruleSpecs,
      'config.extensions.ruleSpecs',
      packId,
    );
  }

  assertKnownEngineConfig(merged);
  return merged;
}

/**
 * Apply a preset overlay on top of a base config.
 *
 * - Uses deepMerge so nested config doesn't get erased
 * - Concatenates extensions.ruleSpecs buckets to allow composition ("a+b")
 */
export function applySchoolPreset(baseConfig: EngineConfig, presetId: string, packs?: SchoolPresetPack[]): EngineConfig {
  return applySchoolPresetFromPacks(
    baseConfig,
    presetId,
    resolvePackArgument(packs),
  );
}

/**
 * Utility: apply multiple presets in order.
 * (Used internally by config normalization, but kept exported for power-users.)
 */
export function applySchoolPresets(baseConfig: EngineConfig, presetIds: string[], packs?: SchoolPresetPack[]): EngineConfig {
  let out = baseConfig;
  const resolvedPacks = resolvePackArgument(packs);
  for (const id of presetIds ?? []) {
    out = applySchoolPresetFromPacks(out, id, resolvedPacks);
  }
  return out;
}
