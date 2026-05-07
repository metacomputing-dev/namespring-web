#!/usr/bin/env node
/**
 * tools/check_gyeol_cluster.mjs
 *
 * Phase 35 Agent A1 — `결` cluster CI gate (the 21st gate).
 *
 * Failure mode this prevents: a fragment-pool change in
 * `data/narrative/<cat>/<period>/<tier>.fragments.json` (or upstream
 * post-processor change) regresses the per-paragraph `결≥3` count
 * above the Phase 34 close-out value (10). The detector matches the
 * existing `gyeolCluster.totalCells` field emitted by
 * `artifacts/phase23-agent-a4/measure_p23.mjs:283-292` so this gate
 * ratchets the same surface that P32-A6 §15 / P33-A6 §1 / P34-A5
 * §"Phase 34+ recommendations" §6 have been tracking informally
 * across 4+ phases.
 *
 * History / lineage:
 *   - P21-A2 / P23-A4 (`measure_p23.mjs`) introduced the broad-`결`
 *     paragraph-cluster detector alongside the `흐름이` (flow) and
 *     `결이` (doubled-gyeoli) detectors. Same `paragraphText(p)`
 *     helper, same `countMatches(t, /결/g) >= 3` predicate, same
 *     per-paragraph push semantics (the variable is named
 *     `gyeolClusterCells` but each entry is a paragraph hit, not
 *     a cell — confirmed by `measure_p23.mjs:283-292`).
 *   - P21-A2 baseline at the time was higher; the count drifted to
 *     12 and then to 10 across the depth-lift phases (P22 → P34).
 *     The Phase 34 pre-merge baseline (`phase34-agent-a5/post-fix-
 *     snapshot-2026-05-08.json`) records `gyeolCluster.totalCells = 10`.
 *   - P29-A2 shipped `ci:flow-cluster` with the same paragraph-walk
 *     methodology and structure (`tools/check_flow_cluster.mjs`).
 *     This file is a per-paragraph variant.
 *   - P35-A1 (this gate) ratchets at the Phase 34 baseline (10) so
 *     the next regression fails fast. Phase 36+ may tighten as
 *     depth-lift sibling work absorbs more `결정`/`결과`/`결국`-style
 *     decision vocabulary into the corpus.
 *
 * Methodology (verbatim port of `measure_p23.mjs:269-308`):
 *
 *   1. Walk `artifacts/sample-outputs-2026-05-05-phase3/*-tiered.json`
 *      (the same read-only oracle that `ci:flow-cluster`,
 *      `ci:hook-coverage`, `ci:hook-concentration`, `ci:samples-stale`,
 *      and `ci:standard-paragraph-floor` consume). Skip any file
 *      lacking `tieredMatrix.periods` (naturally excludes
 *      `diff-legacy-vs-tiered.json`).
 *   2. For each fixture, walk every cell at
 *      `tieredMatrix.periods[periodKey].overall` and
 *      `tieredMatrix.periods[periodKey].byCategory[catKey]`.
 *   3. For each cell × tier ∈ { standard, expert }, walk
 *      `paragraphs[]` and call `paragraphText(p)` (modern
 *      `plainText` first, legacy `tokens[].value` join fallback).
 *      Any paragraph with `countMatches(text, /결/g) >= 3` is a
 *      violation. **Every cluster paragraph counts as one
 *      violation** (per-paragraph semantics — matches
 *      `measure_p23.mjs` `gyeolClusterCells.push` per cluster
 *      paragraph). This is the per-paragraph variant of the
 *      `ci:flow-cluster` per-cell denominator; we keep
 *      per-paragraph here to preserve the Phase 23-34
 *      `gyeolCluster.totalCells` baseline (10).
 *   4. Gate fails if `violationCount > --max-violations` (default
 *      10 — Phase 34 close-out value carry-in).
 *
 * Output:
 *   - default: human-readable summary on stdout, exit 1 on
 *     violations exceeding `--max-violations`.
 *   - --json: structured JSON report on stdout.
 *
 * Flags:
 *   --json                       structured JSON report
 *   --max-violations=N           threshold above which the gate
 *                                fails (default 10 — Phase 34
 *                                close-out baseline)
 *   --threshold=N                `결` occurrences per paragraph
 *                                that constitute a cluster (default
 *                                3 — P21-A2 / P23-A4 definition)
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
const DEFAULT_THRESHOLD = 3;
const DEFAULT_MAX_VIOLATIONS = 10;

function parseArgs(argv) {
  const args = {
    json: false,
    maxViolations: DEFAULT_MAX_VIOLATIONS,
    threshold: DEFAULT_THRESHOLD,
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

// Verbatim port of measure_p23.mjs:119-122.
function countMatches(text, re) {
  if (!text || typeof text !== 'string') return 0;
  return (text.match(re) ?? []).length;
}

// Verbatim port of measure_p23.mjs:132-140. Modern `plainText` first,
// legacy `tokens[].value` join fallback. Surfaces a future shape
// rename without silently masking the gate.
function paragraphText(p) {
  if (typeof p?.plainText === 'string') return p.plainText;
  if (Array.isArray(p?.tokens)) {
    return p.tokens
      .map((t) => (t && typeof t.value === 'string' ? t.value : ''))
      .join('');
  }
  return '';
}

function harvestCluster({ samplesDir, threshold }) {
  const sampleFiles = listSampleFiles(samplesDir);
  const re = /결/g;
  const violations = []; // per-paragraph entries (matches measure_p23 semantics)
  const tierCounts = { standard: 0, expert: 0 };
  let fixturesWithMatrix = 0;
  let totalCells = 0;
  let totalParagraphs = 0;

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
        for (const tierKey of ['standard', 'expert']) {
          const paragraphs = cell[tierKey]?.paragraphs;
          if (!Array.isArray(paragraphs)) continue;
          for (const p of paragraphs) {
            totalParagraphs += 1;
            const ptext = paragraphText(p);
            const c = countMatches(ptext, re);
            if (c >= threshold) {
              tierCounts[tierKey] += 1;
              violations.push({
                fixture: fixtureId,
                period: periodKey,
                category: catKey,
                tier: tierKey,
                count: c,
                excerpt: ptext.slice(0, 140),
              });
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
    totalParagraphs,
    tierCounts,
    violations,
  };
}

function buildReport({ root, samplesDir, threshold, maxSamples }) {
  const resolvedSamples = resolveSamplesDir(root, samplesDir);
  const harvest = harvestCluster({
    samplesDir: resolvedSamples,
    threshold,
  });
  // Sort violations by count desc then fixture/period/category/tier for stability.
  const sorted = harvest.violations
    .slice()
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.fixture.localeCompare(b.fixture) ||
        a.period.localeCompare(b.period) ||
        a.category.localeCompare(b.category) ||
        a.tier.localeCompare(b.tier),
    );
  return {
    policy: 'spring-ts.gyeol-cluster.v1',
    samplesDir: path.relative(root, resolvedSamples).replaceAll(path.sep, '/'),
    needle: '결',
    threshold,
    sampleFilesScanned: harvest.sampleFilesScanned,
    fixturesWithMatrix: harvest.fixturesWithMatrix,
    totalCells: harvest.totalCells,
    totalParagraphs: harvest.totalParagraphs,
    tierCounts: harvest.tierCounts,
    violationCount: sorted.length,
    violations: sorted.slice(0, Math.max(0, maxSamples)),
  };
}

function renderHuman(report, maxViolations) {
  const lines = [];
  lines.push(
    `gyeol-cluster: samples=${report.sampleFilesScanned}, fixtures=${report.fixturesWithMatrix}, totalCells=${report.totalCells}, totalParagraphs=${report.totalParagraphs}, samplesDir=${report.samplesDir}`,
  );
  lines.push(
    `  policy: needle="${report.needle}" threshold=${report.threshold} --max-violations=${maxViolations}`,
  );
  lines.push(
    `  tierCounts: standard=${report.tierCounts.standard} expert=${report.tierCounts.expert}  violationCount=${report.violationCount}`,
  );
  if (report.violationCount > 0) {
    lines.push('  Violations (paragraphs containing 결 >= threshold):');
    for (const v of report.violations) {
      lines.push(
        `    ${v.count}  ${v.fixture}  ${v.period}.${v.category}.${v.tier}`,
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
  threshold: args.threshold,
  maxSamples: args.maxSamples,
});

if (args.json) console.log(JSON.stringify(report, null, 2));
else console.log(renderHuman(report, args.maxViolations));

if (report.violationCount > args.maxViolations) {
  console.error(
    `gyeol-cluster: ${report.violationCount} paragraph(s) containing "결" >= ${args.threshold} exceed --max-violations=${args.maxViolations}`,
  );
  process.exit(1);
}

export { buildReport, renderHuman, countMatches, paragraphText };
