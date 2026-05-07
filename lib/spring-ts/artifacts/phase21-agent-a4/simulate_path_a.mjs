/**
 * P21-A4: Simulate Path A (lift MINOR_LIMITED_CATEGORIES early-return)
 * to measure how many of the 75 src-locked sub-3 cells would actually
 * receive a 3+-paragraph fragment from data, vs. fall back to the
 * 1-paragraph buildMinorStandardFallback path because no minor-gated
 * fragment exists at the matching ageBand.
 *
 * Read-only investigation — does not mutate src/, data/, or tools/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NARRATIVE_ROOT = path.resolve(SPRING_TS_ROOT, 'data/narrative');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.fragments.json')) out.push(p);
  }
  return out;
}

const files = walk(NARRATIVE_ROOT);

// Build (cat|period|depth) -> [{id, ageBand[], paragraphs}] index.
const idx = {};
for (const f of files) {
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { continue; }
  if (!Array.isArray(j.fragments)) continue;
  for (const fr of j.fragments) {
    const a = fr.axis || {};
    const k = `${a.category}|${a.period}|${a.depth}`;
    let combined = '';
    for (const t of fr.templateTokens || []) {
      if (t.kind === 'text') combined += t.value;
      else if (t.kind === 'tag') combined += '#' + (t.label || t.tagId);
    }
    const paragraphs = combined.split(/\n\n+/).filter((s) => s.trim().length > 0).length;
    idx[k] = idx[k] || [];
    idx[k].push({
      id: fr.fragmentId,
      ageBand: fr.gating?.ageBand || null,
      paragraphs,
    });
  }
}

// Minor fixtures (5 children + teen, all in current sample suite).
const fixtures = [
  { id: '04-kim-seoyun-young-female', ageBand: '10-19' },
  { id: '18-lee-child-male', ageBand: '0-9' },
  { id: '27-jonggyeok-jongah', ageBand: '0-9' },
  { id: '30-jeolgi-lidong-boundary', ageBand: '0-9' },
  { id: '31-newborn-infant-male', ageBand: '0-9' },
];
const lockedCats = ['wealth', 'romance', 'study_document'];
const fallbackCats = ['career', 'health', 'health_stress', 'overall'];
const periods = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'];

/** Mirror passesMinorGuard: ageBand must be array including the fixture's band. */
function pickBest(cat, per, fixture) {
  const k = `${cat}|${per}|standard`;
  const cands = (idx[k] || []).filter(
    (fr) => Array.isArray(fr.ageBand) && fr.ageBand.includes(fixture.ageBand),
  );
  if (cands.length === 0) return { outcome: 'no-minor-fragment', paragraphs: 1, best: null };
  cands.sort((a, b) => b.paragraphs - a.paragraphs);
  return { outcome: 'fragment-found', paragraphs: cands[0].paragraphs, best: cands[0].id };
}

const lockedResults = [];
for (const fx of fixtures) {
  for (const c of lockedCats) {
    for (const p of periods) {
      lockedResults.push({ fx: fx.id, cat: c, per: p, ab: fx.ageBand, ...pickBest(c, p, fx) });
    }
  }
}

const fallbackResults = [];
for (const fx of fixtures) {
  for (const c of fallbackCats) {
    for (const p of periods) {
      fallbackResults.push({ fx: fx.id, cat: c, per: p, ab: fx.ageBand, ...pickBest(c, p, fx) });
    }
  }
}

const lockedSub3 = lockedResults.filter((r) => r.paragraphs < 3);
const fallbackSub3 = fallbackResults.filter((r) => r.paragraphs < 3);

console.log('=== Path A simulation (lift MINOR_LIMITED_CATEGORIES) ===');
console.log(`Locked cells (75 = 3 cats × 5 periods × 5 fixtures):`);
console.log(`  3+ paragraphs (Path A closes): ${lockedResults.length - lockedSub3.length}`);
console.log(`  sub-3 (still need authoring):  ${lockedSub3.length}`);

console.log('\n=== Fallback cells (current state, src-overridable) ===');
console.log(`  100 = 4 cats × 5 periods × 5 fixtures`);
console.log(`  sub-3 cells: ${fallbackSub3.length}`);

console.log('\nLocked sub-3 distribution after Path A:');
const lockedGap = {};
for (const r of lockedSub3) {
  const k = `${r.cat}|${r.per}|${r.ab}`;
  lockedGap[k] = (lockedGap[k] || 0) + 1;
}
for (const [k, c] of Object.entries(lockedGap).sort()) console.log(`  ${c}  ${k}`);

console.log('\nFallback sub-3 distribution:');
const fbGap = {};
for (const r of fallbackSub3) {
  const k = `${r.cat}|${r.per}|${r.ab}`;
  fbGap[k] = (fbGap[k] || 0) + 1;
}
for (const [k, c] of Object.entries(fbGap).sort()) console.log(`  ${c}  ${k}`);

const out = {
  phase: 'P21-A4',
  generatedAt: new Date().toISOString(),
  summary: {
    pathA_locked_total: lockedResults.length,
    pathA_locked_3plus: lockedResults.length - lockedSub3.length,
    pathA_locked_sub3: lockedSub3.length,
    fallback_total: fallbackResults.length,
    fallback_sub3: fallbackSub3.length,
    pathA_alone_residual_sub3: lockedSub3.length + fallbackSub3.length,
  },
  lockedResults,
  fallbackResults,
};
fs.writeFileSync(path.join(__dirname, 'simulate_path_a.json'), JSON.stringify(out, null, 2));
console.log('\nWrote simulate_path_a.json');
