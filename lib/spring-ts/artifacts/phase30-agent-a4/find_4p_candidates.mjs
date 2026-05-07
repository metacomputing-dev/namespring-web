/**
 * artifacts/phase30-agent-a4/find_4p_candidates.mjs
 *
 * Walk every expert.fragments.json. For each 4-paragraph fragment,
 * count fire frequency across the 32 sample fixtures. Exclude the 10
 * fragments already lifted by P28-A2. Print top 30 by fire count.
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

// 10 fragments lifted by P28-A2 — exclude.
const P28_A2_FRAGMENTS = new Set([
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
]);

function paragraphCount(frag) {
  // Paragraphs separated by \n\n in text token values.
  const tokens = frag?.templateTokens ?? frag?.tokens ?? [];
  let combined = '';
  for (const t of tokens) {
    if (t?.kind === 'text' && typeof t.value === 'string') {
      combined += t.value;
    } else if (t?.kind === 'tag') {
      combined += '#';
    }
  }
  if (combined.length === 0) return 0;
  // Split on \n\n and count non-empty segments.
  const parts = combined.split(/\n\n+/).map((s) => s.trim()).filter((s) => s.length > 0);
  return parts.length;
}

const cats = fs
  .readdirSync(NARRATIVE_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name)
  .sort();

const fourPFrags = []; // {fragmentId, cat, period, paragraphCount}
for (const cat of cats) {
  for (const period of PERIODS) {
    const file = path.join(NARRATIVE_DIR, cat, period, 'expert.fragments.json');
    if (!fs.existsSync(file)) continue;
    const j = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const frag of j.fragments ?? []) {
      const pc = paragraphCount(frag);
      if (pc === 4 && !P28_A2_FRAGMENTS.has(frag.fragmentId)) {
        fourPFrags.push({
          fragmentId: frag.fragmentId,
          cat,
          period,
          paragraphCount: pc,
          file,
        });
      }
    }
  }
}

console.log(`Found ${fourPFrags.length} 4-paragraph expert fragments (excluding P28-A2's 10).`);

// Walk all sample fixtures. For each fixture/period/category, scan expert
// fragmentIds in the rendered output.
const TIERED_FILE_RE = /-tiered\.json$/;
const sampleFiles = fs
  .readdirSync(SAMPLES_DIR)
  .filter((f) => TIERED_FILE_RE.test(f))
  .sort();

const fireCount = new Map(); // fragmentId -> count

for (const file of sampleFiles) {
  const fullPath = path.join(SAMPLES_DIR, file);
  const fixtureId = file.replace(/\.json$/, '');
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

// Score 4p fragments by fire count.
const scored = fourPFrags.map((f) => ({
  ...f,
  fireCount: fireCount.get(f.fragmentId) ?? 0,
}));

scored.sort((a, b) => b.fireCount - a.fireCount);

console.log('\nTop 50 4-paragraph expert fragments by fire count (excluding P28-A2):\n');
console.log('rank\tfires\tfragmentId\t(cat, period)');
for (let i = 0; i < Math.min(50, scored.length); i++) {
  const f = scored[i];
  console.log(`${i + 1}\t${f.fireCount}\t${f.fragmentId}\t(${f.cat}, ${f.period})`);
}

// Save full ranked list
const out = {
  generatedAt: new Date().toISOString(),
  totalFourPFragments: fourPFrags.length,
  excludedByP28A2: Array.from(P28_A2_FRAGMENTS),
  topCandidates: scored.slice(0, 50),
  allRanked: scored,
};
fs.writeFileSync(
  path.join(__dirname, 'candidates-2026-05-07.json'),
  JSON.stringify(out, null, 2) + '\n',
);
console.log('\nWrote candidates-2026-05-07.json');
