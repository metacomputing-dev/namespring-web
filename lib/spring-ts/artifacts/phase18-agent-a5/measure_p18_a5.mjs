/**
 * artifacts/phase18-agent-a5/measure_p18_a5.mjs
 *
 * Phase 18 Agent A5 audit measurement. Combines:
 *   - paragraph histograms + post-processor leak monitors + cluster
 *     monitors from `measure_p17_a5.mjs`
 *   - authored-vs-emit hook dormancy from `measure_p18_a2.mjs`
 *
 * P18-A5 additions:
 *   - extra post-processor leak pattern: `연흐름` (compound 연결X collides
 *     with the `결X` substitution table when the source word is "연결").
 *     This is a NEW class of leak surfaced by P18-A5 audit. Fix lives in
 *     `data/narrative/_coverage/` source (rephrase 연결X → 연결고리Y).
 *
 * Read-only on samples + data. Pure JSON parse + aggregate.
 *
 * Usage: node artifacts/phase18-agent-a5/measure_p18_a5.mjs [out.json]
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
const COVERAGE_DIR = path.resolve(NARRATIVE_DIR, '_coverage');

const PERIODS = ['today', 'thisWeek', 'thisMonth', 'thisYear', 'life'];

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
const fixturesWithHook = new Set();
const hookStrings = new Map();
const hookFixtureToHooks = new Map();

// Post-processor leak patterns (P15-A2 batchim + P16-A2 source rewording
// + P18-A5 compound 연결 leak surfaced).
const POST_PROCESSOR_LEAK_PATTERNS = [
  { name: 'rhythm_ro', re: /리듬로/g },
  { name: 'rest_ro', re: /호흡로/g },
  { name: 'walk_ro', re: /(?<![발첫한잰빠])걸음로/g },
  { name: 'spot_eul', re: /자리을/g },
  { name: 'walk_eul', re: /(?<![발첫한잰빠])걸음을/g },
  // P18-A5: 연결X compound collision with GYEOL_SUBS post-processor.
  // The post-processor replaces `결을|결로|결이|결은` etc. without word
  // boundary, so 연결을 → 연흐름을 (broken Korean). The fix lives in
  // _coverage/ source rephrasing 연결X → 연결고리Y.
  { name: 'compound_yeon_flow', re: /연흐름|연리듬|연자리|연호흡|연걸음/g },
];
const postProcessorLeaks = new Map();
const postProcessorLeakCells = [];
const postProcessorLeakSrcCells = new Set();

const flowClusterCells = [];
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
                /[^\n]*(리듬로|호흡로|걸음로|자리을|걸음을|연흐름|연리듬|연자리|연호흡|연걸음)[^\n]*/,
              )?.[0] ?? '';
            postProcessorLeakCells.push({
              fixture: fixtureId,
              period: periodKey,
              category: catKey,
              snippet: String(sampleSnippet).slice(0, 160),
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

// Per-fixture hook count distribution.
const perFixtureHookCount = new Map();
let maxHookOnSingleFixture = 0;
let maxHookOnSingleFixtureFixture = null;
for (const [fid, hooks] of hookFixtureToHooks.entries()) {
  perFixtureHookCount.set(fid, hooks.length);
  if (hooks.length > maxHookOnSingleFixture) {
    maxHookOnSingleFixture = hooks.length;
    maxHookOnSingleFixtureFixture = fid;
  }
}
const hookCountHistogram = {};
for (const v of perFixtureHookCount.values()) {
  bump(hookCountHistogram, v);
}
const fixturesWithoutHook = totalFixturesWithMatrix - fixturesWithHook.size;
if (fixturesWithoutHook > 0) {
  hookCountHistogram['0'] = fixturesWithoutHook;
}

// Authored brief.hook fragments — replicate measure_p18_a2.mjs view.
const cats = fs
  .readdirSync(NARRATIVE_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name)
  .sort();

const authoredFragments = [];
for (const cat of cats) {
  for (const period of PERIODS) {
    const file = path.join(NARRATIVE_DIR, cat, period, 'brief.fragments.json');
    if (!fs.existsSync(file)) continue;
    const j = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const frag of j.fragments ?? []) {
      if (typeof frag?.hook === 'string' && frag.hook.length > 0) {
        authoredFragments.push({
          cat,
          period,
          fragmentId: frag.fragmentId,
          hook: frag.hook,
        });
      }
    }
  }
}
const authoredHookStrings = new Set(authoredFragments.map((a) => a.hook));
const dormantHookCount = Array.from(authoredHookStrings).filter(
  (h) => !hookStrings.has(h),
).length;

// _coverage/ 연결X compound count (the source-side root cause of the
// 연흐름 leak). After P18-A5 fix this should drop from 31 to 0.
const coverageFiles = fs
  .readdirSync(COVERAGE_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();
let coverageYeongyeolCount = 0;
const coverageYeongyeolPerFile = {};
for (const f of coverageFiles) {
  const txt = fs.readFileSync(path.join(COVERAGE_DIR, f), 'utf-8');
  const matches = txt.match(/연결[을로은이의도만]/g) ?? [];
  if (matches.length > 0) {
    coverageYeongyeolCount += matches.length;
    coverageYeongyeolPerFile[f] = matches.length;
  }
}

const out = {
  phase: 'P18-A5',
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
    authoredHookStrings: authoredHookStrings.size,
    dormantHookStrings: dormantHookCount,
    perHookOccurrence: Object.fromEntries(
      Array.from(hookStrings.entries()).sort((a, b) => b[1] - a[1]),
    ),
    perFixtureHookCountHistogram: hookCountHistogram,
    maxHookOnSingleFixture,
    maxHookOnSingleFixtureFixture,
  },
  postProcessorLeaks: {
    totalOccurrences: Array.from(postProcessorLeaks.values()).reduce(
      (s, v) => s + v,
      0,
    ),
    uniqueLeakCells: postProcessorLeakSrcCells.size,
    perPattern: Object.fromEntries(
      Array.from(postProcessorLeaks.entries()).sort((a, b) => b[1] - a[1]),
    ),
    sampleCells: postProcessorLeakCells,
  },
  flowCluster: {
    totalCells: flowClusterCells.length,
  },
  gyeolCluster: {
    totalCells: gyeolClusterCells.length,
  },
  coverageYeongyeol: {
    totalCount: coverageYeongyeolCount,
    perFile: coverageYeongyeolPerFile,
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
