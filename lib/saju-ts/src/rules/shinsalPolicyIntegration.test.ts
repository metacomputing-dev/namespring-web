import { describe, expect, it } from 'vitest';
import { createEngine } from '../api/engine.js';

const REQUEST = {
  birth: { instant: '2024-01-04T03:00:00.000Z' },
  sex: 'U',
  location: { lat: 37.5665, lon: 126.978, name: 'Seoul' },
} as const;

const TEST_RULESET = {
  id: 'test.shinsal-quality-overrides',
  version: '1',
  rules: [
    {
      id: 'EMIT_TEST_SAL',
      score: { 'shinsal.TEST_SAL': 1 },
      emit: {
        name: 'TEST_SAL',
        category: 'TEST_CATEGORY',
        basedOn: 'DAY_BRANCH',
        targetBranch: 0,
      },
    },
  ],
};

function run(conditions: Record<string, unknown> = {}) {
  const bundle = createEngine({
    extensions: { rulesets: { shinsal: TEST_RULESET } },
    strategies: {
      shinsal: { conditions },
      fortune: { maxDecades: 0, maxYears: 0, maxMonths: 0, maxDays: 0 },
    },
  } as any).analyze(REQUEST);

  const shinsal = bundle.report.facts['rules.shinsal'] as any;
  const hit = shinsal.detections.find((d: any) => d.name === 'TEST_SAL');
  if (!hit) throw new Error('TEST_SAL detection missing');
  return hit;
}

describe('shinsal quality config overrides', () => {
  it('fixture actually produces a HYEONG penalty without overrides', () => {
    expect(run()).toMatchObject({
      name: 'TEST_SAL',
      category: 'TEST_CATEGORY',
      targetKind: 'BRANCH',
      targetBranch: 0,
      matchedPillars: ['month'],
      quality: 'WEAK',
      qualityWeight: 0.5,
      conditionPenalty: 0.5,
      qualityReasons: ['HYEONG'],
      active: true,
      invalidated: false,
    });
  });

  it('applies category then name numeric overrides without leaking between engines', () => {
    const overridden = run({
      categories: { TEST_CATEGORY: { weights: { HYEONG: 0.2 } } },
      names: { TEST_SAL: { weights: { HYEONG: 0.1 } } },
    });
    expect(overridden.qualityWeight).toBeCloseTo(0.9, 12);
    expect(overridden.conditionPenalty).toBeCloseTo(0.1, 12);
    expect(overridden.qualityReasons).toEqual(['HYEONG']);
    expect(run().qualityWeight).toBe(0.5);
  });

  it.each([
    ['category', { categories: { TEST_CATEGORY: { enabled: false } } }],
    ['name', { names: { TEST_SAL: { enabled: false } } }],
  ])('%s enabled=false bypasses conditions', (_label, conditions) => {
    const hit = run(conditions);
    expect(hit.quality).toBe('FULL');
    expect(hit.qualityWeight).toBe(1);
    expect(hit.conditionPenalty).toBeUndefined();
    expect(hit.qualityReasons).toBeUndefined();
    expect(hit.active).toBe(true);
  });

  it('does not allow a name override to reopen a disabled enclosing gate', () => {
    const hit = run({
      categories: { TEST_CATEGORY: { enabled: false, weights: { HYEONG: 0.2 } } },
      names: { TEST_SAL: { enabled: true, weights: { HYEONG: 0.1 } } },
    });
    expect(hit.quality).toBe('FULL');
    expect(hit.qualityWeight).toBe(1);
    expect(hit.conditionPenalty).toBeUndefined();
  });

  it.each([
    ['global applyToNames', { applyToNames: [{}] }],
    ['name excludeNames', { names: { TEST_SAL: { excludeNames: [1] } } }],
    ['duplicate aliases', { applyToNames: ['TEST_SAL'], onlyNames: ['TEST_SAL'] }],
    ['duplicate names', { applyToNames: ['TEST_SAL', 'TEST_SAL'] }],
  ])('rejects malformed name lists in %s', (_label, conditions) => {
    expect(() => run(conditions as any)).toThrow(/must|only one/);
  });

  it.each([
    ['unknown global key', { enabeld: false }],
    ['unknown category key', { categories: { TEST_CATEGORY: { weight: 0.2 } } }],
    ['unknown name key', { names: { TEST_SAL: { enable: true } } }],
    ['unknown damage key', { weights: { TYPO: 0.5 } }],
    ['enabled', { enabled: 'yes' }],
    ['combine', { combine: 'average' }],
    ['global weight type', { weights: { HYEONG: '0.5' } }],
    ['category override shape', { categories: { TEST_CATEGORY: false } }],
    ['name override weight', { names: { TEST_SAL: { weights: { HYEONG: null } } } }],
    ['negative weight', { weights: { HYEONG: -0.1 } }],
    ['oversized weight', { weights: { HYEONG: 1.1 } }],
    ['invalid weak threshold', { weakThreshold: Number.NaN }],
    ['invalid invalidate threshold', { invalidateThreshold: 2 }],
  ])('rejects malformed %s policy values instead of coercing or clamping', (_label, conditions) => {
    expect(() => run(conditions as any)).toThrow(/must be|supported/);
  });
});
