import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import type { BranchIdx, StemIdx } from '../core/cycle.js';
import { pillar } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY, scorePillars } from '../core/scoring.js';
import { buildRuleFacts } from './facts.js';

const CHART = {
  year: [8, 0],
  month: [0, 2],
  day: [0, 3],
  hour: [8, 11],
} as const;

function strengthOf(strength: Record<string, unknown> = {}) {
  const config = normalizeConfig({
    strategies: {
      strength: {
        model: 'deLingDiShi',
        rootNorm: 10,
        interaction: { enabled: false },
        ...strength,
      },
    },
  });
  const pillars = {
    year: pillar(...(CHART.year as [StemIdx, BranchIdx])),
    month: pillar(...(CHART.month as [StemIdx, BranchIdx])),
    day: pillar(...(CHART.day as [StemIdx, BranchIdx])),
    hour: pillar(...(CHART.hour as [StemIdx, BranchIdx])),
  };
  const elementDistribution = elementDistributionFromPillars(
    [pillars.year, pillars.month, pillars.day, pillars.hour],
    { hiddenStemWeights: config.weights?.hiddenStems },
  );
  const scoring = scorePillars(pillars, DEFAULT_SCORE_POLICY);
  return buildRuleFacts({ config, pillars, elementDistribution, scoring }).strength;
}

function deDiOf(strength: ReturnType<typeof strengthOf>) {
  return strength.details?.delingdiShi?.deDi;
}

describe('life-stage root multipliers for deDi', () => {
  it('stays off by default and preserves the base deDi score', () => {
    const base = strengthOf();
    const explicitOff = strengthOf({ lifeStageRoot: { enabled: false } });

    expect(deDiOf(base)?.lifeStageRoot).toBeUndefined();
    expect(deDiOf(explicitOff)?.lifeStageRoot).toBeUndefined();
    expect(explicitOff.index).toBe(base.index);
    expect(deDiOf(explicitOff)?.score).toBe(deDiOf(base)?.score);
  });

  it('applies opt-in stage multipliers to branch root strength and records evidence', () => {
    const base = strengthOf();
    const weighted = strengthOf({
      lifeStageRoot: {
        enabled: true,
        multipliers: {
          MOK_YOK: 0.5,
          GEON_ROK: 2,
          JE_WANG: 3,
          JANG_SAENG: 4,
        },
      },
    });

    expect(weighted.index).toBeGreaterThan(base.index);
    expect(deDiOf(weighted)?.score).toBeGreaterThan(deDiOf(base)?.score ?? 0);
    expect(deDiOf(weighted)?.lifeStageRoot?.branches).toEqual([
      { position: 'year', branch: 0, stage: 'MOK_YOK', multiplier: 0.5 },
      { position: 'month', branch: 2, stage: 'GEON_ROK', multiplier: 2 },
      { position: 'day', branch: 3, stage: 'JE_WANG', multiplier: 3 },
      { position: 'hour', branch: 11, stage: 'JANG_SAENG', multiplier: 4 },
    ]);
  });

  it('falls back for invalid custom multipliers without poisoning the score', () => {
    const weighted = strengthOf({
      lifeStageRoot: {
        enabled: true,
        multipliers: {
          GEON_ROK: Number.NaN,
          JE_WANG: -2,
        },
      },
    });

    const meta = deDiOf(weighted)?.lifeStageRoot;
    expect(meta?.multipliers.GEON_ROK).toBeCloseTo(1.22, 12);
    expect(meta?.multipliers.JE_WANG).toBeCloseTo(1.28, 12);
    expect(Number.isFinite(deDiOf(weighted)?.score)).toBe(true);
  });
});