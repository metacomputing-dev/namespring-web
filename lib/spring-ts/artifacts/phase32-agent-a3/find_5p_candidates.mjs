/**
 * artifacts/phase32-agent-a3/find_5p_candidates.mjs
 *
 * P32-A3 — Walk every expert.fragments.json. For each 5-paragraph
 * fragment, count fire frequency across the 32 sample fixtures.
 * Print top candidates by fire count.
 *
 * Adapted from artifacts/phase30-agent-a4/find_4p_candidates.mjs
 * (which targeted 4p→5p; here we target 5p→6p).
 *
 * Note: P28-A2 + P30-A4 lifted 20 fragments 4p→5p. Per task brief:
 * "P28-A2 / P30-A4 가 lift 한 fragments 일부 5p 인 경우 OK 가능"
 * — so we do NOT auto-exclude. We mark them as "previously-lifted"
 * for awareness but keep them eligible.
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

// 20 fragments lifted by P28-A2 + P30-A4 (4p→5p). Marked but NOT excluded.
const PREVIOUSLY_LIFTED = new Set([
  // P28-A2
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
  // P30-A4
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

function lastTextValue(frag) {
  const tokens = frag?.templateTokens ?? frag?.tokens ?? [];
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (tokens[i]?.kind === 'text' && typeof tokens[i].value === 'string') {
      return { idx: i, value: tokens[i].value };
    }
  }
  return null;
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
for (const cat of cats) {
  for (const period of PERIODS) {
    const file = path.join(NARRATIVE_DIR, cat, period, 'expert.fragments.json');
    if (!fs.existsSync(file)) continue;
    const j = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const frag of j.fragments ?? []) {
      const pc = paragraphCount(frag);
      if (pc === 5) {
        fivePFrags.push({
          fragmentId: frag.fragmentId,
          cat,
          period,
          paragraphCount: pc,
          file,
          previouslyLifted: PREVIOUSLY_LIFTED.has(frag.fragmentId),
          totalFlowi: flowiCount(frag),
        });
      }
    }
  }
}

console.log(`Found ${fivePFrags.length} 5-paragraph expert fragments.`);

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

console.log('\nTop 50 5-paragraph expert fragments by fire count:\n');
console.log('rank\tfires\tprev\tflowi\tfragmentId\t(cat, period)');
for (let i = 0; i < Math.min(50, scored.length); i += 1) {
  const f = scored[i];
  const prev = f.previouslyLifted ? 'P*' : '--';
  console.log(
    `${i + 1}\t${f.fireCount}\t${prev}\t${f.totalFlowi}\t${f.fragmentId}\t(${f.cat}, ${f.period})`,
  );
}

const out = {
  generatedAt: new Date().toISOString(),
  total5pFragments: fivePFrags.length,
  previouslyLiftedSetSize: PREVIOUSLY_LIFTED.size,
  topCandidates: scored.slice(0, 50),
  allRanked: scored,
};
fs.writeFileSync(
  path.join(__dirname, 'candidates-2026-05-07.json'),
  JSON.stringify(out, null, 2) + '\n',
);
console.log('\nWrote candidates-2026-05-07.json');
