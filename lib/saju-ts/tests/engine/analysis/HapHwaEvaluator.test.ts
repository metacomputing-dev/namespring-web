import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../../../src/domain/PillarPosition.js';
import { HapState } from '../../../src/domain/Relations.js';
import { HapHwaStrictness } from '../../../src/config/CalculationConfig.js';
import { HapHwaEvaluator } from '../../../src/engine/analysis/HapHwaEvaluator.js';

/**
 * Ported from HapHwaEvaluatorTest.kt
 *
 * Tests the HapHwaEvaluator (천간합화 조건 판단기) against reference logic,
 * verifying adjacency, season support, all five 합 pairs, day master protection,
 * opposition checks, strictness modes, and edge cases.
 */

// ── Helper ──────────────────────────────────────────────────────────

/**
 * Creates a PillarSet with specified heavenly stems and a specific
 * month branch. All other branches default to JA since they are
 * not critical for basic condition evaluation (though they may
 * contribute to the presence bonus).
 */
function makePillars(opts: {
  yearStem: Cheongan;
  monthStem: Cheongan;
  dayStem: Cheongan;
  hourStem: Cheongan;
  monthBranch: Jiji;
  yearBranch?: Jiji;
  dayBranch?: Jiji;
  hourBranch?: Jiji;
}): PillarSet {
  return new PillarSet(
    new Pillar(opts.yearStem, opts.yearBranch ?? Jiji.JA),
    new Pillar(opts.monthStem, opts.monthBranch),
    new Pillar(opts.dayStem, opts.dayBranch ?? Jiji.JA),
    new Pillar(opts.hourStem, opts.hourBranch ?? Jiji.JA),
  );
}

// =================================================================
// areAdjacent
// =================================================================

describe('HapHwaEvaluator - areAdjacent', () => {
  it('year-month are adjacent', () => {
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.YEAR, PillarPosition.MONTH)).toBe(true);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.MONTH, PillarPosition.YEAR)).toBe(true);
  });

  it('month-day are adjacent', () => {
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.MONTH, PillarPosition.DAY)).toBe(true);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.DAY, PillarPosition.MONTH)).toBe(true);
  });

  it('day-hour are adjacent', () => {
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.DAY, PillarPosition.HOUR)).toBe(true);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.HOUR, PillarPosition.DAY)).toBe(true);
  });

  it('year-day are not adjacent', () => {
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.YEAR, PillarPosition.DAY)).toBe(false);
  });

  it('year-hour are not adjacent', () => {
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.YEAR, PillarPosition.HOUR)).toBe(false);
  });

  it('month-hour are not adjacent', () => {
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.MONTH, PillarPosition.HOUR)).toBe(false);
  });

  it('same position is not adjacent', () => {
    for (const pos of PILLAR_POSITION_VALUES) {
      expect(HapHwaEvaluator.areAdjacent(pos, pos)).toBe(false);
    }
  });
});

// =================================================================
// isSeasonSupporting
// =================================================================

describe('HapHwaEvaluator - isSeasonSupporting', () => {
  // EARTH: 진/술/축/미
  it('진 supports EARTH', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.JIN, Ohaeng.EARTH)).toBe(true);
  });

  it('술 supports EARTH', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.SUL, Ohaeng.EARTH)).toBe(true);
  });

  it('축 supports EARTH', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.CHUK, Ohaeng.EARTH)).toBe(true);
  });

  it('미 supports EARTH', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.MI, Ohaeng.EARTH)).toBe(true);
  });

  // WOOD: 인/묘
  it('인 supports WOOD', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.IN, Ohaeng.WOOD)).toBe(true);
  });

  it('묘 supports WOOD', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.MYO, Ohaeng.WOOD)).toBe(true);
  });

  // FIRE: 사/오
  it('사 supports FIRE', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.SA, Ohaeng.FIRE)).toBe(true);
  });

  it('오 supports FIRE', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.O, Ohaeng.FIRE)).toBe(true);
  });

  // METAL: 신/유
  it('신 supports METAL', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.SIN, Ohaeng.METAL)).toBe(true);
  });

  it('유 supports METAL', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.YU, Ohaeng.METAL)).toBe(true);
  });

  // WATER: 해/자
  it('해 supports WATER', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.HAE, Ohaeng.WATER)).toBe(true);
  });

  it('자 supports WATER', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.JA, Ohaeng.WATER)).toBe(true);
  });

  // Negative cases
  it('인 does NOT support EARTH', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.IN, Ohaeng.EARTH)).toBe(false);
  });

  it('자 does NOT support FIRE', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.JA, Ohaeng.FIRE)).toBe(false);
  });

  it('진 does NOT support METAL', () => {
    expect(HapHwaEvaluator.isSeasonSupporting(Jiji.JIN, Ohaeng.METAL)).toBe(false);
  });
});

// =================================================================
// 갑기합 (GAP + GI -> EARTH)
// =================================================================

describe('HapHwaEvaluator - 갑기합 (GAP+GI -> EARTH)', () => {
  it('adjacent with earth month produces HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JIN,
    });

    const results = HapHwaEvaluator.evaluate(pillars);

    expect(results).toHaveLength(1);
    const eval_ = results[0]!;
    expect(eval_.stem1).toBe(Cheongan.GAP);
    expect(eval_.stem2).toBe(Cheongan.GI);
    expect(eval_.position1).toBe(PillarPosition.YEAR);
    expect(eval_.position2).toBe(PillarPosition.MONTH);
    expect(eval_.resultOhaeng).toBe(Ohaeng.EARTH);
    expect(eval_.state).toBe(HapState.HAPWHA);
    expect(eval_.confidence).toBeGreaterThanOrEqual(0.70);
    expect(eval_.conditionsMet).toContain('인접 조건');
    expect(eval_.conditionsMet).toContain('월령 조건');
    expect(eval_.dayMasterInvolved).toBe(false);
    expect(eval_.reasoning).toContain('합화');
  });

  it('adjacent with non-earth month produces HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.IN,
    });

    const results = HapHwaEvaluator.evaluate(pillars);

    expect(results).toHaveLength(1);
    const eval_ = results[0]!;
    expect(eval_.state).toBe(HapState.HAPGEO);
    expect(eval_.confidence).toBe(0.50);
    expect(eval_.conditionsMet).toContain('인접 조건');
    expect(eval_.conditionsFailed).toContain('월령 조건');
    expect(eval_.reasoning).toContain('합거');
  });

  it('non-adjacent year-hour produces NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.BYEONG,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.GI,
      monthBranch: Jiji.JIN,
    });

    const results = HapHwaEvaluator.evaluate(pillars);

    expect(results).toHaveLength(1);
    const eval_ = results[0]!;
    expect(eval_.state).toBe(HapState.NOT_ESTABLISHED);
    expect(eval_.confidence).toBe(1.0);
    expect(eval_.conditionsFailed).toContain('인접 조건');
    expect(
      eval_.reasoning.includes('불성립') || eval_.reasoning.includes('인접하지 않'),
    ).toBe(true);
  });
});

// =================================================================
// 을경합 (EUL + GYEONG -> METAL)
// =================================================================

describe('HapHwaEvaluator - 을경합 (EUL+GYEONG -> METAL)', () => {
  it('year-month adjacent with metal month produces HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.GAP,
      monthBranch: Jiji.SIN,
    });

    const results = HapHwaEvaluator.evaluate(pillars);

    const eval_ = results.find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.EUL) && new Set([e.stem1, e.stem2]).has(Cheongan.GYEONG),
    );
    expect(eval_).toBeDefined();
    expect(eval_!.resultOhaeng).toBe(Ohaeng.METAL);
    expect(eval_!.state).toBe(HapState.HAPWHA);
    expect(eval_!.confidence).toBeGreaterThanOrEqual(0.70);
    expect(eval_!.conditionsMet).toContain('인접 조건');
    expect(eval_!.conditionsMet).toContain('월령 조건');
  });
});

// =================================================================
// 병신합 (BYEONG + SIN -> WATER)
// =================================================================

describe('HapHwaEvaluator - 병신합 (BYEONG+SIN -> WATER)', () => {
  it('year-month adjacent with water month produces HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.SIN,
      dayStem: Cheongan.GAP, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.HAE,
    });

    const results = HapHwaEvaluator.evaluate(pillars);

    const eval_ = results.find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.BYEONG) && new Set([e.stem1, e.stem2]).has(Cheongan.SIN),
    );
    expect(eval_).toBeDefined();
    expect(eval_!.resultOhaeng).toBe(Ohaeng.WATER);
    expect(eval_!.state).toBe(HapState.HAPWHA);
    expect(eval_!.confidence).toBeGreaterThanOrEqual(0.70);
  });
});

// =================================================================
// 정임합 (JEONG + IM -> WOOD)
// =================================================================

describe('HapHwaEvaluator - 정임합 (JEONG+IM -> WOOD)', () => {
  it('adjacent with wood month produces HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.JEONG, monthStem: Cheongan.IM,
      dayStem: Cheongan.GI, hourStem: Cheongan.GAP,
      monthBranch: Jiji.MYO,
    });

    const results = HapHwaEvaluator.evaluate(pillars);

    const eval_ = results.find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.JEONG) && new Set([e.stem1, e.stem2]).has(Cheongan.IM),
    );
    expect(eval_).toBeDefined();
    expect(eval_!.resultOhaeng).toBe(Ohaeng.WOOD);
    expect(eval_!.state).toBe(HapState.HAPWHA);
  });
});

// =================================================================
// 무계합 (MU + GYE -> FIRE)
// =================================================================

describe('HapHwaEvaluator - 무계합 (MU+GYE -> FIRE)', () => {
  it('adjacent with fire month produces HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.GYE,
      dayStem: Cheongan.GAP, hourStem: Cheongan.EUL,
      monthBranch: Jiji.O,
    });

    const results = HapHwaEvaluator.evaluate(pillars);

    const eval_ = results.find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.MU) && new Set([e.stem1, e.stem2]).has(Cheongan.GYE),
    );
    expect(eval_).toBeDefined();
    expect(eval_!.resultOhaeng).toBe(Ohaeng.FIRE);
    expect(eval_!.state).toBe(HapState.HAPWHA);
  });
});

// =================================================================
// Day Master involvement (일간 보호 규칙)
// =================================================================

describe('HapHwaEvaluator - Day Master Tests', () => {
  it('day master as first stem produces NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.JEONG,
      dayStem: Cheongan.GAP, hourStem: Cheongan.GI,
      monthBranch: Jiji.JIN,
    });

    const results = HapHwaEvaluator.evaluate(pillars);

    const eval_ = results.find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.GAP) && new Set([e.stem1, e.stem2]).has(Cheongan.GI),
    );
    expect(eval_).toBeDefined();
    expect(eval_!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(eval_!.dayMasterInvolved).toBe(true);
    expect(eval_!.confidence).toBe(1.0);
    expect(eval_!.conditionsFailed.some(c => c.includes('일간'))).toBe(true);
    expect(eval_!.reasoning).toContain('일간');
  });

  it('day master as second stem produces NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.EUL,
      dayStem: Cheongan.GYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.SIN,
    });

    const results = HapHwaEvaluator.evaluate(pillars);

    const eval_ = results.find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.EUL) && new Set([e.stem1, e.stem2]).has(Cheongan.GYEONG),
    );
    expect(eval_).toBeDefined();
    expect(eval_!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(eval_!.dayMasterInvolved).toBe(true);
  });

  it('day master involved even with all conditions met stays NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.GI,
      dayStem: Cheongan.GAP, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JIN,
    });

    const results = HapHwaEvaluator.evaluate(pillars);

    const eval_ = results.find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.GAP) && new Set([e.stem1, e.stem2]).has(Cheongan.GI),
    );
    expect(eval_).toBeDefined();
    expect(eval_!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(eval_!.dayMasterInvolved).toBe(true);
    // Adjacency and season conditions should NOT be evaluated when day master is involved.
    expect(eval_!.conditionsMet).toHaveLength(0);
  });
});

// =================================================================
// Non-합 pair returns null
// =================================================================

describe('HapHwaEvaluator - Non-Hap Pair Tests', () => {
  it('evaluatePair returns null for non-hap pair', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.BYEONG,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.MU,
      monthBranch: Jiji.JA,
    });

    const result = HapHwaEvaluator.evaluatePair(
      Cheongan.GAP, PillarPosition.YEAR,
      Cheongan.BYEONG, PillarPosition.MONTH,
      Jiji.JA,
      pillars,
    );

    expect(result).toBeNull();
  });

  it('evaluate returns empty for chart with no hap', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.BYEONG,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.MU,
      monthBranch: Jiji.JA,
    });

    const results = HapHwaEvaluator.evaluate(pillars);
    expect(results).toHaveLength(0);
  });
});

// =================================================================
// conditionsMet and conditionsFailed lists
// =================================================================

describe('HapHwaEvaluator - Condition List Tests', () => {
  it('all conditions met for HAPWHA', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.CHUK),
      new Pillar(Cheongan.GI, Jiji.CHUK),
      new Pillar(Cheongan.BYEONG, Jiji.MI),
      new Pillar(Cheongan.JEONG, Jiji.SUL),
    );

    const results = HapHwaEvaluator.evaluate(pillars);
    const eval_ = results.find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.GAP) && new Set([e.stem1, e.stem2]).has(Cheongan.GI),
    );
    expect(eval_).toBeDefined();
    expect(eval_!.conditionsMet).toContain('인접 조건');
    expect(eval_!.conditionsMet).toContain('월령 조건');
    // With 3 earth branches (CHUK, MI, SUL), there should be a presence bonus
    expect(eval_!.conditionsMet).toContain('세력/투출 조건 (부분)');
    expect(eval_!.conditionsFailed).toHaveLength(0);
  });

  it('only adjacency met for HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JA, // water season, not earth
    });

    const results = HapHwaEvaluator.evaluate(pillars);
    const eval_ = results[0]!;
    expect(eval_.conditionsMet).toContain('인접 조건');
    expect(eval_.conditionsFailed).toContain('월령 조건');
  });

  it('no conditions met for NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.BYEONG,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.GI,
      monthBranch: Jiji.JA,
    });

    const results = HapHwaEvaluator.evaluate(pillars);
    const eval_ = results[0]!;
    expect(eval_.conditionsFailed).toContain('인접 조건');
  });
});

// =================================================================
// Reasoning contains Korean explanation
// =================================================================

describe('HapHwaEvaluator - Reasoning Tests', () => {
  it('HAPWHA reasoning contains Korean explanation', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JIN,
    });

    const eval_ = HapHwaEvaluator.evaluate(pillars)[0]!;
    expect(eval_.reasoning).toContain('갑기합화토');
    expect(eval_.reasoning).toContain('인접');
    expect(eval_.reasoning).toContain('월령');
    expect(eval_.reasoning).toContain('합화');
  });

  it('HAPGEO reasoning contains Korean explanation', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.IN,
    });

    const eval_ = HapHwaEvaluator.evaluate(pillars)[0]!;
    expect(eval_.reasoning).toContain('합거');
  });

  it('NOT_ESTABLISHED reasoning explains why', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.BYEONG,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.GI,
      monthBranch: Jiji.JIN,
    });

    const eval_ = HapHwaEvaluator.evaluate(pillars)[0]!;
    expect(
      eval_.reasoning.includes('인접하지 않') || eval_.reasoning.includes('불성립'),
    ).toBe(true);
  });
});

// =================================================================
// Confidence score ranges
// =================================================================

describe('HapHwaEvaluator - Confidence Tests', () => {
  it('HAPWHA confidence is at least 0.70', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JIN,
    });

    const eval_ = HapHwaEvaluator.evaluate(pillars)[0]!;
    expect(eval_.confidence).toBeGreaterThanOrEqual(0.70);
    expect(eval_.confidence).toBeLessThanOrEqual(0.95);
  });

  it('HAPGEO confidence is 0.50', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JA,
    });

    const eval_ = HapHwaEvaluator.evaluate(pillars)[0]!;
    expect(eval_.confidence).toBe(0.50);
  });

  it('NOT_ESTABLISHED confidence is 1.0', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.BYEONG,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.GI,
      monthBranch: Jiji.JIN,
    });

    const eval_ = HapHwaEvaluator.evaluate(pillars)[0]!;
    expect(eval_.confidence).toBe(1.0);
  });

  it('HAPWHA with strong presence has higher confidence', () => {
    // Chart loaded with earth elements for GAP-GI hapwha-to
    const pillarsWithPresence = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.CHUK),
      new Pillar(Cheongan.GI, Jiji.JIN),   // earth month (earth season)
      new Pillar(Cheongan.MU, Jiji.MI),     // MU is earth stem, MI is earth branch
      new Pillar(Cheongan.JEONG, Jiji.SUL), // SUL is earth branch
    );
    const evalWithPresence = HapHwaEvaluator.evaluate(pillarsWithPresence).find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.GAP) && new Set([e.stem1, e.stem2]).has(Cheongan.GI),
    );

    // Chart with minimal earth presence
    const pillarsMinimal = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JIN,
    });
    const evalMinimal = HapHwaEvaluator.evaluate(pillarsMinimal)[0]!;

    expect(evalWithPresence).toBeDefined();
    expect(evalWithPresence!.confidence).toBeGreaterThanOrEqual(evalMinimal.confidence);
  });
});

// =================================================================
// Multiple 합 in one chart
// =================================================================

describe('HapHwaEvaluator - Multiple Hap Tests', () => {
  it('detects two hap in same chart', () => {
    // GAP-GI (년-월) and MU-GYE (일-시) -- both adjacent
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.GI, Jiji.JIN),
      new Pillar(Cheongan.MU, Jiji.SA),
      new Pillar(Cheongan.GYE, Jiji.O),
    );

    const results = HapHwaEvaluator.evaluate(pillars);

    expect(results).toHaveLength(2);
    expect(results.some(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.GAP) && new Set([e.stem1, e.stem2]).has(Cheongan.GI),
    )).toBe(true);
    expect(results.some(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.MU) && new Set([e.stem1, e.stem2]).has(Cheongan.GYE),
    )).toBe(true);
  });
});

// =================================================================
// evaluatePair direct invocation
// =================================================================

describe('HapHwaEvaluator - evaluatePair Direct Tests', () => {
  it('direct pair evaluation matches full evaluation', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JIN,
    });

    const fullResult = HapHwaEvaluator.evaluate(pillars)[0]!;
    const directResult = HapHwaEvaluator.evaluatePair(
      Cheongan.GAP, PillarPosition.YEAR,
      Cheongan.GI, PillarPosition.MONTH,
      Jiji.JIN,
      pillars,
    );

    expect(directResult).not.toBeNull();
    expect(directResult!.state).toBe(fullResult.state);
    expect(directResult!.confidence).toBe(fullResult.confidence);
    expect(directResult!.resultOhaeng).toBe(fullResult.resultOhaeng);
  });
});

// =================================================================
// Edge case: same stem appears in multiple positions
// =================================================================

describe('HapHwaEvaluator - Duplicate Stem Tests', () => {
  it('same stem in all positions produces no hap', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GAP,
      dayStem: Cheongan.GAP, hourStem: Cheongan.GAP,
      monthBranch: Jiji.JA,
    });

    const results = HapHwaEvaluator.evaluate(pillars);
    expect(results).toHaveLength(0);
  });

  it('duplicate stem - opposition check uses position not value', () => {
    // 甲年 己月 甲日 戊時, 미월(earth) -- 갑기합화토
    // Year(甲)+Month(己) 합: 남은 Day(甲 WOOD)이 토를 극함 -> 무극조건 미충족 -> HAPGEO
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.GAP, hourStem: Cheongan.MU,
      monthBranch: Jiji.MI,
    });

    const results = HapHwaEvaluator.evaluate(pillars);
    const eval_ = results.find(
      e => e.position1 === PillarPosition.YEAR && e.position2 === PillarPosition.MONTH,
    );
    expect(eval_).toBeDefined();
    // Day.甲(WOOD) controls EARTH -> opposition exists -> HAPGEO
    expect(eval_!.state).toBe(HapState.HAPGEO);
    expect(eval_!.conditionsFailed.some(c => c.includes('무극'))).toBe(true);
  });

  it('duplicate stem - presence bonus uses correct positions', () => {
    // 甲年 己月 甲日 己時, 진월(earth)
    // Year(甲)+Month(己) 합: Day(甲 WOOD) 극토 -> 무극조건 미충족 -> HAPGEO
    // Day(甲)+Hour(己) 합: dayMaster 보호 -> NOT_ESTABLISHED
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.GAP, hourStem: Cheongan.GI,
      monthBranch: Jiji.JIN,
    });

    const results = HapHwaEvaluator.evaluate(pillars);
    expect(results.length).toBeGreaterThan(0);

    // Year-Month pair: Day.甲=WOOD controls EARTH -> opposition -> HAPGEO
    const yearMonthEval = results.find(
      e => e.position1 === PillarPosition.YEAR && e.position2 === PillarPosition.MONTH,
    );
    expect(yearMonthEval).toBeDefined();
    expect(yearMonthEval!.state).toBe(HapState.HAPGEO);

    // Day-Hour pair: day master involved -> NOT_ESTABLISHED
    const dayHourEval = results.find(
      e => e.position1 === PillarPosition.DAY && e.position2 === PillarPosition.HOUR,
    );
    expect(dayHourEval).toBeDefined();
    expect(dayHourEval!.state).toBe(HapState.NOT_ESTABLISHED);
  });

  it('duplicate stem - no false opposition from combining stem', () => {
    // 乙年 庚月 丙日 丁時, 유월(metal) -- 을경합화금
    // 합 당사자: Year(乙)+Month(庚), 남은: Day(丙 FIRE), Hour(丁 FIRE)
    // FIRE controls METAL -> opposition exists -> HAPGEO
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.YU,
    });

    const eval_ = HapHwaEvaluator.evaluate(pillars).find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.EUL) && new Set([e.stem1, e.stem2]).has(Cheongan.GYEONG),
    );
    expect(eval_).toBeDefined();
    expect(eval_!.state).toBe(HapState.HAPGEO);
  });
});

// =================================================================
// 술월 (SUL) also supports EARTH
// =================================================================

describe('HapHwaEvaluator - Additional Season Tests', () => {
  it('술 month supports EARTH for 갑기합', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.SUL,
    });

    const eval_ = HapHwaEvaluator.evaluate(pillars)[0]!;
    expect(eval_.state).toBe(HapState.HAPWHA);
  });

  it('축 month supports EARTH for 갑기합', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.CHUK,
    });

    const eval_ = HapHwaEvaluator.evaluate(pillars)[0]!;
    expect(eval_.state).toBe(HapState.HAPWHA);
  });

  it('미 month supports EARTH for 갑기합', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.MI,
    });

    const eval_ = HapHwaEvaluator.evaluate(pillars)[0]!;
    expect(eval_.state).toBe(HapState.HAPWHA);
  });

  it('유 month supports METAL for 을경합', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.GAP,
      monthBranch: Jiji.YU,
    });

    const eval_ = HapHwaEvaluator.evaluate(pillars)[0]!;
    expect(eval_.state).toBe(HapState.HAPWHA);
    expect(eval_.resultOhaeng).toBe(Ohaeng.METAL);
  });

  it('사 month supports FIRE for 무계합', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.GYE,
      dayStem: Cheongan.GAP, hourStem: Cheongan.EUL,
      monthBranch: Jiji.SA,
    });

    const eval_ = HapHwaEvaluator.evaluate(pillars)[0]!;
    expect(eval_.state).toBe(HapState.HAPWHA);
    expect(eval_.resultOhaeng).toBe(Ohaeng.FIRE);
  });
});

// =================================================================
// 무극 조건 (Opposition) Tests
// =================================================================

describe('HapHwaEvaluator - Opposition Tests', () => {
  it('HAPWHA demoted to HAPGEO when opposing element present', () => {
    // 을경합화금 + 신월 + adjacent, BUT hourStem=JEONG(FIRE) controls METAL
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.SIN,
    });

    const results = HapHwaEvaluator.evaluate(pillars);
    const eval_ = results.find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.EUL) && new Set([e.stem1, e.stem2]).has(Cheongan.GYEONG),
    );
    expect(eval_).toBeDefined();
    expect(eval_!.state).toBe(HapState.HAPGEO);
    expect(eval_!.confidence).toBe(0.60);
    expect(eval_!.conditionsFailed.some(c => c.includes('무극'))).toBe(true);
  });

  it('HAPWHA not demoted when no opposing element', () => {
    // 을경합화금 + 신월, hourStem=GAP(WOOD) does NOT control METAL
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.GAP,
      monthBranch: Jiji.SIN,
    });

    const results = HapHwaEvaluator.evaluate(pillars);
    const eval_ = results.find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.EUL) && new Set([e.stem1, e.stem2]).has(Cheongan.GYEONG),
    );
    expect(eval_).toBeDefined();
    expect(eval_!.state).toBe(HapState.HAPWHA);
    expect(eval_!.conditionsMet.some(c => c.includes('무극'))).toBe(true);
  });

  it('갑기합 demoted when wood stem present', () => {
    // 갑기합화토 + 미월, hourStem=EUL(WOOD) controls EARTH
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.EUL,
      monthBranch: Jiji.MI,
    });

    const results = HapHwaEvaluator.evaluate(pillars);
    const eval_ = results.find(
      e => new Set([e.stem1, e.stem2]).has(Cheongan.GAP) && new Set([e.stem1, e.stem2]).has(Cheongan.GI),
    );
    expect(eval_).toBeDefined();
    expect(eval_!.state).toBe(HapState.HAPGEO);
    expect(eval_!.conditionsFailed.some(c => c.includes('무극'))).toBe(true);
  });
});

// =================================================================
// BLG-B1: hapHwaStrictness config 연결 테스트
// =================================================================

describe('HapHwaEvaluator - Strictness Config Tests', () => {
  it('STRICT: adjacent with season but opposition produces HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.SIN,
    });
    const eval_ = HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS)
      .find(e => new Set([e.stem1, e.stem2]).has(Cheongan.EUL) && new Set([e.stem1, e.stem2]).has(Cheongan.GYEONG));
    expect(eval_).toBeDefined();
    expect(eval_!.state).toBe(HapState.HAPGEO);
  });

  it('MODERATE: adjacent with season but opposition produces HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.SIN,
    });
    const eval_ = HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.MODERATE)
      .find(e => new Set([e.stem1, e.stem2]).has(Cheongan.EUL) && new Set([e.stem1, e.stem2]).has(Cheongan.GYEONG));
    expect(eval_).toBeDefined();
    expect(eval_!.state).toBe(HapState.HAPWHA);
    expect(eval_!.confidence).toBeLessThanOrEqual(0.90);
  });

  it('MODERATE: adjacent without season produces HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.IN, // wood month, not earth
    });
    const eval_ = HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.MODERATE)[0]!;
    expect(eval_.state).toBe(HapState.HAPGEO);
  });

  it('LENIENT: adjacent without season produces HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.IN, // wood month, not earth
    });
    const eval_ = HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.LENIENT)[0]!;
    expect(eval_.state).toBe(HapState.HAPWHA);
    expect(eval_.confidence).toBeGreaterThanOrEqual(0.55);
    expect(eval_.confidence).toBeLessThanOrEqual(0.85);
  });

  it('LENIENT: not adjacent still NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.BYEONG,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.GI,
      monthBranch: Jiji.JIN,
    });
    const eval_ = HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.LENIENT)[0]!;
    expect(eval_.state).toBe(HapState.NOT_ESTABLISHED);
  });
});

// =================================================================
// BLG-B3: dayMasterNeverHapGeo config 연결 테스트
// =================================================================

describe('HapHwaEvaluator - Day Master Config Tests', () => {
  it('dayMasterNeverHapGeo=true produces NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.GI,
      dayStem: Cheongan.GAP, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JIN,
    });
    const eval_ = HapHwaEvaluator.evaluate(
      pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, true,
    ).find(e => new Set([e.stem1, e.stem2]).has(Cheongan.GAP) && new Set([e.stem1, e.stem2]).has(Cheongan.GI));
    expect(eval_).toBeDefined();
    expect(eval_!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(eval_!.dayMasterInvolved).toBe(true);
  });

  it('dayMasterNeverHapGeo=false allows evaluation', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.GI,
      dayStem: Cheongan.GAP, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JIN,
    });
    const eval_ = HapHwaEvaluator.evaluate(
      pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, false,
    ).find(e => new Set([e.stem1, e.stem2]).has(Cheongan.GAP) && new Set([e.stem1, e.stem2]).has(Cheongan.GI));
    expect(eval_).toBeDefined();
    // Adjacent + earth month -> should produce HAPWHA or HAPGEO, NOT NOT_ESTABLISHED
    expect(eval_!.state).not.toBe(HapState.NOT_ESTABLISHED);
  });

  it('dayMasterNeverHapGeo=false with opposition produces HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.GI,
      dayStem: Cheongan.GAP, hourStem: Cheongan.EUL,
      monthBranch: Jiji.JIN,
    });
    const eval_ = HapHwaEvaluator.evaluate(
      pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, false,
    ).find(e => new Set([e.stem1, e.stem2]).has(Cheongan.GAP) && new Set([e.stem1, e.stem2]).has(Cheongan.GI));
    expect(eval_).toBeDefined();
    expect(eval_!.state).toBe(HapState.HAPGEO);
  });
});
