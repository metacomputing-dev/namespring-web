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
 *   node tools/quality_gate.mjs --require-complete     # release: fail on N/A
 *
 * Exit codes:
 *   0 — diagnostic run has no measured failure
 *   1 — measured failure, or incomplete coverage in --require-complete mode
 *   2 — fixture/snapshot unreadable
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyDimensionAggregate,
  classifyGateOverall,
  qualityGateExitCode,
} from './quality_gate_status.mjs';
import { auditSourceTierEvidence } from './quality-gate/source-tier-audit.mjs';
import { evaluateD1 } from './quality-gate/d1.mjs';
import { evaluateD2 } from './quality-gate/d2.mjs';
import { evaluateD3 } from './quality-gate/d3.mjs';
import { evaluateD4 } from './quality-gate/d4.mjs';
import { evaluateD5 } from './quality-gate/d5.mjs';
import {
  extractStrengthBands,
  resolveNarrativeEntry,
  strengthLevelMatches,
} from './quality-gate/shared.mjs';

export {
  evaluateD1,
  evaluateD2,
  evaluateD3,
  evaluateD4,
  evaluateD5,
  extractStrengthBands,
  resolveNarrativeEntry,
  strengthLevelMatches,
};

// ── paths ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const JONGGYEOK_FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/jonggyeok_cases.json');
const JONGGYEOK_AUTHORITY_CASES_PATH = path.resolve(
  SPRING_TS_ROOT,
  'test/fixtures/jonggyeok_authority_cases.json',
);
const SNAPSHOT_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/spring_ts_snapshot.json');
const NARRATIVES_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/spring_ts_narratives.json');
const AUTHORITY_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority');
const ORACLES_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/oracles');
const DATA_SOURCES_DIR = path.resolve(SPRING_TS_ROOT, 'data/sources');

const ALL_DIMENSIONS = ['D1', 'D2', 'D3', 'D4', 'D5'];

// ── arg parsing ───────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {
    dimensions: null,
    fixtures: null,
    json: false,
    verbose: false,
    requireComplete: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--dimensions' && argv[i + 1]) {
      args.dimensions = argv[i + 1].split(',').map(s => s.trim().toUpperCase());
    } else if (argv[i] === '--fixtures' && argv[i + 1]) {
      args.fixtures = argv[i + 1].split(',').map(s => s.trim());
    } else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--verbose') args.verbose = true;
    else if (argv[i] === '--require-complete') args.requireComplete = true;
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

/** Narrative golden (tools/narrative_baseline.ts). Absence is not fatal —
 *  D2/D4 degrade to N/A with an explicit reason (fail-closed for release
 *  mode via --require-complete, never fail-open). */
function loadNarratives() {
  if (!fs.existsSync(NARRATIVES_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(NARRATIVES_PATH, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse narrative golden: ${err.message}`);
    return null;
  }
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

function auditSourceTiers() {
  return auditSourceTierEvidence({
    root: SPRING_TS_ROOT,
    evidenceDirs: [AUTHORITY_DIR, ORACLES_DIR, DATA_SOURCES_DIR],
    extraJsonFiles: [JONGGYEOK_FIXTURES_PATH, JONGGYEOK_AUTHORITY_CASES_PATH],
  });
}

// ── per-fixture aggregator ────────────────────────────────────────────────
function evaluateFixture(fixture, snapshot, dimensionFilter, narratives) {
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
  const narrativeLookup = resolveNarrativeEntry(narratives, fixture.id, snapshot.targetDate);

  const wantDim = (d) => !dimensionFilter || dimensionFilter.includes(d);

  const dimensions = {};
  if (wantDim('D1')) dimensions.D1 = evaluateD1(fixture, snapshotResult, authorityCase, oracleCase);
  if (wantDim('D2')) dimensions.D2 = evaluateD2(fixture, snapshotResult, authorityCase, narrativeLookup);
  if (wantDim('D3')) dimensions.D3 = evaluateD3(fixture, snapshotResult, authorityCase, oracleCase);
  if (wantDim('D4')) dimensions.D4 = evaluateD4(fixture, snapshotResult, authorityCase, narrativeLookup);
  if (wantDim('D5')) dimensions.D5 = evaluateD5(fixture, snapshotResult, authorityCase, oracleCase);

  // 'N/A' = measurement missing (still blocks release completeness);
  // 'NOT_APPLICABLE' = out of scope by design (never counted as measured,
  // never blocks). Both are excluded from the measured set here.
  const measured = Object.values(dimensions)
    .filter(d => d.status !== 'N/A' && d.status !== 'NOT_APPLICABLE');
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
    disagreementNotes: fixture.disagreementNotes || [],
  };
}

// ── overall runner ────────────────────────────────────────────────────────
export function runGate(args) {
  const sourceTierAudit = auditSourceTiers();
  const fixtures = loadFixtures();
  const snapshot = loadSnapshot();
  const narratives = loadNarratives();

  let filteredFixtures = fixtures;
  if (args.fixtures) {
    const idSet = new Set(args.fixtures.map(f => (f.startsWith('fix-') ? f : `fix-${f}`)));
    filteredFixtures = fixtures.filter(f => idSet.has(f.id));
  }

  const dimFilter = args.dimensions;
  const fixtureReports = filteredFixtures.map(f => evaluateFixture(f, snapshot, dimFilter, narratives));

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
    const notApplicable = dimResults.filter(x => x.status === 'NOT_APPLICABLE').length;
    const status = classifyDimensionAggregate({ pass, fail, na, notApplicable });
    dimensionAggregate[d] = { pass, fail, na, notApplicable, status };
  }

  const overall = classifyGateOverall({
    sourceTierStatus: sourceTierAudit.status,
    totalFailures: totalFail,
    dimensionStatuses: Object.values(dimensionAggregate).map(({ status }) => status),
  });
  const incompleteDimensions = Object.entries(dimensionAggregate)
    .filter(([, aggregate]) => aggregate.status !== 'PASS')
    .map(([dimension]) => dimension);

  return {
    overall,
    incompleteDimensions,
    sourceTierAudit,
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
  lines.push(
    `Source tiers: ${report.sourceTierAudit.status}` +
      ` (${report.sourceTierAudit.scanned} records scanned, ${report.sourceTierAudit.violations.length} violations)`
  );
  if (report.incompleteDimensions.length > 0) {
    lines.push('Incomplete dimensions: ' + report.incompleteDimensions.join(', '));
  }
  if (report.sourceTierAudit.violations.length > 0) {
    for (const v of report.sourceTierAudit.violations.slice(0, 10)) {
      const field = v.field ? ` ${v.field}` : '';
      lines.push(`  ${v.file}:${field} ${v.code} — ${v.message}`);
    }
    if (report.sourceTierAudit.violations.length > 10) {
      lines.push(`  ... ${report.sourceTierAudit.violations.length - 10} more source-tier violations`);
    }
  }
  lines.push(``);
  lines.push(`Dimensions:`);
  for (const [dim, agg] of Object.entries(report.dimensions)) {
    const notApplicable = agg.notApplicable > 0 ? ` / ${agg.notApplicable} NOT_APPLICABLE` : '';
    lines.push(`  ${dim}: ${agg.status}  (${agg.pass} PASS / ${agg.fail} FAIL / ${agg.na} N/A${notApplicable})`);
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
      // PR-M-3: surface documented disagreements alongside FAILs so the
      // reader can distinguish "known / pending Authority" from "unexpected".
      if (f.disagreementNotes?.length) {
        lines.push(`    Documented disagreements (pending Reference A):`);
        for (const note of f.disagreementNotes) {
          const tag = note.needsCodeReview ? ' [code review pending]' : '';
          lines.push(`      ${note.field}: spring-ts=${JSON.stringify(note.spring_ts)} vs saju_master=${JSON.stringify(note.saju_master)}${tag}`);
          lines.push(`        ${note.reason}`);
        }
      }
    }
  }
  return lines.join('\n');
}

// ── main ──────────────────────────────────────────────────────────────────
export function runCli(argv = process.argv) {
  const args = parseArgs(argv);
  const report = runGate(args);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHumanSummary(report, args.verbose));
  }
  return qualityGateExitCode(report.overall, {
    requireComplete: args.requireComplete,
  });
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) process.exit(runCli());
