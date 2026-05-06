#!/usr/bin/env node
// Compare three same-input/different-targetDate outputs cell-by-cell.
// Checks how much the prose changes for daily-cycle vs life-stage cells.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputs = [
  'multi-target-2026-05-05.json',
  'multi-target-2026-08-15.json',
  'multi-target-2027-02-04.json',
];

function* walkPlainText(node, trail) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) yield* walkPlainText(node[i], [...trail, i]);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'plainText' && typeof value === 'string') {
      yield { trail: [...trail, key], plainText: value };
      continue;
    }
    if (key === 'headline' && typeof value === 'string') {
      yield { trail: [...trail, key], plainText: value };
      continue;
    }
    yield* walkPlainText(value, [...trail, key]);
  }
}

function classify(trail) {
  const result = { period: null, category: null, depth: null, slot: null };
  let hit = false;
  for (let i = 0; i < trail.length; i += 1) {
    if (trail[i] === 'periods' && typeof trail[i + 1] === 'string') {
      result.period = trail[i + 1];
      hit = true;
    }
    if (trail[i] === 'byCategory' && typeof trail[i + 1] === 'string') result.category = trail[i + 1];
    if (trail[i] === 'overall') result.category = 'overall';
    if (trail[i] === 'brief' || trail[i] === 'standard' || trail[i] === 'expert') result.depth = trail[i];
  }
  const last = trail[trail.length - 1];
  const second = trail[trail.length - 2];
  if (last === 'headline') result.slot = 'headline';
  else if (last === 'plainText') result.slot = typeof second === 'number' ? `para${second}` : 'plain';
  return hit ? result : null;
}

function extractCells(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cells = new Map();
  for (const item of walkPlainText(data.tieredMatrix, ['tieredMatrix'])) {
    const c = classify(item.trail);
    if (!c || !c.depth) continue;
    const key = `${c.period}/${c.category ?? '_unknown'}/${c.depth}/${c.slot}`;
    if (!cells.has(key)) cells.set(key, { period: c.period, category: c.category, depth: c.depth, slot: c.slot, texts: [] });
    cells.get(key).texts.push(item.plainText);
  }
  const out = new Map();
  for (const [k, v] of cells) out.set(k, { ...v, plain: v.texts.join('\n') });
  return { tag: path.basename(file).replace('multi-target-', '').replace('.json', ''), seed: data.seed, cells: out };
}

const corpora = inputs.map((f) => extractCells(path.join(__dirname, f)));

const seeds = corpora.map((c) => c.seed);
console.log('seeds:', seeds);

const allKeys = new Set();
for (const c of corpora) for (const k of c.cells.keys()) allKeys.add(k);

const cellDiffs = [];
const periodBuckets = {};
for (const k of allKeys) {
  const versions = corpora.map((c) => c.cells.get(k)?.plain ?? null);
  const present = versions.filter((v) => v != null);
  if (present.length < 2) continue;
  const distinct = new Set(present).size;
  const sample = corpora.find((c) => c.cells.has(k))?.cells.get(k);
  const period = sample?.period;
  const depth = sample?.depth;
  const cat = sample?.category;
  cellDiffs.push({ cellKey: k, period, category: cat, depth, presentIn: present.length, distinct, ratio: distinct / present.length });
  if (!periodBuckets[period]) periodBuckets[period] = { all: [] };
  periodBuckets[period].all.push(distinct / present.length);
}

cellDiffs.sort((a, b) => a.ratio - b.ratio);

const summary = {
  corpora: corpora.map((c) => ({ tag: c.tag, seed: c.seed, cellCount: c.cells.size })),
  totalSharedCells: cellDiffs.length,
  cellsAllSame: cellDiffs.filter((c) => c.distinct === 1 && c.presentIn === 3).length,
  cellsPartialDiff: cellDiffs.filter((c) => c.distinct === 2 && c.presentIn === 3).length,
  cellsFullyDistinct: cellDiffs.filter((c) => c.distinct === 3 && c.presentIn === 3).length,
};

const byPeriod = {};
for (const [p, v] of Object.entries(periodBuckets)) {
  const ratios = v.all;
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  byPeriod[p] = {
    cells: ratios.length,
    meanDistinctRatio: mean,
    cellsAllSame: ratios.filter((r) => r < 0.5).length,
    cellsAllDifferent: ratios.filter((r) => r === 1).length,
  };
}

const out = {
  generatedAt: new Date().toISOString(),
  summary,
  byPeriod,
  cellsAllIdenticalAcross3: cellDiffs.filter((c) => c.distinct === 1 && c.presentIn === 3).slice(0, 30),
  cellsFullyDistinctAcross3: cellDiffs.filter((c) => c.distinct === 3 && c.presentIn === 3).slice(0, 30),
};
const outPath = path.join(__dirname, 'multi-target-report.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(`shared cells: ${summary.totalSharedCells}`);
console.log(`all 3 same: ${summary.cellsAllSame}`);
console.log(`2-distinct: ${summary.cellsPartialDiff}`);
console.log(`fully distinct (all 3 differ): ${summary.cellsFullyDistinct}`);
console.log('by period:', JSON.stringify(byPeriod, null, 2));
console.log(`output: ${outPath}`);
