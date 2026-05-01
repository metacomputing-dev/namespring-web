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
const JONGGYEOK_FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/jonggyeok_cases.json');
const SNAPSHOT_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/spring_ts_snapshot.json');
const AUTHORITY_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority');
const ORACLES_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/oracles');

const ALL_DIMENSIONS = ['D1', 'D2', 'D3', 'D4', 'D5'];
const SOURCE_TIER_REQUIRED_FIELDS = [
  'tier',
  'sourceType',
  'sourceUrl',
  'accessedAt',
  'quoteShort',
  'humanInterpretation',
  'copyrightNote',
  'authorityTruthEligible',
];
const MIN_AUTHORITY_TRUTH_TIER = 3;

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

function walkJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkJsonFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(fullPath);
  }
  return files;
}

function parseTierRank(sourceTier) {
  const tier = sourceTier?.tier;
  if (typeof tier !== 'string') return null;
  const match = tier.match(/^T([0-5])_[A-Z0-9_]+$/);
  return match ? Number(match[1]) : null;
}

function validateSourceTierObject(sourceTier, filePath) {
  const violations = [];
  const relPath = path.relative(SPRING_TS_ROOT, filePath).replaceAll(path.sep, '/');
  if (!sourceTier || typeof sourceTier !== 'object' || Array.isArray(sourceTier)) {
    return [{ file: relPath, code: 'missing_sourceTier', message: 'sourceTier object is required' }];
  }

  for (const field of SOURCE_TIER_REQUIRED_FIELDS) {
    if (!(field in sourceTier)) {
      violations.push({ file: relPath, code: 'missing_sourceTier_field', field, message: `sourceTier.${field} is required` });
    }
  }

  const rank = parseTierRank(sourceTier);
  if (rank === null) {
    violations.push({ file: relPath, code: 'invalid_sourceTier_tier', message: `invalid tier: ${sourceTier.tier}` });
  }
  if (typeof sourceTier.authorityTruthEligible !== 'boolean') {
    violations.push({ file: relPath, code: 'invalid_authorityTruthEligible', message: 'sourceTier.authorityTruthEligible must be boolean' });
  }
  if (sourceTier.authorityTruthEligible === true && rank !== null && rank < MIN_AUTHORITY_TRUTH_TIER) {
    violations.push({
      file: relPath,
      code: 'low_tier_authority_truth',
      tier: sourceTier.tier,
      message: `${sourceTier.tier} cannot be used as authority truth`,
    });
  }
  return violations;
}

function auditSourceTiers() {
  const files = [
    ...walkJsonFiles(AUTHORITY_DIR),
    ...walkJsonFiles(ORACLES_DIR),
  ];
  if (fs.existsSync(JONGGYEOK_FIXTURES_PATH)) files.push(JONGGYEOK_FIXTURES_PATH);

  const violations = [];
  let scanned = 0;
  for (const filePath of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      violations.push({
        file: path.relative(SPRING_TS_ROOT, filePath).replaceAll(path.sep, '/'),
        code: 'invalid_json',
        message: err.message,
      });
      continue;
    }
    scanned += 1;
    violations.push(...validateSourceTierObject(data.sourceTier, filePath));
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    scanned,
    violations,
  };
}

function isAuthorityTruthEligible(record) {
  const sourceTier = record?.sourceTier;
  const rank = parseTierRank(sourceTier);
  return sourceTier?.authorityTruthEligible === true && rank !== null && rank >= MIN_AUTHORITY_TRUTH_TIER;
}

// ── dimension stubs (PR-G1 — return N/A pending Phase L reference data) ───
// Each dimension returns one of:
//   { dimension: 'DN', status: 'PASS' | 'FAIL' | 'N/A', ... }
// PASS = all checks passed, FAIL = at least one check failed,
// N/A = no reference data available to evaluate.

// D1 thresholds per F-A18 §2.1
const D1_TOTALSCORE_TOLERANCE = 2.0;
const D1_INDIVIDUAL_SCORE_TOLERANCE = 1.0;

function isAllowedField(allowedDiff, fieldPath) {
  if (!Array.isArray(allowedDiff)) return false;
  return allowedDiff.some((d) => typeof d === 'string' && d.startsWith(fieldPath));
}

// PR-M-2: spring-ts emits hedged strength labels like "중화(신약 경향)" /
// "중화(신강 경향)"; saju_master emits discrete "신약" / "신강" / "중화 또는
// 약중강". The two systems disagree on labelling but not on the underlying
// band. Treat the labels as equivalent within the same band so D1 doesn't
// flag a labelling-only diff as substantive.
const STRENGTH_BAND = {
  신약: 'weak',
  '중화(신약 경향)': 'weak',
  신강: 'strong',
  '중화(신강 경향)': 'strong',
  중화: 'middle',
  '중화 또는 약중강': 'middle',
  극신약: 'weak',
  극신강: 'strong',
};

function strengthBand(label) {
  if (!label || typeof label !== 'string') return null;
  return STRENGTH_BAND[label] || null;
}

function strengthLevelMatches(actual, expected) {
  if (actual === expected) return true;
  const a = strengthBand(actual);
  const e = strengthBand(expected);
  if (!a || !e) return false;
  if (a === e) return true;
  // Allow "middle" to match either weak or strong — saju_master uses it as
  // a hedged label when the chart sits on the boundary, and spring-ts may
  // resolve to one side.
  if (a === 'middle' || e === 'middle') return true;
  return false;
}

function evaluateD1(fixture, snapshotResult, authorityCase, oracleCase) {
  const checks = [];
  const allowed = fixture.allowedDiff || [];
  const sajuActual = snapshotResult.output.sajuReport || {};
  const namingActual = snapshotResult.output.namingReport || {};
  const authorityTruth = isAuthorityTruthEligible(authorityCase) ? authorityCase : null;
  const oracleTruth = isAuthorityTruthEligible(oracleCase) ? oracleCase : null;

  // categorical fields from authority (A) — gyeokguk + yongshin + strength
  const categoricalA = [
    { field: 'sajuReport.gyeokgukType', actual: sajuActual.gyeokgukType, expected: authorityTruth?.expected?.gyeokguk },
    { field: 'sajuReport.yongshinElement', actual: sajuActual.yongshinElement, expected: authorityTruth?.expected?.yongshinElement },
    { field: 'sajuReport.strengthLevel', actual: sajuActual.strengthLevel, expected: authorityTruth?.expected?.strengthLevel },
  ];
  for (const c of categoricalA) {
    if (c.expected === undefined || c.expected === null) continue;
    if (isAllowedField(allowed, c.field)) {
      checks.push({ ...c, pass: true, allowedDiff: true });
    } else {
      const pass = c.field === 'sajuReport.strengthLevel'
        ? strengthLevelMatches(c.actual, c.expected)
        : c.actual === c.expected;
      checks.push({ ...c, pass });
    }
  }

  // categorical fields from oracle (B) when a future oracle is explicitly
  // promoted to authority-truth eligibility. Current saju_master captures are
  // T2 reference-implementation records and are excluded from D1.
  if (oracleTruth?.expected) {
    const categoricalB = [
      { field: 'sajuReport.gyeokgukType', actual: sajuActual.gyeokgukType, expected: oracleTruth.expected.gyeokgukType },
      { field: 'sajuReport.yongshinElement', actual: sajuActual.yongshinElement, expected: oracleTruth.expected.yongshinElement },
      { field: 'sajuReport.strengthLevel', actual: sajuActual.strengthLevel, expected: oracleTruth.expected.strengthLevel },
    ];
    for (const c of categoricalB) {
      // skip if A already covered the same field (avoid double-count)
      if (categoricalA.some((a) => a.field === c.field && a.expected !== undefined)) continue;
      if (c.expected === undefined || c.expected === null) continue;
      if (isAllowedField(allowed, c.field)) {
        checks.push({ ...c, pass: true, allowedDiff: true, source: 'oracle' });
      } else {
        const pass = c.field === 'sajuReport.strengthLevel'
          ? strengthLevelMatches(c.actual, c.expected)
          : c.actual === c.expected;
        checks.push({ ...c, pass, source: 'oracle' });
      }
    }
  }

  // numerical: totalScore + scores.{hangul,hanja,fourFrame}
  const expectedNumerical = authorityTruth?.expected?.scores || oracleTruth?.expected?.scores;
  if (expectedNumerical) {
    const numericalChecks = [
      { field: 'namingReport.totalScore', actual: namingActual.totalScore, expected: authorityTruth?.expected?.totalScore ?? oracleTruth?.expected?.totalScore, tol: D1_TOTALSCORE_TOLERANCE },
      { field: 'namingReport.scores.hangul', actual: namingActual.scores?.hangul, expected: expectedNumerical.hangul, tol: D1_INDIVIDUAL_SCORE_TOLERANCE },
      { field: 'namingReport.scores.hanja', actual: namingActual.scores?.hanja, expected: expectedNumerical.hanja, tol: D1_INDIVIDUAL_SCORE_TOLERANCE },
      { field: 'namingReport.scores.fourFrame', actual: namingActual.scores?.fourFrame, expected: expectedNumerical.fourFrame, tol: D1_INDIVIDUAL_SCORE_TOLERANCE },
    ];
    for (const c of numericalChecks) {
      if (c.expected === undefined || c.expected === null || c.actual === undefined || c.actual === null) continue;
      if (isAllowedField(allowed, c.field)) {
        checks.push({ field: c.field, actual: c.actual, expected: c.expected, diff: Math.abs(c.actual - c.expected), tol: c.tol, pass: true, allowedDiff: true });
      } else {
        const diff = Math.abs(c.actual - c.expected);
        checks.push({ field: c.field, actual: c.actual, expected: c.expected, diff, tol: c.tol, pass: diff <= c.tol });
      }
    }
  }

  if (checks.length === 0) {
    return { dimension: 'D1', status: 'N/A', reason: 'no authority-truth-eligible reference data for this fixture' };
  }

  const failed = checks.filter((c) => !c.pass);
  return {
    dimension: 'D1',
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    checks,
    failedCount: failed.length,
    totalChecks: checks.length,
  };
}

function evaluateD2(fixture, snapshotResult, authorityCase) {
  return { dimension: 'D2', status: 'N/A', reason: 'narrative reference unavailable (Phase L F-A16 extract)' };
}

// Map snapshot output keys to the saju-master card-type tokens that
// `oracle.cards.surfacedCardTypes` enumerates. The snapshot's
// fortuneReport block carries headline data per card; absence of the
// data implies the card was not surfaced.
function inferSurfacedCardsFromSnapshot(snapshotResult) {
  const out = snapshotResult.output || {};
  const tokens = new Set();
  if (out.sajuReport?.gyeokgukType) tokens.add('gyeokguk');
  if (out.sajuReport?.yongshinElement) tokens.add('yongshin');
  if (out.fortuneReport?.personalityTraitCount > 0) tokens.add('sipsin');
  // shinsal + johu are not captured directly in baseline_snapshot.json,
  // but spring-ts always surfaces ShinsalCard + JohuCard when sajuEnabled
  // is true. saju-adapter PR-H-B lifts shinsal when non-empty; JohuCard
  // is built unconditionally from sajuReport.johu. Snapshot-only inference
  // therefore can't tell us "did the card carry data?" — treat them as
  // surfaced when the upstream report exists. A future snapshot pass can
  // add direct shinsal/johu signal counts to disambiguate.
  if (out.sajuReport?.sajuEnabled) {
    tokens.add('shinsal');
    tokens.add('johu');
  }
  return tokens;
}

function evaluateD3(fixture, snapshotResult, oracleCase) {
  const expected = oracleCase?.cards?.surfacedCardTypes;
  if (!Array.isArray(expected) || expected.length === 0) {
    return { dimension: 'D3', status: 'N/A', reason: 'oracle card list unavailable (Phase L F-A12 capture)' };
  }

  const allowed = fixture.allowedDiff || [];
  const surfaced = inferSurfacedCardsFromSnapshot(snapshotResult);
  const missing = expected.filter((card) => !surfaced.has(card));
  const allowedMissing = missing.filter((card) =>
    isAllowedField(allowed, `cards.surfacedCardTypes.${card}`)
  );
  const realMissing = missing.filter((card) => !allowedMissing.includes(card));

  return {
    dimension: 'D3',
    status: realMissing.length === 0 ? 'PASS' : 'FAIL',
    expected,
    surfaced: [...surfaced],
    missing: realMissing,
    allowedMissing,
  };
}

function evaluateD4(fixture, snapshotResult, authorityCase, oracleCase) {
  return { dimension: 'D4', status: 'N/A', reason: 'hedge labeling pending Phase L (F-A11 + F-A12)' };
}

// D5 edge axis-tag patterns — per F-A9 fixture taxonomy. Add new edge types
// here (e.g., 'unknown-hour', 'borderline-strength') as Phase L-1 lands them.
const D5_EDGE_AXIS_PATTERNS = [
  /^jonggyeok/i,
  /^jonggwang/i,
  /^jaza-edge$/i,
  /^johu-/i,
  /^unknown-hour$/i,
  /^borderline-strength$/i,
];

function isEdgeFixture(fixture) {
  const axes = Array.isArray(fixture.axis) ? fixture.axis : [];
  return axes.some((a) => D5_EDGE_AXIS_PATTERNS.some((re) => re.test(String(a))));
}

function evaluateD5(fixture, snapshotResult, authorityCase, oracleCase) {
  if (!isEdgeFixture(fixture)) {
    return { dimension: 'D5', status: 'N/A', reason: 'not an edge fixture (axis does not match D5 patterns)' };
  }

  const output = snapshotResult.output || {};
  const sajuReport = output.sajuReport || {};
  const namingReport = output.namingReport || {};

  // Stability checks per F-A18 §2.5 — edge fixtures must surface non-crashing,
  // structurally complete output. Empty/undefined sajuEnabled or missing
  // namingReport totalScore is a D5 FAIL.
  const stabilityChecks = [
    { field: 'output present', pass: typeof snapshotResult.output === 'object' && snapshotResult.output !== null },
    { field: 'sajuReport present', pass: typeof output.sajuReport === 'object' && output.sajuReport !== null },
    { field: 'sajuEnabled defined', pass: sajuReport.sajuEnabled !== undefined },
    { field: 'namingReport present', pass: typeof output.namingReport === 'object' && output.namingReport !== null },
    { field: 'totalScore is finite number', pass: Number.isFinite(namingReport.totalScore) },
  ];

  // If saju is enabled on this edge fixture, also require the scoring categorical
  // fields to surface — collapsing 종격 to undefined would be a critical D5 fail.
  if (sajuReport.sajuEnabled === true) {
    stabilityChecks.push({
      field: 'gyeokgukType surfaced when sajuEnabled',
      pass: typeof sajuReport.gyeokgukType === 'string' && sajuReport.gyeokgukType.length > 0,
    });
    stabilityChecks.push({
      field: 'strengthLevel surfaced when sajuEnabled',
      pass: typeof sajuReport.strengthLevel === 'string' && sajuReport.strengthLevel.length > 0,
    });
  }

  // Reference-driven categorical PASS rate per F-A18 §2.5 — when authority or
  // oracle case is present for the edge fixture, edge D1-equivalent must be
  // 100%. Reuse evaluateD1's pass-rate as the D5 categorical signal.
  let referenceRate = null;
  const authorityTruth = isAuthorityTruthEligible(authorityCase) ? authorityCase : null;
  if (authorityTruth) {
    const d1 = evaluateD1(fixture, snapshotResult, authorityTruth, null);
    if (d1.status !== 'N/A' && d1.totalChecks > 0) {
      const passRate = (d1.totalChecks - d1.failedCount) / d1.totalChecks;
      referenceRate = passRate;
      stabilityChecks.push({
        field: 'edge categorical PASS rate ≥ 1.0 (F-A18 §2.5)',
        pass: passRate >= 1.0,
        passRate,
      });
    }
  }

  const failed = stabilityChecks.filter((c) => !c.pass);
  return {
    dimension: 'D5',
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    checks: stabilityChecks,
    failedCount: failed.length,
    totalChecks: stabilityChecks.length,
    referenceRate,
  };
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
    disagreementNotes: fixture.disagreementNotes || [],
  };
}

// ── overall runner ────────────────────────────────────────────────────────
function runGate(args) {
  const sourceTierAudit = auditSourceTiers();
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
  if (sourceTierAudit.status === 'FAIL') overall = 'FAIL';
  else if (totalFail > 0) overall = 'FAIL';
  else if (totalPass > 0) overall = 'PASS';
  else overall = 'N/A';

  return {
    overall,
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
      ` (${report.sourceTierAudit.scanned} files scanned, ${report.sourceTierAudit.violations.length} violations)`
  );
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
const args = parseArgs(process.argv);
const report = runGate(args);

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderHumanSummary(report, args.verbose));
}

const exitCode = report.overall === 'FAIL' ? 1 : 0;
process.exit(exitCode);
