import type { GyeokgukMacro } from './gyeokgukSpec.js';
import {
  type DataRecord,
  FOLLOW_TYPES,
  assertEnum,
  assertFiniteNumber,
  assertKnownKeys,
  assertOptionalBoolean,
  assertOptionalEnum,
  assertOptionalEnumArray,
  assertOptionalFiniteNumber,
  assertOptionalMonthQuality,
  assertOptionalQualityGate,
  assertOptionalStringArray,
  assertOptionalTargetScoreKey,
  assertRecord,
  assertRequiredString,
  assertStringArrayValue,
  assertTargetMacroScoreKey,
  fail,
  hasOwn,
} from './ruleSpecValidationCore.js';
import {
  assertCustomRulesMacro,
  assertMacroPresentation,
  assertOptionalSafeVarPath,
} from './ruleDslValidation.js';

const TEN_GODS = [
  'BI_GYEON',
  'GEOB_JAE',
  'SIK_SHIN',
  'SANG_GWAN',
  'PYEON_JAE',
  'JEONG_JAE',
  'PYEON_GWAN',
  'JEONG_GWAN',
  'PYEON_IN',
  'JEONG_IN',
] as const;

const COMPETITION_METHODS = [
  'follow',
  'transformations',
  'oneElement',
  'tenGod',
] as const;

const GYEOKGUK_MACRO_KINDS = {
  monthMainTenGod: true,
  monthGyeokTenGod: true,
  oneElementDominance: true,
  transformationsBest: true,
  followJonggyeok: true,
  followJonggyeokTyped: true,
  suppressOtherFrames: true,
  penalizeKeyWhen: true,
  customRules: true,
} as const satisfies Record<GyeokgukMacro['kind'], true>;
void GYEOKGUK_MACRO_KINDS;

function assertGyeokgukCompetition(
  value: unknown,
  path: string,
): void {
  const target = 'gyeokguk' as const;
  assertRecord(value, target, path);
  assertKnownKeys(value, target, path, [
    'enabled', 'methods', 'power', 'minKeep', 'renormalize', 'groups', 'signals',
  ]);
  assertOptionalBoolean(value, 'enabled', target, `${path}.enabled`);
  assertOptionalEnumArray(
    value,
    'methods',
    COMPETITION_METHODS,
    target,
    `${path}.methods`,
    { unique: true },
  );
  if (
    value.enabled === true
    && Array.isArray(value.methods)
    && value.methods.length < 2
  ) {
    fail(
      target,
      `${path}.methods`,
      'at least two unique competition methods when enabled',
    );
  }
  assertOptionalFiniteNumber(
    value,
    'power',
    target,
    `${path}.power`,
    { min: 0.01 },
  );
  assertOptionalFiniteNumber(
    value,
    'minKeep',
    target,
    `${path}.minKeep`,
    { min: 0, max: 1 },
  );
  assertOptionalBoolean(value, 'renormalize', target, `${path}.renormalize`);

  if (hasOwn(value, 'groups') && value.groups !== undefined) {
    assertRecord(value.groups, target, `${path}.groups`);
    assertKnownKeys(
      value.groups,
      target,
      `${path}.groups`,
      COMPETITION_METHODS,
    );
    for (const [method, group] of Object.entries(value.groups)) {
      const groupPath = `${path}.groups.${method}`;
      assertRecord(group, target, groupPath);
      assertKnownKeys(group, target, groupPath, [
        'prefixes', 'keys', 'excludePrefixes', 'excludeKeys',
      ]);
      for (const key of ['prefixes', 'keys', 'excludePrefixes', 'excludeKeys']) {
        assertOptionalStringArray(
          group,
          key,
          target,
          `${groupPath}.${key}`,
          { unique: true },
        );
        if (Array.isArray(group[key])) {
          for (let index = 0; index < group[key].length; index += 1) {
            const entry = group[key][index];
            if (!entry.startsWith('gyeokguk.')) {
              fail(
                target,
                `${groupPath}.${key}[${index}]`,
                'a gyeokguk score key or prefix',
              );
            }
          }
        }
      }
    }
  }

  if (hasOwn(value, 'signals') && value.signals !== undefined) {
    assertRecord(value.signals, target, `${path}.signals`);
    assertKnownKeys(
      value.signals,
      target,
      `${path}.signals`,
      COMPETITION_METHODS,
    );
    assertOptionalEnum(
      value.signals,
      'follow',
      ['auto', 'jonggyeok', 'potential', 'raw'],
      target,
      `${path}.signals.follow`,
    );
    assertOptionalEnum(
      value.signals,
      'transformations',
      ['auto', 'huaqi', 'effective', 'raw'],
      target,
      `${path}.signals.transformations`,
    );
    assertOptionalEnum(
      value.signals,
      'oneElement',
      ['auto', 'zhuanwang', 'raw'],
      target,
      `${path}.signals.oneElement`,
    );
    if (hasOwn(value.signals, 'tenGod') && value.signals.tenGod !== undefined) {
      if (typeof value.signals.tenGod === 'number') {
        assertFiniteNumber(
          value.signals.tenGod,
          target,
          `${path}.signals.tenGod`,
          { min: 0, max: 1 },
        );
      } else {
        assertEnum(
          value.signals.tenGod,
          ['auto', 'monthQuality'],
          target,
          `${path}.signals.tenGod`,
        );
      }
    }
  }
}

export function assertGyeokgukPolicy(value: unknown, path: string): void {
  const target = 'gyeokguk' as const;
  assertRecord(value, target, path);
  assertKnownKeys(value, target, path, ['competition']);
  if (hasOwn(value, 'competition') && value.competition !== undefined) {
    assertGyeokgukCompetition(value.competition, `${path}.competition`);
  }
}

function assertGyeokgukCommonPatternMacro(
  macro: DataRecord,
  path: string,
  options: {
    factors: readonly string[];
    modes?: readonly string[];
    allowTypes?: boolean;
    allowQuality?: boolean;
  },
): void {
  const target = 'gyeokguk' as const;
  assertOptionalFiniteNumber(
    macro,
    'minFactor',
    target,
    `${path}.minFactor`,
    { min: 0, max: 1 },
  );
  assertOptionalFiniteNumber(macro, 'bonus', target, `${path}.bonus`);
  assertOptionalEnum(macro, 'factor', options.factors, target, `${path}.factor`);
  if (options.modes) {
    assertOptionalEnum(macro, 'mode', options.modes, target, `${path}.mode`);
  }
  if (options.allowTypes) {
    assertOptionalEnumArray(
      macro,
      'types',
      FOLLOW_TYPES,
      target,
      `${path}.types`,
      { unique: true },
    );
    assertOptionalEnumArray(
      macro,
      'excludeTypes',
      FOLLOW_TYPES,
      target,
      `${path}.excludeTypes`,
      { unique: true },
    );
    assertOptionalFiniteNumber(
      macro,
      'minSubtypeConfidence',
      target,
      `${path}.minSubtypeConfidence`,
      { min: 0, max: 1 },
    );
  }
  if (options.allowQuality) {
    assertOptionalMonthQuality(macro, target, `${path}.monthQuality`);
    assertOptionalQualityGate(macro, target, `${path}.qualityGate`);
  }
  assertMacroPresentation(macro, target, path);
}

export function assertGyeokgukMacro(
  macro: DataRecord,
  path: string,
): void {
  const target = 'gyeokguk' as const;
  const kind = assertRequiredString(macro, 'kind', target, `${path}.kind`);
  switch (kind) {
    case 'monthMainTenGod':
      assertKnownKeys(macro, target, path, [
        'kind', 'tenGods', 'when', 'bonus', 'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertOptionalEnumArray(
        macro,
        'tenGods',
        TEN_GODS,
        target,
        `${path}.tenGods`,
        { unique: true },
      );
      assertOptionalFiniteNumber(macro, 'bonus', target, `${path}.bonus`);
      assertMacroPresentation(macro, target, path);
      return;
    case 'monthGyeokTenGod':
      assertKnownKeys(macro, target, path, [
        'kind', 'tenGods', 'when', 'bonus', 'idPrefix',
        'useQualityMultiplier', 'qualityMultiplierVar', 'explainTemplate', 'tags',
      ]);
      assertOptionalEnumArray(
        macro,
        'tenGods',
        TEN_GODS,
        target,
        `${path}.tenGods`,
        { unique: true },
      );
      assertOptionalFiniteNumber(macro, 'bonus', target, `${path}.bonus`);
      assertOptionalBoolean(
        macro,
        'useQualityMultiplier',
        target,
        `${path}.useQualityMultiplier`,
      );
      assertOptionalSafeVarPath(
        macro,
        'qualityMultiplierVar',
        target,
        `${path}.qualityMultiplierVar`,
      );
      assertMacroPresentation(macro, target, path);
      return;
    case 'oneElementDominance':
      assertKnownKeys(macro, target, path, [
        'kind', 'when', 'minFactor', 'bonus', 'factor', 'key',
        'requireDayMasterMatch', 'requireIsOneElement', 'monthQuality',
        'qualityGate', 'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertGyeokgukCommonPatternMacro(macro, path, {
        factors: ['raw', 'zhuanwang'],
        allowQuality: true,
      });
      assertOptionalTargetScoreKey(macro, 'key', target, `${path}.key`);
      assertOptionalBoolean(
        macro,
        'requireDayMasterMatch',
        target,
        `${path}.requireDayMasterMatch`,
      );
      assertOptionalBoolean(
        macro,
        'requireIsOneElement',
        target,
        `${path}.requireIsOneElement`,
      );
      return;
    case 'transformationsBest':
      assertKnownKeys(macro, target, path, [
        'kind', 'when', 'minFactor', 'bonus', 'factor', 'key',
        'requireDayMasterInvolved', 'monthQuality', 'qualityGate', 'idPrefix',
        'explainTemplate', 'tags',
      ]);
      assertGyeokgukCommonPatternMacro(macro, path, {
        factors: ['effective', 'huaqi', 'raw'],
        allowQuality: true,
      });
      assertOptionalTargetScoreKey(macro, 'key', target, `${path}.key`);
      assertOptionalBoolean(
        macro,
        'requireDayMasterInvolved',
        target,
        `${path}.requireDayMasterInvolved`,
      );
      return;
    case 'followJonggyeok':
      assertKnownKeys(macro, target, path, [
        'kind', 'when', 'minFactor', 'bonus', 'factor', 'mode', 'key', 'types',
        'excludeTypes', 'minSubtypeConfidence', 'monthQuality', 'qualityGate',
        'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertGyeokgukCommonPatternMacro(macro, path, {
        factors: ['jonggyeok', 'potential'],
        modes: ['PRESSURE', 'SUPPORT', 'ANY'],
        allowTypes: true,
        allowQuality: true,
      });
      assertOptionalTargetScoreKey(macro, 'key', target, `${path}.key`);
      return;
    case 'followJonggyeokTyped':
      assertKnownKeys(macro, target, path, [
        'kind', 'when', 'types', 'minFactor', 'bonus', 'factor', 'mode',
        'keyPrefix', 'minSubtypeConfidence', 'monthQuality', 'qualityGate',
        'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertGyeokgukCommonPatternMacro(macro, path, {
        factors: ['jonggyeok', 'potential'],
        modes: ['PRESSURE', 'SUPPORT', 'ANY'],
        allowTypes: true,
        allowQuality: true,
      });
      if (hasOwn(macro, 'keyPrefix') && macro.keyPrefix !== undefined) {
        assertRequiredString(macro, 'keyPrefix', target, `${path}.keyPrefix`);
        if (!(macro.keyPrefix as string).startsWith('gyeokguk.')) {
          fail(target, `${path}.keyPrefix`, 'a prefix under "gyeokguk."');
        }
      }
      return;
    case 'suppressOtherFrames': {
      assertKnownKeys(macro, target, path, [
        'kind', 'winner', 'targets', 'minFactor', 'penalty', 'factor', 'keyMap',
        'when', 'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertEnum(
        macro.winner,
        ['transformations', 'oneElement', 'follow'],
        target,
        `${path}.winner`,
      );
      assertOptionalEnumArray(
        macro,
        'targets',
        ['transformations', 'oneElement', 'follow'],
        target,
        `${path}.targets`,
        { unique: true },
      );
      assertOptionalFiniteNumber(
        macro,
        'minFactor',
        target,
        `${path}.minFactor`,
        { min: 0, max: 1 },
      );
      assertOptionalFiniteNumber(
        macro,
        'penalty',
        target,
        `${path}.penalty`,
        { min: 0 },
      );
      if (hasOwn(macro, 'factor') && macro.factor !== undefined) {
        const factorPath = `${path}.factor`;
        assertRecord(macro.factor, target, factorPath);
        assertKnownKeys(macro.factor, target, factorPath, ['frame', 'sel']);
        const frame = assertRequiredString(
          macro.factor,
          'frame',
          target,
          `${factorPath}.frame`,
        );
        if (frame !== macro.winner) {
          fail(
            target,
            `${factorPath}.frame`,
            'the same frame selected by suppressOtherFrames.winner',
          );
        }
        if (frame === 'follow') {
          assertOptionalEnum(
            macro.factor,
            'sel',
            ['jonggyeok', 'potential'],
            target,
            `${factorPath}.sel`,
          );
        } else if (frame === 'transformations') {
          assertOptionalEnum(
            macro.factor,
            'sel',
            ['effective', 'raw', 'huaqi'],
            target,
            `${factorPath}.sel`,
          );
        } else if (frame === 'oneElement') {
          assertOptionalEnum(
            macro.factor,
            'sel',
            ['raw', 'zhuanwang'],
            target,
            `${factorPath}.sel`,
          );
        } else {
          fail(target, `${factorPath}.frame`, 'a supported special frame');
        }
      }
      if (hasOwn(macro, 'keyMap') && macro.keyMap !== undefined) {
        assertRecord(macro.keyMap, target, `${path}.keyMap`);
        assertKnownKeys(
          macro.keyMap,
          target,
          `${path}.keyMap`,
          ['transformations', 'oneElement', 'follow'],
        );
        for (const [frame, keysValue] of Object.entries(macro.keyMap)) {
          const keys = keysValue;
          assertStringArrayValue(
            keys,
            target,
            `${path}.keyMap.${frame}`,
            { unique: true },
          );
          const scoreKeys = keys as unknown[];
          for (let index = 0; index < scoreKeys.length; index += 1) {
            assertTargetMacroScoreKey(
              scoreKeys[index],
              target,
              `${path}.keyMap.${frame}[${index}]`,
            );
          }
        }
      }
      assertMacroPresentation(macro, target, path);
      return;
    }
    case 'penalizeKeyWhen':
      assertKnownKeys(macro, target, path, [
        'kind', 'key', 'when', 'penalty', 'scaleVar', 'idPrefix',
        'explainTemplate', 'tags',
      ]);
      assertTargetMacroScoreKey(macro.key, target, `${path}.key`);
      assertFiniteNumber(
        macro.penalty,
        target,
        `${path}.penalty`,
        { min: 0, exclusiveMin: true },
      );
      assertOptionalSafeVarPath(
        macro,
        'scaleVar',
        target,
        `${path}.scaleVar`,
      );
      assertMacroPresentation(macro, target, path);
      return;
    case 'customRules':
      assertCustomRulesMacro(macro, target, path);
      return;
    default:
      fail(target, `${path}.kind`, 'a supported gyeokguk macro kind');
  }
}
