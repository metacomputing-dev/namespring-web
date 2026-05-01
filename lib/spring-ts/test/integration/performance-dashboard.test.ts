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

function runDashboard(outDir: string): any {
  execFileSync('npx', ['tsx', 'scripts/compute-performance-dashboard.ts', '--out-dir', outDir], {
    cwd: SPRING_TS_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  return readJson(path.join(outDir, 'performance-dashboard.json'));
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
const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-performance-dashboard-b-'));
const generatedA = runDashboard(tmpA);
const generatedB = runDashboard(tmpB);

check('artifact schema version is current',
  artifact.schemaVersion === 'spring-ts.performance-dashboard.v1');
check('artifact kind is Phase 9.2 dashboard',
  artifact.artifactKind === 'phase_9_2_performance_dashboard');
check('performance dashboard script is deterministic across runs',
  JSON.stringify(generatedA) === JSON.stringify(generatedB));
check('committed artifact matches generated output',
  JSON.stringify(artifact) === JSON.stringify(generatedA));

check('RPI trend mirrors rpi-summary current values',
  artifact.rpiTrendReport.current.rawScore === rpiSummary.rawRpi.score &&
    artifact.rpiTrendReport.current.rawMaxPoints === rpiSummary.rawRpi.maxPoints &&
    artifact.rpiTrendReport.current.measuredScore === rpiSummary.measuredOnlyRpi.score &&
    artifact.rpiTrendReport.current.measuredPercent === rpiSummary.measuredOnlyRpi.percent);
check('dashboard uses baseline snapshot target date',
  artifact.snapshotTargetDate === bySourceTier.baseline.snapshotTargetDate);
check('RPI axis statuses are visible',
  artifact.rpiTrendReport.axisCount === Object.keys(rpiSummary.axisScores).length &&
    artifact.rpiTrendReport.truthInsufficientAxisCount >= 1 &&
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
    artifact.sourceTierCoverageReport.scanned === sourceTierSummary.scanned);
check('source-tier promotion gate remains blocked by authority objective',
  artifact.sourceTierPromotionGate.calibrationStatus === deterministicCalibration.sourceTierObjective.status &&
    artifact.sourceTierPromotionGate.ruleAbSourceTierGate.status === ruleAbTests.sourceTierGate.status &&
    artifact.sourceTierPromotionGate.ruleAbSourceTierGate.status === 'BLOCKED');

const ruleModes = Object.keys(artifact.ruleModeComparisonReport.modes ?? {}).sort();
check('rule-mode dashboard includes expected modes',
  JSON.stringify(ruleModes) === JSON.stringify(['composite_classical', 'jungki_transparent', 'monthly_main']));
check('composite mode remains evidence-only candidate coverage',
  artifact.ruleModeComparisonReport.modes.composite_classical.measurementStatus === 'MEASURED_CANDIDATE_EVIDENCE' &&
    artifact.ruleModeComparisonReport.modes.composite_classical.selectionPolicy === 'evidence_only_never_promote' &&
    artifact.ruleModeComparisonReport.modes.composite_classical.candidateCoverage.covered ===
      bySourceTier.ruleModeBreakdown.modes.composite_classical.candidateCoverage.covered);

const diversity = artifact.namingCandidateDiversityReport;
check('naming candidate diversity tracks school preset spread',
  diversity.schoolPresetDiversity.presetCount === 6 &&
    diversity.schoolPresetDiversity.changedPresetCount === 5 &&
    diversity.schoolPresetDiversity.presets.some((row: any) =>
      row.presetId === 'naming_safe' && row.averageSajuDelta > 0));
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
