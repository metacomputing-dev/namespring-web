import { describe, it, expect } from 'vitest';
import { SaeunCalculator } from '../../../src/engine/luck/SaeunCalculator.js';
import { LuckInteractionAnalyzer } from '../../../src/engine/luck/LuckInteractionAnalyzer.js';
import { Cheongan, cheonganOrdinal } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Gender } from '../../../src/domain/Gender.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { LuckQuality, type LuckPillarAnalysis } from '../../../src/domain/LuckInteraction.js';
import { GanjiCycle } from '../../../src/engine/GanjiCycle.js';
import type { SaeunPillar } from '../../../src/domain/SaeunInfo.js';

/**
 * Monthly luck boundary multi-year continuity (H-03)
 * and Daeun-Saeun interaction expanded matrix (H-04).
 *
 * Ported from LuckCycleExpandedCoverageTest.kt
 *
 * Part 1: monthlyLuck() multi-year/boundary/continuity verification
 * Part 2: LuckInteractionAnalyzer stem hap/chung, branch relation expanded matrix
 */

// =========================================================================
// Helpers
// =========================================================================

function momentToKey(m: { year: number; month: number; day: number; hour: number; minute: number }): number {
  return m.year * 100_000_000 + m.month * 1_000_000 + m.day * 10_000 + m.hour * 100 + m.minute;
}

function analyzeDaeunSaeunInteraction(
  daeunStem: Cheongan,
  daeunBranch: Jiji,
  saeunStem: Cheongan,
  saeunBranch: Jiji,
): LuckPillarAnalysis {
  const dayMaster = Cheongan.BYEONG;
  const neutralNatal = new PillarSet(
    new Pillar(Cheongan.JEONG, Jiji.SA),
    new Pillar(Cheongan.JEONG, Jiji.MYO),
    new Pillar(dayMaster, Jiji.SUL),
    new Pillar(Cheongan.JEONG, Jiji.MI),
  );
  const daeunPillar = new Pillar(daeunStem, daeunBranch);
  const saeunPillars: SaeunPillar[] = [{ year: 2025, pillar: new Pillar(saeunStem, saeunBranch) }];

  const results = LuckInteractionAnalyzer.analyzeSaeun(
    saeunPillars,
    neutralNatal,
    daeunPillar,
    dayMaster,
    null,
    null,
  );
  return results[0]!;
}

function analyzeDaeunSaeunBranchInteraction(
  daeunBranch: Jiji,
  saeunBranch: Jiji,
): LuckPillarAnalysis {
  const dayMaster = Cheongan.BYEONG;
  const neutralNatal = new PillarSet(
    new Pillar(Cheongan.JEONG, Jiji.JIN),
    new Pillar(Cheongan.JEONG, Jiji.JIN),
    new Pillar(dayMaster, Jiji.JIN),
    new Pillar(Cheongan.JEONG, Jiji.JIN),
  );
  const daeunPillar = new Pillar(Cheongan.GAP, daeunBranch);
  const saeunPillars: SaeunPillar[] = [{ year: 2025, pillar: new Pillar(Cheongan.EUL, saeunBranch) }];

  return LuckInteractionAnalyzer.analyzeSaeun(
    saeunPillars,
    neutralNatal,
    daeunPillar,
    dayMaster,
    null,
    null,
  )[0]!;
}

// =========================================================================
// Part 1: Monthly Luck boundary multi-year continuity (H-03)
// =========================================================================

describe('Monthly luck multi-year continuity', () => {
  const MULTI_YEAR_CASES = [1950, 1980, 2000, 2024, 2050];

  it.each(MULTI_YEAR_CASES)('year %i: 12 monthly pillars generated', (year) => {
    const monthly = SaeunCalculator.monthlyLuck(year);
    expect(monthly.length).toBe(12);
    const indices = monthly.map(w => w.sajuMonthIndex);
    expect(indices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const wolun of monthly) {
      expect(wolun.year).toBe(year);
    }
  });

  it.each(MULTI_YEAR_CASES)('year %i: boundary moments are chronological for months 1-11', (year) => {
    const monthly = SaeunCalculator.monthlyLuck(year);
    const allHaveBoundary = monthly.every(w => w.boundaryMoment !== undefined);
    if (!allHaveBoundary) return; // skip if outside table range

    // months 1-11 ascending
    for (let i = 0; i < 10; i++) {
      const current = monthly[i]!.boundaryMoment!;
      const next = monthly[i + 1]!.boundaryMoment!;
      expect(momentToKey(current)).toBeLessThan(momentToKey(next));
    }

    // month 12 (sohan, January) precedes month 1 (ipchun, February)
    const month12 = monthly[11]!.boundaryMoment!;
    const month1 = monthly[0]!.boundaryMoment!;
    expect(momentToKey(month12)).toBeLessThan(momentToKey(month1));
  });

  it('year transition: month 12 of year N precedes month 1 of year N+1', () => {
    const testPairs: [number, number][] = [
      [1950, 1951], [1999, 2000], [2024, 2025], [2049, 2050],
    ];
    for (const [yearN, yearN1] of testPairs) {
      const monthlyN = SaeunCalculator.monthlyLuck(yearN);
      const monthlyN1 = SaeunCalculator.monthlyLuck(yearN1);

      const month12N = monthlyN[11]!.boundaryMoment;
      const month1N1 = monthlyN1[0]!.boundaryMoment;

      if (month12N === undefined || month1N1 === undefined) continue;
      expect(momentToKey(month12N)).toBeLessThan(momentToKey(month1N1));
    }
  });

  it('ohogyelwonbeop: year stem group determines month 1 stem', () => {
    const expectedFirstStem: Record<Cheongan, Cheongan> = {
      [Cheongan.GAP]: Cheongan.BYEONG,
      [Cheongan.GI]: Cheongan.BYEONG,
      [Cheongan.EUL]: Cheongan.MU,
      [Cheongan.GYEONG]: Cheongan.MU,
      [Cheongan.BYEONG]: Cheongan.GYEONG,
      [Cheongan.SIN]: Cheongan.GYEONG,
      [Cheongan.JEONG]: Cheongan.IM,
      [Cheongan.IM]: Cheongan.IM,
      [Cheongan.MU]: Cheongan.GAP,
      [Cheongan.GYE]: Cheongan.GAP,
    };

    for (let year = 1980; year <= 1989; year++) {
      const yearPillar = GanjiCycle.yearPillarApprox(year);
      const yearStem = yearPillar.cheongan;
      const monthly = SaeunCalculator.monthlyLuck(year);
      const actualFirstStem = monthly[0]!.pillar.cheongan;
      expect(actualFirstStem).toBe(expectedFirstStem[yearStem]);
    }
  });

  it('ohogyelwonbeop: 10 consecutive years cover all 5 groups', () => {
    const coveredStems = new Set<Cheongan>();
    for (let year = 1984; year <= 1993; year++) {
      const yearPillar = GanjiCycle.yearPillarApprox(year);
      coveredStems.add(yearPillar.cheongan);
      const monthly = SaeunCalculator.monthlyLuck(year);
      for (let i = 1; i < 12; i++) {
        const prevStem = monthly[i - 1]!.pillar.cheongan;
        const currStem = monthly[i]!.pillar.cheongan;
        const expectedIdx = (cheonganOrdinal(prevStem) + 1) % 10;
        expect(cheonganOrdinal(currStem)).toBe(expectedIdx);
      }
    }
    expect(coveredStems.size).toBe(10);
  });

  const EXPECTED_BRANCHES: Jiji[] = [
    Jiji.IN, Jiji.MYO, Jiji.JIN, Jiji.SA, Jiji.O, Jiji.MI,
    Jiji.SIN, Jiji.YU, Jiji.SUL, Jiji.HAE, Jiji.JA, Jiji.CHUK,
  ];

  it.each([1900, 1950, 1980, 2000, 2024, 2050])(
    'year %i: monthly branches are IN..CHUK',
    (year) => {
      const monthly = SaeunCalculator.monthlyLuck(year);
      const branches = monthly.map(w => w.pillar.jiji);
      expect(branches).toEqual(EXPECTED_BRANCHES);
    },
  );

  it('boundary year 1900: table start has valid monthly luck', () => {
    const monthly = SaeunCalculator.monthlyLuck(1900);
    expect(monthly.length).toBe(12);
    for (const wolun of monthly) {
      expect(wolun.boundaryMoment).toBeDefined();
    }
  });

  it('boundary year 2050: table end has valid monthly luck', () => {
    const monthly = SaeunCalculator.monthlyLuck(2050);
    expect(monthly.length).toBe(12);
    for (const wolun of monthly) {
      expect(wolun.boundaryMoment).toBeDefined();
    }
  });

  it('out-of-table year 1800: boundary undefined but pillars valid', () => {
    const monthly = SaeunCalculator.monthlyLuck(1800);
    expect(monthly.length).toBe(12);
    for (const wolun of monthly) {
      expect(wolun.boundaryMoment).toBeUndefined();
    }
    const branches = monthly.map(w => w.pillar.jiji);
    expect(branches).toEqual(EXPECTED_BRANCHES);
  });

  it('out-of-table year 2100: boundary undefined but pillars valid', () => {
    const monthly = SaeunCalculator.monthlyLuck(2100);
    expect(monthly.length).toBe(12);
    for (const wolun of monthly) {
      expect(wolun.boundaryMoment).toBeUndefined();
    }
    const branches = monthly.map(w => w.pillar.jiji);
    expect(branches).toEqual(EXPECTED_BRANCHES);
  });

  it('month 12 sohan boundary is in January of the same year', () => {
    const monthly = SaeunCalculator.monthlyLuck(2024);
    const month12 = monthly[11]!;
    expect(month12.sajuMonthIndex).toBe(12);
    const boundary = month12.boundaryMoment!;
    expect(boundary.year).toBe(2024);
    expect(boundary.month).toBe(1);
  });

  it('60-year interval produces identical monthly pillar sequence', () => {
    const monthly1984 = SaeunCalculator.monthlyLuck(1984);
    const monthly2044 = SaeunCalculator.monthlyLuck(2044);
    for (let i = 0; i < 12; i++) {
      expect(monthly2044[i]!.pillar.cheongan).toBe(monthly1984[i]!.pillar.cheongan);
      expect(monthly2044[i]!.pillar.jiji).toBe(monthly1984[i]!.pillar.jiji);
    }
  });
});

// =========================================================================
// Part 2: Daeun-Saeun stem hap expanded matrix (H-04)
// =========================================================================

describe('Daeun-Saeun cheongan hap', () => {
  it('GAP-GI hap detected', () => {
    const result = analyzeDaeunSaeunInteraction(Cheongan.GAP, Jiji.IN, Cheongan.GI, Jiji.SA);
    expect(result.stemRelations.some(r => r.includes('\uAC11\uAE30\uD569'))).toBe(true);
  });

  it('EUL-GYEONG hap detected', () => {
    const result = analyzeDaeunSaeunInteraction(Cheongan.EUL, Jiji.MYO, Cheongan.GYEONG, Jiji.SIN);
    expect(result.stemRelations.some(r => r.includes('\uC744\uACBD\uD569'))).toBe(true);
  });

  it('BYEONG-SIN hap detected', () => {
    const result = analyzeDaeunSaeunInteraction(Cheongan.BYEONG, Jiji.O, Cheongan.SIN, Jiji.YU);
    expect(result.stemRelations.some(r => r.includes('\uBCD1\uC2E0\uD569'))).toBe(true);
  });

  it('JEONG-IM hap detected', () => {
    const result = analyzeDaeunSaeunInteraction(Cheongan.JEONG, Jiji.SA, Cheongan.IM, Jiji.JA);
    expect(result.stemRelations.some(r => r.includes('\uC815\uC784\uD569'))).toBe(true);
  });

  it('MU-GYE hap detected', () => {
    const result = analyzeDaeunSaeunInteraction(Cheongan.MU, Jiji.JIN, Cheongan.GYE, Jiji.HAE);
    expect(result.stemRelations.some(r => r.includes('\uBB34\uACC4\uD569'))).toBe(true);
  });

  it('reverse direction: GI-GAP hap detected', () => {
    const result = analyzeDaeunSaeunInteraction(Cheongan.GI, Jiji.SA, Cheongan.GAP, Jiji.IN);
    expect(result.stemRelations.some(r => r.includes('\uAC11\uAE30\uD569'))).toBe(true);
  });
});

// =========================================================================
// Part 2b: Daeun-Saeun stem chung expanded matrix
// =========================================================================

describe('Daeun-Saeun cheongan chung', () => {
  it('GAP-GYEONG chung detected', () => {
    const result = analyzeDaeunSaeunInteraction(Cheongan.GAP, Jiji.IN, Cheongan.GYEONG, Jiji.SIN);
    expect(result.stemRelations.some(r => r.includes('\uAC11\uACBD\uCDA9'))).toBe(true);
  });

  it('EUL-SIN chung detected', () => {
    const result = analyzeDaeunSaeunInteraction(Cheongan.EUL, Jiji.MYO, Cheongan.SIN, Jiji.YU);
    expect(result.stemRelations.some(r => r.includes('\uC744\uC2E0\uCDA9'))).toBe(true);
  });

  it('BYEONG-IM chung detected', () => {
    const result = analyzeDaeunSaeunInteraction(Cheongan.BYEONG, Jiji.O, Cheongan.IM, Jiji.JA);
    expect(result.stemRelations.some(r => r.includes('\uBCD1\uC784\uCDA9'))).toBe(true);
  });

  it('JEONG-GYE chung detected', () => {
    const result = analyzeDaeunSaeunInteraction(Cheongan.JEONG, Jiji.SA, Cheongan.GYE, Jiji.HAE);
    expect(result.stemRelations.some(r => r.includes('\uC815\uACC4\uCDA9'))).toBe(true);
  });

  it('reverse direction: GYEONG-GAP chung detected', () => {
    const result = analyzeDaeunSaeunInteraction(Cheongan.GYEONG, Jiji.SIN, Cheongan.GAP, Jiji.IN);
    expect(result.stemRelations.some(r => r.includes('\uAC11\uACBD\uCDA9'))).toBe(true);
  });
});

// =========================================================================
// Part 2c: Daeun-Saeun branch interaction expanded matrix
// =========================================================================

describe('Daeun-Saeun jiji interactions', () => {
  // --- chung (clash) ---
  it('JA-O chung detected', () => {
    const result = analyzeDaeunSaeunBranchInteraction(Jiji.JA, Jiji.O);
    expect(result.branchRelations.some(r => r.includes('\uC790\uC624\uCDA9'))).toBe(true);
  });

  it('IN-SIN chung detected', () => {
    const result = analyzeDaeunSaeunBranchInteraction(Jiji.IN, Jiji.SIN);
    expect(result.branchRelations.some(r => r.includes('\uC778\uC2E0\uCDA9'))).toBe(true);
  });

  // --- yukhap (six combination) ---
  it('JA-CHUK hap detected', () => {
    const result = analyzeDaeunSaeunBranchInteraction(Jiji.JA, Jiji.CHUK);
    expect(result.branchRelations.some(r => r.includes('\uC790\uCD95\uD569'))).toBe(true);
  });

  it('IN-HAE hap detected', () => {
    const result = analyzeDaeunSaeunBranchInteraction(Jiji.IN, Jiji.HAE);
    expect(result.branchRelations.some(r => r.includes('\uC778\uD574\uD569'))).toBe(true);
  });

  it('MYO-SUL hap detected', () => {
    const result = analyzeDaeunSaeunBranchInteraction(Jiji.MYO, Jiji.SUL);
    expect(result.branchRelations.some(r => r.includes('\uBB18\uC220\uD569'))).toBe(true);
  });

  // --- hyeong (punishment) ---
  it('IN-SA hyeong detected', () => {
    const result = analyzeDaeunSaeunBranchInteraction(Jiji.IN, Jiji.SA);
    expect(
      result.branchRelations.some(r =>
        r.includes('\uC778\uC0AC\uD615') || r.includes('\uC778\uC0AC\uD574'),
      ),
    ).toBe(true);
  });

  it('JA-MYO hyeong detected', () => {
    const result = analyzeDaeunSaeunBranchInteraction(Jiji.JA, Jiji.MYO);
    expect(result.branchRelations.some(r => r.includes('\uC790\uBB18\uD615'))).toBe(true);
  });

  it('CHUK-MI hyeong detected', () => {
    const result = analyzeDaeunSaeunBranchInteraction(Jiji.CHUK, Jiji.MI);
    expect(result.branchRelations.some(r => r.includes('\uCD95\uBBF8\uD615'))).toBe(true);
  });

  // --- pa (destruction) ---
  it('JA-YU pa detected', () => {
    const result = analyzeDaeunSaeunBranchInteraction(Jiji.JA, Jiji.YU);
    expect(result.branchRelations.some(r => r.includes('\uC790\uC720\uD30C'))).toBe(true);
  });

  // --- hae (harm) ---
  it('JA-MI hae detected', () => {
    const result = analyzeDaeunSaeunBranchInteraction(Jiji.JA, Jiji.MI);
    expect(result.branchRelations.some(r => r.includes('\uC790\uBBF8\uD574'))).toBe(true);
  });

  it('YU-SUL hae detected', () => {
    const result = analyzeDaeunSaeunBranchInteraction(Jiji.YU, Jiji.SUL);
    expect(result.branchRelations.some(r => r.includes('\uC720\uC220\uD574'))).toBe(true);
  });

  // --- no relation ---
  it('IN-O has no direct relation', () => {
    const result = analyzeDaeunSaeunBranchInteraction(Jiji.IN, Jiji.O);
    const inORelations = result.branchRelations.filter(r =>
      (r.includes('\uC778') && r.includes('\uC624')) ||
      (r.includes('\u5BC5') && r.includes('\u5348')),
    );
    expect(inORelations.length).toBe(0);
  });
});

// =========================================================================
// Part 2d: Complex interactions
// =========================================================================

describe('Daeun-Saeun complex interactions', () => {
  it('stem hap and branch chung simultaneous', () => {
    // Daeun GAP-JA, Saeun GI-O: stem=gapgi hap, branch=jao chung
    const dayMaster = Cheongan.BYEONG;
    const neutralNatal = new PillarSet(
      new Pillar(Cheongan.JEONG, Jiji.JIN),
      new Pillar(Cheongan.JEONG, Jiji.JIN),
      new Pillar(dayMaster, Jiji.JIN),
      new Pillar(Cheongan.JEONG, Jiji.JIN),
    );
    const saeunPillars: SaeunPillar[] = [
      { year: 2025, pillar: new Pillar(Cheongan.GI, Jiji.O) },
    ];

    const result = LuckInteractionAnalyzer.analyzeSaeun(
      saeunPillars,
      neutralNatal,
      new Pillar(Cheongan.GAP, Jiji.JA),
      dayMaster,
      null,
      null,
    )[0]!;

    expect(result.stemRelations.some(r => r.includes('\uAC11\uAE30\uD569'))).toBe(true);
    expect(result.branchRelations.some(r => r.includes('\uC790\uC624\uCDA9'))).toBe(true);
  });

  it('stem chung and branch hap simultaneous', () => {
    // Daeun GAP-JA, Saeun GYEONG-CHUK: stem=gap-gyeong chung, branch=ja-chuk hap
    const dayMaster = Cheongan.BYEONG;
    const neutralNatal = new PillarSet(
      new Pillar(Cheongan.JEONG, Jiji.JIN),
      new Pillar(Cheongan.JEONG, Jiji.JIN),
      new Pillar(dayMaster, Jiji.JIN),
      new Pillar(Cheongan.JEONG, Jiji.JIN),
    );
    const saeunPillars: SaeunPillar[] = [
      { year: 2025, pillar: new Pillar(Cheongan.GYEONG, Jiji.CHUK) },
    ];

    const result = LuckInteractionAnalyzer.analyzeSaeun(
      saeunPillars,
      neutralNatal,
      new Pillar(Cheongan.GAP, Jiji.JA),
      dayMaster,
      null,
      null,
    )[0]!;

    expect(result.stemRelations.some(r => r.includes('\uAC11\uACBD\uCDA9'))).toBe(true);
    expect(result.branchRelations.some(r => r.includes('\uC790\uCD95\uD569'))).toBe(true);
  });

  it('yongshin match + hap = VERY_FAVORABLE', () => {
    // Daeun GAP-IN, Saeun GI-HAE: stem=gapgi hap, branch=inhae hap
    // Saeun GI=EARTH, HAE=WATER. Yongshin EARTH -> match
    const dayMaster = Cheongan.BYEONG;
    const neutralNatal = new PillarSet(
      new Pillar(Cheongan.JEONG, Jiji.JIN),
      new Pillar(Cheongan.JEONG, Jiji.JIN),
      new Pillar(dayMaster, Jiji.JIN),
      new Pillar(Cheongan.JEONG, Jiji.JIN),
    );
    const saeunPillars: SaeunPillar[] = [
      { year: 2025, pillar: new Pillar(Cheongan.GI, Jiji.HAE) },
    ];

    const result = LuckInteractionAnalyzer.analyzeSaeun(
      saeunPillars,
      neutralNatal,
      new Pillar(Cheongan.GAP, Jiji.IN),
      dayMaster,
      Ohaeng.EARTH,
      Ohaeng.METAL,
    )[0]!;

    expect(result.stemRelations.some(r => r.includes('\uAC11\uAE30\uD569'))).toBe(true);
    expect(result.branchRelations.some(r => r.includes('\uC778\uD574\uD569'))).toBe(true);
    expect(result.isYongshinElement).toBe(true);
    expect(result.quality).toBe(LuckQuality.VERY_FAVORABLE);
  });

  it('gisin match + chung = VERY_UNFAVORABLE', () => {
    // Daeun GAP-JA, Saeun GYEONG-O: stem=gap-gyeong chung, branch=jao chung
    // Saeun GYEONG=METAL. Gisin METAL -> match
    const dayMaster = Cheongan.BYEONG;
    const neutralNatal = new PillarSet(
      new Pillar(Cheongan.JEONG, Jiji.JIN),
      new Pillar(Cheongan.JEONG, Jiji.JIN),
      new Pillar(dayMaster, Jiji.JIN),
      new Pillar(Cheongan.JEONG, Jiji.JIN),
    );
    const saeunPillars: SaeunPillar[] = [
      { year: 2025, pillar: new Pillar(Cheongan.GYEONG, Jiji.O) },
    ];

    const result = LuckInteractionAnalyzer.analyzeSaeun(
      saeunPillars,
      neutralNatal,
      new Pillar(Cheongan.GAP, Jiji.JA),
      dayMaster,
      Ohaeng.WATER,
      Ohaeng.METAL,
    )[0]!;

    expect(result.stemRelations.some(r => r.includes('\uAC11\uACBD\uCDA9'))).toBe(true);
    expect(result.branchRelations.some(r => r.includes('\uC790\uC624\uCDA9'))).toBe(true);
    expect(result.isGisinElement).toBe(true);
    expect(result.quality).toBe(LuckQuality.VERY_UNFAVORABLE);
  });

  it('no daeun: saeun only analysis has no daeun-specific relations', () => {
    const dayMaster = Cheongan.BYEONG;
    const neutralNatal = new PillarSet(
      new Pillar(Cheongan.JEONG, Jiji.JIN),
      new Pillar(Cheongan.JEONG, Jiji.JIN),
      new Pillar(dayMaster, Jiji.JIN),
      new Pillar(Cheongan.JEONG, Jiji.JIN),
    );
    const saeunPillars: SaeunPillar[] = [
      { year: 2025, pillar: new Pillar(Cheongan.GI, Jiji.O) },
    ];

    const result = LuckInteractionAnalyzer.analyzeSaeun(
      saeunPillars,
      neutralNatal,
      null, // no daeun
      dayMaster,
      null,
      null,
    )[0]!;

    // gapgi hap only happens when daeun is GAP -> with no daeun, not detected
    expect(result.stemRelations.some(r => r.includes('\uAC11\uAE30\uD569'))).toBe(false);
  });
});
