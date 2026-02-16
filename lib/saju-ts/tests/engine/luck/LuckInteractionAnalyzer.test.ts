import { describe, it, expect } from 'vitest';
import { LuckInteractionAnalyzer } from '../../../src/engine/luck/LuckInteractionAnalyzer.js';
import { LuckQuality } from '../../../src/domain/LuckInteraction.js';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { SibiUnseong } from '../../../src/domain/SibiUnseong.js';
import { Sipseong } from '../../../src/domain/Sipseong.js';
import type { DaeunInfo, DaeunPillar } from '../../../src/domain/DaeunInfo.js';
import { DaeunBoundaryMode } from '../../../src/domain/DaeunInfo.js';
import type { SaeunPillar } from '../../../src/domain/SaeunInfo.js';

/**
 * Ported from LuckInteractionAnalyzerTest.kt
 */

// =========================================================================
// Helper: dummy natal pillars
// =========================================================================
function dummyNatalPillars(dayMaster: Cheongan = Cheongan.GAP): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.BYEONG, Jiji.O),
    new Pillar(Cheongan.JEONG, Jiji.SA),
    new Pillar(dayMaster, Jiji.SUL),
    new Pillar(Cheongan.MU, Jiji.JIN),
  );
}

function makeDaeunPillar(cheongan: Cheongan, jiji: Jiji, startAge: number, endAge: number, order: number): DaeunPillar {
  return {
    pillar: new Pillar(cheongan, jiji),
    startAge,
    endAge,
    order,
  };
}

function makeDaeunInfo(pillars: DaeunPillar[], firstDaeunStartAge: number = 3): DaeunInfo {
  return {
    isForward: true,
    firstDaeunStartAge,
    daeunPillars: pillars,
    boundaryMode: DaeunBoundaryMode.EXACT_TABLE,
    warnings: [],
    firstDaeunStartMonths: firstDaeunStartAge * 12,
  };
}

function makeSaeunPillar(year: number, cheongan: Cheongan, jiji: Jiji): SaeunPillar {
  return { year, pillar: new Pillar(cheongan, jiji) };
}

// =========================================================================
// Sipseong tests: verifying day master -> luck stem relationship
// =========================================================================
describe('LuckInteractionAnalyzer sipseong', () => {
  it('GAP day master with WATER daeun produces 편인', () => {
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.IM, Jiji.JA);
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.sipseong).toBe(Sipseong.PYEON_IN);
  });

  it('GAP day master with GYE WATER produces 정인', () => {
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.GYE, Jiji.HAE);
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.sipseong).toBe(Sipseong.JEONG_IN);
  });

  it('GAP day master with METAL daeun produces 편관', () => {
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.GYEONG, Jiji.SIN);
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.sipseong).toBe(Sipseong.PYEON_GWAN);
  });

  it('GAP day master with SIN METAL produces 정관', () => {
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.SIN, Jiji.YU);
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.sipseong).toBe(Sipseong.JEONG_GWAN);
  });

  it('GAP day master with GAP produces 비견', () => {
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.GAP, Jiji.IN);
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.sipseong).toBe(Sipseong.BI_GYEON);
  });

  it('GAP day master with FIRE produces 식신', () => {
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.BYEONG, Jiji.O);
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.sipseong).toBe(Sipseong.SIK_SIN);
  });

  it('GAP day master with EARTH produces 편재', () => {
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.MU, Jiji.JIN);
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.sipseong).toBe(Sipseong.PYEON_JAE);
  });
});

// =========================================================================
// SibiUnseong tests
// =========================================================================
describe('LuckInteractionAnalyzer sibiUnseong', () => {
  it('GAP day master JA branch produces 목욕', () => {
    // GAP (YANG WOOD), jangSaeng branch = HAE (해).
    // JA (자) has ordinal 0, HAE has ordinal 11.
    // Forward: (0 - 11 + 12) % 12 = 1 => MOK_YOK
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.IM, Jiji.JA);
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.sibiUnseong).toBe(SibiUnseong.MOK_YOK);
  });

  it('GAP day master IN branch produces 건록', () => {
    // GAP jangSaeng = HAE (ordinal 11).
    // IN (寅) ordinal = 2. Forward: (2 - 11 + 12) % 12 = 3 => GEON_ROK
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.GAP, Jiji.IN);
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.sibiUnseong).toBe(SibiUnseong.GEON_ROK);
  });
});

// =========================================================================
// Yongshin / Gisin element matching
// =========================================================================
describe('LuckInteractionAnalyzer yongshin/gisin', () => {
  it('yongshin element matched when stem ohaeng matches', () => {
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.IM, Jiji.JA); // WATER stem, WATER branch
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, Ohaeng.WATER, null,
    );

    expect(result.isYongshinElement).toBe(true);
    expect(result.isGisinElement).toBe(false);
  });

  it('yongshin element matched when branch ohaeng matches', () => {
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.GAP, Jiji.JA); // WOOD stem, WATER branch
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, Ohaeng.WATER, null,
    );

    expect(result.isYongshinElement).toBe(true);
  });

  it('gisin element matched correctly', () => {
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.GYEONG, Jiji.SIN); // METAL stem, METAL branch
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, Ohaeng.WATER, Ohaeng.METAL,
    );

    expect(result.isYongshinElement).toBe(false);
    expect(result.isGisinElement).toBe(true);
  });

  it('neither yongshin nor gisin when no match', () => {
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.BYEONG, Jiji.O); // FIRE stem, FIRE branch
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, Ohaeng.WATER, Ohaeng.METAL,
    );

    expect(result.isYongshinElement).toBe(false);
    expect(result.isGisinElement).toBe(false);
  });

  it('yongshin and gisin null produces no match', () => {
    const dayMaster = Cheongan.GAP;
    const luckPillar = new Pillar(Cheongan.IM, Jiji.JA);
    const natal = dummyNatalPillars(dayMaster);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.isYongshinElement).toBe(false);
    expect(result.isGisinElement).toBe(false);
  });
});

// =========================================================================
// Stem relation detection (합/충 with natal stems)
// =========================================================================
describe('LuckInteractionAnalyzer stem relations', () => {
  it('stem hap detected with natal month stem', () => {
    const dayMaster = Cheongan.BYEONG;
    const natal = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(dayMaster, Jiji.O),
      new Pillar(Cheongan.MU, Jiji.SUL),
    );
    const luckPillar = new Pillar(Cheongan.GI, Jiji.MI);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.stemRelations).toContain('갑기합');
  });

  it('stem chung detected with natal year stem', () => {
    const dayMaster = Cheongan.BYEONG;
    const natal = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.JEONG, Jiji.MYO),
      new Pillar(dayMaster, Jiji.O),
      new Pillar(Cheongan.MU, Jiji.SUL),
    );
    const luckPillar = new Pillar(Cheongan.GYEONG, Jiji.SIN);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.stemRelations).toContain('갑경충');
  });

  it('multiple stem relations detected', () => {
    const dayMaster = Cheongan.MU;
    const natal = new PillarSet(
      new Pillar(Cheongan.EUL, Jiji.SA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
      new Pillar(dayMaster, Jiji.O),
      new Pillar(Cheongan.GAP, Jiji.JA),
    );
    const luckPillar = new Pillar(Cheongan.SIN, Jiji.YU);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.stemRelations).toContain('을신충');
    expect(result.stemRelations).toContain('병신합');
  });

  it('no stem relations when no pairs match', () => {
    const dayMaster = Cheongan.BYEONG;
    const natal = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.MU, Jiji.IN),
      new Pillar(dayMaster, Jiji.O),
      new Pillar(Cheongan.JEONG, Jiji.SA),
    );
    const luckPillar = new Pillar(Cheongan.BYEONG, Jiji.O);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.stemRelations.length).toBe(0);
  });
});

// =========================================================================
// Branch relation detection (합/충/형/파/해 with natal branches)
// =========================================================================
describe('LuckInteractionAnalyzer branch relations', () => {
  it('branch chung detected with natal year branch', () => {
    const dayMaster = Cheongan.GAP;
    const natal = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(dayMaster, Jiji.SUL),
      new Pillar(Cheongan.MU, Jiji.JIN),
    );
    const luckPillar = new Pillar(Cheongan.BYEONG, Jiji.O);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.branchRelations).toContain('자오충');
  });

  it('branch yukhap detected', () => {
    const dayMaster = Cheongan.GAP;
    const natal = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(dayMaster, Jiji.SUL),
      new Pillar(Cheongan.MU, Jiji.JIN),
    );
    const luckPillar = new Pillar(Cheongan.GYE, Jiji.CHUK);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.branchRelations).toContain('자축합');
  });

  it('branch hyeong detected', () => {
    const dayMaster = Cheongan.GAP;
    const natal = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(dayMaster, Jiji.SUL),
      new Pillar(Cheongan.MU, Jiji.JIN),
    );
    const luckPillar = new Pillar(Cheongan.EUL, Jiji.MYO);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.branchRelations).toContain('자묘형');
  });

  it('branch pa detected', () => {
    const dayMaster = Cheongan.GAP;
    const natal = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(dayMaster, Jiji.SUL),
      new Pillar(Cheongan.MU, Jiji.JIN),
    );
    const luckPillar = new Pillar(Cheongan.SIN, Jiji.YU);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.branchRelations).toContain('자유파');
  });

  it('branch hae detected', () => {
    const dayMaster = Cheongan.GAP;
    const natal = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(dayMaster, Jiji.SUL),
      new Pillar(Cheongan.MU, Jiji.JIN),
    );
    const luckPillar = new Pillar(Cheongan.GI, Jiji.MI);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.branchRelations).toContain('자미해');
  });

  it('multiple branch relations detected', () => {
    const dayMaster = Cheongan.GAP;
    const natal = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(dayMaster, Jiji.SUL),
      new Pillar(Cheongan.MU, Jiji.JIN),
    );
    const luckPillar = new Pillar(Cheongan.GYEONG, Jiji.SIN);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    expect(result.branchRelations).toContain('인신충');
    expect(result.branchRelations).toContain('인신형');
  });
});

// =========================================================================
// Quality determination (determineLuckQuality)
// =========================================================================
describe('LuckInteractionAnalyzer.determineLuckQuality', () => {
  it('VERY_FAVORABLE when yongshin and good relations', () => {
    const quality = LuckInteractionAnalyzer.determineLuckQuality(
      Ohaeng.WATER, Ohaeng.WATER, Ohaeng.FIRE, true, false,
    );
    expect(quality).toBe(LuckQuality.VERY_FAVORABLE);
  });

  it('FAVORABLE when yongshin only', () => {
    const quality = LuckInteractionAnalyzer.determineLuckQuality(
      Ohaeng.WATER, Ohaeng.WATER, Ohaeng.FIRE, false, false,
    );
    expect(quality).toBe(LuckQuality.FAVORABLE);
  });

  it('FAVORABLE when good relations and not gisin', () => {
    const quality = LuckInteractionAnalyzer.determineLuckQuality(
      Ohaeng.EARTH, Ohaeng.WATER, Ohaeng.FIRE, true, false,
    );
    expect(quality).toBe(LuckQuality.FAVORABLE);
  });

  it('NEUTRAL when no match no relations', () => {
    const quality = LuckInteractionAnalyzer.determineLuckQuality(
      Ohaeng.EARTH, Ohaeng.WATER, Ohaeng.FIRE, false, false,
    );
    expect(quality).toBe(LuckQuality.NEUTRAL);
  });

  it('UNFAVORABLE when gisin only', () => {
    const quality = LuckInteractionAnalyzer.determineLuckQuality(
      Ohaeng.FIRE, Ohaeng.WATER, Ohaeng.FIRE, false, false,
    );
    expect(quality).toBe(LuckQuality.UNFAVORABLE);
  });

  it('UNFAVORABLE when bad relations only', () => {
    const quality = LuckInteractionAnalyzer.determineLuckQuality(
      Ohaeng.EARTH, Ohaeng.WATER, Ohaeng.FIRE, false, true,
    );
    expect(quality).toBe(LuckQuality.UNFAVORABLE);
  });

  it('VERY_UNFAVORABLE when gisin and bad relations', () => {
    const quality = LuckInteractionAnalyzer.determineLuckQuality(
      Ohaeng.FIRE, Ohaeng.WATER, Ohaeng.FIRE, false, true,
    );
    expect(quality).toBe(LuckQuality.VERY_UNFAVORABLE);
  });

  it('NEUTRAL when both null elements', () => {
    const quality = LuckInteractionAnalyzer.determineLuckQuality(
      Ohaeng.WATER, null, null, false, false,
    );
    expect(quality).toBe(LuckQuality.NEUTRAL);
  });

  it('FAVORABLE when both null elements but good relations', () => {
    const quality = LuckInteractionAnalyzer.determineLuckQuality(
      Ohaeng.WATER, null, null, true, false,
    );
    expect(quality).toBe(LuckQuality.FAVORABLE);
  });

  it('VERY_FAVORABLE takes priority when yongshin + good relations even with bad', () => {
    const quality = LuckInteractionAnalyzer.determineLuckQuality(
      Ohaeng.WATER, Ohaeng.WATER, Ohaeng.FIRE, true, true,
    );
    expect(quality).toBe(LuckQuality.VERY_FAVORABLE);
  });
});

// =========================================================================
// Full analyzeLuckPillar integration: quality derived from all factors
// =========================================================================
describe('LuckInteractionAnalyzer full analysis', () => {
  it('yongshin match produces FAVORABLE quality', () => {
    const dayMaster = Cheongan.GAP;
    const natal = new PillarSet(
      new Pillar(Cheongan.BYEONG, Jiji.O),
      new Pillar(Cheongan.JEONG, Jiji.SA),
      new Pillar(dayMaster, Jiji.SUL),
      new Pillar(Cheongan.MU, Jiji.JIN),
    );
    const luckPillar = new Pillar(Cheongan.IM, Jiji.JA);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, Ohaeng.WATER, Ohaeng.METAL,
    );

    expect(result.isYongshinElement).toBe(true);
    expect(result.isGisinElement).toBe(false);
    expect([LuckQuality.FAVORABLE, LuckQuality.VERY_FAVORABLE]).toContain(result.quality);
  });

  it('gisin match produces VERY_UNFAVORABLE quality', () => {
    const dayMaster = Cheongan.GAP;
    const natal = new PillarSet(
      new Pillar(Cheongan.BYEONG, Jiji.O),
      new Pillar(Cheongan.JEONG, Jiji.SA),
      new Pillar(dayMaster, Jiji.SUL),
      new Pillar(Cheongan.MU, Jiji.JIN),
    );
    const luckPillar = new Pillar(Cheongan.GYEONG, Jiji.SIN);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, Ohaeng.WATER, Ohaeng.METAL,
    );

    expect(result.isYongshinElement).toBe(false);
    expect(result.isGisinElement).toBe(true);
    // GYEONG-GAP = 갑경충 => bad relation exists
    // So quality should be VERY_UNFAVORABLE (gisin + bad relations)
    expect(result.quality).toBe(LuckQuality.VERY_UNFAVORABLE);
  });
});

// =========================================================================
// analyzeAllDaeun tests
// =========================================================================
describe('LuckInteractionAnalyzer.analyzeAllDaeun', () => {
  it('produces correct count', () => {
    const daeunInfo = makeDaeunInfo([
      makeDaeunPillar(Cheongan.EUL, Jiji.MYO, 3, 12, 1),
      makeDaeunPillar(Cheongan.BYEONG, Jiji.JIN, 13, 22, 2),
      makeDaeunPillar(Cheongan.JEONG, Jiji.SA, 23, 32, 3),
    ]);
    const natal = dummyNatalPillars(Cheongan.GAP);

    const results = LuckInteractionAnalyzer.analyzeAllDaeun(
      daeunInfo, natal, Cheongan.GAP, Ohaeng.WATER, Ohaeng.METAL,
    );

    expect(results.length).toBe(3);
  });

  it('preserves daeun pillar data', () => {
    const dp = makeDaeunPillar(Cheongan.EUL, Jiji.MYO, 3, 12, 1);
    const daeunInfo = makeDaeunInfo([dp]);
    const natal = dummyNatalPillars(Cheongan.GAP);

    const results = LuckInteractionAnalyzer.analyzeAllDaeun(
      daeunInfo, natal, Cheongan.GAP, null, null,
    );

    expect(results[0]!.daeunPillar.startAge).toBe(3);
    expect(results[0]!.daeunPillar.endAge).toBe(12);
  });
});

// =========================================================================
// Transition period detection
// =========================================================================
describe('LuckInteractionAnalyzer transition period', () => {
  it('first daeun is not transition period', () => {
    const daeunInfo = makeDaeunInfo([
      makeDaeunPillar(Cheongan.EUL, Jiji.MYO, 3, 12, 1),
      makeDaeunPillar(Cheongan.BYEONG, Jiji.JIN, 13, 22, 2),
    ]);
    const natal = dummyNatalPillars(Cheongan.GAP);

    const results = LuckInteractionAnalyzer.analyzeAllDaeun(
      daeunInfo, natal, Cheongan.GAP, null, null,
    );

    expect(results[0]!.isTransitionPeriod).toBe(false);
  });

  it('second and subsequent daeun are transition periods', () => {
    const daeunInfo = makeDaeunInfo([
      makeDaeunPillar(Cheongan.EUL, Jiji.MYO, 3, 12, 1),
      makeDaeunPillar(Cheongan.BYEONG, Jiji.JIN, 13, 22, 2),
      makeDaeunPillar(Cheongan.JEONG, Jiji.SA, 23, 32, 3),
    ]);
    const natal = dummyNatalPillars(Cheongan.GAP);

    const results = LuckInteractionAnalyzer.analyzeAllDaeun(
      daeunInfo, natal, Cheongan.GAP, null, null,
    );

    expect(results[1]!.isTransitionPeriod).toBe(true);
    expect(results[2]!.isTransitionPeriod).toBe(true);
  });
});

// =========================================================================
// analyzeSaeun tests
// =========================================================================
describe('LuckInteractionAnalyzer.analyzeSaeun', () => {
  it('produces correct count', () => {
    const saeunPillars: SaeunPillar[] = [
      makeSaeunPillar(2024, Cheongan.GAP, Jiji.JIN),
      makeSaeunPillar(2025, Cheongan.EUL, Jiji.SA),
      makeSaeunPillar(2026, Cheongan.BYEONG, Jiji.O),
    ];
    const natal = dummyNatalPillars(Cheongan.GAP);

    const results = LuckInteractionAnalyzer.analyzeSaeun(
      saeunPillars, natal, null, Cheongan.GAP, null, null,
    );

    expect(results.length).toBe(3);
  });

  it('with daeun includes daeun stem relations', () => {
    const dayMaster = Cheongan.BYEONG;
    const natal = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.JEONG, Jiji.MYO),
      new Pillar(dayMaster, Jiji.O),
      new Pillar(Cheongan.MU, Jiji.SUL),
    );
    const daeunPillar = new Pillar(Cheongan.GAP, Jiji.IN);
    const saeunPillars: SaeunPillar[] = [makeSaeunPillar(2025, Cheongan.GI, Jiji.YU)];

    const results = LuckInteractionAnalyzer.analyzeSaeun(
      saeunPillars, natal, daeunPillar, dayMaster, null, null,
    );

    expect(results[0]!.stemRelations).toContain('갑기합');
  });

  it('with daeun includes daeun branch relations', () => {
    const dayMaster = Cheongan.BYEONG;
    const natal = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.JEONG, Jiji.MYO),
      new Pillar(dayMaster, Jiji.O),
      new Pillar(Cheongan.MU, Jiji.SUL),
    );
    const daeunPillar = new Pillar(Cheongan.GAP, Jiji.IN);
    const saeunPillars: SaeunPillar[] = [makeSaeunPillar(2025, Cheongan.GYEONG, Jiji.SIN)];

    const results = LuckInteractionAnalyzer.analyzeSaeun(
      saeunPillars, natal, daeunPillar, dayMaster, null, null,
    );

    expect(results[0]!.branchRelations).toContain('인신충');
  });

  it('without daeun omits daeun relations', () => {
    const dayMaster = Cheongan.BYEONG;
    const natal = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.JEONG, Jiji.MYO),
      new Pillar(dayMaster, Jiji.O),
      new Pillar(Cheongan.MU, Jiji.SUL),
    );
    const saeunPillars: SaeunPillar[] = [makeSaeunPillar(2025, Cheongan.GI, Jiji.YU)];

    const results = LuckInteractionAnalyzer.analyzeSaeun(
      saeunPillars, natal, null, dayMaster, null, null,
    );

    expect(results[0]!.stemRelations).not.toContain('갑기합');
  });
});

// =========================================================================
// Summary format tests
// =========================================================================
describe('LuckInteractionAnalyzer summary', () => {
  it('contains pillar label, sipseong, and quality', () => {
    const dayMaster = Cheongan.GAP;
    const natal = dummyNatalPillars(dayMaster);
    const luckPillar = new Pillar(Cheongan.IM, Jiji.JA);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    // 임자운: 편인(偏印) / 목욕(沐浴) -- 평
    expect(result.summary).toContain('임자운');
    expect(result.summary).toContain('편인');
    expect(result.summary).toContain('목욕');
  });

  it('contains yongshin indicator when matched', () => {
    const dayMaster = Cheongan.GAP;
    const natal = dummyNatalPillars(dayMaster);
    const luckPillar = new Pillar(Cheongan.IM, Jiji.JA);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, Ohaeng.WATER, null,
    );

    expect(result.summary).toContain('용신운');
  });

  it('contains gisin indicator when matched', () => {
    const dayMaster = Cheongan.GAP;
    const natal = dummyNatalPillars(dayMaster);
    const luckPillar = new Pillar(Cheongan.GYEONG, Jiji.SIN);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, Ohaeng.WATER, Ohaeng.METAL,
    );

    expect(result.summary).toContain('기신운');
  });
});

// =========================================================================
// Edge case: duplicate relations are suppressed
// =========================================================================
describe('LuckInteractionAnalyzer duplicate suppression', () => {
  it('duplicate branch relations are suppressed', () => {
    const dayMaster = Cheongan.GAP;
    const natal = new PillarSet(
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.GYE, Jiji.JA),  // duplicate JA
      new Pillar(dayMaster, Jiji.SUL),
      new Pillar(Cheongan.MU, Jiji.JIN),
    );
    const luckPillar = new Pillar(Cheongan.BYEONG, Jiji.O);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    const chungCount = result.branchRelations.filter(r => r === '자오충').length;
    expect(chungCount, '자오충 should appear only once despite duplicate natal JA branches').toBe(1);
  });

  it('duplicate stem relations are suppressed', () => {
    const dayMaster = Cheongan.BYEONG;
    const natal = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.IN),  // duplicate GAP
      new Pillar(dayMaster, Jiji.O),
      new Pillar(Cheongan.MU, Jiji.SUL),
    );
    const luckPillar = new Pillar(Cheongan.GI, Jiji.MI);

    const result = LuckInteractionAnalyzer.analyzeLuckPillar(
      luckPillar, natal, dayMaster, null, null,
    );

    const hapCount = result.stemRelations.filter(r => r === '갑기합').length;
    expect(hapCount, '갑기합 should appear only once despite duplicate natal GAP stems').toBe(1);
  });
});
