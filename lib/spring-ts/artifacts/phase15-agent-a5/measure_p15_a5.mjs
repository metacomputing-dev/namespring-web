/**
 * artifacts/phase15-agent-a5/measure_p15_a5.mjs
 *
 * Phase 15 Agent A5 audit measurement. Reads the 35 tiered fixture
 * sample outputs at artifacts/sample-outputs-2026-05-05-phase3/ and
 * computes:
 *
 *   - paragraph-count histograms for brief / standard / expert tiers
 *     (post P13-A4 standard-3-7 paragraph contract; post P14-A2 ≥3
 *     paragraph appends to coverage floors -- now correctly surfaced
 *     after P15-A5 sample regen catch-up).
 *   - brief.hook adoption rate (post P13-A1 brief.hook implementation):
 *     fixtures-with-hook / total fixtures, distinct hook strings, and
 *     per-(category,period) adoption.
 *   - post-processor ungrammatical-alt leak counts (`리듬로`, `자리을`,
 *     `호흡로`, `걸음로`) — productionizable as Phase 16 grammar gate
 *     (P14-A5 §D #1).
 *   - 3+ `흐름이` cluster cells (carry-over from P14-A5 §B3 monitoring).
 *
 * Read-only on the sample artifacts; does not touch fragment data or
 * spawn the engine. No network. Pure JSON parse + aggregate.
 *
 * Usage: node artifacts/phase15-agent-a5/measure_p15_a5.mjs [out.json]
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

// Post-processor ungrammatical-alt detection (P14-A5 §A / §C3 / Phase 16 #1).
// These are particle/suffix combinations that the post-processor's
// alt-pick branch (template-engine.ts:reduceOverusedGyeol) emits when
// it picks an alternative for `결X` and the resulting word doesn't
// satisfy Korean phonetics:
//   `결로` -> `리듬로` / `호흡로` / `걸음로` (should be `으로`)
//   `결을` -> `자리을` / `걸음을` (should be `를` after vowel-final)
//
// Note: `발걸음을` is a legitimate compound noun + object marker
// (grammatical), so we only flag standalone `걸음을` not preceded
// by `발`/`첫`/`잰` etc. via negative lookbehind.
const POST_PROCESSOR_LEAK_PATTERNS = [
  { name: 'rhythm_ro', re: /리듬로/g },
  { name: 'rest_ro', re: /호흡로/g },
  { name: 'walk_ro', re: /(?<![발첫한잰빠])걸음로/g },
  { name: 'spot_eul', re: /자리을/g },
  { name: 'walk_eul', re: /(?<![발첫한잰빠])걸음을/g },
];
const postProcessorLeaks = new Map(); // pattern.name -> total occurrences across cells
const postProcessorLeakCells = []; // up to 30 sample cells
const postProcessorLeakSrcCells = new Set(); // unique fixture|period|category triples

// 3+ `흐름이` cluster cells (P14-A5 §B3 carry-over).
const flowCusterCells = [];

function countMatches(text, re) {
  if (!text || typeof text !== 'string') return 0;
  return (text.match(re) ?? []).length;
}

function bumpMap(map, key, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

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

      // Aggregate cell text across tiers for leak / cluster scans.
      // Use plainText where present (post-glossary expansion), else
      // join token .value strings.
      const plainSegments = [];
      function pushSegments(paragraphs) {
        if (!Array.isArray(paragraphs)) return;
        for (const p of paragraphs) {
          if (typeof p?.plainText === 'string') {
            plainSegments.push(p.plainText);
          } else if (Array.isArray(p?.tokens)) {
            for (const tok of p.tokens) {
              if (tok && typeof tok.value === 'string') plainSegments.push(tok.value);
            }
          }
        }
      }
      if (typeof cell.brief?.headline === 'string') plainSegments.push(cell.brief.headline);
      if (typeof cell.brief?.hook === 'string') plainSegments.push(cell.brief.hook);
      pushSegments(cell.standard?.paragraphs);
      pushSegments(cell.expert?.paragraphs);
      const cellText = plainSegments.join('\n');

      let cellHasLeak = false;
      for (const p of POST_PROCESSOR_LEAK_PATTERNS) {
        const c = countMatches(cellText, p.re);
        if (c > 0) {
          bumpMap(postProcessorLeaks, p.name, c);
          cellHasLeak = true;
        }
      }
      if (cellHasLeak) {
        const triple = `${fixtureId}|${periodKey}|${catKey}`;
        if (!postProcessorLeakSrcCells.has(triple)) {
          postProcessorLeakSrcCells.add(triple);
          if (postProcessorLeakCells.length < 30) {
            const sampleSnippet = cellText.match(/[^\n]*(리듬로|호흡로|걸음로|자리을|걸음을)[^\n]*/)?.[0] ?? '';
            postProcessorLeakCells.push({
              fixture: fixtureId,
              period: periodKey,
              category: catKey,
              snippet: String(sampleSnippet).slice(0, 120),
            });
          }
        }
      }

      // Cluster: any single paragraph plainText with 3+ `흐름이`.
      function checkParagraphCluster(paragraphs) {
        if (!Array.isArray(paragraphs)) return;
        for (const p of paragraphs) {
          const ptext = typeof p?.plainText === 'string'
            ? p.plainText
            : (Array.isArray(p?.tokens)
                ? p.tokens.map((t) => (t && typeof t.value === 'string' ? t.value : '')).join('')
                : '');
          const cnt = countMatches(ptext, /흐름이/g);
          if (cnt >= 3) {
            flowCusterCells.push({
              fixture: fixtureId,
              period: periodKey,
              category: catKey,
              tier: paragraphs === cell.standard?.paragraphs ? 'standard' : 'expert',
              flowCount: cnt,
              snippet: String(ptext).slice(0, 120),
            });
          }
        }
      }
      checkParagraphCluster(cell.standard?.paragraphs);
      checkParagraphCluster(cell.expert?.paragraphs);
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
  phase: 'P15-A5',
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
  postProcessorLeaks: {
    totalOccurrences: Array.from(postProcessorLeaks.values()).reduce((s, v) => s + v, 0),
    uniqueLeakCells: postProcessorLeakSrcCells.size,
    perPattern: Object.fromEntries(
      Array.from(postProcessorLeaks.entries()).sort((a, b) => b[1] - a[1]),
    ),
    sampleCells: postProcessorLeakCells,
  },
  flowCluster: {
    totalCells: flowCusterCells.length,
    sampleCells: flowCusterCells.slice(0, 30),
  },
};

const target = process.argv[2];
const txt = JSON.stringify(out, null, 2);
if (target) {
  fs.writeFileSync(target, txt + '\n');
  console.log(`Wrote ${target}`);
} else {
  console.log(txt);
}
