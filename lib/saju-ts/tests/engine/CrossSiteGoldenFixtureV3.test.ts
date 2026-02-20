import { describe, it, expect } from 'vitest';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { CHEONGAN_INFO } from '../../src/domain/Cheongan.js';
import { JIJI_INFO } from '../../src/domain/Jiji.js';
import { ANALYSIS_KEYS } from '../../src/domain/SajuAnalysis.js';
import type { Pillar } from '../../src/domain/Pillar.js';

/**
 * Cross-site golden fixture V3 tests.
 * Ported from Kotlin CrossSiteGoldenFixtureV3Test.kt.
 *
 * V3 adds provenance, comparison contract, luck requirements,
 * luck narrative expectations, and relation score expectations.
 * Test data is embedded inline (originally from cross_site_golden_cases_v3.json).
 */

const config = createConfig({
  includeEquationOfTime: false,
  applyDstHistory: true,
});

function legacyLabel(pillar: Pillar): string {
  const ci = CHEONGAN_INFO[pillar.cheongan];
  const ji = JIJI_INFO[pillar.jiji];
  return `${ci.hangul}${ci.hanja} / ${ji.hangul}${ji.hanja}`;
}

// =========================================================================
// Embedded V3 fixture data
// =========================================================================

interface V3GoldenCase {
  readonly caseId: string;
  readonly site: string;
  readonly caseType: string;
  readonly date: string;
  readonly time: string;
  readonly gender: Gender;
  readonly longitude: number;
  readonly expected: {
    readonly year: string;
    readonly month: string;
    readonly day: string;
    readonly hour: string;
  };
  readonly palaceRequired: boolean;
  readonly shinsalMinHits: number;
  readonly luckRequirements: {
    readonly daeunRequired: boolean;
    readonly saeunMinYears: number;
  };
  readonly luckNarrativeExpectations: {
    readonly required: boolean;
    readonly minDaeunNarratives: number;
    readonly minSaeunNarratives: number;
    readonly requiredTextFields: string[];
  };
  readonly relationScoreExpectations: {
    readonly required: boolean;
    readonly resolvedJijiMinCount: number;
    readonly scoredCheonganMinCount: number;
    readonly scoreRange: { min: number; max: number };
  };
}

const v3Cases: V3GoldenCase[] = [
  {
    caseId: 'V3-FT-01',
    site: 'forceteller.com',
    caseType: 'pillar_golden',
    date: '1986-04-19', time: '05:45',
    gender: Gender.MALE, longitude: 126.978,
    expected: {
      year: '병丙 / 인寅',
      month: '임壬 / 진辰',
      day: '계癸 / 사巳',
      hour: '을乙 / 묘卯',
    },
    palaceRequired: true,
    shinsalMinHits: 3,
    luckRequirements: { daeunRequired: true, saeunMinYears: 6 },
    luckNarrativeExpectations: {
      required: true,
      minDaeunNarratives: 1,
      minSaeunNarratives: 6,
      requiredTextFields: ['whySummary'],
    },
    relationScoreExpectations: {
      required: true,
      resolvedJijiMinCount: 0,
      scoredCheonganMinCount: 0,
      scoreRange: { min: -100, max: 100 },
    },
  },
  {
    caseId: 'V3-FT-02',
    site: 'forceteller.com',
    caseType: 'pillar_golden',
    date: '1989-01-10', time: '01:30',
    gender: Gender.MALE, longitude: 126.978,
    expected: {
      year: '무戊 / 진辰',
      month: '을乙 / 축丑',
      day: '경庚 / 오午',
      hour: '병丙 / 자子',
    },
    palaceRequired: true,
    shinsalMinHits: 3,
    luckRequirements: { daeunRequired: true, saeunMinYears: 6 },
    luckNarrativeExpectations: {
      required: true,
      minDaeunNarratives: 1,
      minSaeunNarratives: 6,
      requiredTextFields: ['whySummary'],
    },
    relationScoreExpectations: {
      required: true,
      resolvedJijiMinCount: 0,
      scoredCheonganMinCount: 0,
      scoreRange: { min: -100, max: 100 },
    },
  },
  {
    caseId: 'V3-FT-03',
    site: 'forceteller.com',
    caseType: 'pillar_golden',
    date: '1990-06-15', time: '12:00',
    gender: Gender.MALE, longitude: 126.978,
    expected: {
      year: '경庚 / 오午',
      month: '임壬 / 오午',
      day: '신辛 / 해亥',
      hour: '갑甲 / 오午',
    },
    palaceRequired: true,
    shinsalMinHits: 3,
    luckRequirements: { daeunRequired: true, saeunMinYears: 6 },
    luckNarrativeExpectations: {
      required: true,
      minDaeunNarratives: 1,
      minSaeunNarratives: 6,
      requiredTextFields: ['whySummary'],
    },
    relationScoreExpectations: {
      required: true,
      resolvedJijiMinCount: 0,
      scoredCheonganMinCount: 0,
      scoreRange: { min: -100, max: 100 },
    },
  },
  {
    caseId: 'V3-FT-04',
    site: 'forceteller.com',
    caseType: 'pillar_golden',
    date: '2000-01-01', time: '00:00',
    gender: Gender.FEMALE, longitude: 126.978,
    expected: {
      year: '기己 / 묘卯',
      month: '병丙 / 자子',
      day: '무戊 / 오午',
      hour: '임壬 / 자子',
    },
    palaceRequired: true,
    shinsalMinHits: 2,
    luckRequirements: { daeunRequired: true, saeunMinYears: 6 },
    luckNarrativeExpectations: {
      required: true,
      minDaeunNarratives: 1,
      minSaeunNarratives: 6,
      requiredTextFields: ['whySummary'],
    },
    relationScoreExpectations: {
      required: true,
      resolvedJijiMinCount: 0,
      scoredCheonganMinCount: 0,
      scoreRange: { min: -100, max: 100 },
    },
  },
  {
    caseId: 'V3-FT-05',
    site: 'forceteller.com',
    caseType: 'pillar_golden',
    date: '1988-07-15', time: '14:30',
    gender: Gender.MALE, longitude: 126.978,
    expected: {
      year: '무戊 / 진辰',
      month: '기己 / 미未',
      day: '신辛 / 미未',
      hour: '갑甲 / 오午',
    },
    palaceRequired: true,
    shinsalMinHits: 3,
    luckRequirements: { daeunRequired: true, saeunMinYears: 6 },
    luckNarrativeExpectations: {
      required: true,
      minDaeunNarratives: 1,
      minSaeunNarratives: 6,
      requiredTextFields: ['whySummary'],
    },
    relationScoreExpectations: {
      required: true,
      resolvedJijiMinCount: 0,
      scoredCheonganMinCount: 0,
      scoreRange: { min: -100, max: 100 },
    },
  },
];

describe('CrossSiteGoldenFixtureV3Test', () => {

  describe('forceteller golden cases in V3 match pillars', () => {
    for (const fc of v3Cases) {
      it(`${fc.caseId}: pillars match`, () => {
        const [y, m, d] = fc.date.split('-').map(Number) as [number, number, number];
        const [h, min] = fc.time.split(':').map(Number) as [number, number];
        const input = createBirthInput({
          birthYear: y, birthMonth: m, birthDay: d,
          birthHour: h, birthMinute: min,
          gender: fc.gender, longitude: fc.longitude,
        });
        const result = calculatePillars(input, config);
        expect(legacyLabel(result.pillars.year)).toBe(fc.expected.year);
        expect(legacyLabel(result.pillars.month)).toBe(fc.expected.month);
        expect(legacyLabel(result.pillars.day)).toBe(fc.expected.day);
        expect(legacyLabel(result.pillars.hour)).toBe(fc.expected.hour);
      });
    }
  });

  describe('analysis requirements', () => {
    for (const fc of v3Cases) {
      it(`${fc.caseId}: palace and shinsal`, () => {
        const [y, m, d] = fc.date.split('-').map(Number) as [number, number, number];
        const [h, min] = fc.time.split(':').map(Number) as [number, number];
        const input = createBirthInput({
          birthYear: y, birthMonth: m, birthDay: d,
          birthHour: h, birthMinute: min,
          gender: fc.gender, longitude: fc.longitude,
        });
        const analysis = analyzeSaju(input, config);

        if (fc.palaceRequired) {
          expect(analysis.palaceAnalysis).not.toBeNull();
          expect(analysis.analysisResults.has(ANALYSIS_KEYS.PALACE)).toBe(true);
        }
        expect(analysis.shinsalHits.length).toBeGreaterThanOrEqual(fc.shinsalMinHits);
        expect(analysis.analysisResults.has(ANALYSIS_KEYS.WEIGHTED_SHINSAL)).toBe(true);
        expect(analysis.analysisResults.has(ANALYSIS_KEYS.SHINSAL_COMPOSITES)).toBe(true);
      });
    }
  });

  describe('luck requirements', () => {
    for (const fc of v3Cases) {
      it(`${fc.caseId}: daeun and saeun`, () => {
        const [y, m, d] = fc.date.split('-').map(Number) as [number, number, number];
        const [h, min] = fc.time.split(':').map(Number) as [number, number];
        const input = createBirthInput({
          birthYear: y, birthMonth: m, birthDay: d,
          birthHour: h, birthMinute: min,
          gender: fc.gender, longitude: fc.longitude,
        });
        const analysis = analyzeSaju(input, config);

        if (fc.luckRequirements.daeunRequired) {
          expect(analysis.daeunInfo).not.toBeNull();
        }
        expect(analysis.saeunPillars.length).toBeGreaterThanOrEqual(
          fc.luckRequirements.saeunMinYears,
        );
      });
    }
  });

  describe('relation score expectations', () => {
    for (const fc of v3Cases) {
      if (!fc.relationScoreExpectations.required) continue;
      it(`${fc.caseId}: relation scores within range`, () => {
        const [y, m, d] = fc.date.split('-').map(Number) as [number, number, number];
        const [h, min] = fc.time.split(':').map(Number) as [number, number];
        const input = createBirthInput({
          birthYear: y, birthMonth: m, birthDay: d,
          birthHour: h, birthMinute: min,
          gender: fc.gender, longitude: fc.longitude,
        });
        const analysis = analyzeSaju(input, config);
        const { resolvedJijiMinCount, scoredCheonganMinCount, scoreRange } =
          fc.relationScoreExpectations;

        expect(analysis.resolvedJijiRelations.length).toBeGreaterThanOrEqual(
          resolvedJijiMinCount,
        );
        expect(analysis.scoredCheonganRelations.length).toBeGreaterThanOrEqual(
          scoredCheonganMinCount,
        );

        for (const resolved of analysis.resolvedJijiRelations) {
          if (resolved.score) {
            expect(resolved.score.finalScore).toBeGreaterThanOrEqual(scoreRange.min);
            expect(resolved.score.finalScore).toBeLessThanOrEqual(scoreRange.max);
          }
        }

        for (const scored of analysis.scoredCheonganRelations) {
          expect(scored.score.finalScore).toBeGreaterThanOrEqual(scoreRange.min);
          expect(scored.score.finalScore).toBeLessThanOrEqual(scoreRange.max);
        }
      });
    }
  });

  it('V3 fixture has at least 5 golden cases', () => {
    expect(v3Cases.length).toBeGreaterThanOrEqual(5);
  });

  it('all V3 cases have required fields', () => {
    for (const fc of v3Cases) {
      expect(fc.caseId).toBeDefined();
      expect(fc.site).toBeDefined();
      expect(fc.expected).toBeDefined();
      expect(fc.luckRequirements).toBeDefined();
      expect(fc.luckNarrativeExpectations).toBeDefined();
      expect(fc.relationScoreExpectations).toBeDefined();
      expect(fc.luckRequirements.daeunRequired).toBe(true);
      expect(fc.luckRequirements.saeunMinYears).toBeGreaterThanOrEqual(6);
      expect(fc.luckNarrativeExpectations.required).toBe(true);
      expect(fc.luckNarrativeExpectations.minDaeunNarratives).toBeGreaterThanOrEqual(1);
      expect(fc.luckNarrativeExpectations.minSaeunNarratives).toBeGreaterThanOrEqual(6);
      expect(fc.luckNarrativeExpectations.requiredTextFields.length).toBeGreaterThan(0);
    }
  });
});
