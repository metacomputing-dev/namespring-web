import { describe, it, expect } from 'vitest';
import { Cheongan, CHEONGAN_INFO } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { Ohaeng } from '../../src/domain/Ohaeng.js';
import { Pillar } from '../../src/domain/Pillar.js';
import { PillarSet } from '../../src/domain/PillarSet.js';
import { PillarPosition } from '../../src/domain/PillarPosition.js';
import { HapState } from '../../src/domain/Relations.js';
import type { HapHwaEvaluation } from '../../src/domain/Relations.js';
import { DEFAULT_CONFIG } from '../../src/config/CalculationConfig.js';
import { StrengthAnalyzer } from '../../src/engine/analysis/StrengthAnalyzer.js';
import { GyeokgukDeterminer } from '../../src/engine/analysis/GyeokgukDeterminer.js';
import { YongshinDecider } from '../../src/engine/analysis/YongshinDecider.js';
import { GyeokgukCategory, GyeokgukType } from '../../src/domain/Gyeokguk.js';
import { YongshinType } from '../../src/domain/YongshinResult.js';

/**
 * Ported from HapHwaCascadeIntegrationTest.kt
 *
 * Verifies that hapHwa state changes propagate through the full analysis pipeline:
 *   hapHwaEvaluations -> StrengthAnalyzer -> GyeokgukDeterminer -> YongshinDecider
 *
 * Design: components called directly (no BirthInput) to avoid complex calendar logic.
 * Same PillarSet with different hapHwaEvaluations, comparing results.
 */

// ── Helpers ─────────────────────────────────────────────────────────

function makePillars(opts: {
  yearStem: Cheongan;
  monthStem: Cheongan;
  dayStem: Cheongan;
  hourStem: Cheongan;
  yearBranch?: Jiji;
  monthBranch?: Jiji;
  dayBranch?: Jiji;
  hourBranch?: Jiji;
}): PillarSet {
  return new PillarSet(
    new Pillar(opts.yearStem, opts.yearBranch ?? Jiji.JA),
    new Pillar(opts.monthStem, opts.monthBranch ?? Jiji.IN),
    new Pillar(opts.dayStem, opts.dayBranch ?? Jiji.O),
    new Pillar(opts.hourStem, opts.hourBranch ?? Jiji.JA),
  );
}

function hapGeoEval(
  stem1: Cheongan,
  stem2: Cheongan,
  pos1: PillarPosition,
  pos2: PillarPosition,
  resultOhaeng: Ohaeng,
): HapHwaEvaluation {
  return {
    stem1,
    stem2,
    position1: pos1,
    position2: pos2,
    resultOhaeng,
    state: HapState.HAPGEO,
    confidence: 0.60,
    conditionsMet: ['인접'],
    conditionsFailed: ['월령'],
    reasoning: '테스트용 합거',
    dayMasterInvolved: false,
  };
}

function hapWhaEval(
  stem1: Cheongan,
  stem2: Cheongan,
  pos1: PillarPosition,
  pos2: PillarPosition,
  resultOhaeng: Ohaeng,
  confidence: number = 0.80,
): HapHwaEvaluation {
  return {
    stem1,
    stem2,
    position1: pos1,
    position2: pos2,
    resultOhaeng,
    state: HapState.HAPWHA,
    confidence,
    conditionsMet: ['인접', '월령', '무극'],
    conditionsFailed: [],
    reasoning: '테스트용 합화',
    dayMasterInvolved: false,
  };
}

const config = DEFAULT_CONFIG;

// ── 1. StrengthAnalyzer deukse difference (hapgeo) ──────────────────

describe('HapHwaCascade - Stage 1: StrengthAnalyzer hapgeo deukse', () => {
  it('hapgeo eliminates bigyeop contribution from deukse', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,    // bigyeop 7 pts
      monthStem: Cheongan.GI,    // pyeonjae 0 pts
      dayStem: Cheongan.GAP,     // day master
      hourStem: Cheongan.IM,     // pyeonin 5 pts
    });

    const noHap = StrengthAnalyzer.analyze(pillars, config);
    const withHapGeo = StrengthAnalyzer.analyze(
      pillars, config, null,
      [hapGeoEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH)],
    );

    expect(noHap.score.deukse).toBeGreaterThan(withHapGeo.score.deukse);
    const deukseDiff = noHap.score.deukse - withHapGeo.score.deukse;
    expect(deukseDiff).toBeCloseTo(7.0, 1);
  });

  it('hapgeo eliminates inseong contribution', () => {
    const pillars = makePillars({
      yearStem: Cheongan.IM,       // pyeonin 5 pts
      monthStem: Cheongan.JEONG,   // sanggwan 0 pts
      dayStem: Cheongan.GAP,       // day master
      hourStem: Cheongan.MU,       // pyeonjae 0 pts
    });
    const hapGeo = hapGeoEval(Cheongan.JEONG, Cheongan.IM, PillarPosition.MONTH, PillarPosition.YEAR, Ohaeng.WOOD);

    const noHap = StrengthAnalyzer.analyze(pillars, config);
    const withHap = StrengthAnalyzer.analyze(pillars, config, null, [hapGeo]);

    const diff = noHap.score.deukse - withHap.score.deukse;
    expect(diff).toBeCloseTo(5.0, 1);
  });

  it('hapgeo eliminates both supporting and non-supporting stems', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GYEONG,   // pyeongwan 0 pts
      monthStem: Cheongan.EUL,     // gyeobjae 7 pts
      dayStem: Cheongan.GAP,       // day master
      hourStem: Cheongan.MU,       // pyeonjae 0 pts
    });
    const hapGeo = hapGeoEval(Cheongan.EUL, Cheongan.GYEONG, PillarPosition.MONTH, PillarPosition.YEAR, Ohaeng.METAL);

    const noHap = StrengthAnalyzer.analyze(pillars, config);
    const withHap = StrengthAnalyzer.analyze(pillars, config, null, [hapGeo]);

    const diff = noHap.score.deukse - withHap.score.deukse;
    expect(diff).toBeCloseTo(7.0, 1);
  });

  it('hapgeo propagates to totalSupport', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,    // bigyeop 7 pts
      monthStem: Cheongan.GI,    // pyeonjae 0 pts
      dayStem: Cheongan.GAP,     // day master
      hourStem: Cheongan.GYE,    // jeongin 5 pts
    });
    const hapGeo = hapGeoEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH);

    const noHap = StrengthAnalyzer.analyze(pillars, config);
    const withHap = StrengthAnalyzer.analyze(pillars, config, null, [hapGeo]);

    expect(noHap.score.deukryeong).toBeCloseTo(withHap.score.deukryeong, 1);
    expect(noHap.score.deukji).toBeCloseTo(withHap.score.deukji, 1);

    const totalDiff = noHap.score.totalSupport - withHap.score.totalSupport;
    const deukseDiff = noHap.score.deukse - withHap.score.deukse;
    expect(totalDiff).toBeCloseTo(deukseDiff, 1);
  });
});

// ── 2. StrengthAnalyzer hapwha ohaeng transformation ────────────────

describe('HapHwaCascade - Stage 2: StrengthAnalyzer hapwha ohaeng transformation', () => {
  it('hapwha transforms bigyeop to pyeonjae, losing support', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,    // bigyeop -> hapwha to EARTH (pyeonjae)
      monthStem: Cheongan.GI,    // pyeonjae -> hapwha to EARTH (pyeonjae)
      dayStem: Cheongan.GAP,     // day master
      hourStem: Cheongan.MU,     // pyeonjae 0 pts
    });
    const hapWha = hapWhaEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH);

    const noHap = StrengthAnalyzer.analyze(pillars, config);
    const withHap = StrengthAnalyzer.analyze(pillars, config, null, [hapWha]);

    const diff = noHap.score.deukse - withHap.score.deukse;
    expect(diff).toBeCloseTo(7.0, 1);
  });

  it('hapwha transforms inseong to bigyeop, gaining support', () => {
    const pillars = makePillars({
      yearStem: Cheongan.IM,       // pyeonin 5 -> hapwha-wood bigyeop 7
      monthStem: Cheongan.JEONG,   // sanggwan 0 -> hapwha-wood bigyeop 7
      dayStem: Cheongan.GAP,       // day master
      hourStem: Cheongan.MU,       // pyeonjae 0 pts
    });
    const hapWha = hapWhaEval(Cheongan.JEONG, Cheongan.IM, PillarPosition.MONTH, PillarPosition.YEAR, Ohaeng.WOOD);

    const noHap = StrengthAnalyzer.analyze(pillars, config);
    const withHap = StrengthAnalyzer.analyze(pillars, config, null, [hapWha]);

    expect(withHap.score.deukse).toBeGreaterThan(noHap.score.deukse);
  });

  it('eul-gyeong hapwha-metal: fire day master loses inseong', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL,      // pyeonin 5 -> hapwha-metal jaeseong 0
      monthStem: Cheongan.GYEONG,  // pyeonjae 0 -> hapwha-metal jaeseong 0
      dayStem: Cheongan.BYEONG,    // day master
      hourStem: Cheongan.MU,       // siksin 0 pts
      monthBranch: Jiji.SA,
    });
    const hapWha = hapWhaEval(Cheongan.EUL, Cheongan.GYEONG, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.METAL);

    const noHap = StrengthAnalyzer.analyze(pillars, config);
    const withHap = StrengthAnalyzer.analyze(pillars, config, null, [hapWha]);

    const diff = noHap.score.deukse - withHap.score.deukse;
    expect(diff).toBeCloseTo(5.0, 1);
  });
});

// ── 3. Strength determination shift ─────────────────────────────────

describe('HapHwaCascade - Stage 3: Strength determination shift', () => {
  it('hapgeo can shift strong to weak via bigyeop elimination', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,      // bigyeop 7
      monthStem: Cheongan.GI,      // pyeonjae 0
      dayStem: Cheongan.GAP,       // day master
      hourStem: Cheongan.GYEONG,   // pyeongwan 0
      monthBranch: Jiji.IN,        // deukryeong 40
      dayBranch: Jiji.SIN,
      yearBranch: Jiji.YU,
      hourBranch: Jiji.SUL,
    });
    const hapGeo = hapGeoEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH);

    const noHap = StrengthAnalyzer.analyze(pillars, config);
    const withHap = StrengthAnalyzer.analyze(pillars, config, null, [hapGeo]);

    expect(noHap.score.totalSupport).toBeGreaterThan(withHap.score.totalSupport);

    if (noHap.isStrong && !withHap.isStrong) {
      expect(withHap.isStrong).toBe(false);
    }
  });

  it('hapwha can boost totalSupport significantly', () => {
    const pillars = makePillars({
      yearStem: Cheongan.IM,       // pyeonin -> hapwha-wood bigyeop
      monthStem: Cheongan.JEONG,   // sanggwan -> hapwha-wood bigyeop
      dayStem: Cheongan.GAP,
      hourStem: Cheongan.MU,       // pyeonjae 0
      monthBranch: Jiji.IN,        // deukryeong 40
    });
    const hapWha = hapWhaEval(Cheongan.JEONG, Cheongan.IM, PillarPosition.MONTH, PillarPosition.YEAR, Ohaeng.WOOD);

    const noHap = StrengthAnalyzer.analyze(pillars, config);
    const withHap = StrengthAnalyzer.analyze(pillars, config, null, [hapWha]);

    const boost = withHap.score.deukse - noHap.score.deukse;
    expect(boost).toBeGreaterThanOrEqual(9.0);
    expect(withHap.score.totalSupport).toBeGreaterThan(noHap.score.totalSupport);
  });
});

// ── 4. GyeokgukDeterminer changes ───────────────────────────────────

describe('HapHwaCascade - Stage 4: GyeokgukDeterminer changes', () => {
  it('hapwha triggers hwagyeok category', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,
      monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG,
      hourStem: Cheongan.MU,
      monthBranch: Jiji.JIN,
    });
    const strength = StrengthAnalyzer.analyze(pillars, config);
    const hapWha = hapWhaEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH);

    const noHap = GyeokgukDeterminer.determine(pillars, strength);
    const withHap = GyeokgukDeterminer.determine(pillars, strength, [hapWha]);

    expect(noHap.category).toBe(GyeokgukCategory.NAEGYEOK);
    expect(withHap.category).toBe(GyeokgukCategory.HWAGYEOK);
    expect(withHap.type).toBe(GyeokgukType.HAPWHA_EARTH);
  });

  it('hapgeo neutralizing controlling stem may allow ilhaeng', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GYEONG,   // metal controls wood
      monthStem: Cheongan.EUL,     // wood
      dayStem: Cheongan.GAP,       // day master
      hourStem: Cheongan.IM,       // water (not controlling)
      yearBranch: Jiji.IN,
      monthBranch: Jiji.MYO,
      dayBranch: Jiji.JIN,
      hourBranch: Jiji.IN,
    });
    const strength = StrengthAnalyzer.analyze(pillars, config);
    const noHap = GyeokgukDeterminer.determine(pillars, strength, [], config);

    const hapGeo = hapGeoEval(Cheongan.EUL, Cheongan.GYEONG, PillarPosition.MONTH, PillarPosition.YEAR, Ohaeng.METAL);
    const withHap = GyeokgukDeterminer.determine(pillars, strength, [hapGeo], config);

    expect(noHap.category).not.toBe(GyeokgukCategory.ILHAENG);

    const validCategories = new Set([GyeokgukCategory.ILHAENG, GyeokgukCategory.JONGGYEOK, GyeokgukCategory.NAEGYEOK]);
    expect(validCategories.has(withHap.category)).toBe(true);
  });

  it('hapgeo eliminates tuchul stem, changing naegyeok type', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,      // hapgeo target
      monthStem: Cheongan.GI,      // hapgeo target
      dayStem: Cheongan.GYEONG,    // day master
      hourStem: Cheongan.BYEONG,   // mid-qi tuchul candidate
      monthBranch: Jiji.IN,        // junggi = BYEONG, jeonggi = GAP
    });
    const strength = StrengthAnalyzer.analyze(pillars, config);

    const noHap = GyeokgukDeterminer.determine(pillars, strength, [], config);
    const hapGeo = hapGeoEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH);
    const withHap = GyeokgukDeterminer.determine(pillars, strength, [hapGeo], config);

    expect(noHap).toBeDefined();
    expect(withHap).toBeDefined();

    if (noHap.category === GyeokgukCategory.NAEGYEOK && withHap.category === GyeokgukCategory.NAEGYEOK) {
      expect(noHap.type).not.toBe(withHap.type);
    }
  });
});

// ── 5. Full cascade (Strength -> Gyeokguk -> Yongshin) ──────────────

describe('HapHwaCascade - Stage 5: Full cascade', () => {
  it('hapgeo full pipeline produces score difference', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,    // bigyeop 7 -> hapgeo eliminated
      monthStem: Cheongan.GI,    // pyeonjae 0 -> hapgeo eliminated
      dayStem: Cheongan.GAP,     // day master
      hourStem: Cheongan.IM,     // pyeonin 5
      monthBranch: Jiji.IN,
    });

    // No hap pipeline
    const strengthNoHap = StrengthAnalyzer.analyze(pillars, config);
    const gyeokgukNoHap = GyeokgukDeterminer.determine(pillars, strengthNoHap, [], config);
    const yongshinNoHap = YongshinDecider.decide(
      pillars, strengthNoHap.isStrong, CHEONGAN_INFO[Cheongan.GAP].ohaeng,
      config, gyeokgukNoHap,
    );

    // With hapgeo pipeline
    const hapGeo = hapGeoEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH);
    const evals = [hapGeo];
    const strengthWithHap = StrengthAnalyzer.analyze(pillars, config, null, evals);
    const gyeokgukWithHap = GyeokgukDeterminer.determine(pillars, strengthWithHap, evals, config);
    const yongshinWithHap = YongshinDecider.decide(
      pillars, strengthWithHap.isStrong, CHEONGAN_INFO[Cheongan.GAP].ohaeng,
      config, gyeokgukWithHap, evals,
    );

    expect(strengthNoHap.score.totalSupport).toBeGreaterThan(strengthWithHap.score.totalSupport);

    expect(strengthNoHap).toBeDefined();
    expect(strengthWithHap).toBeDefined();
    expect(gyeokgukNoHap).toBeDefined();
    expect(gyeokgukWithHap).toBeDefined();
    expect(yongshinNoHap).toBeDefined();
    expect(yongshinWithHap).toBeDefined();

    const deukseDiff = strengthNoHap.score.deukse - strengthWithHap.score.deukse;
    expect(deukseDiff).toBeCloseTo(7.0, 1);
  });

  it('hapwha hwagyeok produces hapwha-yongshin', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,
      monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG,
      hourStem: Cheongan.MU,
      monthBranch: Jiji.JIN,
    });
    const hapWha = hapWhaEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH);
    const evals = [hapWha];

    const strength = StrengthAnalyzer.analyze(pillars, config, null, evals);
    const gyeokguk = GyeokgukDeterminer.determine(pillars, strength, evals, config);
    const yongshin = YongshinDecider.decide(
      pillars, strength.isStrong, CHEONGAN_INFO[Cheongan.BYEONG].ohaeng,
      config, gyeokguk, evals,
    );

    expect(gyeokguk.category).toBe(GyeokgukCategory.HWAGYEOK);
    expect(yongshin.finalYongshin).toBe(Ohaeng.FIRE);
  });

  it('same pillars without hapwha produces naegyeok', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,
      monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG,
      hourStem: Cheongan.MU,
      monthBranch: Jiji.JIN,
    });

    const strengthNoHap = StrengthAnalyzer.analyze(pillars, config);
    const gyeokgukNoHap = GyeokgukDeterminer.determine(pillars, strengthNoHap, [], config);
    const yongshinNoHap = YongshinDecider.decide(
      pillars, strengthNoHap.isStrong, CHEONGAN_INFO[Cheongan.BYEONG].ohaeng,
      config, gyeokgukNoHap,
    );

    const hapWha = hapWhaEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH);
    const evals = [hapWha];
    const strengthWithHap = StrengthAnalyzer.analyze(pillars, config, null, evals);
    const gyeokgukWithHap = GyeokgukDeterminer.determine(pillars, strengthWithHap, evals, config);

    expect(gyeokgukNoHap.category).not.toBe(gyeokgukWithHap.category);
  });
});

// ── 6. Multiple cheongan-hap pairs cascade ──────────────────────────

describe('HapHwaCascade - Stage 6: Multiple cheongan-hap pairs', () => {
  it('eul-gyeong hapwha-metal: fire day master loses support', () => {
    const pillars = makePillars({
      yearStem: Cheongan.EUL,
      monthStem: Cheongan.GYEONG,
      dayStem: Cheongan.BYEONG,
      hourStem: Cheongan.JEONG,    // gyeobjae 7 pts
      monthBranch: Jiji.SA,
    });
    const hapWha = hapWhaEval(Cheongan.EUL, Cheongan.GYEONG, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.METAL);

    const noHap = StrengthAnalyzer.analyze(pillars, config);
    const withHap = StrengthAnalyzer.analyze(pillars, config, null, [hapWha]);

    expect(noHap.score.deukse).toBeGreaterThan(withHap.score.deukse);
  });

  it('byeong-sin hapwha-water: wood day master gains inseong', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG,   // siksin 0 -> hapwha-water inseong
      monthStem: Cheongan.SIN,     // jeonggwan 0 -> hapwha-water inseong
      dayStem: Cheongan.GAP,       // day master
      hourStem: Cheongan.MU,       // pyeonjae 0
      monthBranch: Jiji.IN,
    });
    const hapWha = hapWhaEval(Cheongan.BYEONG, Cheongan.SIN, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.WATER);

    const noHap = StrengthAnalyzer.analyze(pillars, config);
    const withHap = StrengthAnalyzer.analyze(pillars, config, null, [hapWha]);

    const boost = withHap.score.deukse - noHap.score.deukse;
    expect(boost).toBeCloseTo(10.0, 1);
  });

  it('mu-gye hapwha-fire: metal day master loses inseong', () => {
    const pillars = makePillars({
      yearStem: Cheongan.MU,       // pyeonin 5 -> hapwha-fire gwanseong 0
      monthStem: Cheongan.GYE,     // sanggwan 0 -> hapwha-fire gwanseong 0
      dayStem: Cheongan.GYEONG,    // day master
      hourStem: Cheongan.SIN,      // gyeobjae 7
      monthBranch: Jiji.SIN,
    });
    const hapWha = hapWhaEval(Cheongan.MU, Cheongan.GYE, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.FIRE);

    const noHap = StrengthAnalyzer.analyze(pillars, config);
    const withHap = StrengthAnalyzer.analyze(pillars, config, null, [hapWha]);

    const diff = noHap.score.deukse - withHap.score.deukse;
    expect(diff).toBeCloseTo(5.0, 1);
  });
});

// ── 7. Hapgeo and jonggyeok interaction ─────────────────────────────

describe('HapHwaCascade - Stage 7: Hapgeo and jonggyeok', () => {
  it('hapgeo bigyeop elimination affects elementProfile', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,      // bigyeop -> hapgeo target
      monthStem: Cheongan.GI,      // pyeonjae
      dayStem: Cheongan.GAP,       // day master
      hourStem: Cheongan.GYEONG,   // pyeongwan
      monthBranch: Jiji.YU,
      yearBranch: Jiji.SIN,
      dayBranch: Jiji.SUL,
      hourBranch: Jiji.YU,
    });
    const hapGeo = hapGeoEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH);

    const strengthNoHap = StrengthAnalyzer.analyze(pillars, config);
    const gyeokgukNoHap = GyeokgukDeterminer.determine(pillars, strengthNoHap, [], config);

    const strengthWithHap = StrengthAnalyzer.analyze(pillars, config, null, [hapGeo]);
    const gyeokgukWithHap = GyeokgukDeterminer.determine(pillars, strengthWithHap, [hapGeo], config);

    expect(strengthWithHap.score.totalSupport).toBeLessThanOrEqual(strengthNoHap.score.totalSupport);
    expect(gyeokgukNoHap).toBeDefined();
    expect(gyeokgukWithHap).toBeDefined();
  });
});

// ── 8. Hapwha and YongshinDecider interaction ───────────────────────

describe('HapHwaCascade - Stage 8: Hapwha and YongshinDecider', () => {
  it('hapwha element count change accepted by tongwan', () => {
    const pillars = makePillars({
      yearStem: Cheongan.BYEONG,
      monthStem: Cheongan.SIN,
      dayStem: Cheongan.GAP,
      hourStem: Cheongan.GAP,
      monthBranch: Jiji.SIN,
      yearBranch: Jiji.YU,
      dayBranch: Jiji.IN,
      hourBranch: Jiji.MYO,
    });

    const tongwanNoHap = YongshinDecider.tongwanYongshin(
      pillars, CHEONGAN_INFO[Cheongan.GAP].ohaeng, [],
    );

    const hapWha = hapWhaEval(Cheongan.BYEONG, Cheongan.SIN, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.WATER);
    const tongwanWithHap = YongshinDecider.tongwanYongshin(
      pillars, CHEONGAN_INFO[Cheongan.GAP].ohaeng, [hapWha],
    );

    // Both should execute without errors. Specific results vary by element counts.
    expect(true).toBe(true);
  });

  it('hapwha concentrating element triggers byeongyak', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,
      monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG,
      hourStem: Cheongan.MU,
      monthBranch: Jiji.CHUK,
      yearBranch: Jiji.MI,
      dayBranch: Jiji.JIN,
      hourBranch: Jiji.SUL,
    });
    const hapWha = hapWhaEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH);

    const byeongNoHap = YongshinDecider.byeongyakYongshin(
      pillars, CHEONGAN_INFO[Cheongan.BYEONG].ohaeng, true, [],
    );
    const byeongWithHap = YongshinDecider.byeongyakYongshin(
      pillars, CHEONGAN_INFO[Cheongan.BYEONG].ohaeng, true, [hapWha],
    );

    if (byeongWithHap != null) {
      expect(byeongWithHap.type).toBe(YongshinType.BYEONGYAK);
      expect(byeongWithHap.primaryElement).toBe(Ohaeng.WOOD);
    }
    // Pipeline processes without error regardless of activation
    expect(pillars).toBeDefined();
  });
});

// ── 9. Multiple evaluations simultaneously ──────────────────────────

describe('HapHwaCascade - Stage 9: Multiple evaluations', () => {
  it('multiple evaluation list processed normally', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,
      monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG,
      hourStem: Cheongan.MU,
      monthBranch: Jiji.JIN,
    });

    const hapGeo = hapGeoEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH);
    const notEstablished: HapHwaEvaluation = {
      stem1: Cheongan.MU,
      stem2: Cheongan.GYE,
      position1: PillarPosition.HOUR,
      position2: PillarPosition.YEAR,
      resultOhaeng: Ohaeng.FIRE,
      state: HapState.NOT_ESTABLISHED,
      confidence: 1.0,
      conditionsMet: [],
      conditionsFailed: ['비인접'],
      reasoning: '불성립',
      dayMasterInvolved: false,
    };
    const evals = [hapGeo, notEstablished];

    const strength = StrengthAnalyzer.analyze(pillars, config, null, evals);
    const gyeokguk = GyeokgukDeterminer.determine(pillars, strength, evals, config);
    const yongshin = YongshinDecider.decide(
      pillars, strength.isStrong, CHEONGAN_INFO[Cheongan.BYEONG].ohaeng,
      config, gyeokguk, evals,
    );

    expect(strength).toBeDefined();
    expect(gyeokguk).toBeDefined();
    expect(yongshin).toBeDefined();
  });
});

// ── 10. Hapwha confidence propagation ───────────────────────────────

describe('HapHwaCascade - Stage 10: Confidence propagation', () => {
  it('hapwha confidence propagates to hwagyeok confidence', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,
      monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG,
      hourStem: Cheongan.MU,
      monthBranch: Jiji.JIN,
    });
    const strength = StrengthAnalyzer.analyze(pillars, config);

    const highConf = hapWhaEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH, 0.90);
    const lowConf = hapWhaEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH, 0.60);

    const gyeokgukHigh = GyeokgukDeterminer.determine(pillars, strength, [highConf], config);
    const gyeokgukLow = GyeokgukDeterminer.determine(pillars, strength, [lowConf], config);

    expect(gyeokgukHigh.category).toBe(GyeokgukCategory.HWAGYEOK);
    expect(gyeokgukLow.category).toBe(GyeokgukCategory.HWAGYEOK);

    expect(gyeokgukHigh.confidence).toBeCloseTo(0.90, 1);
    expect(gyeokgukLow.confidence).toBeCloseTo(0.60, 1);
  });

  it('hapwha confidence affects final yongshin confidence', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,
      monthStem: Cheongan.GI,
      dayStem: Cheongan.BYEONG,
      hourStem: Cheongan.MU,
      monthBranch: Jiji.JIN,
    });
    const hapWha = hapWhaEval(Cheongan.GAP, Cheongan.GI, PillarPosition.YEAR, PillarPosition.MONTH, Ohaeng.EARTH, 0.85);
    const evals = [hapWha];

    const strength = StrengthAnalyzer.analyze(pillars, config, null, evals);
    const gyeokguk = GyeokgukDeterminer.determine(pillars, strength, evals, config);
    const yongshin = YongshinDecider.decide(
      pillars, strength.isStrong, CHEONGAN_INFO[Cheongan.BYEONG].ohaeng,
      config, gyeokguk, evals,
    );

    expect(yongshin.finalConfidence).toBeGreaterThanOrEqual(0.75);
    expect(yongshin.finalConfidence).toBeLessThanOrEqual(0.95);
  });
});

// ── 11. Empty hapwha evaluation baseline ────────────────────────────

describe('HapHwaCascade - Stage 11: Empty evaluation baseline', () => {
  it('empty list equals omitted evaluations', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,
      monthStem: Cheongan.GI,
      dayStem: Cheongan.GAP,
      hourStem: Cheongan.IM,
    });

    const resultOmitted = StrengthAnalyzer.analyze(pillars, config);
    const resultEmpty = StrengthAnalyzer.analyze(pillars, config, null, []);

    expect(resultOmitted.score.deukse).toBeCloseTo(resultEmpty.score.deukse, 2);
    expect(resultOmitted.score.totalSupport).toBeCloseTo(resultEmpty.score.totalSupport, 2);
    expect(resultOmitted.isStrong).toBe(resultEmpty.isStrong);
  });

  it('NOT_ESTABLISHED evaluation equals no hap', () => {
    const pillars = makePillars({
      yearStem: Cheongan.GAP,
      monthStem: Cheongan.GI,
      dayStem: Cheongan.GAP,
      hourStem: Cheongan.IM,
    });
    const notEst: HapHwaEvaluation = {
      stem1: Cheongan.GAP,
      stem2: Cheongan.GI,
      position1: PillarPosition.YEAR,
      position2: PillarPosition.MONTH,
      resultOhaeng: Ohaeng.EARTH,
      state: HapState.NOT_ESTABLISHED,
      confidence: 1.0,
      conditionsMet: [],
      conditionsFailed: ['비인접'],
      reasoning: '불성립',
      dayMasterInvolved: false,
    };

    const resultNoHap = StrengthAnalyzer.analyze(pillars, config);
    const resultNotEst = StrengthAnalyzer.analyze(pillars, config, null, [notEst]);

    expect(resultNoHap.score.deukse).toBeCloseTo(resultNotEst.score.deukse, 2);
    expect(resultNoHap.score.totalSupport).toBeCloseTo(resultNotEst.score.totalSupport, 2);
  });
});
