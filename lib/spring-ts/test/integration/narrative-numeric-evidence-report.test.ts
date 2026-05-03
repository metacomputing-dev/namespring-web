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
check('new ordinal axes have entered the evidence corpus',
  ['feature.agePhaseOrdinal', 'feature.dayMasterStrengthOrdinal', 'feature.birthSeasonOrdinal', 'feature.currentSeasonOrdinal']
    .every((pathKey) => expressionsByKey[pathKey]?.count >= 1),
  JSON.stringify(report?.expressions));
check('all available numeric paths are now used at least once',
  Array.isArray(report?.unusedAvailablePaths) &&
    report.unusedAvailablePaths.length === 0 &&
    report?.totals?.unusedAvailablePathCount === 0,
  JSON.stringify(report?.unusedAvailablePaths));
check('source tier counts are machine readable',
  report?.sourceTierCounts?.T3_INTERNAL_ENGINE >= 55,
  JSON.stringify(report?.sourceTierCounts));
check('cell count rows obey --max-top-rows',
  Array.isArray(report?.cellCounts) &&
    report.cellCounts.length <= 5 &&
    report.cellCounts.every((row: any) => typeof row.key === 'string' && typeof row.count === 'number'),
  String(report?.cellCounts?.length ?? 0));
check('expert bundle evidence gap records obey --max-top-rows',
  report?.totals?.expertBundleCount > 0 &&
    report?.totals?.expertBundlesWithNumericalEvidenceCount > 0 &&
    report?.totals?.expertBundlesWithoutNumericalEvidenceCount >= 0 &&
    Array.isArray(report?.expertBundlesWithoutNumericalEvidence) &&
    report.expertBundlesWithoutNumericalEvidence.length <= 5 &&
    report.expertBundlesWithoutNumericalEvidence.every((row: any) =>
      typeof row.file === 'string' &&
      typeof row.bundleId === 'string' &&
      typeof row.expertFragmentCount === 'number' &&
      typeof row.numericalEvidenceRecordCount === 'number'),
  `${report?.expertBundlesWithoutNumericalEvidence?.length ?? 0}/${report?.totals?.expertBundlesWithoutNumericalEvidenceCount ?? 0}`);
check('thresholds default to observation mode',
  report?.minExpressionUsageThreshold === 1 &&
  report?.maxUnknownExpressionThreshold === null &&
    report?.maxUnusedAvailablePathThreshold === null &&
    report?.maxThinAvailablePathThreshold === null &&
    report?.maxExpertBundlesWithoutNumericalEvidenceThreshold === null &&
    report?.totals?.unknownExpressionExcessToThreshold === 0 &&
    report?.totals?.unusedAvailablePathExcessToThreshold === 0 &&
    report?.totals?.thinAvailablePathExcessToThreshold === 0 &&
    report?.totals?.expertBundleNumericalEvidenceGapExcessToThreshold === 0,
  JSON.stringify({
    minUsage: report?.minExpressionUsageThreshold,
    unknown: report?.maxUnknownExpressionThreshold,
    unused: report?.maxUnusedAvailablePathThreshold,
    thin: report?.maxThinAvailablePathThreshold,
    expertBundleGaps: report?.maxExpertBundlesWithoutNumericalEvidenceThreshold,
  }));
check('thin available path records are machine readable',
  Array.isArray(report?.thinAvailablePaths) &&
    report.thinAvailablePaths.length === 0);

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
check('unused available path threshold can pass when target is met',
  unusedGate.status === 0 &&
    unusedGateReport?.maxUnusedAvailablePathThreshold === 0,
  `status=${unusedGate.status}; stderr=${unusedGate.stderr.trim()}`);
check('unused available path threshold excess is machine readable',
  unusedGateReport?.totals?.unusedAvailablePathExcessToThreshold === 0 &&
    unusedGateReport?.totals?.unusedAvailablePathCount === 0,
  `${unusedGateReport?.totals?.unusedAvailablePathExcessToThreshold ?? 0}/${unusedGateReport?.totals?.unusedAvailablePathCount ?? 0}`);

const expertBundleGapGate = spawnSync('node', [
  SCRIPT_PATH,
  '--json',
  '--max-top-rows=3',
  '--max-expert-bundles-without-numerical-evidence=0',
], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const expertBundleGapGateReport = JSON.parse(expertBundleGapGate.stdout);
check('expert bundle numerical evidence gap threshold can fail CI intentionally',
  expertBundleGapGate.status === 1 &&
    expertBundleGapGate.stderr.includes('expert bundles without numericalEvidence') &&
    expertBundleGapGateReport?.maxExpertBundlesWithoutNumericalEvidenceThreshold === 0 &&
    expertBundleGapGateReport?.totals?.expertBundlesWithoutNumericalEvidenceCount > 0,
  `status=${expertBundleGapGate.status}; stderr=${expertBundleGapGate.stderr.trim()}`);
check('expert bundle numerical evidence gap threshold excess is machine readable',
  expertBundleGapGateReport?.totals?.expertBundleNumericalEvidenceGapExcessToThreshold ===
    expertBundleGapGateReport?.totals?.expertBundlesWithoutNumericalEvidenceCount &&
    Array.isArray(expertBundleGapGateReport?.expertBundlesWithoutNumericalEvidence) &&
    expertBundleGapGateReport.expertBundlesWithoutNumericalEvidence.length <= 3,
  `${expertBundleGapGateReport?.totals?.expertBundleNumericalEvidenceGapExcessToThreshold ?? 0}/${expertBundleGapGateReport?.totals?.expertBundlesWithoutNumericalEvidenceCount ?? 0}`);

const thinGate = spawnSync('node', [
  SCRIPT_PATH,
  '--json',
  '--min-expression-usage=18',
  '--max-thin-available-paths=0',
], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const thinGateReport = JSON.parse(thinGate.stdout);
check('thin available path threshold can pass at the current density floor',
  thinGate.status === 0 &&
    thinGateReport?.minExpressionUsageThreshold === 18 &&
    thinGateReport?.maxThinAvailablePathThreshold === 0,
  `status=${thinGate.status}; stderr=${thinGate.stderr.trim()}`);
check('thin available path threshold excess is machine readable',
  thinGateReport?.totals?.thinAvailablePathExcessToThreshold === 0 &&
    thinGateReport?.totals?.thinAvailablePathCount === 0 &&
    Array.isArray(thinGateReport?.thinAvailablePaths) &&
    thinGateReport.thinAvailablePaths.length === 0,
  `${thinGateReport?.totals?.thinAvailablePathExcessToThreshold ?? 0}/${thinGateReport?.totals?.thinAvailablePathCount ?? 0}`);

const strictThinGate = spawnSync('node', [
  SCRIPT_PATH,
  '--json',
  '--min-expression-usage=19',
  '--max-thin-available-paths=0',
], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const strictThinGateReport = JSON.parse(strictThinGate.stdout);
check('stricter thin available path threshold can fail CI intentionally',
  strictThinGate.status === 1 &&
    strictThinGate.stderr.includes('thin available numeric paths') &&
    strictThinGateReport?.minExpressionUsageThreshold === 19 &&
    strictThinGateReport?.maxThinAvailablePathThreshold === 0,
  `status=${strictThinGate.status}; stderr=${strictThinGate.stderr.trim()}`);
check('stricter thin available path threshold excess is machine readable',
  strictThinGateReport?.totals?.thinAvailablePathExcessToThreshold ===
    strictThinGateReport?.totals?.thinAvailablePathCount &&
    strictThinGateReport?.thinAvailablePaths?.every((row: any) =>
      typeof row.expression === 'string' &&
      typeof row.count === 'number' &&
      typeof row.requiredCount === 'number' &&
      typeof row.deficit === 'number'),
  `${strictThinGateReport?.totals?.thinAvailablePathExcessToThreshold ?? 0}/${strictThinGateReport?.totals?.thinAvailablePathCount ?? 0}`);

console.log(`\nNarrative numeric evidence report: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
