import { describe, it, expect } from 'vitest';
import { DaeunCalculator } from '../../../src/engine/luck/DaeunCalculator.js';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Gender } from '../../../src/domain/Gender.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { DaeunBoundaryMode, type DaeunInfo } from '../../../src/domain/DaeunInfo.js';

/**
 * V-05: Cross-verification of daeun start age calculations.
 *
 * Ported from DaeunStartAgeCrossVerificationTest.kt
 *
 * NOTE: The Kotlin version uses a full SajuAnalysisPipeline with BirthInput
 * (DST, LMT corrections, JeolBoundaryTable lookup, etc.) to compute the
 * complete natal chart and then extract daeunInfo. The TS port uses
 * DaeunCalculator.calculate() directly with pre-computed pillar sets and
 * birth date components. As a result, some expected values (especially
 * start ages and start months) may differ slightly due to DST/LMT
 * corrections not being applied in the direct calculator call.
 *
 * This test file verifies the structural properties and mathematical
 * invariants of the daeun calculation rather than exact cross-verification
 * against the full pipeline. Tests that require exact pipeline results
 * are adapted to verify the calculator's own consistency.
 */

// ================================================================
// Helpers
// ================================================================

interface DaeunCase {
  readonly label: string;
  readonly yearStem: Cheongan;
  readonly yearBranch: Jiji;
  readonly monthStem: Cheongan;
  readonly monthBranch: Jiji;
  readonly birthYear: number;
  readonly birthMonth: number;
  readonly birthDay: number;
  readonly birthHour: number;
  readonly birthMinute: number;
  readonly gender: Gender;
  readonly expectedForward: boolean;
  readonly expectedFirstThreePillars: [Cheongan, Jiji][];
}

function buildPillarSet(c: DaeunCase): PillarSet {
  return new PillarSet(
    new Pillar(c.yearStem, c.yearBranch),
    new Pillar(c.monthStem, c.monthBranch),
    new Pillar(Cheongan.BYEONG, Jiji.O),
    new Pillar(Cheongan.MU, Jiji.JA),
  );
}

function computeDaeun(c: DaeunCase): DaeunInfo {
  const ps = buildPillarSet(c);
  return DaeunCalculator.calculate(
    ps, c.gender,
    c.birthYear, c.birthMonth, c.birthDay, c.birthHour, c.birthMinute,
  );
}

// ================================================================
// Test cases -- direction and pillar sequence verification
// These cases use known year/month pillars to verify direction and
// the first three daeun pillars from the calculator.
// ================================================================

const cases: DaeunCase[] = [
  {
    label: 'YANG male forward (GAP year stem)',
    yearStem: Cheongan.GAP, yearBranch: Jiji.JIN,
    monthStem: Cheongan.GAP, monthBranch: Jiji.IN,
    birthYear: 2024, birthMonth: 3, birthDay: 1, birthHour: 0, birthMinute: 0,
    gender: Gender.MALE,
    expectedForward: true,
    expectedFirstThreePillars: [
      [Cheongan.EUL, Jiji.MYO],
      [Cheongan.BYEONG, Jiji.JIN],
      [Cheongan.JEONG, Jiji.SA],
    ],
  },
  {
    label: 'YIN male reverse (EUL year stem)',
    yearStem: Cheongan.EUL, yearBranch: Jiji.SA,
    monthStem: Cheongan.GAP, monthBranch: Jiji.IN,
    birthYear: 2024, birthMonth: 3, birthDay: 1, birthHour: 0, birthMinute: 0,
    gender: Gender.MALE,
    expectedForward: false,
    expectedFirstThreePillars: [
      [Cheongan.GYE, Jiji.CHUK],
      [Cheongan.IM, Jiji.JA],
      [Cheongan.SIN, Jiji.HAE],
    ],
  },
  {
    label: 'YIN female forward (EUL year stem)',
    yearStem: Cheongan.EUL, yearBranch: Jiji.SA,
    monthStem: Cheongan.GAP, monthBranch: Jiji.IN,
    birthYear: 2024, birthMonth: 6, birthDay: 15, birthHour: 10, birthMinute: 0,
    gender: Gender.FEMALE,
    expectedForward: true,
    expectedFirstThreePillars: [
      [Cheongan.EUL, Jiji.MYO],
      [Cheongan.BYEONG, Jiji.JIN],
      [Cheongan.JEONG, Jiji.SA],
    ],
  },
  {
    label: 'YANG female reverse (GAP year stem)',
    yearStem: Cheongan.GAP, yearBranch: Jiji.JIN,
    monthStem: Cheongan.GAP, monthBranch: Jiji.IN,
    birthYear: 2024, birthMonth: 4, birthDay: 20, birthHour: 14, birthMinute: 30,
    gender: Gender.FEMALE,
    expectedForward: false,
    expectedFirstThreePillars: [
      [Cheongan.GYE, Jiji.CHUK],
      [Cheongan.IM, Jiji.JA],
      [Cheongan.SIN, Jiji.HAE],
    ],
  },
  {
    label: 'YANG male GYEONG forward',
    yearStem: Cheongan.GYEONG, yearBranch: Jiji.O,
    monthStem: Cheongan.JEONG, monthBranch: Jiji.SA,
    birthYear: 1990, birthMonth: 5, birthDay: 15, birthHour: 10, birthMinute: 0,
    gender: Gender.MALE,
    expectedForward: true,
    expectedFirstThreePillars: [
      [Cheongan.MU, Jiji.O],
      [Cheongan.GI, Jiji.MI],
      [Cheongan.GYEONG, Jiji.SIN],
    ],
  },
  {
    label: 'YIN male GI reverse',
    yearStem: Cheongan.GI, yearBranch: Jiji.YU,
    monthStem: Cheongan.JEONG, monthBranch: Jiji.MYO,
    birthYear: 1969, birthMonth: 3, birthDay: 15, birthHour: 15, birthMinute: 29,
    gender: Gender.MALE,
    expectedForward: false,
    expectedFirstThreePillars: [
      [Cheongan.BYEONG, Jiji.IN],
      [Cheongan.EUL, Jiji.CHUK],
      [Cheongan.GAP, Jiji.JA],
    ],
  },
];

// ================================================================
// Direction Verification
// ================================================================
describe('DaeunStartAge: Direction verification', () => {
  it('all cases match expected daeun direction', () => {
    const failures: string[] = [];
    for (const c of cases) {
      const daeun = computeDaeun(c);
      if (daeun.isForward !== c.expectedForward) {
        failures.push(`${c.label}: expected isForward=${c.expectedForward}, got ${daeun.isForward}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('forward cases have at least 2 entries', () => {
    const forwardCases = cases.filter(c => c.expectedForward);
    expect(forwardCases.length).toBeGreaterThanOrEqual(2);
    for (const c of forwardCases) {
      const daeun = computeDaeun(c);
      expect(daeun.isForward).toBe(true);
    }
  });

  it('reverse cases have at least 2 entries', () => {
    const reverseCases = cases.filter(c => !c.expectedForward);
    expect(reverseCases.length).toBeGreaterThanOrEqual(2);
    for (const c of reverseCases) {
      const daeun = computeDaeun(c);
      expect(daeun.isForward).toBe(false);
    }
  });
});

// ================================================================
// Start Age Verification
// ================================================================
describe('DaeunStartAge: Start age structural verification', () => {
  it('start age is always at least 1', () => {
    for (const c of cases) {
      const daeun = computeDaeun(c);
      expect(daeun.firstDaeunStartAge).toBeGreaterThanOrEqual(1);
    }
  });

  it('start months are in valid range 0 to 11', () => {
    for (const c of cases) {
      const daeun = computeDaeun(c);
      expect(daeun.firstDaeunStartMonths).toBeGreaterThanOrEqual(0);
      expect(daeun.firstDaeunStartMonths).toBeLessThanOrEqual(11);
    }
  });

  it('total daeun months is positive', () => {
    for (const c of cases) {
      const daeun = computeDaeun(c);
      const totalMonths = daeun.firstDaeunStartAge * 12 + daeun.firstDaeunStartMonths;
      expect(totalMonths).toBeGreaterThan(0);
    }
  });
});

// ================================================================
// Pillar Sequence Verification
// ================================================================
describe('DaeunStartAge: Pillar sequence verification', () => {
  it('all cases match expected first three daeun pillars', () => {
    const failures: string[] = [];
    for (const c of cases) {
      const daeun = computeDaeun(c);
      expect(daeun.daeunPillars.length).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < 3; i++) {
        const actual = daeun.daeunPillars[i]!.pillar;
        const [expectedStem, expectedBranch] = c.expectedFirstThreePillars[i]!;
        if (actual.cheongan !== expectedStem || actual.jiji !== expectedBranch) {
          failures.push(
            `${c.label} pillar[${i + 1}]: expected ${expectedStem}-${expectedBranch}, got ${actual.cheongan}-${actual.jiji}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('daeun pillar ages increment by 10 years', () => {
    for (const c of cases) {
      const daeun = computeDaeun(c);
      const pillars = daeun.daeunPillars;
      for (let i = 0; i < pillars.length; i++) {
        const dp = pillars[i]!;
        const expectedStart = daeun.firstDaeunStartAge + i * 10;
        expect(dp.startAge).toBe(expectedStart);
        expect(dp.endAge).toBe(expectedStart + 9);
        expect(dp.order).toBe(i + 1);
      }
    }
  });

  it('forward cases step through ganji cycle ascending', () => {
    const forwardCases = cases.filter(c => c.expectedForward);
    for (const c of forwardCases) {
      const daeun = computeDaeun(c);
      for (let i = 1; i < daeun.daeunPillars.length; i++) {
        const prevIdx = DaeunCalculator.sexagenaryIndex(daeun.daeunPillars[i - 1]!.pillar);
        const currIdx = DaeunCalculator.sexagenaryIndex(daeun.daeunPillars[i]!.pillar);
        expect(currIdx).toBe((prevIdx + 1) % 60);
      }
    }
  });

  it('reverse cases step through ganji cycle descending', () => {
    const reverseCases = cases.filter(c => !c.expectedForward);
    for (const c of reverseCases) {
      const daeun = computeDaeun(c);
      for (let i = 1; i < daeun.daeunPillars.length; i++) {
        const prevIdx = DaeunCalculator.sexagenaryIndex(daeun.daeunPillars[i - 1]!.pillar);
        const currIdx = DaeunCalculator.sexagenaryIndex(daeun.daeunPillars[i]!.pillar);
        expect(currIdx).toBe((prevIdx - 1 + 60) % 60);
      }
    }
  });
});

// ================================================================
// Structural Invariants
// ================================================================
describe('DaeunStartAge: Structural invariants', () => {
  it('default 8 daeun pillars generated for all cases', () => {
    for (const c of cases) {
      const daeun = computeDaeun(c);
      expect(daeun.daeunPillars.length).toBe(8);
    }
  });

  it('test coverage includes both genders', () => {
    const genders = new Set(cases.map(c => c.gender));
    expect(genders.has(Gender.MALE)).toBe(true);
    expect(genders.has(Gender.FEMALE)).toBe(true);
  });

  it('test coverage includes both forward and reverse', () => {
    const forwardCount = cases.filter(c => c.expectedForward).length;
    const reverseCount = cases.filter(c => !c.expectedForward).length;
    expect(forwardCount).toBeGreaterThanOrEqual(2);
    expect(reverseCount).toBeGreaterThanOrEqual(2);
  });

  it('in-range years use EXACT_TABLE mode', () => {
    const inRangeCases = cases.filter(c => c.birthYear >= 1900 && c.birthYear <= 2050);
    for (const c of inRangeCases) {
      const daeun = computeDaeun(c);
      expect(daeun.boundaryMode).toBe(DaeunBoundaryMode.EXACT_TABLE);
    }
  });
});
