/**
 * test/integration/deterministic-calibration.test.ts
 *
 * Verifies the deterministic calibration v2 artifact and its fail-closed
 * complete-D1 input contract.
 *
 * Run: npm run test:deterministic-calibration
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  D1_TRUTH_COVERAGE_REQUIRED_FIELDS,
  createD1TruthCoverageContract,
} from '../../tools/metrics/d1-truth-coverage-contract.mjs';
import {
  validateCompleteD1CalibrationInput,
} from '../../tools/metrics/complete-d1-calibration-input.mjs';
import {
  completeD1ObjectiveStatusForCount,
  isIncludedInCompleteD1Objective,
} from '../../tools/metrics/complete-d1-objective.mjs';
import { sha256FileDigest } from '../../tools/metrics/artifact-digest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const FIXTURES_PATH = path.resolve(
  SPRING_TS_ROOT,
  'test/fixtures/spring_ts_baseline_cases.json',
);
const METRICS_DIR = path.resolve(SPRING_TS_ROOT, 'metrics');
const TSX_CLI = path.resolve(SPRING_TS_ROOT, 'node_modules/tsx/dist/cli.mjs');

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, evidence?: string): void {
  if (condition) {
    pass += 1;
    console.log('  PASS ' + label + (evidence ? ' (' + evidence + ')' : ''));
  } else {
    fail += 1;
    console.log('  FAIL ' + label + (evidence ? ' (' + evidence + ')' : ''));
  }
}

function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildInputMetric(): any {
  const fixtures = readJson<{ fixtures: Array<{ id: string }> }>(FIXTURES_PATH).fixtures;
  const coverageRows = fixtures.map((fixture, index) => {
    const isComplete = index < 2;
    const isPartial = index === 2;
    const missingRequiredFields = isComplete
      ? []
      : isPartial
        ? [...D1_TRUTH_COVERAGE_REQUIRED_FIELDS.slice(3)]
        : [...D1_TRUTH_COVERAGE_REQUIRED_FIELDS];
    return {
      fixtureId: fixture.id,
      referenceTier: isComplete
        ? index === 0 ? 'T4_PRIMARY_TEXT' : 'T3_AUTHORED_INTERPRETATION'
        : isPartial ? 'T4_PRIMARY_TEXT' : 'NO_REFERENCE',
      referenceKind: isComplete
        ? index === 0 ? 'authority' : 'mixed'
        : isPartial ? 'authority' : 'none',
      sourceType: isComplete || isPartial
        ? 'scoped_complete_d1_test_reference'
        : 'none',
      coverageStatus: isComplete ? 'COMPLETE' : isPartial ? 'PARTIAL' : 'NONE',
      coveredFieldCount:
        D1_TRUTH_COVERAGE_REQUIRED_FIELDS.length - missingRequiredFields.length,
      missingRequiredFields,
      doctrineComplete: isComplete || isPartial,
      namingCalibrationComplete: isComplete,
    };
  });
  return {
    schemaVersion: 'spring-ts.by-source-tier.v2',
    d1TruthCoverage: createD1TruthCoverageContract(coverageRows, {
      expectedFixtureCount: fixtures.length,
    }),
    // Deliberately misleading legacy data: calibration must never consume this.
    schoolPresetBreakdown: {
      rows: fixtures.map((fixture) => ({
        fixtureId: fixture.id,
        authorityTruthEligible: true,
        completeD1TruthEligible: true,
      })),
    },
  };
}

function runCalibration(outDir: string, metricPath: string): any {
  execFileSync(process.execPath, [
    TSX_CLI,
    'scripts/compute-deterministic-calibration.ts',
    '--metrics',
    metricPath,
    '--out-dir',
    outDir,
  ], {
    cwd: SPRING_TS_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return readJson(path.join(outDir, 'deterministic-calibration.json'));
}

function validateMetricExpectFailure(metric: unknown, label: string): {
  label: string;
  failed: boolean;
  output: string;
} {
  const fixtureIds = readJson<{ fixtures: Array<{ id: string }> }>(FIXTURES_PATH)
    .fixtures.map((fixture) => fixture.id);
  try {
    validateCompleteD1CalibrationInput(metric, { expectedFixtureIds: fixtureIds });
    return { label, failed: false, output: '' };
  } catch (error) {
    return {
      label,
      failed: true,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

function collectForbiddenKeyPaths(value: unknown, currentPath = '$'): string[] {
  const forbidden = new Set([
    'authorityTruthEligible',
    'completeD1TruthEligible',
    'truthBucket',
    'eligibleObjectiveFixtureCount',
    'excludedNonAuthorityFixtureCount',
    'includedInObjective',
    'authorityTruthPolicy',
    'objectiveStatus',
    'birth',
    'birthDate',
    'birthTime',
    'calendarType',
    'city',
    'email',
    'freeText',
    'gender',
    'hanja',
    'hangul',
    'ip',
    'name',
    'phone',
    'rawEvent',
    'rawText',
    'sessionId',
    'sourceTier',
    'sourceUrl',
    'userId',
  ]);
  const paths: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      paths.push(...collectForbiddenKeyPaths(item, currentPath + '[' + index + ']'));
    });
    return paths;
  }
  if (!value || typeof value !== 'object') return paths;
  for (const [key, item] of Object.entries(value)) {
    const nextPath = currentPath + '.' + key;
    if (forbidden.has(key)) paths.push(nextPath);
    paths.push(...collectForbiddenKeyPaths(item, nextPath));
  }
  return paths;
}

console.log('Phase 8.2 deterministic calibration v2\n');

const validMetric = buildInputMetric();
const artifact = runCalibration(
  fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-calibration-committed-')),
  path.join(METRICS_DIR, 'bySourceTier.json'),
);
const committedArtifact = readJson(path.join(METRICS_DIR, 'deterministic-calibration.json'));

check('calibration artifact schema version is v2',
  artifact.schemaVersion === 'spring-ts.deterministic-calibration.v2');
check('artifact records the strict bySourceTier v2 input contract',
  artifact.inputSchemaVersion === 'spring-ts.by-source-tier.v2' &&
    artifact.inputMetric === 'metrics/bySourceTier.json#d1TruthCoverage.fixtures' &&
    artifact.inputMetricDigest === sha256FileDigest(
      path.join(METRICS_DIR, 'bySourceTier.json'),
    ));
check('committed calibration artifact deterministically matches committed v2 inputs',
  JSON.stringify(committedArtifact) === JSON.stringify(artifact));
check('complete-D1 objective predicate excludes partial and low-tier profiles',
  isIncludedInCompleteD1Objective({
    coverageStatus: 'COMPLETE',
    referenceTier: 'T4_PRIMARY_TEXT',
  }) === true &&
    isIncludedInCompleteD1Objective({
      coverageStatus: 'PARTIAL',
      referenceTier: 'T4_PRIMARY_TEXT',
    }) === false &&
    isIncludedInCompleteD1Objective({
      coverageStatus: 'COMPLETE',
      referenceTier: 'T2_REFERENCE_IMPLEMENTATION',
    }) === false &&
    completeD1ObjectiveStatusForCount(2) === 'INSUFFICIENT_COMPLETE_D1_TRUTH' &&
    completeD1ObjectiveStatusForCount(3) === 'READY');

const invalidMetrics: Array<{ label: string; value: any }> = [];
const wrongSchema = clone(validMetric);
wrongSchema.schemaVersion = 'spring-ts.by-source-tier.v1';
invalidMetrics.push({ label: 'wrong input schema', value: wrongSchema });

const legacyAlias = clone(validMetric);
legacyAlias.d1TruthCoverage.fixtures[0].authorityTruthEligible = true;
invalidMetrics.push({ label: 'legacy authority alias', value: legacyAlias });

const inconsistentDerivedFields = clone(validMetric);
inconsistentDerivedFields.d1TruthCoverage.fixtures[0].coveredFieldCount = 6;
invalidMetrics.push({ label: 'inconsistent derived fields', value: inconsistentDerivedFields });

const lowTierPartial = clone(validMetric);
lowTierPartial.d1TruthCoverage.fixtures[2].referenceTier = 'T2_REFERENCE_IMPLEMENTATION';
invalidMetrics.push({ label: 'low-tier partial truth', value: lowTierPartial });

const noneKindCovered = clone(validMetric);
noneKindCovered.d1TruthCoverage.fixtures[0].referenceKind = 'none';
invalidMetrics.push({ label: 'covered truth with none reference kind', value: noneKindCovered });

const unknownFixture = clone(validMetric);
unknownFixture.d1TruthCoverage.fixtures.at(-1).fixtureId = 'fix-unknown';
invalidMetrics.push({ label: 'unknown fixture id', value: unknownFixture });

for (const invalid of invalidMetrics) {
  const result = validateMetricExpectFailure(invalid.value, invalid.label);
  check(
    'input validation rejects ' + invalid.label,
    result.failed &&
      result.output.includes('Invalid spring-ts.by-source-tier.v2 complete-D1 input'),
    result.output.trim().split(/\r?\n/).at(-1),
  );
}

check('grid search policy forbids ML/random/default mutation',
  artifact.gridSearchPolicy?.gridKind === 'fixed_parameter_grid' &&
    artifact.gridSearchPolicy?.executionSurface === 'SpringEngine.analyze(mode=evaluate)' &&
    artifact.gridSearchPolicy?.mlAllowed === false &&
    artifact.gridSearchPolicy?.randomSearchAllowed === false &&
    artifact.gridSearchPolicy?.runtimeDefaultMutationAllowed === false &&
    artifact.gridSearchPolicy?.minimumCompleteD1ObjectiveFixtures === 3);
check('one-axis grid is present',
  artifact.grid.length === 31 &&
    artifact.grid.some((row: any) => row.candidateId === 'current_default') &&
    artifact.grid.some((row: any) => row.candidateId === 'schoolPreset:classical_text') &&
    artifact.grid.some((row: any) =>
      row.candidateId === 'scorer:tenGodMode:positional_weighted_v2') &&
    artifact.grid.some((row: any) =>
      row.candidateId === 'evaluator:unknownHourGuard:true:damp:0.5'),
  'grid=' + artifact.grid.length);

const sourceTierObjective = artifact.sourceTierObjective;
check('source-tier objective uses only explicit complete-D1 field names',
  sourceTierObjective?.completeD1ObjectiveStatus ===
      'INSUFFICIENT_COMPLETE_D1_TRUTH' &&
    sourceTierObjective?.completeD1ObjectiveFixtureCount === 0 &&
    typeof sourceTierObjective?.completeD1TruthPolicy === 'string' &&
    !('status' in sourceTierObjective) &&
    !('authorityTruthPolicy' in sourceTierObjective));
check('complete-D1 objective ignores schoolPreset legacy truth aliases',
  artifact.grid.every((candidate: any) =>
    candidate.objective?.completeD1ObjectiveFixtureCount === 0 &&
      candidate.objective?.excludedFromCompleteD1ObjectiveFixtureCount === 17));
check('low-tier rows remain visible but excluded from complete-D1 objective',
  artifact.sourceTierObjective?.tierWeights?.T2_REFERENCE_IMPLEMENTATION === 0 &&
    artifact.sourceTierObjective?.tierWeights?.T1_HYPOTHESIS === 0 &&
    artifact.sourceTierObjective?.tierWeights?.NO_REFERENCE === 0 &&
    artifact.grid.every((candidate: any) => {
      const bucket = candidate.byReferenceTier?.NO_REFERENCE;
      return bucket?.completeD1ObjectiveFixtureCount === 0 &&
        bucket?.includedInCompleteD1Objective === false;
    }));
check('insufficient complete-D1 truth blocks promotion',
  artifact.selected?.candidateId === 'current_default' &&
    artifact.selected?.decision === 'keep_current_default' &&
    artifact.grid.every((candidate: any) =>
      candidate.objective?.promotionEligible === false));

const forbiddenPaths = collectForbiddenKeyPaths(artifact);
check('candidate output has no generic authority aliases or raw source data',
  forbiddenPaths.length === 0,
  forbiddenPaths.slice(0, 5).join(', '));
check('candidate rows retain auditable dedicated D1 coverage',
  artifact.grid.every((candidate: any) =>
    candidate.rows.every((row: any) =>
      ['COMPLETE', 'PARTIAL', 'NONE'].includes(row.coverageStatus) &&
        row.coveredFieldCount + row.missingRequiredFields.length === 7 &&
        typeof row.doctrineComplete === 'boolean' &&
        typeof row.namingCalibrationComplete === 'boolean' &&
        typeof row.includedInCompleteD1Objective === 'boolean')));
check('all candidate scores remain finite and bounded',
  artifact.grid.every((candidate: any) =>
    candidate.rows.every((row: any) =>
      Number.isFinite(row.score?.total) &&
        Number.isFinite(row.score?.saju) &&
        row.score.total >= 0 &&
        row.score.total <= 100 &&
        row.score.saju >= 0 &&
        row.score.saju <= 100)));

console.log('\nDeterministic calibration v2: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail > 0 ? 1 : 0);
