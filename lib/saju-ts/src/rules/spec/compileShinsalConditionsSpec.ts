import type { Rule, RuleSet } from '../dsl.js';
import { DEFAULT_SHINSAL_CONDITIONS_RULESET } from '../defaultShinsalConditions.js';
import type {
  ShinsalConditionsMacro,
  ShinsalConditionsRuleSpec,
  ShinsalConditionsRuleSpecMode,
} from './shinsalConditionsSpec.js';
import type { ShinsalDamageKey } from '../packs/shinsalConditionsBasePack.js';

function uniqStrings(xs: string[] | undefined): string[] | undefined {
  if (!xs) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const t = String(x).trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.length ? out : undefined;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function defaultExplain(key: ShinsalDamageKey): string {
  switch (key) {
    case 'CHUNG':
      return '타깃 지지가 정충(沖)에 걸리면 신살 효력이 약화될 수 있음(가중치로 반영).';
    case 'HAE':
      return '타깃 지지가 지해(害)에 걸리면 약화(가중치).';
    case 'PA':
      return '타깃 지지가 파(破)에 걸리면 약화(가중치).';
    case 'WONJIN':
      return '타깃 지지가 원진(怨嗔)에 걸리면 약화(가중치).';
    case 'HYEONG':
      return '타깃 지지가 형(刑/自刑/三刑)에 걸리면 약화(가중치).';
    case 'GONGMANG':
      return '타깃 지지가 일주旬空(공망)에 해당하면 약화(가중치).';
    default:
      return '신살 조건(약화) 가중치.';
  }
}

function relationVarForKey(key: ShinsalDamageKey): string {
  switch (key) {
    case 'CHUNG':
      return 'chart.relations.chungBranches';
    case 'HAE':
      return 'chart.relations.haeBranches';
    case 'PA':
      return 'chart.relations.paBranches';
    case 'WONJIN':
      return 'chart.relations.wonjinBranches';
    case 'HYEONG':
      return 'chart.relations.hyeongBranches';
    case 'GONGMANG':
      return 'shinsal.gongmang.day';
    default:
      return 'chart.relations.damagedBranches';
  }
}

function buildStandardRule(
  key: ShinsalDamageKey,
  opts: {
    idPrefix?: string;
    explainTemplate?: string;
    tags?: string[];
  },
): Rule {
  const idPrefix = opts.idPrefix ? String(opts.idPrefix).trim() : '';
  const id = idPrefix ? `${idPrefix}_${key}` : `COND_${key}`;

  const explain = opts.explainTemplate
    ? renderTemplate(opts.explainTemplate, { key })
    : defaultExplain(key);

  const tags = uniqStrings(['COND', key, ...(opts.tags ?? [])]);

  return {
    id,
    when: {
      op: 'overlap',
      args: [{ var: 'det.targetBranches' }, { var: relationVarForKey(key) }],
    },
    score: { [`cond.penalty.${key}`]: { var: `policy.shinsal.conditions.weights.${key}` } },
    explain,
    tags,
  };
}

function compileMacros(macros: ShinsalConditionsMacro[]): Rule[] {
  const out: Rule[] = [];

  for (const m of macros ?? []) {
    switch (m.kind) {
      case 'standardDamagePenalties': {
        const keys: ShinsalDamageKey[] = (m.keys && m.keys.length
          ? m.keys
          : ['CHUNG', 'HAE', 'PA', 'WONJIN', 'HYEONG', 'GONGMANG']) as ShinsalDamageKey[];

        for (const key of keys) {
          out.push(
            buildStandardRule(key, {
              idPrefix: m.idPrefix,
              tags: m.tags,
            }),
          );
        }
        break;
      }

      case 'customRules':
        out.push(...(m.rules ?? []));
        break;

      default: {
        const _exhaustive: never = m;
        throw new Error(`Unknown shinsalConditions macro kind: ${(m as any).kind}`);
      }
    }
  }

  return out;
}

function applyMode(baseRules: Rule[], compiled: Rule[], mode: ShinsalConditionsRuleSpecMode): Rule[] {
  switch (mode) {
    case 'prepend':
      return [...compiled, ...baseRules];
    case 'replace':
      return [...compiled];
    case 'append':
    default:
      return [...baseRules, ...compiled];
  }
}

/**
 * Compile a JSON macro spec into a concrete shinsal-conditions ruleset.
 */
export function compileShinsalConditionsRuleSpec(
  specInput: ShinsalConditionsRuleSpec | ShinsalConditionsRuleSpec[],
): RuleSet {
  const specs = Array.isArray(specInput) ? specInput : [specInput];
  if (specs.length === 0) return DEFAULT_SHINSAL_CONDITIONS_RULESET;

  let rules: Rule[] = [];
  let meta: Pick<RuleSet, 'id' | 'version' | 'description'> = {
    id: specs[0]?.id ?? 'shinsalConditions.spec',
    version: specs[0]?.version ?? '0.1',
    description: specs[0]?.description,
  };

  let first = true;
  for (const s of specs) {
    const compiled = compileMacros(s.macros ?? []);
    if (first) {
      const base = s.base ?? 'default';
      const baseRules = base === 'default' ? DEFAULT_SHINSAL_CONDITIONS_RULESET.rules : [];
      const mode = s.mode ?? 'append';
      rules = applyMode(baseRules, compiled, mode);
      meta = {
        id: s.id ?? meta.id,
        version: s.version ?? meta.version,
        description: s.description ?? meta.description,
      };
      first = false;
    } else {
      const mode = s.mode ?? 'append';
      rules = applyMode(rules, compiled, mode);
      if (s.description) meta.description = (meta.description ? `${meta.description}\n` : '') + s.description;
    }
  }

  return {
    id: meta.id,
    version: meta.version,
    description: meta.description,
    rules,
  };
}
