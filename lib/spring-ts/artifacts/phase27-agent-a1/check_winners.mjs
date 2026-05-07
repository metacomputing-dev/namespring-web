// For each (slot, target-fixture), inspect the existing brief winner's gating
// to determine if our planned gating dim-count will beat it.
import fs from 'node:fs';
import path from 'node:path';

const dir = 'artifacts/sample-outputs-2026-05-05-phase3';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('-tiered.json'));
const fixturesByPrefix = new Map();
for (const f of files) {
  const prefix = f.replace('-tiered.json', '').replace(/-spring-report-vector\.json$/, '');
  fixturesByPrefix.set(prefix, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}

const candidates = [
  { slot: 'wealth/today', target: ['32-nonagenarian-weak-daymaster'], gateDims: 3 },
  { slot: 'wealth/thisWeek', target: ['04-kim-seoyun-young-female'], gateDims: 2 },
  { slot: 'health/life', target: ['18-lee-child-male', '27-jonggyeok-jongah', '30-jeolgi-lidong-boundary', '31-newborn-infant-male'], gateDims: 2 },
  { slot: 'health_stress/today', target: ['17-kim-senior-female'], gateDims: 2 },
  { slot: 'health_stress/thisYear', target: ['22-low-confidence-yongshin'], gateDims: 3 },
  { slot: 'health_stress/life', target: ['26-jonggyeok-jongsal'], gateDims: 3 },
  { slot: 'romance/today', target: ['25-jonggyeok-jonggwan'], gateDims: 3 },
  { slot: 'romance/thisWeek', target: ['22-low-confidence-yongshin'], gateDims: 3 },
  { slot: 'academic/thisMonth', target: ['25-jonggyeok-jonggwan'], gateDims: 3 },
  { slot: 'academic/life', target: ['17-kim-senior-female'], gateDims: 3 },
  { slot: 'study_document/thisMonth', target: ['26-jonggyeok-jongsal'], gateDims: 3 },
  { slot: 'expression_children/life', target: ['18-lee-child-male', '27-jonggyeok-jongah', '30-jeolgi-lidong-boundary', '31-newborn-infant-male'], gateDims: 2 },
];

for (const c of candidates) {
  const [cat, period] = c.slot.split('/');
  console.log('=== Slot:', c.slot, '(planned dims:', c.gateDims + ') ===');
  for (const targetPrefix of c.target) {
    const data = fixturesByPrefix.get(targetPrefix);
    if (!data) {
      console.log('  ', targetPrefix, '-> FIXTURE NOT FOUND');
      continue;
    }
    const tm = data.payload && data.payload.tieredMatrix;
    if (!tm) continue;
    const p = tm.periods && tm.periods[period];
    if (!p) continue;
    const cell = p.byCategory && p.byCategory[cat];
    if (!cell || !cell.selectedFragments || !cell.selectedFragments.brief) {
      console.log('  ', targetPrefix, '-> NO WINNER!');
      continue;
    }
    const w = cell.selectedFragments.brief;
    const dims = Object.keys(w.gating || {}).length;
    const willWin = c.gateDims > dims;
    console.log('  ', targetPrefix, '-> winner:', w.fragmentId, '| existing dims:', dims, '| will-win:', willWin);
  }
}
