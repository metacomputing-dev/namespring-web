#!/usr/bin/env node
/**
 * tools/check_flow_cluster.mjs
 *
 * Phase 29 Agent A2 — `흐름이` cluster CI gate (the 19th gate).
 *
 * Failure mode this prevents: a fragment-pool change in
 * `data/narrative/<cat>/<period>/<tier>.fragments.json` (or upstream
 * post-processor change) reintroduces 3+ `흐름이` occurrences inside a
 * single rendered paragraph, undoing the diversification lock that
 * P14-A5 / P15-A4 negotiated and that P28-A6 caught regressing
 * silently (flowCluster 0 → 15 across two P28-A2 expert 5p
 * paragraphs because there was no data-side enforcement).
 *
 * History / lineage:
 *   - P14-A5 §B3 first identified the cluster pattern: a single
 *     `흐름이` repeats 3+ times in one paragraph, which reads as a
 *     mechanical template signature.
 *   - P15-A4 measured the baseline (51 cells across 7 fragment IDs
 *     using `artifacts/phase15-agent-a4/measure_p15_a4.mjs`) and
 *     drove the count to 0 by reworking 5 source fragments. See
 *     `artifacts/phase15-agent-a4/baseline-cluster.json` and
 *     `after-all-fixes.json`.
 *   - P28-A2 expert 4p → 5p extension on 10 fired cells regressed
 *     the count to 15 (`artifacts/phase28-agent-a6/`). The lock
 *     was data-only narrative discipline; with no CI gate the
 *     regression slipped through.
 *   - P29-A1 reverts the regression. P29-A2 (this gate) makes the
 *     lock structural so the next regression fails fast.
 *
 * Methodology (verbatim port of `measure_p15_a4.mjs:30-115`):
 *
 *   1. Walk `artifacts/sample-outputs-2026-05-05-phase3/*-tiered.json`
 *      (the same read-only oracle that `ci:hook-coverage`,
 *      `ci:hook-concentration`, `ci:samples-stale`, and
 *      `ci:standard-paragraph-floor` consume). Skip any file
 *      lacking `tieredMatrix.periods` — naturally excludes
 *      `diff-legacy-vs-tiered.json`.
 *   2. For each fixture, walk every cell at
 *      `tieredMatrix.periods[periodKey].overall` and
 *      `tieredMatrix.periods[periodKey].byCategory[catKey]`.
 *   3. For each cell × tier ∈ { brief, standard, expert }, collect
 *      `headline` and `paragraphs[].plainText` (or `text` legacy
 *      shape). Any paragraph with `countOccurrences(p, '흐름이') >= 3`
 *      is a cluster paragraph. The cell counts as one violation
 *      regardless of how many of its paragraphs cluster (matches
 *      P15-A4 `cellsWithClusterCount` denominator and P28-A6's
 *      reported "flowCluster 0 → 15" cell count).
 *   4. Gate fails if `violationCount > --max-violations` (default
 *      0 — P15-A4 lock target).
 *
 * Output:
 *   - default: human-readable summary on stdout, exit 1 on
 *     violations exceeding `--max-violations`.
 *   - --json: structured JSON report on stdout.
 *
 * Flags:
 *   --json                       structured JSON report
 *   --max-violations=N           threshold above which the gate
 *                                fails (default 0 — P15-A4 lock)
 *   --threshold=N                `흐름이` occurrences per paragraph
 *                                that constitute a cluster (default
 *                                3 — P14-A5 / P15-A4 definition)
 *   --needle=<str>               cluster needle (default `흐름이`)
 *   --root=<path>                override spring-ts root
 *   --samples-dir=<path>         override samples directory
 *                                (absolute or relative to --root)
 *   --max-samples=N              cap printed/JSON violation samples
 *                                (default 20)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SAMPLES_REL = 'artifacts/sample-outputs-2026-05-05-phase3';
const DEFAULT_NEEDLE = '흐름이';
const DEFAULT_THRESHOLD = 3;

function parseArgs(argv) {
  const args = {
    json: false,
    maxViolations: 0,
    threshold: DEFAULT_THRESHOLD,
    needle: DEFAULT_NEEDLE,
    root: DEFAULT_ROOT,
    samplesDir: null,
    maxSamples: 20,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--max-violations=')) {
      const v = Number(arg.slice('--max-violations='.length));
      if (Number.isInteger(v) && v >= 0) args.maxViolations = v;
    } else if (arg.startsWith('--threshold=')) {
      const v = Number(arg.slice('--threshold='.length));
      if (Number.isInteger(v) && v >= 1) args.threshold = v;
    } else if (arg.startsWith('--needle=')) {
      const v = arg.slice('--needle='.length);
      if (v.length > 0) args.needle = v;
    } else if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
    } else if (arg.startsWith('--samples-dir=')) {
      args.samplesDir = arg.slice('--samples-dir='.length);
    } else if (arg.startsWith('--max-samples=')) {
      const v = Number(arg.slice('--max-samples='.length));
      if (Number.isInteger(v) && v >= 0) args.maxSamples = v;
    }
  }
  return args;
}

function resolveSamplesDir(root, samplesDir) {
  if (!samplesDir) return path.join(root, DEFAULT_SAMPLES_REL);
  return path.isAbsolute(samplesDir)
    ? samplesDir
    : path.resolve(root, samplesDir);
}

function listSampleFiles(samplesDir) {
  if (!fs.existsSync(samplesDir)) return [];
  return fs
    .readdirSync(samplesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /-tiered\.json$/.test(entry.name))
    .map((entry) => path.join(samplesDir, entry.name))
    .sort();
}

// Verbatim port of measure_p15_a4.mjs:30-39.
function countOccurrences(text, needle) {
  if (typeof text !== 'string' || text.length === 0) return 0;
  let count = 0;
  let idx = text.indexOf(needle);
  while (idx >= 0) {
    count += 1;
    idx = text.indexOf(needle, idx + needle.length);
  }
  return count;
}

// Verbatim port of measure_p15_a4.mjs:41-52. Surfaces both headline
// and paragraphs[].plainText (modern shape) and paragraphs[].text
// (legacy fallback) so a future shape rename does not silently mask
// the gate.
function paragraphsFromCellTier(tier) {
  if (!tier) return [];
  const out = [];
  if (typeof tier.headline === 'string') out.push(tier.headline);
  if (Array.isArray(tier.paragraphs)) {
    for (const p of tier.paragraphs) {
      if (typeof p?.plainText === 'string') out.push(p.plainText);
      else if (typeof p?.text === 'string') out.push(p.text);
    }
  }
  return out;
}

function harvestCluster({ samplesDir, needle, threshold }) {
  const sampleFiles = listSampleFiles(samplesDir);
  const cellsWithCluster = []; // ordered, first-paragraph-per-cell only
  const fragmentSourceCounts = new Map();
  let fixturesWithMatrix = 0;
  let totalCells = 0;
  let paragraphsWithCluster = 0;

  for (const file of sampleFiles) {
    let json;
    try {
      json = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      continue;
    }
    const tm = json?.payload?.tieredMatrix ?? json?.tieredMatrix;
    if (!tm?.periods) continue;
    fixturesWithMatrix += 1;
    const fixtureId = path.basename(file).replace(/\.json$/, '');
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
        const candidates = [
          ['brief', paragraphsFromCellTier(cell.brief)],
          ['standard', paragraphsFromCellTier(cell.standard)],
          ['expert', paragraphsFromCellTier(cell.expert)],
        ];
        let hitOnceForCell = false;
        for (const [tierKey, paras] of candidates) {
          for (const p of paras) {
            const c = countOccurrences(p, needle);
            if (c >= threshold) {
              paragraphsWithCluster += 1;
              if (!hitOnceForCell) {
                const fragId =
                  cell.selectedFragments?.[tierKey]?.fragmentId ?? null;
                cellsWithCluster.push({
                  fixture: fixtureId,
                  period: periodKey,
                  category: catKey,
                  tier: tierKey,
                  count: c,
                  fragmentId: fragId,
                  excerpt: p.slice(0, 140),
                });
                if (fragId) {
                  fragmentSourceCounts.set(
                    fragId,
                    (fragmentSourceCounts.get(fragId) ?? 0) + 1,
                  );
                }
                hitOnceForCell = true;
              }
            }
          }
        }
      }
    }
  }
  return {
    sampleFilesScanned: sampleFiles.length,
    fixturesWithMatrix,
    totalCells,
    paragraphsWithCluster,
    cellsWithCluster,
    fragmentSourceCounts,
  };
}

function buildReport({ root, samplesDir, needle, threshold, maxSamples }) {
  const resolvedSamples = resolveSamplesDir(root, samplesDir);
  const harvest = harvestCluster({
    samplesDir: resolvedSamples,
    needle,
    threshold,
  });
  // Sort violations by count desc then fixture/period/category for stability.
  const violations = harvest.cellsWithCluster
    .slice()
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.fixture.localeCompare(b.fixture) ||
        a.period.localeCompare(b.period) ||
        a.category.localeCompare(b.category),
    );
  return {
    policy: 'spring-ts.flow-cluster.v1',
    samplesDir: path.relative(root, resolvedSamples).replaceAll(path.sep, '/'),
    needle,
    threshold,
    sampleFilesScanned: harvest.sampleFilesScanned,
    fixturesWithMatrix: harvest.fixturesWithMatrix,
    totalCells: harvest.totalCells,
    paragraphsWithCluster: harvest.paragraphsWithCluster,
    fragmentSourceCounts: Object.fromEntries(
      Array.from(harvest.fragmentSourceCounts.entries()).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      ),
    ),
    violationCount: violations.length,
    violations: violations.slice(0, Math.max(0, maxSamples)),
  };
}

function renderHuman(report, maxViolations) {
  const lines = [];
  lines.push(
    `flow-cluster: samples=${report.sampleFilesScanned}, fixtures=${report.fixturesWithMatrix}, totalCells=${report.totalCells}, samplesDir=${report.samplesDir}`,
  );
  lines.push(
    `  policy: needle="${report.needle}" threshold=${report.threshold} --max-violations=${maxViolations}`,
  );
  lines.push(
    `  paragraphsWithCluster=${report.paragraphsWithCluster}  violationCount=${report.violationCount}`,
  );
  const fragKeys = Object.keys(report.fragmentSourceCounts);
  if (fragKeys.length > 0) {
    lines.push('  fragmentSourceCounts (fragmentId: cellCount):');
    for (const k of fragKeys) {
      lines.push(`    ${report.fragmentSourceCounts[k]}  ${k}`);
    }
  }
  if (report.violationCount > 0) {
    lines.push('  Violations (cells with paragraphs containing 흐름이 >= threshold):');
    for (const v of report.violations) {
      lines.push(
        `    ${v.count}  ${v.fixture}  ${v.period}.${v.category}.${v.tier}  [${v.fragmentId ?? '?'}]`,
      );
      lines.push(`      ${v.excerpt}`);
    }
  }
  return lines.join('\n');
}

const args = parseArgs(process.argv);
const report = buildReport({
  root: args.root,
  samplesDir: args.samplesDir,
  needle: args.needle,
  threshold: args.threshold,
  maxSamples: args.maxSamples,
});

if (args.json) console.log(JSON.stringify(report, null, 2));
else console.log(renderHuman(report, args.maxViolations));

if (report.violationCount > args.maxViolations) {
  console.error(
    `flow-cluster: ${report.violationCount} cell(s) with paragraphs containing "${args.needle}" >= ${args.threshold} exceed --max-violations=${args.maxViolations}`,
  );
  process.exit(1);
}

export { buildReport, renderHuman, countOccurrences, paragraphsFromCellTier };
