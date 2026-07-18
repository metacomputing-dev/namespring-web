import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import type { BranchIdx, StemIdx } from '../core/cycle.js';
import { pillar } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY } from '../core/scoring.js';
import { buildRuleFacts } from './facts.js';
import { scorePillarsForRuleFacts } from './ruleFactsScoring.js';

type Chart = {
  year: readonly [number, number];
  month: readonly [number, number];
  day: readonly [number, number];
  hour: readonly [number, number];
};

const SUPPORTIVE_CHART = {
  year: [1, 9],
  month: [3, 3],
  day: [0, 2],
  hour: [0, 0],
} as const;

const OFFICER_BIND_CHART = {
  year: [2, 0],
  month: [7, 1],
  day: [0, 2],
  hour: [4, 4],
} as const;

function factsFor(chart: Chart, strategies: Record<string, unknown>) {
  const config = normalizeConfig({ strategies });
  const pillars = {
    year: pillar(chart.year[0] as StemIdx, chart.year[1] as BranchIdx),
    month: pillar(chart.month[0] as StemIdx, chart.month[1] as BranchIdx),
    day: pillar(chart.day[0] as StemIdx, chart.day[1] as BranchIdx),
    hour: pillar(chart.hour[0] as StemIdx, chart.hour[1] as BranchIdx),
  };
  const elementDistribution = elementDistributionFromPillars(
    [pillars.year, pillars.month, pillars.day, pillars.hour],
    { hiddenStemWeights: config.weights?.hiddenStems },
  );
  const scoring = scorePillarsForRuleFacts(pillars, DEFAULT_SCORE_POLICY);
  return buildRuleFacts({ config, pillars, elementDistribution, scoring });
}

function deLingDiShiFacts(
  chart: Chart,
  overrides: {
    rootNorm?: number;
    shiNorm?: number;
    diScale?: number;
    shiScale?: number;
  } = {},
  applyOfficerBindPenalty = false,
) {
  return factsFor(chart, {
    strength: {
      model: 'deLingDiShi',
      ...overrides,
      interaction: {
        stemBind: { applyToPressure: applyOfficerBindPenalty },
      },
    },
  }).strength;
}

function zhuanwangDetails(norms: { rootNorm?: number; shiNorm?: number } = {}) {
  const facts = factsFor(SUPPORTIVE_CHART, {
    strength: { model: 'base' },
    patterns: {
      oneElement: {
        zhuanwang: { enabled: true, ...norms },
      },
    },
  });
  return (facts.patterns.elements.oneElement as any).zhuanwangDetails;
}

describe('positive norm contract', () => {
  it.each([0, -1])('fails closed for root and shi strength contributions when norm=%s', (norm) => {
    const strength = deLingDiShiFacts(SUPPORTIVE_CHART, {
      rootNorm: norm,
      shiNorm: norm,
    });
    const contributionsDisabled = deLingDiShiFacts(SUPPORTIVE_CHART, {
      diScale: 0,
      shiScale: 0,
    });
    const details = (strength.details as any).delingdiShi;

    expect(details.deDi.score).toBeGreaterThan(0);
    expect(details.deShi.score).toBeGreaterThan(0);
    expect(details.deDi.normalized).toBe(0);
    expect(details.deShi.normalized).toBe(0);
    expect(strength.support).toBeCloseTo(contributionsDisabled.support, 12);
  });

  it.each([0, -1])('fails closed for the officer-bind pressure penalty when norm=%s', (norm) => {
    const penalized = deLingDiShiFacts(
      OFFICER_BIND_CHART,
      { shiNorm: norm },
      true,
    );
    const withoutPenalty = deLingDiShiFacts(
      OFFICER_BIND_CHART,
      { shiNorm: norm },
      false,
    );
    const penalty = (penalized.details as any).delingdiShi.interaction.pressureStemBindPenalty;

    expect(penalty.score).toBeGreaterThan(0);
    expect(penalty.normalized).toBe(0);
    expect(penalty.factor).toBe(0);
    expect(penalized.pressure).toBeCloseTo(withoutPenalty.pressure, 12);
  });

  it.each([0, -1])('fails closed for zhuanwang fallback root and shi signals when norm=%s', (norm) => {
    const baseline = zhuanwangDetails();
    const details = zhuanwangDetails({ rootNorm: norm, shiNorm: norm });

    expect(baseline.signals.diNorm).toBeGreaterThan(0);
    expect(baseline.signals.shiNorm).toBeGreaterThan(0);
    expect(details.signals.diNorm).toBe(0);
    expect(details.signals.shiNorm).toBe(0);
  });

  it('preserves default behavior for explicit positive default norms', () => {
    expect(
      deLingDiShiFacts(SUPPORTIVE_CHART, { rootNorm: 2.2, shiNorm: 1.6 }),
    ).toEqual(deLingDiShiFacts(SUPPORTIVE_CHART));
    expect(
      deLingDiShiFacts(OFFICER_BIND_CHART, { rootNorm: 2.2, shiNorm: 1.6 }, true),
    ).toEqual(deLingDiShiFacts(OFFICER_BIND_CHART, {}, true));
    expect(
      zhuanwangDetails({ rootNorm: 2.2, shiNorm: 1.6 }),
    ).toEqual(zhuanwangDetails());
  });
});
