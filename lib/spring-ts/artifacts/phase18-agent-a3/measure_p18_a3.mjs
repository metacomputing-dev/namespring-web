/**
 * artifacts/phase18-agent-a3/measure_p18_a3.mjs
 *
 * P18-A3: Detailed sub-3-paragraph standard cell measurement.
 * Reads sample outputs and identifies which fragments produce
 * sub-3-paragraph standard cells. Output groups by fragmentId,
 * tier (1 or 2 paragraphs), and lists all affected cells.
 *
 * Usage: node artifacts/phase18-agent-a3/measure_p18_a3.mjs [out.json]
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

const standardHist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
let totalCells = 0;
const sub3Cells = [];

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
      totalCells += 1;
      const sLen = Array.isArray(cell.standard?.paragraphs)
        ? cell.standard.paragraphs.length
        : 0;
      if (sLen <= 6) standardHist[sLen] = (standardHist[sLen] ?? 0) + 1;
      if (sLen < 3) {
        const fragmentId = cell.selectedFragments?.standard?.fragmentId;
        const sample =
          cell.standard?.paragraphs?.[0]?.plainText ??
          cell.standard?.paragraphs?.[0]?.text ??
          '';
        sub3Cells.push({
          fixture: fixtureId,
          period: periodKey,
          category: catKey,
          paragraphs: sLen,
          fragmentId: fragmentId ?? null,
          firstParagraphSample: String(sample).slice(0, 100),
        });
      }
    }
  }
}

const byFragmentId = {};
const noFragmentIdCount = { 1: 0, 2: 0, total: 0 };
for (const c of sub3Cells) {
  const fid = c.fragmentId ?? '__no_fragmentId__';
  if (!byFragmentId[fid]) {
    byFragmentId[fid] = { paragraphCount: c.paragraphs, count: 0, firstSample: c.firstParagraphSample, exampleCells: [] };
  }
  byFragmentId[fid].count += 1;
  if (byFragmentId[fid].exampleCells.length < 3) {
    byFragmentId[fid].exampleCells.push({
      fixture: c.fixture,
      period: c.period,
      category: c.category,
    });
  }
  if (!c.fragmentId) {
    noFragmentIdCount.total += 1;
    noFragmentIdCount[c.paragraphs] = (noFragmentIdCount[c.paragraphs] ?? 0) + 1;
  }
}

const sortedFragments = Object.entries(byFragmentId)
  .sort((a, b) => b[1].count - a[1].count);

const out = {
  phase: 'P18-A3',
  generatedAt: new Date().toISOString(),
  totalCells,
  standardHist,
  sub3Total: sub3Cells.length,
  sub3ByParagraphCount: {
    1: sub3Cells.filter((c) => c.paragraphs === 1).length,
    2: sub3Cells.filter((c) => c.paragraphs === 2).length,
  },
  noFragmentIdCount,
  fragmentBreakdown: sortedFragments.map(([fid, info]) => ({ fragmentId: fid, ...info })),
  // First N sub3 cells with full details for traceability
  allSub3Cells: sub3Cells,
};

const outPath = process.argv[2] ?? path.join(__dirname, 'sub3-snapshot.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath}`);
console.log(`Total cells: ${totalCells}`);
console.log(`Standard histogram:`, standardHist);
console.log(`Sub-3 total: ${sub3Cells.length}`);
console.log(`  1-paragraph: ${out.sub3ByParagraphCount[1]}`);
console.log(`  2-paragraph: ${out.sub3ByParagraphCount[2]}`);
console.log(`No fragmentId:`, noFragmentIdCount);
console.log(`\nTop fragments producing sub-3 cells:`);
for (const [fid, info] of sortedFragments.slice(0, 30)) {
  console.log(`  [${info.paragraphCount}P x ${info.count}] ${fid}`);
}
