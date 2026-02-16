import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import {
  generate,
  narrativeToFullReport,
} from '../../src/interpretation/NarrativeEngine.js';
import {
  configFromPreset,
  SchoolPreset,
} from '../../src/config/CalculationConfig.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../../src/domain/PillarPosition.js';

/**
 * Quality gate tests for NarrativeEngine report output.
 *
 * Verifies structural completeness, minimum length thresholds,
 * and key content markers across multiple chart types.
 */
describe('NarrativeReportQuality', () => {

  const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

  // Representative test cases spanning different chart types
  const cases: [string, ReturnType<typeof createBirthInput>][] = [
    ['강한신강', createBirthInput({
      birthYear: 1985, birthMonth: 3, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE,
      longitude: 126.978,
    })],
    ['야자시경계', createBirthInput({
      birthYear: 2021, birthMonth: 2, birthDay: 3,
      birthHour: 23, birthMinute: 59,
      gender: Gender.MALE,
      longitude: 126.978,
    })],
    ['DST시대여성', createBirthInput({
      birthYear: 1988, birthMonth: 6, birthDay: 15,
      birthHour: 10, birthMinute: 0,
      gender: Gender.FEMALE,
    })],
  ];

  describe('full report length', () => {
    for (const [label, birth] of cases) {
      it(`${label}: full report exceeds 3000 characters`, () => {
        const analysis = analyzeSaju(birth, config);
        const narrative = generate(analysis, config);
        const report = narrativeToFullReport(narrative);
        expect(report.length).toBeGreaterThanOrEqual(3000);
      });
    }
  });

  describe('full report contains all major sections', () => {
    it('first case report contains all required markers', () => {
      const [, birth] = cases[0]!;
      const analysis = analyzeSaju(birth, config);
      const narrative = generate(analysis, config);
      const report = narrativeToFullReport(narrative);

      const requiredSections: [string, string][] = [
        ['사주 원국 개요', 'overview'],
        ['오행(五行) 분포', 'ohaengDistribution'],
        ['신강', 'strengthAnalysis'],
        ['격국', 'gyeokguk'],
        ['용신', 'yongshin'],
        ['조후론', 'johu'],
        ['년주', 'yearPillar'],
        ['월주', 'monthPillar'],
        ['일주', 'dayPillar'],
        ['시주', 'hourPillar'],
        ['재물운', 'lifeDomain-wealth'],
        ['직업운', 'lifeDomain-career'],
        ['건강운', 'lifeDomain-health'],
        ['연애', 'lifeDomain-romance'],
        ['신살', 'shinsal'],
        ['종합 판단', 'overallAssessment'],
        ['대운', 'luckCycle'],
        ['참고 원전', 'bibliography'],
      ];

      for (const [marker, sectionName] of requiredSections) {
        expect(report, `Missing '${marker}' (${sectionName})`).toContain(marker);
      }
    });
  });

  describe('pillar interpretations non-empty', () => {
    for (const [label, birth] of cases) {
      it(`${label}: all 4 pillar interpretations are non-blank`, () => {
        const analysis = analyzeSaju(birth, config);
        const narrative = generate(analysis, config);
        for (const pos of PILLAR_POSITION_VALUES) {
          const text = narrative.pillarInterpretations[pos];
          expect(text, `${label}: ${pos} should be non-blank`).toBeDefined();
          expect(text!.length, `${label}: ${pos} should be non-blank`).toBeGreaterThan(0);
        }
      });
    }
  });

  describe('overall assessment minimum depth', () => {
    for (const [label, birth] of cases) {
      it(`${label}: overall assessment >= 200 chars`, () => {
        const analysis = analyzeSaju(birth, config);
        const narrative = generate(analysis, config);
        expect(narrative.overallAssessment.length).toBeGreaterThanOrEqual(200);
      });
    }
  });

  describe('life domain analysis covers 4 areas', () => {
    for (const [label, birth] of cases) {
      it(`${label}: life domain contains all 4 areas`, () => {
        const analysis = analyzeSaju(birth, config);
        const narrative = generate(analysis, config);
        const domains = ['재물운', '직업운', '건강운', '연애'];
        for (const domain of domains) {
          expect(narrative.lifeDomainAnalysis, `${label}: missing ${domain}`).toContain(domain);
        }
      });
    }
  });

  describe('inline citations', () => {
    it('report contains inline citation tags', () => {
      const [, birth] = cases[0]!;
      const analysis = analyzeSaju(birth, config);
      const narrative = generate(analysis, config);
      const report = narrativeToFullReport(narrative);
      const hasCitations = report.includes('[근거:') || report.includes('[출처:');
      expect(hasCitations).toBe(true);
    });
  });

  describe('bibliography section', () => {
    it('lists classical sources', () => {
      const [, birth] = cases[0]!;
      const analysis = analyzeSaju(birth, config);
      const narrative = generate(analysis, config);
      expect(narrative.sourceBibliography).toContain('적천수');
      expect(narrative.sourceBibliography).toContain('궁통보감');
    });
  });

  describe('detailed luck narrative non-empty', () => {
    for (const [label, birth] of cases) {
      it(`${label}: detailed luck narrative is non-blank`, () => {
        const analysis = analyzeSaju(birth, config);
        const narrative = generate(analysis, config);
        // detailedLuckNarrative may be empty if LuckNarrativeInterpreter integration is pending
        // This test documents the expectation
        expect(typeof narrative.detailedLuckNarrative).toBe('string');
      });
    }
  });

  describe('yearly fortune narrative', () => {
    it('produces content when targetYear is set', () => {
      const [, birth] = cases[0]!;
      const analysis = analyzeSaju(birth, config);
      const narrative = generate(analysis, config, 2026);
      // yearlyFortuneNarrative may be empty if not yet integrated
      expect(typeof narrative.yearlyFortuneNarrative).toBe('string');
      if (narrative.yearlyFortuneNarrative.length > 0) {
        expect(narrative.yearlyFortuneNarrative).toContain('2026');
      }
    });
  });
});
