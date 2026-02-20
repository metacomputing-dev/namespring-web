import { describe, it, expect } from 'vitest';
import { DaeunCalculator } from '../../../src/engine/luck/DaeunCalculator.js';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Gender } from '../../../src/domain/Gender.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { DaeunBoundaryMode, DaeunPillar } from '../../../src/domain/DaeunInfo.js';
import { GanjiCycle } from '../../../src/engine/GanjiCycle.js';

/**
 * Ported from DaeunCalculatorTest.kt
 *
 * Tests for:
 * 1. Direction (isForward) — 양남음녀 순행, 음남양녀 역행
 * 2. Sexagenary index calculation
 * 3. Forward/reverse daeun pillar sequences
 * 4. Daeun count and age ranges
 * 5. Start age calculation from jeol boundary table
 * 6. Full calculate integration
 * 7. Minute-precision start age (months)
 */

// --- Helpers ---

function dummyPillarSet(
  yearPillar: Pillar = new Pillar(Cheongan.GAP, Jiji.JA),
  monthPillar: Pillar = new Pillar(Cheongan.GAP, Jiji.IN),
  dayPillar: Pillar = new Pillar(Cheongan.GAP, Jiji.JA),
  hourPillar: Pillar = new Pillar(Cheongan.GAP, Jiji.JA),
): PillarSet {
  return new PillarSet(yearPillar, monthPillar, dayPillar, hourPillar);
}

function assertPillarEquals(
  expectedStem: Cheongan,
  expectedBranch: Jiji,
  actual: DaeunPillar,
): void {
  expect(actual.pillar.cheongan).toBe(expectedStem);
  expect(actual.pillar.jiji).toBe(expectedBranch);
}

// =========================================================================
// 1. Direction tests (isForward)
// =========================================================================
describe('isForward', () => {
  it('양남 -> 순행: YANG year stem + MALE = forward', () => {
    expect(DaeunCalculator.isForward(Cheongan.GAP, Gender.MALE)).toBe(true);
    expect(DaeunCalculator.isForward(Cheongan.BYEONG, Gender.MALE)).toBe(true);
    expect(DaeunCalculator.isForward(Cheongan.MU, Gender.MALE)).toBe(true);
    expect(DaeunCalculator.isForward(Cheongan.GYEONG, Gender.MALE)).toBe(true);
    expect(DaeunCalculator.isForward(Cheongan.IM, Gender.MALE)).toBe(true);
  });

  it('음남 -> 역행: YIN year stem + MALE = reverse', () => {
    expect(DaeunCalculator.isForward(Cheongan.EUL, Gender.MALE)).toBe(false);
    expect(DaeunCalculator.isForward(Cheongan.JEONG, Gender.MALE)).toBe(false);
    expect(DaeunCalculator.isForward(Cheongan.GI, Gender.MALE)).toBe(false);
    expect(DaeunCalculator.isForward(Cheongan.SIN, Gender.MALE)).toBe(false);
    expect(DaeunCalculator.isForward(Cheongan.GYE, Gender.MALE)).toBe(false);
  });

  it('양녀 -> 역행: YANG year stem + FEMALE = reverse', () => {
    expect(DaeunCalculator.isForward(Cheongan.GAP, Gender.FEMALE)).toBe(false);
    expect(DaeunCalculator.isForward(Cheongan.BYEONG, Gender.FEMALE)).toBe(false);
    expect(DaeunCalculator.isForward(Cheongan.MU, Gender.FEMALE)).toBe(false);
    expect(DaeunCalculator.isForward(Cheongan.GYEONG, Gender.FEMALE)).toBe(false);
    expect(DaeunCalculator.isForward(Cheongan.IM, Gender.FEMALE)).toBe(false);
  });

  it('음녀 -> 순행: YIN year stem + FEMALE = forward', () => {
    expect(DaeunCalculator.isForward(Cheongan.EUL, Gender.FEMALE)).toBe(true);
    expect(DaeunCalculator.isForward(Cheongan.JEONG, Gender.FEMALE)).toBe(true);
    expect(DaeunCalculator.isForward(Cheongan.GI, Gender.FEMALE)).toBe(true);
    expect(DaeunCalculator.isForward(Cheongan.SIN, Gender.FEMALE)).toBe(true);
    expect(DaeunCalculator.isForward(Cheongan.GYE, Gender.FEMALE)).toBe(true);
  });
});

// =========================================================================
// 2. Sexagenary index tests
// =========================================================================
describe('sexagenaryIndex', () => {
  it('갑자 = 0', () => {
    expect(DaeunCalculator.sexagenaryIndex(new Pillar(Cheongan.GAP, Jiji.JA))).toBe(0);
  });

  it('을축 = 1', () => {
    expect(DaeunCalculator.sexagenaryIndex(new Pillar(Cheongan.EUL, Jiji.CHUK))).toBe(1);
  });

  it('갑인 = 50', () => {
    expect(DaeunCalculator.sexagenaryIndex(new Pillar(Cheongan.GAP, Jiji.IN))).toBe(50);
  });

  it('계해 = 59', () => {
    expect(DaeunCalculator.sexagenaryIndex(new Pillar(Cheongan.GYE, Jiji.HAE))).toBe(59);
  });

  it('round-trips for all 60 pillars', () => {
    for (let i = 0; i < 60; i++) {
      const pillar = GanjiCycle.fromSexagenaryIndex(i);
      expect(DaeunCalculator.sexagenaryIndex(pillar)).toBe(i);
    }
  });
});

// =========================================================================
// 3. Forward daeun pillar sequence
// =========================================================================
describe('forward daeun sequence', () => {
  it('forward from 갑인 produces correct sequence', () => {
    // 갑인 (index 50), forward: +1=을묘, +2=병진, +3=정사
    const monthPillar = new Pillar(Cheongan.GAP, Jiji.IN);
    const yearPillar = new Pillar(Cheongan.GAP, Jiji.JA); // YANG stem
    const pillars = dummyPillarSet(yearPillar, monthPillar);

    const result = DaeunCalculator.calculateWithStartAge(pillars, Gender.MALE, 3);

    expect(result.isForward).toBe(true);
    expect(result.daeunPillars.length).toBe(8);

    assertPillarEquals(Cheongan.EUL, Jiji.MYO, result.daeunPillars[0]!);
    assertPillarEquals(Cheongan.BYEONG, Jiji.JIN, result.daeunPillars[1]!);
    assertPillarEquals(Cheongan.JEONG, Jiji.SA, result.daeunPillars[2]!);
  });

  it('forward wraps around cycle correctly', () => {
    // 계해 (index 59), forward: +1 wraps to index 0 = 갑자
    const monthPillar = new Pillar(Cheongan.GYE, Jiji.HAE);
    const yearPillar = new Pillar(Cheongan.GAP, Jiji.JA); // YANG stem
    const pillars = dummyPillarSet(yearPillar, monthPillar);

    const result = DaeunCalculator.calculateWithStartAge(pillars, Gender.MALE, 5);

    expect(result.isForward).toBe(true);
    assertPillarEquals(Cheongan.GAP, Jiji.JA, result.daeunPillars[0]!);
    assertPillarEquals(Cheongan.EUL, Jiji.CHUK, result.daeunPillars[1]!);
  });
});

// =========================================================================
// 4. Reverse daeun pillar sequence
// =========================================================================
describe('reverse daeun sequence', () => {
  it('reverse from 갑인 produces correct sequence', () => {
    // 갑인 (index 50), reverse: -1=계축, -2=임자, -3=신해
    const monthPillar = new Pillar(Cheongan.GAP, Jiji.IN);
    const yearPillar = new Pillar(Cheongan.EUL, Jiji.CHUK); // YIN stem
    const pillars = dummyPillarSet(yearPillar, monthPillar);

    const result = DaeunCalculator.calculateWithStartAge(pillars, Gender.MALE, 7);

    expect(result.isForward).toBe(false);
    expect(result.daeunPillars.length).toBe(8);

    assertPillarEquals(Cheongan.GYE, Jiji.CHUK, result.daeunPillars[0]!);
    assertPillarEquals(Cheongan.IM, Jiji.JA, result.daeunPillars[1]!);
    assertPillarEquals(Cheongan.SIN, Jiji.HAE, result.daeunPillars[2]!);
  });

  it('reverse wraps around cycle correctly', () => {
    // 갑자 (index 0), reverse: -1 wraps to index 59 = 계해
    const monthPillar = new Pillar(Cheongan.GAP, Jiji.JA);
    const yearPillar = new Pillar(Cheongan.EUL, Jiji.CHUK); // YIN stem
    const pillars = dummyPillarSet(yearPillar, monthPillar);

    const result = DaeunCalculator.calculateWithStartAge(pillars, Gender.MALE, 2);

    expect(result.isForward).toBe(false);
    assertPillarEquals(Cheongan.GYE, Jiji.HAE, result.daeunPillars[0]!);
    assertPillarEquals(Cheongan.IM, Jiji.SUL, result.daeunPillars[1]!);
  });
});

// =========================================================================
// 5. Daeun count and age ranges
// =========================================================================
describe('daeun count and age ranges', () => {
  it('8 daeun pillars generated by default', () => {
    const pillars = dummyPillarSet();
    const result = DaeunCalculator.calculateWithStartAge(pillars, Gender.MALE, 4);
    expect(result.daeunPillars.length).toBe(8);
  });

  it('custom daeun count is respected', () => {
    const pillars = dummyPillarSet();
    const result = DaeunCalculator.calculateWithStartAge(pillars, Gender.MALE, 3, 5);
    expect(result.daeunPillars.length).toBe(5);
  });

  it('start ages increment by 10 years', () => {
    const firstAge = 4;
    const pillars = dummyPillarSet();
    const result = DaeunCalculator.calculateWithStartAge(pillars, Gender.MALE, firstAge);

    result.daeunPillars.forEach((dp, index) => {
      const expectedStart = firstAge + index * 10;
      const expectedEnd = expectedStart + 9;
      expect(dp.startAge).toBe(expectedStart);
      expect(dp.endAge).toBe(expectedEnd);
      expect(dp.order).toBe(index + 1);
    });
  });

  it('start ages sequence for startAge 3', () => {
    const pillars = dummyPillarSet();
    const result = DaeunCalculator.calculateWithStartAge(pillars, Gender.MALE, 3);

    expect(result.firstDaeunStartAge).toBe(3);
    expect(result.daeunPillars[0]!.startAge).toBe(3);
    expect(result.daeunPillars[0]!.endAge).toBe(12);
    expect(result.daeunPillars[1]!.startAge).toBe(13);
    expect(result.daeunPillars[1]!.endAge).toBe(22);
    expect(result.daeunPillars[2]!.startAge).toBe(23);
    expect(result.daeunPillars[2]!.endAge).toBe(32);
  });
});

// =========================================================================
// 6. calculateStartAge with exact table
// =========================================================================
describe('calculateStartAge', () => {
  it('start age forward from exact table', () => {
    // Birth: 2024-03-01 00:00
    // Next jeol boundary: 2024-03-05 11:23 (경칩)
    // startAge = minutes / 360 / 12 -> clamped >= 1
    const startAge = DaeunCalculator.calculateStartAge(2024, 3, 1, 0, 0, true);
    expect(startAge).toBe(1);
  });

  it('start age reverse from exact table', () => {
    // Birth: 2024-03-01 00:00
    // Previous jeol boundary at or before: 2024-02-04 17:27 (입춘)
    // ~26 days -> startAge ~8
    const startAge = DaeunCalculator.calculateStartAge(2024, 3, 1, 0, 0, false);
    expect(startAge).toBe(8);
  });

  it('start age minimum is 1', () => {
    // Birth: 2024-02-04 17:00 (just before ipchun boundary at 17:27)
    // Forward: next boundary is 27 minutes away -> 0 months -> 0 years -> clamped to 1
    const startAge = DaeunCalculator.calculateStartAge(2024, 2, 4, 17, 0, true);
    expect(startAge).toBe(1);
  });

  it('start age with larger day gap', () => {
    // Birth: 2024-08-01 00:00
    // Forward: next boundary -> 2024-08-07 09:09 (입추)
    // ~6 days -> startAge = 2
    const startAge = DaeunCalculator.calculateStartAge(2024, 8, 1, 0, 0, true);
    expect(startAge).toBe(2);
  });
});

// =========================================================================
// 7. Full calculate (integration)
// =========================================================================
describe('full calculate', () => {
  it('YANG male in 2024 forward', () => {
    const yearPillar = new Pillar(Cheongan.GAP, Jiji.JIN);   // 갑진 year (2024)
    const monthPillar = new Pillar(Cheongan.GAP, Jiji.IN);   // 갑인 month
    const dayPillar = new Pillar(Cheongan.BYEONG, Jiji.O);
    const hourPillar = new Pillar(Cheongan.MU, Jiji.JA);
    const pillars = new PillarSet(yearPillar, monthPillar, dayPillar, hourPillar);

    const result = DaeunCalculator.calculate(pillars, Gender.MALE, 2024, 3, 1);

    expect(result.isForward).toBe(true);
    expect(result.firstDaeunStartAge).toBe(1);
    expect(result.daeunPillars.length).toBe(8);

    // Forward from 갑인 (50): 을묘, 병진, 정사, 무오, 기미, 경신, 신유, 임술
    assertPillarEquals(Cheongan.EUL, Jiji.MYO, result.daeunPillars[0]!);
    assertPillarEquals(Cheongan.BYEONG, Jiji.JIN, result.daeunPillars[1]!);
    assertPillarEquals(Cheongan.JEONG, Jiji.SA, result.daeunPillars[2]!);
    assertPillarEquals(Cheongan.MU, Jiji.O, result.daeunPillars[3]!);
    assertPillarEquals(Cheongan.GI, Jiji.MI, result.daeunPillars[4]!);
    assertPillarEquals(Cheongan.GYEONG, Jiji.SIN, result.daeunPillars[5]!);
    assertPillarEquals(Cheongan.SIN, Jiji.YU, result.daeunPillars[6]!);
    assertPillarEquals(Cheongan.IM, Jiji.SUL, result.daeunPillars[7]!);
  });

  it('YIN female in 2024 forward', () => {
    const yearPillar = new Pillar(Cheongan.EUL, Jiji.SA);
    const monthPillar = new Pillar(Cheongan.GAP, Jiji.IN);
    const dayPillar = new Pillar(Cheongan.BYEONG, Jiji.O);
    const hourPillar = new Pillar(Cheongan.MU, Jiji.JA);
    const pillars = new PillarSet(yearPillar, monthPillar, dayPillar, hourPillar);

    const result = DaeunCalculator.calculate(pillars, Gender.FEMALE, 2024, 3, 1);

    expect(result.isForward).toBe(true);
    assertPillarEquals(Cheongan.EUL, Jiji.MYO, result.daeunPillars[0]!);
  });

  it('YIN male produces reverse', () => {
    const yearPillar = new Pillar(Cheongan.EUL, Jiji.SA);
    const monthPillar = new Pillar(Cheongan.GAP, Jiji.IN);
    const dayPillar = new Pillar(Cheongan.BYEONG, Jiji.O);
    const hourPillar = new Pillar(Cheongan.MU, Jiji.JA);
    const pillars = new PillarSet(yearPillar, monthPillar, dayPillar, hourPillar);

    const result = DaeunCalculator.calculate(pillars, Gender.MALE, 2024, 3, 1);

    expect(result.isForward).toBe(false);
    // Reverse from 갑인 (50): 계축, 임자, 신해, ...
    assertPillarEquals(Cheongan.GYE, Jiji.CHUK, result.daeunPillars[0]!);
    assertPillarEquals(Cheongan.IM, Jiji.JA, result.daeunPillars[1]!);
    assertPillarEquals(Cheongan.SIN, Jiji.HAE, result.daeunPillars[2]!);
  });
});

// =========================================================================
// 8. Minute-precision start age tests
// =========================================================================
describe('minute-precision start age', () => {
  it('minute precision yields months when available', () => {
    // Birth: 2024-03-01 00:00
    // Next jeol: 2024-03-05 11:23 (경칩)
    // Minutes between: 4d * 1440 + 11h * 60 + 23m = 5760 + 660 + 23 = 6443 minutes
    // Total daeun months: 6443 / 360 = 17
    // Years: 17 / 12 = 1, Months: 17 % 12 = 5
    const yearPillar = new Pillar(Cheongan.GAP, Jiji.JIN);
    const monthPillar = new Pillar(Cheongan.GAP, Jiji.IN);
    const dayPillar = new Pillar(Cheongan.BYEONG, Jiji.O);
    const hourPillar = new Pillar(Cheongan.MU, Jiji.JA);
    const pillars = new PillarSet(yearPillar, monthPillar, dayPillar, hourPillar);

    const result = DaeunCalculator.calculate(pillars, Gender.MALE, 2024, 3, 1, 0, 0);

    expect(result.firstDaeunStartAge).toBe(1);
    expect(result.firstDaeunStartMonths).toBe(5);
  });

  it('minute precision birth at noon differs from midnight', () => {
    const yearPillar = new Pillar(Cheongan.GAP, Jiji.JIN);
    const monthPillar = new Pillar(Cheongan.GAP, Jiji.IN);
    const dayPillar = new Pillar(Cheongan.BYEONG, Jiji.O);
    const hourPillar = new Pillar(Cheongan.MU, Jiji.JA);
    const pillars = new PillarSet(yearPillar, monthPillar, dayPillar, hourPillar);

    const resultMidnight = DaeunCalculator.calculate(pillars, Gender.MALE, 2024, 8, 1, 0, 0);
    const resultNoon = DaeunCalculator.calculate(pillars, Gender.MALE, 2024, 8, 1, 12, 0);

    const totalMonthsMidnight =
      resultMidnight.firstDaeunStartAge * 12 + resultMidnight.firstDaeunStartMonths;
    const totalMonthsNoon =
      resultNoon.firstDaeunStartAge * 12 + resultNoon.firstDaeunStartMonths;

    expect(totalMonthsMidnight).toBeGreaterThan(totalMonthsNoon);
  });

  it('firstDaeunStartMonths is in 0-11 range', () => {
    const yearPillar = new Pillar(Cheongan.GAP, Jiji.JIN);
    const monthPillar = new Pillar(Cheongan.GAP, Jiji.IN);
    const dayPillar = new Pillar(Cheongan.BYEONG, Jiji.O);
    const hourPillar = new Pillar(Cheongan.MU, Jiji.JA);
    const pillars = new PillarSet(yearPillar, monthPillar, dayPillar, hourPillar);

    const result = DaeunCalculator.calculate(pillars, Gender.MALE, 2024, 3, 1, 0, 0);

    expect(result.firstDaeunStartMonths).toBeGreaterThanOrEqual(0);
    expect(result.firstDaeunStartMonths).toBeLessThanOrEqual(11);
  });

  it('calculateWithStartAge has zero months', () => {
    const pillars = dummyPillarSet();
    const result = DaeunCalculator.calculateWithStartAge(pillars, Gender.MALE, 5);
    expect(result.firstDaeunStartMonths).toBe(0);
  });
});

// =========================================================================
// 9. Boundary mode and warnings
// =========================================================================
describe('boundary mode and warnings', () => {
  it('outside table year uses VSOP87D_CALCULATED mode via table scan', () => {
    // Year 1850 is outside the 1900-2050 table range.
    // However, JeolBoundaryTable.nextBoundaryAfter will find boundaries from
    // later years (1900+) because it scans all sorted data. The code detects
    // that year 1850 is not in isSupportedYear and reports VSOP87D_CALCULATED
    // with a warning about being outside the table range.
    const pillars = dummyPillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.BYEONG, Jiji.O),
      new Pillar(Cheongan.MU, Jiji.JA),
    );

    const result = DaeunCalculator.calculate(pillars, Gender.MALE, 1850, 3, 1, 0, 0);

    expect(result.boundaryMode).toBe(DaeunBoundaryMode.VSOP87D_CALCULATED);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('outside JeolBoundaryTable'))).toBe(true);
  });

  it('in-range year has no outside-table warning', () => {
    const pillars = dummyPillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.BYEONG, Jiji.O),
      new Pillar(Cheongan.MU, Jiji.JA),
    );

    const result = DaeunCalculator.calculate(pillars, Gender.MALE, 2024, 3, 1, 0, 0);

    expect(result.warnings.every(w => !w.includes('outside JeolBoundaryTable'))).toBe(true);
  });

  it('in-range year uses EXACT_TABLE mode', () => {
    const pillars = dummyPillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.BYEONG, Jiji.O),
      new Pillar(Cheongan.MU, Jiji.JA),
    );

    const result = DaeunCalculator.calculate(pillars, Gender.MALE, 2024, 3, 1, 0, 0);

    expect(result.boundaryMode).toBe(DaeunBoundaryMode.EXACT_TABLE);
  });
});
