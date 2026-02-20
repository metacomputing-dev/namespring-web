import { describe, it, expect } from 'vitest';
import { Gender } from '../../src/domain/Gender.js';
import {
  createBirthInput,
  normalizeBirthDateByCalendar,
} from '../../src/domain/types.js';

describe('BirthInput calendar normalization', () => {
  it('keeps solar dates unchanged by default', () => {
    const input = createBirthInput({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 15,
      birthHour: 14,
      birthMinute: 30,
      gender: Gender.MALE,
    });

    expect(input.birthYear).toBe(1990);
    expect(input.birthMonth).toBe(5);
    expect(input.birthDay).toBe(15);
    expect(input.sourceCalendarType).toBe('SOLAR');
  });

  it('converts lunar birth dates to solar for analysis', () => {
    const input = createBirthInput({
      birthYear: 2024,
      birthMonth: 1,
      birthDay: 1,
      birthHour: 12,
      birthMinute: 0,
      gender: Gender.FEMALE,
      calendarType: 'lunar',
    });

    expect(input.birthYear).toBe(2024);
    expect(input.birthMonth).toBe(2);
    expect(input.birthDay).toBe(10);
    expect(input.calendarType).toBe('SOLAR');
    expect(input.sourceCalendarType).toBe('LUNAR');
  });

  it('supports explicit leap-month lunar normalization', () => {
    const normalized = normalizeBirthDateByCalendar({
      birthYear: 2023,
      birthMonth: 2,
      birthDay: 15,
      calendarType: 'LUNAR',
      isLeapMonth: true,
    });

    expect(normalized.sourceCalendarType).toBe('LUNAR');
    expect(normalized.isLeapMonth).toBe(true);
    expect(normalized.year).toBe(2023);
    expect(normalized.month).toBeGreaterThanOrEqual(3);
  });

  it('uses automatic leap-month resolution when leap flag is omitted', () => {
    const autoResolved = normalizeBirthDateByCalendar({
      birthYear: 2023,
      birthMonth: 2,
      birthDay: 15,
      calendarType: 'LUNAR',
    });

    const explicitNonLeap = normalizeBirthDateByCalendar({
      birthYear: 2023,
      birthMonth: 2,
      birthDay: 15,
      calendarType: 'LUNAR',
      isLeapMonth: false,
    });

    expect(autoResolved.sourceCalendarType).toBe('LUNAR');
    expect(autoResolved.isLeapMonth).toBe(false);
    expect(autoResolved).toEqual(explicitNonLeap);
  });

  it('throws when leap-month input is invalid for the selected lunar year', () => {
    expect(() => normalizeBirthDateByCalendar({
      birthYear: 2024,
      birthMonth: 3,
      birthDay: 1,
      calendarType: 'LUNAR',
      isLeapMonth: true,
    })).toThrow(RangeError);
  });
});
