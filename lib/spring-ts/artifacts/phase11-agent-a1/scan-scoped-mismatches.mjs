#!/usr/bin/env node
// P11-A1 scoped scanner: detect glossary tag.label mismatches in
//  - data/narrative/<cat>/<period>/expert.fragments.json (all fragments)
//  - data/narrative/_coverage/**/*.fragments.json (only fragments with axis.depth === 'expert')
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

// Build glossary canonical labels
const glossaryTags = new Map(); // tagId -> { label }
const glossaryDir = path.join(NARRATIVE_ROOT, '_glossary');
for (const f of walkJsonFiles(glossaryDir, '_glossary')) {
  const data = JSON.parse(fs.readFileSync(f.full, 'utf8'));
  if (Array.isArray(data?.entries)) {
    for (const e of data.entries) {
      const id = e.tagId ?? e.id;
      if (id) glossaryTags.set(id, e.label ?? e.koLabel ?? id);
    }
  }
  if (Array.isArray(data?.terms)) {
    for (const t of data.terms) {
      const id = t.tagId ?? t.id;
      if (id) glossaryTags.set(id, t.label ?? t.koLabel ?? id);
    }
  }
}

// Collect target files
const targetFiles = []; // { full, rel, scope: 'category-expert' | 'coverage' }

const CATEGORY_DIRS = [
  'overall', 'career', 'wealth', 'health', 'health_stress',
  'romance', 'family', 'academic', 'study_document',
  'expression_children', 'movement',
];

for (const cat of CATEGORY_DIRS) {
  const catDir = path.join(NARRATIVE_ROOT, cat);
  if (!fs.existsSync(catDir)) continue;
  for (const period of fs.readdirSync(catDir)) {
    const expertPath = path.join(catDir, period, 'expert.fragments.json');
    if (fs.existsSync(expertPath)) {
      targetFiles.push({
        full: expertPath,
        rel: path.posix.join(cat, period, 'expert.fragments.json'),
        scope: 'category-expert',
      });
    }
  }
}

const coverageDir = path.join(NARRATIVE_ROOT, '_coverage');
if (fs.existsSync(coverageDir)) {
  for (const f of walkJsonFiles(coverageDir, '_coverage')) {
    if (f.full.endsWith('.fragments.json')) {
      targetFiles.push({
        full: f.full,
        rel: f.rel.replace(/\\/g, '/'),
        scope: 'coverage',
      });
    }
  }
}

// Inspect each fragment's tag tokens
//   - For category-expert: every fragment is expert (file scope), include all
//   - For coverage: include only fragments with axis.depth === 'expert'
const usedTags = new Map(); // tagId -> { totalCount, labels: Map<label, count>, fileLabels: Map<file, Map<label, count>> }
let inspectedFragments = 0;
let inspectedTagTokens = 0;

for (const file of targetFiles) {
  const data = JSON.parse(fs.readFileSync(file.full, 'utf8'));
  if (!Array.isArray(data?.fragments)) continue;
  for (const fr of data.fragments) {
    const depth = fr?.axis?.depth;
    if (file.scope === 'coverage' && depth !== 'expert') continue;
    inspectedFragments++;
    const tokens = fr.templateTokens ?? [];
    for (const t of tokens) {
      if (t.kind !== 'tag') continue;
      const id = t.tagId;
      if (!id) continue;
      inspectedTagTokens++;
      if (!usedTags.has(id)) {
        usedTags.set(id, {
          totalCount: 0,
          labels: new Map(),
          fileLabels: new Map(),
        });
      }
      const info = usedTags.get(id);
      info.totalCount++;
      const lbl = t.label ?? '';
      info.labels.set(lbl, (info.labels.get(lbl) ?? 0) + 1);
      if (!info.fileLabels.has(file.rel)) info.fileLabels.set(file.rel, new Map());
      const fmap = info.fileLabels.get(file.rel);
      fmap.set(lbl, (fmap.get(lbl) ?? 0) + 1);
    }
  }
}

// Compute mismatches against glossary canonical
const mismatches = [];
const byTagId = {};
for (const [id, info] of usedTags.entries()) {
  if (!glossaryTags.has(id)) continue;
  const canonical = glossaryTags.get(id);
  const variantList = [...info.labels.entries()];
  const nonCanonical = variantList.filter(([lbl]) => lbl !== canonical);
  if (nonCanonical.length === 0) continue;
  const filesWithMismatch = [];
  for (const [file, fmap] of info.fileLabels.entries()) {
    const nonCanonicalForFile = [...fmap.entries()].filter(([lbl]) => lbl !== canonical);
    if (nonCanonicalForFile.length > 0) {
      for (const [lbl, count] of nonCanonicalForFile) {
        filesWithMismatch.push({ file, label: lbl, count });
      }
    }
  }
  byTagId[id] = {
    canonical,
    totalUsage: info.totalCount,
    canonicalUsage: info.labels.get(canonical) ?? 0,
    variants: nonCanonical.map(([lbl, count]) => ({ label: lbl, count })),
    files: filesWithMismatch,
  };
  for (const [lbl, count] of nonCanonical) {
    mismatches.push({
      tagId: id,
      glossaryLabel: canonical,
      usedLabel: lbl,
      count,
    });
  }
}

const totalMismatchTokens = mismatches.reduce((s, m) => s + m.count, 0);

const out = path.join(__dirname, 'mismatch-scan.json');
fs.writeFileSync(out, JSON.stringify({
  scope: {
    categoryExpertFiles: targetFiles.filter((f) => f.scope === 'category-expert').length,
    coverageFiles: targetFiles.filter((f) => f.scope === 'coverage').length,
    inspectedFragments,
    inspectedTagTokens,
  },
  glossaryTagsKnown: glossaryTags.size,
  uniqueMismatches: mismatches.length,
  totalMismatchTokens,
  mismatches,
  byTagId,
}, null, 2));

console.log(`Target files: ${targetFiles.length} (category-expert: ${targetFiles.filter((f) => f.scope === 'category-expert').length}, coverage: ${targetFiles.filter((f) => f.scope === 'coverage').length})`);
console.log(`Inspected fragments: ${inspectedFragments}, tag tokens: ${inspectedTagTokens}`);
console.log(`Unique mismatches: ${mismatches.length}, total mismatch tokens: ${totalMismatchTokens}`);
for (const m of mismatches) {
  console.log(`  ${m.tagId}: glossary="${m.glossaryLabel}" used="${m.usedLabel}" (${m.count}x)`);
}
console.log(`output: ${out}`);
