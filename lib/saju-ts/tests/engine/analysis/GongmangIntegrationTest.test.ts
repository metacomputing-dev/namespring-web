import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput, type BirthInput } from '../../../src/domain/types.js';
import { Gender } from '../../../src/domain/Gender.js';
import { Cheongan, CHEONGAN_VALUES } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import { ANALYSIS_KEYS } from '../../../src/domain/SajuAnalysis.js';
import { DEFAULT_CONFIG } from '../../../src/config/CalculationConfig.js';
import {
  calculateGongmang,
  voidBranchesOf,
  sexagenaryIndex,
  type GongmangResult,
} from '../../../src/engine/analysis/GongmangCalculator.js';

/**
 * Integration tests for Gongmang (空亡/공망) detection within the full analysis pipeline.
 */

function birth(
  year: number, month: number, day: number,
  hour: number, minute: number,
  gender: Gender = Gender.MALE,
): BirthInput {
  return createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender, longitude: 126.978,
  });
}

// =========================================================================
// 1. Detection accuracy -- all 6 Xun groups
// =========================================================================

describe('Gongmang Detection Accuracy', () => {
  it('GAP-JA xun void is SUL, HAE', () => {
    const v = voidBranchesOf(new Pillar(Cheongan.GAP, Jiji.JA));
    expect(v).toEqual([Jiji.SUL, Jiji.HAE]);
  });

  it('GAP-SUL xun void is SIN, YU', () => {
    const v = voidBranchesOf(new Pillar(Cheongan.GAP, Jiji.SUL));
    expect(v).toEqual([Jiji.SIN, Jiji.YU]);
  });

  it('GAP-SIN xun void is O, MI', () => {
    const v = voidBranchesOf(new Pillar(Cheongan.GAP, Jiji.SIN));
    expect(v).toEqual([Jiji.O, Jiji.MI]);
  });

  it('GAP-O xun void is JIN, SA', () => {
    const v = voidBranchesOf(new Pillar(Cheongan.GAP, Jiji.O));
    expect(v).toEqual([Jiji.JIN, Jiji.SA]);
  });

  it('GAP-JIN xun void is IN, MYO', () => {
    const v = voidBranchesOf(new Pillar(Cheongan.GAP, Jiji.JIN));
    expect(v).toEqual([Jiji.IN, Jiji.MYO]);
  });

  it('GAP-IN xun void is JA, CHUK', () => {
    const v = voidBranchesOf(new Pillar(Cheongan.GAP, Jiji.IN));
    expect(v).toEqual([Jiji.JA, Jiji.CHUK]);
  });
});

// =========================================================================
// 2. Parametric: representative pillar from each Xun
// =========================================================================

describe('Gongmang Parametric Xun Tests', () => {
  const cases: [Pillar, Jiji, Jiji, string][] = [
    [new Pillar(Cheongan.BYEONG, Jiji.IN), Jiji.SUL, Jiji.HAE, 'GAP-JA xun: byeong-in (index 2)'],
    [new Pillar(Cheongan.EUL, Jiji.HAE), Jiji.SIN, Jiji.YU, 'GAP-SUL xun: eul-hae (index 11)'],
    [new Pillar(Cheongan.MU, Jiji.JA), Jiji.O, Jiji.MI, 'GAP-SIN xun: mu-ja (index 24)'],
    [new Pillar(Cheongan.GI, Jiji.HAE), Jiji.JIN, Jiji.SA, 'GAP-O xun: gi-hae (index 35)'],
    [new Pillar(Cheongan.BYEONG, Jiji.O), Jiji.IN, Jiji.MYO, 'GAP-JIN xun: byeong-o (index 42)'],
    [new Pillar(Cheongan.IM, Jiji.SUL), Jiji.JA, Jiji.CHUK, 'GAP-IN xun: im-sul (index 58)'],
  ];

  it.each(cases)('representative pillar %s produces correct voids', (pillar, v1, v2, desc) => {
    const v = voidBranchesOf(pillar);
    expect(v[0], `${desc}: void1`).toBe(v1);
    expect(v[1], `${desc}: void2`).toBe(v2);
  });
});

// =========================================================================
// 3. Pipeline integration
// =========================================================================

describe('Gongmang Pipeline Integration', () => {
  it('analysis contains gongmang void branches', () => {
    const analysis = analyzeSaju(birth(1990, 5, 15, 14, 30));
    expect(analysis.gongmangVoidBranches).not.toBeNull();
    const [void1, void2] = analysis.gongmangVoidBranches!;
    expect(JIJI_VALUES).toContain(void1);
    expect(JIJI_VALUES).toContain(void2);
    expect(void1).not.toBe(void2);
  });

  it('analysisResults map contains GongmangResult', () => {
    const analysis = analyzeSaju(birth(1990, 5, 15, 14, 30));
    const gongmang = analysis.analysisResults.get(ANALYSIS_KEYS.GONGMANG) as GongmangResult | undefined;
    expect(gongmang).toBeDefined();
    expect(gongmang!.voidBranches).toBeDefined();
  });

  it('gongmang void branches match GongmangResult in map', () => {
    const analysis = analyzeSaju(birth(1990, 5, 15, 14, 30));
    const fromField = analysis.gongmangVoidBranches;
    const fromMap = analysis.analysisResults.get(ANALYSIS_KEYS.GONGMANG) as GongmangResult;
    expect(fromField).toEqual(fromMap.voidBranches);
  });

  it('trace contains gongmang step', () => {
    const analysis = analyzeSaju(birth(1990, 5, 15, 14, 30));
    const gongmangTrace = analysis.trace.find(t => t.key === ANALYSIS_KEYS.GONGMANG);
    expect(gongmangTrace).toBeDefined();
    expect(gongmangTrace!.summary).toContain('공망');
  });

  it('gongmang void branches consistent with day pillar', () => {
    const analysis = analyzeSaju(birth(1990, 5, 15, 14, 30));
    const dayPillar = analysis.pillars.day;
    const expectedVoid = voidBranchesOf(dayPillar);
    expect(analysis.gongmangVoidBranches).toEqual(expectedVoid);
  });
});

// =========================================================================
// 4. Position impact
// =========================================================================

describe('Gongmang Position Impact', () => {
  it('day branch is never reported as affected', () => {
    const dates = [
      birth(1990, 5, 15, 14, 30),
      birth(1982, 9, 3, 8, 0),
      birth(1995, 8, 20, 23, 15),
      birth(2010, 1, 1, 0, 0),
      birth(1986, 4, 19, 5, 45),
    ];

    for (const input of dates) {
      const analysis = analyzeSaju(input);
      const gongmang = analysis.analysisResults.get(ANALYSIS_KEYS.GONGMANG) as GongmangResult;
      expect(
        gongmang.affectedPositions.every(h => h.position !== PillarPosition.DAY),
      ).toBe(true);
    }
  });

  it('maximum three positions can be affected', () => {
    const dates = [
      birth(1990, 5, 15, 14, 30),
      birth(1968, 5, 5, 11, 0),
      birth(1985, 6, 21, 9, 0, Gender.FEMALE),
      birth(1977, 1, 25, 3, 0),
      birth(2001, 8, 1, 0, 2),
    ];

    for (const input of dates) {
      const analysis = analyzeSaju(input);
      const gongmang = analysis.analysisResults.get(ANALYSIS_KEYS.GONGMANG) as GongmangResult;
      expect(gongmang.affectedPositions.length).toBeLessThanOrEqual(3);
    }
  });

  it('all affected branches are void branches', () => {
    const dates = [
      birth(1990, 5, 15, 14, 30),
      birth(1968, 5, 5, 11, 0),
      birth(1985, 6, 21, 9, 0),
      birth(1973, 11, 8, 16, 0),
      birth(2024, 2, 4, 5, 30),
    ];

    for (const input of dates) {
      const analysis = analyzeSaju(input);
      const gongmang = analysis.analysisResults.get(ANALYSIS_KEYS.GONGMANG) as GongmangResult;
      const [void1, void2] = gongmang.voidBranches;

      for (const h of gongmang.affectedPositions) {
        expect(h.branch === void1 || h.branch === void2).toBe(true);
      }
    }
  });

  it('no affected positions when no branch matches void', () => {
    const ps = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JIN),
      new Pillar(Cheongan.EUL, Jiji.MYO),
      new Pillar(Cheongan.GAP, Jiji.JA),  // void = SUL, HAE
      new Pillar(Cheongan.BYEONG, Jiji.IN),
    );
    const result = calculateGongmang(ps);
    expect(result.affectedPositions.length).toBe(0);
  });
});

// =========================================================================
// 5. Restoration (해공) logic
// =========================================================================

describe('Gongmang Restoration Logic', () => {
  it('restoration by chung is detected', () => {
    const ps = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.SUL),
      new Pillar(Cheongan.GAP, Jiji.JIN),
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
    );
    const result = calculateGongmang(ps);
    const yearHit = result.affectedPositions.find(h => h.position === PillarPosition.YEAR);
    expect(yearHit).toBeDefined();
    expect(yearHit!.isRestored).toBe(true);
    expect(yearHit!.restorationNote).toBe('충으로 해공');
  });

  it('restoration by hap is detected', () => {
    const ps = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.SUL),
      new Pillar(Cheongan.EUL, Jiji.MYO),
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
    );
    const result = calculateGongmang(ps);
    const yearHit = result.affectedPositions.find(h => h.position === PillarPosition.YEAR);
    expect(yearHit).toBeDefined();
    expect(yearHit!.isRestored).toBe(true);
    expect(yearHit!.restorationNote).toBe('합으로 해공');
  });

  it('restoration by hyeong is detected', () => {
    const ps = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.SUL),
      new Pillar(Cheongan.EUL, Jiji.CHUK),
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
    );
    const result = calculateGongmang(ps);
    const yearHit = result.affectedPositions.find(h => h.position === PillarPosition.YEAR);
    expect(yearHit).toBeDefined();
    expect(yearHit!.isRestored).toBe(true);
    expect(yearHit!.restorationNote).toBe('형으로 해공');
  });

  it('restoration priority is chung over hyeong over hap', () => {
    const ps = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.SUL),
      new Pillar(Cheongan.GAP, Jiji.JIN),  // chung
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.EUL, Jiji.CHUK), // hyeong
    );
    const result = calculateGongmang(ps);
    const yearHit = result.affectedPositions.find(h => h.position === PillarPosition.YEAR);
    expect(yearHit).toBeDefined();
    expect(yearHit!.restorationNote).toBe('충으로 해공');
  });

  it('no restoration when no relating branch present', () => {
    const ps = new PillarSet(
      new Pillar(Cheongan.EUL, Jiji.HAE),
      new Pillar(Cheongan.EUL, Jiji.MYO),
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.O),
    );
    const result = calculateGongmang(ps);
    const yearHit = result.affectedPositions.find(h => h.position === PillarPosition.YEAR);
    expect(yearHit).toBeDefined();
    expect(yearHit!.isRestored).toBe(false);
    expect(yearHit!.restorationNote).toBe('');
  });
});

// =========================================================================
// 6. Sexagenary index cross-validation
// =========================================================================

describe('Gongmang Sexagenary Index Cross-Validation', () => {
  it('all sixty pillars map to distinct indices', () => {
    const indices = new Set<number>();
    for (let s = 0; s < 10; s++) {
      for (let b = 0; b < 12; b++) {
        if (s % 2 !== b % 2) continue;
        const pillar = new Pillar(CHEONGAN_VALUES[s]!, JIJI_VALUES[b]!);
        const idx = sexagenaryIndex(pillar);
        expect(indices.has(idx)).toBe(false);
        indices.add(idx);
      }
    }
    expect(indices.size).toBe(60);
  });

  it('each xun group contains exactly ten consecutive indices', () => {
    for (const xunStart of [0, 10, 20, 30, 40, 50]) {
      const xunPillars = Array.from({ length: 10 }, (_, k) => {
        const i = xunStart + k;
        return new Pillar(CHEONGAN_VALUES[i % 10]!, JIJI_VALUES[i % 12]!);
      });
      const firstVoid = voidBranchesOf(xunPillars[0]!);
      for (const pillar of xunPillars) {
        expect(voidBranchesOf(pillar)).toEqual(firstVoid);
      }
    }
  });

  it('void branches partition all twelve branches', () => {
    const xunStarts = [
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.SUL),
      new Pillar(Cheongan.GAP, Jiji.SIN),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.GAP, Jiji.JIN),
      new Pillar(Cheongan.GAP, Jiji.IN),
    ];
    const allVoidBranches: Jiji[] = [];
    for (const start of xunStarts) {
      const [v1, v2] = voidBranchesOf(start);
      allVoidBranches.push(v1, v2);
    }
    expect(allVoidBranches.length).toBe(12);
    expect(new Set(allVoidBranches).size).toBe(12);
  });
});

// =========================================================================
// 7. Diverse birth dates
// =========================================================================

describe('Gongmang Diverse Birth Dates', () => {
  it('gongmang is computed for various historical dates', () => {
    const dates = [
      birth(1916, 1, 6, 23, 59),
      birth(1969, 3, 15, 15, 29),
      birth(1986, 4, 19, 5, 45),
      birth(1991, 2, 18, 5, 25),
      birth(2001, 8, 1, 0, 2),
      birth(2010, 1, 1, 0, 0),
      birth(2022, 4, 6, 19, 0),
      birth(2025, 8, 26, 0, 30),
    ];

    for (const input of dates) {
      const analysis = analyzeSaju(input);
      expect(analysis.gongmangVoidBranches).not.toBeNull();
      const gongmang = analysis.analysisResults.get(ANALYSIS_KEYS.GONGMANG) as GongmangResult;
      expect(gongmang).toBeDefined();
      expect(gongmang.voidBranches[0]).not.toBe(gongmang.voidBranches[1]);
    }
  });

  it('male and female produce same gongmang for same birth moment', () => {
    const maleBirth = birth(1990, 5, 15, 14, 30, Gender.MALE);
    const femaleBirth = birth(1990, 5, 15, 14, 30, Gender.FEMALE);
    const maleAnalysis = analyzeSaju(maleBirth);
    const femaleAnalysis = analyzeSaju(femaleBirth);
    expect(maleAnalysis.gongmangVoidBranches).toEqual(femaleAnalysis.gongmangVoidBranches);
  });
});
