// Phase 39 Agent A3 -- 4p->5p candidate finder.
//
// Lineage continuation of P38-A2 select-candidates. ALREADY_5P set
// extended with P38-A2's 8 ids (70 + 8 = 78 total).
//
// P39-A3 must hit +10 cells; the 4p paragraph-count filter is the
// real exclusion (a 5p fragment cannot match the 4p filter), but
// we list known 5p ids for documentation+audit traceability.
//
// Important: the post-processor rewrites 결-* particles to 흐름-* and
// also has the `결->운` rewrite (e.g., `이동 결은`->`이동운은`). The
// rendered first-paragraph plainText therefore differs from the source
// fragment value. We normalize both sides by collapsing those
// substitutions to a wildcard before keying.
//
// Run from lib/spring-ts root:
//   `node artifacts/phase39-agent-a3/select-candidates.mjs`
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const NARRATIVE = path.join(ROOT, 'data', 'narrative');
const SAMPLES = path.join(ROOT, 'artifacts', 'sample-outputs-2026-05-05-phase3');

// Already-5p lifted fragments across 8 prior lift phases (78 ids).
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
  // P37-A2
  'academic.today.standard.55plus.006',
  'career.thisYear.standard.age10_19.006',
  'expression_children.life.standard.10_19.003',
  'expression_children.thisWeek.standard.55_69.007',
  'expression_children.today.standard.40_54.006',
  'family.thisMonth.standard.teen.003',
  'family.thisYear.standard.strong.012',
  'health.thisWeek.standard.55_69.001',
  'health.today.standard.teen.001',
  'movement.thisMonth.standard.10_19.003',
  // P38-A2
  'academic.today.standard.balanced.009',
  'career.life.standard.age10_19.006',
  'family.thisWeek.standard.middle.006',
  'family.thisYear.standard.teen.003',
  'health.thisYear.standard.10_19.001',
  'health.thisYear.standard.strong.001',
  'expression_children.thisYear.standard.0_9.002',
  'family.thisMonth.standard.elder.008',
]);

// Normalize 결X / 흐름X / 운X variants to a wildcard so source <-> sample
// keys match despite reduceOverusedGyeol and 결->운 rewrites.
function normalizeKey(text) {
  return text
    .replace(/결을|흐름을|운을/g, '⊕을')
    .replace(/결은|흐름은|운은/g, '⊕은')
    .replace(/결의|흐름의|운의/g, '⊕의')
    .replace(/결로|흐름으로|운으로/g, '⊕로')
    .replace(/결이|흐름이|운이/g, '⊕이')
    .replace(/결과|흐름과|운과/g, '⊕과')
    .replace(/결에|흐름에|운에/g, '⊕에');
}

// Index fragments and their first-paragraph prefix.
const fragMap = new Map(); // normalized prefix -> { id, pCount, cat, period }
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
      const key = normalizeKey(firstPara).slice(0, 40);
      fragMap.set(key, { id: frag.fragmentId, pCount, cat, period });
      if (fragsByCount[pCount]) {
        fragsByCount[pCount].push({ id: frag.fragmentId, cat, period });
      }
    }
  }
}

// Walk samples and attribute cells to fragments via first-paragraph
// prefix matching (with same normalization).
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
      const key = normalizeKey(firstPara).slice(0, 40);
      const match = fragMap.get(key);
      if (match) {
        firings.set(match.id, (firings.get(match.id) ?? 0) + 1);
      }
    }
  }
}

const fourPa = fragsByCount[4];
const buckets = { 1: [], 2: [], 3: [], '4+': [] };
for (const f of fourPa) {
  if (ALREADY_5P.has(f.id)) continue;
  const ct = firings.get(f.id) ?? 0;
  if (ct === 0) continue;
  if (ct === 1) buckets[1].push({ ...f, ct });
  else if (ct === 2) buckets[2].push({ ...f, ct });
  else if (ct === 3) buckets[3].push({ ...f, ct });
  else buckets['4+'].push({ ...f, ct });
}

console.log(`total 4p fragments: ${fourPa.length}`);
console.log(`ct=1 candidates (excl ALREADY_5P): ${buckets[1].length}`);
console.log(`ct=2 candidates: ${buckets[2].length}`);
console.log(`ct=3 candidates: ${buckets[3].length}`);
console.log(`ct>=4 candidates: ${buckets['4+'].length}`);
console.log('');
console.log('--- ct=1 candidates ---');
for (const c of buckets[1]) console.log(`  ${c.id}  (${c.cat}/${c.period})`);
console.log('--- ct=2 candidates ---');
for (const c of buckets[2]) console.log(`  ${c.id}  (${c.cat}/${c.period})`);
console.log('--- ct=3 candidates ---');
for (const c of buckets[3]) console.log(`  ${c.id}  (${c.cat}/${c.period})`);
console.log('--- ct>=4 candidates ---');
for (const c of buckets['4+']) console.log(`  ${c.id}  (${c.cat}/${c.period}, ct=${c.ct})`);

// Also show by period and cat
console.log('');
console.log('--- by period (ct>=1, ct<=3) ---');
const all = [...buckets[1], ...buckets[2], ...buckets[3]];
const byP = {};
for (const c of all) {
  if (!byP[c.period]) byP[c.period] = [];
  byP[c.period].push(c.id + ` (ct=${c.ct})`);
}
for (const k of Object.keys(byP)) console.log(`  ${k}: ${byP[k].length} -> ${byP[k].join(', ')}`);
