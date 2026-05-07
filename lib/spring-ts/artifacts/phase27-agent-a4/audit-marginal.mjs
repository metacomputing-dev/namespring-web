#!/usr/bin/env node
// Phase 27 Agent A4 - Marginal depth_inversion audit
//
// Reuses P21-A2 logic (audit-phase12.mjs depth_inversion) but reports the
// marginal band 0.6 <= sim < 0.75 in addition to the >= 0.75 hits.
// Goal: identify cells where standard.first-sentence is approaching the
// brief.headline in wording so the standard tier can be paraphrased BEFORE
// it crosses the 0.75 detector threshold (regression prevention).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corpusPath = path.resolve(
  __dirname,
  '..',
  'phase12-agent-a5',
  'prose-corpus.json',
);
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

const PARTICLE_RE = /(은|는|이|가|을|를|의|에|에서|와|과|도|만|으로|로|요|예요|이에요|이다|다)$/;

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function normalizeForOverlap(text) {
  let s = text.split(/[.!?\n]/)[0];
  s = s.replace(/\s+/g, '');
  s = s.replace(/[.,!?·]/g, '');
  for (let i = 0; i < 4; i += 1) {
    const before = s;
    s = s.replace(PARTICLE_RE, '');
    if (s === before) break;
  }
  return s;
}

const MIN_LEN = 6;
const LOW = 0.6;
const HIGH = 0.75;

const fixtureNames = Array.from(new Set(corpus.records.map((r) => r.fixture)));
const allCells = [];
for (const fx of fixtureNames) {
  const groups = new Map();
  for (const r of corpus.records) {
    if (r.fixture !== fx) continue;
    const key = r.period + '/' + r.category;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  for (const [key, items] of groups) {
    const briefH = items.find((x) => x.depth === 'brief' && x.slot === 'headline');
    const standardP0 = items.find(
      (x) => x.depth === 'standard' && (x.slot === 'plain' || x.slot === 'para0'),
    );
    if (!briefH || !standardP0) continue;
    const a = normalizeForOverlap(briefH.plainText);
    const b = normalizeForOverlap(standardP0.plainText);
    if (a.length < MIN_LEN || b.length < MIN_LEN) continue;
    const dist = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    const similarity = 1 - dist / maxLen;
    allCells.push({
      fixture: fx,
      period: key.split('/')[0],
      category: key.split('/')[1],
      similarity: Number(similarity.toFixed(4)),
      editDistance: dist,
      brief: briefH.plainText,
      standard: standardP0.plainText,
      briefNorm: a,
      standardNorm: b,
    });
  }
}

allCells.sort((x, y) => y.similarity - x.similarity);

const buckets = {
  high: allCells.filter((c) => c.similarity >= HIGH),
  marginal: allCells.filter((c) => c.similarity >= LOW && c.similarity < HIGH),
  safe: allCells.filter((c) => c.similarity < LOW),
};

const summary = {
  totalPairs: allCells.length,
  high: buckets.high.length,
  marginal: buckets.marginal.length,
  safe: buckets.safe.length,
};

console.log('Phase 27 A4 marginal-band depth_inversion audit:');
console.log(JSON.stringify(summary, null, 2));

const outPath = path.join(__dirname, 'marginal-cells.json');
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      summary,
      thresholds: { high: HIGH, low: LOW, minLen: MIN_LEN },
      high: buckets.high,
      marginal: buckets.marginal,
    },
    null,
    2,
  ),
);
console.log('output:', outPath);

console.log('\nTop 25 marginal cells (sim ' + LOW + '–' + HIGH + '):');
for (const c of buckets.marginal.slice(0, 25)) {
  console.log(`  [${c.similarity}] ${c.fixture} ${c.period}/${c.category}`);
  console.log(`    brief: ${c.brief.substring(0, 70)}`);
  console.log(`    std:   ${c.standard.substring(0, 70)}`);
}
