#!/usr/bin/env node
/**
 * artifacts/phase7-agent-a4/measure-distribution.mjs
 *
 * P7-A4 measurement helper.
 *
 * Each expert fragment's `templateTokens` is concatenated to recover the
 * full plain prose, then split on `\n\n` to count *authorial* paragraphs.
 * (The runtime renderer collapses `\n\n` -> ' ', so paragraphs.length is
 * structurally always 1 at output time. This script measures the
 * source-level paragraph structure recommended by the
 * NARRATIVE_STYLE_GUIDE §2-3 expert tier, since that's the contract this
 * agent owns.)
 *
 * Output: phase7-agent-a4/expert-paragraph-distribution.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');

const CATEGORIES = [
  'academic', 'career', 'expression_children', 'family', 'health',
  'health_stress', 'movement', 'overall', 'romance', 'study_document',
  'wealth',
];
const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'];
const COVERAGE_DIR = path.join(NARRATIVE_DIR, '_coverage');

function fragmentPlainText(fragment) {
  return fragment.templateTokens
    .map((t) => {
      if (t.kind === 'text') return t.value || '';
      if (t.kind === 'tag') return `#${t.label || t.tagId}`;
      if (t.kind === 'slot') return ` `;
      return '';
    })
    .join('');
}

function countParagraphs(plainText) {
  if (!plainText.trim()) return 0;
  // Source-level paragraph: split on \n\n
  return plainText
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .length;
}

function bucket(n) {
  if (n <= 1) return '1';
  if (n === 2) return '2';
  if (n === 3) return '3';
  if (n <= 8) return '4-8';
  return '9+';
}

const summary = {
  generatedAt: new Date().toISOString(),
  totalFragments: 0,
  byBucket: { '1': 0, '2': 0, '3': 0, '4-8': 0, '9+': 0 },
  byCategory: {},
  byPeriod: {},
  perCellSamples: [],
  thinFragments: [],
  longFragments: [],
};

function recordFragment(category, period, frag, source) {
  const text = fragmentPlainText(frag);
  const n = countParagraphs(text);
  const b = bucket(n);
  summary.byBucket[b] += 1;
  summary.byCategory[category] ??= { '1': 0, '2': 0, '3': 0, '4-8': 0, '9+': 0, total: 0 };
  summary.byCategory[category][b] += 1;
  summary.byCategory[category].total += 1;
  summary.byPeriod[period] ??= { '1': 0, '2': 0, '3': 0, '4-8': 0, '9+': 0, total: 0 };
  summary.byPeriod[period][b] += 1;
  summary.byPeriod[period].total += 1;
  summary.totalFragments += 1;
  const sample = {
    category,
    period,
    source,
    fragmentId: frag.fragmentId,
    paragraphs: n,
    bucket: b,
    textLen: text.length,
  };
  summary.perCellSamples.push(sample);
  if (n <= 1) summary.thinFragments.push(sample);
  if (n >= 9) summary.longFragments.push(sample);
}

for (const category of CATEGORIES) {
  summary.byCategory[category] = { '1': 0, '2': 0, '3': 0, '4-8': 0, '9+': 0, total: 0 };
  for (const period of PERIODS) {
    summary.byPeriod[period] ??= { '1': 0, '2': 0, '3': 0, '4-8': 0, '9+': 0, total: 0 };
    const file = path.join(NARRATIVE_DIR, category, period, 'expert.fragments.json');
    if (!fs.existsSync(file)) continue;
    const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const fragments = json.fragments ?? [];
    for (const frag of fragments) {
      recordFragment(category, period, frag, `${category}/${period}/expert.fragments.json`);
    }
  }
}

// Coverage axis fragments — filter by axis.depth === 'expert'
if (fs.existsSync(COVERAGE_DIR)) {
  for (const file of fs.readdirSync(COVERAGE_DIR)) {
    if (!file.endsWith('.fragments.json')) continue;
    const filePath = path.join(COVERAGE_DIR, file);
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const fragments = json.fragments ?? [];
    for (const frag of fragments) {
      const axis = frag.axis ?? {};
      if (axis.depth !== 'expert') continue;
      const category = axis.category ?? 'unknown';
      const period = axis.period ?? 'unknown';
      recordFragment(category, period, frag, `_coverage/${file}`);
    }
  }
}

// Compliance metric (4-8 share)
const compliantBuckets = ['4-8'];
const compliant = compliantBuckets.reduce((acc, b) => acc + summary.byBucket[b], 0);
summary.compliance = {
  metBucket: compliantBuckets,
  total: summary.totalFragments,
  compliantFragments: compliant,
  compliancePercent: summary.totalFragments
    ? Math.round((10000 * compliant) / summary.totalFragments) / 100
    : 0,
};

const outPath = path.join(__dirname, 'expert-paragraph-distribution.json');
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf-8');
console.log(
  `Wrote ${outPath}: ${summary.totalFragments} fragments, ` +
  `${compliant} compliant (${summary.compliance.compliancePercent}%), ` +
  `thin=${summary.thinFragments.length}, long=${summary.longFragments.length}`,
);
