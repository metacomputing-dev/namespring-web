#!/usr/bin/env node
// Build a fragment reuse heatmap TSV from prose-corpus.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'prose-corpus.json'), 'utf8'));
const records = corpus.records;
const fixtures = corpus.fixtures.map((f) => f.fixture);

const proseToFixtures = new Map();
for (const r of records) {
  const key = r.plainText.trim();
  if (!key) continue;
  if (!proseToFixtures.has(key)) proseToFixtures.set(key, new Set());
  proseToFixtures.get(key).add(r.fixture);
}

const sorted = [...proseToFixtures.entries()]
  .map(([prose, fset]) => ({ prose, count: fset.size, fixtures: fset }))
  .sort((a, b) => b.count - a.count);

const top = sorted.slice(0, 50);
const lines = [];
const header = ['proseExcerpt', 'fixtureCount', ...fixtures.map((f) => f.replace('.json', '').slice(0, 8))];
lines.push(header.join('\t'));
for (const e of top) {
  const row = [e.prose.replaceAll('\t', ' ').replaceAll('\n', '|').slice(0, 80), e.count];
  for (const f of fixtures) row.push(e.fixtures.has(f) ? 'X' : '.');
  lines.push(row.join('\t'));
}

const outTsv = path.join(__dirname, 'fragment-reuse-heatmap.tsv');
fs.writeFileSync(outTsv, lines.join('\n'));
console.log(`heatmap rows: ${top.length}`);
console.log(`output: ${outTsv}`);

const summary = {
  totalUniqueProse: sorted.length,
  in_100pct_fixtures: sorted.filter((e) => e.count === 32).length,
  in_80pct_plus: sorted.filter((e) => e.count >= 26).length,
  in_50pct_plus: sorted.filter((e) => e.count >= 16).length,
  in_25pct_plus: sorted.filter((e) => e.count >= 8).length,
  appears_only_once: sorted.filter((e) => e.count === 1).length,
};
console.log('summary:', JSON.stringify(summary, null, 2));

const summaryPath = path.join(__dirname, 'fragment-reuse-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
