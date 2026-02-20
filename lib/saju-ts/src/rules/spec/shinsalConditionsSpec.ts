import type { Rule } from '../dsl.js';
import type { ShinsalDamageKey } from '../packs/shinsalConditionsBasePack.js';

export type ShinsalConditionsRuleSpecBase = 'default' | 'none';
export type ShinsalConditionsRuleSpecMode = 'append' | 'prepend' | 'replace';

export type ShinsalConditionsMacro =
  | {
      /** Emit the engine's default set of damage-penalty rules (CHUNG/HAE/PA/WONJIN/HYEONG/GONGMANG). */
      kind: 'standardDamagePenalties';
      keys?: ShinsalDamageKey[];
      idPrefix?: string;
      tags?: string[];
    }
  | { kind: 'customRules'; rules: Rule[] };

export interface ShinsalConditionsRuleSpec {
  id?: string;
  version?: string;
  description?: string;

  base?: ShinsalConditionsRuleSpecBase;
  mode?: ShinsalConditionsRuleSpecMode;

  macros: ShinsalConditionsMacro[];
}
