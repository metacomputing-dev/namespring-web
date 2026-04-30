/**
 * tools/measure_default_change.mjs
 *
 * A/B snapshot comparison tool per F-A11
 * (`spring-info/09_finalization/11_default_tuning_experiment_design.md`).
 *
 * Sibling to `tools/measure_regression.mjs`:
 *
 *   measure_regression       — binary "any field diff?" detector for catching
 *                              accidental regressions on PRs that should not
 *                              change default-mode output.
 *
 *   measure_default_change   — delta-aware dimension classifier for PRs that
 *                              INTENTIONALLY change default mode. Per-fixture,
 *                              per-dimension classification of how the change
 *                              moves toward / against / orthogonal to "능가".
 *
 * Use this BEFORE creating a Phase M default-flip PR to confirm the change
 * improves at least one quality_gate dimension (per F-A18 §8 "초과 능가") and
 * does not move any dimension backwards beyond the local-tolerance band.
 *
 * Usage:
 *   node tools/measure_default_change.mjs --baseline main --branch HEAD
 *   node tools/measure_default_change.mjs --baseline main --branch HEAD --json > report.json
 *
 * Exit codes:
 *   0 — change is improvement-only (no per-dimension regression)
 *   1 — change has at least one dimension regression
 *   2 — refs unreadable
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SPRING_TS_ROOT, '../..');
const SNAPSHOT_REL_PATH = 'lib/spring-ts/test/baseline/spring_ts_snapshot.json';

// F-A11 §4 epsilons — the per-dimension local-tolerance band beyond which a
// regression is reported. Values are intentionally small (changes within
// epsilon are treated as noise, not regression). Mirrors quality_gate.mjs
// numerical tolerances scaled to delta semantics.
const EPS_TOTAL_SCORE = 0.5;          // Δ totalScore within ±0.5 = noise
const EPS_INDIVIDUAL_SCORE = 0.5;     // Δ scores.* within ±0.5 = noise
const EPS_CARDS_DELTA = 0;            // any drop in card surface = regression
const EPS_FIXTURE_FIELDS_DROPPED = 0; // any field present in baseline but absent in branch = regression

// ── arg parsing ───────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { baseline: 'main', branch: 'HEAD', json: false, verbose: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--baseline') args.baseline = argv[i + 1];
    else if (argv[i] === '--branch') args.branch = argv[i + 1];
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--verbose') args.verbose = true;
  }
  return args;
}

// ── snapshot reading via git-show ─────────────────────────────────────────
function readSnapshotAtRef(ref) {
  try {
    const json = execSync(`git show ${ref}:${SNAPSHOT_REL_PATH}`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(json);
  } catch (err) {
    console.error(`Cannot read ${ref}:${SNAPSHOT_REL_PATH}`);
    console.error(`  reason: ${err.message.split('\n')[0]}`);
    process.exit(2);
  }
}

// ── per-fixture classification ────────────────────────────────────────────
//
// Each fixture's diff is classified into one of:
//   improvement  — branch surfaces more / better than baseline
//   regression   — branch surfaces less / worse than baseline beyond epsilon
//   unchanged    — within epsilon
//   missing      — fixture removed from snapshot
//   added        — fixture only on branch (new fixture)

function classifyFixtureDiff(baseFix, branchFix) {
  if (!baseFix && branchFix) {
    return { type: 'added', fixtureId: branchFix.id, label: branchFix.label, dimensions: {} };
  }
  if (baseFix && !branchFix) {
    return { type: 'missing', fixtureId: baseFix.id, label: baseFix.label, dimensions: {} };
  }

  const baseOut = baseFix.output || {};
  const branchOut = branchFix.output || {};
  const dims = {};

  // D1 numerical — totalScore + scores.* deltas
  const d1Checks = [];
  const totalA = baseOut.namingReport?.totalScore;
  const totalB = branchOut.namingReport?.totalScore;
  if (Number.isFinite(totalA) && Number.isFinite(totalB)) {
    const delta = totalB - totalA;
    let verdict;
    if (Math.abs(delta) <= EPS_TOTAL_SCORE) verdict = 'unchanged';
    else if (delta > 0) verdict = 'improvement';
    else verdict = 'regression';
    d1Checks.push({ field: 'namingReport.totalScore', baseline: totalA, branch: totalB, delta, verdict });
  }
  for (const k of ['hangul', 'hanja', 'fourFrame']) {
    const a = baseOut.namingReport?.scores?.[k];
    const b = branchOut.namingReport?.scores?.[k];
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const delta = b - a;
      let verdict;
      if (Math.abs(delta) <= EPS_INDIVIDUAL_SCORE) verdict = 'unchanged';
      else if (delta > 0) verdict = 'improvement';
      else verdict = 'regression';
      d1Checks.push({ field: `namingReport.scores.${k}`, baseline: a, branch: b, delta, verdict });
    }
  }

  // D1 categorical — gyeokguk/yongshin/strength change is direction-neutral
  // unless the fixture has an `expected` reference. Without reference, any
  // categorical change is flagged for human review (verdict='change').
  for (const k of ['gyeokgukType', 'yongshinElement', 'strengthLevel']) {
    const a = baseOut.sajuReport?.[k];
    const b = branchOut.sajuReport?.[k];
    if (a !== undefined || b !== undefined) {
      if (a !== b) {
        d1Checks.push({ field: `sajuReport.${k}`, baseline: a, branch: b, delta: null, verdict: 'change' });
      }
    }
  }

  dims.D1 = summarizeDimensionChecks(d1Checks);

  // D3 — card surface set comparison
  const baseCards = new Set(Object.keys(baseOut.fortuneReport || {}));
  const branchCards = new Set(Object.keys(branchOut.fortuneReport || {}));
  const droppedCards = [...baseCards].filter((c) => !branchCards.has(c));
  const addedCards = [...branchCards].filter((c) => !baseCards.has(c));
  let d3Verdict;
  if (droppedCards.length > 0) d3Verdict = 'regression';
  else if (addedCards.length > 0) d3Verdict = 'improvement';
  else d3Verdict = 'unchanged';
  dims.D3 = {
    verdict: d3Verdict,
    droppedCards,
    addedCards,
    baseCount: baseCards.size,
    branchCount: branchCards.size,
  };

  // D5 stability — sajuEnabled flip from true→undefined or 카드 disappearance is a structural regression
  const sajuA = baseOut.sajuReport;
  const sajuB = branchOut.sajuReport;
  const d5Checks = [];
  if (sajuA && !sajuB) {
    d5Checks.push({ field: 'sajuReport', baseline: 'present', branch: 'absent', verdict: 'regression' });
  }
  if (sajuA?.sajuEnabled === true && sajuB?.sajuEnabled !== true) {
    d5Checks.push({ field: 'sajuReport.sajuEnabled', baseline: true, branch: sajuB?.sajuEnabled, verdict: 'regression' });
  }
  dims.D5 = summarizeDimensionChecks(d5Checks);

  // overall fixture verdict
  const dimVerdicts = Object.values(dims).map((d) => d.verdict);
  let fixtureVerdict;
  if (dimVerdicts.some((v) => v === 'regression')) fixtureVerdict = 'regression';
  else if (dimVerdicts.some((v) => v === 'improvement' || v === 'change')) fixtureVerdict = 'improvement';
  else fixtureVerdict = 'unchanged';

  return {
    type: fixtureVerdict,
    fixtureId: baseFix.id,
    label: baseFix.label,
    dimensions: dims,
  };
}

function summarizeDimensionChecks(checks) {
  if (checks.length === 0) return { verdict: 'unchanged', checks: [] };
  if (checks.some((c) => c.verdict === 'regression')) return { verdict: 'regression', checks };
  if (checks.some((c) => c.verdict === 'improvement' || c.verdict === 'change')) {
    return { verdict: 'improvement', checks };
  }
  return { verdict: 'unchanged', checks };
}

// ── overall runner ────────────────────────────────────────────────────────
function runMeasure(args) {
  const baseline = readSnapshotAtRef(args.baseline);
  const branch = readSnapshotAtRef(args.branch);

  const baseById = new Map(baseline.results.map((r) => [r.id, r]));
  const branchById = new Map(branch.results.map((r) => [r.id, r]));
  const allIds = new Set([...baseById.keys(), ...branchById.keys()]);

  const fixtureDiffs = [];
  for (const id of allIds) {
    fixtureDiffs.push(classifyFixtureDiff(baseById.get(id), branchById.get(id)));
  }

  const totals = {
    improvement: fixtureDiffs.filter((d) => d.type === 'improvement').length,
    regression: fixtureDiffs.filter((d) => d.type === 'regression').length,
    unchanged: fixtureDiffs.filter((d) => d.type === 'unchanged').length,
    added: fixtureDiffs.filter((d) => d.type === 'added').length,
    missing: fixtureDiffs.filter((d) => d.type === 'missing').length,
  };

  const dimensionTotals = {};
  for (const d of ['D1', 'D3', 'D5']) {
    const verdicts = fixtureDiffs.map((f) => f.dimensions?.[d]?.verdict).filter(Boolean);
    dimensionTotals[d] = {
      improvement: verdicts.filter((v) => v === 'improvement' || v === 'change').length,
      regression: verdicts.filter((v) => v === 'regression').length,
      unchanged: verdicts.filter((v) => v === 'unchanged').length,
    };
  }

  const overall = totals.regression > 0 ? 'REGRESSION' : (totals.improvement > 0 ? 'IMPROVEMENT' : 'UNCHANGED');

  return {
    overall,
    baselineRef: args.baseline,
    branchRef: args.branch,
    totals,
    dimensions: dimensionTotals,
    fixtures: fixtureDiffs,
    generatedAt: new Date().toISOString(),
  };
}

// ── reporters ─────────────────────────────────────────────────────────────
function renderHumanSummary(report, verbose) {
  const lines = [];
  lines.push(`Default Change Report (${report.baselineRef} → ${report.branchRef})`);
  lines.push(`────────────────────────────────────────────────────────────`);
  lines.push(`Overall: ${report.overall}`);
  lines.push(`Fixtures: ${report.totals.improvement} improvement / ${report.totals.regression} regression / ${report.totals.unchanged} unchanged`);
  if (report.totals.added) lines.push(`          ${report.totals.added} added`);
  if (report.totals.missing) lines.push(`          ${report.totals.missing} missing`);
  lines.push(``);
  lines.push(`Dimensions (per F-A18):`);
  for (const [dim, t] of Object.entries(report.dimensions)) {
    lines.push(`  ${dim}: ${t.improvement} ↑ / ${t.regression} ↓ / ${t.unchanged} —`);
  }
  if (verbose) {
    lines.push(``);
    lines.push(`Per-fixture detail (only changed):`);
    for (const f of report.fixtures) {
      if (f.type === 'unchanged') continue;
      lines.push(`  ${f.fixtureId} (${f.label}): ${f.type}`);
      for (const [dim, dResult] of Object.entries(f.dimensions || {})) {
        if (dResult.verdict === 'unchanged') continue;
        lines.push(`    ${dim}: ${dResult.verdict}`);
        for (const c of dResult.checks ?? []) {
          if (c.verdict === 'unchanged') continue;
          const deltaStr = c.delta !== null && c.delta !== undefined ? ` (Δ=${c.delta.toFixed(2)})` : '';
          lines.push(`      ${c.field}: ${JSON.stringify(c.baseline)} → ${JSON.stringify(c.branch)}${deltaStr}`);
        }
        if (dResult.droppedCards?.length) lines.push(`      dropped cards: ${dResult.droppedCards.join(', ')}`);
        if (dResult.addedCards?.length) lines.push(`      added cards: ${dResult.addedCards.join(', ')}`);
      }
    }
  }
  return lines.join('\n');
}

// ── main ──────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv);
const report = runMeasure(args);

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderHumanSummary(report, args.verbose));
}

const exitCode = report.overall === 'REGRESSION' ? 1 : 0;
process.exit(exitCode);
