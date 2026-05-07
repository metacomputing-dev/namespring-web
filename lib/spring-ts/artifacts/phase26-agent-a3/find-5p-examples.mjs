// Find 5p examples in owned scope
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');

const examples = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith('.fragments.json')) {
      const rel = path.relative(NARRATIVE_DIR, full).split(path.sep).join('/');
      if (!rel.endsWith('/standard.fragments.json')) continue;
      if (rel.startsWith('_')) continue;
      try {
        const j = JSON.parse(fs.readFileSync(full, 'utf-8'));
        if (!Array.isArray(j.fragments)) continue;
        for (const frag of j.fragments) {
          const text = frag.templateTokens?.find((t) => t.kind === 'text')?.value ?? '';
          const paragraphs = text.split('\n\n').filter((s) => s.trim().length > 0);
          if (paragraphs.length === 5) {
            examples.push({
              fid: frag.fragmentId,
              file: rel,
              paragraphs,
              category: frag.axis?.category,
              period: frag.axis?.period,
            });
          }
        }
      } catch (e) {}
    }
  }
}

walk(NARRATIVE_DIR);

console.log('Total 5p fragments in owned scope (cat/period/standard.fragments.json, !_*):', examples.length);
console.log('');

// Print 5 samples
for (let i = 0; i < Math.min(5, examples.length); i++) {
  const ex = examples[i];
  console.log(`--- ${ex.fid} (${ex.file}) ---`);
  for (let p = 0; p < ex.paragraphs.length; p++) {
    console.log(`  P${p + 1} (${ex.paragraphs[p].length}c): ${ex.paragraphs[p]}`);
  }
  console.log('');
}

// Show category breakdown
const byCat = new Map();
for (const ex of examples) byCat.set(ex.category, (byCat.get(ex.category) || 0) + 1);
console.log('By category:', Object.fromEntries([...byCat.entries()].sort()));
