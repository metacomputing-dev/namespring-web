import { describe, it, expect } from 'vitest';
import { DaeunCalculator } from '../../../src/engine/luck/DaeunCalculator.js';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Gender } from '../../../src/domain/Gender.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { DaeunBoundaryMode, type DaeunPillar } from '../../../src/domain/DaeunInfo.js';
import { GanjiCycle } from '../../../src/engine/GanjiCycle.js';

/**
 * Edge-case tests for DaeunCalculator covering:
 *
 * 1. APPROXIMATE_DAY6 fallback mode
 * 2. Start age extreme edge cases
 * 3. Pillar sequence integrity at sexagenary cycle boundaries
 *
 * Ported from DaeunBoundaryEdgeCaseTest.kt (8th audit H-02)
 */

// ================================================================
// Helpers
// ================================================================

function pillars(opts?: {
  yearStem?: Cheongan;
  yearBranch?: Jiji;
  monthStem?: Cheongan;
  monthBranch?: Jiji;
  dayStem?: Cheongan;
  dayBranch?: Jiji;
  hourStem?: Cheongan;
  hourBranch?: Jiji;
}): PillarSet {
  return new PillarSet(
    new Pillar(opts?.yearStem ?? Cheongan.GAP, opts?.yearBranch ?? Jiji.JA),
    new Pillar(opts?.monthStem ?? Cheongan.GAP, opts?.monthBranch ?? Jiji.IN),
    new Pillar(opts?.dayStem ?? Cheongan.BYEONG, opts?.dayBranch ?? Jiji.O),
    new Pillar(opts?.hourStem ?? Cheongan.MU, opts?.hourBranch ?? Jiji.JA),
  );
}

function assertPillarEquals(
  expectedStem: Cheongan,
  expectedBranch: Jiji,
  actual: DaeunPillar,
  message: string = '',
): void {
  expect(actual.pillar.cheongan, `Stem mismatch at order ${actual.order}. ${message}`).toBe(expectedStem);
  expect(actual.pillar.jiji, `Branch mismatch at order ${actual.order}. ${message}`).toBe(expectedBranch);
}

// =====================================================================
// Part 1: APPROXIMATE_DAY6 Fallback Mode
// =====================================================================

describe('APPROXIMATE_DAY6 Fallback', () => {
  it('year 2000 uses EXACT_TABLE', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculate(ps, Gender.MALE, 2000, 5, 15, 9, 0);
    expect(result.boundaryMode).toBe(DaeunBoundaryMode.EXACT_TABLE);
    expect(result.warnings.length).toBe(0);
  });

  it('year 1850 uses non-EXACT_TABLE mode', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculate(ps, Gender.MALE, 1850, 7, 20, 14, 0);
    expect(result.boundaryMode).not.toBe(DaeunBoundaryMode.EXACT_TABLE);
  });

  it('out-of-table year produces warnings', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculate(ps, Gender.MALE, 1850, 7, 20, 14, 0);
    expect(result.warnings.length).toBeGreaterThan(0);
    const allWarnings = result.warnings.join(' ');
    expect(
      allWarnings.includes('approximate') ||
      allWarnings.includes('VSOP') ||
      allWarnings.includes('outside') ||
      allWarnings.includes('fallback'),
    ).toBe(true);
  });

  it('out-of-table year still produces valid result', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculate(ps, Gender.MALE, 1850, 3, 15, 8, 0);
    expect(result.daeunPillars.length).toBeGreaterThan(0);
    expect(result.firstDaeunStartAge).toBeGreaterThanOrEqual(1);
  });

  it('approximate mode produces structurally valid pillars', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculate(ps, Gender.MALE, 1800, 8, 10, 6, 0, 8);
    expect(result.daeunPillars.length).toBe(8);

    for (const dp of result.daeunPillars) {
      const idx = DaeunCalculator.sexagenaryIndex(dp.pillar);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(59);
    }
  });

  it('approximate and exact share pillar sequence logic', () => {
    const ps = pillars();
    const exactResult = DaeunCalculator.calculate(ps, Gender.MALE, 2024, 3, 1, 0, 0);
    const otherResult = DaeunCalculator.calculate(ps, Gender.MALE, 1800, 3, 1, 0, 0);

    expect(exactResult.daeunPillars.length).toBe(otherResult.daeunPillars.length);
    for (let i = 0; i < exactResult.daeunPillars.length; i++) {
      expect(otherResult.daeunPillars[i]!.pillar.cheongan).toBe(
        exactResult.daeunPillars[i]!.pillar.cheongan,
      );
      expect(otherResult.daeunPillars[i]!.pillar.jiji).toBe(
        exactResult.daeunPillars[i]!.pillar.jiji,
      );
    }
  });
});

// =====================================================================
// Part 2: Start Age Extreme Edge Cases
// =====================================================================

describe('Start age extreme edge cases', () => {
  it('birth one minute before jeol yields minimum start age', () => {
    // Birth very close to ipchun boundary (2024-02-04 ~17:27 KST)
    const startAge = DaeunCalculator.calculateStartAge(2024, 2, 4, 17, 26, true);
    expect(startAge).toBe(1);
  });

  it('birth at exact jeol boundary clamped to at least 1', () => {
    const startAge = DaeunCalculator.calculateStartAge(2024, 2, 4, 17, 27, true);
    expect(startAge).toBeGreaterThanOrEqual(1);
  });

  it('birth far from boundary yields larger start age', () => {
    // Birth just after ipchun (Feb 5), next boundary is gyeongchip (Mar 5) ~29 days away
    const startAge = DaeunCalculator.calculateStartAge(2024, 2, 5, 0, 0, true);
    expect(startAge).toBeGreaterThanOrEqual(7);
    expect(startAge).toBeLessThanOrEqual(10);
  });

  it('start age and months match minute precision', () => {
    const ps = pillars();
    // Birth: 2024-03-01 00:00, next jeol (gyeongchip): 2024-03-05 11:23
    // Minutes: 4*1440 + 11*60 + 23 = 6443 -> 17 months -> 1y 5m
    const result = DaeunCalculator.calculate(ps, Gender.MALE, 2024, 3, 1, 0, 0);
    expect(result.firstDaeunStartAge).toBe(1);
    expect(result.firstDaeunStartMonths).toBe(5);
  });

  it('start months never exceeds eleven', () => {
    const birthDates: [number, number, number, number, number][] = [
      [2024, 1, 15, 8, 0],
      [2024, 4, 20, 14, 30],
      [2024, 7, 1, 0, 0],
      [2024, 9, 10, 23, 59],
      [2024, 11, 25, 6, 15],
    ];
    const ps = pillars();

    for (const [y, m, d, h, mi] of birthDates) {
      const result = DaeunCalculator.calculate(ps, Gender.MALE, y, m, d, h, mi);
      expect(result.firstDaeunStartMonths).toBeGreaterThanOrEqual(0);
      expect(result.firstDaeunStartMonths).toBeLessThanOrEqual(11);
    }
  });

  it('sub-year distance yields age 1 with zero months', () => {
    const ps = pillars();
    // Birth very close to the next jeol boundary
    const result = DaeunCalculator.calculate(ps, Gender.MALE, 2024, 2, 3, 0, 0);
    expect(result.firstDaeunStartAge).toBe(1);
    expect(result.firstDaeunStartMonths).toBe(0);
  });

  it('birth at late night produces valid start age', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculate(ps, Gender.MALE, 2024, 6, 15, 23, 59);
    expect(result.firstDaeunStartAge).toBeGreaterThanOrEqual(1);
    expect(result.firstDaeunStartMonths).toBeGreaterThanOrEqual(0);
    expect(result.firstDaeunStartMonths).toBeLessThanOrEqual(11);
  });

  it('forward and reverse yield different start ages', () => {
    const forward = DaeunCalculator.calculateStartAge(2024, 5, 15, 12, 0, true);
    const reverse = DaeunCalculator.calculateStartAge(2024, 5, 15, 12, 0, false);
    // Unless exactly at midpoint, they should differ
    expect(
      forward !== reverse || (forward === 1 && reverse === 1),
    ).toBe(true);
    // Their sum should approximate one jeol interval (~10 daeun years)
    const sum = forward + reverse;
    expect(sum).toBeGreaterThanOrEqual(7);
    expect(sum).toBeLessThanOrEqual(13);
  });
});

// =====================================================================
// Part 3: Pillar Sequence Integrity at Boundaries
// =====================================================================

describe('Pillar sequence integrity', () => {
  it('forward from index 0 starts at index 1', () => {
    const monthPillar = new Pillar(Cheongan.GAP, Jiji.JA);
    expect(DaeunCalculator.sexagenaryIndex(monthPillar)).toBe(0);

    const ps = pillars({ monthStem: Cheongan.GAP, monthBranch: Jiji.JA });
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 3);

    expect(result.isForward).toBe(true);
    assertPillarEquals(Cheongan.EUL, Jiji.CHUK, result.daeunPillars[0]!,
      'Forward from index 0 should start at index 1 (EUL-CHUK)');
  });

  it('forward from index 59 wraps to index 0', () => {
    expect(DaeunCalculator.sexagenaryIndex(new Pillar(Cheongan.GYE, Jiji.HAE))).toBe(59);

    const ps = pillars({ monthStem: Cheongan.GYE, monthBranch: Jiji.HAE });
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 5);

    expect(result.isForward).toBe(true);
    assertPillarEquals(Cheongan.GAP, Jiji.JA, result.daeunPillars[0]!,
      'Forward from 59 wraps to 0 (GAP-JA)');
    assertPillarEquals(Cheongan.EUL, Jiji.CHUK, result.daeunPillars[1]!,
      'Second daeun from 59 forward is index 1 (EUL-CHUK)');
  });

  it('reverse from index 0 wraps to index 59', () => {
    const ps = pillars({
      yearStem: Cheongan.EUL,
      yearBranch: Jiji.CHUK,
      monthStem: Cheongan.GAP,
      monthBranch: Jiji.JA,
    });
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 4);

    expect(result.isForward).toBe(false);
    assertPillarEquals(Cheongan.GYE, Jiji.HAE, result.daeunPillars[0]!,
      'Reverse from 0 wraps to 59 (GYE-HAE)');
    assertPillarEquals(Cheongan.IM, Jiji.SUL, result.daeunPillars[1]!,
      'Second daeun from 0 reverse is 58 (IM-SUL)');
  });

  it('daeun ages are monotonically increasing by ten', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 3);

    expect(result.daeunPillars.length).toBe(8);
    for (let i = 0; i < result.daeunPillars.length - 1; i++) {
      const current = result.daeunPillars[i]!;
      const next = result.daeunPillars[i + 1]!;
      expect(next.startAge).toBe(current.startAge + 10);
    }
  });

  it('endAge is startAge plus nine', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.FEMALE, 7);

    for (const dp of result.daeunPillars) {
      expect(dp.endAge).toBe(dp.startAge + 9);
    }
  });

  it('order field is one-based', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 2, 10);

    expect(result.daeunPillars.length).toBe(10);
    for (let i = 0; i < result.daeunPillars.length; i++) {
      expect(result.daeunPillars[i]!.order).toBe(i + 1);
    }
  });

  it('forward sequence has consecutive indices', () => {
    const monthPillar = new Pillar(Cheongan.GAP, Jiji.O); // index 30
    expect(DaeunCalculator.sexagenaryIndex(monthPillar)).toBe(30);

    const ps = pillars({ monthStem: Cheongan.GAP, monthBranch: Jiji.O });
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 5);

    expect(result.isForward).toBe(true);
    for (let i = 0; i < result.daeunPillars.length; i++) {
      const expectedIndex = (30 + i + 1) % 60;
      const actualIndex = DaeunCalculator.sexagenaryIndex(result.daeunPillars[i]!.pillar);
      expect(actualIndex).toBe(expectedIndex);
    }
  });

  it('reverse sequence has decreasing indices', () => {
    const ps = pillars({
      yearStem: Cheongan.EUL,
      yearBranch: Jiji.CHUK,
      monthStem: Cheongan.GAP,
      monthBranch: Jiji.O,
    });
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 5);

    expect(result.isForward).toBe(false);
    for (let i = 0; i < result.daeunPillars.length; i++) {
      const expectedIndex = ((30 - i - 1) % 60 + 60) % 60;
      const actualIndex = DaeunCalculator.sexagenaryIndex(result.daeunPillars[i]!.pillar);
      expect(actualIndex).toBe(expectedIndex);
    }
  });

  it('sixty forward pillars cover full cycle', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 1, 60);

    expect(result.daeunPillars.length).toBe(60);
    const indices = result.daeunPillars.map(dp => DaeunCalculator.sexagenaryIndex(dp.pillar));
    const distinctIndices = new Set(indices);
    expect(distinctIndices.size).toBe(60);
  });

  it('reverse wraps multiple times correctly', () => {
    // Month pillar: BYEONG-IN (index 2)
    expect(DaeunCalculator.sexagenaryIndex(new Pillar(Cheongan.BYEONG, Jiji.IN))).toBe(2);

    const ps = pillars({
      yearStem: Cheongan.GI,
      yearBranch: Jiji.SA,
      monthStem: Cheongan.BYEONG,
      monthBranch: Jiji.IN,
    });
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 4, 5);

    expect(result.isForward).toBe(false);
    const expectedIndices = [1, 0, 59, 58, 57];
    for (let i = 0; i < result.daeunPillars.length; i++) {
      const actualIndex = DaeunCalculator.sexagenaryIndex(result.daeunPillars[i]!.pillar);
      expect(actualIndex).toBe(expectedIndices[i]);
    }
  });

  it('all pillars round-trip through sexagenary index', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculateWithStartAge(ps, Gender.MALE, 1, 30);

    for (const dp of result.daeunPillars) {
      const idx = DaeunCalculator.sexagenaryIndex(dp.pillar);
      const roundTripped = GanjiCycle.fromSexagenaryIndex(idx);
      expect(roundTripped.cheongan).toBe(dp.pillar.cheongan);
      expect(roundTripped.jiji).toBe(dp.pillar.jiji);
    }
  });
});

// =====================================================================
// Part 4: Integration -- full calculate() with boundary edge dates
// =====================================================================

describe('Integration boundary dates', () => {
  it('birth on Ipchun day produces valid full result', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculate(ps, Gender.MALE, 2024, 2, 4, 12, 0);

    expect(result.isForward).toBe(true);
    expect(result.boundaryMode).toBe(DaeunBoundaryMode.EXACT_TABLE);
    expect(result.firstDaeunStartAge).toBeGreaterThanOrEqual(1);
    expect(result.daeunPillars.length).toBe(8);

    // Verify age progression
    let prevAge = result.firstDaeunStartAge;
    for (let i = 1; i < result.daeunPillars.length; i++) {
      expect(result.daeunPillars[i]!.startAge).toBe(prevAge + 10);
      prevAge = result.daeunPillars[i]!.startAge;
    }
  });

  it('late December birth crosses year boundary', () => {
    const ps = pillars();
    const result = DaeunCalculator.calculate(ps, Gender.MALE, 2024, 12, 31, 23, 0);

    expect(result.firstDaeunStartAge).toBeGreaterThanOrEqual(1);
    expect(result.daeunPillars.length).toBe(8);
    // Next jeol after Dec 31 is sohan (~Jan 5-6), ~5-6 days -> ~1-2 years
    expect(result.firstDaeunStartAge).toBeGreaterThanOrEqual(1);
    expect(result.firstDaeunStartAge).toBeLessThanOrEqual(3);
  });

  it('early January birth looks back across year boundary', () => {
    const ps = pillars({ yearStem: Cheongan.EUL, yearBranch: Jiji.CHUK });
    const result = DaeunCalculator.calculate(ps, Gender.MALE, 2024, 1, 1, 0, 30);

    expect(result.isForward).toBe(false);
    expect(result.firstDaeunStartAge).toBeGreaterThanOrEqual(1);
    // Reverse from Jan 1: previous jeol is daeseol (~Dec 7, 2023) ~25 days -> ~8 years
    expect(result.firstDaeunStartAge).toBeGreaterThanOrEqual(6);
    expect(result.firstDaeunStartAge).toBeLessThanOrEqual(10);
  });
});
