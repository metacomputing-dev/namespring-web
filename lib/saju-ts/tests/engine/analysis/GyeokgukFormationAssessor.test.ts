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
} from '../../../src/domain/Gyeokguk.js';
import type { GyeokgukResult, GyeokgukFormation } from '../../../src/domain/Gyeokguk.js';
import { GyeokgukFormationAssessor } from '../../../src/engine/analysis/GyeokgukFormationAssessor.js';

/**
 * Ported from GyeokgukFormationAssessorTest.kt (40 tests)
 *
 * Tests for GyeokgukFormationAssessor.
 *
 * Each nested describe corresponds to one of the 10 naegyeok types and tests:
 * 1. seonggyeok (well-formed) conditions
 * 2. pagyeok (broken) conditions
 * 3. guwon (rescued) conditions
 *
 * Pillar sets are hand-crafted to produce specific sipseong distributions.
 */

// ===================================================================
// Helpers
// ===================================================================

function ps(
  year: [Cheongan, Jiji],
  month: [Cheongan, Jiji],
  day: [Cheongan, Jiji],
  hour: [Cheongan, Jiji],
): PillarSet {
  return new PillarSet(
    new Pillar(year[0], year[1]),
    new Pillar(month[0], month[1]),
    new Pillar(day[0], day[1]),
    new Pillar(hour[0], hour[1]),
  );
}

function naegyeok(type: GyeokgukType): GyeokgukResult {
  return {
    type,
    category: GyeokgukCategory.NAEGYEOK,
    baseSipseong: null,
    confidence: 1.0,
    reasoning: 'test',
    formation: null,
  };
}

function strong(): StrengthResult {
  return {
    dayMaster: Cheongan.GAP,
    level: StrengthLevel.STRONG,
    score: {
      deukryeong: 30.0, deukji: 20.0, deukse: 10.0,
      totalSupport: 60.0, totalOppose: 40.0,
    },
    isStrong: true,
    details: ['test'],
  };
}

function weak(): StrengthResult {
  return {
    dayMaster: Cheongan.GAP,
    level: StrengthLevel.WEAK,
    score: {
      deukryeong: 10.0, deukji: 10.0, deukse: 5.0,
      totalSupport: 25.0, totalOppose: 75.0,
    },
    isStrong: false,
    details: ['test'],
  };
}

function assess(
  type: GyeokgukType,
  pillars: PillarSet,
  strength: StrengthResult,
): GyeokgukFormation {
  const gr = naegyeok(type);
  return GyeokgukFormationAssessor.assess(gr, pillars, strength);
}

// ===================================================================
// Tests
// ===================================================================

describe('GyeokgukFormationAssessor', () => {

  // -----------------------------------------------------------------
  // oegyeok produces actual assessment (CC-N2)
  // -----------------------------------------------------------------

  it('oegyeok produces actual assessment (not NOT_ASSESSED)', () => {
    const gr: GyeokgukResult = {
      type: GyeokgukType.JONGGANG,
      category: GyeokgukCategory.JONGGYEOK,
      baseSipseong: null,
      confidence: 0.85,
      reasoning: 'test',
      formation: null,
    };
    const pillars = ps(
      [Cheongan.GAP, Jiji.JA], [Cheongan.GAP, Jiji.IN],
      [Cheongan.GAP, Jiji.JIN], [Cheongan.GAP, Jiji.O],
    );
    const result = GyeokgukFormationAssessor.assess(gr, pillars, strong());
    expect(result.quality).not.toBe(GyeokgukQuality.NOT_ASSESSED);
  });

  // -----------------------------------------------------------------
  // 1. JeongGwan (正官格)
  // -----------------------------------------------------------------

  describe('JeongGwan Formation', () => {
    // Day master: GAP. jeonggwan = SIN (metal).
    // jaeseong = MU/GI (earth). inseong = IM/GYE (water).
    // sanggwan = JEONG (fire). pyeongwan = GYEONG (metal).

    it('seonggyeok - jaeseong saengs gwan and no sanggwan', () => {
      // Year=MU(jae), Month=SIN(jeonggwan), Day=GAP, Hour=IM(inseong)
      const pillars = ps(
        [Cheongan.MU, Jiji.SUL], [Cheongan.SIN, Jiji.YU],
        [Cheongan.GAP, Jiji.IN], [Cheongan.IM, Jiji.JA],
      );
      const f = assess(GyeokgukType.JEONGGWAN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.WELL_FORMED);
      expect(f.breakingFactors.length).toBe(0);
    });

    it('pagyeok - sanggwan gyeongwan (sanggwan touchul, no inseong)', () => {
      // Year=JEONG(sanggwan), Month=SIN(jeonggwan), Day=GAP, Hour=MU(jae)
      const pillars = ps(
        [Cheongan.JEONG, Jiji.SA], [Cheongan.SIN, Jiji.YU],
        [Cheongan.GAP, Jiji.IN], [Cheongan.MU, Jiji.JIN],
      );
      const f = assess(GyeokgukType.JEONGGWAN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
      expect(f.breakingFactors.some(s => s.includes('상관견관'))).toBe(true);
    });

    it('guwon - sanggwan gyeongwan but inseong suppresses sanggwan', () => {
      // Year=JEONG(sanggwan), Month=SIN(jeonggwan), Day=GAP, Hour=IM(inseong)
      const pillars = ps(
        [Cheongan.JEONG, Jiji.SA], [Cheongan.SIN, Jiji.YU],
        [Cheongan.GAP, Jiji.IN], [Cheongan.IM, Jiji.JA],
      );
      const f = assess(GyeokgukType.JEONGGWAN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.RESCUED);
      expect(f.rescueFactors.some(s => s.includes('인성'))).toBe(true);
    });

    it('pagyeok - gwansal honjap (jeonggwan+pyeongwan simultaneous touchul)', () => {
      // Year=GYEONG(pyeongwan), Month=SIN(jeonggwan), Day=GAP, Hour=MU(jae)
      const pillars = ps(
        [Cheongan.GYEONG, Jiji.SIN], [Cheongan.SIN, Jiji.YU],
        [Cheongan.GAP, Jiji.IN], [Cheongan.MU, Jiji.JIN],
      );
      const f = assess(GyeokgukType.JEONGGWAN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
      expect(f.breakingFactors.some(s => s.includes('관살혼잡'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // 2. JeongJae (正財格)
  // -----------------------------------------------------------------

  describe('JeongJae Formation', () => {
    // Day master: GAP. jeongjae = GI (earth).
    // bigyeop = GAP(bigyeon)/EUL(gyeobjae). siksang = BYEONG(siksin)/JEONG(sanggwan).
    // gwanseong = GYEONG(pyeongwan)/SIN(jeonggwan).

    it('seonggyeok - siksin saengjae + singang', () => {
      // Year=BYEONG(siksin), Month=GI(jeongjae), Day=GAP, Hour=SIN(jeonggwan)
      const pillars = ps(
        [Cheongan.BYEONG, Jiji.O], [Cheongan.GI, Jiji.MI],
        [Cheongan.GAP, Jiji.IN], [Cheongan.SIN, Jiji.YU],
      );
      const f = assess(GyeokgukType.JEONGJAE, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('pagyeok - gungeop jaengjae (bigyeop excess, no gwan)', () => {
      // Year=GAP(bigyeon), Month=GI(jeongjae), Day=GAP, Hour=EUL(gyeobjae)
      const pillars = ps(
        [Cheongan.GAP, Jiji.IN], [Cheongan.GI, Jiji.MI],
        [Cheongan.GAP, Jiji.JIN], [Cheongan.EUL, Jiji.MYO],
      );
      const f = assess(GyeokgukType.JEONGJAE, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
      expect(f.breakingFactors.some(s => s.includes('군겁쟁재'))).toBe(true);
    });

    it('guwon - gungeop jaengjae but gwanseong controls bigyeop', () => {
      // Year=GAP(bigyeon), Month=EUL(gyeobjae), Day=GAP, Hour=SIN(jeonggwan) -> bigyeop 2 + gwan rescue
      const pillars = ps(
        [Cheongan.GAP, Jiji.IN], [Cheongan.EUL, Jiji.MYO],
        [Cheongan.GAP, Jiji.JIN], [Cheongan.SIN, Jiji.YU],
      );
      const f = assess(GyeokgukType.JEONGJAE, pillars, strong());
      // Has both breaking (2 bigyeop -> gungeop jaengjae) and rescue (gwan controls)
      expect(f.quality).toBe(GyeokgukQuality.RESCUED);
    });
  });

  // -----------------------------------------------------------------
  // 3. PyeonJae (偏財格) -- same rules as JeongJae
  // -----------------------------------------------------------------

  describe('PyeonJae Formation', () => {
    it('pyeonjae uses same rules as jeongjae', () => {
      // Year=GAP(bigyeon), Month=MU(pyeonjae), Day=GAP, Hour=EUL(gyeobjae)
      const pillars = ps(
        [Cheongan.GAP, Jiji.IN], [Cheongan.MU, Jiji.JIN],
        [Cheongan.GAP, Jiji.O], [Cheongan.EUL, Jiji.MYO],
      );
      const f = assess(GyeokgukType.PYEONJAE, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
      expect(f.breakingFactors.some(s => s.includes('군겁쟁재'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // 4. SikSin (食神格)
  // -----------------------------------------------------------------

  describe('SikSin Formation', () => {
    // Day master: GAP. siksin = BYEONG (fire).
    // pyeonin = IM (water). pyeonjae = MU (earth). pyeongwan = GYEONG (metal).

    it('seonggyeok - siksin saengjae + singang', () => {
      // Year=MU(jae), Month=BYEONG(siksin), Day=GAP, Hour=GI(jae)
      const pillars = ps(
        [Cheongan.MU, Jiji.JIN], [Cheongan.BYEONG, Jiji.SA],
        [Cheongan.GAP, Jiji.IN], [Cheongan.GI, Jiji.MI],
      );
      const f = assess(GyeokgukType.SIKSIN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('pagyeok - hyoshin talsik (pyeonin touchul, no pyeonjae)', () => {
      // Year=IM(pyeonin), Month=BYEONG(siksin), Day=GAP, Hour=GAP(bigyeon)
      const pillars = ps(
        [Cheongan.IM, Jiji.JA], [Cheongan.BYEONG, Jiji.SA],
        [Cheongan.GAP, Jiji.IN], [Cheongan.GAP, Jiji.JIN],
      );
      const f = assess(GyeokgukType.SIKSIN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
      expect(f.breakingFactors.some(s => s.includes('효신탈식'))).toBe(true);
    });

    it('guwon - hyoshin talsik but pyeonjae suppresses pyeonin', () => {
      // Year=IM(pyeonin), Month=BYEONG(siksin), Day=GAP, Hour=MU(pyeonjae)
      const pillars = ps(
        [Cheongan.IM, Jiji.JA], [Cheongan.BYEONG, Jiji.SA],
        [Cheongan.GAP, Jiji.IN], [Cheongan.MU, Jiji.JIN],
      );
      const f = assess(GyeokgukType.SIKSIN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.RESCUED);
      expect(f.rescueFactors.some(s => s.includes('제효호식') || s.includes('편재'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // 5. SangGwan (傷官格)
  // -----------------------------------------------------------------

  describe('SangGwan Formation', () => {
    // Day master: GAP. sanggwan = JEONG (fire).
    // jeonggwan = SIN (metal). inseong = IM/GYE (water). jae = MU/GI (earth).

    it('seonggyeok - sanggwan saengjae', () => {
      // Year=MU(jae), Month=JEONG(sanggwan), Day=GAP, Hour=GI(jae)
      const pillars = ps(
        [Cheongan.MU, Jiji.JIN], [Cheongan.JEONG, Jiji.SA],
        [Cheongan.GAP, Jiji.IN], [Cheongan.GI, Jiji.MI],
      );
      const f = assess(GyeokgukType.SANGGWAN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('pagyeok - sanggwan gyeongwan (jeonggwan touchul, no inseong)', () => {
      // Year=SIN(jeonggwan), Month=JEONG(sanggwan), Day=GAP, Hour=GAP(bigyeon)
      const pillars = ps(
        [Cheongan.SIN, Jiji.YU], [Cheongan.JEONG, Jiji.SA],
        [Cheongan.GAP, Jiji.IN], [Cheongan.GAP, Jiji.JIN],
      );
      const f = assess(GyeokgukType.SANGGWAN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
      expect(f.breakingFactors.some(s => s.includes('상관견관'))).toBe(true);
    });

    it('guwon - sanggwan gyeongwan but inseong protects', () => {
      // Year=SIN(jeonggwan), Month=JEONG(sanggwan), Day=GAP, Hour=IM(inseong)
      const pillars = ps(
        [Cheongan.SIN, Jiji.YU], [Cheongan.JEONG, Jiji.SA],
        [Cheongan.GAP, Jiji.IN], [Cheongan.IM, Jiji.JA],
      );
      const f = assess(GyeokgukType.SANGGWAN, pillars, weak());
      expect(f.quality).toBe(GyeokgukQuality.RESCUED);
    });
  });

  // -----------------------------------------------------------------
  // 6. PyeonGwan (偏官格/七殺格)
  // -----------------------------------------------------------------

  describe('PyeonGwan Formation', () => {
    // Day master: GAP. pyeongwan = GYEONG (metal).
    // siksin = BYEONG (fire). inseong = IM (water). jae = MU (earth).

    it('seonggyeok - siksin jesal', () => {
      // Year=BYEONG(siksin), Month=GYEONG(pyeongwan), Day=GAP, Hour=MU(jae)
      const pillars = ps(
        [Cheongan.BYEONG, Jiji.SA], [Cheongan.GYEONG, Jiji.SIN],
        [Cheongan.GAP, Jiji.IN], [Cheongan.MU, Jiji.JIN],
      );
      const f = assess(GyeokgukType.PYEONGWAN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('pagyeok - chilsal muje (no siksin/inseong/yangin)', () => {
      // Year=MU(jae), Month=GYEONG(pyeongwan), Day=GAP, Hour=GI(jae)
      const pillars = ps(
        [Cheongan.MU, Jiji.JIN], [Cheongan.GYEONG, Jiji.SIN],
        [Cheongan.GAP, Jiji.IN], [Cheongan.GI, Jiji.MI],
      );
      const f = assess(GyeokgukType.PYEONGWAN, pillars, weak());
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
      expect(f.breakingFactors.some(s =>
        s.includes('칠살무제') || s.includes('재생살') || s.includes('신약'),
      )).toBe(true);
    });

    it('seonggyeok - salin sangsaeng (inseong converts sal energy)', () => {
      // Year=IM(inseong), Month=GYEONG(pyeongwan), Day=GAP, Hour=GYE(inseong)
      const pillars = ps(
        [Cheongan.IM, Jiji.JA], [Cheongan.GYEONG, Jiji.SIN],
        [Cheongan.GAP, Jiji.IN], [Cheongan.GYE, Jiji.HAE],
      );
      const f = assess(GyeokgukType.PYEONGWAN, pillars, weak());
      expect(f.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('pagyeok - intal sik (siksin+inseong conflict without jae)', () => {
      // Year=BYEONG(siksin), Month=GYEONG(pyeongwan), Day=GAP, Hour=IM(inseong) -> in geuk sik
      const pillars = ps(
        [Cheongan.BYEONG, Jiji.SA], [Cheongan.GYEONG, Jiji.SIN],
        [Cheongan.GAP, Jiji.IN], [Cheongan.IM, Jiji.JA],
      );
      const f = assess(GyeokgukType.PYEONGWAN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
      expect(f.breakingFactors.some(s => s.includes('인탈식'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // 7. JeongIn (正印格)
  // -----------------------------------------------------------------

  describe('JeongIn Formation', () => {
    // Day master: GAP. jeongin = GYE (water).
    // gwanseong = GYEONG/SIN (metal). jae = MU/GI (earth). siksang = BYEONG/JEONG (fire).

    it('seonggyeok - gwanin sangsaeng', () => {
      // Year=SIN(jeonggwan), Month=GYE(jeongin), Day=GAP, Hour=BYEONG(siksin)
      const pillars = ps(
        [Cheongan.SIN, Jiji.YU], [Cheongan.GYE, Jiji.HAE],
        [Cheongan.GAP, Jiji.IN], [Cheongan.BYEONG, Jiji.SA],
      );
      const f = assess(GyeokgukType.JEONGIN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('pagyeok - ingyeong bongjae (sinyak + jae geuk in + no bigyeop)', () => {
      // Year=MU(jae), Month=GYE(jeongin), Day=GAP, Hour=GI(jae)
      const pillars = ps(
        [Cheongan.MU, Jiji.JIN], [Cheongan.GYE, Jiji.HAE],
        [Cheongan.GAP, Jiji.IN], [Cheongan.GI, Jiji.MI],
      );
      const f = assess(GyeokgukType.JEONGIN, pillars, weak());
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
      expect(f.breakingFactors.some(s => s.includes('인경봉재'))).toBe(true);
    });

    it('guwon - ingyeong bongjae but bigyeop controls jae', () => {
      // Year=MU(jae), Month=GYE(jeongin), Day=GAP, Hour=EUL(gyeobjae)
      const pillars = ps(
        [Cheongan.MU, Jiji.JIN], [Cheongan.GYE, Jiji.HAE],
        [Cheongan.GAP, Jiji.IN], [Cheongan.EUL, Jiji.MYO],
      );
      const f = assess(GyeokgukType.JEONGIN, pillars, weak());
      expect(f.quality).toBe(GyeokgukQuality.RESCUED);
      expect(f.rescueFactors.some(s => s.includes('비겁') || s.includes('겁재'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // 8. PyeonIn (偏印格)
  // -----------------------------------------------------------------

  describe('PyeonIn Formation', () => {
    // Day master: GAP. pyeonin = IM (water).
    // siksin = BYEONG (fire). pyeonjae = MU (earth). pyeongwan = GYEONG (metal).

    it('pagyeok - hyoshin talsik (pyeonin-gyeok with siksin touchul + no pyeonjae)', () => {
      // Year=BYEONG(siksin), Month=IM(pyeonin), Day=GAP, Hour=GAP(bigyeon)
      const pillars = ps(
        [Cheongan.BYEONG, Jiji.SA], [Cheongan.IM, Jiji.JA],
        [Cheongan.GAP, Jiji.IN], [Cheongan.GAP, Jiji.JIN],
      );
      const f = assess(GyeokgukType.PYEONIN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
      expect(f.breakingFactors.some(s => s.includes('효신탈식'))).toBe(true);
    });

    it('guwon - hyoshin talsik but pyeonjae suppresses pyeonin', () => {
      // Year=BYEONG(siksin), Month=IM(pyeonin), Day=GAP, Hour=MU(pyeonjae)
      const pillars = ps(
        [Cheongan.BYEONG, Jiji.SA], [Cheongan.IM, Jiji.JA],
        [Cheongan.GAP, Jiji.IN], [Cheongan.MU, Jiji.JIN],
      );
      const f = assess(GyeokgukType.PYEONIN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.RESCUED);
    });

    it('seonggyeok - salin sangsaeng (pyeongwan + pyeonin)', () => {
      // Year=GYEONG(pyeongwan), Month=IM(pyeonin), Day=GAP, Hour=EUL(gyeobjae)
      const pillars = ps(
        [Cheongan.GYEONG, Jiji.SIN], [Cheongan.IM, Jiji.JA],
        [Cheongan.GAP, Jiji.IN], [Cheongan.EUL, Jiji.MYO],
      );
      const f = assess(GyeokgukType.PYEONIN, pillars, weak());
      expect(f.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });
  });

  // -----------------------------------------------------------------
  // 9. GeonRok (建祿格)
  // -----------------------------------------------------------------

  describe('GeonRok Formation', () => {
    // Day master: GAP. GeonRok = wolji IN (bigyeon GAP as jeonggi).
    // jeonggwan = SIN (metal). jae = MU/GI (earth). siksang = BYEONG/JEONG (fire).

    it('seonggyeok - tugwan bongjae-in', () => {
      // Year=MU(jae), Month=GAP(bigyeon), Day=GAP, Hour=SIN(jeonggwan)
      const pillars = ps(
        [Cheongan.MU, Jiji.JIN], [Cheongan.GAP, Jiji.IN],
        [Cheongan.GAP, Jiji.O], [Cheongan.SIN, Jiji.YU],
      );
      const f = assess(GyeokgukType.GEONROK, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('pagyeok - mujae gwansiksang (all bigyeop only)', () => {
      // Year=GAP(bigyeon), Month=GAP(bigyeon), Day=GAP, Hour=EUL(gyeobjae)
      const pillars = ps(
        [Cheongan.GAP, Jiji.IN], [Cheongan.GAP, Jiji.IN],
        [Cheongan.GAP, Jiji.JIN], [Cheongan.EUL, Jiji.MYO],
      );
      const f = assess(GyeokgukType.GEONROK, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
      expect(f.breakingFactors.some(s => s.includes('무재관식상'))).toBe(true);
    });

    it('pagyeok - tugwan bongsang (gwan touchul but sanggwan geuk)', () => {
      // Year=JEONG(sanggwan), Month=GAP(bigyeon), Day=GAP, Hour=SIN(jeonggwan)
      const pillars = ps(
        [Cheongan.JEONG, Jiji.SA], [Cheongan.GAP, Jiji.IN],
        [Cheongan.GAP, Jiji.O], [Cheongan.SIN, Jiji.YU],
      );
      const f = assess(GyeokgukType.GEONROK, pillars, strong());
      // Has breaking (sanggwan gyeongwan) but also has gwan+jae or siksang
      expect(
        f.quality === GyeokgukQuality.BROKEN || f.quality === GyeokgukQuality.RESCUED,
      ).toBe(true);
      expect(f.breakingFactors.some(s => s.includes('투관봉상'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // 10. YangIn (羊刃格)
  // -----------------------------------------------------------------

  describe('YangIn Formation', () => {
    // Day master: GAP. YangIn = wolji MYO (gyeobjae EUL as jeonggi).
    // gwanseong = GYEONG(pyeongwan)/SIN(jeonggwan). sanggwan = JEONG (fire).

    it('seonggyeok - gwansal controls yangin', () => {
      // Year=MU(jae), Month=EUL(gyeobjae), Day=GAP, Hour=GYEONG(pyeongwan)
      const pillars = ps(
        [Cheongan.MU, Jiji.JIN], [Cheongan.EUL, Jiji.MYO],
        [Cheongan.GAP, Jiji.IN], [Cheongan.GYEONG, Jiji.SIN],
      );
      const f = assess(GyeokgukType.YANGIN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.WELL_FORMED);
    });

    it('pagyeok - yangin mugwansal', () => {
      // Year=BYEONG(siksin), Month=EUL(gyeobjae), Day=GAP, Hour=MU(jae)
      const pillars = ps(
        [Cheongan.BYEONG, Jiji.SA], [Cheongan.EUL, Jiji.MYO],
        [Cheongan.GAP, Jiji.IN], [Cheongan.MU, Jiji.JIN],
      );
      const f = assess(GyeokgukType.YANGIN, pillars, strong());
      expect(f.quality).toBe(GyeokgukQuality.BROKEN);
      expect(f.breakingFactors.some(s => s.includes('양인무관살'))).toBe(true);
    });

    it('pagyeok - sanggwan geuk gwan with no inseong', () => {
      // Year=JEONG(sanggwan), Month=EUL(gyeobjae), Day=GAP, Hour=SIN(jeonggwan)
      const pillars = ps(
        [Cheongan.JEONG, Jiji.SA], [Cheongan.EUL, Jiji.MYO],
        [Cheongan.GAP, Jiji.IN], [Cheongan.SIN, Jiji.YU],
      );
      const f = assess(GyeokgukType.YANGIN, pillars, strong());
      expect(f.breakingFactors.some(s => s.includes('상관견관'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // Reasoning and output validation
  // -----------------------------------------------------------------

  it('reasoning contains pattern name in Korean', () => {
    const pillars = ps(
      [Cheongan.MU, Jiji.SUL], [Cheongan.SIN, Jiji.YU],
      [Cheongan.GAP, Jiji.IN], [Cheongan.IM, Jiji.JA],
    );
    const f = assess(GyeokgukType.JEONGGWAN, pillars, strong());
    expect(f.reasoning).toContain('정관격');
  });

  it('well-formed reasoning mentions seonggyeok', () => {
    const pillars = ps(
      [Cheongan.MU, Jiji.SUL], [Cheongan.SIN, Jiji.YU],
      [Cheongan.GAP, Jiji.IN], [Cheongan.IM, Jiji.JA],
    );
    const f = assess(GyeokgukType.JEONGGWAN, pillars, strong());
    expect(f.reasoning).toContain('성격');
  });

  it('broken reasoning mentions pagyeok', () => {
    const pillars = ps(
      [Cheongan.JEONG, Jiji.SA], [Cheongan.SIN, Jiji.YU],
      [Cheongan.GAP, Jiji.IN], [Cheongan.MU, Jiji.JIN],
    );
    const f = assess(GyeokgukType.JEONGGWAN, pillars, strong());
    expect(f.reasoning).toContain('파격');
  });

  // -----------------------------------------------------------------
  // Pipeline integration
  // -----------------------------------------------------------------

  it('formation is populated via pipeline', async () => {
    const { analyzeSaju } = await import('../../../src/engine/SajuAnalysisPipeline.js');
    const { createBirthInput } = await import('../../../src/domain/types.js');
    const { Gender } = await import('../../../src/domain/Gender.js');

    const input = createBirthInput({
      birthYear: 1990, birthMonth: 6, birthDay: 15, birthHour: 10, birthMinute: 30,
      gender: Gender.MALE,
    });
    const analysis = analyzeSaju(input);

    const gr = analysis.gyeokgukResult;
    expect(gr).toBeDefined();
    expect(gr!.formation).toBeDefined();
    expect([
      GyeokgukQuality.WELL_FORMED,
      GyeokgukQuality.BROKEN,
      GyeokgukQuality.RESCUED,
      GyeokgukQuality.NOT_ASSESSED,
    ]).toContain(gr!.formation!.quality);
  });

  // -----------------------------------------------------------------
  // Hidden Stem Breaking (BLG-M4)
  // -----------------------------------------------------------------

  describe('HiddenStem Breaking', () => {

    it('jeonggwan-gyeok - hidden sanggwan in jijanggan triggers potential pagyeok', () => {
      // GAP daymaster + jeonggwan-gyeok
      // cheongan: SIN=jeonggwan, GI=jeongjae, IM=pyeonin -> no sanggwan (seonggyeok)
      // jiji: O's jeonggi=JEONG=sanggwan -> hidden potential pagyeok
      const pillars = ps(
        [Cheongan.SIN, Jiji.IN],    // SIN=jeonggwan
        [Cheongan.GI, Jiji.MYO],    // GI=jeongjae
        [Cheongan.GAP, Jiji.O],     // ilju: GAP+O (O jeonggi=JEONG=sanggwan)
        [Cheongan.IM, Jiji.SIN],    // IM=pyeonin
      );
      const result = assess(GyeokgukType.JEONGGWAN, pillars, strong());
      expect(
        result.breakingFactors.some(s => s.includes('잠재') && s.includes('상관')),
      ).toBe(true);
    });

    it('jeonggwan-gyeok - sanggwan already in cheongan means no hidden warning', () => {
      // GAP + cheongan already has JEONG=sanggwan -> hasHiddenSangGwan = false
      const pillars = ps(
        [Cheongan.JEONG, Jiji.IN],  // JEONG=sanggwan (already touchul)
        [Cheongan.SIN, Jiji.MYO],   // SIN=jeonggwan
        [Cheongan.GAP, Jiji.O],     // ilju
        [Cheongan.IM, Jiji.SIN],    // IM=pyeonin
      );
      const result = assess(GyeokgukType.JEONGGWAN, pillars, strong());
      // Should have sanggwan gyeongwan as main breaking, NOT hidden
      expect(result.breakingFactors.some(s => s.includes('상관견관'))).toBe(true);
      expect(
        result.breakingFactors.some(s => s.includes('잠재') && s.includes('상관')),
      ).toBe(false);
    });

    it('siksin-gyeok - hidden pyeonin in jijanggan triggers potential pagyeok', () => {
      // GAP daymaster + siksin-gyeok
      // cheongan: BYEONG=siksin, MU=pyeonjae, GI=jeongjae -> no pyeonin
      // jiji: HAE's jeonggi=IM=pyeonin -> hidden potential pagyeok
      const pillars = ps(
        [Cheongan.BYEONG, Jiji.JA], // BYEONG=siksin
        [Cheongan.MU, Jiji.JIN],    // MU=pyeonjae
        [Cheongan.GAP, Jiji.HAE],   // ilju: GAP+HAE (HAE jeonggi=IM=pyeonin)
        [Cheongan.GI, Jiji.MI],     // GI=jeongjae
      );
      const result = assess(GyeokgukType.SIKSIN, pillars, strong());
      expect(
        result.breakingFactors.some(s => s.includes('잠재') && s.includes('편인')),
      ).toBe(true);
    });

    it('jeongjae-gyeok - hidden gyeobjae in jijanggan triggers potential pagyeok', () => {
      // GAP daymaster + jeongjae-gyeok
      // cheongan: GI=jeongjae, BYEONG=siksin, GI=jeongjae -> no bigyeop
      // jiji: MYO's jeonggi=EUL=gyeobjae -> hidden potential pagyeok
      const pillars = ps(
        [Cheongan.GI, Jiji.JA],     // GI=jeongjae
        [Cheongan.BYEONG, Jiji.IN], // BYEONG=siksin
        [Cheongan.GAP, Jiji.MYO],   // ilju: GAP+MYO (MYO jeonggi=EUL=gyeobjae)
        [Cheongan.GI, Jiji.SIN],    // GI=jeongjae
      );
      const result = assess(GyeokgukType.JEONGJAE, pillars, strong());
      expect(
        result.breakingFactors.some(s => s.includes('잠재') && s.includes('겁재')),
      ).toBe(true);
    });

    it('jeonggwan-gyeok - no hidden pagyeok elements means no hidden warning', () => {
      // GAP + IN's jeonggi=GAP=bigyeon -> bigyeon is not a pagyeok factor
      const pillars = ps(
        [Cheongan.SIN, Jiji.SUL],   // SIN=jeonggwan
        [Cheongan.GI, Jiji.JIN],    // GI=jeongjae
        [Cheongan.GAP, Jiji.IN],    // ilju: GAP+IN (IN jeonggi=GAP=bigyeon, same as ilgan so excluded)
        [Cheongan.IM, Jiji.SIN],    // IM=pyeonin
      );
      const result = assess(GyeokgukType.JEONGGWAN, pillars, strong());
      expect(
        result.breakingFactors.some(s => s.includes('잠재')),
      ).toBe(false);
    });
  });
});
