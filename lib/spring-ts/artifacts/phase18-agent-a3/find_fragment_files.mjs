/**
 * Find which fragment file contains each fragmentId in the sub-3 list.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NARRATIVE_DIR = path.resolve(SPRING_TS_ROOT, 'data/narrative');

function walkDir(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkDir(full, files);
    else if (full.endsWith('.fragments.json')) files.push(full);
  }
  return files;
}

const files = walkDir(NARRATIVE_DIR);
const targetIds = JSON.parse(fs.readFileSync(path.join(__dirname, 'analyze-no-fid.json'), 'utf-8')).distinctFragmentIds;

const found = {};
for (const file of files) {
  const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const frags = json.fragments ?? [];
  for (const frag of frags) {
    const fid = frag.fragmentId;
    if (targetIds.includes(fid)) {
      const rel = path.relative(SPRING_TS_ROOT, file).replace(/\\/g, '/');
      if (!found[fid]) found[fid] = [];
      found[fid].push(rel);
    }
  }
}

const fileGroups = {};
for (const [fid, paths] of Object.entries(found)) {
  for (const p of paths) {
    if (!fileGroups[p]) fileGroups[p] = [];
    fileGroups[p].push(fid);
  }
}

console.log('Found:', Object.keys(found).length, '/', targetIds.length);

console.log('\nBy file:');
const sortedFiles = Object.entries(fileGroups).sort((a, b) => b[1].length - a[1].length);
for (const [file, ids] of sortedFiles) {
  console.log(`  [${ids.length}] ${file}`);
  for (const id of ids.sort()) {
    console.log(`        ${id}`);
  }
}

const missing = targetIds.filter((id) => !found[id]);
console.log('\nMissing:', missing.length);
for (const id of missing) console.log(`  ${id}`);

fs.writeFileSync(
  path.join(__dirname, 'fragment-file-map.json'),
  JSON.stringify({ found, fileGroups, missing }, null, 2),
);
