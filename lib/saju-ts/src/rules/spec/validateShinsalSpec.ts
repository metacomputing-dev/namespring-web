import type { ShinsalConditionsMacro } from './shinsalConditionsSpec.js';
import type { ShinsalMacro } from './shinsalSpec.js';
import {
  type DataRecord,
  type KnownRuleSpecTarget,
  DAMAGE_KEYS,
  assertArray,
  assertEnum,
  assertKnownKeys,
  assertOptionalBoolean,
  assertOptionalEnum,
  assertOptionalEnumArray,
  assertOptionalFiniteNumber,
  assertOptionalGenericScoreKey,
  assertOptionalString,
  assertOptionalStringArray,
  assertRecord,
  assertRequiredString,
  assertSafeDottedKey,
  assertSafeDynamicKey,
  assertStringArrayValue,
  fail,
  hasOwn,
} from './ruleSpecValidationCore.js';
import {
  assertCustomRulesMacro,
  assertOptionalSafeVarPath,
  assertRequiredSafeVarPath,
} from './ruleDslValidation.js';

const PILLARS = ['year', 'month', 'day', 'hour'] as const;
const SHINSAL_BASES = [
  'YEAR_BRANCH',
  'DAY_BRANCH',
  'MONTH_BRANCH',
  'DAY_STEM',
  'YEAR_STEM',
  'OTHER',
] as const;
const TWELVE_SAL_KEYS = [
  'JI_SAL',
  'DOHWA',
  'WOL_SAL',
  'MANG_SHIN_SAL',
  'JANGSEONG',
  'BAN_AN_SAL',
  'YEOKMA',
  'YUK_HAE_SAL',
  'HUAGAI',
  'GEOB_SAL',
  'JAESAL',
  'CHEON_SAL',
] as const;

const SHINSAL_MACRO_KINDS = {
  relationSal: true,
  relationSalKeys: true,
  branchPresence: true,
  twelveSal: true,
  gongmangPillars: true,
  pillarBranchInList: true,
  catalogDayStem: true,
  catalogMonthBranchStem: true,
  catalogMonthBranchBranch: true,
  catalogDayPillar: true,
  catalogKeys: true,
  customRules: true,
} as const satisfies Record<ShinsalMacro['kind'], true>;
void SHINSAL_MACRO_KINDS;

const SHINSAL_CONDITIONS_MACRO_KINDS = {
  standardDamagePenalties: true,
  customRules: true,
} as const satisfies Record<ShinsalConditionsMacro['kind'], true>;
void SHINSAL_CONDITIONS_MACRO_KINDS;

function assertShinsalDefinitionStrings(
  definition: DataRecord,
  target: KnownRuleSpecTarget,
  path: string,
): void {
  assertOptionalString(definition, 'id', target, `${path}.id`, true);
  assertOptionalString(definition, 'name', target, `${path}.name`, true);
  assertOptionalString(definition, 'explain', target, `${path}.explain`);
  assertOptionalString(definition, 'category', target, `${path}.category`, true);
  assertOptionalStringArray(definition, 'tags', target, `${path}.tags`);
}

function assertCatalogDefinition(
  value: unknown,
  path: string,
  options: { emitPresentList: boolean; scoreMode: boolean },
): void {
  const target = 'shinsal' as const;
  assertRecord(value, target, path);
  const keys = [
    'key', 'name', 'id', 'score', 'explain', 'category', 'tags',
    ...(options.scoreMode ? ['scoreMode'] : []),
    ...(options.emitPresentList ? ['emitPresentList'] : []),
  ];
  assertKnownKeys(value, target, path, keys);
  assertRequiredString(value, 'key', target, `${path}.key`);
  assertShinsalDefinitionStrings(value, target, path);
  assertOptionalFiniteNumber(value, 'score', target, `${path}.score`);
  if (options.scoreMode) {
    assertOptionalEnum(
      value,
      'scoreMode',
      ['const1', 'count', 'lenPresent'],
      target,
      `${path}.scoreMode`,
    );
  }
  if (options.emitPresentList) {
    assertOptionalBoolean(
      value,
      'emitPresentList',
      target,
      `${path}.emitPresentList`,
    );
  }
}

function assertDefinitionArray(
  value: unknown,
  target: KnownRuleSpecTarget,
  path: string,
  validate: (entry: unknown, entryPath: string) => void,
  options: { nonEmpty?: boolean } = {},
): void {
  assertArray(value, target, path);
  if (options.nonEmpty && value.length === 0) {
    fail(target, path, 'a non-empty definition array');
  }
  for (let index = 0; index < value.length; index += 1) {
    validate(value[index], `${path}[${index}]`);
  }
}

export function assertShinsalMacro(
  macro: DataRecord,
  path: string,
): void {
  const target = 'shinsal' as const;
  const kind = assertRequiredString(macro, 'kind', target, `${path}.kind`);
  switch (kind) {
    case 'relationSal':
      assertKnownKeys(macro, target, path, ['kind', 'defs']);
      assertDefinitionArray(
        macro.defs,
        target,
        `${path}.defs`,
        (entry, entryPath) => {
          assertRecord(entry, target, entryPath);
          assertKnownKeys(entry, target, entryPath, [
            'name', 'id', 'explain', 'scoreKey', 'tags',
          ]);
          assertRequiredString(entry, 'name', target, `${entryPath}.name`);
          assertOptionalString(entry, 'id', target, `${entryPath}.id`, true);
          assertOptionalString(entry, 'explain', target, `${entryPath}.explain`);
          assertOptionalGenericScoreKey(
            entry,
            'scoreKey',
            target,
            `${entryPath}.scoreKey`,
          );
          assertOptionalStringArray(entry, 'tags', target, `${entryPath}.tags`);
        },
        { nonEmpty: true },
      );
      return;
    case 'relationSalKeys':
      assertKnownKeys(macro, target, path, [
        'kind', 'names', 'scoreKeyPrefix', 'explainTemplate', 'tags',
      ]);
      assertStringArrayValue(
        macro.names,
        target,
        `${path}.names`,
        { nonEmpty: true, unique: true },
      );
      if (hasOwn(macro, 'scoreKeyPrefix') && macro.scoreKeyPrefix !== undefined) {
        const prefix = assertRequiredString(
          macro,
          'scoreKeyPrefix',
          target,
          `${path}.scoreKeyPrefix`,
        );
        assertSafeDottedKey(prefix, target, `${path}.scoreKeyPrefix`);
      }
      assertOptionalString(
        macro,
        'explainTemplate',
        target,
        `${path}.explainTemplate`,
      );
      assertOptionalStringArray(macro, 'tags', target, `${path}.tags`);
      return;
    case 'branchPresence':
      assertKnownKeys(macro, target, path, ['kind', 'defs']);
      assertDefinitionArray(
        macro.defs,
        target,
        `${path}.defs`,
        (entry, entryPath) => {
          assertRecord(entry, target, entryPath);
          assertKnownKeys(entry, target, entryPath, [
            'id', 'name', 'basedOn', 'targetVar', 'explain', 'score', 'category', 'tags',
          ]);
          assertRequiredString(entry, 'id', target, `${entryPath}.id`);
          assertRequiredString(entry, 'name', target, `${entryPath}.name`);
          assertEnum(entry.basedOn, SHINSAL_BASES, target, `${entryPath}.basedOn`);
          assertRequiredSafeVarPath(
            entry,
            'targetVar',
            target,
            `${entryPath}.targetVar`,
          );
          assertShinsalDefinitionStrings(entry, target, entryPath);
          assertOptionalFiniteNumber(entry, 'score', target, `${entryPath}.score`);
        },
        { nonEmpty: true },
      );
      return;
    case 'twelveSal':
      assertKnownKeys(macro, target, path, [
        'kind', 'anchors', 'keys', 'nameMode', 'score', 'category', 'tags',
      ]);
      assertOptionalEnumArray(
        macro,
        'anchors',
        ['YEAR_BRANCH', 'DAY_BRANCH'],
        target,
        `${path}.anchors`,
        { nonEmpty: true, unique: true },
      );
      assertOptionalEnumArray(
        macro,
        'keys',
        TWELVE_SAL_KEYS,
        target,
        `${path}.keys`,
        { nonEmpty: true, unique: true },
      );
      assertOptionalEnum(
        macro,
        'nameMode',
        ['key', 'anchored'],
        target,
        `${path}.nameMode`,
      );
      assertOptionalFiniteNumber(macro, 'score', target, `${path}.score`);
      assertOptionalString(macro, 'category', target, `${path}.category`, true);
      assertOptionalStringArray(macro, 'tags', target, `${path}.tags`);
      return;
    case 'gongmangPillars':
      assertKnownKeys(macro, target, path, [
        'kind', 'name', 'listVar', 'pillars', 'score', 'category', 'tags',
        'explainTemplate',
      ]);
      assertOptionalString(macro, 'name', target, `${path}.name`, true);
      assertOptionalSafeVarPath(macro, 'listVar', target, `${path}.listVar`);
      assertOptionalEnumArray(
        macro,
        'pillars',
        PILLARS,
        target,
        `${path}.pillars`,
        { nonEmpty: true, unique: true },
      );
      assertOptionalFiniteNumber(macro, 'score', target, `${path}.score`);
      assertOptionalString(macro, 'category', target, `${path}.category`, true);
      assertOptionalStringArray(macro, 'tags', target, `${path}.tags`);
      assertOptionalString(
        macro,
        'explainTemplate',
        target,
        `${path}.explainTemplate`,
      );
      return;
    case 'pillarBranchInList':
      assertKnownKeys(macro, target, path, ['kind', 'args']);
      assertRecord(macro.args, target, `${path}.args`);
      assertKnownKeys(macro.args, target, `${path}.args`, [
        'name', 'listVar', 'pillars', 'category',
      ]);
      assertRequiredString(macro.args, 'name', target, `${path}.args.name`);
      assertRequiredSafeVarPath(
        macro.args,
        'listVar',
        target,
        `${path}.args.listVar`,
      );
      assertOptionalString(
        macro.args,
        'category',
        target,
        `${path}.args.category`,
        true,
      );
      assertDefinitionArray(
        macro.args.pillars,
        target,
        `${path}.args.pillars`,
        (entry, entryPath) => {
          assertRecord(entry, target, entryPath);
          assertKnownKeys(entry, target, entryPath, [
            'pillar', 'id', 'explain', 'basedOn', 'score', 'category', 'tags',
          ]);
          assertEnum(entry.pillar, PILLARS, target, `${entryPath}.pillar`);
          assertRequiredString(entry, 'id', target, `${entryPath}.id`);
          assertOptionalString(entry, 'explain', target, `${entryPath}.explain`);
          assertOptionalEnum(
            entry,
            'basedOn',
            SHINSAL_BASES,
            target,
            `${entryPath}.basedOn`,
          );
          assertOptionalFiniteNumber(entry, 'score', target, `${entryPath}.score`);
          assertOptionalString(
            entry,
            'category',
            target,
            `${entryPath}.category`,
            true,
          );
          assertOptionalStringArray(entry, 'tags', target, `${entryPath}.tags`);
        },
        { nonEmpty: true },
      );
      return;
    case 'catalogDayStem':
      assertKnownKeys(macro, target, path, ['kind', 'which', 'defs']);
      assertOptionalEnum(
        macro,
        'which',
        ['dayStem', 'yearStem'],
        target,
        `${path}.which`,
      );
      assertDefinitionArray(
        macro.defs,
        target,
        `${path}.defs`,
        (entry, entryPath) => {
          assertCatalogDefinition(entry, entryPath, {
            emitPresentList: false,
            scoreMode: true,
          });
        },
        { nonEmpty: true },
      );
      return;
    case 'catalogMonthBranchStem':
    case 'catalogMonthBranchBranch':
      assertKnownKeys(macro, target, path, ['kind', 'defs']);
      assertDefinitionArray(
        macro.defs,
        target,
        `${path}.defs`,
        (entry, entryPath) => {
          assertCatalogDefinition(entry, entryPath, {
            emitPresentList: true,
            scoreMode: true,
          });
        },
        { nonEmpty: true },
      );
      return;
    case 'catalogDayPillar':
      assertKnownKeys(macro, target, path, ['kind', 'defs']);
      assertDefinitionArray(
        macro.defs,
        target,
        `${path}.defs`,
        (entry, entryPath) => {
          assertCatalogDefinition(entry, entryPath, {
            emitPresentList: false,
            scoreMode: false,
          });
        },
        { nonEmpty: true },
      );
      return;
    case 'catalogKeys':
      assertEnum(
        macro.catalog,
        ['dayStem', 'yearStem', 'monthBranchStem', 'monthBranchBranch', 'dayPillar'],
        target,
        `${path}.catalog`,
      );
      {
        const catalog = macro.catalog as string;
        const supportsScoreMode = catalog !== 'dayPillar';
        const supportsEmitPresentList =
          catalog === 'monthBranchStem' || catalog === 'monthBranchBranch';
        assertKnownKeys(macro, target, path, [
          'kind', 'catalog', 'keys', 'score', 'category', 'tags', 'names',
          'idPrefix', 'explainTemplate',
          ...(supportsScoreMode ? ['scoreMode'] : []),
          ...(supportsEmitPresentList ? ['emitPresentList'] : []),
        ]);
      }
      assertStringArrayValue(
        macro.keys,
        target,
        `${path}.keys`,
        { nonEmpty: true, unique: true },
      );
      assertOptionalEnum(
        macro,
        'scoreMode',
        ['const1', 'count', 'lenPresent'],
        target,
        `${path}.scoreMode`,
      );
      assertOptionalFiniteNumber(macro, 'score', target, `${path}.score`);
      assertOptionalBoolean(
        macro,
        'emitPresentList',
        target,
        `${path}.emitPresentList`,
      );
      assertOptionalString(macro, 'category', target, `${path}.category`, true);
      assertOptionalStringArray(macro, 'tags', target, `${path}.tags`);
      if (hasOwn(macro, 'names') && macro.names !== undefined) {
        assertRecord(macro.names, target, `${path}.names`);
        const keys = new Set(macro.keys as string[]);
        for (const [key, name] of Object.entries(macro.names)) {
          assertSafeDynamicKey(key, target, `${path}.names.${key}`);
          if (key.trim().length === 0 || key !== key.trim()) {
            fail(target, `${path}.names`, 'non-empty trimmed keys');
          }
          if (!keys.has(key)) {
            fail(target, `${path}.names.${key}`, 'a key listed in catalogKeys.keys');
          }
          if (
            typeof name !== 'string'
            || name.trim().length === 0
            || name !== name.trim()
          ) {
            fail(target, `${path}.names.${key}`, 'a non-empty trimmed string');
          }
        }
      }
      assertOptionalString(macro, 'idPrefix', target, `${path}.idPrefix`, true);
      assertOptionalString(
        macro,
        'explainTemplate',
        target,
        `${path}.explainTemplate`,
      );
      return;
    case 'customRules':
      assertCustomRulesMacro(macro, target, path);
      return;
    default:
      fail(target, `${path}.kind`, 'a supported shinsal macro kind');
  }
}

export function assertShinsalConditionsMacro(
  macro: DataRecord,
  path: string,
): void {
  const target = 'shinsalConditions' as const;
  const kind = assertRequiredString(macro, 'kind', target, `${path}.kind`);
  switch (kind) {
    case 'standardDamagePenalties':
      assertKnownKeys(macro, target, path, ['kind', 'keys', 'idPrefix', 'tags']);
      assertOptionalEnumArray(
        macro,
        'keys',
        DAMAGE_KEYS,
        target,
        `${path}.keys`,
        { unique: true },
      );
      assertOptionalString(macro, 'idPrefix', target, `${path}.idPrefix`, true);
      assertOptionalStringArray(macro, 'tags', target, `${path}.tags`);
      return;
    case 'customRules':
      assertCustomRulesMacro(macro, target, path);
      return;
    default:
      fail(target, `${path}.kind`, 'a supported shinsalConditions macro kind');
  }
}
