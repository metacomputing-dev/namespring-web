/**
 * tools/quality_gate.mjs
 *
 * 5-dimension quality gate per F-A18 (`spring-info/09_finalization/18_quality_gate.md`).
 *
 * Compares spring-ts default-mode actual output against external reference
 * data (A: Korean myeongri authority cases, B: saju_master CLI oracle) and
 * verifies "능가" — strict binary AND across D1–D5.
 *
 * Status (PR-G1): infrastructure skeleton. Dimensions return N/A when their
 * reference data is unavailable (Phase L wires the actual data: F-A16
 * authority extract + F-A12 oracle capture + F-A9 edge fixture additions).
 *
 * Usage:
 *   node tools/quality_gate.mjs                       # all dim, all fixtures
 *   node tools/quality_gate.mjs --dimensions D1,D3    # specific dimensions
 *   node tools/quality_gate.mjs --fixtures fix-01,03  # specific fixtures
 *   node tools/quality_gate.mjs --json > report.json  # JSON output
 *   node tools/quality_gate.mjs --verbose             # per-fixture diagnostic
 *
 * Exit codes:
 *   0 — overall PASS (or all dimensions N/A — no actionable failure)
 *   1 — overall FAIL
 *   2 — fixture/snapshot unreadable
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── paths ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const SNAPSHOT_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/spring_ts_snapshot.json');
const AUTHORITY_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority');
const ORACLES_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/oracles');

const ALL_DIMENSIONS = ['D1', 'D2', 'D3', 'D4', 'D5'];

// ── arg parsing ───────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { dimensions: null, fixtures: null, json: false, verbose: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--dimensions' && argv[i + 1]) {
      args.dimensions = argv[i + 1].split(',').map(s => s.trim().toUpperCase());
    } else if (argv[i] === '--fixtures' && argv[i + 1]) {
      args.fixtures = argv[i + 1].split(',').map(s => s.trim());
    } else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--verbose') args.verbose = true;
  }
  return args;
}

// ── data loaders ──────────────────────────────────────────────────────────
function loadFixtures() {
  if (!fs.existsSync(FIXTURES_PATH)) {
    console.error(`Fixtures not found: ${FIXTURES_PATH}`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8')).fixtures;
}

function loadSnapshot() {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(`Snapshot not found: ${SNAPSHOT_PATH}.`);
    console.error(`  hint: run \`npm run snapshot:capture\` first to generate it.`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
}

function loadAuthorityCase(fixtureId) {
  const filePath = path.join(AUTHORITY_DIR, `${fixtureId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse authority case ${fixtureId}: ${err.message}`);
    return null;
  }
}

function loadOracleCase(fixtureId) {
  const filePath = path.join(ORACLES_DIR, `${fixtureId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse oracle case ${fixtureId}: ${err.message}`);
    return null;
  }
}

// ── dimension stubs (PR-G1 — return N/A pending Phase L reference data) ───
// Each dimension returns one of:
//   { dimension: 'DN', status: 'PASS' | 'FAIL' | 'N/A', ... }
// PASS = all checks passed, FAIL = at least one check failed,
// N/A = no reference data available to evaluate.

function evaluateD1(fixture, snapshotResult, authorityCase, oracleCase) {
  return { dimension: 'D1', status: 'N/A', reason: 'wire pending PR-G1 commit 2 (D1 score accuracy)' };
}

function evaluateD2(fixture, snapshotResult, authorityCase) {
  return { dimension: 'D2', status: 'N/A', reason: 'narrative reference unavailable (Phase L F-A16 extract)' };
}

function evaluateD3(fixture, snapshotResult, oracleCase) {
  return { dimension: 'D3', status: 'N/A', reason: 'oracle card list unavailable (Phase L F-A12 capture)' };
}

function evaluateD4(fixture, snapshotResult, authorityCase, oracleCase) {
  return { dimension: 'D4', status: 'N/A', reason: 'hedge labeling pending Phase L (F-A11 + F-A12)' };
}

function evaluateD5(fixture, snapshotResult, authorityCase, oracleCase) {
  return { dimension: 'D5', status: 'N/A', reason: 'edge subset wire pending PR-G1 commit 3' };
}

// ── per-fixture aggregator ────────────────────────────────────────────────
function evaluateFixture(fixture, snapshot, dimensionFilter) {
  const snapshotResult = snapshot.results.find(r => r.id === fixture.id);
  if (!snapshotResult) {
    return {
      fixtureId: fixture.id,
      label: fixture.label,
      status: 'FAIL',
      reason: 'fixture not present in snapshot — run npm run snapshot:capture',
      dimensions: {},
    };
  }

  const authorityCase = loadAuthorityCase(fixture.id);
  const oracleCase = loadOracleCase(fixture.id);

  const wantDim = (d) => !dimensionFilter || dimensionFilter.includes(d);

  const dimensions = {};
  if (wantDim('D1')) dimensions.D1 = evaluateD1(fixture, snapshotResult, authorityCase, oracleCase);
  if (wantDim('D2')) dimensions.D2 = evaluateD2(fixture, snapshotResult, authorityCase);
  if (wantDim('D3')) dimensions.D3 = evaluateD3(fixture, snapshotResult, oracleCase);
  if (wantDim('D4')) dimensions.D4 = evaluateD4(fixture, snapshotResult, authorityCase, oracleCase);
  if (wantDim('D5')) dimensions.D5 = evaluateD5(fixture, snapshotResult, authorityCase, oracleCase);

  const measured = Object.values(dimensions).filter(d => d.status !== 'N/A');
  const failed = measured.filter(d => d.status === 'FAIL');

  let status;
  if (failed.length > 0) status = 'FAIL';
  else if (measured.length > 0) status = 'PASS';
  else status = 'N/A';

  return {
    fixtureId: fixture.id,
    label: fixture.label,
    status,
    dimensions,
    measuredCount: measured.length,
    failedCount: failed.length,
  };
}

// ── overall runner ────────────────────────────────────────────────────────
function runGate(args) {
  const fixtures = loadFixtures();
  const snapshot = loadSnapshot();

  let filteredFixtures = fixtures;
  if (args.fixtures) {
    const idSet = new Set(args.fixtures.map(f => (f.startsWith('fix-') ? f : `fix-${f}`)));
    filteredFixtures = fixtures.filter(f => idSet.has(f.id));
  }

  const dimFilter = args.dimensions;
  const fixtureReports = filteredFixtures.map(f => evaluateFixture(f, snapshot, dimFilter));

  const totalFail = fixtureReports.filter(r => r.status === 'FAIL').length;
  const totalPass = fixtureReports.filter(r => r.status === 'PASS').length;
  const totalNA = fixtureReports.filter(r => r.status === 'N/A').length;

  const dimensionAggregate = {};
  for (const d of ALL_DIMENSIONS) {
    if (dimFilter && !dimFilter.includes(d)) continue;
    const dimResults = fixtureReports.map(r => r.dimensions?.[d]).filter(Boolean);
    const fail = dimResults.filter(x => x.status === 'FAIL').length;
    const pass = dimResults.filter(x => x.status === 'PASS').length;
    const na = dimResults.filter(x => x.status === 'N/A').length;
    let status;
    if (fail > 0) status = 'FAIL';
    else if (pass > 0) status = 'PASS';
    else status = 'N/A';
    dimensionAggregate[d] = { pass, fail, na, status };
  }

  let overall;
  if (totalFail > 0) overall = 'FAIL';
  else if (totalPass > 0) overall = 'PASS';
  else overall = 'N/A';

  return {
    overall,
    totals: { pass: totalPass, fail: totalFail, na: totalNA, total: fixtureReports.length },
    dimensions: dimensionAggregate,
    fixtures: fixtureReports,
    generatedAt: new Date().toISOString(),
  };
}

// ── reporters ─────────────────────────────────────────────────────────────
function renderHumanSummary(report, verbose) {
  const lines = [];
  lines.push(`Quality Gate Report`);
  lines.push(`─────────────────────────────────`);
  lines.push(`Overall: ${report.overall}`);
  lines.push(
    `Fixtures: ${report.totals.pass} PASS / ${report.totals.fail} FAIL / ${report.totals.na} N/A` +
      ` (total ${report.totals.total})`
  );
  lines.push(``);
  lines.push(`Dimensions:`);
  for (const [dim, agg] of Object.entries(report.dimensions)) {
    lines.push(`  ${dim}: ${agg.status}  (${agg.pass} PASS / ${agg.fail} FAIL / ${agg.na} N/A)`);
  }
  if (verbose) {
    lines.push(``);
    lines.push(`Per-fixture detail:`);
    for (const f of report.fixtures) {
      lines.push(`  ${f.fixtureId} (${f.label}): ${f.status}`);
      if (f.reason) lines.push(`    ${f.reason}`);
      for (const [dim, dimResult] of Object.entries(f.dimensions || {})) {
        const reason = dimResult.reason ? ` — ${dimResult.reason}` : '';
        lines.push(`    ${dim}: ${dimResult.status}${reason}`);
      }
    }
  }
  return lines.join('\n');
}

// ── main ──────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv);
const report = runGate(args);

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderHumanSummary(report, args.verbose));
}

const exitCode = report.overall === 'FAIL' ? 1 : 0;
process.exit(exitCode);
