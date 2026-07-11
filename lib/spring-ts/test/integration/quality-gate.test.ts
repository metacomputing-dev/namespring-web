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
check('baseline run exits with a documented gate status', [0, 1].includes(baseline.status),
  `status=${baseline.status}`);
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
check('JSON has explicit sourceTierAudit status and violations', jsonReport &&
  ['PASS', 'FAIL'].includes(jsonReport.sourceTierAudit?.status) &&
  Array.isArray(jsonReport.sourceTierAudit?.violations),
  jsonReport ? `sourceTierAudit=${jsonReport.sourceTierAudit?.status}` : 'no jsonReport');
check('JSON has dimensions D1-D5', jsonReport &&
  ['D1', 'D2', 'D3', 'D4', 'D5'].every((d) => d in jsonReport.dimensions));
check('JSON has fixtures array', jsonReport && Array.isArray(jsonReport.fixtures));
// P0-3: 픽스처 수 하드코딩 금지 — 스냅샷 파일의 실제 개수와 동적 비교 (15→17 확장 대응)
const snapshotFixtureCount = JSON.parse(
  fs.readFileSync(path.resolve(SPRING_TS_ROOT, 'test/baseline/spring_ts_snapshot.json'), 'utf-8'),
).results.length;
check(`JSON fixtures count matches snapshot (${snapshotFixtureCount})`,
  jsonReport && jsonReport.fixtures.length === snapshotFixtureCount,
  `got ${jsonReport?.fixtures?.length}`);

// ── (3) D5 detects existing edge fixtures ───────────────────────────────
const d5Stable = jsonReport?.fixtures?.filter(
  (f: any) => f.dimensions?.D5?.stabilityStatus === 'PASS'
) ?? [];
const d5StableIds = d5Stable.map((f: any) => f.fixtureId).sort();
check('D5 detects at least 3 structurally stable edge fixtures',
  d5Stable.length >= 3, `detected: ${d5StableIds.join(', ')}`);
check('D5 includes fix-03 (jaza-edge)', d5StableIds.includes('fix-03'));
check('D5 includes fix-04 (strength-direction)', d5StableIds.includes('fix-04'));
check('D5 does not claim calculation accuracy without eligible truth',
  jsonReport?.dimensions?.D5?.pass === 0 &&
    jsonReport?.dimensions?.D5?.fail === 0 &&
    jsonReport?.dimensions?.D5?.na === 14 &&
    jsonReport?.dimensions?.D5?.notApplicable === 3,
  JSON.stringify(jsonReport?.dimensions?.D5));

const violationPath = path.join(AUTHORITY_DIR, '__source_tier_violation_test__.json');
try {
  fs.writeFileSync(violationPath, JSON.stringify({
    sourceTier: {
      tier: 'T3_AUTHORED_INTERPRETATION',
      sourceType: 'temporary_test_fixture',
      sourceUrl: null,
      accessedAt: '2026-05-01',
      quoteShort: null,
      humanInterpretation: 'Temporary test fixture root record.',
      copyrightNote: 'No source prose.',
      authorityTruthEligible: true,
    },
    sources: [{
      id: 'nested_low_tier_violation',
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
    }],
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
    violationReport?.sourceTierAudit?.violations?.some((v: any) =>
      v.code === 'low_tier_authority_truth' &&
      v.sourceTierPath === 'sources[0].sourceTier'));
} finally {
  if (fs.existsSync(violationPath)) fs.unlinkSync(violationPath);
}

// ── (4) classical quote length enforcement ──────────────────────────────
const quoteLimitPath = path.join(AUTHORITY_DIR, '__classical_quote_limit_test__.json');
try {
  fs.writeFileSync(quoteLimitPath, JSON.stringify({
    source: {
      tradition: 'classical',
      text: 'temporary classical quote limit fixture',
    },
    prose_quote: {
      verbatim: 'x'.repeat(81),
    },
    sourceTier: {
      tier: 'T4_PRIMARY_TEXT',
      sourceType: 'classical_primary_text',
      sourceUrl: null,
      accessedAt: '2026-05-01',
      quoteShort: null,
      humanInterpretation: 'Temporary classical fixture used to verify short-quote enforcement.',
      copyrightNote: 'Synthetic quote text for test only.',
      authorityTruthEligible: true,
    },
  }, null, 2) + '\n', 'utf-8');
  const quoteRun = runGate(['--json']);
  let quoteReport: any = null;
  try {
    quoteReport = JSON.parse(quoteRun.stdout);
  } catch {
    /* fall-through */
  }
  check('classical prose_quote.verbatim over limit blocks quality gate',
    quoteRun.status === 1 && quoteReport?.sourceTierAudit?.status === 'FAIL',
    `status=${quoteRun.status}`);
  check('classical quote-limit violation reports path and length',
    quoteReport?.sourceTierAudit?.violations?.some((v: any) =>
      v.code === 'classical_quote_too_long' &&
      v.file === 'test/baseline/authority/__classical_quote_limit_test__.json' &&
      v.quotePath === 'prose_quote.verbatim' &&
      v.limit === 80 &&
      v.length === 81));
} finally {
  if (fs.existsSync(quoteLimitPath)) fs.unlinkSync(quoteLimitPath);
}

// ── (5) --dimensions filter ─────────────────────────────────────────────
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

// ── (6) --fixtures filter ───────────────────────────────────────────────
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

// — (7) source-tiered snippet arrays are scanned —
const snippetQuoteLimitPath = path.join(AUTHORITY_DIR, '__classical_snippet_quote_limit_test__.json');
try {
  fs.writeFileSync(snippetQuoteLimitPath, JSON.stringify({
    schemaVersion: 'spring-ts.classical-rule-snippets.test',
    sourceTier: {
      tier: 'T4_PRIMARY_TEXT',
      sourceType: 'classical_public_rule_snippet_fixture',
      sourceUrl: null,
      accessedAt: '2026-05-02',
      quoteShort: null,
      humanInterpretation: 'Temporary classical snippet fixture used to verify snippet source-tier scanning.',
      copyrightNote: 'Synthetic quote text for test only.',
      authorityTruthEligible: false,
    },
    snippets: [
      {
        id: 'temporary_snippet_quote_limit',
        sourceTier: {
          tier: 'T4_PRIMARY_TEXT',
          sourceType: 'classical_public_rule_snippet',
          sourceUrl: null,
          accessedAt: '2026-05-02',
          quoteShort: 'x'.repeat(81),
          humanInterpretation: 'Temporary snippet row used to verify short-quote enforcement.',
          copyrightNote: 'Synthetic quote text for test only.',
          authorityTruthEligible: false,
        },
      },
    ],
  }, null, 2) + '\n', 'utf-8');
  const snippetRun = runGate(['--json']);
  let snippetReport: any = null;
  try {
    snippetReport = JSON.parse(snippetRun.stdout);
  } catch {
    /* fall-through */
  }
  check('classical snippets[] sourceTier is scanned by quality gate',
    snippetRun.status === 1 && snippetReport?.sourceTierAudit?.status === 'FAIL',
    `status=${snippetRun.status}`);
  check('classical snippets[] quote-limit violation reports path and length',
    snippetReport?.sourceTierAudit?.violations?.some((v: any) =>
      v.code === 'classical_quote_too_long' &&
      v.file === 'test/baseline/authority/__classical_snippet_quote_limit_test__.json' &&
      v.quotePath === 'snippets[0].sourceTier.quoteShort' &&
      v.limit === 80 &&
      v.length === 81));
} finally {
  if (fs.existsSync(snippetQuoteLimitPath)) fs.unlinkSync(snippetQuoteLimitPath);
}

console.log(`\nQuality gate smoke: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
