#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else if (e.endsWith('.fragments.json')) files.push(p);
  }
  return files;
}

const root = path.resolve(__dirname, '..', '..', 'data', 'narrative');
const all = walk(root);
const matches = [];
for (const f of all) {
  let j;
  try {
    j = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    continue;
  }
  if (!j.fragments) continue;
  for (const frag of j.fragments) {
    const a = frag.axis || {};
    if (a.category === 'movement' && a.period === 'thisWeek' && a.depth === 'expert') {
      const rel = f.substring(root.length + 1).replaceAll(path.sep, '/');
      // Look for any token that mentions 대운궁실
      let mentions = 0;
      let asTag = 0;
      let asText = 0;
      for (const tok of frag.templateTokens || []) {
        if (tok.kind === 'tag' && tok.label === '대운궁실') asTag += 1;
        if (tok.kind === 'text' && tok.value && tok.value.includes('대운궁실')) {
          asText += 1;
          mentions += (tok.value.match(/대운궁실/g) || []).length;
        }
      }
      if (asTag > 0 || asText > 0) {
        matches.push({ file: rel, id: frag.fragmentId, asTag, asText, mentions });
      }
    }
  }
}
console.log('movement/thisWeek/expert fragments mentioning 대운궁실:');
for (const m of matches) console.log(JSON.stringify(m));
