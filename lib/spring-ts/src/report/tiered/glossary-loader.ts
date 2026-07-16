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

import type { GlossaryEntry, TagId } from '../types.js';
import { snapshotJsonValue } from './immutable-json-snapshot.js';

/** Whitespace-only cleanup. Glossary prose is authored and reviewed at the
 *  source — there is deliberately no rewrite pipeline here (WYSIWYG). */
function cleanGlossaryText(value: string): string {
  return value.replace(/[ \t]+/g, ' ').trim();
}

declare global {
  interface ImportMeta {
    glob: (pattern: string, options?: { eager?: boolean }) => Record<string, unknown>;
  }
}

const browserGlossaryModules = (() => {
  try {
    return import.meta.glob('../../../data/narrative/_glossary/*.json', { eager: true });
  } catch {
    return {};
  }
})();

interface GlossaryBundle {
  schemaVersion: 'spring-ts.glossary-bundle.v1';
  category: string;
  entries: GlossaryEntry[];
}

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isNodeRuntime(): boolean {
  return !isBrowserRuntime() && typeof process !== 'undefined' && Boolean(process.versions?.node);
}

const nodeBuiltins = isNodeRuntime()
  ? await (async () => {
    const [fsModule, pathModule, urlModule] = await Promise.all([
      import('node:fs'),
      import('node:path'),
      import('node:url'),
    ]);
    return {
      fs: fsModule,
      path: pathModule,
      fileURLToPath: urlModule.fileURLToPath,
    };
  })()
  : null;

let cached: Readonly<Record<TagId, GlossaryEntry>> | null = null;

function unwrapJsonModule(moduleValue: unknown): unknown {
  if (moduleValue && typeof moduleValue === 'object' && 'default' in moduleValue) {
    return (moduleValue as { default?: unknown }).default;
  }
  return moduleValue;
}

function normalizeGlossaryEntry(entry: GlossaryEntry): GlossaryEntry | null {
  if (!entry?.id || !entry.label || !entry.hashLabel || !entry.category) return null;
  return snapshotJsonValue({
    id: entry.id,
    label: entry.label,
    hashLabel: entry.hashLabel,
    category: entry.category,
    brief: cleanGlossaryText(entry.brief ?? ''),
    detailed: cleanGlossaryText(entry.detailed ?? ''),
    ...(entry.classicalSource ? { classicalSource: entry.classicalSource } : {}),
    related: Array.isArray(entry.related) ? entry.related : [],
  });
}

export function loadGlossary(): Readonly<Record<TagId, GlossaryEntry>> {
  if (cached) return cached;
  const out: Record<TagId, GlossaryEntry> = {};
  if (!isNodeRuntime()) {
    for (const moduleValue of Object.values(browserGlossaryModules)) {
      const bundle = unwrapJsonModule(moduleValue) as GlossaryBundle;
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
  // All fs / path resolution deferred until first call so module evaluation
  // does not touch externalized node builtins on a browser bundle.
  if (!nodeBuiltins) {
    cached = Object.freeze(out);
    return cached;
  }
  const here = nodeBuiltins.path.dirname(nodeBuiltins.fileURLToPath(import.meta.url));
  const glossaryDir = nodeBuiltins.path.resolve(here, '../../../data/narrative/_glossary');
  if (!nodeBuiltins.fs.existsSync(glossaryDir)) {
    cached = Object.freeze(out);
    return cached;
  }
  const files = nodeBuiltins.fs.readdirSync(glossaryDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const full = nodeBuiltins.path.join(glossaryDir, file);
    let bundle: GlossaryBundle;
    try {
      bundle = JSON.parse(nodeBuiltins.fs.readFileSync(full, 'utf-8')) as GlossaryBundle;
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
