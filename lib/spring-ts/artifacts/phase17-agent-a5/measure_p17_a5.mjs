/**
 * artifacts/phase17-agent-a5/measure_p17_a5.mjs
 *
 * Phase 17 Agent A5 audit measurement. Reuses the heavy-lift detector
 * shape from P16-A5 (`measure_p16_a5.mjs`) on the current 35 tiered
 * sample outputs at `artifacts/sample-outputs-2026-05-05-phase3/`.
 *
 * Outputs the cumulative metric set tracked since P14-A5:
 *   - paragraph-count histograms for brief / standard / expert tiers
 *   - brief.hook adoption rate (per fixture, per category|period, per
 *     distinct hook string)
 *   - post-processor ungrammatical-alt leak counts (now ratcheted to 0
 *     per P15-A2 batchim fix + P16-A2 source rewording + ci ratchet)
 *   - 3+ `흐름이` cluster cells (P15-A4 follow-up monitoring)
 *   - 3+ `결` source clusters (P14-A5 follow-up monitoring,
 *     informational only — see P16-A5 §D4)
 *
 * Phase 17 additions:
 *   - per-fixture hook count distribution (so the audit can tell
 *     whether the P16-A3 hook expansion is hitting many fixtures
 *     evenly or piling onto a few)
 *   - longest-hook-cluster-on-a-single-fixture marker (for early
 *     detection of "every cell got the same hook" regression that
 *     P14-A5 / P15-A5 / P16-A5 all warned could happen if gating
 *     widened too far)
 *
 * Read-only on the sample artifacts. Does not touch fragment data,
 * does not spawn the engine, does not network. Pure JSON parse +
 * aggregate.
 *
 * Usage: node artifacts/phase17-agent-a5/measure_p17_a5.mjs [out.json]
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

const briefHist = {};
const standardHist = {};
const expertHist = {};
let totalCells = 0;
let totalFixturesWithMatrix = 0;
let totalFixtures = 0;
const lowParagraphSamples = [];
const fixturesWithHook = new Set();
const hookStrings = new Map();
const hookByCategoryPeriod = new Map();
const hookFixtureToHooks = new Map();

// Post-processor ungrammatical-alt detection (carry-over from P15-A5;
// expected 0 after P15-A2 + P16-A2 + ratchet).
const POST_PROCESSOR_LEAK_PATTERNS = [
  { name: 'rhythm_ro', re: /리듬로/g },
  { name: 'rest_ro', re: /호흡로/g },
  { name: 'walk_ro', re: /(?<![발첫한잰빠])걸음로/g },
  { name: 'spot_eul', re: /자리을/g },
  { name: 'walk_eul', re: /(?<![발첫한잰빠])걸음을/g },
];
const postProcessorLeaks = new Map();
const postProcessorLeakCells = [];
const postProcessorLeakSrcCells = new Set();

// 3+ `흐름이` cluster cells (P15-A4 follow-up monitoring).
const flowClusterCells = [];

// 3+ `결` density cluster (P14-A5 follow-up monitoring; informational).
const gyeolClusterCells = [];

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
        hookByCategoryPeriod.set(
          k,
          (hookByCategoryPeriod.get(k) ?? 0) + 1,
        );
        if (!hookFixtureToHooks.has(fixtureId)) {
          hookFixtureToHooks.set(fixtureId, []);
        }
        hookFixtureToHooks
          .get(fixtureId)
          .push({ category: catKey, period: periodKey, text: briefHook });
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
          cell.standard?.paragraphs?.[0]?.plainText ??
          cell.standard?.paragraphs?.[0]?.text ??
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

      const plainSegments = [];
      function pushSegments(paragraphs) {
        if (!Array.isArray(paragraphs)) return;
        for (const p of paragraphs) {
          if (typeof p?.plainText === 'string') {
            plainSegments.push(p.plainText);
          } else if (Array.isArray(p?.tokens)) {
            for (const tok of p.tokens) {
              if (tok && typeof tok.value === 'string') {
                plainSegments.push(tok.value);
              }
            }
          }
        }
      }
      if (typeof cell.brief?.headline === 'string') {
        plainSegments.push(cell.brief.headline);
      }
      if (typeof cell.brief?.hook === 'string') {
        plainSegments.push(cell.brief.hook);
      }
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
            const sampleSnippet =
              cellText.match(
                /[^\n]*(리듬로|호흡로|걸음로|자리을|걸음을)[^\n]*/,
              )?.[0] ?? '';
            postProcessorLeakCells.push({
              fixture: fixtureId,
              period: periodKey,
              category: catKey,
              snippet: String(sampleSnippet).slice(0, 120),
            });
          }
        }
      }

      function checkParagraphCluster(paragraphs, tier) {
        if (!Array.isArray(paragraphs)) return;
        for (const p of paragraphs) {
          const ptext =
            typeof p?.plainText === 'string'
              ? p.plainText
              : Array.isArray(p?.tokens)
                ? p.tokens
                    .map((t) =>
                      t && typeof t.value === 'string' ? t.value : '',
                    )
                    .join('')
                : '';
          const flowCnt = countMatches(ptext, /흐름이/g);
          if (flowCnt >= 3) {
            flowClusterCells.push({
              fixture: fixtureId,
              period: periodKey,
              category: catKey,
              tier,
              flowCount: flowCnt,
              snippet: String(ptext).slice(0, 120),
            });
          }
          const gyeolCnt = countMatches(ptext, /결/g);
          if (gyeolCnt >= 3) {
            gyeolClusterCells.push({
              fixture: fixtureId,
              period: periodKey,
              category: catKey,
              tier,
              gyeolCount: gyeolCnt,
              snippet: String(ptext).slice(0, 120),
            });
          }
        }
      }
      checkParagraphCluster(cell.standard?.paragraphs, 'standard');
      checkParagraphCluster(cell.expert?.paragraphs, 'expert');
    }
  }
}

function fraction(n, d) {
  return d > 0 ? +((n / d) * 100).toFixed(2) : 0;
}

const standardGe3 = Object.entries(standardHist).reduce(
  (sum, [k, v]) => (Number(k) >= 3 ? sum + v : sum),
  0,
);
const standardGe2 = Object.entries(standardHist).reduce(
  (sum, [k, v]) => (Number(k) >= 2 ? sum + v : sum),
  0,
);
const expertGe3 = Object.entries(expertHist).reduce(
  (sum, [k, v]) => (Number(k) >= 3 ? sum + v : sum),
  0,
);

// Phase 17 additions: per-fixture hook count distribution + max
// hook concentration per fixture (early detector for "every cell got
// the same hook" regression).
const perFixtureHookCount = new Map();
const perFixtureDistinctHookCount = new Map();
let maxHookOnSingleFixture = 0;
let maxHookOnSingleFixtureFixture = null;
for (const [fid, hooks] of hookFixtureToHooks.entries()) {
  perFixtureHookCount.set(fid, hooks.length);
  perFixtureDistinctHookCount.set(
    fid,
    new Set(hooks.map((h) => h.text)).size,
  );
  if (hooks.length > maxHookOnSingleFixture) {
    maxHookOnSingleFixture = hooks.length;
    maxHookOnSingleFixtureFixture = fid;
  }
}
const hookCountHistogram = {};
for (const v of perFixtureHookCount.values()) {
  bump(hookCountHistogram, v);
}
// Add zero-hook-fixtures to the histogram so totals add up to 32.
const fixturesWithoutHook = totalFixturesWithMatrix - fixturesWithHook.size;
if (fixturesWithoutHook > 0) {
  hookCountHistogram['0'] = fixturesWithoutHook;
}

const out = {
  phase: 'P17-A5',
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
    fixtureCoveragePercent: fraction(
      fixturesWithHook.size,
      totalFixturesWithMatrix,
    ),
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
    perFixtureHookCountHistogram: hookCountHistogram,
    maxHookOnSingleFixture,
    maxHookOnSingleFixtureFixture,
  },
  lowParagraphStandardSamples: lowParagraphSamples,
  postProcessorLeaks: {
    totalOccurrences: Array.from(postProcessorLeaks.values()).reduce(
      (s, v) => s + v,
      0,
    ),
    uniqueLeakCells: postProcessorLeakSrcCells.size,
    perPattern: Object.fromEntries(
      Array.from(postProcessorLeaks.entries()).sort(
        (a, b) => b[1] - a[1],
      ),
    ),
    sampleCells: postProcessorLeakCells,
  },
  flowCluster: {
    totalCells: flowClusterCells.length,
    sampleCells: flowClusterCells.slice(0, 30),
  },
  gyeolCluster: {
    totalCells: gyeolClusterCells.length,
    sampleCells: gyeolClusterCells.slice(0, 30),
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
