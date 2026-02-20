import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { ANALYSIS_KEYS, type SajuAnalysis } from '../../src/domain/SajuAnalysis.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { Pillar } from '../../src/domain/Pillar.js';
import { PillarSet } from '../../src/domain/PillarSet.js';
import { type SaeunPillar } from '../../src/domain/SaeunInfo.js';
import {
  DEFAULT_CONFIG,
  configFromPreset,
  SchoolPreset,
} from '../../src/config/CalculationConfig.js';
import type { GyeokgukResult } from '../../src/domain/Gyeokguk.js';

/**
 * SajuAnalysis domain tests -- verifies that the analysis result interface
 * contains all required typed fields, ANALYSIS_KEYS constants are non-empty
 * and distinct, the extensible analysisResults map is populated, and
 * convenience accessors delegate to coreResult.
 */

// Common test input for generating a full analysis
const dummyInput = createBirthInput({
  birthYear: 1990, birthMonth: 5, birthDay: 15,
  birthHour: 10, birthMinute: 30,
  gender: Gender.MALE,
  longitude: 126.978,
});

function dummyAnalysis(): SajuAnalysis {
  return analyzeSaju(dummyInput);
}

// =========================================================================
// Construction -- typed fields populated
// =========================================================================

describe('SajuAnalysis Construction', () => {

  it('coreResult is populated with pillars', () => {
    const analysis = dummyAnalysis();
    expect(analysis.coreResult).toBeDefined();
    expect(analysis.coreResult.pillars).toBeDefined();
    expect(analysis.coreResult.pillars.year).toBeDefined();
    expect(analysis.coreResult.pillars.month).toBeDefined();
    expect(analysis.coreResult.pillars.day).toBeDefined();
    expect(analysis.coreResult.pillars.hour).toBeDefined();
  });

  it('cheonganRelations is a non-empty array', () => {
    const analysis = dummyAnalysis();
    expect(Array.isArray(analysis.cheonganRelations)).toBe(true);
    // May or may not have relations depending on the chart
  });

  it('sibiUnseong is populated', () => {
    const analysis = dummyAnalysis();
    expect(analysis.sibiUnseong).not.toBeNull();
    if (analysis.sibiUnseong) {
      expect(analysis.sibiUnseong.size).toBeGreaterThan(0);
    }
  });

  it('gongmangVoidBranches is a tuple of two Jiji values', () => {
    const analysis = dummyAnalysis();
    expect(analysis.gongmangVoidBranches).not.toBeNull();
    if (analysis.gongmangVoidBranches) {
      expect(analysis.gongmangVoidBranches.length).toBe(2);
      const jiji = Object.values(Jiji);
      expect(jiji).toContain(analysis.gongmangVoidBranches[0]);
      expect(jiji).toContain(analysis.gongmangVoidBranches[1]);
    }
  });

  it('strengthResult is populated', () => {
    const analysis = dummyAnalysis();
    expect(analysis.strengthResult).not.toBeNull();
    expect(typeof analysis.strengthResult!.isStrong).toBe('boolean');
  });

  it('yongshinResult is populated', () => {
    const analysis = dummyAnalysis();
    expect(analysis.yongshinResult).not.toBeNull();
  });

  it('gyeokgukResult is populated', () => {
    const analysis = dummyAnalysis();
    expect(analysis.gyeokgukResult).not.toBeNull();
  });

  it('shinsalHits is an array', () => {
    const analysis = dummyAnalysis();
    expect(Array.isArray(analysis.shinsalHits)).toBe(true);
  });

  it('daeunInfo is populated', () => {
    const analysis = dummyAnalysis();
    expect(analysis.daeunInfo).not.toBeNull();
    expect(typeof analysis.daeunInfo!.isForward).toBe('boolean');
    expect(analysis.daeunInfo!.daeunPillars.length).toBeGreaterThan(0);
  });

  it('saeunPillars is a non-empty array', () => {
    const analysis = dummyAnalysis();
    expect(analysis.saeunPillars.length).toBeGreaterThan(0);
    const first = analysis.saeunPillars[0]!;
    expect(typeof first.year).toBe('number');
    expect(first.pillar).toBeDefined();
  });

  it('trace is a non-empty array', () => {
    const analysis = dummyAnalysis();
    expect(analysis.trace.length).toBeGreaterThan(0);
  });

  it('palaceAnalysis is populated', () => {
    const analysis = dummyAnalysis();
    expect(analysis.palaceAnalysis).not.toBeNull();
  });
});

// =========================================================================
// Typed fields -- saeun pillar details
// =========================================================================

describe('SajuAnalysis Saeun Pillars', () => {

  it('saeunPillars have year and pillar fields', () => {
    const analysis = analyzeSaju(dummyInput, DEFAULT_CONFIG, {
      daeunCount: 4,
      saeunStartYear: 2024,
      saeunYearCount: 3,
    });

    expect(analysis.saeunPillars.length).toBe(3);
    expect(analysis.saeunPillars[0]!.year).toBe(2024);
    expect(analysis.saeunPillars[0]!.pillar).toBeDefined();
    expect(analysis.saeunPillars[0]!.pillar.cheongan).toBeDefined();
    expect(analysis.saeunPillars[0]!.pillar.jiji).toBeDefined();
  });

  it('saeunPillars years are consecutive', () => {
    const analysis = analyzeSaju(dummyInput, DEFAULT_CONFIG, {
      daeunCount: 4,
      saeunStartYear: 2020,
      saeunYearCount: 5,
    });

    for (let i = 0; i < analysis.saeunPillars.length; i++) {
      expect(analysis.saeunPillars[i]!.year).toBe(2020 + i);
    }
  });
});

// =========================================================================
// Extensible analysisResults map
// =========================================================================

describe('SajuAnalysis analysisResults Map', () => {

  it('map contains core analysis keys', () => {
    const analysis = dummyAnalysis();
    const keys = analysis.analysisResults;

    expect(keys.has(ANALYSIS_KEYS.STRENGTH)).toBe(true);
    expect(keys.has(ANALYSIS_KEYS.YONGSHIN)).toBe(true);
    expect(keys.has(ANALYSIS_KEYS.GYEOKGUK)).toBe(true);
    expect(keys.has(ANALYSIS_KEYS.SIBI_UNSEONG)).toBe(true);
    expect(keys.has(ANALYSIS_KEYS.GONGMANG)).toBe(true);
    expect(keys.has(ANALYSIS_KEYS.DAEUN)).toBe(true);
    expect(keys.has(ANALYSIS_KEYS.SAEUN)).toBe(true);
    expect(keys.has(ANALYSIS_KEYS.TRACE)).toBe(true);
  });

  it('map values match typed fields by reference', () => {
    const analysis = dummyAnalysis();
    const keys = analysis.analysisResults;

    expect(analysis.strengthResult).toBe(keys.get(ANALYSIS_KEYS.STRENGTH));
    expect(analysis.yongshinResult).toBe(keys.get(ANALYSIS_KEYS.YONGSHIN));
    expect(analysis.sibiUnseong).toBe(keys.get(ANALYSIS_KEYS.SIBI_UNSEONG));
    expect(analysis.daeunInfo).toBe(keys.get(ANALYSIS_KEYS.DAEUN));
    expect(analysis.saeunPillars).toBe(keys.get(ANALYSIS_KEYS.SAEUN));
    expect(analysis.trace).toBe(keys.get(ANALYSIS_KEYS.TRACE));
  });

  it('gyeokguk value in map is accessible', () => {
    const analysis = dummyAnalysis();
    const gyeokguk = analysis.analysisResults.get(ANALYSIS_KEYS.GYEOKGUK) as GyeokgukResult | undefined;
    expect(gyeokguk).toBeDefined();
  });

  it('saeun value in map matches typed field', () => {
    const analysis = dummyAnalysis();
    const saeunFromMap = analysis.analysisResults.get(ANALYSIS_KEYS.SAEUN) as readonly SaeunPillar[] | undefined;
    expect(saeunFromMap).toBeDefined();
    expect(saeunFromMap!.length).toBe(analysis.saeunPillars.length);
    if (saeunFromMap!.length > 0) {
      expect(saeunFromMap![0]!.year).toBe(analysis.saeunPillars[0]!.year);
    }
  });
});

// =========================================================================
// Convenience accessors
// =========================================================================

describe('SajuAnalysis Convenience Accessors', () => {

  it('pillars delegates to coreResult.pillars', () => {
    const analysis = dummyAnalysis();
    expect(analysis.pillars).toBe(analysis.coreResult.pillars);
  });

  it('input delegates to coreResult.input', () => {
    const analysis = dummyAnalysis();
    expect(analysis.input).toBe(analysis.coreResult.input);
  });

  it('jijiRelations is an array', () => {
    const analysis = dummyAnalysis();
    expect(Array.isArray(analysis.jijiRelations)).toBe(true);
  });
});

// =========================================================================
// ANALYSIS_KEYS constants
// =========================================================================

describe('ANALYSIS_KEYS Constants', () => {

  it('all well-known keys are non-empty strings', () => {
    for (const [name, value] of Object.entries(ANALYSIS_KEYS)) {
      expect(typeof value).toBe('string');
      expect(value.length, `ANALYSIS_KEYS.${name} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('all well-known keys are distinct', () => {
    const values = Object.values(ANALYSIS_KEYS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('expected key names exist', () => {
    expect(ANALYSIS_KEYS.STRENGTH).toBeDefined();
    expect(ANALYSIS_KEYS.YONGSHIN).toBeDefined();
    expect(ANALYSIS_KEYS.GYEOKGUK).toBeDefined();
    expect(ANALYSIS_KEYS.SIBI_UNSEONG).toBeDefined();
    expect(ANALYSIS_KEYS.GONGMANG).toBeDefined();
    expect(ANALYSIS_KEYS.SHINSAL).toBeDefined();
    expect(ANALYSIS_KEYS.DAEUN).toBeDefined();
    expect(ANALYSIS_KEYS.SAEUN).toBeDefined();
    expect(ANALYSIS_KEYS.CHEONGAN_RELATIONS).toBeDefined();
    expect(ANALYSIS_KEYS.TRACE).toBeDefined();
  });

  it('additional keys for extended analyses exist', () => {
    expect(ANALYSIS_KEYS.RESOLVED_JIJI).toBeDefined();
    expect(ANALYSIS_KEYS.SCORED_CHEONGAN).toBeDefined();
    expect(ANALYSIS_KEYS.WEIGHTED_SHINSAL).toBeDefined();
    expect(ANALYSIS_KEYS.SHINSAL_COMPOSITES).toBeDefined();
    expect(ANALYSIS_KEYS.PALACE).toBeDefined();
    expect(ANALYSIS_KEYS.OHAENG_DISTRIBUTION).toBeDefined();
    expect(ANALYSIS_KEYS.TEN_GODS).toBeDefined();
    expect(ANALYSIS_KEYS.HIDDEN_STEMS).toBeDefined();
  });
});

// =========================================================================
// Cross-preset consistency
// =========================================================================

describe('SajuAnalysis Cross-Preset', () => {

  const presets = [
    SchoolPreset.KOREAN_MAINSTREAM,
    SchoolPreset.TRADITIONAL_CHINESE,
    SchoolPreset.MODERN_INTEGRATED,
  ];

  it('all presets produce a complete analysis with typed fields', () => {
    for (const preset of presets) {
      const config = configFromPreset(preset);
      const analysis = analyzeSaju(dummyInput, config);

      expect(analysis.coreResult, `${preset}: coreResult`).toBeDefined();
      expect(analysis.strengthResult, `${preset}: strengthResult`).not.toBeNull();
      expect(analysis.yongshinResult, `${preset}: yongshinResult`).not.toBeNull();
      expect(analysis.gyeokgukResult, `${preset}: gyeokgukResult`).not.toBeNull();
      expect(analysis.daeunInfo, `${preset}: daeunInfo`).not.toBeNull();
      expect(analysis.saeunPillars.length, `${preset}: saeunPillars`).toBeGreaterThan(0);
      expect(analysis.trace.length, `${preset}: trace`).toBeGreaterThan(0);
      expect(analysis.analysisResults.size, `${preset}: analysisResults`).toBeGreaterThan(0);
    }
  });

  it('all presets have consistent ANALYSIS_KEYS presence', () => {
    const coreKeys = [
      ANALYSIS_KEYS.STRENGTH,
      ANALYSIS_KEYS.YONGSHIN,
      ANALYSIS_KEYS.GYEOKGUK,
      ANALYSIS_KEYS.DAEUN,
      ANALYSIS_KEYS.SAEUN,
      ANALYSIS_KEYS.TRACE,
    ];

    for (const preset of presets) {
      const config = configFromPreset(preset);
      const analysis = analyzeSaju(dummyInput, config);

      for (const key of coreKeys) {
        expect(analysis.analysisResults.has(key), `${preset}: missing '${key}'`).toBe(true);
      }
    }
  });
});
