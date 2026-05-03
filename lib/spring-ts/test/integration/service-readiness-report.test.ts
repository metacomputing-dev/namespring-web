/**
 * test/integration/service-readiness-report.test.ts
 *
 * Verifies that the frontend/commercial service readiness report stays
 * machine-readable and keeps launch-claim blockers explicit.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.resolve(SPRING_TS_ROOT, 'tools/service_readiness_report.mjs');
const PACKAGE_PATH = path.resolve(SPRING_TS_ROOT, 'package.json');

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

console.log('Service readiness report\n');

const stdout = execFileSync('node', [SCRIPT_PATH, '--json'], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const report = JSON.parse(stdout);
const humanStdout = execFileSync('node', [SCRIPT_PATH], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf-8'));

check('report schema version is stable',
  report?.schemaVersion === 'spring-ts.service-readiness-report.v1',
  report?.schemaVersion);
check('frontend handoff is ready for integration when density gaps are closed',
  report?.frontendHandoff?.status === 'ready_for_frontend_integration',
  report?.frontendHandoff?.status);
check('frontend checklist keeps all hard checks passing',
  Array.isArray(report?.frontendHandoff?.checks) &&
    report.frontendHandoff.checks.every((row: any) => row.status !== 'fail') &&
    report.frontendHandoff.checks.some((row: any) =>
      row.id === 'progressive_disclosure_runtime_contract' &&
      row.status === 'pass' &&
      String(row.evidence).includes('present')),
  JSON.stringify(report?.frontendHandoff?.checks));
check('frontend checklist exposes progressive disclosure test',
  report?.frontendHandoff?.tests?.progressiveDisclosure === true,
  JSON.stringify(report?.frontendHandoff?.tests));
check('frontend next steps are explicit',
  Array.isArray(report?.frontendHandoff?.nextFrontendSteps) &&
    report.frontendHandoff.nextFrontendSteps.some((step: string) => step.includes('surfaceTieredMatrix')) &&
    report.frontendHandoff.nextFrontendSteps.some((step: string) => step.includes('expert detail')),
  JSON.stringify(report?.frontendHandoff?.nextFrontendSteps));
check('commercial status blocks authority claims',
  report?.commercialReadiness?.status === 'blocked_for_authority_claims',
  report?.commercialReadiness?.status);
check('commercial blockers include authority truth blockers without density warning',
  Array.isArray(report?.commercialReadiness?.blockers) &&
    report.commercialReadiness.blockers.some((row: any) => row.id === 'no_authority_truth_fragments' && row.severity === 'blocker') &&
    report.commercialReadiness.blockers.some((row: any) => row.id === 'zero_authority_cells' && row.severity === 'blocker') &&
    !report.commercialReadiness.blockers.some((row: any) => row.id === 'invalid_reference_authority_intake') &&
    !report.commercialReadiness.blockers.some((row: any) => row.id === 'thin_expert_axis_values'),
  JSON.stringify(report?.commercialReadiness?.blockers));
check('reference authority intake is surfaced in readiness report',
  report?.authorityIntake?.status === 'PASS' &&
    report?.authorityIntake?.flatCaseCount === 0 &&
    report?.authorityIntake?.violationCount === 0 &&
    report?.metrics?.referenceAuthorityFlatCaseCount === report?.authorityIntake?.flatCaseCount &&
    report?.metrics?.referenceAuthorityIntakeViolationCount === report?.authorityIntake?.violationCount,
  JSON.stringify(report?.authorityIntake));
check('metrics expose current launch blockers',
  report?.metrics?.populatedCells === report?.metrics?.expectedCells &&
    report?.metrics?.expertInternalEvidenceBackedCells === report?.metrics?.expertCellCount &&
    report?.metrics?.authorityTruthEligibleFragmentCount === 0 &&
    report?.metrics?.authorityTruthEligibleNumericalEvidenceCount === 0 &&
    report?.metrics?.zeroAuthorityCellCount === report?.metrics?.expectedCells &&
    report?.metrics?.thinExpertAxisValueCount === report?.nextDensityTargets?.length,
  JSON.stringify(report?.metrics));
check('remaining density targets are machine readable',
  Array.isArray(report?.nextDensityTargets) &&
    report.nextDensityTargets.every((row: any) =>
      typeof row.field === 'string' &&
      typeof row.value === 'string' &&
      typeof row.authoredFragments === 'number'),
  String(report?.nextDensityTargets?.length ?? 0));
check('next authority work is exposed for paid-claim planning',
  Array.isArray(report?.nextAuthorityWork) &&
    report.nextAuthorityWork.length > 0 &&
    report.nextAuthorityWork.length <= 5 &&
    report.nextAuthorityWork[0].priorityClass === 'P0_EXPERT_INTERNAL_EVIDENCE_REVIEW' &&
    report.nextAuthorityWork.every((row: any) =>
      typeof row.category === 'string' &&
      typeof row.period === 'string' &&
      typeof row.depth === 'string' &&
      Array.isArray(row.neededEvidence) &&
      row.neededEvidence.includes('authority_fragment_source') &&
      Array.isArray(row.reviewExamples) &&
      row.reviewExamples.length > 0 &&
      row.reviewExamples.every((example: any) =>
        typeof example.fragmentId === 'string' &&
        typeof example.file === 'string' &&
        typeof example.numericalEvidenceCount === 'number')),
  JSON.stringify(report?.nextAuthorityWork));
check('human readiness output includes review example fragment handles',
  humanStdout.includes('Next authority work:') &&
    humanStdout.includes('example:') &&
    humanStdout.includes('.fragments.json'),
  humanStdout.split('\n').filter((line) => line.includes('example:')).slice(0, 2).join(' | '));
check('paid service gate script is registered',
  typeof packageJson?.scripts?.['service:readiness:paid-gate'] === 'string' &&
    packageJson.scripts['service:readiness:paid-gate'].includes('--max-thin-expert-axis-values=0') &&
    packageJson.scripts['service:readiness:paid-gate'].includes('--min-authority-fragments=1') &&
    packageJson.scripts['service:readiness:paid-gate'].includes('--max-zero-authority-cells=0') &&
    packageJson.scripts['service:readiness:paid-gate'].includes('--max-reference-authority-intake-violations=0'),
  packageJson?.scripts?.['service:readiness:paid-gate']);

const strictGate = spawnSync('node', [
  SCRIPT_PATH,
  '--json',
  '--max-thin-expert-axis-values=0',
  '--min-authority-fragments=1',
  '--min-authority-numerical-evidence=1',
  '--max-zero-authority-cells=0',
  '--max-reference-authority-intake-violations=0',
], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const strictReport = JSON.parse(strictGate.stdout);

check('strict paid-claim thresholds fail intentionally',
  strictGate.status === 1 &&
    !strictGate.stderr.includes('thin expert axis values') &&
    strictGate.stderr.includes('authorityTruthEligible fragments') &&
    strictGate.stderr.includes('authorityTruthEligible numericalEvidence') &&
    strictGate.stderr.includes('zero-authority cells'),
  `status=${strictGate.status}; stderr=${strictGate.stderr.trim()}`);
check('strict threshold deficits remain machine readable',
  strictReport?.thresholds?.maxThinExpertAxisValues === 0 &&
    strictReport?.thresholds?.minAuthorityTruthEligibleFragments === 1 &&
    strictReport?.thresholds?.minAuthorityTruthEligibleNumericalEvidence === 1 &&
    strictReport?.thresholds?.maxZeroAuthorityCells === 0 &&
    strictReport?.thresholds?.maxReferenceAuthorityIntakeViolations === 0 &&
    strictReport?.metrics?.thinExpertAxisValueCount === 0 &&
    strictReport?.metrics?.referenceAuthorityIntakeViolationCount === 0 &&
    strictReport?.metrics?.zeroAuthorityCellCount > 0,
  JSON.stringify({ thresholds: strictReport?.thresholds, metrics: strictReport?.metrics }));

console.log(`\nService readiness report: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
