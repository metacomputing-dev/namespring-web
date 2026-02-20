import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { StrengthLevel } from '../../../src/domain/StrengthResult.js';
import type { StrengthResult } from '../../../src/domain/StrengthResult.js';
import {
  GyeokgukType,
  GyeokgukCategory,
  GyeokgukQuality,
  GYEOKGUK_TYPE_INFO,
} from '../../../src/domain/Gyeokguk.js';
import type { GyeokgukResult } from '../../../src/domain/Gyeokguk.js';
import { GyeokgukFormationAssessor } from '../../../src/engine/analysis/GyeokgukFormationAssessor.js';

/**
 * Ported from OegyeokFormationTest.kt (14 tests)
 *
 * CC-N2: oegyeok 15-type seonggyeok/pagyeok/guwon tests.
 *
 * Verifies that GyeokgukFormationAssessor produces actual
 * (not NOT_ASSESSED) formation assessments for jonggyeok(5),
 * hwagyeok(5), and ilhaeng(5) types.
 */

// ===================================================================
// Helpers
// ===================================================================

function gyeokguk(type: GyeokgukType, category: GyeokgukCategory): GyeokgukResult {
  return {
    type,
    category,
    baseSipseong: null,
    confidence: 0.85,
    reasoning: 'test',
    formation: null,
  };
}

function strong(): StrengthResult {
  return {
    dayMaster: Cheongan.GAP,
    level: StrengthLevel.STRONG,
    score: {
      deukryeong: 40.0,
      deukji: 15.0,
      deukse: 14.0,
      totalSupport: 69.0,
      totalOppose: 31.0,
    },
    isStrong: true,
    details: ['test strong'],
  };
}

function weak(): StrengthResult {
  return {
    dayMaster: Cheongan.GAP,
    level: StrengthLevel.VERY_WEAK,
    score: {
      deukryeong: 0.0,
      deukji: 3.0,
      deukse: 2.0,
      totalSupport: 5.0,
      totalOppose: 95.0,
    },
    isStrong: false,
    details: ['test weak'],
  };
}

// ===================================================================
// Tests
// ===================================================================

describe('OegyeokFormation', () => {

  // ===================================================================
  // jonggyeok 5 types
  // ===================================================================

  describe('jonggyeok', () => {

    it('jonggang well-formed when bigyeop dominant and no jae or gwan', () => {
      // GAP ilgan, bigyeop(GAP/EUL) touchul, inseong(IM/GYE) touchul, jaegwan absent
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.IM, Jiji.HAE),
      );
      const result = GyeokgukFormationAssessor.assess(
        gyeokguk(GyeokgukType.JONGGANG, GyeokgukCategory.JONGGYEOK),
        pillars, strong(),
      );
      expect(result.quality).toBe(GyeokgukQuality.WELL_FORMED);
      expect(result.breakingFactors.length).toBe(0);
    });

    it('jonggang broken when jae appears in stems', () => {
      // GAP ilgan, jaeseong(MU=pyeonjae) touchul
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.MU, Jiji.SUL),  // MU = pyeonjae
      );
      const result = GyeokgukFormationAssessor.assess(
        gyeokguk(GyeokgukType.JONGGANG, GyeokgukCategory.JONGGYEOK),
        pillars, strong(),
      );
      expect(result.quality).not.toBe(GyeokgukQuality.NOT_ASSESSED);
      expect(result.breakingFactors.some(s => s.includes('재성'))).toBe(true);
    });

    it('jonga well-formed when siksang dominant and no inseong', () => {
      // GAP ilgan, siksang(BYEONG=siksin, JEONG=sanggwan) touchul, inseong/bigyeop absent
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.GAP, Jiji.MI),
        new Pillar(Cheongan.BYEONG, Jiji.SA),
      );
      const result = GyeokgukFormationAssessor.assess(
        gyeokguk(GyeokgukType.JONGA, GyeokgukCategory.JONGGYEOK),
        pillars, weak(),
      );
      expect(result.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('jonga broken when inseong appears (hyoshin)', () => {
      // GAP ilgan, siksang(BYEONG) + inseong(IM=pyeonin) -> hyoshin talsik
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.GAP, Jiji.MI),
        new Pillar(Cheongan.IM, Jiji.HAE),  // IM = pyeonin
      );
      const result = GyeokgukFormationAssessor.assess(
        gyeokguk(GyeokgukType.JONGA, GyeokgukCategory.JONGGYEOK),
        pillars, weak(),
      );
      expect(result.breakingFactors.some(s => s.includes('인성'))).toBe(true);
    });

    it('jongjae well-formed when jae dominant and no bigyeop', () => {
      // GAP ilgan, jaeseong(MU=pyeonjae, GI=jeongjae) touchul
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.SUL),
        new Pillar(Cheongan.GI, Jiji.CHUK),
        new Pillar(Cheongan.GAP, Jiji.MI),
        new Pillar(Cheongan.MU, Jiji.JIN),
      );
      const result = GyeokgukFormationAssessor.assess(
        gyeokguk(GyeokgukType.JONGJAE, GyeokgukCategory.JONGGYEOK),
        pillars, weak(),
      );
      expect(result.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('jongsal well-formed when gwan dominant and no siksang', () => {
      // GAP ilgan, gwanseong(GYEONG=pyeongwan, SIN=jeonggwan) touchul
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
        new Pillar(Cheongan.GYEONG, Jiji.YU),
        new Pillar(Cheongan.GAP, Jiji.SUL),
        new Pillar(Cheongan.SIN, Jiji.SIN),
      );
      const result = GyeokgukFormationAssessor.assess(
        gyeokguk(GyeokgukType.JONGSAL, GyeokgukCategory.JONGGYEOK),
        pillars, weak(),
      );
      expect(result.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('jongse broken when bigyeop appears', () => {
      // GAP ilgan + bigyeop(EUL=gyeobjae) -> jongse pagyeok
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.SUL),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
        new Pillar(Cheongan.GAP, Jiji.MI),
        new Pillar(Cheongan.EUL, Jiji.MYO),  // EUL = gyeobjae
      );
      const result = GyeokgukFormationAssessor.assess(
        gyeokguk(GyeokgukType.JONGSE, GyeokgukCategory.JONGGYEOK),
        pillars, weak(),
      );
      expect(result.breakingFactors.some(s => s.includes('비겁'))).toBe(true);
    });
  });

  // ===================================================================
  // hwagyeok 5 types
  // ===================================================================

  describe('hwagyeok', () => {

    it('hapwha earth well-formed when no controlling element (wood)', () => {
      // hapwha-to-gyeok -- hwashin=earth, controlling=wood. No wood -> seonggyeok.
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.SUL),
        new Pillar(Cheongan.GI, Jiji.CHUK),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.BYEONG, Jiji.MI),
      );
      const result = GyeokgukFormationAssessor.assess(
        gyeokguk(GyeokgukType.HAPWHA_EARTH, GyeokgukCategory.HWAGYEOK),
        pillars, strong(),
      );
      // GAP is wood but it's the day master so excluded from touchul check (year/month/hour only)
      // year=MU(earth), month=GI(earth), hour=BYEONG(fire) -> no wood -> seonggyeok
      expect(result.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('hapwha metal broken when controlling element (fire) appears', () => {
      // hapwha-geum-gyeok -- hwashin=metal, controlling=fire. Fire touchul -> pagyeok.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
        new Pillar(Cheongan.SIN, Jiji.YU),
        new Pillar(Cheongan.GYEONG, Jiji.SUL),
        new Pillar(Cheongan.BYEONG, Jiji.SA),  // BYEONG = pyeongwan (fire ohaeng)
      );
      const result = GyeokgukFormationAssessor.assess(
        gyeokguk(GyeokgukType.HAPWHA_METAL, GyeokgukCategory.HWAGYEOK),
        pillars, strong(),
      );
      expect(result.breakingFactors.some(s =>
        s.includes('화신극파') || s.includes('극'),
      )).toBe(true);
    });

    it('all 5 hwagyeok types are not NOT_ASSESSED', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.SUL),
        new Pillar(Cheongan.GI, Jiji.CHUK),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.MU, Jiji.MI),
      );
      const hwagyeokTypes = [
        GyeokgukType.HAPWHA_EARTH, GyeokgukType.HAPWHA_METAL,
        GyeokgukType.HAPWHA_WATER, GyeokgukType.HAPWHA_WOOD,
        GyeokgukType.HAPWHA_FIRE,
      ];
      for (const type of hwagyeokTypes) {
        const result = GyeokgukFormationAssessor.assess(
          gyeokguk(type, GyeokgukCategory.HWAGYEOK),
          pillars, strong(),
        );
        expect(result.quality,
          `${GYEOKGUK_TYPE_INFO[type].koreanName} should not be NOT_ASSESSED`,
        ).not.toBe(GyeokgukQuality.NOT_ASSESSED);
      }
    });
  });

  // ===================================================================
  // ilhaeng 5 types
  // ===================================================================

  describe('ilhaeng', () => {

    it('gokjik well-formed when wood pure and no metal', () => {
      // gokjik-gyeok(wood) -- metal(geuk) absent -> seonggyeok
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.IM, Jiji.HAE),  // IM = pyeonin (water, generates wood)
      );
      const result = GyeokgukFormationAssessor.assess(
        gyeokguk(GyeokgukType.GOKJIK, GyeokgukCategory.ILHAENG),
        pillars, strong(),
      );
      expect(result.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('gokjik broken when metal (controlling) appears', () => {
      // gokjik-gyeok(wood) -- GYEONG(metal) touchul -> pagyeok
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),  // GYEONG = pyeongwan (metal)
      );
      const result = GyeokgukFormationAssessor.assess(
        gyeokguk(GyeokgukType.GOKJIK, GyeokgukCategory.ILHAENG),
        pillars, strong(),
      );
      expect(result.breakingFactors.some(s =>
        s.includes('극기개입') || s.includes('금'),
      )).toBe(true);
    });

    it('all 5 ilhaeng types are not NOT_ASSESSED', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.IM, Jiji.HAE),
      );
      const ilhaengTypes = [
        GyeokgukType.GOKJIK, GyeokgukType.YEOMSANG,
        GyeokgukType.GASAEK, GyeokgukType.JONGHYEOK,
        GyeokgukType.YUNHA,
      ];
      for (const type of ilhaengTypes) {
        const result = GyeokgukFormationAssessor.assess(
          gyeokguk(type, GyeokgukCategory.ILHAENG),
          pillars, strong(),
        );
        expect(result.quality,
          `${GYEOKGUK_TYPE_INFO[type].koreanName} should not be NOT_ASSESSED`,
        ).not.toBe(GyeokgukQuality.NOT_ASSESSED);
      }
    });
  });

  // ===================================================================
  // All 15 oegyeok types NOT_ASSESSED verification
  // ===================================================================

  it('all 15 oegyeok types produce actual assessment (not NOT_ASSESSED)', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.MU, Jiji.SUL),
      new Pillar(Cheongan.BYEONG, Jiji.SA),
      new Pillar(Cheongan.GAP, Jiji.JIN),
      new Pillar(Cheongan.GYE, Jiji.HAE),
    );
    const allOegyeok: [GyeokgukType, GyeokgukCategory][] = [
      [GyeokgukType.JONGGANG, GyeokgukCategory.JONGGYEOK],
      [GyeokgukType.JONGA, GyeokgukCategory.JONGGYEOK],
      [GyeokgukType.JONGJAE, GyeokgukCategory.JONGGYEOK],
      [GyeokgukType.JONGSAL, GyeokgukCategory.JONGGYEOK],
      [GyeokgukType.JONGSE, GyeokgukCategory.JONGGYEOK],
      [GyeokgukType.HAPWHA_EARTH, GyeokgukCategory.HWAGYEOK],
      [GyeokgukType.HAPWHA_METAL, GyeokgukCategory.HWAGYEOK],
      [GyeokgukType.HAPWHA_WATER, GyeokgukCategory.HWAGYEOK],
      [GyeokgukType.HAPWHA_WOOD, GyeokgukCategory.HWAGYEOK],
      [GyeokgukType.HAPWHA_FIRE, GyeokgukCategory.HWAGYEOK],
      [GyeokgukType.GOKJIK, GyeokgukCategory.ILHAENG],
      [GyeokgukType.YEOMSANG, GyeokgukCategory.ILHAENG],
      [GyeokgukType.GASAEK, GyeokgukCategory.ILHAENG],
      [GyeokgukType.JONGHYEOK, GyeokgukCategory.ILHAENG],
      [GyeokgukType.YUNHA, GyeokgukCategory.ILHAENG],
    ];

    for (const [type, category] of allOegyeok) {
      const strength = (category === GyeokgukCategory.JONGGYEOK && type === GyeokgukType.JONGGANG)
        ? strong()
        : weak();
      const result = GyeokgukFormationAssessor.assess(
        gyeokguk(type, category),
        pillars,
        strength,
      );
      const typeInfo = GYEOKGUK_TYPE_INFO[type];
      expect(result.quality,
        `${typeInfo.koreanName}(${typeInfo.hanja}) should produce actual assessment, not NOT_ASSESSED`,
      ).not.toBe(GyeokgukQuality.NOT_ASSESSED);
    }
  });
});
