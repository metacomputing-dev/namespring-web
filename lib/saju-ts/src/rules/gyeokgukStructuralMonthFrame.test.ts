import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import { pillar } from '../core/cycle.js';
import type { BranchIdx, StemIdx } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY } from '../core/scoring.js';
import type { TenGod } from '../core/tenGod.js';
import { evalRuleSet } from './dsl.js';
import { buildRuleFacts } from './facts.js';
import { computeGyeokguk } from './gyeokguk.js';
import { classifyStructuralMonthFrame } from './gyeokgukMonthFrame.js';
import { scorePillarsForRuleFacts } from './ruleFactsScoring.js';
import { compileGyeokgukRuleSpec } from './spec/compileGyeokgukSpec.js';

type PillarPair = [number, number];
type PillarSpec = {
  year: PillarPair;
  month: PillarPair;
  day: PillarPair;
  hour: PillarPair;
};

function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}

function assertDerivedPillarStems(pillarSpec: PillarSpec): void {
  const [yearStem, yearBranch] = pillarSpec.year;
  const [monthStem, monthBranch] = pillarSpec.month;
  const [dayStem, dayBranch] = pillarSpec.day;
  const [hourStem, hourBranch] = pillarSpec.hour;
  const monthOffsetFromIn = mod(monthBranch - 2, 12);
  const expectedMonthStem = mod(mod(yearStem, 5) * 2 + 2 + monthOffsetFromIn, 10);
  const expectedHourStem = mod(mod(dayStem, 5) * 2 + hourBranch, 10);

  if (mod(yearStem - yearBranch, 2) !== 0 || mod(dayStem - dayBranch, 2) !== 0) {
    throw new Error('test specimen contains an impossible year/day pillar');
  }
  if (monthStem !== expectedMonthStem) {
    throw new Error(`test specimen violates five-tiger month derivation: expected stem ${expectedMonthStem}`);
  }
  if (hourStem !== expectedHourStem) {
    throw new Error(`test specimen violates five-rat hour derivation: expected stem ${expectedHourStem}`);
  }
}

function analyze(pillarSpec: PillarSpec, gyeokgukStrategies: Record<string, unknown> = {}) {
  assertDerivedPillarStems(pillarSpec);
  const config = normalizeConfig({
    strategies: { gyeokguk: gyeokgukStrategies },
    extensions: {
      ruleSpecs: {
        gyeokguk: {
          id: 'test.gyeokguk.structural-month-frame',
          base: 'none',
          mode: 'replace',
          macros: [{ kind: 'monthGyeokTenGod' }],
        },
      },
    },
  });
  const pillars = {
    year: pillar(...pillarSpec.year),
    month: pillar(...pillarSpec.month),
    day: pillar(...pillarSpec.day),
    hour: pillar(...pillarSpec.hour),
  };
  const elementDistribution = elementDistributionFromPillars(
    [pillars.year, pillars.month, pillars.day, pillars.hour],
    { hiddenStemWeights: (config.weights as any)?.hiddenStems },
  );
  const scoring = scorePillarsForRuleFacts(pillars, DEFAULT_SCORE_POLICY);
  const facts = buildRuleFacts({ config, pillars, elementDistribution, scoring });
  const result = computeGyeokguk(config, facts);
  return { facts, result };
}

function expectSelected(
  pillarSpec: PillarSpec,
  expected: {
    tenGod: TenGod;
    method: string;
    subtype: 'GEONROK' | 'YANGIN' | 'WOLGEOB' | null;
    resultKey: string;
  },
  gyeokgukStrategies: Record<string, unknown> = {},
) {
  const { facts, result } = analyze(pillarSpec, gyeokgukStrategies);
  expect(facts.month.gyeok.tenGod).toBe(expected.tenGod);
  expect(facts.month.gyeok.method).toBe(expected.method);
  expect(facts.month.gyeok.bigyeopSubtype).toBe(expected.subtype);
  expect(result.best).toBe(expected.resultKey);
  return facts;
}

describe('structural month-frame classifier', () => {
  const canonicalLokBranches: Array<[StemIdx, BranchIdx]> = [
    [0, 2],
    [1, 3],
    [2, 5],
    [3, 6],
    [4, 5],
    [5, 6],
    [6, 8],
    [7, 9],
    [8, 11],
    [9, 0],
  ];

  it.each(canonicalLokBranches)('classifies stem %s at branch %s as GEONROK', (dayStem, monthBranch) => {
    expect(classifyStructuralMonthFrame({
      dayStem,
      monthBranch,
      monthMainStem: 2 as StemIdx,
      monthMainTenGod: 'PYEON_IN',
    })).toEqual({
      subtype: 'GEONROK',
      anchorStem: dayStem,
      reason: 'DAY_STEM_LOK_BRANCH',
    });
  });

  it('does not infer a structural frame without a lu branch or companion month main', () => {
    expect(classifyStructuralMonthFrame({
      dayStem: 0 as StemIdx,
      monthBranch: 11 as BranchIdx,
      monthMainStem: 8 as StemIdx,
      monthMainTenGod: 'PYEON_IN',
    })).toBeNull();
  });

  it.each([
    [4, 1, 5, 'GEOB_JAE', 'WOLGEOB'],
    [4, 7, 5, 'GEOB_JAE', 'WOLGEOB'],
    [5, 4, 4, 'GEOB_JAE', 'WOLGEOB'],
    [5, 10, 4, 'GEOB_JAE', 'WOLGEOB'],
  ] as const)(
    'classifies earth mixed-month GEOB_JAE as WOLGEOB for day stem %s / branch %s',
    (dayStem, monthBranch, monthMainStem, monthMainTenGod, subtype) => {
      expect(classifyStructuralMonthFrame({
        dayStem: dayStem as StemIdx,
        monthBranch: monthBranch as BranchIdx,
        monthMainStem: monthMainStem as StemIdx,
        monthMainTenGod,
      })?.subtype).toBe(subtype);
    },
  );

  it.each([
    [4, 4, 4],
    [4, 10, 4],
    [5, 1, 5],
    [5, 7, 5],
  ] as const)(
    'does not auto-promote earth mixed-month BI_GYEON for day stem %s / branch %s',
    (dayStem, monthBranch, monthMainStem) => {
      const input = {
        dayStem: dayStem as StemIdx,
        monthBranch: monthBranch as BranchIdx,
        monthMainStem: monthMainStem as StemIdx,
        monthMainTenGod: 'BI_GYEON' as const,
      };
      expect(classifyStructuralMonthFrame(input)).toBeNull();
      expect(classifyStructuralMonthFrame({
        ...input,
        earthMixedMonthPolicy: 'geonrok_compat',
      })?.subtype).toBe('GEONROK');
    },
  );
});

describe('month hidden-stem transparency', () => {
  it('does not count the day master itself as transparent', () => {
    const facts = expectSelected(
      { year: [6, 0], month: [3, 11], day: [0, 0], hour: [6, 6] },
      { tenGod: 'PYEON_IN', method: 'MAIN_FALLBACK', subtype: null, resultKey: 'gyeokguk.PYEON_IN' },
    );
    const dayStemCandidate = facts.month.hiddenStems.find((candidate) => candidate.stem === 0);
    expect(dayStemCandidate).toMatchObject({ tenGod: 'BI_GYEON', visibleInChart: false });
  });

  it.each([
    ['year', { year: [0, 0], month: [2, 2], day: [6, 4], hour: [6, 4] }],
    ['month', { year: [4, 0], month: [0, 2], day: [6, 4], hour: [6, 4] }],
    ['hour', { year: [2, 0], month: [6, 2], day: [6, 4], hour: [0, 8] }],
  ] as const)('counts a hidden stem exposed in the %s stem', (_position, pillarSpec) => {
    const { facts } = analyze(pillarSpec);
    expect(facts.month.hiddenStems.find((candidate) => candidate.stem === 0)?.visibleInChart).toBe(true);
  });

  it('counts the selected unexposed frame together with a different exposed hidden stem for purity', () => {
    const { facts } = analyze({
      year: [8, 0], month: [0, 4], day: [0, 0], hour: [1, 1],
    });
    expect(facts.month.gyeok).toMatchObject({
      tenGod: 'PYEON_JAE',
      method: 'MAIN_FALLBACK',
      quality: {
        mixed: true,
      },
    });
    expect(facts.month.gyeok.quality.reasons).toContain('mixedVisible:2');
  });
});

describe('structural month-gyeok integration', () => {
  it('keeps unexposed 甲 in 亥 month from becoming a false GEONROK frame', () => {
    expectSelected(
      { year: [6, 0], month: [3, 11], day: [0, 0], hour: [6, 6] },
      { tenGod: 'PYEON_IN', method: 'MAIN_FALLBACK', subtype: null, resultKey: 'gyeokguk.PYEON_IN' },
    );
  });

  it('keeps unexposed 丙 in 寅 month from becoming a false GEONROK frame', () => {
    expectSelected(
      { year: [7, 1], month: [6, 2], day: [2, 10], hour: [9, 5] },
      { tenGod: 'PYEON_IN', method: 'MAIN_FALLBACK', subtype: null, resultKey: 'gyeokguk.PYEON_IN' },
    );
  });

  it('does not promote an exposed companion residual stem when the month command is not a companion frame', () => {
    const fix06 = expectSelected(
      { year: [4, 6], month: [4, 6], day: [4, 8], hour: [5, 7] },
      { tenGod: 'JEONG_IN', method: 'MAIN_FALLBACK', subtype: null, resultKey: 'gyeokguk.JEONG_IN' },
    );
    const fix07 = expectSelected(
      { year: [3, 9], month: [8, 2], day: [3, 7], hour: [2, 6] },
      { tenGod: 'JEONG_IN', method: 'MAIN_FALLBACK', subtype: null, resultKey: 'gyeokguk.JEONG_IN' },
    );
    const fix11 = expectSelected(
      { year: [1, 11], month: [0, 8], day: [4, 2], hour: [4, 6] },
      { tenGod: 'SIK_SHIN', method: 'MAIN_FALLBACK', subtype: null, resultKey: 'gyeokguk.SIK_SHIN' },
    );

    for (const facts of [fix06, fix07, fix11]) {
      const excluded = facts.month.gyeok.candidates?.filter(
        (candidate) => candidate.eligibleForGyeokSelection === false,
      ) ?? [];
      expect(excluded.length).toBeGreaterThan(0);
      expect(excluded.every((candidate) =>
        candidate.selectionExclusionReason === 'COMPANION_REQUIRES_STRUCTURAL_FRAME')).toBe(true);
    }

    const candidates = fix07.month.gyeok.candidates ?? [];
    const eligible = candidates.filter((candidate) => candidate.eligibleForGyeokSelection !== false);
    const candidateGap = (rows: typeof candidates): number => {
      const top = rows[0]?.score ?? 0;
      const second = rows[1]?.score ?? 0;
      return top > 0 ? Math.max(0, Math.min(1, (top - second) / top)) : 0;
    };
    const qualityGap = fix07.month.gyeok.quality?.details.gap;

    expect(qualityGap).toBeCloseTo(candidateGap(eligible), 12);
    expect(qualityGap).not.toBeCloseTo(candidateGap(candidates), 12);
  });

  it('keeps excluded companion transparency as quality evidence without selecting it', () => {
    const { facts, result } = analyze({
      year: [5, 5],
      month: [4, 4],
      day: [0, 0],
      hour: [1, 11],
    });
    const excludedCompanion = facts.month.gyeok.candidates?.find(
      (candidate) => candidate.tenGod === 'GEOB_JAE' && candidate.visibleInChart,
    );

    expect(facts.month.gyeok.tenGod).toBe('PYEON_JAE');
    expect(result.best).toBe('gyeokguk.PYEON_JAE');
    expect(excludedCompanion).toMatchObject({
      eligibleForGyeokSelection: false,
      selectionExclusionReason: 'COMPANION_REQUIRES_STRUCTURAL_FRAME',
    });
    expect(facts.month.gyeok.quality).toMatchObject({
      mixed: true,
      qingZhuo: 'ZHUO',
    });
    expect(facts.month.gyeok.seongpae).toMatchObject({
      verdict: 'PAGYEOK',
      pagyeokFactor: 'GEOB_JAE',
    });
  });

  it.each([
    [
      '甲寅',
      { year: [6, 0], month: [4, 2], day: [0, 6], hour: [5, 5] },
      { tenGod: 'BI_GYEON', subtype: 'GEONROK', resultKey: 'gyeokguk.GEONROK' },
    ],
    [
      '甲卯',
      { year: [6, 0], month: [5, 3], day: [0, 8], hour: [4, 4] },
      { tenGod: 'GEOB_JAE', subtype: 'YANGIN', resultKey: 'gyeokguk.YANGIN' },
    ],
    [
      '乙寅',
      { year: [8, 0], month: [8, 2], day: [1, 1], hour: [6, 4] },
      { tenGod: 'GEOB_JAE', subtype: 'WOLGEOB', resultKey: 'gyeokguk.WOLGEOB' },
    ],
    [
      '戊巳',
      { year: [0, 0], month: [5, 5], day: [4, 4], hour: [2, 4] },
      { tenGod: 'BI_GYEON', subtype: 'GEONROK', resultKey: 'gyeokguk.GEONROK' },
    ],
    [
      '己午',
      { year: [0, 0], month: [6, 6], day: [5, 5], hour: [8, 8] },
      { tenGod: 'BI_GYEON', subtype: 'GEONROK', resultKey: 'gyeokguk.GEONROK' },
    ],
  ] as const)('selects %s from a structural month-frame basis', (_label, pillarSpec, expected) => {
    expectSelected(pillarSpec, {
      ...expected,
      method: 'STRUCTURAL_MONTH_FRAME',
    });
  });

  it('keeps 戊辰 mixed month out of GEONROK unless compatibility is explicit', () => {
    const specimen: PillarSpec = {
      year: [0, 0], month: [4, 4], day: [4, 4], hour: [2, 4],
    };
    expectSelected(
      specimen,
      { tenGod: 'BI_GYEON', method: 'MAIN_EXPOSED', subtype: null, resultKey: 'gyeokguk.BI_GYEON' },
    );
    expectSelected(
      specimen,
      { tenGod: 'BI_GYEON', method: 'STRUCTURAL_MONTH_FRAME', subtype: 'GEONROK', resultKey: 'gyeokguk.GEONROK' },
      { earthMixedMonthFrame: 'geonrok_compat' },
    );
  });

  it('documents that a structural frame takes precedence over selectionRule', () => {
    const facts = expectSelected(
      { year: [0, 0], month: [5, 5], day: [4, 4], hour: [2, 4] },
      { tenGod: 'BI_GYEON', method: 'STRUCTURAL_MONTH_FRAME', subtype: 'GEONROK', resultKey: 'gyeokguk.GEONROK' },
      { selectionRule: 'monthly_main' },
    );
    expect(facts.month.gyeok.selectionRule).toBe('monthly_main');
    expect(facts.month.mainTenGod).toBe('PYEON_IN');
    expect(facts.month.gyeok.stem).toBe(4);
  });

  it('keeps 戊午 as JEONG_IN under the adopted policy', () => {
    expectSelected(
      { year: [0, 0], month: [6, 6], day: [4, 10], hour: [9, 11] },
      { tenGod: 'JEONG_IN', method: 'MAIN_FALLBACK', subtype: null, resultKey: 'gyeokguk.JEONG_IN' },
    );
  });

  it('keeps legacy output naming while retaining doctrine-compatible seongpae', () => {
    const specimen: PillarSpec = { year: [6, 0], month: [4, 2], day: [0, 6], hour: [5, 5] };
    const classic = analyze(specimen, { selectionRule: 'monthly_main' });
    const legacy = analyze(specimen, { selectionRule: 'monthly_main', bigyeopGyeok: 'legacy' });

    expect(classic.facts.month.gyeok).toMatchObject({
      tenGod: 'BI_GYEON',
      method: 'STRUCTURAL_MONTH_FRAME',
      bigyeopSubtype: 'GEONROK',
    });
    expect(legacy.facts.month.gyeok).toMatchObject({
      tenGod: 'BI_GYEON',
      method: 'STRUCTURAL_MONTH_FRAME',
      bigyeopSubtype: null,
    });
    expect(classic.result.best).toBe('gyeokguk.GEONROK');
    expect(legacy.result.best).toBe('gyeokguk.BI_GYEON');
    expect(legacy.facts.month.gyeok.seongpae).toEqual(classic.facts.month.gyeok.seongpae);
  });

  it('keeps Yangren judgment unchanged when legacy mode changes only its public name', () => {
    const specimen: PillarSpec = { year: [6, 0], month: [5, 3], day: [0, 8], hour: [4, 4] };
    const classic = analyze(specimen);
    const legacy = analyze(specimen, { bigyeopGyeok: 'legacy' });

    expect(classic.facts.month.gyeok).toMatchObject({
      tenGod: 'GEOB_JAE',
      method: 'STRUCTURAL_MONTH_FRAME',
      bigyeopSubtype: 'YANGIN',
    });
    expect(legacy.facts.month.gyeok).toMatchObject({
      tenGod: 'GEOB_JAE',
      method: 'STRUCTURAL_MONTH_FRAME',
      bigyeopSubtype: null,
    });
    expect(classic.result.best).toBe('gyeokguk.YANGIN');
    expect(legacy.result.best).toBe('gyeokguk.GEOB_JAE');
    expect(legacy.facts.month.gyeok.seongpae).toEqual(classic.facts.month.gyeok.seongpae);
  });

  it.each([
    ['fix-07', { year: [3, 9], month: [8, 2], day: [3, 7], hour: [2, 6] }],
    ['fix-11', { year: [1, 11], month: [0, 8], day: [4, 2], hour: [4, 6] }],
  ] as const)('does not re-enable an ineligible companion candidate in legacy mode for %s', (_label, specimen) => {
    const classic = analyze(specimen);
    const legacy = analyze(specimen, { bigyeopGyeok: 'legacy' });
    const eligibleSignature = (facts: typeof classic.facts) => (facts.month.gyeok.candidates ?? [])
      .filter((candidate) => candidate.eligibleForGyeokSelection !== false)
      .map((candidate) => [candidate.stem, candidate.tenGod, candidate.role, candidate.score]);

    expect(legacy.facts.month.gyeok.tenGod).toBe(classic.facts.month.gyeok.tenGod);
    expect(legacy.facts.month.gyeok.stem).toBe(classic.facts.month.gyeok.stem);
    expect(legacy.facts.month.gyeok.method).toBe(classic.facts.month.gyeok.method);
    expect(eligibleSignature(legacy.facts)).toEqual(eligibleSignature(classic.facts));
    expect(legacy.facts.month.gyeok.seongpae).toEqual(classic.facts.month.gyeok.seongpae);
    expect(legacy.result.best).toBe(classic.result.best);
  });
});

describe('monthGyeokTenGod macro structural contract', () => {
  function evaluate(tenGod: TenGod, subtype: string | null, tenGods?: TenGod[]) {
    const ruleSet = compileGyeokgukRuleSpec({
      id: 'test.structural-month-frame-macro',
      base: 'none',
      mode: 'replace',
      macros: [{ kind: 'monthGyeokTenGod', ...(tenGods ? { tenGods } : {}) }],
    });
    return evalRuleSet(ruleSet, {
      month: {
        gyeok: {
          tenGod,
          bigyeopSubtype: subtype,
          quality: { multiplier: 1 },
        },
      },
    }).scores;
  }

  it('scores only the structural subtype for consistent companion facts', () => {
    const scores = evaluate('BI_GYEON', 'GEONROK');
    expect(scores['gyeokguk.GEONROK']).toBe(1);
    expect(scores['gyeokguk.BI_GYEON']).toBeUndefined();
  });

  it('fails closed for a subtype/source-ten-god contradiction', () => {
    const scores = evaluate('PYEON_IN', 'GEONROK');
    expect(scores['gyeokguk.GEONROK']).toBeUndefined();
    expect(scores['gyeokguk.PYEON_IN']).toBeUndefined();
  });

  it('does not generate a structural subtype outside the macro ten-god subset', () => {
    const scores = evaluate('BI_GYEON', 'GEONROK', ['PYEON_IN']);
    expect(scores['gyeokguk.GEONROK']).toBeUndefined();
  });
});
