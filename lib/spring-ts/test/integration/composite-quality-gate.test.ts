/**
 * Composite-classical behavior and regression gate.
 *
 * This test protects current runtime behavior. Phase-P label agreement is
 * historical observation data and must never become an authority or release
 * decision.
 */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeSaju } from '../../src/saju-adapter.js';
import type { BirthInfo } from '../../src/types.js';

interface BaselineFixture {
  readonly id: string;
  readonly label: string;
  readonly birth: BirthInfo;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_PATH = path.resolve(
  SPRING_TS_ROOT,
  'test/fixtures/spring_ts_baseline_cases.json',
);
const METRICS_PATH = path.resolve(
  SPRING_TS_ROOT,
  'metrics/bySourceTier.json',
);

const BASELINE_REF = process.env.COMPOSITE_GATE_BASELINE_REF ?? 'main';
const BRANCH_REF = process.env.COMPOSITE_GATE_BRANCH_REF ?? 'HEAD';

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, evidence?: string): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function comparableCount(tally: any): number {
  return Number(tally?.pass ?? 0) +
    Number(tally?.partial ?? 0) +
    Number(tally?.diff ?? 0);
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
      `default snapshot has no regression (${BASELINE_REF}..${BRANCH_REF})`,
      false,
      (stdout || stderr || error.message).trim().slice(0, 500),
    );
    return null;
  }
}

console.log('Composite-classical behavior and regression gate\n');

const regressionReport = runDefaultRegressionGate();
if (regressionReport) {
  check(
    `default snapshot has no unapproved diff (${BASELINE_REF}..${BRANCH_REF})`,
    regressionReport.unapprovedDiffs === 0,
    `diffs=${regressionReport.totalDiffs}, unapproved=${regressionReport.unapprovedDiffs}, approval=${regressionReport.approval?.status}`,
  );
}

const matrix = JSON.parse(execSync(
  'npm run measure:alternative-rules --silent -- --json',
  {
    cwd: SPRING_TS_ROOT,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  },
));
const monthlyMain = matrix.totals?.monthly_main;
const composite = matrix.totals?.composite_classical;
check(
  'historical matrix keeps composite selected agreement identical to monthly_main',
  Number.isFinite(monthlyMain?.pass) &&
    Number.isFinite(composite?.pass) &&
    composite.pass === monthlyMain.pass &&
    comparableCount(composite) === comparableCount(monthlyMain),
  `composite=${composite?.pass}/${comparableCount(composite)}, monthly=${monthlyMain?.pass}/${comparableCount(monthlyMain)}`,
);
check(
  'historical candidate coverage is present but not interpreted as authority',
  Number.isFinite(matrix.compositeCandidateCoverage?.covered) &&
    Number.isFinite(matrix.compositeCandidateCoverage?.comparable),
  JSON.stringify(matrix.compositeCandidateCoverage),
);

const bySourceTier = readJson<any>(METRICS_PATH);
const breakdown = bySourceTier.ruleModeBreakdown ?? {};
const compositeMode = breakdown.modes?.composite_classical;
check(
  'Phase-P metric is explicitly historical and release-ineligible',
  breakdown.authorityScope === 'historical_observation_only' &&
    breakdown.releaseEligible === false &&
    breakdown.historicalCompositeObservation?.releaseEligible === false &&
    !('compositeQualityGate' in breakdown),
);
check(
  'historical metric uses no current source-tier authority keys',
  Object.keys(compositeMode?.byHistoricalLabelTier ?? {}).sort().join(',') ===
      'phase_p_authored_interpretation_label,phase_p_primary_text_label' &&
    !('bySourceTier' in (compositeMode ?? {})) &&
    compositeMode?.selectionPolicy ===
      'historical_evidence_only_never_promote',
);

const fixtures = readJson<{ fixtures: readonly BaselineFixture[] }>(
  FIXTURE_PATH,
).fixtures;
const selectedJonggyeokFixtures: string[] = [];
const compositePromotionViolations: string[] = [];

for (const fixture of fixtures) {
  const summary = await analyzeSaju(fixture.birth);
  const candidates = summary.gyeokguk.candidates ?? [];
  const selectedJonggyeok = (
    summary.gyeokguk.jonggyeokCandidates ?? []
  ).some((candidate) => candidate.status === 'selected');
  const promotesComposite = candidates.some((candidate) =>
    candidate.compositeClassical?.selectionPolicy !==
      'evidence_only_never_promote' ||
    candidate.compositeClassical?.selectedByComposite !== false);

  if (selectedJonggyeok) selectedJonggyeokFixtures.push(fixture.id);
  if (promotesComposite) compositePromotionViolations.push(fixture.id);
}

check(
  'composite evidence never promotes a runtime candidate',
  compositePromotionViolations.length === 0,
  compositePromotionViolations.join(','),
);
check(
  'regular baseline selects no jonggyeok candidate',
  selectedJonggyeokFixtures.length === 0,
  selectedJonggyeokFixtures.join(','),
);

console.log(`\nComposite behavior gate: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
