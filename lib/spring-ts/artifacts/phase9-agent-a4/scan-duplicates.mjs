/*
 * Scan all violation paragraphs (>6 tags) for duplicate tagIds within the same
 * paragraph. Each duplicate found represents a free reduction opportunity:
 * we can demote the second occurrence to plain text without semantic loss.
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

const seenFragments = new Map(); // fragmentId -> { dupTags: [tagId, ...] }

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
        const tagIds = tags.map((t) => t.tagId);
        const counts = {};
        for (const id of tagIds) counts[id] = (counts[id] ?? 0) + 1;
        const dups = Object.entries(counts).filter(([, c]) => c > 1).map(([id]) => id);
        if (dups.length > 0 && !seenFragments.has(sf.fragmentId)) {
          seenFragments.set(sf.fragmentId, {
            tagCount: tags.length,
            tagIds,
            dups,
            period,
            category,
          });
        }
      }
    }
  }
}

// Output
const records = [...seenFragments.entries()].map(([fragmentId, v]) => ({ fragmentId, ...v }));
console.log(`Fragments with intra-paragraph duplicate tags: ${records.length}`);
for (const r of records) {
  console.log(` - ${r.fragmentId} (${r.tagCount} tags) dup=${r.dups.join(',')} cat=${r.category}/${r.period}`);
}

const outPath = path.resolve(__dirname, 'duplicate-scan.json');
fs.writeFileSync(outPath, `${JSON.stringify({ count: records.length, records }, null, 2)}\n`, 'utf-8');
console.log(`Wrote ${outPath}`);
