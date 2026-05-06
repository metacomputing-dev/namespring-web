/**
 * fragment-registry.ts -- Static index over data/narrative/**.fragments.json
 *
 * On first call the registry walks `data/narrative/` (excluding
 * `_glossary/` and `_contract/`), parses every `*.fragments.json` bundle,
 * and groups fragments by (category, period, depth) for O(1) lookup.
 * Subsequent calls hit the in-memory cache.
 */

// node:fs / node:path / node:url are imported but NEVER touched at module-load
// time. All filesystem walks live inside `loadFragmentRegistry`, which only
// runs when `surfaceTieredMatrix === true`. The browser bundle (vite-externalized
// node builtins) is safe as long as nothing here executes at module evaluation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  TieredCategoryId,
  TieredPeriodKind,
  TieredDepth,
} from '../types.js';

export interface FragmentToken {
  readonly kind: 'text' | 'slot' | 'tag';
  readonly value?: string;
  readonly name?: string;
  readonly type?: string;
  readonly tagId?: string;
  readonly label?: string;
}

export interface NarrativeFragment {
  readonly schemaVersion: 'spring-ts.narrative-fragment.v1';
  readonly fragmentId: string;
  readonly axis: {
    readonly category: 'overall' | TieredCategoryId;
    readonly period: TieredPeriodKind;
    readonly depth: TieredDepth;
    readonly tone?: 'expert' | 'plain' | 'counselor' | null;
  };
  readonly gating: {
    readonly gender?: readonly string[];
    readonly agePhase?: readonly string[];
    readonly ageBand?: readonly string[];
    readonly currentSeason?: readonly string[];
    readonly birthSeason?: readonly string[];
    readonly dayMasterPolarity?: readonly string[];
    readonly dayMasterStrength?: readonly string[];
    readonly yongshinAlignment?: readonly string[];
    readonly dayMasterElement?: readonly string[];
    readonly yongshinElement?: readonly string[];
    readonly gyeokguk?: readonly string[];
  };
  readonly templateTokens: readonly FragmentToken[];
  readonly slots?: Readonly<Record<string, readonly string[]>>;
  readonly tags: readonly string[];
  readonly livingTips?: readonly string[];
  readonly cautions?: readonly string[];
  readonly numericalEvidence?: readonly {
    readonly label: string;
    readonly valueExpression: string;
    readonly unit?: string;
    readonly sourceTier: unknown;
  }[];
  readonly headlineSlot?: string;
  readonly hookSlot?: string;
  /**
   * Brief-tier optional supporting sentence (P13-A1). Surfaces on
   * `BriefFortuneText.hook` when present and ≤24 Korean code points after
   * normalization. Distinct from `hookSlot`, which references a slot name
   * inside `slots` (legacy, unused). `hook` is a literal string authored
   * directly into the fragment bundle. Style-guide §2-1 frames it as the
   * optional 보조 한 문장 of the brief tier.
   */
  readonly hook?: string;
  readonly aiGenerated: boolean;
  readonly sourceTier: unknown;
}

interface FragmentBundle {
  schemaVersion: string;
  fragments: NarrativeFragment[];
}

type CellKey = string;
function cellKey(cat: string, period: string, depth: string): CellKey {
  return `${cat}|${period}|${depth}`;
}

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

function listFragmentBundles(rootDir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(rootDir)) return out;
  function walk(dir: string): void {
    const skipBase = ['_glossary', '_contract'];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipBase.includes(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.fragments.json')) {
        out.push(full);
      }
    }
  }
  walk(rootDir);
  return out;
}

export interface FragmentRegistry {
  get(category: string, period: TieredPeriodKind, depth: TieredDepth): readonly NarrativeFragment[];
  totalFragmentCount: number;
  contentSource: 'placeholder' | 'authored';
}

let cachedRegistry: FragmentRegistry | null = null;

export function loadFragmentRegistry(): FragmentRegistry {
  if (cachedRegistry) return cachedRegistry;

  const map = new Map<CellKey, NarrativeFragment[]>();
  let count = 0;
  let authoredCount = 0;

  if (isNodeRuntime()) {
    // All fs / path resolution deferred until first call so module evaluation
    // does not touch externalized node builtins on a browser bundle.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const narrativeDir = path.resolve(here, '../../../data/narrative');
    for (const file of listFragmentBundles(narrativeDir)) {
      let bundle: FragmentBundle;
      try {
        bundle = JSON.parse(fs.readFileSync(file, 'utf-8')) as FragmentBundle;
      } catch {
        continue;
      }
      if (!Array.isArray(bundle?.fragments)) continue;
      const isSeedBundle = file.includes(`${path.sep}_seed${path.sep}`);
      for (const frag of bundle.fragments) {
        if (!frag?.axis) continue;
        const key = cellKey(frag.axis.category, frag.axis.period, frag.axis.depth);
        const list = map.get(key);
        if (list) list.push(frag);
        else map.set(key, [frag]);
        count += 1;
        if (!isSeedBundle) authoredCount += 1;
      }
    }
  }

  cachedRegistry = Object.freeze({
    get(category: string, period: TieredPeriodKind, depth: TieredDepth) {
      return map.get(cellKey(category, period, depth)) ?? [];
    },
    totalFragmentCount: count,
    contentSource: authoredCount > 0 ? 'authored' : 'placeholder',
  });
  return cachedRegistry;
}

/** Test-only — clear the memo cache so a test can re-load freshly. */
export function _clearFragmentRegistryCacheForTesting(): void {
  cachedRegistry = null;
}
