#!/usr/bin/env node
// Find residual orphan-tag-text issues in fragment data (Phase 12 follow-on
// to P11-A5).
//
// Strategy (simplified):
//   For each fragment, scan text tokens for occurrences of LABEL of length
//   3+ chars where:
//     1. The label is preceded by a non-`#` non-Korean character.
//     2. The label is followed by `의 (결이|결과|자리|흐름|신호|기운)`.
//     3. The fragment's tags array CONTAINS the corresponding tagId.
//     4. The bare-text occurrence is NOT a "stylistic re-mention" (intro
//        with #LABEL then mention without # later in same prose).
//
//   To distinguish (4): we accept ANY bare-text occurrence as a candidate,
//   then triage by checking parallel sibling fragments at the same axis.
//   If a strong majority (>=80%) of siblings using LABEL only use it as
//   tag (never bare text), the bare text is the regression.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, '..', '..', 'data', 'narrative');

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else if (e.endsWith('.fragments.json')) files.push(p);
  }
  return files;
}

const all = walk(root);
const allFragments = [];
for (const f of all) {
  let j;
  try {
    j = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    continue;
  }
  if (!j.fragments) continue;
  const rel = f.substring(root.length + 1).replaceAll(path.sep, '/');
  for (const frag of j.fragments) {
    allFragments.push({ file: rel, frag });
  }
}

console.log('total fragments scanned:', allFragments.length);

const STEMS = ['결이', '결과', '자리', '흐름', '신호', '기운'];

// All known labels of length 3+
const allLabels = new Set();
const tagIdByLabel = new Map();
for (const { frag } of allFragments) {
  for (const tok of frag.templateTokens || []) {
    if (tok.kind === 'tag' && tok.label && tok.label.length >= 3) {
      allLabels.add(tok.label);
      if (tok.tagId) tagIdByLabel.set(tok.label, tok.tagId);
    }
  }
}
console.log('distinct labels of length 3+:', allLabels.size);

// Group fragments by axis
const byAxis = new Map();
for (const f of allFragments) {
  const a = f.frag.axis || {};
  const key = `${a.category || ''}/${a.period || ''}/${a.depth || ''}`;
  if (!byAxis.has(key)) byAxis.set(key, []);
  byAxis.get(key).push(f);
}

// For each axis, count per-label tag-vs-text usage
const labelStatsPerAxis = new Map();
for (const [axisKey, siblings] of byAxis) {
  const stats = new Map(); // label -> { asTagFragments, asTextFragments }
  for (const { frag } of siblings) {
    const tokens = frag.templateTokens || [];
    const tagLabels = new Set();
    const textLabels = new Set();
    for (const tok of tokens) {
      if (tok.kind === 'tag' && tok.label) tagLabels.add(tok.label);
      if (tok.kind === 'text' && tok.value) {
        for (const label of allLabels) {
          if (tok.value.includes(label + '의')) {
            // check `#` prefix
            const idx = tok.value.indexOf(label + '의');
            const before = idx > 0 ? tok.value[idx - 1] : '';
            if (before !== '#') textLabels.add(label);
          }
        }
      }
    }
    for (const lbl of tagLabels) {
      if (!stats.has(lbl)) stats.set(lbl, { asTag: 0, asText: 0 });
      stats.get(lbl).asTag += 1;
    }
    for (const lbl of textLabels) {
      if (!stats.has(lbl)) stats.set(lbl, { asTag: 0, asText: 0 });
      stats.get(lbl).asText += 1;
    }
  }
  labelStatsPerAxis.set(axisKey, stats);
}

// Identify orphan candidates
const issues = [];
for (const { file, frag } of allFragments) {
  const tokens = frag.templateTokens || [];
  const a = frag.axis || {};
  const axisKey = `${a.category || ''}/${a.period || ''}/${a.depth || ''}`;
  const stats = labelStatsPerAxis.get(axisKey) || new Map();
  // Set of labels this fragment uses as tag
  const fragmentTagLabels = new Set();
  for (const tok of tokens) {
    if (tok.kind === 'tag' && tok.label) fragmentTagLabels.add(tok.label);
  }
  // For each text token, find bare-text labels
  for (let ti = 0; ti < tokens.length; ti += 1) {
    const tok = tokens[ti];
    if (tok.kind !== 'text' || !tok.value) continue;
    for (const label of allLabels) {
      if (label.length < 3) continue;
      const re = new RegExp(`(?<!#)${label}의\\s*(${STEMS.join('|')})`, 'g');
      let m;
      while ((m = re.exec(tok.value))) {
        // check the immediately-preceding char in the token
        const before = m.index > 0 ? tok.value[m.index - 1] : '';
        // skip if this is part of a longer compound (preceded by Korean syllable
        // forming part of a different word, e.g., 통관용신 - skip 용신)
        if (/[가-힣]/.test(before)) {
          // accept only if 이전 syllable isn't bonded — typically that means
          // the preceding char is a particle char (과/와/은/는/이/가/을/를/의/에/도/만/로 etc.)
          // For simplicity: we accept if preceding char is one of common particles
          // that are SEPARATE words (not compound prefix).
          const allowedPrev = '과와은는이가을를의에도만으로에서까지부터';
          if (!allowedPrev.includes(before)) continue;
        }
        // Get axis stats
        const stat = stats.get(label) || { asTag: 0, asText: 0 };
        // If at least 80% of siblings using LABEL use it ONLY as tag
        // (asTag count > 0 and asText count is small relative), flag.
        const total = stat.asTag + stat.asText;
        if (total < 2) continue; // need siblings to compare
        const tagFraction = stat.asTag / total;
        if (tagFraction >= 0.8 && fragmentTagLabels.has(label)) {
          issues.push({
            file,
            fragmentId: frag.fragmentId,
            axis: a,
            label,
            stem: m[1],
            tagId: tagIdByLabel.get(label) || null,
            bareTokenIdx: ti,
            tagFractionAtAxis: tagFraction,
            siblingsAsTag: stat.asTag,
            siblingsAsText: stat.asText,
            excerpt: tok.value.substring(Math.max(0, m.index - 12), Math.min(tok.value.length, m.index + 30)),
          });
        }
      }
    }
  }
}

const seen = new Set();
const dedup = [];
for (const iss of issues) {
  const k = `${iss.file}||${iss.fragmentId}||${iss.label}||${iss.bareTokenIdx}`;
  if (seen.has(k)) continue;
  seen.add(k);
  dedup.push(iss);
}

console.log('residual orphan-tag-text issues:', dedup.length);
for (const iss of dedup) console.log(JSON.stringify(iss));

const out = path.join(__dirname, 'residual-orphan-issues.json');
fs.writeFileSync(out, JSON.stringify(dedup, null, 2));
console.log('output:', out);
