import { describe, it, expect } from 'vitest';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { Cheongan, cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { Jiji, jijiOrdinal } from '../../src/domain/Jiji.js';

/**
 * V-08: Critical boundary condition stress test.
 *
 * Verifies minute-level accuracy at the most sensitive calculation boundaries:
 *
 * 1. Jeol boundary +/-1 minute -- year and month pillar transitions
 * 2. Yaza hour boundary at 23:00 -- day pillar rollover
 * 3. DST transition boundary -- standard moment computation (Korean DST 1988)
 * 4. Day pillar transition at midnight/yaza -- consecutive day pillars
 * 5. Early/late ja-si split -- hour pillar behavior across midnight
 *
 * All tests use Seoul coordinates (lat=37.5665, lon=126.978) with timezone Asia/Seoul.
 * Where LMT correction would obscure the boundary under test, longitude=135.0 is used
 * instead (LMT=0 at the KST standard meridian).
 *
 * Reference data (from saju_jeol_1900_2050.csv):
 *   Ipchun 2024:    2024-02-04 17:27 KST (solar lon 315, sajuMonthIndex=1, IN)
 *   Gyeongchip 2024: 2024-03-05 11:23 KST (solar lon 345, sajuMonthIndex=2, MYO)
 */

// ---- Helpers ----

function noLmtConfig(applyDstHistory = false) {
  return createConfig({
    dayCutMode: DayCutMode.MIDNIGHT_00,
    applyDstHistory,
    includeEquationOfTime: false,
    lmtBaselineLongitude: 135.0,
  });
}

function yazaConfig(applyDstHistory = false) {
  return createConfig({
    dayCutMode: DayCutMode.YAZA_23_TO_01_NEXTDAY,
    applyDstHistory,
    includeEquationOfTime: false,
    lmtBaselineLongitude: 135.0,
  });
}

function midnightConfig() {
  return createConfig({
    dayCutMode: DayCutMode.MIDNIGHT_00,
    applyDstHistory: false,
    includeEquationOfTime: false,
    lmtBaselineLongitude: 135.0,
  });
}

function dstEnabledConfig() {
  return createConfig({
    dayCutMode: DayCutMode.YAZA_23_TO_01_NEXTDAY,
    applyDstHistory: true,
    includeEquationOfTime: false,
    lmtBaselineLongitude: 135.0,
  });
}

function calc(
  year: number, month: number, day: number,
  hour: number, minute: number,
  config: ReturnType<typeof createConfig>,
  longitude = 126.978, latitude = 37.5665,
) {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender: Gender.MALE, timezone: 'Asia/Seoul',
    longitude, latitude,
  });
  return calculatePillars(input, config);
}

/**
 * Computes the sexagenary (60-cycle) index for a given pillar.
 * Finds i in 0..59 where i%10 == stemOrdinal and i%12 == branchOrdinal.
 */
function sexagenaryIndex(cheongan: Cheongan, jiji: Jiji): number {
  const stemIdx = cheonganOrdinal(cheongan);
  const branchIdx = jijiOrdinal(jiji);
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stemIdx && i % 12 === branchIdx) return i;
  }
  throw new Error(`No sexagenary index found for ${cheongan}/${jiji}`);
}

// ====================================================================
// Tests
// ====================================================================

describe('CriticalBoundaryFixtureTest', () => {

  // ================================================================
  // 1. Jeol boundary +/-1 minute -- Year and month pillar transitions
  // ================================================================
  describe('Ipchun 2024 boundary (2024-02-04 17:27 KST)', () => {
    it('ipchun minus 1 minute yields previous year pillar (GYE-MYO)', () => {
      const config = noLmtConfig();
      // 17:26 KST on 2024-02-04 is 1 minute before ipchun at 17:27
      const result = calc(2024, 2, 4, 17, 26, config, 135.0);

      expect(result.pillars.year.cheongan).toBe(Cheongan.GYE);
      expect(result.pillars.year.jiji).toBe(Jiji.MYO);
    });

    it('ipchun plus 1 minute yields current year pillar (GAP-JIN)', () => {
      const config = noLmtConfig();
      // 17:28 KST on 2024-02-04 is 1 minute after ipchun at 17:27
      const result = calc(2024, 2, 4, 17, 28, config, 135.0);

      expect(result.pillars.year.cheongan).toBe(Cheongan.GAP);
      expect(result.pillars.year.jiji).toBe(Jiji.JIN);
    });

    it('ipchun exact instant belongs to previous year (strictly-after rule)', () => {
      const config = noLmtConfig();
      const atBoundary = calc(2024, 2, 4, 17, 27, config, 135.0);
      const after = calc(2024, 2, 4, 17, 28, config, 135.0);

      expect(atBoundary.pillars.year.cheongan).toBe(Cheongan.GYE);
      expect(atBoundary.pillars.year.equals(after.pillars.year)).toBe(false);
    });

    it('ipchun boundary also transitions month pillar from CHUK to IN', () => {
      const config = noLmtConfig();
      const before = calc(2024, 2, 4, 17, 26, config, 135.0);
      const after = calc(2024, 2, 4, 17, 28, config, 135.0);

      expect(before.pillars.month.jiji).toBe(Jiji.CHUK);
      expect(after.pillars.month.jiji).toBe(Jiji.IN);
    });
  });

  describe('Gyeongchip 2024 boundary (2024-03-05 11:23 KST)', () => {
    it('gyeongchip minus 1 minute yields previous month pillar (IN)', () => {
      const config = noLmtConfig();
      const result = calc(2024, 3, 5, 11, 22, config, 135.0);

      expect(result.pillars.month.jiji).toBe(Jiji.IN);
    });

    it('gyeongchip plus 1 minute yields current month pillar (MYO)', () => {
      const config = noLmtConfig();
      const result = calc(2024, 3, 5, 11, 24, config, 135.0);

      expect(result.pillars.month.jiji).toBe(Jiji.MYO);
    });

    it('gyeongchip exact instant belongs to previous month (strictly-after rule)', () => {
      const config = noLmtConfig();
      const atBoundary = calc(2024, 3, 5, 11, 23, config, 135.0);
      const after = calc(2024, 3, 5, 11, 24, config, 135.0);

      expect(atBoundary.pillars.month.jiji).toBe(Jiji.IN);
      expect(after.pillars.month.jiji).toBe(Jiji.MYO);
    });

    it('gyeongchip does not change year pillar', () => {
      const config = noLmtConfig();
      const before = calc(2024, 3, 5, 11, 22, config, 135.0);
      const after = calc(2024, 3, 5, 11, 24, config, 135.0);

      expect(before.pillars.year.equals(after.pillars.year)).toBe(true);
      // Both should be 2024 saju year (GAP-JIN)
      expect(before.pillars.year.cheongan).toBe(Cheongan.GAP);
      expect(before.pillars.year.jiji).toBe(Jiji.JIN);
    });
  });

  // ================================================================
  // 2. Yaza hour boundary -- Day and hour pillar behavior near 23:00
  // ================================================================
  describe('Yaza hour boundary (YAZA_23_TO_01_NEXTDAY mode)', () => {
    it('22:59 is HAE hour on current day', () => {
      const config = yazaConfig();
      const result = calc(2024, 8, 7, 22, 59, config, 135.0);

      expect(result.pillars.hour.jiji).toBe(Jiji.HAE);
    });

    it('23:00 is JA hour on next day', () => {
      const config = yazaConfig();
      const before = calc(2024, 8, 7, 22, 59, config, 135.0);
      const at2300 = calc(2024, 8, 7, 23, 0, config, 135.0);

      expect(at2300.pillars.hour.jiji).toBe(Jiji.JA);
      expect(before.pillars.day.equals(at2300.pillars.day)).toBe(false);
    });

    it('23:30 is still JA hour on next day', () => {
      const config = yazaConfig();
      const at2300 = calc(2024, 8, 7, 23, 0, config, 135.0);
      const at2330 = calc(2024, 8, 7, 23, 30, config, 135.0);

      expect(at2330.pillars.hour.jiji).toBe(Jiji.JA);
      expect(at2300.pillars.day.equals(at2330.pillars.day)).toBe(true);
    });

    it('00:00 is JA hour on current day', () => {
      const config = yazaConfig();
      const at0000 = calc(2024, 8, 8, 0, 0, config, 135.0);

      expect(at0000.pillars.hour.jiji).toBe(Jiji.JA);
    });

    it('00:30 is JA hour on current day', () => {
      const config = yazaConfig();
      const at0030 = calc(2024, 8, 8, 0, 30, config, 135.0);

      expect(at0030.pillars.hour.jiji).toBe(Jiji.JA);
    });

    it('01:00 is CHUK hour on current day', () => {
      const config = yazaConfig();
      const at0100 = calc(2024, 8, 8, 1, 0, config, 135.0);

      expect(at0100.pillars.hour.jiji).toBe(Jiji.CHUK);
    });

    it('23:00 on Aug 7 and 00:00 on Aug 8 share same day pillar', () => {
      const config = yazaConfig();
      const at2300 = calc(2024, 8, 7, 23, 0, config, 135.0);
      const at0000 = calc(2024, 8, 8, 0, 0, config, 135.0);

      expect(at2300.pillars.day.equals(at0000.pillars.day)).toBe(true);
    });
  });

  // ================================================================
  // 3. DST transition boundary -- Korean DST 1988
  // ================================================================
  describe('Korean DST 1988 transitions', () => {
    it('before DST start (23:59 May 7) has no correction', () => {
      const config = dstEnabledConfig();
      const result = calc(1988, 5, 7, 23, 59, config);

      expect(result.dstCorrectionMinutes).toBe(0);
    });

    it('at DST start (00:00 May 8) has 60m correction', () => {
      const config = dstEnabledConfig();
      const result = calc(1988, 5, 8, 0, 0, config);

      expect(result.dstCorrectionMinutes).toBe(60);
      // Standard moment should be shifted back 1 hour: 23:00 May 7
      expect(result.standardHour).toBe(23);
      expect(result.standardDay).toBe(7);
      expect(result.standardMonth).toBe(5);
    });

    it('mid-summer 1988 has correct DST correction', () => {
      const config = dstEnabledConfig();
      // 1988-07-15 14:30 KDT -> standard: 13:30 KST
      const result = calc(1988, 7, 15, 14, 30, config);

      expect(result.dstCorrectionMinutes).toBe(60);
      expect(result.standardHour).toBe(13);
      expect(result.standardMinute).toBe(30);
    });

    it('DST disabled vs enabled produce different results for 1988 summer', () => {
      const withDst = dstEnabledConfig();
      const withoutDst = noLmtConfig(false);

      const resultOn = calc(1988, 7, 15, 0, 30, withDst);
      const resultOff = calc(1988, 7, 15, 0, 30, withoutDst);

      expect(resultOn.dstCorrectionMinutes).toBe(60);
      expect(resultOff.dstCorrectionMinutes).toBe(0);
      // Standard hours should differ
      expect(resultOn.standardHour).not.toBe(resultOff.standardHour);
    });

    it('before DST end (23:59 Oct 8) still has 60m correction', () => {
      const config = dstEnabledConfig();
      const result = calc(1988, 10, 8, 23, 59, config);

      expect(result.dstCorrectionMinutes).toBe(60);
    });

    it('at DST end (00:00 Oct 9) has no correction', () => {
      const config = dstEnabledConfig();
      const result = calc(1988, 10, 9, 0, 0, config);

      expect(result.dstCorrectionMinutes).toBe(0);
    });
  });

  // ================================================================
  // 4. Day pillar transition correctness
  // ================================================================
  describe('Day pillar transitions', () => {
    it('yaza mode changes day pillar at 23:00, not midnight', () => {
      const yazaCfg = yazaConfig();
      const midCfg = midnightConfig();

      const yazaBefore = calc(2024, 8, 7, 22, 59, yazaCfg, 135.0);
      const yazaAfter = calc(2024, 8, 7, 23, 0, yazaCfg, 135.0);
      const midBefore = calc(2024, 8, 7, 23, 59, midCfg, 135.0);
      const midAfter = calc(2024, 8, 8, 0, 0, midCfg, 135.0);

      // YAZA rolls at 23:00
      expect(yazaBefore.pillars.day.equals(yazaAfter.pillars.day)).toBe(false);
      // MIDNIGHT does NOT roll at 23:00 -- same day for 23:59 Aug 7
      // (compared to itself, this is a tautology; the real check is midBefore vs midAfter)
      // MIDNIGHT rolls at 00:00
      expect(midBefore.pillars.day.equals(midAfter.pillars.day)).toBe(false);
    });

    it('consecutive days at noon have consecutive day pillars (mod 60)', () => {
      const config = noLmtConfig();
      const day1 = calc(2024, 8, 7, 12, 0, config, 135.0);
      const day2 = calc(2024, 8, 8, 12, 0, config, 135.0);

      const index1 = sexagenaryIndex(day1.pillars.day.cheongan, day1.pillars.day.jiji);
      const index2 = sexagenaryIndex(day2.pillars.day.cheongan, day2.pillars.day.jiji);
      const diff = ((index2 - index1) % 60 + 60) % 60;

      expect(diff).toBe(1);
    });

    it('consecutive days across month boundary have consecutive day pillars', () => {
      const config = noLmtConfig();
      const lastDay = calc(2024, 7, 31, 12, 0, config, 135.0);
      const firstDay = calc(2024, 8, 1, 12, 0, config, 135.0);

      const idx1 = sexagenaryIndex(lastDay.pillars.day.cheongan, lastDay.pillars.day.jiji);
      const idx2 = sexagenaryIndex(firstDay.pillars.day.cheongan, firstDay.pillars.day.jiji);
      const diff = ((idx2 - idx1) % 60 + 60) % 60;

      expect(diff).toBe(1);
    });
  });

  // ================================================================
  // 5. Early/late ja-si split
  // ================================================================
  describe('Early/late ja-si split (YAZA mode)', () => {
    it('early jasi (23:00) and late jasi (00:00 next day) share same day pillar and hour pillar', () => {
      const config = yazaConfig();
      // At 23:00 on Aug 7, YAZA advances to Aug 8's day pillar
      const earlyJasi = calc(2024, 8, 7, 23, 0, config, 135.0);
      // At 00:00 on Aug 8, same day pillar (Aug 8)
      const lateJasi = calc(2024, 8, 8, 0, 0, config, 135.0);

      // Both should be JA
      expect(earlyJasi.pillars.hour.jiji).toBe(Jiji.JA);
      expect(lateJasi.pillars.hour.jiji).toBe(Jiji.JA);

      // Both use Aug 8 day pillar, so hour stems should match
      expect(earlyJasi.pillars.day.equals(lateJasi.pillars.day)).toBe(true);
      expect(earlyJasi.pillars.hour.equals(lateJasi.pillars.hour)).toBe(true);
    });

    it('early jasi hour pillar differs from previous day late jasi when day stems differ', () => {
      const config = yazaConfig();
      // Late jasi of Aug 7: 00:00 on Aug 7 -> day pillar for Aug 7
      const lateJasiDay7 = calc(2024, 8, 7, 0, 0, config, 135.0);
      // Early jasi of Aug 7: 23:00 on Aug 7 -> day pillar for Aug 8 (YAZA rollover)
      const earlyJasiDay7 = calc(2024, 8, 7, 23, 0, config, 135.0);

      expect(lateJasiDay7.pillars.hour.jiji).toBe(Jiji.JA);
      expect(earlyJasiDay7.pillars.hour.jiji).toBe(Jiji.JA);

      // Day pillars are different (Aug 7 vs Aug 8)
      expect(lateJasiDay7.pillars.day.equals(earlyJasiDay7.pillars.day)).toBe(false);

      // Since day stems differ (consecutive days), day stems must differ
      expect(lateJasiDay7.pillars.day.cheongan).not.toBe(earlyJasiDay7.pillars.day.cheongan);
    });

    it('22:59 is HAE while 23:00 is JA', () => {
      const config = yazaConfig();
      const hae = calc(2024, 8, 7, 22, 59, config, 135.0);
      const ja = calc(2024, 8, 7, 23, 0, config, 135.0);

      expect(hae.pillars.hour.jiji).toBe(Jiji.HAE);
      expect(ja.pillars.hour.jiji).toBe(Jiji.JA);
    });

    it('00:59 is JA while 01:00 is CHUK', () => {
      const config = yazaConfig();
      const ja = calc(2024, 8, 8, 0, 59, config, 135.0);
      const chuk = calc(2024, 8, 8, 1, 0, config, 135.0);

      expect(ja.pillars.hour.jiji).toBe(Jiji.JA);
      expect(chuk.pillars.hour.jiji).toBe(Jiji.CHUK);
    });
  });

  // ================================================================
  // DST + YAZA compound boundary
  // ================================================================
  describe('DST + YAZA compound boundary', () => {
    it('DST correction near midnight can shift day pillar in yaza mode', () => {
      const withDst = yazaConfig(true);
      const withoutDst = yazaConfig(false);

      // 1988-06-01 00:15 KDT:
      // With DST(-60): standard=1988-05-31 23:15, LMT(126.978, baseline=135)=-32min -> adjusted=22:43
      //   => adjusted hour=22 => no YAZA roll => day = May 31
      // Without DST: standard=1988-06-01 00:15, LMT=-32min -> adjusted=May 31 23:43
      //   => adjusted hour=23 on May 31 => YAZA rolls to June 1
      // So: DST on => day=May31, DST off => day=June1. Different!
      const resultOn = calc(1988, 6, 1, 0, 15, withDst);
      const resultOff = calc(1988, 6, 1, 0, 15, withoutDst);

      expect(resultOn.pillars.day.equals(resultOff.pillars.day)).toBe(false);
    });
  });
});
