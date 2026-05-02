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

const stdout = execFileSync('node', [SCRIPT_PATH, '--json', '--min-authored=5'], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const report = JSON.parse(stdout);

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
check('axis value gaps identify future agePhase expansion targets',
  report?.axisValueCoverage?.agePhase?.missingValues?.includes('late_40s'),
  String(report?.axisValueCoverage?.agePhase?.missingValues?.length ?? 0));
check('axis value gaps identify future yongshinElement expansion targets',
  report?.axisValueCoverage?.yongshinElement?.missingValues?.includes('WOOD'),
  (report?.axisValueCoverage?.yongshinElement?.missingValues ?? []).join(','));
check('underfilled cells are sorted planning records',
  Array.isArray(report?.underfilledCells) &&
    report.underfilledCells.every((cell: any) =>
      typeof cell.category === 'string' &&
      typeof cell.period === 'string' &&
      typeof cell.depth === 'string' &&
      typeof cell.authoredFragments === 'number'));

console.log(`\nNarrative coverage report: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
