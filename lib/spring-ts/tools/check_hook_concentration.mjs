#!/usr/bin/env node
/**
 * tools/check_hook_concentration.mjs
 *
 * Phase 21 Agent A3 -- brief.hook concentration CI gate.
 *
 * Failure mode this prevents: a future regression -- typically a
 * gating-rule broadening in `data/narrative/<cat>/<period>/brief.fragments.json`
 * that lets the same fragmentId fire across too many cells of a single
 * fixture, or a post-processor / fragment-selector edit that collapses
 * what used to be diverse cells into a single hook-saturated fixture --
 * silently piles too many distinct brief.hook strings onto one fixture.
 * Over-concentration in any one fixture is a smell that the gating
 * predicates are merging cohorts that authoring intent kept separate.
 *
 * History:
 *   - P19-A4 added `ci:hook-coverage` (dormant-fragment detection).
 *   - P20-A5 §D2 audited per-fixture hook concentration (max=15,
 *     mode=13 -- the audit prose said "median 13" but the recomputed
 *     50th-percentile over the 32-value histogram is 10; the value
 *     reported as "median" was actually the mode).
 *   - P20-A5 §Recommendation #5 flagged "above 20" as the
 *     concentration threshold for over-merge detection. This gate
 *     instantiates that recommendation as a CI ratchet.
 *
 * Methodology:
 *
 *   1. Walk `artifacts/sample-outputs-2026-05-05-phase3/*-tiered.json`
 *      (the same read-only oracle that `ci:hook-coverage` and
 *      `ci:samples-stale` consume). Skip any file lacking a
 *      `tieredMatrix.periods` shape -- this naturally excludes
 *      `diff-legacy-vs-tiered.json` without special-casing.
 *   2. For each fixture, visit each `tieredMatrix.periods[periodKey].overall`
 *      and each `tieredMatrix.periods[periodKey].byCategory[catKey]` cell.
 *      Collect every non-empty `cell.brief.hook` string into a per-fixture
 *      Set; the Set's size is the "distinct hook count" for that fixture.
 *   3. Compute distribution statistics (min / median / max / mode)
 *      across all fixtures with a tieredMatrix.
 *   4. Gate fails if `maxDistinctHooks > --max-hooks` (default 20,
 *      P20-A5 measured max=15 + safety margin of 5).
 *
 * The gate is one-sided: a fixture with 0 hooks is NOT a violation
 * (the child-tier fixture intentionally has 0; that's coverage, not
 * concentration, and `ci:hook-coverage` already speaks to coverage).
 *
 * Output:
 *   - default: human-readable summary on stdout, exit 1 on violations.
 *   - --json: structured JSON report on stdout.
 *
 * Flags:
 *   --json                       structured JSON report
 *   --max-hooks=N                threshold above which the gate fails
 *                                (default 20 -- P20-A5 max=15 + margin)
 *   --root=<path>                override spring-ts root
 *   --samples-dir=<path>         override samples directory (absolute
 *                                or relative to --root)
 *   --max-samples=N              cap printed/JSON top-fixture entries
 *                                (default 10)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SAMPLES_REL = 'artifacts/sample-outputs-2026-05-05-phase3';

function parseArgs(argv) {
  const args = {
    json: false,
    maxHooks: 20,
    root: DEFAULT_ROOT,
    samplesDir: null,
    maxSamples: 10,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--max-hooks=')) {
      const v = Number(arg.slice('--max-hooks='.length));
      if (Number.isInteger(v) && v >= 0) args.maxHooks = v;
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
  return path.isAbsolute(samplesDir) ? samplesDir : path.resolve(root, samplesDir);
}

function listSampleFiles(samplesDir) {
  if (!fs.existsSync(samplesDir)) return [];
  return fs.readdirSync(samplesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /-tiered\.json$/.test(entry.name))
    .map((entry) => path.join(samplesDir, entry.name))
    .sort();
}

function harvestPerFixtureHookCounts(samplesDir) {
  const sampleFiles = listSampleFiles(samplesDir);
  const perFixture = []; // { file, distinctHooks, cellsScanned }
  for (const file of sampleFiles) {
    let json;
    try {
      json = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      continue;
    }
    const tm = json?.payload?.tieredMatrix ?? json?.tieredMatrix;
    if (!tm?.periods) continue;
    const distinctHooks = new Set();
    let cellsScanned = 0;
    for (const periodKey of Object.keys(tm.periods)) {
      const period = tm.periods[periodKey];
      if (!period) continue;
      const cells = [
        ['overall', period.overall],
        ...Object.entries(period.byCategory ?? {}),
      ];
      for (const [, cell] of cells) {
        if (!cell) continue;
        cellsScanned += 1;
        const briefHook = cell.brief?.hook;
        if (typeof briefHook === 'string' && briefHook.length > 0) {
          distinctHooks.add(briefHook);
        }
      }
    }
    perFixture.push({
      file: path.basename(file),
      distinctHooks: distinctHooks.size,
      cellsScanned,
    });
  }
  return { sampleFilesScanned: sampleFiles.length, perFixture };
}

function computeStats(values) {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, median: 0, mode: 0, mean: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  // Mode: highest-frequency value (lowest value wins ties for stability).
  const freq = new Map();
  for (const v of sorted) freq.set(v, (freq.get(v) ?? 0) + 1);
  let mode = sorted[0];
  let modeFreq = 0;
  for (const [v, f] of freq.entries()) {
    if (f > modeFreq || (f === modeFreq && v < mode)) {
      mode = v;
      modeFreq = f;
    }
  }
  return { count: n, min, max, median, mode, mean: Number(mean.toFixed(2)) };
}

function buildReport({ root, samplesDir, maxSamples }) {
  const resolvedSamples = resolveSamplesDir(root, samplesDir);
  const { sampleFilesScanned, perFixture } = harvestPerFixtureHookCounts(resolvedSamples);

  const distinctHookCounts = perFixture.map((f) => f.distinctHooks);
  const stats = computeStats(distinctHookCounts);

  // Histogram for at-a-glance diagnostic.
  const histogram = {};
  for (const v of distinctHookCounts) {
    histogram[String(v)] = (histogram[String(v)] ?? 0) + 1;
  }

  // Top concentration -- fixtures most likely to be flagged on regression.
  const topFixtures = [...perFixture]
    .sort((a, b) => b.distinctHooks - a.distinctHooks || a.file.localeCompare(b.file))
    .slice(0, Math.max(0, maxSamples));

  // Violations: fixtures whose distinctHooks > maxHooks (filled in below).
  return {
    policy: 'spring-ts.brief-hook-concentration.v1',
    samplesDir: path.relative(root, resolvedSamples).replaceAll(path.sep, '/'),
    sampleFilesScanned,
    fixturesWithMatrix: perFixture.length,
    perFixtureDistinctHooks: stats,
    histogram,
    topFixtures,
  };
}

function renderHuman(report, maxHooks, violatingFixtures) {
  const lines = [];
  const s = report.perFixtureDistinctHooks;
  lines.push(
    `brief.hook concentration: samples=${report.sampleFilesScanned}, fixtures=${report.fixturesWithMatrix}, samplesDir=${report.samplesDir}`,
  );
  lines.push(
    `  distinct hooks per fixture: min=${s.min} median=${s.median} max=${s.max} mode=${s.mode} mean=${s.mean} (n=${s.count})`,
  );
  lines.push(`  threshold: --max-hooks=${maxHooks}`);
  const histKeys = Object.keys(report.histogram).map(Number).sort((a, b) => a - b);
  lines.push('  histogram (distinctHooks: fixtureCount):');
  for (const k of histKeys) {
    lines.push(`    ${k}: ${report.histogram[String(k)]}`);
  }
  lines.push('  top fixtures (highest concentration):');
  for (const tf of report.topFixtures) {
    lines.push(`    ${tf.distinctHooks}  ${tf.file}  (cellsScanned=${tf.cellsScanned})`);
  }
  if (violatingFixtures.length > 0) {
    lines.push('', `Violations (distinctHooks > ${maxHooks}):`);
    for (const v of violatingFixtures) {
      lines.push(`  ${v.distinctHooks}  ${v.file}`);
    }
  }
  return lines.join('\n');
}

const args = parseArgs(process.argv);
const report = buildReport({
  root: args.root,
  samplesDir: args.samplesDir,
  maxSamples: args.maxSamples,
});

const violatingFixtures = report.topFixtures.filter((f) => f.distinctHooks > args.maxHooks);
report.maxHooks = args.maxHooks;
report.violationCount = violatingFixtures.length;
report.violatingFixtures = violatingFixtures;

if (args.json) console.log(JSON.stringify(report, null, 2));
else console.log(renderHuman(report, args.maxHooks, violatingFixtures));

if (report.violationCount > 0) {
  console.error(
    `brief.hook concentration: ${report.violationCount} fixture(s) exceed --max-hooks=${args.maxHooks} (observed max=${report.perFixtureDistinctHooks.max})`,
  );
  process.exit(1);
}

export { buildReport, renderHuman, computeStats };
