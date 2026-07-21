/**
 * Runtime contract for the engine-owned `strategies.fortune` surface.
 *
 * Keep this module dependency-free so both API validation and policy
 * compilation can share one authoritative vocabulary without creating an
 * API/fortune import cycle.
 */
export const FORTUNE_HORIZON_LIMITS = Object.freeze({
  maxDecades: 10,
  maxYears: 122,
  maxMonths: 1_600,
  maxDays: 3_660,
});

export const FORTUNE_POLICY_LIMITS = Object.freeze({
  minStartAge: FORTUNE_HORIZON_LIMITS.maxYears,
  decadeLengthYears: FORTUNE_HORIZON_LIMITS.maxYears,
  // Pillars repeat every 60 steps. Direction has its own signed axis, so
  // canonical offsets are non-negative and values above 59 add no meaning.
  firstDecadeOffsetSteps: 59,
});

export const FORTUNE_POLICY_KEYS = [
  'directionRule',
  'startBoundary',
  'startAgeMethod',
  'startAge',
  'startAgeRounding',
  'minStartAge',
  'firstDecadeOffsetSteps',
  'decadeLengthYears',
  'maxDecades',
  'maxYears',
  'maxMonths',
  'maxDays',
  'ageDisplay',
  'axis',
] as const;

export const FORTUNE_DIRECTION_RULES = [
  'sex_yearStemYinYang',
  'fixedForward',
  'fixedBackward',
] as const;

export const FORTUNE_START_BOUNDARIES = ['jie'] as const;

export const FORTUNE_START_AGE_METHODS = [
  'threeDaysOneYear',
  'oneDayFourMonths',
] as const;

export const FORTUNE_START_AGE_ROUNDINGS = [
  'round1down2up',
  'threshold8months',
  'floor',
  'ceil',
  'none',
] as const;

export const FORTUNE_AGE_DISPLAY_MODES = [
  'continuousFromBirth',
  'koreanCountingAge',
] as const;

export const FORTUNE_AXES = ['ageOnly', 'utcByGregorianYear'] as const;
