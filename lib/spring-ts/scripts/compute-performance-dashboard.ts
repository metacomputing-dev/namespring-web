/**
 * scripts/compute-performance-dashboard.ts
 *
 * Phase 9.2 performance dashboard.
 *
 * Aggregates existing deterministic metrics into a compact dashboard so RPI,
 * source-tier coverage, rule-mode comparison, and naming candidate diversity
 * are tracked by numbers instead of narrative impressions.
 *
 * Usage:
 *   npx tsx scripts/compute-performance-dashboard.ts
 *   npx tsx scripts/compute-performance-dashboard.ts --out-dir /tmp/dashboard
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256FileDigest } from '../tools/metrics/artifact-digest.mjs';
import {
  validatePerformanceDashboardInputs,
} from '../tools/metrics/performance-dashboard-input.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const GENERATED_AT = '2026-05-02T00:00:00.000Z';
const SCHEMA_VERSION = 'spring-ts.performance-dashboard.v2';

interface Args {
  readonly outDir: string;
  readonly metricsDir: string;
  readonly json: boolean;
}

function parseArgs(argv: string[]): Args {
  const mutable: { -readonly [K in keyof Args]: Args[K] } = {
    outDir: path.resolve(SPRING_TS_ROOT, 'metrics'),
    metricsDir: path.resolve(SPRING_TS_ROOT, 'metrics'),
    json: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--out-dir' && argv[i + 1]) {
      mutable.outDir = path.resolve(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--metrics-dir' && argv[i + 1]) {
      mutable.metricsDir = path.resolve(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--json') {
      mutable.json = true;
    }
  }
  return mutable;
}

function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function percent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return round((numerator / denominator) * 100);
}

function buildRpiTrendReport(rpi: any): any {
  const axes = Object.fromEntries(Object.entries(rpi.axisScores ?? {}).map(([axisId, axis]: [string, any]) => [
    axisId,
    {
      score: axis.score,
      maxPoints: axis.maxPoints,
      percent: percent(Number(axis.score ?? 0), Number(axis.maxPoints ?? 0)),
      status: axis.status,
    },
  ]));
  const axisRows = Object.values(axes) as any[];
  return {
    trendKind: 'single_snapshot_baseline',
    current: {
      rawScore: rpi.rawRpi?.score,
      rawMaxPoints: rpi.rawRpi?.maxPoints,
      measuredScore: rpi.measuredOnlyRpi?.score,
      measuredMaxPoints: rpi.measuredOnlyRpi?.maxPoints,
      measuredPercent: rpi.measuredOnlyRpi?.percent,
    },
    axisCount: axisRows.length,
    measuredAxisCount: axisRows.filter((axis) =>
      axis.status !== 'NOT_MEASURED' && axis.status !== 'INSUFFICIENT_TRUTH').length,
    truthInsufficientAxisCount: axisRows.filter((axis) => axis.status === 'INSUFFICIENT_TRUTH').length,
    notMeasuredAxisCount: axisRows.filter((axis) => axis.status === 'NOT_MEASURED').length,
    axes,
  };
}

function buildSourceTierCoverageReport(
  sourceSummary: any,
  bySourceTier: any,
  inputValidation: any,
): any {
  const { eligible: eligibleRecordCount, ineligible: ineligibleRecordCount } =
    inputValidation.sourceRecordCounts;
  const byTier = Object.fromEntries(Object.entries(sourceSummary.byTier ?? {}).map(([tier, bucket]: [string, any]) => [
    tier,
    {
      recordCount: bucket.recordCount,
      declaredScopeEligibleSourceRecordCount: bucket.declaredScopeEligibleSourceRecordCount,
      declaredScopeIneligibleSourceRecordCount: bucket.declaredScopeIneligibleSourceRecordCount,
      declaredScopeEligibleSourceRecordRate: percent(
        Number(bucket.declaredScopeEligibleSourceRecordCount ?? 0),
        Number(bucket.recordCount ?? 0),
      ),
    },
  ]));
  const baselineByReferenceTier = Object.fromEntries(
    Object.entries(bySourceTier.qualityGateByReferenceTier ?? {}).map(([tier, bucket]: [string, any]) => [
      tier,
      {
        fixtureCount: bucket.fixtureCount,
        fixtureStatus: bucket.fixtureStatus,
        dimensionStatus: bucket.dimensionStatus,
        truthBuckets: bucket.truthBuckets,
        references: bucket.references,
      },
    ]),
  );
  const truthCoverage = inputValidation.coverage;
  return {
    status: sourceSummary.status,
    scanned: sourceSummary.scanned,
    violationCount: sourceSummary.violationCount,
    recordEligibilityDefinition: sourceSummary.eligibilityDefinition,
    declaredScopeEligibleSourceRecordCount:
      sourceSummary.declaredScopeEligibleSourceRecordCount,
    declaredScopeIneligibleSourceRecordCount:
      sourceSummary.declaredScopeIneligibleSourceRecordCount,
    declaredScopeEligibleSourceRecordRate: percent(
      eligibleRecordCount,
      eligibleRecordCount + ineligibleRecordCount,
    ),
    byTier,
    d1FixtureTruthCoverage: {
      fixtureCount: truthCoverage.fixtureCount,
      requiredFieldCount: truthCoverage.requiredFieldCount,
      requiredFields: truthCoverage.requiredFields,
      completeSevenFieldTruthFixtureCount: truthCoverage.completeFixtureCount,
      partialTruthFixtureCount: truthCoverage.partialFixtureCount,
      noTruthFixtureCount: truthCoverage.noneFixtureCount,
      releaseInsufficientTruthFixtureCount:
        truthCoverage.partialFixtureCount + truthCoverage.noneFixtureCount,
      completeSevenFieldTruthFixtureRate: percent(
        truthCoverage.completeFixtureCount,
        truthCoverage.fixtureCount,
      ),
      doctrineTruthFixtureCount: truthCoverage.doctrineCompleteFixtureCount,
      namingScoreTruthFixtureCount: truthCoverage.namingCalibrationCompleteFixtureCount,
    },
    baselineByReferenceTier,
    truthSeparation: bySourceTier.truthSeparation,
  };
}

function buildRuleModeComparisonReport(bySourceTier: any): any {
  const breakdown = bySourceTier.ruleModeBreakdown ?? {};
  const modes = breakdown.modes ?? {};
  return {
    authorityScope: breakdown.authorityScope,
    releaseEligible: breakdown.releaseEligible,
    baselineMode: 'monthly_main',
    modeCount: Object.keys(modes).length,
    modes: Object.fromEntries(Object.entries(modes).map(([modeId, mode]: [string, any]) => [
      modeId,
      {
        measurementClassification: mode.measurementClassification,
        authorityScope: mode.authorityScope,
        releaseEligible: mode.releaseEligible,
        phasePSourceRow: mode.phasePSourceRow,
        selectionPolicy: mode.selectionPolicy,
        total: mode.total,
        pass: mode.pass,
        partial: mode.partial,
        diff: mode.diff,
        comparable: mode.comparable,
        passRate: mode.passRate,
        historicalWinLossVsMonthlyMain: mode.historicalWinLossVsMonthlyMain,
        historicalCandidateCoverage: mode.historicalCandidateCoverage,
        historicalNonRegressionVsMonthlyMain:
          mode.historicalNonRegressionVsMonthlyMain,
        byHistoricalLabelTier: mode.byHistoricalLabelTier,
        bySourceGroup: mode.bySourceGroup,
      },
    ])),
    historicalCompositeObservation: breakdown.historicalCompositeObservation,
  };
}

function buildNamingCandidateDiversityReport(bySourceTier: any, ruleAbTests: any): any {
  const presets = bySourceTier.schoolPresetBreakdown?.presets ?? {};
  const presetRows = Object.entries(presets).map(([presetId, preset]: [string, any]) => ({
    presetId,
    fixtureCount: preset.fixtureCount,
    changedFromDefault: preset.changedFromDefault,
    changedRate: percent(Number(preset.changedFromDefault ?? 0), Number(preset.fixtureCount ?? 0)),
    averageTotalDelta: preset.averageTotalDelta,
    averageSajuDelta: preset.averageSajuDelta,
  }));
  const rankingComparison = (ruleAbTests.comparisons ?? [])
    .find((comparison: any) => comparison.experimentId === 'candidate_ranking_strategy_feedback');
  const rankingExperiment = (ruleAbTests.experiments ?? [])
    .find((experiment: any) => experiment.experimentId === 'candidate_ranking_strategy_feedback');
  return {
    metricLimit: 'feedback proxy; direct candidate-list diversity is asserted in pareto-candidates.test.ts today',
    schoolPresetDiversity: {
      presetCount: presetRows.length,
      fixtureCount: bySourceTier.schoolPresetBreakdown?.rows?.length ?? 0,
      changedPresetCount: presetRows.filter((row) => Number(row.changedFromDefault ?? 0) > 0).length,
      nameInputShapeCoverage: bySourceTier.schoolPresetBreakdown?.nameInputShapeCoverage,
      presets: presetRows,
    },
    rankingStrategyDiversity: rankingComparison
      ? {
        experimentId: rankingComparison.experimentId,
        variants: (rankingExperiment?.variants ?? []).map((variant: any) => ({
          variantId: variant.variantId,
          role: variant.role,
          paretoFrontierCandidates: variant.options?.precisionConfig?.paretoFrontierCandidates === true,
          surfaceNamingScoreVector: variant.options?.precisionConfig?.surfaceNamingScoreVector === true,
          yongshinMode: variant.options?.precisionConfig?.yongshinMode ?? null,
          nameElementStrategy: variant.options?.precisionConfig?.nameElementStrategy ?? null,
        })),
        strategyCount: rankingComparison.rows?.length ?? 0,
        winningVariantId: rankingComparison.winningVariantId,
        decision: rankingComparison.decision,
        blockedBy: rankingComparison.blockedBy,
        rows: (rankingComparison.rows ?? []).map((row: any) => ({
          variantId: row.variantId,
          role: row.role,
          exposures: row.exposures,
          compositeFeedbackScore: row.compositeFeedbackScore,
          deltaVsControl: row.deltaVsControl,
          candidateNameRejectionRate: row.candidateNameRejectionRate,
        })),
      }
      : null,
  };
}

function buildDashboard(metricsDir: string): any {
  const inputPaths = {
    rpiSummary: path.join(metricsDir, 'rpi-summary.json'),
    sourceTierSummary: path.join(metricsDir, 'source-tier-summary.json'),
    bySourceTier: path.join(metricsDir, 'bySourceTier.json'),
    deterministicCalibration: path.join(metricsDir, 'deterministic-calibration.json'),
    ruleAbTests: path.join(metricsDir, 'rule-ab-tests.json'),
  };
  const rpi = readJson(inputPaths.rpiSummary);
  const sourceSummary = readJson(inputPaths.sourceTierSummary);
  const bySourceTier = readJson(inputPaths.bySourceTier);
  const deterministicCalibration = readJson(inputPaths.deterministicCalibration);
  const ruleAbTests = readJson(inputPaths.ruleAbTests);
  const inputValidation = validatePerformanceDashboardInputs({
    rpiSummary: rpi,
    sourceTierSummary: sourceSummary,
    bySourceTier,
    deterministicCalibration,
    ruleAbTests,
    inputPaths,
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    artifactKind: 'phase_9_2_performance_dashboard',
    generatedAt: GENERATED_AT,
    snapshotTargetDate: bySourceTier.baseline?.snapshotTargetDate,
    inputs: {
      rpiSummary: {
        path: 'metrics/rpi-summary.json',
        sha256: sha256FileDigest(inputPaths.rpiSummary),
      },
      sourceTierSummary: {
        path: 'metrics/source-tier-summary.json',
        sha256: sha256FileDigest(inputPaths.sourceTierSummary),
      },
      bySourceTier: {
        path: 'metrics/bySourceTier.json',
        sha256: sha256FileDigest(inputPaths.bySourceTier),
      },
      deterministicCalibration: {
        path: 'metrics/deterministic-calibration.json',
        sha256: sha256FileDigest(inputPaths.deterministicCalibration),
      },
      ruleAbTests: {
        path: 'metrics/rule-ab-tests.json',
        sha256: sha256FileDigest(inputPaths.ruleAbTests),
      },
    },
    privacy: {
      sourceFree: true,
      aggregateOnly: true,
      authorityUsage: 'not_authority_truth',
      rawFixtureRowsStored: false,
      rawPersonalFieldsStored: false,
      rawFeedbackStoredInRepo: false,
    },
    rpiTrendReport: buildRpiTrendReport(rpi),
    sourceTierCoverageReport: buildSourceTierCoverageReport(
      sourceSummary,
      bySourceTier,
      inputValidation,
    ),
    completeD1PromotionGate: {
      completeD1ObjectiveStatus:
        deterministicCalibration.sourceTierObjective?.completeD1ObjectiveStatus,
      completeD1ObjectiveFixtureCount:
        deterministicCalibration.sourceTierObjective?.completeD1ObjectiveFixtureCount,
      completeD1TruthPolicy:
        deterministicCalibration.sourceTierObjective?.completeD1TruthPolicy,
      tierWeights: deterministicCalibration.sourceTierObjective?.tierWeights,
      lowTierPolicy: deterministicCalibration.sourceTierObjective?.lowTierPolicy,
      ruleAbCompleteD1Gate: ruleAbTests.sourceTierGate,
    },
    ruleModeComparisonReport: buildRuleModeComparisonReport(bySourceTier),
    namingCandidateDiversityReport: buildNamingCandidateDiversityReport(bySourceTier, ruleAbTests),
    releaseGates: {
      qualityGateOverall: rpi.qualityGate?.overall,
      sourceTierStatus: sourceSummary.status,
      sourceTierViolationCount: sourceSummary.violationCount,
      defaultPromotionDecision: ruleAbTests.defaultPromotionDecision?.decision,
      completeD1DefaultPromotionGate: ruleAbTests.sourceTierGate?.status,
    },
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const dashboard = buildDashboard(args.metricsDir);
  const outPath = path.join(args.outDir, 'performance-dashboard.json');
  writeJson(outPath, dashboard);
  const summary = {
    outPath,
    schemaVersion: dashboard.schemaVersion,
    rawRpi: dashboard.rpiTrendReport.current.rawScore,
    sourceTierStatus: dashboard.sourceTierCoverageReport.status,
    ruleModeCount: dashboard.ruleModeComparisonReport.modeCount,
    presetCount: dashboard.namingCandidateDiversityReport.schoolPresetDiversity.presetCount,
  };
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`Performance dashboard written to ${outPath}`);
    console.log(`  rawRpi=${summary.rawRpi}`);
    console.log(`  sourceTier=${summary.sourceTierStatus}`);
    console.log(`  ruleModes=${summary.ruleModeCount}`);
    console.log(`  presets=${summary.presetCount}`);
  }
}

await main();
