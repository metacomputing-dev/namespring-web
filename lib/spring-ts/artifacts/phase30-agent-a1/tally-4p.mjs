// Phase 30 Agent A1 -- find 4p fragments in owned scope, sorted by usage in 4p cells
// Excludes fragments already lifted by P25-A2/P26-A2/P26-A3/P27-A3/P29-A4
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');
const SAMPLE_DIR = path.join(ROOT, 'artifacts', 'sample-outputs-2026-05-05-phase3');

// All fragments touched by prior P2x lifts to 4p; these are eligible for
// further 4p->5p lift, BUT we need to know which ones are CURRENTLY 4p.
// We'll detect paragraphs at runtime, so this is informational.
const PRIOR_LIFTED_TO_4P = new Set([
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
]);

// Already lifted to 5p (must be excluded from new 5p lift, since they ARE 5p)
const ALREADY_5P_LIFTED = new Set([
  // P26-A3 (10 frags, 4p->5p)
  // wealth.thisYear.* and 6 P25-A2 lifts
  // P27-A3 (10 frags, 4p->5p)
  // 5 insert-P4 + 5 append-P5
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

// Tally usage in 4p cells from samples
const samples = fs.readdirSync(SAMPLE_DIR).filter((f) => /-tiered\.json$/.test(f));
const usage4p = new Map(); // fragmentId -> count of 4p cells
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

console.log('Cell histogram:', histogram);
console.log('');

// Filter: owned-scope (cat/period/standard.fragments.json), ct=1, paragraphs=4,
//         AND not already lifted to 5p
const candidates = [];
for (const [fid, ct] of usage4p.entries()) {
  if (ct !== 1) continue;
  if (ALREADY_5P_LIFTED.has(fid)) continue;
  const meta = fragMap.get(fid);
  if (!meta) continue;
  if (meta.paragraphs !== 4) continue;
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

console.log('Total ct=1, owned-scope, 4p candidates (not yet 5p-lifted):', candidates.length);
console.log('');

const byCat = new Map();
for (const c of candidates) byCat.set(c.meta.category, (byCat.get(c.meta.category) || 0) + 1);
console.log('By category:', Object.fromEntries([...byCat.entries()].sort()));
console.log('');

const byPeriod = new Map();
for (const c of candidates) byPeriod.set(c.meta.period, (byPeriod.get(c.meta.period) || 0) + 1);
console.log('By period:', Object.fromEntries([...byPeriod.entries()].sort()));
console.log('');

// Mark prior-lifted (substantive vs original)
console.log('All candidates with avg paragraph length:');
for (const c of candidates) {
  const avgLen = Math.round(c.meta.textLen / c.meta.paragraphs);
  const maxLen = Math.max(...c.meta.paragraphTexts.map((p) => p.length));
  const minLen = Math.min(...c.meta.paragraphTexts.map((p) => p.length));
  const last = c.meta.paragraphTexts[3];
  const lastLen = last.length;
  const tag = PRIOR_LIFTED_TO_4P.has(c.fid) ? 'P2x-lifted' : 'original-4p';
  console.log(
    `  ${c.fid}  [${tag}]  textLen=${c.meta.textLen}  avg=${avgLen}  min=${minLen}  max=${maxLen}  lastP=${lastLen}  cat=${c.meta.category}/${c.meta.period}`
  );
}

fs.writeFileSync(
  'artifacts/phase30-agent-a1/candidates-4p-ct1.json',
  JSON.stringify(
    candidates.map((c) => ({
      fragmentId: c.fid,
      file: c.meta.file,
      category: c.meta.category,
      period: c.meta.period,
      textLen: c.meta.textLen,
      avgParagraphLen: Math.round(c.meta.textLen / c.meta.paragraphs),
      paragraphLengths: c.meta.paragraphTexts.map((p) => p.length),
      priorLifted: PRIOR_LIFTED_TO_4P.has(c.fragmentId || c.fid),
      livingTips: c.meta.livingTips,
      cautions: c.meta.cautions,
      paragraphs: c.meta.paragraphTexts,
    })),
    null,
    2
  )
);
console.log('');
console.log('Wrote candidates-4p-ct1.json');
