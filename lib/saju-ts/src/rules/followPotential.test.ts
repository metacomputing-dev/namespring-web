import { describe, expect, it } from 'vitest';
import { computeFollowPotential } from './followPotential.js';

const DEFAULT_THRESHOLDS = {
  weakThreshold: -0.78,
  strongThreshold: 0.78,
  minDominanceRatio: 2.2,
} as const;

describe('computeFollowPotential', () => {
  it('selects external pressure for an extremely weak day master', () => {
    const result = computeFollowPotential({
      ...DEFAULT_THRESHOLDS,
      strengthIndex: -1,
      support: 1,
      pressure: 5,
    });

    expect(result.mode).toBe('PRESSURE');
    expect(result.potential).toBe(1);
    expect(result.weakPotential).toBe(1);
    expect(result.strongPotential).toBe(0);
    expect(result.dominanceRatio).toBe(5);
  });

  it('selects internal support for an extremely strong day master', () => {
    const result = computeFollowPotential({
      ...DEFAULT_THRESHOLDS,
      strengthIndex: 1,
      support: 5,
      pressure: 1,
    });

    expect(result.mode).toBe('SUPPORT');
    expect(result.potential).toBe(1);
    expect(result.weakPotential).toBe(0);
    expect(result.strongPotential).toBe(1);
    expect(result.dominanceRatio).toBe(5);
  });

  it('returns no follow signal inside the strength thresholds', () => {
    const result = computeFollowPotential({
      ...DEFAULT_THRESHOLDS,
      strengthIndex: 0,
      support: 3,
      pressure: 3,
    });

    expect(result.mode).toBe('NONE');
    expect(result.potential).toBe(0);
    expect(result.weakPotential).toBe(0);
    expect(result.strongPotential).toBe(0);
  });

  it('keeps the existing weak-side tie behavior', () => {
    const result = computeFollowPotential({
      ...DEFAULT_THRESHOLDS,
      strengthIndex: 0,
      support: 0,
      pressure: 0,
    });

    expect(result.mode).toBe('NONE');
    expect(result.dominanceRatio).toBe(0);
  });
});
