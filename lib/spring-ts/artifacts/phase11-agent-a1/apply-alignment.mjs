#!/usr/bin/env node
// P11-A1 alignment applier: rewrite tag.label in scoped fragment files to
// match glossary canonical for the listed tagIds.
//
// Usage:
//   node apply-alignment.mjs --tagIds=fire,earth,water [--dry-run]
//   node apply-alignment.mjs --tagIds=stabilityIndex,yongshinFit,...
//   node apply-alignment.mjs --tagIds=ALL
//
// Scope:
//   - data/narrative/<cat>/<period>/expert.fragments.json (every fragment)
//   - data/narrative/_coverage/**/*.fragments.json (only fragments where axis.depth === 'expert')

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NARRATIVE_ROOT = path.resolve(__dirname, '..', '..', 'data', 'narrative');

const args = new Map();
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const [k, v] = arg.slice(2).split('=');
    args.set(k, v ?? true);
  }
}
const tagIdsArg = args.get('tagIds');
const dryRun = args.get('dry-run') === true;
if (!tagIdsArg) {
  console.error('error: provide --tagIds=<comma-list> or --tagIds=ALL');
  process.exit(2);
}

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
const glossaryTags = new Map();
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

// Resolve which tagIds to align
let targetTagIds;
if (tagIdsArg === 'ALL') {
  targetTagIds = new Set(glossaryTags.keys());
} else {
  targetTagIds = new Set(tagIdsArg.split(',').map((s) => s.trim()).filter(Boolean));
  for (const id of targetTagIds) {
    if (!glossaryTags.has(id)) {
      console.error(`warn: tagId "${id}" has no glossary entry; skipping`);
      targetTagIds.delete(id);
    }
  }
}

// Collect target files
const CATEGORY_DIRS = [
  'overall', 'career', 'wealth', 'health', 'health_stress',
  'romance', 'family', 'academic', 'study_document',
  'expression_children', 'movement',
];

const targetFiles = [];
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

// Apply: per-file, walk fragments and rewrite tag tokens
const changes = []; // { file, tagId, fromLabel, toLabel, count }
let touchedFiles = 0;
let totalChanges = 0;

for (const file of targetFiles) {
  const original = fs.readFileSync(file.full, 'utf8');
  const data = JSON.parse(original);
  if (!Array.isArray(data?.fragments)) continue;
  const perChange = new Map(); // key=`${tagId}|${fromLabel}|${toLabel}` -> count
  let mutated = false;
  for (const fr of data.fragments) {
    const depth = fr?.axis?.depth;
    if (file.scope === 'coverage' && depth !== 'expert') continue;
    const tokens = fr.templateTokens ?? [];
    for (const t of tokens) {
      if (t.kind !== 'tag') continue;
      const id = t.tagId;
      if (!id || !targetTagIds.has(id)) continue;
      const canonical = glossaryTags.get(id);
      if (typeof t.label !== 'string') continue;
      if (t.label === canonical) continue;
      const key = `${id}|${t.label}|${canonical}`;
      perChange.set(key, (perChange.get(key) ?? 0) + 1);
      t.label = canonical;
      mutated = true;
      totalChanges++;
    }
  }
  if (!mutated) continue;
  touchedFiles++;
  for (const [key, count] of perChange.entries()) {
    const [tagId, fromLabel, toLabel] = key.split('|');
    changes.push({ file: file.rel, tagId, fromLabel, toLabel, count });
  }
  if (!dryRun) {
    // Detect indentation, line-ending style, and trailing newline of original
    const indent = (original.match(/^( +|\t+)\"/m)?.[1] ?? '  ');
    const usesCRLF = original.includes('\r\n');
    const endsWithNewline = original.endsWith('\n') || original.endsWith('\r\n');
    let serialized = JSON.stringify(data, null, indent);
    if (usesCRLF) serialized = serialized.replace(/\n/g, '\r\n');
    if (endsWithNewline) serialized += usesCRLF ? '\r\n' : '\n';
    fs.writeFileSync(file.full, serialized);
  }
}

const out = path.join(__dirname, dryRun ? 'apply-result.dry.json' : 'apply-result.json');
fs.writeFileSync(out, JSON.stringify({
  dryRun,
  targetTagIds: [...targetTagIds],
  totalFilesScanned: targetFiles.length,
  filesTouched: touchedFiles,
  totalLabelChanges: totalChanges,
  changes,
}, null, 2));

console.log(`Files scanned: ${targetFiles.length}`);
console.log(`Files touched: ${touchedFiles}`);
console.log(`Total label changes: ${totalChanges} (dryRun=${dryRun})`);
console.log(`output: ${out}`);
