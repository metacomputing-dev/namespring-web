import { describe, it, expect } from 'vitest';
import { calculatePillars, SajuPillarResult } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { configFromPreset, SchoolPreset, CalculationConfig } from '../../src/config/CalculationConfig.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { jijiOrdinal } from '../../src/domain/Jiji.js';

/**
 * P-03: Extreme longitude LMT day pillar transition tests.
 *
 * LMT correction formula: (birthLongitude - standardMeridian) * 4 minutes.
 * For Asia/Seoul (KST, UTC+9), the standard meridian is 135 degrees E.
 *
 * At extreme longitudes the LMT correction can shift the adjusted solar time by
 * several hours, potentially crossing midnight and changing the day pillar.
 * Tests verify that day/hour pillars correctly reflect the LMT-adjusted time,
 * while year and month pillars remain based on the standard moment (pre-LMT).
 */

const TIMEZONE = 'Asia/Seoul';
const config: CalculationConfig = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

function analyze(
  year: number, month: number, day: number,
  hour: number, minute: number,
  longitude: number,
  name = 'test',
): SajuPillarResult {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender: Gender.MALE, longitude, name,
  });
  return calculatePillars(input, config);
}

describe('ExtremeLongitudeLmt', () => {

  // =================================================================
  // 1. Longitude 180E (Date Line East)
  //    LMT = (180 - 135) * 4 = +180 min = +3h
  // =================================================================

  describe('Longitude 180E (Date Line East)', () => {
    it('birth at 23h with +3h LMT advances day pillar', () => {
      const at180 = analyze(2000, 6, 15, 23, 0, 180.0, 'lon180_23h');
      const atNoon = analyze(2000, 6, 15, 12, 0, 180.0, 'lon180_noon');
      const nextDaySeoul = analyze(2000, 6, 16, 12, 0, 126.978, 'next_day_seoul');

      // 23:00 at lon=180 => adjusted 02:00 next day => day pillar must advance vs noon
      const stemDiff = (cheonganOrdinal(at180.pillars.day.cheongan) - cheonganOrdinal(atNoon.pillars.day.cheongan) + 10) % 10;
      const branchDiff = (jijiOrdinal(at180.pillars.day.jiji) - jijiOrdinal(atNoon.pillars.day.jiji) + 12) % 12;
      expect(stemDiff).toBe(1);
      expect(branchDiff).toBe(1);

      // Should match the next calendar day's day pillar
      expect(at180.pillars.day.cheongan).toBe(nextDaySeoul.pillars.day.cheongan);
      expect(at180.pillars.day.jiji).toBe(nextDaySeoul.pillars.day.jiji);
    });

    it('all four pillars valid at longitude 180', () => {
      const result = analyze(2000, 6, 15, 14, 0, 180.0, 'lon180_valid');
      expect(result.pillars.year).toBeDefined();
      expect(result.pillars.month).toBeDefined();
      expect(result.pillars.day).toBeDefined();
      expect(result.pillars.hour).toBeDefined();
    });
  });

  // =================================================================
  // 2. Longitude 0 (Prime Meridian / Greenwich)
  //    LMT = (0 - 135) * 4 = -540 min = -9h
  // =================================================================

  describe('Longitude 0 (Prime Meridian)', () => {
    it('birth at 03h with -9h LMT retreats day pillar', () => {
      const atLon0 = analyze(2000, 6, 15, 3, 0, 0.0, 'lon0_03h');
      const sameDay = analyze(2000, 6, 15, 12, 0, 126.978, 'same_day_seoul');
      const prevDay = analyze(2000, 6, 14, 12, 0, 126.978, 'prev_day_seoul');

      // lon=0 at 03:00 - 9h = 18:00 previous day
      const stemDiff = (cheonganOrdinal(sameDay.pillars.day.cheongan) - cheonganOrdinal(atLon0.pillars.day.cheongan) + 10) % 10;
      const branchDiff = (jijiOrdinal(sameDay.pillars.day.jiji) - jijiOrdinal(atLon0.pillars.day.jiji) + 12) % 12;
      expect(stemDiff).toBe(1);
      expect(branchDiff).toBe(1);

      // Should match previous calendar day
      expect(atLon0.pillars.day.cheongan).toBe(prevDay.pillars.day.cheongan);
      expect(atLon0.pillars.day.jiji).toBe(prevDay.pillars.day.jiji);
    });
  });

  // =================================================================
  // 3. Longitude -180 (Date Line West, extreme negative LMT)
  //    LMT = (-180 - 135) * 4 = -1260 min = -21h
  // =================================================================

  describe('Longitude -180 (Date Line West)', () => {
    it('produces valid pillars at extreme negative longitude', () => {
      const result = analyze(2000, 6, 15, 22, 0, -180.0, 'lon_neg180_22h');
      expect(result.pillars.day).toBeDefined();
      expect(result.pillars.hour).toBeDefined();
    });

    it('day pillar shifts to previous day', () => {
      // LMT = -1260 min = -21h
      // Birth at noon (12:00) -> adjusted 12 - 21 = -9h = 15:00 previous day
      const atNeg180 = analyze(2000, 6, 15, 12, 0, -180.0, 'lon_neg180_noon');
      const prevDay = analyze(2000, 6, 14, 12, 0, 126.978, 'prev_day');

      expect(atNeg180.pillars.day.cheongan).toBe(prevDay.pillars.day.cheongan);
      expect(atNeg180.pillars.day.jiji).toBe(prevDay.pillars.day.jiji);
    });
  });

  // =================================================================
  // 4. Longitude 70E: LMT = (70-135)*4 = -260 min = -4h20m
  // =================================================================

  describe('Longitude 70E', () => {
    it('birth at 03h retreats day pillar', () => {
      // 03:00 - 4h20m = 22:40 previous day
      const atLon70 = analyze(2000, 6, 15, 3, 0, 70.0, 'lon70_03h');
      const prevDay = analyze(2000, 6, 14, 12, 0, 126.978, 'prev_day_for_lon70');

      expect(atLon70.pillars.day.cheongan).toBe(prevDay.pillars.day.cheongan);
      expect(atLon70.pillars.day.jiji).toBe(prevDay.pillars.day.jiji);
    });
  });

  // =================================================================
  // 5. Longitude 170E: LMT = (170-135)*4 = +140 min = +2h20m
  // =================================================================

  describe('Longitude 170E', () => {
    it('birth at 22h advances day pillar', () => {
      // 22:00 + 2h20m = 00:20 next day
      const atLon170 = analyze(2000, 6, 15, 22, 0, 170.0, 'lon170_22h');
      const nextDay = analyze(2000, 6, 16, 12, 0, 126.978, 'next_day_for_lon170');

      expect(atLon170.pillars.day.cheongan).toBe(nextDay.pillars.day.cheongan);
      expect(atLon170.pillars.day.jiji).toBe(nextDay.pillars.day.jiji);
    });
  });

  // =================================================================
  // 6. Day pillar continuity: consecutive days at extreme longitude
  // =================================================================

  describe('Day pillar continuity at extreme longitude', () => {
    it('consecutive days advance by exactly 1 at lon=180', () => {
      const day1 = analyze(2000, 6, 14, 12, 0, 180.0, 'lon180_day1');
      const day2 = analyze(2000, 6, 15, 12, 0, 180.0, 'lon180_day2');
      const day3 = analyze(2000, 6, 16, 12, 0, 180.0, 'lon180_day3');

      const stemDiff12 = (cheonganOrdinal(day2.pillars.day.cheongan) - cheonganOrdinal(day1.pillars.day.cheongan) + 10) % 10;
      const branchDiff12 = (jijiOrdinal(day2.pillars.day.jiji) - jijiOrdinal(day1.pillars.day.jiji) + 12) % 12;
      const stemDiff23 = (cheonganOrdinal(day3.pillars.day.cheongan) - cheonganOrdinal(day2.pillars.day.cheongan) + 10) % 10;
      const branchDiff23 = (jijiOrdinal(day3.pillars.day.jiji) - jijiOrdinal(day2.pillars.day.jiji) + 12) % 12;

      expect(stemDiff12).toBe(1);
      expect(branchDiff12).toBe(1);
      expect(stemDiff23).toBe(1);
      expect(branchDiff23).toBe(1);
    });
  });

  // =================================================================
  // 7. Hour pillar shifts with LMT at extreme longitude
  // =================================================================

  describe('Hour pillar LMT shift', () => {
    it('hour branch shifts with LMT at longitude 180', () => {
      // LMT = +3h at lon=180.
      // Seoul 10:00 => SA (09-11), lon180 10:00+3h=13:00 => MI (13-15)
      const atSeoul = analyze(2000, 6, 15, 10, 0, 126.978, 'seoul_10h');
      const atLon180 = analyze(2000, 6, 15, 10, 0, 180.0, 'lon180_10h');

      expect(atSeoul.pillars.hour.jiji).toBe(Jiji.SA);
      expect(atLon180.pillars.hour.jiji).toBe(Jiji.MI);
    });
  });

  // =================================================================
  // 8. Month pillar unchanged by extreme longitude
  // =================================================================

  describe('Month pillar unaffected by extreme LMT', () => {
    it('month pillar is same at different longitudes', () => {
      const atSeoul = analyze(2000, 6, 15, 12, 0, 126.978, 'seoul_month');
      const atLon180 = analyze(2000, 6, 15, 12, 0, 180.0, 'lon180_month');
      const atLon0 = analyze(2000, 6, 15, 12, 0, 0.0, 'lon0_month');

      expect(atSeoul.pillars.month.cheongan).toBe(atLon180.pillars.month.cheongan);
      expect(atSeoul.pillars.month.jiji).toBe(atLon180.pillars.month.jiji);
      expect(atSeoul.pillars.month.cheongan).toBe(atLon0.pillars.month.cheongan);
      expect(atSeoul.pillars.month.jiji).toBe(atLon0.pillars.month.jiji);
    });
  });

  // =================================================================
  // 9. Year pillar unchanged by extreme longitude
  // =================================================================

  describe('Year pillar unaffected by extreme LMT', () => {
    it('year pillar is same at different longitudes', () => {
      const atSeoul = analyze(2000, 6, 15, 12, 0, 126.978, 'seoul_year');
      const atLon180 = analyze(2000, 6, 15, 12, 0, 180.0, 'lon180_year');
      const atLonNeg180 = analyze(2000, 6, 15, 12, 0, -180.0, 'lon_neg180_year');

      expect(atSeoul.pillars.year.cheongan).toBe(atLon180.pillars.year.cheongan);
      expect(atSeoul.pillars.year.jiji).toBe(atLon180.pillars.year.jiji);
      expect(atSeoul.pillars.year.cheongan).toBe(atLonNeg180.pillars.year.cheongan);
      expect(atSeoul.pillars.year.jiji).toBe(atLonNeg180.pillars.year.jiji);
    });
  });

  // =================================================================
  // 10. Midnight crossing both directions
  // =================================================================

  describe('Midnight crossing both directions', () => {
    it('positive LMT keeps same day when not crossing midnight', () => {
      // At lon=170, LMT=+2h20m. Birth at 00:30 => adjusted 02:50 same day.
      const at0030Lon170 = analyze(2000, 6, 15, 0, 30, 170.0, 'lon170_0030');
      const noonLon170 = analyze(2000, 6, 15, 12, 0, 170.0, 'lon170_noon');

      expect(at0030Lon170.pillars.day.cheongan).toBe(noonLon170.pillars.day.cheongan);
      expect(at0030Lon170.pillars.day.jiji).toBe(noonLon170.pillars.day.jiji);
    });

    it('negative LMT retreats to previous day', () => {
      // At lon=70, LMT=-4h20m. Birth at 00:30 => adjusted 20:10 previous day.
      const at0030Lon70 = analyze(2000, 6, 15, 0, 30, 70.0, 'lon70_0030');
      const prevDayNoon = analyze(2000, 6, 14, 12, 0, 126.978, 'prev_day_noon');

      expect(at0030Lon70.pillars.day.cheongan).toBe(prevDayNoon.pillars.day.cheongan);
      expect(at0030Lon70.pillars.day.jiji).toBe(prevDayNoon.pillars.day.jiji);
    });
  });
});
