#!/usr/bin/env node
// Detect text tokens whose value ends with "X의 결과 " or "X의 자리" or
// "X의 흐름" (with optional trailing space) where X is a glossary label.
// These tokens are then immediately followed by a tag token, suggesting the
// "X의" was a forgotten lead-in tag.

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

const issues = [];

for (const file of walkBundles(NARR)) {
  let bundle;
  try { bundle = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { continue; }
  for (const frag of bundle.fragments || []) {
    const tokens = frag.templateTokens || [];
    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i];
      if (tok.kind !== 'text') continue;
      const v = tok.value || '';
      const next = tokens[i + 1];
      if (!next || next.kind !== 'tag') continue;
      for (const [label, id] of labels) {
        if (label.length < 2) continue;
        const candidates = [
          `${label}의 결과 `,
          `${label}의 결과`,
          `${label}의 자리 `,
          `${label}의 자리`,
          `${label}의 흐름 `,
          `${label}의 흐름`,
        ];
        let matched = null;
        for (const c of candidates) {
          if (v.endsWith(c)) { matched = c; break; }
        }
        if (!matched) continue;
        if (next.label === label) continue;
        const labelStart = v.length - matched.length;
        if (labelStart > 0 && v.charAt(labelStart - 1) === '#') continue;
        if (labelStart > 0 && /[가-힣]/.test(v.charAt(labelStart - 1))) continue;
        issues.push({
          file: path.relative(NARR, file),
          fragmentId: frag.fragmentId,
          tokenIndex: i,
          label,
          tagId: id,
          nextTagLabel: next.label,
          tokenTail: v.slice(-Math.max(20, matched.length + 5)),
          matchedSuffix: matched,
        });
        break;
      }
    }
  }
}

const out = path.join(__dirname, 'bare-tag-leadin-issues.json');
fs.writeFileSync(out, JSON.stringify({ count: issues.length, issues }, null, 2));
console.log(`bare-tag-leadin issues: ${issues.length}`);
for (const i of issues) {
  console.log(`  ${i.file} :: ${i.fragmentId}#tok${i.tokenIndex} :: "${i.label}${i.matchedSuffix.slice(i.label.length)}#${i.nextTagLabel}"`);
}
