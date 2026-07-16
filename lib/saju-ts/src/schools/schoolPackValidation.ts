import { assertKnownEngineConfig } from '../api/configValidation.js';
import { compileGyeokgukRuleSpec } from '../rules/spec/compileGyeokgukSpec.js';
import { compileShinsalConditionsRuleSpec } from '../rules/spec/compileShinsalConditionsSpec.js';
import { compileShinsalRuleSpec } from '../rules/spec/compileShinsalSpec.js';
import { compileYongshinRuleSpec } from '../rules/spec/compileYongshinSpec.js';
import {
  assertValidKnownRuleSpec,
  InvalidRuleSpecError,
} from '../rules/spec/ruleSpecValidation.js';
import type {
  SchoolPresetDefinition,
  SchoolPresetPack,
} from './packTypes.js';

/** Raised when a data-driven school preset pack cannot be interpreted safely. */
export class InvalidSchoolPresetPackError extends TypeError {
  readonly code = 'SAJU_INVALID_SCHOOL_PRESET_PACK';
  readonly path: string;
  readonly packId?: string;

  constructor(path: string, expected: string, packId?: string) {
    super(`Invalid school preset pack at ${path}: expected ${expected}.`);
    this.name = 'InvalidSchoolPresetPackError';
    this.path = path;
    this.packId = packId;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function assertDataOnly(
  value: unknown,
  path: string,
  visiting = new WeakSet<object>(),
  visited = new WeakSet<object>(),
): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new InvalidSchoolPresetPackError(path, 'a finite number');
  }
  if (
    typeof value === 'function'
    || typeof value === 'symbol'
    || typeof value === 'bigint'
  ) {
    throw new InvalidSchoolPresetPackError(path, 'data-only JSON-compatible values');
  }
  if (value === null || typeof value !== 'object') return;

  const source = value as object;
  if (visiting.has(source)) {
    throw new InvalidSchoolPresetPackError(path, 'an acyclic data graph');
  }
  if (visited.has(source)) return;
  if (!Array.isArray(value) && !isRecord(value)) {
    throw new InvalidSchoolPresetPackError(path, 'a plain data object');
  }

  visiting.add(source);
  for (const key of Reflect.ownKeys(source)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key === 'symbol') {
      throw new InvalidSchoolPresetPackError(path, 'string-keyed data');
    }
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      throw new InvalidSchoolPresetPackError(
        `${path}.${key}`,
        'an enumerable data property',
      );
    }
    assertDataOnly(
      descriptor.value,
      Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`,
      visiting,
      visited,
    );
  }
  visiting.delete(source);
  visited.add(source);
}

function assertRecord(
  value: unknown,
  path: string,
  packId?: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new InvalidSchoolPresetPackError(path, 'an object', packId);
  }
}

function assertKnownKeys(
  record: Record<string, unknown>,
  path: string,
  allowed: readonly string[],
  packId?: string,
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) {
      throw new InvalidSchoolPresetPackError(
        `${path}.${key}`,
        'a supported field',
        packId,
      );
    }
  }
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  packId?: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidSchoolPresetPackError(path, 'a non-empty string', packId);
  }
  return value;
}

function assertOptionalString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  packId?: string,
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  readRequiredString(record, key, path, packId);
}

function readOptionalStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
  packId: string | undefined,
  rejectDuplicates: boolean,
): string[] {
  if (!hasOwn(record, key) || record[key] === undefined) return [];
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new InvalidSchoolPresetPackError(path, 'an array of non-empty strings', packId);
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new InvalidSchoolPresetPackError(
        `${path}[${index}]`,
        'a non-empty string',
        packId,
      );
    }
    if (rejectDuplicates && seen.has(item)) {
      throw new InvalidSchoolPresetPackError(
        `${path}[${index}]`,
        'a unique reference',
        packId,
      );
    }
    seen.add(item);
    result.push(item);
  }
  return result;
}

export function assertValidSchoolPresetOverlay(
  value: unknown,
  path: string,
  packId?: string,
): void {
  assertRecord(value, path, packId);
  assertKnownEngineConfig(value);
}

const PACK_KEYS = [
  'schemaVersion',
  'id',
  'name',
  'description',
  'overlayBlocks',
  'ruleSpecBlocks',
  'presets',
] as const;

const PRESET_KEYS = [
  'id',
  'name',
  'description',
  'extends',
  'aliases',
  'sources',
  'overlay',
  'include',
] as const;

const INCLUDE_KEYS = ['overlayBlocks', 'ruleSpecBlocks'] as const;
const RULE_SPEC_BLOCK_KEYS = ['target', 'spec'] as const;

const RULE_SPEC_COMPILERS = new Map<
  string,
  (input: any) => { rules: Array<{ id: string }> }
>([
  ['yongshin', compileYongshinRuleSpec],
  ['gyeokguk', compileGyeokgukRuleSpec],
  ['shinsal', compileShinsalRuleSpec],
  ['shinsalConditions', compileShinsalConditionsRuleSpec],
]);

function assertSelectorToken(
  value: string,
  path: string,
  packId?: string,
): void {
  if (value !== value.trim() || /[+,]/.test(value)) {
    throw new InvalidSchoolPresetPackError(
      path,
      'a trimmed selector token without "+" or ","',
      packId,
    );
  }
}

/**
 * Compile every rule bucket consumed by the engine and reject duplicate
 * concrete rule ids. Unknown targets remain open for future extensions.
 */
export function assertUniqueCompiledRuleIds(
  ruleSpecs: unknown,
  path: string,
  packId?: string,
): void {
  if (ruleSpecs === undefined) return;
  assertDataOnly(ruleSpecs, path);
  assertRecord(ruleSpecs, path, packId);

  for (const [target, spec] of Object.entries(ruleSpecs)) {
    const compiler = RULE_SPEC_COMPILERS.get(target);
    if (!compiler) continue;
    // Public compiler helpers keep [] as a programmatic "use defaults" shortcut.
    // Persisted EngineConfig/school-pack payloads must be explicit instead: an
    // empty block is much more likely to be an omitted or truncated policy.
    if (Array.isArray(spec) && spec.length === 0) {
      throw new InvalidSchoolPresetPackError(
        `${path}.${target}`,
        'a non-empty rule specification',
        packId,
      );
    }

    let compiled: { rules: Array<{ id: string }> };
    try {
      assertValidKnownRuleSpec(target, spec, `${path}.${target}`);
      compiled = compiler(spec);
    } catch (error) {
      if (error instanceof InvalidRuleSpecError) {
        const owningPath = `${path}.${target}`;
        const errorPath = error.path.startsWith(`compiledRuleSets.${target}`)
          ? owningPath
          : error.path;
        throw new InvalidSchoolPresetPackError(
          errorPath,
          error.expected,
          packId,
        );
      }
      throw new InvalidSchoolPresetPackError(
        `${path}.${target}`,
        'a compilable rule specification',
        packId,
      );
    }

    const seen = new Set<string>();
    for (let index = 0; index < compiled.rules.length; index += 1) {
      const ruleId = compiled.rules[index]?.id;
      if (typeof ruleId !== 'string' || ruleId.length === 0) {
        throw new InvalidSchoolPresetPackError(
          `${path}.${target}`,
          'compiled rules with non-empty ids',
          packId,
        );
      }
      if (seen.has(ruleId)) {
        throw new InvalidSchoolPresetPackError(
          `${path}.${target}`,
          'unique compiled rule ids',
          packId,
        );
      }
      seen.add(ruleId);
    }
  }
}

interface ValidatedPreset {
  definition: SchoolPresetDefinition;
  index: number;
  id: string;
  parentId?: string;
  overlayRefs: string[];
  ruleSpecRefs: string[];
  aliases: string[];
}

/**
 * Validate a school pack before any inheritance or include materialization.
 *
 * The pack is a closed data contract. Rule-spec payloads remain target-defined,
 * but pack structure, references, inheritance, and engine overlays fail closed.
 */
export function assertValidSchoolPresetPack(
  pack: unknown,
  path = 'schoolPresetPack',
): asserts pack is SchoolPresetPack {
  assertRecord(pack, path);
  assertDataOnly(pack, path);
  assertKnownKeys(pack, path, PACK_KEYS);

  const schemaVersion = readRequiredString(
    pack,
    'schemaVersion',
    `${path}.schemaVersion`,
  );
  if (schemaVersion !== '1') {
    throw new InvalidSchoolPresetPackError(
      `${path}.schemaVersion`,
      JSON.stringify('1'),
    );
  }

  const packId = readRequiredString(pack, 'id', `${path}.id`);
  assertOptionalString(pack, 'name', `${path}.name`, packId);
  assertOptionalString(pack, 'description', `${path}.description`, packId);

  const overlayBlockIds = new Set<string>();
  if (hasOwn(pack, 'overlayBlocks') && pack.overlayBlocks !== undefined) {
    assertRecord(pack.overlayBlocks, `${path}.overlayBlocks`, packId);
    for (const [blockId, block] of Object.entries(pack.overlayBlocks)) {
      if (blockId.trim().length === 0) {
        throw new InvalidSchoolPresetPackError(
          `${path}.overlayBlocks`,
          'non-empty block ids',
          packId,
        );
      }
      overlayBlockIds.add(blockId);
      assertValidSchoolPresetOverlay(
        block,
        `${path}.overlayBlocks.${blockId}`,
        packId,
      );
    }
  }

  const ruleSpecBlockIds = new Set<string>();
  if (hasOwn(pack, 'ruleSpecBlocks') && pack.ruleSpecBlocks !== undefined) {
    assertRecord(pack.ruleSpecBlocks, `${path}.ruleSpecBlocks`, packId);
    for (const [blockId, block] of Object.entries(pack.ruleSpecBlocks)) {
      if (blockId.trim().length === 0) {
        throw new InvalidSchoolPresetPackError(
          `${path}.ruleSpecBlocks`,
          'non-empty block ids',
          packId,
        );
      }
      const blockPath = `${path}.ruleSpecBlocks.${blockId}`;
      assertRecord(block, blockPath, packId);
      assertKnownKeys(block, blockPath, RULE_SPEC_BLOCK_KEYS, packId);
      const target = readRequiredString(
        block,
        'target',
        `${blockPath}.target`,
        packId,
      );
      if (target !== target.trim()) {
        throw new InvalidSchoolPresetPackError(
          `${blockPath}.target`,
          'a trimmed non-empty target',
          packId,
        );
      }
      if (!hasOwn(block, 'spec') || block.spec === undefined || block.spec === null) {
        throw new InvalidSchoolPresetPackError(
          `${blockPath}.spec`,
          'a rule specification payload',
          packId,
        );
      }
      if (RULE_SPEC_COMPILERS.has(target)) {
        assertUniqueCompiledRuleIds(
          { [target]: block.spec },
          `${blockPath}.compiled`,
          packId,
        );
      }
      ruleSpecBlockIds.add(blockId);
    }
  }

  if (!Array.isArray(pack.presets)) {
    throw new InvalidSchoolPresetPackError(
      `${path}.presets`,
      'an array',
      packId,
    );
  }

  const presets: ValidatedPreset[] = [];
  const presetsById = new Map<string, ValidatedPreset>();
  for (let index = 0; index < pack.presets.length; index += 1) {
    const definition = pack.presets[index];
    const presetPath = `${path}.presets[${index}]`;
    assertRecord(definition, presetPath, packId);
    assertKnownKeys(definition, presetPath, PRESET_KEYS, packId);

    const id = readRequiredString(definition, 'id', `${presetPath}.id`, packId);
    assertSelectorToken(id, `${presetPath}.id`, packId);
    readRequiredString(definition, 'name', `${presetPath}.name`, packId);
    readRequiredString(
      definition,
      'description',
      `${presetPath}.description`,
      packId,
    );

    if (presetsById.has(id)) {
      throw new InvalidSchoolPresetPackError(
        `${presetPath}.id`,
        'a unique preset id within the pack',
        packId,
      );
    }

    let parentId: string | undefined;
    if (hasOwn(definition, 'extends') && definition.extends !== undefined) {
      parentId = readRequiredString(
        definition,
        'extends',
        `${presetPath}.extends`,
        packId,
      );
      assertSelectorToken(parentId, `${presetPath}.extends`, packId);
    }

    const aliases = readOptionalStringArray(
      definition,
      'aliases',
      `${presetPath}.aliases`,
      packId,
      true,
    );
    for (let aliasIndex = 0; aliasIndex < aliases.length; aliasIndex += 1) {
      assertSelectorToken(
        aliases[aliasIndex]!,
        `${presetPath}.aliases[${aliasIndex}]`,
        packId,
      );
    }
    readOptionalStringArray(
      definition,
      'sources',
      `${presetPath}.sources`,
      packId,
      false,
    );

    if (hasOwn(definition, 'overlay') && definition.overlay !== undefined) {
      assertValidSchoolPresetOverlay(
        definition.overlay,
        `${presetPath}.overlay`,
        packId,
      );
    }

    let overlayRefs: string[] = [];
    let ruleSpecRefs: string[] = [];
    if (hasOwn(definition, 'include') && definition.include !== undefined) {
      const includePath = `${presetPath}.include`;
      assertRecord(definition.include, includePath, packId);
      assertKnownKeys(definition.include, includePath, INCLUDE_KEYS, packId);
      overlayRefs = readOptionalStringArray(
        definition.include,
        'overlayBlocks',
        `${includePath}.overlayBlocks`,
        packId,
        true,
      );
      ruleSpecRefs = readOptionalStringArray(
        definition.include,
        'ruleSpecBlocks',
        `${includePath}.ruleSpecBlocks`,
        packId,
        true,
      );
    }

    const validated: ValidatedPreset = {
      definition: definition as unknown as SchoolPresetDefinition,
      index,
      id,
      parentId,
      overlayRefs,
      ruleSpecRefs,
      aliases,
    };
    presets.push(validated);
    presetsById.set(id, validated);
  }

  for (const preset of presets) {
    const presetPath = `${path}.presets[${preset.index}]`;
    if (preset.parentId && !presetsById.has(preset.parentId)) {
      throw new InvalidSchoolPresetPackError(
        `${presetPath}.extends`,
        'an existing preset id in the same pack',
        packId,
      );
    }
    for (let index = 0; index < preset.overlayRefs.length; index += 1) {
      if (!overlayBlockIds.has(preset.overlayRefs[index]!)) {
        throw new InvalidSchoolPresetPackError(
          `${presetPath}.include.overlayBlocks[${index}]`,
          'an existing overlay block id',
          packId,
        );
      }
    }
    for (let index = 0; index < preset.ruleSpecRefs.length; index += 1) {
      if (!ruleSpecBlockIds.has(preset.ruleSpecRefs[index]!)) {
        throw new InvalidSchoolPresetPackError(
          `${presetPath}.include.ruleSpecBlocks[${index}]`,
          'an existing rule-spec block id',
          packId,
        );
      }
    }
  }

  const visitState = new Map<string, 'visiting' | 'visited'>();
  const visit = (preset: ValidatedPreset): void => {
    const state = visitState.get(preset.id);
    if (state === 'visited') return;
    if (state === 'visiting') {
      throw new InvalidSchoolPresetPackError(
        `${path}.presets[${preset.index}].extends`,
        'an acyclic parent chain',
        packId,
      );
    }

    visitState.set(preset.id, 'visiting');
    if (preset.parentId) {
      visit(presetsById.get(preset.parentId)!);
    }
    visitState.set(preset.id, 'visited');
  };

  for (const preset of presets) visit(preset);
}
