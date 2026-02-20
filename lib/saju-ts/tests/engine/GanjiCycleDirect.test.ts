import { describe, it, expect } from 'vitest';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { Cheongan, CHEONGAN_VALUES, cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, jijiOrdinal } from '../../src/domain/Jiji.js';

/**
 * Ported from GanjiCycleDirectUnitTest.kt
 *
 * Direct unit tests for 3 public methods:
 * 1. dayPillarByJdn  -- JDN-based day pillar ((jdn + 49) % 60)
 * 2. monthPillarApprox -- year stem + solar month based month pillar
 * 3. sajuMonthIndexByJeolApprox -- approximate jeol-based saju month index
 */

// Helper: epoch day for manual JDN calculation
function toEpochDay(year: number, month: number, day: number): number {
  const d = Date.UTC(year, month - 1, day);
  return Math.floor(d / 86_400_000);
}

// =========================================================================
// 1. dayPillarByJdn -- JDN-based day pillar
// =========================================================================
describe('dayPillarByJdn (direct)', () => {
  it('60 consecutive days produce all 60 unique pillars', () => {
    const pillars = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 1 + i));
      return GanjiCycle.dayPillarByJdn(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    });

    const uniqueLabels = new Set(pillars.map(p => p.label));
    expect(uniqueLabels.size).toBe(60);

    const stems = new Set(pillars.map(p => p.cheongan));
    const branches = new Set(pillars.map(p => p.jiji));
    expect(stems.size).toBe(10);
    expect(branches.size).toBe(12);
  });

  it('dates 60 days apart have the same pillar', () => {
    const dates = [
      [2000, 1, 1], [1984, 2, 4], [2024, 6, 15], [1950, 12, 25],
    ] as const;

    for (const [y, m, d] of dates) {
      const pillar = GanjiCycle.dayPillarByJdn(y, m, d);

      // +60 days
      const d60 = new Date(Date.UTC(y, m - 1, d + 60));
      const p60 = GanjiCycle.dayPillarByJdn(d60.getUTCFullYear(), d60.getUTCMonth() + 1, d60.getUTCDate());
      expect(pillar.equals(p60)).toBe(true);

      // +120 days
      const d120 = new Date(Date.UTC(y, m - 1, d + 120));
      const p120 = GanjiCycle.dayPillarByJdn(d120.getUTCFullYear(), d120.getUTCMonth() + 1, d120.getUTCDate());
      expect(pillar.equals(p120)).toBe(true);

      // -60 days
      const dm60 = new Date(Date.UTC(y, m - 1, d - 60));
      const pm60 = GanjiCycle.dayPillarByJdn(dm60.getUTCFullYear(), dm60.getUTCMonth() + 1, dm60.getUTCDate());
      expect(pillar.equals(pm60)).toBe(true);
    }
  });

  it('dates not multiple of 60 apart have different pillars', () => {
    const base = GanjiCycle.dayPillarByJdn(2024, 3, 1);
    for (const offset of [1, 7, 13, 29, 30, 31, 59]) {
      const d = new Date(Date.UTC(2024, 2, 1 + offset));
      const other = GanjiCycle.dayPillarByJdn(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      expect(base.equals(other)).toBe(false);
    }
  });

  it('known date 1984-02-02 produces a valid pillar', () => {
    const pillar = GanjiCycle.dayPillarByJdn(1984, 2, 2);
    expect(pillar).toBeDefined();
    expect(CHEONGAN_VALUES).toContain(pillar.cheongan);
    expect(JIJI_VALUES).toContain(pillar.jiji);
  });

  it('unix epoch 1970-01-01 day pillar is SIN-SA', () => {
    const pillar = GanjiCycle.dayPillarByJdn(1970, 1, 1);
    expect(pillar.cheongan).toBe(Cheongan.SIN);
    expect(pillar.jiji).toBe(Jiji.SA);
  });

  it.each([
    [1900, 1, 1],
    [2000, 1, 1],
    [2000, 2, 29],
    [2050, 12, 31],
  ])('edge date %i-%i-%i produces valid pillar', (y, m, d) => {
    const pillar = GanjiCycle.dayPillarByJdn(y, m, d);
    expect(CHEONGAN_VALUES).toContain(pillar.cheongan);
    expect(JIJI_VALUES).toContain(pillar.jiji);
  });

  it('2000-01-01 day pillar is MU-O', () => {
    const pillar = GanjiCycle.dayPillarByJdn(2000, 1, 1);
    expect(pillar.cheongan).toBe(Cheongan.MU);
    expect(pillar.jiji).toBe(Jiji.O);
  });

  it('1900-01-01 day pillar is GAP-SUL', () => {
    const pillar = GanjiCycle.dayPillarByJdn(1900, 1, 1);
    expect(pillar.cheongan).toBe(Cheongan.GAP);
    expect(pillar.jiji).toBe(Jiji.SUL);
  });

  it('result matches manual fromSexagenaryIndex calculation', () => {
    const dates = [
      [1970, 1, 1], [2000, 6, 15], [2024, 2, 29], [1945, 8, 15],
    ] as const;

    for (const [y, m, d] of dates) {
      const jdn = toEpochDay(y, m, d) + 2440588;
      const index = ((jdn + 49) % 60 + 60) % 60;
      const expected = GanjiCycle.fromSexagenaryIndex(index);
      const actual = GanjiCycle.dayPillarByJdn(y, m, d);
      expect(actual.equals(expected)).toBe(true);
    }
  });

  it('consecutive days have consecutive stems', () => {
    for (let i = 0; i < 30; i++) {
      const d1 = new Date(Date.UTC(2024, 0, 1 + i));
      const d2 = new Date(Date.UTC(2024, 0, 2 + i));
      const p1 = GanjiCycle.dayPillarByJdn(d1.getUTCFullYear(), d1.getUTCMonth() + 1, d1.getUTCDate());
      const p2 = GanjiCycle.dayPillarByJdn(d2.getUTCFullYear(), d2.getUTCMonth() + 1, d2.getUTCDate());
      const stemDiff = (cheonganOrdinal(p2.cheongan) - cheonganOrdinal(p1.cheongan) + 10) % 10;
      expect(stemDiff).toBe(1);
    }
  });

  it('consecutive days have consecutive branches', () => {
    for (let i = 0; i < 30; i++) {
      const d1 = new Date(Date.UTC(2024, 0, 1 + i));
      const d2 = new Date(Date.UTC(2024, 0, 2 + i));
      const p1 = GanjiCycle.dayPillarByJdn(d1.getUTCFullYear(), d1.getUTCMonth() + 1, d1.getUTCDate());
      const p2 = GanjiCycle.dayPillarByJdn(d2.getUTCFullYear(), d2.getUTCMonth() + 1, d2.getUTCDate());
      const branchDiff = (jijiOrdinal(p2.jiji) - jijiOrdinal(p1.jiji) + 12) % 12;
      expect(branchDiff).toBe(1);
    }
  });
});

// =========================================================================
// 2. monthPillarApprox -- 오호원 month pillar
// =========================================================================
describe('monthPillarApprox (direct)', () => {
  // Generate all 60 test cases for 5 year-stem groups x 12 months
  const stemStarts: [Cheongan, Cheongan][] = [
    [Cheongan.GAP, Cheongan.BYEONG],
    [Cheongan.EUL, Cheongan.MU],
    [Cheongan.BYEONG, Cheongan.GYEONG],
    [Cheongan.JEONG, Cheongan.IM],
    [Cheongan.MU, Cheongan.GAP],
  ];

  const branchByMonth = Array.from({ length: 12 }, (_, i) => JIJI_VALUES[(i + 2) % 12]!);

  const cases: { yearStem: Cheongan; month: number; expectedStem: Cheongan; expectedBranch: Jiji }[] = [];
  for (const [yearStem, startStem] of stemStarts) {
    for (let month = 1; month <= 12; month++) {
      const monthOffset = (month - 1) % 12;
      const expectedStem = CHEONGAN_VALUES[(cheonganOrdinal(startStem) + monthOffset) % 10]!;
      const expectedBranch = branchByMonth[month - 1]!;
      cases.push({ yearStem, month, expectedStem, expectedBranch });
    }
  }

  it.each(cases)(
    '5 year-stem groups x 12 months: yearStem=$yearStem, month=$month',
    ({ yearStem, month, expectedStem, expectedBranch }) => {
      const pillar = GanjiCycle.monthPillarApprox(yearStem, month);
      expect(pillar.cheongan).toBe(expectedStem);
      expect(pillar.jiji).toBe(expectedBranch);
    },
  );

  it.each([0, 13, -1, 100, -100])('invalid month %i throws RangeError', (month) => {
    expect(() => GanjiCycle.monthPillarApprox(Cheongan.GAP, month)).toThrow(RangeError);
  });

  it('January maps to IN branch', () => {
    const pillar = GanjiCycle.monthPillarApprox(Cheongan.GAP, 1);
    expect(pillar.jiji).toBe(Jiji.IN);
  });

  it('February maps to MYO branch', () => {
    const pillar = GanjiCycle.monthPillarApprox(Cheongan.GAP, 2);
    expect(pillar.jiji).toBe(Jiji.MYO);
  });

  it('November maps to JA branch', () => {
    const pillar = GanjiCycle.monthPillarApprox(Cheongan.GAP, 11);
    expect(pillar.jiji).toBe(Jiji.JA);
  });

  it('December maps to CHUK branch', () => {
    const pillar = GanjiCycle.monthPillarApprox(Cheongan.GAP, 12);
    expect(pillar.jiji).toBe(Jiji.CHUK);
  });

  it('paired year stems produce identical month pillars', () => {
    const pairs: [Cheongan, Cheongan][] = [
      [Cheongan.GAP, Cheongan.GI],
      [Cheongan.EUL, Cheongan.GYEONG],
      [Cheongan.BYEONG, Cheongan.SIN],
      [Cheongan.JEONG, Cheongan.IM],
      [Cheongan.MU, Cheongan.GYE],
    ];
    for (const [stem1, stem2] of pairs) {
      for (let month = 1; month <= 12; month++) {
        const p1 = GanjiCycle.monthPillarApprox(stem1, month);
        const p2 = GanjiCycle.monthPillarApprox(stem2, month);
        expect(p1.equals(p2)).toBe(true);
      }
    }
  });
});

// =========================================================================
// 3. sajuMonthIndexByJeolApprox -- approximate jeol month index
// =========================================================================
describe('sajuMonthIndexByJeolApprox (direct)', () => {
  it('January 1st before jeol returns 11 (hae-wol)', () => {
    expect(GanjiCycle.sajuMonthIndexByJeolApprox(2024, 1, 1)).toBe(11);
  });

  it('January 7th after jeol returns 12 (chuk-wol)', () => {
    expect(GanjiCycle.sajuMonthIndexByJeolApprox(2024, 1, 7)).toBe(12);
  });

  it('February 3rd before ipchun returns 12 (wrap-around)', () => {
    expect(GanjiCycle.sajuMonthIndexByJeolApprox(2024, 2, 3)).toBe(12);
  });

  it('February 5th after ipchun returns 1 (in-wol)', () => {
    expect(GanjiCycle.sajuMonthIndexByJeolApprox(2024, 2, 5)).toBe(1);
  });

  // All 12 months on 15th (safely after jeol)
  it.each([
    [1, 12], [2, 1], [3, 2], [4, 3], [5, 4], [6, 5],
    [7, 6], [8, 7], [9, 8], [10, 9], [11, 10], [12, 11],
  ])('month %i on 15th -> saju month index %i', (month, expectedIndex) => {
    expect(GanjiCycle.sajuMonthIndexByJeolApprox(2024, month, 15)).toBe(expectedIndex);
  });

  // All 12 months on 1st (before jeol)
  it.each([
    [1, 11], [2, 12], [3, 1], [4, 2], [5, 3], [6, 4],
    [7, 5], [8, 6], [9, 7], [10, 8], [11, 9], [12, 10],
  ])('month %i on 1st -> saju month index %i', (month, expectedIndex) => {
    expect(GanjiCycle.sajuMonthIndexByJeolApprox(2024, month, 1)).toBe(expectedIndex);
  });

  // Exact jeol start days
  it.each([
    [1, 6, 12], [2, 4, 1], [3, 6, 2], [4, 5, 3],
    [5, 6, 4], [6, 6, 5], [7, 7, 6], [8, 8, 7],
    [9, 8, 8], [10, 8, 9], [11, 7, 10], [12, 7, 11],
  ])('month %i jeol start day %i -> index %i', (month, jeolDay, expectedIndex) => {
    expect(GanjiCycle.sajuMonthIndexByJeolApprox(2024, month, jeolDay)).toBe(expectedIndex);
  });

  // Day before jeol start
  it.each([
    [1, 5, 11], [2, 3, 12], [3, 5, 1], [4, 4, 2],
    [5, 5, 3], [6, 5, 4], [7, 6, 5], [8, 7, 6],
    [9, 7, 7], [10, 7, 8], [11, 6, 9], [12, 6, 10],
  ])('month %i day before jeol (%i) -> index %i', (month, dayBefore, expectedIndex) => {
    expect(GanjiCycle.sajuMonthIndexByJeolApprox(2024, month, dayBefore)).toBe(expectedIndex);
  });

  it('result is always in range 1 to 12', () => {
    for (let month = 1; month <= 12; month++) {
      for (const day of [1, 10, 15, 20, 28]) {
        const index = GanjiCycle.sajuMonthIndexByJeolApprox(2024, month, day);
        expect(index).toBeGreaterThanOrEqual(1);
        expect(index).toBeLessThanOrEqual(12);
      }
    }
  });
});
