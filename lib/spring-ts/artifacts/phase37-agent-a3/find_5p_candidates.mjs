/**
 * artifacts/phase37-agent-a3/find_5p_candidates.mjs
 *
 * P37-A3 — Walk every expert.fragments.json. For each 5-paragraph
 * fragment, count fire frequency across the sample fixtures.
 * Print top candidates by fire count.
 *
 * Adapted from artifacts/phase36-agent-a3/find_5p_candidates.mjs
 * (5p->6p target). Per task brief:
 *   "P28-A2/P30-A4/P32-A3/P33-A3/P34-A3/P36-A3 lift fragments 무수정"
 * — excluding 60 prior-lifted fragments (10 each phase x 6) from candidates.
 *
 * Goal: re-measure firing 5p pool post-P36 merge (samples regenerated
 * under P36-A1/A2/A4 narrative deltas). Hypothesis from task brief:
 * sample regen may have reshuffled fragment selection, surfacing
 * previously-non-firing 5p as firing-eligible candidates.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SAMPLES_DIR = path.resolve(
  SPRING_TS_ROOT,
  'artifacts/sample-outputs-2026-05-05-phase3',
);
const NARRATIVE_DIR = path.resolve(SPRING_TS_ROOT, 'data/narrative');
const PERIODS = ['today', 'thisWeek', 'thisMonth', 'thisYear', 'life'];

// 60 fragments lifted by P28-A2 + P30-A4 + P32-A3 + P33-A3 + P34-A3 + P36-A3. EXCLUDED.
const PREVIOUSLY_LIFTED = new Set([
  // P28-A2 (4p->5p, 10)
  'overall.life.expert.strong.neutral.005',
  'movement.life.expert.weak_neutral.010',
  'wealth.life.expert.weak.neutral.004',
  'wealth.thisYear.expert.weak.neutral.004',
  'health_stress.thisMonth.expert.weak_neutral.001',
  'health_stress.today.expert.male_30_39.001',
  'romance.thisMonth.expert.adult.weak.001',
  'family.life.expert.young_caregiver.008',
  'health.life.expert.child.001',
  'overall.thisYear.expert.strong.neutral.005',
  // P30-A4 (4p->5p, 10)
  'overall.today.expert.strong.neutral.005',
  'movement.thisMonth.expert.weak_neutral.010',
  'wealth.today.expert.weak.neutral.004',
  'overall.life.expert.weak.neutral.age40_54.011',
  'family.thisMonth.expert.young_caregiver.009',
  'health_stress.thisYear.expert.weak_neutral.001',
  'romance.thisWeek.expert.adult.weak.001',
  'health.thisMonth.expert.child.001',
  'movement.life.expert.0_9.002',
  'overall.thisYear.expert.child.001',
  // P32-A3 (5p->6p, 10)
  'romance.today.expert.teen.001',
  'romance.thisWeek.expert.teen.001',
  'romance.thisMonth.expert.teen.001',
  'romance.thisYear.expert.teen.001',
  'romance.life.expert.teen.001',
  'movement.thisYear.expert.10_19.003',
  'movement.life.expert.10_19.003',
  'wealth.thisYear.expert.female.40_54.006',
  'health_stress.life.expert.male_30_39.001',
  'family.life.expert.diversity.anchor.013',
  // P33-A3 (5p->6p, 10)
  'health_stress.life.expert.weak_neutral.001',
  'romance.thisYear.expert.adult.strong.001',
  'health.today.expert.strong.001',
  'health.thisWeek.expert.aligned.001',
  'health.thisMonth.expert.balanced.001',
  'health.thisYear.expert.balanced.001',
  'health.life.expert.conflicting.001',
  'movement.life.expert.wildcard.001',
  'wealth.thisYear.expert.55_69.008',
  'study_document.life.expert.diversity.anchor.013',
  // P34-A3 (5p->6p, 10)
  'romance.thisYear.expert.adult.weak.001',
  'romance.thisMonth.expert.adult.strong.001',
  'romance.life.expert.adult.strong.001',
  'overall.life.expert.diversity.anchor.507',
  'health.today.expert.fire_day.001',
  'health.thisWeek.expert.wild.001',
  'health.thisYear.expert.water_year.001',
  'health_stress.life.expert.weak_conflicting.001',
  'romance.today.expert.young_adult.001',
  'health.life.expert.water_excess.001',
  // P36-A3 (5p->6p, 10)
  'health.today.expert.water_day.001',
  'health.thisWeek.expert.weak.001',
  'health.thisMonth.expert.conflicting.001',
  'health.life.expert.extreme_strong.001',
  'health_stress.today.expert.wildcard.001',
  'health_stress.life.expert.diversity.anchor.001',
  'movement.thisYear.expert.30_39.005',
  'romance.thisWeek.expert.midlife.aligned.001',
  'romance.thisMonth.expert.midlife.aligned.001',
  'wealth.thisYear.expert.wildcard.001',
]);

function paragraphCount(frag) {
  const tokens = frag?.templateTokens ?? frag?.tokens ?? [];
  let combined = '';
  for (const t of tokens) {
    if (t?.kind === 'text' && typeof t.value === 'string') combined += t.value;
    else if (t?.kind === 'tag') combined += '#';
  }
  if (combined.length === 0) return 0;
  const parts = combined.split(/\n\n+/).map((s) => s.trim()).filter((s) => s.length > 0);
  return parts.length;
}

function flowiCount(frag) {
  const tokens = frag?.templateTokens ?? frag?.tokens ?? [];
  let combined = '';
  for (const t of tokens) {
    if (t?.kind === 'text' && typeof t.value === 'string') combined += t.value;
  }
  let count = 0;
  let idx = combined.indexOf('흐름이');
  while (idx >= 0) {
    count += 1;
    idx = combined.indexOf('흐름이', idx + 3);
  }
  return count;
}

const cats = fs
  .readdirSync(NARRATIVE_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name)
  .sort();

const fivePFrags = [];
const histogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
let totalFrags = 0;
for (const cat of cats) {
  for (const period of PERIODS) {
    const file = path.join(NARRATIVE_DIR, cat, period, 'expert.fragments.json');
    if (!fs.existsSync(file)) continue;
    const j = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const frag of j.fragments ?? []) {
      const pc = paragraphCount(frag);
      totalFrags += 1;
      histogram[pc] = (histogram[pc] ?? 0) + 1;
      if (pc === 5 && !PREVIOUSLY_LIFTED.has(frag.fragmentId)) {
        fivePFrags.push({
          fragmentId: frag.fragmentId,
          cat,
          period,
          paragraphCount: pc,
          file,
          totalFlowi: flowiCount(frag),
        });
      }
    }
  }
}

console.log(`Total expert fragments: ${totalFrags}`);
console.log('Source paragraph histogram:', histogram);
console.log(`Eligible 5p fragments (post-exclusion): ${fivePFrags.length}`);

// Walk all sample fixtures.
const TIERED_FILE_RE = /-tiered\.json$/;
const sampleFiles = fs
  .readdirSync(SAMPLES_DIR)
  .filter((f) => TIERED_FILE_RE.test(f))
  .sort();

const fireCount = new Map();

for (const file of sampleFiles) {
  const fullPath = path.join(SAMPLES_DIR, file);
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  const tm = json?.payload?.tieredMatrix ?? json?.tieredMatrix;
  if (!tm?.periods) continue;
  for (const periodKey of Object.keys(tm.periods)) {
    const period = tm.periods[periodKey];
    if (!period) continue;
    const cells = [
      ['overall', period.overall],
      ...Object.entries(period.byCategory ?? {}),
    ];
    for (const [, cell] of cells) {
      const expertFid = cell?.selectedFragments?.expert?.fragmentId;
      if (typeof expertFid === 'string' && expertFid.length > 0) {
        fireCount.set(expertFid, (fireCount.get(expertFid) ?? 0) + 1);
      }
    }
  }
}

const scored = fivePFrags.map((f) => ({
  ...f,
  fireCount: fireCount.get(f.fragmentId) ?? 0,
}));

scored.sort((a, b) => b.fireCount - a.fireCount);

console.log('\nTop 60 5-paragraph expert fragments by fire count (post-exclusion):\n');
console.log('rank\tfires\tflowi\tfragmentId\t(cat, period)');
for (let i = 0; i < Math.min(60, scored.length); i += 1) {
  const f = scored[i];
  console.log(
    `${i + 1}\t${f.fireCount}\t${f.totalFlowi}\t${f.fragmentId}\t(${f.cat}, ${f.period})`,
  );
}

const out = {
  generatedAt: new Date().toISOString(),
  totalFragments: totalFrags,
  sourceParagraphHistogram: histogram,
  excludedSetSize: PREVIOUSLY_LIFTED.size,
  total5pEligible: fivePFrags.length,
  topCandidates: scored.slice(0, 60),
  allRanked: scored,
};
fs.writeFileSync(
  path.join(__dirname, 'candidates-2026-05-09.json'),
  JSON.stringify(out, null, 2) + '\n',
);
console.log('\nWrote candidates-2026-05-09.json');
console.log(`\nFiring-eligible 5p candidates (fireCount >= 1): ${
  scored.filter((s) => s.fireCount >= 1).length
}`);
