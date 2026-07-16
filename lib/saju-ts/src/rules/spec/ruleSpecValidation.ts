import {
  type DataRecord,
  type KnownRuleSpecTarget,
  KNOWN_TARGETS,
  assertArray,
  assertDataOnly,
  assertKnownKeys,
  assertOptionalEnum,
  assertOptionalString,
  assertRecord,
  fail,
  hasOwn,
} from './ruleSpecValidationCore.js';
import {
  assertGyeokgukMacro,
  assertGyeokgukPolicy,
} from './validateGyeokgukSpec.js';
import {
  assertShinsalConditionsMacro,
  assertShinsalMacro,
} from './validateShinsalSpec.js';
import { assertYongshinMacro } from './validateYongshinSpec.js';

export type { KnownRuleSpecTarget } from './ruleSpecValidationCore.js';
export { InvalidRuleSpecError } from './ruleSpecValidationCore.js';
export { assertValidRuleSet } from './ruleDslValidation.js';

function assertSpec(
  value: unknown,
  target: KnownRuleSpecTarget,
  path: string,
): void {
  assertRecord(value, target, path);
  const allowed = [
    'id', 'version', 'description', 'base', 'mode', 'macros',
    ...(target === 'gyeokguk' ? ['policy'] : []),
  ];
  assertKnownKeys(value, target, path, allowed);
  assertOptionalString(value, 'id', target, `${path}.id`, true);
  assertOptionalString(value, 'version', target, `${path}.version`, true);
  assertOptionalString(value, 'description', target, `${path}.description`);
  assertOptionalEnum(value, 'base', ['default', 'none'], target, `${path}.base`);
  assertOptionalEnum(
    value,
    'mode',
    ['append', 'prepend', 'replace'],
    target,
    `${path}.mode`,
  );
  if (!hasOwn(value, 'macros')) fail(target, `${path}.macros`, 'an array');
  assertArray(value.macros, target, `${path}.macros`);

  if (target === 'gyeokguk' && hasOwn(value, 'policy') && value.policy !== undefined) {
    assertGyeokgukPolicy(value.policy, `${path}.policy`);
  }

  for (let index = 0; index < value.macros.length; index += 1) {
    const macroPath = `${path}.macros[${index}]`;
    const macroValue = value.macros[index];
    assertRecord(macroValue, target, macroPath);
    const macro: DataRecord = macroValue;
    if (target === 'yongshin') assertYongshinMacro(macro, macroPath);
    else if (target === 'gyeokguk') assertGyeokgukMacro(macro, macroPath);
    else if (target === 'shinsal') assertShinsalMacro(macro, macroPath);
    else assertShinsalConditionsMacro(macro, macroPath);
  }
}

/**
 * Validate one of the four rule-spec targets accepted by the engine.
 *
 * An empty spec array intentionally remains valid: every compiler has a
 * documented empty-array fallback to its immutable default ruleset.
 */
export function assertValidKnownRuleSpec(
  target: string,
  input: unknown,
  path: string,
): void {
  if (!KNOWN_TARGETS.has(target as KnownRuleSpecTarget)) {
    fail(String(target), path, 'a known rule-spec target');
  }
  const knownTarget = target as KnownRuleSpecTarget;
  assertDataOnly(input, knownTarget, path);
  const specs = Array.isArray(input) ? input : [input];
  for (let index = 0; index < specs.length; index += 1) {
    assertSpec(
      specs[index],
      knownTarget,
      Array.isArray(input) ? `${path}[${index}]` : path,
    );
  }
}
