import { describe, expect, it } from 'vitest';

import {
  LegacyTimezoneError as FacadeLegacyTimezoneError,
  dstMinutesAtUtcMs as facadeDstMinutesAtUtcMs,
  parseOffsetToken as facadeParseOffsetToken,
  resolveOffsetMinutes as facadeResolveOffsetMinutes,
} from './springLegacy.js';
import {
  LegacyAmbiguousTimeError,
  LegacyNonexistentTimeError,
  LegacyTimezoneDataUnsupportedError,
  LegacyTimezoneError,
  addCivilMinutes,
  civilDateTimeToUtcMs,
  civilToIsoInstant,
  createLegacyTimezoneDataGuard,
  dstMinutesAtUtcMs,
  parseOffsetToken,
  resolveOffsetMinutes,
  supportsRequiredLegacyTimezoneData,
} from './springLegacyTimezone.js';

describe('springLegacy timezone module characterization', () => {
  it('preserves the springLegacy facade export identities', () => {
    expect(FacadeLegacyTimezoneError).toBe(LegacyTimezoneError);
    expect(facadeDstMinutesAtUtcMs).toBe(dstMinutesAtUtcMs);
    expect(facadeParseOffsetToken).toBe(parseOffsetToken);
    expect(facadeResolveOffsetMinutes).toBe(resolveOffsetMinutes);
  });

  it('preserves fixed-offset parsing, civil rollover, and ISO formatting', () => {
    const civil = { y: 2024, m: 2, d: 29, h: 23, min: 45 };

    expect(parseOffsetToken('UTC-03:30')).toBe(-210);
    expect(parseOffsetToken('GMT+14:00')).toBe(840);
    expect(parseOffsetToken('UTC-14:00')).toBe(-840);
    expect(resolveOffsetMinutes('GMT+09:00', civil)).toBe(540);
    expect(resolveOffsetMinutes('UTC-03:30', civil)).toBe(-210);
    expect(resolveOffsetMinutes('UTC+14:00', civil)).toBe(840);
    expect(dstMinutesAtUtcMs(0, 'GMT+09:00')).toBe(0);
    expect(addCivilMinutes(civil, 30)).toEqual({
      y: 2024,
      m: 3,
      d: 1,
      h: 0,
      min: 15,
    });
    expect(civilToIsoInstant(civil, -210))
      .toBe('2024-02-29T23:45:00-03:30');
  });

  it('preserves literal years 1..99 in UTC conversion and civil arithmetic', () => {
    const ancient = { y: 50, m: 1, d: 1, h: 0, min: 0 };
    expect(new Date(civilDateTimeToUtcMs(ancient)).getUTCFullYear()).toBe(50);
    expect(addCivilMinutes(ancient, -1)).toEqual({
      y: 49,
      m: 12,
      d: 31,
      h: 23,
      min: 59,
    });
  });

  it.each([
    '+09:00',
    'garbageGMT+09:00',
    'GMT+09:00garbage',
    'UTC+09:99',
    'UTC+09:00:60',
    'GMT+24:00',
    'GMT+14:01',
    'UTC-14:00:01',
    'GMT++09:00',
  ])('rejects malformed or out-of-range fixed offset token %s', (token) => {
    expect(parseOffsetToken(token)).toBeNull();
  });

  it('accepts the required capability contract with an injected lookup', () => {
    const expectedByProbe = new Map<string, number>([
      ['Asia/Seoul|1907-06-15T00:00:00.000Z', 508],
      ['Asia/Seoul|1954-07-01T00:00:00.000Z', 510],
      ['Asia/Seoul|1988-07-15T00:00:00.000Z', 600],
      ['America/New_York|2024-01-15T00:00:00.000Z', -300],
      ['America/New_York|2024-07-15T00:00:00.000Z', -240],
      ['Pacific/Kiritimati|2024-07-15T00:00:00.000Z', 840],
    ]);
    let lookups = 0;
    const lookup = (utcMs: number, timeZone: string): number => {
      lookups += 1;
      const value = expectedByProbe.get(
        `${timeZone}|${new Date(utcMs).toISOString()}`,
      );
      if (value == null) throw new Error('unexpected probe');
      return value;
    };

    expect(supportsRequiredLegacyTimezoneData(lookup)).toBe(true);

    lookups = 0;
    const guard = createLegacyTimezoneDataGuard(lookup);
    guard();
    guard();
    expect(lookups).toBe(expectedByProbe.size);
  });

  it('caches capability failure and does not expose the underlying error', () => {
    const secret = 'runtime-specific Intl failure details';
    let lookups = 0;
    const guard = createLegacyTimezoneDataGuard(() => {
      lookups += 1;
      throw new Error(secret);
    });
    const caught: unknown[] = [];

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        guard();
      } catch (cause) {
        caught.push(cause);
      }
    }

    expect(lookups).toBe(1);
    expect(caught).toHaveLength(2);
    for (const cause of caught) {
      expect(cause).toBeInstanceOf(LegacyTimezoneDataUnsupportedError);
      const error = cause as LegacyTimezoneDataUnsupportedError;
      expect(error.code).toBe('SAJU_LEGACY_TIMEZONE_DATA_UNSUPPORTED');
      expect(error.message).not.toContain(secret);
      expect('cause' in error).toBe(false);
    }
  });

  it('rejects a tzdb that returns incomplete historical offsets', () => {
    expect(supportsRequiredLegacyTimezoneData(() => 0)).toBe(false);
  });

  it.each([
    ['America/New_York', { y: 2024, m: 3, d: 10, h: 2, min: 30 }],
    ['Europe/London', { y: 2024, m: 3, d: 31, h: 1, min: 30 }],
    ['Asia/Seoul', { y: 1988, m: 5, d: 8, h: 2, min: 30 }],
  ])('fails closed for a nonexistent civil time in %s', (timeZone, civil) => {
    let caught: unknown;
    try {
      resolveOffsetMinutes(timeZone, civil);
    } catch (cause) {
      caught = cause;
    }

    expect(caught).toBeInstanceOf(LegacyNonexistentTimeError);
    const error = caught as LegacyNonexistentTimeError;
    expect(error.code).toBe('SAJU_LEGACY_TIME_NONEXISTENT');
    expect(error.timeZone).toBe(timeZone);
    expect(error.civil).toEqual(civil);
  });

  it.each([
    ['America/New_York', { y: 2024, m: 3, d: 10, h: 1, min: 30 }, -300],
    ['America/New_York', { y: 2024, m: 3, d: 10, h: 3, min: 30 }, -240],
    ['Europe/London', { y: 2024, m: 3, d: 31, h: 0, min: 30 }, 0],
    ['Europe/London', { y: 2024, m: 3, d: 31, h: 2, min: 30 }, 60],
    ['Asia/Seoul', { y: 1988, m: 5, d: 8, h: 1, min: 30 }, 540],
    ['Asia/Seoul', { y: 1988, m: 5, d: 8, h: 3, min: 30 }, 600],
  ])(
    'keeps a unique offset immediately outside the transition in %s',
    (timeZone, civil, expectedOffset) => {
      expect(resolveOffsetMinutes(timeZone, civil)).toBe(expectedOffset);
    },
  );

  it.each([
    ['America/New_York', { y: 2024, m: 11, d: 3, h: 1, min: 30 }],
    ['Europe/London', { y: 2024, m: 10, d: 27, h: 1, min: 30 }],
    ['Asia/Seoul', { y: 1988, m: 10, d: 9, h: 2, min: 30 }],
  ])('fails closed for an ambiguous civil time in %s', (timeZone, civil) => {
    let caught: unknown;
    try {
      resolveOffsetMinutes(timeZone, civil);
    } catch (cause) {
      caught = cause;
    }

    expect(caught).toBeInstanceOf(LegacyAmbiguousTimeError);
    const error = caught as LegacyAmbiguousTimeError;
    expect(error.code).toBe('SAJU_LEGACY_TIME_AMBIGUOUS');
    expect(error.timeZone).toBe(timeZone);
    expect(error.civil).toEqual(civil);
  });

  it('preserves historical Asia/Seoul LMT and DST results', () => {
    const lmtCivil = { y: 1907, m: 6, d: 15, h: 12, min: 0 };
    const dstCivil = { y: 1988, m: 7, d: 15, h: 12, min: 0 };

    expect(resolveOffsetMinutes('Asia/Seoul', lmtCivil)).toBe(508);
    const dstOffset = resolveOffsetMinutes('Asia/Seoul', dstCivil);
    expect(dstOffset).toBe(600);
    const dstUtcMs = Date.UTC(1988, 6, 15, 12, 0, 0) - dstOffset * 60_000;
    expect(dstMinutesAtUtcMs(dstUtcMs, 'Asia/Seoul')).toBe(60);
  });

  it('preserves structured invalid-timezone error code, message, and cause', () => {
    const timeZone = 'Not/A_Real_Zone';
    let caught: unknown;
    try {
      resolveOffsetMinutes(timeZone, { y: 2000, m: 1, d: 1, h: 12, min: 0 });
    } catch (cause) {
      caught = cause;
    }

    expect(caught).toBeInstanceOf(LegacyTimezoneError);
    const error = caught as LegacyTimezoneError;
    expect(error.code).toBe('SAJU_LEGACY_TIMEZONE_INVALID');
    expect(error.timeZone).toBe(timeZone);
    expect(error.message).toBe(
      'Invalid or unsupported legacy timezone: Not/A_Real_Zone',
    );
    expect(error.cause).toBeInstanceOf(RangeError);
  });
});
