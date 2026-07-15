import {
  MIN_COMPLETE_D1_OBJECTIVE_FIXTURES,
  completeD1ObjectiveStatusForCount,
} from './complete-d1-objective.mjs';

export const DETERMINISTIC_CALIBRATION_SCHEMA_VERSION =
  'spring-ts.deterministic-calibration.v2';

const CALIBRATION_DECISIONS = new Set([
  'keep_current_default',
  'candidate_selected_for_human_review',
]);

export function completeD1GateFromCalibration(calibration) {
  const calibrationSchemaVersion =
    typeof calibration?.schemaVersion === 'string'
      ? calibration.schemaVersion
      : 'UNKNOWN';
  const completeD1ObjectiveStatus =
    typeof calibration?.sourceTierObjective?.completeD1ObjectiveStatus === 'string'
      ? calibration.sourceTierObjective.completeD1ObjectiveStatus
      : 'UNKNOWN';
  const rawCount = calibration?.sourceTierObjective?.completeD1ObjectiveFixtureCount;
  const countValid = Number.isSafeInteger(rawCount) && rawCount >= 0;
  const completeD1ObjectiveFixtureCount = countValid ? rawCount : 0;
  const calibrationDecision = String(calibration?.selected?.decision ?? 'unknown');
  const statusConsistent = countValid &&
    completeD1ObjectiveStatus ===
      completeD1ObjectiveStatusForCount(completeD1ObjectiveFixtureCount);
  const calibrationContractValid =
    calibrationSchemaVersion === DETERMINISTIC_CALIBRATION_SCHEMA_VERSION &&
    countValid &&
    statusConsistent &&
    CALIBRATION_DECISIONS.has(calibrationDecision);
  const deterministicCalibrationPassed = calibrationContractValid &&
    completeD1ObjectiveStatus === 'READY';
  const status = deterministicCalibrationPassed &&
    calibrationDecision === 'candidate_selected_for_human_review'
    ? 'PASS'
    : 'BLOCKED';
  return {
    requiredBeforeDefaultChange: true,
    status,
    calibrationSchemaVersion,
    requiredCalibrationSchemaVersion: DETERMINISTIC_CALIBRATION_SCHEMA_VERSION,
    calibrationContractValid,
    completeD1ObjectiveStatus,
    completeD1ObjectiveFixtureCount,
    minimumCompleteD1ObjectiveFixtures: MIN_COMPLETE_D1_OBJECTIVE_FIXTURES,
    deterministicCalibrationPassed,
    lowTierPolicy:
      'T2, T1, T0, and NO_REFERENCE feedback is diagnostic only and cannot promote defaults.',
  };
}
