#!/usr/bin/env node
// Scan for fragments where the tags array is missing tagIds that are present
// in templateTokens (kind=tag), or vice versa.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NARR = path.resolve(__dirname, '..', '..', 'data', 'narrative');

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
    const tagIds = new Set(frag.tags || []);
    const tokenTagIds = new Set();
    for (const t of frag.templateTokens || []) {
      if (t.kind === 'tag' && t.tagId) tokenTagIds.add(t.tagId);
    }
    const missing = [...tokenTagIds].filter((id) => !tagIds.has(id));
    const extra = [...tagIds].filter((id) => !tokenTagIds.has(id));
    if (missing.length > 0 || extra.length > 0) {
      issues.push({
        file: path.relative(NARR, file),
        fragmentId: frag.fragmentId,
        missing,
        extra,
      });
    }
  }
}

const out = path.join(__dirname, 'tag-consistency-issues.json');
fs.writeFileSync(out, JSON.stringify({ count: issues.length, issues }, null, 2));
console.log(`tag-consistency issues: ${issues.length}`);
for (const i of issues.slice(0, 30)) {
  console.log(`  ${i.file} :: ${i.fragmentId}`);
  if (i.missing.length) console.log(`    missing in tags array:`, i.missing);
  if (i.extra.length) console.log(`    extra (in tags but not used as token):`, i.extra);
}
