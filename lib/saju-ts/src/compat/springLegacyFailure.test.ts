import { describe, expect, it } from 'vitest';

import {
  LegacyBirthLocationError,
  LegacyTimezoneError,
  analyzeSaju,
  createBirthInput,
  resolveOffsetMinutes,
} from './springLegacy.js';

describe('legacy timezone failure contract', () => {
  it('rejects invalid IANA zones instead of fabricating +09:00', () => {
    const civil = { y: 2000, m: 1, d: 1, h: 12, min: 0 };
    expect(() => resolveOffsetMinutes('Not/A_Real_Zone', civil))
      .toThrow(LegacyTimezoneError);
  });

  it('propagates invalid zones through analyzeSaju', () => {
    const input = createBirthInput({
      birthYear: 2000,
      birthMonth: 1,
      birthDay: 1,
      birthHour: 12,
      birthMinute: 0,
      gender: 'MALE',
      timezone: 'Not/A_Real_Zone',
      latitude: 37.5665,
      longitude: 126.978,
    });
    expect(() => analyzeSaju(input)).toThrow(LegacyTimezoneError);
  });

  it.each([
    { timezone: 'America/New_York' },
    { latitude: 40.7128, longitude: -74.006 },
    { timezone: 'America/New_York', latitude: 40.7128 },
  ])('rejects a partial legacy birth-location tuple %#', (location) => {
    expect(() => createBirthInput({
      birthYear: 2000,
      birthMonth: 1,
      birthDay: 1,
      birthHour: 12,
      birthMinute: 0,
      gender: 'MALE',
      ...location,
    })).toThrowError(expect.objectContaining({
      code: 'SAJU_LEGACY_BIRTH_LOCATION_PARTIAL',
    }));
  });

  it('rejects coercible legacy coordinates instead of replacing them with Seoul', () => {
    expect(() => createBirthInput({
      birthYear: 2000,
      birthMonth: 1,
      birthDay: 1,
      birthHour: 12,
      birthMinute: 0,
      gender: 'MALE',
      timezone: 'America/New_York',
      latitude: '40.7128' as any,
      longitude: -74.006,
    })).toThrow(LegacyBirthLocationError);
  });

  it('preserves a complete explicit legacy location tuple', () => {
    const input = createBirthInput({
      birthYear: 2000,
      birthMonth: 1,
      birthDay: 1,
      birthHour: 12,
      birthMinute: 0,
      gender: 'MALE',
      timezone: 'America/New_York',
      latitude: 40.7128,
      longitude: -74.006,
    });
    expect(input).toMatchObject({
      timezone: 'America/New_York',
      latitude: 40.7128,
      longitude: -74.006,
    });
  });
});
