import { describe, expect, it } from 'vitest';

import {
  LegacyTimezoneError as FacadeLegacyTimezoneError,
  dstMinutesAtUtcMs as facadeDstMinutesAtUtcMs,
  parseOffsetToken as facadeParseOffsetToken,
  resolveOffsetMinutes as facadeResolveOffsetMinutes,
} from './springLegacy.js';
import {
  LegacyTimezoneError,
  addCivilMinutes,
  civilToIsoInstant,
  dstMinutesAtUtcMs,
  parseOffsetToken,
  resolveOffsetMinutes,
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
    expect(resolveOffsetMinutes('GMT+09:00', civil)).toBe(540);
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
