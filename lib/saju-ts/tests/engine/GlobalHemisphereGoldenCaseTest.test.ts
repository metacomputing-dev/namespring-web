import { describe, it, expect } from 'vitest';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { standardMeridianDegrees, lmtOffsetMinutes } from '../../src/calendar/time/SolarTimeAdjuster.js';

/**
 * Southern and western hemisphere golden cases: verifies that the engine
 * correctly handles cities across all four hemispheres.
 *
 * Cities: Sydney, Buenos Aires, Cape Town, London, Reykjavik, Honolulu.
 */

interface HemisphereCase {
  id: string;
  timezone: string;
  year: number; month: number; day: number;
  hour: number; minute: number;
  longitude: number;
  latitude: number;
  gender: Gender;
  expectedStandardMeridian: number;
  expectedLmtMinutes: number;
}

const cases: HemisphereCase[] = [
  {
    id: 'SYDNEY', timezone: 'Australia/Sydney',
    year: 2000, month: 9, day: 25, hour: 15, minute: 0,
    longitude: 151.2093, latitude: -33.8688,
    gender: Gender.FEMALE,
    expectedStandardMeridian: 150.0, expectedLmtMinutes: 5,
  },
  {
    id: 'BUENOS_AIRES', timezone: 'America/Argentina/Buenos_Aires',
    year: 1998, month: 3, day: 12, hour: 10, minute: 30,
    longitude: -58.3816, latitude: -34.6037,
    gender: Gender.MALE,
    expectedStandardMeridian: -45.0, expectedLmtMinutes: -54,
  },
  {
    id: 'CAPE_TOWN', timezone: 'Africa/Johannesburg',
    year: 1996, month: 11, day: 2, hour: 8, minute: 45,
    longitude: 18.4241, latitude: -33.9249,
    gender: Gender.FEMALE,
    expectedStandardMeridian: 30.0, expectedLmtMinutes: -46,
  },
  {
    id: 'LONDON', timezone: 'Europe/London',
    year: 2003, month: 1, day: 20, hour: 13, minute: 20,
    longitude: -0.1278, latitude: 51.5074,
    gender: Gender.MALE,
    expectedStandardMeridian: 0.0, expectedLmtMinutes: -1,
  },
  {
    id: 'REYKJAVIK', timezone: 'Atlantic/Reykjavik',
    year: 1993, month: 6, day: 14, hour: 11, minute: 10,
    longitude: -21.9426, latitude: 64.1466,
    gender: Gender.FEMALE,
    expectedStandardMeridian: 0.0, expectedLmtMinutes: -88,
  },
  {
    id: 'HONOLULU', timezone: 'Pacific/Honolulu',
    year: 1991, month: 5, day: 8, hour: 9, minute: 5,
    longitude: -157.8583, latitude: 21.3069,
    gender: Gender.MALE,
    expectedStandardMeridian: -150.0, expectedLmtMinutes: -31,
  },
];

describe('GlobalHemisphereGoldenCaseTest', () => {
  for (const c of cases) {
    it(`${c.id}: correct meridian, LMT, and valid pillars`, () => {
      const meridian = standardMeridianDegrees(c.timezone);
      expect(meridian, `${c.id}: standard meridian`).toBe(c.expectedStandardMeridian);

      const lmt = lmtOffsetMinutes(c.longitude, meridian);
      expect(lmt, `${c.id}: LMT`).toBe(c.expectedLmtMinutes);

      const cfg = createConfig({
        dayCutMode: DayCutMode.MIDNIGHT_00,
        applyDstHistory: false,
        includeEquationOfTime: false,
        lmtBaselineLongitude: c.expectedStandardMeridian,
      });
      const input = createBirthInput({
        birthYear: c.year, birthMonth: c.month, birthDay: c.day,
        birthHour: c.hour, birthMinute: c.minute,
        gender: c.gender, timezone: c.timezone,
        longitude: c.longitude, latitude: c.latitude,
      });
      const result = calculatePillars(input, cfg);

      expect(result.longitudeCorrectionMinutes, `${c.id}: engine LMT`).toBe(c.expectedLmtMinutes);

      // All four pillars must be valid
      expect(result.pillars.year.cheongan).toBeDefined();
      expect(result.pillars.month.cheongan).toBeDefined();
      expect(result.pillars.day.cheongan).toBeDefined();
      expect(result.pillars.hour.cheongan).toBeDefined();
    });
  }
});
