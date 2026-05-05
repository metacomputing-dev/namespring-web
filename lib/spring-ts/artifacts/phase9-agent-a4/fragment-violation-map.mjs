/*
 * Map each violating expert paragraph to its underlying source fragment, so we
 * know which fragment files need editing and how many fixtures each impacts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(__dirname, '../sample-outputs-2026-05-05-phase3');
const sampleFiles = fs
  .readdirSync(SAMPLES_DIR)
  .filter((name) => /^\d{2}-.*\.json$/.test(name))
  .sort();

const fragmentImpact = new Map(); // fragmentId -> { tagCount, fixturesAffected: Set, period, category }

for (const file of sampleFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf-8'));
  const matrix = data?.payload?.tieredMatrix;
  if (!matrix?.periods) continue;
  for (const [period, periodObj] of Object.entries(matrix.periods)) {
    for (const [category, catObj] of Object.entries(periodObj?.byCategory ?? {})) {
      const sf = catObj?.selectedFragments?.expert;
      const expert = catObj?.expert;
      if (!sf?.fragmentId || !expert?.paragraphs) continue;
      for (const p of expert.paragraphs) {
        const tags = (p.tokens ?? []).filter((t) => t?.kind === 'tag');
        if (tags.length <= 6) continue;
        if (!fragmentImpact.has(sf.fragmentId)) {
          fragmentImpact.set(sf.fragmentId, {
            tagCount: tags.length,
            tagIds: tags.map((t) => t.tagId),
            fixtures: new Set(),
            period,
            category,
          });
        }
        fragmentImpact.get(sf.fragmentId).fixtures.add(file);
      }
    }
  }
}

// Map fragmentId to source file
const NARRATIVE_DIR = path.resolve(__dirname, '../../data/narrative');
const fragmentFileMap = new Map();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.fragments.json')) {
      try {
        const obj = JSON.parse(fs.readFileSync(full, 'utf-8'));
        for (const f of obj.fragments ?? []) {
          if (f?.fragmentId) {
            if (!fragmentFileMap.has(f.fragmentId)) fragmentFileMap.set(f.fragmentId, full);
          }
        }
      } catch (e) {
        console.error('parse error', full, e.message);
      }
    }
  }
}
walk(NARRATIVE_DIR);

const records = [...fragmentImpact.entries()].map(([fragmentId, v]) => ({
  fragmentId,
  tagCount: v.tagCount,
  fixtureCount: v.fixtures.size,
  fixtures: [...v.fixtures].sort(),
  category: v.category,
  period: v.period,
  sourceFile: fragmentFileMap.get(fragmentId) ?? '(NOT FOUND)',
})).sort((a, b) => b.tagCount - a.tagCount || b.fixtureCount - a.fixtureCount);

// Group by source file
const byFile = {};
for (const r of records) {
  byFile[r.sourceFile] = (byFile[r.sourceFile] ?? 0) + 1;
}

const out = {
  uniqueFragmentCount: records.length,
  totalParagraphHits: records.reduce((s, r) => s + r.fixtureCount, 0),
  bySourceFile: byFile,
  records,
};

const outPath = path.resolve(__dirname, 'fragment-violation-map.json');
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf-8');
console.log(`Unique violating fragments: ${records.length}`);
console.log(`Total fixture hits: ${out.totalParagraphHits}`);
console.log('\nFiles affected:');
for (const [f, c] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c}x  ${f.replace(/.*data[\\/]narrative[\\/]/, '')}`);
}
console.log(`\nWrote ${outPath}`);
