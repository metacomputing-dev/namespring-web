/**
 * test/integration/narrative-numeric-evidence-report.test.ts
 *
 * Verifies that numericalEvidence expression usage remains machine-readable.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.resolve(SPRING_TS_ROOT, 'tools/narrative_numeric_evidence_report.mjs');

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

console.log('Narrative numeric evidence report\n');

const stdout = execFileSync('node', [SCRIPT_PATH, '--json', '--max-top-rows=5'], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const report = JSON.parse(stdout);
const expressionsByKey = Object.fromEntries((report?.expressions ?? []).map((row: any) => [row.key, row]));

check('report schema version is stable',
  report?.schemaVersion === 'spring-ts.narrative-numeric-evidence-report.v1',
  report?.schemaVersion);
check('available numeric paths include new ordinal axes',
  ['feature.agePhaseOrdinal', 'feature.dayMasterStrengthOrdinal', 'feature.birthSeasonOrdinal', 'feature.currentSeasonOrdinal']
    .every((pathKey) => report?.availableNumericPaths?.includes(pathKey)),
  JSON.stringify(report?.availableNumericPaths));
check('current corpus uses existing age and star expressions',
  expressionsByKey['feature.ageYears']?.count > 0 &&
    expressionsByKey['cell.stars']?.count > 0,
  JSON.stringify(report?.expressions));
check('current corpus has only safe known numerical expressions',
  report?.totals?.unknownExpressionCount === 0 &&
    Array.isArray(report?.unknownExpressionRecords) &&
    report.unknownExpressionRecords.length === 0,
  String(report?.totals?.unknownExpressionCount ?? ''));
check('new ordinal axes are exposed as unused expansion targets',
  ['feature.agePhaseOrdinal', 'feature.dayMasterStrengthOrdinal', 'feature.birthSeasonOrdinal', 'feature.currentSeasonOrdinal']
    .every((pathKey) => report?.unusedAvailablePaths?.includes(pathKey)),
  JSON.stringify(report?.unusedAvailablePaths));
check('source tier counts are machine readable',
  report?.sourceTierCounts?.T3_INTERNAL_ENGINE >= 55,
  JSON.stringify(report?.sourceTierCounts));
check('cell count rows obey --max-top-rows',
  Array.isArray(report?.cellCounts) &&
    report.cellCounts.length <= 5 &&
    report.cellCounts.every((row: any) => typeof row.key === 'string' && typeof row.count === 'number'),
  String(report?.cellCounts?.length ?? 0));
check('thresholds default to observation mode',
  report?.maxUnknownExpressionThreshold === null &&
    report?.maxUnusedAvailablePathThreshold === null &&
    report?.totals?.unknownExpressionExcessToThreshold === 0 &&
    report?.totals?.unusedAvailablePathExcessToThreshold === 0,
  JSON.stringify({
    unknown: report?.maxUnknownExpressionThreshold,
    unused: report?.maxUnusedAvailablePathThreshold,
  }));

const unknownGate = spawnSync('node', [
  SCRIPT_PATH,
  '--json',
  '--max-unknown-expressions=0',
], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const unknownGateReport = JSON.parse(unknownGate.stdout);
check('unknown expression threshold can pass when target is met',
  unknownGate.status === 0 &&
    unknownGateReport?.totals?.unknownExpressionExcessToThreshold === 0,
  `status=${unknownGate.status}; stderr=${unknownGate.stderr.trim()}`);

const unusedGate = spawnSync('node', [
  SCRIPT_PATH,
  '--json',
  '--max-unused-available-paths=0',
], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const unusedGateReport = JSON.parse(unusedGate.stdout);
check('unused available path threshold can fail CI intentionally',
  unusedGate.status === 1 &&
    unusedGate.stderr.includes('unused available numeric paths') &&
    unusedGateReport?.maxUnusedAvailablePathThreshold === 0,
  `status=${unusedGate.status}; stderr=${unusedGate.stderr.trim()}`);
check('unused available path threshold excess is machine readable',
  unusedGateReport?.totals?.unusedAvailablePathExcessToThreshold ===
    unusedGateReport?.totals?.unusedAvailablePathCount,
  `${unusedGateReport?.totals?.unusedAvailablePathExcessToThreshold ?? 0}/${unusedGateReport?.totals?.unusedAvailablePathCount ?? 0}`);

console.log(`\nNarrative numeric evidence report: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
