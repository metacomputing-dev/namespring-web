import { describe, it, expect } from 'vitest';
import {
  NarrativeEngine,
  narrativeToFullReport,
  generate,
  type SajuNarrative,
} from '../../src/interpretation/NarrativeEngine.js';
import { DEFAULT_CONFIG } from '../../src/config/CalculationConfig.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { Ohaeng } from '../../src/domain/Ohaeng.js';
import { Gender } from '../../src/domain/Gender.js';
import { Pillar } from '../../src/domain/Pillar.js';
import { PillarSet } from '../../src/domain/PillarSet.js';
import { PillarPosition } from '../../src/domain/PillarPosition.js';
import { Sipseong } from '../../src/domain/Sipseong.js';
import { SibiUnseong } from '../../src/domain/SibiUnseong.js';
import { StrengthLevel } from '../../src/domain/StrengthResult.js';
import { YongshinType, YongshinAgreement } from '../../src/domain/YongshinResult.js';
import { GyeokgukType, GyeokgukCategory, GyeokgukQuality } from '../../src/domain/Gyeokguk.js';
import { ShinsalType, ShinsalGrade } from '../../src/domain/Shinsal.js';
import type { SajuAnalysis } from '../../src/domain/SajuAnalysis.js';
import type { BirthInput } from '../../src/domain/types.js';

// ── Fixture helpers ──────────────────────────────────────────────

function makePillarSet(): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, Jiji.JA),
    new Pillar(Cheongan.BYEONG, Jiji.IN),
    new Pillar(Cheongan.MU, Jiji.JIN),
    new Pillar(Cheongan.GYEONG, Jiji.SIN),
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

function makeMinimalAnalysis(overrides?: Partial<SajuAnalysis>): SajuAnalysis {
  return {
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
    sibiUnseong: new Map<PillarPosition, SibiUnseong>([
      [PillarPosition.YEAR, SibiUnseong.JANG_SAENG],
      [PillarPosition.MONTH, SibiUnseong.GEON_ROK],
      [PillarPosition.DAY, SibiUnseong.JE_WANG],
      [PillarPosition.HOUR, SibiUnseong.SWOE],
    ]),
    gongmangVoidBranches: null,
    strengthResult: {
      dayMaster: Cheongan.MU,
      level: StrengthLevel.STRONG,
      score: { deukryeong: 20, deukji: 15, deukse: 10, totalSupport: 45, totalOppose: 35 },
      isStrong: true,
      details: ['득령: 월지 인(寅) — 토 득령 약함'],
    },
    yongshinResult: {
      recommendations: [{
        type: YongshinType.EOKBU,
        primaryElement: Ohaeng.WATER,
        secondaryElement: null,
        confidence: 90,
        reasoning: '신강한 일간을 억제하기 위해 수(水)가 용신',
      }],
      finalYongshin: Ohaeng.WATER,
      finalHeesin: Ohaeng.METAL,
      gisin: Ohaeng.FIRE,
      gusin: null,
      agreement: YongshinAgreement.FULL_AGREE,
      finalConfidence: 0.9,
    },
    gyeokgukResult: {
      type: GyeokgukType.GEONROK,
      category: GyeokgukCategory.NAEGYEOK,
      baseSipseong: Sipseong.BI_GYEON,
      confidence: 90,
      reasoning: '건록격 — 월지에 비견 투출',
      formation: {
        quality: GyeokgukQuality.WELL_FORMED,
        breakingFactors: [],
        rescueFactors: [],
        reasoning: '성격',
      },
    },
    shinsalHits: [{
      type: ShinsalType.CHEONUL_GWIIN,
      position: PillarPosition.DAY,
      grade: ShinsalGrade.A,
      reference: Jiji.JIN,
    }],
    weightedShinsalHits: [{
      hit: {
        type: ShinsalType.CHEONUL_GWIIN,
        position: PillarPosition.DAY,
        grade: ShinsalGrade.A,
        reference: Jiji.JIN,
      },
      baseWeight: 10,
      positionMultiplier: 1.5,
      weightedScore: 15,
    }],
    shinsalComposites: [],
    palaceAnalysis: null,
    daeunInfo: {
      isForward: true,
      firstDaeunStartAge: 5,
      firstDaeunStartMonths: 60,
      daeunPillars: [
        { pillar: new Pillar(Cheongan.JEONG, Jiji.MYO), startAge: 5, endAge: 14, order: 1 },
        { pillar: new Pillar(Cheongan.MU, Jiji.JIN), startAge: 15, endAge: 24, order: 2 },
      ],
      boundaryMode: 'EXACT_TABLE' as never,
      warnings: [],
    },
    saeunPillars: [],
    ohaengDistribution: new Map<Ohaeng, number>([
      [Ohaeng.WOOD, 2],
      [Ohaeng.FIRE, 1],
      [Ohaeng.EARTH, 3],
      [Ohaeng.METAL, 1],
      [Ohaeng.WATER, 1],
    ]),
    trace: [
      { key: 'pillar.year', summary: '년주 계산: 갑자(甲子)', evidence: ['입춘 기준'], citations: [], reasoning: ['1990년 3월 → 경오(庚午)년'], confidence: null },
      { key: 'pillar.month', summary: '월주 계산: 병인(丙寅)', evidence: ['절기 기준'], citations: [], reasoning: ['경칩 이전'], confidence: null },
      { key: 'strength', summary: '신강/신약 판정: 신강', evidence: ['득령 20점'], citations: ['적천수'], reasoning: ['지지 토 세력 강함'], confidence: 90 },
    ],
    tenGodAnalysis: {
      dayMaster: Cheongan.MU,
      byPosition: {
        [PillarPosition.YEAR]: {
          cheonganSipseong: Sipseong.PYEON_IN,
          jijiPrincipalSipseong: Sipseong.JEONG_JAE,
          hiddenStems: [],
          hiddenStemSipseong: [],
        },
        [PillarPosition.MONTH]: {
          cheonganSipseong: Sipseong.PYEON_IN,
          jijiPrincipalSipseong: Sipseong.PYEON_GWAN,
          hiddenStems: [],
          hiddenStemSipseong: [],
        },
        [PillarPosition.HOUR]: {
          cheonganSipseong: Sipseong.PYEON_JAE,
          jijiPrincipalSipseong: Sipseong.PYEON_JAE,
          hiddenStems: [],
          hiddenStemSipseong: [],
        },
      },
    },
    analysisResults: new Map(),
    jijiRelations: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('NarrativeEngine', () => {
  describe('module exports', () => {
    it('NarrativeEngine object has generate and narrativeToFullReport', () => {
      expect(typeof NarrativeEngine.generate).toBe('function');
      expect(typeof NarrativeEngine.narrativeToFullReport).toBe('function');
    });

    it('standalone generate and narrativeToFullReport are functions', () => {
      expect(typeof generate).toBe('function');
      expect(typeof narrativeToFullReport).toBe('function');
    });
  });

  describe('generate returns SajuNarrative with all sections', () => {
    it('produces non-empty narrative with minimal analysis', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative).toBeDefined();
    });

    it('overview is non-empty', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.overview.length).toBeGreaterThan(0);
    });

    it('ohaengDistribution is non-empty when distribution exists', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.ohaengDistribution.length).toBeGreaterThan(0);
    });

    it('coreCharacteristics is non-empty', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.coreCharacteristics.length).toBeGreaterThan(0);
    });

    it('yongshinGuidance is non-empty when yongshin exists', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.yongshinGuidance.length).toBeGreaterThan(0);
    });

    it('pillarInterpretations has entries', () => {
      const narrative = generate(makeMinimalAnalysis());
      // Should have at least some content for pillar positions
      const allPillarText = Object.values(narrative.pillarInterpretations).join('');
      expect(allPillarText.length).toBeGreaterThan(0);
    });

    it('lifeDomainAnalysis is non-empty', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.lifeDomainAnalysis.length).toBeGreaterThan(0);
    });

    it('overallAssessment is non-empty', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.overallAssessment.length).toBeGreaterThan(0);
    });

    it('luckCycleOverview is non-empty when daeun exists', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.luckCycleOverview.length).toBeGreaterThan(0);
    });

    it('calculationReasoning is non-empty with trace', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.calculationReasoning.length).toBeGreaterThan(0);
    });

    it('sourceBibliography is non-empty', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.sourceBibliography.length).toBeGreaterThan(0);
    });

    it('schoolLabel is non-empty', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.schoolLabel.length).toBeGreaterThan(0);
    });
  });

  // ── Korean text quality ─────────────────────────────────────

  describe('Korean text quality', () => {
    it('all major sections contain Korean characters', () => {
      const narrative = generate(makeMinimalAnalysis());
      const koreanRegex = /[\uAC00-\uD7AF]/;
      expect(koreanRegex.test(narrative.overview), 'overview has Korean').toBe(true);
      expect(koreanRegex.test(narrative.coreCharacteristics), 'coreCharacteristics has Korean').toBe(true);
      expect(koreanRegex.test(narrative.yongshinGuidance), 'yongshinGuidance has Korean').toBe(true);
      expect(koreanRegex.test(narrative.lifeDomainAnalysis), 'lifeDomainAnalysis has Korean').toBe(true);
      expect(koreanRegex.test(narrative.overallAssessment), 'overallAssessment has Korean').toBe(true);
    });
  });

  // ── narrativeToFullReport ───────────────────────────────────

  describe('narrativeToFullReport', () => {
    it('produces a long non-empty string', () => {
      const narrative = generate(makeMinimalAnalysis());
      const report = narrativeToFullReport(narrative);
      expect(report.length).toBeGreaterThan(200);
    });

    it('includes major sections in order', () => {
      const narrative = generate(makeMinimalAnalysis());
      const report = narrativeToFullReport(narrative);

      // Should contain content from multiple sections
      expect(report).toContain(narrative.overview.substring(0, 20));
    });

    it('is a string type', () => {
      const narrative = generate(makeMinimalAnalysis());
      const report = narrativeToFullReport(narrative);
      expect(typeof report).toBe('string');
    });
  });

  // ── Null/minimal field handling ─────────────────────────────

  describe('graceful handling of null fields', () => {
    it('works with no strength result', () => {
      const narrative = generate(makeMinimalAnalysis({ strengthResult: null }));
      expect(narrative.overview.length).toBeGreaterThan(0);
    });

    it('works with no yongshin result', () => {
      const narrative = generate(makeMinimalAnalysis({ yongshinResult: null }));
      expect(narrative.overview.length).toBeGreaterThan(0);
    });

    it('works with no gyeokguk result', () => {
      const narrative = generate(makeMinimalAnalysis({ gyeokgukResult: null }));
      expect(narrative.overview.length).toBeGreaterThan(0);
    });

    it('works with no daeun info', () => {
      const narrative = generate(makeMinimalAnalysis({ daeunInfo: null }));
      expect(narrative.overview.length).toBeGreaterThan(0);
    });

    it('works with no tenGodAnalysis', () => {
      const narrative = generate(makeMinimalAnalysis({ tenGodAnalysis: null }));
      expect(narrative.overview.length).toBeGreaterThan(0);
    });

    it('works with no ohaengDistribution', () => {
      const narrative = generate(makeMinimalAnalysis({ ohaengDistribution: null }));
      expect(narrative.overview.length).toBeGreaterThan(0);
    });

    it('works with empty trace', () => {
      const narrative = generate(makeMinimalAnalysis({ trace: [] }));
      expect(narrative.overview.length).toBeGreaterThan(0);
    });

    it('works with no shinsal hits', () => {
      const narrative = generate(makeMinimalAnalysis({
        shinsalHits: [],
        weightedShinsalHits: [],
      }));
      expect(narrative.overview.length).toBeGreaterThan(0);
    });

    it('works with completely minimal analysis (all nullable fields null)', () => {
      const narrative = generate(makeMinimalAnalysis({
        strengthResult: null,
        yongshinResult: null,
        gyeokgukResult: null,
        daeunInfo: null,
        tenGodAnalysis: null,
        ohaengDistribution: null,
        sibiUnseong: null,
        palaceAnalysis: null,
        shinsalHits: [],
        weightedShinsalHits: [],
        shinsalComposites: [],
        trace: [],
      }));
      expect(narrative.overview.length).toBeGreaterThan(0);
      expect(narrative.overallAssessment.length).toBeGreaterThan(0);
    });
  });

  // ── Config handling ─────────────────────────────────────────

  describe('config parameter', () => {
    it('accepts default config', () => {
      const narrative = generate(makeMinimalAnalysis(), DEFAULT_CONFIG);
      expect(narrative.schoolLabel.length).toBeGreaterThan(0);
    });

    it('NarrativeEngine.generate matches standalone generate', () => {
      const analysis = makeMinimalAnalysis();
      const n1 = generate(analysis, DEFAULT_CONFIG);
      const n2 = NarrativeEngine.generate(analysis, DEFAULT_CONFIG);
      expect(n1.overview).toBe(n2.overview);
      expect(n1.schoolLabel).toBe(n2.schoolLabel);
    });
  });
});
