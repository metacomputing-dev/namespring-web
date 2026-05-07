// Phase 26 Agent A2 -- candidate selection (follow-up to P25-A2)
// Selects standard.fragments.json fragments still at 3p, with ct in 1..3,
// excluding the 12 fragments already lifted by P25-A2.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');
const SAMPLE_DIR = path.join(ROOT, 'artifacts', 'sample-outputs-2026-05-05-phase3');

// 12 fragments lifted in P25-A2 (commit 0ac9ebe5). Now 4p, but exclude
// explicitly so audit story is clear.
const P25_A2_LIFTED = new Set([
  'academic.life.standard.10_19.003',
  'career.thisMonth.standard.age20_29.007',
  'expression_children.thisMonth.standard.55_69.007',
  'family.life.standard.balanced.012',
  'family.life.standard.elder.008',
  'family.thisMonth.standard.middle.006',
  'family.thisYear.standard.strong.012',
  'health.thisYear.standard.10_19.001',
  'health.today.standard.balanced.001',
  'movement.thisMonth.standard.30_39.005',
  'movement.thisYear.standard.55_69.007',
  'overall.thisMonth.standard.balanced.neutral.008',
]);

const fragMap = new Map();

function indexFile(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!Array.isArray(j.fragments)) return;
    for (const frag of j.fragments) {
      const text = frag.templateTokens?.find((t) => t.kind === 'text')?.value ?? '';
      const paragraphs = text.split('\n\n').filter((s) => s.trim().length > 0);
      const rel = path.relative(NARRATIVE_DIR, file).split(path.sep).join('/');
      fragMap.set(frag.fragmentId, {
        file: rel,
        absFile: file,
        paragraphs: paragraphs.length,
        paragraphTexts: paragraphs,
        depth: frag.axis?.depth ?? null,
        category: frag.axis?.category ?? null,
        period: frag.axis?.period ?? null,
        textLen: text.length,
        livingTips: frag.livingTips ?? [],
        cautions: frag.cautions ?? [],
      });
    }
  } catch (e) {}
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith('.fragments.json')) indexFile(full);
  }
}

walk(NARRATIVE_DIR);

// Tally usage in 3p cells from samples
const samples = fs.readdirSync(SAMPLE_DIR).filter((f) => /-tiered\.json$/.test(f));
const usage = new Map(); // fragmentId -> count of 3p cells

for (const f of samples) {
  const s = JSON.parse(fs.readFileSync(path.join(SAMPLE_DIR, f), 'utf-8'));
  const periods = s?.payload?.tieredMatrix?.periods || s?.tieredMatrix?.periods;
  if (!periods) continue;
  for (const pk of Object.keys(periods)) {
    const period = periods[pk];
    const cells = [['overall', period.overall], ...Object.entries(period.byCategory || {})];
    for (const [, cell] of cells) {
      if (!cell?.standard?.paragraphs) continue;
      if (cell.standard.paragraphs.length !== 3) continue;
      const fid = cell.selectedFragments?.standard?.fragmentId;
      if (!fid) continue;
      usage.set(fid, (usage.get(fid) || 0) + 1);
    }
  }
}

// Filter: owned-scope (cat/period/standard.fragments.json), ct in [1..3], paragraphs=3
const candidates = [];
for (const [fid, ct] of usage.entries()) {
  if (ct < 1 || ct > 3) continue;
  if (P25_A2_LIFTED.has(fid)) continue;
  const meta = fragMap.get(fid);
  if (!meta) continue;
  if (meta.paragraphs !== 3) continue;
  if (!meta.file.endsWith('/standard.fragments.json')) continue;
  if (meta.file.startsWith('_')) continue;
  candidates.push({ fid, ct, meta });
}

// Sort by ct desc (higher leverage first), then category, period
candidates.sort((a, b) => {
  return (
    b.ct - a.ct ||
    a.meta.category.localeCompare(b.meta.category) ||
    a.meta.period.localeCompare(b.meta.period) ||
    a.fid.localeCompare(b.fid)
  );
});

console.log('Total ct in [1..3], owned-scope, 3p, non-P25A2 candidates:', candidates.length);

const ctTally = new Map();
for (const c of candidates) ctTally.set(c.ct, (ctTally.get(c.ct) || 0) + 1);
console.log('By ct:', Object.fromEntries([...ctTally.entries()].sort()));

const byCat = new Map();
for (const c of candidates) byCat.set(c.meta.category, (byCat.get(c.meta.category) || 0) + 1);
console.log('By category:', Object.fromEntries([...byCat.entries()].sort()));

// Output JSON for downstream
fs.writeFileSync(
  'artifacts/phase26-agent-a2/candidates-ct1to3.json',
  JSON.stringify(
    candidates.map((c) => ({
      fragmentId: c.fid,
      ct: c.ct,
      file: c.meta.file,
      category: c.meta.category,
      period: c.meta.period,
      textLen: c.meta.textLen,
      livingTips: c.meta.livingTips,
      cautions: c.meta.cautions,
      paragraphs: c.meta.paragraphTexts,
    })),
    null,
    2
  )
);
console.log('');
console.log('Wrote candidates-ct1to3.json');
