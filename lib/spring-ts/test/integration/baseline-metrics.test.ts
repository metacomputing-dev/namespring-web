/**
 * test/integration/baseline-metrics.test.ts
 *
 * Verifies Phase 0 baseline dashboard artifacts.
 *
 * Run: npm run test:baseline-metrics
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

function readMetric(fileName: string): any {
  return JSON.parse(fs.readFileSync(path.join(METRICS_DIR, fileName), 'utf-8'));
}

console.log('Phase 0 baseline metrics test\n');

execSync('npm run metrics:baseline', {
  cwd: SPRING_TS_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

const bySourceTier = readMetric('bySourceTier.json');
const sourceTierSummary = readMetric('source-tier-summary.json');
const rpiSummary = readMetric('rpi-summary.json');

check('bySourceTier schema version is current',
  bySourceTier.schemaVersion === 'spring-ts.by-source-tier.v1');
check('source tier summary scans the Phase 0 source ledger',
  sourceTierSummary.scanned >= 51,
  `scanned=${sourceTierSummary.scanned}`);
check('source tier governance status matches the RPI governance axis',
  sourceTierSummary.status === rpiSummary.axisScores?.G_validationGovernance?.status &&
    sourceTierSummary.violationCount === rpiSummary.axisScores?.G_validationGovernance?.sourceTierViolations,
  `status=${sourceTierSummary.status}, violations=${sourceTierSummary.violationCount}`);

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
check('rule modes expose total win/loss vs monthly_main',
  typeof modes.jungki_transparent?.winLossVsMonthlyMain?.wins === 'number' &&
    typeof modes.jungki_transparent?.winLossVsMonthlyMain?.losses === 'number',
  JSON.stringify(modes.jungki_transparent?.winLossVsMonthlyMain));
check('rule modes expose source-tier win/loss vs monthly_main',
  Object.values(modes.jungki_transparent?.bySourceTier ?? {}).every((bucket: any) =>
    typeof bucket?.winLossVsMonthlyMain?.wins === 'number' &&
    typeof bucket?.winLossVsMonthlyMain?.losses === 'number'),
  JSON.stringify(modes.jungki_transparent?.bySourceTier));
check('composite_classical is measured as evidence-only candidate mode',
  modes.composite_classical?.measurementStatus === 'MEASURED_CANDIDATE_EVIDENCE' &&
    modes.composite_classical?.phasePSourceRow === 'monthly_main' &&
    modes.composite_classical?.selectionPolicy === 'evidence_only_never_promote',
  JSON.stringify({
    status: modes.composite_classical?.measurementStatus,
    sourceRow: modes.composite_classical?.phasePSourceRow,
    policy: modes.composite_classical?.selectionPolicy,
  }));
check('composite_classical selected agreement is not worse than monthly_main',
  modes.composite_classical?.winLossVsMonthlyMain?.net === 0 &&
    modes.composite_classical?.sourceTierNonRegressionVsMonthlyMain?.status === 'PASS',
  JSON.stringify(modes.composite_classical?.winLossVsMonthlyMain));
check('composite_classical source-tier non-regression passes',
  Object.values(modes.composite_classical?.bySourceTier ?? {}).every((bucket: any) =>
    bucket?.winLossVsMonthlyMain?.net === 0 &&
    bucket?.sourceTierNonRegressionVsMonthlyMain?.status === 'PASS'),
  JSON.stringify(modes.composite_classical?.bySourceTier));
check('composite_classical authority candidate coverage is tracked',
  modes.composite_classical?.candidateCoverage?.covered === 23 &&
    modes.composite_classical?.candidateCoverage?.comparable === 27,
  JSON.stringify(modes.composite_classical?.candidateCoverage));
check('composite_classical improves classical candidate coverage over selected agreement',
  modes.composite_classical?.bySourceGroup?.jonheom?.candidateCoverage?.covered === 3 &&
    modes.composite_classical?.bySourceGroup?.jonheom?.pass === 1,
  JSON.stringify(modes.composite_classical?.bySourceGroup?.jonheom));

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
      typeof row.truthBucket === 'string' &&
      typeof row.authorityTruthEligible === 'boolean'));
check('current authority fixtures are tracked as non-scorable for naming preset deltas',
  bySourceTier.schoolPresetBreakdown?.authorityFixtureCoverage?.scorableAuthorityFixtures === 0,
  JSON.stringify(bySourceTier.schoolPresetBreakdown?.authorityFixtureCoverage));

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
    return axisA.status === 'NOT_MEASURED' && axisA.score === 0;
  })(),
  JSON.stringify(rpiSummary.axisScores?.A_calculationAccuracy));
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
