import { describe, it, expect } from 'vitest';
import { Cheongan, CHEONGAN_INFO } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, JIJI_INFO } from '../../../src/domain/Jiji.js';
import { Ohaeng, OHAENG_VALUES } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../../../src/domain/PillarPosition.js';
import { HapState } from '../../../src/domain/Relations.js';
import { HapHwaStrictness } from '../../../src/config/CalculationConfig.js';
import { HapHwaEvaluator } from '../../../src/engine/analysis/HapHwaEvaluator.js';
import type { HapHwaEvaluation } from '../../../src/domain/Relations.js';

/**
 * Ported from HapHwaFailureCaseTest.kt
 *
 * Systematically covers paths that lead to NOT_ESTABLISHED or HAPGEO outcomes.
 *
 * Controlling element mapping (what controls the result):
 * - EARTH controlled by WOOD  (gap-gi hap)
 * - METAL controlled by FIRE  (eul-gyeong hap)
 * - WATER controlled by EARTH (byeong-sin hap)
 * - WOOD  controlled by METAL (jeong-im hap)
 * - FIRE  controlled by WATER (mu-gye hap)
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

// ── Data ────────────────────────────────────────────────────────────

interface HapPairSpec {
  stemA: Cheongan;
  stemB: Cheongan;
  resultOhaeng: Ohaeng;
  filler1: Cheongan;
  filler2: Cheongan;
  seasonBranch: Jiji;
}

const HAP_PAIRS: HapPairSpec[] = [
  { stemA: Cheongan.GAP, stemB: Cheongan.GI, resultOhaeng: Ohaeng.EARTH, filler1: Cheongan.BYEONG, filler2: Cheongan.JEONG, seasonBranch: Jiji.JIN },
  { stemA: Cheongan.EUL, stemB: Cheongan.GYEONG, resultOhaeng: Ohaeng.METAL, filler1: Cheongan.MU, filler2: Cheongan.IM, seasonBranch: Jiji.SIN },
  { stemA: Cheongan.BYEONG, stemB: Cheongan.SIN, resultOhaeng: Ohaeng.WATER, filler1: Cheongan.GAP, filler2: Cheongan.EUL, seasonBranch: Jiji.HAE },
  { stemA: Cheongan.JEONG, stemB: Cheongan.IM, resultOhaeng: Ohaeng.WOOD, filler1: Cheongan.MU, filler2: Cheongan.GI, seasonBranch: Jiji.MYO },
  { stemA: Cheongan.MU, stemB: Cheongan.GYE, resultOhaeng: Ohaeng.FIRE, filler1: Cheongan.GAP, filler2: Cheongan.EUL, seasonBranch: Jiji.SA },
];

const NON_ADJACENT_COMBOS: [number, number][] = [
  [0, 2], // YEAR-DAY
  [0, 3], // YEAR-HOUR
  [1, 3], // MONTH-HOUR
];

// ── 1. Non-adjacent pairs: ALL 3 non-adjacent combos x 5 hap pairs ──

describe('HapHwaFailureCase - NonAdjacentExhaustive', () => {
  const cases: Array<{
    label: string;
    stemA: Cheongan;
    stemB: Cheongan;
    pos1: PillarPosition;
    pos2: PillarPosition;
    filler1: Cheongan;
    filler2: Cheongan;
    seasonBranch: Jiji;
  }> = [];

  for (const spec of HAP_PAIRS) {
    for (const [idx1, idx2] of NON_ADJACENT_COMBOS) {
      const pos1 = PILLAR_POSITION_VALUES[idx1]!;
      const pos2 = PILLAR_POSITION_VALUES[idx2]!;
      cases.push({
        label: `${CHEONGAN_INFO[spec.stemA].hangul}${CHEONGAN_INFO[spec.stemB].hangul}합 at ${pos1}-${pos2}`,
        stemA: spec.stemA,
        stemB: spec.stemB,
        pos1,
        pos2,
        filler1: spec.filler1,
        filler2: spec.filler2,
        seasonBranch: spec.seasonBranch,
      });
    }
  }

  it.each(cases)(
    'non-adjacent pair always NOT_ESTABLISHED: $label',
    ({ stemA, stemB, pos1, pos2, filler1, filler2, seasonBranch }) => {
      const stems: (Cheongan | null)[] = [null, null, null, null];
      stems[PILLAR_POSITION_VALUES.indexOf(pos1)] = stemA;
      stems[PILLAR_POSITION_VALUES.indexOf(pos2)] = stemB;
      const fillers = [filler1, filler2];
      let fillerIdx = 0;
      for (let i = 0; i < 4; i++) {
        if (stems[i] == null) {
          stems[i] = fillers[fillerIdx++]!;
        }
      }

      const pillars = makePillars({
        yearStem: stems[0]!,
        monthStem: stems[1]!,
        dayStem: stems[2]!,
        hourStem: stems[3]!,
        monthBranch: seasonBranch,
      });

      const ev = findPair(
        HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, false),
        stemA, stemB,
      );
      expect(ev).toBeDefined();
      expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
      expect(ev!.confidence).toBe(1.0);
      expect(ev!.conditionsFailed.some(c => c.includes('인접'))).toBe(true);
    },
  );
});

// ── 2. Multiple condition failures ──────────────────────────────────

describe('HapHwaFailureCase - MultipleConditionFailures', () => {
  it('gap-gi non-adjacent and wrong season', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.BYEONG,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.GI,
      monthBranch: Jiji.IN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, false),
      Cheongan.GAP, Cheongan.GI,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
    expect(ev!.conditionsFailed.some(c => c.includes('인접'))).toBe(true);
  });

  it('eul-gyeong non-adjacent and wrong season', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.EUL,
      dayStem: Cheongan.IM, hourStem: Cheongan.GYEONG,
      monthBranch: Jiji.JA,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, false),
      Cheongan.EUL, Cheongan.GYEONG,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
  });

  it('byeong-sin triple failure: non-adjacent, wrong season, opposition', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.MU,
      dayStem: Cheongan.SIN, hourStem: Cheongan.GI,
      monthBranch: Jiji.SA,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, false),
      Cheongan.BYEONG, Cheongan.SIN,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
  });

  it('jeong-im all failures', () => {
    const pillars = makePillars({
      yearStem: Cheongan.JEONG, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.IM, hourStem: Cheongan.SIN,
      monthBranch: Jiji.O,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, false),
      Cheongan.JEONG, Cheongan.IM,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
  });
});

// ── 3. Opposition edge cases ────────────────────────────────────────

describe('HapHwaFailureCase - OppositionEdgeCases', () => {
  it('gap-gi double opposition still HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.GAP, hourStem: Cheongan.EUL,
      monthBranch: Jiji.SUL,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.GAP, Cheongan.GI);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.60);
    expect(ev!.conditionsFailed.some(c => c.includes('무극'))).toBe(true);
  });

  it('gap-gi same value different position is opposition', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.GAP, hourStem: Cheongan.BYEONG,
      monthBranch: Jiji.JIN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.GAP, Cheongan.GI);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.conditionsFailed.some(c => c.includes('무극'))).toBe(true);
  });

  it('eul-gyeong combining stems not counted as opposition', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.IM,
      monthBranch: Jiji.SIN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.EUL, Cheongan.GYEONG);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.conditionsMet.some(c => c.includes('무극'))).toBe(true);
  });

  it('mu-gye partner water not opposition, external water IS opposition', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.GYE,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.IM,
      monthBranch: Jiji.SA,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.MU, Cheongan.GYE);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.conditionsFailed.some(c => c.includes('무극'))).toBe(true);
  });
});

// ── 4. Zero presence bonus ──────────────────────────────────────────

describe('HapHwaFailureCase - ZeroPresenceBonus', () => {
  it('gap-gi no earth presence HAPGEO confidence 0.50', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.IN,
      yearBranch: Jiji.JA, dayBranch: Jiji.JA, hourBranch: Jiji.JA,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.GAP, Cheongan.GI);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.50);
    expect(ev!.conditionsFailed.some(c => c.includes('세력') || c.includes('투출'))).toBe(true);
  });

  it('jeong-im minimal presence only month branch', () => {
    const pillars = makePillars({
      yearStem: Cheongan.JEONG, monthStem: Cheongan.IM,
      dayStem: Cheongan.MU, hourStem: Cheongan.GI,
      monthBranch: Jiji.MYO,
      yearBranch: Jiji.JA, dayBranch: Jiji.JA, hourBranch: Jiji.JA,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.JEONG, Cheongan.IM);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeCloseTo(0.725, 2);
    expect(ev!.conditionsMet.some(c => c.includes('세력') || c.includes('투출'))).toBe(true);
  });

  it('byeong-sin high branch presence boosted confidence', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.SIN,
      dayStem: Cheongan.GAP, hourStem: Cheongan.EUL,
      monthBranch: Jiji.HAE,
      yearBranch: Jiji.JA, dayBranch: Jiji.JA, hourBranch: Jiji.JA,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.BYEONG, Cheongan.SIN);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeCloseTo(0.80, 2);
  });

  it('byeong-sin presence bonus capped at 0.15', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.SIN,
      dayStem: Cheongan.IM, hourStem: Cheongan.GYE,
      monthBranch: Jiji.HAE,
      yearBranch: Jiji.JA, dayBranch: Jiji.HAE, hourBranch: Jiji.JA,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.BYEONG, Cheongan.SIN);
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeCloseTo(0.85, 2);
  });
});

// ── 5. Day master involvement toggle ────────────────────────────────

describe('HapHwaFailureCase - DayMasterInvolvement', () => {
  it('dayMaster=true blocks evaluation', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.JEONG,
      dayStem: Cheongan.GAP, hourStem: Cheongan.GI,
      monthBranch: Jiji.JIN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, true),
      Cheongan.GAP, Cheongan.GI,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.confidence).toBe(1.0);
    expect(ev!.dayMasterInvolved).toBe(true);
    expect(ev!.conditionsFailed.some(c => c.includes('일간'))).toBe(true);
    expect(ev!.reasoning).toContain('일간');
    expect(ev!.reasoning).toContain('삼명통회');
  });

  it('dayMaster=false allows evaluation', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.JEONG,
      dayStem: Cheongan.GAP, hourStem: Cheongan.GI,
      monthBranch: Jiji.JIN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, false),
      Cheongan.GAP, Cheongan.GI,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).not.toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.dayMasterInvolved).toBe(false);
  });

  it('dayMaster month-day adjacent still blocked', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU, monthStem: Cheongan.IM,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.GI,
      monthBranch: Jiji.IN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, true),
      Cheongan.JEONG, Cheongan.IM,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.dayMasterInvolved).toBe(true);
  });

  it('dayMaster=false with opposition produces HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GYEONG, monthStem: Cheongan.IM,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.GI,
      monthBranch: Jiji.MYO,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, false),
      Cheongan.JEONG, Cheongan.IM,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.60);
  });

  it('stem at non-day position no protection', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JIN,
    });
    const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.GAP, Cheongan.GI);
    expect(ev).toBeDefined();
    expect(ev!.dayMasterInvolved).toBe(false);
    expect(ev!.state).not.toBe(HapState.NOT_ESTABLISHED);
  });
});

// ── 6. Strictness confidence boundaries ─────────────────────────────

describe('HapHwaFailureCase - StrictnessBoundaries', () => {
  const maxPresencePillars = makePillars({
    yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
    dayStem: Cheongan.GYEONG, hourStem: Cheongan.SIN,
    monthBranch: Jiji.SIN,
    yearBranch: Jiji.SIN, dayBranch: Jiji.YU, hourBranch: Jiji.SIN,
  });

  it('STRICT confidence never exceeds 0.95', () => {
    const ev = findPair(
      HapHwaEvaluator.evaluate(maxPresencePillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS),
      Cheongan.EUL, Cheongan.GYEONG,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeLessThanOrEqual(0.95);
    expect(ev!.confidence).toBeCloseTo(0.85, 2);
  });

  it('MODERATE confidence never exceeds 0.90', () => {
    const ev = findPair(
      HapHwaEvaluator.evaluate(maxPresencePillars, HapHwaStrictness.MODERATE),
      Cheongan.EUL, Cheongan.GYEONG,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeLessThanOrEqual(0.90);
    expect(ev!.confidence).toBeCloseTo(0.80, 2);
  });

  it('LENIENT confidence never exceeds 0.85', () => {
    const ev = findPair(
      HapHwaEvaluator.evaluate(maxPresencePillars, HapHwaStrictness.LENIENT),
      Cheongan.EUL, Cheongan.GYEONG,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeLessThanOrEqual(0.85);
    expect(ev!.confidence).toBeCloseTo(0.70, 2);
  });

  it('STRICT HAPGEO no season fixed confidence 0.50', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.IN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS),
      Cheongan.GAP, Cheongan.GI,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.50);
  });

  it('STRICT HAPGEO season with opposition fixed confidence 0.60', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.GAP, hourStem: Cheongan.EUL,
      monthBranch: Jiji.JIN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS),
      Cheongan.GAP, Cheongan.GI,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.60);
  });

  it('MODERATE HAPGEO no season fixed confidence 0.50', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.IN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.MODERATE),
      Cheongan.GAP, Cheongan.GI,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.50);
  });
});

// ── 7. Tied conditions ──────────────────────────────────────────────

describe('HapHwaFailureCase - TiedConditions', () => {
  it('gap-gi season+opposition STRICT -> HAPGEO', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.EUL,
      monthBranch: Jiji.MI,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS),
      Cheongan.GAP, Cheongan.GI,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.confidence).toBe(0.60);
    expect(ev!.conditionsMet).toContain('인접 조건');
    expect(ev!.conditionsMet).toContain('월령 조건');
    expect(ev!.conditionsFailed.some(c => c.includes('무극'))).toBe(true);
  });

  it('gap-gi season+opposition MODERATE -> HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.EUL,
      monthBranch: Jiji.MI,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.MODERATE),
      Cheongan.GAP, Cheongan.GI,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPWHA);
    expect(ev!.confidence).toBeLessThanOrEqual(0.90);
  });

  it('eul-gyeong season+opposition STRICT->HAPGEO, LENIENT->HAPWHA', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL, monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.MU, hourStem: Cheongan.BYEONG,
      monthBranch: Jiji.YU,
    });
    const evStrict = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS),
      Cheongan.EUL, Cheongan.GYEONG,
    );
    expect(evStrict).toBeDefined();
    expect(evStrict!.state).toBe(HapState.HAPGEO);

    const evLenient = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.LENIENT),
      Cheongan.EUL, Cheongan.GYEONG,
    );
    expect(evLenient).toBeDefined();
    expect(evLenient!.state).toBe(HapState.HAPWHA);
  });

  it('byeong-sin HAPGEO reasoning mentions opposition', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG, monthStem: Cheongan.SIN,
      dayStem: Cheongan.GAP, hourStem: Cheongan.GI,
      monthBranch: Jiji.HAE,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS),
      Cheongan.BYEONG, Cheongan.SIN,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.HAPGEO);
    expect(ev!.reasoning.includes('극') || ev!.reasoning.includes('무극')).toBe(true);
    expect(ev!.reasoning).toContain('합거');
  });
});

// ── 8. Season support table completeness ────────────────────────────

describe('HapHwaFailureCase - SeasonSupportTableCompleteness', () => {
  const EXPECTED_EARTH_SEASON: Record<string, boolean> = {
    [Jiji.JA]: false,
    [Jiji.CHUK]: true,
    [Jiji.IN]: false,
    [Jiji.MYO]: false,
    [Jiji.JIN]: true,
    [Jiji.SA]: false,
    [Jiji.O]: false,
    [Jiji.MI]: true,
    [Jiji.SIN]: false,
    [Jiji.YU]: false,
    [Jiji.SUL]: true,
    [Jiji.HAE]: false,
  };

  const monthBranchCases = JIJI_VALUES.map(branch => ({
    branch,
    hangul: JIJI_INFO[branch].hangul,
    expectedSupport: EXPECTED_EARTH_SEASON[branch]!,
  }));

  it.each(monthBranchCases)(
    'gap-gi season support for $hangul = $expectedSupport',
    ({ branch, expectedSupport }) => {
      expect(HapHwaEvaluator.isSeasonSupporting(branch, Ohaeng.EARTH)).toBe(expectedSupport);

      const pillars = makePillars({
        yearStem: Cheongan.GAP, monthStem: Cheongan.GI,
        dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
        monthBranch: branch,
      });
      const ev = findPair(HapHwaEvaluator.evaluate(pillars), Cheongan.GAP, Cheongan.GI);
      expect(ev).toBeDefined();

      if (expectedSupport) {
        expect(ev!.conditionsMet).toContain('월령 조건');
        expect(ev!.state).toBe(HapState.HAPWHA);
      } else {
        expect(ev!.conditionsFailed).toContain('월령 조건');
        expect(ev!.state).toBe(HapState.HAPGEO);
        expect(ev!.confidence).toBe(0.50);
      }
    },
  );

  it.each(OHAENG_VALUES.map(o => ({ element: o })))(
    'all 5 elements season support defined for all 12 branches ($element)',
    ({ element }) => {
      for (const branch of JIJI_VALUES) {
        const result = HapHwaEvaluator.isSeasonSupporting(branch, element);
        expect(typeof result).toBe('boolean');
      }
    },
  );
});

// ── 9. Reasoning and direct API ─────────────────────────────────────

describe('HapHwaFailureCase - ReasoningAndDirectApi', () => {
  it('NOT_ESTABLISHED reasoning content', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.BYEONG,
      dayStem: Cheongan.JEONG, hourStem: Cheongan.GI,
      monthBranch: Jiji.JIN,
    });
    const ev = findPair(
      HapHwaEvaluator.evaluate(pillars, HapHwaStrictness.STRICT_FIVE_CONDITIONS, false),
      Cheongan.GAP, Cheongan.GI,
    );
    expect(ev).toBeDefined();
    expect(ev!.state).toBe(HapState.NOT_ESTABLISHED);
    expect(ev!.reasoning).toContain('인접하지 않아');
    expect(ev!.reasoning).toContain('불성립');
  });

  it('evaluatePair non-hap pair returns null', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.EUL,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JIN,
    });
    const ev = HapHwaEvaluator.evaluatePair(
      Cheongan.GAP, PillarPosition.YEAR,
      Cheongan.EUL, PillarPosition.MONTH,
      Jiji.JIN,
      pillars,
    );
    expect(ev).toBeNull();
  });

  it('evaluatePair reversed order still finds hap', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GI, monthStem: Cheongan.GAP,
      dayStem: Cheongan.BYEONG, hourStem: Cheongan.JEONG,
      monthBranch: Jiji.JIN,
    });
    const ev = HapHwaEvaluator.evaluatePair(
      Cheongan.GI, PillarPosition.YEAR,
      Cheongan.GAP, PillarPosition.MONTH,
      Jiji.JIN,
      pillars,
    );
    expect(ev).not.toBeNull();
    expect(ev!.resultOhaeng).toBe(Ohaeng.EARTH);
  });

  it('no pairs in chart returns empty', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.GAP,
      dayStem: Cheongan.GAP, hourStem: Cheongan.GAP,
      monthBranch: Jiji.JIN,
    });
    const results = HapHwaEvaluator.evaluate(pillars);
    expect(results).toHaveLength(0);
  });

  it('no hap relationships returns empty', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP, monthStem: Cheongan.BYEONG,
      dayStem: Cheongan.GYEONG, hourStem: Cheongan.IM,
      monthBranch: Jiji.JIN,
    });
    const results = HapHwaEvaluator.evaluate(pillars);
    expect(results).toHaveLength(0);
  });
});

// ── 10. areAdjacent exhaustive ──────────────────────────────────────

describe('HapHwaFailureCase - AreAdjacentExhaustive', () => {
  it('all six pairs adjacency correctness', () => {
    // Adjacent pairs
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.YEAR, PillarPosition.MONTH)).toBe(true);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.MONTH, PillarPosition.YEAR)).toBe(true);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.MONTH, PillarPosition.DAY)).toBe(true);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.DAY, PillarPosition.MONTH)).toBe(true);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.DAY, PillarPosition.HOUR)).toBe(true);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.HOUR, PillarPosition.DAY)).toBe(true);

    // Non-adjacent pairs
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.YEAR, PillarPosition.DAY)).toBe(false);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.DAY, PillarPosition.YEAR)).toBe(false);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.YEAR, PillarPosition.HOUR)).toBe(false);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.HOUR, PillarPosition.YEAR)).toBe(false);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.MONTH, PillarPosition.HOUR)).toBe(false);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.HOUR, PillarPosition.MONTH)).toBe(false);

    // Same position
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.YEAR, PillarPosition.YEAR)).toBe(false);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.MONTH, PillarPosition.MONTH)).toBe(false);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.DAY, PillarPosition.DAY)).toBe(false);
    expect(HapHwaEvaluator.areAdjacent(PillarPosition.HOUR, PillarPosition.HOUR)).toBe(false);
  });
});
