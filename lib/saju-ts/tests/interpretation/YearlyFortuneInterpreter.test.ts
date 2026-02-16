import { describe, it, expect } from 'vitest';
import {
  buildYearlyFortune,
  yearlyFortuneToNarrative,
  type YearlyFortune,
  type MonthlyHighlight,
} from '../../src/interpretation/YearlyFortuneInterpreter.js';
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
import { LuckQuality } from '../../src/domain/LuckInteraction.js';
import { YongshinType, YongshinAgreement } from '../../src/domain/YongshinResult.js';
import type { LuckPillarAnalysis } from '../../src/domain/LuckInteraction.js';
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
    sibiUnseong: null,
    gongmangVoidBranches: null,
    strengthResult: {
      dayMaster: Cheongan.MU,
      level: StrengthLevel.STRONG,
      score: { deukryeong: 20, deukji: 15, deukse: 10, totalSupport: 45, totalOppose: 35 },
      isStrong: true,
      details: [],
    },
    yongshinResult: {
      recommendations: [{
        type: YongshinType.EOKBU,
        primaryElement: Ohaeng.WATER,
        secondaryElement: null,
        confidence: 90,
        reasoning: 'test',
      }],
      finalYongshin: Ohaeng.WATER,
      finalHeesin: null,
      gisin: Ohaeng.FIRE,
      gusin: null,
      agreement: YongshinAgreement.FULL_AGREE,
      finalConfidence: 0.9,
    },
    gyeokgukResult: null,
    shinsalHits: [],
    weightedShinsalHits: [],
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
    ohaengDistribution: null,
    trace: [],
    tenGodAnalysis: null,
    analysisResults: new Map(),
    jijiRelations: [],
    ...overrides,
  };
}

function makeLPA(overrides?: Partial<LuckPillarAnalysis>): LuckPillarAnalysis {
  return {
    pillar: new Pillar(Cheongan.GAP, Jiji.JA),
    sipseong: Sipseong.JEONG_JAE,
    sibiUnseong: SibiUnseong.GEON_ROK,
    isYongshinElement: false,
    isGisinElement: false,
    stemRelations: [],
    branchRelations: [],
    quality: LuckQuality.FAVORABLE,
    summary: 'test',
    ...overrides,
  };
}

function makeMonthlyAnalyses(): Array<{ sajuMonthIndex: number; pillar: Pillar; analysis: LuckPillarAnalysis }> {
  const qualities = [
    LuckQuality.VERY_FAVORABLE, LuckQuality.FAVORABLE, LuckQuality.NEUTRAL,
    LuckQuality.UNFAVORABLE, LuckQuality.VERY_UNFAVORABLE, LuckQuality.NEUTRAL,
    LuckQuality.FAVORABLE, LuckQuality.VERY_FAVORABLE, LuckQuality.NEUTRAL,
    LuckQuality.NEUTRAL, LuckQuality.UNFAVORABLE, LuckQuality.NEUTRAL,
  ];
  return qualities.map((quality, i) => ({
    sajuMonthIndex: i + 1,
    pillar: new Pillar(Cheongan.GAP, Jiji.IN),
    analysis: makeLPA({ quality }),
  }));
}

// ── Tests ──────────────────────────────────────────────────────────

describe('YearlyFortuneInterpreter', () => {
  describe('buildYearlyFortune', () => {
    it('builds a valid YearlyFortune with all fields', () => {
      const analysis = makeMinimalAnalysis();
      const saeunPillar = new Pillar(Cheongan.GAP, Jiji.JA);
      const lpa = makeLPA();
      const monthly = makeMonthlyAnalyses();

      const fortune = buildYearlyFortune(analysis, 2025, saeunPillar, lpa, monthly);

      expect(fortune.targetYear).toBe(2025);
      expect(fortune.saeunPillar).toBe(saeunPillar);
      expect(fortune.quality).toBe(LuckQuality.FAVORABLE);
      expect(fortune.sipseong).toBe(Sipseong.JEONG_JAE);
      expect(fortune.overview.length).toBeGreaterThan(0);
      expect(fortune.wealthForecast.length).toBeGreaterThan(0);
      expect(fortune.careerForecast.length).toBeGreaterThan(0);
      expect(fortune.healthForecast.length).toBeGreaterThan(0);
      expect(fortune.loveForecast.length).toBeGreaterThan(0);
    });

    it('produces correct number of monthly highlights', () => {
      const fortune = buildYearlyFortune(
        makeMinimalAnalysis(), 2025,
        new Pillar(Cheongan.GAP, Jiji.JA),
        makeLPA(),
        makeMonthlyAnalyses(),
      );
      expect(fortune.monthlyHighlights).toHaveLength(12);
    });

    it('bestMonths includes favorable and very_favorable', () => {
      const fortune = buildYearlyFortune(
        makeMinimalAnalysis(), 2025,
        new Pillar(Cheongan.GAP, Jiji.JA),
        makeLPA(),
        makeMonthlyAnalyses(),
      );
      expect(fortune.bestMonths.length).toBeGreaterThan(0);
    });

    it('cautionMonths includes unfavorable and very_unfavorable', () => {
      const fortune = buildYearlyFortune(
        makeMinimalAnalysis(), 2025,
        new Pillar(Cheongan.GAP, Jiji.JA),
        makeLPA(),
        makeMonthlyAnalyses(),
      );
      expect(fortune.cautionMonths.length).toBeGreaterThan(0);
    });

    it('overview mentions the target year', () => {
      const fortune = buildYearlyFortune(
        makeMinimalAnalysis(), 2025,
        new Pillar(Cheongan.GAP, Jiji.JA),
        makeLPA(),
        makeMonthlyAnalyses(),
      );
      expect(fortune.overview).toContain('2025');
    });

    it('overview mentions yongshin alignment when isYongshinElement is true', () => {
      const fortune = buildYearlyFortune(
        makeMinimalAnalysis(), 2025,
        new Pillar(Cheongan.GAP, Jiji.JA),
        makeLPA({ isYongshinElement: true }),
        makeMonthlyAnalyses(),
      );
      expect(fortune.overview).toContain('용신');
    });

    it('overview mentions gisin warning when isGisinElement is true', () => {
      const fortune = buildYearlyFortune(
        makeMinimalAnalysis(), 2025,
        new Pillar(Cheongan.GAP, Jiji.JA),
        makeLPA({ isGisinElement: true }),
        makeMonthlyAnalyses(),
      );
      expect(fortune.overview).toContain('기신');
    });

    it('overview mentions current daeun when available', () => {
      const fortune = buildYearlyFortune(
        makeMinimalAnalysis(), 2010, // age=20 → daeun[1] (15-24)
        new Pillar(Cheongan.GAP, Jiji.JA),
        makeLPA(),
        makeMonthlyAnalyses(),
      );
      expect(fortune.overview).toContain('대운');
    });
  });

  // ── Sipseong-specific forecasts ─────────────────────────────

  describe('sipseong-specific forecast variations', () => {
    const sipseongValues = Object.values(Sipseong);

    it('all 10 sipseong produce non-empty wealth forecast', () => {
      for (const sip of sipseongValues) {
        const fortune = buildYearlyFortune(
          makeMinimalAnalysis(), 2025,
          new Pillar(Cheongan.GAP, Jiji.JA),
          makeLPA({ sipseong: sip }),
          makeMonthlyAnalyses(),
        );
        expect(fortune.wealthForecast.length, `${sip} wealth`).toBeGreaterThan(0);
      }
    });

    it('all 10 sipseong produce non-empty career forecast', () => {
      for (const sip of sipseongValues) {
        const fortune = buildYearlyFortune(
          makeMinimalAnalysis(), 2025,
          new Pillar(Cheongan.GAP, Jiji.JA),
          makeLPA({ sipseong: sip }),
          makeMonthlyAnalyses(),
        );
        expect(fortune.careerForecast.length, `${sip} career`).toBeGreaterThan(0);
      }
    });

    it('all 10 sipseong produce non-empty love forecast', () => {
      for (const sip of sipseongValues) {
        const fortune = buildYearlyFortune(
          makeMinimalAnalysis(), 2025,
          new Pillar(Cheongan.GAP, Jiji.JA),
          makeLPA({ sipseong: sip }),
          makeMonthlyAnalyses(),
        );
        expect(fortune.loveForecast.length, `${sip} love`).toBeGreaterThan(0);
      }
    });
  });

  // ── yearlyFortuneToNarrative ────────────────────────────────

  describe('yearlyFortuneToNarrative', () => {
    function buildTestFortune(): YearlyFortune {
      return buildYearlyFortune(
        makeMinimalAnalysis(), 2025,
        new Pillar(Cheongan.GAP, Jiji.JA),
        makeLPA(),
        makeMonthlyAnalyses(),
      );
    }

    it('produces non-empty narrative string', () => {
      const narrative = yearlyFortuneToNarrative(buildTestFortune());
      expect(narrative.length).toBeGreaterThan(100);
    });

    it('includes year in title', () => {
      const narrative = yearlyFortuneToNarrative(buildTestFortune());
      expect(narrative).toContain('2025');
    });

    it('includes section headers', () => {
      const narrative = yearlyFortuneToNarrative(buildTestFortune());
      expect(narrative).toContain('재물운');
      expect(narrative).toContain('직업운');
      expect(narrative).toContain('건강운');
      expect(narrative).toContain('연애운');
    });

    it('includes monthly highlights section', () => {
      const narrative = yearlyFortuneToNarrative(buildTestFortune());
      expect(narrative).toContain('월별 운세 하이라이트');
    });

    it('includes best/caution months when present', () => {
      const narrative = yearlyFortuneToNarrative(buildTestFortune());
      expect(narrative).toContain('기회 시기');
      expect(narrative).toContain('주의 시기');
    });

    it('contains Korean characters throughout', () => {
      const narrative = yearlyFortuneToNarrative(buildTestFortune());
      const koreanRegex = /[\uAC00-\uD7AF]/;
      // Check multiple sections have Korean
      const lines = narrative.split('\n').filter(l => l.trim().length > 0);
      const koreanLines = lines.filter(l => koreanRegex.test(l));
      expect(koreanLines.length).toBeGreaterThan(lines.length / 2);
    });

    it('includes quality icons for monthly highlights', () => {
      const narrative = yearlyFortuneToNarrative(buildTestFortune());
      // Should contain at least one of the quality icons
      const hasQualityIcon = narrative.includes('\u25CE') || narrative.includes('\u25CB') ||
        narrative.includes('\u25B3') || narrative.includes('\u25CF') || narrative.includes('\u2715');
      expect(hasQualityIcon).toBe(true);
    });
  });

  // ── Health forecast SibiUnseong variations ──────────────────

  describe('health forecast with different sibi unseong', () => {
    const unseongValues = Object.values(SibiUnseong);

    it('all 12 sibi unseong produce non-empty health forecast', () => {
      for (const su of unseongValues) {
        const fortune = buildYearlyFortune(
          makeMinimalAnalysis(), 2025,
          new Pillar(Cheongan.GAP, Jiji.JA),
          makeLPA({ sibiUnseong: su }),
          makeMonthlyAnalyses(),
        );
        expect(fortune.healthForecast.length, `${su} health`).toBeGreaterThan(0);
      }
    });
  });
});
