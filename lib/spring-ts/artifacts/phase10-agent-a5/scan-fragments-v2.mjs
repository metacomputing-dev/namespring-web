#!/usr/bin/env node
// Refined fragment scan v2 - higher-precision issue patterns.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NARRATIVE_ROOT = path.resolve(__dirname, '..', '..', 'data', 'narrative');

function* walkJsonFiles(dir, root = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    const rel = path.join(root, entry.name);
    if (entry.isDirectory()) yield* walkJsonFiles(full, rel);
    else if (entry.name.endsWith('.json')) yield { full, rel };
  }
}

function* walkText(node, trail) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* walkText(node[i], [...trail, i]);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if ((k === 'value' || k === 'headline' || k === 'plainText') && typeof v === 'string') {
      yield { trail: [...trail, k], text: v, key: k };
    }
    yield* walkText(v, [...trail, k]);
  }
}

const SCOPE = ['_coverage', 'overall', 'career', 'wealth', 'health', 'health_stress', 'romance', 'family', 'academic', 'study_document', 'expression_children', 'movement'];

// High-precision patterns
const ISSUE_PATTERNS = [
  // Definite typos
  { name: 'comma_period', re: /,\./u, severity: 'high' },
  { name: 'period_comma', re: /\.,/u, severity: 'high' },
  { name: 'mid_doubled_period', re: /\.\.[가-힣A-Za-z]/u, severity: 'high' },
  { name: 'space_before_terminal', re: /[가-힣]\s+\.[가-힣\s]/u, severity: 'high' },
  { name: 'jamo_in_text', re: /[가-힣][ㄱ-ㅎㅏ-ㅣ][가-힣]/u, severity: 'high' },
  { name: 'space_after_open_paren', re: /\(\s+/u, severity: 'medium' },
  { name: 'space_before_close_paren', re: /\s+\)/u, severity: 'medium' },
  { name: 'mismatched_paren', re: /\([^)]{60,}/u, severity: 'low' },
  // Korean specific awkwardness
  { name: 'redundant_eun_neun_subj', re: /([가-힣])([은는이가])\s+\1\2/u, severity: 'high' }, // "흐름은 흐름은"
  { name: 'subj_obj_repeat', re: /([가-힣]{2,4})은\s+\1을\b/u, severity: 'medium' },
  { name: 'period_then_no_space', re: /\.[가-힣]/u, severity: 'medium' },
  { name: 'comma_then_no_space', re: /,[가-힣A-Za-z]/u, severity: 'medium' },
  // Repeated words
  { name: 'word_repeat', re: /\b([가-힣]{3,5})\s+\1\b/u, severity: 'medium' },
  // English bleed
  { name: 'english_bleed', re: /\b[a-zA-Z]{4,}\b/u, severity: 'medium' },
];

const records = [];
const fileCount = { total: 0 };

for (const top of SCOPE) {
  const dir = path.join(NARRATIVE_ROOT, top);
  if (!fs.existsSync(dir)) continue;
  for (const file of walkJsonFiles(dir, top)) {
    fileCount.total++;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file.full, 'utf8'));
    } catch (e) {
      continue;
    }
    for (const item of walkText(data, [])) {
      const text = item.text;
      for (const p of ISSUE_PATTERNS) {
        const m = text.match(p.re);
        if (m) {
          records.push({
            file: file.rel,
            trail: item.trail.join('.'),
            issue: p.name,
            severity: p.severity,
            match: m[0],
            text,
          });
        }
      }
    }
  }
}

const summary = {};
for (const r of records) summary[r.issue] = (summary[r.issue] || 0) + 1;

const out = path.join(__dirname, 'fragment-issues-v2.json');
fs.writeFileSync(out, JSON.stringify({ scope: SCOPE, fileCount, summary, records }, null, 2));

console.log(`Scanned ${fileCount.total} JSON files`);
console.log('High-precision issues:');
for (const [k, n] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(30)} ${n}`);
}
console.log(`\noutput: ${out}`);
