import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  D1_REQUIRED_DOCTRINE_FIELDS,
  D1_REQUIRED_NAMING_FIELDS,
} from '../quality-gate/d1.mjs';
import * as contractModule from './d1-truth-coverage-contract.mjs';
import * as calibrationInputModule from './complete-d1-calibration-input.mjs';
import * as objectiveModule from './complete-d1-objective.mjs';
import * as digestModule from './artifact-digest.mjs';
import * as ruleAbGateModule from './complete-d1-rule-ab-gate.mjs';
import {
  D1_TRUTH_COVERAGE_DEFINITION,
  D1_TRUTH_COVERAGE_REQUIRED_FIELDS,
  D1_TRUTH_COVERAGE_SCHEMA_VERSION,
  D1_TRUTH_COVERAGE_STATUSES,
  createD1TruthCoverageContract,
  validateD1TruthCoverageContract,
} from './d1-truth-coverage-contract.mjs';

const MODULE_URL = new URL('./d1-truth-coverage-contract.mjs', import.meta.url);
const CALIBRATION_INPUT_MODULE_URL = new URL(
  './complete-d1-calibration-input.mjs',
  import.meta.url,
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixtureRow({
  fixtureId,
  missingRequiredFields = [],
  referenceTier = 'T4_PRIMARY_TEXT',
  referenceKind = 'authority',
  sourceType = 'contract_test',
}) {
  const missing = new Set(missingRequiredFields);
  const coveredFieldCount =
    D1_TRUTH_COVERAGE_REQUIRED_FIELDS.length - missingRequiredFields.length;
  return {
    fixtureId,
    referenceTier,
    referenceKind,
    sourceType,
    coverageStatus: coveredFieldCount === D1_TRUTH_COVERAGE_REQUIRED_FIELDS.length
      ? 'COMPLETE'
      : coveredFieldCount > 0 ? 'PARTIAL' : 'NONE',
    coveredFieldCount,
    missingRequiredFields: [...missingRequiredFields],
    doctrineComplete: D1_REQUIRED_DOCTRINE_FIELDS
      .every((field) => !missing.has(field)),
    namingCalibrationComplete: D1_REQUIRED_NAMING_FIELDS
      .every((field) => !missing.has(field)),
  };
}

function boundaryRows() {
  return [
    fixtureRow({ fixtureId: 'complete-7-of-7' }),
    fixtureRow({
      fixtureId: 'partial-1-of-7',
      missingRequiredFields: D1_TRUTH_COVERAGE_REQUIRED_FIELDS.slice(1),
    }),
    fixtureRow({
      fixtureId: 'none-0-of-7',
      missingRequiredFields: D1_TRUTH_COVERAGE_REQUIRED_FIELDS,
      referenceTier: 'NO_REFERENCE',
      referenceKind: 'none',
      sourceType: 'none',
    }),
  ];
}

function validCoverage() {
  return createD1TruthCoverageContract(boundaryRows(), {
    expectedFixtureCount: 3,
  });
}

test('public contract exports and canonical seven-field constants stay exact', () => {
  assert.deepEqual(Object.keys(contractModule).sort(), [
    'D1_TRUTH_COVERAGE_DEFINITION',
    'D1_TRUTH_COVERAGE_REQUIRED_FIELDS',
    'D1_TRUTH_COVERAGE_SCHEMA_VERSION',
    'D1_TRUTH_COVERAGE_STATUSES',
    'createD1TruthCoverageContract',
    'validateD1TruthCoverageContract',
  ]);
  assert.equal(D1_TRUTH_COVERAGE_SCHEMA_VERSION, 'spring-ts.d1-truth-coverage.v1');
  assert.equal(
    D1_TRUTH_COVERAGE_DEFINITION,
    'D1 requires all three doctrine and four naming-calibration fields from scope-eligible references',
  );
  assert.deepEqual([...D1_TRUTH_COVERAGE_REQUIRED_FIELDS], [
    ...D1_REQUIRED_DOCTRINE_FIELDS,
    ...D1_REQUIRED_NAMING_FIELDS,
  ]);
  assert.equal(D1_TRUTH_COVERAGE_REQUIRED_FIELDS.length, 7);
  assert.deepEqual([...D1_TRUTH_COVERAGE_STATUSES], ['COMPLETE', 'PARTIAL', 'NONE']);
  assert.equal(Object.isFrozen(D1_TRUTH_COVERAGE_REQUIRED_FIELDS), true);
  assert.equal(Object.isFrozen(D1_TRUTH_COVERAGE_STATUSES), true);
});

test('COMPLETE 7/7, PARTIAL 1/7, and NONE 0/7 stay disjoint', () => {
  const coverage = validCoverage();
  assert.strictEqual(validateD1TruthCoverageContract(coverage, {
    expectedFixtureCount: 3,
  }), coverage);
  assert.deepEqual({
    fixtureCount: coverage.fixtureCount,
    complete: coverage.completeFixtureCount,
    partial: coverage.partialFixtureCount,
    none: coverage.noneFixtureCount,
    doctrineComplete: coverage.doctrineCompleteFixtureCount,
    namingComplete: coverage.namingCalibrationCompleteFixtureCount,
  }, {
    fixtureCount: 3,
    complete: 1,
    partial: 1,
    none: 1,
    doctrineComplete: 1,
    namingComplete: 1,
  });

  const [complete, partial, none] = coverage.fixtures;
  assert.deepEqual(
    [complete.coverageStatus, complete.coveredFieldCount, complete.missingRequiredFields],
    ['COMPLETE', 7, []],
  );
  assert.deepEqual(
    [partial.coverageStatus, partial.coveredFieldCount],
    ['PARTIAL', 1],
  );
  assert.equal(partial.doctrineComplete, false);
  assert.equal(partial.namingCalibrationComplete, false);
  assert.deepEqual(
    [none.coverageStatus, none.coveredFieldCount, none.missingRequiredFields],
    ['NONE', 0, [...D1_TRUTH_COVERAGE_REQUIRED_FIELDS]],
  );
});

test('duplicate fixture IDs fail closed', () => {
  const row = fixtureRow({ fixtureId: 'duplicate' });
  assert.throws(
    () => createD1TruthCoverageContract([row, { ...row }]),
    /duplicate fixtureId duplicate/u,
  );
  assert.throws(
    () => validateD1TruthCoverageContract(validCoverage(), {
      expectedFixtureIds: ['different-1', 'different-2', 'different-3'],
    }),
    /canonical fixture order/u,
  );
});

test('stale schemas, legacy aliases, and unknown fields fail closed', () => {
  const staleSchema = clone(validCoverage());
  staleSchema.schemaVersion = 'spring-ts.d1-truth-coverage.v0';
  assert.throws(
    () => validateD1TruthCoverageContract(staleSchema),
    /header does not match/u,
  );

  const staleRequiredField = clone(validCoverage());
  staleRequiredField.requiredFields[0] = 'sajuReport.gyeokguk';
  assert.throws(
    () => validateD1TruthCoverageContract(staleRequiredField),
    /header does not match/u,
  );

  const legacyAlias = clone(validCoverage());
  legacyAlias.fixtures[0].authorityTruthEligible = true;
  assert.throws(
    () => validateD1TruthCoverageContract(legacyAlias),
    /unexpected shape/u,
  );

  const unknownMissingField = clone(validCoverage());
  unknownMissingField.fixtures[1].missingRequiredFields[0] = 'sajuReport.unknown';
  assert.throws(
    () => validateD1TruthCoverageContract(unknownMissingField),
    /invalid missingRequiredFields/u,
  );

  const unknownTopLevelField = clone(validCoverage());
  unknownTopLevelField.authorityTruthEligibleCount = 3;
  assert.throws(
    () => validateD1TruthCoverageContract(unknownTopLevelField),
    /top-level shape is invalid/u,
  );
});

test('corrupt derived booleans, counts, statuses, and aggregates fail closed', () => {
  for (const [field, value] of [
    ['coverageStatus', 'PARTIAL'],
    ['coveredFieldCount', 6],
    ['doctrineComplete', false],
    ['namingCalibrationComplete', false],
  ]) {
    const corrupt = clone(validCoverage());
    corrupt.fixtures[0][field] = value;
    assert.throws(
      () => validateD1TruthCoverageContract(corrupt),
      /derived fields are inconsistent/u,
      field,
    );
  }

  const corruptAggregate = clone(validCoverage());
  corruptAggregate.completeFixtureCount = 2;
  assert.throws(
    () => validateD1TruthCoverageContract(corruptAggregate),
    /aggregate counts do not match/u,
  );

  assert.throws(
    () => validateD1TruthCoverageContract(validCoverage(), { expectedFixtureCount: 4 }),
    /header does not match/u,
  );

  for (const overrides of [
    { referenceTier: 'T2_REFERENCE_IMPLEMENTATION' },
    { referenceKind: 'none' },
    { sourceType: 'none' },
  ]) {
    assert.throws(
      () => createD1TruthCoverageContract([
        fixtureRow({ fixtureId: 'fabricated-complete', ...overrides }),
      ]),
      /derived fields are inconsistent/u,
    );
  }
});

test('shared production module stays small, pure, and dependency-bounded', () => {
  const source = fs.readFileSync(MODULE_URL, 'utf8');
  const dependencies = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)]
    .map((match) => match[1])
    .sort();
  assert.ok(
    source.trimEnd().split(/\r?\n/u).length <= 200,
    'D1 truth coverage contract must remain at or below 200 lines',
  );
  assert.deepEqual(dependencies, ['../quality-gate/d1.mjs']);
  assert.doesNotMatch(source, /\bimport\s*\(/u);
  assert.doesNotMatch(source, /\bprocess\.(?:argv|exit)\b/u);
  assert.doesNotMatch(source, /scripts[\\/](?:compute-rpi|compute-performance-dashboard|compute-deterministic-calibration)/u);
});

test('calibration input wrapper binds schema and canonical fixture IDs', () => {
  assert.deepEqual(Object.keys(calibrationInputModule).sort(), [
    'BY_SOURCE_TIER_INPUT_SCHEMA_VERSION',
    'validateCompleteD1CalibrationInput',
  ]);
  const coverage = validCoverage();
  const metric = {
    schemaVersion: calibrationInputModule.BY_SOURCE_TIER_INPUT_SCHEMA_VERSION,
    d1TruthCoverage: coverage,
  };
  assert.strictEqual(calibrationInputModule.validateCompleteD1CalibrationInput(metric, {
    expectedFixtureIds: coverage.fixtures.map((row) => row.fixtureId),
  }), coverage);
  assert.throws(
    () => calibrationInputModule.validateCompleteD1CalibrationInput(
      { ...metric, schemaVersion: 'spring-ts.by-source-tier.v1' },
      { expectedFixtureIds: coverage.fixtures.map((row) => row.fixtureId) },
    ),
    /schemaVersion must be spring-ts\.by-source-tier\.v2/u,
  );
  const source = fs.readFileSync(CALIBRATION_INPUT_MODULE_URL, 'utf8');
  assert.ok(source.trimEnd().split(/\r?\n/u).length <= 80);
  assert.deepEqual(
    [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)].map((match) => match[1]),
    ['./d1-truth-coverage-contract.mjs'],
  );
  assert.doesNotMatch(source, /\bprocess\.(?:argv|exit)\b/u);
});

test('complete-D1 objective policy is centralized and fail closed', () => {
  assert.deepEqual(Object.keys(objectiveModule).sort(), [
    'COMPLETE_D1_OBJECTIVE_TIER_WEIGHTS',
    'MIN_COMPLETE_D1_OBJECTIVE_FIXTURES',
    'completeD1ObjectiveStatusForCount',
    'completeD1ObjectiveWeightForTier',
    'isIncludedInCompleteD1Objective',
  ]);
  assert.equal(Object.isFrozen(objectiveModule.COMPLETE_D1_OBJECTIVE_TIER_WEIGHTS), true);
  assert.equal(objectiveModule.isIncludedInCompleteD1Objective({
    coverageStatus: 'COMPLETE',
    referenceTier: 'T4_PRIMARY_TEXT',
  }), true);
  assert.equal(objectiveModule.isIncludedInCompleteD1Objective({
    coverageStatus: 'PARTIAL',
    referenceTier: 'T5_OFFICIAL',
  }), false);
  assert.equal(objectiveModule.isIncludedInCompleteD1Objective({
    coverageStatus: 'COMPLETE',
    referenceTier: 'T2_REFERENCE_IMPLEMENTATION',
  }), false);
  assert.equal(objectiveModule.completeD1ObjectiveStatusForCount(2),
    'INSUFFICIENT_COMPLETE_D1_TRUTH');
  assert.equal(objectiveModule.completeD1ObjectiveStatusForCount(3), 'READY');
  assert.throws(() => objectiveModule.completeD1ObjectiveStatusForCount(-1));
});

test('artifact digest helper produces stable lowercase SHA-256 bindings', () => {
  assert.deepEqual(Object.keys(digestModule), ['sha256FileDigest']);
  const first = digestModule.sha256FileDigest(MODULE_URL);
  const second = digestModule.sha256FileDigest(MODULE_URL);
  assert.match(first, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(first, second);
});

test('rule A/B gate consumes only coherent calibration v2 objectives', () => {
  assert.deepEqual(Object.keys(ruleAbGateModule).sort(), [
    'DETERMINISTIC_CALIBRATION_SCHEMA_VERSION',
    'completeD1GateFromCalibration',
  ]);
  const ready = ruleAbGateModule.completeD1GateFromCalibration({
    schemaVersion: 'spring-ts.deterministic-calibration.v2',
    sourceTierObjective: {
      completeD1ObjectiveStatus: 'READY',
      completeD1ObjectiveFixtureCount: 3,
    },
    selected: { decision: 'candidate_selected_for_human_review' },
  });
  assert.equal(ready.calibrationContractValid, true);
  assert.equal(ready.status, 'PASS');
  const inconsistent = ruleAbGateModule.completeD1GateFromCalibration({
    schemaVersion: 'spring-ts.deterministic-calibration.v2',
    sourceTierObjective: {
      completeD1ObjectiveStatus: 'READY',
      completeD1ObjectiveFixtureCount: 2,
    },
    selected: { decision: 'candidate_selected_for_human_review' },
  });
  assert.equal(inconsistent.calibrationContractValid, false);
  assert.equal(inconsistent.status, 'BLOCKED');
});
