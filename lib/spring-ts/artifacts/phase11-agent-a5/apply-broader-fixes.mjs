#!/usr/bin/env node
// Apply fixes for broader bare-leadin issues.
// For each issue, find the bare "X의 <stem>" occurrence in the fragment's
// text tokens and split into [text-prefix, tag, text-suffix].

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NARR = path.resolve(__dirname, '..', '..', 'data', 'narrative');
const GD = path.join(NARR, '_glossary');

const labelToId = new Map();
for (const f of fs.readdirSync(GD)) {
  if (!f.endsWith('.json')) continue;
  const data = JSON.parse(fs.readFileSync(path.join(GD, f), 'utf8'));
  const entries = Array.isArray(data) ? data : data.entries || [data];
  for (const e of entries) {
    if (e.label && typeof e.label === 'string' && e.id) {
      if (!labelToId.has(e.label)) labelToId.set(e.label, e.id);
    }
  }
}

const issues = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'bare-leadin-broader.json'), 'utf8'),
).issues;

const byFile = new Map();
for (const i of issues) {
  const f = i.file.split('\\').join('/');
  if (!byFile.has(f)) byFile.set(f, []);
  byFile.get(f).push(i);
}

let modified = 0;

for (const [filePathRel, fileIssues] of byFile) {
  const filePath = path.join(NARR, filePathRel);
  const original = fs.readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const trailing = original.endsWith('\r\n') || original.endsWith('\n') ? eol : '';
  const data = JSON.parse(original);

  const byFrag = new Map();
  for (const i of fileIssues) {
    if (!byFrag.has(i.fragId)) byFrag.set(i.fragId, []);
    byFrag.get(i.fragId).push(i);
  }

  for (const [fragId, fragIssues] of byFrag) {
    const frag = data.fragments.find((f) => f.fragmentId === fragId);
    if (!frag) {
      console.warn(`  WARN fragment not found: ${fragId}`);
      continue;
    }
    for (const issue of fragIssues) {
      const lbl = issue.label;
      const id = labelToId.get(lbl);
      if (!id) {
        console.warn(`  WARN no glossary id for label ${lbl}`);
        continue;
      }
      const stemSet = ['결이', '결과', '자리', '흐름', '신호', '기운', '균형', '평균'];
      const fragTagLabels = new Set();
      for (const t of frag.templateTokens) if (t.kind === 'tag' && t.label) fragTagLabels.add(t.label);
      if (fragTagLabels.has(lbl)) {
        console.warn(`  SKIP ${fragId}: ${lbl} already used as tag (re-mention style)`);
        continue;
      }
      let tokenIndex = -1;
      let match = null;
      for (let i = 0; i < frag.templateTokens.length; i += 1) {
        const tok = frag.templateTokens[i];
        if (tok.kind !== 'text') continue;
        const v = tok.value || '';
        for (const stem of stemSet) {
          const target = `${lbl}의 ${stem}`;
          let idx = -1;
          let from = 0;
          while ((idx = v.indexOf(target, from)) !== -1) {
            from = idx + target.length;
            if (idx > 0 && v.charAt(idx - 1) === '#') continue;
            if (idx > 0 && /[가-힣]/.test(v.charAt(idx - 1))) continue;
            tokenIndex = i;
            match = { idx, target, stem };
            break;
          }
          if (match) break;
        }
        if (match) break;
      }
      if (tokenIndex < 0 || !match) {
        console.warn(`  WARN no match for ${fragId} :: ${lbl}/${issue.stem}`);
        continue;
      }
      const tok = frag.templateTokens[tokenIndex];
      const v = tok.value;
      const prefix = v.slice(0, match.idx);
      const labelEnd = match.idx + lbl.length;
      const suffix = v.slice(labelEnd);
      const newTokens = [];
      if (prefix.length > 0) newTokens.push({ kind: 'text', value: prefix });
      newTokens.push({ kind: 'tag', tagId: id, label: lbl });
      if (suffix.length > 0) newTokens.push({ kind: 'text', value: suffix });
      frag.templateTokens.splice(tokenIndex, 1, ...newTokens);
      if (!frag.tags) frag.tags = [];
      if (!frag.tags.includes(id)) frag.tags.push(id);
      modified += 1;
      console.log(`  FIX ${fragId} :: tok ${tokenIndex} :: insert tag ${lbl} (${id})`);
    }
  }

  let out = JSON.stringify(data, null, 2);
  if (eol === '\r\n') out = out.replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, out + trailing);
  console.log(`  SAVED ${filePathRel}`);
}

console.log(`\ntotal modifications: ${modified}`);
