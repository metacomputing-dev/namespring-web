import { describe, it, expect } from 'vitest';
import { Cheongan, CHEONGAN_INFO } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng, OhaengRelations, OHAENG_VALUES } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import { YongshinType } from '../../../src/domain/YongshinResult.js';
import {
  GyeokgukType,
  GyeokgukCategory,
} from '../../../src/domain/Gyeokguk.js';
import type { GyeokgukResult } from '../../../src/domain/Gyeokguk.js';
import { HapState } from '../../../src/domain/Relations.js';
import type { HapHwaEvaluation } from '../../../src/domain/Relations.js';
import {
  JonggyeokYongshinMode,
  DEFAULT_CONFIG,
  createConfig,
} from '../../../src/config/CalculationConfig.js';
import { YongshinDecider } from '../../../src/engine/analysis/YongshinDecider.js';

const { WOOD, FIRE, EARTH, METAL, WATER } = Ohaeng;

// ── Helpers ──────────────────────────────────────────────────────

function p(stem: Cheongan, branch: Jiji): Pillar {
  return new Pillar(stem, branch);
}

function pillars(year: Pillar, month: Pillar, day: Pillar, hour: Pillar): PillarSet {
  return new PillarSet(year, month, day, hour);
}

function gyeokgukResult(
  type: GyeokgukType,
  category: GyeokgukCategory,
): GyeokgukResult {
  return {
    type,
    category,
    baseSipseong: null,
    confidence: 0.8,
    reasoning: 'test',
    formation: null,
  };
}

function hapwhaEval(
  stem1: Cheongan,
  stem2: Cheongan,
  pos1: PillarPosition,
  pos2: PillarPosition,
  state: HapState,
  resultOhaeng: Ohaeng,
): HapHwaEvaluation {
  return {
    stem1,
    stem2,
    position1: pos1,
    position2: pos2,
    resultOhaeng,
    state,
    confidence: 0.75,
    conditionsMet: [],
    conditionsFailed: [],
    reasoning: 'test',
    dayMasterInvolved: false,
  };
}

// ================================================================
// 1. Byeongyak threshold tests
// ================================================================

describe('ByeongyakThresholdTests', () => {
  it('count 3 below threshold returns null', () => {
    const ps = pillars(
      p(Cheongan.GAP, Jiji.JA),
      p(Cheongan.EUL, Jiji.CHUK),
      p(Cheongan.BYEONG, Jiji.IN),
      p(Cheongan.JEONG, Jiji.O),
    );
    const result = YongshinDecider.byeongyakYongshin(ps, FIRE, true);
    expect(result).toBeNull();
  });

  it('count 4 at threshold returns recommendation', () => {
    const ps = pillars(
      p(Cheongan.GAP, Jiji.IN),
      p(Cheongan.EUL, Jiji.MYO),
      p(Cheongan.BYEONG, Jiji.JIN),
      p(Cheongan.GYEONG, Jiji.HAE),
    );
    const result = YongshinDecider.byeongyakYongshin(ps, FIRE, true);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(YongshinType.BYEONGYAK);
    expect(result!.primaryElement).toBe(METAL);
  });

  it('medicine equals dayMaster and weak returns null', () => {
    const ps = pillars(
      p(Cheongan.GAP, Jiji.IN),
      p(Cheongan.EUL, Jiji.MYO),
      p(Cheongan.GYEONG, Jiji.JIN),
      p(Cheongan.MU, Jiji.HAE),
    );
    const result = YongshinDecider.byeongyakYongshin(ps, METAL, false);
    expect(result).toBeNull();
  });

  it('medicine equals dayMaster but strong returns recommendation', () => {
    const ps = pillars(
      p(Cheongan.GAP, Jiji.IN),
      p(Cheongan.EUL, Jiji.MYO),
      p(Cheongan.GYEONG, Jiji.JIN),
      p(Cheongan.MU, Jiji.HAE),
    );
    const result = YongshinDecider.byeongyakYongshin(ps, METAL, true);
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(METAL);
  });

  it('controlledBy never equals self -- defensive guard unreachable', () => {
    for (const ohaeng of OHAENG_VALUES) {
      const controller = OhaengRelations.controlledBy(ohaeng);
      expect(controller).not.toBe(ohaeng);
    }
  });
});

// ================================================================
// 2. Jeonwang COUNTER_DOMINANT tests
// ================================================================

describe('JeonwangCounterDominantTests', () => {
  const counterConfig = createConfig({
    jonggyeokYongshinMode: JonggyeokYongshinMode.COUNTER_DOMINANT,
  });
  const naturalConfig = createConfig({
    jonggyeokYongshinMode: JonggyeokYongshinMode.FOLLOW_DOMINANT,
  });

  const dayMasterOhaeng = WOOD;
  const testPillars = pillars(
    p(Cheongan.GAP, Jiji.IN),
    p(Cheongan.EUL, Jiji.MYO),
    p(Cheongan.GAP, Jiji.JIN),
    p(Cheongan.BYEONG, Jiji.SA),
  );

  it('JONGGANG counter dominant produces controller and drainer', () => {
    const result = YongshinDecider.jeonwangYongshin(
      testPillars, dayMasterOhaeng,
      gyeokgukResult(GyeokgukType.JONGGANG, GyeokgukCategory.JONGGYEOK),
      counterConfig,
    );
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(METAL);
    expect(result!.secondaryElement).toBe(FIRE);
    expect(result!.reasoning).toContain('역종');
  });

  it('JONGGANG natural mode differs from counter', () => {
    const natural = YongshinDecider.jeonwangYongshin(
      testPillars, dayMasterOhaeng,
      gyeokgukResult(GyeokgukType.JONGGANG, GyeokgukCategory.JONGGYEOK),
      naturalConfig,
    );
    const counter = YongshinDecider.jeonwangYongshin(
      testPillars, dayMasterOhaeng,
      gyeokgukResult(GyeokgukType.JONGGANG, GyeokgukCategory.JONGGYEOK),
      counterConfig,
    );
    expect(natural).not.toBeNull();
    expect(counter).not.toBeNull();
    expect(natural!.primaryElement).not.toBe(counter!.primaryElement);
  });

  it('JONGA counter dominant produces inseong and bigyeop', () => {
    const result = YongshinDecider.jeonwangYongshin(
      testPillars, dayMasterOhaeng,
      gyeokgukResult(GyeokgukType.JONGA, GyeokgukCategory.JONGGYEOK),
      counterConfig,
    );
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(WATER);
    expect(result!.secondaryElement).toBe(WOOD);
  });

  it('JONGJAE counter dominant produces bigyeop and inseong', () => {
    const result = YongshinDecider.jeonwangYongshin(
      testPillars, dayMasterOhaeng,
      gyeokgukResult(GyeokgukType.JONGJAE, GyeokgukCategory.JONGGYEOK),
      counterConfig,
    );
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(WOOD);
    expect(result!.secondaryElement).toBe(WATER);
  });

  it('JONGSAL counter dominant produces siksang and inseong', () => {
    const result = YongshinDecider.jeonwangYongshin(
      testPillars, dayMasterOhaeng,
      gyeokgukResult(GyeokgukType.JONGSAL, GyeokgukCategory.JONGGYEOK),
      counterConfig,
    );
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(FIRE);
    expect(result!.secondaryElement).toBe(WATER);
  });

  it('JONGSE counter dominant produces inseong and bigyeop', () => {
    const result = YongshinDecider.jeonwangYongshin(
      testPillars, dayMasterOhaeng,
      gyeokgukResult(GyeokgukType.JONGSE, GyeokgukCategory.JONGGYEOK),
      counterConfig,
    );
    expect(result).not.toBeNull();
    expect(result!.primaryElement).toBe(WATER);
    expect(result!.secondaryElement).toBe(WOOD);
  });

  it('all 5 jonggyeok types have different elements between modes', () => {
    const types = [
      GyeokgukType.JONGGANG, GyeokgukType.JONGA,
      GyeokgukType.JONGJAE, GyeokgukType.JONGSAL,
      GyeokgukType.JONGSE,
    ];
    for (const type of types) {
      const gResult = gyeokgukResult(type, GyeokgukCategory.JONGGYEOK);
      const natural = YongshinDecider.jeonwangYongshin(testPillars, dayMasterOhaeng, gResult, naturalConfig);
      const counter = YongshinDecider.jeonwangYongshin(testPillars, dayMasterOhaeng, gResult, counterConfig);
      expect(natural).not.toBeNull();
      expect(counter).not.toBeNull();
      expect(natural!.primaryElement).not.toBe(counter!.primaryElement);
    }
  });

  it('non jonggyeok type returns null', () => {
    const result = YongshinDecider.jeonwangYongshin(
      testPillars, dayMasterOhaeng,
      gyeokgukResult(GyeokgukType.JEONGGWAN, GyeokgukCategory.NAEGYEOK),
      counterConfig,
    );
    expect(result).toBeNull();
  });
});

// ================================================================
// 3. resolveAll Tier tests
// ================================================================

describe('ResolveAllTierTests', () => {
  it('tier 1 hwagyeok overrides eokbu/johu with hapwha yongshin', () => {
    const ps = pillars(
      p(Cheongan.GAP, Jiji.JIN),
      p(Cheongan.GI, Jiji.JIN),
      p(Cheongan.GAP, Jiji.JIN),
      p(Cheongan.GI, Jiji.SA),
    );

    const hapEval = hapwhaEval(
      Cheongan.GAP, Cheongan.GI,
      PillarPosition.YEAR, PillarPosition.MONTH,
      HapState.HAPWHA, EARTH,
    );

    const gResult = gyeokgukResult(GyeokgukType.HAPWHA_EARTH, GyeokgukCategory.HWAGYEOK);

    const result = YongshinDecider.decide(
      ps, true, WOOD, DEFAULT_CONFIG, gResult, [hapEval],
    );

    expect(result.finalYongshin).toBe(FIRE);
    expect(result.recommendations.some(r => r.type === YongshinType.HAPWHA_YONGSHIN)).toBe(true);
  });

  it('tier 2 tonggwan takes priority when eokbu and johu disagree', () => {
    const ps = pillars(
      p(Cheongan.GYEONG, Jiji.YU),
      p(Cheongan.SIN, Jiji.SIN),
      p(Cheongan.GAP, Jiji.IN),
      p(Cheongan.GAP, Jiji.MYO),
    );

    const tonggwan = YongshinDecider.tongwanYongshin(ps, WOOD);
    expect(tonggwan).not.toBeNull();
    expect(tonggwan!.type).toBe(YongshinType.TONGGWAN);
    expect(tonggwan!.primaryElement).toBe(WATER);

    const eokbu = YongshinDecider.eokbuYongshin(WOOD, false);
    const johu = YongshinDecider.johuYongshin(Cheongan.GAP, Jiji.SIN);

    if (eokbu.primaryElement !== johu.primaryElement) {
      const result = YongshinDecider.decide(ps, false, WOOD);
      expect(result.finalYongshin).toBe(WATER);
    }
  });

  it('decide with no gyeokguk and no haphwa produces base result', () => {
    const ps = pillars(
      p(Cheongan.GAP, Jiji.IN),
      p(Cheongan.EUL, Jiji.MYO),
      p(Cheongan.BYEONG, Jiji.O),
      p(Cheongan.JEONG, Jiji.SA),
    );
    const result = YongshinDecider.decide(ps, true, FIRE);
    expect(result.finalYongshin).not.toBeNull();
    expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
    expect(result.recommendations.some(r => r.type === YongshinType.EOKBU)).toBe(true);
    expect(result.recommendations.some(r => r.type === YongshinType.JOHU)).toBe(true);
  });

  it('decide with ILHAENG gyeokguk uses ilhaeng yongshin', () => {
    const ps = pillars(
      p(Cheongan.GAP, Jiji.IN),
      p(Cheongan.EUL, Jiji.MYO),
      p(Cheongan.GAP, Jiji.HAE),
      p(Cheongan.EUL, Jiji.IN),
    );
    const gResult = gyeokgukResult(GyeokgukType.GOKJIK, GyeokgukCategory.ILHAENG);
    const result = YongshinDecider.decide(ps, false, WOOD, DEFAULT_CONFIG, gResult);
    expect(result.finalYongshin).toBe(FIRE);
  });

  it('decide with JONGGYEOK uses jeonwang yongshin', () => {
    const ps = pillars(
      p(Cheongan.GAP, Jiji.IN),
      p(Cheongan.EUL, Jiji.MYO),
      p(Cheongan.GAP, Jiji.HAE),
      p(Cheongan.EUL, Jiji.IN),
    );
    const gResult = gyeokgukResult(GyeokgukType.JONGGANG, GyeokgukCategory.JONGGYEOK);
    const result = YongshinDecider.decide(ps, false, WOOD, DEFAULT_CONFIG, gResult);
    expect(result.finalYongshin).toBe(WOOD);
  });
});

// ================================================================
// 4. Hapwha yongshin null tests
// ================================================================

describe('HapwhaYongshinNullTests', () => {
  it('no HAPWHA evaluation returns null', () => {
    const gResult = gyeokgukResult(GyeokgukType.HAPWHA_EARTH, GyeokgukCategory.HWAGYEOK);
    const evals = [
      hapwhaEval(
        Cheongan.GAP, Cheongan.GI,
        PillarPosition.YEAR, PillarPosition.HOUR,
        HapState.NOT_ESTABLISHED, EARTH,
      ),
    ];
    const result = YongshinDecider.hapwhaYongshin(gResult, evals);
    expect(result).toBeNull();
  });

  it('empty evaluations returns null', () => {
    const gResult = gyeokgukResult(GyeokgukType.HAPWHA_EARTH, GyeokgukCategory.HWAGYEOK);
    const result = YongshinDecider.hapwhaYongshin(gResult, []);
    expect(result).toBeNull();
  });

  it('only HAPGEO evaluation returns null', () => {
    const gResult = gyeokgukResult(GyeokgukType.HAPWHA_METAL, GyeokgukCategory.HWAGYEOK);
    const evals = [
      hapwhaEval(
        Cheongan.EUL, Cheongan.GYEONG,
        PillarPosition.MONTH, PillarPosition.DAY,
        HapState.HAPGEO, METAL,
      ),
    ];
    const result = YongshinDecider.hapwhaYongshin(gResult, evals);
    expect(result).toBeNull();
  });

  it('HAPWHA evaluation returns valid recommendation', () => {
    const gResult = gyeokgukResult(GyeokgukType.HAPWHA_EARTH, GyeokgukCategory.HWAGYEOK);
    const evals = [
      hapwhaEval(
        Cheongan.GAP, Cheongan.GI,
        PillarPosition.YEAR, PillarPosition.MONTH,
        HapState.HAPWHA, EARTH,
      ),
    ];
    const result = YongshinDecider.hapwhaYongshin(gResult, evals);
    expect(result).not.toBeNull();
    expect(result!.type).toBe(YongshinType.HAPWHA_YONGSHIN);
    expect(result!.primaryElement).toBe(FIRE);
    expect(result!.secondaryElement).toBe(EARTH);
  });
});

// ================================================================
// 5. Ilhaeng yongshin null tests
// ================================================================

describe('IlhaengYongshinNullTests', () => {
  const testPillars = pillars(
    p(Cheongan.GAP, Jiji.IN),
    p(Cheongan.EUL, Jiji.MYO),
    p(Cheongan.GAP, Jiji.JIN),
    p(Cheongan.BYEONG, Jiji.SA),
  );

  it('JEONGGWAN type returns null', () => {
    const result = YongshinDecider.ilhaengYongshin(
      testPillars,
      gyeokgukResult(GyeokgukType.JEONGGWAN, GyeokgukCategory.NAEGYEOK),
    );
    expect(result).toBeNull();
  });

  it('JONGGANG type returns null', () => {
    const result = YongshinDecider.ilhaengYongshin(
      testPillars,
      gyeokgukResult(GyeokgukType.JONGGANG, GyeokgukCategory.JONGGYEOK),
    );
    expect(result).toBeNull();
  });

  it('HAPWHA_EARTH type returns null', () => {
    const result = YongshinDecider.ilhaengYongshin(
      testPillars,
      gyeokgukResult(GyeokgukType.HAPWHA_EARTH, GyeokgukCategory.HWAGYEOK),
    );
    expect(result).toBeNull();
  });

  it('GOKJIK type returns valid recommendation', () => {
    const result = YongshinDecider.ilhaengYongshin(
      testPillars,
      gyeokgukResult(GyeokgukType.GOKJIK, GyeokgukCategory.ILHAENG),
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe(YongshinType.ILHAENG_YONGSHIN);
    expect(result!.primaryElement).toBe(FIRE);
    expect(result!.secondaryElement).toBe(WOOD);
  });

  it('all 5 ilhaeng types produce correct elements', () => {
    const cases: [GyeokgukType, Ohaeng, Ohaeng][] = [
      [GyeokgukType.GOKJIK, WOOD, FIRE],
      [GyeokgukType.YEOMSANG, FIRE, EARTH],
      [GyeokgukType.GASAEK, EARTH, METAL],
      [GyeokgukType.JONGHYEOK, METAL, WATER],
      [GyeokgukType.YUNHA, WATER, WOOD],
    ];

    for (const [type, dominant, primary] of cases) {
      const result = YongshinDecider.ilhaengYongshin(
        testPillars,
        gyeokgukResult(type, GyeokgukCategory.ILHAENG),
      );
      expect(result).not.toBeNull();
      expect(result!.primaryElement).toBe(primary);
      expect(result!.secondaryElement).toBe(dominant);
    }
  });
});

// ================================================================
// 6. Gyeokguk yongshin tests
// ================================================================

describe('GyeokgukYongshinTests', () => {
  it('all 10 naegyeok types produce non-null recommendations', () => {
    const naegyeokTypes = [
      GyeokgukType.JEONGGWAN, GyeokgukType.PYEONGWAN,
      GyeokgukType.JEONGJAE, GyeokgukType.PYEONJAE,
      GyeokgukType.JEONGIN, GyeokgukType.PYEONIN,
      GyeokgukType.SIKSIN, GyeokgukType.SANGGWAN,
      GyeokgukType.YANGIN, GyeokgukType.GEONROK,
    ];
    for (const type of naegyeokTypes) {
      const result = YongshinDecider.gyeokgukYongshin(
        WOOD,
        gyeokgukResult(type, GyeokgukCategory.NAEGYEOK),
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe(YongshinType.GYEOKGUK);
      expect(result!.confidence).toBe(0.65);
    }
  });

  it('non naegyeok type returns null', () => {
    const result = YongshinDecider.gyeokgukYongshin(
      WOOD,
      gyeokgukResult(GyeokgukType.JONGGANG, GyeokgukCategory.JONGGYEOK),
    );
    expect(result).toBeNull();
  });
});
