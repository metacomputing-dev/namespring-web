import { describe, expect, it } from 'vitest';
import { monthOrderByPolicy } from './pillars.js';

describe('monthOrderByPolicy', () => {
  it('throws when monthBoundary=jieqi but boundaries are missing (no approx fallback)', () => {
    const utcMs = Date.parse('2024-03-01T00:00:00Z');
    const ldt = {
      date: { y: 2024, m: 3, d: 1 },
      time: { h: 0, min: 0 },
      offsetMinutes: 0,
    };

    expect(() => monthOrderByPolicy(utcMs, ldt, 'jieqi', null)).toThrow(/jieBoundariesAround is required/i);
  });
});
