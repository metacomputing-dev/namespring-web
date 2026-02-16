import { describe, it, expect } from 'vitest';
import { calculateSibiUnseong, analyzeAllPillars } from '../../../src/engine/analysis/SibiUnseongCalculator.js';
import { Cheongan, CHEONGAN_VALUES, CHEONGAN_INFO } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, JIJI_INFO } from '../../../src/domain/Jiji.js';
import { SibiUnseong, SIBI_UNSEONG_VALUES, SIBI_UNSEONG_INFO } from '../../../src/domain/SibiUnseong.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../../../src/domain/PillarPosition.js';
import { createConfig, EarthLifeStageRule } from '../../../src/config/CalculationConfig.js';

// =========================================================================
// GAP (양목) -- forward from HAE
// =========================================================================

describe('GAP (양목) -- forward from HAE', () => {
  it('GAP 장생 at HAE', () => {
    expect(calculateSibiUnseong(Cheongan.GAP, Jiji.HAE)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('GAP 목욕 at JA', () => {
    expect(calculateSibiUnseong(Cheongan.GAP, Jiji.JA)).toBe(SibiUnseong.MOK_YOK);
  });

  it('GAP 관대 at CHUK', () => {
    expect(calculateSibiUnseong(Cheongan.GAP, Jiji.CHUK)).toBe(SibiUnseong.GWAN_DAE);
  });

  it('GAP 건록 at IN', () => {
    expect(calculateSibiUnseong(Cheongan.GAP, Jiji.IN)).toBe(SibiUnseong.GEON_ROK);
  });

  it('GAP 제왕 at MYO', () => {
    expect(calculateSibiUnseong(Cheongan.GAP, Jiji.MYO)).toBe(SibiUnseong.JE_WANG);
  });

  it('GAP 사 at O', () => {
    expect(calculateSibiUnseong(Cheongan.GAP, Jiji.O)).toBe(SibiUnseong.SA);
  });

  it('GAP full forward cycle', () => {
    const expected: [Jiji, SibiUnseong][] = [
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
    for (const [branch, stage] of expected) {
      expect(calculateSibiUnseong(Cheongan.GAP, branch))
        .toBe(stage);
    }
  });
});

// =========================================================================
// EUL (음목) -- reverse from O
// =========================================================================

describe('EUL (음목) -- reverse from O', () => {
  it('EUL 장생 at O', () => {
    expect(calculateSibiUnseong(Cheongan.EUL, Jiji.O)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('EUL 목욕 at SA', () => {
    expect(calculateSibiUnseong(Cheongan.EUL, Jiji.SA)).toBe(SibiUnseong.MOK_YOK);
  });

  it('EUL 관대 at JIN', () => {
    expect(calculateSibiUnseong(Cheongan.EUL, Jiji.JIN)).toBe(SibiUnseong.GWAN_DAE);
  });

  it('EUL 건록 at MYO', () => {
    expect(calculateSibiUnseong(Cheongan.EUL, Jiji.MYO)).toBe(SibiUnseong.GEON_ROK);
  });

  it('EUL full reverse cycle', () => {
    // YIN stem: reverse direction from O (ordinal 6)
    const expected: [Jiji, SibiUnseong][] = [
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
    for (const [branch, stage] of expected) {
      expect(calculateSibiUnseong(Cheongan.EUL, branch))
        .toBe(stage);
    }
  });
});

// =========================================================================
// All 10 stems: 장생 starting position verification
// =========================================================================

describe('All 10 stems: 장생 starting position', () => {
  it('each stem has 장생 at its designated branch', () => {
    const cases: [Cheongan, Jiji][] = [
      [Cheongan.GAP,    Jiji.HAE],
      [Cheongan.EUL,    Jiji.O],
      [Cheongan.BYEONG, Jiji.IN],
      [Cheongan.JEONG,  Jiji.YU],
      [Cheongan.MU,     Jiji.IN],
      [Cheongan.GI,     Jiji.YU],
      [Cheongan.GYEONG, Jiji.SA],
      [Cheongan.SIN,    Jiji.JA],
      [Cheongan.IM,     Jiji.SIN],
      [Cheongan.GYE,    Jiji.MYO],
    ];
    for (const [stem, branch] of cases) {
      expect(calculateSibiUnseong(stem, branch)).toBe(SibiUnseong.JANG_SAENG);
    }
  });
});

// =========================================================================
// 화토동법 (Earth follows Fire)
// =========================================================================

describe('화토동법 (Earth follows Fire)', () => {
  it('MU follows BYEONG for every branch', () => {
    for (const branch of JIJI_VALUES) {
      expect(calculateSibiUnseong(Cheongan.MU, branch))
        .toBe(calculateSibiUnseong(Cheongan.BYEONG, branch));
    }
  });

  it('GI follows JEONG for every branch', () => {
    for (const branch of JIJI_VALUES) {
      expect(calculateSibiUnseong(Cheongan.GI, branch))
        .toBe(calculateSibiUnseong(Cheongan.JEONG, branch));
    }
  });
});

// =========================================================================
// BYEONG (양화) -- forward from IN
// =========================================================================

describe('BYEONG (양화)', () => {
  it('BYEONG 장생 at IN', () => {
    expect(calculateSibiUnseong(Cheongan.BYEONG, Jiji.IN)).toBe(SibiUnseong.JANG_SAENG);
  });
});

// =========================================================================
// GYEONG (양금) -- forward from SA
// =========================================================================

describe('GYEONG (양금) -- forward from SA', () => {
  it('GYEONG 장생 at SA', () => {
    expect(calculateSibiUnseong(Cheongan.GYEONG, Jiji.SA)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('GYEONG full forward cycle', () => {
    const expected: [Jiji, SibiUnseong][] = [
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
    for (const [branch, stage] of expected) {
      expect(calculateSibiUnseong(Cheongan.GYEONG, branch))
        .toBe(stage);
    }
  });
});

// =========================================================================
// IM (양수) -- forward from SIN
// =========================================================================

describe('IM (양수)', () => {
  it('IM 장생 at SIN', () => {
    expect(calculateSibiUnseong(Cheongan.IM, Jiji.SIN)).toBe(SibiUnseong.JANG_SAENG);
  });
});

// =========================================================================
// SIN (음금) -- reverse from JA
// =========================================================================

describe('SIN (음금) -- reverse from JA', () => {
  it('SIN full reverse cycle', () => {
    const expected: [Jiji, SibiUnseong][] = [
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
    for (const [branch, stage] of expected) {
      expect(calculateSibiUnseong(Cheongan.SIN, branch))
        .toBe(stage);
    }
  });
});

// =========================================================================
// GYE (음수) -- reverse from MYO
// =========================================================================

describe('GYE (음수) -- reverse from MYO', () => {
  it('GYE full reverse cycle', () => {
    const expected: [Jiji, SibiUnseong][] = [
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
    for (const [branch, stage] of expected) {
      expect(calculateSibiUnseong(Cheongan.GYE, branch))
        .toBe(stage);
    }
  });
});

// =========================================================================
// Exhaustive: every stem produces exactly 12 distinct stages
// =========================================================================

describe('Exhaustive: every stem produces all 12 stages', () => {
  it('each of 10 stems maps to all 12 stages', () => {
    for (const stem of CHEONGAN_VALUES) {
      const stages = new Set(JIJI_VALUES.map(branch => calculateSibiUnseong(stem, branch)));
      const allStages = new Set(SIBI_UNSEONG_VALUES);
      expect(stages).toEqual(allStages);
    }
  });
});

// =========================================================================
// analyzeAllPillars
// =========================================================================

describe('analyzeAllPillars', () => {
  it('returns four entries', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
      new Pillar(Cheongan.MU, Jiji.O),
      new Pillar(Cheongan.GYEONG, Jiji.SIN),
    );
    const result = analyzeAllPillars(Cheongan.MU, pillars);
    expect(result.size).toBe(4);
    expect(new Set(result.keys())).toEqual(new Set(PILLAR_POSITION_VALUES));
  });

  it('uses day stem (day master) for evaluation', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.HAE),      // GAP + HAE = 장생
      new Pillar(Cheongan.BYEONG, Jiji.IN),   // GAP + IN = 건록
      new Pillar(Cheongan.GAP, Jiji.MYO),     // GAP + MYO = 제왕
      new Pillar(Cheongan.GYEONG, Jiji.O),    // GAP + O = 사
    );
    const result = analyzeAllPillars(Cheongan.GAP, pillars);

    expect(result.get(PillarPosition.YEAR)).toBe(SibiUnseong.JANG_SAENG);
    expect(result.get(PillarPosition.MONTH)).toBe(SibiUnseong.GEON_ROK);
    expect(result.get(PillarPosition.DAY)).toBe(SibiUnseong.JE_WANG);
    expect(result.get(PillarPosition.HOUR)).toBe(SibiUnseong.SA);
  });

  it('ignores pillar stem, uses only branch', () => {
    const pillarsA = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.GAP, Jiji.SIN),
    );
    const pillarsB = new PillarSet(
      new Pillar(Cheongan.GYE, Jiji.JA),
      new Pillar(Cheongan.SIN, Jiji.IN),
      new Pillar(Cheongan.JEONG, Jiji.O),
      new Pillar(Cheongan.EUL, Jiji.SIN),
    );
    const resultA = analyzeAllPillars(Cheongan.GAP, pillarsA);
    const resultB = analyzeAllPillars(Cheongan.GAP, pillarsB);

    expect(resultA).toEqual(resultB);
  });
});

// =========================================================================
// 수토동법 (FOLLOW_WATER): Earth follows Water
// =========================================================================

describe('수토동법 (FOLLOW_WATER)', () => {
  const config = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_WATER });

  it('MU follows IM under FOLLOW_WATER', () => {
    for (const branch of JIJI_VALUES) {
      expect(calculateSibiUnseong(Cheongan.MU, branch, config))
        .toBe(calculateSibiUnseong(Cheongan.IM, branch, config));
    }
  });

  it('GI follows GYE under FOLLOW_WATER', () => {
    for (const branch of JIJI_VALUES) {
      expect(calculateSibiUnseong(Cheongan.GI, branch, config))
        .toBe(calculateSibiUnseong(Cheongan.GYE, branch, config));
    }
  });

  it('MU 장생 at SIN under FOLLOW_WATER', () => {
    expect(calculateSibiUnseong(Cheongan.MU, Jiji.SIN, config)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('GI 장생 at MYO under FOLLOW_WATER', () => {
    expect(calculateSibiUnseong(Cheongan.GI, Jiji.MYO, config)).toBe(SibiUnseong.JANG_SAENG);
  });

  it('non-earth stems unchanged under FOLLOW_WATER', () => {
    const nonEarthStems: Cheongan[] = [
      Cheongan.GAP, Cheongan.EUL, Cheongan.BYEONG, Cheongan.JEONG,
      Cheongan.GYEONG, Cheongan.SIN, Cheongan.IM, Cheongan.GYE,
    ];
    for (const stem of nonEarthStems) {
      for (const branch of JIJI_VALUES) {
        expect(calculateSibiUnseong(stem, branch, config))
          .toBe(calculateSibiUnseong(stem, branch));
      }
    }
  });
});

// =========================================================================
// 토독립설 (INDEPENDENT): falls back to FOLLOW_FIRE
// =========================================================================

describe('토독립설 (INDEPENDENT)', () => {
  const independentConfig = createConfig({ earthLifeStageRule: EarthLifeStageRule.INDEPENDENT });
  const followFireConfig = createConfig({ earthLifeStageRule: EarthLifeStageRule.FOLLOW_FIRE });

  it('INDEPENDENT produces same result as FOLLOW_FIRE for Earth stems', () => {
    for (const stem of [Cheongan.MU, Cheongan.GI]) {
      for (const branch of JIJI_VALUES) {
        expect(calculateSibiUnseong(stem, branch, independentConfig))
          .toBe(calculateSibiUnseong(stem, branch, followFireConfig));
      }
    }
  });

  it('MU 장생 at IN under INDEPENDENT', () => {
    expect(calculateSibiUnseong(Cheongan.MU, Jiji.IN, independentConfig))
      .toBe(SibiUnseong.JANG_SAENG);
  });

  it('GI 장생 at YU under INDEPENDENT', () => {
    expect(calculateSibiUnseong(Cheongan.GI, Jiji.YU, independentConfig))
      .toBe(SibiUnseong.JANG_SAENG);
  });

  it('all stems produce all 12 stages under INDEPENDENT', () => {
    for (const stem of CHEONGAN_VALUES) {
      const stages = new Set(
        JIJI_VALUES.map(branch => calculateSibiUnseong(stem, branch, independentConfig)),
      );
      expect(stages).toEqual(new Set(SIBI_UNSEONG_VALUES));
    }
  });
});

// =========================================================================
// Mathematical structure
// =========================================================================

describe('Mathematical structure', () => {
  it('yang stems 장생 form +3 cycle (HAE, IN, SA, SIN)', () => {
    const yangStems = [Cheongan.GAP, Cheongan.BYEONG, Cheongan.GYEONG, Cheongan.IM];
    const expectedPositions = [Jiji.HAE, Jiji.IN, Jiji.SA, Jiji.SIN];
    const ordinals = expectedPositions.map(j => JIJI_VALUES.indexOf(j));

    // Check +3 circular gap
    for (let i = 0; i < ordinals.length; i++) {
      const next = ordinals[(i + 1) % ordinals.length]!;
      expect((next - ordinals[i]! + 12) % 12).toBe(3);
    }

    // Check each yang stem's 장생 is at expected position
    for (let i = 0; i < yangStems.length; i++) {
      expect(calculateSibiUnseong(yangStems[i]!, expectedPositions[i]!))
        .toBe(SibiUnseong.JANG_SAENG);
    }
  });

  it('yin 장생 = yang 장생 + 7 (mod 12)', () => {
    const yangYinPairs: [Cheongan, Cheongan][] = [
      [Cheongan.GAP,    Cheongan.EUL],
      [Cheongan.BYEONG, Cheongan.JEONG],
      [Cheongan.GYEONG, Cheongan.SIN],
      [Cheongan.IM,     Cheongan.GYE],
    ];
    for (const [yang, yin] of yangYinPairs) {
      const yangJS = JIJI_VALUES.find(j => calculateSibiUnseong(yang, j) === SibiUnseong.JANG_SAENG)!;
      const yinJS = JIJI_VALUES.find(j => calculateSibiUnseong(yin, j) === SibiUnseong.JANG_SAENG)!;
      expect((JIJI_VALUES.indexOf(yinJS) - JIJI_VALUES.indexOf(yangJS) + 12) % 12).toBe(7);
    }
  });

  it('earth yang MU also follows +7 rule for yin GI', () => {
    const muJS = JIJI_VALUES.find(j => calculateSibiUnseong(Cheongan.MU, j) === SibiUnseong.JANG_SAENG)!;
    const giJS = JIJI_VALUES.find(j => calculateSibiUnseong(Cheongan.GI, j) === SibiUnseong.JANG_SAENG)!;
    expect((JIJI_VALUES.indexOf(giJS) - JIJI_VALUES.indexOf(muJS) + 12) % 12).toBe(7);
  });

  it('four 생지 exactly occupied by 4 yang stems', () => {
    const saengji = new Set([Jiji.HAE, Jiji.IN, Jiji.SA, Jiji.SIN]);
    const yangStems = [Cheongan.GAP, Cheongan.BYEONG, Cheongan.GYEONG, Cheongan.IM];
    const occupied = new Set(
      yangStems.map(stem =>
        JIJI_VALUES.find(j => calculateSibiUnseong(stem, j) === SibiUnseong.JANG_SAENG)!,
      ),
    );
    expect(occupied).toEqual(saengji);
  });

  it('제왕 matches peak month (왕지) for yang stems', () => {
    const cases: [Cheongan, Jiji][] = [
      [Cheongan.GAP,    Jiji.MYO],   // 木 왕지 = 卯
      [Cheongan.BYEONG, Jiji.O],     // 火 왕지 = 午
      [Cheongan.GYEONG, Jiji.YU],    // 金 왕지 = 酉
      [Cheongan.IM,     Jiji.JA],    // 水 왕지 = 子
    ];
    for (const [stem, expectedPeak] of cases) {
      expect(calculateSibiUnseong(stem, expectedPeak)).toBe(SibiUnseong.JE_WANG);
    }
  });
});
