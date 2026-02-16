import { describe, it, expect } from 'vitest';
import { SaeunCalculator } from '../../../src/engine/luck/SaeunCalculator.js';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';

/**
 * Ported from SaeunCalculatorTest.kt
 *
 * Tests for:
 * 1. forYear -- individual year pillar checks
 * 2. calculate -- multi-year sequences
 * 3. monthlyLuck -- 12 monthly pillars with boundary moments
 */

function assertPillarEquals(
  expectedStem: Cheongan,
  expectedBranch: Jiji,
  actual: Pillar,
  context: string = '',
): void {
  const prefix = context ? `${context}: ` : '';
  expect(actual.cheongan, `${prefix}Expected stem ${expectedStem} but was ${actual.cheongan}`).toBe(expectedStem);
  expect(actual.jiji, `${prefix}Expected branch ${expectedBranch} but was ${actual.jiji}`).toBe(expectedBranch);
}

// =========================================================================
// forYear: individual year pillar checks
// =========================================================================
describe('SaeunCalculator.forYear', () => {
  it('base year 1984 is GAP-JA', () => {
    const saeun = SaeunCalculator.forYear(1984);
    expect(saeun.year).toBe(1984);
    assertPillarEquals(Cheongan.GAP, Jiji.JA, saeun.pillar);
  });

  it('year 2024 is GAP-JIN', () => {
    const saeun = SaeunCalculator.forYear(2024);
    expect(saeun.year).toBe(2024);
    assertPillarEquals(Cheongan.GAP, Jiji.JIN, saeun.pillar);
  });

  it('year 2025 is EUL-SA', () => {
    const saeun = SaeunCalculator.forYear(2025);
    expect(saeun.year).toBe(2025);
    assertPillarEquals(Cheongan.EUL, Jiji.SA, saeun.pillar);
  });
});

// =========================================================================
// calculate: multi-year sequences
// =========================================================================
describe('SaeunCalculator.calculate', () => {
  it('ten-year sequence from 2020 matches expected', () => {
    const expected: [Cheongan, Jiji][] = [
      [Cheongan.GYEONG, Jiji.JA],   // 경자 2020
      [Cheongan.SIN, Jiji.CHUK],     // 신축 2021
      [Cheongan.IM, Jiji.IN],        // 임인 2022
      [Cheongan.GYE, Jiji.MYO],      // 계묘 2023
      [Cheongan.GAP, Jiji.JIN],      // 갑진 2024
      [Cheongan.EUL, Jiji.SA],       // 을사 2025
      [Cheongan.BYEONG, Jiji.O],     // 병오 2026
      [Cheongan.JEONG, Jiji.MI],     // 정미 2027
      [Cheongan.MU, Jiji.SIN],       // 무신 2028
      [Cheongan.GI, Jiji.YU],        // 기유 2029
    ];

    const result = SaeunCalculator.calculate(2020, 10);

    expect(result.length).toBe(10);
    result.forEach((saeun, index) => {
      const [expectedStem, expectedBranch] = expected[index]!;
      const expectedYear = 2020 + index;
      expect(saeun.year, `Year mismatch at index ${index}`).toBe(expectedYear);
      assertPillarEquals(expectedStem, expectedBranch, saeun.pillar, `Pillar mismatch at year ${expectedYear}`);
    });
  });

  it('default count is ten', () => {
    const result = SaeunCalculator.calculate(2020);
    expect(result.length).toBe(10);
  });

  it('custom count is respected', () => {
    const result = SaeunCalculator.calculate(2020, 5);
    expect(result.length).toBe(5);
    expect(result[0]!.year).toBe(2020);
    expect(result[4]!.year).toBe(2024);
  });

  it('single year count works', () => {
    const result = SaeunCalculator.calculate(2024, 1);
    expect(result.length).toBe(1);
    assertPillarEquals(Cheongan.GAP, Jiji.JIN, result[0]!.pillar);
  });
});

// =========================================================================
// Sexagenary cycle wraparound
// =========================================================================
describe('SaeunCalculator cycle wraparound', () => {
  it('cycle wraps correctly after 60 years', () => {
    // 1984 = GAP-JA (index 0), so 1984 + 60 = 2044 should also be GAP-JA
    const saeun2044 = SaeunCalculator.forYear(2044);
    assertPillarEquals(Cheongan.GAP, Jiji.JA, saeun2044.pillar);
  });

  it('year before base year', () => {
    // 1983 = GYE-HAE (index 59, one step back from GAP-JA)
    const saeun1983 = SaeunCalculator.forYear(1983);
    assertPillarEquals(Cheongan.GYE, Jiji.HAE, saeun1983.pillar);
  });

  it('distant past year', () => {
    // 1924 = 1984 - 60 = GAP-JA (exactly one full cycle earlier)
    const saeun1924 = SaeunCalculator.forYear(1924);
    assertPillarEquals(Cheongan.GAP, Jiji.JA, saeun1924.pillar);
  });
});

// =========================================================================
// forYear and calculate consistency
// =========================================================================
describe('SaeunCalculator consistency', () => {
  it('forYear and calculate produce same results', () => {
    const range = SaeunCalculator.calculate(2015, 20);
    for (const saeun of range) {
      const single = SaeunCalculator.forYear(saeun.year);
      expect(single.pillar.cheongan, `Mismatch for year ${saeun.year}`).toBe(saeun.pillar.cheongan);
      expect(single.pillar.jiji, `Mismatch for year ${saeun.year}`).toBe(saeun.pillar.jiji);
    }
  });
});

// =========================================================================
// monthlyLuck
// =========================================================================
describe('SaeunCalculator.monthlyLuck', () => {
  it('generates twelve pillars', () => {
    const monthly = SaeunCalculator.monthlyLuck(2024);
    expect(monthly.length).toBe(12);
  });

  it('saju month indices are 1 to 12', () => {
    const monthly = SaeunCalculator.monthlyLuck(2024);
    const indices = monthly.map(w => w.sajuMonthIndex);
    expect(indices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('all years match requested year', () => {
    const monthly = SaeunCalculator.monthlyLuck(2024);
    for (const wolun of monthly) {
      expect(wolun.year).toBe(2024);
    }
  });

  it('GAP year has correct first and last month', () => {
    // 2024 = GAP (甲) year. monthStemStartAtIn(GAP) = BYEONG (丙).
    // Month 1 (寅): BYEONG-IN (丙寅)
    // Month 12 (丑): JEONG-CHUK (丁丑)
    const monthly = SaeunCalculator.monthlyLuck(2024);

    const first = monthly[0]!;
    expect(first.sajuMonthIndex).toBe(1);
    assertPillarEquals(Cheongan.BYEONG, Jiji.IN, first.pillar, 'First month of GAP year');

    const last = monthly[11]!;
    expect(last.sajuMonthIndex).toBe(12);
    assertPillarEquals(Cheongan.JEONG, Jiji.CHUK, last.pillar, 'Last month of GAP year');
  });

  it('GAP year full sequence', () => {
    // 2024 = GAP (甲) year. Starting stem at 寅 = BYEONG (丙).
    const expected: [Cheongan, Jiji][] = [
      [Cheongan.BYEONG, Jiji.IN],    // Month 1: 丙寅
      [Cheongan.JEONG, Jiji.MYO],     // Month 2: 丁卯
      [Cheongan.MU, Jiji.JIN],        // Month 3: 戊辰
      [Cheongan.GI, Jiji.SA],         // Month 4: 己巳
      [Cheongan.GYEONG, Jiji.O],      // Month 5: 庚午
      [Cheongan.SIN, Jiji.MI],        // Month 6: 辛未
      [Cheongan.IM, Jiji.SIN],        // Month 7: 壬申
      [Cheongan.GYE, Jiji.YU],        // Month 8: 癸酉
      [Cheongan.GAP, Jiji.SUL],       // Month 9: 甲戌
      [Cheongan.EUL, Jiji.HAE],       // Month 10: 乙亥
      [Cheongan.BYEONG, Jiji.JA],     // Month 11: 丙子
      [Cheongan.JEONG, Jiji.CHUK],    // Month 12: 丁丑
    ];

    const monthly = SaeunCalculator.monthlyLuck(2024);

    monthly.forEach((wolun, index) => {
      const [expectedStem, expectedBranch] = expected[index]!;
      assertPillarEquals(expectedStem, expectedBranch, wolun.pillar, `Month ${index + 1} of GAP year`);
    });
  });

  it('EUL year has correct starting stem', () => {
    // 2025 = EUL (乙) year. monthStemStartAtIn(EUL) = MU (戊).
    // Month 1 (寅): MU-IN (戊寅)
    const monthly = SaeunCalculator.monthlyLuck(2025);
    const first = monthly[0]!;
    assertPillarEquals(Cheongan.MU, Jiji.IN, first.pillar, 'First month of EUL year');
  });

  it('different years produce different stems', () => {
    const monthly2024 = SaeunCalculator.monthlyLuck(2024); // GAP year
    const monthly2025 = SaeunCalculator.monthlyLuck(2025); // EUL year

    // First months must differ in stem (BYEONG vs MU), same branch (IN)
    expect(monthly2024[0]!.pillar.jiji).toBe(Jiji.IN);
    expect(monthly2025[0]!.pillar.jiji).toBe(Jiji.IN);
    expect(monthly2024[0]!.pillar.cheongan).toBe(Cheongan.BYEONG);
    expect(monthly2025[0]!.pillar.cheongan).toBe(Cheongan.MU);
  });
});

// =========================================================================
// monthlyLuck jeol-boundary tests
// =========================================================================
describe('SaeunCalculator.monthlyLuck boundary moments', () => {
  it('includes boundary moments for supported year', () => {
    const monthly = SaeunCalculator.monthlyLuck(2024);
    for (const wolun of monthly) {
      expect(wolun.boundaryMoment, `Month ${wolun.sajuMonthIndex} of 2024 should have boundaryMoment from table`).toBeDefined();
    }
  });

  it('boundary moments are chronological for months 1 to 11', () => {
    const monthly = SaeunCalculator.monthlyLuck(2024);
    for (let i = 0; i < 10; i++) {
      const current = monthly[i]!.boundaryMoment!;
      const next = monthly[i + 1]!.boundaryMoment!;
      const currentKey = momentToKey(current);
      const nextKey = momentToKey(next);
      expect(currentKey, `Month ${monthly[i]!.sajuMonthIndex} boundary should be before month ${monthly[i + 1]!.sajuMonthIndex} boundary`).toBeLessThan(nextKey);
    }
    // Month 12 boundary should be in January (earlier than month 1's Feb)
    const month12 = monthly[11]!.boundaryMoment!;
    const month1 = monthly[0]!.boundaryMoment!;
    expect(momentToKey(month12), 'Month 12 (소한/Jan) should precede month 1 (입춘/Feb) in the Gregorian year').toBeLessThan(momentToKey(month1));
  });

  it('boundary for month 1 is Ipchun', () => {
    // 2024 입춘 = 2024-02-04 17:27 (from jeol table)
    const monthly = SaeunCalculator.monthlyLuck(2024);
    const ipchunWolun = monthly.find(w => w.sajuMonthIndex === 1)!;
    const moment = ipchunWolun.boundaryMoment!;
    expect(moment.year).toBe(2024);
    expect(moment.month, '입춘 should be in February').toBe(2);
    expect(moment.day, '입춘 2024 should be on Feb 4').toBe(4);
    expect(moment.hour, '입춘 2024 should be at 17:xx').toBe(17);
  });

  it('boundary for month 2 is Gyeongchip', () => {
    // 2024 경칩 = 2024-03-05 11:23 (from jeol table)
    const monthly = SaeunCalculator.monthlyLuck(2024);
    const gyeongchipWolun = monthly.find(w => w.sajuMonthIndex === 2)!;
    const moment = gyeongchipWolun.boundaryMoment!;
    expect(moment.month, '경칩 should be in March').toBe(3);
    expect(moment.day, '경칩 2024 should be on Mar 5').toBe(5);
  });

  it('boundary moments null for unsupported year', () => {
    // Year 1800 is outside JeolBoundaryTable range
    const monthly = SaeunCalculator.monthlyLuck(1800);
    for (const wolun of monthly) {
      expect(wolun.boundaryMoment, `Month ${wolun.sajuMonthIndex} of 1800 should have undefined boundaryMoment`).toBeUndefined();
    }
  });

  it('pillars unchanged after boundary addition', () => {
    // The 오호결원법 pillar calculation should be the same before and after adding boundaries
    const monthly = SaeunCalculator.monthlyLuck(2024);
    assertPillarEquals(Cheongan.BYEONG, Jiji.IN, monthly[0]!.pillar, 'Month 1 pillar unchanged');
    assertPillarEquals(Cheongan.JEONG, Jiji.CHUK, monthly[11]!.pillar, 'Month 12 pillar unchanged');
  });
});

// =========================================================================
// Helper
// =========================================================================
function momentToKey(m: { year: number; month: number; day: number; hour: number; minute: number }): number {
  return m.year * 100_000_000 + m.month * 1_000_000 + m.day * 10_000 + m.hour * 100 + m.minute;
}
