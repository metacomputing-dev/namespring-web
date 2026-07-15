import {
  validateD1TruthCoverageContract,
} from './d1-truth-coverage-contract.mjs';

export const BY_SOURCE_TIER_INPUT_SCHEMA_VERSION =
  'spring-ts.by-source-tier.v2';

function fail(message) {
  throw new Error(
    `Invalid ${BY_SOURCE_TIER_INPUT_SCHEMA_VERSION} complete-D1 input: ${message}`,
  );
}

export function validateCompleteD1CalibrationInput(metric, {
  expectedFixtureIds,
} = {}) {
  if (
    !metric ||
    typeof metric !== 'object' ||
    Array.isArray(metric) ||
    metric.schemaVersion !== BY_SOURCE_TIER_INPUT_SCHEMA_VERSION
  ) {
    fail(`schemaVersion must be ${BY_SOURCE_TIER_INPUT_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(expectedFixtureIds)) {
    fail('expectedFixtureIds must be supplied by the canonical baseline');
  }
  try {
    return validateD1TruthCoverageContract(metric.d1TruthCoverage, {
      expectedFixtureCount: expectedFixtureIds.length,
      expectedFixtureIds,
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
