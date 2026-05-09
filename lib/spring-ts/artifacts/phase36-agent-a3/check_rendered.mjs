/**
 * P34-A3 — Rendered-cell histogram from sample fixtures.
 * Computes paragraph counts of rendered expert tier per cell.
 * Adapted from artifacts/phase33-agent-a3/check_rendered.mjs.
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

const SNAPSHOT_NAME = process.argv[2] ?? 'snapshot-2026-05-08.json';

const TIERED_FILE_RE = /-tiered\.json$/;
const sampleFiles = fs
  .readdirSync(SAMPLES_DIR)
  .filter((f) => TIERED_FILE_RE.test(f))
  .sort();

const histogram = {};
let totalCells = 0;
const fragHistogram = new Map();
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
      const expert = cell?.expert;
      if (!expert) continue;
      const pc = (expert.paragraphs ?? []).length;
      histogram[pc] = (histogram[pc] ?? 0) + 1;
      totalCells += 1;

      const fid = cell?.selectedFragments?.expert?.fragmentId;
      if (fid) {
        if (!fragHistogram.has(fid)) {
          fragHistogram.set(fid, { count: 0, paragraphs: pc });
        }
        const ref = fragHistogram.get(fid);
        ref.count += 1;
        ref.paragraphs = pc;
      }
    }
  }
}

console.log('Total expert rendered cells:', totalCells);
console.log('Rendered paragraph histogram:', histogram);

const out = {
  generatedAt: new Date().toISOString(),
  totalCells,
  renderedHistogram: histogram,
  perFragment: Object.fromEntries(fragHistogram),
};
fs.writeFileSync(
  path.join(__dirname, SNAPSHOT_NAME),
  JSON.stringify(out, null, 2) + '\n',
);
console.log(`\nWrote ${SNAPSHOT_NAME}`);
