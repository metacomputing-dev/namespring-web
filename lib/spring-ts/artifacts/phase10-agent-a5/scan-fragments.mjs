#!/usr/bin/env node
// Direct fragment-level scan for typos and awkward phrasing
// in lib/spring-ts/data/narrative/_coverage/ + per-category fragment files.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NARRATIVE_ROOT = path.resolve(__dirname, '..', '..', 'data', 'narrative');

// Recursive walk
function* walkJsonFiles(dir, root = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    const rel = path.join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walkJsonFiles(full, rel);
    } else if (entry.name.endsWith('.json')) {
      yield { full, rel };
    }
  }
}

// Walk fragment-like structures and emit per-text records
function* walkText(node, trail) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      yield* walkText(node[i], [...trail, i]);
    }
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === 'value' && typeof v === 'string') {
      yield { trail: [...trail, k], text: v };
    } else if (k === 'headline' && typeof v === 'string') {
      yield { trail: [...trail, k], text: v };
    }
    yield* walkText(v, [...trail, k]);
  }
}

const SCOPE = ['_coverage', 'overall', 'career', 'wealth', 'health', 'health_stress', 'romance', 'family', 'academic', 'study_document', 'expression_children', 'movement'];

const ISSUE_PATTERNS = [
  // Data-side patterns - things the renderer can't fix
  { name: 'double_space',    re: / {2,}/u, severity: 'low' },
  { name: 'mixed_punct',     re: /,\.|\.,|;,|,;/u, severity: 'medium' },
  { name: 'space_before_punct', re: / [\.,;]/u, severity: 'medium' },
  { name: 'triple_punct',    re: /\.{3,}|!{3,}|\?{3,}/u, severity: 'low' },
  { name: 'leading_space',   re: /^\s+/u, severity: 'low' },
  { name: 'trailing_space',  re: /\s+$/u, severity: 'low' },
  { name: 'doubled_period',  re: /\.\./u, severity: 'medium' },
  { name: 'common_typo_eunneun', re: /것을은\b/u, severity: 'high' },
  { name: 'missing_space_before_quote', re: /[가-힣]"/u, severity: 'low' },  // not always wrong
  { name: 'particle_double', re: /[을를이가에서에는]\s+[을를이가에서에는]/u, severity: 'low' },
  { name: 'standalone_jamo', re: /(?:^|[^가-힣])[ㄱ-ㅎㅏ-ㅣ]+(?:$|[^가-힣])/u, severity: 'low' },
  // Common awkward phrasings
  { name: 'redundant_가지가', re: /(?:한|두|세|네|다섯)\s*가지가\s*가\b/u, severity: 'high' },
  { name: 'duplicate_subj', re: /\b(\S{2,5})\s+\1\b/u, severity: 'medium' },
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
      console.warn('[parse error]', file.rel, e.message);
      continue;
    }
    for (const item of walkText(data, [])) {
      const text = item.text;
      if (typeof text !== 'string') continue;
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
for (const r of records) {
  summary[r.issue] = (summary[r.issue] || 0) + 1;
}

const out = path.join(__dirname, 'fragment-issues.json');
fs.writeFileSync(out, JSON.stringify({ scope: SCOPE, fileCount, summary, records }, null, 2));

console.log(`Scanned ${fileCount.total} JSON files`);
console.log('Issues found:');
for (const [k, n] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(30)} ${n}`);
}
console.log(`\noutput: ${out}`);
