/**
 * Categorize the 107 no-fragmentId cells by category/period.
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

const TIERED_FILE_RE = /-tiered\.json$/;
const sampleFiles = fs
  .readdirSync(SAMPLES_DIR)
  .filter((f) => TIERED_FILE_RE.test(f))
  .sort();

const noFidCells = [];
const sub3CellsWithFid = [];

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
    for (const [catKey, cell] of cells) {
      if (!cell) continue;
      const sLen = Array.isArray(cell.standard?.paragraphs)
        ? cell.standard.paragraphs.length
        : 0;
      if (sLen >= 3) continue;
      const fragmentId = cell.selectedFragments?.standard?.fragmentId;
      const sample =
        cell.standard?.paragraphs?.[0]?.plainText ??
        cell.standard?.paragraphs?.[0]?.text ??
        '';
      const entry = {
        fixture: fixtureId,
        period: periodKey,
        category: catKey,
        paragraphs: sLen,
        fragmentId: fragmentId ?? null,
        sample: String(sample).slice(0, 100),
      };
      if (fragmentId) {
        sub3CellsWithFid.push(entry);
      } else {
        noFidCells.push(entry);
      }
    }
  }
}

// Categorize no-fid cells by category and period
const byCatPeriod = {};
for (const c of noFidCells) {
  const k = `${c.category}|${c.period}`;
  if (!byCatPeriod[k]) byCatPeriod[k] = 0;
  byCatPeriod[k] += 1;
}
console.log('No-fragmentId cells (107 expected):', noFidCells.length);
console.log('\nBy category|period:');
const sorted = Object.entries(byCatPeriod).sort((a, b) => b[1] - a[1]);
for (const [k, c] of sorted) {
  console.log(`  ${c.toString().padStart(3)}  ${k}`);
}

// Group by category alone
const byCat = {};
for (const c of noFidCells) {
  if (!byCat[c.category]) byCat[c.category] = 0;
  byCat[c.category] += 1;
}
console.log('\nBy category:');
for (const [k, c] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c.toString().padStart(3)}  ${k}`);
}

console.log('\n2-paragraph cells (84 expected):', sub3CellsWithFid.length);

// Group fragments
const byFid = {};
for (const c of sub3CellsWithFid) {
  if (!byFid[c.fragmentId]) byFid[c.fragmentId] = { count: 0, sample: c.sample };
  byFid[c.fragmentId].count += 1;
}
console.log('\nDistinct fragmentIds:', Object.keys(byFid).length);

// Output to file
const out = {
  phase: 'P18-A3',
  noFidCells,
  sub3CellsWithFid,
  byCatPeriod,
  byCat,
  distinctFragmentIds: Object.keys(byFid).sort(),
};
fs.writeFileSync(path.join(__dirname, 'analyze-no-fid.json'), JSON.stringify(out, null, 2));
