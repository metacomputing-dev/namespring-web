/**
 * P22-A1: Pre-measure brief tier minor coverage to detect regression
 * after lifting MINOR_LIMITED_CATEGORIES early-return.
 *
 * Mirrors passesMinorGuard semantics from fragment-selector.ts:53-62:
 * - When the reader is a minor (ageBand=0-9 or 10-19), candidate must
 *   have an array `gating.ageBand` that includes the reader's band.
 * - Fragments without explicit `gating.ageBand` are filtered out.
 *
 * Output: per-cell tally for wealth/romance/study_document × 5 periods
 * × 5 minor fixtures, brief-tier specifically. Identifies cells that
 * would regress to PLACEHOLDER_BRIEF after the src lift if no
 * minor-gated brief fragment exists.
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

// (cat|period|depth) -> [{id, ageBand}].
const idx = {};
for (const f of files) {
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { continue; }
  if (!Array.isArray(j.fragments)) continue;
  for (const fr of j.fragments) {
    const a = fr.axis || {};
    const k = `${a.category}|${a.period}|${a.depth}`;
    idx[k] = idx[k] || [];
    idx[k].push({
      id: fr.fragmentId,
      ageBand: fr.gating?.ageBand || null,
      sourceFile: path.relative(NARRATIVE_ROOT, f),
    });
  }
}

const fixtures = [
  { id: '04-kim-seoyun-young-female', ageBand: '10-19' },
  { id: '18-lee-child-male', ageBand: '0-9' },
  { id: '27-jonggyeok-jongah', ageBand: '0-9' },
  { id: '30-jeolgi-lidong-boundary', ageBand: '0-9' },
  { id: '31-newborn-infant-male', ageBand: '0-9' },
];
const cats = ['wealth', 'romance', 'study_document'];
const periods = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'];

function findMinorGated(cat, per, depth, fixture) {
  const k = `${cat}|${per}|${depth}`;
  const cands = (idx[k] || []).filter(
    (fr) => Array.isArray(fr.ageBand) && fr.ageBand.includes(fixture.ageBand),
  );
  return cands;
}

const briefResults = [];
for (const fx of fixtures) {
  for (const c of cats) {
    for (const p of periods) {
      const cands = findMinorGated(c, p, 'brief', fx);
      briefResults.push({
        fx: fx.id,
        cat: c,
        per: p,
        ab: fx.ageBand,
        candidates: cands.length,
        candidateIds: cands.map((c) => c.id),
        outcome: cands.length > 0 ? 'fragment-found' : 'no-minor-gated-brief',
      });
    }
  }
}

const noBrief = briefResults.filter((r) => r.outcome === 'no-minor-gated-brief');

console.log('=== Brief tier minor-gated coverage ===');
console.log(`Total cells (3 cats × 5 periods × 5 fixtures): ${briefResults.length}`);
console.log(`Fragment-found: ${briefResults.length - noBrief.length}`);
console.log(`No minor-gated brief (would regress to PLACEHOLDER_BRIEF after src lift): ${noBrief.length}`);

console.log('\nGap distribution (cat | per | ab → fixture count):');
const gap = {};
for (const r of noBrief) {
  const k = `${r.cat}|${r.per}|${r.ab}`;
  gap[k] = (gap[k] || 0) + 1;
}
for (const [k, c] of Object.entries(gap).sort()) console.log(`  ${c}  ${k}`);

console.log('\nMinimum brief fragments needed to close all gaps:');
const slotKeys = new Set();
for (const r of noBrief) slotKeys.add(`${r.cat}|${r.per}`);
const slotsByCatPer = {};
for (const r of noBrief) {
  const k = `${r.cat}|${r.per}`;
  if (!slotsByCatPer[k]) slotsByCatPer[k] = new Set();
  slotsByCatPer[k].add(r.ab);
}
let totalFragments = 0;
const fragmentsByCatPer = [];
for (const [k, abSet] of Object.entries(slotsByCatPer).sort()) {
  const abs = [...abSet].sort();
  // 1 fragment with combined ageBand can cover both bands at once.
  fragmentsByCatPer.push({ catPer: k, ageBands: abs, fragmentsNeeded: 1 });
  totalFragments += 1;
}
console.log(`Total slots: ${slotKeys.size}, fragments needed: ${totalFragments}`);
for (const { catPer, ageBands, fragmentsNeeded } of fragmentsByCatPer) {
  console.log(`  ${fragmentsNeeded}  ${catPer} ageBand=[${ageBands.join(',')}]`);
}

const out = {
  phase: 'P22-A1',
  generatedAt: new Date().toISOString(),
  summary: {
    total: briefResults.length,
    fragmentFound: briefResults.length - noBrief.length,
    wouldRegressToPlaceholderBrief: noBrief.length,
    fragmentsNeededToClose: totalFragments,
  },
  noBriefDistribution: gap,
  fragmentsToAuthor: fragmentsByCatPer,
  briefResults,
};
fs.writeFileSync(path.join(__dirname, 'measure_brief_tier.json'), JSON.stringify(out, null, 2));
console.log('\nWrote measure_brief_tier.json');
