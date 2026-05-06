#!/usr/bin/env node
// Extract all narrative prose units from sample fixtures for audit.
// Walks the tieredMatrix structure and emits each (fixture, period, category, depth, plainText) record.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLES_DIR = path.resolve(
  __dirname,
  '..',
  'sample-outputs-2026-05-05-phase3',
);

function* walkPlainText(node, trail) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      yield* walkPlainText(node[i], [...trail, i]);
    }
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
  // trail like: payload, tieredMatrix, periods, life, overall, brief, headline
  // or:        payload, tieredMatrix, periods, life, categories, wealth, brief, paragraphs, 0, plainText
  const result = { period: null, category: null, depth: null };
  let hit = false;
  for (let i = 0; i < trail.length; i += 1) {
    if (trail[i] === 'periods' && typeof trail[i + 1] === 'string') {
      result.period = trail[i + 1];
      hit = true;
    }
    if (trail[i] === 'byCategory' && typeof trail[i + 1] === 'string') {
      result.category = trail[i + 1];
    }
    if (trail[i] === 'overall') result.category = 'overall';
    if (trail[i] === 'brief' || trail[i] === 'standard' || trail[i] === 'expert') {
      result.depth = trail[i];
    }
  }
  return hit ? result : null;
}

function loadFixture(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const fixtures = fs
  .readdirSync(SAMPLES_DIR)
  .filter((f) => /^\d{2}-.*\.json$/.test(f))
  .filter((f) => !f.includes('candidate-summaries'))
  .filter((f) => !f.includes('current-fortune'))
  .filter((f) => !f.includes('spring-report-vector'))
  .sort();

const records = [];

for (const file of fixtures) {
  const full = path.join(SAMPLES_DIR, file);
  const data = loadFixture(full);
  const matrix = data?.payload?.tieredMatrix;
  if (!matrix) continue;
  for (const item of walkPlainText(matrix, ['payload', 'tieredMatrix'])) {
    const cls = classify(item.trail);
    if (!cls) continue;
    if (!cls.depth) continue;
    records.push({
      fixture: file,
      period: cls.period,
      category: cls.category ?? '_unknown',
      depth: cls.depth,
      plainText: item.plainText,
    });
  }
}

const out = path.join(__dirname, 'prose-corpus.json');
fs.writeFileSync(out, JSON.stringify({ count: records.length, records }, null, 2));

console.log(`fixtures: ${fixtures.length}`);
console.log(`prose units: ${records.length}`);
console.log(`output: ${out}`);

// Also emit a flat tsv for grepping
const tsv = path.join(__dirname, 'prose-corpus.tsv');
const lines = ['fixture\tperiod\tcategory\tdepth\tplainText'];
for (const r of records) {
  lines.push(
    `${r.fixture}\t${r.period}\t${r.category}\t${r.depth}\t${r.plainText.replaceAll('\t', ' ').replaceAll('\n', '\\n')}`,
  );
}
fs.writeFileSync(tsv, lines.join('\n'));
console.log(`tsv:    ${tsv}`);
