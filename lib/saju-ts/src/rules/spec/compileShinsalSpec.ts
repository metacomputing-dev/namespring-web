import type { Rule, RuleSet } from '../dsl.js';
import {
  buildBranchPresenceRules,
  buildCatalogDayPillarRules,
  buildCatalogDayStemRules,
  buildCatalogMonthBranchBranchRules,
  buildCatalogMonthBranchStemRules,
  buildPillarBranchInListRules,
  buildRelationSalRules,
} from '../shinsalRuleCompiler.js';
import { DEFAULT_SHINSAL_RULESET } from '../defaultRuleSets.js';

import type { ShinsalCatalogName, ShinsalMacro, ShinsalRuleSpec, ShinsalRuleSpecMode } from './shinsalSpec.js';

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function pillarKoLabel(p: string): string {
  switch (p) {
    case 'year':
      return '연';
    case 'month':
      return '월';
    case 'day':
      return '일';
    case 'hour':
      return '시';
    default:
      return p;
  }
}

function compileCatalogKeys(m: Extract<ShinsalMacro, { kind: 'catalogKeys' }>): Rule[] {
  const defsBase = m.keys.map((key) => {
    const name = (m.names && typeof m.names === 'object' ? (m.names as any)[key] : undefined) ?? key;
    const id = m.idPrefix ? `${m.idPrefix}_${key}` : undefined;
    const explain = m.explainTemplate ? renderTemplate(m.explainTemplate, { key, name }) : undefined;
    return {
      key,
      name,
      id,
      scoreMode: m.scoreMode,
      score: m.score,
      emitPresentList: m.emitPresentList,
      explain,
      category: m.category,
      tags: m.tags,
    } as any;
  });

  const c: ShinsalCatalogName = m.catalog;
  if (c === 'dayStem') return buildCatalogDayStemRules(defsBase, 'dayStem');
  if (c === 'yearStem') return buildCatalogDayStemRules(defsBase, 'yearStem');
  if (c === 'monthBranchStem') return buildCatalogMonthBranchStemRules(defsBase);
  if (c === 'monthBranchBranch') return buildCatalogMonthBranchBranchRules(defsBase);
  if (c === 'dayPillar') {
    // dayPillar builder does not support scoreMode/emitPresentList; ignore.
    const defs = defsBase.map((d: any) => ({ key: d.key, name: d.name, id: d.id, score: d.score, explain: d.explain, category: d.category, tags: d.tags }));
    return buildCatalogDayPillarRules(defs);
  }
  return [];
}

function compileMacros(macros: ShinsalMacro[]): Rule[] {
  const out: Rule[] = [];
  for (const m of macros) {
    switch (m.kind) {
      case 'relationSal':
        out.push(...buildRelationSalRules(m.defs));
        break;

      case 'relationSalKeys': {
        const prefix = m.scoreKeyPrefix ?? 'shinsal.';
        const defs = (m.names ?? []).map((name) => {
          const scoreKey = prefix.includes('{name}')
            ? renderTemplate(prefix, { name })
            : prefix.endsWith('.')
              ? `${prefix}${name}`
              : `${prefix}${name}`;
          const explain = typeof m.explainTemplate === 'string' ? renderTemplate(m.explainTemplate, { name }) : undefined;
          return { name, scoreKey, explain, tags: m.tags };
        });
        out.push(...buildRelationSalRules(defs));
        break;
      }

      case 'branchPresence':
        out.push(...buildBranchPresenceRules(m.defs));
        break;

      case 'twelveSal': {
        const anchors: Array<'YEAR_BRANCH' | 'DAY_BRANCH'> =
          m.anchors && m.anchors.length ? m.anchors : ['YEAR_BRANCH', 'DAY_BRANCH'];
        const keys = m.keys && m.keys.length
          ? m.keys
          : ['JI_SAL','DOHWA','WOL_SAL','MANG_SHIN_SAL','JANGSEONG','BAN_AN_SAL','YEOKMA','YUK_HAE_SAL','HUAGAI','GEOB_SAL','JAESAL','CHEON_SAL'];

        const nameMode = m.nameMode ?? 'key';

        const defs = anchors.flatMap((basedOn) => {
          const anchorLabel = basedOn === 'YEAR_BRANCH' ? 'YEAR' : 'DAY';
          const anchorPath = anchorLabel.toLowerCase(); // year | day
          return keys.map((k) => ({
            id: `TWELVE_SAL_${anchorLabel}_${k}`,
            name: nameMode === 'anchored' ? `TWELVE_SAL_${anchorLabel}_${k}` : k,
            basedOn,
            // facts.shinsal.twelveSal.{year|day}.{KEY} is a BranchIdx number
            targetVar: `shinsal.twelveSal.${anchorPath}.${k}`,
            explain: `${anchorLabel === 'YEAR' ? '년지' : '일지'} 기준 12신살(${k}) 타깃 지지가 명식에 존재`,
            score: m.score,
            category: m.category ?? 'TWELVE_SAL',
            tags: m.tags,
          }));
        });
        out.push(...buildBranchPresenceRules(defs));
        break;
      }

      case 'gongmangPillars': {
        const name = m.name ?? 'GONGMANG';
        const listVar = m.listVar ?? 'shinsal.gongmang.day';
        const pillars = (m.pillars && m.pillars.length ? m.pillars : ['year', 'month', 'day', 'hour']) as any[];
        const score = typeof m.score === 'number' ? m.score : undefined;

        const defaultExplain = (pillar: string) => `${pillarKoLabel(pillar)}지가 일주旬空(공망)에 해당`;

        const args = {
          name,
          listVar,
          pillars: pillars.map((pillar) => ({
            pillar,
            id: `${name.toUpperCase()}_${String(pillar).toUpperCase()}`,
            explain: m.explainTemplate
              ? renderTemplate(m.explainTemplate, { pillar: String(pillar), label: pillarKoLabel(String(pillar)) })
              : defaultExplain(String(pillar)),
            score,
            category: m.category,
            tags: m.tags,
          })),
          category: m.category,
        };

        out.push(...buildPillarBranchInListRules(args as any));
        break;
      }

      case 'pillarBranchInList':
        out.push(...buildPillarBranchInListRules(m.args));
        break;

      case 'catalogDayStem':
        out.push(...buildCatalogDayStemRules(m.defs, m.which ?? 'dayStem'));
        break;

      case 'catalogMonthBranchStem':
        out.push(...buildCatalogMonthBranchStemRules(m.defs));
        break;

      case 'catalogMonthBranchBranch':
        out.push(...buildCatalogMonthBranchBranchRules(m.defs));
        break;

      case 'catalogDayPillar':
        out.push(...buildCatalogDayPillarRules(m.defs));
        break;

      case 'catalogKeys':
        out.push(...compileCatalogKeys(m));
        break;

      case 'customRules':
        out.push(...(m.rules ?? []));
        break;

      default: {
        const _exhaustive: never = m;
        throw new Error(`Unknown shinsal macro kind: ${(m as any).kind}`);
      }
    }
  }
  return out;
}

function applyMode(baseRules: Rule[], compiled: Rule[], mode: ShinsalRuleSpecMode): Rule[] {
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
 * Compile a JSON macro spec into a concrete shinsal ruleset.
 *
 * This is intended for configuration-driven extensibility:
 * - keep the public API stable
 * - avoid repetitive JSON-DSL boilerplate
 */
export function compileShinsalRuleSpec(specInput: ShinsalRuleSpec | ShinsalRuleSpec[]): RuleSet {
  const specs = Array.isArray(specInput) ? specInput : [specInput];
  if (specs.length === 0) return DEFAULT_SHINSAL_RULESET;

  let rules: Rule[] = [];
  let meta: Pick<RuleSet, 'id' | 'version' | 'description'> = {
    id: specs[0]?.id ?? 'shinsal.spec',
    version: specs[0]?.version ?? '0.1',
    description: specs[0]?.description,
  };

  // First spec may include a base+mode; later specs default to append.
  let first = true;
  for (const s of specs) {
    const compiled = compileMacros(s.macros ?? []);
    if (first) {
      const base = s.base ?? 'default';
      const baseRules = base === 'default' ? DEFAULT_SHINSAL_RULESET.rules : [];
      const mode = s.mode ?? 'append';
      rules = applyMode(baseRules, compiled, mode);
      // Use the first spec's meta preferentially.
      meta = {
        id: s.id ?? meta.id,
        version: s.version ?? meta.version,
        description: s.description ?? meta.description,
      };
      first = false;
    } else {
      const mode = s.mode ?? 'append';
      rules = applyMode(rules, compiled, mode);
      // If later spec has description, append it.
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
