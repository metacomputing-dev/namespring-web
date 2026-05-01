/**
 * test/integration/composite-quality-gate.test.ts
 *
 * PR-4.6 gate for composite_classical merge readiness.
 *
 * Run:
 *   npm run test:composite-quality-gate
 *
 * CI may override refs:
 *   COMPOSITE_GATE_BASELINE_REF=origin/main
 *   COMPOSITE_GATE_BRANCH_REF=HEAD
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

const BASELINE_REF = process.env.COMPOSITE_GATE_BASELINE_REF ?? 'main';
const BRANCH_REF = process.env.COMPOSITE_GATE_BRANCH_REF ?? 'HEAD';

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

function runDefaultRegressionGate(): any | null {
  try {
    const stdout = execFileSync(
      process.execPath,
      [
        'tools/measure_regression.mjs',
        '--baseline',
        BASELINE_REF,
        '--branch',
        BRANCH_REF,
        '--json',
      ],
      {
        cwd: SPRING_TS_ROOT,
        encoding: 'utf-8',
      },
    );
    return JSON.parse(stdout);
  } catch (error: any) {
    const stdout = error?.stdout?.toString?.() ?? '';
    const stderr = error?.stderr?.toString?.() ?? '';
    check(
      `monthly_main default snapshot has no regression (${BASELINE_REF}..${BRANCH_REF})`,
      false,
      (stdout || stderr || error.message).trim().slice(0, 500),
    );
    return null;
  }
}

console.log('PR-4.6 composite quality gate: monthly_main default\n');

const regressionReport = runDefaultRegressionGate();
if (regressionReport) {
  check(
    `monthly_main default snapshot has no regression (${BASELINE_REF}..${BRANCH_REF})`,
    regressionReport.totalDiffs === 0,
    `diffs=${regressionReport.totalDiffs}`,
  );
}

console.log(`\nComposite quality gate: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
