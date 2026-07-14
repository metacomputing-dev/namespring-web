import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import { pillar, type BranchIdx, type StemIdx } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY, scorePillars } from '../core/scoring.js';
import { buildRuleFacts } from './facts.js';
import { computeGyeokguk } from './gyeokguk.js';
import { classifyStructuralMonthFrame } from './gyeokgukMonthFrame.js';
import type { TenGod } from '../core/tenGod.js';
import { evalRuleSet } from './dsl.js';
import { compileGyeokgukRuleSpec } from './spec/compileGyeokgukSpec.js';

type PillarPair = [number, number];
type PillarSpec = {
  year: PillarPair;
  month: PillarPair;
  day: PillarPair;
  hour: PillarPair;
};

function analyze(pillarSpec: PillarSpec, gyeokgukStrategies: Record<string, unknown> = {}) {
  const config = normalizeConfig({ strategies: { gyeokguk: gyeokgukStrategies } });
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
  const scoring = scorePillars(pillars, DEFAULT_SCORE_POLICY);
  const facts = buildRuleFacts({ config, pillars, elementDistribution, scoring });
  const result = computeGyeokguk(config, facts);
  return { facts, result };
}

describe('structural month-frame classifier', () => {
  it.each([
    [0, 2], [1, 3], [2, 5], [3, 6], [4, 5],
    [5, 6], [6, 8], [7, 9], [8, 11], [9, 0],
  ] as Array<[StemIdx, BranchIdx]>)('classifies stem %s at branch %s as GEONROK', (dayStem, monthBranch) => {
    expect(classifyStructuralMonthFrame({
      dayStem,
      monthBranch,
      monthMainStem: 2,
      monthMainTenGod: 'PYEON_IN',
    })?.subtype).toBe('GEONROK');
  });

  it('does not infer a frame from a residual companion stem', () => {
    expect(classifyStructuralMonthFrame({
      dayStem: 0,
      monthBranch: 11,
      monthMainStem: 8,
      monthMainTenGod: 'PYEON_IN',
    })).toBeNull();
  });
});

describe('structural month-frame integration', () => {
  it('does not count the day master itself as transparent in a 甲 day / 亥 month chart', () => {
    const { facts, result } = analyze({
      year: [6, 0], month: [3, 11], day: [0, 0], hour: [6, 6],
    });

    expect(facts.month.hiddenStems.find((candidate) => candidate.stem === 0)).toMatchObject({
      tenGod: 'BI_GYEON',
      visibleInChart: false,
    });
    expect(facts.month.gyeok).toMatchObject({
      tenGod: 'PYEON_IN',
      method: 'MAIN_FALLBACK',
      bigyeopSubtype: null,
    });
    expect(result.best).toBe('gyeokguk.PYEON_IN');
  });

  it('does not count the day master itself as transparent in a 丙 day / 寅 month chart', () => {
    const { facts, result } = analyze({
      year: [7, 1], month: [6, 2], day: [2, 10], hour: [9, 5],
    });

    expect(facts.month.hiddenStems.find((candidate) => candidate.stem === 2)).toMatchObject({
      tenGod: 'BI_GYEON',
      visibleInChart: false,
    });
    expect(facts.month.gyeok).toMatchObject({
      tenGod: 'PYEON_IN', method: 'MAIN_FALLBACK', bigyeopSubtype: null,
    });
    expect(result.best).toBe('gyeokguk.PYEON_IN');
  });

  it('excludes an exposed residual companion from ordinary month-gyeok selection', () => {
    const { facts, result } = analyze({
      year: [3, 9], month: [8, 2], day: [3, 7], hour: [2, 6],
    });

    expect(facts.month.gyeok.tenGod).toBe('JEONG_IN');
    expect(facts.month.gyeok.bigyeopSubtype).toBeNull();
    const candidates = facts.month.gyeok.candidates ?? [];
    const excluded = candidates.filter((candidate) => candidate.eligibleForGyeokSelection === false);
    const eligible = candidates.filter((candidate) => candidate.eligibleForGyeokSelection !== false);
    expect(excluded.length).toBeGreaterThan(0);
    expect(excluded.every((candidate) =>
      candidate.selectionExclusionReason === 'COMPANION_REQUIRES_STRUCTURAL_FRAME')).toBe(true);

    const candidateGap = (rows: typeof candidates): number => {
      const top = rows[0]?.score ?? 0;
      const second = rows[1]?.score ?? 0;
      return top > 0 ? Math.max(0, Math.min(1, (top - second) / top)) : 0;
    };
    expect(facts.month.gyeok.quality.details.gap).toBeCloseTo(candidateGap(eligible), 12);
    expect(facts.month.gyeok.quality.details.gap).not.toBeCloseTo(candidateGap(candidates), 12);
    expect(result.best).toBe('gyeokguk.JEONG_IN');
  });

  it('selects a canonical 甲寅 structural frame independently of transparency', () => {
    const { facts, result } = analyze({
      year: [6, 0], month: [4, 2], day: [0, 6], hour: [5, 5],
    });

    expect(facts.month.gyeok).toMatchObject({
      tenGod: 'BI_GYEON',
      method: 'STRUCTURAL_MONTH_FRAME',
      bigyeopSubtype: 'GEONROK',
    });
    expect(result.best).toBe('gyeokguk.GEONROK');
  });

  it.each([
    [
      'YANGIN',
      { year: [6, 0], month: [5, 3], day: [0, 8], hour: [4, 4] },
      'GEOB_JAE',
    ],
    [
      'WOLGEOB',
      { year: [8, 0], month: [8, 2], day: [1, 1], hour: [6, 4] },
      'GEOB_JAE',
    ],
  ] as const)('selects a canonical %s structural frame', (subtype, specimen, tenGod) => {
    const { facts, result } = analyze(specimen as PillarSpec);
    expect(facts.month.gyeok).toMatchObject({
      tenGod,
      method: 'STRUCTURAL_MONTH_FRAME',
      bigyeopSubtype: subtype,
    });
    expect(result.best).toBe(`gyeokguk.${subtype}`);
    const publicEligible = (facts.month.gyeok.candidates ?? [])
      .filter((candidate) => candidate.eligibleForGyeokSelection !== false);
    expect(publicEligible.filter((candidate) => candidate.tenGod === tenGod)).toHaveLength(1);
  });

  it('lets a structural frame take precedence over monthly_main selection', () => {
    const { facts, result } = analyze(
      { year: [0, 0], month: [5, 5], day: [4, 4], hour: [2, 4] },
      { selectionRule: 'monthly_main' },
    );

    expect(facts.month.mainTenGod).toBe('PYEON_IN');
    expect(facts.month.gyeok).toMatchObject({
      tenGod: 'BI_GYEON',
      method: 'STRUCTURAL_MONTH_FRAME',
      bigyeopSubtype: 'GEONROK',
    });
    expect(result.best).toBe('gyeokguk.GEONROK');
  });

  it('keeps legacy mode as a naming-only compatibility option', () => {
    const specimen: PillarSpec = {
      year: [6, 0], month: [4, 2], day: [0, 6], hour: [5, 5],
    };
    const classic = analyze(specimen);
    const legacy = analyze(specimen, { bigyeopGyeok: 'legacy' });

    expect(classic.facts.month.gyeok.method).toBe('STRUCTURAL_MONTH_FRAME');
    expect(legacy.facts.month.gyeok).toMatchObject({
      tenGod: 'BI_GYEON',
      method: 'STRUCTURAL_MONTH_FRAME',
      bigyeopSubtype: null,
    });
    expect(classic.result.best).toBe('gyeokguk.GEONROK');
    expect(legacy.result.best).toBe('gyeokguk.BI_GYEON');
  });

  it('does not re-enable a residual companion candidate in legacy mode', () => {
    const specimen: PillarSpec = {
      year: [3, 9], month: [8, 2], day: [3, 7], hour: [2, 6],
    };
    const classic = analyze(specimen);
    const legacy = analyze(specimen, { bigyeopGyeok: 'legacy' });
    const eligibleSignature = (facts: typeof classic.facts) => (facts.month.gyeok.candidates ?? [])
      .filter((candidate) => candidate.eligibleForGyeokSelection !== false)
      .map((candidate) => [candidate.stem, candidate.tenGod, candidate.role, candidate.score]);

    expect(legacy.facts.month.gyeok.tenGod).toBe(classic.facts.month.gyeok.tenGod);
    expect(legacy.facts.month.gyeok.stem).toBe(classic.facts.month.gyeok.stem);
    expect(legacy.facts.month.gyeok.method).toBe(classic.facts.month.gyeok.method);
    expect(eligibleSignature(legacy.facts)).toEqual(eligibleSignature(classic.facts));
    expect(legacy.result.best).toBe(classic.result.best);
  });
});

describe('monthGyeokTenGod macro structural contract', () => {
  function evaluate(
    tenGod: TenGod,
    subtype: string | null,
    options: { tenGods?: TenGod[]; bonus?: number; useQualityMultiplier?: boolean } = {},
  ) {
    const ruleSet = compileGyeokgukRuleSpec({
      id: 'test.structural-month-frame-macro',
      base: 'none',
      mode: 'replace',
      macros: [{
        kind: 'monthGyeokTenGod',
        ...(options.tenGods ? { tenGods: options.tenGods } : {}),
        ...(options.bonus == null ? {} : { bonus: options.bonus }),
        ...(options.useQualityMultiplier == null
          ? {}
          : { useQualityMultiplier: options.useQualityMultiplier }),
      }],
    });
    return evalRuleSet(ruleSet, {
      month: {
        gyeok: {
          tenGod,
          bigyeopSubtype: subtype,
          quality: { multiplier: 0.4 },
        },
      },
    }).scores;
  }

  it('scores only the structural subtype for a consistent GEONROK frame', () => {
    const scores = evaluate('BI_GYEON', 'GEONROK');
    expect(scores['gyeokguk.GEONROK']).toBe(1);
    expect(scores['gyeokguk.BI_GYEON']).toBeUndefined();
  });

  it.each(['YANGIN', 'WOLGEOB'] as const)('maps GEOB_JAE to %s without a duplicate key', (subtype) => {
    const scores = evaluate('GEOB_JAE', subtype);
    expect(scores['gyeokguk.' + subtype]).toBe(1);
    expect(scores['gyeokguk.GEOB_JAE']).toBeUndefined();
  });

  it('fails closed for a subtype and source-ten-god contradiction', () => {
    expect(evaluate('PYEON_IN', 'GEONROK')).toEqual({});
  });

  it('keeps the ordinary key when legacy naming omits the subtype', () => {
    expect(evaluate('BI_GYEON', null)['gyeokguk.BI_GYEON']).toBe(1);
  });

  it('honours the macro whitelist and quality multiplier for structural keys', () => {
    expect(evaluate('BI_GYEON', 'GEONROK', { tenGods: ['PYEON_IN'] })).toEqual({});
    expect(evaluate('BI_GYEON', 'GEONROK', {
      bonus: 2,
      useQualityMultiplier: true,
    })['gyeokguk.GEONROK']).toBeCloseTo(0.8, 12);
  });
});
