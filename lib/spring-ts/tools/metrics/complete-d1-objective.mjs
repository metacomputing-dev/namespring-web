export const MIN_COMPLETE_D1_OBJECTIVE_FIXTURES = 3;

export const COMPLETE_D1_OBJECTIVE_TIER_WEIGHTS = Object.freeze({
  T5_OFFICIAL: 5,
  T4_PRIMARY_TEXT: 4,
  T3_AUTHORED_INTERPRETATION: 2,
  T2_REFERENCE_IMPLEMENTATION: 0,
  T1_HYPOTHESIS: 0,
  T0_UNSOURCED: 0,
  NO_REFERENCE: 0,
});

export function completeD1ObjectiveWeightForTier(tier) {
  if (Object.hasOwn(COMPLETE_D1_OBJECTIVE_TIER_WEIGHTS, tier)) {
    return COMPLETE_D1_OBJECTIVE_TIER_WEIGHTS[tier];
  }
  if (/^T5_/.test(tier)) return COMPLETE_D1_OBJECTIVE_TIER_WEIGHTS.T5_OFFICIAL;
  if (/^T4_/.test(tier)) return COMPLETE_D1_OBJECTIVE_TIER_WEIGHTS.T4_PRIMARY_TEXT;
  if (/^T3_/.test(tier)) return COMPLETE_D1_OBJECTIVE_TIER_WEIGHTS.T3_AUTHORED_INTERPRETATION;
  return 0;
}

export function isIncludedInCompleteD1Objective(profile) {
  return profile?.coverageStatus === 'COMPLETE' &&
    completeD1ObjectiveWeightForTier(profile?.referenceTier) > 0;
}

export function completeD1ObjectiveStatusForCount(count) {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Complete-D1 objective fixture count must be a non-negative safe integer');
  }
  return count >= MIN_COMPLETE_D1_OBJECTIVE_FIXTURES
    ? 'READY'
    : 'INSUFFICIENT_COMPLETE_D1_TRUTH';
}
