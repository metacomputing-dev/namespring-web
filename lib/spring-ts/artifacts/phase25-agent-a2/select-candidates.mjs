// Phase 25 Agent A2 -- candidate selection
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');
const SAMPLE_DIR = path.join(ROOT, 'artifacts', 'sample-outputs-2026-05-05-phase3');

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

// Filter: owned-scope (cat/period/standard.fragments.json), ct=1, paragraphs=3
const candidates = [];
for (const [fid, ct] of usage.entries()) {
  if (ct !== 1) continue;
  const meta = fragMap.get(fid);
  if (!meta) continue;
  if (meta.paragraphs !== 3) continue;
  if (!meta.file.endsWith('/standard.fragments.json')) continue;
  if (meta.file.startsWith('_')) continue;
  candidates.push({ fid, ct, meta });
}

// Sort by category, period, fragmentId
candidates.sort((a, b) => {
  return (
    a.meta.category.localeCompare(b.meta.category) ||
    a.meta.period.localeCompare(b.meta.period) ||
    a.fid.localeCompare(b.fid)
  );
});

console.log('Total ct=1, owned-scope, 3p candidates:', candidates.length);
console.log('');

// Print sample with categories distribution
const byCat = new Map();
for (const c of candidates) byCat.set(c.meta.category, (byCat.get(c.meta.category) || 0) + 1);
console.log('By category:', Object.fromEntries([...byCat.entries()].sort()));
console.log('');

// Print first 30 candidates with details
console.log('First 30 candidates with text preview:');
for (let i = 0; i < Math.min(30, candidates.length); i++) {
  const { fid, meta } = candidates[i];
  console.log('');
  console.log('  ' + fid + '  (' + meta.category + '/' + meta.period + ')');
  console.log('  textLen=' + meta.textLen + '  tips=' + meta.livingTips.length + '  cautions=' + meta.cautions.length);
  for (let p = 0; p < meta.paragraphTexts.length; p++) {
    const t = meta.paragraphTexts[p];
    console.log('    P' + (p + 1) + ' (' + t.length + 'chars): ' + t.slice(0, 80) + (t.length > 80 ? '...' : ''));
  }
}

// Output JSON for downstream
fs.writeFileSync(
  'artifacts/phase25-agent-a2/candidates-ct1.json',
  JSON.stringify(
    candidates.map((c) => ({
      fragmentId: c.fid,
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
console.log('Wrote candidates-ct1.json');
