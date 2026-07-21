import type { YongshinMacro } from './yongshinSpec.js';
import {
  type DataRecord,
  ELEMENTS,
  FOLLOW_TYPES,
  ROLES,
  assertEnum,
  assertEnumArrayValue,
  assertFiniteNumber,
  assertKnownKeys,
  assertOptionalBoolean,
  assertOptionalEnum,
  assertOptionalEnumArray,
  assertOptionalFiniteNumber,
  assertOptionalMonthQuality,
  assertRecord,
  assertRequiredString,
  fail,
} from './ruleSpecValidationCore.js';
import {
  assertCustomRulesMacro,
  assertMacroPresentation,
  assertOptionalSafeVarPath,
  assertRequiredSafeVarPath,
} from './ruleDslValidation.js';

const YONGSHIN_MACRO_KINDS = {
  roleBoost: true,
  monthTenGodRoleBias: true,
  oneElementDominance: true,
  transformationsBest: true,
  elementBoost: true,
  tongguanBridge: true,
  followWeakPressure: true,
  followJonggyeok: true,
  elementByVar: true,
  customRules: true,
} as const satisfies Record<YongshinMacro['kind'], true>;
void YONGSHIN_MACRO_KINDS;

export function assertYongshinMacro(
  macro: DataRecord,
  path: string,
): void {
  const target = 'yongshin' as const;
  const kind = assertRequiredString(macro, 'kind', target, `${path}.kind`);
  switch (kind) {
    case 'roleBoost':
      assertKnownKeys(macro, target, path, [
        'kind', 'role', 'when', 'bonus', 'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertEnum(macro.role, ROLES, target, `${path}.role`);
      assertFiniteNumber(macro.bonus, target, `${path}.bonus`);
      assertMacroPresentation(macro, target, path);
      return;
    case 'monthTenGodRoleBias':
      assertKnownKeys(macro, target, path, [
        'kind', 'basis', 'bonuses', 'when', 'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertOptionalEnum(macro, 'basis', ['main', 'gyeok'], target, `${path}.basis`);
      assertRecord(macro.bonuses, target, `${path}.bonuses`);
      assertKnownKeys(macro.bonuses, target, `${path}.bonuses`, ROLES);
      for (const [role, bonus] of Object.entries(macro.bonuses)) {
        assertFiniteNumber(bonus, target, `${path}.bonuses.${role}`);
      }
      assertMacroPresentation(macro, target, path);
      return;
    case 'oneElementDominance':
      assertKnownKeys(macro, target, path, [
        'kind', 'minFactor', 'bonus', 'factor', 'requireDayMasterMatch',
        'requireIsOneElement', 'monthQuality', 'when', 'idPrefix',
        'explainTemplate', 'tags',
      ]);
      assertOptionalFiniteNumber(
        macro,
        'minFactor',
        target,
        `${path}.minFactor`,
        { min: 0, max: 1 },
      );
      assertOptionalFiniteNumber(macro, 'bonus', target, `${path}.bonus`);
      assertOptionalEnum(macro, 'factor', ['raw', 'zhuanwang'], target, `${path}.factor`);
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
      assertOptionalMonthQuality(macro, target, `${path}.monthQuality`);
      assertMacroPresentation(macro, target, path);
      return;
    case 'transformationsBest':
      assertKnownKeys(macro, target, path, [
        'kind', 'minFactor', 'bonus', 'factor', 'requireDayMasterInvolved',
        'monthQuality', 'when', 'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertOptionalFiniteNumber(
        macro,
        'minFactor',
        target,
        `${path}.minFactor`,
        { min: 0, max: 1 },
      );
      assertOptionalFiniteNumber(macro, 'bonus', target, `${path}.bonus`);
      assertOptionalEnum(
        macro,
        'factor',
        ['raw', 'effective', 'huaqi'],
        target,
        `${path}.factor`,
      );
      assertOptionalBoolean(
        macro,
        'requireDayMasterInvolved',
        target,
        `${path}.requireDayMasterInvolved`,
      );
      assertOptionalMonthQuality(macro, target, `${path}.monthQuality`);
      assertMacroPresentation(macro, target, path);
      return;
    case 'elementBoost':
      assertKnownKeys(macro, target, path, [
        'kind', 'elements', 'when', 'bonus', 'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertEnumArrayValue(
        macro.elements,
        ELEMENTS,
        target,
        `${path}.elements`,
        { nonEmpty: true, unique: true },
      );
      assertFiniteNumber(macro.bonus, target, `${path}.bonus`);
      assertMacroPresentation(macro, target, path);
      return;
    case 'tongguanBridge':
      assertKnownKeys(macro, target, path, [
        'kind', 'pairs', 'intensityField', 'minIntensity', 'minIntensityVar',
        'bonus', 'bonusVar', 'when', 'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertOptionalEnumArray(
        macro,
        'pairs',
        ['waterFire', 'fireMetal', 'metalWood', 'woodEarth', 'earthWater'],
        target,
        `${path}.pairs`,
        { unique: true },
      );
      assertOptionalEnum(
        macro,
        'intensityField',
        ['intensity', 'weightedIntensity'],
        target,
        `${path}.intensityField`,
      );
      assertOptionalFiniteNumber(
        macro,
        'minIntensity',
        target,
        `${path}.minIntensity`,
        { min: 0, max: 1 },
      );
      assertOptionalSafeVarPath(
        macro,
        'minIntensityVar',
        target,
        `${path}.minIntensityVar`,
      );
      assertOptionalFiniteNumber(macro, 'bonus', target, `${path}.bonus`);
      assertOptionalSafeVarPath(
        macro,
        'bonusVar',
        target,
        `${path}.bonusVar`,
      );
      assertMacroPresentation(macro, target, path);
      return;
    case 'followWeakPressure':
      assertKnownKeys(macro, target, path, [
        'kind', 'weakThreshold', 'minDominanceRatio', 'roles', 'bonus', 'when',
        'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertOptionalFiniteNumber(
        macro,
        'weakThreshold',
        target,
        `${path}.weakThreshold`,
        { min: -1, max: 1 },
      );
      assertOptionalFiniteNumber(
        macro,
        'minDominanceRatio',
        target,
        `${path}.minDominanceRatio`,
        { min: 0, exclusiveMin: true },
      );
      assertOptionalEnumArray(
        macro,
        'roles',
        ROLES,
        target,
        `${path}.roles`,
        { unique: true },
      );
      assertOptionalFiniteNumber(macro, 'bonus', target, `${path}.bonus`);
      assertMacroPresentation(macro, target, path);
      return;
    case 'followJonggyeok':
      assertKnownKeys(macro, target, path, [
        'kind', 'factor', 'mode', 'minFactor', 'bonus', 'target',
        'includeOtherSupportRole', 'otherSupportScale', 'scaleBy', 'types',
        'excludeTypes', 'minSubtypeConfidence', 'monthQuality', 'when',
        'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertOptionalEnum(
        macro,
        'factor',
        ['jonggyeok', 'potential', 'raw'],
        target,
        `${path}.factor`,
      );
      assertOptionalEnum(
        macro,
        'mode',
        ['PRESSURE', 'SUPPORT', 'ANY'],
        target,
        `${path}.mode`,
      );
      assertOptionalFiniteNumber(
        macro,
        'minFactor',
        target,
        `${path}.minFactor`,
        { min: 0, max: 1 },
      );
      assertOptionalFiniteNumber(macro, 'bonus', target, `${path}.bonus`);
      assertOptionalEnum(macro, 'target', ['role', 'element'], target, `${path}.target`);
      assertOptionalBoolean(
        macro,
        'includeOtherSupportRole',
        target,
        `${path}.includeOtherSupportRole`,
      );
      assertOptionalFiniteNumber(
        macro,
        'otherSupportScale',
        target,
        `${path}.otherSupportScale`,
      );
      assertOptionalEnum(macro, 'scaleBy', ['share', 'none'], target, `${path}.scaleBy`);
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
      assertOptionalMonthQuality(macro, target, `${path}.monthQuality`);
      assertMacroPresentation(macro, target, path);
      return;
    case 'elementByVar':
      assertKnownKeys(macro, target, path, [
        'kind', 'elementVar', 'factorVar', 'minFactor', 'bonus', 'when',
        'idPrefix', 'explainTemplate', 'tags',
      ]);
      assertRequiredSafeVarPath(
        macro,
        'elementVar',
        target,
        `${path}.elementVar`,
      );
      assertRequiredSafeVarPath(
        macro,
        'factorVar',
        target,
        `${path}.factorVar`,
      );
      assertOptionalFiniteNumber(
        macro,
        'minFactor',
        target,
        `${path}.minFactor`,
        { min: 0, max: 1 },
      );
      assertOptionalFiniteNumber(macro, 'bonus', target, `${path}.bonus`);
      assertMacroPresentation(macro, target, path);
      return;
    case 'customRules':
      assertCustomRulesMacro(macro, target, path);
      return;
    default:
      fail(target, `${path}.kind`, 'a supported yongshin macro kind');
  }
}
