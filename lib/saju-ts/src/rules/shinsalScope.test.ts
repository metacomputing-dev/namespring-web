import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import { pillar, type PillarIdx } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY, scorePillars } from '../core/scoring.js';
import { buildRuleFacts } from './facts.js';
import { computeShinsal } from './shinsal.js';

type FourPillars = {
  year: PillarIdx;
  month: PillarIdx;
  day: PillarIdx;
  hour: PillarIdx;
};

function analyze(pillars: FourPillars, monthDeokScope?: 'dayOnly') {
  const config = normalizeConfig({
    strategies: {
      shinsal: {
        ...(monthDeokScope ? { monthDeokScope } : {}),
        conditions: { enabled: false },
      },
    },
  });
  const elementDistribution = elementDistributionFromPillars(
    [pillars.year, pillars.month, pillars.day, pillars.hour],
    { hiddenStemWeights: (config.weights as any)?.hiddenStems },
  );
  const scoring = scorePillars(pillars, DEFAULT_SCORE_POLICY);
  const facts = buildRuleFacts({ config, pillars, elementDistribution, scoring });

  return { facts, result: computeShinsal(config, facts) };
}

function findDetection(result: ReturnType<typeof computeShinsal>, name: string, targetKind: 'STEM' | 'BRANCH') {
  const detection = result.detections.find((item) => item.name === name && item.targetKind === targetKind);
  if (!detection) throw new Error(`${name}/${targetKind} detection missing`);
  return detection;
}

describe('month-based shinsal scope', () => {
  it('keeps a day-only stem scope after target fan-out normalization', () => {
    const pillars = {
      year: pillar(2, 2),
      month: pillar(6, 2),
      day: pillar(2, 2),
      hour: pillar(4, 0),
    };

    const strict = analyze(pillars, 'dayOnly');
    const allPillars = analyze(pillars);
    const strictFact = strict.facts.shinsal.catalog.monthBranchStem.WOL_DEOK_GUI_IN;

    expect(strictFact).toMatchObject({ count: 1, matchedPillars: ['day'] });
    expect(findDetection(strict.result, 'WOL_DEOK_GUI_IN', 'STEM').matchedPillars).toEqual(['day']);
    expect(strict.result.scores['shinsal.WOL_DEOK_GUI_IN']).toBe(1);
    expect(strict.result.scoresAdjusted['shinsal.WOL_DEOK_GUI_IN']).toBe(1);

    expect(findDetection(allPillars.result, 'WOL_DEOK_GUI_IN', 'STEM').matchedPillars).toEqual(['year', 'day']);
    expect(allPillars.result.scoresAdjusted['shinsal.WOL_DEOK_GUI_IN']).toBe(2);
  });

  it('keeps a day-only branch scope after target fan-out normalization', () => {
    const pillars = {
      year: pillar(0, 8),
      month: pillar(1, 3),
      day: pillar(2, 8),
      hour: pillar(3, 3),
    };

    const strict = analyze(pillars, 'dayOnly');
    const allPillars = analyze(pillars);
    const strictFact = strict.facts.shinsal.catalog.monthBranchBranch.CHEON_DEOK_GUI_IN_BRANCH;

    expect(strictFact).toMatchObject({ count: 1, matchedPillars: ['day'] });
    expect(findDetection(strict.result, 'CHEON_DEOK_GUI_IN', 'BRANCH').matchedPillars).toEqual(['day']);
    expect(strict.result.scores['shinsal.CHEON_DEOK_GUI_IN']).toBe(1);
    expect(strict.result.scoresAdjusted['shinsal.CHEON_DEOK_GUI_IN']).toBe(1);

    expect(findDetection(allPillars.result, 'CHEON_DEOK_GUI_IN', 'BRANCH').matchedPillars).toEqual(['year', 'day']);
    expect(allPillars.result.scoresAdjusted['shinsal.CHEON_DEOK_GUI_IN']).toBe(2);
  });

  it('keeps target-specific seats when a catalog rule fans out multiple stems', () => {
    const { result } = analyze({
      year: pillar(2, 2),
      month: pillar(6, 2),
      day: pillar(3, 3),
      hour: pillar(6, 0),
    });

    const hits = result.detections
      .filter((item) => item.name === 'DEOK_SU_GUI_IN' && item.targetKind === 'STEM')
      .map((item) => ({ targetStem: item.targetStem, matchedPillars: item.matchedPillars }));

    expect(hits).toEqual([
      { targetStem: 2, matchedPillars: ['year'] },
      { targetStem: 3, matchedPillars: ['day'] },
    ]);
    expect(result.scores['shinsal.DEOK_SU_GUI_IN']).toBe(2);
    expect(result.scoresAdjusted['shinsal.DEOK_SU_GUI_IN']).toBe(2);
  });

  it('does not treat per-rule gongmang seats as a pillar scope', () => {
    const { result } = analyze({
      year: pillar(2, 10),
      month: pillar(1, 1),
      day: pillar(0, 0),
      hour: pillar(4, 10),
    });

    const hits = result.detections
      .filter((item) => item.name === 'GONGMANG' && item.targetKind === 'BRANCH');

    expect(hits).toHaveLength(2);
    for (const hit of hits) {
      expect(hit.targetBranch).toBe(10);
      expect(hit.matchedPillars).toEqual(['year', 'hour']);
    }
    expect(result.scores['shinsal.GONGMANG']).toBe(2);
    expect(result.scoresAdjusted['shinsal.GONGMANG']).toBe(2);
  });
});
