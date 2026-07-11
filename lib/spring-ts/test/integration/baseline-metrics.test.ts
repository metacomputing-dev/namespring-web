/**
 * test/integration/baseline-metrics.test.ts
 *
 * Verifies Phase 0 baseline dashboard artifacts.
 *
 * Run: npm run test:baseline-metrics
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  D1_REQUIRED_DOCTRINE_FIELDS,
  D1_REQUIRED_NAMING_FIELDS,
} from '../../tools/quality-gate/d1.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const METRICS_DIR = path.resolve(SPRING_TS_ROOT, 'metrics');

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

function readMetric(dir: string, fileName: string): any {
  return JSON.parse(fs.readFileSync(path.join(dir, fileName), 'utf-8'));
}

function generateMetrics(outDir: string): Record<string, any> {
  execFileSync('npx', ['tsx', 'scripts/compute-rpi.ts', '--out-dir', outDir], {
    cwd: SPRING_TS_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  return {
    bySourceTier: readMetric(outDir, 'bySourceTier.json'),
    sourceTierSummary: readMetric(outDir, 'source-tier-summary.json'),
    rpiSummary: readMetric(outDir, 'rpi-summary.json'),
  };
}

console.log('Phase 0 baseline metrics test\n');

const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-baseline-metrics-a-'));
const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-baseline-metrics-b-'));
const generatedA = generateMetrics(tmpA);
const generatedB = generateMetrics(tmpB);
const committed = {
  bySourceTier: readMetric(METRICS_DIR, 'bySourceTier.json'),
  sourceTierSummary: readMetric(METRICS_DIR, 'source-tier-summary.json'),
  rpiSummary: readMetric(METRICS_DIR, 'rpi-summary.json'),
};
const { bySourceTier, sourceTierSummary, rpiSummary } = generatedA;

check('baseline metrics generation is deterministic',
  JSON.stringify(generatedA) === JSON.stringify(generatedB));
check('committed baseline metrics match generated output',
  JSON.stringify(committed) === JSON.stringify(generatedA));

check('bySourceTier schema version is current',
  bySourceTier.schemaVersion === 'spring-ts.by-source-tier.v2');
check('source-tier and RPI summary schema versions are current',
  sourceTierSummary.schemaVersion === 'spring-ts.source-tier-summary.v2' &&
    rpiSummary.schemaVersion === 'spring-ts.rpi-summary.v2');
check('source tier summary scans the Phase 0 source ledger',
  sourceTierSummary.scanned >= 51,
  `scanned=${sourceTierSummary.scanned}`);
check('source tier governance status matches the RPI governance axis',
  sourceTierSummary.status === rpiSummary.axisScores?.G_validationGovernance?.status &&
    sourceTierSummary.violationCount === rpiSummary.axisScores?.G_validationGovernance?.sourceTierViolations,
  `status=${sourceTierSummary.status}, violations=${sourceTierSummary.violationCount}`);
check('declared-scope source-record accounting is explicit and complete',
  sourceTierSummary.declaredScopeEligibleSourceRecordCount +
      sourceTierSummary.declaredScopeIneligibleSourceRecordCount === sourceTierSummary.scanned &&
    sourceTierSummary.eligibilityDefinition.includes('not complete D1 fixture truth') &&
    !('authorityTruthEligibleCount' in sourceTierSummary) &&
    !('nonEligibleCount' in sourceTierSummary));

const d1TruthCoverage = bySourceTier.d1TruthCoverage;
const d1RequiredFields = [
  ...D1_REQUIRED_DOCTRINE_FIELDS,
  ...D1_REQUIRED_NAMING_FIELDS,
];
const d1Rows = d1TruthCoverage?.fixtures ?? [];
check('D1 truth coverage owns the canonical seven-field contract',
  d1TruthCoverage?.requiredFieldCount === 7 &&
    JSON.stringify(d1TruthCoverage?.requiredFields) === JSON.stringify(d1RequiredFields) &&
    d1TruthCoverage?.fixtureCount === bySourceTier.baseline?.fixtureCount &&
    d1Rows.length === d1TruthCoverage?.fixtureCount);
check('D1 COMPLETE, PARTIAL, and NONE counts are exhaustive',
  d1TruthCoverage?.completeFixtureCount +
      d1TruthCoverage?.partialFixtureCount +
      d1TruthCoverage?.noneFixtureCount === d1Rows.length &&
    d1TruthCoverage?.completeFixtureCount ===
      d1Rows.filter((row: any) => row.coverageStatus === 'COMPLETE').length &&
    d1TruthCoverage?.partialFixtureCount ===
      d1Rows.filter((row: any) => row.coverageStatus === 'PARTIAL').length &&
    d1TruthCoverage?.noneFixtureCount ===
      d1Rows.filter((row: any) => row.coverageStatus === 'NONE').length);
check('D1 fixture rows obey field-count and component-completeness invariants',
  d1Rows.every((row: any) => {
    const covered = d1RequiredFields.length - row.missingRequiredFields.length;
    const status = covered === 7 ? 'COMPLETE' : covered > 0 ? 'PARTIAL' : 'NONE';
    const doctrineComplete = D1_REQUIRED_DOCTRINE_FIELDS
      .every((field) => !row.missingRequiredFields.includes(field));
    const namingComplete = D1_REQUIRED_NAMING_FIELDS
      .every((field) => !row.missingRequiredFields.includes(field));
    return row.coveredFieldCount === covered &&
      row.coverageStatus === status &&
      row.doctrineComplete === doctrineComplete &&
      row.namingCalibrationComplete === namingComplete &&
      !('authorityTruthEligible' in row) &&
      !('completeD1TruthEligible' in row);
  }));

const qByTier = bySourceTier.qualityGateByReferenceTier ?? {};
const tierFixtureTotal = Object.values(qByTier)
  .reduce((sum: number, bucket: any) => sum + (bucket.fixtureCount ?? 0), 0);
check('reference-tier fixture buckets cover the full baseline',
  tierFixtureTotal === bySourceTier.baseline?.fixtureCount,
  `bucketed=${tierFixtureTotal}, baseline=${bySourceTier.baseline?.fixtureCount}`);
check('non-authority reference fixtures remain visible',
  !!qByTier.T2_REFERENCE_IMPLEMENTATION || !!qByTier.NO_REFERENCE,
  `tiers=${Object.keys(qByTier).join(', ')}`);
check('T2 reference fixtures do not become authority truth',
  qByTier.T2_REFERENCE_IMPLEMENTATION?.truthBuckets?.insufficient_source_truth === qByTier.T2_REFERENCE_IMPLEMENTATION?.fixtureCount &&
    qByTier.T2_REFERENCE_IMPLEMENTATION?.truthBuckets?.authority_match === 0,
  JSON.stringify(qByTier.T2_REFERENCE_IMPLEMENTATION?.truthBuckets));
check('NO_REFERENCE fixtures do not become authority truth',
  qByTier.NO_REFERENCE?.truthBuckets?.insufficient_source_truth === qByTier.NO_REFERENCE?.fixtureCount &&
    qByTier.NO_REFERENCE?.truthBuckets?.authority_match === 0,
  JSON.stringify(qByTier.NO_REFERENCE?.truthBuckets));

check('insufficient source truth is separated from engine rule failure',
  bySourceTier.truthSeparation?.engineRuleFailureCount === 0 &&
    bySourceTier.truthSeparation?.insufficientSourceTruthCount >= 0,
  JSON.stringify(bySourceTier.truthSeparation));

const modes = bySourceTier.ruleModeBreakdown?.modes ?? {};
check('monthly_main rule mode is present', !!modes.monthly_main);
check('jungki_transparent rule mode is present', !!modes.jungki_transparent);
check('composite_classical rule mode is present', !!modes.composite_classical);
check('Phase-P rule modes are explicitly historical and release-ineligible',
  bySourceTier.ruleModeBreakdown?.authorityScope === 'historical_observation_only' &&
    bySourceTier.ruleModeBreakdown?.releaseEligible === false &&
    Object.values(modes).every((mode: any) =>
      mode.measurementClassification === 'HISTORICAL_PHASE_P_OBSERVATION' &&
      mode.authorityScope === 'historical_observation_only' &&
      mode.releaseEligible === false) &&
    !('compositeQualityGate' in (bySourceTier.ruleModeBreakdown ?? {})));
check('rule modes expose historical total win/loss vs monthly_main',
  typeof modes.jungki_transparent?.historicalWinLossVsMonthlyMain?.wins === 'number' &&
    typeof modes.jungki_transparent?.historicalWinLossVsMonthlyMain?.losses === 'number',
  JSON.stringify(modes.jungki_transparent?.historicalWinLossVsMonthlyMain));
check('rule modes expose historical-label-tier comparisons without current T3/T4 keys',
  Object.keys(modes.jungki_transparent?.byHistoricalLabelTier ?? {}).sort().join(',') ===
      'phase_p_authored_interpretation_label,phase_p_primary_text_label' &&
    Object.values(modes.jungki_transparent?.byHistoricalLabelTier ?? {}).every((bucket: any) =>
      typeof bucket?.historicalWinLossVsMonthlyMain?.wins === 'number' &&
      typeof bucket?.historicalWinLossVsMonthlyMain?.losses === 'number' &&
      bucket?.releaseEligible === false) &&
    !('bySourceTier' in modes.jungki_transparent),
  JSON.stringify(modes.jungki_transparent?.byHistoricalLabelTier));
check('composite_classical is classified as historical evidence-only observation',
  modes.composite_classical?.measurementClassification === 'HISTORICAL_PHASE_P_OBSERVATION' &&
    modes.composite_classical?.phasePSourceRow === 'monthly_main' &&
    modes.composite_classical?.selectionPolicy === 'historical_evidence_only_never_promote' &&
    modes.composite_classical?.releaseEligible === false,
  JSON.stringify({
    classification: modes.composite_classical?.measurementClassification,
    sourceRow: modes.composite_classical?.phasePSourceRow,
    policy: modes.composite_classical?.selectionPolicy,
  }));
check('composite_classical historical non-regression is observation, not a release PASS',
  modes.composite_classical?.historicalWinLossVsMonthlyMain?.net === 0 &&
    modes.composite_classical?.historicalNonRegressionVsMonthlyMain?.observed === true &&
    !('status' in (modes.composite_classical?.historicalNonRegressionVsMonthlyMain ?? {})),
  JSON.stringify(modes.composite_classical?.historicalWinLossVsMonthlyMain));
check('composite_classical historical candidate coverage is tracked without authority claim',
  modes.composite_classical?.historicalCandidateCoverage?.covered === 23 &&
    modes.composite_classical?.historicalCandidateCoverage?.comparable === 27 &&
    modes.composite_classical?.historicalCandidateCoverage?.releaseEligible === false,
  JSON.stringify(modes.composite_classical?.historicalCandidateCoverage));
check('jonheom figures remain a historical source-group observation',
  modes.composite_classical?.bySourceGroup?.jonheom?.historicalCandidateCoverage?.covered === 3 &&
    modes.composite_classical?.bySourceGroup?.jonheom?.pass === 1,
  JSON.stringify(modes.composite_classical?.bySourceGroup?.jonheom));
check('historical composite floors cannot become a quality gate',
  bySourceTier.ruleModeBreakdown?.historicalCompositeObservation
      ?.allHistoricalFloorsObserved === true &&
    bySourceTier.ruleModeBreakdown?.historicalCompositeObservation
      ?.releaseEligible === false &&
    (bySourceTier.ruleModeBreakdown?.historicalCompositeObservation?.checks ?? [])
      .every((row: any) => row.releaseEligible === false && !('status' in row)));

const presets = bySourceTier.schoolPresetBreakdown?.presets ?? {};
const expectedPresetNames = ['korean', 'chinese', 'modern', 'korean_modern', 'classical_text', 'naming_safe'];
for (const preset of expectedPresetNames) {
  // P0-3: 픽스처 수 하드코딩 금지 — baseline.fixtureCount와 동적 비교 (15→17 확장 대응)
  check(`${preset} schoolPreset breakdown is present`,
    presets[preset]?.fixtureCount === bySourceTier.baseline?.fixtureCount,
    `preset=${presets[preset]?.fixtureCount}, baseline=${bySourceTier.baseline?.fixtureCount}`);
}
const presetRows = bySourceTier.schoolPresetBreakdown?.rows ?? [];
check('schoolPreset rows cover the baseline fixtures',
  presetRows.length === bySourceTier.baseline?.fixtureCount,
  `rows=${presetRows.length}, fixtures=${bySourceTier.baseline?.fixtureCount}`);
check('schoolPreset rows expose default and every preset score',
  presetRows.every((row: any) =>
    row.scores?.default &&
      expectedPresetNames.every((preset) => row.scores?.[preset] && row.deltaVsDefault?.[preset])),
  `presets=${expectedPresetNames.join(',')}`);
check('korean preset remains zero-delta row by row',
  presetRows.every((row: any) =>
    row.deltaVsDefault?.korean?.total === 0 && row.deltaVsDefault?.korean?.saju === 0));
check('aggregate preset counts equal row count',
  expectedPresetNames.every((preset) => presets[preset]?.fixtureCount === presetRows.length));
check('schoolPreset rows expose source-tier comparison metadata',
  presetRows.every((row: any) =>
    typeof row.referenceTier === 'string' &&
      typeof row.sourceType === 'string' &&
      typeof row.referenceKind === 'string' &&
      !('truthBucket' in row) &&
      !('authorityTruthEligible' in row) &&
      !('completeD1TruthEligible' in row)));
check('name-input shape inventory makes no authority claim',
  bySourceTier.schoolPresetBreakdown?.nameInputShapeCoverage?.authorityClaim === false &&
    typeof bySourceTier.schoolPresetBreakdown?.nameInputShapeCoverage
      ?.fullNameInputFixtureCount === 'number',
  JSON.stringify(bySourceTier.schoolPresetBreakdown?.nameInputShapeCoverage));

check('RPI summary has A-G axis scores',
  rpiSummary.axisScores &&
    Object.keys(rpiSummary.axisScores).length === 7);
// cf8b08006: D5가 NOT_APPLICABLE(설계상 범위 밖)을 분모에서 제외하므로 axis A는
// PASS/100%가 정상일 수 있다. 상태별 정직성 불변식만 강제: PASS⇔fail·na 0+만점+100%,
// PARTIAL(na>0)⇔감점+커버리지<100, FAIL⇔fail>0.
check('RPI calculation axis stays honest (PASS requires full coverage; partial coverage is penalized)',
  (() => {
    const axisA = rpiSummary.axisScores?.A_calculationAccuracy;
    if (!axisA) return false;
    if (axisA.status === 'PASS')
      return axisA.fail === 0 && axisA.na === 0 && axisA.score === axisA.maxPoints && axisA.coverageRate === 100;
    if (axisA.status === 'PARTIAL')
      return axisA.na > 0 && axisA.score < axisA.maxPoints && axisA.coverageRate < 100;
    if (axisA.status === 'FAIL') return axisA.fail > 0;
    if (axisA.status === 'INSUFFICIENT_TRUTH')
      return axisA.pass === 0 && axisA.fail === 0 && axisA.na > 0 && axisA.score === 0;
    return axisA.status === 'NOT_MEASURED' && axisA.score === 0;
  })(),
  JSON.stringify(rpiSummary.axisScores?.A_calculationAccuracy));
check('quality-gate status buckets preserve NOT_APPLICABLE as a number',
  Object.values(bySourceTier.qualityGateByReferenceTier ?? {}).every((bucket: any) =>
    Object.values(bucket.dimensionStatus ?? {}).every((statuses: any) =>
      typeof statuses.NOT_APPLICABLE === 'number')));
check('RPI truth separation reports no current engine rule failures',
  rpiSummary.truthSeparation?.engineRuleFailureCount === 0,
  JSON.stringify(rpiSummary.truthSeparation));
check('RPI rule-quality axis stays truth-insufficient instead of fitting low-tier rows',
  rpiSummary.axisScores?.C_gyeokgukYongshinRuleQuality?.status === 'INSUFFICIENT_TRUTH' &&
    rpiSummary.axisScores.C_gyeokgukYongshinRuleQuality.score === 0 &&
    // P0-3: 전 baseline 픽스처가 T1(권위 분모 0)인 한 fixtureCount와 동행 (15 하드코딩 제거)
    rpiSummary.truthSeparation?.insufficientSourceTruthCount === bySourceTier.baseline?.fixtureCount &&
    rpiSummary.truthSeparation?.authorityMatchCount === 0,
  JSON.stringify(rpiSummary.axisScores?.C_gyeokgukYongshinRuleQuality));
check('ten-god v1/v2 comparison artifact is present',
  rpiSummary.tenGodPositionWeighting?.baselineComparison?.modeA === 'positional_weighted' &&
    rpiSummary.tenGodPositionWeighting?.baselineComparison?.modeB === 'positional_weighted_v2');
check('ten-god v1/v2 artifact covers all current default fixtures',
  rpiSummary.tenGodPositionWeighting?.baselineComparison?.defaultFixtures?.total === bySourceTier.baseline.fixtureCount,
  JSON.stringify(rpiSummary.tenGodPositionWeighting?.baselineComparison?.defaultFixtures));
check('ten-god v1/v2 artifact covers jonggyeok stress fixtures',
  rpiSummary.tenGodPositionWeighting?.baselineComparison?.jonggyeokFixtures?.total === 9,
  JSON.stringify(rpiSummary.tenGodPositionWeighting?.baselineComparison?.jonggyeokFixtures));
check('ten-god v1/v2 artifact records row-level deltas',
  (rpiSummary.tenGodPositionWeighting?.baselineComparison?.defaultFixtures?.rows ?? []).every((row: any) =>
    row.id && Number.isFinite(row.v1?.saju) && Number.isFinite(row.v2?.saju) && Number.isFinite(row.delta?.saju)));

console.log(`\nBaseline metrics: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
