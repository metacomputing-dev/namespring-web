#!/usr/bin/env node
/**
 * artifacts/phase15-agent-a4/measure_p15_a4.mjs
 *
 * Phase 15 Agent A4 cluster measurement. Reads the regenerated tiered
 * sample outputs at artifacts/sample-outputs-2026-05-05-phase3/ and
 * counts cells whose any rendered paragraph contains 3 or more
 * `흐름이` occurrences (the cluster pattern documented in P14-A5 §B3).
 *
 * Read-only. No engine spawn, no fragment-data writes, no network.
 *
 * Usage: node artifacts/phase15-agent-a4/measure_p15_a4.mjs [out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SAMPLES_DIR = path.resolve(
  SPRING_TS_ROOT,
  'artifacts/sample-outputs-2026-05-05-phase3',
);
const TIERED_FILE_RE = /-tiered\.json$/;
const TARGET = '흐름이';
const THRESHOLD = 3;

function countOccurrences(text, needle) {
  if (typeof text !== 'string' || text.length === 0) return 0;
  let count = 0;
  let idx = text.indexOf(needle);
  while (idx >= 0) {
    count += 1;
    idx = text.indexOf(needle, idx + needle.length);
  }
  return count;
}

function paragraphsFromCellTier(tier) {
  if (!tier) return [];
  const out = [];
  if (typeof tier.headline === 'string') out.push(tier.headline);
  if (Array.isArray(tier.paragraphs)) {
    for (const p of tier.paragraphs) {
      if (typeof p?.plainText === 'string') out.push(p.plainText);
      else if (typeof p?.text === 'string') out.push(p.text);
    }
  }
  return out;
}

const sampleFiles = fs
  .readdirSync(SAMPLES_DIR)
  .filter((f) => TIERED_FILE_RE.test(f))
  .sort();

const cellsWithCluster = [];
let totalCells = 0;
let totalParagraphsWithCluster = 0;
const fragmentSourceCounts = new Map();

for (const file of sampleFiles) {
  const fullPath = path.join(SAMPLES_DIR, file);
  const fixtureId = file.replace(/\.json$/, '');
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const tm = json?.payload?.tieredMatrix ?? json?.tieredMatrix;
  if (!tm?.periods) continue;
  for (const periodKey of Object.keys(tm.periods)) {
    const period = tm.periods[periodKey];
    if (!period) continue;
    const cells = [
      ['overall', period.overall],
      ...Object.entries(period.byCategory ?? {}),
    ];
    for (const [catKey, cell] of cells) {
      if (!cell) continue;
      totalCells += 1;
      const candidates = [
        ['brief', paragraphsFromCellTier(cell.brief)],
        ['standard', paragraphsFromCellTier(cell.standard)],
        ['expert', paragraphsFromCellTier(cell.expert)],
      ];
      let hitOnceForCell = false;
      for (const [tierKey, paras] of candidates) {
        for (const p of paras) {
          const c = countOccurrences(p, TARGET);
          if (c >= THRESHOLD) {
            totalParagraphsWithCluster += 1;
            if (!hitOnceForCell) {
              const fragId =
                cell.selectedFragments?.[tierKey]?.fragmentId ?? null;
              cellsWithCluster.push({
                fixture: fixtureId,
                period: periodKey,
                category: catKey,
                tier: tierKey,
                count: c,
                fragmentId: fragId,
                excerpt: p.slice(0, 140),
              });
              if (fragId) {
                fragmentSourceCounts.set(
                  fragId,
                  (fragmentSourceCounts.get(fragId) ?? 0) + 1,
                );
              }
              hitOnceForCell = true;
            }
          }
        }
      }
    }
  }
}

const out = {
  phase: 'P15-A4',
  generatedAt: new Date().toISOString(),
  source: path.relative(SPRING_TS_ROOT, SAMPLES_DIR),
  threshold: THRESHOLD,
  needle: TARGET,
  totalCells,
  cellsWithClusterCount: cellsWithCluster.length,
  paragraphsWithCluster: totalParagraphsWithCluster,
  fragmentSourceCounts: Object.fromEntries(
    Array.from(fragmentSourceCounts.entries()).sort((a, b) => b[1] - a[1]),
  ),
  cellsWithCluster,
};

const target = process.argv[2];
const txt = JSON.stringify(out, null, 2);
if (target) {
  fs.writeFileSync(target, txt + '\n');
  console.log(`Wrote ${target}`);
  console.log(
    `cellsWithClusterCount=${cellsWithCluster.length} totalCells=${totalCells}`,
  );
} else {
  console.log(txt);
}
