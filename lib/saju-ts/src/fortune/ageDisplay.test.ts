import { describe, expect, it } from 'vitest';

import { createEngine } from '../api/engine.js';

const REQUEST = {
  birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' },
  sex: 'M',
} as const;

function fortune(config: any = {}) {
  const bundle = createEngine(config).analyze(REQUEST as any);
  return (bundle.summary as any).fortune;
}

describe('fortune age display policy', () => {
  it('keeps continuous-from-birth as the default display convention', () => {
    const f = fortune();
    expect(f.start.ageDisplay).toBe('continuousFromBirth');
    expect(f.start.ageDisplayLabel).toContain('Continuous age');
    expect(typeof f.start.startAgeDisplay).toBe('number');
    expect(typeof f.decades[0].displayStartAge).toBe('number');
    expect(f.decades[0].displayStartAge).toBe(f.start.startAgeDisplay);
    expect(f.decades[0].startAgeYears).not.toBe(f.decades[0].displayStartAge);
  });

  it('adds an opt-in Korean counting display without changing continuous ages', () => {
    const base = fortune();
    const counted = fortune({ strategies: { fortune: { ageDisplay: 'koreanCountingAge' } } });

    expect(counted.start.ageDisplay).toBe('koreanCountingAge');
    expect(counted.start.ageDisplayLabel).toContain('Korean counting age');
    expect(counted.start.startAgeYears).toBeCloseTo(base.start.startAgeYears, 12);
    expect(counted.decades[0].startAgeYears).toBeCloseTo(base.decades[0].startAgeYears, 12);
    expect(Number.isInteger(counted.decades[0].displayStartAge)).toBe(true);
    expect(counted.decades[0].displayStartAge).toBeGreaterThanOrEqual(1);
    expect(counted.decades[0].displayEndAge).toBeGreaterThan(counted.decades[0].displayStartAge);
  });
});