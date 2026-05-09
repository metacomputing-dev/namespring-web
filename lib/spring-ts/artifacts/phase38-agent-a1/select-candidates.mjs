// Phase 38 Agent A1 -- candidate selection (post P37-A1 109-ID LIFTED set)
// Selects standard.fragments.json fragments still at 3p, with ct in 1..3,
// excluding all fragments touched by prior lift batches:
// 104 inherited from P37-A1 + 5 new from P37-A1 = 109 IDs.
// (P37-A2's 10 promotions were 4p->5p, all already in the 104 from prior
//  3p->4p lifts, so no new defensive entries needed for them.)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');
const SAMPLE_DIR = path.join(ROOT, 'artifacts', 'sample-outputs-2026-05-05-phase3');

const LIFTED = new Set([
  // P25-A2 (12, 3p->4p)
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
  // P26-A2 (16, 3p->4p)
  'academic.life.standard.70plus.008',
  'career.thisMonth.standard.balanced.neutral.004',
  'family.thisWeek.standard.weak.011',
  'overall.thisYear.standard.balanced.neutral.008',
  'academic.life.standard.40_54.006',
  'academic.life.standard.balanced.011',
  'career.thisMonth.standard.age10_19.006',
  'career.thisWeek.standard.age20_29.007',
  'expression_children.life.standard.30_39.005',
  'expression_children.thisWeek.standard.55_69.007',
  'family.life.standard.teen.003',
  'family.thisMonth.standard.young_adult.004',
  'health.thisMonth.standard.male.001',
  'health.thisMonth.standard.70p.001',
  'movement.today.standard.10_19.003',
  'movement.today.standard.55_69.007',
  // P26-A3 / P27-A3 (4p->5p moves; already 5p, exclude defensively)
  'wealth.thisYear.standard.55_69.009',
  'wealth.thisYear.standard.female.40_54.007',
  'wealth.thisYear.standard.male.30_39.006',
  'wealth.thisYear.standard.wildcard.001',
  // P29-A4 (15, 3p->4p)
  'academic.thisMonth.standard.balanced.009',
  'academic.thisWeek.standard.balanced.009',
  'academic.today.standard.balanced.009',
  'career.life.standard.balanced.neutral.004',
  'career.thisYear.standard.balanced.neutral.004',
  'expression_children.thisMonth.standard.10_19.003',
  'expression_children.today.standard.30_39.005',
  'family.thisWeek.standard.middle.006',
  'family.thisWeek.standard.senior.007',
  'health.thisMonth.standard.strong.001',
  'health.thisWeek.standard.55_69.001',
  'health.thisYear.standard.balanced.001',
  'movement.thisMonth.standard.10_19.003',
  'movement.thisWeek.standard.30_39.005',
  'overall.thisMonth.standard.teen.001',
  // P30-A1 (7, 4p->5p; already 5p, exclude defensively)
  'wealth.thisMonth.standard.male.30_39.006',
  'wealth.thisWeek.standard.male.30_39.006',
  'wealth.today.standard.male.30_39.006',
  'wealth.thisMonth.standard.female.40_54.007',
  'wealth.thisWeek.standard.female.40_54.007',
  'wealth.today.standard.female.40_54.007',
  'wealth.today.standard.55_69.009',
  // P31-A4 (10, 3p->4p)
  'academic.life.standard.55_69.007',
  'academic.thisYear.standard.40_54.006',
  'career.thisWeek.standard.age55plus.010',
  'career.thisYear.standard.age10_19.006',
  'expression_children.thisYear.standard.70plus.008',
  'expression_children.today.standard.40_54.006',
  'family.today.standard.young_adult.004',
  'family.thisYear.standard.teen.003',
  'health.thisWeek.standard.female.001',
  'movement.thisYear.standard.10_19.003',
  // P32-A2 (10, 3p->4p)
  'academic.today.standard.55plus.006',
  'academic.thisYear.standard.20_29.004',
  'career.life.standard.age10_19.006',
  'career.thisWeek.standard.age10_19.006',
  'expression_children.life.standard.40_54.006',
  'expression_children.thisWeek.standard.10_19.003',
  'family.thisMonth.standard.teen.003',
  'family.thisYear.standard.young_adult.004',
  'health.thisYear.standard.strong.001',
  'overall.thisWeek.standard.teen.001',
  // P33-A2 (10, 3p->4p)
  'academic.thisYear.standard.10_19.003',
  'academic.today.standard.20_29.004',
  'career.thisYear.standard.age20_29.007',
  'expression_children.life.standard.10_19.003',
  'family.thisWeek.standard.teen.003',
  'family.today.standard.teen.003',
  'health.life.standard.20_29.001',
  'health.thisMonth.standard.teen.001',
  'overall.thisYear.standard.teen.001',
  'overall.today.standard.teen.001',
  // P34-A1 (8, 3p->4p)
  'academic.today.standard.10_19.003',
  'expression_children.thisYear.standard.30_39.005',
  'family.life.standard.young_adult.004',
  'family.thisWeek.standard.young_adult.004',
  'health.life.standard.balanced.001',
  'health.thisWeek.standard.teen.001',
  'health.today.standard.teen.001',
  'movement.thisMonth.standard.70plus.008',
  // P35-A2 (7, 3p->4p)
  'health.life.standard.teen.001',
  'academic.life.standard.30_39.005',
  'career.thisWeek.standard.balanced.neutral.004',
  'expression_children.life.standard.0_9.002',
  'family.thisMonth.standard.elder.008',
  'movement.thisYear.standard.0_9.002',
  'overall.today.standard.balanced.neutral.008',
  // P36-A1 (5, 3p->4p)
  'career.today.standard.balanced.neutral.004',
  'expression_children.thisMonth.standard.30_39.005',
  'family.thisWeek.standard.thirties.005',
  'health.life.standard.female.001',
  'movement.thisWeek.standard.0_9.002',
  // P37-A1 (5, 3p->4p) -- new this phase to exclude
  'expression_children.thisYear.standard.0_9.002',
  'family.today.standard.weak.011',
  'health.thisYear.standard.female.40_54.001',
  'movement.life.standard.30_39.005',
  'overall.thisWeek.standard.balanced.neutral.008',
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
  if (LIFTED.has(fid)) continue;
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

console.log('LIFTED set size:', LIFTED.size);
console.log('Total ct in [1..3], owned-scope, 3p, non-LIFTED candidates:', candidates.length);

const ctTally = new Map();
for (const c of candidates) ctTally.set(c.ct, (ctTally.get(c.ct) || 0) + 1);
console.log('By ct:', Object.fromEntries([...ctTally.entries()].sort()));

const byCat = new Map();
for (const c of candidates) byCat.set(c.meta.category, (byCat.get(c.meta.category) || 0) + 1);
console.log('By category:', Object.fromEntries([...byCat.entries()].sort()));

const byPeriod = new Map();
for (const c of candidates) byPeriod.set(c.meta.period, (byPeriod.get(c.meta.period) || 0) + 1);
console.log('By period:', Object.fromEntries([...byPeriod.entries()].sort()));

// Output JSON for downstream
fs.writeFileSync(
  'artifacts/phase38-agent-a1/candidates-ct1to3.json',
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
