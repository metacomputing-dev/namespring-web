import { describe, expect, it } from 'vitest';

import type { RuleSet } from '../dsl.js';
import { compileGyeokgukRuleSpec } from './compileGyeokgukSpec.js';
import { compileShinsalConditionsRuleSpec } from './compileShinsalConditionsSpec.js';
import { compileShinsalRuleSpec } from './compileShinsalSpec.js';
import { compileYongshinRuleSpec } from './compileYongshinSpec.js';
import {
  assertValidKnownRuleSpec,
  assertValidRuleSet,
  InvalidRuleSpecError,
  type KnownRuleSpecTarget,
} from './ruleSpecValidation.js';

const compilers: Record<KnownRuleSpecTarget, (input: any) => RuleSet> = {
  yongshin: compileYongshinRuleSpec,
  gyeokguk: compileGyeokgukRuleSpec,
  shinsal: compileShinsalRuleSpec,
  shinsalConditions: compileShinsalConditionsRuleSpec,
};

function spec(macro: unknown, extra: Record<string, unknown> = {}) {
  return {
    id: 'test.spec',
    version: '1',
    base: 'none',
    mode: 'append',
    macros: [macro],
    ...extra,
  };
}

function ruleFor(target: KnownRuleSpecTarget, id = 'RULE') {
  const scoreKey = target === 'yongshin'
    ? 'yongshin.WOOD'
    : target === 'gyeokguk'
      ? 'gyeokguk.TEST'
      : target === 'shinsal'
        ? 'shinsal.TEST'
        : 'cond.penalty.CHUNG';
  return { id, score: { [scoreKey]: 1 } };
}

function captureInvalid(run: () => unknown): InvalidRuleSpecError {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(InvalidRuleSpecError);
  expect(thrown).toMatchObject({
    name: 'InvalidRuleSpecError',
    code: 'SAJU_INVALID_RULE_SPEC',
  });
  return thrown as InvalidRuleSpecError;
}

const minimumMacros: Array<{
  target: KnownRuleSpecTarget;
  kind: string;
  macro: Record<string, unknown>;
}> = [
  {
    target: 'yongshin',
    kind: 'roleBoost',
    macro: { kind: 'roleBoost', role: 'COMPANION', bonus: 1 },
  },
  {
    target: 'yongshin',
    kind: 'monthTenGodRoleBias',
    macro: { kind: 'monthTenGodRoleBias', bonuses: { OFFICER: 0.2 } },
  },
  {
    target: 'yongshin',
    kind: 'oneElementDominance',
    macro: { kind: 'oneElementDominance' },
  },
  {
    target: 'yongshin',
    kind: 'transformationsBest',
    macro: { kind: 'transformationsBest' },
  },
  {
    target: 'yongshin',
    kind: 'elementBoost',
    macro: { kind: 'elementBoost', elements: ['WOOD'], bonus: 1 },
  },
  {
    target: 'yongshin',
    kind: 'tongguanBridge',
    macro: { kind: 'tongguanBridge' },
  },
  {
    target: 'yongshin',
    kind: 'followWeakPressure',
    macro: { kind: 'followWeakPressure' },
  },
  {
    target: 'yongshin',
    kind: 'followJonggyeok',
    macro: { kind: 'followJonggyeok' },
  },
  {
    target: 'yongshin',
    kind: 'elementByVar',
    macro: {
      kind: 'elementByVar',
      elementVar: 'patterns.element',
      factorVar: 'patterns.factor',
    },
  },
  {
    target: 'yongshin',
    kind: 'customRules',
    macro: { kind: 'customRules', rules: [ruleFor('yongshin')] },
  },
  {
    target: 'gyeokguk',
    kind: 'monthMainTenGod',
    macro: { kind: 'monthMainTenGod' },
  },
  {
    target: 'gyeokguk',
    kind: 'monthGyeokTenGod',
    macro: { kind: 'monthGyeokTenGod' },
  },
  {
    target: 'gyeokguk',
    kind: 'oneElementDominance',
    macro: { kind: 'oneElementDominance' },
  },
  {
    target: 'gyeokguk',
    kind: 'transformationsBest',
    macro: { kind: 'transformationsBest' },
  },
  {
    target: 'gyeokguk',
    kind: 'followJonggyeok',
    macro: { kind: 'followJonggyeok' },
  },
  {
    target: 'gyeokguk',
    kind: 'followJonggyeokTyped',
    macro: { kind: 'followJonggyeokTyped' },
  },
  {
    target: 'gyeokguk',
    kind: 'suppressOtherFrames',
    macro: { kind: 'suppressOtherFrames', winner: 'follow' },
  },
  {
    target: 'gyeokguk',
    kind: 'penalizeKeyWhen',
    macro: {
      kind: 'penalizeKeyWhen',
      key: 'gyeokguk.TEST',
      penalty: 0.5,
    },
  },
  {
    target: 'gyeokguk',
    kind: 'customRules',
    macro: { kind: 'customRules', rules: [ruleFor('gyeokguk')] },
  },
  {
    target: 'shinsal',
    kind: 'relationSal',
    macro: { kind: 'relationSal', defs: [{ name: 'TEST' }] },
  },
  {
    target: 'shinsal',
    kind: 'relationSalKeys',
    macro: { kind: 'relationSalKeys', names: ['TEST'] },
  },
  {
    target: 'shinsal',
    kind: 'branchPresence',
    macro: {
      kind: 'branchPresence',
      defs: [{
        id: 'BRANCH_TEST',
        name: 'TEST',
        basedOn: 'OTHER',
        targetVar: 'patterns.branch',
      }],
    },
  },
  {
    target: 'shinsal',
    kind: 'twelveSal',
    macro: { kind: 'twelveSal' },
  },
  {
    target: 'shinsal',
    kind: 'gongmangPillars',
    macro: { kind: 'gongmangPillars' },
  },
  {
    target: 'shinsal',
    kind: 'pillarBranchInList',
    macro: {
      kind: 'pillarBranchInList',
      args: {
        name: 'TEST',
        listVar: 'patterns.list',
        pillars: [{ pillar: 'day', id: 'PILLAR_TEST' }],
      },
    },
  },
  {
    target: 'shinsal',
    kind: 'catalogDayStem',
    macro: { kind: 'catalogDayStem', defs: [{ key: 'TEST' }] },
  },
  {
    target: 'shinsal',
    kind: 'catalogMonthBranchStem',
    macro: { kind: 'catalogMonthBranchStem', defs: [{ key: 'TEST' }] },
  },
  {
    target: 'shinsal',
    kind: 'catalogMonthBranchBranch',
    macro: { kind: 'catalogMonthBranchBranch', defs: [{ key: 'TEST' }] },
  },
  {
    target: 'shinsal',
    kind: 'catalogDayPillar',
    macro: { kind: 'catalogDayPillar', defs: [{ key: 'TEST' }] },
  },
  {
    target: 'shinsal',
    kind: 'catalogKeys',
    macro: { kind: 'catalogKeys', catalog: 'dayStem', keys: ['TEST'] },
  },
  {
    target: 'shinsal',
    kind: 'customRules',
    macro: { kind: 'customRules', rules: [ruleFor('shinsal')] },
  },
  {
    target: 'shinsalConditions',
    kind: 'standardDamagePenalties',
    macro: { kind: 'standardDamagePenalties' },
  },
  {
    target: 'shinsalConditions',
    kind: 'customRules',
    macro: { kind: 'customRules', rules: [ruleFor('shinsalConditions')] },
  },
];

describe('known rule-spec runtime validation', () => {
  it('accepts and compiles every one of the 33 supported macro kinds', () => {
    expect(minimumMacros).toHaveLength(33);
    for (const testCase of minimumMacros) {
      expect(
        () => compilers[testCase.target](spec(testCase.macro)),
        `${testCase.target}.${testCase.kind}`,
      ).not.toThrow();
    }
  });

  it('preserves the public empty-array fallback for all compilers', () => {
    for (const target of Object.keys(compilers) as KnownRuleSpecTarget[]) {
      const compiled = compilers[target]([]);
      expect(compiled.id, target).not.toBe('');
      expect(compiled.version, target).not.toBe('');
      expect(Array.isArray(compiled.rules), target).toBe(true);
    }
  });

  it('preserves ordered spec-array composition', () => {
    const compiled = compileYongshinRuleSpec([
      spec({
        kind: 'elementBoost',
        elements: ['WOOD'],
        bonus: 1,
        idPrefix: 'FIRST',
      }),
      spec({
        kind: 'elementBoost',
        elements: ['WATER'],
        bonus: 1,
        idPrefix: 'SECOND',
      }),
    ] as any);

    expect(compiled.rules.map((rule) => rule.id)).toEqual([
      'FIRST_WOOD',
      'SECOND_WATER',
    ]);
  });

  it.each([
    {
      target: 'yongshin' as const,
      input: spec({
        kind: 'elementBoost',
        elements: ['WOOD'],
        bonus: 'not-a-number',
      }),
      suffix: '.bonus',
    },
    {
      target: 'yongshin' as const,
      input: spec({
        kind: 'tongguanBridge',
        minIntensity: 'silently-fell-back-before',
      }),
      suffix: '.minIntensity',
    },
    {
      target: 'gyeokguk' as const,
      input: spec({
        kind: 'customRules',
        rules: [{
          id: 'UNKNOWN_OP',
          score: {
            'gyeokguk.TEST': { op: 'unknown-op', args: [1] },
          },
        }],
      }),
      suffix: '.op',
    },
  ])('closes a reproduced silent fallback or delayed DSL failure %#', ({
    target,
    input,
    suffix,
  }) => {
    const error = captureInvalid(() => compilers[target](input as any));
    expect(error.target).toBe(target);
    expect(error.path).toContain(suffix);
  });

  it.each([
    spec({ kind: 'elementBoost', elements: ['WOOD'], bonus: 1, extra: true }),
    {
      ...spec({ kind: 'elementBoost', elements: ['WOOD'], bonus: 1 }),
      unknownSpecField: true,
    },
    spec({
      kind: 'oneElementDominance',
      monthQuality: { minIntegrity: 0.5, unsupported: true },
    }),
  ])('rejects unknown fields instead of ignoring them %#', (input) => {
    const error = captureInvalid(() => compileYongshinRuleSpec(input as any));
    expect(error.expected).toContain('supported field');
  });

  it.each([
    {
      input: spec({ kind: 'roleBoost', role: 'UNKNOWN', bonus: 1 }),
      suffix: '.role',
    },
    {
      input: spec({ kind: 'elementBoost', elements: ['WOOD'], bonus: Infinity }),
      suffix: '.bonus',
    },
    {
      input: spec({ kind: 'oneElementDominance', minFactor: 1.01 }),
      suffix: '.minFactor',
    },
    {
      input: spec({
        kind: 'followJonggyeok',
        minSubtypeConfidence: -0.01,
      }),
      suffix: '.minSubtypeConfidence',
    },
  ])('rejects invalid enums, non-finite values, and out-of-range values %#', ({
    input,
    suffix,
  }) => {
    const error = captureInvalid(() => compileYongshinRuleSpec(input as any));
    expect(error.path).toContain(suffix);
  });

  it('validates gyeokguk policy enums and numeric ranges', () => {
    const badMethod = captureInvalid(() => compileGyeokgukRuleSpec({
      ...spec({ kind: 'monthMainTenGod' }),
      policy: { competition: { methods: ['unknown'] } },
    } as any));
    expect(badMethod.path).toContain('.methods[0]');

    const badPower = captureInvalid(() => compileGyeokgukRuleSpec({
      ...spec({ kind: 'monthMainTenGod' }),
      policy: { competition: { power: 0 } },
    } as any));
    expect(badPower.path).toContain('.power');
  });

  it('rejects an enabled gyeokguk rule-spec competition with fewer than two methods', () => {
    const error = captureInvalid(() => compileGyeokgukRuleSpec({
      ...spec({ kind: 'monthMainTenGod' }),
      policy: {
        competition: {
          enabled: true,
          methods: ['follow'],
        },
      },
    } as any));

    expect(error.path).toContain('.policy.competition.methods');
  });

  it('keeps ratio and score-penalty ranges aligned with compiler semantics', () => {
    const zeroRatio = captureInvalid(() => compileYongshinRuleSpec(spec({
      kind: 'followWeakPressure',
      minDominanceRatio: 0,
    }) as any));
    expect(zeroRatio.path).toContain('.minDominanceRatio');

    expect(() => compileGyeokgukRuleSpec(spec({
      kind: 'suppressOtherFrames',
      winner: 'follow',
      penalty: 2,
    }) as any)).not.toThrow();

    const mismatchedFactor = captureInvalid(() => compileGyeokgukRuleSpec(spec({
      kind: 'suppressOtherFrames',
      winner: 'follow',
      factor: { frame: 'transformations', sel: 'effective' },
    }) as any));
    expect(mismatchedFactor.path).toContain('.factor.frame');

    expect(() => compileYongshinRuleSpec(spec({
      kind: 'followJonggyeok',
      otherSupportScale: 2,
    }) as any)).not.toThrow();
  });

  it.each([
    { op: 'eq', args: [1] },
    { op: 'if', args: [true, 1] },
    { op: 'and', args: [] },
    { op: 'not', args: [true, false] },
  ])('rejects invalid DSL arity %#', (expression) => {
    const error = captureInvalid(() => compileGyeokgukRuleSpec(spec({
      kind: 'customRules',
      rules: [{
        id: 'BAD_ARITY',
        when: expression,
        score: { 'gyeokguk.TEST': 1 },
      }],
    }) as any));
    expect(error.path).toContain('.args');
  });

  it('accepts every supported DSL operator with its declared arity', () => {
    const expressions: Record<string, unknown[]> = {
      and: [true],
      or: [false],
      not: [true],
      isFiniteNumber: [{ var: 'facts.value' }],
      eq: [1, 1],
      ne: [1, 2],
      lt: [1, 2],
      lte: [1, 2],
      gt: [2, 1],
      gte: [2, 1],
      in: ['A', ['A']],
      overlap: [['A'], ['A']],
      intersect: [['A'], ['A']],
      len: [['A']],
      add: [1],
      sub: [2, 1],
      mul: [2],
      div: [2, 1],
      neg: [1],
      abs: [-1],
      min: [1],
      max: [1],
      sum: [[1, 2]],
      clamp: [1, 0, 2],
      if: [true, 1, 0],
    };

    for (const [op, args] of Object.entries(expressions)) {
      expect(() => compileShinsalRuleSpec(spec({
        kind: 'customRules',
        rules: [{
          id: `DSL_${op}`,
          emit: { value: { op, args } },
        }],
      }) as any), op).not.toThrow();
    }
  });

  it('rejects constant DSL expressions that evaluate to non-finite numbers', () => {
    const scoreError = captureInvalid(() => compileYongshinRuleSpec(spec({
      kind: 'customRules',
      rules: [{
        id: 'DIVIDE_BY_ZERO',
        score: {
          'yongshin.WOOD': { op: 'div', args: [1, 0] },
        },
      }],
    }) as any));
    expect(scoreError.path).toContain('.score.yongshin.WOOD');
    expect(scoreError.expected).toContain('DSL expression');

    const emitError = captureInvalid(() => compileShinsalRuleSpec(spec({
      kind: 'customRules',
      rules: [{
        id: 'NON_FINITE_EMIT',
        emit: { value: { op: 'mul', args: [1e308, 1e308] } },
      }],
    }) as any));
    expect(emitError.path).toContain('.emit.value');

    for (const expression of [
      { op: 'div', args: [{ var: 'facts.value' }, 0] },
      {
        op: 'add',
        args: [Number.MAX_VALUE, Number.MAX_VALUE, { var: 'facts.value' }],
      },
      {
        op: 'mul',
        args: [Number.MAX_VALUE, 2, { var: 'facts.value' }],
      },
      {
        op: 'sum',
        args: [[Number.MAX_VALUE, Number.MAX_VALUE, { var: 'facts.value' }]],
      },
    ]) {
      const guaranteedError = captureInvalid(() => compileYongshinRuleSpec(spec({
        kind: 'customRules',
        rules: [{
          id: 'GUARANTEED_NON_FINITE',
          score: { 'yongshin.WOOD': expression },
        }],
      }) as any));
      expect(guaranteedError.path).toContain('.score.yongshin.WOOD');
    }
  });

  it('rejects explicit undefined values and sparse arrays in caller rule data', () => {
    const undefinedValue = captureInvalid(() => compileShinsalRuleSpec(spec({
      kind: 'customRules',
      rules: [{
        id: 'UNDEFINED_EMIT',
        emit: { name: undefined },
      }],
    }) as any));
    expect(undefinedValue.path).toContain('.emit.name');
    expect(undefinedValue.expected).toContain('JSON-compatible');

    const sparseDetails: unknown[] = [];
    sparseDetails.length = 2;
    sparseDetails[1] = 'present';
    const sparseArray = captureInvalid(() => compileShinsalRuleSpec(spec({
      kind: 'customRules',
      rules: [{
        id: 'SPARSE_EMIT',
        emit: { details: sparseDetails },
      }],
    }) as any));
    expect(sparseArray.path).toContain('.emit.details[0]');
    expect(sparseArray.expected).toContain('non-sparse');
  });

  it('publishes generated shinsal rules without undefined object fields', () => {
    const compiled = compileShinsalRuleSpec([]);
    const findUndefined = (value: unknown): boolean => {
      if (value === undefined) return true;
      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
          if (
            !Object.prototype.hasOwnProperty.call(value, index)
            || findUndefined(value[index])
          ) return true;
        }
        return false;
      }
      if (!value || typeof value !== 'object') return false;
      return Object.values(value).some((entry) => findUndefined(entry));
    };
    expect(findUndefined(compiled)).toBe(false);
  });

  it('separates predicate, numeric score, and emit-template expression contexts', () => {
    const badWhen = captureInvalid(() => compileGyeokgukRuleSpec(spec({
      kind: 'customRules',
      rules: [{
        id: 'BAD_WHEN',
        when: { arbitrary: true },
        score: { 'gyeokguk.TEST': 1 },
      }],
    }) as any));
    expect(badWhen.path).toContain('.when');

    for (const invalidScore of ['oops', true, null, [1], { arbitrary: 1 }]) {
      const error = captureInvalid(() => compileGyeokgukRuleSpec(spec({
        kind: 'customRules',
        rules: [{
          id: 'BAD_SCORE',
          score: { 'gyeokguk.TEST': invalidScore },
        }],
      }) as any));
      expect(error.path).toContain('.score.gyeokguk.TEST');
    }
    captureInvalid(() => compileGyeokgukRuleSpec(spec({
      kind: 'customRules',
      rules: [{
        id: 'BAD_SUM_SOURCE',
        score: {
          'gyeokguk.TEST': { op: 'sum', args: ['silently-zero-before'] },
        },
      }],
    }) as any));

    expect(() => compileGyeokgukRuleSpec(spec({
      kind: 'customRules',
      rules: [{
        id: 'LEN_PREDICATE',
        when: { op: 'len', args: [[1]] },
        score: { 'generic.score': 1 },
      }],
    }) as any)).not.toThrow();

    expect(() => compileGyeokgukRuleSpec(spec({
      kind: 'customRules',
      rules: [{
        id: 'SUM_INTERSECTION',
        score: {
          'generic.score': {
            op: 'sum',
            args: [{ op: 'intersect', args: [[1], [1]] }],
          },
        },
      }],
    }) as any)).not.toThrow();

    const objectComparison = captureInvalid(() => compileGyeokgukRuleSpec(spec({
      kind: 'customRules',
      rules: [{
        id: 'OBJECT_COMPARE',
        when: { op: 'gt', args: [{ x: 1 }, 0] },
        score: { 'generic.score': 1 },
      }],
    }) as any));
    expect(objectComparison.path).toContain('.args[0]');

    expect(() => compileGyeokgukRuleSpec(spec({
      kind: 'customRules',
      rules: [{
        id: 'EMIT_TEMPLATE',
        emit: {
          name: 'TEST',
          details: [{ value: { var: 'facts.value' } }],
        },
      }],
    }) as any)).not.toThrow();
  });

  it('requires a non-empty effect-bearing rule contract', () => {
    const emptyScore = captureInvalid(() => compileGyeokgukRuleSpec(spec({
      kind: 'customRules',
      rules: [{ id: 'EMPTY_SCORE', score: {} }],
    }) as any));
    expect(emptyScore.path).toContain('.score');

    const noEffect = captureInvalid(() => compileGyeokgukRuleSpec(spec({
      kind: 'customRules',
      rules: [{ id: 'NO_EFFECT', when: true }],
    }) as any));
    expect(noEffect.expected).toContain('score, emit, or assert');

    const nullEmit = captureInvalid(() => compileGyeokgukRuleSpec(spec({
      kind: 'customRules',
      rules: [{ id: 'NULL_EMIT', emit: null }],
    }) as any));
    expect(nullEmit.expected).toContain('score, emit, or assert');
  });

  it.each([
    { kind: 'relationSal', defs: [] },
    { kind: 'relationSalKeys', names: [] },
    { kind: 'branchPresence', defs: [] },
    {
      kind: 'pillarBranchInList',
      args: { name: 'TEST', listVar: 'facts.list', pillars: [] },
    },
    { kind: 'catalogDayStem', defs: [] },
    { kind: 'catalogMonthBranchStem', defs: [] },
    { kind: 'catalogMonthBranchBranch', defs: [] },
    { kind: 'catalogDayPillar', defs: [] },
    { kind: 'twelveSal', anchors: [] },
    { kind: 'twelveSal', keys: [] },
    { kind: 'gongmangPillars', pillars: [] },
  ])('rejects an explicitly empty macro collection that would silently fall back or no-op %#', (
    macro,
  ) => {
    captureInvalid(() => compileShinsalRuleSpec(spec(macro) as any));
  });

  it('keeps public Rule score keys generic while macro judgment keys stay scoped', () => {
    expect(() => compileYongshinRuleSpec(spec({
      kind: 'customRules',
      rules: [{ id: 'GENERIC', score: { 'analytics.custom': 1 } }],
    }) as any)).not.toThrow();
    expect(() => compileShinsalConditionsRuleSpec(spec({
      kind: 'customRules',
      rules: [{ id: 'GENERIC', score: { 'audit.condition': 1 } }],
    }) as any)).not.toThrow();
    expect(() => compileShinsalRuleSpec(spec({
      kind: 'relationSal',
      defs: [{ name: 'TEST', scoreKey: 'custom.relation' }],
    }) as any)).not.toThrow();
    expect(() => compileShinsalRuleSpec(spec({
      kind: 'relationSalKeys',
      names: ['TEST'],
      scoreKeyPrefix: 'custom.{name}',
    }) as any)).not.toThrow();

    const macroKey = captureInvalid(() => compileGyeokgukRuleSpec(spec({
      kind: 'oneElementDominance',
      key: 'analytics.custom',
    }) as any));
    expect(macroKey.path).toContain('.key');

    const unsafeGeneric = captureInvalid(() => compileYongshinRuleSpec(spec({
      kind: 'customRules',
      rules: [{ id: 'UNSAFE', score: { 'audit.__proto__.value': 1 } }],
    }) as any));
    expect(unsafeGeneric.path).toContain('__proto__');
  });

  it('validates twelve-sal keys and catalog-specific compact fields', () => {
    const invalidTwelveSal = captureInvalid(() => compileShinsalRuleSpec(spec({
      kind: 'twelveSal',
      keys: ['NOT_A_TWELVE_SAL'],
    }) as any));
    expect(invalidTwelveSal.path).toContain('.keys[0]');

    captureInvalid(() => compileShinsalRuleSpec(spec({
      kind: 'catalogKeys',
      catalog: 'dayPillar',
      keys: ['TEST'],
      scoreMode: 'count',
    }) as any));
    captureInvalid(() => compileShinsalRuleSpec(spec({
      kind: 'catalogKeys',
      catalog: 'dayStem',
      keys: ['TEST'],
      emitPresentList: true,
    }) as any));
    captureInvalid(() => compileShinsalRuleSpec(spec({
      kind: 'catalogKeys',
      catalog: 'dayStem',
      keys: ['TEST'],
      names: { EXTRA: 'extra' },
    }) as any));

    expect(() => compileShinsalRuleSpec(spec({
      kind: 'catalogKeys',
      catalog: 'monthBranchStem',
      keys: ['TEST'],
      scoreMode: 'count',
      emitPresentList: true,
      names: { TEST: 'RENAMED' },
    }) as any)).not.toThrow();
  });

  it('rejects duplicate ids produced only after macro/spec compilation', () => {
    const error = captureInvalid(() => compileYongshinRuleSpec([
      spec({
        kind: 'elementBoost',
        elements: ['WOOD'],
        bonus: 1,
        idPrefix: 'DUPLICATE',
      }),
      spec({
        kind: 'elementBoost',
        elements: ['WOOD'],
        bonus: 2,
        idPrefix: 'DUPLICATE',
      }),
    ] as any));
    expect(error.path).toBe('compiledRuleSets.yongshin.rules[1].id');
  });

  it('rejects prototype-sensitive variable paths and open object keys', () => {
    const badVar = captureInvalid(() => compileGyeokgukRuleSpec(spec({
      kind: 'customRules',
      rules: [{
        id: 'BAD_VAR',
        score: {
          'gyeokguk.TEST': { var: 'facts.constructor.value' },
        },
      }],
    }) as any));
    expect(badVar.path).toContain('.var');

    const badGeneratedVar = captureInvalid(() => compileYongshinRuleSpec(spec({
      kind: 'elementByVar',
      elementVar: 'facts.__proto__.element',
      factorVar: 'facts.factor',
    }) as any));
    expect(badGeneratedVar.path).toContain('.elementVar');

    const badShinsalVar = captureInvalid(() => compileShinsalRuleSpec(spec({
      kind: 'branchPresence',
      defs: [{
        id: 'BAD_TARGET',
        name: 'TEST',
        basedOn: 'OTHER',
        targetVar: 'facts.constructor.branch',
      }],
    }) as any));
    expect(badShinsalVar.path).toContain('.targetVar');

    const unsafeEmit = JSON.parse('{"__proto__":{"polluted":true}}');
    const badEmit = captureInvalid(() => compileShinsalRuleSpec(spec({
      kind: 'customRules',
      rules: [{ id: 'BAD_EMIT', emit: unsafeEmit }],
    }) as any));
    expect(badEmit.path).toContain('__proto__');

    const unsafeNames = JSON.parse('{"__proto__":"BAD"}');
    const badNames = captureInvalid(() => compileShinsalRuleSpec(spec({
      kind: 'catalogKeys',
      catalog: 'dayStem',
      keys: ['TEST'],
      names: unsafeNames,
    }) as any));
    expect(badNames.path).toContain('__proto__');
  });

  it('rejects accessors without executing caller code', () => {
    let getterRuns = 0;
    const input = spec({ kind: 'elementBoost', elements: ['WOOD'], bonus: 1 });
    Object.defineProperty(input, 'description', {
      enumerable: true,
      get() {
        getterRuns += 1;
        return 'unsafe';
      },
    });

    captureInvalid(() => compileYongshinRuleSpec(input as any));
    expect(getterRuns).toBe(0);
  });

  it('rejects cyclic and executable data before structural reads', () => {
    const cyclic: any = spec({
      kind: 'elementBoost',
      elements: ['WOOD'],
      bonus: 1,
    });
    cyclic.self = cyclic;
    captureInvalid(() => compileYongshinRuleSpec(cyclic));

    captureInvalid(() => compileYongshinRuleSpec(spec({
      kind: 'elementBoost',
      elements: ['WOOD'],
      bonus: 1,
      callback: () => true,
    }) as any));
  });

  it('returns structured, raw-value-free errors', () => {
    const secret = 'DO_NOT_ECHO_THIS_VALUE';
    const error = captureInvalid(() => compileYongshinRuleSpec(spec({
      kind: 'elementBoost',
      elements: ['WOOD'],
      bonus: secret,
    }) as any));

    expect(error).toMatchObject({
      code: 'SAJU_INVALID_RULE_SPEC',
      target: 'yongshin',
      path: expect.stringContaining('.bonus'),
      expected: 'a finite number',
    });
    expect(error.message).not.toContain(secret);
  });
});

describe('direct RuleSet runtime validation', () => {
  function ruleSet(target: KnownRuleSpecTarget, rules = [ruleFor(target)]) {
    return {
      id: `${target}.direct`,
      version: '1',
      description: 'direct ruleset',
      rules,
    };
  }

  it('accepts valid target-specific RuleSets', () => {
    for (const target of Object.keys(compilers) as KnownRuleSpecTarget[]) {
      expect(
        () => assertValidRuleSet(ruleSet(target), `rulesets.${target}`, target),
        target,
      ).not.toThrow();
    }
  });

  it('rejects duplicate rule ids before evaluation', () => {
    const error = captureInvalid(() => assertValidRuleSet(
      ruleSet('gyeokguk', [
        ruleFor('gyeokguk', 'DUPLICATE'),
        ruleFor('gyeokguk', 'DUPLICATE'),
      ]),
      'rulesets.gyeokguk',
      'gyeokguk',
    ));
    expect(error.path).toBe('rulesets.gyeokguk.rules[1].id');
  });

  it('rejects malformed envelopes while allowing generic score namespaces', () => {
    captureInvalid(() => assertValidRuleSet(
      { id: 'missing.version', rules: [] },
      'rulesets.gyeokguk',
      'gyeokguk',
    ));
    expect(() => assertValidRuleSet(
      ruleSet('gyeokguk', [{
        id: 'GENERIC',
        score: { 'external.metric': 1 },
      }]),
      'rulesets.gyeokguk',
      'gyeokguk',
    )).not.toThrow();
  });

  it('limits the validator API itself to the four known targets', () => {
    const error = captureInvalid(() => assertValidKnownRuleSpec(
      'future-target',
      { macros: [] },
      'ruleSpecs.future',
    ));
    expect(error.target).toBe('future-target');
  });
});
