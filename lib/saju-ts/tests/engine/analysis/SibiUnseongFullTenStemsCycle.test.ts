import { describe, it, expect } from 'vitest';
import { calculateSibiUnseong } from '../../../src/engine/analysis/SibiUnseongCalculator.js';
import { Cheongan, CHEONGAN_VALUES, CHEONGAN_INFO } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, JIJI_INFO, jijiOrdinal } from '../../../src/domain/Jiji.js';
import { SibiUnseong, SIBI_UNSEONG_VALUES, SIBI_UNSEONG_INFO } from '../../../src/domain/SibiUnseong.js';
import { createConfig, EarthLifeStageRule } from '../../../src/config/CalculationConfig.js';

/**
 * Ported from SibiUnseongFullTenStemsCycleTest.kt (T-01).
 *
 * Full 12-stage life cycle verification for 5 stems:
 * GAP, EUL, GYEONG, SIN, GYE.
 *
 * Tests full cycles, bijection, contiguous traversal,
 * FOLLOW_WATER invariance, exhaustive completeness, and yang-yin symmetry.
 */

const stageOrder: SibiUnseong[] = [
  SibiUnseong.JANG_SAENG, SibiUnseong.MOK_YOK, SibiUnseong.GWAN_DAE,
  SibiUnseong.GEON_ROK, SibiUnseong.JE_WANG, SibiUnseong.SWOE,
  SibiUnseong.BYEONG, SibiUnseong.SA, SibiUnseong.MYO,
  SibiUnseong.JEOL, SibiUnseong.TAE, SibiUnseong.YANG,
];

function assertFullCycle(
  stem: Cheongan,
  expectedCycle: [Jiji, SibiUnseong][],
  config = createConfig({}),
): void {
  expect(expectedCycle.length).toBe(12);
  for (const [branch, stage] of expectedCycle) {
    expect(calculateSibiUnseong(stem, branch, config)).toBe(stage);
  }
}

// =========================================================================
// GAP (yang wood) -- forward from HAE
// =========================================================================

describe('GAP (yang wood)', () => {
  const expectedCycle: [Jiji, SibiUnseong][] = [
    [Jiji.HAE,  SibiUnseong.JANG_SAENG],
    [Jiji.JA,   SibiUnseong.MOK_YOK],
    [Jiji.CHUK, SibiUnseong.GWAN_DAE],
    [Jiji.IN,   SibiUnseong.GEON_ROK],
    [Jiji.MYO,  SibiUnseong.JE_WANG],
    [Jiji.JIN,  SibiUnseong.SWOE],
    [Jiji.SA,   SibiUnseong.BYEONG],
    [Jiji.O,    SibiUnseong.SA],
    [Jiji.MI,   SibiUnseong.MYO],
    [Jiji.SIN,  SibiUnseong.JEOL],
    [Jiji.YU,   SibiUnseong.TAE],
    [Jiji.SUL,  SibiUnseong.YANG],
  ];

  it('full forward cycle', () => {
    assertFullCycle(Cheongan.GAP, expectedCycle);
  });

  it('jangSaeng at HAE', () => {
    expect(calculateSibiUnseong(Cheongan.GAP, Jiji.HAE)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('jeWang at MYO', () => {
    expect(calculateSibiUnseong(Cheongan.GAP, Jiji.MYO)).toBe(SibiUnseong.JE_WANG);
  });

  it('myo at MI', () => {
    expect(calculateSibiUnseong(Cheongan.GAP, Jiji.MI)).toBe(SibiUnseong.MYO);
  });

  it('bijection: all 12 distinct stages', () => {
    const stages = new Set(JIJI_VALUES.map(b => calculateSibiUnseong(Cheongan.GAP, b)));
    expect(stages).toEqual(new Set(SIBI_UNSEONG_VALUES));
  });

  it('contiguous forward traversal', () => {
    const start = JIJI_VALUES.indexOf(Jiji.HAE);
    for (let k = 0; k < 12; k++) {
      const branch = JIJI_VALUES[(start + k) % 12]!;
      expect(calculateSibiUnseong(Cheongan.GAP, branch)).toBe(stageOrder[k]);
    }
  });
});

// =========================================================================
// EUL (yin wood) -- reverse from O
// =========================================================================

describe('EUL (yin wood)', () => {
  const expectedCycle: [Jiji, SibiUnseong][] = [
    [Jiji.O,    SibiUnseong.JANG_SAENG],
    [Jiji.SA,   SibiUnseong.MOK_YOK],
    [Jiji.JIN,  SibiUnseong.GWAN_DAE],
    [Jiji.MYO,  SibiUnseong.GEON_ROK],
    [Jiji.IN,   SibiUnseong.JE_WANG],
    [Jiji.CHUK, SibiUnseong.SWOE],
    [Jiji.JA,   SibiUnseong.BYEONG],
    [Jiji.HAE,  SibiUnseong.SA],
    [Jiji.SUL,  SibiUnseong.MYO],
    [Jiji.YU,   SibiUnseong.JEOL],
    [Jiji.SIN,  SibiUnseong.TAE],
    [Jiji.MI,   SibiUnseong.YANG],
  ];

  it('full reverse cycle', () => {
    assertFullCycle(Cheongan.EUL, expectedCycle);
  });

  it('jangSaeng at O', () => {
    expect(calculateSibiUnseong(Cheongan.EUL, Jiji.O)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('jeWang at IN', () => {
    expect(calculateSibiUnseong(Cheongan.EUL, Jiji.IN)).toBe(SibiUnseong.JE_WANG);
  });

  it('myo at SUL', () => {
    expect(calculateSibiUnseong(Cheongan.EUL, Jiji.SUL)).toBe(SibiUnseong.MYO);
  });

  it('bijection: all 12 distinct stages', () => {
    const stages = new Set(JIJI_VALUES.map(b => calculateSibiUnseong(Cheongan.EUL, b)));
    expect(stages).toEqual(new Set(SIBI_UNSEONG_VALUES));
  });

  it('contiguous backward traversal', () => {
    const start = JIJI_VALUES.indexOf(Jiji.O);
    for (let k = 0; k < 12; k++) {
      const branch = JIJI_VALUES[(start - k + 12) % 12]!;
      expect(calculateSibiUnseong(Cheongan.EUL, branch)).toBe(stageOrder[k]);
    }
  });
});

// =========================================================================
// GYEONG (yang metal) -- forward from SA
// =========================================================================

describe('GYEONG (yang metal)', () => {
  const expectedCycle: [Jiji, SibiUnseong][] = [
    [Jiji.SA,   SibiUnseong.JANG_SAENG],
    [Jiji.O,    SibiUnseong.MOK_YOK],
    [Jiji.MI,   SibiUnseong.GWAN_DAE],
    [Jiji.SIN,  SibiUnseong.GEON_ROK],
    [Jiji.YU,   SibiUnseong.JE_WANG],
    [Jiji.SUL,  SibiUnseong.SWOE],
    [Jiji.HAE,  SibiUnseong.BYEONG],
    [Jiji.JA,   SibiUnseong.SA],
    [Jiji.CHUK, SibiUnseong.MYO],
    [Jiji.IN,   SibiUnseong.JEOL],
    [Jiji.MYO,  SibiUnseong.TAE],
    [Jiji.JIN,  SibiUnseong.YANG],
  ];

  it('full forward cycle', () => {
    assertFullCycle(Cheongan.GYEONG, expectedCycle);
  });

  it('jangSaeng at SA', () => {
    expect(calculateSibiUnseong(Cheongan.GYEONG, Jiji.SA)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('jeWang at YU', () => {
    expect(calculateSibiUnseong(Cheongan.GYEONG, Jiji.YU)).toBe(SibiUnseong.JE_WANG);
  });

  it('myo at CHUK', () => {
    expect(calculateSibiUnseong(Cheongan.GYEONG, Jiji.CHUK)).toBe(SibiUnseong.MYO);
  });

  it('bijection: all 12 distinct stages', () => {
    const stages = new Set(JIJI_VALUES.map(b => calculateSibiUnseong(Cheongan.GYEONG, b)));
    expect(stages).toEqual(new Set(SIBI_UNSEONG_VALUES));
  });

  it('contiguous forward traversal', () => {
    const start = JIJI_VALUES.indexOf(Jiji.SA);
    for (let k = 0; k < 12; k++) {
      const branch = JIJI_VALUES[(start + k) % 12]!;
      expect(calculateSibiUnseong(Cheongan.GYEONG, branch)).toBe(stageOrder[k]);
    }
  });
});

// =========================================================================
// SIN (yin metal) -- reverse from JA
// =========================================================================

describe('SIN (yin metal)', () => {
  const expectedCycle: [Jiji, SibiUnseong][] = [
    [Jiji.JA,   SibiUnseong.JANG_SAENG],
    [Jiji.HAE,  SibiUnseong.MOK_YOK],
    [Jiji.SUL,  SibiUnseong.GWAN_DAE],
    [Jiji.YU,   SibiUnseong.GEON_ROK],
    [Jiji.SIN,  SibiUnseong.JE_WANG],
    [Jiji.MI,   SibiUnseong.SWOE],
    [Jiji.O,    SibiUnseong.BYEONG],
    [Jiji.SA,   SibiUnseong.SA],
    [Jiji.JIN,  SibiUnseong.MYO],
    [Jiji.MYO,  SibiUnseong.JEOL],
    [Jiji.IN,   SibiUnseong.TAE],
    [Jiji.CHUK, SibiUnseong.YANG],
  ];

  it('full reverse cycle', () => {
    assertFullCycle(Cheongan.SIN, expectedCycle);
  });

  it('jangSaeng at JA', () => {
    expect(calculateSibiUnseong(Cheongan.SIN, Jiji.JA)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('jeWang at SIN', () => {
    expect(calculateSibiUnseong(Cheongan.SIN, Jiji.SIN)).toBe(SibiUnseong.JE_WANG);
  });

  it('myo at JIN', () => {
    expect(calculateSibiUnseong(Cheongan.SIN, Jiji.JIN)).toBe(SibiUnseong.MYO);
  });

  it('bijection: all 12 distinct stages', () => {
    const stages = new Set(JIJI_VALUES.map(b => calculateSibiUnseong(Cheongan.SIN, b)));
    expect(stages).toEqual(new Set(SIBI_UNSEONG_VALUES));
  });

  it('contiguous backward traversal', () => {
    const start = JIJI_VALUES.indexOf(Jiji.JA);
    for (let k = 0; k < 12; k++) {
      const branch = JIJI_VALUES[(start - k + 12) % 12]!;
      expect(calculateSibiUnseong(Cheongan.SIN, branch)).toBe(stageOrder[k]);
    }
  });
});

// =========================================================================
// GYE (yin water) -- reverse from MYO
// =========================================================================

describe('GYE (yin water)', () => {
  const expectedCycle: [Jiji, SibiUnseong][] = [
    [Jiji.MYO,  SibiUnseong.JANG_SAENG],
    [Jiji.IN,   SibiUnseong.MOK_YOK],
    [Jiji.CHUK, SibiUnseong.GWAN_DAE],
    [Jiji.JA,   SibiUnseong.GEON_ROK],
    [Jiji.HAE,  SibiUnseong.JE_WANG],
    [Jiji.SUL,  SibiUnseong.SWOE],
    [Jiji.YU,   SibiUnseong.BYEONG],
    [Jiji.SIN,  SibiUnseong.SA],
    [Jiji.MI,   SibiUnseong.MYO],
    [Jiji.O,    SibiUnseong.JEOL],
    [Jiji.SA,   SibiUnseong.TAE],
    [Jiji.JIN,  SibiUnseong.YANG],
  ];

  it('full reverse cycle', () => {
    assertFullCycle(Cheongan.GYE, expectedCycle);
  });

  it('jangSaeng at MYO', () => {
    expect(calculateSibiUnseong(Cheongan.GYE, Jiji.MYO)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('jeWang at HAE', () => {
    expect(calculateSibiUnseong(Cheongan.GYE, Jiji.HAE)).toBe(SibiUnseong.JE_WANG);
  });

  it('myo at MI', () => {
    expect(calculateSibiUnseong(Cheongan.GYE, Jiji.MI)).toBe(SibiUnseong.MYO);
  });

  it('bijection: all 12 distinct stages', () => {
    const stages = new Set(JIJI_VALUES.map(b => calculateSibiUnseong(Cheongan.GYE, b)));
    expect(stages).toEqual(new Set(SIBI_UNSEONG_VALUES));
  });

  it('contiguous backward traversal', () => {
    const start = JIJI_VALUES.indexOf(Jiji.MYO);
    for (let k = 0; k < 12; k++) {
      const branch = JIJI_VALUES[(start - k + 12) % 12]!;
      expect(calculateSibiUnseong(Cheongan.GYE, branch)).toBe(stageOrder[k]);
    }
  });
});

// =========================================================================
// FOLLOW_WATER invariance: non-Earth stems are unaffected
// =========================================================================

describe('FOLLOW_WATER invariance', () => {
  const followWaterConfig = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_WATER });
  const nonEarthStems: Cheongan[] = [
    Cheongan.GAP, Cheongan.EUL, Cheongan.GYEONG, Cheongan.SIN, Cheongan.GYE,
  ];

  for (const stem of nonEarthStems) {
    it(`${stem} identical under FOLLOW_WATER`, () => {
      for (const branch of JIJI_VALUES) {
        expect(calculateSibiUnseong(stem, branch, followWaterConfig))
          .toBe(calculateSibiUnseong(stem, branch));
      }
    });
  }

  it('all 5 non-Earth stems invariant under FOLLOW_WATER (batch)', () => {
    for (const stem of nonEarthStems) {
      for (const branch of JIJI_VALUES) {
        expect(calculateSibiUnseong(stem, branch, followWaterConfig))
          .toBe(calculateSibiUnseong(stem, branch));
      }
    }
  });
});

// =========================================================================
// 10-stem exhaustive completeness: all 120 combinations valid
// =========================================================================

describe('exhaustive completeness', () => {
  it('all 120 combinations produce valid results', () => {
    let count = 0;
    for (const stem of CHEONGAN_VALUES) {
      for (const branch of JIJI_VALUES) {
        const result = calculateSibiUnseong(stem, branch);
        expect(SIBI_UNSEONG_VALUES).toContain(result);
        count++;
      }
    }
    expect(count).toBe(120);
  });

  it('every 10 stems has bijection', () => {
    for (const stem of CHEONGAN_VALUES) {
      const stages = new Set(JIJI_VALUES.map(b => calculateSibiUnseong(stem, b)));
      expect(stages.size).toBe(12);
      expect(stages).toEqual(new Set(SIBI_UNSEONG_VALUES));
    }
  });

  it('all 120 combinations valid under FOLLOW_WATER', () => {
    const config = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_WATER });
    for (const stem of CHEONGAN_VALUES) {
      for (const branch of JIJI_VALUES) {
        const result = calculateSibiUnseong(stem, branch, config);
        expect(SIBI_UNSEONG_VALUES).toContain(result);
      }
    }
  });
});

// =========================================================================
// Yang-Yin symmetry
// =========================================================================

describe('yang-yin symmetry', () => {
  function findBranchForStage(stem: Cheongan, stage: SibiUnseong): Jiji {
    return JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === stage)!;
  }

  it('GAP jangSaeng equals EUL sa', () => {
    expect(findBranchForStage(Cheongan.GAP, SibiUnseong.JANG_SAENG))
      .toBe(findBranchForStage(Cheongan.EUL, SibiUnseong.SA));
  });

  it('GYEONG jangSaeng equals SIN sa', () => {
    expect(findBranchForStage(Cheongan.GYEONG, SibiUnseong.JANG_SAENG))
      .toBe(findBranchForStage(Cheongan.SIN, SibiUnseong.SA));
  });

  it('IM jangSaeng equals GYE sa', () => {
    expect(findBranchForStage(Cheongan.IM, SibiUnseong.JANG_SAENG))
      .toBe(findBranchForStage(Cheongan.GYE, SibiUnseong.SA));
  });

  it('EUL jangSaeng equals GAP sa (converse)', () => {
    expect(findBranchForStage(Cheongan.EUL, SibiUnseong.JANG_SAENG))
      .toBe(findBranchForStage(Cheongan.GAP, SibiUnseong.SA));
  });

  it('SIN jangSaeng equals GYEONG sa (converse)', () => {
    expect(findBranchForStage(Cheongan.SIN, SibiUnseong.JANG_SAENG))
      .toBe(findBranchForStage(Cheongan.GYEONG, SibiUnseong.SA));
  });

  it('all 5 element pairs exhibit symmetry', () => {
    const pairs: [Cheongan, Cheongan][] = [
      [Cheongan.GAP, Cheongan.EUL],
      [Cheongan.BYEONG, Cheongan.JEONG],
      [Cheongan.MU, Cheongan.GI],
      [Cheongan.GYEONG, Cheongan.SIN],
      [Cheongan.IM, Cheongan.GYE],
    ];
    for (const [yang, yin] of pairs) {
      expect(findBranchForStage(yang, SibiUnseong.JANG_SAENG))
        .toBe(findBranchForStage(yin, SibiUnseong.SA));
    }
  });

  it('yang jeWang equals yin geonRok', () => {
    const pairs: [Cheongan, Cheongan][] = [
      [Cheongan.GAP, Cheongan.EUL],
      [Cheongan.GYEONG, Cheongan.SIN],
    ];
    for (const [yang, yin] of pairs) {
      expect(findBranchForStage(yang, SibiUnseong.JE_WANG))
        .toBe(findBranchForStage(yin, SibiUnseong.GEON_ROK));
    }
  });
});

// =========================================================================
// Directional properties
// =========================================================================

describe('directional properties', () => {
  function findBranchForStage(stem: Cheongan, stage: SibiUnseong): Jiji {
    return JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === stage)!;
  }

  it('yang stems proceed forward (mokYok = jangSaeng + 1)', () => {
    for (const stem of [Cheongan.GAP, Cheongan.GYEONG]) {
      const jsIdx = JIJI_VALUES.indexOf(findBranchForStage(stem, SibiUnseong.JANG_SAENG));
      const myIdx = JIJI_VALUES.indexOf(findBranchForStage(stem, SibiUnseong.MOK_YOK));
      expect(myIdx).toBe((jsIdx + 1) % 12);
    }
  });

  it('yin stems proceed backward (mokYok = jangSaeng - 1)', () => {
    for (const stem of [Cheongan.EUL, Cheongan.SIN, Cheongan.GYE]) {
      const jsIdx = JIJI_VALUES.indexOf(findBranchForStage(stem, SibiUnseong.JANG_SAENG));
      const myIdx = JIJI_VALUES.indexOf(findBranchForStage(stem, SibiUnseong.MOK_YOK));
      expect(myIdx).toBe((jsIdx - 1 + 12) % 12);
    }
  });

  it('jeWang = geonRok + 1 for yang', () => {
    for (const stem of [Cheongan.GAP, Cheongan.GYEONG]) {
      const grIdx = JIJI_VALUES.indexOf(findBranchForStage(stem, SibiUnseong.GEON_ROK));
      const jwIdx = JIJI_VALUES.indexOf(findBranchForStage(stem, SibiUnseong.JE_WANG));
      expect(jwIdx).toBe((grIdx + 1) % 12);
    }
  });

  it('jeWang = geonRok - 1 for yin', () => {
    for (const stem of [Cheongan.EUL, Cheongan.SIN, Cheongan.GYE]) {
      const grIdx = JIJI_VALUES.indexOf(findBranchForStage(stem, SibiUnseong.GEON_ROK));
      const jwIdx = JIJI_VALUES.indexOf(findBranchForStage(stem, SibiUnseong.JE_WANG));
      expect(jwIdx).toBe((grIdx - 1 + 12) % 12);
    }
  });

  it('all 5 stems have distinct jangSaeng positions', () => {
    const stems = [Cheongan.GAP, Cheongan.EUL, Cheongan.GYEONG, Cheongan.SIN, Cheongan.GYE];
    const positions = stems.map(s => findBranchForStage(s, SibiUnseong.JANG_SAENG));
    expect(new Set(positions).size).toBe(5);
  });

  it('jangSaeng positions match classical table', () => {
    const expected: [Cheongan, Jiji][] = [
      [Cheongan.GAP, Jiji.HAE],
      [Cheongan.EUL, Jiji.O],
      [Cheongan.GYEONG, Jiji.SA],
      [Cheongan.SIN, Jiji.JA],
      [Cheongan.GYE, Jiji.MYO],
    ];
    for (const [stem, branch] of expected) {
      expect(findBranchForStage(stem, SibiUnseong.JANG_SAENG)).toBe(branch);
    }
  });
});
