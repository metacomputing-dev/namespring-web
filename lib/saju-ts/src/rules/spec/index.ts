export type {
  ShinsalMacro,
  ShinsalRuleSpec,
  ShinsalRuleSpecBase,
  ShinsalRuleSpecMode,
} from './shinsalSpec.js';

export type {
  ShinsalConditionsMacro,
  ShinsalConditionsRuleSpec,
  ShinsalConditionsRuleSpecBase,
  ShinsalConditionsRuleSpecMode,
} from './shinsalConditionsSpec.js';

export { compileShinsalRuleSpec } from './compileShinsalSpec.js';
export { compileShinsalConditionsRuleSpec } from './compileShinsalConditionsSpec.js';
