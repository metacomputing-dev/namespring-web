import { describe, expect, it } from 'vitest';

import {
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
    });
    expect(() => analyzeSaju(input)).toThrow(LegacyTimezoneError);
  });
});
