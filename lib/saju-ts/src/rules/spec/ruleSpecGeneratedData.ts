import type { RuleSet } from '../dsl.js';

function omitUndefinedObjectFields(value: unknown, path: string): unknown {
  if (Array.isArray(value)) {
    const output: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new Error(`Generated rule data contains a sparse array at ${path}[${index}].`);
      }
      output.push(omitUndefinedObjectFields(value[index], `${path}[${index}]`));
    }
    return output;
  }
  if (!value || typeof value !== 'object') return value;

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    output[key] = omitUndefinedObjectFields(entry, `${path}.${key}`);
  }
  return output;
}

/**
 * Compilers may construct optional object fields as `undefined`, while the
 * published RuleSet contract is JSON-compatible data. Omit only object fields;
 * sparse arrays remain a compiler error instead of being compacted.
 */
export function finalizeGeneratedRuleSet(
  value: RuleSet,
  path: string,
): RuleSet {
  return omitUndefinedObjectFields(value, path) as RuleSet;
}
