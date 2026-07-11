import { describe, expect, it } from 'vitest';

import { rawHiddenStemsTable } from '../core/hiddenStems.js';
import { NAEUM_BY_GANZHI, NAEUM_PAIR_TABLE } from '../core/naeum.js';
import { PALACE_INFO } from '../core/palace.js';
import type { RuleSet } from '../rules/dsl.js';
import { compileGyeokgukRuleSpec } from '../rules/spec/compileGyeokgukSpec.js';
import { compileShinsalConditionsRuleSpec } from '../rules/spec/compileShinsalConditionsSpec.js';
import { compileShinsalRuleSpec } from '../rules/spec/compileShinsalSpec.js';
import { compileYongshinRuleSpec } from '../rules/spec/compileYongshinSpec.js';
import { getSchoolPreset, listSchoolPresets } from '../schools/presets.js';
import { defaultConfig } from './config.js';
import { createEngine } from './engine.js';

const REQUEST = {
  birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' as const },
  sex: 'M' as const,
};

function expectIndependentCompilerResults(factory: () => RuleSet): void {
  const first = factory();
  const second = factory();

  expect(first).not.toBe(second);
  expect(first.rules).not.toBe(second.rules);

  first.rules.push({ id: 'MUTATION_SENTINEL', score: { poison: 999 } });
  if (first.rules[0] && second.rules[0]) first.rules[0].id = 'NESTED_MUTATION_SENTINEL';

  const fresh = factory();
  expect(fresh.rules.some((rule) => rule.id === 'MUTATION_SENTINEL')).toBe(false);
  expect(fresh.rules.some((rule) => rule.id === 'NESTED_MUTATION_SENTINEL')).toBe(false);
}

describe('engine configuration ownership', () => {
  it('owns and freezes an independent effective configuration per engine', () => {
    const first = createEngine();
    const second = createEngine();
    const firstConfig = first.config as any;
    const secondConfig = second.config as any;

    expect(firstConfig).not.toBe(secondConfig);
    expect(firstConfig.calendar).not.toBe(secondConfig.calendar);
    expect(firstConfig.calendar.trueSolarTime).not.toBe(secondConfig.calendar.trueSolarTime);
    expect(Object.isFrozen(firstConfig)).toBe(true);
    expect(Object.isFrozen(firstConfig.calendar)).toBe(true);
    expect(Object.isFrozen(firstConfig.calendar.trueSolarTime)).toBe(true);
    expect(Object.isFrozen(defaultConfig)).toBe(true);
    expect(Object.isFrozen((defaultConfig as any).calendar.trueSolarTime)).toBe(true);

    const before = first.analyze(REQUEST).summary.yongshin?.best;
    expect(before).toBeDefined();
    expect(() => {
      firstConfig.calendar.trueSolarTime.enabled = true;
    }).toThrow(TypeError);

    expect(secondConfig.calendar.trueSolarTime.enabled).toBe(false);
    expect((defaultConfig as any).calendar.trueSolarTime.enabled).toBe(false);
    expect(createEngine().analyze(REQUEST).summary.yongshin?.best).toBe(before);
  });

  it('detaches the effective configuration from caller-owned input', () => {
    const input: any = {
      calendar: { trueSolarTime: { enabled: true } },
      strategies: { strength: { model: 'base' }, ownerProbe: { values: [{ score: 7 }] } },
    };
    const engine = createEngine(input);

    input.calendar.trueSolarTime.enabled = false;
    input.strategies.ownerProbe.values[0].score = 99;
    input.strategies.ownerProbe.values.push({ score: 100 });

    const effective = engine.config as any;
    expect(effective.calendar.trueSolarTime.enabled).toBe(true);
    expect(effective.strategies.ownerProbe.values).toEqual([{ score: 7 }]);
    expect(effective.strategies.ownerProbe.values).not.toBe(input.strategies.ownerProbe.values);
  });
});

describe('school preset ownership', () => {
  it('returns defensive copies and keeps future engines clean', () => {
    const preset = getSchoolPreset('johoo.strict');
    expect(preset).not.toBeNull();
    const originalClimate = (preset!.overlay as any).strategies.yongshin.weights.climate;

    (preset!.overlay as any).strategies.yongshin.weights.climate = 99;
    const listed = listSchoolPresets();
    const listedJohoo = listed.find((item) => item.id === 'johoo.strict');
    expect(listedJohoo).toBeDefined();
    (listedJohoo!.overlay as any).strategies.yongshin.weights.climate = 88;

    expect((getSchoolPreset('johoo.strict')!.overlay as any).strategies.yongshin.weights.climate).toBe(originalClimate);
    expect(
      (listSchoolPresets().find((item) => item.id === 'johoo.strict')!.overlay as any).strategies.yongshin.weights.climate,
    ).toBe(originalClimate);
    expect(
      (createEngine({ school: { id: 'johoo.strict' } } as any).config.strategies as any).yongshin.weights.climate,
    ).toBe(originalClimate);
  });
});

describe('compiled rule ownership', () => {
  it('does not expose any default ruleset singleton', () => {
    expectIndependentCompilerResults(() => compileYongshinRuleSpec([]));
    expectIndependentCompilerResults(() => compileGyeokgukRuleSpec([]));
    expectIndependentCompilerResults(() => compileShinsalRuleSpec([]));
    expectIndependentCompilerResults(() => compileShinsalConditionsRuleSpec([]));
  });

  it('does not let a compiled-rules mutation change a fresh engine result', () => {
    const before = createEngine().analyze(REQUEST).summary.yongshin?.best;
    const exposed = compileYongshinRuleSpec([]);
    exposed.rules.push({ id: 'FORCE_WATER', score: { 'yongshin.WATER': 999 } });

    expect(createEngine().analyze(REQUEST).summary.yongshin?.best).toBe(before);
  });
});

describe('public reference tables', () => {
  it('are recursively immutable at runtime', () => {
    expect(Object.isFrozen(rawHiddenStemsTable)).toBe(true);
    expect(Object.isFrozen(rawHiddenStemsTable[0])).toBe(true);
    expect(Object.isFrozen(rawHiddenStemsTable[0]![0])).toBe(true);
    expect(() => {
      (rawHiddenStemsTable[0]![0] as any).stem = 8;
    }).toThrow(TypeError);

    expect(Object.isFrozen(PALACE_INFO)).toBe(true);
    expect(Object.isFrozen(PALACE_INFO.year)).toBe(true);
    expect(() => {
      (PALACE_INFO.year as any).name = 'MUTATED';
    }).toThrow(TypeError);

    expect(Object.isFrozen(NAEUM_PAIR_TABLE)).toBe(true);
    expect(Object.isFrozen(NAEUM_PAIR_TABLE[0])).toBe(true);
    expect(Object.isFrozen(NAEUM_PAIR_TABLE[0]![1])).toBe(true);
    expect(Object.isFrozen(NAEUM_BY_GANZHI)).toBe(true);
    const firstGanzhi = Object.keys(NAEUM_BY_GANZHI)[0]!;
    expect(Object.isFrozen(NAEUM_BY_GANZHI[firstGanzhi])).toBe(true);
    expect(() => {
      (NAEUM_BY_GANZHI[firstGanzhi] as any).meaning = 'MUTATED';
    }).toThrow(TypeError);
  });
});
