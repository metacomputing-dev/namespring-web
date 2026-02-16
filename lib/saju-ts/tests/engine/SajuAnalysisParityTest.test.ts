import { describe, it, expect } from 'vitest';
import { analyzeSaju, SajuAnalysisPipeline } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { ANALYSIS_KEYS } from '../../src/domain/SajuAnalysis.js';
import {
  configFromPreset,
  SchoolPreset,
} from '../../src/config/CalculationConfig.js';
import type { GongmangResult } from '../../src/engine/analysis/GongmangCalculator.js';

/**
 * Parity test: verifies that typed fields and analysisResults map are synchronized
 * across all presets.
 *
 * Also verifies that analyzeSaju() and SajuAnalysisPipeline.analyze() produce
 * equivalent results.
 */

describe('SajuAnalysisParity', () => {

  const input = createBirthInput({
    birthYear: 1994, birthMonth: 11, birthDay: 5,
    birthHour: 23, birthMinute: 40,
    gender: Gender.FEMALE,
  });

  const presets = [
    SchoolPreset.KOREAN_MAINSTREAM,
    SchoolPreset.TRADITIONAL_CHINESE,
    SchoolPreset.MODERN_INTEGRATED,
  ];

  it('typed fields and analysisResults are synchronized across presets', () => {
    for (const preset of presets) {
      const config = configFromPreset(preset);
      const analysis = analyzeSaju(input, config, {
        daeunCount: 4,
        saeunStartYear: 2024,
        saeunYearCount: 5,
      });

      const keys = analysis.analysisResults;

      // Verify required keys exist
      expect(keys.has(ANALYSIS_KEYS.STRENGTH), `Missing strength key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.YONGSHIN), `Missing yongshin key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.GYEOKGUK), `Missing gyeokguk key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.SIBI_UNSEONG), `Missing sibiUnseong key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.GONGMANG), `Missing gongmang key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.SHINSAL), `Missing shinsal key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.DAEUN), `Missing daeun key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.SAEUN), `Missing saeun key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.CHEONGAN_RELATIONS), `Missing cheonganRelations key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.RESOLVED_JIJI), `Missing resolvedJijiRelations key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.SCORED_CHEONGAN), `Missing scoredCheonganRelations key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.WEIGHTED_SHINSAL), `Missing weightedShinsal key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.SHINSAL_COMPOSITES), `Missing shinsalComposites key for ${preset}`).toBe(true);
      expect(keys.has(ANALYSIS_KEYS.TRACE), `Missing trace key for ${preset}`).toBe(true);

      // Verify typed fields match map values
      expect(analysis.strengthResult).toBe(keys.get(ANALYSIS_KEYS.STRENGTH));
      expect(analysis.yongshinResult).toBe(keys.get(ANALYSIS_KEYS.YONGSHIN));
      expect(analysis.sibiUnseong).toBe(keys.get(ANALYSIS_KEYS.SIBI_UNSEONG));
      expect(analysis.shinsalHits).toBe(keys.get(ANALYSIS_KEYS.SHINSAL));
      expect(analysis.daeunInfo).toBe(keys.get(ANALYSIS_KEYS.DAEUN));
      expect(analysis.saeunPillars).toBe(keys.get(ANALYSIS_KEYS.SAEUN));
      expect(analysis.cheonganRelations).toBe(keys.get(ANALYSIS_KEYS.CHEONGAN_RELATIONS));
      expect(analysis.resolvedJijiRelations).toBe(keys.get(ANALYSIS_KEYS.RESOLVED_JIJI));
      expect(analysis.scoredCheonganRelations).toBe(keys.get(ANALYSIS_KEYS.SCORED_CHEONGAN));
      expect(analysis.weightedShinsalHits).toBe(keys.get(ANALYSIS_KEYS.WEIGHTED_SHINSAL));
      expect(analysis.shinsalComposites).toBe(keys.get(ANALYSIS_KEYS.SHINSAL_COMPOSITES));
      expect(analysis.trace).toBe(keys.get(ANALYSIS_KEYS.TRACE));

      // Gongmang void branch parity
      const gongmang = keys.get(ANALYSIS_KEYS.GONGMANG) as GongmangResult;
      expect(gongmang).toBeDefined();
      expect(analysis.gongmangVoidBranches).toEqual(gongmang.voidBranches);
    }
  });

  it('analyzeSaju and SajuAnalysisPipeline produce equivalent results', () => {
    const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);
    const directResult = analyzeSaju(input, config);
    const pipeline = new SajuAnalysisPipeline(config);
    const pipelineResult = pipeline.analyze(input);

    // Both should produce the same pillars
    expect(directResult.pillars.year.cheongan).toBe(pipelineResult.pillars.year.cheongan);
    expect(directResult.pillars.year.jiji).toBe(pipelineResult.pillars.year.jiji);
    expect(directResult.pillars.month.cheongan).toBe(pipelineResult.pillars.month.cheongan);
    expect(directResult.pillars.month.jiji).toBe(pipelineResult.pillars.month.jiji);
    expect(directResult.pillars.day.cheongan).toBe(pipelineResult.pillars.day.cheongan);
    expect(directResult.pillars.day.jiji).toBe(pipelineResult.pillars.day.jiji);
    expect(directResult.pillars.hour.cheongan).toBe(pipelineResult.pillars.hour.cheongan);
    expect(directResult.pillars.hour.jiji).toBe(pipelineResult.pillars.hour.jiji);

    // Both should produce the same strength result
    expect(directResult.strengthResult?.isStrong).toBe(pipelineResult.strengthResult?.isStrong);

    // Both should have the same gongmang
    expect(directResult.gongmangVoidBranches).toEqual(pipelineResult.gongmangVoidBranches);
  });
});
