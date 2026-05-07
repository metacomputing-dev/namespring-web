// Phase 35 Agent A3 -- find 4p fragments in owned scope, with ct ∈ [1..3] in 4p cells
// Excludes fragments already lifted to 5p by P26-A3 / P27-A3 / P30-A1 / P34-A2 (40 fragments).
// Goal: 5p band 280 → 290 (+10). Math: pick ct mix summing to exactly 10.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');
const SAMPLE_DIR = path.join(ROOT, 'artifacts', 'sample-outputs-2026-05-05-phase3');

// Already 5p (must NOT touch — task: "이미 lift 5p 인 fragments 무수정")
// P26-A3 (10) + P27-A3 (10) + P30-A1 (7) + P34-A2 (13) = 40 fragments lifted to 5p
// across phases (with overlap accounting from earlier phases).
const ALREADY_5P_LIFTED = new Set([
  // P26-A3 (10 frags, 4p->5p)
  'academic.life.standard.10_19.003',
  'career.thisMonth.standard.age20_29.007',
  'family.life.standard.balanced.012',
  'family.life.standard.elder.008',
  'health.thisYear.standard.10_19.001',
  'overall.thisMonth.standard.balanced.neutral.008',
  'wealth.thisYear.standard.55_69.009',
  'wealth.thisYear.standard.female.40_54.007',
  'wealth.thisYear.standard.male.30_39.006',
  'wealth.thisYear.standard.wildcard.001',
  // P27-A3 (10 frags, 4p->5p)
  'academic.life.standard.40_54.006',
  'academic.life.standard.balanced.011',
  'career.thisMonth.standard.age10_19.006',
  'career.thisWeek.standard.age20_29.007',
  'family.thisMonth.standard.young_adult.004',
  'expression_children.life.standard.30_39.005',
  'family.life.standard.teen.003',
  'health.thisMonth.standard.70p.001',
  'health.thisMonth.standard.male.001',
  'movement.today.standard.10_19.003',
  // P30-A1 (7 frags, 4p->5p; wealth bands)
  'wealth.thisMonth.standard.male.30_39.006',
  'wealth.thisWeek.standard.male.30_39.006',
  'wealth.today.standard.male.30_39.006',
  'wealth.thisMonth.standard.female.40_54.007',
  'wealth.thisWeek.standard.female.40_54.007',
  'wealth.today.standard.female.40_54.007',
  'wealth.today.standard.55_69.009',
  // P34-A2 (13 frags, 4p->5p)
  'academic.thisYear.standard.10_19.003',
  'academic.today.standard.20_29.004',
  'career.thisYear.standard.age20_29.007',
  'expression_children.thisWeek.standard.10_19.003',
  'family.thisWeek.standard.teen.003',
  'family.today.standard.teen.003',
  'health.life.standard.20_29.001',
  'health.thisMonth.standard.teen.001',
  'health.thisWeek.standard.female.001',
  'movement.thisYear.standard.10_19.003',
  'overall.thisYear.standard.teen.001',
  'overall.today.standard.teen.001',
  'family.today.standard.young_adult.004',
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

const samples = fs.readdirSync(SAMPLE_DIR).filter((f) => /-tiered\.json$/.test(f));
const usage4p = new Map();
const histogram = { 3: 0, 4: 0, 5: 0 };

for (const f of samples) {
  const s = JSON.parse(fs.readFileSync(path.join(SAMPLE_DIR, f), 'utf-8'));
  const periods = s?.payload?.tieredMatrix?.periods || s?.tieredMatrix?.periods;
  if (!periods) continue;
  for (const pk of Object.keys(periods)) {
    const period = periods[pk];
    const cells = [['overall', period.overall], ...Object.entries(period.byCategory || {})];
    for (const [, cell] of cells) {
      if (!cell?.standard?.paragraphs) continue;
      const p = cell.standard.paragraphs.length;
      histogram[p] = (histogram[p] || 0) + 1;
      if (p !== 4) continue;
      const fid = cell.selectedFragments?.standard?.fragmentId;
      if (!fid) continue;
      usage4p.set(fid, (usage4p.get(fid) || 0) + 1);
    }
  }
}

console.log('Cell histogram (current main):', histogram);
console.log('');

const candidates = [];
for (const [fid, ct] of usage4p.entries()) {
  if (ct < 1 || ct > 3) continue;
  if (ALREADY_5P_LIFTED.has(fid)) continue;
  const meta = fragMap.get(fid);
  if (!meta) continue;
  if (meta.paragraphs !== 4) continue;
  if (!meta.file.endsWith('/standard.fragments.json')) continue;
  if (meta.file.startsWith('_')) continue;
  candidates.push({ fid, ct, meta });
}

candidates.sort((a, b) => {
  return (
    b.ct - a.ct ||
    a.meta.category.localeCompare(b.meta.category) ||
    a.meta.period.localeCompare(b.meta.period) ||
    a.fid.localeCompare(b.fid)
  );
});

console.log('Total ct ∈ [1..3], owned-scope, 4p candidates:', candidates.length);
const ctTally = new Map();
for (const c of candidates) ctTally.set(c.ct, (ctTally.get(c.ct) || 0) + 1);
console.log('By ct:', Object.fromEntries([...ctTally.entries()].sort()));
const byCat = new Map();
for (const c of candidates) byCat.set(c.meta.category, (byCat.get(c.meta.category) || 0) + 1);
console.log('By category:', Object.fromEntries([...byCat.entries()].sort()));
const byPeriod = new Map();
for (const c of candidates) byPeriod.set(c.meta.period, (byPeriod.get(c.meta.period) || 0) + 1);
console.log('By period:', Object.fromEntries([...byPeriod.entries()].sort()));
console.log('');

console.log('All candidates with paragraph lengths:');
for (const c of candidates) {
  const avgLen = Math.round(c.meta.textLen / c.meta.paragraphs);
  const maxLen = Math.max(...c.meta.paragraphTexts.map((p) => p.length));
  const minLen = Math.min(...c.meta.paragraphTexts.map((p) => p.length));
  const last = c.meta.paragraphTexts[3];
  const lastLen = last.length;
  console.log(
    `  ${c.fid}  ct=${c.ct}  textLen=${c.meta.textLen}  avg=${avgLen}  min=${minLen}  max=${maxLen}  lastP=${lastLen}  cat=${c.meta.category}/${c.meta.period}`
  );
}

fs.writeFileSync(
  'artifacts/phase35-agent-a3/candidates-4p.json',
  JSON.stringify(
    candidates.map((c) => ({
      fragmentId: c.fid,
      ct: c.ct,
      file: c.meta.file,
      category: c.meta.category,
      period: c.meta.period,
      textLen: c.meta.textLen,
      avgParagraphLen: Math.round(c.meta.textLen / c.meta.paragraphs),
      paragraphLengths: c.meta.paragraphTexts.map((p) => p.length),
      livingTips: c.meta.livingTips,
      cautions: c.meta.cautions,
      paragraphs: c.meta.paragraphTexts,
    })),
    null,
    2
  )
);
console.log('');
console.log('Wrote candidates-4p.json');
