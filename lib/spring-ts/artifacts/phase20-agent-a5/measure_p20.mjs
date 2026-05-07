/**
 * artifacts/phase20-agent-a5/measure_p20.mjs
 *
 * Phase 20 Agent A5 audit measurement.
 *
 * Successor to `measure_p19.mjs`. Same shape (paragraph histograms +
 * post-processor leak monitors + cluster monitors + per-fixture hook
 * distribution + 연결X conservative + vulnerable + non-_coverage scan +
 * sub-3 standard cells + doubled 결이 cluster monitor), with P20
 * acceptance gate extensions:
 *
 *   1. Verb-form 연결 scan (`연결돼 / 연결되 / 연결해 / 연결한 / 연결할 /
 *      연결됨 / 연결되어 / 연결된다 / 연결하는 / 연결되는 / 연결되며 /
 *      연결하며`). Informational-only counter — verb forms are NOT
 *      vulnerable to GYEOL_SUBS (no particle directly suffixed to 결).
 *      Tracked across `_coverage/`, non-_coverage
 *      `data/narrative/<cat>/**`, `_metaphor/`, `_glossary/`. Foreshadowed
 *      by P19-A5 §Recommendation #7, now explicit P20-A2 follow-up.
 *
 * Read-only on data + samples. Pure JSON parse + aggregate. Does NOT
 * regenerate samples and does NOT touch any forbidden surface.
 *
 * Usage: node artifacts/phase20-agent-a5/measure_p20.mjs [out.json]
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
const METAPHOR_DIR = path.resolve(NARRATIVE_DIR, '_metaphor');
const GLOSSARY_DIR = path.resolve(NARRATIVE_DIR, '_glossary');

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

// Post-processor leak patterns (P15-A2 single-token + P18-A5 compound).
const POST_PROCESSOR_LEAK_PATTERNS = [
  { name: 'rhythm_ro', re: /리듬로/g },
  { name: 'rest_ro', re: /호흡로/g },
  { name: 'walk_ro', re: /(?<![발첫한잰빠])걸음로/g },
  { name: 'spot_eul', re: /자리을/g },
  { name: 'walk_eul', re: /(?<![발첫한잰빠])걸음을/g },
  // Compound 연결X collision with GYEOL_SUBS (surfaced P18-A5).
  { name: 'compound_yeon_flow', re: /연흐름/g },
  { name: 'compound_yeon_rhythm', re: /연리듬/g },
  { name: 'compound_yeon_spot', re: /연자리/g },
  { name: 'compound_yeon_rest', re: /연호흡/g },
  { name: 'compound_yeon_walk', re: /연걸음/g },
];
const postProcessorLeaks = new Map();
const postProcessorLeakCells = [];
const postProcessorLeakSrcCells = new Set();

const flowClusterCells = [];
const gyeolClusterCells = [];
// Doubled `결이` cluster — P18-A4 metric. A paragraph or headline string
// containing `결이` ≥ 2× signals brief reversal cycle re-introducing the
// duplicate. P18-A4 fix in src/template-engine.ts.
const doubledGyeoliCells = [];

// Sub-3 paragraph standard cells (P18-A3 baseline = 107 single-paragraph).
const sub3StandardCells = [];

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

function paragraphText(p) {
  if (typeof p?.plainText === 'string') return p.plainText;
  if (Array.isArray(p?.tokens)) {
    return p.tokens
      .map((t) => (t && typeof t.value === 'string' ? t.value : ''))
      .join('');
  }
  return '';
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
      if (sLen > 0 && sLen < 3) {
        sub3StandardCells.push({
          fixture: fixtureId,
          period: periodKey,
          category: catKey,
          paragraphCount: sLen,
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

      // Doubled 결이 in brief.headline (P18-A4 metric).
      const headline = typeof cell.brief?.headline === 'string'
        ? cell.brief.headline
        : '';
      const headlineGyeoli = countMatches(headline, /결이/g);
      if (headlineGyeoli >= 2) {
        doubledGyeoliCells.push({
          fixture: fixtureId,
          period: periodKey,
          category: catKey,
          surface: 'brief.headline',
          gyeoliCount: headlineGyeoli,
          text: headline,
        });
      }

      function checkParagraphCluster(paragraphs, tier) {
        if (!Array.isArray(paragraphs)) return;
        for (const p of paragraphs) {
          const ptext = paragraphText(p);
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
          const gyeoliCnt = countMatches(ptext, /결이/g);
          if (gyeoliCnt >= 2) {
            doubledGyeoliCells.push({
              fixture: fixtureId,
              period: periodKey,
              category: catKey,
              surface: `${tier}.paragraph`,
              gyeoliCount: gyeoliCnt,
              text: ptext.slice(0, 160),
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
// Per-text dormancy (counting artifact when post-processor mutates).
const dormantHookTextCount = Array.from(authoredHookStrings).filter(
  (h) => !hookStrings.has(h),
).length;

// 연결 + particles. Two scan layers:
//
// 1) PLAN_PHASE19_COMPOUND_HARDENING.md §P19-A1 conservative 8-particle
//    scan (을/이/로/의/에/과/도/만). Wider net for owned-scope cleanup.
// 2) GYEOL_SUBS-vulnerable subset (post-processor leak class). Per
//    `src/report/tiered/template-engine.ts` line 763-777 the GYEOL_SUBS
//    table covers 13 particles: 이|을|로|은|의|도|만|처럼|마다|이에요|
//    입니다|이라|이고. ANY of those particles directly suffixed to a
//    `[가-힣]결` compound triggers the post-processor mangling (`결X →
//    흐름X / 리듬X / 자리X / 호흡X / 걸음X`). Particles `과` and `에`
//    are NOT in GYEOL_SUBS, so `연결과 / 연결에` survive intact and are
//    grammatical Korean ("and connection / at connection"). They appear
//    in the conservative scan as latent risk only if the post-processor
//    table ever expands.
const YEONGYEOL_RE = /연결[을이로의에과도만]/g;
const YEONGYEOL_VULN_RE =
  /연결(?:이에요|입니다|이라|이고|이|을|로|은|의|도|만|처럼|마다)/g;

// P20-A5 — Verb-form 연결 scan (informational-only). NOT vulnerable to
// GYEOL_SUBS (no particle directly suffixed to 결, so post-processor
// passes them through unchanged). Tracked because P19-A5 §Recommendation
// #7 noted vocabulary-consistency rephrase opportunity (이어지는 /
// 이어진다 / 이어져 / 이어짐 to match noun-form `연결고리` rephrase).
//
// Forms covered:
//   연결돼 / 연결되 / 연결된다 / 연결되는 / 연결되며 / 연결되어 /
//   연결됨 / 연결될 / 연결되었 / 연결해 / 연결한 / 연결할 / 연결하는 /
//   연결하며 / 연결하면
//
// Anchored on `연결` followed by Hangul stems that begin a verb form
// (돼/되/된/될/됐/됨/해/한/할/했/함). `연결되어`, `연결된다` etc. all
// share the `연결되` prefix. Exclude particle forms (을/이/로/의/...)
// already covered by YEONGYEOL_RE / YEONGYEOL_VULN_RE.
const YEONGYEOL_VERB_RE = /연결(?:돼|되|된|될|됐|됨|해|한|할|했|함)/g;

function scanYeongyeolDir(dir) {
  if (!fs.existsSync(dir)) {
    return {
      total: 0,
      perFile: {},
      vulnTotal: 0,
      vulnPerFile: {},
      verbTotal: 0,
      verbPerFile: {},
    };
  }
  const out = {
    total: 0,
    perFile: {},
    vulnTotal: 0,
    vulnPerFile: {},
    verbTotal: 0,
    verbPerFile: {},
  };
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  for (const f of files) {
    const txt = fs.readFileSync(path.join(dir, f), 'utf-8');
    YEONGYEOL_RE.lastIndex = 0;
    const matches = txt.match(YEONGYEOL_RE) ?? [];
    if (matches.length > 0) {
      out.total += matches.length;
      out.perFile[f] = matches.length;
    }
    YEONGYEOL_VULN_RE.lastIndex = 0;
    const vulnMatches = txt.match(YEONGYEOL_VULN_RE) ?? [];
    if (vulnMatches.length > 0) {
      out.vulnTotal += vulnMatches.length;
      out.vulnPerFile[f] = vulnMatches.length;
    }
    YEONGYEOL_VERB_RE.lastIndex = 0;
    const verbMatches = txt.match(YEONGYEOL_VERB_RE) ?? [];
    if (verbMatches.length > 0) {
      out.verbTotal += verbMatches.length;
      out.verbPerFile[f] = verbMatches.length;
    }
  }
  return out;
}

const coverageYeongyeol = scanYeongyeolDir(COVERAGE_DIR);

// Recursive walk of `data/narrative/<cat>/**/*.fragments.json` (NOT
// _coverage / _metaphor / _glossary / _seed / _modifier* / _contract).
function scanYeongyeolNarrativeRecursive() {
  const out = {
    total: 0,
    perFile: {},
    vulnTotal: 0,
    vulnPerFile: {},
    verbTotal: 0,
    verbPerFile: {},
  };
  for (const cat of cats) {
    const catDir = path.join(NARRATIVE_DIR, cat);
    if (!fs.existsSync(catDir)) continue;
    const stack = [catDir];
    while (stack.length > 0) {
      const cur = stack.pop();
      const entries = fs.readdirSync(cur, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(cur, e.name);
        if (e.isDirectory()) {
          stack.push(full);
        } else if (e.isFile() && e.name.endsWith('.json')) {
          const txt = fs.readFileSync(full, 'utf-8');
          YEONGYEOL_RE.lastIndex = 0;
          const matches = txt.match(YEONGYEOL_RE) ?? [];
          if (matches.length > 0) {
            const rel = path.relative(NARRATIVE_DIR, full).replaceAll(
              path.sep,
              '/',
            );
            out.total += matches.length;
            out.perFile[rel] = matches.length;
          }
          YEONGYEOL_VULN_RE.lastIndex = 0;
          const vulnMatches = txt.match(YEONGYEOL_VULN_RE) ?? [];
          if (vulnMatches.length > 0) {
            const rel = path.relative(NARRATIVE_DIR, full).replaceAll(
              path.sep,
              '/',
            );
            out.vulnTotal += vulnMatches.length;
            out.vulnPerFile[rel] = vulnMatches.length;
          }
          YEONGYEOL_VERB_RE.lastIndex = 0;
          const verbMatches = txt.match(YEONGYEOL_VERB_RE) ?? [];
          if (verbMatches.length > 0) {
            const rel = path.relative(NARRATIVE_DIR, full).replaceAll(
              path.sep,
              '/',
            );
            out.verbTotal += verbMatches.length;
            out.verbPerFile[rel] = verbMatches.length;
          }
        }
      }
    }
  }
  return out;
}

const narrativeYeongyeol = scanYeongyeolNarrativeRecursive();
const metaphorYeongyeol = scanYeongyeolDir(METAPHOR_DIR);
const glossaryYeongyeol = scanYeongyeolDir(GLOSSARY_DIR);

const out = {
  phase: 'P20-A5',
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
    standardSub3Cells: sub3StandardCells.length,
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
    dormantHookStringsByText: dormantHookTextCount,
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
  doubledGyeoli: {
    totalCells: doubledGyeoliCells.length,
    sampleCells: doubledGyeoliCells.slice(0, 20),
  },
  yeongyeolCompound: {
    coverage: coverageYeongyeol,
    narrativeNonCoverage: narrativeYeongyeol,
    metaphor: metaphorYeongyeol,
    glossary: glossaryYeongyeol,
    grandTotal:
      coverageYeongyeol.total
      + narrativeYeongyeol.total
      + metaphorYeongyeol.total
      + glossaryYeongyeol.total,
    grandTotalVulnerable:
      coverageYeongyeol.vulnTotal
      + narrativeYeongyeol.vulnTotal
      + metaphorYeongyeol.vulnTotal
      + glossaryYeongyeol.vulnTotal,
    notes:
      'grandTotal = conservative 8-particle scan (을/이/로/의/에/과/도/만);'
      + ' grandTotalVulnerable = GYEOL_SUBS-vulnerable subset (이/을/로/은/의/도/만/처럼/마다/이에요/입니다/이라/이고).'
      + ' Particles 과/에 are grammatical Korean and NOT in GYEOL_SUBS.',
  },
  yeongyeolVerb: {
    coverage: {
      verbTotal: coverageYeongyeol.verbTotal,
      verbPerFile: coverageYeongyeol.verbPerFile,
    },
    narrativeNonCoverage: {
      verbTotal: narrativeYeongyeol.verbTotal,
      verbPerFile: narrativeYeongyeol.verbPerFile,
    },
    metaphor: {
      verbTotal: metaphorYeongyeol.verbTotal,
      verbPerFile: metaphorYeongyeol.verbPerFile,
    },
    glossary: {
      verbTotal: glossaryYeongyeol.verbTotal,
      verbPerFile: glossaryYeongyeol.verbPerFile,
    },
    grandTotalVerb:
      coverageYeongyeol.verbTotal
      + narrativeYeongyeol.verbTotal
      + metaphorYeongyeol.verbTotal
      + glossaryYeongyeol.verbTotal,
    notes:
      'Verb-form 연결 (연결돼/연결되/연결된/연결될/연결됐/연결됨/연결해/연결한/연결할/연결했/연결함).'
      + ' INFORMATIONAL ONLY — verb forms are NOT vulnerable to GYEOL_SUBS'
      + ' (no particle directly suffixed to 결, post-processor passes through).'
      + ' Tracked because P19-A5 §Recommendation #7 noted vocabulary-consistency'
      + ' rephrase opportunity (이어지는 / 이어진다 / 이어져 / 이어짐).',
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
