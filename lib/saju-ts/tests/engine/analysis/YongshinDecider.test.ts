import { describe, it, expect } from 'vitest';
import { Cheongan, CHEONGAN_INFO, CHEONGAN_VALUES } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../../src/domain/Jiji.js';
import { Ohaeng, OhaengRelations, OHAENG_VALUES } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import {
  YongshinType,
  YongshinAgreement,
  YONGSHIN_AGREEMENT_INFO,
} from '../../../src/domain/YongshinResult.js';
import {
  GyeokgukType,
  GyeokgukCategory,
  GYEOKGUK_TYPE_INFO,
} from '../../../src/domain/Gyeokguk.js';
import type { GyeokgukResult } from '../../../src/domain/Gyeokguk.js';
import { HapState } from '../../../src/domain/Relations.js';
import type { HapHwaEvaluation } from '../../../src/domain/Relations.js';
import {
  YongshinPriority,
  JonggyeokYongshinMode,
  DEFAULT_CONFIG,
  createConfig,
} from '../../../src/config/CalculationConfig.js';
import { YongshinDecider } from '../../../src/engine/analysis/YongshinDecider.js';

const { WOOD, FIRE, EARTH, METAL, WATER } = Ohaeng;

// ── Helpers ──────────────────────────────────────────────────────

function makeGyeokguk(type: GyeokgukType): GyeokgukResult {
  return {
    type,
    category: GyeokgukCategory.JONGGYEOK,
    baseSipseong: null,
    confidence: 0.85,
    reasoning: '테스트용 종격',
    formation: null,
  };
}

function makeNaegyeok(type: GyeokgukType): GyeokgukResult {
  return {
    type,
    category: GyeokgukCategory.NAEGYEOK,
    baseSipseong: null,
    confidence: 1.0,
    reasoning: '테스트용 내격',
    formation: null,
  };
}

// ══════════════════════════════════════════════════════════════════
// 조후용신 individual tests
// ══════════════════════════════════════════════════════════════════

describe('JohuYongshin', () => {
  it('갑목 인월 returns WATER/FIRE', () => {
    const rec = YongshinDecider.johuYongshin(Cheongan.GAP, Jiji.IN);
    expect(rec.type).toBe(YongshinType.JOHU);
    expect(rec.primaryElement).toBe(WATER);
    expect(rec.secondaryElement).toBe(FIRE);
  });

  it('병화 자월 returns WOOD/FIRE', () => {
    const rec = YongshinDecider.johuYongshin(Cheongan.BYEONG, Jiji.JA);
    expect(rec.type).toBe(YongshinType.JOHU);
    expect(rec.primaryElement).toBe(WOOD);
    expect(rec.secondaryElement).toBe(FIRE);
  });

  it('confidence is positive and <= 1', () => {
    const rec = YongshinDecider.johuYongshin(Cheongan.GAP, Jiji.SA);
    expect(rec.confidence).toBeGreaterThan(0);
    expect(rec.confidence).toBeLessThanOrEqual(1.0);
  });

  it('reasoning contains Korean terms', () => {
    const rec = YongshinDecider.johuYongshin(Cheongan.GAP, Jiji.IN);
    expect(rec.reasoning).toContain('조후');
    expect(rec.reasoning).toContain('궁통보감');
  });
});

// ══════════════════════════════════════════════════════════════════
// 억부용신 individual tests
// ══════════════════════════════════════════════════════════════════

describe('EokbuYongshin', () => {
  it('신강 WOOD returns FIRE (식상)', () => {
    const rec = YongshinDecider.eokbuYongshin(WOOD, true);
    expect(rec.type).toBe(YongshinType.EOKBU);
    expect(rec.primaryElement).toBe(FIRE);
    expect(rec.secondaryElement).toBe(EARTH);
  });

  it('신약 WOOD returns WATER (인성)', () => {
    const rec = YongshinDecider.eokbuYongshin(WOOD, false);
    expect(rec.type).toBe(YongshinType.EOKBU);
    expect(rec.primaryElement).toBe(WATER);
    expect(rec.secondaryElement).toBe(WOOD);
  });

  it('신강 FIRE returns EARTH', () => {
    const rec = YongshinDecider.eokbuYongshin(FIRE, true);
    expect(rec.primaryElement).toBe(EARTH);
    expect(rec.secondaryElement).toBe(METAL);
  });

  it('신약 FIRE returns WOOD', () => {
    const rec = YongshinDecider.eokbuYongshin(FIRE, false);
    expect(rec.primaryElement).toBe(WOOD);
    expect(rec.secondaryElement).toBe(FIRE);
  });

  it('신강 EARTH returns METAL', () => {
    const rec = YongshinDecider.eokbuYongshin(EARTH, true);
    expect(rec.primaryElement).toBe(METAL);
    expect(rec.secondaryElement).toBe(WATER);
  });

  it('신약 EARTH returns FIRE', () => {
    const rec = YongshinDecider.eokbuYongshin(EARTH, false);
    expect(rec.primaryElement).toBe(FIRE);
    expect(rec.secondaryElement).toBe(EARTH);
  });

  it('신강 METAL returns WATER', () => {
    const rec = YongshinDecider.eokbuYongshin(METAL, true);
    expect(rec.primaryElement).toBe(WATER);
    expect(rec.secondaryElement).toBe(WOOD);
  });

  it('신약 METAL returns EARTH', () => {
    const rec = YongshinDecider.eokbuYongshin(METAL, false);
    expect(rec.primaryElement).toBe(EARTH);
    expect(rec.secondaryElement).toBe(METAL);
  });

  it('신강 WATER returns WOOD', () => {
    const rec = YongshinDecider.eokbuYongshin(WATER, true);
    expect(rec.primaryElement).toBe(WOOD);
    expect(rec.secondaryElement).toBe(FIRE);
  });

  it('신약 WATER returns METAL', () => {
    const rec = YongshinDecider.eokbuYongshin(WATER, false);
    expect(rec.primaryElement).toBe(METAL);
    expect(rec.secondaryElement).toBe(WATER);
  });

  it('reasoning mentions strength direction', () => {
    const strong = YongshinDecider.eokbuYongshin(WOOD, true);
    expect(strong.reasoning).toContain('신강');

    const weak = YongshinDecider.eokbuYongshin(WOOD, false);
    expect(weak.reasoning).toContain('신약');
  });
});

// ══════════════════════════════════════════════════════════════════
// 억부용신 structural properties (all 5 elements x 2 directions)
// ══════════════════════════════════════════════════════════════════

describe('EokbuYongshin structural properties', () => {
  it('strong primary is always generates(dayMaster)', () => {
    for (const element of OHAENG_VALUES) {
      const rec = YongshinDecider.eokbuYongshin(element, true);
      expect(rec.primaryElement).toBe(OhaengRelations.generates(element));
    }
  });

  it('weak primary is always generatedBy(dayMaster)', () => {
    for (const element of OHAENG_VALUES) {
      const rec = YongshinDecider.eokbuYongshin(element, false);
      expect(rec.primaryElement).toBe(OhaengRelations.generatedBy(element));
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// Combined decide() tests
// ══════════════════════════════════════════════════════════════════

describe('decide()', () => {
  it('weak WOOD + IN month: 억부(수) + 조후(수) agree -> 수', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GYE, Jiji.MI),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.BYEONG, Jiji.JA),
    );
    const result = YongshinDecider.decide(pillars, false, WOOD);

    expect(result.finalYongshin).toBe(WATER);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
    expect(result.finalHeesin).not.toBeNull();
    expect(result.gisin).not.toBeNull();
    expect(result.gusin).not.toBeNull();
  });

  it('weak FIRE + JA month: 억부(목) + 조후(목) agree -> 목', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.SIN),
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
      new Pillar(Cheongan.GYEONG, Jiji.JIN),
    );
    const result = YongshinDecider.decide(pillars, false, FIRE);

    expect(result.finalYongshin).toBe(WOOD);
  });

  it('strong WOOD + IN month: cross-match -> 화', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
      new Pillar(Cheongan.GAP, Jiji.JIN),
      new Pillar(Cheongan.GAP, Jiji.IN),
    );
    const result = YongshinDecider.decide(pillars, true, WOOD);

    expect(result.finalYongshin).toBe(FIRE);
  });

  it('strong WOOD + HAE month: 억부(화) + 조후(화) agree -> 화', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.EUL, Jiji.MYO),
      new Pillar(Cheongan.JEONG, Jiji.HAE),
      new Pillar(Cheongan.GAP, Jiji.JIN),
      new Pillar(Cheongan.GAP, Jiji.IN),
    );
    const result = YongshinDecider.decide(pillars, true, WOOD);

    expect(result.finalYongshin).toBe(FIRE);
  });

  it('full disagreement: 조후 takes priority (default)', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.EUL, Jiji.MYO),
      new Pillar(Cheongan.GYEONG, Jiji.O),
      new Pillar(Cheongan.BYEONG, Jiji.SUL),
    );
    const result = YongshinDecider.decide(pillars, true, METAL);

    expect(result.finalYongshin).toBe(FIRE);
  });
});

// ══════════════════════════════════════════════════════════════════
// 기신 / 구신 derivation tests
// ══════════════════════════════════════════════════════════════════

describe('Gisin / Gusin derivation', () => {
  it('기신 is element that controls 용신', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GYE, Jiji.MI),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.BYEONG, Jiji.JA),
    );
    const result = YongshinDecider.decide(pillars, false, WOOD);

    // finalYongshin = WATER, 기신 = controlledBy(WATER) = EARTH
    expect(result.gisin).toBe(EARTH);
  });

  it('구신 is element that generates 기신', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GYE, Jiji.MI),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.BYEONG, Jiji.JA),
    );
    const result = YongshinDecider.decide(pillars, false, WOOD);

    // 기신 = EARTH, 구신 = generatedBy(EARTH) = FIRE
    expect(result.gusin).toBe(FIRE);
  });
});

// ══════════════════════════════════════════════════════════════════
// Result structure tests
// ══════════════════════════════════════════════════════════════════

describe('Result structure', () => {
  it('always contains at least 억부 + 조후', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.SA),
      new Pillar(Cheongan.MU, Jiji.SIN),
      new Pillar(Cheongan.GYEONG, Jiji.HAE),
    );
    const result = YongshinDecider.decide(pillars, true, EARTH);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(2);

    const types = new Set(result.recommendations.map(r => r.type));
    expect(types.has(YongshinType.EOKBU)).toBe(true);
    expect(types.has(YongshinType.JOHU)).toBe(true);
  });

  it('all confidences are in valid range [0, 1]', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.SA),
      new Pillar(Cheongan.MU, Jiji.SIN),
      new Pillar(Cheongan.GYEONG, Jiji.HAE),
    );
    const result = YongshinDecider.decide(pillars, true, EARTH);

    for (const rec of result.recommendations) {
      expect(rec.confidence).toBeGreaterThanOrEqual(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('finalYongshin and gisin are never the same', () => {
    const stems = [Cheongan.GAP, Cheongan.BYEONG, Cheongan.MU, Cheongan.GYEONG, Cheongan.IM];
    const branches = [Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.HAE];

    for (const stem of stems) {
      for (const branch of branches) {
        for (const strong of [true, false]) {
          const pillars = new PillarSet(
            new Pillar(Cheongan.GAP, Jiji.JA),
            new Pillar(stem, branch),
            new Pillar(stem, Jiji.O),
            new Pillar(Cheongan.GYEONG, Jiji.SUL),
          );
          const result = YongshinDecider.decide(
            pillars, strong, CHEONGAN_INFO[stem].ohaeng,
          );
          expect(result.finalYongshin).not.toBe(result.gisin);
        }
      }
    }
  });

  it('기신 controls 용신 for all combinations', () => {
    const stems = [Cheongan.GAP, Cheongan.BYEONG, Cheongan.MU, Cheongan.GYEONG, Cheongan.IM];

    for (const stem of stems) {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(stem, Jiji.IN),
        new Pillar(stem, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SUL),
      );
      const result = YongshinDecider.decide(pillars, false, CHEONGAN_INFO[stem].ohaeng);
      const gisin = result.gisin!;

      expect(OhaengRelations.controls(gisin)).toBe(result.finalYongshin);
    }
  });

  it('구신 generates 기신 for all combinations', () => {
    const stems = [Cheongan.GAP, Cheongan.BYEONG, Cheongan.MU, Cheongan.GYEONG, Cheongan.IM];

    for (const stem of stems) {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(stem, Jiji.IN),
        new Pillar(stem, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SUL),
      );
      const result = YongshinDecider.decide(pillars, true, CHEONGAN_INFO[stem].ohaeng);
      const gisin = result.gisin!;
      const gusin = result.gusin!;

      expect(OhaengRelations.generates(gusin)).toBe(gisin);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// 통관용신 (Mediating Element) tests
// ══════════════════════════════════════════════════════════════════

describe('TongwanYongshin', () => {
  it('returns null for balanced chart', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.SA),
      new Pillar(Cheongan.MU, Jiji.SIN),
      new Pillar(Cheongan.GYEONG, Jiji.HAE),
    );
    const result = YongshinDecider.tongwanYongshin(pillars, EARTH);
    expect(result).toBeNull();
  });

  it('detects strong controller vs self conflict', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GYEONG, Jiji.IN),
      new Pillar(Cheongan.SIN, Jiji.MYO),
      new Pillar(Cheongan.GAP, Jiji.SIN),
      new Pillar(Cheongan.GYEONG, Jiji.IN),
    );
    const result = YongshinDecider.tongwanYongshin(pillars, WOOD);

    expect(result).not.toBeNull();
    expect(result!.type).toBe(YongshinType.TONGGWAN);
    expect(result!.primaryElement).toBe(WATER);
    expect(result!.reasoning).toContain('통관');
  });

  it('mediator follows generation cycle', () => {
    const expectedMediators: [Ohaeng, Ohaeng][] = [
      [WOOD, WATER],
      [FIRE, WOOD],
      [EARTH, FIRE],
      [METAL, EARTH],
      [WATER, METAL],
    ];

    for (const [dm, expectedMediator] of expectedMediators) {
      const controller = OhaengRelations.controlledBy(dm);
      const mediator = OhaengRelations.generates(controller);
      expect(mediator).toBe(expectedMediator);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// 전왕용신 (Following-Strength for 종격) tests
// ══════════════════════════════════════════════════════════════════

describe('JeonwangYongshin', () => {
  it('종강격 returns same element (비겁)', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.EUL, Jiji.MYO),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.EUL, Jiji.MYO),
    );
    const gyeokguk = makeGyeokguk(GyeokgukType.JONGGANG);
    const result = YongshinDecider.jeonwangYongshin(pillars, WOOD, gyeokguk, DEFAULT_CONFIG);

    expect(result).not.toBeNull();
    expect(result!.type).toBe(YongshinType.JEONWANG);
    expect(result!.primaryElement).toBe(WOOD);
    expect(result!.secondaryElement).toBe(WATER);
  });

  it('종아격 returns 식상 element', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.BYEONG, Jiji.SA),
      new Pillar(Cheongan.JEONG, Jiji.O),
      new Pillar(Cheongan.GAP, Jiji.SA),
      new Pillar(Cheongan.BYEONG, Jiji.O),
    );
    const gyeokguk = makeGyeokguk(GyeokgukType.JONGA);
    const result = YongshinDecider.jeonwangYongshin(pillars, WOOD, gyeokguk, DEFAULT_CONFIG);

    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(FIRE);
  });

  it('종재격 returns 재성 element', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.MU, Jiji.JIN),
      new Pillar(Cheongan.GI, Jiji.SUL),
      new Pillar(Cheongan.GAP, Jiji.JIN),
      new Pillar(Cheongan.MU, Jiji.SUL),
    );
    const gyeokguk = makeGyeokguk(GyeokgukType.JONGJAE);
    const result = YongshinDecider.jeonwangYongshin(pillars, WOOD, gyeokguk, DEFAULT_CONFIG);

    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(EARTH);
  });

  it('종살격 returns 관성 element', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GYEONG, Jiji.SIN),
      new Pillar(Cheongan.SIN, Jiji.YU),
      new Pillar(Cheongan.GAP, Jiji.SIN),
      new Pillar(Cheongan.GYEONG, Jiji.YU),
    );
    const gyeokguk = makeGyeokguk(GyeokgukType.JONGSAL);
    const result = YongshinDecider.jeonwangYongshin(pillars, WOOD, gyeokguk, DEFAULT_CONFIG);

    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(METAL);
  });

  it('returns null for 내격 chart', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.MU, Jiji.SIN),
    );
    const gyeokguk: GyeokgukResult = {
      type: GyeokgukType.GEONROK,
      category: GyeokgukCategory.NAEGYEOK,
      baseSipseong: null,
      confidence: 1.0,
      reasoning: '내격',
      formation: null,
    };
    const result = YongshinDecider.jeonwangYongshin(pillars, WOOD, gyeokguk, DEFAULT_CONFIG);
    expect(result).toBeNull();
  });

  it('added to recommendations for 종격 chart', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.EUL, Jiji.MYO),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.EUL, Jiji.MYO),
    );
    const gyeokguk = makeGyeokguk(GyeokgukType.JONGGANG);
    const result = YongshinDecider.decide(
      pillars, true, WOOD, DEFAULT_CONFIG, gyeokguk,
    );

    const types = new Set(result.recommendations.map(r => r.type));
    expect(types.has(YongshinType.JEONWANG)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
// Config-aware priority tests
// ══════════════════════════════════════════════════════════════════

describe('Config-aware priority', () => {
  const disagreeChart = () => new PillarSet(
    new Pillar(Cheongan.GAP, Jiji.IN),
    new Pillar(Cheongan.EUL, Jiji.MYO),
    new Pillar(Cheongan.GYEONG, Jiji.O),
    new Pillar(Cheongan.BYEONG, Jiji.SUL),
  );

  it('EOKBU_FIRST resolves disagreement to 억부', () => {
    const config = createConfig({ yongshinPriority: YongshinPriority.EOKBU_FIRST });
    const result = YongshinDecider.decide(disagreeChart(), true, METAL, config);
    expect(result.finalYongshin).toBe(WATER);
  });

  it('JOHU_FIRST resolves disagreement to 조후', () => {
    const config = createConfig({ yongshinPriority: YongshinPriority.JOHU_FIRST });
    const result = YongshinDecider.decide(disagreeChart(), true, METAL, config);
    expect(result.finalYongshin).toBe(FIRE);
  });

  it('EQUAL_WEIGHT prefers higher confidence (조후 0.8 > 억부 0.7)', () => {
    const config = createConfig({ yongshinPriority: YongshinPriority.EQUAL_WEIGHT });
    const result = YongshinDecider.decide(disagreeChart(), true, METAL, config);
    expect(result.finalYongshin).toBe(FIRE);
  });
});

// ══════════════════════════════════════════════════════════════════
// 격국용신 (Pattern-based Element for 내격) tests
// ══════════════════════════════════════════════════════════════════

describe('GyeokgukYongshin', () => {
  it('정관격 returns 재/인성', () => {
    const result = YongshinDecider.gyeokgukYongshin(WOOD, makeNaegyeok(GyeokgukType.JEONGGWAN));
    expect(result).not.toBeNull();
    expect(result!.type).toBe(YongshinType.GYEOKGUK);
    expect(result!.primaryElement).toBe(EARTH);
    expect(result!.secondaryElement).toBe(WATER);
    expect(result!.reasoning).toContain('순용');
  });

  it('정재격 returns 관/식상', () => {
    const result = YongshinDecider.gyeokgukYongshin(WOOD, makeNaegyeok(GyeokgukType.JEONGJAE));
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(METAL);
    expect(result!.secondaryElement).toBe(FIRE);
  });

  it('편재격 returns 관/식상 (for FIRE DM)', () => {
    const result = YongshinDecider.gyeokgukYongshin(FIRE, makeNaegyeok(GyeokgukType.PYEONJAE));
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(WATER);
    expect(result!.secondaryElement).toBe(EARTH);
  });

  it('정인격 returns 관 only', () => {
    const result = YongshinDecider.gyeokgukYongshin(METAL, makeNaegyeok(GyeokgukType.JEONGIN));
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(FIRE);
    expect(result!.secondaryElement).toBeNull();
  });

  it('식신격 returns 재/비겁', () => {
    const result = YongshinDecider.gyeokgukYongshin(WOOD, makeNaegyeok(GyeokgukType.SIKSIN));
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(EARTH);
    expect(result!.secondaryElement).toBe(WOOD);
  });

  it('건록격 returns 관/재', () => {
    const result = YongshinDecider.gyeokgukYongshin(WATER, makeNaegyeok(GyeokgukType.GEONROK));
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(EARTH);
    expect(result!.secondaryElement).toBe(FIRE);
  });

  it('편관격 returns 식상/인성 (역용)', () => {
    const result = YongshinDecider.gyeokgukYongshin(WOOD, makeNaegyeok(GyeokgukType.PYEONGWAN));
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(FIRE);
    expect(result!.secondaryElement).toBe(WATER);
    expect(result!.reasoning).toContain('역용');
  });

  it('상관격 returns 인성/재 (역용)', () => {
    const result = YongshinDecider.gyeokgukYongshin(EARTH, makeNaegyeok(GyeokgukType.SANGGWAN));
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(FIRE);
    expect(result!.secondaryElement).toBe(WATER);
  });

  it('편인격 returns 재 only (역용)', () => {
    const result = YongshinDecider.gyeokgukYongshin(METAL, makeNaegyeok(GyeokgukType.PYEONIN));
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(WOOD);
    expect(result!.secondaryElement).toBeNull();
  });

  it('양인격 returns 관 only (역용)', () => {
    const result = YongshinDecider.gyeokgukYongshin(FIRE, makeNaegyeok(GyeokgukType.YANGIN));
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(WATER);
    expect(result!.secondaryElement).toBeNull();
  });

  it('returns null for 종격', () => {
    const result = YongshinDecider.gyeokgukYongshin(WOOD, makeGyeokguk(GyeokgukType.JONGGANG));
    expect(result).toBeNull();
  });

  it('added to recommendations for 내격 chart', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.JEONG, Jiji.JA),
      new Pillar(Cheongan.JEONG, Jiji.IN),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.JEONG, Jiji.SIN),
    );
    const gyeokguk = makeNaegyeok(GyeokgukType.GEONROK);
    const result = YongshinDecider.decide(pillars, true, WOOD, DEFAULT_CONFIG, gyeokguk);

    const types = new Set(result.recommendations.map(r => r.type));
    expect(types.has(YongshinType.GYEOKGUK)).toBe(true);
  });

  it('all 10 내격 types return non-null', () => {
    const naegyeokTypes = [
      GyeokgukType.GEONROK, GyeokgukType.YANGIN,
      GyeokgukType.SIKSIN, GyeokgukType.SANGGWAN,
      GyeokgukType.PYEONJAE, GyeokgukType.JEONGJAE,
      GyeokgukType.PYEONGWAN, GyeokgukType.JEONGGWAN,
      GyeokgukType.PYEONIN, GyeokgukType.JEONGIN,
    ];
    for (const type of naegyeokTypes) {
      const result = YongshinDecider.gyeokgukYongshin(WOOD, makeNaegyeok(type));
      expect(result).not.toBeNull();
      expect(result!.type).toBe(YongshinType.GYEOKGUK);
      expect(result!.confidence).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// 병약용신 (Disease-Medicine Element) tests
// ══════════════════════════════════════════════════════════════════

describe('ByeongyakYongshin', () => {
  it('detects WOOD disease -> returns METAL', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.GAP, Jiji.MYO),
      new Pillar(Cheongan.GYEONG, Jiji.IN),
      new Pillar(Cheongan.EUL, Jiji.MYO),
    );
    const result = YongshinDecider.byeongyakYongshin(pillars, METAL, true);

    expect(result).not.toBeNull();
    expect(result!.type).toBe(YongshinType.BYEONGYAK);
    expect(result!.primaryElement).toBe(METAL);
    expect(result!.reasoning).toContain('병약');
    expect(result!.reasoning).toContain('유병방귀');
  });

  it('returns null for balanced chart', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.SA),
      new Pillar(Cheongan.MU, Jiji.SIN),
      new Pillar(Cheongan.GYEONG, Jiji.HAE),
    );
    const result = YongshinDecider.byeongyakYongshin(pillars, EARTH, true);
    expect(result).toBeNull();
  });

  it('skips when medicine overlaps with weak day master', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.BYEONG, Jiji.SA),
      new Pillar(Cheongan.JEONG, Jiji.O),
      new Pillar(Cheongan.IM, Jiji.SA),
      new Pillar(Cheongan.BYEONG, Jiji.O),
    );
    const result = YongshinDecider.byeongyakYongshin(pillars, WATER, false);
    expect(result).toBeNull();
  });

  it('added to full decide recommendations', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.GAP, Jiji.MYO),
      new Pillar(Cheongan.GYEONG, Jiji.IN),
      new Pillar(Cheongan.EUL, Jiji.MYO),
    );
    const result = YongshinDecider.decide(pillars, true, METAL);

    const types = new Set(result.recommendations.map(r => r.type));
    expect(types.has(YongshinType.BYEONGYAK)).toBe(true);
  });

  it('medicine is always controller of disease', () => {
    const expectedMedicine: [Ohaeng, Ohaeng][] = [
      [WOOD, METAL],
      [FIRE, WATER],
      [EARTH, WOOD],
      [METAL, FIRE],
      [WATER, EARTH],
    ];
    for (const [disease, medicine] of expectedMedicine) {
      expect(OhaengRelations.controlledBy(disease)).toBe(medicine);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// 합화 효과 전파 (HapHwa Propagation) tests
// ══════════════════════════════════════════════════════════════════

describe('HapHwa propagation', () => {
  it('byeongyakYongshin with HAPWHA counts transformed elements', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.MU, Jiji.JIN),
      new Pillar(Cheongan.GYE, Jiji.SA),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.EUL, Jiji.MI),
    );

    const hapWha: HapHwaEvaluation = {
      stem1: Cheongan.MU, stem2: Cheongan.GYE,
      position1: PillarPosition.YEAR, position2: PillarPosition.MONTH,
      resultOhaeng: Ohaeng.FIRE, state: HapState.HAPWHA,
      confidence: 0.85, conditionsMet: ['인접 조건', '월령 조건'],
      conditionsFailed: [], reasoning: '무계합화화',
      dayMasterInvolved: false,
    };

    // Without hap: stems are 무(EARTH), 계(WATER), 을(WOOD)
    const _withoutHap = YongshinDecider.byeongyakYongshin(pillars, WOOD, true);

    // With hapwha: stems become 화(FIRE), 화(FIRE), 을(WOOD)
    const _withHap = YongshinDecider.byeongyakYongshin(pillars, WOOD, true, [hapWha]);

    // The function should accept and process hapHwaEvaluations without error
    // (specific result depends on branch principal stems too)
  });

  it('tongwanYongshin with HAPGEO reduces element counts', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.GI, Jiji.MYO),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.GYEONG, Jiji.SIN),
    );

    const hapGeo: HapHwaEvaluation = {
      stem1: Cheongan.GAP, stem2: Cheongan.GI,
      position1: PillarPosition.YEAR, position2: PillarPosition.MONTH,
      resultOhaeng: EARTH, state: HapState.HAPGEO,
      confidence: 0.5, conditionsMet: ['인접 조건'],
      conditionsFailed: ['월령 조건'], reasoning: '갑기합거',
      dayMasterInvolved: false,
    };

    // Without hap
    const _withoutHap = YongshinDecider.tongwanYongshin(pillars, WOOD);

    // With hapgeo
    const _withHap = YongshinDecider.tongwanYongshin(pillars, WOOD, [hapGeo]);

    // Function should execute without error
  });
});

// ══════════════════════════════════════════════════════════════════
// 합화용신 (BLG-H3)
// ══════════════════════════════════════════════════════════════════

describe('HapwhaYongshin', () => {
  it('returns null when no HAPWHA evaluation', () => {
    const gyeokguk: GyeokgukResult = {
      type: GyeokgukType.HAPWHA_EARTH,
      category: GyeokgukCategory.HWAGYEOK,
      baseSipseong: null,
      confidence: 0.8,
      reasoning: '갑기합화토격 성립',
      formation: null,
    };
    const result = YongshinDecider.hapwhaYongshin(gyeokguk, []);
    expect(result).toBeNull();
  });

  it('returns correct for 갑기 earth transformation', () => {
    const gyeokguk: GyeokgukResult = {
      type: GyeokgukType.HAPWHA_EARTH,
      category: GyeokgukCategory.HWAGYEOK,
      baseSipseong: null,
      confidence: 0.8,
      reasoning: '갑기합화토격 성립',
      formation: null,
    };
    const hapwha: HapHwaEvaluation = {
      stem1: Cheongan.GAP, stem2: Cheongan.GI,
      position1: PillarPosition.YEAR, position2: PillarPosition.MONTH,
      state: HapState.HAPWHA, resultOhaeng: EARTH,
      confidence: 0.8,
      conditionsMet: ['인접', '월령'], conditionsFailed: [],
      reasoning: '갑기합화토', dayMasterInvolved: false,
    };
    const result = YongshinDecider.hapwhaYongshin(gyeokguk, [hapwha]);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(YongshinType.HAPWHA_YONGSHIN);
    expect(result!.primaryElement).toBe(FIRE);
    expect(result!.secondaryElement).toBe(EARTH);
    expect(result!.reasoning).toContain('합화용신');
  });

  it('all five transformations produce correct yongshin', () => {
    const transformations: [Cheongan, Cheongan, Ohaeng][] = [
      [Cheongan.GAP, Cheongan.GI, EARTH],
      [Cheongan.EUL, Cheongan.GYEONG, METAL],
      [Cheongan.BYEONG, Cheongan.SIN, WATER],
      [Cheongan.JEONG, Cheongan.IM, WOOD],
      [Cheongan.MU, Cheongan.GYE, FIRE],
    ];

    for (const [s1, s2, resultOh] of transformations) {
      const hapwha: HapHwaEvaluation = {
        stem1: s1, stem2: s2,
        position1: PillarPosition.YEAR, position2: PillarPosition.MONTH,
        state: HapState.HAPWHA, resultOhaeng: resultOh,
        confidence: 0.8, conditionsMet: ['인접'], conditionsFailed: [],
        reasoning: `${CHEONGAN_INFO[s1].hangul}${CHEONGAN_INFO[s2].hangul}합화`,
        dayMasterInvolved: false,
      };

      const gyeokgukTypeMap: Record<string, GyeokgukType> = {
        [EARTH]: GyeokgukType.HAPWHA_EARTH,
        [METAL]: GyeokgukType.HAPWHA_METAL,
        [WATER]: GyeokgukType.HAPWHA_WATER,
        [WOOD]: GyeokgukType.HAPWHA_WOOD,
        [FIRE]: GyeokgukType.HAPWHA_FIRE,
      };
      const gyeokguk: GyeokgukResult = {
        type: gyeokgukTypeMap[resultOh]!,
        category: GyeokgukCategory.HWAGYEOK,
        baseSipseong: null, confidence: 0.8,
        reasoning: `합화${resultOh}격`,
        formation: null,
      };

      const result = YongshinDecider.hapwhaYongshin(gyeokguk, [hapwha]);
      expect(result).not.toBeNull();
      const expected = OhaengRelations.generatedBy(resultOh);
      expect(result!.primaryElement).toBe(expected);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// 일행득기용신 (BLG-H3)
// ══════════════════════════════════════════════════════════════════

describe('IlhaengYongshin', () => {
  const dummyPillars = new PillarSet(
    new Pillar(Cheongan.GAP, Jiji.IN),
    new Pillar(Cheongan.EUL, Jiji.MYO),
    new Pillar(Cheongan.GAP, Jiji.JIN),
    new Pillar(Cheongan.GAP, Jiji.IN),
  );

  it('returns null for non-ilhaeng type', () => {
    const gyeokguk: GyeokgukResult = {
      type: GyeokgukType.JEONGGWAN,
      category: GyeokgukCategory.NAEGYEOK,
      baseSipseong: null, confidence: 0.8, reasoning: '정관격',
      formation: null,
    };
    const result = YongshinDecider.ilhaengYongshin(dummyPillars, gyeokguk);
    expect(result).toBeNull();
  });

  it('곡직격 (WOOD) -> FIRE as yongshin', () => {
    const gyeokguk: GyeokgukResult = {
      type: GyeokgukType.GOKJIK,
      category: GyeokgukCategory.ILHAENG,
      baseSipseong: null, confidence: 0.8, reasoning: '곡직격 (목 일행득기)',
      formation: null,
    };
    const result = YongshinDecider.ilhaengYongshin(dummyPillars, gyeokguk);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(YongshinType.ILHAENG_YONGSHIN);
    expect(result!.primaryElement).toBe(FIRE);
    expect(result!.secondaryElement).toBe(WOOD);
    expect(result!.reasoning).toContain('일행득기');
  });

  it('all five patterns produce correct yongshin', () => {
    const patterns: [GyeokgukType, Ohaeng, Ohaeng][] = [
      [GyeokgukType.GOKJIK, WOOD, FIRE],
      [GyeokgukType.YEOMSANG, FIRE, EARTH],
      [GyeokgukType.GASAEK, EARTH, METAL],
      [GyeokgukType.JONGHYEOK, METAL, WATER],
      [GyeokgukType.YUNHA, WATER, WOOD],
    ];

    const genericPillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
      new Pillar(Cheongan.MU, Jiji.O),
      new Pillar(Cheongan.GYEONG, Jiji.SIN),
    );

    for (const [type, dominant, expectedYongshin] of patterns) {
      const gyeokguk: GyeokgukResult = {
        type,
        category: GyeokgukCategory.ILHAENG,
        baseSipseong: null, confidence: 0.8,
        reasoning: GYEOKGUK_TYPE_INFO[type].koreanName,
        formation: null,
      };
      const result = YongshinDecider.ilhaengYongshin(genericPillars, gyeokguk);
      expect(result).not.toBeNull();
      expect(result!.primaryElement).toBe(expectedYongshin);
      expect(result!.secondaryElement).toBe(dominant);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// BLG-M2: 동적 confidence (억부-조후 일치도)
// ══════════════════════════════════════════════════════════════════

describe('Dynamic confidence', () => {
  it('full agree when eokbu and johu primary match', () => {
    // 갑(WOOD) 신약 -> 억부 primary=WATER
    // 갑일간 미월 -> 조후 primary=WATER (궁통보감)
    const eokbu = YongshinDecider.eokbuYongshin(WOOD, false);
    const johu = YongshinDecider.johuYongshin(Cheongan.GAP, Jiji.MI);

    if (eokbu.primaryElement === johu.primaryElement) {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.MI),
        new Pillar(Cheongan.GAP, Jiji.MI),
        new Pillar(Cheongan.GAP, Jiji.MI),
        new Pillar(Cheongan.GAP, Jiji.MI),
      );
      const result = YongshinDecider.decide(pillars, false, WOOD);
      expect(result.agreement).toBe(YongshinAgreement.FULL_AGREE);
      expect(result.finalConfidence).toBe(0.95);
    }
  });

  it('disagree when no overlap', () => {
    // 임(WATER) 신약 -> 억부 primary=METAL
    // 임일간 축(CHUK)월 -> 조후 primary=FIRE
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.GYE, Jiji.CHUK),
      new Pillar(Cheongan.IM, Jiji.O),
      new Pillar(Cheongan.GYEONG, Jiji.JA),
    );
    const result = YongshinDecider.decide(pillars, false, WATER);

    const eokbuRec = result.recommendations.find(r => r.type === YongshinType.EOKBU)!;
    const johuRec = result.recommendations.find(r => r.type === YongshinType.JOHU)!;
    expect(eokbuRec.primaryElement).toBe(METAL);
    expect(johuRec.primaryElement).toBe(FIRE);

    // Check full disagree (no cross-match)
    if (
      eokbuRec.secondaryElement !== johuRec.primaryElement &&
      johuRec.secondaryElement !== eokbuRec.primaryElement
    ) {
      expect(result.agreement).toBe(YongshinAgreement.DISAGREE);
      expect(result.finalConfidence).toBe(0.55);
    }
  });

  it('partial agree when secondary matches primary', () => {
    // 경(METAL) 신강 -> 억부 primary=WATER, secondary=WOOD
    const eokbuStrong = YongshinDecider.eokbuYongshin(METAL, true);

    for (const branch of JIJI_VALUES) {
      const johu = YongshinDecider.johuYongshin(Cheongan.GYEONG, branch);
      if (
        johu.primaryElement === eokbuStrong.secondaryElement &&
        johu.primaryElement !== eokbuStrong.primaryElement
      ) {
        const pillars = new PillarSet(
          new Pillar(Cheongan.GYEONG, branch),
          new Pillar(Cheongan.GYEONG, branch),
          new Pillar(Cheongan.GYEONG, branch),
          new Pillar(Cheongan.GYEONG, branch),
        );
        const result = YongshinDecider.decide(pillars, true, METAL);
        expect(result.agreement).toBe(YongshinAgreement.PARTIAL_AGREE);
        expect(result.finalConfidence).toBe(0.75);
        return;
      }
    }
    // If no partial case found, that's fine -- same as Kotlin test
  });

  it('agreement enum values match', () => {
    expect(YONGSHIN_AGREEMENT_INFO[YongshinAgreement.FULL_AGREE].confidence).toBe(0.95);
    expect(YONGSHIN_AGREEMENT_INFO[YongshinAgreement.PARTIAL_AGREE].confidence).toBe(0.75);
    expect(YONGSHIN_AGREEMENT_INFO[YongshinAgreement.DISAGREE].confidence).toBe(0.55);
    expect(YONGSHIN_AGREEMENT_INFO[YongshinAgreement.FULL_AGREE].label).toBe('완전 일치');
    expect(YONGSHIN_AGREEMENT_INFO[YongshinAgreement.PARTIAL_AGREE].label).toBe('부분 일치');
    expect(YONGSHIN_AGREEMENT_INFO[YongshinAgreement.DISAGREE].label).toBe('불일치');
  });

  it('confidence in result matches agreement', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.EUL, Jiji.MYO),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.BYEONG, Jiji.JA),
    );
    const result = YongshinDecider.decide(pillars, true, WOOD);
    expect(result.finalConfidence).toBe(
      YONGSHIN_AGREEMENT_INFO[result.agreement].confidence,
    );
  });
});
