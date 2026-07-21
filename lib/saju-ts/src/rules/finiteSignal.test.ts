import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import type { EngineConfig } from '../api/types.js';
import { pillar } from '../core/cycle.js';
import type { ElementDistribution } from '../core/elementDistribution.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY } from '../core/scoring.js';
import { evalExpr, evalRuleSet } from './dsl.js';
import { buildRuleFacts, type RuleFacts } from './facts.js';
import {
  finiteSignalFallbackExpr,
  firstFiniteSignal,
} from './finiteSignal.js';
import { computeGyeokguk } from './gyeokguk.js';
import { scorePillarsForRuleFacts } from './ruleFactsScoring.js';
import { compileGyeokgukRuleSpec } from './spec/compileGyeokgukSpec.js';
import { compileYongshinRuleSpec } from './spec/compileYongshinSpec.js';
import { computeYongshin } from './yongshin.js';

const PILLARS = {
  year: pillar(2, 0),
  month: pillar(5, 2),
  day: pillar(4, 4),
  hour: pillar(7, 9),
};

function buildFacts(
  config: EngineConfig,
  elementDistribution: ElementDistribution = elementDistributionFromPillars(
    [PILLARS.year, PILLARS.month, PILLARS.day, PILLARS.hour],
    { hiddenStemWeights: (config.weights as any)?.hiddenStems },
  ),
): RuleFacts {
  return buildRuleFacts({
    config,
    pillars: PILLARS,
    elementDistribution,
    scoring: scorePillarsForRuleFacts(PILLARS, DEFAULT_SCORE_POLICY),
  });
}

function setSyntheticSpecialSignals(
  facts: RuleFacts,
  precise: { huaqi?: number; zhuanwang?: number },
): void {
  const mutable = facts as any;
  mutable.strength.index = 0.5;
  mutable.patterns.elements.oneElement = {
    enabled: true,
    isOneElement: true,
    element: 'FIRE',
    factor: 0.8,
    ...(precise.zhuanwang === undefined ? {} : { zhuanwangFactor: precise.zhuanwang }),
  };
  mutable.patterns.transformations = {
    best: {
      pair: 'SYNTHETIC',
      resultElement: 'FIRE',
      factor: 0.9,
      effectiveFactor: 0.8,
      ...(precise.huaqi === undefined ? {} : { huaqiFactor: precise.huaqi }),
      huaqiDetails: { flags: { dayInvolved: false } },
    },
  };
}

describe('finite special-pattern signal fallback', () => {
  it('keeps explicit zero and skips only unavailable or non-finite values', () => {
    expect(firstFiniteSignal(undefined, 0, 0.8)).toBe(0);
    expect(firstFiniteSignal(0.4, 0.8)).toBe(0.4);
    expect(firstFiniteSignal(undefined, 0.8)).toBe(0.8);
    expect(firstFiniteSignal(Number.NaN, Number.POSITIVE_INFINITY, 0.6)).toBe(0.6);
    expect(firstFiniteSignal(undefined, Number.NaN)).toBeUndefined();
  });

  it('applies the same finite-present policy in the rule DSL', () => {
    const expression = finiteSignalFallbackExpr('precise', { var: 'fallback' });

    expect(evalExpr(expression, { precise: 0, fallback: 0.8 })).toBe(0);
    expect(evalExpr(expression, { precise: 0.4, fallback: 0.8 })).toBe(0.4);
    expect(evalExpr(expression, { fallback: 0.8 })).toBe(0.8);
    expect(evalExpr(expression, { precise: Number.NaN, fallback: 0.8 })).toBe(0.8);
    expect(evalExpr(expression, { precise: '0', fallback: 0.8 })).toBe(0.8);
  });

  it('keeps hard vetoes authoritative in default rules, candidates, and canonical when clauses', () => {
    const config = normalizeConfig({});
    const vetoFacts = buildFacts(config);
    setSyntheticSpecialSignals(vetoFacts, { huaqi: 0, zhuanwang: 0 });

    const vetoed = computeGyeokguk(config, vetoFacts);
    expect(vetoed.scores['gyeokguk.HUA_QI']).toBe(0);
    expect(vetoed.scores['gyeokguk.ZHUAN_WANG']).toBe(0);
    expect(vetoed.rules.matches.map((match) => match.ruleId)).not.toContain('GYEOK_HUA_QI');
    expect(vetoed.rules.matches.map((match) => match.ruleId)).not.toContain('GYEOK_ZHUAN_WANG');
    expect(vetoed.jonggyeokCandidates.find((candidate) => candidate.subtype === 'hua_qi')?.followPressure).toBe(0);
    expect(vetoed.jonggyeokCandidates.find((candidate) => candidate.subtype === 'zhuan_wang')?.followPressure).toBe(0);

    const fallbackFacts = buildFacts(config);
    setSyntheticSpecialSignals(fallbackFacts, {});

    const fallback = computeGyeokguk(config, fallbackFacts);
    expect(fallback.scores['gyeokguk.HUA_QI']).toBeCloseTo(0.68, 12);
    expect(fallback.scores['gyeokguk.ZHUAN_WANG']).toBeCloseTo(0.68, 12);
    expect(fallback.jonggyeokCandidates.find((candidate) => candidate.subtype === 'hua_qi')?.followPressure).toBe(0.8);
    expect(fallback.jonggyeokCandidates.find((candidate) => candidate.subtype === 'zhuan_wang')?.followPressure).toBe(0.8);

    const positiveFacts = buildFacts(config);
    setSyntheticSpecialSignals(positiveFacts, { huaqi: 0.7, zhuanwang: 0.7 });

    const positive = computeGyeokguk(config, positiveFacts);
    expect(positive.scores['gyeokguk.HUA_QI']).toBeCloseTo(0.595, 12);
    expect(positive.scores['gyeokguk.ZHUAN_WANG']).toBeCloseTo(0.595, 12);
    expect(positive.jonggyeokCandidates.find((candidate) => candidate.subtype === 'hua_qi')?.followPressure).toBe(0.7);
    expect(positive.jonggyeokCandidates.find((candidate) => candidate.subtype === 'zhuan_wang')?.followPressure).toBe(0.7);

    const belowGateFacts = buildFacts(config);
    setSyntheticSpecialSignals(belowGateFacts, { huaqi: 0.7, zhuanwang: 0.3 });

    const belowGate = computeGyeokguk(config, belowGateFacts);
    expect(belowGate.scores['gyeokguk.ZHUAN_WANG']).toBe(0);
    expect(belowGate.rules.matches.map((match) => match.ruleId)).not.toContain('GYEOK_ZHUAN_WANG');
    expect(belowGate.jonggyeokCandidates.find((candidate) => candidate.subtype === 'zhuan_wang')?.followPressure).toBe(0.3);
  });

  it('preserves zero in compiled gyeokguk and yongshin one-element macros', () => {
    const facts = {
      patterns: {
        elements: {
          oneElement: {
            element: 'FIRE',
            factor: 0.8,
            zhuanwangFactor: 0,
          },
        },
      },
    };
    const gyeokgukRules = compileGyeokgukRuleSpec({
      id: 'test.gyeokguk.finite-signal',
      base: 'none',
      mode: 'replace',
      macros: [{
        kind: 'oneElementDominance',
        factor: 'zhuanwang',
        minFactor: 0.5,
        bonus: 1,
      }],
    });
    const yongshinRules = compileYongshinRuleSpec({
      id: 'test.yongshin.finite-signal',
      base: 'none',
      mode: 'replace',
      macros: [{
        kind: 'oneElementDominance',
        factor: 'zhuanwang',
        minFactor: 0.5,
        bonus: 1,
      }],
    });

    expect(evalRuleSet(gyeokgukRules, facts).scores['gyeokguk.ZHUAN_WANG']).toBeUndefined();
    expect(evalRuleSet(yongshinRules, facts).scores['yongshin.FIRE']).toBeUndefined();

    delete (facts.patterns.elements.oneElement as any).zhuanwangFactor;
    expect(evalRuleSet(gyeokgukRules, facts).scores['gyeokguk.ZHUAN_WANG']).toBeCloseTo(0.8, 12);
    expect(evalRuleSet(yongshinRules, facts).scores['yongshin.FIRE']).toBeCloseTo(0.8, 12);
  });

  it('preserves zero in the gyeokguk follow-signal reader and falls back only when missing', () => {
    const config = normalizeConfig({
      strategies: {
        gyeokguk: {
          competition: {
            enabled: true,
            methods: ['follow', 'transformations'],
            signals: {
              follow: 'auto',
              transformations: 'raw',
            },
          },
        },
      },
      extensions: {
        rulesets: {
          gyeokguk: {
            id: 'test.gyeokguk.follow-signal',
            version: '1.0',
            rules: [
              { id: 'FOLLOW_SCORE', score: { 'gyeokguk.CONG_GE': 1 } },
              { id: 'TRANSFORM_SCORE', score: { 'gyeokguk.HUA_QI': 1 } },
            ],
          },
        },
      },
    });
    const readCompetitionSignal = (jonggyeokFactor: number | undefined): number | undefined => {
      const facts = buildFacts(config) as any;
      facts.patterns.follow = {
        enabled: true,
        potentialRaw: 0.9,
        potential: 0.8,
        ...(jonggyeokFactor === undefined ? {} : { jonggyeokFactor }),
      };
      facts.patterns.transformations = {
        best: {
          factor: 0.5,
          resultElement: 'FIRE',
        },
      };
      return computeGyeokguk(config, facts).competition?.signals.follow;
    };

    expect(readCompetitionSignal(0)).toBe(0);
    expect(readCompetitionSignal(undefined)).toBe(0.8);
    expect(readCompetitionSignal(0.7)).toBe(0.7);
  });

  it('preserves zero in compiled yongshin follow-jonggyeok macros', () => {
    const rules = compileYongshinRuleSpec({
      id: 'test.yongshin.follow-finite-signal',
      base: 'none',
      mode: 'replace',
      macros: [{
        kind: 'followJonggyeok',
        factor: 'jonggyeok',
        mode: 'ANY',
        target: 'element',
        scaleBy: 'none',
        minFactor: 0.5,
        bonus: 1,
      }],
    });
    const facts = {
      patterns: {
        follow: {
          enabled: true,
          mode: 'PRESSURE',
          dominantElement: 'FIRE',
          potentialRaw: 0.9,
          potential: 0.8,
          jonggyeokFactor: 0,
        },
      },
    };

    expect(evalRuleSet(rules, facts).scores['yongshin.FIRE']).toBeUndefined();

    delete (facts.patterns.follow as any).jonggyeokFactor;
    expect(evalRuleSet(rules, facts).scores['yongshin.FIRE']).toBeCloseTo(0.8, 12);

    (facts.patterns.follow as any).jonggyeokFactor = 0.7;
    expect(evalRuleSet(rules, facts).scores['yongshin.FIRE']).toBeCloseTo(0.7, 12);
  });

  it('preserves hard vetoes in yongshin follow, transformation, and one-element terms', () => {
    const config = normalizeConfig({
      strategies: {
        yongshin: {
          weights: {
            follow: 1,
            transformations: 1,
            oneElement: 1,
          },
        },
      },
    });

    const vetoFacts = buildFacts(config);
    setSyntheticSpecialSignals(vetoFacts, { huaqi: 0, zhuanwang: 0 });
    const vetoed = computeYongshin(config, vetoFacts);

    expect(vetoed.base.follow?.oneElementFactor).toBe(0);
    expect(vetoed.base.transformations?.bestFactor).toBe(0);
    expect(vetoed.base.oneElement?.signal).toBe(0);

    const fallbackFacts = buildFacts(config);
    setSyntheticSpecialSignals(fallbackFacts, {});
    const fallback = computeYongshin(config, fallbackFacts);

    expect(fallback.base.follow?.oneElementFactor).toBe(0.8);
    expect(fallback.base.transformations?.bestFactor).toBe(0.8);
    expect(fallback.base.oneElement?.signal).toBe(0.8);
  });

  it('keeps a real zhuanwang day-master mismatch veto through follow-pattern enrichment', () => {
    const config = normalizeConfig({
      strategies: {
        patterns: {
          oneElement: {
            zhuanwang: {
              enabled: true,
              requireDayMasterMatch: true,
            },
          },
          follow: {
            enabled: true,
            strongThreshold: -2,
            minDominanceRatio: 0,
            oneElementBoost: 1,
          },
        },
      },
    });
    const concentratedFire: ElementDistribution = {
      heaven: { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 },
      hidden: { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 },
      total: { WOOD: 0, FIRE: 100, EARTH: 0, METAL: 0, WATER: 0 },
    };

    const facts = buildFacts(config, concentratedFire);
    const oneElement = (facts as any).patterns.elements.oneElement;
    const follow = (facts as any).patterns.follow;

    expect(facts.dayMaster.element).toBe('EARTH');
    expect(oneElement.element).toBe('FIRE');
    expect(oneElement.factor).toBeGreaterThan(0.9);
    expect(oneElement.zhuanwangFactor).toBe(0);
    expect(follow.mode).toBe('SUPPORT');
    expect(follow.oneElementFactor).toBe(0);
  });
});
