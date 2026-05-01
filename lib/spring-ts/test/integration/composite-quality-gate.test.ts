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
const FIXTURE_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const METRICS_PATH = path.resolve(SPRING_TS_ROOT, 'metrics/bySourceTier.json');

const BASELINE_REF = process.env.COMPOSITE_GATE_BASELINE_REF ?? 'main';
const BRANCH_REF = process.env.COMPOSITE_GATE_BRANCH_REF ?? 'HEAD';
const MAX_SELECTED_JONGGYEOK_RATIO = 0;
const MONTHLY_MAIN_THRESHOLD = { minPass: 17, comparable: 27 };
const COMPOSITE_TOTAL_COVERAGE_THRESHOLD = { minCovered: 23, comparable: 27 };
const COMPOSITE_SOURCE_TIER_THRESHOLDS = {
  T3_AUTHORED_INTERPRETATION: { minCovered: 20, comparable: 21 },
  T4_PRIMARY_TEXT: { minCovered: 3, comparable: 6 },
} as const;
const COMPOSITE_SOURCE_GROUP_THRESHOLDS = [
  { id: 'lecture', sourceIndex: 0, minCovered: 14, comparable: 14 },
  { id: 'jonheom', sourceIndex: 1, minCovered: 3, comparable: 6 },
  { id: 'korean_modern_figures_and_chumyeongga', sourceIndex: 2, minCovered: 6, comparable: 7 },
] as const;

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

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function comparableCount(tally: any): number {
  return Number(tally?.pass ?? 0) + Number(tally?.partial ?? 0) + Number(tally?.diff ?? 0);
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

const matrix = JSON.parse(execSync('npm run measure:alternative-rules --silent -- --json', {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
}));

const monthlyMain = matrix.totals?.monthly_main;
const composite = matrix.totals?.composite_classical;
const monthlyComparable = comparableCount(monthlyMain);
const compositeComparable = comparableCount(composite);

check(
  'monthly_main authority subset selected agreement meets gate threshold',
  monthlyMain?.pass >= MONTHLY_MAIN_THRESHOLD.minPass &&
    monthlyComparable === MONTHLY_MAIN_THRESHOLD.comparable,
  `pass=${monthlyMain?.pass}, comparable=${monthlyComparable}`,
);
check(
  'composite_classical selected agreement does not regress against monthly_main',
  composite?.pass >= monthlyMain?.pass && compositeComparable === monthlyComparable,
  `composite=${composite?.pass}/${compositeComparable}, monthly=${monthlyMain?.pass}/${monthlyComparable}`,
);
check(
  'composite_classical total authority candidate coverage meets threshold',
  matrix.compositeCandidateCoverage?.covered >= COMPOSITE_TOTAL_COVERAGE_THRESHOLD.minCovered &&
    matrix.compositeCandidateCoverage?.comparable === COMPOSITE_TOTAL_COVERAGE_THRESHOLD.comparable,
  JSON.stringify(matrix.compositeCandidateCoverage),
);

const sourceTierCoverage: Record<string, { covered: number; comparable: number }> = {};
for (const [index, source] of (matrix.sources ?? []).entries()) {
  const tier = index === 1 ? 'T4_PRIMARY_TEXT' : 'T3_AUTHORED_INTERPRETATION';
  const bucket = sourceTierCoverage[tier] ?? { covered: 0, comparable: 0 };
  bucket.covered += Number(source.compositeCandidateCoverage?.covered ?? 0);
  bucket.comparable += Number(source.compositeCandidateCoverage?.comparable ?? 0);
  sourceTierCoverage[tier] = bucket;
}

for (const [tier, threshold] of Object.entries(COMPOSITE_SOURCE_TIER_THRESHOLDS)) {
  const coverage = sourceTierCoverage[tier];
  check(
    `${tier} composite authority candidate coverage meets gate threshold`,
    coverage?.covered >= threshold.minCovered && coverage?.comparable === threshold.comparable,
    JSON.stringify(coverage),
  );
}

for (const threshold of COMPOSITE_SOURCE_GROUP_THRESHOLDS) {
  const coverage = matrix.sources?.[threshold.sourceIndex]?.compositeCandidateCoverage;
  check(
    `${threshold.id} composite authority candidate coverage meets gate threshold`,
    coverage?.covered >= threshold.minCovered && coverage?.comparable === threshold.comparable,
    JSON.stringify(coverage),
  );
}

execSync('npm run metrics:baseline', {
  cwd: SPRING_TS_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});
const bySourceTier = readJson<any>(METRICS_PATH);
const compositeQualityGate = bySourceTier.ruleModeBreakdown?.compositeQualityGate;
check(
  'baseline metrics dashboard exposes composite quality gate status',
  compositeQualityGate?.status === 'PASS' &&
    Array.isArray(compositeQualityGate?.checks) &&
    compositeQualityGate.checks.length >= 7,
  `status=${compositeQualityGate?.status}, checks=${compositeQualityGate?.checks?.length}`,
);
check(
  'baseline metrics dashboard exposes source-tier composite performance',
  ['T3_AUTHORED_INTERPRETATION', 'T4_PRIMARY_TEXT'].every((tier) =>
    compositeQualityGate?.sourceTierDashboard?.[tier]?.candidateCoverage &&
    compositeQualityGate?.sourceTierDashboard?.[tier]?.nonRegression?.status === 'PASS'),
  JSON.stringify(compositeQualityGate?.sourceTierDashboard),
);

const fixtures = readJson<{ fixtures: readonly BaselineFixture[] }>(FIXTURE_PATH).fixtures;
const selectedJonggyeokFixtures: string[] = [];
for (const fixture of fixtures) {
  const summary = await analyzeSaju(fixture.birth);
  const selected = (summary.gyeokguk.jonggyeokCandidates ?? [])
    .some((candidate) => candidate.status === 'selected');
  if (selected) selectedJonggyeokFixtures.push(fixture.id);
}
const selectedJonggyeokRatio = fixtures.length > 0
  ? selectedJonggyeokFixtures.length / fixtures.length
  : 1;
check(
  'regular baseline selected jonggyeok ratio stays at zero',
  selectedJonggyeokRatio <= MAX_SELECTED_JONGGYEOK_RATIO,
  `selected=${selectedJonggyeokFixtures.length}/${fixtures.length}: ${selectedJonggyeokFixtures.join(',')}`,
);

console.log(`\nComposite quality gate: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
