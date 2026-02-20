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

function currentKoreanYear(): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).formatToParts(new Date());
  const yearStr = parts.find(part => part.type === 'year')?.value ?? '0';
  return Number.parseInt(yearStr, 10);
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

    it('readableSummary is non-empty', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.readableSummary.length).toBeGreaterThan(0);
      expect(narrative.readableSummary).toContain('핵심 브리핑');
      expect(narrative.readableSummary).toContain('일생 흐름 요약');
      expect(narrative.readableSummary).toContain('현재 시점 운세');
      expect(narrative.readableSummary).toContain('맞춤 실행 플랜');
      expect(narrative.readableSummary).toContain('관심사별 운세');
      expect(narrative.readableSummary).toContain('판정 요약');
      expect(narrative.readableSummary).toContain('본문 핵심 캡처');
      expect(narrative.readableSummary).toContain('생활 영역 핵심');
      expect(narrative.readableSummary).toContain('실행 가이드 5가지');
    });

    it('readableSummary does not include truncated ellipsis marker', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.readableSummary).not.toContain('…');
      expect(narrative.readableSummary).not.toContain('...');
      expect(narrative.readableSummary).not.toContain('쉬운 말 핵심');
    });

    it('readableSummary risk phrase reflects low gisin exposure instead of fixed warning text', () => {
      const narrative = generate(makeMinimalAnalysis({
        yongshinResult: {
          recommendations: [{
            type: YongshinType.EOKBU,
            primaryElement: Ohaeng.FIRE,
            secondaryElement: null,
            confidence: 88,
            reasoning: '신약 일간 보완',
          }],
          finalYongshin: Ohaeng.FIRE,
          finalHeesin: Ohaeng.WOOD,
          gisin: Ohaeng.WATER,
          gusin: null,
          agreement: YongshinAgreement.DISAGREE,
          finalConfidence: 0.7,
        },
        ohaengDistribution: new Map<Ohaeng, number>([
          [Ohaeng.WOOD, 3],
          [Ohaeng.FIRE, 2],
          [Ohaeng.EARTH, 2],
          [Ohaeng.METAL, 1],
          [Ohaeng.WATER, 0],
        ]),
      }));
      expect(narrative.readableSummary).toContain('원국 노출이 낮아');
      expect(narrative.readableSummary).not.toContain('강해지거나 생활 리듬이 깨질 때');
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

    it('coreCharacteristics avoids weak-assertion wording when assertive ten-god signals are strong', () => {
      const narrative = generate(makeMinimalAnalysis({
        strengthResult: {
          dayMaster: Cheongan.MU,
          level: StrengthLevel.VERY_WEAK,
          score: { deukryeong: 0, deukji: 2, deukse: 1, totalSupport: 3, totalOppose: 70 },
          isStrong: false,
          details: [],
        },
        tenGodAnalysis: {
          dayMaster: Cheongan.MU,
          byPosition: {
            [PillarPosition.YEAR]: {
              cheonganSipseong: Sipseong.BI_GYEON,
              jijiPrincipalSipseong: Sipseong.SANG_GWAN,
              hiddenStems: [],
              hiddenStemSipseong: [],
            },
            [PillarPosition.MONTH]: {
              cheonganSipseong: Sipseong.GYEOB_JAE,
              jijiPrincipalSipseong: Sipseong.SIK_SIN,
              hiddenStems: [],
              hiddenStemSipseong: [],
            },
            [PillarPosition.DAY]: {
              cheonganSipseong: Sipseong.BI_GYEON,
              jijiPrincipalSipseong: Sipseong.PYEON_GWAN,
              hiddenStems: [],
              hiddenStemSipseong: [],
            },
            [PillarPosition.HOUR]: {
              cheonganSipseong: Sipseong.SANG_GWAN,
              jijiPrincipalSipseong: Sipseong.JEONG_JAE,
              hiddenStems: [],
              hiddenStemSipseong: [],
            },
          },
        },
      }));
      expect(narrative.coreCharacteristics).toContain('자기 기준과 표현 욕구는 분명하지만');
      expect(narrative.coreCharacteristics).not.toContain('자기 주장이 약함');
    });

    it('does not recommend unconditional supplementation for scarce gisin element', () => {
      const narrative = generate(makeMinimalAnalysis({
        yongshinResult: {
          recommendations: [{
            type: YongshinType.EOKBU,
            primaryElement: Ohaeng.FIRE,
            secondaryElement: null,
            confidence: 90,
            reasoning: '보완',
          }],
          finalYongshin: Ohaeng.FIRE,
          finalHeesin: Ohaeng.WOOD,
          gisin: Ohaeng.WATER,
          gusin: null,
          agreement: YongshinAgreement.FULL_AGREE,
          finalConfidence: 0.9,
        },
        ohaengDistribution: new Map<Ohaeng, number>([
          [Ohaeng.WOOD, 3],
          [Ohaeng.FIRE, 2],
          [Ohaeng.EARTH, 2],
          [Ohaeng.METAL, 1],
          [Ohaeng.WATER, 0],
        ]),
      }));

      expect(narrative.ohaengDistribution).toContain('주의: 수(水) — 기신 축이므로 과한 증강보다 균형 관리가 중요합니다.');
      expect(narrative.ohaengDistribution).not.toContain('수(水) — 1개뿐이므로 점진 보완이 도움이 됩니다.');
    });

    it('health section uses gisin-aware guidance wording', () => {
      const narrative = generate(makeMinimalAnalysis({
        yongshinResult: {
          recommendations: [{
            type: YongshinType.EOKBU,
            primaryElement: Ohaeng.FIRE,
            secondaryElement: null,
            confidence: 90,
            reasoning: '보완',
          }],
          finalYongshin: Ohaeng.FIRE,
          finalHeesin: Ohaeng.WOOD,
          gisin: Ohaeng.WATER,
          gusin: null,
          agreement: YongshinAgreement.FULL_AGREE,
          finalConfidence: 0.9,
        },
        ohaengDistribution: new Map<Ohaeng, number>([
          [Ohaeng.WOOD, 2],
          [Ohaeng.FIRE, 2],
          [Ohaeng.EARTH, 3],
          [Ohaeng.METAL, 1],
          [Ohaeng.WATER, 0],
        ]),
      }));

      expect(narrative.lifeDomainAnalysis).toContain('기신 오행(수(水))은 과도한 증강보다 변동 시기 점검이 안전합니다.');
      expect(narrative.lifeDomainAnalysis).not.toContain('용신 오행을 보강하는 음식·색상·계절 활동이 건강 유지에 도움이 됩니다.');
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

    it('default yearly fortune targets current Korean year when target year is omitted', () => {
      const narrative = generate(makeMinimalAnalysis());
      expect(narrative.yearlyFortuneNarrative).toContain(`${currentKoreanYear()}`);
      expect(narrative.readableSummary).toContain('현재 연도(');
      expect(narrative.readableSummary).toContain('현재 월(');
      expect(narrative.readableSummary).toContain('오늘 운세(');
      expect(narrative.readableSummary).toContain('오늘 행동 포인트');
      expect(narrative.readableSummary).toContain('총운:');
      expect(narrative.readableSummary).toContain('재물운:');
      expect(narrative.readableSummary).toContain('연애운:');
      expect(narrative.readableSummary).toContain('가족/주거운:');
      expect(narrative.readableSummary).toContain('자녀/후배운:');
      expect(narrative.readableSummary).toContain('이직/변화운:');
      expect(narrative.readableSummary).toContain('법률/분쟁운:');
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
      expect(koreanRegex.test(narrative.readableSummary), 'readableSummary has Korean').toBe(true);
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
      expect(report).toContain('한눈에 보는 핵심 요약');
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
