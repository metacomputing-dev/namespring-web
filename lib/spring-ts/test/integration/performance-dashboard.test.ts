/**
 * test/integration/performance-dashboard.test.ts
 *
 * Verifies Phase 9.2 deterministic performance dashboard artifact.
 *
 * Run: npm run test:performance-dashboard
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validatePerformanceDashboardInputs,
} from '../../tools/metrics/performance-dashboard-input.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const METRICS_DIR = path.resolve(SPRING_TS_ROOT, 'metrics');
const ARTIFACT_PATH = path.resolve(METRICS_DIR, 'performance-dashboard.json');

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

function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function runDashboard(outDir: string, metricsDir = METRICS_DIR): any {
  execFileSync('npx', [
    'tsx',
    'scripts/compute-performance-dashboard.ts',
    '--out-dir', outDir,
    '--metrics-dir', metricsDir,
  ], {
    cwd: SPRING_TS_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  return readJson(path.join(outDir, 'performance-dashboard.json'));
}

function copyMetrics(): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-dashboard-inputs-'));
  for (const fileName of [
    'rpi-summary.json',
    'source-tier-summary.json',
    'bySourceTier.json',
    'deterministic-calibration.json',
    'rule-ab-tests.json',
  ]) {
    fs.copyFileSync(path.join(METRICS_DIR, fileName), path.join(target, fileName));
  }
  return target;
}

function readDashboardInputs(metricsDir: string): any {
  const inputPaths = {
    rpiSummary: path.join(metricsDir, 'rpi-summary.json'),
    sourceTierSummary: path.join(metricsDir, 'source-tier-summary.json'),
    bySourceTier: path.join(metricsDir, 'bySourceTier.json'),
    deterministicCalibration: path.join(metricsDir, 'deterministic-calibration.json'),
    ruleAbTests: path.join(metricsDir, 'rule-ab-tests.json'),
  };
  return {
    rpiSummary: readJson(inputPaths.rpiSummary),
    sourceTierSummary: readJson(inputPaths.sourceTierSummary),
    bySourceTier: readJson(inputPaths.bySourceTier),
    deterministicCalibration: readJson(inputPaths.deterministicCalibration),
    ruleAbTests: readJson(inputPaths.ruleAbTests),
    inputPaths,
  };
}

function dashboardInputsFail(metricsDir: string): boolean {
  try {
    validatePerformanceDashboardInputs(readDashboardInputs(metricsDir));
    return false;
  } catch {
    return true;
  }
}

function collectForbiddenKeyPaths(value: unknown, currentPath = '$'): string[] {
  const forbidden = new Set([
    'assignmentKey',
    'birth',
    'birthDate',
    'birthTime',
    'calendarType',
    'city',
    'email',
    'freeText',
    'fullHangul',
    'fullHanja',
    'gender',
    'hanja',
    'hangul',
    'ip',
    'name',
    'phone',
    'quote',
    'rawEvent',
    'rawText',
    'sessionId',
    'sourceId',
    'sourceUrl',
    'userId',
  ]);
  const paths: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      paths.push(...collectForbiddenKeyPaths(item, `${currentPath}[${index}]`));
    });
    return paths;
  }
  if (!value || typeof value !== 'object') return paths;
  for (const [key, item] of Object.entries(value)) {
    const nextPath = `${currentPath}.${key}`;
    if (forbidden.has(key)) paths.push(nextPath);
    paths.push(...collectForbiddenKeyPaths(item, nextPath));
  }
  return paths;
}

function collectStringMatches(value: unknown, pattern: RegExp, currentPath = '$'): string[] {
  const paths: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      paths.push(...collectStringMatches(item, pattern, `${currentPath}[${index}]`));
    });
    return paths;
  }
  if (typeof value === 'string') {
    if (pattern.test(value)) paths.push(currentPath);
    return paths;
  }
  if (!value || typeof value !== 'object') return paths;
  for (const [key, item] of Object.entries(value)) {
    paths.push(...collectStringMatches(item, pattern, `${currentPath}.${key}`));
  }
  return paths;
}

console.log('Phase 9.2 performance dashboard\n');

const artifact = readJson(ARTIFACT_PATH);
const rpiSummary = readJson(path.join(METRICS_DIR, 'rpi-summary.json'));
const sourceTierSummary = readJson(path.join(METRICS_DIR, 'source-tier-summary.json'));
const bySourceTier = readJson(path.join(METRICS_DIR, 'bySourceTier.json'));
const deterministicCalibration = readJson(path.join(METRICS_DIR, 'deterministic-calibration.json'));
const ruleAbTests = readJson(path.join(METRICS_DIR, 'rule-ab-tests.json'));

const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-performance-dashboard-a-'));
const generatedA = runDashboard(tmpA);

check('artifact schema version is current',
  artifact.schemaVersion === 'spring-ts.performance-dashboard.v2');
check('artifact kind is Phase 9.2 dashboard',
  artifact.artifactKind === 'phase_9_2_performance_dashboard');
check('committed artifact deterministically matches generated output',
  JSON.stringify(artifact) === JSON.stringify(generatedA));
check('dashboard records byte digests for every metric input',
  Object.values(artifact.inputs ?? {}).every((input: any) =>
    typeof input?.path === 'string' && /^sha256:[a-f0-9]{64}$/.test(input?.sha256)));

check('RPI trend mirrors rpi-summary current values',
  artifact.rpiTrendReport.current.rawScore === rpiSummary.rawRpi.score &&
    artifact.rpiTrendReport.current.rawMaxPoints === rpiSummary.rawRpi.maxPoints &&
    artifact.rpiTrendReport.current.measuredScore === rpiSummary.measuredOnlyRpi.score &&
    artifact.rpiTrendReport.current.measuredPercent === rpiSummary.measuredOnlyRpi.percent);
check('dashboard uses baseline snapshot target date',
  artifact.snapshotTargetDate === bySourceTier.baseline.snapshotTargetDate);
check('RPI axis statuses are visible',
  artifact.rpiTrendReport.axisCount === Object.keys(rpiSummary.axisScores).length &&
    artifact.rpiTrendReport.truthInsufficientAxisCount >= 2 &&
    artifact.rpiTrendReport.axes.A_calculationAccuracy.status === 'INSUFFICIENT_TRUTH' &&
    artifact.rpiTrendReport.axes.A_calculationAccuracy.score === 0 &&
    artifact.rpiTrendReport.axes.C_gyeokgukYongshinRuleQuality.status === 'INSUFFICIENT_TRUTH');

const baselineBuckets = artifact.sourceTierCoverageReport.baselineByReferenceTier ?? {};
const bucketedFixtureCount = Object.values(baselineBuckets)
  .reduce((sum: number, bucket: any) => sum + Number(bucket.fixtureCount ?? 0), 0);
check('source-tier fixture buckets sum to baseline fixture count',
  bucketedFixtureCount === bySourceTier.baseline.fixtureCount,
  `bucketed=${bucketedFixtureCount}, baseline=${bySourceTier.baseline.fixtureCount}`);
check('source-tier summary mirrors source-tier metrics',
  artifact.sourceTierCoverageReport.status === sourceTierSummary.status &&
    artifact.sourceTierCoverageReport.violationCount === sourceTierSummary.violationCount &&
    artifact.sourceTierCoverageReport.scanned === sourceTierSummary.scanned &&
    artifact.sourceTierCoverageReport.declaredScopeEligibleSourceRecordCount ===
      sourceTierSummary.declaredScopeEligibleSourceRecordCount &&
    artifact.sourceTierCoverageReport.declaredScopeIneligibleSourceRecordCount ===
      sourceTierSummary.declaredScopeIneligibleSourceRecordCount);
check('source-record eligibility is not mislabeled as seven-field D1 truth',
  !('authorityTruthEligibleCount' in artifact.sourceTierCoverageReport) &&
    !('authorityTruthEligibleRate' in artifact.sourceTierCoverageReport) &&
    artifact.sourceTierCoverageReport.recordEligibilityDefinition.includes(
      'not complete D1 fixture truth'));

const truthCoverage = artifact.sourceTierCoverageReport.d1FixtureTruthCoverage;
const truthRows = bySourceTier.d1TruthCoverage?.fixtures ?? [];
check('D1 truth coverage accounts for every baseline fixture exactly once',
  truthCoverage.fixtureCount === truthRows.length &&
    truthCoverage.completeSevenFieldTruthFixtureCount +
      truthCoverage.partialTruthFixtureCount +
      truthCoverage.noTruthFixtureCount === truthRows.length &&
    truthCoverage.releaseInsufficientTruthFixtureCount ===
      truthCoverage.partialTruthFixtureCount + truthCoverage.noTruthFixtureCount);
check('D1 truth coverage uses the exact seven-field release contract',
  truthCoverage.requiredFieldCount === 7 &&
    JSON.stringify(truthCoverage.requiredFields) === JSON.stringify([
      'sajuReport.gyeokgukType',
      'sajuReport.yongshinElement',
      'sajuReport.strengthLevel',
      'namingReport.totalScore',
      'namingReport.scores.hangul',
      'namingReport.scores.hanja',
      'namingReport.scores.fourFrame',
    ]) &&
    truthCoverage.completeSevenFieldTruthFixtureCount ===
      truthRows.filter((row: any) => row.coverageStatus === 'COMPLETE').length &&
    truthCoverage.partialTruthFixtureCount ===
      truthRows.filter((row: any) => row.coverageStatus === 'PARTIAL').length &&
    truthCoverage.doctrineTruthFixtureCount ===
      truthRows.filter((row: any) => row.doctrineComplete === true).length &&
    truthCoverage.namingScoreTruthFixtureCount ===
      truthRows.filter((row: any) => row.namingCalibrationComplete === true).length);

const staleInputs = copyMetrics();
const staleBySourceTier = readJson(path.join(staleInputs, 'bySourceTier.json'));
staleBySourceTier.schemaVersion = 'spring-ts.by-source-tier.v1';
fs.writeFileSync(
  path.join(staleInputs, 'bySourceTier.json'),
  JSON.stringify(staleBySourceTier, null, 2) + '\n',
);
check('dashboard rejects stale input schemas instead of repackaging them',
  dashboardInputsFail(staleInputs));

const partialInputs = copyMetrics();
const partialBySourceTier = readJson(path.join(partialInputs, 'bySourceTier.json'));
const partialCoverage = partialBySourceTier.d1TruthCoverage;
const partialRow = partialCoverage.fixtures[0];
const countKeyByStatus: Record<string, string> = {
  COMPLETE: 'completeFixtureCount',
  PARTIAL: 'partialFixtureCount',
  NONE: 'noneFixtureCount',
};
partialCoverage[countKeyByStatus[partialRow.coverageStatus]] -= 1;
partialCoverage.partialFixtureCount += 1;
if (partialRow.doctrineComplete) partialCoverage.doctrineCompleteFixtureCount -= 1;
if (partialRow.namingCalibrationComplete) {
  partialCoverage.namingCalibrationCompleteFixtureCount -= 1;
}
partialRow.coverageStatus = 'PARTIAL';
partialRow.coveredFieldCount = 1;
partialRow.missingRequiredFields = partialCoverage.requiredFields.slice(1);
partialRow.doctrineComplete = false;
partialRow.namingCalibrationComplete = false;
fs.writeFileSync(
  path.join(partialInputs, 'bySourceTier.json'),
  JSON.stringify(partialBySourceTier, null, 2) + '\n',
);
check('dashboard rejects D1 coverage that is not propagated to downstream artifacts',
  dashboardInputsFail(partialInputs));

const corruptInputs = copyMetrics();
const corruptBySourceTier = readJson(path.join(corruptInputs, 'bySourceTier.json'));
corruptBySourceTier.d1TruthCoverage.fixtures[0].coveredFieldCount = -1;
fs.writeFileSync(
  path.join(corruptInputs, 'bySourceTier.json'),
  JSON.stringify(corruptBySourceTier, null, 2) + '\n',
);
check('dashboard rejects corrupt D1 coverage invariants',
  dashboardInputsFail(corruptInputs));

const divergentInputs = copyMetrics();
const divergentRuleAb = readJson(path.join(divergentInputs, 'rule-ab-tests.json'));
divergentRuleAb.sourceTierGate.completeD1ObjectiveFixtureCount += 1;
fs.writeFileSync(
  path.join(divergentInputs, 'rule-ab-tests.json'),
  JSON.stringify(divergentRuleAb, null, 2) + '\n',
);
check('dashboard rejects cross-artifact complete-D1 count divergence',
  dashboardInputsFail(divergentInputs));
check('complete-D1 promotion gate remains blocked by incomplete truth',
  artifact.completeD1PromotionGate.completeD1ObjectiveStatus ===
      deterministicCalibration.sourceTierObjective.completeD1ObjectiveStatus &&
    artifact.completeD1PromotionGate.completeD1ObjectiveFixtureCount ===
      deterministicCalibration.sourceTierObjective.completeD1ObjectiveFixtureCount &&
    artifact.completeD1PromotionGate.ruleAbCompleteD1Gate.status ===
      ruleAbTests.sourceTierGate.status &&
    artifact.completeD1PromotionGate.ruleAbCompleteD1Gate.status === 'BLOCKED' &&
    !('sourceTierPromotionGate' in artifact) &&
    !('sourceTierDefaultPromotionGate' in artifact.releaseGates) &&
    artifact.releaseGates.completeD1DefaultPromotionGate === 'BLOCKED');

const ruleModes = Object.keys(artifact.ruleModeComparisonReport.modes ?? {}).sort();
check('rule-mode dashboard includes expected modes',
  JSON.stringify(ruleModes) === JSON.stringify(['composite_classical', 'jungki_transparent', 'monthly_main']));
check('rule-mode dashboard labels Phase-P figures as release-ineligible history',
  artifact.ruleModeComparisonReport.authorityScope === 'historical_observation_only' &&
    artifact.ruleModeComparisonReport.releaseEligible === false &&
    artifact.ruleModeComparisonReport.modes.composite_classical
      .measurementClassification === 'HISTORICAL_PHASE_P_OBSERVATION' &&
    artifact.ruleModeComparisonReport.modes.composite_classical.releaseEligible === false &&
    !('compositeQualityGate' in artifact.ruleModeComparisonReport));
check('composite historical observation preserves evidence without current authority claims',
  artifact.ruleModeComparisonReport.modes.composite_classical.selectionPolicy ===
      'historical_evidence_only_never_promote' &&
    artifact.ruleModeComparisonReport.modes.composite_classical
      .historicalCandidateCoverage.covered ===
      bySourceTier.ruleModeBreakdown.modes.composite_classical
        .historicalCandidateCoverage.covered &&
    artifact.ruleModeComparisonReport.historicalCompositeObservation
      .allHistoricalFloorsObserved === true &&
    artifact.ruleModeComparisonReport.historicalCompositeObservation
      .releaseEligible === false &&
    Object.keys(artifact.ruleModeComparisonReport.modes.composite_classical
      .byHistoricalLabelTier).every((key) => key.startsWith('phase_p_')));

const diversity = artifact.namingCandidateDiversityReport;
check('naming candidate diversity tracks school preset spread',
  diversity.schoolPresetDiversity.presetCount === 6 &&
    diversity.schoolPresetDiversity.changedPresetCount === 5 &&
    diversity.schoolPresetDiversity.presets.some((row: any) =>
      row.presetId === 'naming_safe' && row.averageSajuDelta > 0));
check('name-input shape inventory is not presented as authority coverage',
  diversity.schoolPresetDiversity.nameInputShapeCoverage?.authorityClaim === false &&
    !('authorityFixtureCoverage' in diversity.schoolPresetDiversity));
check('ranking strategy diversity uses only candidate ranking experiment',
  diversity.rankingStrategyDiversity.experimentId === 'candidate_ranking_strategy_feedback' &&
    diversity.rankingStrategyDiversity.strategyCount === 3 &&
    diversity.rankingStrategyDiversity.winningVariantId === 'pareto_conflict_aware_safe' &&
    diversity.rankingStrategyDiversity.decision === 'blocked_source_tier_gate');
check('ranking variants expose Pareto and conflict-aware switches',
  diversity.rankingStrategyDiversity.variants.some((variant: any) =>
    variant.variantId === 'pareto_frontier' && variant.paretoFrontierCandidates === true) &&
    diversity.rankingStrategyDiversity.variants.some((variant: any) =>
      variant.variantId === 'pareto_conflict_aware_safe' &&
      variant.yongshinMode === 'consensus_aware' &&
      variant.nameElementStrategy === 'safeFallback'));

check('dashboard privacy is aggregate-only and not authority truth',
  artifact.privacy.sourceFree === true &&
    artifact.privacy.aggregateOnly === true &&
    artifact.privacy.authorityUsage === 'not_authority_truth' &&
    artifact.privacy.rawPersonalFieldsStored === false);
check('dashboard stores no raw names, birth data, source URLs, or assignment keys',
  collectForbiddenKeyPaths(artifact).length === 0,
  collectForbiddenKeyPaths(artifact).slice(0, 5).join(', '));
check('dashboard does not reference top-level namespring paths',
  collectStringMatches(artifact, /(^|[\\/])namespring([\\/]|$)/).length === 0,
  collectStringMatches(artifact, /(^|[\\/])namespring([\\/]|$)/).slice(0, 5).join(', '));

console.log(`\nPerformance dashboard: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
