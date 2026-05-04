/**
 * glossary-loader.ts -- Load tiered-matrix glossary entries
 *
 * Reads every JSON bundle under `data/narrative/_glossary/*.json`,
 * unwraps the `entries: GlossaryEntry[]` payload, and returns a
 * `Record<TagId, GlossaryEntry>` lookup.
 *
 * The loader memoizes its result — repeated calls return the same
 * frozen record. Designed for Node runtime; browser callers must pre-
 * bundle the JSON imports separately (NameSpring already follows this
 * pattern for static `data/**` reads).
 */

// node:fs / node:path / node:url are imported but NEVER touched at module-load
// time. All `fs.*` and `path.*` calls live inside the `loadGlossary` function
// body, which is reached only when `surfaceTieredMatrix === true`. Browser
// callers (NameSpring vite bundle) that keep the flag at default-false never
// trigger fs even though vite externalizes these imports.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GlossaryEntry, TagId } from '../types.js';
import { normalizeRenderedText } from './template-engine.js';

interface GlossaryBundle {
  schemaVersion: 'spring-ts.glossary-bundle.v1';
  category: string;
  entries: GlossaryEntry[];
}

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

let cached: Readonly<Record<TagId, GlossaryEntry>> | null = null;

function normalizeGlossaryEntry(entry: GlossaryEntry): GlossaryEntry | null {
  if (!entry?.id || !entry.label || !entry.hashLabel || !entry.category) return null;
  return {
    id: entry.id,
    label: entry.label,
    hashLabel: entry.hashLabel,
    category: entry.category,
    brief: normalizeRenderedText(entry.brief ?? ''),
    detailed: normalizeRenderedText(entry.detailed ?? ''),
    ...(entry.classicalSource ? { classicalSource: entry.classicalSource } : {}),
    related: Array.isArray(entry.related) ? entry.related : [],
  };
}

export function loadGlossary(): Readonly<Record<TagId, GlossaryEntry>> {
  if (cached) return cached;
  const out: Record<TagId, GlossaryEntry> = {};
  if (!isNodeRuntime()) {
    cached = Object.freeze(out);
    return cached;
  }
  // All fs / path resolution deferred until first call so module evaluation
  // does not touch externalized node builtins on a browser bundle.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const glossaryDir = path.resolve(here, '../../../data/narrative/_glossary');
  if (!fs.existsSync(glossaryDir)) {
    cached = Object.freeze(out);
    return cached;
  }
  const files = fs.readdirSync(glossaryDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const full = path.join(glossaryDir, file);
    let bundle: GlossaryBundle;
    try {
      bundle = JSON.parse(fs.readFileSync(full, 'utf-8')) as GlossaryBundle;
    } catch {
      continue;
    }
    if (!Array.isArray(bundle?.entries)) continue;
    for (const entry of bundle.entries) {
      const normalized = normalizeGlossaryEntry(entry);
      if (!normalized) continue;
      out[normalized.id] = normalized;
    }
  }
  cached = Object.freeze(out);
  return cached;
}

/** Test-only — clear the memo cache so a test can re-load freshly. */
export function _clearGlossaryCacheForTesting(): void {
  cached = null;
}
