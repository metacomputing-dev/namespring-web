import { describe, it, expect } from 'vitest';
import { DaeunCalculator } from '../../../src/engine/luck/DaeunCalculator.js';
import { Cheongan, CHEONGAN_INFO, CHEONGAN_VALUES, cheonganOrdinal } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, jijiOrdinal } from '../../../src/domain/Jiji.js';
import { Eumyang } from '../../../src/domain/Eumyang.js';
import { Gender } from '../../../src/domain/Gender.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { GanjiCycle } from '../../../src/engine/GanjiCycle.js';
import type { DaeunPillar } from '../../../src/domain/DaeunInfo.js';

/**
 * V-06: Exhaustive daeun direction test covering all 20 combinations
 * of 10 heavenly stems x 2 genders.
 *
 * Ported from DaeunDirectionExhaustiveTest.kt
 *
 * Rule under test:
 *   - YANG stem + MALE  -> forward
 *   - YIN  stem + FEMALE -> forward
 *   - YIN  stem + MALE  -> reverse
 *   - YANG stem + FEMALE -> reverse
 */

// ================================================================
// Helpers
// ================================================================

function pillarSet(opts: {
  yearStem: Cheongan;
  yearBranch: Jiji;
  monthStem: Cheongan;
  monthBranch: Jiji;
  dayStem?: Cheongan;
  dayBranch?: Jiji;
  hourStem?: Cheongan;
  hourBranch?: Jiji;
}): PillarSet {
  return new PillarSet(
    new Pillar(opts.yearStem, opts.yearBranch),
    new Pillar(opts.monthStem, opts.monthBranch),
    new Pillar(opts.dayStem ?? Cheongan.GAP, opts.dayBranch ?? Jiji.JA),
    new Pillar(opts.hourStem ?? Cheongan.GAP, opts.hourBranch ?? Jiji.JA),
  );
}

function assertDaeunSequence(
  expected: [Cheongan, Jiji][],
  actual: readonly DaeunPillar[],
): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const [stem, branch] = expected[i]!;
    const dp = actual[i]!;
    expect(dp.pillar.cheongan).toBe(stem);
    expect(dp.pillar.jiji).toBe(branch);
  }
}

function assertAdjacentStepsAreUnitary(
  daeunPillars: readonly DaeunPillar[],
  forward: boolean,
): void {
  for (let i = 1; i < daeunPillars.length; i++) {
    const prev = daeunPillars[i - 1]!.pillar;
    const curr = daeunPillars[i]!.pillar;
    const stemDelta = forward
      ? (cheonganOrdinal(curr.cheongan) - cheonganOrdinal(prev.cheongan) + 10) % 10
      : (cheonganOrdinal(prev.cheongan) - cheonganOrdinal(curr.cheongan) + 10) % 10;
    const branchDelta = forward
      ? (jijiOrdinal(curr.jiji) - jijiOrdinal(prev.jiji) + 12) % 12
      : (jijiOrdinal(prev.jiji) - jijiOrdinal(curr.jiji) + 12) % 12;
    expect(stemDelta).toBe(1);
    expect(branchDelta).toBe(1);
  }
}

// ================================================================
// Part 1: Exhaustive 20-combination direction matrix
// ================================================================
describe('Part 1: Exhaustive direction matrix', () => {
  const MALE_CASES: [Cheongan, boolean][] = [
    [Cheongan.GAP, true],
    [Cheongan.EUL, false],
    [Cheongan.BYEONG, true],
    [Cheongan.JEONG, false],
    [Cheongan.MU, true],
    [Cheongan.GI, false],
    [Cheongan.GYEONG, true],
    [Cheongan.SIN, false],
    [Cheongan.IM, true],
    [Cheongan.GYE, false],
  ];

  it.each(MALE_CASES)('%s + MALE -> forward=%s', (stem, expectedForward) => {
    expect(DaeunCalculator.isForward(stem, Gender.MALE)).toBe(expectedForward);
  });

  const FEMALE_CASES: [Cheongan, boolean][] = [
    [Cheongan.GAP, false],
    [Cheongan.EUL, true],
    [Cheongan.BYEONG, false],
    [Cheongan.JEONG, true],
    [Cheongan.MU, false],
    [Cheongan.GI, true],
    [Cheongan.GYEONG, false],
    [Cheongan.SIN, true],
    [Cheongan.IM, false],
    [Cheongan.GYE, true],
  ];

  it.each(FEMALE_CASES)('%s + FEMALE -> forward=%s', (stem, expectedForward) => {
    expect(DaeunCalculator.isForward(stem, Gender.FEMALE)).toBe(expectedForward);
  });
});

// ================================================================
// Part 2: Structural invariant -- direction is XOR of polarity bits
// ================================================================
describe('Part 2: Polarity identity for all 20 combinations', () => {
  it('direction matches polarity identity for all 20 combinations', () => {
    const stems = CHEONGAN_VALUES;
    const genders = [Gender.MALE, Gender.FEMALE];

    for (const stem of stems) {
      for (const gender of genders) {
        const stemIsYang = CHEONGAN_INFO[stem].eumyang === Eumyang.YANG;
        const genderIsMale = gender === Gender.MALE;
        const expectedForward = stemIsYang === genderIsMale;
        expect(DaeunCalculator.isForward(stem, gender)).toBe(expectedForward);
      }
    }
  });
});

// ================================================================
// Part 3: Full calculate flow -- forward direction
// ================================================================
describe('Part 3: Forward integration', () => {
  it('YANG male GAP-IN forward from index 50', () => {
    const ps = pillarSet({
      yearStem: Cheongan.GAP, yearBranch: Jiji.JIN,
      monthStem: Cheongan.GAP, monthBranch: Jiji.IN,
    });
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 3);

    expect(result.isForward).toBe(true);
    expect(result.daeunPillars.length).toBe(8);

    assertDaeunSequence([
      [Cheongan.EUL, Jiji.MYO],
      [Cheongan.BYEONG, Jiji.JIN],
      [Cheongan.JEONG, Jiji.SA],
      [Cheongan.MU, Jiji.O],
      [Cheongan.GI, Jiji.MI],
      [Cheongan.GYEONG, Jiji.SIN],
      [Cheongan.SIN, Jiji.YU],
      [Cheongan.IM, Jiji.SUL],
    ], result.daeunPillars);
  });

  it('YIN female GYE-HAE forward wraps at 60', () => {
    const ps = pillarSet({
      yearStem: Cheongan.GYE, yearBranch: Jiji.HAE,
      monthStem: Cheongan.GYE, monthBranch: Jiji.HAE,
    });
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.FEMALE, 5);

    expect(result.isForward).toBe(true);

    assertDaeunSequence([
      [Cheongan.GAP, Jiji.JA],
      [Cheongan.EUL, Jiji.CHUK],
      [Cheongan.BYEONG, Jiji.IN],
      [Cheongan.JEONG, Jiji.MYO],
      [Cheongan.MU, Jiji.JIN],
      [Cheongan.GI, Jiji.SA],
      [Cheongan.GYEONG, Jiji.O],
      [Cheongan.SIN, Jiji.MI],
    ], result.daeunPillars);
  });
});

// ================================================================
// Part 4: Full calculate flow -- reverse direction
// ================================================================
describe('Part 4: Reverse integration', () => {
  it('YIN male reverse from GAP-IN (index 50)', () => {
    const ps = pillarSet({
      yearStem: Cheongan.EUL, yearBranch: Jiji.SA,
      monthStem: Cheongan.GAP, monthBranch: Jiji.IN,
    });
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 7);

    expect(result.isForward).toBe(false);
    expect(result.daeunPillars.length).toBe(8);

    assertDaeunSequence([
      [Cheongan.GYE, Jiji.CHUK],
      [Cheongan.IM, Jiji.JA],
      [Cheongan.SIN, Jiji.HAE],
      [Cheongan.GYEONG, Jiji.SUL],
      [Cheongan.GI, Jiji.YU],
      [Cheongan.MU, Jiji.SIN],
      [Cheongan.JEONG, Jiji.MI],
      [Cheongan.BYEONG, Jiji.O],
    ], result.daeunPillars);
  });

  it('YANG female reverse from EUL-CHUK wraps at 0', () => {
    const ps = pillarSet({
      yearStem: Cheongan.GAP, yearBranch: Jiji.JA,
      monthStem: Cheongan.EUL, monthBranch: Jiji.CHUK,
    });
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.FEMALE, 4);

    expect(result.isForward).toBe(false);

    assertDaeunSequence([
      [Cheongan.GAP, Jiji.JA],
      [Cheongan.GYE, Jiji.HAE],
      [Cheongan.IM, Jiji.SUL],
      [Cheongan.SIN, Jiji.YU],
      [Cheongan.GYEONG, Jiji.SIN],
      [Cheongan.GI, Jiji.MI],
      [Cheongan.MU, Jiji.O],
      [Cheongan.JEONG, Jiji.SA],
    ], result.daeunPillars);
  });
});

// ================================================================
// Part 5: Start age invariants
// ================================================================
describe('Part 5: Start age invariants', () => {
  const START_AGE_CASES: [number, number][] = [
    [1, 8],
    [2, 8],
    [3, 10],
    [5, 12],
    [10, 6],
  ];

  it.each(START_AGE_CASES)(
    'startAge=%i, count=%i: ages increment by 10, order is 1-based',
    (firstAge, count) => {
      const ps = pillarSet({
        yearStem: Cheongan.GAP, yearBranch: Jiji.JA,
        monthStem: Cheongan.GAP, monthBranch: Jiji.IN,
      });
      const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, firstAge, count);

      expect(result.daeunPillars.length).toBe(count);
      expect(result.firstDaeunStartAge).toBeGreaterThanOrEqual(1);

      for (let idx = 0; idx < result.daeunPillars.length; idx++) {
        const dp = result.daeunPillars[idx]!;
        const expectedStart = firstAge + idx * 10;
        const expectedEnd = expectedStart + 9;
        expect(dp.order).toBe(idx + 1);
        expect(dp.startAge).toBe(expectedStart);
        expect(dp.endAge).toBe(expectedEnd);
      }
    },
  );
});

// ================================================================
// Part 6: Sexagenary cycle mathematical consistency
// ================================================================
describe('Part 6: Sexagenary cycle consistency for all 60 pillars', () => {
  it('forward: all 60 month pillars produce correct daeun indices', () => {
    for (let monthIndex = 0; monthIndex < 60; monthIndex++) {
      const monthPillar = GanjiCycle.fromSexagenaryIndex(monthIndex);
      const ps = pillarSet({
        yearStem: Cheongan.GAP, yearBranch: Jiji.JA,
        monthStem: monthPillar.cheongan, monthBranch: monthPillar.jiji,
      });
      const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 1, 12);

      for (let idx = 0; idx < result.daeunPillars.length; idx++) {
        const expectedIndex = (monthIndex + (idx + 1)) % 60;
        const actualIndex = DaeunCalculator.sexagenaryIndex(result.daeunPillars[idx]!.pillar);
        expect(actualIndex).toBe(expectedIndex);
      }
    }
  });

  it('reverse: all 60 month pillars produce correct daeun indices', () => {
    for (let monthIndex = 0; monthIndex < 60; monthIndex++) {
      const monthPillar = GanjiCycle.fromSexagenaryIndex(monthIndex);
      const ps = pillarSet({
        yearStem: Cheongan.EUL, yearBranch: Jiji.CHUK,
        monthStem: monthPillar.cheongan, monthBranch: monthPillar.jiji,
      });
      const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 1, 12);

      for (let idx = 0; idx < result.daeunPillars.length; idx++) {
        const expectedIndex = ((monthIndex - (idx + 1)) % 60 + 60) % 60;
        const actualIndex = DaeunCalculator.sexagenaryIndex(result.daeunPillars[idx]!.pillar);
        expect(actualIndex).toBe(expectedIndex);
      }
    }
  });

  it('adjacent pillars differ by exactly 1 in stem and branch', () => {
    // Forward case
    const forwardPs = pillarSet({
      yearStem: Cheongan.GAP, yearBranch: Jiji.JA,
      monthStem: Cheongan.GAP, monthBranch: Jiji.IN,
    });
    const forwardResult = DaeunCalculator.calculateWithStartAge(forwardPs, Gender.MALE, 1, 12);
    assertAdjacentStepsAreUnitary(forwardResult.daeunPillars, true);

    // Reverse case
    const reversePs = pillarSet({
      yearStem: Cheongan.EUL, yearBranch: Jiji.CHUK,
      monthStem: Cheongan.GAP, monthBranch: Jiji.IN,
    });
    const reverseResult = DaeunCalculator.calculateWithStartAge(reversePs, Gender.MALE, 1, 12);
    assertAdjacentStepsAreUnitary(reverseResult.daeunPillars, false);
  });
});

// ================================================================
// Part 7: Direction for all 5 YANG-YIN ohaeng pairs
// ================================================================
describe('Part 7: Ohaeng pair direction symmetry', () => {
  const OHAENG_PAIRS: [Cheongan, Cheongan][] = [
    [Cheongan.GAP, Cheongan.EUL],
    [Cheongan.BYEONG, Cheongan.JEONG],
    [Cheongan.MU, Cheongan.GI],
    [Cheongan.GYEONG, Cheongan.SIN],
    [Cheongan.IM, Cheongan.GYE],
  ];

  it('YANG/YIN pairs produce opposite directions for same gender', () => {
    for (const [yangStem, yinStem] of OHAENG_PAIRS) {
      for (const gender of [Gender.MALE, Gender.FEMALE]) {
        const yangForward = DaeunCalculator.isForward(yangStem, gender);
        const yinForward = DaeunCalculator.isForward(yinStem, gender);
        expect(yangForward).not.toBe(yinForward);
      }
    }
  });

  it('same stem, opposite genders produce opposite directions', () => {
    for (const stem of CHEONGAN_VALUES) {
      const maleForward = DaeunCalculator.isForward(stem, Gender.MALE);
      const femaleForward = DaeunCalculator.isForward(stem, Gender.FEMALE);
      expect(maleForward).not.toBe(femaleForward);
    }
  });
});
