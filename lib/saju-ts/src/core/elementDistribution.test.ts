import { describe, expect, it } from 'vitest';

import { createEngine } from '../api/engine.js';
import type { ElementVector } from './elementVector.js';
import { elementDistributionFromPillars } from './elementDistribution.js';
import type { PillarIdx } from './cycle.js';
import { pillar } from './cycle.js';

const PILLARS: [PillarIdx, PillarIdx, PillarIdx, PillarIdx] = [
  pillar(0, 0),
  pillar(2, 1),
  pillar(4, 2),
  pillar(6, 3),
];

function expectVector(actual: ElementVector, expected: ElementVector): void {
  for (const key of ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'] as const) {
    expect(actual[key]).toBeCloseTo(expected[key], 10);
  }
}

describe('elementDistributionFromPillars position weights', () => {
  it('preserves the legacy distribution when no position weights are provided', () => {
    const distribution = elementDistributionFromPillars(PILLARS);

    expectVector(distribution.heaven, { WOOD: 1, FIRE: 1, EARTH: 1, METAL: 1, WATER: 0 });
    expectVector(distribution.hidden, { WOOD: 1.6, FIRE: 0.3, EARTH: 0.7, METAL: 0.1, WATER: 1.3 });
    expectVector(distribution.total, { WOOD: 2.6, FIRE: 1.3, EARTH: 1.7, METAL: 1.1, WATER: 1.3 });
  });

  it('applies shared position weights to both heaven stems and branch hidden stems', () => {
    const distribution = elementDistributionFromPillars(PILLARS, {
      positionWeights: { month: 2 },
    });

    expectVector(distribution.heaven, { WOOD: 1, FIRE: 2, EARTH: 1, METAL: 1, WATER: 0 });
    expectVector(distribution.hidden, { WOOD: 1.6, FIRE: 0.3, EARTH: 1.3, METAL: 0.2, WATER: 1.6 });
    expectVector(distribution.total, { WOOD: 2.6, FIRE: 2.3, EARTH: 2.3, METAL: 1.2, WATER: 1.6 });
  });

  it('allows heaven and branch position weights to diverge', () => {
    const distribution = elementDistributionFromPillars(PILLARS, {
      heavenPositionWeights: { month: 3 },
      branchPositionWeights: { month: 4 },
    });

    expectVector(distribution.heaven, { WOOD: 1, FIRE: 3, EARTH: 1, METAL: 1, WATER: 0 });
    expectVector(distribution.hidden, { WOOD: 1.6, FIRE: 0.3, EARTH: 2.5, METAL: 0.4, WATER: 2.2 });
    expectVector(distribution.total, { WOOD: 2.6, FIRE: 3.3, EARTH: 3.5, METAL: 1.4, WATER: 2.2 });
  });

  it('ignores invalid negative or non-finite weights', () => {
    const base = elementDistributionFromPillars(PILLARS);
    const invalid = elementDistributionFromPillars(PILLARS, {
      heavenStemWeight: Number.NaN,
      branchTotalWeight: -1,
      positionWeights: { month: -2, day: Number.POSITIVE_INFINITY },
      heavenPositionWeights: { hour: Number.NaN },
      branchPositionWeights: { year: -3 },
    });

    expect(invalid).toEqual(base);
  });

  it('is wired through engine weights without enabling adjusted distribution output', () => {
    const req = { birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' as const }, sex: 'M' as const };
    const base = createEngine({}).analyze(req);
    const allOnes = createEngine({
      weights: {
        elementDistribution: {
          positionWeights: { year: 1, month: 1, day: 1, hour: 1 },
        },
      },
    }).analyze(req);
    const monthWeighted = createEngine({
      weights: {
        elementDistribution: {
          branchPositionWeights: { month: 3 },
        },
      },
    }).analyze(req);

    expect(allOnes.summary.elementDistribution).toEqual(base.summary.elementDistribution);
    expect(monthWeighted.summary.elementDistribution).not.toEqual(base.summary.elementDistribution);
    expect((monthWeighted.summary as any).elementDistributionAdjusted).toBeUndefined();
  });
});
