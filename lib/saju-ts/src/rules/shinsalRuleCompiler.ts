import type { Expr, Rule } from './dsl.js';
import type { ShinsalBasedOn } from './shinsal.js';

/**
 * Shinsal ruleset “compiler” helpers.
 *
 * These helpers generate repetitive JSON-DSL boilerplate from compact meta-spec objects.
 * The goal is: adding a new shinsal == adding a small data entry, not duplicating rules.
 */

export type PillarName = 'year' | 'month' | 'day' | 'hour';
export type ScoreMode = 'const1' | 'count' | 'lenPresent';

function v(path: string): Expr {
  return { var: path };
}

function lenOf(path: string): Expr {
  return { op: 'len', args: [v(path)] };
}

function scoreExprFromCatalog(basePath: string, mode: ScoreMode, presentProp: string = 'present'): Expr {
  if (mode === 'count') return v(`${basePath}.count`);
  if (mode === 'lenPresent') return lenOf(`${basePath}.${presentProp}`);
  return 1;
}

// ---------------------------------------------------------------------------
// Relation-based sal (facts.shinsal.relationSal.* already returns payload arrays)
// ---------------------------------------------------------------------------

export function buildRelationSalRules(
  defs: Array<{ name: string; id?: string; explain?: string; scoreKey?: string; tags?: string[] }>,
): Rule[] {
  return defs.map((d) => {
    const arrVar = `shinsal.relationSal.${d.name}`;
    const ruleId = d.id ?? `REL_${d.name}`;
    const scoreKey = d.scoreKey ?? `shinsal.${d.name}`;

    return {
      id: ruleId,
      when: { op: 'gt', args: [{ op: 'len', args: [v(arrVar)] }, 0] },
      score: { [scoreKey]: { op: 'len', args: [v(arrVar)] } },
      emit: v(arrVar) as any,
      explain: d.explain,
      tags: d.tags,
    } satisfies Rule;
  });
}

// ---------------------------------------------------------------------------
// Derived: single branch presence in chart
// ---------------------------------------------------------------------------

export function buildBranchPresenceRules(
  defs: Array<{
    id: string;
    name: string;
    basedOn: ShinsalBasedOn;
    targetVar: string;
    explain?: string;
    score?: number;
    category?: string;
    tags?: string[];
  }>,
): Rule[] {
  return defs.map((d) => {
    return {
      id: d.id,
      when: { op: 'in', args: [v(d.targetVar), v('chart.branches')] },
      score: { [`shinsal.${d.name}`]: typeof d.score === 'number' ? d.score : 1 },
      emit: {
        name: d.name,
        category: d.category ?? null,
        basedOn: d.basedOn,
        targetBranch: v(d.targetVar),
      } as any,
      explain: d.explain,
      tags: d.tags,
    } satisfies Rule;
  });
}

// ---------------------------------------------------------------------------
// Derived: pillar-branch membership in list
// ---------------------------------------------------------------------------

export function buildPillarBranchInListRules(args: {
  name: string;
  listVar: string;
  pillars: Array<{
    pillar: PillarName;
    id: string;
    explain?: string;
    basedOn?: ShinsalBasedOn;
    score?: number;
    category?: string;
    tags?: string[];
  }>;
  category?: string;
}): Rule[] {
  return args.pillars.map((p) => {
    const bVar = `chart.pillars.${p.pillar}.branch`;
    return {
      id: p.id,
      when: { op: 'in', args: [v(bVar), v(args.listVar)] },
      score: { [`shinsal.${args.name}`]: typeof p.score === 'number' ? p.score : 1 },
      emit: {
        name: args.name,
        category: (p.category ?? args.category) ?? null,
        basedOn: p.basedOn ?? 'OTHER',
        targetBranch: v(bVar),
        matchedPillars: [p.pillar],
        details: { pillar: p.pillar },
      } as any,
      explain: p.explain,
      tags: p.tags,
    } satisfies Rule;
  });
}

// ---------------------------------------------------------------------------
// Catalog: dayStem/yearStem → branches
// ---------------------------------------------------------------------------

export function buildCatalogDayStemRules(
  defs: Array<{
    key: string;
    name?: string;
    id?: string;
    scoreMode?: ScoreMode;
    score?: number;
    explain?: string;
    category?: string;
    tags?: string[];
  }>,
  which: 'dayStem' | 'yearStem' = 'dayStem',
): Rule[] {
  return defs.map((d) => {
    const basePath = `shinsal.catalog.${which}.${d.key}`;
    const ruleId = d.id ?? `${which.toUpperCase()}_${d.key}`;
    const name = d.name ?? d.key;

    const scoreExpr =
      typeof d.score === 'number'
        ? d.score
        : scoreExprFromCatalog(basePath, d.scoreMode ?? 'const1', 'present');

    return {
      id: ruleId,
      when: { op: 'gt', args: [v(`${basePath}.count`), 0] },
      score: { [`shinsal.${name}`]: scoreExpr },
      emit: {
        name,
        category: d.category ?? null,
        basedOn: 'OTHER',
        targetBranches: v(`${basePath}.present`),
        matchedPillars: v(`${basePath}.matchedPillars`),
      } as any,
      explain: d.explain,
      tags: d.tags,
    } satisfies Rule;
  });
}

// ---------------------------------------------------------------------------
// Catalog: monthBranch → stems
// ---------------------------------------------------------------------------

export function buildCatalogMonthBranchStemRules(
  defs: Array<{
    key: string;
    name?: string;
    id?: string;
    scoreMode?: ScoreMode;
    score?: number;
    emitPresentList?: boolean;
    explain?: string;
    category?: string;
    tags?: string[];
  }>,
): Rule[] {
  return defs.map((d) => {
    const basePath = `shinsal.catalog.monthBranchStem.${d.key}`;
    const ruleId = d.id ?? `MONTH_STEM_${d.key}`;
    const name = d.name ?? d.key;

    const scoreExpr =
      typeof d.score === 'number'
        ? d.score
        : scoreExprFromCatalog(basePath, d.scoreMode ?? 'count', 'present');

    const targetPart = d.emitPresentList
      ? { targetStems: v(`${basePath}.present`) }
      : { targetStem: v(`${basePath}.target`) };

    return {
      id: ruleId,
      when: { op: 'gt', args: [v(`${basePath}.count`), 0] },
      score: { [`shinsal.${name}`]: scoreExpr },
      emit: {
        name,
        category: d.category,
        basedOn: 'MONTH_BRANCH',
        matchedPillars: v(`${basePath}.matchedPillars`),
        ...targetPart,
      } as any,
      explain: d.explain,
      tags: d.tags,
    } satisfies Rule;
  });
}

// ---------------------------------------------------------------------------
// Catalog: monthBranch → branches
// ---------------------------------------------------------------------------

export function buildCatalogMonthBranchBranchRules(
  defs: Array<{
    key: string;
    name?: string;
    id?: string;
    scoreMode?: ScoreMode;
    score?: number;
    emitPresentList?: boolean;
    explain?: string;
    category?: string;
    tags?: string[];
  }>,
): Rule[] {
  return defs.map((d) => {
    const basePath = `shinsal.catalog.monthBranchBranch.${d.key}`;
    const ruleId = d.id ?? `MONTH_BRANCH_${d.key}`;
    const name = d.name ?? d.key;

    const scoreExpr =
      typeof d.score === 'number'
        ? d.score
        : scoreExprFromCatalog(basePath, d.scoreMode ?? 'count', 'present');

    const targetPart = d.emitPresentList
      ? { targetBranches: v(`${basePath}.present`) }
      : { targetBranch: v(`${basePath}.target`) };

    return {
      id: ruleId,
      when: { op: 'gt', args: [v(`${basePath}.count`), 0] },
      score: { [`shinsal.${name}`]: scoreExpr },
      emit: {
        name,
        category: d.category,
        basedOn: 'MONTH_BRANCH',
        matchedPillars: v(`${basePath}.matchedPillars`),
        ...targetPart,
      } as any,
      explain: d.explain,
      tags: d.tags,
    } satisfies Rule;
  });
}

// ---------------------------------------------------------------------------
// Catalog: dayPillar → set membership (boolean)
// ---------------------------------------------------------------------------

export function buildCatalogDayPillarRules(
  defs: Array<{
    key: string;
    name?: string;
    id?: string;
    score?: number;
    explain?: string;
    category?: string;
    tags?: string[];
  }>,
): Rule[] {
  return defs.map((d) => {
    const basePath = `shinsal.catalog.dayPillar.${d.key}`;
    const ruleId = d.id ?? `DAY_PILLAR_${d.key}`;
    const name = d.name ?? d.key;

    return {
      id: ruleId,
      when: { op: 'eq', args: [v(`${basePath}.active`), true] },
      score: { [`shinsal.${name}`]: typeof d.score === 'number' ? d.score : 1 },
      emit: {
        name,
        category: d.category,
        basedOn: 'OTHER',
        targetKind: 'NONE',
        matchedPillars: v(`${basePath}.matchedPillars`),
      } as any,
      explain: d.explain,
      tags: d.tags,
    } satisfies Rule;
  });
}
