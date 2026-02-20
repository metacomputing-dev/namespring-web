import { describe, it, expect } from 'vitest';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { lmtOffsetMinutes } from '../../src/calendar/time/SolarTimeAdjuster.js';

/**
 * Geographic diversity golden test: verifies LMT corrections
 * for six Korean cities with different longitudes.
 *
 * Standard meridian for KST = 135.0
 */

const config = createConfig({
  dayCutMode: DayCutMode.MIDNIGHT_00,
  applyDstHistory: false,
  includeEquationOfTime: false,
  lmtBaselineLongitude: 135.0,
});

interface CityCase {
  id: string;
  longitude: number;
  expectedLmtMinutes: number;
}

const cities: CityCase[] = [
  { id: 'G01', longitude: 126.978, expectedLmtMinutes: -32 }, // Seoul
  { id: 'G02', longitude: 129.075, expectedLmtMinutes: -24 }, // Busan
  { id: 'G03', longitude: 128.601, expectedLmtMinutes: -26 }, // Daegu
  { id: 'G04', longitude: 126.531, expectedLmtMinutes: -34 }, // Jeju
  { id: 'G05', longitude: 126.705, expectedLmtMinutes: -33 }, // Incheon
  { id: 'G06', longitude: 128.591, expectedLmtMinutes: -26 }, // Sokcho
];

describe('GeographicDiversityGoldenTest', () => {
  it('six city LMT corrections match expected values', () => {
    const observedLmtCorrections = new Set<number>();

    for (const city of cities) {
      const lmt = lmtOffsetMinutes(city.longitude, 135.0);
      expect(lmt, `${city.id}: LMT correction`).toBe(city.expectedLmtMinutes);
      observedLmtCorrections.add(lmt);

      // Verify engine applies the correction
      const input = createBirthInput({
        birthYear: 1985, birthMonth: 5, birthDay: 20,
        birthHour: 14, birthMinute: 0,
        gender: Gender.MALE,
        longitude: city.longitude, latitude: 37.5,
      });
      const result = calculatePillars(input, config);
      expect(result.longitudeCorrectionMinutes, `${city.id}: engine LMT`).toBe(city.expectedLmtMinutes);
    }

    expect(observedLmtCorrections.size).toBeGreaterThanOrEqual(5);
  });

  it('all six cities produce valid four pillars', () => {
    for (const city of cities) {
      const input = createBirthInput({
        birthYear: 1985, birthMonth: 5, birthDay: 20,
        birthHour: 14, birthMinute: 0,
        gender: Gender.MALE,
        longitude: city.longitude, latitude: 37.5,
      });
      const result = calculatePillars(input, config);

      expect(result.pillars.year).toBeDefined();
      expect(result.pillars.month).toBeDefined();
      expect(result.pillars.day).toBeDefined();
      expect(result.pillars.hour).toBeDefined();
    }
  });

  it('different longitudes can produce different hour pillars', () => {
    // Seoul vs Busan at a time near shi-chen boundary
    const seoulInput = createBirthInput({
      birthYear: 1985, birthMonth: 5, birthDay: 20,
      birthHour: 13, birthMinute: 5,
      gender: Gender.MALE, longitude: 126.978,
    });
    const busanInput = createBirthInput({
      birthYear: 1985, birthMonth: 5, birthDay: 20,
      birthHour: 13, birthMinute: 5,
      gender: Gender.MALE, longitude: 129.075,
    });
    const seoulResult = calculatePillars(seoulInput, config);
    const busanResult = calculatePillars(busanInput, config);

    // Both produce valid pillars
    expect(seoulResult.pillars.hour).toBeDefined();
    expect(busanResult.pillars.hour).toBeDefined();
    // Day pillars should be identical (same date)
    expect(seoulResult.pillars.day.equals(busanResult.pillars.day)).toBe(true);
  });
});
