import { describe, it, expect } from 'vitest';
import { analyzeSaju, SajuAnalysisPipeline } from '../../../src/engine/SajuAnalysisPipeline.js';
import { calculatePillars } from '../../../src/engine/SajuCalculator.js';
import { createBirthInput, type BirthInput } from '../../../src/domain/types.js';
import { Gender } from '../../../src/domain/Gender.js';
import {
  DEFAULT_CONFIG,
  configFromPreset,
  SchoolPreset,
} from '../../../src/config/CalculationConfig.js';

/**
 * Integration tests verifying that trace entries are properly produced
 * during pipeline analysis.
 *
 * Verifies that:
 * - Core calculator produces pillar result with warnings
 * - Full analysis pipeline produces trace entries for each step
 * - Trace includes core pipeline steps across all presets
 */

const standardBirth: BirthInput = createBirthInput({
  birthYear: 2021, birthMonth: 2, birthDay: 3,
  birthHour: 23, birthMinute: 59,
  gender: Gender.MALE,
  longitude: 126.978,
});

const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

// -- Core calculator produces correct warnings --

describe('TraceBridge: Core Calculator', () => {

  it('core calculator produces pillar result with correction info', () => {
    const result = calculatePillars(standardBirth, config);
    expect(result).toBeDefined();
    expect(result.pillars).toBeDefined();
    // TS SajuPillarResult exposes correction minutes instead of warnings
    expect(typeof result.longitudeCorrectionMinutes).toBe('number');
    expect(typeof result.dstCorrectionMinutes).toBe('number');
  });

  it('core result has all four pillars', () => {
    const result = calculatePillars(standardBirth, config);
    expect(result.pillars.year).toBeDefined();
    expect(result.pillars.month).toBeDefined();
    expect(result.pillars.day).toBeDefined();
    expect(result.pillars.hour).toBeDefined();
  });
});

// -- Full analysis produces trace entries --

describe('TraceBridge: Full Pipeline Trace', () => {

  it('analysis produces non-empty trace', () => {
    const analysis = analyzeSaju(standardBirth, config);
    expect(analysis.trace.length).toBeGreaterThan(0);
  });

  it('trace contains core step', () => {
    const analysis = analyzeSaju(standardBirth, config);
    const coreStep = analysis.trace.find(t => t.key === 'core');
    expect(coreStep).toBeDefined();
    expect(coreStep!.summary.length).toBeGreaterThan(0);
  });

  it('trace contains strength step', () => {
    const analysis = analyzeSaju(standardBirth, config);
    const strengthStep = analysis.trace.find(t => t.key === 'strength');
    expect(strengthStep).toBeDefined();
  });

  it('trace contains yongshin step', () => {
    const analysis = analyzeSaju(standardBirth, config);
    const yongshinStep = analysis.trace.find(t => t.key === 'yongshin');
    expect(yongshinStep).toBeDefined();
  });

  it('trace contains daeun step', () => {
    const analysis = analyzeSaju(standardBirth, config);
    const daeunStep = analysis.trace.find(t => t.key === 'daeun');
    expect(daeunStep).toBeDefined();
  });

  it('trace contains saeun step', () => {
    const analysis = analyzeSaju(standardBirth, config);
    const saeunStep = analysis.trace.find(t => t.key === 'saeun');
    expect(saeunStep).toBeDefined();
  });

  it('trace contains gongmang step', () => {
    const analysis = analyzeSaju(standardBirth, config);
    const gongmangStep = analysis.trace.find(t => t.key === 'gongmang');
    expect(gongmangStep).toBeDefined();
    expect(gongmangStep!.summary).toContain('공망');
  });

  it('trace contains gyeokguk step', () => {
    const analysis = analyzeSaju(standardBirth, config);
    const step = analysis.trace.find(t => t.key === 'gyeokguk');
    expect(step).toBeDefined();
  });
});

// -- All presets produce traces --

describe('TraceBridge: Cross-Preset', () => {

  const presets = [
    SchoolPreset.KOREAN_MAINSTREAM,
    SchoolPreset.TRADITIONAL_CHINESE,
    SchoolPreset.MODERN_INTEGRATED,
  ];

  it('all presets produce non-empty trace', () => {
    for (const preset of presets) {
      const cfg = configFromPreset(preset);
      const analysis = analyzeSaju(standardBirth, cfg);
      expect(analysis.trace.length, `Trace should be non-empty for preset ${preset}`).toBeGreaterThan(0);
    }
  });

  it('all presets include core pipeline steps in trace', () => {
    const coreSteps = ['core', 'strength', 'gyeokguk', 'yongshin', 'daeun', 'saeun'];

    for (const preset of presets) {
      const cfg = configFromPreset(preset);
      const analysis = analyzeSaju(standardBirth, cfg);
      const traceKeys = new Set(analysis.trace.map(t => t.key));
      for (const step of coreSteps) {
        expect(traceKeys.has(step), `Missing trace step '${step}' for preset ${preset}`).toBe(true);
      }
    }
  });

  it('trace order starts with core', () => {
    const analysis = analyzeSaju(standardBirth, config);
    expect(analysis.trace[0]!.key).toBe('core');
  });
});

// -- DST boundary bridges correctly --

describe('TraceBridge: DST Boundary', () => {

  it('1988 summer birth includes DST info in analysis', () => {
    const dstBirth = createBirthInput({
      birthYear: 1988, birthMonth: 6, birthDay: 1,
      birthHour: 0, birthMinute: 30,
      gender: Gender.MALE,
    });
    const analysis = analyzeSaju(dstBirth, config);
    expect(analysis.trace.length).toBeGreaterThan(0);
    // 1988 summer births have DST correction applied
    expect(analysis.coreResult.dstCorrectionMinutes).not.toBe(0);
  });
});
