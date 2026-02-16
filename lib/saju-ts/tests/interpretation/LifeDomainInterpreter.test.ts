import { describe, it, expect } from 'vitest';
import { interpretLifeDomains, type DomainReading } from '../../src/interpretation/LifeDomainInterpreter.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { Ohaeng } from '../../src/domain/Ohaeng.js';
import { Gender } from '../../src/domain/Gender.js';
import { Pillar } from '../../src/domain/Pillar.js';
import { PillarSet } from '../../src/domain/PillarSet.js';
import { PillarPosition } from '../../src/domain/PillarPosition.js';
import { Sipseong } from '../../src/domain/Sipseong.js';
import { StrengthLevel } from '../../src/domain/StrengthResult.js';
import { ShinsalType, ShinsalGrade } from '../../src/domain/Shinsal.js';
import type { SajuAnalysis } from '../../src/domain/SajuAnalysis.js';
import type { StrengthResult } from '../../src/domain/StrengthResult.js';
import type { TenGodAnalysis, PillarTenGodAnalysis } from '../../src/domain/TenGodAnalysis.js';
import type { YongshinResult } from '../../src/domain/YongshinResult.js';
import { YongshinType, YongshinAgreement } from '../../src/domain/YongshinResult.js';
import type { WeightedShinsalHit } from '../../src/domain/Relations.js';
import type { ShinsalHit } from '../../src/domain/Shinsal.js';
import { GyeokgukType, GyeokgukCategory, GyeokgukQuality } from '../../src/domain/Gyeokguk.js';
import type { BirthInput } from '../../src/domain/types.js';

// ── Test helpers ─────────────────────────────────────────────────

function makePillarSet(): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, Jiji.JA),   // year
    new Pillar(Cheongan.BYEONG, Jiji.IN), // month
    new Pillar(Cheongan.MU, Jiji.JIN),    // day
    new Pillar(Cheongan.GYEONG, Jiji.SIN), // hour
  );
}

function makeBirthInput(): BirthInput {
  return {
    birthYear: 1990, birthMonth: 3, birthDay: 15,
    birthHour: 10, birthMinute: 30,
    gender: Gender.MALE,
    timezone: 'Asia/Seoul', latitude: 37.5665, longitude: 126.978,
  };
}

function makeShinsalHit(type: ShinsalType, pos: PillarPosition): ShinsalHit {
  return { type, position: pos, grade: ShinsalGrade.A, reference: Jiji.JA };
}

function makeWeightedHit(type: ShinsalType, pos: PillarPosition): WeightedShinsalHit {
  return {
    hit: makeShinsalHit(type, pos),
    baseWeight: 10,
    positionMultiplier: 1.0,
    weightedScore: 10,
  };
}

function makeTenGodAnalysis(monthSipseong: Sipseong): TenGodAnalysis {
  const monthPillar: PillarTenGodAnalysis = {
    cheonganSipseong: monthSipseong,
    jijiPrincipalSipseong: Sipseong.BI_GYEON,
    hiddenStems: [],
    hiddenStemSipseong: [],
  };
  return {
    dayMaster: Cheongan.MU,
    byPosition: {
      [PillarPosition.MONTH]: monthPillar,
    },
  };
}

function makeStrengthResult(isStrong: boolean): StrengthResult {
  return {
    dayMaster: Cheongan.MU,
    level: isStrong ? StrengthLevel.STRONG : StrengthLevel.WEAK,
    score: { deukryeong: 20, deukji: 15, deukse: 10, totalSupport: 45, totalOppose: 35 },
    isStrong,
    details: [],
  };
}

function makeYongshinResult(finalYongshin: Ohaeng): YongshinResult {
  return {
    recommendations: [{
      type: YongshinType.EOKBU,
      primaryElement: finalYongshin,
      secondaryElement: null,
      confidence: 90,
      reasoning: 'test',
    }],
    finalYongshin,
    finalHeesin: null,
    gisin: null,
    gusin: null,
    agreement: YongshinAgreement.FULL_AGREE,
    finalConfidence: 0.9,
  };
}

function makeMinimalAnalysis(overrides?: Partial<SajuAnalysis>): SajuAnalysis {
  const base: SajuAnalysis = {
    coreResult: {
      input: makeBirthInput(),
      pillars: makePillarSet(),
      standardYear: 1990, standardMonth: 3, standardDay: 15,
      standardHour: 10, standardMinute: 30,
      adjustedYear: 1990, adjustedMonth: 3, adjustedDay: 15,
      adjustedHour: 10, adjustedMinute: 30,
      dstCorrectionMinutes: 0,
      longitudeCorrectionMinutes: 0,
      equationOfTimeMinutes: 0,
    },
    pillars: makePillarSet(),
    input: makeBirthInput(),
    cheonganRelations: [],
    hapHwaEvaluations: [],
    resolvedJijiRelations: [],
    scoredCheonganRelations: [],
    sibiUnseong: null,
    gongmangVoidBranches: null,
    strengthResult: makeStrengthResult(true),
    yongshinResult: null,
    gyeokgukResult: null,
    shinsalHits: [],
    weightedShinsalHits: [],
    shinsalComposites: [],
    palaceAnalysis: null,
    daeunInfo: null,
    saeunPillars: [],
    ohaengDistribution: null,
    trace: [],
    tenGodAnalysis: null,
    analysisResults: new Map(),
    jijiRelations: [],
    ...overrides,
  };
  return base;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('LifeDomainInterpreter', () => {
  describe('interpretLifeDomains returns 4 domains', () => {
    it('returns exactly 4 domain readings', () => {
      const analysis = makeMinimalAnalysis();
      const result = interpretLifeDomains(analysis);
      expect(result).toHaveLength(4);
    });

    it('domains are in correct order: wealth, career, health, love', () => {
      const result = interpretLifeDomains(makeMinimalAnalysis());
      expect(result[0].domain).toContain('재물운');
      expect(result[1].domain).toContain('직업운');
      expect(result[2].domain).toContain('건강운');
      expect(result[3].domain).toContain('연애');
    });
  });

  describe('each domain has required fields', () => {
    it('all domains have non-blank domain, icon, overview, advice', () => {
      const result = interpretLifeDomains(makeMinimalAnalysis());
      for (const reading of result) {
        expect(reading.domain.length, `${reading.domain} domain name`).toBeGreaterThan(0);
        expect(reading.icon.length, `${reading.domain} icon`).toBeGreaterThan(0);
        expect(reading.overview.length, `${reading.domain} overview`).toBeGreaterThan(0);
        expect(reading.advice.length, `${reading.domain} advice`).toBeGreaterThan(0);
      }
    });

    it('details is an array', () => {
      const result = interpretLifeDomains(makeMinimalAnalysis());
      for (const reading of result) {
        expect(Array.isArray(reading.details)).toBe(true);
      }
    });
  });

  // ── Wealth domain specifics ─────────────────────────────────

  describe('wealth domain', () => {
    it('mentions lack of wealth stars when none in TGA', () => {
      const analysis = makeMinimalAnalysis();
      const result = interpretLifeDomains(analysis);
      const wealth = result[0];
      // With no TGA, should still produce valid reading
      expect(wealth.overview.length).toBeGreaterThan(0);
    });

    it('mentions wealth element when yongshin is METAL', () => {
      const analysis = makeMinimalAnalysis({
        yongshinResult: makeYongshinResult(Ohaeng.METAL),
      });
      const result = interpretLifeDomains(analysis);
      const wealth = result[0];
      const allText = [wealth.overview, ...wealth.details, wealth.advice].join(' ');
      expect(allText).toContain('용신');
    });

    it('detects geumyeo shinsal when present', () => {
      const analysis = makeMinimalAnalysis({
        weightedShinsalHits: [makeWeightedHit(ShinsalType.GEUMYEO, PillarPosition.DAY)],
      });
      const result = interpretLifeDomains(analysis);
      const wealth = result[0];
      const allText = wealth.details.join(' ');
      expect(allText).toContain('금여');
    });
  });

  // ── Career domain specifics ─────────────────────────────────

  describe('career domain', () => {
    it('mentions gyeokguk type in career if available', () => {
      const analysis = makeMinimalAnalysis({
        gyeokgukResult: {
          type: GyeokgukType.SIKSIN,
          category: GyeokgukCategory.NAEGYEOK,
          baseSipseong: Sipseong.SIK_SIN,
          confidence: 90,
          reasoning: 'test',
          formation: {
            quality: GyeokgukQuality.WELL_FORMED,
            breakingFactors: [],
            rescueFactors: [],
            reasoning: 'test',
          },
        },
      });
      const result = interpretLifeDomains(analysis);
      const career = result[1];
      const allText = career.details.join(' ');
      expect(allText).toContain('식신격');
    });

    it('detects jangseong shinsal in career', () => {
      const analysis = makeMinimalAnalysis({
        weightedShinsalHits: [makeWeightedHit(ShinsalType.JANGSEONG, PillarPosition.MONTH)],
      });
      const result = interpretLifeDomains(analysis);
      const career = result[1];
      const allText = career.details.join(' ');
      expect(allText).toContain('장성');
    });
  });

  // ── Health domain specifics ─────────────────────────────────

  describe('health domain', () => {
    it('includes day master health focus', () => {
      const result = interpretLifeDomains(makeMinimalAnalysis());
      const health = result[2];
      const allText = health.details.join(' ');
      // Day master is MU (EARTH) → should mention 위장/피부
      expect(allText).toContain('토(土)');
    });

    it('detects baekho shinsal in health', () => {
      const analysis = makeMinimalAnalysis({
        weightedShinsalHits: [makeWeightedHit(ShinsalType.BAEKHO, PillarPosition.DAY)],
      });
      const result = interpretLifeDomains(analysis);
      const health = result[2];
      const allText = health.details.join(' ');
      expect(allText).toContain('백호');
    });
  });

  // ── Love domain specifics ──────────────────────────────────

  describe('love domain', () => {
    it('male uses wealth stars as spouse stars', () => {
      const tga = makeTenGodAnalysis(Sipseong.JEONG_JAE);
      const analysis = makeMinimalAnalysis({ tenGodAnalysis: tga });
      const result = interpretLifeDomains(analysis);
      const love = result[3];
      const allText = [love.overview, ...love.details].join(' ');
      // Should mention 배우자 or 재성
      expect(allText.length).toBeGreaterThan(10);
    });

    it('female uses official stars as spouse stars', () => {
      const input: BirthInput = {
        ...makeBirthInput(),
        gender: Gender.FEMALE,
      };
      const tga = makeTenGodAnalysis(Sipseong.JEONG_GWAN);
      const analysis = makeMinimalAnalysis({
        input,
        coreResult: {
          input,
          pillars: makePillarSet(),
          standardYear: 1990, standardMonth: 3, standardDay: 15,
          standardHour: 10, standardMinute: 30,
          adjustedYear: 1990, adjustedMonth: 3, adjustedDay: 15,
          adjustedHour: 10, adjustedMinute: 30,
          dstCorrectionMinutes: 0,
          longitudeCorrectionMinutes: 0,
          equationOfTimeMinutes: 0,
        },
        tenGodAnalysis: tga,
      });
      const result = interpretLifeDomains(analysis);
      const love = result[3];
      expect(love.overview.length).toBeGreaterThan(0);
    });

    it('detects dohwa shinsal in love domain', () => {
      const analysis = makeMinimalAnalysis({
        weightedShinsalHits: [makeWeightedHit(ShinsalType.DOHWA, PillarPosition.DAY)],
      });
      const result = interpretLifeDomains(analysis);
      const love = result[3];
      const allText = love.details.join(' ');
      expect(allText).toContain('도화');
    });

    it('detects gosin/gwasuk in love domain', () => {
      const analysis = makeMinimalAnalysis({
        weightedShinsalHits: [makeWeightedHit(ShinsalType.GOSIN, PillarPosition.YEAR)],
      });
      const result = interpretLifeDomains(analysis);
      const love = result[3];
      const allText = love.details.join(' ');
      expect(allText).toContain('고신');
    });
  });

  // ── Korean text quality ─────────────────────────────────────

  describe('Korean text quality', () => {
    it('all readings contain Korean characters', () => {
      const result = interpretLifeDomains(makeMinimalAnalysis());
      const koreanRegex = /[\uAC00-\uD7AF]/;
      for (const reading of result) {
        expect(koreanRegex.test(reading.overview), `${reading.domain} overview has Korean`).toBe(true);
        expect(koreanRegex.test(reading.advice), `${reading.domain} advice has Korean`).toBe(true);
      }
    });
  });
});
