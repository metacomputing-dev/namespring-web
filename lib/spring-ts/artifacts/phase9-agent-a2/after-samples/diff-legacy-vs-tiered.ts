/**
 * Diff helper — legacy NameSpring fortune output vs tiered surfacing.
 *
 * Reads the two paired Choi-Seongsoo fixtures from this directory and emits
 * `diff-legacy-vs-tiered.json` describing top-level key add/keep/drop sets,
 * tieredMatrix shape summary, and a deep-key sample (first 25 leaf paths
 * appearing only on the tiered side).
 *
 * Usage (from lib/spring-ts):
 *   npx tsx artifacts/sample-outputs-2026-05-05-phase3/diff-legacy-vs-tiered.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEGACY_PATH = path.join(__dirname, '01-choi-seongsoo-current-fortune.json');
const TIERED_PATH = path.join(__dirname, '02-choi-seongsoo-tiered-fortune.json');
const VECTOR_PATH = path.join(__dirname, '03-choi-seongsoo-spring-report-vector.json');
const OUT_PATH = path.join(__dirname, 'diff-legacy-vs-tiered.json');

type Json = unknown;

function readEnvelope(p: string): { sampleId: string; description: string; call: string; payload: any } {
  const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return raw;
}

function leafPaths(value: Json, prefix = '', out: string[] = [], depth = 0, maxDepth = 6): string[] {
  if (depth > maxDepth) return out;
  if (value === null || typeof value !== 'object') {
    out.push(prefix || '<root>');
    return out;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push(`${prefix}[]`);
      return out;
    }
    leafPaths(value[0], `${prefix}[]`, out, depth + 1, maxDepth);
    return out;
  }
  for (const k of Object.keys(value)) {
    leafPaths((value as Record<string, Json>)[k], prefix ? `${prefix}.${k}` : k, out, depth + 1, maxDepth);
  }
  return out;
}

function setDiff(a: string[], b: string[]): { added: string[]; removed: string[]; shared: string[] } {
  const aSet = new Set(a);
  const bSet = new Set(b);
  return {
    added: [...bSet].filter((x) => !aSet.has(x)).sort(),
    removed: [...aSet].filter((x) => !bSet.has(x)).sort(),
    shared: [...aSet].filter((x) => bSet.has(x)).sort(),
  };
}

const legacy = readEnvelope(LEGACY_PATH);
const tiered = readEnvelope(TIERED_PATH);
const vector = fs.existsSync(VECTOR_PATH) ? readEnvelope(VECTOR_PATH) : null;

const legacyTop = Object.keys(legacy.payload).sort();
const tieredTop = Object.keys(tiered.payload).sort();

const legacyLeaf = leafPaths(legacy.payload).sort();
const tieredLeaf = leafPaths(tiered.payload).sort();

const topDiff = setDiff(legacyTop, tieredTop);
const leafDiffSample = setDiff(legacyLeaf, tieredLeaf);

const tieredMatrix = tiered.payload.tieredMatrix;
const tieredMatrixSummary = tieredMatrix
  ? {
      schemaVersion: tieredMatrix.schemaVersion,
      periods: Object.keys(tieredMatrix.periods ?? {}),
      categoriesPerPeriod: Object.fromEntries(
        Object.entries(tieredMatrix.periods ?? {}).map(([periodKey, p]: [string, any]) => [
          periodKey,
          ['overall', ...Object.keys(p.byCategory ?? {})],
        ]),
      ),
      glossaryEntryCount: Object.keys(tieredMatrix.glossary?.entries ?? {}).length,
      glossaryUsedCount: tieredMatrix.glossary?.usedInThisReport?.length ?? null,
      meta: tieredMatrix.meta ?? null,
      hasNamingEvidence: Boolean(tieredMatrix.namingEvidence),
    }
  : null;

const out: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
  pair: {
    legacy: {
      file: path.basename(LEGACY_PATH),
      sampleId: legacy.sampleId,
      call: legacy.call,
    },
    tiered: {
      file: path.basename(TIERED_PATH),
      sampleId: tiered.sampleId,
      call: tiered.call,
    },
  },
  topLevel: {
    legacyKeys: legacyTop,
    tieredKeys: tieredTop,
    addedInTiered: topDiff.added,
    removedInTiered: topDiff.removed,
    shared: topDiff.shared,
    keyCountLegacy: legacyTop.length,
    keyCountTiered: tieredTop.length,
  },
  leafPathDiff: {
    legacyLeafCount: legacyLeaf.length,
    tieredLeafCount: tieredLeaf.length,
    sharedLeafCount: leafDiffSample.shared.length,
    addedSample: leafDiffSample.added.slice(0, 25),
    removedSample: leafDiffSample.removed.slice(0, 25),
  },
  tieredMatrix: tieredMatrixSummary,
};

if (vector) {
  const vectorTop = Object.keys(vector.payload).sort();
  const vectorVsLegacy = setDiff(legacyTop, vectorTop);
  out.springReportVector = {
    file: path.basename(VECTOR_PATH),
    sampleId: vector.sampleId,
    call: vector.call,
    topLevelKeys: vectorTop,
    addedVsLegacyFortune: vectorVsLegacy.added,
    note: 'getSpringReport vs getFortuneReport — different envelope (combines naming + saju), so top-level shape diverges by design.',
  };
}

fs.writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf-8');
console.log(`Wrote ${OUT_PATH}`);
console.log(`legacy keys=${legacyTop.length} tiered keys=${tieredTop.length} (added=${topDiff.added.length})`);
