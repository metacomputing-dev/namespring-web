#!/usr/bin/env node
// Apply trims.json (auto + manual) to fragment files via raw substring replace.
// Preserves CRLF line endings and surrounding JSON byte-for-byte by only
// substituting JSON-encoded tip strings (since Korean chars are not escaped
// in JSON, the raw substring matches the JSON-quoted string).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const NARRATIVE_ROOT = path.join(ROOT, 'data', 'narrative');
const SCOPE_DIRS = ['_coverage', 'overall'];

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const trimsPath = path.join(__dirname, 'trims.json');

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile() && p.endsWith('.fragments.json')) yield p;
  }
}

function jsonQuote(s) { return JSON.stringify(s); }

const trims = JSON.parse(fs.readFileSync(trimsPath, 'utf8'));
const valid = trims.trims.filter((t) =>
  !t.needsManual && t.replacement && t.replacement !== t.original);
const map = new Map();
for (const t of valid) map.set(t.original, t.replacement);
console.log(`Loaded ${map.size} replacements (auto + manual) from trims.json`);

let totalReplaced = 0;
let filesChanged = 0;
const replacedKeys = new Set();

for (const top of SCOPE_DIRS) {
  const root = path.join(NARRATIVE_ROOT, top);
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    let raw = fs.readFileSync(file, 'utf8');
    let fileReplaceCount = 0;
    for (const [from, to] of map) {
      const fromQ = jsonQuote(from);
      const toQ = jsonQuote(to);
      let idx = 0;
      while (true) {
        const found = raw.indexOf(fromQ, idx);
        if (found === -1) break;
        raw = raw.slice(0, found) + toQ + raw.slice(found + fromQ.length);
        idx = found + toQ.length;
        fileReplaceCount++;
        replacedKeys.add(from);
      }
    }
    if (fileReplaceCount > 0) {
      filesChanged++;
      totalReplaced += fileReplaceCount;
      if (!dryRun) fs.writeFileSync(file, raw, 'utf8');
      const rel = path.relative(NARRATIVE_ROOT, file).replace(/\\/g, '/');
      console.log(`${dryRun ? '[dry] ' : ''}${rel}: ${fileReplaceCount}`);
    }
  }
}

console.log(`\nFiles changed: ${filesChanged}`);
console.log(`Tip occurrences replaced: ${totalReplaced}`);
console.log(`Unique trim keys applied: ${replacedKeys.size} / ${map.size}`);
const missed = [...map.keys()].filter((k) => !replacedKeys.has(k));
if (missed.length > 0) console.log(`Trims not found in any file: ${missed.length}`);
