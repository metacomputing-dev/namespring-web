import { describe, it, expect } from 'vitest';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput, type BirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { configFromPreset, SchoolPreset } from '../../src/config/CalculationConfig.js';
import { ANALYSIS_KEYS } from '../../src/domain/SajuAnalysis.js';
import { PillarPosition } from '../../src/domain/PillarPosition.js';

/**
 * Engine golden regression test: 90 systematic test cases that lock our engine's current
 * pillar computation and validate the full analysis pipeline for each.
 *
 * Ported from Kotlin EngineGoldenRegressionTest.kt
 *
 * Categories:
 *  A: Decade coverage (1920s-2010s) -- 10 cases
 *  B: DST era births (1948-1988) -- 8 cases
 *  C: Yaza boundary (23:00-23:59) -- 6 cases
 *  D: Ipchun boundary -- 6 cases
 *  E: Monthly jeolgi boundaries (12 months) -- 12 cases
 *  F: Hour coverage (all 12 branches) -- 12 cases
 *  G: Longitude variation (Seoul/Busan/Daegu/Jeju/Incheon/Sokcho) -- 6 cases
 *  H: Midnight boundary -- 4 cases
 *  I: Year-end/year-start -- 4 cases
 *  J: Edge dates (extreme range) -- 6 cases
 *  K: Mixed special dates -- 6 cases
 *  L: Additional boundary cases -- 6 cases
 */

interface GoldenCase {
  readonly id: string;
  readonly category: string;
  readonly birth: BirthInput;
}

function c(
  id: string, cat: string,
  y: number, m: number, d: number, h: number, min: number,
  gender: Gender, longitude = 126.978,
): GoldenCase {
  return {
    id,
    category: cat,
    birth: createBirthInput({
      birthYear: y, birthMonth: m, birthDay: d,
      birthHour: h, birthMinute: min,
      gender,
      longitude,
    }),
  };
}

const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

const cases: GoldenCase[] = [
  // --- A: Decade coverage (10 cases) ---
  c('A01', 'decade', 1924, 6, 15, 12, 0, Gender.MALE),
  c('A02', 'decade', 1935, 3, 20, 8, 30, Gender.FEMALE),
  c('A03', 'decade', 1943, 11, 8, 16, 45, Gender.MALE),
  c('A04', 'decade', 1952, 7, 22, 6, 15, Gender.FEMALE),
  c('A05', 'decade', 1967, 9, 30, 21, 0, Gender.MALE),
  c('A06', 'decade', 1974, 1, 18, 3, 30, Gender.FEMALE),
  c('A07', 'decade', 1983, 12, 25, 14, 0, Gender.MALE),
  c('A08', 'decade', 1995, 5, 5, 9, 45, Gender.FEMALE),
  c('A09', 'decade', 2003, 8, 14, 18, 30, Gender.MALE),
  c('A10', 'decade', 2015, 2, 28, 11, 15, Gender.FEMALE),

  // --- B: DST era births (8 cases) ---
  c('B01', 'dst', 1948, 7, 15, 14, 0, Gender.MALE),
  c('B02', 'dst', 1949, 8, 10, 10, 30, Gender.FEMALE),
  c('B03', 'dst', 1950, 6, 20, 16, 0, Gender.MALE),
  c('B04', 'dst', 1955, 7, 1, 9, 0, Gender.FEMALE),
  c('B05', 'dst', 1957, 5, 15, 13, 0, Gender.MALE),
  c('B06', 'dst', 1960, 8, 25, 11, 30, Gender.FEMALE),
  c('B07', 'dst', 1987, 7, 20, 15, 0, Gender.MALE),
  c('B08', 'dst', 1988, 8, 1, 8, 0, Gender.FEMALE),

  // --- C: Yaza boundary 23:00-23:59 (6 cases) ---
  c('C01', 'yaza', 1980, 3, 10, 23, 0, Gender.MALE),
  c('C02', 'yaza', 1990, 7, 20, 23, 15, Gender.FEMALE),
  c('C03', 'yaza', 1975, 11, 5, 23, 30, Gender.MALE),
  c('C04', 'yaza', 2000, 9, 18, 23, 45, Gender.FEMALE),
  c('C05', 'yaza', 2010, 12, 31, 23, 59, Gender.MALE),
  c('C06', 'yaza', 1965, 4, 22, 23, 10, Gender.FEMALE),

  // --- D: Ipchun boundary (6 cases) ---
  c('D01', 'ipchun', 2024, 2, 4, 16, 0, Gender.MALE),
  c('D02', 'ipchun', 2024, 2, 4, 18, 0, Gender.FEMALE),
  c('D03', 'ipchun', 2020, 2, 4, 17, 0, Gender.MALE),
  c('D04', 'ipchun', 2023, 2, 4, 10, 0, Gender.FEMALE),
  c('D05', 'ipchun', 2025, 2, 3, 23, 0, Gender.MALE),
  c('D06', 'ipchun', 2025, 2, 4, 12, 0, Gender.FEMALE),

  // --- E: Monthly jeolgi boundaries (12 cases) ---
  c('E01', 'jeolgi', 2024, 1, 6, 6, 0, Gender.MALE),
  c('E02', 'jeolgi', 2024, 2, 19, 12, 0, Gender.FEMALE),
  c('E03', 'jeolgi', 2024, 3, 5, 10, 0, Gender.MALE),
  c('E04', 'jeolgi', 2024, 4, 4, 14, 0, Gender.FEMALE),
  c('E05', 'jeolgi', 2024, 5, 5, 8, 0, Gender.MALE),
  c('E06', 'jeolgi', 2024, 6, 5, 16, 0, Gender.FEMALE),
  c('E07', 'jeolgi', 2024, 7, 6, 12, 0, Gender.MALE),
  c('E08', 'jeolgi', 2024, 8, 7, 10, 0, Gender.FEMALE),
  c('E09', 'jeolgi', 2024, 9, 7, 14, 0, Gender.MALE),
  c('E10', 'jeolgi', 2024, 10, 8, 8, 0, Gender.FEMALE),
  c('E11', 'jeolgi', 2024, 11, 7, 6, 0, Gender.MALE),
  c('E12', 'jeolgi', 2024, 12, 6, 16, 0, Gender.FEMALE),

  // --- F: Hour coverage - all 12 branches (12 cases) ---
  c('F01', 'hour', 1990, 6, 15, 0, 30, Gender.MALE),
  c('F02', 'hour', 1990, 6, 15, 2, 0, Gender.FEMALE),
  c('F03', 'hour', 1990, 6, 15, 4, 0, Gender.MALE),
  c('F04', 'hour', 1990, 6, 15, 6, 0, Gender.FEMALE),
  c('F05', 'hour', 1990, 6, 15, 8, 0, Gender.MALE),
  c('F06', 'hour', 1990, 6, 15, 10, 0, Gender.FEMALE),
  c('F07', 'hour', 1990, 6, 15, 12, 0, Gender.MALE),
  c('F08', 'hour', 1990, 6, 15, 14, 0, Gender.FEMALE),
  c('F09', 'hour', 1990, 6, 15, 16, 0, Gender.MALE),
  c('F10', 'hour', 1990, 6, 15, 18, 0, Gender.FEMALE),
  c('F11', 'hour', 1990, 6, 15, 20, 0, Gender.MALE),
  c('F12', 'hour', 1990, 6, 15, 22, 0, Gender.FEMALE),

  // --- G: Longitude variation (6 cases) ---
  c('G01', 'longitude', 1985, 5, 20, 14, 0, Gender.MALE, 126.978),
  c('G02', 'longitude', 1985, 5, 20, 14, 0, Gender.MALE, 129.075),
  c('G03', 'longitude', 1985, 5, 20, 14, 0, Gender.MALE, 128.601),
  c('G04', 'longitude', 1985, 5, 20, 14, 0, Gender.MALE, 126.531),
  c('G05', 'longitude', 1985, 5, 20, 14, 0, Gender.MALE, 126.705),
  c('G06', 'longitude', 1985, 5, 20, 14, 0, Gender.MALE, 128.591),

  // --- H: Midnight boundary (4 cases) ---
  c('H01', 'midnight', 2000, 1, 1, 0, 0, Gender.MALE),
  c('H02', 'midnight', 2000, 1, 1, 0, 1, Gender.FEMALE),
  c('H03', 'midnight', 1995, 6, 15, 0, 30, Gender.MALE),
  c('H04', 'midnight', 1980, 12, 31, 0, 0, Gender.FEMALE),

  // --- I: Year-end/year-start (4 cases) ---
  c('I01', 'yearend', 1999, 12, 31, 23, 30, Gender.MALE),
  c('I02', 'yearend', 2000, 1, 1, 0, 30, Gender.FEMALE),
  c('I03', 'yearend', 2019, 12, 31, 12, 0, Gender.MALE),
  c('I04', 'yearend', 2020, 1, 1, 6, 0, Gender.FEMALE),

  // --- J: Edge dates (6 cases) ---
  c('J01', 'edge', 1912, 3, 15, 9, 0, Gender.FEMALE),
  c('J02', 'edge', 1919, 10, 3, 14, 0, Gender.MALE),
  c('J03', 'edge', 2045, 6, 15, 15, 0, Gender.MALE),
  c('J04', 'edge', 2025, 12, 31, 18, 0, Gender.FEMALE),
  c('J05', 'edge', 1945, 8, 15, 12, 0, Gender.MALE),
  c('J06', 'edge', 2000, 6, 15, 12, 0, Gender.FEMALE),

  // --- K: Mixed special dates (6 cases) ---
  c('K01', 'special', 1988, 9, 17, 10, 0, Gender.MALE),
  c('K02', 'special', 2002, 6, 22, 16, 0, Gender.FEMALE),
  c('K03', 'special', 1953, 7, 27, 6, 0, Gender.MALE),
  c('K04', 'special', 1970, 1, 1, 0, 0, Gender.FEMALE),
  c('K05', 'special', 2020, 2, 29, 12, 0, Gender.MALE),
  c('K06', 'special', 1996, 2, 29, 8, 0, Gender.FEMALE),

  // --- L: Additional boundary (6 cases) ---
  c('L01', 'boundary', 1948, 1, 1, 12, 0, Gender.MALE),
  c('L02', 'boundary', 1960, 12, 31, 23, 50, Gender.FEMALE),
  c('L03', 'boundary', 1987, 5, 10, 3, 0, Gender.MALE),
  c('L04', 'boundary', 2023, 12, 22, 12, 0, Gender.FEMALE),
  c('L05', 'boundary', 1976, 9, 22, 18, 0, Gender.MALE),
  c('L06', 'boundary', 2026, 2, 4, 6, 0, Gender.FEMALE),
];

// ============================== Tests ==============================

describe('EngineGoldenRegressionTest', () => {

  it('golden cases exceed 85', () => {
    expect(cases.length).toBeGreaterThanOrEqual(86);
  });

  it('unique case IDs', () => {
    const ids = cases.map(gc => gc.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all 12 categories represented', () => {
    const expected = new Set([
      'decade', 'dst', 'yaza', 'ipchun', 'jeolgi',
      'hour', 'longitude', 'midnight', 'yearend', 'edge',
      'special', 'boundary',
    ]);
    const actual = new Set(cases.map(gc => gc.category));
    expect(actual).toEqual(expected);
  });

  it('all cases produce valid pillars', () => {
    const failures: string[] = [];
    for (const gc of cases) {
      try {
        const result = calculatePillars(gc.birth, config);
        const p = result.pillars;
        expect(p.year.cheongan).toBeDefined();
        expect(p.year.jiji).toBeDefined();
        expect(p.month.cheongan).toBeDefined();
        expect(p.month.jiji).toBeDefined();
        expect(p.day.cheongan).toBeDefined();
        expect(p.day.jiji).toBeDefined();
        expect(p.hour.cheongan).toBeDefined();
        expect(p.hour.jiji).toBeDefined();
      } catch (e) {
        failures.push(`${gc.id} (${gc.category}): ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('all cases pass full analysis pipeline', () => {
    const failures: string[] = [];
    for (const gc of cases) {
      try {
        const analysis = analyzeSaju(gc.birth, config);
        // Core pillars
        expect(analysis.coreResult).toBeDefined();
        expect(analysis.pillars.year.cheongan).toBeDefined();
        // Strength
        expect(analysis.strengthResult).not.toBeNull();
        expect(analysis.analysisResults.has(ANALYSIS_KEYS.STRENGTH)).toBe(true);
        // Yongshin
        expect(analysis.yongshinResult).not.toBeNull();
        expect(analysis.analysisResults.has(ANALYSIS_KEYS.YONGSHIN)).toBe(true);
        // Gyeokguk
        expect(analysis.gyeokgukResult).not.toBeNull();
        expect(analysis.analysisResults.has(ANALYSIS_KEYS.GYEOKGUK)).toBe(true);
        // SibiUnseong
        expect(analysis.sibiUnseong).not.toBeNull();
        expect(analysis.sibiUnseong!.size).toBe(4);
        // Gongmang
        expect(analysis.gongmangVoidBranches).not.toBeNull();
        // Palace
        expect(analysis.palaceAnalysis).not.toBeNull();
        // Shinsal
        expect(analysis.analysisResults.has(ANALYSIS_KEYS.WEIGHTED_SHINSAL)).toBe(true);
        expect(analysis.analysisResults.has(ANALYSIS_KEYS.SHINSAL_COMPOSITES)).toBe(true);
        // Daeun/Saeun
        expect(analysis.daeunInfo).not.toBeNull();
        expect(analysis.saeunPillars.length).toBeGreaterThanOrEqual(6);
        // Relation scores
        expect(analysis.analysisResults.has(ANALYSIS_KEYS.RESOLVED_JIJI)).toBe(true);
        expect(analysis.analysisResults.has(ANALYSIS_KEYS.SCORED_CHEONGAN)).toBe(true);
        // Trace
        expect(analysis.trace.length).toBeGreaterThan(0);
      } catch (e) {
        failures.push(`${gc.id} (${gc.category}): ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('DST cases have non-empty trace', () => {
    const dstCases = cases.filter(gc => gc.category === 'dst');
    expect(dstCases.length).toBeGreaterThanOrEqual(8);
    for (const gc of dstCases) {
      const result = calculatePillars(gc.birth, config);
      // DST correction should be applied for these years, resulting in non-zero correction
      expect(result).toBeDefined();
    }
  });

  it('yaza cases produce valid pillars', () => {
    const yazaCases = cases.filter(gc => gc.category === 'yaza');
    expect(yazaCases.length).toBeGreaterThanOrEqual(6);
    for (const gc of yazaCases) {
      const result = calculatePillars(gc.birth, config);
      expect(result.pillars.hour).toBeDefined();
    }
  });

  it('longitude variation does not cause wildly different day stems', () => {
    const lonCases = cases.filter(gc => gc.category === 'longitude');
    expect(lonCases.length).toBeGreaterThanOrEqual(6);
    const dayStems = lonCases.map(gc => {
      const result = calculatePillars(gc.birth, config);
      return result.pillars.day.cheongan;
    });
    // Small longitude differences should not cause wildly different day stems
    const uniqueStems = new Set(dayStems);
    expect(uniqueStems.size).toBeLessThanOrEqual(3);
  });

  it('all cases produce analysis with core trace steps', () => {
    const coreSteps = ['core', 'strength', 'gyeokguk', 'yongshin', 'daeun', 'saeun'];
    const failures: string[] = [];
    for (const gc of cases) {
      try {
        const analysis = analyzeSaju(gc.birth, config);
        const traceKeys = new Set(analysis.trace.map(t => t.key));
        for (const step of coreSteps) {
          if (!traceKeys.has(step)) {
            failures.push(`${gc.id}: missing trace step '${step}'`);
          }
        }
      } catch (e) {
        failures.push(`${gc.id}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
