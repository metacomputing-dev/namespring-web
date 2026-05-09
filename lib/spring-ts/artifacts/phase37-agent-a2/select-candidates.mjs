// Phase 37 Agent A2 -- 4p->5p candidate finder.
//
// Walks data/narrative/<cat>/<period>/standard.fragments.json, counts
// '\n\n' separators in each fragment's templateTokens[0].value, and
// pairs that with the cell-firing count derived from the 32-fixture
// sample directory (matching first-paragraph plainText prefix to map
// rendered cells back to source fragments).
//
// Output: prints 4p fragments with their ct (firing count) and a
// sub-list of ct=1 candidates suitable for append-P5 lifting.
//
// Run from lib/spring-ts root:
//   `node artifacts/phase37-agent-a2/select-candidates.mjs`
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE = path.join(ROOT, 'data', 'narrative');
const SAMPLES = path.join(ROOT, 'artifacts', 'sample-outputs-2026-05-05-phase3');

// Already-5p lifted fragments (60 ids across 6 prior lift phases).
// Excluded structurally because their paragraph count is now 5+.
const ALREADY_5P = new Set([
  // P26-A3
  'academic.life.standard.10_19.003',
  'career.thisMonth.standard.age20_29.007',
  'family.life.standard.balanced.012',
  'family.life.standard.elder.008',
  'health.today.standard.balanced.001',
  'overall.thisMonth.standard.balanced.neutral.008',
  'wealth.thisYear.standard.55_69.009',
  'wealth.thisYear.standard.female.40_54.007',
  'wealth.thisYear.standard.male.30_39.006',
  'wealth.thisYear.standard.wildcard.001',
  // P27-A3 (extracted from diff, IDs not bulleted in commit body)
  // P30-A1 (wealth pool)
  'wealth.thisMonth.standard.female.40_54.007',
  'wealth.thisMonth.standard.male.30_39.006',
  'wealth.thisWeek.standard.female.40_54.007',
  'wealth.thisWeek.standard.male.30_39.006',
  'wealth.today.standard.55_69.009',
  'wealth.today.standard.female.40_54.007',
  'wealth.today.standard.male.30_39.006',
  // P34-A2
  'academic.thisYear.standard.10_19.003',
  'academic.today.standard.20_29.004',
  'career.thisYear.standard.age20_29.007',
  'expression_children.thisWeek.standard.10_19.003',
  'family.thisWeek.standard.teen.003',
  'family.today.standard.teen.003',
  'family.today.standard.young_adult.004',
  'health.life.standard.20_29.001',
  'health.thisMonth.standard.teen.001',
  'health.thisWeek.standard.female.001',
  'movement.thisYear.standard.10_19.003',
  'overall.thisYear.standard.teen.001',
  'overall.today.standard.teen.001',
  // P35-A3
  'academic.thisWeek.standard.balanced.009',
  'career.thisWeek.standard.age10_19.006',
  'expression_children.thisMonth.standard.10_19.003',
  'family.thisMonth.standard.middle.006',
  'family.thisYear.standard.young_adult.004',
  'health.life.standard.balanced.001',
  'health.thisYear.standard.balanced.001',
  'movement.thisYear.standard.55_69.007',
  'movement.today.standard.55_69.007',
  'overall.thisMonth.standard.teen.001',
  // P36-A2
  'academic.thisYear.standard.20_29.004',
  'academic.today.standard.10_19.003',
  'career.life.standard.balanced.neutral.004',
  'career.thisYear.standard.balanced.neutral.004',
  'expression_children.thisYear.standard.70plus.008',
  'family.thisWeek.standard.young_adult.004',
  'health.thisMonth.standard.strong.001',
  'movement.thisMonth.standard.30_39.005',
  'movement.thisWeek.standard.30_39.005',
  'overall.thisWeek.standard.teen.001',
]);
// Note: P27-A3's 10 ids omitted because they are structurally excluded
// (their paragraph count is already 5+) — the 4p scan below does the
// real exclusion regardless of explicit set membership.

// Index fragments and their first-paragraph prefix.
const fragMap = new Map(); // first-40-prefix -> { id, pCount, cat, period }
const fragsByCount = { 3: [], 4: [], 5: [] };

const cats = fs.readdirSync(NARRATIVE).filter(c => !c.startsWith('_'));
for (const cat of cats) {
  const catDir = path.join(NARRATIVE, cat);
  if (!fs.statSync(catDir).isDirectory()) continue;
  const periods = fs
    .readdirSync(catDir)
    .filter(p => fs.statSync(path.join(catDir, p)).isDirectory());
  for (const period of periods) {
    const fp = path.join(catDir, period, 'standard.fragments.json');
    if (!fs.existsSync(fp)) continue;
    const json = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    for (const frag of json.fragments) {
      const value = frag.templateTokens?.[0]?.value ?? '';
      const seps = (value.match(/\n\n/g) || []).length;
      const pCount = seps + 1;
      const firstPara = value.split('\n\n')[0];
      const key = firstPara.slice(0, 40);
      fragMap.set(key, { id: frag.fragmentId, pCount, cat, period });
      if (fragsByCount[pCount]) {
        fragsByCount[pCount].push({ id: frag.fragmentId, cat, period });
      }
    }
  }
}

// Walk samples and attribute cells to fragments via first-paragraph
// prefix matching.
const firings = new Map(); // fragmentId -> count
const files = fs.readdirSync(SAMPLES).filter(n => /-tiered\.json$/.test(n));
for (const f of files) {
  const fp = path.join(SAMPLES, f);
  const json = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  const tm = json?.payload?.tieredMatrix ?? json?.tieredMatrix;
  if (!tm?.periods) continue;
  for (const periodKey of Object.keys(tm.periods)) {
    const period = tm.periods[periodKey];
    if (!period) continue;
    const cells = [['overall', period.overall], ...Object.entries(period.byCategory ?? {})];
    for (const [, cell] of cells) {
      const std = cell?.standard;
      if (!std?.paragraphs?.length) continue;
      const firstPara = std.paragraphs[0]?.plainText ?? '';
      const key = firstPara.slice(0, 40);
      const match = fragMap.get(key);
      if (match) {
        firings.set(match.id, (firings.get(match.id) ?? 0) + 1);
      }
    }
  }
}

const fourPa = fragsByCount[4].map(f => f.id);
const ct1 = [];
for (const id of fourPa) {
  if (ALREADY_5P.has(id)) continue;
  const ct = firings.get(id) ?? 0;
  if (ct === 1) ct1.push(id);
}

console.log(`total 4p fragments: ${fourPa.length}`);
console.log(`ct=1 4p candidates (excluding ALREADY_5P): ${ct1.length}`);
console.log('--- ct=1 4p candidates ---');
for (const id of ct1) console.log(id);
