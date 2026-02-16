import { describe, it, expect } from 'vitest';
import { calculatePillars, SajuPillarResult } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig, configFromPreset, SchoolPreset, CalculationConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { Pillar } from '../../src/domain/Pillar.js';
import { cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { jijiOrdinal } from '../../src/domain/Jiji.js';

/**
 * ACC-2: LMT (Local Mean Time) midnight crossing tests.
 *
 * Verifies that when LMT longitude correction pushes the adjusted solar time
 * across a calendar midnight boundary, the day pillar is assigned to the
 * correct date. LMT formula: correction = (birthLongitude - standardMeridian) * 4 minutes.
 *
 * For Korea (Asia/Seoul, UTC+9), the standard meridian is 135 degrees E.
 *
 * Key scenarios:
 * - Negative correction (longitude < 135) pulling time backward across midnight
 * - Positive correction (longitude > 135) pushing time forward across midnight
 * - Interaction with DayCutMode (MIDNIGHT_00 vs YAZA modes)
 * - Consecutive-day invariant: day pillars 24h apart differ by exactly 1 ganji index
 * - Extreme longitudes (70E and 170E)
 */

const TIMEZONE = 'Asia/Seoul';

function configWith(mode: DayCutMode): CalculationConfig {
  return {
    ...configFromPreset(SchoolPreset.KOREAN_MAINSTREAM),
    dayCutMode: mode,
    applyDstHistory: false,
    includeEquationOfTime: false,
  };
}

function calc(
  year: number, month: number, day: number,
  hour: number, minute: number,
  longitude: number, config: CalculationConfig,
): SajuPillarResult {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender: Gender.MALE,
    longitude,
    name: 'LMT-test',
  });
  return calculatePillars(input, config);
}

/**
 * Recover sexagenary (60-cycle) index from a pillar using CRT.
 * index = (6 * stemOrd - 5 * branchOrd) mod 60
 */
function sexagenaryIndex(pillar: Pillar): number {
  const s = cheonganOrdinal(pillar.cheongan);
  const b = jijiOrdinal(pillar.jiji);
  return ((6 * s - 5 * b) % 60 + 60) % 60;
}

describe('LmtMidnightCrossing', () => {
  // =========================================================================
  // Scenario 1: Negative LMT correction crosses midnight backward
  //
  // Birth: 2024-03-15 00:30 KST, longitude 100E
  // LMT correction = (100 - 135) * 4 = -140 minutes
  // Adjusted solar time = 00:30 - 2h20m = 2024-03-14 22:10
  // => Day pillar should use March 14 in MIDNIGHT_00 mode.
  // =========================================================================

  it('negative LMT pushes before midnight (MIDNIGHT_00 mode)', () => {
    const config = configWith(DayCutMode.MIDNIGHT_00);
    const result = calc(2024, 3, 15, 0, 30, 100.0, config);
    const march14Pillar = GanjiCycle.dayPillarByJdn(2024, 3, 14);
    expect(result.pillars.day.equals(march14Pillar)).toBe(true);
  });

  it('negative LMT pushes before midnight (YAZA mode)', () => {
    const config = configWith(DayCutMode.YAZA_23_TO_01_NEXTDAY);
    const result = calc(2024, 3, 15, 0, 30, 100.0, config);
    // Adjusted = 2024-03-14 22:10, hour 22 does NOT trigger YAZA advancement
    const march14Pillar = GanjiCycle.dayPillarByJdn(2024, 3, 14);
    expect(result.pillars.day.equals(march14Pillar)).toBe(true);
  });

  // =========================================================================
  // Scenario 2: Positive LMT correction crosses midnight forward
  //
  // Birth: 2024-03-15 23:30 KST, longitude 160E
  // LMT correction = (160 - 135) * 4 = +100 minutes
  // Adjusted solar time = 23:30 + 1h40m = 2024-03-16 01:10
  // =========================================================================

  it('positive LMT pushes after midnight (MIDNIGHT_00 mode)', () => {
    const config = configWith(DayCutMode.MIDNIGHT_00);
    const result = calc(2024, 3, 15, 23, 30, 160.0, config);
    const march16Pillar = GanjiCycle.dayPillarByJdn(2024, 3, 16);
    expect(result.pillars.day.equals(march16Pillar)).toBe(true);
  });

  it('positive LMT pushes after midnight (YAZA mode)', () => {
    const config = configWith(DayCutMode.YAZA_23_TO_01_NEXTDAY);
    const result = calc(2024, 3, 15, 23, 30, 160.0, config);
    // Adjusted = 2024-03-16 01:10, hour 01 does NOT trigger YAZA advancement
    const march16Pillar = GanjiCycle.dayPillarByJdn(2024, 3, 16);
    expect(result.pillars.day.equals(march16Pillar)).toBe(true);
  });

  // =========================================================================
  // Scenario 3: Negative LMT lands in YAZA window (23:xx)
  //
  // Birth: 2024-03-15 00:05 KST, longitude 120E
  // LMT correction = (120 - 135) * 4 = -60 minutes
  // Adjusted solar time = 00:05 - 1h00m = 2024-03-14 23:05
  // =========================================================================

  it('negative LMT lands in YAZA window - MIDNIGHT_00 uses current date', () => {
    const config = configWith(DayCutMode.MIDNIGHT_00);
    const result = calc(2024, 3, 15, 0, 5, 120.0, config);
    const march14Pillar = GanjiCycle.dayPillarByJdn(2024, 3, 14);
    expect(result.pillars.day.equals(march14Pillar)).toBe(true);
  });

  it('negative LMT lands in YAZA window - YAZA mode advances day', () => {
    const config = configWith(DayCutMode.YAZA_23_TO_01_NEXTDAY);
    const result = calc(2024, 3, 15, 0, 5, 120.0, config);
    // Adjusted = 2024-03-14 23:05, hour == 23 triggers advancement to March 15
    const march15Pillar = GanjiCycle.dayPillarByJdn(2024, 3, 15);
    expect(result.pillars.day.equals(march15Pillar)).toBe(true);
  });

  it('negative LMT lands in YAZA window - YAZA_23_30 does not advance before 23:30', () => {
    const config = configWith(DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY);
    const result = calc(2024, 3, 15, 0, 5, 120.0, config);
    // Adjusted = 2024-03-14 23:05, before 23:30, so NO advancement
    const march14Pillar = GanjiCycle.dayPillarByJdn(2024, 3, 14);
    expect(result.pillars.day.equals(march14Pillar)).toBe(true);
  });

  it('negative LMT lands in YAZA window - YAZA_23_30 advances after 23:30', () => {
    const config = configWith(DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY);
    // Birth at 00:35 with LMT -60min => adjusted = 23:35 => should advance
    const result = calc(2024, 3, 15, 0, 35, 120.0, config);
    const march15Pillar = GanjiCycle.dayPillarByJdn(2024, 3, 15);
    expect(result.pillars.day.equals(march15Pillar)).toBe(true);
  });

  // =========================================================================
  // Consecutive-day invariant
  // =========================================================================

  it('consecutive day invariant: day pillars 24h apart differ by exactly 1', () => {
    const config = configWith(DayCutMode.MIDNIGHT_00);
    const testLongitudes = [70.0, 100.0, 126.978, 135.0, 160.0, 170.0];

    for (const longitude of testLongitudes) {
      const result1 = calc(2024, 6, 15, 12, 0, longitude, config);
      const result2 = calc(2024, 6, 16, 12, 0, longitude, config);

      const index1 = sexagenaryIndex(result1.pillars.day);
      const index2 = sexagenaryIndex(result2.pillars.day);
      const diff = ((index2 - index1) % 60 + 60) % 60;

      expect(diff).toBe(1);
    }
  });

  it('consecutive day invariant holds near midnight with LMT correction', () => {
    const config = configWith(DayCutMode.MIDNIGHT_00);
    // At longitude 100, LMT = -140min. Birth at 14:00 => adjusted 11:40 (safe from midnight)
    const result1 = calc(2024, 1, 10, 14, 0, 100.0, config);
    const result2 = calc(2024, 1, 11, 14, 0, 100.0, config);

    const diff = ((sexagenaryIndex(result2.pillars.day) - sexagenaryIndex(result1.pillars.day)) % 60 + 60) % 60;
    expect(diff).toBe(1);
  });

  // =========================================================================
  // Extreme longitude tests: 70E and 170E
  // =========================================================================

  it('extreme west longitude 70E: large negative correction', () => {
    const config = configWith(DayCutMode.MIDNIGHT_00);
    // Birth 2024-07-01 04:00, longitude 70E
    // LMT = -260 min => adjusted = 04:00 - 4h20m = 2024-06-30 23:40
    const result = calc(2024, 7, 1, 4, 0, 70.0, config);
    const june30Pillar = GanjiCycle.dayPillarByJdn(2024, 6, 30);
    expect(result.pillars.day.equals(june30Pillar)).toBe(true);
  });

  it('extreme west longitude 70E: YAZA mode interaction', () => {
    const config = configWith(DayCutMode.YAZA_23_TO_01_NEXTDAY);
    // LMT = -260 min => adjusted = 2024-06-30 23:40
    // YAZA: hour=23 => advance to July 1
    const result = calc(2024, 7, 1, 4, 0, 70.0, config);
    const july1Pillar = GanjiCycle.dayPillarByJdn(2024, 7, 1);
    expect(result.pillars.day.equals(july1Pillar)).toBe(true);
  });

  it('extreme east longitude 170E: large positive correction', () => {
    const config = configWith(DayCutMode.MIDNIGHT_00);
    // Birth 2024-07-01 22:00, longitude 170E
    // LMT = +140 min => adjusted = 22:00 + 2h20m = 2024-07-02 00:20
    const result = calc(2024, 7, 1, 22, 0, 170.0, config);
    const july2Pillar = GanjiCycle.dayPillarByJdn(2024, 7, 2);
    expect(result.pillars.day.equals(july2Pillar)).toBe(true);
  });

  it('extreme east longitude 170E: YAZA mode does not double advance', () => {
    const config = configWith(DayCutMode.YAZA_23_TO_01_NEXTDAY);
    // LMT = +140 min => adjusted = 2024-07-02 00:20
    // YAZA: hour=0 does NOT trigger advancement. Day pillar = July 2
    const result = calc(2024, 7, 1, 22, 0, 170.0, config);
    const july2Pillar = GanjiCycle.dayPillarByJdn(2024, 7, 2);
    expect(result.pillars.day.equals(july2Pillar)).toBe(true);
  });

  // =========================================================================
  // Cross-mode comparison
  // =========================================================================

  it('all DayCutModes compared when adjusted hour is 23', () => {
    // Birth 2024-03-15 00:05, longitude 120E
    // LMT = -60min => adjusted = 2024-03-14 23:05
    const midnightResult = calc(2024, 3, 15, 0, 5, 120.0, configWith(DayCutMode.MIDNIGHT_00));
    const yazaResult = calc(2024, 3, 15, 0, 5, 120.0, configWith(DayCutMode.YAZA_23_TO_01_NEXTDAY));
    const yaza2330Result = calc(2024, 3, 15, 0, 5, 120.0, configWith(DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY));
    const jojaResult = calc(2024, 3, 15, 0, 5, 120.0, configWith(DayCutMode.JOJA_SPLIT));

    // MIDNIGHT_00 and JOJA_SPLIT should agree at hour 23
    expect(midnightResult.pillars.day.equals(jojaResult.pillars.day)).toBe(true);

    // YAZA should differ from MIDNIGHT_00 at hour 23
    expect(midnightResult.pillars.day.equals(yazaResult.pillars.day)).toBe(false);

    // YAZA_23_30: adjusted 23:05 < 23:30, NO advancement (same as MIDNIGHT_00)
    expect(midnightResult.pillars.day.equals(yaza2330Result.pillars.day)).toBe(true);
  });

  // =========================================================================
  // LMT correction is reported in result
  // =========================================================================

  it('negative LMT correction is reported', () => {
    const config = configWith(DayCutMode.MIDNIGHT_00);
    const result = calc(2024, 6, 15, 12, 0, 100.0, config);
    // LMT = (100 - 135) * 4 = -140
    expect(result.longitudeCorrectionMinutes).toBe(-140);
  });

  it('positive LMT correction is reported', () => {
    const config = configWith(DayCutMode.MIDNIGHT_00);
    const result = calc(2024, 6, 15, 12, 0, 160.0, config);
    // LMT = (160 - 135) * 4 = +100
    expect(result.longitudeCorrectionMinutes).toBe(100);
  });
});
