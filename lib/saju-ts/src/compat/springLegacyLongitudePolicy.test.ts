import { describe, expect, it } from 'vitest';

import {
  analyzeSaju,
  configFromPreset,
  createBirthInput,
  type LegacySajuConfig,
} from './springLegacy.js';

interface LocationCase {
  label: string;
  y: number;
  m: number;
  d: number;
  timezone: string;
  latitude: number;
  longitude: number;
  expectedMinutes: number;
}

function longitudeCorrection(
  location: LocationCase,
  config: LegacySajuConfig,
): number {
  const output = analyzeSaju(createBirthInput({
    birthYear: location.y,
    birthMonth: location.m,
    birthDay: location.d,
    birthHour: 12,
    birthMinute: 0,
    gender: 'MALE',
    timezone: location.timezone,
    latitude: location.latitude,
    longitude: location.longitude,
  }), {
    dayCutMode: 'MIDNIGHT_00',
    trueSolarTimeEnabled: true,
    includeEquationOfTime: false,
    ...config,
  });

  return output.coreResult.longitudeCorrectionMinutes;
}

const CIVIL_CASES: readonly LocationCase[] = [
  {
    label: 'modern Seoul',
    y: 2024, m: 1, d: 15,
    timezone: 'Asia/Seoul', latitude: 37.5665, longitude: 126.978,
    expectedMinutes: -32.088,
  },
  {
    label: 'historical Seoul +08:30',
    y: 1954, m: 7, d: 15,
    timezone: 'Asia/Seoul', latitude: 37.5665, longitude: 126.978,
    expectedMinutes: -2.088,
  },
  {
    label: 'historical Seoul DST +09:30',
    y: 1957, m: 7, d: 15,
    timezone: 'Asia/Seoul', latitude: 37.5665, longitude: 126.978,
    expectedMinutes: -62.088,
  },
  {
    label: 'New York DST',
    y: 2024, m: 7, d: 15,
    timezone: 'America/New_York', latitude: 40.7128, longitude: -74.006,
    expectedMinutes: -56.024,
  },
  {
    label: 'London DST',
    y: 2024, m: 7, d: 15,
    timezone: 'Europe/London', latitude: 51.5074, longitude: -0.1276,
    expectedMinutes: -60.5104,
  },
  {
    label: 'Los Angeles DST',
    y: 2024, m: 7, d: 15,
    timezone: 'America/Los_Angeles', latitude: 34.0522, longitude: -118.2437,
    expectedMinutes: -52.9748,
  },
  {
    label: 'Sydney DST',
    y: 2024, m: 1, d: 15,
    timezone: 'Australia/Sydney', latitude: -33.8688, longitude: 151.2093,
    expectedMinutes: -55.1628,
  },
  {
    label: 'Kiritimati UTC+14 across the dateline',
    y: 2024, m: 1, d: 15,
    timezone: 'Pacific/Kiritimati', latitude: 1.8721, longitude: -157.4,
    expectedMinutes: -29.6,
  },
];

describe('legacy bridge longitude policy', () => {
  it.each(CIVIL_CASES)(
    'uses the birth instant civil-offset meridian for $label',
    (location) => {
      expect(longitudeCorrection(location, {
        longitudeCorrectionPolicy: { mode: 'civilOffsetMeridian' },
      })).toBeCloseTo(location.expectedMinutes, 6);
    },
  );

  it('keeps fixed 135 and 120 degree preset behavior', () => {
    const seoul = CIVIL_CASES[0]!;
    expect(longitudeCorrection(seoul, {
      ...configFromPreset('KOREAN_MAINSTREAM'),
      trueSolarTimeEnabled: true,
    })).toBeCloseTo(-32.088, 6);
    expect(longitudeCorrection(seoul, {
      ...configFromPreset('TRADITIONAL_CHINESE'),
      trueSolarTimeEnabled: true,
    })).toBeCloseTo(27.912, 6);
  });

  it('preserves legacy longitudeCorrectionEnabled=false as civil-offset behavior', () => {
    const newYork = CIVIL_CASES.find((entry) => entry.label === 'New York DST')!;
    expect(longitudeCorrection(newYork, {
      ...configFromPreset('KOREAN_MAINSTREAM'),
      trueSolarTimeEnabled: true,
      longitudeCorrectionEnabled: false,
    })).toBeCloseTo(-56.024, 6);
  });

  it('gives the new typed policy priority and provides actual off', () => {
    const newYork = CIVIL_CASES.find((entry) => entry.label === 'New York DST')!;
    expect(longitudeCorrection(newYork, {
      ...configFromPreset('KOREAN_MAINSTREAM'),
      trueSolarTimeEnabled: true,
      longitudeCorrectionEnabled: true,
      longitudeCorrectionPolicy: { mode: 'off' },
    })).toBe(0);
  });
});
