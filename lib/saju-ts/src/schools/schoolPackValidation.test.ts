import { describe, expect, it } from 'vitest';

import {
  defaultConfig,
  InvalidEngineConfigError,
  InvalidLongitudeCorrectionPolicyError,
  normalizeConfig,
} from '../api/config.js';
import { compileYongshinRuleSpec } from '../rules/spec/compileYongshinSpec.js';
import {
  applySchoolPreset,
  InvalidSchoolPresetPackError,
  listSchoolPresets,
} from './presets.js';

function preset(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    description: `${id} description`,
    ...extra,
  };
}

function pack(
  presets: unknown[],
  extra: Record<string, unknown> = {},
) {
  return {
    schemaVersion: '1',
    id: 'custom-pack',
    presets,
    ...extra,
  };
}

function configWithPack(
  customPack: unknown,
  schoolId = 'child',
  location: 'presetPacks' | 'schoolPacks' | 'schools.packs' = 'presetPacks',
) {
  const extensions = location === 'schools.packs'
    ? { schools: { packs: [customPack] } }
    : { [location]: [customPack] };
  return {
    school: { id: schoolId },
    extensions,
  };
}

function capturePackError(run: () => unknown): InvalidSchoolPresetPackError {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(InvalidSchoolPresetPackError);
  expect(thrown).toMatchObject({
    name: 'InvalidSchoolPresetPackError',
    code: 'SAJU_INVALID_SCHOOL_PRESET_PACK',
  });
  return thrown as InvalidSchoolPresetPackError;
}

function captureEngineConfigError(run: () => unknown): InvalidEngineConfigError {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(InvalidEngineConfigError);
  return thrown as InvalidEngineConfigError;
}

function yongshinSpec(id: string, idPrefix: string, bonus: number) {
  return {
    id,
    version: '1',
    base: 'none',
    mode: 'append',
    macros: [
      {
        kind: 'elementBoost',
        elements: ['WATER'],
        bonus,
        idPrefix,
      },
    ],
  };
}

describe('school preset pack integrity', () => {
  it('keeps all built-in presets valid and materializable', () => {
    const presets = listSchoolPresets();

    expect(presets).toHaveLength(18);
    for (const builtIn of presets) {
      expect(() => applySchoolPreset(defaultConfig, builtIn.id)).not.toThrow();
    }
  });

  it('rejects a missing parent instead of partially applying the child', () => {
    const error = capturePackError(() => normalizeConfig(configWithPack(
      pack([
        preset('child', {
          extends: 'missing-parent',
          overlay: { strategies: { marker: 'child-only' } },
        }),
      ]),
    ) as any));

    expect(error.path).toBe(
      'config.extensions.presetPacks[0].presets[0].extends',
    );
    expect(error.packId).toBe('custom-pack');
  });

  it.each([
    {
      include: { overlayBlocks: ['missing-overlay'] },
      suffix: 'include.overlayBlocks[0]',
    },
    {
      include: { ruleSpecBlocks: ['missing-rule'] },
      suffix: 'include.ruleSpecBlocks[0]',
    },
  ])('rejects a missing include reference %#', ({ include, suffix }) => {
    const error = capturePackError(() => normalizeConfig(configWithPack(
      pack([preset('child', { include })]),
    ) as any));

    expect(error.path).toBe(
      `config.extensions.presetPacks[0].presets[0].${suffix}`,
    );
  });

  it.each([
    { definitions: [preset('self', { extends: 'self' })] },
    {
      definitions: [
        preset('a', { extends: 'b' }),
        preset('b', { extends: 'a' }),
      ],
    },
    {
      definitions: [
        preset('a', { extends: 'b' }),
        preset('b', { extends: 'c' }),
        preset('c', { extends: 'a' }),
      ],
    },
  ])('rejects direct and indirect inheritance cycles %#', ({ definitions }) => {
    const error = capturePackError(() => normalizeConfig(configWithPack(
      pack(definitions),
      definitions[0]!.id,
    ) as any));

    expect(error.path).toContain('.extends');
  });

  it('rejects duplicate preset ids within one pack', () => {
    const error = capturePackError(() => normalizeConfig(configWithPack(
      pack([
        preset('child', { overlay: { strategies: { marker: 'first' } } }),
        preset('child', { overlay: { strategies: { marker: 'second' } } }),
      ]),
    ) as any));

    expect(error.path).toBe(
      'config.extensions.presetPacks[0].presets[1].id',
    );
  });

  it('rejects duplicate local include references', () => {
    const error = capturePackError(() => normalizeConfig(configWithPack(
      pack(
        [
          preset('child', {
            include: { ruleSpecBlocks: ['rule', 'rule'] },
          }),
        ],
        {
          ruleSpecBlocks: {
            rule: {
              target: 'yongshin',
              spec: yongshinSpec('rule', 'RULE', 1),
            },
          },
        },
      ),
    ) as any));

    expect(error.path).toBe(
      'config.extensions.presetPacks[0].presets[0].include.ruleSpecBlocks[1]',
    );
  });

  it('rejects duplicate effective includes inherited from a parent', () => {
    const customPack = pack(
      [
        preset('parent', {
          include: { ruleSpecBlocks: ['rule'] },
        }),
        preset('child', {
          extends: 'parent',
          include: { ruleSpecBlocks: ['rule'] },
        }),
      ],
      {
        ruleSpecBlocks: {
          rule: {
            target: 'yongshin',
            spec: yongshinSpec('rule', 'RULE', 1),
          },
        },
      },
    );

    const error = capturePackError(() => normalizeConfig(
      configWithPack(customPack) as any,
    ));

    expect(error.path).toBe(
      'schoolPresetPack.presets.include.ruleSpecBlocks',
    );
  });

  it('rejects duplicate concrete rule ids across different blocks', () => {
    const customPack = pack(
      [
        preset('child', {
          include: { ruleSpecBlocks: ['first', 'second'] },
        }),
      ],
      {
        ruleSpecBlocks: {
          first: {
            target: 'yongshin',
            spec: yongshinSpec('first', 'DUPLICATE', 10),
          },
          second: {
            target: 'yongshin',
            spec: yongshinSpec('second', 'DUPLICATE', 20),
          },
        },
      },
    );

    const error = capturePackError(() => normalizeConfig(
      configWithPack(customPack) as any,
    ));

    expect(error.path).toBe(
      'schoolPresetPack.presets.child.overlay.extensions.ruleSpecs.yongshin',
    );
  });

  it.each([
    123,
    {},
    { macros: [], base: 'fallback' },
    { macros: [], mode: 'merge' },
  ])('rejects malformed known-target rule specs %#', (spec) => {
    const customPack = pack(
      [preset('child', { include: { ruleSpecBlocks: ['rule'] } })],
      {
        ruleSpecBlocks: {
          rule: { target: 'yongshin', spec },
        },
      },
    );

    capturePackError(() => normalizeConfig(
      configWithPack(customPack) as any,
    ));
  });

  it('rejects an empty persisted rule-spec block while the compiler helper keeps its fallback', () => {
    expect(compileYongshinRuleSpec([]).id).toBeTruthy();

    const error = captureEngineConfigError(() => normalizeConfig({
      extensions: {
        ruleSpecs: {
          yongshin: [],
        },
      },
    }));

    expect(error.path).toBe('extensions.ruleSpecs.yongshin');
  });

  it('preserves the precise macro field path when pack rule validation fails', () => {
    const customPack = pack(
      [preset('child', { include: { ruleSpecBlocks: ['rule'] } })],
      {
        ruleSpecBlocks: {
          rule: {
            target: 'yongshin',
            spec: {
              id: 'invalid-bonus',
              version: '1',
              base: 'none',
              macros: [{
                kind: 'elementBoost',
                elements: ['WOOD'],
                bonus: 'not-a-number',
              }],
            },
          },
        },
      },
    );

    const error = capturePackError(() => normalizeConfig(
      configWithPack(customPack) as any,
    ));

    expect(error.path).toContain('ruleSpecBlocks.rule');
    expect(error.path).toMatch(/macros\[0\]\.bonus$/);
    expect(error.packId).toBe('custom-pack');
    expect(error.message).not.toContain('not-a-number');
  });

  it('keeps unknown rule targets open without prototype-key pollution', () => {
    const customPack = pack(
      [preset('child', { include: { ruleSpecBlocks: ['future'] } })],
      {
        ruleSpecBlocks: {
          future: { target: '__proto__', spec: 123 },
        },
      },
    );

    const config = normalizeConfig(configWithPack(customPack) as any);
    const ruleSpecs = (config.extensions as any).ruleSpecs;
    expect(ruleSpecs.__proto__).toBe(123);
    expect(Object.getPrototypeOf(ruleSpecs)).toBeNull();
  });

  it('rejects an invalid overlay produced only after parent-child merging', () => {
    const customPack = pack([
      preset('parent', {
        overlay: {
          calendar: {
            trueSolarTime: {
              longitudeCorrectionPolicy: {
                mode: 'fixedMeridian',
                meridianDeg: 135,
              },
            },
          },
        },
      }),
      preset('child', {
        extends: 'parent',
        overlay: {
          calendar: {
            trueSolarTime: {
              longitudeCorrectionPolicy: { mode: 'off' },
            },
          },
        },
      }),
    ]);

    expect(() => normalizeConfig(
      configWithPack(customPack) as any,
    )).toThrow(InvalidLongitudeCorrectionPolicyError);
  });

  it.each(['presetPacks', 'schoolPacks', 'schools.packs'] as const)(
    'validates the %s soft extension path',
    (location) => {
      const error = capturePackError(() => normalizeConfig(configWithPack(
        pack([preset('child', { extends: 'missing-parent' })]),
        'child',
        location,
      ) as any));

      expect(error.path).toContain('.presets[0].extends');
    },
  );

  it('rejects malformed outer packs instead of silently skipping them', () => {
    const error = capturePackError(() => normalizeConfig({
      extensions: { presetPacks: 123 },
    } as any));

    expect(error.path).toBe('config.extensions.presetPacks');
  });

  it('rejects accessors without executing caller code', () => {
    let getterRuns = 0;
    const customPack = pack([preset('child')]);
    Object.defineProperty(customPack, 'name', {
      enumerable: true,
      get() {
        getterRuns += 1;
        return 'unsafe';
      },
    });

    capturePackError(() => applySchoolPreset(
      defaultConfig,
      'child',
      [customPack] as any,
    ));
    expect(getterRuns).toBe(0);
  });

  it.each([
    () => undefined,
    Number.POSITIVE_INFINITY,
  ])('rejects non-data rule payload values %#', (invalidValue) => {
    const customPack = pack(
      [preset('child', { include: { ruleSpecBlocks: ['future'] } })],
      {
        ruleSpecBlocks: {
          future: { target: 'future-target', spec: invalidValue },
        },
      },
    );

    capturePackError(() => applySchoolPreset(
      defaultConfig,
      'child',
      [customPack] as any,
    ));
  });

  it('rejects cyclic pack data before materialization', () => {
    const customPack: any = pack([preset('child')]);
    customPack.extra = customPack;

    const error = capturePackError(() => applySchoolPreset(
      defaultConfig,
      'child',
      [customPack],
    ));
    expect(error.message).toContain('acyclic data graph');
  });

  it('rejects ambiguous simultaneous pack locations', () => {
    const customPack = pack([preset('child')]);
    const error = capturePackError(() => normalizeConfig({
      school: { id: 'child' },
      extensions: {
        presetPacks: [customPack],
        schoolPacks: [customPack],
      },
    } as any));

    expect(error.path).toBe('config.extensions.schoolPacks');
  });

  it('treats undefined soft pack locations as omitted', () => {
    expect(() => normalizeConfig({
      extensions: { presetPacks: undefined },
    } as any)).not.toThrow();
    expect(() => normalizeConfig({
      extensions: {
        presetPacks: undefined,
        schoolPacks: [],
      },
    } as any)).not.toThrow();
  });

  it.each([
    { schemaVersion: '999' },
    { presets: [preset('child'), preset('child')] },
    { presets: [{ id: 'child', description: 'missing name' }] },
    { presets: [{ id: 'child', name: 'missing description' }] },
  ])('rejects malformed pack contracts %#', (override) => {
    const customPack = {
      ...pack([preset('child')]),
      ...override,
    };
    capturePackError(() => normalizeConfig(
      configWithPack(customPack) as any,
    ));
  });

  it.each([
    preset(' child'),
    preset('child+other'),
    preset('child', { aliases: ['bad,alias'] }),
    preset('child', { aliases: ['same', 'same'] }),
  ])('rejects unreachable or duplicate selector tokens %#', (definition) => {
    capturePackError(() => normalizeConfig({
      extensions: { presetPacks: [pack([definition])] },
    } as any));
  });

  it('rejects a user pack id that collides with the built-in pack', () => {
    const error = capturePackError(() => normalizeConfig({
      extensions: {
        presetPacks: [
          pack([preset('child')], { id: 'builtin' }),
        ],
      },
    } as any));

    expect(error.path).toBe('schoolPresetPacks[1].id');
  });

  it('rejects duplicate pack ids in the direct public API', () => {
    const first = pack([preset('first')], { id: 'duplicate-pack' });
    const second = pack([preset('second')], { id: 'duplicate-pack' });

    const error = capturePackError(() => applySchoolPreset(
      defaultConfig,
      'second',
      [first, second] as any,
    ));

    expect(error.path).toBe('schoolPresetPacks[1].id');
  });

  it('rejects accessor entries in the direct packs array without executing them', () => {
    let getterRuns = 0;
    const packs: any[] = [];
    Object.defineProperty(packs, '0', {
      enumerable: true,
      get() {
        getterRuns += 1;
        return pack([preset('child')]);
      },
    });
    packs.length = 1;

    capturePackError(() => applySchoolPreset(
      defaultConfig,
      'child',
      packs as any,
    ));
    expect(getterRuns).toBe(0);
  });

  it('rejects malformed rule specs already present in the public base config', () => {
    expect(() => applySchoolPreset({
      ...defaultConfig,
      extensions: { ruleSpecs: 123 },
    } as any, 'johoo.strict')).toThrow(InvalidEngineConfigError);
  });

  it('rejects base rule-spec accessors without executing caller code', () => {
    let getterRuns = 0;
    const ruleSpecs = {};
    Object.defineProperty(ruleSpecs, 'yongshin', {
      enumerable: true,
      get() {
        getterRuns += 1;
        return yongshinSpec('unsafe', 'UNSAFE_GETTER', 1);
      },
    });

    expect(() => applySchoolPreset({
      ...defaultConfig,
      extensions: { ruleSpecs },
    } as any, 'johoo.strict')).toThrow();
    expect(getterRuns).toBe(0);
  });

  it.each([
    {},
    { school: { id: 'johoo.strict' } },
  ])('validates final direct rule specs after preset merging %#', (base) => {
    const error = captureEngineConfigError(() => normalizeConfig({
      ...base,
      extensions: {
        ruleSpecs: { yongshin: 123 },
      },
    } as any));

    expect(error.path).toBe('extensions.ruleSpecs.yongshin');
  });

  it('rejects duplicate concrete ids in final direct rule specs', () => {
    const error = captureEngineConfigError(() => normalizeConfig({
      extensions: {
        ruleSpecs: {
          yongshin: [
            yongshinSpec('first', 'DIRECT_DUPLICATE', 1),
            yongshinSpec('second', 'DIRECT_DUPLICATE', 2),
          ],
        },
      },
    } as any));

    expect(error.path).toBe('extensions.ruleSpecs.yongshin');
  });

  it('accepts a valid final direct rule spec', () => {
    const config = normalizeConfig({
      extensions: {
        ruleSpecs: {
          yongshin: yongshinSpec('direct', 'DIRECT_VALID', 1),
        },
      },
    } as any);

    expect((config.extensions as any).ruleSpecs.yongshin.id).toBe('direct');
  });

  it('reports the owning pack id for cross-preset rule collisions', () => {
    const firstPack = pack(
      [preset('first', { include: { ruleSpecBlocks: ['rule'] } })],
      {
        id: 'pack-a',
        ruleSpecBlocks: {
          rule: {
            target: 'yongshin',
            spec: yongshinSpec('first', 'COLLISION', 1),
          },
        },
      },
    );
    const secondPack = pack(
      [preset('second', { include: { ruleSpecBlocks: ['rule'] } })],
      {
        id: 'pack-b',
        ruleSpecBlocks: {
          rule: {
            target: 'yongshin',
            spec: yongshinSpec('second', 'COLLISION', 2),
          },
        },
      },
    );
    const base = applySchoolPreset(
      defaultConfig,
      'first',
      [firstPack] as any,
    );

    const error = capturePackError(() => applySchoolPreset(
      base,
      'second',
      [secondPack] as any,
    ));

    expect(error.path).toBe('config.extensions.ruleSpecs.yongshin');
    expect(error.packId).toBe('pack-b');
  });

  it('normalizes one-sided rule-spec maps to a null prototype', () => {
    const customPack = pack([
      preset('child', {
        overlay: {
          extensions: {
            ruleSpecs: {
              yongshin: yongshinSpec('direct', 'DIRECT', 1),
            },
          },
        },
      }),
    ]);

    const config = applySchoolPreset(
      defaultConfig,
      'child',
      [customPack] as any,
    );
    expect(Object.getPrototypeOf((config.extensions as any).ruleSpecs)).toBeNull();
  });

  it('preserves cross-pack preset override and built-in alias precedence', () => {
    const first = pack(
      [
        preset('choice', {
          aliases: ['shared', 'second', 'choice'],
          overlay: { strategies: { marker: 'first' } },
        }),
      ],
      { id: 'first-pack' },
    );
    const second = pack(
      [
        preset('second', {
          aliases: ['shared'],
          overlay: { strategies: { marker: 'second' } },
        }),
        preset('choice', {
          overlay: { strategies: { marker: 'override' } },
        }),
      ],
      { id: 'second-pack' },
    );

    const byAlias = applySchoolPreset(
      defaultConfig,
      'shared',
      [first, second] as any,
    );
    const byExactId = applySchoolPreset(
      defaultConfig,
      'choice',
      [first, second] as any,
    );

    expect((byAlias.strategies as any).marker).toBe('second');
    expect((byExactId.strategies as any).marker).toBe('override');
  });

  it('keeps prototype-like preset ids safe in the lookup index', () => {
    const customPack = pack([
      preset('__proto__', {
        overlay: { strategies: { marker: 'safe' } },
      }),
    ]);

    const config = applySchoolPreset(
      defaultConfig,
      '__proto__',
      [customPack] as any,
    );
    expect((config.strategies as any).marker).toBe('safe');
  });

  it('materializes a valid parent rule exactly once', () => {
    const customPack = pack(
      [
        preset('parent', {
          include: { ruleSpecBlocks: ['rule'] },
        }),
        preset('child', {
          extends: 'parent',
          overlay: { strategies: { marker: 'child' } },
        }),
      ],
      {
        ruleSpecBlocks: {
          rule: {
            target: 'yongshin',
            spec: yongshinSpec('rule', 'PARENT', 10),
          },
        },
      },
    );

    const config = applySchoolPreset(
      defaultConfig,
      'child',
      [customPack] as any,
    );
    const compiled = compileYongshinRuleSpec(
      (config.extensions as any).ruleSpecs.yongshin,
    );

    expect(compiled.rules.map((rule) => rule.id)).toEqual(['PARENT_WATER']);
    expect((config.strategies as any).marker).toBe('child');
  });
});
