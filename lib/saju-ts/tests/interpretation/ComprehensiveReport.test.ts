import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import {
  generate,
  narrativeToFullReport,
} from '../../src/interpretation/NarrativeEngine.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';

/**
 * CC-14: Comprehensive report engine verification.
 *
 * Verifies the NarrativeEngine's ohaeng distribution and overall assessment
 * sections, plus the overall report quality (length, section ordering, etc.).
 */
describe('ComprehensiveReport', () => {

  const case1 = analyzeSaju(createBirthInput({
    birthYear: 1986, birthMonth: 4, birthDay: 19,
    birthHour: 5, birthMinute: 45,
    gender: Gender.MALE,
    longitude: 126.978,
  }));

  const case2 = analyzeSaju(createBirthInput({
    birthYear: 1989, birthMonth: 1, birthDay: 10,
    birthHour: 1, birthMinute: 30,
    gender: Gender.MALE,
    longitude: 126.978,
  }));

  const narrative1 = generate(case1);
  const narrative2 = generate(case2);

  // -- Ohaeng distribution section --

  describe('ohaeng distribution section', () => {
    it('contains header', () => {
      expect(narrative1.ohaengDistribution).toContain('오행(五行) 분포');
    });

    it('contains all five elements', () => {
      expect(narrative1.ohaengDistribution).toContain('목(木)');
      expect(narrative1.ohaengDistribution).toContain('화(火)');
      expect(narrative1.ohaengDistribution).toContain('토(土)');
      expect(narrative1.ohaengDistribution).toContain('금(金)');
      expect(narrative1.ohaengDistribution).toContain('수(水)');
    });

    it('contains visual bars', () => {
      const hasVisual = narrative1.ohaengDistribution.includes('\u25CF') ||
                        narrative1.ohaengDistribution.includes('\u25CB');
      expect(hasVisual).toBe(true);
    });

    it('contains /8) count format', () => {
      expect(narrative1.ohaengDistribution).toContain('/8)');
    });

    it('contains yin-yang balance', () => {
      expect(narrative1.ohaengDistribution).toContain('음양:');
    });

    it('shows excess or deficiency analysis', () => {
      const text = narrative1.ohaengDistribution;
      const hasAnalysis = text.includes('과다') ||
                          text.includes('부재') ||
                          text.includes('부족') ||
                          !text.includes('\u25CF\u25CF\u25CF'); // no element has 3+
      expect(hasAnalysis).toBe(true);
    });
  });

  // -- Overall assessment section --

  describe('overall assessment section', () => {
    it('contains header', () => {
      expect(narrative1.overallAssessment).toContain('종합 판단');
    });

    it('contains day master element reference', () => {
      const text = narrative1.overallAssessment;
      const hasDayMaster = text.includes('목') || text.includes('화') ||
                           text.includes('토') || text.includes('금') || text.includes('수');
      expect(hasDayMaster).toBe(true);
    });

    it('contains strength level', () => {
      const text = narrative1.overallAssessment;
      const hasStrength = text.includes('신강') || text.includes('신약') ||
                          text.includes('중강') || text.includes('중약') ||
                          text.includes('극신강') || text.includes('극신약');
      expect(hasStrength).toBe(true);
    });

    it('contains yongshin direction', () => {
      expect(narrative1.overallAssessment).toContain('용신');
    });

    it('contains ilju reference when present', () => {
      // TS SajuAnalysis does not have iljuInterpretation field;
      // instead check that the overall assessment mentions day pillar
      expect(narrative1.overallAssessment).toContain('일주');
    });
  });

  // -- Full report quality --

  describe('full report quality', () => {
    it('report exceeds 2000 characters (case 1)', () => {
      const report = narrativeToFullReport(narrative1);
      expect(report.length).toBeGreaterThan(2000);
    });

    it('report exceeds 2000 characters (case 2)', () => {
      const report = narrativeToFullReport(narrative2);
      expect(report.length).toBeGreaterThan(2000);
    });

    it('contains all major sections', () => {
      const report = narrativeToFullReport(narrative1);

      expect(report).toContain('사주 원국 개요');
      expect(report).toContain('오행(五行) 분포');
      expect(report).toContain('핵심 성향 분석');
      expect(report).toContain('용신(用神) 안내');
      expect(report).toContain('특수 요소');
      expect(report).toContain('종합 판단');
      expect(report).toContain('대운(大運) 흐름');
    });

    it('sections appear in correct order', () => {
      const report = narrativeToFullReport(narrative1);

      // Use full section headers with ■ prefix to avoid false matches
      // within body text of other sections
      const overviewIdx = report.indexOf('\u25A0 사주 원국 개요');
      const ohaengIdx = report.indexOf('\u25A0 오행(五行) 분포');
      const coreIdx = report.indexOf('\u25A0 핵심 성향 분석');
      const yongshinIdx = report.indexOf('\u25A0 용신(用神) 안내');
      const specialIdx = report.indexOf('\u25A0 특수 요소');
      const assessmentIdx = report.indexOf('\u25A0 종합 판단');
      const luckIdx = report.indexOf('\u25A0 대운(大運) 흐름');

      expect(overviewIdx).toBeLessThan(ohaengIdx);
      expect(ohaengIdx).toBeLessThan(coreIdx);
      expect(coreIdx).toBeLessThan(yongshinIdx);
      expect(yongshinIdx).toBeLessThan(specialIdx);
      expect(specialIdx).toBeLessThan(assessmentIdx);
      expect(assessmentIdx).toBeLessThan(luckIdx);
    });
  });

  // -- Minimal input resilience --

  describe('minimal input resilience', () => {
    it('ohaeng distribution works with minimal analysis', () => {
      // Create a minimal analysis that has coreResult only (other fields null/empty)
      const minimal: typeof case1 = {
        ...case1,
        strengthResult: null,
        yongshinResult: null,
        gyeokgukResult: null,
        daeunInfo: null,
        tenGodAnalysis: null,
        shinsalHits: [],
        weightedShinsalHits: [],
        shinsalComposites: [],
        trace: [],
      };
      const narrative = generate(minimal);
      expect(narrative.ohaengDistribution).toContain('오행(五行) 분포');
    });

    it('overall assessment works with minimal analysis', () => {
      const minimal: typeof case1 = {
        ...case1,
        strengthResult: null,
        yongshinResult: null,
        gyeokgukResult: null,
        daeunInfo: null,
        tenGodAnalysis: null,
        shinsalHits: [],
        weightedShinsalHits: [],
        shinsalComposites: [],
        trace: [],
      };
      const narrative = generate(minimal);
      expect(narrative.overallAssessment).toContain('종합 판단');
    });
  });
});
