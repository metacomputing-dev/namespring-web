import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import { createEngine } from '../api/engine.js';
import type { BranchIdx, PillarIdx, StemIdx } from '../core/cycle.js';
import { pillar } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY, emptyTenGodScore, scorePillars } from '../core/scoring.js';
import { buildRuleFacts } from './facts.js';
import {
  readRuleFactsScoringProvenance,
  scorePillarsForRuleFacts,
} from './ruleFactsScoring.js';
import { computeStrengthBase } from './strengthBase.js';

function analyzeStrength(
  pillars: { year: PillarIdx; month: PillarIdx; day: PillarIdx; hour: PillarIdx },
  options: {
    stemWeight?: number;
    model?: 'base' | 'deLingDiShi';
    excludeDayMasterSelf?: boolean;
  } = {},
) {
  const config = normalizeConfig({
    strategies: {
      strength: {
        model: options.model ?? 'base',
        ...(options.excludeDayMasterSelf !== undefined
          ? { excludeDayMasterSelf: options.excludeDayMasterSelf }
          : {}),
      },
    },
  });
  const elementDistribution = elementDistributionFromPillars(
    [pillars.year, pillars.month, pillars.day, pillars.hour],
    { hiddenStemWeights: (config.weights as any)?.hiddenStems },
  );
  const scoringPolicy = {
    ...DEFAULT_SCORE_POLICY,
    stemWeight: options.stemWeight ?? DEFAULT_SCORE_POLICY.stemWeight,
  };
  const scoring = scorePillarsForRuleFacts(pillars, scoringPolicy);
  const facts = buildRuleFacts({ config, pillars, elementDistribution, scoring });

  return { facts, scoring };
}

describe('strength day-master self exclusion', () => {
  it('keeps internal scoring provenance out of the raw public facts shape', () => {
    const bundle = createEngine({}).analyze({
      birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' },
      sex: 'M',
    } as any);
    const scoring = (bundle.report.facts as Record<string, any>)['scores.pillars'];

    expect(scoring).toBeTruthy();
    expect('provenance' in scoring).toBe(false);
    expect(JSON.stringify(scoring)).not.toContain('dayMasterDirectStemWeight');
  });

  it.each([
    { stemWeight: 1, expectedPressure: 7 },
    { stemWeight: 2, expectedPressure: 10 },
  ])('excludes the exact policy weight ($stemWeight) from an otherwise unsupported day master', ({
    stemWeight,
    expectedPressure,
  }) => {
    const pillars = {
      year: pillar(2 as StemIdx, 6 as BranchIdx),
      month: pillar(3 as StemIdx, 5 as BranchIdx),
      day: pillar(0 as StemIdx, 10 as BranchIdx),
      hour: pillar(7 as StemIdx, 9 as BranchIdx),
    };
    const { facts, scoring } = analyzeStrength(pillars, {
      stemWeight,
      excludeDayMasterSelf: true,
    });
    const genericScoring = scorePillars(pillars, {
      ...DEFAULT_SCORE_POLICY,
      stemWeight,
    });

    expect(readRuleFactsScoringProvenance(scoring)?.dayMasterDirectStemWeight).toBe(stemWeight);
    expect(Object.keys(scoring)).toEqual(Object.keys(genericScoring));
    expect(JSON.stringify(scoring)).toBe(JSON.stringify(genericScoring));
    expect(scoring.tenGods.BI_GYEON).toBeCloseTo(stemWeight, 12);
    expect(facts.tenGodScores).toEqual(scoring.tenGods);
    expect(facts.strength.components.companions).toBe(0);
    expect(facts.strength.support).toBe(0);
    expect(facts.strength.pressure).toBeCloseTo(expectedPressure, 12);
    expect(facts.strength.index).toBe(-1);
  });

  it('keeps the legacy ledger by default until the measured default change is approved', () => {
    const pillars = {
      year: pillar(2 as StemIdx, 6 as BranchIdx),
      month: pillar(3 as StemIdx, 5 as BranchIdx),
      day: pillar(0 as StemIdx, 10 as BranchIdx),
      hour: pillar(7 as StemIdx, 9 as BranchIdx),
    };
    const { facts } = analyzeStrength(pillars);

    expect(facts.strength.components.companions).toBe(1);
    expect(facts.strength.support).toBe(1);
  });

  it('fails closed when self exclusion is requested without scoring provenance', () => {
    const config = normalizeConfig({
      strategies: { strength: { model: 'base', excludeDayMasterSelf: true } },
    });
    const pillars = {
      year: pillar(2 as StemIdx, 6 as BranchIdx),
      month: pillar(3 as StemIdx, 5 as BranchIdx),
      day: pillar(0 as StemIdx, 10 as BranchIdx),
      hour: pillar(7 as StemIdx, 9 as BranchIdx),
    };
    const elementDistribution = elementDistributionFromPillars(
      [pillars.year, pillars.month, pillars.day, pillars.hour],
      { hiddenStemWeights: (config.weights as any)?.hiddenStems },
    );
    const scoring = scorePillars(pillars, DEFAULT_SCORE_POLICY);

    expect(() => buildRuleFacts({ config, pillars, elementDistribution, scoring }))
      .toThrow(/requires scoring provenance/);
  });

  it('fails closed when explicit and coupled provenance disagree', () => {
    const config = normalizeConfig({ strategies: { strength: { model: 'base' } } });
    const pillars = {
      year: pillar(2 as StemIdx, 6 as BranchIdx),
      month: pillar(3 as StemIdx, 5 as BranchIdx),
      day: pillar(0 as StemIdx, 10 as BranchIdx),
      hour: pillar(7 as StemIdx, 9 as BranchIdx),
    };
    const elementDistribution = elementDistributionFromPillars(
      [pillars.year, pillars.month, pillars.day, pillars.hour],
      { hiddenStemWeights: (config.weights as any)?.hiddenStems },
    );
    const scoring = scorePillarsForRuleFacts(pillars, {
      ...DEFAULT_SCORE_POLICY,
      stemWeight: 2,
    });

    expect(() => buildRuleFacts({
      config,
      pillars,
      elementDistribution,
      scoring,
      dayMasterSelfScore: 1,
    })).toThrow(/conflicting day-master self-score provenance/);
  });

  it('forwards coupled provenance to seongpae BI_GYEON strength comparison', () => {
    const config = normalizeConfig({
      strategies: {
        strength: { model: 'base' },
        gyeokguk: {
          seongpae: {
            enabled: true,
            hiddenSangshin: { enabled: true },
            strengthCompare: { enabled: true, decisiveMargin: 0.4 },
          },
        },
      },
    });
    const pillars = {
      year: pillar(0 as StemIdx, 0 as BranchIdx),
      month: pillar(2 as StemIdx, 1 as BranchIdx),
      day: pillar(0 as StemIdx, 10 as BranchIdx),
      hour: pillar(8 as StemIdx, 9 as BranchIdx),
    };
    const elementDistribution = elementDistributionFromPillars(
      [pillars.year, pillars.month, pillars.day, pillars.hour],
      { hiddenStemWeights: (config.weights as any)?.hiddenStems },
    );
    const scoring = scorePillarsForRuleFacts(pillars, DEFAULT_SCORE_POLICY);
    const facts = buildRuleFacts({ config, pillars, elementDistribution, scoring });

    expect(facts.month.gyeok.seongpae?.strengthComparison).toMatchObject({
      breaker: 'BI_GYEON',
    });
  });

  it('fails closed when the scoring policy and ten-god ledger are inconsistent', () => {
    const tenGods = emptyTenGodScore();
    tenGods.BI_GYEON = 0.5;

    expect(() =>
      computeStrengthBase(tenGods, { excludedDayMasterDirectStemWeight: 1 }),
    ).toThrow(/lacks the declared day-master stem contribution/);
  });

  it('keeps the generic ledger intact and moves adjudicated fix-04 to the weak side', () => {
    const pillars = {
      year: pillar(1 as StemIdx, 5 as BranchIdx),
      month: pillar(0 as StemIdx, 8 as BranchIdx),
      day: pillar(0 as StemIdx, 6 as BranchIdx),
      hour: pillar(9 as StemIdx, 9 as BranchIdx),
    };
    const { facts, scoring } = analyzeStrength(pillars, {
      model: 'deLingDiShi',
      excludeDayMasterSelf: true,
    });

    expect(facts.tenGodScores).toEqual(scoring.tenGods);
    expect(scoring.tenGods.BI_GYEON + scoring.tenGods.GEOB_JAE).toBeCloseTo(3, 12);
    expect(facts.strength.components.companions).toBeCloseTo(2, 12);
    expect(facts.strength.index).toBeLessThan(0);
  });
});
