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

  it('applies a category override from strategies.shinsal.conditions.categories', () => {
    const hit = run({
      categories: {
        TEST_CATEGORY: { weights: { HYEONG: 0.2 } },
      },
    });
    expect(hit.qualityWeight).toBeCloseTo(0.8, 12);
    expect(hit.conditionPenalty).toBeCloseTo(0.2, 12);
    expect(hit.qualityReasons).toEqual(['HYEONG']);
  });

  it('applies the name override after the category override', () => {
    const hit = run({
      categories: {
        TEST_CATEGORY: { weights: { HYEONG: 0.2 } },
      },
      names: {
        TEST_SAL: { weights: { HYEONG: 0.1 } },
      },
    });
    expect(hit.qualityWeight).toBeCloseTo(0.9, 12);
    expect(hit.conditionPenalty).toBeCloseTo(0.1, 12);
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
  it('does not leak an override into a separately configured engine', () => {
    const overridden = run({
      names: {
        TEST_SAL: { weights: { HYEONG: 0 } },
      },
    });
    expect(overridden.qualityWeight).toBe(1);
    expect(run().qualityWeight).toBe(0.5);
  });

  it('keeps enclosing gates fail-closed when a name override enables itself', () => {
    const hit = run({
      categories: {
        TEST_CATEGORY: { enabled: false, weights: { HYEONG: 0.2 } },
      },
      names: {
        TEST_SAL: { enabled: true, weights: { HYEONG: 0.1 } },
      },
    });
    expect(hit.quality).toBe('FULL');
    expect(hit.qualityWeight).toBe(1);
    expect(hit.conditionPenalty).toBeUndefined();
  });

  it.each([
    ['global applyToNames', { applyToNames: [{}] }],
    ['name excludeNames', { names: { TEST_SAL: { excludeNames: [1] } } }],
  ])('rejects non-string entries in %s', (_label, conditions) => {
    expect(() => run(conditions as any)).toThrow(/array of non-empty strings|must be a non-empty string/);
  });

  it.each([
    ['enabled', { enabled: 'yes' }],
    ['combine', { combine: 'average' }],
    ['global weight', { weights: { HYEONG: '0.5' } }],
    ['category override', { categories: { TEST_CATEGORY: false } }],
    ['name override weight', { names: { TEST_SAL: { weights: { HYEONG: null } } } }],
  ])('rejects malformed %s policy values', (_label, conditions) => {
    expect(() => run(conditions as any)).toThrow(
      /must be|supported damage key/,
    );
  });

  it('clamps override weights before evaluating conditions', () => {
    const hit = run({ names: { TEST_SAL: { weights: { HYEONG: 5 } } } });
    expect(hit.qualityWeight).toBe(0);
    expect(hit.conditionPenalty).toBe(1);
    expect(hit.invalidated).toBe(true);
    expect(hit.active).toBe(false);
  });
});
