import { describe, it, expect } from 'vitest';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { standardMeridianDegrees, lmtOffsetMinutes } from '../../src/calendar/time/SolarTimeAdjuster.js';

/**
 * Global timezone regression test: verifies that international timezones
 * produce correct standard meridians and LMT corrections.
 *
 * Cities tested: New York, Los Angeles, Tokyo, Shanghai, Berlin, Sydney.
 */

interface ZoneCase {
  id: string;
  timezone: string;
  year: number; month: number; day: number;
  hour: number; minute: number;
  longitude: number;
  gender: Gender;
  expectedStandardMeridian: number;
  expectedLmtMinutes: number;
}

const cases: ZoneCase[] = [
  {
    id: 'EST_NY', timezone: 'America/New_York',
    year: 1990, month: 3, day: 15, hour: 9, minute: 0,
    longitude: -74.006, gender: Gender.MALE,
    expectedStandardMeridian: -75.0, expectedLmtMinutes: 4,
  },
  {
    id: 'PST_LA', timezone: 'America/Los_Angeles',
    year: 1985, month: 8, day: 20, hour: 14, minute: 0,
    longitude: -118.243, gender: Gender.FEMALE,
    expectedStandardMeridian: -120.0, expectedLmtMinutes: 7,
  },
  {
    id: 'JST_TYO', timezone: 'Asia/Tokyo',
    year: 1992, month: 12, day: 1, hour: 6, minute: 0,
    longitude: 139.690, gender: Gender.MALE,
    expectedStandardMeridian: 135.0, expectedLmtMinutes: 19,
  },
  {
    id: 'CST_SHA', timezone: 'Asia/Shanghai',
    year: 1988, month: 6, day: 15, hour: 11, minute: 0,
    longitude: 121.473, gender: Gender.FEMALE,
    expectedStandardMeridian: 120.0, expectedLmtMinutes: 6,
  },
  {
    id: 'CET_BER', timezone: 'Europe/Berlin',
    year: 1995, month: 1, day: 10, hour: 20, minute: 0,
    longitude: 13.405, gender: Gender.MALE,
    expectedStandardMeridian: 15.0, expectedLmtMinutes: -6,
  },
  {
    id: 'AEST_SYD', timezone: 'Australia/Sydney',
    year: 2000, month: 9, day: 25, hour: 15, minute: 0,
    longitude: 151.209, gender: Gender.FEMALE,
    expectedStandardMeridian: 150.0, expectedLmtMinutes: 5,
  },
];

describe('GlobalTimezoneRegressionTest', () => {
  it('each timezone yields correct standard meridian and LMT correction', () => {
    for (const c of cases) {
      const meridian = standardMeridianDegrees(c.timezone);
      expect(meridian, `${c.id}: standard meridian`).toBe(c.expectedStandardMeridian);

      const lmt = lmtOffsetMinutes(c.longitude, meridian);
      expect(lmt, `${c.id}: LMT minutes`).toBe(c.expectedLmtMinutes);

      const cfg = createConfig({
        dayCutMode: DayCutMode.MIDNIGHT_00,
        applyDstHistory: false,
        includeEquationOfTime: false,
        lmtBaselineLongitude: meridian,
      });
      const input = createBirthInput({
        birthYear: c.year, birthMonth: c.month, birthDay: c.day,
        birthHour: c.hour, birthMinute: c.minute,
        gender: c.gender, timezone: c.timezone,
        longitude: c.longitude, latitude: 37.0,
      });
      const result = calculatePillars(input, cfg);

      expect(result.longitudeCorrectionMinutes, `${c.id}: engine LMT`).toBe(c.expectedLmtMinutes);
      expect(result.pillars.year).toBeDefined();
      expect(result.pillars.month).toBeDefined();
      expect(result.pillars.day).toBeDefined();
      expect(result.pillars.hour).toBeDefined();
    }
  });

  it('different timezones produce different hour pillars for same local time', () => {
    // Seoul 21:00 KST vs Berlin 13:00 CET -- different local hours
    const seoulCfg = createConfig({
      dayCutMode: DayCutMode.MIDNIGHT_00,
      applyDstHistory: false,
      includeEquationOfTime: false,
      lmtBaselineLongitude: 135.0,
    });
    const berlinCfg = createConfig({
      dayCutMode: DayCutMode.MIDNIGHT_00,
      applyDstHistory: false,
      includeEquationOfTime: false,
      lmtBaselineLongitude: 15.0,
    });

    const seoulInput = createBirthInput({
      birthYear: 1995, birthMonth: 1, birthDay: 10, birthHour: 21, birthMinute: 0,
      gender: Gender.MALE, timezone: 'Asia/Seoul', longitude: 126.978,
    });
    const berlinInput = createBirthInput({
      birthYear: 1995, birthMonth: 1, birthDay: 10, birthHour: 13, birthMinute: 0,
      gender: Gender.MALE, timezone: 'Europe/Berlin', longitude: 13.405,
    });

    const seoulResult = calculatePillars(seoulInput, seoulCfg);
    const berlinResult = calculatePillars(berlinInput, berlinCfg);

    // Different local clock times should produce different hour pillars
    expect(seoulResult.pillars.hour.equals(berlinResult.pillars.hour)).toBe(false);
  });
});
