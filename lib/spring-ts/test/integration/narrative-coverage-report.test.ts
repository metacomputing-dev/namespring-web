/**
 * test/integration/narrative-coverage-report.test.ts
 *
 * Verifies that the narrative coverage planning report remains machine-readable.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.resolve(SPRING_TS_ROOT, 'tools/narrative_coverage_report.mjs');

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

console.log('Narrative coverage report\n');

const stdout = execFileSync('node', [SCRIPT_PATH, '--json', '--min-authored=8'], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const report = JSON.parse(stdout);
const fieldsWithMissingAxisValues = Object.entries(report?.axisValueCoverage ?? {})
  .filter(([, coverage]: [string, any]) => (coverage?.missingValueCount ?? 0) > 0)
  .map(([field]) => field)
  .sort();

check('report schema version is stable',
  report?.schemaVersion === 'spring-ts.narrative-coverage-report.v1',
  report?.schemaVersion);
check('expected matrix size is 165 cells',
  report?.totals?.expectedCells === 165,
  String(report?.totals?.expectedCells));
check('all matrix cells are populated',
  report?.totals?.cellsWithFragments === report?.totals?.expectedCells,
  `${report?.totals?.cellsWithFragments}/${report?.totals?.expectedCells}`);
check('authored corpus remains above Phase 2 floor',
  report?.totals?.authoredFragmentCount >= 1600,
  String(report?.totals?.authoredFragmentCount));
check('agePhase is tracked as a gating axis',
  Array.isArray(report?.gatingFields) && report.gatingFields.includes('agePhase'));
for (const field of ['agePhase', 'birthSeason', 'currentSeason', 'dayMasterPolarity', 'yongshinElement']) {
  check(`${field} has authored branching coverage`,
    report?.axisUsage?.[field]?.fragmentCount > 0,
    String(report?.axisUsage?.[field]?.fragmentCount ?? 0));
}
check('axis usage is machine readable',
  report?.axisUsage?.gender && Array.isArray(report.axisUsage.gender.values));
check('axis value coverage is machine readable',
  report?.axisValueCoverage?.agePhase &&
    Array.isArray(report.axisValueCoverage.agePhase.expectedValues) &&
    Array.isArray(report.axisValueCoverage.agePhase.missingValues));
check('axis value density is machine readable',
  report?.axisValueDensity?.agePhase?.early_20s?.authoredFragments > 0,
  String(report?.axisValueDensity?.agePhase?.early_20s?.authoredFragments ?? 0));
check('axis value coverage confirms agePhase expansion is complete',
  report?.axisValueCoverage?.agePhase?.missingValueCount === 0 &&
    report.axisValueCoverage.agePhase.coveredValues?.length === 16,
  JSON.stringify(report?.axisValueCoverage?.agePhase));
check('axis value coverage confirms yongshinElement expansion is complete',
  report?.axisValueCoverage?.yongshinElement?.missingValueCount === 0 &&
    report.axisValueCoverage.yongshinElement.coveredValues?.length === 5,
  JSON.stringify(report?.axisValueCoverage?.yongshinElement));
check('axis value coverage has no missing expansion targets',
  fieldsWithMissingAxisValues.length === 0,
  fieldsWithMissingAxisValues.join(','));
check('underfilled cells are sorted planning records',
  Array.isArray(report?.underfilledCells) &&
    report.underfilledCells.every((cell: any) =>
      typeof cell.category === 'string' &&
      typeof cell.period === 'string' &&
      typeof cell.depth === 'string' &&
      typeof cell.authoredFragments === 'number'));
check('all cells meet the Phase 2 authored floor',
  Array.isArray(report?.underfilledCells) && report.underfilledCells.length === 0,
  String(report?.underfilledCells?.length ?? 0));
check('thin axis values are sorted planning records',
  Array.isArray(report?.thinAxisValues) &&
    report.thinAxisValues.every((row: any) =>
      typeof row.field === 'string' &&
      typeof row.value === 'string' &&
      typeof row.authoredFragments === 'number'));
check('thin axis values expose next density targets',
  report?.totals?.thinAxisValueCount === report?.thinAxisValues?.length &&
    report.thinAxisValues.every((row: any) => row.authoredFragments < 8),
  String(report?.totals?.thinAxisValueCount ?? 0));
check('all tracked axis values meet the authored density floor',
  report?.totals?.thinAxisValueCount === 0 &&
    Array.isArray(report?.thinAxisValues) &&
    report.thinAxisValues.length === 0,
  String(report?.totals?.thinAxisValueCount ?? 0));
check('thin axis field summary is machine readable',
  Array.isArray(report?.thinAxisFieldSummary) &&
    report.thinAxisFieldSummary.every((row: any) =>
      typeof row.field === 'string' &&
      typeof row.thinValueCount === 'number' &&
      typeof row.authoredDeficitToThreshold === 'number'));
check('thin axis field summary is empty when the density floor is met',
  Array.isArray(report?.thinAxisFieldSummary) &&
    report.thinAxisFieldSummary.length === 0,
  String(report?.thinAxisFieldSummary?.length ?? 0));
check('thin axis field summary prioritizes largest remaining deficit',
  Array.isArray(report?.thinAxisFieldSummary) &&
    report.thinAxisFieldSummary.every((row: any, index: number, rows: any[]) =>
      index === 0 ||
      rows[index - 1].authoredDeficitToThreshold >= row.authoredDeficitToThreshold),
  JSON.stringify(report?.thinAxisFieldSummary?.[0]));
check('expert numerical evidence threshold is reported',
  report?.minExpertNumericalEvidenceThreshold === 1,
  String(report?.minExpertNumericalEvidenceThreshold ?? ''));
check('expert numerical evidence cell totals are machine readable',
  typeof report?.totals?.expertCellCount === 'number' &&
    typeof report?.totals?.expertCellsWithNumericalEvidenceCount === 'number' &&
    typeof report?.totals?.expertNumericalEvidenceGapCellCount === 'number');
check('expert numerical evidence gap cells are planning records',
  Array.isArray(report?.expertNumericalEvidenceGapCells) &&
    report.expertNumericalEvidenceGapCells.every((cell: any) =>
      typeof cell.category === 'string' &&
      typeof cell.period === 'string' &&
      cell.depth === 'expert' &&
      typeof cell.authoredFragments === 'number' &&
      typeof cell.expertNumericalEvidenceFragments === 'number' &&
      typeof cell.deficit === 'number'));
check('expert numerical evidence gap count matches records',
  report?.totals?.expertNumericalEvidenceGapCellCount === report?.expertNumericalEvidenceGapCells?.length,
  String(report?.totals?.expertNumericalEvidenceGapCellCount ?? ''));
check('expert numerical evidence coverage is complete',
  report?.totals?.expertCellsWithNumericalEvidenceCount === report?.totals?.expertCellCount &&
    report?.totals?.expertNumericalEvidenceGapCellCount === 0,
  `${report?.totals?.expertCellsWithNumericalEvidenceCount ?? 0}/${report?.totals?.expertCellCount ?? 0}`);
check('source tier summary is machine readable',
  typeof report?.sourceTierSummary?.fragmentTierCounts === 'object' &&
    typeof report?.sourceTierSummary?.numericalEvidenceTierCounts === 'object' &&
    typeof report?.sourceTierSummary?.numericalEvidenceRecordCount === 'number' &&
    typeof report?.sourceTierSummary?.authorityTruthEligibleFragmentCount === 'number' &&
    typeof report?.sourceTierSummary?.authorityTruthEligibleNumericalEvidenceCount === 'number');
check('source tier summary exposes current evidence tiers',
  report?.sourceTierSummary?.fragmentTierCounts?.T1_HYPOTHESIS > 0 &&
    report?.sourceTierSummary?.numericalEvidenceTierCounts?.T3_INTERNAL_ENGINE >= 55,
  JSON.stringify(report?.sourceTierSummary));

console.log(`\nNarrative coverage report: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
