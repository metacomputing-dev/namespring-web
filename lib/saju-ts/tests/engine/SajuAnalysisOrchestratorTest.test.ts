import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { ANALYSIS_KEYS } from '../../src/domain/SajuAnalysis.js';
import { DEFAULT_CONFIG } from '../../src/config/CalculationConfig.js';
import type { GyeokgukResult } from '../../src/domain/Gyeokguk.js';

/**
 * SajuAnalysisOrchestrator test -- verifies the full analysis pipeline
 * produces complete typed analysis results.
 */

describe('SajuAnalysisOrchestrator', () => {

  it('analyze builds full typed analysis', () => {
    const input = createBirthInput({
      birthYear: 1991, birthMonth: 2, birthDay: 13,
      birthHour: 23, birthMinute: 45,
      gender: Gender.MALE,
    });

    const analysis = analyzeSaju(input);

    expect(analysis.strengthResult).not.toBeNull();
    expect(analysis.yongshinResult).not.toBeNull();
    expect(analysis.sibiUnseong).not.toBeNull();
    expect(analysis.gongmangVoidBranches).not.toBeNull();
    expect(analysis.daeunInfo).not.toBeNull();
    expect(analysis.saeunPillars.length).toBeGreaterThan(0);
    expect(analysis.trace.length).toBeGreaterThan(0);
    expect(analysis.analysisResults.has(ANALYSIS_KEYS.TRACE)).toBe(true);

    const gyeokguk = analysis.analysisResults.get(ANALYSIS_KEYS.GYEOKGUK) as GyeokgukResult | undefined;
    expect(gyeokguk).toBeDefined();
  });

  it('analyze respects options for luck range and shinsal', () => {
    const input = createBirthInput({
      birthYear: 1988, birthMonth: 6, birthDay: 20,
      birthHour: 14, birthMinute: 10,
      gender: Gender.FEMALE,
    });

    const analysis = analyzeSaju(input, DEFAULT_CONFIG, {
      daeunCount: 4,
      saeunStartYear: 2030,
      saeunYearCount: 6,
    });

    expect(analysis.daeunInfo).not.toBeNull();
    expect(analysis.daeunInfo!.daeunPillars.length).toBe(4);
    expect(analysis.saeunPillars.length).toBe(6);
    expect(analysis.saeunPillars[0]!.year).toBe(2030);
  });
});
