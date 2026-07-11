import {
  D1_REQUIRED_DOCTRINE_FIELDS,
  D1_REQUIRED_NAMING_FIELDS,
} from '../quality-gate/d1.mjs';

export const D1_TRUTH_COVERAGE_SCHEMA_VERSION =
  'spring-ts.d1-truth-coverage.v1';
export const D1_TRUTH_COVERAGE_DEFINITION =
  'D1 requires all three doctrine and four naming-calibration fields from scope-eligible references';
export const D1_TRUTH_COVERAGE_REQUIRED_FIELDS = Object.freeze([
  ...D1_REQUIRED_DOCTRINE_FIELDS,
  ...D1_REQUIRED_NAMING_FIELDS,
]);
export const D1_TRUTH_COVERAGE_STATUSES = Object.freeze([
  'COMPLETE',
  'PARTIAL',
  'NONE',
]);

const COVERAGE_KEYS = Object.freeze([
  'schemaVersion',
  'contract',
  'requiredFields',
  'requiredFieldCount',
  'fixtureCount',
  'completeFixtureCount',
  'partialFixtureCount',
  'noneFixtureCount',
  'doctrineCompleteFixtureCount',
  'namingCalibrationCompleteFixtureCount',
  'fixtures',
]);
const FIXTURE_KEYS = Object.freeze([
  'fixtureId',
  'referenceTier',
  'referenceKind',
  'sourceType',
  'coverageStatus',
  'coveredFieldCount',
  'missingRequiredFields',
  'doctrineComplete',
  'namingCalibrationComplete',
]);
const REFERENCE_KINDS = new Set(['authority', 'oracle', 'mixed', 'none']);
const STATUS_SET = new Set(D1_TRUTH_COVERAGE_STATUSES);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function fail(message) {
  throw new Error(`Invalid D1 truth coverage contract: ${message}`);
}

function derivedFixtureState(row) {
  if (!hasExactKeys(row, FIXTURE_KEYS)) fail('fixture row has an unexpected shape');
  if (
    !nonEmpty(row.fixtureId) ||
    !nonEmpty(row.referenceTier) ||
    !nonEmpty(row.sourceType) ||
    !REFERENCE_KINDS.has(row.referenceKind) ||
    !STATUS_SET.has(row.coverageStatus) ||
    typeof row.doctrineComplete !== 'boolean' ||
    typeof row.namingCalibrationComplete !== 'boolean' ||
    !Array.isArray(row.missingRequiredFields)
  ) {
    fail(`fixture ${String(row.fixtureId)} has invalid scalar fields`);
  }
  const missingSet = new Set(row.missingRequiredFields);
  if (
    missingSet.size !== row.missingRequiredFields.length ||
    row.missingRequiredFields.some((field) =>
      !D1_TRUTH_COVERAGE_REQUIRED_FIELDS.includes(field))
  ) {
    fail(`fixture ${row.fixtureId} has invalid missingRequiredFields`);
  }
  const canonicalMissing = D1_TRUTH_COVERAGE_REQUIRED_FIELDS
    .filter((field) => missingSet.has(field));
  if (JSON.stringify(canonicalMissing) !== JSON.stringify(row.missingRequiredFields)) {
    fail(`fixture ${row.fixtureId} missingRequiredFields are not in canonical order`);
  }
  const coveredFieldCount =
    D1_TRUTH_COVERAGE_REQUIRED_FIELDS.length - canonicalMissing.length;
  const coverageStatus = coveredFieldCount === D1_TRUTH_COVERAGE_REQUIRED_FIELDS.length
    ? 'COMPLETE'
    : coveredFieldCount > 0 ? 'PARTIAL' : 'NONE';
  const tierMatch = row.referenceTier.match(/^T([0-5])_[A-Z0-9_]+$/);
  const tierRank = tierMatch ? Number(tierMatch[1]) : null;
  const doctrineComplete = D1_REQUIRED_DOCTRINE_FIELDS
    .every((field) => !missingSet.has(field));
  const namingCalibrationComplete = D1_REQUIRED_NAMING_FIELDS
    .every((field) => !missingSet.has(field));
  if (
    row.coveredFieldCount !== coveredFieldCount ||
    row.coverageStatus !== coverageStatus ||
    row.doctrineComplete !== doctrineComplete ||
    row.namingCalibrationComplete !== namingCalibrationComplete ||
    (coverageStatus !== 'NONE' &&
      (tierRank === null || tierRank < 3 || row.referenceKind === 'none' || row.sourceType === 'none'))
  ) {
    fail(`fixture ${row.fixtureId} derived fields are inconsistent`);
  }
  return { coverageStatus, doctrineComplete, namingCalibrationComplete };
}

export function validateD1TruthCoverageContract(coverage, {
  expectedFixtureCount,
  expectedFixtureIds,
} = {}) {
  if (!hasExactKeys(coverage, COVERAGE_KEYS)) fail('top-level shape is invalid');
  if (
    coverage.schemaVersion !== D1_TRUTH_COVERAGE_SCHEMA_VERSION ||
    coverage.contract !== D1_TRUTH_COVERAGE_DEFINITION ||
    coverage.requiredFieldCount !== D1_TRUTH_COVERAGE_REQUIRED_FIELDS.length ||
    JSON.stringify(coverage.requiredFields) !==
      JSON.stringify(D1_TRUTH_COVERAGE_REQUIRED_FIELDS) ||
    !Array.isArray(coverage.fixtures) ||
    coverage.fixtureCount !== coverage.fixtures.length ||
    (expectedFixtureCount !== undefined &&
      coverage.fixtureCount !== expectedFixtureCount) ||
    (expectedFixtureIds !== undefined &&
      (!Array.isArray(expectedFixtureIds) ||
        coverage.fixtureCount !== expectedFixtureIds.length ||
        new Set(expectedFixtureIds).size !== expectedFixtureIds.length))
  ) {
    fail('header does not match the canonical seven-field contract');
  }
  const fixtureIds = new Set();
  const counts = { COMPLETE: 0, PARTIAL: 0, NONE: 0 };
  let doctrineCompleteFixtureCount = 0;
  let namingCalibrationCompleteFixtureCount = 0;
  for (const row of coverage.fixtures) {
    if (fixtureIds.has(row?.fixtureId)) fail(`duplicate fixtureId ${row.fixtureId}`);
    const derived = derivedFixtureState(row);
    fixtureIds.add(row.fixtureId);
    counts[derived.coverageStatus] += 1;
    if (derived.doctrineComplete) doctrineCompleteFixtureCount += 1;
    if (derived.namingCalibrationComplete) namingCalibrationCompleteFixtureCount += 1;
  }
  if (
    expectedFixtureIds !== undefined &&
    JSON.stringify(coverage.fixtures.map((row) => row.fixtureId)) !==
      JSON.stringify(expectedFixtureIds)
  ) {
    fail('fixture IDs do not match the canonical fixture order');
  }
  if (
    coverage.completeFixtureCount !== counts.COMPLETE ||
    coverage.partialFixtureCount !== counts.PARTIAL ||
    coverage.noneFixtureCount !== counts.NONE ||
    coverage.doctrineCompleteFixtureCount !== doctrineCompleteFixtureCount ||
    coverage.namingCalibrationCompleteFixtureCount !==
      namingCalibrationCompleteFixtureCount
  ) {
    fail('aggregate counts do not match fixture rows');
  }
  return coverage;
}

export function createD1TruthCoverageContract(fixtures, options = {}) {
  if (!Array.isArray(fixtures)) fail('fixtures must be an array');
  const rows = fixtures.map((row) => ({
    ...row,
    missingRequiredFields: [...row.missingRequiredFields],
  }));
  const coverage = {
    schemaVersion: D1_TRUTH_COVERAGE_SCHEMA_VERSION,
    contract: D1_TRUTH_COVERAGE_DEFINITION,
    requiredFields: [...D1_TRUTH_COVERAGE_REQUIRED_FIELDS],
    requiredFieldCount: D1_TRUTH_COVERAGE_REQUIRED_FIELDS.length,
    fixtureCount: rows.length,
    completeFixtureCount: rows.filter((row) => row.coverageStatus === 'COMPLETE').length,
    partialFixtureCount: rows.filter((row) => row.coverageStatus === 'PARTIAL').length,
    noneFixtureCount: rows.filter((row) => row.coverageStatus === 'NONE').length,
    doctrineCompleteFixtureCount: rows.filter((row) => row.doctrineComplete).length,
    namingCalibrationCompleteFixtureCount: rows
      .filter((row) => row.namingCalibrationComplete).length,
    fixtures: rows,
  };
  return validateD1TruthCoverageContract(coverage, options);
}
