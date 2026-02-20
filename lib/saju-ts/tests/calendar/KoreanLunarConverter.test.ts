import { describe, it, expect } from 'vitest';
import {
  KoreanLunarAlgorithmicConverter,
  lunarToSolar,
  solarToLunar,
  MIN_LUNAR_YEAR,
  MAX_LUNAR_YEAR,
} from '../../src/calendar/lunar/KoreanLunarAlgorithmicConverter.js';
import {
  createLunarDate,
  formatLunarDate,
  lunarDateEquals,
} from '../../src/calendar/lunar/LunarDate.js';
import type { LunarDate, SolarDate } from '../../src/calendar/lunar/LunarDate.js';

// ── Helper ──────────────────────────────────────────────────────────────

function solar(year: number, month: number, day: number): SolarDate {
  return { year, month, day };
}

function solarEq(a: SolarDate | null, b: SolarDate): boolean {
  return a !== null && a.year === b.year && a.month === b.month && a.day === b.day;
}

// =========================================================================
// KoreanLunarAlgorithmicConverter tests
// (Ported from KoreanLunarAlgorithmicConverterTest.kt)
// =========================================================================

describe('KoreanLunarAlgorithmicConverter', () => {

  // ── lunarToSolar: Known-correct conversions ─────────────────────────

  it('lunar new year 2024 = solar 2024-02-10', () => {
    const result = lunarToSolar(createLunarDate(2024, 1, 1));
    expect(result).not.toBeNull();
    expect(solarEq(result, solar(2024, 2, 10))).toBe(true);
  });

  it('chuseok 2024 = solar 2024-09-17', () => {
    const result = lunarToSolar(createLunarDate(2024, 8, 15));
    expect(result).not.toBeNull();
    expect(solarEq(result, solar(2024, 9, 17))).toBe(true);
  });

  it('lunar new year 2023 = solar 2023-01-22', () => {
    const result = lunarToSolar(createLunarDate(2023, 1, 1));
    expect(result).not.toBeNull();
    expect(solarEq(result, solar(2023, 1, 22))).toBe(true);
  });

  it('lunar 1986-03-11 = solar 1986-04-19', () => {
    const result = lunarToSolar(createLunarDate(1986, 3, 11));
    expect(result).not.toBeNull();
    expect(solarEq(result, solar(1986, 4, 19))).toBe(true);
  });

  it('lunar 1991-02-15 converts successfully', () => {
    const result = lunarToSolar(createLunarDate(1991, 2, 15));
    expect(result).not.toBeNull();
  });

  it('lunar 1900-01-01 = solar 1900-01-31', () => {
    const result = lunarToSolar(createLunarDate(1900, 1, 1));
    expect(result).not.toBeNull();
    expect(solarEq(result, solar(1900, 1, 31))).toBe(true);
  });

  it('lunar 1950-05-05 converts correctly', () => {
    const result = lunarToSolar(createLunarDate(1950, 5, 5));
    expect(result).not.toBeNull();
  });

  it('lunar 2000-01-01 = solar 2000-02-05', () => {
    const result = lunarToSolar(createLunarDate(2000, 1, 1));
    expect(result).not.toBeNull();
    expect(solarEq(result, solar(2000, 2, 5))).toBe(true);
  });

  // ── Leap month handling ─────────────────────────────────────────────

  it('2023 leap 2nd month converts correctly', () => {
    const regular = lunarToSolar(createLunarDate(2023, 2, 15));
    const leap = lunarToSolar(createLunarDate(2023, 2, 15, true));
    expect(regular).not.toBeNull();
    expect(leap).not.toBeNull();
    // Leap month is AFTER regular month, so solar date should be later
    const regVal = regular!.year * 10000 + regular!.month * 100 + regular!.day;
    const leapVal = leap!.year * 10000 + leap!.month * 100 + leap!.day;
    expect(leapVal).toBeGreaterThan(regVal);
  });

  it('non-existent leap month returns null', () => {
    const result = lunarToSolar(createLunarDate(2024, 3, 1, true));
    expect(result).toBeNull();
  });

  // ── solarToLunar: reverse conversions ───────────────────────────────

  it('solar 2024-02-10 = lunar 2024-01-01', () => {
    const result = solarToLunar(solar(2024, 2, 10));
    expect(result).not.toBeNull();
    expect(lunarDateEquals(result!, createLunarDate(2024, 1, 1))).toBe(true);
  });

  it('solar 2024-09-17 = lunar 2024-08-15 (chuseok)', () => {
    const result = solarToLunar(solar(2024, 9, 17));
    expect(result).not.toBeNull();
    expect(lunarDateEquals(result!, createLunarDate(2024, 8, 15))).toBe(true);
  });

  it('solar 1986-04-19 = lunar 1986-03-11', () => {
    const result = solarToLunar(solar(1986, 4, 19));
    expect(result).not.toBeNull();
    expect(result!.year).toBe(1986);
    expect(result!.month).toBe(3);
    expect(result!.day).toBe(11);
  });

  // ── Round-trip consistency ──────────────────────────────────────────

  it('round-trip lunar to solar to lunar is identity', () => {
    const original = createLunarDate(1990, 6, 15);
    const s = lunarToSolar(original);
    expect(s).not.toBeNull();
    const roundTripped = solarToLunar(s!);
    expect(roundTripped).not.toBeNull();
    expect(lunarDateEquals(roundTripped!, original)).toBe(true);
  });

  it('round-trip for multiple years 1920-2040 step 10', () => {
    for (let year = 1920; year <= 2040; year += 10) {
      const original = createLunarDate(year, 1, 1);
      const s = lunarToSolar(original);
      expect(s).not.toBeNull();
      const roundTripped = solarToLunar(s!);
      expect(roundTripped).not.toBeNull();
      expect(lunarDateEquals(roundTripped!, original)).toBe(true);
    }
  });

  // ── Range validation ────────────────────────────────────────────────

  it('year before 1899 returns null', () => {
    const result = lunarToSolar(createLunarDate(1898, 1, 1));
    expect(result).toBeNull();
  });

  it('year 1899 is supported (early 1900 solar dates map here)', () => {
    const result = lunarToSolar(createLunarDate(1899, 12, 1));
    expect(result).not.toBeNull();
  });

  it('year after 2050 returns null', () => {
    const result = lunarToSolar(createLunarDate(2051, 1, 1));
    expect(result).toBeNull();
  });

  it('solar date 1900-01-01 is now supported (maps to lunar 1899)', () => {
    const result = solarToLunar(solar(1900, 1, 1));
    expect(result).not.toBeNull();
    expect(result!.year).toBe(1899);
  });

  it('solar date before 1900-01-01 returns null', () => {
    const result = solarToLunar(solar(1899, 12, 31));
    expect(result).toBeNull();
  });

  // ── Cross-validation with KASI CSV data ─────────────────────────────

  it('algorithmic converter matches KASI CSV for 2023-01-22', () => {
    const fromAlgo = solarToLunar(solar(2023, 1, 22));
    expect(fromAlgo).not.toBeNull();
    expect(fromAlgo!.year).toBe(2023);
    expect(fromAlgo!.month).toBe(1);
    expect(fromAlgo!.day).toBe(1);
    expect(fromAlgo!.isLeapMonth).toBe(false);
  });

  it('algorithmic converter matches KASI CSV for chuseok 2023', () => {
    const fromAlgo = solarToLunar(solar(2023, 9, 29));
    expect(fromAlgo).not.toBeNull();
    expect(fromAlgo!.year).toBe(2023);
    expect(fromAlgo!.month).toBe(8);
    expect(fromAlgo!.day).toBe(15);
  });

  // ── Singleton object style ──────────────────────────────────────────

  it('singleton object exposes lunarToSolar', () => {
    const result = KoreanLunarAlgorithmicConverter.lunarToSolar(createLunarDate(2024, 1, 1));
    expect(result).not.toBeNull();
    expect(solarEq(result, solar(2024, 2, 10))).toBe(true);
  });

  it('singleton object exposes solarToLunar', () => {
    const result = KoreanLunarAlgorithmicConverter.solarToLunar(solar(2024, 2, 10));
    expect(result).not.toBeNull();
    expect(lunarDateEquals(result!, createLunarDate(2024, 1, 1))).toBe(true);
  });
});

// =========================================================================
// LunarSolarConverter tests
// (Ported from LunarSolarConverterTest.kt - since TS has no CSV fallback,
//  these all go through the algorithmic converter directly)
// =========================================================================

describe('LunarSolarConverter (algorithmic)', () => {

  // ── lunarToSolar tests ──────────────────────────────────────────────

  it('lunar new year 2024 converted correctly', () => {
    const s = lunarToSolar(createLunarDate(2024, 1, 1));
    expect(s).not.toBeNull();
    expect(solarEq(s, solar(2024, 2, 10))).toBe(true);
  });

  it('lunar chuseok 2024 converted correctly', () => {
    const s = lunarToSolar(createLunarDate(2024, 8, 15));
    expect(s).not.toBeNull();
    expect(solarEq(s, solar(2024, 9, 17))).toBe(true);
  });

  it('late lunar 2023 month falls in solar year 2024', () => {
    const s = lunarToSolar(createLunarDate(2023, 12, 20));
    expect(s).not.toBeNull();
    expect(s!.year).toBe(2024);
  });

  it('year 1990 is convertible', () => {
    const s = lunarToSolar(createLunarDate(1990, 1, 1));
    expect(s).not.toBeNull();
    expect(s!.year).toBe(1990);
  });

  it('year 1850 returns null (outside range)', () => {
    const s = lunarToSolar(createLunarDate(1850, 1, 1));
    expect(s).toBeNull();
  });

  it('lunar day 30 in month 1 of 2024 does not throw', () => {
    // Just verify it doesn't throw; result may be null if month has only 29 days
    expect(() => lunarToSolar(createLunarDate(2024, 1, 30))).not.toThrow();
  });

  // ── solarToLunar tests ──────────────────────────────────────────────

  it('solar 2024-02-10 = lunar 2024-01-01', () => {
    const l = solarToLunar(solar(2024, 2, 10));
    expect(l).not.toBeNull();
    expect(l!.year).toBe(2024);
    expect(l!.month).toBe(1);
    expect(l!.day).toBe(1);
    expect(l!.isLeapMonth).toBe(false);
  });

  it('solar 2024-01-01 falls in lunar year 2023 month 11', () => {
    const l = solarToLunar(solar(2024, 1, 1));
    expect(l).not.toBeNull();
    expect(l!.year).toBe(2023);
    expect(l!.month).toBe(11);
  });

  it('solar 1990-06-15 is convertible', () => {
    const l = solarToLunar(solar(1990, 6, 15));
    expect(l).not.toBeNull();
    expect(l!.year).toBe(1990);
  });

  it('solar 1850-06-15 returns null (outside range)', () => {
    const l = solarToLunar(solar(1850, 6, 15));
    expect(l).toBeNull();
  });

  // ── Round-trip tests ────────────────────────────────────────────────

  it('round-trip lunar -> solar -> lunar', () => {
    const original = createLunarDate(2024, 5, 10);
    const s = lunarToSolar(original);
    expect(s).not.toBeNull();
    const roundTripped = solarToLunar(s!);
    expect(roundTripped).not.toBeNull();
    expect(lunarDateEquals(roundTripped!, original)).toBe(true);
  });

  it('round-trip solar -> lunar -> solar', () => {
    const original = solar(2024, 7, 15);
    const l = solarToLunar(original);
    expect(l).not.toBeNull();
    const roundTripped = lunarToSolar(l!);
    expect(roundTripped).not.toBeNull();
    expect(solarEq(roundTripped, original)).toBe(true);
  });

  // ── Every day of 2024 has a lunar mapping ───────────────────────────

  it('every 2024 solar date has a lunar mapping (366 days)', () => {
    let count = 0;
    // 2024 is a leap year
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= daysInMonth[m - 1]!; d++) {
        const l = solarToLunar(solar(2024, m, d));
        expect(l).not.toBeNull();
        count++;
      }
    }
    expect(count).toBe(366);
  });
});

// =========================================================================
// LunarDate model tests
// =========================================================================

describe('LunarDate', () => {

  it('createLunarDate validates month range', () => {
    expect(() => createLunarDate(2024, 0, 1)).toThrow(RangeError);
    expect(() => createLunarDate(2024, 13, 1)).toThrow(RangeError);
  });

  it('createLunarDate validates day range', () => {
    expect(() => createLunarDate(2024, 1, 0)).toThrow(RangeError);
    expect(() => createLunarDate(2024, 1, 31)).toThrow(RangeError);
  });

  it('formatLunarDate normal', () => {
    const ld = createLunarDate(2024, 1, 15);
    expect(formatLunarDate(ld)).toBe('\uc74c\ub825 2024\ub144 1\uc6d4 15\uc77c');
  });

  it('formatLunarDate leap month', () => {
    const ld = createLunarDate(2023, 2, 10, true);
    expect(formatLunarDate(ld)).toBe('\uc74c\ub825 2023\ub144 \uc7242\uc6d4 10\uc77c');
  });

  it('equality includes leap flag', () => {
    const normal = createLunarDate(2024, 3, 1, false);
    const leap = createLunarDate(2024, 3, 1, true);
    expect(lunarDateEquals(normal, leap)).toBe(false);
  });

  it('equality for identical dates', () => {
    const a = createLunarDate(2024, 5, 15);
    const b = createLunarDate(2024, 5, 15);
    expect(lunarDateEquals(a, b)).toBe(true);
  });
});

// =========================================================================
// Additional algorithmic correctness tests
// =========================================================================

describe('Algorithmic correctness', () => {

  it('supported range constants are correct', () => {
    expect(MIN_LUNAR_YEAR).toBe(1899);
    expect(MAX_LUNAR_YEAR).toBe(2050);
  });

  it('boundary: earliest supported lunar date converts', () => {
    const s = lunarToSolar(createLunarDate(1900, 1, 1));
    expect(s).not.toBeNull();
    // KASI: lunar 1900-01-01 = solar 1900-01-31
    expect(solarEq(s, solar(1900, 1, 31))).toBe(true);
  });

  it('boundary: solar 1900-01-01 is the first supported solar date', () => {
    const l1 = solarToLunar(solar(1899, 12, 31));
    expect(l1).toBeNull();
    const l2 = solarToLunar(solar(1900, 1, 1));
    expect(l2).not.toBeNull();
  });

  it('extensive round-trip: every lunar new year 1900-2050', () => {
    // Solar range now starts at 1900-01-01, so lunar 1900-01-01 (= solar 1900-01-31) works.
    for (let year = 1900; year <= 2050; year++) {
      const ld = createLunarDate(year, 1, 1);
      const s = lunarToSolar(ld);
      expect(s).not.toBeNull();
      const back = solarToLunar(s!);
      expect(back).not.toBeNull();
      expect(lunarDateEquals(back!, ld)).toBe(true);
    }
  });

  it('known leap years have convertible leap months', () => {
    // 2023 has leap month 2
    const leap2023 = lunarToSolar(createLunarDate(2023, 2, 1, true));
    expect(leap2023).not.toBeNull();

    // 2025 has leap month 6
    const leap2025 = lunarToSolar(createLunarDate(2025, 6, 1, true));
    expect(leap2025).not.toBeNull();
  });

  it('non-leap year has no leap month', () => {
    // 2024 does not have a leap month at all
    for (let m = 1; m <= 12; m++) {
      const result = lunarToSolar(createLunarDate(2024, m, 1, true));
      expect(result).toBeNull();
    }
  });
});
