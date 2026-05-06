#!/usr/bin/env node
// Apply fixes for orphan-tag-leadin bugs found by find-bare-tag-leadin.mjs.
// For each issue, the affected text token ends with "<label>의 결과 " (or 자리/흐름).
// Splits the token into [text-prefix, tag, text-suffix] and adds the tagId to
// the fragment's tags array.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NARR = path.resolve(__dirname, '..', '..', 'data', 'narrative');
const issues = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'bare-tag-leadin-issues.json'), 'utf8'),
).issues;

const byFile = new Map();
for (const i of issues) {
  const f = i.file.split('\\').join('/');
  if (!byFile.has(f)) byFile.set(f, []);
  byFile.get(f).push(i);
}

let fragmentsModified = 0;
let tokensReplaced = 0;
let tagsAddedToArrays = 0;

for (const [filePathRel, fileIssues] of byFile) {
  const filePath = path.join(NARR, filePathRel);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const issue of fileIssues) {
    const frag = data.fragments.find((f) => f.fragmentId === issue.fragmentId);
    if (!frag) {
      console.warn(`  WARN fragment not found: ${issue.fragmentId}`);
      continue;
    }
    const tokens = frag.templateTokens;
    const tok = tokens[issue.tokenIndex];
    if (!tok || tok.kind !== 'text') {
      console.warn(`  WARN token kind unexpected: ${issue.fragmentId}#${issue.tokenIndex}`);
      continue;
    }
    const v = tok.value || '';
    const matched = issue.matchedSuffix;
    if (!v.endsWith(matched)) {
      console.warn(`  WARN token suffix mismatch: ${issue.fragmentId}#${issue.tokenIndex}`);
      continue;
    }
    const prefix = v.slice(0, v.length - matched.length);
    const suffix = matched.slice(issue.label.length);
    const newTokens = [];
    if (prefix.length > 0) newTokens.push({ kind: 'text', value: prefix });
    newTokens.push({ kind: 'tag', tagId: issue.tagId, label: issue.label });
    if (suffix.length > 0) newTokens.push({ kind: 'text', value: suffix });
    tokens.splice(issue.tokenIndex, 1, ...newTokens);
    tokensReplaced += 1;

    if (!frag.tags) frag.tags = [];
    if (!frag.tags.includes(issue.tagId)) {
      frag.tags.push(issue.tagId);
      tagsAddedToArrays += 1;
    }
    fragmentsModified += 1;

    console.log(
      `  FIX ${issue.fragmentId}#tok${issue.tokenIndex} :: split text+inserted tag ${issue.label} (${issue.tagId})`,
    );
  }
  const original = fs.readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const trailing = original.endsWith('\r\n') || original.endsWith('\n') ? eol : '';
  let out = JSON.stringify(data, null, 2);
  if (eol === '\r\n') out = out.replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, out + trailing);
  console.log(`  SAVED ${filePathRel} (eol=${eol === '\r\n' ? 'CRLF' : 'LF'})`);
}

console.log(`\nfragments modified: ${fragmentsModified}`);
console.log(`tokens replaced: ${tokensReplaced}`);
console.log(`tags added to arrays: ${tagsAddedToArrays}`);
