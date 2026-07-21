import { deepFreeze } from './utils/deep-freeze.js';
import { SeedCalculationError } from './errors.js';

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
  readonly authorityDecisions: readonly {
    readonly id: string;
    readonly status: 'expert-review-required';
    readonly scope: string;
    readonly reason: string;
  }[];
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
  authorityDecisions: [
    {
      id: 'energy-coefficients-and-weights',
      status: 'expert-review-required',
      scope: 'All shipped energy weights, baseline, adjustments, and score clamps.',
      reason: 'Compatibility values are deterministic but have not been approved by an external naming-theory authority.',
    },
    {
      id: 'directional-adjacency',
      status: 'expert-review-required',
      scope: 'Left-to-right adjacent element relationships only.',
      reason: 'The directional adjacency model is shipped behavior without documented external authority approval.',
    },
    {
      id: 'component-aggregation',
      status: 'expert-review-required',
      scope: 'Arithmetic mean across enabled Hangul, Hanja, and four-frame components.',
      reason: 'Equal component aggregation is provisional and not authority-calibrated.',
    },
    {
      id: 'length-normalization',
      status: 'expert-review-required',
      scope: 'Relationship scores are not normalized by the number of adjacent pairs.',
      reason: 'Names of different lengths can accumulate different relation adjustments; changing this debt would alter valid scores.',
    },
  ],
  reviewWarnings: [{
    id: 'same-element-adjustment-expert-review',
    status: 'expert-review-required',
    currentAdjustment: -5,
    reason: 'The existing -5 adjustment is preserved for compatibility but conflicts with the supportive same-element description.',
  }],
});

function failScore(path: string, reason: string, received: unknown): never {
  throw new SeedCalculationError(
    'INVALID_SCORE_INPUT',
    reason,
    path,
    received,
  );
}

function assertScore(value: unknown, path: string): number {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < SEED_SCORING_POLICY.energy.minimumScore
    || value > SEED_SCORING_POLICY.energy.maximumScore
  ) {
    failScore(path, 'Score must be finite and within the policy score range.', value);
  }
  return value;
}

export function combineEnergyScores(
  polarityScore: number,
  elementScore: number,
): number {
  const policy = SEED_SCORING_POLICY.energy;
  return assertScore(polarityScore, 'polarityScore') * policy.polarityWeight
    + assertScore(elementScore, 'elementScore') * policy.elementWeight;
}

export function calculateElementRelationScore(counts: {
  readonly generating: number;
  readonly overcoming: number;
  readonly same: number;
}): number {
  if (typeof counts !== 'object' || counts === null || Array.isArray(counts)) {
    failScore('counts', 'Relation counts must be an object.', counts);
  }
  for (const key of ['generating', 'overcoming', 'same'] as const) {
    const value = counts[key];
    if (!Number.isSafeInteger(value) || value < 0) {
      failScore(
        `counts.${key}`,
        'Relation counts must be non-negative safe integers.',
        value,
      );
    }
  }
  const policy = SEED_SCORING_POLICY.energy;
  const score = policy.elementBaseline
    + counts.generating * policy.generatingAdjustment
    + counts.overcoming * policy.overcomingAdjustment
    + counts.same * policy.sameElementAdjustment;
  return Math.min(policy.maximumScore, Math.max(policy.minimumScore, score));
}

export function averageEnabledComponentScores(scores: readonly number[]): number {
  if (!Array.isArray(scores) || scores.length === 0) {
    failScore('scores', 'Enabled component scores must be a non-empty array.', scores);
  }
  const validatedScores = scores.map((score, index) =>
    assertScore(score, `scores[${index}]`));
  return validatedScores.reduce((sum, value) => sum + value, 0)
    / validatedScores.length;
}
