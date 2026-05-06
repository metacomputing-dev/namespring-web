/**
 * artifacts/phase14-agent-a5/measure_p14_a5.mjs
 *
 * Phase 14 Agent A5 audit measurement. Reads the 35 tiered fixture
 * sample outputs at artifacts/sample-outputs-2026-05-05-phase3/ and
 * computes:
 *
 *   - paragraph-count histograms for brief / standard / expert tiers
 *     (post P13-A4 standard-3-7 paragraph contract)
 *   - brief.hook adoption rate (post P13-A1 brief.hook implementation):
 *     fixtures-with-hook / total fixtures, distinct hook strings, and
 *     per-(category,period) adoption
 *
 * Read-only on the sample artifacts; does not touch fragment data or
 * spawn the engine. No network. Pure JSON parse + aggregate.
 *
 * Usage: node artifacts/phase14-agent-a5/measure_p14_a5.mjs [out.json]
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SAMPLES_DIR = path.resolve(SPRING_TS_ROOT, 'artifacts/sample-outputs-2026-05-05-phase3');

const TIERED_FILE_RE = /-tiered\.json$/;
const sampleFiles = fs
  .readdirSync(SAMPLES_DIR)
  .filter((f) => TIERED_FILE_RE.test(f))
  .sort();

const briefHist = {};
const standardHist = {};
const expertHist = {};
let totalCells = 0;
let totalFixturesWithMatrix = 0;
let totalFixtures = 0;
const lowParagraphSamples = []; // examples of standard < 3
const fixturesWithHook = new Set();
const hookStrings = new Map(); // string -> count
const hookByCategoryPeriod = new Map(); // 'category|period' -> count
const hookFixtureToHooks = new Map(); // fixture -> [{cat,period,text}]

function bump(hist, key) {
  hist[String(key)] = (hist[String(key)] ?? 0) + 1;
}

for (const file of sampleFiles) {
  totalFixtures += 1;
  const fullPath = path.join(SAMPLES_DIR, file);
  const fixtureId = file.replace(/\.json$/, '');
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  const tm = json?.payload?.tieredMatrix ?? json?.tieredMatrix;
  if (!tm?.periods) continue;
  totalFixturesWithMatrix += 1;
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
      const briefHook = cell.brief?.hook;
      if (typeof briefHook === 'string' && briefHook.length > 0) {
        fixturesWithHook.add(fixtureId);
        hookStrings.set(briefHook, (hookStrings.get(briefHook) ?? 0) + 1);
        const k = `${catKey}|${periodKey}`;
        hookByCategoryPeriod.set(k, (hookByCategoryPeriod.get(k) ?? 0) + 1);
        if (!hookFixtureToHooks.has(fixtureId)) hookFixtureToHooks.set(fixtureId, []);
        hookFixtureToHooks.get(fixtureId).push({ category: catKey, period: periodKey, text: briefHook });
      }
      const briefHeadlineLen =
        typeof cell.brief?.headline === 'string'
          ? [...cell.brief.headline].length
          : 0;
      bump(briefHist, briefHeadlineLen > 0 ? 1 : 0);
      const sLen = Array.isArray(cell.standard?.paragraphs)
        ? cell.standard.paragraphs.length
        : 0;
      bump(standardHist, sLen);
      if (sLen < 3 && lowParagraphSamples.length < 30) {
        const sample =
          (cell.standard?.paragraphs?.[0]?.plainText) ??
          (cell.standard?.paragraphs?.[0]?.text) ??
          '';
        lowParagraphSamples.push({
          fixture: fixtureId,
          period: periodKey,
          category: catKey,
          paragraphs: sLen,
          fragmentId: cell.selectedFragments?.standard?.fragmentId,
          firstParagraphSample: String(sample).slice(0, 80),
        });
      }
      const eLen = Array.isArray(cell.expert?.paragraphs)
        ? cell.expert.paragraphs.length
        : 0;
      bump(expertHist, eLen);
    }
  }
}

function fraction(n, d) {
  return d > 0 ? +((n / d) * 100).toFixed(2) : 0;
}

const standardGe3 =
  Object.entries(standardHist).reduce(
    (sum, [k, v]) => (Number(k) >= 3 ? sum + v : sum),
    0,
  );
const standardGe2 =
  Object.entries(standardHist).reduce(
    (sum, [k, v]) => (Number(k) >= 2 ? sum + v : sum),
    0,
  );
const expertGe3 =
  Object.entries(expertHist).reduce(
    (sum, [k, v]) => (Number(k) >= 3 ? sum + v : sum),
    0,
  );

const out = {
  phase: 'P14-A5',
  generatedAt: new Date().toISOString(),
  source: path.relative(SPRING_TS_ROOT, SAMPLES_DIR),
  totalFixtures,
  totalFixturesWithMatrix,
  totalCells,
  paragraphHistograms: {
    brief: briefHist,
    standard: standardHist,
    expert: expertHist,
  },
  paragraphRollups: {
    standardGe3Cells: standardGe3,
    standardGe3Percent: fraction(standardGe3, totalCells),
    standardGe2Cells: standardGe2,
    standardGe2Percent: fraction(standardGe2, totalCells),
    expertGe3Cells: expertGe3,
    expertGe3Percent: fraction(expertGe3, totalCells),
  },
  briefHookSurface: {
    fixturesWithAtLeastOneHook: fixturesWithHook.size,
    fixtureCoveragePercent: fraction(fixturesWithHook.size, totalFixturesWithMatrix),
    totalHookOccurrences: Array.from(hookStrings.values()).reduce(
      (s, v) => s + v,
      0,
    ),
    distinctHookStrings: hookStrings.size,
    perHookOccurrence: Object.fromEntries(
      Array.from(hookStrings.entries()).sort((a, b) => b[1] - a[1]),
    ),
    perCategoryPeriodCount: Object.fromEntries(
      Array.from(hookByCategoryPeriod.entries()).sort(
        (a, b) => b[1] - a[1],
      ),
    ),
  },
  lowParagraphStandardSamples: lowParagraphSamples,
};

const target = process.argv[2];
const txt = JSON.stringify(out, null, 2);
if (target) {
  fs.writeFileSync(target, txt + '\n');
  console.log(`Wrote ${target}`);
} else {
  console.log(txt);
}
