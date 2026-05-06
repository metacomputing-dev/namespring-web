#!/usr/bin/env node
// Broader scan: a text token where any KNOWN sentence-leadin pattern appears
// without `#` prefix, AND the same paragraph is rendered with `#` in any
// sibling fragment of the same (category, period, depth) cell. Filters out
// stylistic re-mentions (where the same fragment uses the label as a tag
// elsewhere).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NARR = path.resolve(__dirname, '..', '..', 'data', 'narrative');
const GD = path.join(NARR, '_glossary');

const labels = new Map();
for (const f of fs.readdirSync(GD)) {
  if (!f.endsWith('.json')) continue;
  const data = JSON.parse(fs.readFileSync(path.join(GD, f), 'utf8'));
  const entries = Array.isArray(data) ? data : data.entries || [data];
  for (const e of entries) {
    if (e.label && typeof e.label === 'string' && e.label.length >= 2 && e.id) {
      if (!labels.has(e.label)) labels.set(e.label, e.id);
    }
  }
}

function* walkBundles(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith('_glossary') || item.name.startsWith('_metaphor') || item.name.startsWith('_modifier_') || item.name.startsWith('_seed') || item.name.startsWith('_contract')) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) yield* walkBundles(full);
    else if (item.name.endsWith('.fragments.json')) yield full;
  }
}

function render(frag) {
  let s = '';
  for (const t of frag.templateTokens || []) {
    if (t.kind === 'text') s += t.value;
    else if (t.kind === 'tag') s += '#' + (t.label || '');
  }
  return s;
}

const byAxis = new Map();
for (const file of walkBundles(NARR)) {
  let bundle;
  try { bundle = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { continue; }
  for (const frag of bundle.fragments || []) {
    const axis = frag.axis || {};
    const key = `${axis.category || '_'}/${axis.period || '_'}/${axis.depth || '_'}`;
    if (!byAxis.has(key)) byAxis.set(key, []);
    byAxis.get(key).push({ file: path.relative(NARR, file), frag, rendered: render(frag) });
  }
}

const issues = [];

for (const [axisKey, items] of byAxis) {
  const tagged = new Set();
  const bare = [];
  for (const { file, frag, rendered } of items) {
    for (const [label] of labels) {
      if (label.length < 2) continue;
      const re = new RegExp(`(#?)${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}의 (결이|결과|자리|흐름)`, 'g');
      let m;
      while ((m = re.exec(rendered)) !== null) {
        const stem = m[2];
        const key = `${label}|${stem}`;
        const startBefore = m.index - 1;
        if (m[1] === '' && startBefore >= 0) {
          const ch = rendered.charAt(startBefore);
          if (/[가-힣]/.test(ch)) continue;
        }
        if (m[1] === '#') tagged.add(key);
        else bare.push({ file, fragId: frag.fragmentId, label, stem, key, idx: m.index });
      }
    }
  }
  for (const b of bare) {
    if (!tagged.has(b.key)) continue;
    const item = items.find((it) => it.frag.fragmentId === b.fragId);
    if (!item) continue;
    const fragLabels = new Set();
    for (const t of item.frag.templateTokens || []) {
      if (t.kind === 'tag' && t.label) fragLabels.add(t.label);
    }
    if (fragLabels.has(b.label)) continue;
    issues.push({ axis: axisKey, ...b });
  }
}

const out = path.join(__dirname, 'bare-leadin-broader.json');
fs.writeFileSync(out, JSON.stringify({ count: issues.length, issues }, null, 2));
console.log(`broader bare-leadin issues: ${issues.length}`);
const byLabel = {};
for (const i of issues) byLabel[i.label] = (byLabel[i.label] || 0) + 1;
console.log('by label:', JSON.stringify(byLabel));
const byFile = {};
for (const i of issues) byFile[i.file] = (byFile[i.file] || 0) + 1;
const sf = Object.entries(byFile).sort((a, b) => b[1] - a[1]);
for (const [f, c] of sf.slice(0, 12)) console.log(`  ${c}  ${f}`);
