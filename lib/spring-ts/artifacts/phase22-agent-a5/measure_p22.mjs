/**
 * artifacts/phase22-agent-a5/measure_p22.mjs
 *
 * Phase 22 Agent A5 audit measurement.
 *
 * Successor to `measure_p21.mjs`. Same shape (paragraph histograms +
 * post-processor leak monitors + cluster monitors + per-fixture hook
 * distribution + 연결X conservative + vulnerable + verb-form + sub-3
 * standard cells + doubled `결이` + hook concentration), with three
 * P22 acceptance gate additions:
 *
 *   1. **Brief tier PLACEHOLDER count.** Detect cells where
 *      `cell.brief.headline === '준비 중인 흐름이에요.'` — the
 *      `PLACEHOLDER_BRIEF` value emitted by
 *      `src/report/tiered/build-tiered-matrix.ts:55`. P22-A1's lift of
 *      `MINOR_LIMITED_CATEGORIES` early-return must not regress brief
 *      tier; minor-gated brief fragments must cover any newly-reachable
 *      cell. Pre-fix expectation: 0 (no current PLACEHOLDER_BRIEF).
 *      Target: 0 (hold; P22-A1 ensures regression-free).
 *
 *   2. **`depth_inversion` hits passthrough.** Run
 *      `artifacts/phase12-agent-a5/audit-phase12.mjs` (P21-A2 refresh,
 *      Levenshtein similarity ≥ 0.75) and surface the
 *      `depth_inversion` array length. Pre-fix expectation: 18 hits
 *      (14 in `thisMonth/movement` shared template + 4 single-fixture
 *      overlaps). Target: 0 (or ≤ 2) after P22-A4 rephrase.
 *
 *   3. **Sub-3 standard cell pre-vs-target gap.** Already measured by
 *      `paragraphRollups.standardSub3Cells` (carried from P21-A5).
 *      Pre-fix expectation: 107. Target: 0 after P22-A1 (lift) +
 *      P22-A2 (14 fallback fragments) + P22-A3 (5 wealth gap fragments).
 *
 * Read-only on data + samples. Pure JSON parse + aggregate. Does NOT
 * regenerate samples and does NOT touch any forbidden surface.
 *
 * Usage: node artifacts/phase22-agent-a5/measure_p22.mjs [out.json]
 */
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
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

// Mirrors `src/report/tiered/build-tiered-matrix.ts:55`. P22-A5 gate
// surface — must remain 0 throughout Phase 22 even after P22-A1 src lift.
const PLACEHOLDER_BRIEF_HEADLINE = '준비 중인 흐름이에요.';

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
const doubledGyeoliCells = [];

// Sub-3 paragraph standard cells (P18-A3 baseline = 107; P22 target = 0).
const sub3StandardCells = [];

// P22-A5 — brief tier PLACEHOLDER cells.
const placeholderBriefCells = [];

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
      const briefHeadline =
        typeof cell.brief?.headline === 'string' ? cell.brief.headline : '';
      const briefHeadlineLen = [...briefHeadline].length;
      bump(briefHist, briefHeadlineLen > 0 ? 1 : 0);

      // P22-A5 — brief tier PLACEHOLDER detection.
      if (briefHeadline === PLACEHOLDER_BRIEF_HEADLINE) {
        placeholderBriefCells.push({
          fixture: fixtureId,
          period: periodKey,
          category: catKey,
        });
      }

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

function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return +(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)).toFixed(2);
}
const hookCountVector = [];
for (let i = 0; i < totalFixturesWithMatrix; i += 1) {
  hookCountVector.push(0);
}
{
  let idx = 0;
  for (const [, count] of perFixtureHookCount.entries()) {
    hookCountVector[idx] = count;
    idx += 1;
  }
}
const sortedHookCounts = [...hookCountVector].sort((a, b) => a - b);
const meanHook =
  sortedHookCounts.length > 0
    ? +(
        sortedHookCounts.reduce((s, v) => s + v, 0) / sortedHookCounts.length
      ).toFixed(2)
    : 0;
const concentrationStats = {
  min: sortedHookCounts.length > 0 ? sortedHookCounts[0] : 0,
  p10: quantile(sortedHookCounts, 0.1),
  median: quantile(sortedHookCounts, 0.5),
  mean: meanHook,
  p90: quantile(sortedHookCounts, 0.9),
  max: sortedHookCounts.length > 0 ? sortedHookCounts[sortedHookCounts.length - 1] : 0,
  fixtures: sortedHookCounts.length,
  notes:
    'Distribution of distinct hook count per fixture-with-matrix.'
    + ' Fixtures without ANY emitted brief.hook contribute 0 to the vector.'
    + ' P21-A3 ratchet `--max-hooks=20`.',
};

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
const dormantHookTextCount = Array.from(authoredHookStrings).filter(
  (h) => !hookStrings.has(h),
).length;

const YEONGYEOL_RE = /연결[을이로의에과도만]/g;
const YEONGYEOL_VULN_RE =
  /연결(?:이에요|입니다|이라|이고|이|을|로|은|의|도|만|처럼|마다)/g;
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

// P22-A5 — depth_inversion passthrough. Run audit-phase12.mjs and
// surface the depth_inversion array length. P21-A2 refresh wired the
// detector to Levenshtein similarity ≥ 0.75. Pre-fix expectation: 18.
// Target: 0 (or ≤ 2) after P22-A4 rephrase.
let depthInversionStatus;
const auditScript = path.join(
  SPRING_TS_ROOT,
  'artifacts/phase12-agent-a5/audit-phase12.mjs',
);
const phase12IssuesPath = path.join(
  SPRING_TS_ROOT,
  'artifacts/phase12-agent-a5/phase12-audit-issues.json',
);
try {
  // Ensure prose-corpus.json freshness via extract-prose.mjs first if needed.
  const corpusPath = path.join(
    SPRING_TS_ROOT,
    'artifacts/phase12-agent-a5/prose-corpus.json',
  );
  if (!fs.existsSync(corpusPath)) {
    const extractScript = path.join(
      SPRING_TS_ROOT,
      'artifacts/phase12-agent-a5/extract-prose.mjs',
    );
    execSync(`node "${extractScript}"`, {
      cwd: SPRING_TS_ROOT,
      stdio: 'pipe',
    });
  }
  execSync(`node "${auditScript}"`, {
    cwd: SPRING_TS_ROOT,
    stdio: 'pipe',
  });
  const issues = JSON.parse(fs.readFileSync(phase12IssuesPath, 'utf-8'));
  depthInversionStatus = {
    hits: Array.isArray(issues?.detectorHits?.depth_inversion)
      ? issues.detectorHits.depth_inversion.length
      : 0,
    sampleHits: (issues?.detectorHits?.depth_inversion ?? []).slice(0, 5),
    auditedSummary: issues?.summary ?? null,
    notes:
      'depth_inversion = P21-A2 refreshed Levenshtein ≥ 0.75 detector.'
      + ' Pre-fix baseline 18 hits (14 in thisMonth/movement shared'
      + ' template + 4 single-fixture overlaps). P22-A4 target = 0 (or ≤ 2).',
  };
} catch (err) {
  depthInversionStatus = {
    hits: null,
    error: String(err?.message ?? err),
    notes:
      'audit-phase12.mjs run failed; depth_inversion count unavailable.'
      + ' Inspect artifacts/phase12-agent-a5/ directly.',
  };
}

const out = {
  phase: 'P22-A5',
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
    sub3StandardCellsSample: sub3StandardCells.slice(0, 10),
  },
  briefTierPlaceholder: {
    cells: placeholderBriefCells.length,
    placeholderHeadline: PLACEHOLDER_BRIEF_HEADLINE,
    sampleCells: placeholderBriefCells.slice(0, 10),
    notes:
      'PLACEHOLDER_BRIEF emitted by build-tiered-matrix.ts:55.'
      + ' P22-A1 lift of MINOR_LIMITED_CATEGORIES early-return must not'
      + ' regress brief tier. Pre-fix baseline 0; target 0 (hold).',
  },
  depthInversion: depthInversionStatus,
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
    concentrationStats,
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
      + ' grandTotalVulnerable = GYEOL_SUBS-vulnerable subset.',
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
      + ' P21-A1 target 0; P22 hold.',
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
