const EPSILON = 1e-9;

export interface FollowPotentialInput {
  strengthIndex: number;
  support: number;
  pressure: number;
  weakThreshold: number;
  strongThreshold: number;
  minDominanceRatio: number;
}

export interface FollowPotentialResult {
  potential: number;
  dominanceRatio: number;
  mode: 'PRESSURE' | 'SUPPORT' | 'NONE';
  weakPotential: number;
  strongPotential: number;
  weakDominanceRatio: number;
  strongDominanceRatio: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Compute the shared follow-pattern signal used by both rule facts and
 * yongshin selection. Keeping this formula in one place prevents the two
 * judgment paths from drifting during jonggyeok recalibration.
 */
export function computeFollowPotential(input: FollowPotentialInput): FollowPotentialResult {
  const {
    strengthIndex,
    support,
    pressure,
    weakThreshold,
    strongThreshold,
    minDominanceRatio,
  } = input;

  const weakDenominator = Math.max(EPSILON, weakThreshold + 1);
  const weakFactor =
    strengthIndex < weakThreshold
      ? clamp01((weakThreshold - strengthIndex) / weakDenominator)
      : 0;
  const weakDominanceRatio = pressure / Math.max(EPSILON, support);
  const weakDominanceFactor = clamp01(
    (weakDominanceRatio - minDominanceRatio) /
      Math.max(EPSILON, minDominanceRatio),
  );
  const weakPotential = clamp01(weakFactor * weakDominanceFactor);

  const strongDenominator = Math.max(EPSILON, 1 - strongThreshold);
  const strongFactor =
    strengthIndex > strongThreshold
      ? clamp01((strengthIndex - strongThreshold) / strongDenominator)
      : 0;
  const strongDominanceRatio = support / Math.max(EPSILON, pressure);
  const strongDominanceFactor = clamp01(
    (strongDominanceRatio - minDominanceRatio) /
      Math.max(EPSILON, minDominanceRatio),
  );
  const strongPotential = clamp01(strongFactor * strongDominanceFactor);

  if (strongPotential > weakPotential) {
    return {
      potential: strongPotential,
      dominanceRatio: strongDominanceRatio,
      mode: strongPotential > 0 ? 'SUPPORT' : 'NONE',
      weakPotential,
      strongPotential,
      weakDominanceRatio,
      strongDominanceRatio,
    };
  }

  return {
    potential: weakPotential,
    dominanceRatio: weakDominanceRatio,
    mode: weakPotential > 0 ? 'PRESSURE' : 'NONE',
    weakPotential,
    strongPotential,
    weakDominanceRatio,
    strongDominanceRatio,
  };
}
