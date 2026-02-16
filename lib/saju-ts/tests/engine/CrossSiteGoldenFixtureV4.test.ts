import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import {
  createConfig,
  configFromPreset,
  SchoolPreset,
} from '../../src/config/CalculationConfig.js';
import { ANALYSIS_KEYS } from '../../src/domain/SajuAnalysis.js';

/**
 * Cross-site golden fixture V4 tests.
 * Ported from Kotlin CrossSiteGoldenFixtureV4Test.kt.
 *
 * V4 adds school preset contract: each golden case must produce valid
 * analysis under all three school presets, with required analysis keys
 * and trace keys present. Additionally, expected_tokens must match for
 * the forceteller baseline config.
 */

const forcetellerBaselineConfig = createConfig({
  includeEquationOfTime: false,
  applyDstHistory: true,
});

// =========================================================================
// Embedded V4 fixture data
// =========================================================================

interface V4GoldenCase {
  readonly caseId: string;
  readonly site: string;
  readonly caseType: 'pillar_golden' | 'boundary_profile';
  readonly date: string;
  readonly time: string;
  readonly gender: Gender;
  readonly longitude: number;
  readonly palaceRequired: boolean;
  readonly shinsalMinHits: number;
  readonly luckRequirements: {
    readonly daeunRequired: boolean;
    readonly saeunMinYears: number;
  };
  readonly relationScoreExpectations: {
    readonly required: boolean;
    readonly resolvedJijiMinCount: number;
    readonly scoredCheonganMinCount: number;
    readonly scoreRange: { min: number; max: number };
  };
  readonly schoolExpectations: {
    readonly required: boolean;
    readonly presets: SchoolPreset[];
    readonly requiredAnalysisKeys: string[];
    readonly requiredTraceKeys: string[];
  };
  /** Only present for pillar_golden cases. */
  readonly expectedTokens?: {
    readonly year: string;
    readonly month: string;
    readonly day: string;
    readonly hour: string;
  };
}

const REQUIRED_ANALYSIS_KEYS = [
  ANALYSIS_KEYS.STRENGTH,
  ANALYSIS_KEYS.YONGSHIN,
  ANALYSIS_KEYS.GYEOKGUK,
  ANALYSIS_KEYS.SIBI_UNSEONG,
  ANALYSIS_KEYS.GONGMANG,
  ANALYSIS_KEYS.PALACE,
  ANALYSIS_KEYS.DAEUN,
  ANALYSIS_KEYS.SAEUN,
  ANALYSIS_KEYS.RESOLVED_JIJI,
  ANALYSIS_KEYS.SCORED_CHEONGAN,
  ANALYSIS_KEYS.WEIGHTED_SHINSAL,
  ANALYSIS_KEYS.SHINSAL_COMPOSITES,
];

const REQUIRED_TRACE_KEYS = [
  'core', 'strength', 'gyeokguk', 'yongshin', 'daeun', 'saeun',
];

const ALL_PRESETS = [
  SchoolPreset.KOREAN_MAINSTREAM,
  SchoolPreset.TRADITIONAL_CHINESE,
  SchoolPreset.MODERN_INTEGRATED,
];

const v4Cases: V4GoldenCase[] = [
  {
    caseId: 'V4-FT-01',
    site: 'forceteller.com',
    caseType: 'pillar_golden',
    date: '1986-04-19', time: '05:45',
    gender: Gender.MALE, longitude: 126.978,
    palaceRequired: true,
    shinsalMinHits: 3,
    luckRequirements: { daeunRequired: true, saeunMinYears: 6 },
    relationScoreExpectations: {
      required: true,
      resolvedJijiMinCount: 0,
      scoredCheonganMinCount: 0,
      scoreRange: { min: -100, max: 100 },
    },
    schoolExpectations: {
      required: true,
      presets: ALL_PRESETS,
      requiredAnalysisKeys: REQUIRED_ANALYSIS_KEYS,
      requiredTraceKeys: REQUIRED_TRACE_KEYS,
    },
    expectedTokens: {
      year: 'BYEONG_IN',
      month: 'IM_JIN',
      day: 'GYE_SA',
      hour: 'EUL_MYO',
    },
  },
  {
    caseId: 'V4-FT-02',
    site: 'forceteller.com',
    caseType: 'pillar_golden',
    date: '1989-01-10', time: '01:30',
    gender: Gender.MALE, longitude: 126.978,
    palaceRequired: true,
    shinsalMinHits: 3,
    luckRequirements: { daeunRequired: true, saeunMinYears: 6 },
    relationScoreExpectations: {
      required: true,
      resolvedJijiMinCount: 0,
      scoredCheonganMinCount: 0,
      scoreRange: { min: -100, max: 100 },
    },
    schoolExpectations: {
      required: true,
      presets: ALL_PRESETS,
      requiredAnalysisKeys: REQUIRED_ANALYSIS_KEYS,
      requiredTraceKeys: REQUIRED_TRACE_KEYS,
    },
    expectedTokens: {
      year: 'MU_JIN',
      month: 'EUL_CHUK',
      day: 'GYEONG_O',
      hour: 'BYEONG_JA',
    },
  },
  {
    caseId: 'V4-FT-03',
    site: 'forceteller.com',
    caseType: 'pillar_golden',
    date: '1990-06-15', time: '12:00',
    gender: Gender.MALE, longitude: 126.978,
    palaceRequired: true,
    shinsalMinHits: 3,
    luckRequirements: { daeunRequired: true, saeunMinYears: 6 },
    relationScoreExpectations: {
      required: true,
      resolvedJijiMinCount: 0,
      scoredCheonganMinCount: 0,
      scoreRange: { min: -100, max: 100 },
    },
    schoolExpectations: {
      required: true,
      presets: ALL_PRESETS,
      requiredAnalysisKeys: REQUIRED_ANALYSIS_KEYS,
      requiredTraceKeys: REQUIRED_TRACE_KEYS,
    },
    expectedTokens: {
      year: 'GYEONG_O',
      month: 'IM_O',
      day: 'SIN_HAE',
      hour: 'GAP_O',
    },
  },
  {
    caseId: 'V4-FT-04',
    site: 'forceteller.com',
    caseType: 'pillar_golden',
    date: '2000-01-01', time: '00:00',
    gender: Gender.FEMALE, longitude: 126.978,
    palaceRequired: true,
    shinsalMinHits: 2,
    luckRequirements: { daeunRequired: true, saeunMinYears: 6 },
    relationScoreExpectations: {
      required: true,
      resolvedJijiMinCount: 0,
      scoredCheonganMinCount: 0,
      scoreRange: { min: -100, max: 100 },
    },
    schoolExpectations: {
      required: true,
      presets: ALL_PRESETS,
      requiredAnalysisKeys: REQUIRED_ANALYSIS_KEYS,
      requiredTraceKeys: REQUIRED_TRACE_KEYS,
    },
    expectedTokens: {
      year: 'GI_MYO',
      month: 'BYEONG_JA',
      day: 'MU_O',
      hour: 'IM_JA',
    },
  },
  {
    caseId: 'V4-FT-05',
    site: 'forceteller.com',
    caseType: 'pillar_golden',
    date: '1988-07-15', time: '14:30',
    gender: Gender.MALE, longitude: 126.978,
    palaceRequired: true,
    shinsalMinHits: 3,
    luckRequirements: { daeunRequired: true, saeunMinYears: 6 },
    relationScoreExpectations: {
      required: true,
      resolvedJijiMinCount: 0,
      scoredCheonganMinCount: 0,
      scoreRange: { min: -100, max: 100 },
    },
    schoolExpectations: {
      required: true,
      presets: ALL_PRESETS,
      requiredAnalysisKeys: REQUIRED_ANALYSIS_KEYS,
      requiredTraceKeys: REQUIRED_TRACE_KEYS,
    },
    expectedTokens: {
      year: 'MU_JIN',
      month: 'GI_MI',
      day: 'SIN_MI',
      hour: 'GAP_O',
    },
  },
];

function tokenOf(p: import('../../src/domain/Pillar.js').Pillar): string {
  return `${p.cheongan}_${p.jiji}`;
}

describe('CrossSiteGoldenFixtureV4Test', () => {

  it('fixture V4 has school presets', () => {
    expect(ALL_PRESETS).toContain(SchoolPreset.KOREAN_MAINSTREAM);
    expect(ALL_PRESETS).toContain(SchoolPreset.TRADITIONAL_CHINESE);
    expect(ALL_PRESETS).toContain(SchoolPreset.MODERN_INTEGRATED);
  });

  describe('golden cases satisfy school expectation contract', () => {
    for (const fc of v4Cases) {
      if (!fc.schoolExpectations.required) continue;

      for (const presetName of fc.schoolExpectations.presets) {
        it(`${fc.caseId}/${presetName}: analysis keys present`, () => {
          const [y, m, d] = fc.date.split('-').map(Number) as [number, number, number];
          const [h, min] = fc.time.split(':').map(Number) as [number, number];
          const input = createBirthInput({
            birthYear: y, birthMonth: m, birthDay: d,
            birthHour: h, birthMinute: min,
            gender: fc.gender, longitude: fc.longitude,
          });
          const presetConfig = configFromPreset(presetName);
          const analysis = analyzeSaju(input, presetConfig);

          // Required analysis keys
          for (const key of fc.schoolExpectations.requiredAnalysisKeys) {
            expect(analysis.analysisResults.has(key)).toBe(true);
          }

          // Required trace keys
          const traceKeySet = new Set(analysis.trace.map(t => t.key));
          for (const key of fc.schoolExpectations.requiredTraceKeys) {
            expect(traceKeySet.has(key)).toBe(true);
          }
        });
      }
    }
  });

  describe('required cases satisfy analysis expectation contract', () => {
    for (const fc of v4Cases) {
      if (!fc.schoolExpectations.required) continue;

      for (const presetName of fc.schoolExpectations.presets) {
        it(`${fc.caseId}/${presetName}: analysis expectations met`, () => {
          const [y, m, d] = fc.date.split('-').map(Number) as [number, number, number];
          const [h, min] = fc.time.split(':').map(Number) as [number, number];
          const input = createBirthInput({
            birthYear: y, birthMonth: m, birthDay: d,
            birthHour: h, birthMinute: min,
            gender: fc.gender, longitude: fc.longitude,
          });
          const presetConfig = configFromPreset(presetName);
          const analysis = analyzeSaju(input, presetConfig);

          // Palace
          if (fc.palaceRequired) {
            expect(analysis.palaceAnalysis).not.toBeNull();
          }

          // Shinsal
          expect(analysis.shinsalHits.length).toBeGreaterThanOrEqual(fc.shinsalMinHits);

          // Luck
          if (fc.luckRequirements.daeunRequired) {
            expect(analysis.daeunInfo).not.toBeNull();
          }
          expect(analysis.saeunPillars.length).toBeGreaterThanOrEqual(
            fc.luckRequirements.saeunMinYears,
          );

          // Relation scores
          if (fc.relationScoreExpectations.required) {
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
                expect(resolved.score.baseScore).toBeGreaterThanOrEqual(scoreRange.min);
                expect(resolved.score.baseScore).toBeLessThanOrEqual(scoreRange.max);
                expect(resolved.score.rationale.length).toBeGreaterThan(0);
              }
            }

            for (const scored of analysis.scoredCheonganRelations) {
              expect(scored.score.finalScore).toBeGreaterThanOrEqual(scoreRange.min);
              expect(scored.score.finalScore).toBeLessThanOrEqual(scoreRange.max);
              expect(scored.score.baseScore).toBeGreaterThanOrEqual(scoreRange.min);
              expect(scored.score.baseScore).toBeLessThanOrEqual(scoreRange.max);
              expect(scored.score.rationale.length).toBeGreaterThan(0);
            }
          }
        });
      }
    }
  });

  describe('pillar_golden cases match expected tokens under forceteller baseline', () => {
    for (const fc of v4Cases) {
      if (fc.caseType !== 'pillar_golden' || !fc.expectedTokens) continue;

      it(`${fc.caseId}: pillar tokens match`, () => {
        const [y, m, d] = fc.date.split('-').map(Number) as [number, number, number];
        const [h, min] = fc.time.split(':').map(Number) as [number, number];
        const input = createBirthInput({
          birthYear: y, birthMonth: m, birthDay: d,
          birthHour: h, birthMinute: min,
          gender: fc.gender, longitude: fc.longitude,
        });
        const analysis = analyzeSaju(input, forcetellerBaselineConfig);
        const actual = analysis.pillars;

        expect(tokenOf(actual.year)).toBe(fc.expectedTokens!.year);
        expect(tokenOf(actual.month)).toBe(fc.expectedTokens!.month);
        expect(tokenOf(actual.day)).toBe(fc.expectedTokens!.day);
        expect(tokenOf(actual.hour)).toBe(fc.expectedTokens!.hour);
      });
    }
  });
});
