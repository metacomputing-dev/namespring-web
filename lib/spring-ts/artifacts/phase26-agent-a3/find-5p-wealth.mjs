// Find 5p wealth examples
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');

function indexFile(file, all) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!Array.isArray(j.fragments)) return;
    for (const frag of j.fragments) {
      const text = frag.templateTokens?.find((t) => t.kind === 'text')?.value ?? '';
      const paragraphs = text.split('\n\n').filter((s) => s.trim().length > 0);
      const rel = path.relative(NARRATIVE_DIR, file).split(path.sep).join('/');
      if (rel.endsWith('/standard.fragments.json') && !rel.startsWith('_') && paragraphs.length === 5) {
        all.push({
          fid: frag.fragmentId,
          file: rel,
          paragraphs,
          category: frag.axis?.category,
          period: frag.axis?.period,
          textLen: text.length,
        });
      }
    }
  } catch (e) {}
}

function walk(dir, all) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, all);
    else if (e.name.endsWith('.fragments.json')) indexFile(full, all);
  }
}

const all = [];
walk(NARRATIVE_DIR, all);
const wealth = all.filter((e) => e.category === 'wealth');

console.log('Wealth 5p (' + wealth.length + ' total). First 8:');
for (const ex of wealth.slice(0, 8)) {
  console.log(`\n--- ${ex.fid} ---`);
  for (let p = 0; p < ex.paragraphs.length; p++) {
    console.log(`  P${p + 1} (${ex.paragraphs[p].length}c): ${ex.paragraphs[p]}`);
  }
}
