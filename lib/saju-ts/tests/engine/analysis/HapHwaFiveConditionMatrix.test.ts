import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { HapState } from '../../../src/domain/Relations.js';
import { HapHwaStrictness } from '../../../src/config/CalculationConfig.js';
import { HapHwaEvaluator } from '../../../src/engine/analysis/HapHwaEvaluator.js';
import type { HapHwaEvaluation } from '../../../src/domain/Relations.js';

/**
 * Ported from HapHwaFiveConditionMatrixTest.kt
 *
 * For each of the 5 cheongan-hap pairs, tests 7 scenarios covering all
 * condition combinations and strictness levels:
 *
 * | # | Scenario                             | Expected State    | Expected Confidence |
 * |---|--------------------------------------|-------------------|---------------------|
 * | 1 | Adjacent + season + no opposition    | HAPWHA            | >= 0.70             |
 * | 2 | Adjacent + season + opposition       | HAPGEO            | 0.60                |
 * | 3 | Adjacent + no season                 | HAPGEO            | 0.50                |
 * | 4 | Not adjacent                         | NOT_ESTABLISHED   | 1.0                 |
 * | 5 | Day master involved                  | NOT_ESTABLISHED   | 1.0                 |
 * | 6 | MODERATE: adjacent+season+opposition | HAPWHA            | <= 0.90             |
 * | 7 | LENIENT: adjacent + no season        | HAPWHA            | in [0.55, 0.85]     |
 *
 * Controlling element mapping (what controls the result):
 * - EARTH controlled by WOOD  (gap-gi)
 * - METAL controlled by FIRE  (eul-gyeong)
 * - WATER controlled by EARTH (byeong-sin)
 * - WOOD  controlled by METAL (jeong-im)
 * - FIRE  controlled by WATER (mu-gye)
 */

// ── Helper ──────────────────────────────────────────────────────────

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

function findPair(
  evals: HapHwaEvaluation[],
  s1: Cheongan,
  s2: Cheongan,
): HapHwaEvaluation | undefined {
  const target = new Set([s1, s2]);
  return evals.find(e => {
    const pair = new Set([e.stem1, e.stem2]);
    return target.size === pair.size && [...target].every(v => pair.has(v));
  });
}

// ── 1. GapGi Matrix (GAP + GI -> EARTH) ────────────────────────────
//    Controller: WOOD (GAP, EUL)
//    Season branches: JIN, SUL, CHUK, MI
//    Neutral fillers: BYEONG, JEONG

describe('HapHwaFiveConditionMatrix - GapGi (EARTH)', () => {
  it('scenario 1: adjacent + season + no opposition -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JIN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.GAP, Cheongan.GI);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.resultOhaeng).toBe(Ohaeng.EARTH);
    expect(ev!.confidence).toBeGreaterThanOrEqual(0.70);
    expect(ev!.conditionsMet).toContain('인접 조건');
    expect(ev!.conditionsMet).toContain('월령 조건');
    expect(ev!.conditionsMet.some(c => c.includes('무극'))).toBe(true);
    expect(ev!.dayMasterInvolved).toBe(false);
  });

  it('scenario 2: adjacent + season + opposition -> HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.EUL,
      monthBranch: Jiji.JIN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.GAP, Cheongan.GI);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.60);
    expect(ev!.conditionsMet).toContain('인접 조건');
    expect(ev!.conditionsMet).toContain('월령 조건');
    expect(ev!.conditionsFailed.some(c => c.includes('무극'))).toBe(true);
  });

  it('scenario 3: adjacent + no season -> HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.IN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.GAP, Cheongan.GI);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.50);
    expect(ev!.conditionsMet).toContain('인접 조건');
    expect(ev!.conditionsFailed).toContain('월령 조건');
  });

  it('scenario 4: not adjacent -> NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.BYEONG,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.GI,
      monthBranch: Jiji.JIN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.GAP, Cheongan.GI);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
    expect(ev!.conditionsFailed).toContain('인접 조건');
  });

  it('scenario 5: day master involved -> NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.JEONG,
      dayStem: Cheongan.GAP, hourStem: Cheongan.GI,
      monthBranch: Jiji.JIN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.GAP, Cheongan.GI);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
    expect(ev!.dayMasterInvolved).toBe(true);
    expect(ev!.conditionsFailed.some(c => c.includes('일간'))).toBe(true);
  });

  it('scenario 6: MODERATE adjacent+season+opposition -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.EUL,
      monthBranch: Jiji.JIN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.MODERATE),
      Cheongan.GAP, Cheongan.GI,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeLessThanOrEqual(0.90);
  });

  it('scenario 7: LENIENT adjacent + no season -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.IN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.LENIENT),
      Cheongan.GAP, Cheongan.GI,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeGreaterThanOrEqual(0.55);
    expect(ev!.confidence).toBeLessThanOrEqual(0.85);
  });
});

// ── 2. EulGyeong Matrix (EUL + GYEONG -> METAL) ────────────────────
//    Controller: FIRE (BYEONG, JEONG)
//    Season branches: SIN, YU
//    Neutral fillers: MU, IM

describe('HapHwaFiveConditionMatrix - EulGyeong (METAL)', () => {
  it('scenario 1: adjacent + season + no opposition -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.IM,
      monthBranch: Jiji.SIN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.EUL, Cheongan.GYEONG);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.resultOhaeng).toBe(Ohaeng.METAL);
    expect(ev!.confidence).toBeGreaterThanOrEqual(0.70);
    expect(ev!.conditionsMet).toContain('인접 조건');
    expect(ev!.conditionsMet).toContain('월령 조건');
    expect(ev!.conditionsMet.some(c => c.includes('무극'))).toBe(true);
    expect(ev!.dayMasterInvolved).toBe(false);
  });

  it('scenario 2: adjacent + season + opposition -> HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.BYEONG,
      monthBranch: Jiji.YU,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.EUL, Cheongan.GYEONG);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.60);
    expect(ev!.conditionsFailed.some(c => c.includes('무극'))).toBe(true);
  });

  it('scenario 3: adjacent + no season -> HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.IM,
      monthBranch: Jiji.IN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.EUL, Cheongan.GYEONG);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.50);
  });

  it('scenario 4: not adjacent -> NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.MU,
      dayStem: Cheongan.IM, hourStem: Cheongan.GYEONG,
      monthBranch: Jiji.SIN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.EUL, Cheongan.GYEONG);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
  });

  it('scenario 5: day master involved -> NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.IM,
      dayStem: Cheongan.EUL, hourStem: Cheongan.GYEONG,
      monthBranch: Jiji.SIN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.EUL, Cheongan.GYEONG);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
    expect(ev!.dayMasterInvolved).toBe(true);
  });

  it('scenario 6: MODERATE adjacent+season+opposition -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.BYEONG,
      monthBranch: Jiji.YU,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.MODERATE),
      Cheongan.EUL, Cheongan.GYEONG,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeLessThanOrEqual(0.90);
  });

  it('scenario 7: LENIENT adjacent + no season -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.IM,
      monthBranch: Jiji.IN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.LENIENT),
      Cheongan.EUL, Cheongan.GYEONG,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeGreaterThanOrEqual(0.55);
    expect(ev!.confidence).toBeLessThanOrEqual(0.85);
  });
});

// ── 3. ByeongSin Matrix (BYEONG + SIN -> WATER) ────────────────────
//    Controller: EARTH (MU, GI)
//    Season branches: HAE, JA
//    Neutral fillers: GAP, EUL

describe('HapHwaFiveConditionMatrix - ByeongSin (WATER)', () => {
  it('scenario 1: adjacent + season + no opposition -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.SIN,
      dayStem: Cheongan.GAP, hourStem: Cheongan.EUL,
      monthBranch: Jiji.HAE,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.BYEONG, Cheongan.SIN);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.resultOhaeng).toBe(Ohaeng.WATER);
    expect(ev!.confidence).toBeGreaterThanOrEqual(0.70);
    expect(ev!.conditionsMet).toContain('인접 조건');
    expect(ev!.conditionsMet).toContain('월령 조건');
    expect(ev!.conditionsMet.some(c => c.includes('무극'))).toBe(true);
    expect(ev!.dayMasterInvolved).toBe(false);
  });

  it('scenario 2: adjacent + season + opposition -> HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.SIN,
      dayStem: Cheongan.GAP, hourStem: Cheongan.MU,
      monthBranch: Jiji.JA,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.BYEONG, Cheongan.SIN);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.60);
    expect(ev!.conditionsFailed.some(c => c.includes('무극'))).toBe(true);
  });

  it('scenario 3: adjacent + no season -> HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.SIN,
      dayStem: Cheongan.GAP, hourStem: Cheongan.EUL,
      monthBranch: Jiji.IN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.BYEONG, Cheongan.SIN);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.50);
  });

  it('scenario 4: not adjacent -> NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.GAP,
      dayStem: Cheongan.EUL, hourStem: Cheongan.SIN,
      monthBranch: Jiji.HAE,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.BYEONG, Cheongan.SIN);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
  });

  it('scenario 5: day master involved -> NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.EUL,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.SIN,
      monthBranch: Jiji.HAE,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.BYEONG, Cheongan.SIN);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
    expect(ev!.dayMasterInvolved).toBe(true);
  });

  it('scenario 6: MODERATE adjacent+season+opposition -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.SIN,
      dayStem: Cheongan.GAP, hourStem: Cheongan.MU,
      monthBranch: Jiji.JA,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.MODERATE),
      Cheongan.BYEONG, Cheongan.SIN,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeLessThanOrEqual(0.90);
  });

  it('scenario 7: LENIENT adjacent + no season -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.SIN,
      dayStem: Cheongan.GAP, hourStem: Cheongan.EUL,
      monthBranch: Jiji.IN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.LENIENT),
      Cheongan.BYEONG, Cheongan.SIN,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeGreaterThanOrEqual(0.55);
    expect(ev!.confidence).toBeLessThanOrEqual(0.85);
  });
});

// ── 4. JeongIm Matrix (JEONG + IM -> WOOD) ─────────────────────────
//    Controller: METAL (GYEONG, SIN)
//    Season branches: IN, MYO
//    Neutral fillers: MU, GI

describe('HapHwaFiveConditionMatrix - JeongIm (WOOD)', () => {
  it('scenario 1: adjacent + season + no opposition -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.JEONG, monthStem: Cheongan.IM,
      dayStem: Cheongan.MU, hourStem: Cheongan.GI,
      monthBranch: Jiji.MYO,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.JEONG, Cheongan.IM);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.resultOhaeng).toBe(Ohaeng.WOOD);
    expect(ev!.confidence).toBeGreaterThanOrEqual(0.70);
    expect(ev!.conditionsMet).toContain('인접 조건');
    expect(ev!.conditionsMet).toContain('월령 조건');
    expect(ev!.conditionsMet.some(c => c.includes('무극'))).toBe(true);
    expect(ev!.dayMasterInvolved).toBe(false);
  });

  it('scenario 2: adjacent + season + opposition -> HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.JEONG, monthStem: Cheongan.IM,
      dayStem: Cheongan.MU, hourStem: Cheongan.GYEONG,
      monthBranch: Jiji.IN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.JEONG, Cheongan.IM);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.60);
    expect(ev!.conditionsFailed.some(c => c.includes('무극'))).toBe(true);
  });

  it('scenario 3: adjacent + no season -> HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.JEONG, monthStem: Cheongan.IM,
      dayStem: Cheongan.MU, hourStem: Cheongan.GI,
      monthBranch: Jiji.JA,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.JEONG, Cheongan.IM);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.50);
  });

  it('scenario 4: not adjacent -> NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.JEONG, monthStem: Cheongan.MU,
      dayStem: Cheongan.GI, hourStem: Cheongan.IM,
      monthBranch: Jiji.MYO,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.JEONG, Cheongan.IM);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
  });

  it('scenario 5: day master involved -> NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.GI,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.IM,
      monthBranch: Jiji.MYO,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.JEONG, Cheongan.IM);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
    expect(ev!.dayMasterInvolved).toBe(true);
  });

  it('scenario 6: MODERATE adjacent+season+opposition -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.JEONG, monthStem: Cheongan.IM,
      dayStem: Cheongan.MU, hourStem: Cheongan.GYEONG,
      monthBranch: Jiji.IN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.MODERATE),
      Cheongan.JEONG, Cheongan.IM,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeLessThanOrEqual(0.90);
  });

  it('scenario 7: LENIENT adjacent + no season -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.JEONG, monthStem: Cheongan.IM,
      dayStem: Cheongan.MU, hourStem: Cheongan.GI,
      monthBranch: Jiji.JA,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.LENIENT),
      Cheongan.JEONG, Cheongan.IM,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeGreaterThanOrEqual(0.55);
    expect(ev!.confidence).toBeLessThanOrEqual(0.85);
  });
});

// ── 5. MuGye Matrix (MU + GYE -> FIRE) ─────────────────────────────
//    Controller: WATER (IM, GYE)
//    Season branches: SA, O
//    Neutral fillers: GAP, EUL

describe('HapHwaFiveConditionMatrix - MuGye (FIRE)', () => {
  it('scenario 1: adjacent + season + no opposition -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.GYE,
      dayStem: Cheongan.GAP, hourStem: Cheongan.EUL,
      monthBranch: Jiji.SA,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.MU, Cheongan.GYE);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.resultOhaeng).toBe(Ohaeng.FIRE);
    expect(ev!.confidence).toBeGreaterThanOrEqual(0.70);
    expect(ev!.conditionsMet).toContain('인접 조건');
    expect(ev!.conditionsMet).toContain('월령 조건');
    expect(ev!.conditionsMet.some(c => c.includes('무극'))).toBe(true);
    expect(ev!.dayMasterInvolved).toBe(false);
  });

  it('scenario 2: adjacent + season + opposition -> HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.GYE,
      dayStem: Cheongan.GAP, hourStem: Cheongan.IM,
      monthBranch: Jiji.O,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.MU, Cheongan.GYE);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.60);
    expect(ev!.conditionsFailed.some(c => c.includes('무극'))).toBe(true);
  });

  it('scenario 3: adjacent + no season -> HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.GYE,
      dayStem: Cheongan.GAP, hourStem: Cheongan.EUL,
      monthBranch: Jiji.JA,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.MU, Cheongan.GYE);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.50);
  });

  it('scenario 4: not adjacent -> NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.GAP,
      dayStem: Cheongan.EUL, hourStem: Cheongan.GYE,
      monthBranch: Jiji.SA,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.MU, Cheongan.GYE);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
  });

  it('scenario 5: day master involved -> NOT_ESTABLISHED', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.EUL,
      dayStem: Cheongan.MU, hourStem: Cheongan.GYE,
      monthBranch: Jiji.O,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.MU, Cheongan.GYE);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
    expect(ev!.dayMasterInvolved).toBe(true);
  });

  it('scenario 6: MODERATE adjacent+season+opposition -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.GYE,
      dayStem: Cheongan.GAP, hourStem: Cheongan.IM,
      monthBranch: Jiji.O,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.MODERATE),
      Cheongan.MU, Cheongan.GYE,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeLessThanOrEqual(0.90);
  });

  it('scenario 7: LENIENT adjacent + no season -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.GYE,
      dayStem: Cheongan.GAP, hourStem: Cheongan.EUL,
      monthBranch: Jiji.JA,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.LENIENT),
      Cheongan.MU, Cheongan.GYE,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeGreaterThanOrEqual(0.55);
    expect(ev!.confidence).toBeLessThanOrEqual(0.85);
  });
});
