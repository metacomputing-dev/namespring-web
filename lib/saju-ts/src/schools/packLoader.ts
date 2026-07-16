import type { EngineConfig } from '../api/types.js';
import { deepMerge } from '../utils/deepMerge.js';

import type {
  SchoolPreset,
  SchoolPresetDefinition,
  SchoolPresetPack,
  SchoolRuleSpecBlock,
} from './packTypes.js';
import {
  assertUniqueCompiledRuleIds,
  assertValidSchoolPresetPack,
  assertValidSchoolPresetOverlay,
  InvalidSchoolPresetPackError,
} from './schoolPackValidation.js';

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function copyRuleSpecs(source: any): Record<string, unknown> {
  const out: Record<string, unknown> = Object.create(null);
  for (const [key, value] of Object.entries(source ?? {})) out[key] = value;
  return out;
}

export function concatRuleSpecs(baseRuleSpecs: any, overlayRuleSpecs: any): any {
  if (!baseRuleSpecs && !overlayRuleSpecs) return undefined;
  if (!baseRuleSpecs) return copyRuleSpecs(overlayRuleSpecs);
  if (!overlayRuleSpecs) return copyRuleSpecs(baseRuleSpecs);

  const out = copyRuleSpecs(baseRuleSpecs);
  const keys = new Set<string>([
    ...Object.keys(baseRuleSpecs ?? {}),
    ...Object.keys(overlayRuleSpecs ?? {}),
  ]);

  for (const key of keys) {
    const base = (baseRuleSpecs as any)[key];
    const overlay = (overlayRuleSpecs as any)[key];
    if (base == null) {
      out[key] = overlay;
      continue;
    }
    if (overlay == null) {
      out[key] = base;
      continue;
    }
    // Both present: concatenate as spec arrays. Compilers support spec | spec[].
    out[key] = [...asArray(base), ...asArray(overlay)];
  }

  return out;
}

function requireOverlayBlock(
  pack: SchoolPresetPack,
  id: string,
): Partial<EngineConfig> {
  const block = pack.overlayBlocks?.[id];
  if (!block) {
    throw new InvalidSchoolPresetPackError(
      'schoolPresetPack.presets.include.overlayBlocks',
      'an existing overlay block id',
      pack.id,
    );
  }
  return block;
}

function requireRuleSpecBlock(
  pack: SchoolPresetPack,
  id: string,
): SchoolRuleSpecBlock {
  const block = pack.ruleSpecBlocks?.[id];
  if (!block) {
    throw new InvalidSchoolPresetPackError(
      'schoolPresetPack.presets.include.ruleSpecBlocks',
      'an existing rule-spec block id',
      pack.id,
    );
  }
  return block;
}

function mergeInclude(
  parent?: SchoolPresetDefinition['include'],
  child?: SchoolPresetDefinition['include'],
): SchoolPresetDefinition['include'] {
  const parentInclude = parent ?? {};
  const childInclude = child ?? {};
  const overlayBlocks = [
    ...(parentInclude.overlayBlocks ?? []),
    ...(childInclude.overlayBlocks ?? []),
  ];
  const ruleSpecBlocks = [
    ...(parentInclude.ruleSpecBlocks ?? []),
    ...(childInclude.ruleSpecBlocks ?? []),
  ];
  const out: SchoolPresetDefinition['include'] = {};
  if (overlayBlocks.length) out.overlayBlocks = overlayBlocks;
  if (ruleSpecBlocks.length) out.ruleSpecBlocks = ruleSpecBlocks;
  return Object.keys(out).length ? out : undefined;
}

function uniq<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function assertUniqueReferences(
  values: string[] | undefined,
  path: string,
  packId: string,
): void {
  const seen = new Set<string>();
  for (const value of values ?? []) {
    if (seen.has(value)) {
      throw new InvalidSchoolPresetPackError(
        path,
        'unique effective include references',
        packId,
      );
    }
    seen.add(value);
  }
}

function resolveExtends(
  definition: SchoolPresetDefinition,
  pack: SchoolPresetPack,
  stack: string[] = [],
): SchoolPresetDefinition {
  const parentId = definition.extends;
  if (!parentId) return definition;
  if (stack.includes(definition.id)) {
    throw new InvalidSchoolPresetPackError(
      'schoolPresetPack.presets.extends',
      'an acyclic parent chain',
      pack.id,
    );
  }

  const parent = pack.presets.find((preset) => preset.id === parentId);
  if (!parent) {
    throw new InvalidSchoolPresetPackError(
      'schoolPresetPack.presets.extends',
      'an existing preset id in the same pack',
      pack.id,
    );
  }

  const parentResolved = resolveExtends(parent, pack, [
    ...stack,
    definition.id,
  ]);
  const mergedOverlay = deepMerge(
    parentResolved.overlay ?? {},
    definition.overlay ?? {},
  ) as Partial<EngineConfig>;
  const mergedInclude = mergeInclude(
    parentResolved.include,
    definition.include,
  );
  assertUniqueReferences(
    mergedInclude?.overlayBlocks,
    'schoolPresetPack.presets.include.overlayBlocks',
    pack.id,
  );
  assertUniqueReferences(
    mergedInclude?.ruleSpecBlocks,
    'schoolPresetPack.presets.include.ruleSpecBlocks',
    pack.id,
  );
  const mergedSources = uniq([
    ...(parentResolved.sources ?? []),
    ...(definition.sources ?? []),
  ]);

  return {
    ...definition,
    overlay: Object.keys(mergedOverlay).length
      ? mergedOverlay
      : definition.overlay,
    include: mergedInclude,
    // Aliases belong to the child only. Inheriting a parent's aliases would
    // rebind those public lookup names to the derived preset.
    aliases: definition.aliases,
    sources: mergedSources.length ? mergedSources : definition.sources,
  };
}

function materializeValidatedPreset(
  definition: SchoolPresetDefinition,
  pack: SchoolPresetPack,
): SchoolPreset {
  const resolved = resolveExtends(definition, pack);

  // 1) Reusable overlay blocks.
  let overlay: Partial<EngineConfig> = {};
  for (const blockId of resolved.include?.overlayBlocks ?? []) {
    overlay = deepMerge(
      overlay,
      requireOverlayBlock(pack, blockId),
    ) as Partial<EngineConfig>;
  }

  // 2) Preset-local overlay.
  if (resolved.overlay) {
    overlay = deepMerge(overlay, resolved.overlay) as Partial<EngineConfig>;
  }

  // 3) RuleSpec blocks -> overlay.extensions.ruleSpecs.
  const blockIds = resolved.include?.ruleSpecBlocks ?? [];
  if (blockIds.length) {
    const ruleSpecs = Object.create(null) as Record<string, unknown>;
    for (const blockId of blockIds) {
      const block = requireRuleSpecBlock(pack, blockId);
      const previous = ruleSpecs[block.target];
      ruleSpecs[block.target] = previous == null
        ? block.spec
        : [...asArray(previous), ...asArray(block.spec)];
    }

    const extensions = ((overlay as any).extensions ?? {}) as Record<
      string,
      unknown
    >;
    (overlay as any).extensions = extensions;
    extensions.ruleSpecs = concatRuleSpecs(
      extensions.ruleSpecs,
      ruleSpecs,
    );
  }

  assertValidSchoolPresetOverlay(
    overlay,
    `schoolPresetPack.presets.${resolved.id}.overlay`,
    pack.id,
  );
  assertUniqueCompiledRuleIds(
    (overlay.extensions as any)?.ruleSpecs,
    `schoolPresetPack.presets.${resolved.id}.overlay.extensions.ruleSpecs`,
    pack.id,
  );

  return {
    id: resolved.id,
    name: resolved.name,
    description: resolved.description,
    aliases: resolved.aliases,
    sources: resolved.sources,
    overlay,
  };
}

/**
 * Expand a preset definition into a canonical preset with a materialized
 * overlay. The whole pack is validated before any inheritance is applied.
 */
export function materializePreset(
  definition: SchoolPresetDefinition,
  pack: SchoolPresetPack,
): SchoolPreset {
  assertValidSchoolPresetPack(pack);
  return materializeValidatedPreset(definition, pack);
}

export function buildPresetIndex(
  packs: SchoolPresetPack[],
): Record<string, { preset: SchoolPreset; packId: string }> {
  const out = Object.create(null) as Record<
    string,
    { preset: SchoolPreset; packId: string }
  >;

  // Later packs intentionally override earlier packs.
  const materialized: Array<{ preset: SchoolPreset; packId: string }> = [];
  const packIds = new Set<string>();
  for (let packIndex = 0; packIndex < packs.length; packIndex += 1) {
    const pack = packs[packIndex]!;
    assertValidSchoolPresetPack(pack, `schoolPresetPacks[${packIndex}]`);
    if (packIds.has(pack.id)) {
      throw new InvalidSchoolPresetPackError(
        `schoolPresetPacks[${packIndex}].id`,
        'a unique pack id',
        pack.id,
      );
    }
    packIds.add(pack.id);
    for (const definition of pack.presets) {
      materialized.push({
        preset: materializeValidatedPreset(definition, pack),
        packId: pack.id,
      });
    }
  }

  // Register aliases first.
  for (const entry of materialized) {
    for (const alias of entry.preset.aliases ?? []) out[alias] = entry;
  }
  // Exact ids always take precedence over aliases.
  for (const entry of materialized) out[entry.preset.id] = entry;

  return out;
}

/**
 * Extract user-provided packs from one supported data-first extension path.
 *
 * Supported locations:
 * - config.extensions.presetPacks
 * - config.extensions.schoolPacks
 * - config.extensions.schools.packs
 */
export function extractUserPresetPacks(
  config: EngineConfig,
): SchoolPresetPack[] {
  const extensions: any = (config.extensions as any) ?? {};
  const candidates: Array<{ path: string; value: unknown }> = [];

  if (
    Object.prototype.hasOwnProperty.call(extensions, 'presetPacks')
    && extensions.presetPacks !== undefined
  ) {
    candidates.push({
      path: 'config.extensions.presetPacks',
      value: extensions.presetPacks,
    });
  }
  if (
    Object.prototype.hasOwnProperty.call(extensions, 'schoolPacks')
    && extensions.schoolPacks !== undefined
  ) {
    candidates.push({
      path: 'config.extensions.schoolPacks',
      value: extensions.schoolPacks,
    });
  }
  if (
    extensions.schools
    && typeof extensions.schools === 'object'
    && !Array.isArray(extensions.schools)
    && Object.prototype.hasOwnProperty.call(extensions.schools, 'packs')
    && extensions.schools.packs !== undefined
  ) {
    candidates.push({
      path: 'config.extensions.schools.packs',
      value: extensions.schools.packs,
    });
  }

  if (candidates.length === 0) return [];
  if (candidates.length > 1) {
    throw new InvalidSchoolPresetPackError(
      candidates[1]!.path,
      'a single configured school-pack location',
    );
  }

  const [{ path, value: raw }] = candidates;
  const values = Array.isArray(raw) ? raw : [raw];
  const packs: SchoolPresetPack[] = [];
  const packIds = new Set<string>();

  for (let index = 0; index < values.length; index += 1) {
    const packPath = Array.isArray(raw) ? `${path}[${index}]` : path;
    const pack = values[index];
    assertValidSchoolPresetPack(pack, packPath);
    if (packIds.has(pack.id)) {
      throw new InvalidSchoolPresetPackError(
        `${packPath}.id`,
        'a unique user pack id',
        pack.id,
      );
    }
    packIds.add(pack.id);
    packs.push(pack);
  }

  return packs;
}
