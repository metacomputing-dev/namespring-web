#!/usr/bin/env node
/**
 * tools/check_standard_paragraph_floor.mjs
 *
 * Phase 24 Agent A1 -- standard.paragraphs floor CI gate.
 *
 * Failure mode this prevents: a future regression -- typically a
 * fragment-pool shrink in `data/narrative/<cat>/<period>/<tier>.fragments.json`,
 * or a selector / build-tiered-matrix change that drops paragraphs below the
 * 3-paragraph floor for any standard-tier cell -- silently re-opens the
 * sub-3 standard hole that P23-A1+A2+A3 closed.
 *
 * History:
 *   - P18-A3 measured baseline: 107 sub-3 standard cells across 1705 total.
 *   - P22-A6 carry-in: 21 sub-3 cells remained after Phase 22.
 *   - P23-A1 (overall × {today/thisWeek/thisMonth/thisYear} teen + health_stress
 *     × today child), P23-A2 (10 romance × minor-band), P23-A3 (3
 *     study_document × minor-band) closed the residue.
 *   - P23-A5 measured post-fix: sub-3 standard cells = 0, distribution
 *     {3: 1385, 4: 83, 5: 237} across 1705 cells.
 *
 * P24-A1 instantiates that hard-won floor as a CI ratchet so any future
 * regression that lets a standard cell drop below 3 paragraphs fails fast.
 *
 * Methodology:
 *
 *   1. Walk `artifacts/sample-outputs-2026-05-05-phase3/*-tiered.json`
 *      (the same read-only oracle that `ci:hook-coverage`,
 *      `ci:hook-concentration`, and `ci:samples-stale` consume). Skip any
 *      file lacking a `tieredMatrix.periods` shape -- this naturally
 *      excludes `diff-legacy-vs-tiered.json` without special-casing.
 *   2. For each fixture, visit each `tieredMatrix.periods[periodKey].overall`
 *      and each `tieredMatrix.periods[periodKey].byCategory[catKey]` cell.
 *      Compute `standardParagraphCount = cell.standard?.paragraphs?.length ?? 0`.
 *   3. Strict policy: `standardParagraphCount < --min-paragraphs` (default 3)
 *      is a violation. This includes length=0 cells (missing-standard-tier
 *      IS a floor breach). The current sample corpus has no length=0
 *      standard cells, so the strict rule and the historical
 *      `len > 0 && len < 3` rule agree on today's data; the strict rule
 *      additionally locks the floor against regressions that delete the
 *      tier wholesale.
 *   4. Build a `paragraphCountHistogram` over all scanned cells.
 *   5. Track `shortestCells` (lexicographic by file/period/category) for
 *      the smallest paragraph count observed.
 *   6. Gate fails if `violationCount > --max-violations` (default 0,
 *      P23-A5 closed the hole; Phase 24 locks zero).
 *
 * Output:
 *   - default: human-readable summary on stdout, exit 1 on violations.
 *   - --json: structured JSON report on stdout.
 *
 * Flags:
 *   --json                       structured JSON report
 *   --min-paragraphs=N           paragraph floor (default 3 -- P23 lock target)
 *   --max-violations=N           threshold above which the gate fails
 *                                (default 0 -- any violation fails)
 *   --root=<path>                override spring-ts root
 *   --samples-dir=<path>         override samples directory (absolute
 *                                or relative to --root)
 *   --max-samples=N              cap printed/JSON violation samples
 *                                (default 20)
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
    minParagraphs: 3,
    maxViolations: 0,
    root: DEFAULT_ROOT,
    samplesDir: null,
    maxSamples: 20,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--min-paragraphs=')) {
      const v = Number(arg.slice('--min-paragraphs='.length));
      if (Number.isInteger(v) && v >= 0) args.minParagraphs = v;
    } else if (arg.startsWith('--max-violations=')) {
      const v = Number(arg.slice('--max-violations='.length));
      if (Number.isInteger(v) && v >= 0) args.maxViolations = v;
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

function harvestStandardParagraphCounts(samplesDir) {
  const sampleFiles = listSampleFiles(samplesDir);
  const cellRecords = []; // { fixture, period, category, count }
  let fixturesWithMatrix = 0;
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
        const count = Array.isArray(cell.standard?.paragraphs)
          ? cell.standard.paragraphs.length
          : 0;
        cellRecords.push({
          fixture: fixtureId,
          period: periodKey,
          category: catKey,
          count,
        });
      }
    }
  }
  return {
    sampleFilesScanned: sampleFiles.length,
    fixturesWithMatrix,
    cellRecords,
  };
}

function computeStats(values) {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, median: 0, mode: 0, mean: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
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

function buildReport({ root, samplesDir, minParagraphs, maxSamples }) {
  const resolvedSamples = resolveSamplesDir(root, samplesDir);
  const { sampleFilesScanned, fixturesWithMatrix, cellRecords } =
    harvestStandardParagraphCounts(resolvedSamples);

  const counts = cellRecords.map((r) => r.count);
  const stats = computeStats(counts);

  const histogram = {};
  for (const v of counts) {
    histogram[String(v)] = (histogram[String(v)] ?? 0) + 1;
  }

  const violations = cellRecords.filter((r) => r.count < minParagraphs);
  // Sort violations: smallest count first, then lexicographic for stability.
  violations.sort(
    (a, b) =>
      a.count - b.count ||
      a.fixture.localeCompare(b.fixture) ||
      a.period.localeCompare(b.period) ||
      a.category.localeCompare(b.category),
  );

  // Shortest cells (count == min observed). Useful even when 0 violations:
  // it tells reviewers how much margin remains above the floor.
  const minObserved = stats.min;
  const shortestCells = cellRecords
    .filter((r) => r.count === minObserved)
    .sort(
      (a, b) =>
        a.fixture.localeCompare(b.fixture) ||
        a.period.localeCompare(b.period) ||
        a.category.localeCompare(b.category),
    )
    .slice(0, Math.max(0, maxSamples));

  return {
    policy: 'spring-ts.standard-paragraph-floor.v1',
    samplesDir: path.relative(root, resolvedSamples).replaceAll(path.sep, '/'),
    sampleFilesScanned,
    fixturesWithMatrix,
    totalCells: cellRecords.length,
    minParagraphs,
    paragraphCountStats: stats,
    paragraphCountHistogram: histogram,
    shortestCells,
    violationCount: violations.length,
    violations: violations.slice(0, Math.max(0, maxSamples)),
  };
}

function renderHuman(report, maxViolations) {
  const lines = [];
  const s = report.paragraphCountStats;
  lines.push(
    `standard.paragraphs floor: samples=${report.sampleFilesScanned}, fixtures=${report.fixturesWithMatrix}, totalCells=${report.totalCells}, samplesDir=${report.samplesDir}`,
  );
  lines.push(
    `  paragraph counts per cell: min=${s.min} median=${s.median} max=${s.max} mode=${s.mode} mean=${s.mean} (n=${s.count})`,
  );
  lines.push(
    `  policy: --min-paragraphs=${report.minParagraphs} --max-violations=${maxViolations}`,
  );
  const histKeys = Object.keys(report.paragraphCountHistogram)
    .map(Number)
    .sort((a, b) => a - b);
  lines.push('  histogram (paragraphCount: cellCount):');
  for (const k of histKeys) {
    lines.push(`    ${k}: ${report.paragraphCountHistogram[String(k)]}`);
  }
  lines.push(
    `  shortest cells (count=${s.min}, sample of ${report.shortestCells.length}):`,
  );
  for (const sc of report.shortestCells.slice(0, 5)) {
    lines.push(`    ${sc.count}  ${sc.fixture}  ${sc.period}.${sc.category}`);
  }
  lines.push(`  violationCount: ${report.violationCount}`);
  if (report.violationCount > 0) {
    lines.push('  Violations (count < min-paragraphs):');
    for (const v of report.violations) {
      lines.push(
        `    ${v.count}  ${v.fixture}  ${v.period}.${v.category}`,
      );
    }
  }
  return lines.join('\n');
}

const args = parseArgs(process.argv);
const report = buildReport({
  root: args.root,
  samplesDir: args.samplesDir,
  minParagraphs: args.minParagraphs,
  maxSamples: args.maxSamples,
});

if (args.json) console.log(JSON.stringify(report, null, 2));
else console.log(renderHuman(report, args.maxViolations));

if (report.violationCount > args.maxViolations) {
  console.error(
    `standard.paragraphs floor: ${report.violationCount} cell(s) below --min-paragraphs=${args.minParagraphs} exceed --max-violations=${args.maxViolations}`,
  );
  process.exit(1);
}

export { buildReport, renderHuman, computeStats };
