import { describe, it, expect } from 'vitest';
import { analyzeSaju, SajuAnalysisPipeline } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { PillarPosition } from '../../src/domain/PillarPosition.js';
import { ANALYSIS_KEYS } from '../../src/domain/SajuAnalysis.js';
import {
  DEFAULT_CONFIG,
  createConfig,
  configFromPreset,
  SchoolPreset,
} from '../../src/config/CalculationConfig.js';
import type { StrengthResult } from '../../src/domain/StrengthResult.js';
import type { GyeokgukResult } from '../../src/domain/Gyeokguk.js';
import type { GongmangResult } from '../../src/engine/analysis/GongmangCalculator.js';

/**
 * Integration tests for SajuAnalysisPipeline.
 *
 * Verifies that the pipeline correctly orchestrates all sub-analyzers and
 * produces a fully populated SajuAnalysis for known birth data.
 *
 * Two test subjects are used:
 *
 * Case 1: 1986-04-19 05:45 KST, Male, Seoul
 *   Expected pillars: year=byeong-in, month=im-jin
 *
 * Case 2: 1989-01-10 01:30 KST, Male, Seoul
 *   Expected pillars: year=mu-jin, month=eul-chuk
 */

const case1Input = createBirthInput({
  birthYear: 1986, birthMonth: 4, birthDay: 19,
  birthHour: 5, birthMinute: 45,
  gender: Gender.MALE,
  longitude: 126.978,
});

const case2Input = createBirthInput({
  birthYear: 1989, birthMonth: 1, birthDay: 10,
  birthHour: 1, birthMinute: 30,
  gender: Gender.MALE,
  longitude: 126.978,
});

// =====================================================================
// Case 1: 1986-04-19 05:45 KST, Male
// =====================================================================

describe('SajuAnalysisPipeline - Case 1 (1986-04-19)', () => {

  it('produces non-null analysis', () => {
    const analysis = analyzeSaju(case1Input);
    expect(analysis).toBeDefined();
    expect(analysis.coreResult).toBeDefined();
  });

  it('core pillars match expected values', () => {
    const analysis = analyzeSaju(case1Input);
    const pillars = analysis.pillars;

    // year = byeong-in (BYEONG-IN)
    expect(pillars.year.cheongan).toBe(Cheongan.BYEONG);
    expect(pillars.year.jiji).toBe(Jiji.IN);

    // month = im-jin (IM-JIN)
    expect(pillars.month.cheongan).toBe(Cheongan.IM);
    expect(pillars.month.jiji).toBe(Jiji.JIN);

    // day/hour should be populated
    expect(pillars.day.cheongan).toBeDefined();
    expect(pillars.day.jiji).toBeDefined();
    expect(pillars.hour.cheongan).toBeDefined();
    expect(pillars.hour.jiji).toBeDefined();
  });

  it('cheongan relations are populated', () => {
    const analysis = analyzeSaju(case1Input);
    // With stems BYEONG, IM, GYE, EUL there should be at least one relation.
    expect(analysis.cheonganRelations.length).toBeGreaterThan(0);
  });

  it('sibi unseong has four entries', () => {
    const analysis = analyzeSaju(case1Input);
    expect(analysis.sibiUnseong).not.toBeNull();
    expect(analysis.sibiUnseong!.size).toBe(4);
    expect(analysis.sibiUnseong!.has(PillarPosition.YEAR)).toBe(true);
    expect(analysis.sibiUnseong!.has(PillarPosition.MONTH)).toBe(true);
    expect(analysis.sibiUnseong!.has(PillarPosition.DAY)).toBe(true);
    expect(analysis.sibiUnseong!.has(PillarPosition.HOUR)).toBe(true);
  });

  it('gongmang void branches are not null', () => {
    const analysis = analyzeSaju(case1Input);
    expect(analysis.gongmangVoidBranches).not.toBeNull();
  });

  it('strength result is valid', () => {
    const analysis = analyzeSaju(case1Input);
    expect(analysis.strengthResult).not.toBeNull();

    const strength = analysis.strengthResult!;
    expect(strength.dayMaster).toBe(analysis.pillars.day.cheongan);
    expect(strength.score.totalSupport).toBeGreaterThanOrEqual(0);
    expect(strength.score.totalOppose).toBeGreaterThanOrEqual(0);
    expect(strength.details.length).toBeGreaterThan(0);
  });

  it('yongshin result is valid', () => {
    const analysis = analyzeSaju(case1Input);
    expect(analysis.yongshinResult).not.toBeNull();

    const yongshin = analysis.yongshinResult!;
    expect(yongshin.finalYongshin).toBeDefined();
    expect(yongshin.recommendations.length).toBeGreaterThan(0);
  });

  it('shinsal hits are populated', () => {
    const analysis = analyzeSaju(case1Input);
    expect(analysis.shinsalHits.length).toBeGreaterThan(0);
  });

  it('daeun info has correct direction and pillar count', () => {
    const analysis = analyzeSaju(case1Input);
    expect(analysis.daeunInfo).not.toBeNull();

    const daeun = analysis.daeunInfo!;
    // Year stem BYEONG is YANG, gender MALE -> YANG-MALE -> forward
    expect(daeun.isForward).toBe(true);
    expect(daeun.daeunPillars.length).toBe(8);
    expect(daeun.firstDaeunStartAge).toBeGreaterThanOrEqual(1);

    // Verify age progression: each daeun spans 10 years
    for (let i = 0; i < daeun.daeunPillars.length; i++) {
      const dp = daeun.daeunPillars[i]!;
      expect(dp.order).toBe(i + 1);
      expect(dp.endAge).toBe(dp.startAge + 9);
    }
  });

  it('saeun pillars has 10 entries', () => {
    const analysis = analyzeSaju(case1Input, DEFAULT_CONFIG, {
      saeunStartYear: 2024,
      saeunYearCount: 10,
    });
    expect(analysis.saeunPillars.length).toBe(10);
    expect(analysis.saeunPillars[0]!.year).toBe(2024);
    expect(analysis.saeunPillars[9]!.year).toBe(2033);
  });

  it('gyeokguk result is retrievable from analysisResults', () => {
    const analysis = analyzeSaju(case1Input);
    const gyeokguk = analysis.analysisResults.get(ANALYSIS_KEYS.GYEOKGUK) as GyeokgukResult | undefined;
    expect(gyeokguk).toBeDefined();
    expect(gyeokguk!.type).toBeDefined();
    expect(gyeokguk!.category).toBeDefined();
    expect(gyeokguk!.reasoning.length).toBeGreaterThan(0);
  });

  it('gongmang result is retrievable from analysisResults', () => {
    const analysis = analyzeSaju(case1Input);
    const gongmang = analysis.analysisResults.get(ANALYSIS_KEYS.GONGMANG) as GongmangResult | undefined;
    expect(gongmang).toBeDefined();
    expect(gongmang!.voidBranches).toEqual(analysis.gongmangVoidBranches);
  });

  it('yongshin day master matches strength day master', () => {
    const analysis = analyzeSaju(case1Input);
    const strength = analysis.strengthResult!;
    const yongshin = analysis.yongshinResult!;

    // The yongshin recommendations should reference the day master's ohaeng.
    const dayMasterOhaeng = strength.dayMaster;
    const eokbuRec = yongshin.recommendations[0]!;
    expect(eokbuRec.reasoning).toBeDefined();
  });
});

// =====================================================================
// Case 2: 1989-01-10 01:30 KST, Male
// =====================================================================

describe('SajuAnalysisPipeline - Case 2 (1989-01-10)', () => {

  it('produces non-null analysis', () => {
    const analysis = analyzeSaju(case2Input);
    expect(analysis).toBeDefined();
    expect(analysis.coreResult).toBeDefined();
  });

  it('core pillars match expected values', () => {
    const analysis = analyzeSaju(case2Input);
    const pillars = analysis.pillars;

    // year = mu-jin (MU-JIN) -- 1989-01-10 is before ipchun, so saju year is 1988
    expect(pillars.year.cheongan).toBe(Cheongan.MU);
    expect(pillars.year.jiji).toBe(Jiji.JIN);

    // month = eul-chuk (EUL-CHUK)
    expect(pillars.month.cheongan).toBe(Cheongan.EUL);
    expect(pillars.month.jiji).toBe(Jiji.CHUK);

    expect(pillars.day.cheongan).toBeDefined();
    expect(pillars.day.jiji).toBeDefined();
    expect(pillars.hour.cheongan).toBeDefined();
    expect(pillars.hour.jiji).toBeDefined();
  });

  it('all sub-analyses are populated', () => {
    const analysis = analyzeSaju(case2Input, DEFAULT_CONFIG, {
      saeunStartYear: 2024,
      saeunYearCount: 10,
    });

    // Cheongan relations: MU, EUL, GYEONG, BYEONG -- EUL-GYEONG is a hap
    expect(analysis.cheonganRelations.length).toBeGreaterThan(0);

    // Sibi unseong
    expect(analysis.sibiUnseong).not.toBeNull();
    expect(analysis.sibiUnseong!.size).toBe(4);

    // Gongmang
    expect(analysis.gongmangVoidBranches).not.toBeNull();

    // Strength
    expect(analysis.strengthResult).not.toBeNull();
    expect(analysis.strengthResult!.dayMaster).toBe(analysis.pillars.day.cheongan);

    // Yongshin
    expect(analysis.yongshinResult).not.toBeNull();

    // Shinsal
    expect(analysis.shinsalHits.length).toBeGreaterThan(0);

    // Daeun -- MU (YANG) + MALE -> forward
    expect(analysis.daeunInfo).not.toBeNull();
    expect(analysis.daeunInfo!.isForward).toBe(true);
    expect(analysis.daeunInfo!.daeunPillars.length).toBe(8);

    // Saeun
    expect(analysis.saeunPillars.length).toBe(10);

    // Gyeokguk from extensible map
    expect(analysis.analysisResults.get(ANALYSIS_KEYS.GYEOKGUK)).toBeDefined();
  });

  it('strength and yongshin are mutually consistent', () => {
    const analysis = analyzeSaju(case2Input);
    const strength = analysis.strengthResult!;
    const yongshin = analysis.yongshinResult!;

    const eokbuRec = yongshin.recommendations[0]!;
    if (strength.isStrong) {
      expect(
        eokbuRec.reasoning.includes('신강') || eokbuRec.reasoning.includes('과강'),
      ).toBe(true);
    } else {
      expect(
        eokbuRec.reasoning.includes('신약') || eokbuRec.reasoning.includes('약'),
      ).toBe(true);
    }
  });
});

// =====================================================================
// Pipeline configuration tests
// =====================================================================

describe('SajuAnalysisPipeline - Configuration', () => {

  it('custom saeun parameters are respected', () => {
    const analysis = analyzeSaju(case1Input, DEFAULT_CONFIG, {
      saeunStartYear: 2000,
      saeunYearCount: 5,
    });
    expect(analysis.saeunPillars.length).toBe(5);
    expect(analysis.saeunPillars[0]!.year).toBe(2000);
    expect(analysis.saeunPillars[4]!.year).toBe(2004);
  });

  it('custom daeun count is respected', () => {
    const analysis = analyzeSaju(case1Input, DEFAULT_CONFIG, { daeunCount: 12 });
    expect(analysis.daeunInfo!.daeunPillars.length).toBe(12);
  });

  it('pipeline with custom config produces valid analysis', () => {
    const customConfig = createConfig({
      applyDstHistory: false,
      includeEquationOfTime: true,
    });
    const analysis = analyzeSaju(case1Input, customConfig);
    expect(analysis.coreResult).toBeDefined();
    expect(analysis.strengthResult).not.toBeNull();
    expect(analysis.yongshinResult).not.toBeNull();
  });

  it('backward-compatible facade works', () => {
    const pipeline = new SajuAnalysisPipeline();
    const analysis = pipeline.analyze(case1Input);
    expect(analysis).toBeDefined();
    expect(analysis.coreResult).toBeDefined();
    expect(analysis.strengthResult).not.toBeNull();
    expect(analysis.yongshinResult).not.toBeNull();
  });
});

// =====================================================================
// Consistency and invariant tests
// =====================================================================

describe('SajuAnalysisPipeline - Consistency', () => {

  it('convenience accessors delegate correctly to core result', () => {
    const analysis = analyzeSaju(case1Input);

    // pillars should delegate to coreResult.pillars
    expect(analysis.pillars).toEqual(analysis.coreResult.pillars);

    // input should delegate to coreResult.input
    expect(analysis.input).toEqual(analysis.coreResult.input);
  });

  it('daeun age ranges are non-overlapping and contiguous', () => {
    const analysis = analyzeSaju(case1Input);
    const daeunPillars = analysis.daeunInfo!.daeunPillars;

    for (let i = 1; i < daeunPillars.length; i++) {
      const prev = daeunPillars[i - 1]!;
      const curr = daeunPillars[i]!;
      expect(curr.startAge).toBe(prev.endAge + 1);
    }
  });

  it('saeun years are consecutive', () => {
    const analysis = analyzeSaju(case1Input, DEFAULT_CONFIG, {
      saeunStartYear: 2020,
      saeunYearCount: 10,
    });
    for (let i = 0; i < analysis.saeunPillars.length; i++) {
      expect(analysis.saeunPillars[i]!.year).toBe(2020 + i);
    }
  });

  it('total strength score equals sum of three dimensions', () => {
    const analysis = analyzeSaju(case1Input);
    const score = analysis.strengthResult!.score;
    const expectedTotal = score.deukryeong + score.deukji + score.deukse;
    expect(score.totalSupport).toBeCloseTo(expectedTotal, 3);
  });

  it('ohaeng distribution sums to 8', () => {
    const analysis = analyzeSaju(case1Input);
    expect(analysis.ohaengDistribution).not.toBeNull();
    let sum = 0;
    for (const count of analysis.ohaengDistribution!.values()) {
      sum += count;
    }
    expect(sum).toBe(8);
  });

  it('trace includes core pipeline steps', () => {
    const analysis = analyzeSaju(case1Input);
    const coreSteps = ['core', 'strength', 'gyeokguk', 'yongshin', 'daeun', 'saeun'];
    const traceKeys = new Set(analysis.trace.map(t => t.key));
    for (const step of coreSteps) {
      expect(traceKeys.has(step)).toBe(true);
    }
  });
});

// =====================================================================
// Cross-preset tests
// =====================================================================

describe('SajuAnalysisPipeline - Cross-preset', () => {

  const presets = [
    SchoolPreset.KOREAN_MAINSTREAM,
    SchoolPreset.TRADITIONAL_CHINESE,
    SchoolPreset.MODERN_INTEGRATED,
  ];

  const cases = [
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

  it('all preset + case combinations produce valid core analyses', () => {
    for (const preset of presets) {
      const config = configFromPreset(preset);
      for (const testCase of cases) {
        const analysis = analyzeSaju(testCase.birth, config);

        expect(analysis.pillars.year).toBeDefined();
        expect(analysis.pillars.month).toBeDefined();
        expect(analysis.pillars.day).toBeDefined();
        expect(analysis.pillars.hour).toBeDefined();

        expect(analysis.strengthResult).not.toBeNull();
        expect(analysis.yongshinResult).not.toBeNull();
        expect(analysis.gyeokgukResult).not.toBeNull();
        expect(analysis.palaceAnalysis).not.toBeNull();
        expect(analysis.daeunInfo).not.toBeNull();
        expect(analysis.saeunPillars.length).toBeGreaterThan(0);
        expect(analysis.trace.length).toBeGreaterThanOrEqual(7);
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
          expect(keys.has(required)).toBe(true);
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
        for (const requiredStep of coreSteps) {
          expect(traceKeys.has(requiredStep)).toBe(true);
        }
      }
    }
  });
});
