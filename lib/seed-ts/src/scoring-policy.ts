import { deepFreeze } from './utils/deep-freeze.js';

export interface SeedScoringPolicyV1 {
  readonly schemaVersion: 'namespring.seed-scoring-policy/v1';
  readonly energy: {
    readonly polarityWeight: 0.5;
    readonly elementWeight: 0.5;
    readonly elementBaseline: 70;
    readonly generatingAdjustment: 15;
    readonly overcomingAdjustment: -20;
    readonly sameElementAdjustment: -5;
    readonly minimumScore: 0;
    readonly maximumScore: 100;
  };
  readonly componentAggregation: {
    readonly method: 'arithmetic-mean-of-enabled-components';
  };
  readonly reviewWarnings: readonly [{
    readonly id: 'same-element-adjustment-expert-review';
    readonly status: 'expert-review-required';
    readonly currentAdjustment: -5;
    readonly reason: string;
  }];
}

/**
 * Versioned snapshot of the currently shipped score arithmetic.
 *
 * The same-element adjustment intentionally remains -5 in v1 so this
 * refactor cannot alter existing scores. That value conflicts with the
 * model's supportive description of equal elements and requires a separate
 * authority-backed decision before any future policy version changes it.
 */
export const SEED_SCORING_POLICY: SeedScoringPolicyV1 = deepFreeze({
  schemaVersion: 'namespring.seed-scoring-policy/v1',
  energy: {
    polarityWeight: 0.5,
    elementWeight: 0.5,
    elementBaseline: 70,
    generatingAdjustment: 15,
    overcomingAdjustment: -20,
    sameElementAdjustment: -5,
    minimumScore: 0,
    maximumScore: 100,
  },
  componentAggregation: {
    method: 'arithmetic-mean-of-enabled-components',
  },
  reviewWarnings: [{
    id: 'same-element-adjustment-expert-review',
    status: 'expert-review-required',
    currentAdjustment: -5,
    reason: 'The existing -5 adjustment is preserved for compatibility but conflicts with the supportive same-element description.',
  }],
});

export function combineEnergyScores(
  polarityScore: number,
  elementScore: number,
): number {
  const policy = SEED_SCORING_POLICY.energy;
  return polarityScore * policy.polarityWeight
    + elementScore * policy.elementWeight;
}

export function calculateElementRelationScore(counts: {
  readonly generating: number;
  readonly overcoming: number;
  readonly same: number;
}): number {
  const policy = SEED_SCORING_POLICY.energy;
  const score = policy.elementBaseline
    + counts.generating * policy.generatingAdjustment
    + counts.overcoming * policy.overcomingAdjustment
    + counts.same * policy.sameElementAdjustment;
  return Math.min(policy.maximumScore, Math.max(policy.minimumScore, score));
}

export function averageEnabledComponentScores(scores: readonly number[]): number {
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}
