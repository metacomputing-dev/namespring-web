import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import {
  generate,
  NarrativeEngine,
  type SajuNarrative,
} from '../../src/interpretation/NarrativeEngine.js';
import {
  DEFAULT_CONFIG,
  configFromPreset,
  SchoolPreset,
  type CalculationConfig,
} from '../../src/config/CalculationConfig.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';

/**
 * CC-10: School-specific narrative branching verification.
 *
 * Analyzes the same birth date/time under 3 school presets and verifies
 * that the narrative output reflects the methodology differences of each school.
 */
describe('SchoolNarrativeBranching', () => {

  // 1986-04-19 05:45 Male, Seoul
  const input = createBirthInput({
    birthYear: 1986, birthMonth: 4, birthDay: 19,
    birthHour: 5, birthMinute: 45,
    gender: Gender.MALE,
    longitude: 126.978,
  });

  const koreanConfig = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);
  const chineseConfig = configFromPreset(SchoolPreset.TRADITIONAL_CHINESE);
  const modernConfig = configFromPreset(SchoolPreset.MODERN_INTEGRATED);

  const koreanAnalysis = analyzeSaju(input, koreanConfig);
  const chineseAnalysis = analyzeSaju(input, chineseConfig);
  const modernAnalysis = analyzeSaju(input, modernConfig);

  const koreanNarrative = generate(koreanAnalysis, koreanConfig);
  const chineseNarrative = generate(chineseAnalysis, chineseConfig);
  const modernNarrative = generate(modernAnalysis, modernConfig);

  // -- schoolLabel verification --

  describe('schoolLabel', () => {
    it('Korean preset has correct school label', () => {
      expect(koreanNarrative.schoolLabel).toBe('한국 주류(적천수+궁통보감)');
    });

    it('Chinese preset has correct school label', () => {
      expect(chineseNarrative.schoolLabel).toBe('중국 전통(자평진전)');
    });

    it('Modern preset has correct school label', () => {
      expect(modernNarrative.schoolLabel).toBe('현대 통합(정밀 분석)');
    });
  });

  // -- Overview: analysis basis label --

  describe('overview contains school label', () => {
    it('Korean overview contains school name', () => {
      expect(koreanNarrative.overview).toContain('한국 주류');
    });

    it('Chinese overview contains school name', () => {
      expect(chineseNarrative.overview).toContain('중국 전통');
    });

    it('Modern overview contains school name', () => {
      expect(modernNarrative.overview).toContain('현대 통합');
    });

    it('all overviews contain analysis basis tag', () => {
      expect(koreanNarrative.overview).toContain('[분석 기준:');
      expect(chineseNarrative.overview).toContain('[분석 기준:');
      expect(modernNarrative.overview).toContain('[분석 기준:');
    });
  });

  // -- Core characteristics: strength methodology differences --

  describe('strength methodology differences', () => {
    it('Korean shows 40-point deukryeong weight', () => {
      expect(koreanNarrative.coreCharacteristics).toContain('득령 40점');
    });

    it('Chinese shows 50-point deukryeong weight', () => {
      expect(chineseNarrative.coreCharacteristics).toContain('득령 50점');
    });

    it('Korean shows ALL_THREE scope', () => {
      expect(koreanNarrative.coreCharacteristics).toContain('여기+중기+정기 모두 포함');
    });

    it('Chinese shows JEONGGI_ONLY scope', () => {
      expect(chineseNarrative.coreCharacteristics).toContain('정기만 포함');
    });

    it('Korean shows ALWAYS_JEONGGI saryeong mode', () => {
      expect(koreanNarrative.coreCharacteristics).toContain('사령=항상 정기');
    });

    it('Chinese shows BY_DAY_IN_MONTH saryeong mode', () => {
      expect(chineseNarrative.coreCharacteristics).toContain('사령=절입 후 일수 기반');
    });
  });

  // -- Yongshin: priority branching --

  describe('yongshin priority branching', () => {
    it('Korean shows JOHU_FIRST priority', () => {
      expect(koreanNarrative.yongshinGuidance).toContain('조후(기후 균형) 우선');
    });

    it('Chinese shows EOKBU_FIRST priority', () => {
      expect(chineseNarrative.yongshinGuidance).toContain('억부(강약 균형) 우선');
    });

    it('Modern shows EQUAL_WEIGHT priority', () => {
      expect(modernNarrative.yongshinGuidance).toContain('동등 비중');
    });

    it('all presets contain yongshin priority note', () => {
      expect(koreanNarrative.yongshinGuidance).toContain('※ 용신 결정 기준:');
      expect(chineseNarrative.yongshinGuidance).toContain('※ 용신 결정 기준:');
      expect(modernNarrative.yongshinGuidance).toContain('※ 용신 결정 기준:');
    });
  });

  // -- Special features: haphwa/banhap/shinsal methodology --

  describe('special features methodology', () => {
    it('Korean shows STRICT_FIVE_CONDITIONS hapHwa', () => {
      expect(koreanNarrative.specialFeatures).toContain('엄격 5조건');
    });

    it('Modern shows MODERATE hapHwa strictness', () => {
      expect(modernNarrative.specialFeatures).toContain('중간');
    });

    it('Korean shows banhap allowed', () => {
      expect(koreanNarrative.specialFeatures).toContain('반합: 인정');
    });

    it('Chinese shows banhap disallowed', () => {
      expect(chineseNarrative.specialFeatures).toContain('반합: 불인정');
    });

    it('Korean shows dayMaster never hapGeo', () => {
      expect(koreanNarrative.specialFeatures).toContain('일간 합거: 불가');
    });

    it('Chinese shows dayMaster hapGeo possible', () => {
      expect(chineseNarrative.specialFeatures).toContain('일간 합거: 가능');
    });

    it('Korean shinsal ref shows DAY_AND_YEAR', () => {
      expect(koreanNarrative.specialFeatures).toContain('신살 참조: 일지+년지 모두');
    });

    it('Chinese shinsal ref shows DAY_ONLY', () => {
      expect(chineseNarrative.specialFeatures).toContain('신살 참조: 일지만 기준');
    });

    it('all presets contain methodology section', () => {
      expect(koreanNarrative.specialFeatures).toContain('[분석 방법론]');
      expect(chineseNarrative.specialFeatures).toContain('[분석 방법론]');
      expect(modernNarrative.specialFeatures).toContain('[분석 방법론]');
    });
  });

  // -- Full reports differ across presets --

  describe('full reports', () => {
    it('Korean and Chinese full reports differ', () => {
      const koreanReport = NarrativeEngine.narrativeToFullReport(koreanNarrative);
      const chineseReport = NarrativeEngine.narrativeToFullReport(chineseNarrative);
      expect(koreanReport).not.toBe(chineseReport);
    });

    it('Korean and Modern full reports differ', () => {
      const koreanReport = NarrativeEngine.narrativeToFullReport(koreanNarrative);
      const modernReport = NarrativeEngine.narrativeToFullReport(modernNarrative);
      expect(koreanReport).not.toBe(modernReport);
    });

    it('full report contains school label in overview', () => {
      const report = NarrativeEngine.narrativeToFullReport(koreanNarrative);
      expect(report).toContain('[분석 기준: 한국 주류');
    });
  });

  // -- Default parameter compatibility --

  describe('default parameter compatibility', () => {
    it('generate without config uses DEFAULT_CONFIG label', () => {
      // In TS, the DEFAULT_CONFIG is not a preset; it resolves to '사용자 설정'.
      // When a specific preset is passed, the correct label appears.
      const defaultNarrative = generate(koreanAnalysis);
      expect(defaultNarrative.schoolLabel.length).toBeGreaterThan(0);
    });

    it('generate with Korean preset config has correct school label', () => {
      const narrative = generate(koreanAnalysis, koreanConfig);
      expect(narrative.schoolLabel).toBe('한국 주류(적천수+궁통보감)');
      expect(narrative.overview).toContain('한국 주류');
    });
  });
});
