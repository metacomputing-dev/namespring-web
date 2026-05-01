/**
 * test/integration/quality-gate.test.ts
 *
 * Smoke test for tools/quality_gate.mjs (PR-G1).
 *
 * Verifies:
 *   1. The CLI runs without crashing on the existing baseline (no reference
 *      data installed).
 *   2. With no reference data, exit code is 0 (N/A semantics — the gate
 *      doesn't fail noisily; it reports nothing to check).
 *   3. The --json output is valid JSON with the expected top-level shape.
 *   4. D5 detects the existing edge axis tags (fix-03/04/05).
 *   5. --dimensions and --fixtures filters narrow the result set.
 *
 * Run: npm run test:quality-gate
 */
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const GATE = path.resolve(SPRING_TS_ROOT, 'tools/quality_gate.mjs');
const AUTHORITY_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority');

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function runGate(args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync('node', [GATE, ...args], {
      cwd: SPRING_TS_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, status: 0 };
  } catch (err: any) {
    return { stdout: err.stdout?.toString() ?? '', status: err.status ?? -1 };
  }
}

console.log('PR-G1 quality_gate smoke test\n');

// ── (1) baseline run, exit 0 ────────────────────────────────────────────
const baseline = runGate([]);
check('baseline run exit code is 0 (PASS or N/A)', baseline.status === 0, `status=${baseline.status}`);
check('baseline run prints "Quality Gate Report"', baseline.stdout.includes('Quality Gate Report'));

// ── (2) JSON output well-formed ──────────────────────────────────────────
const jsonRun = runGate(['--json']);
let jsonReport: any = null;
let jsonParseOk = false;
try {
  jsonReport = JSON.parse(jsonRun.stdout);
  jsonParseOk = true;
} catch {
  jsonParseOk = false;
}
check('--json output parses as valid JSON', jsonParseOk);
check('JSON has overall field', jsonReport && typeof jsonReport.overall === 'string',
  jsonReport ? `overall=${jsonReport.overall}` : 'no jsonReport');
check('JSON has passing sourceTierAudit', jsonReport &&
  jsonReport.sourceTierAudit?.status === 'PASS',
  jsonReport ? `sourceTierAudit=${jsonReport.sourceTierAudit?.status}` : 'no jsonReport');
check('JSON has dimensions D1-D5', jsonReport &&
  ['D1', 'D2', 'D3', 'D4', 'D5'].every((d) => d in jsonReport.dimensions));
check('JSON has fixtures array', jsonReport && Array.isArray(jsonReport.fixtures));
check('JSON fixtures count matches snapshot (15)',
  jsonReport && jsonReport.fixtures.length === 15,
  `got ${jsonReport?.fixtures?.length}`);

// ── (3) D5 detects existing edge fixtures ───────────────────────────────
const d5Pass = jsonReport?.fixtures?.filter(
  (f: any) => f.dimensions?.D5?.status === 'PASS'
) ?? [];
const d5PassIds = d5Pass.map((f: any) => f.fixtureId).sort();
check('D5 detects at least 3 edge fixtures from existing axis tags',
  d5Pass.length >= 3, `detected: ${d5PassIds.join(', ')}`);
check('D5 includes fix-03 (jaza-edge)', d5PassIds.includes('fix-03'));
check('D5 includes fix-04 (jonggwang-candidate)', d5PassIds.includes('fix-04'));

const violationPath = path.join(AUTHORITY_DIR, '__source_tier_violation_test__.json');
try {
  fs.writeFileSync(violationPath, JSON.stringify({
    sourceTier: {
      tier: 'T1_HYPOTHESIS',
      sourceType: 'training_derived',
      sourceUrl: null,
      accessedAt: '2026-05-01',
      quoteShort: null,
      humanInterpretation: 'Temporary test fixture that must never be authority truth.',
      copyrightNote: 'No source prose.',
      authorityTruthEligible: true,
    },
  }, null, 2) + '\n', 'utf-8');
  const violationRun = runGate(['--json']);
  let violationReport: any = null;
  try {
    violationReport = JSON.parse(violationRun.stdout);
  } catch {
    /* fall-through */
  }
  check('T1 authorityTruthEligible=true blocks quality gate',
    violationRun.status === 1 && violationReport?.sourceTierAudit?.status === 'FAIL',
    `status=${violationRun.status}`);
  check('source-tier violation reports low_tier_authority_truth',
    violationReport?.sourceTierAudit?.violations?.some((v: any) => v.code === 'low_tier_authority_truth'));
} finally {
  if (fs.existsSync(violationPath)) fs.unlinkSync(violationPath);
}

// ── (4) --dimensions filter ─────────────────────────────────────────────
const dimFilter = runGate(['--dimensions', 'D5', '--json']);
let dimReport: any = null;
try {
  dimReport = JSON.parse(dimFilter.stdout);
} catch {
  /* fall-through */
}
check('--dimensions D5 limits the dimensions set', dimReport &&
  Object.keys(dimReport.dimensions ?? {}).length === 1 &&
  'D5' in dimReport.dimensions);

// ── (5) --fixtures filter ───────────────────────────────────────────────
const fixFilter = runGate(['--fixtures', 'fix-01', '--json']);
let fixReport: any = null;
try {
  fixReport = JSON.parse(fixFilter.stdout);
} catch {
  /* fall-through */
}
check('--fixtures fix-01 narrows fixtures to 1', fixReport && fixReport.fixtures?.length === 1);
check('--fixtures fix-01 returns the fix-01 fixture',
  fixReport && fixReport.fixtures?.[0]?.fixtureId === 'fix-01');

console.log(`\nQuality gate smoke: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
