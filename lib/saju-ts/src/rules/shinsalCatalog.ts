import type { BranchIdx, PillarIdx, StemIdx } from '../core/cycle.js';
import { branchIdxFromHanja, ganzhiIndex, pillar, stemIdxFromHanja } from '../core/cycle.js';
import { mod } from '../core/mod.js';

export interface RawShinsalCatalog {
  meta?: {
    id?: string;
    version?: string;
    description?: string;
  };

  /** key → { branches: { '甲': ['丑','未'], ... } } */
  dayStem?: Record<
    string,
    {
      branches: Record<string, string[]>;
      description?: string;
    }
  >;

  /**
   * Month-branch based STEM targets: key → { stems: { '寅': ['丙'], ... } }
   *
   * Typically used for 월덕/월덕합, and stem-part of 천덕/천덕합.
   */
  monthBranchStem?: Record<
    string,
    {
      stems: Record<string, string[]>;
      description?: string;
    }
  >;

  /**
   * Month-branch based BRANCH targets: key → { branches: { '卯': ['申'], ... } }
   *
   * Typically used for branch-part of 천덕.
   */
  monthBranchBranch?: Record<
    string,
    {
      branches: Record<string, string[]>;
      description?: string;
    }
  >;

  /** key → { primary: ['甲辰', ...], extended?: ['戊辰', ...], requiresDayPillar?: boolean } */
  dayPillar?: Record<
    string,
    {
      primary: string[];
      extended?: string[];
      requiresDayPillar?: boolean;
      description?: string;
    }
  >;
}

export interface NormalizedDayStemSpec {
  /** length 10; missing stems become empty arrays */
  byStem: BranchIdx[][];
  description?: string;
}

export interface NormalizedMonthBranchStemSpec {
  /** length 12; missing branches become empty arrays */
  byBranch: StemIdx[][];
  description?: string;
}

export interface NormalizedMonthBranchBranchSpec {
  /** length 12; missing branches become empty arrays */
  byBranch: BranchIdx[][];
  description?: string;
}

export interface NormalizedDayPillarSpec {
  primary: Set<number>; // 60-index
  extended: Set<number>; // 60-index
  requiresDayPillar: boolean;
  description?: string;
}

export interface NormalizedShinsalCatalog {
  meta: {
    id: string;
    version: string;
    description?: string;
  };
  dayStem: Record<string, NormalizedDayStemSpec>;
  monthBranchStem: Record<string, NormalizedMonthBranchStemSpec>;
  monthBranchBranch: Record<string, NormalizedMonthBranchBranchSpec>;
  dayPillar: Record<string, NormalizedDayPillarSpec>;
}

export function mergeRawShinsalCatalog(base: RawShinsalCatalog, ext: RawShinsalCatalog): RawShinsalCatalog {
  return {
    meta: { ...base.meta, ...ext.meta },
    dayStem: { ...(base.dayStem ?? {}), ...(ext.dayStem ?? {}) },
    monthBranchStem: { ...(base.monthBranchStem ?? {}), ...(ext.monthBranchStem ?? {}) },
    monthBranchBranch: { ...(base.monthBranchBranch ?? {}), ...(ext.monthBranchBranch ?? {}) },
    dayPillar: { ...(base.dayPillar ?? {}), ...(ext.dayPillar ?? {}) },
  };
}

function parseGanzhiHanjaPair(s: string): PillarIdx | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (t.length < 2) return null;
  const stemH = t[0]!;
  const branchH = t[1]!;
  const stem = stemIdxFromHanja(stemH);
  const branch = branchIdxFromHanja(branchH);
  if (stem == null || branch == null) return null;
  return pillar(stem, branch);
}

function normalizeDayStemSpec(
  raw: { branches: Record<string, string[]>; description?: string } | undefined,
): NormalizedDayStemSpec {
  const byStem: BranchIdx[][] = Array.from({ length: 10 }, () => [] as BranchIdx[]);
  const branches = (raw?.branches ?? {}) as Record<string, string[]>;

  for (const [stemH, brs] of Object.entries(branches)) {
    const sIdx = stemIdxFromHanja(stemH);
    if (sIdx == null) continue;
    const targets: BranchIdx[] = [];
    for (const bH of brs ?? []) {
      const bIdx = branchIdxFromHanja(String(bH));
      if (bIdx == null) continue;
      targets.push(bIdx);
    }
    // de-dup + normalize
    const uniq = Array.from(new Set(targets.map((x) => mod(x, 12) as BranchIdx)));
    byStem[sIdx] = uniq;
  }

  return { byStem, description: raw?.description };
}

function normalizeMonthBranchStemSpec(
  raw: { stems: Record<string, string[]>; description?: string } | undefined,
): NormalizedMonthBranchStemSpec {
  const byBranch: StemIdx[][] = Array.from({ length: 12 }, () => [] as StemIdx[]);
  const stems = (raw?.stems ?? {}) as Record<string, string[]>;

  for (const [monthBranchH, ss] of Object.entries(stems)) {
    const bIdx = branchIdxFromHanja(monthBranchH);
    if (bIdx == null) continue;

    const targets: StemIdx[] = [];
    for (const sH of ss ?? []) {
      const sIdx = stemIdxFromHanja(String(sH));
      if (sIdx == null) continue;
      targets.push(sIdx);
    }

    const uniq = Array.from(new Set(targets.map((x) => mod(x, 10) as StemIdx)));
    byBranch[bIdx] = uniq;
  }

  return { byBranch, description: raw?.description };
}

function normalizeMonthBranchBranchSpec(
  raw: { branches: Record<string, string[]>; description?: string } | undefined,
): NormalizedMonthBranchBranchSpec {
  const byBranch: BranchIdx[][] = Array.from({ length: 12 }, () => [] as BranchIdx[]);
  const branches = (raw?.branches ?? {}) as Record<string, string[]>;

  for (const [monthBranchH, bs] of Object.entries(branches)) {
    const bIdx = branchIdxFromHanja(monthBranchH);
    if (bIdx == null) continue;

    const targets: BranchIdx[] = [];
    for (const bH of bs ?? []) {
      const tIdx = branchIdxFromHanja(String(bH));
      if (tIdx == null) continue;
      targets.push(tIdx);
    }

    const uniq = Array.from(new Set(targets.map((x) => mod(x, 12) as BranchIdx)));
    byBranch[bIdx] = uniq;
  }

  return { byBranch, description: raw?.description };
}

function normalizeDayPillarSpec(
  raw:
    | {
        primary: string[];
        extended?: string[];
        requiresDayPillar?: boolean;
        description?: string;
      }
    | undefined,
): NormalizedDayPillarSpec {
  const primary = new Set<number>();
  const extended = new Set<number>();

  for (const s of raw?.primary ?? []) {
    const p = parseGanzhiHanjaPair(s);
    if (!p) continue;
    const idx = ganzhiIndex(p);
    if (idx != null) primary.add(mod(idx, 60));
  }

  for (const s of raw?.extended ?? []) {
    const p = parseGanzhiHanjaPair(s);
    if (!p) continue;
    const idx = ganzhiIndex(p);
    if (idx != null) extended.add(mod(idx, 60));
  }

  return {
    primary,
    extended,
    requiresDayPillar: raw?.requiresDayPillar ?? true,
    description: raw?.description,
  };
}

export function normalizeShinsalCatalog(raw: RawShinsalCatalog): NormalizedShinsalCatalog {
  const meta = {
    id: raw?.meta?.id ?? 'shinsal.catalog.unknown',
    version: raw?.meta?.version ?? '0',
    description: raw?.meta?.description,
  };

  const dayStem: Record<string, NormalizedDayStemSpec> = {};
  for (const [k, spec] of Object.entries(raw?.dayStem ?? {})) {
    dayStem[k] = normalizeDayStemSpec(spec);
  }

  const monthBranchStem: Record<string, NormalizedMonthBranchStemSpec> = {};
  for (const [k, spec] of Object.entries(raw?.monthBranchStem ?? {})) {
    monthBranchStem[k] = normalizeMonthBranchStemSpec(spec);
  }

  const monthBranchBranch: Record<string, NormalizedMonthBranchBranchSpec> = {};
  for (const [k, spec] of Object.entries(raw?.monthBranchBranch ?? {})) {
    monthBranchBranch[k] = normalizeMonthBranchBranchSpec(spec);
  }

  const dayPillar: Record<string, NormalizedDayPillarSpec> = {};
  for (const [k, spec] of Object.entries(raw?.dayPillar ?? {})) {
    dayPillar[k] = normalizeDayPillarSpec(spec);
  }

  return { meta, dayStem, monthBranchStem, monthBranchBranch, dayPillar };
}
