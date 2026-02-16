import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput, type BirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { ANALYSIS_KEYS } from '../../src/domain/SajuAnalysis.js';
import {
  configFromPreset,
  SchoolPreset,
} from '../../src/config/CalculationConfig.js';

/**
 * Cross-preset integration tests for the full analysis calculator.
 *
 * Verifies that all preset + case combinations produce non-null core analyses,
 * the analysisResults map contains all required keys, and trace includes
 * core pipeline steps.
 */

interface TestCase {
  readonly id: string;
  readonly birth: BirthInput;
}

const cases: TestCase[] = [
  {
    id: 'case_hapwha',
    birth: createBirthInput({
      birthYear: 1989, birthMonth: 10, birthDay: 20,
      birthHour: 7, birthMinute: 30,
      gender: Gender.FEMALE, longitude: 126.978,
    }),
  },
  {
    id: 'case_dst',
    birth: createBirthInput({
      birthYear: 1988, birthMonth: 7, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE, longitude: 126.978,
    }),
  },
  {
    id: 'case_ipchun',
    birth: createBirthInput({
      birthYear: 2024, birthMonth: 2, birthDay: 4,
      birthHour: 5, birthMinute: 30,
      gender: Gender.FEMALE, longitude: 126.978,
    }),
  },
];

const presets = [
  SchoolPreset.KOREAN_MAINSTREAM,
  SchoolPreset.TRADITIONAL_CHINESE,
  SchoolPreset.MODERN_INTEGRATED,
];

describe('DefaultSajuAnalysisCalculator', () => {

  it('all preset and case combinations produce non-null core analyses', () => {
    for (const preset of presets) {
      const config = configFromPreset(preset);
      for (const testCase of cases) {
        const analysis = analyzeSaju(testCase.birth, config);

        expect(analysis.pillars.year, `${testCase.id}/${preset}: year pillar missing`).toBeDefined();
        expect(analysis.pillars.month, `${testCase.id}/${preset}: month pillar missing`).toBeDefined();
        expect(analysis.pillars.day, `${testCase.id}/${preset}: day pillar missing`).toBeDefined();
        expect(analysis.pillars.hour, `${testCase.id}/${preset}: hour pillar missing`).toBeDefined();

        expect(analysis.strengthResult, `${testCase.id}/${preset}: strengthResult missing`).not.toBeNull();
        expect(analysis.yongshinResult, `${testCase.id}/${preset}: yongshinResult missing`).not.toBeNull();
        expect(analysis.gyeokgukResult, `${testCase.id}/${preset}: gyeokgukResult missing`).not.toBeNull();
        expect(analysis.palaceAnalysis, `${testCase.id}/${preset}: palaceAnalysis missing`).not.toBeNull();
        expect(analysis.daeunInfo, `${testCase.id}/${preset}: daeunInfo missing`).not.toBeNull();
        expect(analysis.saeunPillars.length, `${testCase.id}/${preset}: saeunPillars empty`).toBeGreaterThan(0);
        expect(analysis.trace.length, `${testCase.id}/${preset}: trace steps < 7`).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('analysisResults map contains core typed keys across presets', () => {
    const requiredKeys = [
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

    for (const preset of presets) {
      const config = configFromPreset(preset);
      for (const testCase of cases) {
        const analysis = analyzeSaju(testCase.birth, config);
        const keys = analysis.analysisResults;
        for (const required of requiredKeys) {
          expect(keys.has(required), `${testCase.id}/${preset}: missing key '${required}'`).toBe(true);
        }
      }
    }
  });

  it('trace includes core pipeline steps across presets', () => {
    const coreSteps = ['core', 'strength', 'gyeokguk', 'yongshin', 'daeun', 'saeun'];

    for (const preset of presets) {
      const config = configFromPreset(preset);
      for (const testCase of cases) {
        const analysis = analyzeSaju(testCase.birth, config);
        const traceKeys = new Set(analysis.trace.map(t => t.key));
        for (const step of coreSteps) {
          expect(traceKeys.has(step), `${testCase.id}/${preset}: missing trace step '${step}'`).toBe(true);
        }
      }
    }
  });
});
