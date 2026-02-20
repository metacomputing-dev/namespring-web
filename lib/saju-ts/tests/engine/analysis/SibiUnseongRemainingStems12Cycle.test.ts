import { describe, it, expect } from 'vitest';
import { calculateSibiUnseong } from '../../../src/engine/analysis/SibiUnseongCalculator.js';
import { Cheongan, CHEONGAN_VALUES } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../../src/domain/Jiji.js';
import { SibiUnseong, SIBI_UNSEONG_VALUES } from '../../../src/domain/SibiUnseong.js';
import { createConfig, EarthLifeStageRule } from '../../../src/config/CalculationConfig.js';

/**
 * Ported from SibiUnseongRemainingStems12CycleTest.kt (8th audit H-01).
 *
 * Full 12-stage life cycle verification for 5 stems:
 * BYEONG, JEONG, MU, GI, IM.
 *
 * Includes FOLLOW_WATER full cycles and mathematical properties.
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
// BYEONG (yang fire) -- forward from IN
// =========================================================================

describe('BYEONG (yang fire)', () => {
  const expectedCycle: [Jiji, SibiUnseong][] = [
    [Jiji.IN,   SibiUnseong.JANG_SAENG],
    [Jiji.MYO,  SibiUnseong.MOK_YOK],
    [Jiji.JIN,  SibiUnseong.GWAN_DAE],
    [Jiji.SA,   SibiUnseong.GEON_ROK],
    [Jiji.O,    SibiUnseong.JE_WANG],
    [Jiji.MI,   SibiUnseong.SWOE],
    [Jiji.SIN,  SibiUnseong.BYEONG],
    [Jiji.YU,   SibiUnseong.SA],
    [Jiji.SUL,  SibiUnseong.MYO],
    [Jiji.HAE,  SibiUnseong.JEOL],
    [Jiji.JA,   SibiUnseong.TAE],
    [Jiji.CHUK, SibiUnseong.YANG],
  ];

  it('full forward cycle', () => {
    assertFullCycle(Cheongan.BYEONG, expectedCycle);
  });

  it('jangSaeng at IN', () => {
    expect(calculateSibiUnseong(Cheongan.BYEONG, Jiji.IN)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('jeWang at O', () => {
    expect(calculateSibiUnseong(Cheongan.BYEONG, Jiji.O)).toBe(SibiUnseong.JE_WANG);
  });

  it('myo at SUL', () => {
    expect(calculateSibiUnseong(Cheongan.BYEONG, Jiji.SUL)).toBe(SibiUnseong.MYO);
  });
});

// =========================================================================
// JEONG (yin fire) -- reverse from YU
// =========================================================================

describe('JEONG (yin fire)', () => {
  const expectedCycle: [Jiji, SibiUnseong][] = [
    [Jiji.YU,   SibiUnseong.JANG_SAENG],
    [Jiji.SIN,  SibiUnseong.MOK_YOK],
    [Jiji.MI,   SibiUnseong.GWAN_DAE],
    [Jiji.O,    SibiUnseong.GEON_ROK],
    [Jiji.SA,   SibiUnseong.JE_WANG],
    [Jiji.JIN,  SibiUnseong.SWOE],
    [Jiji.MYO,  SibiUnseong.BYEONG],
    [Jiji.IN,   SibiUnseong.SA],
    [Jiji.CHUK, SibiUnseong.MYO],
    [Jiji.JA,   SibiUnseong.JEOL],
    [Jiji.HAE,  SibiUnseong.TAE],
    [Jiji.SUL,  SibiUnseong.YANG],
  ];

  it('full reverse cycle', () => {
    assertFullCycle(Cheongan.JEONG, expectedCycle);
  });

  it('jangSaeng at YU', () => {
    expect(calculateSibiUnseong(Cheongan.JEONG, Jiji.YU)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('jeWang at SA', () => {
    expect(calculateSibiUnseong(Cheongan.JEONG, Jiji.SA)).toBe(SibiUnseong.JE_WANG);
  });

  it('myo at CHUK', () => {
    expect(calculateSibiUnseong(Cheongan.JEONG, Jiji.CHUK)).toBe(SibiUnseong.MYO);
  });
});

// =========================================================================
// MU (yang earth) -- follows BYEONG (hwatodongbeop)
// =========================================================================

describe('MU (yang earth, hwatodongbeop)', () => {
  const expectedCycle: [Jiji, SibiUnseong][] = [
    [Jiji.IN,   SibiUnseong.JANG_SAENG],
    [Jiji.MYO,  SibiUnseong.MOK_YOK],
    [Jiji.JIN,  SibiUnseong.GWAN_DAE],
    [Jiji.SA,   SibiUnseong.GEON_ROK],
    [Jiji.O,    SibiUnseong.JE_WANG],
    [Jiji.MI,   SibiUnseong.SWOE],
    [Jiji.SIN,  SibiUnseong.BYEONG],
    [Jiji.YU,   SibiUnseong.SA],
    [Jiji.SUL,  SibiUnseong.MYO],
    [Jiji.HAE,  SibiUnseong.JEOL],
    [Jiji.JA,   SibiUnseong.TAE],
    [Jiji.CHUK, SibiUnseong.YANG],
  ];

  it('full cycle matches BYEONG', () => {
    assertFullCycle(Cheongan.MU, expectedCycle);
  });

  it('jangSaeng at IN', () => {
    expect(calculateSibiUnseong(Cheongan.MU, Jiji.IN)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('every branch matches BYEONG', () => {
    for (const branch of JIJI_VALUES) {
      expect(calculateSibiUnseong(Cheongan.MU, branch))
        .toBe(calculateSibiUnseong(Cheongan.BYEONG, branch));
    }
  });
});

// =========================================================================
// GI (yin earth) -- follows JEONG (hwatodongbeop)
// =========================================================================

describe('GI (yin earth, hwatodongbeop)', () => {
  const expectedCycle: [Jiji, SibiUnseong][] = [
    [Jiji.YU,   SibiUnseong.JANG_SAENG],
    [Jiji.SIN,  SibiUnseong.MOK_YOK],
    [Jiji.MI,   SibiUnseong.GWAN_DAE],
    [Jiji.O,    SibiUnseong.GEON_ROK],
    [Jiji.SA,   SibiUnseong.JE_WANG],
    [Jiji.JIN,  SibiUnseong.SWOE],
    [Jiji.MYO,  SibiUnseong.BYEONG],
    [Jiji.IN,   SibiUnseong.SA],
    [Jiji.CHUK, SibiUnseong.MYO],
    [Jiji.JA,   SibiUnseong.JEOL],
    [Jiji.HAE,  SibiUnseong.TAE],
    [Jiji.SUL,  SibiUnseong.YANG],
  ];

  it('full cycle matches JEONG', () => {
    assertFullCycle(Cheongan.GI, expectedCycle);
  });

  it('jangSaeng at YU', () => {
    expect(calculateSibiUnseong(Cheongan.GI, Jiji.YU)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('every branch matches JEONG', () => {
    for (const branch of JIJI_VALUES) {
      expect(calculateSibiUnseong(Cheongan.GI, branch))
        .toBe(calculateSibiUnseong(Cheongan.JEONG, branch));
    }
  });
});

// =========================================================================
// IM (yang water) -- forward from SIN
// =========================================================================

describe('IM (yang water)', () => {
  const expectedCycle: [Jiji, SibiUnseong][] = [
    [Jiji.SIN,  SibiUnseong.JANG_SAENG],
    [Jiji.YU,   SibiUnseong.MOK_YOK],
    [Jiji.SUL,  SibiUnseong.GWAN_DAE],
    [Jiji.HAE,  SibiUnseong.GEON_ROK],
    [Jiji.JA,   SibiUnseong.JE_WANG],
    [Jiji.CHUK, SibiUnseong.SWOE],
    [Jiji.IN,   SibiUnseong.BYEONG],
    [Jiji.MYO,  SibiUnseong.SA],
    [Jiji.JIN,  SibiUnseong.MYO],
    [Jiji.SA,   SibiUnseong.JEOL],
    [Jiji.O,    SibiUnseong.TAE],
    [Jiji.MI,   SibiUnseong.YANG],
  ];

  it('full forward cycle', () => {
    assertFullCycle(Cheongan.IM, expectedCycle);
  });

  it('jangSaeng at SIN', () => {
    expect(calculateSibiUnseong(Cheongan.IM, Jiji.SIN)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('jeWang at JA', () => {
    expect(calculateSibiUnseong(Cheongan.IM, Jiji.JA)).toBe(SibiUnseong.JE_WANG);
  });

  it('myo at JIN', () => {
    expect(calculateSibiUnseong(Cheongan.IM, Jiji.JIN)).toBe(SibiUnseong.MYO);
  });
});

// =========================================================================
// FOLLOW_WATER: Earth stems follow Water
// =========================================================================

describe('FOLLOW_WATER full cycles', () => {
  const config = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_WATER });

  it('MU full cycle matches IM under FOLLOW_WATER', () => {
    const expectedCycle: [Jiji, SibiUnseong][] = [
      [Jiji.SIN,  SibiUnseong.JANG_SAENG],
      [Jiji.YU,   SibiUnseong.MOK_YOK],
      [Jiji.SUL,  SibiUnseong.GWAN_DAE],
      [Jiji.HAE,  SibiUnseong.GEON_ROK],
      [Jiji.JA,   SibiUnseong.JE_WANG],
      [Jiji.CHUK, SibiUnseong.SWOE],
      [Jiji.IN,   SibiUnseong.BYEONG],
      [Jiji.MYO,  SibiUnseong.SA],
      [Jiji.JIN,  SibiUnseong.MYO],
      [Jiji.SA,   SibiUnseong.JEOL],
      [Jiji.O,    SibiUnseong.TAE],
      [Jiji.MI,   SibiUnseong.YANG],
    ];
    assertFullCycle(Cheongan.MU, expectedCycle, config);
  });

  it('MU every branch matches IM under FOLLOW_WATER', () => {
    for (const branch of JIJI_VALUES) {
      expect(calculateSibiUnseong(Cheongan.MU, branch, config))
        .toBe(calculateSibiUnseong(Cheongan.IM, branch, config));
    }
  });

  it('GI full cycle matches GYE under FOLLOW_WATER', () => {
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
    assertFullCycle(Cheongan.GI, expectedCycle, config);
  });

  it('GI every branch matches GYE under FOLLOW_WATER', () => {
    for (const branch of JIJI_VALUES) {
      expect(calculateSibiUnseong(Cheongan.GI, branch, config))
        .toBe(calculateSibiUnseong(Cheongan.GYE, branch, config));
    }
  });

  it('MU jangSaeng at SIN under FOLLOW_WATER', () => {
    expect(calculateSibiUnseong(Cheongan.MU, Jiji.SIN, config)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('GI jangSaeng at MYO under FOLLOW_WATER', () => {
    expect(calculateSibiUnseong(Cheongan.GI, Jiji.MYO, config)).toBe(SibiUnseong.JANG_SAENG);
  });
});

// =========================================================================
// Mathematical properties
// =========================================================================

describe('mathematical properties (remaining stems)', () => {
  const targetStems = [
    Cheongan.BYEONG, Cheongan.JEONG, Cheongan.MU, Cheongan.GI, Cheongan.IM,
  ];

  it('each stem visits all 12 branches exactly once', () => {
    for (const stem of targetStems) {
      const stages = new Set(JIJI_VALUES.map(b => calculateSibiUnseong(stem, b)));
      expect(stages.size).toBe(12);
      expect(stages).toEqual(new Set(SIBI_UNSEONG_VALUES));
    }
  });

  it('yang stems proceed forward', () => {
    for (const stem of [Cheongan.BYEONG, Cheongan.MU, Cheongan.IM]) {
      const jsIdx = JIJI_VALUES.indexOf(
        JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === SibiUnseong.JANG_SAENG)!,
      );
      const myIdx = JIJI_VALUES.indexOf(
        JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === SibiUnseong.MOK_YOK)!,
      );
      expect(myIdx).toBe((jsIdx + 1) % 12);
    }
  });

  it('yin stems proceed backward', () => {
    for (const stem of [Cheongan.JEONG, Cheongan.GI]) {
      const jsIdx = JIJI_VALUES.indexOf(
        JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === SibiUnseong.JANG_SAENG)!,
      );
      const myIdx = JIJI_VALUES.indexOf(
        JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === SibiUnseong.MOK_YOK)!,
      );
      expect(myIdx).toBe((jsIdx - 1 + 12) % 12);
    }
  });

  it('jeWang = geonRok + 1 for yang stems', () => {
    for (const stem of [Cheongan.BYEONG, Cheongan.MU, Cheongan.IM]) {
      const grIdx = JIJI_VALUES.indexOf(
        JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === SibiUnseong.GEON_ROK)!,
      );
      const jwIdx = JIJI_VALUES.indexOf(
        JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === SibiUnseong.JE_WANG)!,
      );
      expect(jwIdx).toBe((grIdx + 1) % 12);
    }
  });

  it('jeWang = geonRok - 1 for yin stems', () => {
    for (const stem of [Cheongan.JEONG, Cheongan.GI]) {
      const grIdx = JIJI_VALUES.indexOf(
        JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === SibiUnseong.GEON_ROK)!,
      );
      const jwIdx = JIJI_VALUES.indexOf(
        JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === SibiUnseong.JE_WANG)!,
      );
      expect(jwIdx).toBe((grIdx - 1 + 12) % 12);
    }
  });

  it('yang stems form contiguous forward traversal', () => {
    for (const stem of [Cheongan.BYEONG, Cheongan.MU, Cheongan.IM]) {
      const start = JIJI_VALUES.indexOf(
        JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === SibiUnseong.JANG_SAENG)!,
      );
      for (let k = 0; k < 12; k++) {
        const branch = JIJI_VALUES[(start + k) % 12]!;
        expect(calculateSibiUnseong(stem, branch)).toBe(stageOrder[k]);
      }
    }
  });

  it('yin stems form contiguous backward traversal', () => {
    for (const stem of [Cheongan.JEONG, Cheongan.GI]) {
      const start = JIJI_VALUES.indexOf(
        JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === SibiUnseong.JANG_SAENG)!,
      );
      for (let k = 0; k < 12; k++) {
        const branch = JIJI_VALUES[(start - k + 12) % 12]!;
        expect(calculateSibiUnseong(stem, branch)).toBe(stageOrder[k]);
      }
    }
  });

  it('FOLLOW_WATER Earth stems still bijection', () => {
    const config = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_WATER });
    for (const stem of [Cheongan.MU, Cheongan.GI]) {
      const stages = new Set(JIJI_VALUES.map(b => calculateSibiUnseong(stem, b, config)));
      expect(stages).toEqual(new Set(SIBI_UNSEONG_VALUES));
    }
  });

  it('target yang stems have distinct jangSaeng (BYEONG/MU share, IM distinct)', () => {
    function findJS(stem: Cheongan): Jiji {
      return JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === SibiUnseong.JANG_SAENG)!;
    }
    expect(findJS(Cheongan.BYEONG)).toBe(Jiji.IN);
    expect(findJS(Cheongan.MU)).toBe(Jiji.IN);
    expect(findJS(Cheongan.IM)).toBe(Jiji.SIN);
    expect(findJS(Cheongan.BYEONG)).not.toBe(findJS(Cheongan.IM));
  });

  it('target yin stems have expected jangSaeng (JEONG/GI share YU)', () => {
    function findJS(stem: Cheongan): Jiji {
      return JIJI_VALUES.find(b => calculateSibiUnseong(stem, b) === SibiUnseong.JANG_SAENG)!;
    }
    expect(findJS(Cheongan.JEONG)).toBe(Jiji.YU);
    expect(findJS(Cheongan.GI)).toBe(Jiji.YU);
    expect(findJS(Cheongan.JEONG)).toBe(findJS(Cheongan.GI));
  });
});
