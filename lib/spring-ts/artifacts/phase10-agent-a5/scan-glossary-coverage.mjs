#!/usr/bin/env node
// Glossary coverage: are all tags used in fragments registered in glossary?
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NARRATIVE_ROOT = path.resolve(__dirname, '..', '..', 'data', 'narrative');

function* walkJsonFiles(dir, root = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const f = path.join(dir, e.name);
    const r = path.join(root, e.name);
    if (e.isDirectory()) yield* walkJsonFiles(f, r);
    else if (e.name.endsWith('.json')) yield { full: f, rel: r };
  }
}

// Build glossary set
const glossaryTags = new Map(); // tagId -> label
const glossaryDir = path.join(NARRATIVE_ROOT, '_glossary');
for (const f of walkJsonFiles(glossaryDir, '_glossary')) {
  const data = JSON.parse(fs.readFileSync(f.full, 'utf8'));
  if (Array.isArray(data?.terms)) {
    for (const t of data.terms) {
      const id = t.tagId ?? t.id;
      if (id) glossaryTags.set(id, t.label ?? t.koLabel ?? id);
    }
  }
  if (Array.isArray(data?.entries)) {
    for (const e of data.entries) {
      const id = e.tagId ?? e.id;
      if (id) glossaryTags.set(id, e.label ?? e.koLabel ?? id);
    }
  }
}

// Walk fragments looking for tag usage
const usedTags = new Map(); // tagId -> { count, labels: Set, files: Set }
const SCOPE_DIRS = ['_coverage', 'overall', 'career', 'wealth', 'health', 'health_stress', 'romance', 'family', 'academic', 'study_document', 'expression_children', 'movement'];

function* walkFragments(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const x of node) yield* walkFragments(x);
    return;
  }
  if (Array.isArray(node.fragments)) {
    for (const fr of node.fragments) {
      yield fr;
    }
  }
  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') yield* walkFragments(v);
  }
}

for (const top of SCOPE_DIRS) {
  const dir = path.join(NARRATIVE_ROOT, top);
  if (!fs.existsSync(dir)) continue;
  for (const file of walkJsonFiles(dir, top)) {
    let data;
    try { data = JSON.parse(fs.readFileSync(file.full, 'utf8')); }
    catch { continue; }
    for (const fr of walkFragments(data)) {
      const tokens = fr.templateTokens ?? [];
      for (const t of tokens) {
        if (t.kind !== 'tag') continue;
        const id = t.tagId;
        if (!id) continue;
        if (!usedTags.has(id)) usedTags.set(id, { count: 0, labels: new Set(), files: new Set() });
        const info = usedTags.get(id);
        info.count++;
        if (t.label) info.labels.add(t.label);
        info.files.add(file.rel);
      }
    }
  }
}

// Report
const missingFromGlossary = [];
const labelMismatches = [];

for (const [id, info] of usedTags.entries()) {
  if (!glossaryTags.has(id)) {
    missingFromGlossary.push({ tagId: id, count: info.count, labels: [...info.labels].slice(0, 3), files: [...info.files].slice(0, 5) });
  } else {
    const glossaryLabel = glossaryTags.get(id);
    for (const usedLabel of info.labels) {
      if (usedLabel !== glossaryLabel) {
        labelMismatches.push({ tagId: id, glossaryLabel, usedLabel, count: info.count });
      }
    }
  }
}

const out = path.join(__dirname, 'glossary-coverage.json');
fs.writeFileSync(out, JSON.stringify({
  totalGlossaryTags: glossaryTags.size,
  totalUsedTags: usedTags.size,
  missingFromGlossary,
  labelMismatches,
}, null, 2));

console.log(`Glossary tags: ${glossaryTags.size}`);
console.log(`Used tags: ${usedTags.size}`);
console.log(`Missing from glossary: ${missingFromGlossary.length}`);
console.log(`Label mismatches: ${labelMismatches.length}`);
if (missingFromGlossary.length) {
  console.log('\nMissing examples:');
  missingFromGlossary.slice(0, 10).forEach(x => {
    console.log(`  ${x.tagId} (${x.count}x, labels=${x.labels.join(',')})`);
  });
}
if (labelMismatches.length) {
  console.log('\nLabel mismatches:');
  labelMismatches.slice(0, 10).forEach(x => {
    console.log(`  ${x.tagId}: glossary="${x.glossaryLabel}" used="${x.usedLabel}"`);
  });
}
console.log(`\noutput: ${out}`);
