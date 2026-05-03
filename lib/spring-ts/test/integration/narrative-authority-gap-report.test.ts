/**
 * test/integration/narrative-authority-gap-report.test.ts
 *
 * Verifies that the authority evidence planning report remains machine-readable.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.resolve(SPRING_TS_ROOT, 'tools/narrative_authority_gap_report.mjs');

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

console.log('Narrative authority gap report\n');

const stdout = execFileSync('node', [SCRIPT_PATH, '--json', '--max-top-cells=5'], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const report = JSON.parse(stdout);

check('report schema version is stable',
  report?.schemaVersion === 'spring-ts.narrative-authority-gap-report.v1',
  report?.schemaVersion);
check('authority thresholds default to observation mode',
  report?.minAuthorityTruthEligibleFragmentThreshold === 0 &&
    report?.minAuthorityTruthEligibleNumericalEvidenceThreshold === 0 &&
    report?.maxZeroAuthorityCellThreshold === null &&
    report?.totals?.zeroAuthorityCellExcessToThreshold === 0,
  JSON.stringify({
    fragment: report?.minAuthorityTruthEligibleFragmentThreshold,
    evidence: report?.minAuthorityTruthEligibleNumericalEvidenceThreshold,
    zeroCell: report?.maxZeroAuthorityCellThreshold,
  }));
check('source tier summary is carried through',
  report?.sourceTierSummary?.fragmentTierCounts?.T1_HYPOTHESIS > 0 &&
    report?.sourceTierSummary?.numericalEvidenceTierCounts?.T3_INTERNAL_ENGINE >= 55,
  JSON.stringify(report?.sourceTierSummary));
check('current corpus has no authority-truth eligible fragments yet',
  report?.totals?.authorityTruthEligibleFragmentCount === 0 &&
    report?.totals?.authorityTruthEligibleNumericalEvidenceCount === 0,
  `${report?.totals?.authorityTruthEligibleFragmentCount}/${report?.totals?.authorityTruthEligibleNumericalEvidenceCount}`);
check('zero-authority cells are counted across the full matrix',
  report?.totals?.zeroAuthorityCellCount === report?.totals?.expectedCells &&
    report?.totals?.expectedCells === 165,
  `${report?.totals?.zeroAuthorityCellCount}/${report?.totals?.expectedCells}`);
check('zero-authority cell records obey --max-top-cells',
  Array.isArray(report?.zeroAuthorityCells) &&
    report.zeroAuthorityCells.length <= 5 &&
    report.zeroAuthorityCells.every((cell: any) =>
      typeof cell.category === 'string' &&
      typeof cell.period === 'string' &&
      typeof cell.depth === 'string' &&
      typeof cell.authoredFragments === 'number' &&
      typeof cell.expertNumericalEvidenceFragments === 'number' &&
      typeof cell.authorityTruthEligibleFragments === 'number' &&
      typeof cell.authorityTruthEligibleNumericalEvidenceRecords === 'number'),
  String(report?.zeroAuthorityCells?.length ?? 0));
check('expert authority evidence gaps are machine readable',
  Array.isArray(report?.expertAuthorityEvidenceGapCells) &&
    report.expertAuthorityEvidenceGapCells.length <= 5 &&
    report.expertAuthorityEvidenceGapCells.every((cell: any) =>
      cell.depth === 'expert' &&
      typeof cell.expertNumericalEvidenceFragments === 'number' &&
      cell.authorityTruthEligibleNumericalEvidenceRecords === 0),
  String(report?.expertAuthorityEvidenceGapCells?.length ?? 0));
check('grouped summaries are machine readable',
  ['byCategory', 'byPeriod', 'byDepth'].every((field) =>
    Array.isArray(report?.[field]) &&
      report[field].every((row: any) =>
        typeof row.key === 'string' &&
        typeof row.cellCount === 'number' &&
        typeof row.zeroAuthorityCellCount === 'number' &&
        typeof row.authoredFragments === 'number' &&
        typeof row.authorityTruthEligibleFragments === 'number' &&
        typeof row.authorityTruthEligibleNumericalEvidenceRecords === 'number')));
check('depth summary covers brief, standard, and expert',
  ['brief', 'standard', 'expert'].every((depth) =>
    report?.byDepth?.some((row: any) => row.key === depth)),
  report?.byDepth?.map((row: any) => row.key).join(','));
check('category summary zero-authority counts aggregate to the matrix count',
  report?.byCategory?.reduce((sum: number, row: any) => sum + row.zeroAuthorityCellCount, 0) ===
    report?.totals?.zeroAuthorityCellCount,
  String(report?.totals?.zeroAuthorityCellCount ?? 0));

const zeroCellGate = spawnSync('node', [
  SCRIPT_PATH,
  '--json',
  '--max-zero-authority-cells=0',
], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const zeroCellGateReport = JSON.parse(zeroCellGate.stdout);
check('zero-authority cell threshold can fail CI intentionally',
  zeroCellGate.status === 1 &&
    zeroCellGate.stderr.includes('zero-authority cells') &&
    zeroCellGateReport?.maxZeroAuthorityCellThreshold === 0,
  `status=${zeroCellGate.status}; stderr=${zeroCellGate.stderr.trim()}`);
check('zero-authority threshold excess is machine readable',
  zeroCellGateReport?.totals?.zeroAuthorityCellExcessToThreshold ===
    zeroCellGateReport?.totals?.zeroAuthorityCellCount,
  `${zeroCellGateReport?.totals?.zeroAuthorityCellExcessToThreshold ?? 0}/${zeroCellGateReport?.totals?.zeroAuthorityCellCount ?? 0}`);

const authorityGate = spawnSync('node', [
  SCRIPT_PATH,
  '--json',
  '--min-authority-fragments=1',
  '--min-authority-numerical-evidence=1',
], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const authorityGateReport = JSON.parse(authorityGate.stdout);
check('authority source thresholds can fail CI intentionally',
  authorityGate.status === 1 &&
    authorityGate.stderr.includes('authorityTruthEligible fragments 0/1') &&
    authorityGate.stderr.includes('authorityTruthEligible numericalEvidence 0/1'),
  `status=${authorityGate.status}; stderr=${authorityGate.stderr.trim()}`);
check('authority source deficits are machine readable',
  authorityGateReport?.totals?.authorityTruthEligibleFragmentDeficitToThreshold === 1 &&
    authorityGateReport?.totals?.authorityTruthEligibleNumericalEvidenceDeficitToThreshold === 1,
  JSON.stringify(authorityGateReport?.totals));

console.log(`\nNarrative authority gap report: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
