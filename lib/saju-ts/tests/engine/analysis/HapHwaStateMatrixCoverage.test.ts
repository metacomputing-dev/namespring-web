import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import { HapState } from '../../../src/domain/Relations.js';
import { HapHwaEvaluator } from '../../../src/engine/analysis/HapHwaEvaluator.js';

/**
 * Ported from HapHwaStateMatrixCoverageTest.kt
 *
 * Verifies that all five stem pairs cover the three states matrix:
 * HAPWHA, HAPGEO, NOT_ESTABLISHED.
 */

interface HapPairCase {
  name: string;
  stem1: Cheongan;
  stem2: Cheongan;
  result: Ohaeng;
  supportMonth: Jiji;
  nonSupportMonth: Jiji;
  safeDayStem: Cheongan;
  safeHourStem: Cheongan;
}

const pairs: HapPairCase[] = [
  {
    name: '갑기합토',
    stem1: Cheongan.GAP, stem2: Cheongan.GI,
    result: Ohaeng.EARTH,
    supportMonth: Jiji.JIN, nonSupportMonth: Jiji.IN,
    safeDayStem: Cheongan.BYEONG, safeHourStem: Cheongan.JEONG,
  },
  {
    name: '을경합금',
    stem1: Cheongan.EUL, stem2: Cheongan.GYEONG,
    result: Ohaeng.METAL,
    supportMonth: Jiji.SIN, nonSupportMonth: Jiji.IN,
    safeDayStem: Cheongan.GAP, safeHourStem: Cheongan.EUL,
  },
  {
    name: '병신합수',
    stem1: Cheongan.BYEONG, stem2: Cheongan.SIN,
    result: Ohaeng.WATER,
    supportMonth: Jiji.HAE, nonSupportMonth: Jiji.IN,
    safeDayStem: Cheongan.GAP, safeHourStem: Cheongan.EUL,
  },
  {
    name: '정임합목',
    stem1: Cheongan.JEONG, stem2: Cheongan.IM,
    result: Ohaeng.WOOD,
    supportMonth: Jiji.IN, nonSupportMonth: Jiji.SA,
    safeDayStem: Cheongan.BYEONG, safeHourStem: Cheongan.GI,
  },
  {
    name: '무계합화',
    stem1: Cheongan.MU, stem2: Cheongan.GYE,
    result: Ohaeng.FIRE,
    supportMonth: Jiji.SA, nonSupportMonth: Jiji.IN,
    safeDayStem: Cheongan.GYEONG, safeHourStem: Cheongan.SIN,
  },
];

function pillarsFor(
  c: HapPairCase,
  monthBranch: Jiji,
  firstPos: PillarPosition,
  secondPos: PillarPosition,
): PillarSet {
  let yearStem = c.safeDayStem;
  let monthStem = c.safeHourStem;
  let dayStem = c.safeDayStem;
  let hourStem = c.safeHourStem;

  const setStem = (pos: PillarPosition, stem: Cheongan) => {
    switch (pos) {
      case PillarPosition.YEAR: yearStem = stem; break;
      case PillarPosition.MONTH: monthStem = stem; break;
      case PillarPosition.DAY: dayStem = stem; break;
      case PillarPosition.HOUR: hourStem = stem; break;
    }
  };

  setStem(firstPos, c.stem1);
  setStem(secondPos, c.stem2);

  return new PillarSet(
    new Pillar(yearStem, Jiji.JA),
    new Pillar(monthStem, monthBranch),
    new Pillar(dayStem, Jiji.MYO),
    new Pillar(hourStem, Jiji.YU),
  );
}

describe('HapHwaStateMatrixCoverage', () => {
  it('all five stem pairs cover three states matrix', () => {
    for (const c of pairs) {
      // HAPWHA: adjacent + supporting month
      const hapWhaEval = HapHwaEvaluator.evaluatePair(
        c.stem1, PillarPosition.YEAR,
        c.stem2, PillarPosition.MONTH,
        c.supportMonth,
        pillarsFor(c, c.supportMonth, PillarPosition.YEAR, PillarPosition.MONTH),
      );
      expect(hapWhaEval, `${c.name} should be evaluable`).not.toBeNull();
      expect(hapWhaEval!.resultOhaeng).toBe(c.result);
      expect(hapWhaEval!.state).toBe(HapState.HAPWHA);

      // HAPGEO: adjacent + non-supporting month
      const hapGeoEval = HapHwaEvaluator.evaluatePair(
        c.stem1, PillarPosition.YEAR,
        c.stem2, PillarPosition.MONTH,
        c.nonSupportMonth,
        pillarsFor(c, c.nonSupportMonth, PillarPosition.YEAR, PillarPosition.MONTH),
      );
      expect(hapGeoEval, `${c.name} should be evaluable in non-supporting month`).not.toBeNull();
      expect(hapGeoEval!.state).toBe(HapState.HAPGEO);

      // NOT_ESTABLISHED: non-adjacent (YEAR-HOUR)
      const notEstablishedEval = HapHwaEvaluator.evaluatePair(
        c.stem1, PillarPosition.YEAR,
        c.stem2, PillarPosition.HOUR,
        c.supportMonth,
        pillarsFor(c, c.supportMonth, PillarPosition.YEAR, PillarPosition.HOUR),
      );
      expect(notEstablishedEval, `${c.name} should be evaluable for non-adjacent positions`).not.toBeNull();
      expect(notEstablishedEval!.state).toBe(HapState.NOT_ESTABLISHED);
      expect(
        notEstablishedEval!.conditionsFailed.some(f => f.includes('인접')),
      ).toBe(true);
    }
  });
});
