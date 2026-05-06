#!/usr/bin/env node
// Apply the wealth-cluster fix: rewrite "자산 운영 결이" to "자산 운영 호흡이"
// to break the post-processor 결이→흐름이 chain that produces 3 흐름이 in
// one short sentence.

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
let filesChanged = 0;
let totalOccurrences = 0;

const target = '의 결이 또렷한 사주는 자기 격에 맞는 자산 운영 결이 자연스럽게 자리 잡아요';
const replacement = '의 결이 또렷한 사주는 자기 격에 맞는 자산 운영 호흡이 자연스럽게 자리 잡아요';

for (const f of all) {
  let txt;
  try {
    txt = fs.readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  if (!txt.includes(target)) continue;
  const parts = txt.split(target);
  const occurrences = parts.length - 1;
  if (occurrences === 0) continue;
  const updated = parts.join(replacement);
  fs.writeFileSync(f, updated);
  console.log('updated:', f.substring(root.length + 1).replaceAll(path.sep, '/'), '(' + occurrences + ' occurrences)');
  filesChanged += 1;
  totalOccurrences += occurrences;
}
console.log('files changed:', filesChanged);
console.log('total token replacements:', totalOccurrences);
