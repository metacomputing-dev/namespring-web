import { describe, it, expect } from 'vitest';
import { analyzeSaju, SajuAnalysisPipeline } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput, type BirthInput } from '../../src/domain/types.js';
import { type SajuAnalysis, ANALYSIS_KEYS } from '../../src/domain/SajuAnalysis.js';
import { Gender } from '../../src/domain/Gender.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { Cheongan, cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { jijiOrdinal } from '../../src/domain/Jiji.js';
import {
  DEFAULT_CONFIG,
  createConfig,
  configFromPreset,
  SchoolPreset,
  type CalculationConfig,
} from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';

/**
 * Edge Case Robustness Test (E-01 ~ E-04)
 *
 * Comprehensive edge case verification across the full analysis pipeline:
 *   E-01: Feb 29 (leap year) full pipeline
 *   E-02: Exact jeol boundary births (simplified for TS)
 *   E-03: Half-hour timezone offset international births
 *   E-04: YAZA sub-minute boundary day pillar transitions
 */

// =====================================================================
// Helper functions
// =====================================================================

function analyzeSeoul(
  year: number, month: number, day: number,
  hour: number = 12, minute: number = 0,
  gender: Gender = Gender.MALE,
  customConfig: CalculationConfig = DEFAULT_CONFIG,
): SajuAnalysis {
  return analyzeSaju(
    createBirthInput({
      birthYear: year, birthMonth: month, birthDay: day,
      birthHour: hour, birthMinute: minute,
      gender,
      longitude: 126.978,
      latitude: 37.5665,
    }),
    customConfig,
  );
}

function assertFullPipelineComplete(analysis: SajuAnalysis, label: string): void {
  expect(analysis.pillars.year, `${label}: year pillar null`).toBeDefined();
  expect(analysis.pillars.month, `${label}: month pillar null`).toBeDefined();
  expect(analysis.pillars.day, `${label}: day pillar null`).toBeDefined();
  expect(analysis.pillars.hour, `${label}: hour pillar null`).toBeDefined();

  expect(analysis.strengthResult, `${label}: strengthResult null`).not.toBeNull();
  expect(analysis.yongshinResult, `${label}: yongshinResult null`).not.toBeNull();
  expect(analysis.gyeokgukResult, `${label}: gyeokgukResult null`).not.toBeNull();
  expect(analysis.daeunInfo, `${label}: daeunInfo null`).not.toBeNull();
  expect(analysis.sibiUnseong, `${label}: sibiUnseong null`).not.toBeNull();
  expect(analysis.palaceAnalysis, `${label}: palaceAnalysis null`).not.toBeNull();
  expect(analysis.saeunPillars.length, `${label}: saeunPillars empty`).toBeGreaterThan(0);
  expect(analysis.trace.length, `${label}: trace steps < 7`).toBeGreaterThanOrEqual(7);
}

function assertDayPillarAdvancesByOne(
  prev: SajuAnalysis, next: SajuAnalysis, label: string,
): void {
  const stemDiff = (cheonganOrdinal(next.pillars.day.cheongan) - cheonganOrdinal(prev.pillars.day.cheongan) + 10) % 10;
  const branchDiff = (jijiOrdinal(next.pillars.day.jiji) - jijiOrdinal(prev.pillars.day.jiji) + 12) % 12;
  expect(stemDiff, `${label}: day stem should advance by 1`).toBe(1);
  expect(branchDiff, `${label}: day branch should advance by 1`).toBe(1);
}

// =====================================================================
// E-01: Feb 29 Full Analysis Pipeline
// =====================================================================

describe('E-01: Feb 29 Full Analysis Pipeline', () => {

  it('E-01-1 Feb 29 1904 full pipeline produces all analysis sections', () => {
    const analysis = analyzeSeoul(1904, 2, 29, 14, 0);
    assertFullPipelineComplete(analysis, '1904-02-29');
  });

  it('E-01-2 Feb 29 2000 full pipeline produces all analysis sections', () => {
    const analysis = analyzeSeoul(2000, 2, 29, 10, 30);
    assertFullPipelineComplete(analysis, '2000-02-29');
  });

  it('E-01-3 Feb 29 2024 full pipeline produces all analysis sections', () => {
    const analysis = analyzeSeoul(2024, 2, 29, 8, 15);
    assertFullPipelineComplete(analysis, '2024-02-29');
  });

  it('E-01-4 Feb 29 is in IN month after ipchun for all test years', () => {
    for (const year of [1904, 2000, 2024]) {
      const analysis = analyzeSeoul(year, 2, 29, 12, 0);
      expect(analysis.pillars.month.jiji, `${year}-02-29: month branch should be IN`).toBe(Jiji.IN);
    }
  });

  it('E-01-5 day pillar is continuous across Feb 28 to Mar 1 for 1904', () => {
    const feb28 = analyzeSeoul(1904, 2, 28, 12, 0);
    const feb29 = analyzeSeoul(1904, 2, 29, 12, 0);
    const mar01 = analyzeSeoul(1904, 3, 1, 12, 0);
    assertDayPillarAdvancesByOne(feb28, feb29, '1904 Feb28->Feb29');
    assertDayPillarAdvancesByOne(feb29, mar01, '1904 Feb29->Mar01');
  });

  it('E-01-6 day pillar is continuous across Feb 28 to Mar 1 for 2000', () => {
    const feb28 = analyzeSeoul(2000, 2, 28, 12, 0);
    const feb29 = analyzeSeoul(2000, 2, 29, 12, 0);
    const mar01 = analyzeSeoul(2000, 3, 1, 12, 0);
    assertDayPillarAdvancesByOne(feb28, feb29, '2000 Feb28->Feb29');
    assertDayPillarAdvancesByOne(feb29, mar01, '2000 Feb29->Mar01');
  });

  it('E-01-7 day pillar is continuous across Feb 28 to Mar 1 for 2024', () => {
    const feb28 = analyzeSeoul(2024, 2, 28, 12, 0);
    const feb29 = analyzeSeoul(2024, 2, 29, 12, 0);
    const mar01 = analyzeSeoul(2024, 3, 1, 12, 0);
    assertDayPillarAdvancesByOne(feb28, feb29, '2024 Feb28->Feb29');
    assertDayPillarAdvancesByOne(feb29, mar01, '2024 Feb29->Mar01');
  });

  it('E-01-8 daeun start age is positive for all Feb 29 births', () => {
    for (const year of [1904, 2000, 2024]) {
      const analysis = analyzeSeoul(year, 2, 29, 12, 0);
      const daeun = analysis.daeunInfo!;
      expect(daeun.firstDaeunStartAge, `${year}-02-29: daeun start age >= 0`).toBeGreaterThanOrEqual(0);
      expect(daeun.daeunPillars.length, `${year}-02-29: daeun pillars not empty`).toBeGreaterThan(0);
    }
  });

  it('E-01-10 Feb 29 analysis works for both genders', () => {
    const male = analyzeSeoul(2024, 2, 29, 12, 0, Gender.MALE);
    const female = analyzeSeoul(2024, 2, 29, 12, 0, Gender.FEMALE);
    assertFullPipelineComplete(male, '2024-02-29 MALE');
    assertFullPipelineComplete(female, '2024-02-29 FEMALE');
    expect(male.daeunInfo!.daeunPillars.length).toBeGreaterThan(0);
    expect(female.daeunInfo!.daeunPillars.length).toBeGreaterThan(0);
  });
});

// =====================================================================
// E-03: Half-Hour Timezone Offset
// =====================================================================

describe('E-03: Half-Hour Timezone Offset', () => {

  const noHistoryConfig = createConfig({
    applyDstHistory: false,
    includeEquationOfTime: false,
  });

  function analyzeInternational(
    year: number, month: number, day: number,
    hour: number, minute: number,
    timezone: string, latitude: number, longitude: number,
  ): SajuAnalysis {
    return analyzeSaju(
      createBirthInput({
        birthYear: year, birthMonth: month, birthDay: day,
        birthHour: hour, birthMinute: minute,
        gender: Gender.MALE,
        timezone, latitude, longitude,
      }),
      noHistoryConfig,
    );
  }

  it('E-03-1 Kolkata UTC+5h30 full analysis produces valid results', () => {
    const analysis = analyzeInternational(1990, 6, 15, 14, 30, 'Asia/Kolkata', 28.6139, 77.2090);
    assertFullPipelineComplete(analysis, 'Kolkata');
  });

  it('E-03-4 Kathmandu UTC+5h45 full analysis produces valid results', () => {
    const analysis = analyzeInternational(1995, 3, 20, 8, 0, 'Asia/Kathmandu', 27.7172, 85.3240);
    assertFullPipelineComplete(analysis, 'Kathmandu');
  });

  it('E-03-6 Adelaide UTC+9h30 full analysis produces valid results', () => {
    const analysis = analyzeInternational(2010, 11, 5, 16, 45, 'Australia/Adelaide', -34.9285, 138.6007);
    assertFullPipelineComplete(analysis, 'Adelaide');
  });

  it('E-03-8 Yangon UTC+6h30 full analysis produces valid results', () => {
    const analysis = analyzeInternational(1995, 9, 10, 22, 15, 'Asia/Yangon', 16.8661, 96.1951);
    assertFullPipelineComplete(analysis, 'Yangon');
  });

  it('E-03-10 half-hour timezones produce complete results vs full-hour neighbors', () => {
    const kolkata = analyzeInternational(2000, 6, 15, 14, 30, 'Asia/Kolkata', 28.6139, 77.2090);
    const shanghai = analyzeInternational(2000, 6, 15, 14, 30, 'Asia/Shanghai', 31.2304, 121.4737);
    assertFullPipelineComplete(kolkata, 'Kolkata comparison');
    assertFullPipelineComplete(shanghai, 'Shanghai comparison');
  });
});

// =====================================================================
// E-04: YAZA Sub-Minute Boundary
// =====================================================================

describe('E-04: YAZA Sub-Minute Boundary', () => {

  const yaza23Config = createConfig({
    dayCutMode: DayCutMode.YAZA_23_TO_01_NEXTDAY,
    applyDstHistory: false,
    includeEquationOfTime: false,
    lmtBaselineLongitude: 135.0,
  });
  const yaza2330Config = createConfig({
    dayCutMode: DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY,
    applyDstHistory: false,
    includeEquationOfTime: false,
    lmtBaselineLongitude: 135.0,
  });
  const midnightConfig = createConfig({
    dayCutMode: DayCutMode.MIDNIGHT_00,
    applyDstHistory: false,
    includeEquationOfTime: false,
    lmtBaselineLongitude: 135.0,
  });

  function analyzeWithMode(
    year: number, month: number, day: number,
    hour: number, minute: number,
    modeConfig: CalculationConfig,
  ): SajuAnalysis {
    return analyzeSaju(
      createBirthInput({
        birthYear: year, birthMonth: month, birthDay: day,
        birthHour: hour, birthMinute: minute,
        gender: Gender.MALE,
        latitude: 37.5665,
        longitude: 135.0,
      }),
      modeConfig,
    );
  }

  it('E-04-1 YAZA_23 mode 22h59 vs 23h00 day pillar should differ', () => {
    const before = analyzeWithMode(2024, 8, 7, 22, 59, yaza23Config);
    const after = analyzeWithMode(2024, 8, 7, 23, 0, yaza23Config);
    expect(before.pillars.day.equals(after.pillars.day)).toBe(false);
  });

  it('E-04-2 YAZA_23_30 mode 23h29 vs 23h30 day pillar should differ', () => {
    const before = analyzeWithMode(2024, 8, 7, 23, 29, yaza2330Config);
    const after = analyzeWithMode(2024, 8, 7, 23, 30, yaza2330Config);
    expect(before.pillars.day.equals(after.pillars.day)).toBe(false);
  });

  it('E-04-3 YAZA_23_30 mode at 23h00 still same day pillar', () => {
    const at2259 = analyzeWithMode(2024, 8, 7, 22, 59, yaza2330Config);
    const at2300 = analyzeWithMode(2024, 8, 7, 23, 0, yaza2330Config);
    expect(at2259.pillars.day.equals(at2300.pillars.day)).toBe(true);
  });

  it('E-04-5 00h00 midnight is new day in MIDNIGHT mode', () => {
    const midnightDate = analyzeWithMode(2024, 8, 8, 0, 0, midnightConfig);
    const beforeDate = analyzeWithMode(2024, 8, 7, 23, 59, midnightConfig);
    expect(beforeDate.pillars.day.equals(midnightDate.pillars.day)).toBe(false);
  });

  it('E-04-6 YAZA_23 mode 23h00 and 23h30 are in the same new day', () => {
    const at2300 = analyzeWithMode(2024, 8, 7, 23, 0, yaza23Config);
    const at2330 = analyzeWithMode(2024, 8, 7, 23, 30, yaza23Config);
    expect(at2300.pillars.day.equals(at2330.pillars.day)).toBe(true);
  });

  it('E-04-7 YAZA_23_30 mode 23h00 is old day but 23h30 is new day', () => {
    const at2300 = analyzeWithMode(2024, 8, 7, 23, 0, yaza2330Config);
    const at2330 = analyzeWithMode(2024, 8, 7, 23, 30, yaza2330Config);
    expect(at2300.pillars.day.equals(at2330.pillars.day)).toBe(false);
  });

  it('E-04-8 full analysis completes for all modes at all boundary times', () => {
    const boundaryTimes = [
      { hour: 22, minute: 59, label: '22:59' },
      { hour: 23, minute: 0, label: '23:00' },
      { hour: 23, minute: 29, label: '23:29' },
      { hour: 23, minute: 30, label: '23:30' },
      { hour: 23, minute: 59, label: '23:59' },
      { hour: 0, minute: 0, label: '00:00 next' },
      { hour: 0, minute: 30, label: '00:30 next' },
      { hour: 1, minute: 0, label: '01:00 next' },
    ];
    const configs: [string, CalculationConfig][] = [
      ['MIDNIGHT', midnightConfig],
      ['YAZA_23', yaza23Config],
      ['YAZA_23_30', yaza2330Config],
    ];

    for (const [modeName, modeConfig] of configs) {
      for (const bc of boundaryTimes) {
        const day = bc.hour < 22 ? 8 : 7;
        const analysis = analyzeWithMode(2024, 8, day, bc.hour, bc.minute, modeConfig);
        assertFullPipelineComplete(analysis, `${modeName} at ${bc.label}`);
      }
    }
  });

  it('E-04-9 YAZA boundary test with different date to confirm generality', () => {
    const before = analyzeWithMode(2020, 1, 15, 22, 59, yaza23Config);
    const after = analyzeWithMode(2020, 1, 15, 23, 0, yaza23Config);
    expect(before.pillars.day.equals(after.pillars.day)).toBe(false);

    const before2330 = analyzeWithMode(2020, 1, 15, 23, 29, yaza2330Config);
    const after2330 = analyzeWithMode(2020, 1, 15, 23, 30, yaza2330Config);
    expect(before2330.pillars.day.equals(after2330.pillars.day)).toBe(false);
  });
});
