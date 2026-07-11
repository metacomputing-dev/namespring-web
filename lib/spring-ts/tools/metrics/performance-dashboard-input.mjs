import { sha256FileDigest } from './artifact-digest.mjs';
import {
  completeD1ObjectiveStatusForCount,
  isIncludedInCompleteD1Objective,
} from './complete-d1-objective.mjs';
import {
  validateD1TruthCoverageContract,
} from './d1-truth-coverage-contract.mjs';

export const PERFORMANCE_DASHBOARD_INPUT_SCHEMAS = Object.freeze({
  rpiSummary: 'spring-ts.rpi-summary.v2',
  sourceTierSummary: 'spring-ts.source-tier-summary.v2',
  bySourceTier: 'spring-ts.by-source-tier.v2',
  deterministicCalibration: 'spring-ts.deterministic-calibration.v2',
  ruleAbTests: 'spring-ts.rule-ab-tests.v2',
});

function fail(message) {
  throw new Error(`Invalid performance dashboard input snapshot: ${message}`);
}

function requireSchemas(inputs) {
  for (const [label, expected] of Object.entries(PERFORMANCE_DASHBOARD_INPUT_SCHEMAS)) {
    if (inputs[label]?.schemaVersion !== expected) {
      fail(`${label} schema must be ${expected}`);
    }
  }
}

function validateSourceRecordAccounting(sourceSummary) {
  const eligible = sourceSummary.declaredScopeEligibleSourceRecordCount;
  const ineligible = sourceSummary.declaredScopeIneligibleSourceRecordCount;
  if (
    !Number.isSafeInteger(eligible) || eligible < 0 ||
    !Number.isSafeInteger(ineligible) || ineligible < 0 ||
    eligible + ineligible !== sourceSummary.scanned ||
    typeof sourceSummary.eligibilityDefinition !== 'string' ||
    !sourceSummary.eligibilityDefinition.includes('not complete D1 fixture truth')
  ) {
    fail('declared-scope source-record accounting is inconsistent');
  }
  for (const buckets of [sourceSummary.byTier, sourceSummary.bySourceType]) {
    const rows = Object.values(buckets ?? {});
    if (rows.reduce((sum, row) => sum + Number(row.recordCount ?? 0), 0) !== sourceSummary.scanned) {
      fail('source-record buckets do not sum to scanned');
    }
    for (const row of rows) {
      if (
        row.declaredScopeEligibleSourceRecordCount +
          row.declaredScopeIneligibleSourceRecordCount !== row.recordCount
      ) {
        fail('source-record bucket eligibility counts are inconsistent');
      }
    }
  }
  return { eligible, ineligible };
}

export function validatePerformanceDashboardInputs(inputs) {
  requireSchemas(inputs);
  const {
    rpiSummary: rpi,
    sourceTierSummary: sourceSummary,
    bySourceTier,
    deterministicCalibration,
    ruleAbTests,
    inputPaths,
  } = inputs;
  if (!inputPaths || typeof inputPaths !== 'object') fail('inputPaths are required');
  const sourceRecordCounts = validateSourceRecordAccounting(sourceSummary);
  const coverage = validateD1TruthCoverageContract(bySourceTier.d1TruthCoverage, {
    expectedFixtureCount: bySourceTier?.baseline?.fixtureCount,
  });
  const completeObjectiveFixtureCount = coverage.fixtures
    .filter(isIncludedInCompleteD1Objective).length;
  const expectedObjectiveStatus =
    completeD1ObjectiveStatusForCount(completeObjectiveFixtureCount);
  const objective = deterministicCalibration.sourceTierObjective;
  const ruleGate = ruleAbTests.sourceTierGate;
  const incompleteFixtureCount =
    coverage.partialFixtureCount + coverage.noneFixtureCount;
  if (
    deterministicCalibration.inputMetricDigest !== sha256FileDigest(inputPaths.bySourceTier) ||
    ruleAbTests.inputs?.calibrationMetricDigest !==
      sha256FileDigest(inputPaths.deterministicCalibration) ||
    deterministicCalibration.inputSchemaVersion !== bySourceTier.schemaVersion ||
    objective?.completeD1ObjectiveFixtureCount !== completeObjectiveFixtureCount ||
    objective?.completeD1ObjectiveStatus !== expectedObjectiveStatus ||
    ruleGate?.calibrationContractValid !== true ||
    ruleGate?.calibrationSchemaVersion !== deterministicCalibration.schemaVersion ||
    ruleGate?.completeD1ObjectiveFixtureCount !== completeObjectiveFixtureCount ||
    ruleGate?.completeD1ObjectiveStatus !== expectedObjectiveStatus ||
    bySourceTier.truthSeparation?.insufficientSourceTruthCount !== incompleteFixtureCount ||
    bySourceTier.truthSeparation?.authorityMatchCount +
      bySourceTier.truthSeparation?.engineRuleFailureCount !== coverage.completeFixtureCount ||
    JSON.stringify(rpi.truthSeparation) !== JSON.stringify(bySourceTier.truthSeparation) ||
    sourceSummary.violationCount !== rpi.axisScores?.G_validationGovernance?.sourceTierViolations
  ) {
    fail('artifacts are not bound to one coherent complete-D1 snapshot');
  }
  return {
    coverage,
    sourceRecordCounts,
    completeObjectiveFixtureCount,
    expectedObjectiveStatus,
  };
}
