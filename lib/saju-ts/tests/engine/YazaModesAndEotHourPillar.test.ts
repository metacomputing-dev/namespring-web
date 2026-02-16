import { describe, it, expect } from 'vitest';
import { calculatePillars, SajuPillarResult } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import {
  CalculationConfig, createConfig, configFromPreset, SchoolPreset,
} from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { equationOfTimeMinutes } from '../../src/calendar/time/SolarTimeAdjuster.js';

/**
 * ACC-4: Exhaustive tests for YAZA_23_30_TO_01_30_NEXTDAY mode and
 * Equation of Time (EoT) effects on hour pillar assignment.
 *
 * YAZA_23_30 mode:
 * - 23:00-23:29 => current day, hour pillar = JA
 * - 23:30-23:59 => NEXT day, hour pillar = JA
 * - 00:00-00:59 => current day (already next calendar day), hour pillar = JA
 *
 * EoT accounts for Earth's orbital eccentricity and axial tilt,
 * causing solar noon to deviate from clock noon by up to ~16 minutes.
 */

const TIMEZONE = 'Asia/Seoul';
const SEOUL_LON = 126.978;
const MERIDIAN_LON = 135.0; // Zero LMT correction

function yaza2330Config(): CalculationConfig {
  return {
    ...configFromPreset(SchoolPreset.KOREAN_MAINSTREAM),
    dayCutMode: DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY,
    applyDstHistory: false,
    includeEquationOfTime: false,
  };
}

function configWith(
  includeEot: boolean,
  mode: DayCutMode = DayCutMode.MIDNIGHT_00,
): CalculationConfig {
  return {
    ...configFromPreset(SchoolPreset.KOREAN_MAINSTREAM),
    dayCutMode: mode,
    applyDstHistory: false,
    includeEquationOfTime: includeEot,
  };
}

function calc(
  year: number, month: number, day: number,
  hour: number, minute: number,
  config: CalculationConfig, longitude = SEOUL_LON,
): SajuPillarResult {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender: Gender.MALE, longitude, name: 'yaza-eot-test',
  });
  return calculatePillars(input, config);
}

function calcWithMode(
  mode: DayCutMode,
  year: number, month: number, day: number,
  hour: number, minute: number,
): SajuPillarResult {
  const config: CalculationConfig = {
    ...configFromPreset(SchoolPreset.KOREAN_MAINSTREAM),
    dayCutMode: mode,
    applyDstHistory: false,
    includeEquationOfTime: false,
  };
  return calc(year, month, day, hour, minute, config, MERIDIAN_LON);
}

/**
 * Get day of year for EoT calculation.
 */
function getDayOfYear(year: number, month: number, day: number): number {
  const d = new Date(year, month - 1, day);
  const start = new Date(year, 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

describe('YazaModesAndEotHourPillar', () => {

  // =========================================================================
  // Part 1: YAZA_23_30 mode behavior
  // =========================================================================

  describe('YAZA_23_30 mode behavior', () => {
    it('hour 23:00-23:29 uses current day', () => {
      const config = yaza2330Config();
      const at2300 = calc(2024, 5, 10, 23, 0, config, MERIDIAN_LON);
      const at2315 = calc(2024, 5, 10, 23, 15, config, MERIDIAN_LON);
      const at2329 = calc(2024, 5, 10, 23, 29, config, MERIDIAN_LON);
      const may10Pillar = GanjiCycle.dayPillarByJdn(2024, 5, 10);

      expect(at2300.pillars.day.equals(may10Pillar)).toBe(true);
      expect(at2315.pillars.day.equals(may10Pillar)).toBe(true);
      expect(at2329.pillars.day.equals(may10Pillar)).toBe(true);
    });

    it('hour 23:30-23:59 uses next day', () => {
      const config = yaza2330Config();
      const at2330 = calc(2024, 5, 10, 23, 30, config, MERIDIAN_LON);
      const at2345 = calc(2024, 5, 10, 23, 45, config, MERIDIAN_LON);
      const at2359 = calc(2024, 5, 10, 23, 59, config, MERIDIAN_LON);
      const may11Pillar = GanjiCycle.dayPillarByJdn(2024, 5, 11);

      expect(at2330.pillars.day.equals(may11Pillar)).toBe(true);
      expect(at2345.pillars.day.equals(may11Pillar)).toBe(true);
      expect(at2359.pillars.day.equals(may11Pillar)).toBe(true);
    });

    it('hour 00:00-00:59 uses current calendar day', () => {
      const config = yaza2330Config();
      const at0000 = calc(2024, 5, 11, 0, 0, config, MERIDIAN_LON);
      const at0030 = calc(2024, 5, 11, 0, 30, config, MERIDIAN_LON);
      const at0059 = calc(2024, 5, 11, 0, 59, config, MERIDIAN_LON);
      const may11Pillar = GanjiCycle.dayPillarByJdn(2024, 5, 11);

      expect(at0000.pillars.day.equals(may11Pillar)).toBe(true);
      expect(at0030.pillars.day.equals(may11Pillar)).toBe(true);
      expect(at0059.pillars.day.equals(may11Pillar)).toBe(true);
    });

    it('all Ja-shi times produce JA branch', () => {
      const config = yaza2330Config();
      const at2300 = calc(2024, 5, 10, 23, 0, config, MERIDIAN_LON);
      const at2330 = calc(2024, 5, 10, 23, 30, config, MERIDIAN_LON);
      const at0030 = calc(2024, 5, 11, 0, 30, config, MERIDIAN_LON);

      expect(at2300.pillars.hour.jiji).toBe(Jiji.JA);
      expect(at2330.pillars.hour.jiji).toBe(Jiji.JA);
      expect(at0030.pillars.hour.jiji).toBe(Jiji.JA);
    });

    it('day pillar advances exactly at 23:30', () => {
      const config = yaza2330Config();
      const at2329 = calc(2024, 5, 10, 23, 29, config, MERIDIAN_LON);
      const at2330 = calc(2024, 5, 10, 23, 30, config, MERIDIAN_LON);

      expect(at2329.pillars.day.equals(at2330.pillars.day)).toBe(false);
    });
  });

  // =========================================================================
  // Part 2: Cross-mode comparison
  // =========================================================================

  describe('Cross-mode comparison', () => {
    it('modes compared at 23:15', () => {
      const yaza23 = calcWithMode(DayCutMode.YAZA_23_TO_01_NEXTDAY, 2024, 5, 10, 23, 15);
      const yaza2330 = calcWithMode(DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY, 2024, 5, 10, 23, 15);
      const midnight = calcWithMode(DayCutMode.MIDNIGHT_00, 2024, 5, 10, 23, 15);

      const may11 = GanjiCycle.dayPillarByJdn(2024, 5, 11);
      const may10 = GanjiCycle.dayPillarByJdn(2024, 5, 10);

      expect(yaza23.pillars.day.equals(may11)).toBe(true);
      expect(yaza2330.pillars.day.equals(may10)).toBe(true);
      expect(midnight.pillars.day.equals(may10)).toBe(true);
    });

    it('modes compared at 23:45', () => {
      const yaza23 = calcWithMode(DayCutMode.YAZA_23_TO_01_NEXTDAY, 2024, 5, 10, 23, 45);
      const yaza2330 = calcWithMode(DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY, 2024, 5, 10, 23, 45);
      const midnight = calcWithMode(DayCutMode.MIDNIGHT_00, 2024, 5, 10, 23, 45);

      const may11 = GanjiCycle.dayPillarByJdn(2024, 5, 11);
      const may10 = GanjiCycle.dayPillarByJdn(2024, 5, 10);

      expect(yaza23.pillars.day.equals(may11)).toBe(true);
      expect(yaza2330.pillars.day.equals(may11)).toBe(true);
      expect(midnight.pillars.day.equals(may10)).toBe(true);
    });

    it('modes compared at 00:15 (all agree)', () => {
      const yaza23 = calcWithMode(DayCutMode.YAZA_23_TO_01_NEXTDAY, 2024, 5, 11, 0, 15);
      const yaza2330 = calcWithMode(DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY, 2024, 5, 11, 0, 15);
      const midnight = calcWithMode(DayCutMode.MIDNIGHT_00, 2024, 5, 11, 0, 15);

      const may11 = GanjiCycle.dayPillarByJdn(2024, 5, 11);

      expect(yaza23.pillars.day.equals(may11)).toBe(true);
      expect(yaza2330.pillars.day.equals(may11)).toBe(true);
      expect(midnight.pillars.day.equals(may11)).toBe(true);
    });
  });

  // =========================================================================
  // Part 3: Hour pillar changes from YAZA day advancement
  // =========================================================================

  describe('Hour pillar stem changes when day pillar advances', () => {
    it('hour stem changes at YAZA 23:30 boundary', () => {
      const config = yaza2330Config();
      const at2329 = calc(2024, 5, 10, 23, 29, config, MERIDIAN_LON);
      const at2330 = calc(2024, 5, 10, 23, 30, config, MERIDIAN_LON);

      // Both are in JA hour, so branch is the same
      expect(at2329.pillars.hour.jiji).toBe(at2330.pillars.hour.jiji);

      // Day stems should differ (day pillar changed)
      expect(at2329.pillars.day.cheongan).not.toBe(at2330.pillars.day.cheongan);

      // Verify hour pillar is consistent with new day stem
      const expectedHourPillar = GanjiCycle.hourPillar(at2330.pillars.day.cheongan, 23);
      expect(at2330.pillars.hour.equals(expectedHourPillar)).toBe(true);
    });
  });

  // =========================================================================
  // Part 4: Equation of Time (EoT) effects
  // =========================================================================

  describe('Equation of Time effects', () => {
    it('EoT max negative around Feb 12 has significant magnitude', () => {
      const dayOfYear = getDayOfYear(2024, 2, 12);
      const eot = equationOfTimeMinutes(dayOfYear);
      expect(eot).toBeLessThan(-10);
      expect(eot).toBeGreaterThan(-20);
    });

    it('EoT max positive around Nov 3 has significant magnitude', () => {
      const dayOfYear = getDayOfYear(2024, 11, 3);
      const eot = equationOfTimeMinutes(dayOfYear);
      expect(eot).toBeGreaterThan(10);
      expect(eot).toBeLessThan(20);
    });

    it('EoT can change hour pillar when near hour boundary', () => {
      // Nov 3 has large positive EoT (~+16 min).
      // Birth at 02:55 + ~16 min => ~03:11 => crosses from CHUK to IN hour.
      const dayOfYear = getDayOfYear(2024, 11, 3);
      const eot = equationOfTimeMinutes(dayOfYear);
      expect(eot).toBeGreaterThan(10); // precondition

      const configOff = configWith(false);
      const configOn = configWith(true);

      const resultOff = calc(2024, 11, 3, 2, 55, configOff, MERIDIAN_LON);
      const resultOn = calc(2024, 11, 3, 2, 55, configOn, MERIDIAN_LON);

      // Without EoT: 02:55 => CHUK hour (01:00-02:59)
      expect(resultOff.pillars.hour.jiji).toBe(Jiji.CHUK);

      // With EoT: 02:55 + ~16min => ~03:11 => IN hour (03:00-04:59)
      expect(resultOn.pillars.hour.jiji).toBe(Jiji.IN);
    });

    it('negative EoT can pull hour backward', () => {
      // Feb 12 has large negative EoT (~-14 to -15 min).
      // Birth at 03:10 with EoT => adjusted ~02:55 => CHUK hour instead of IN
      const dayOfYear = getDayOfYear(2024, 2, 12);
      const eot = equationOfTimeMinutes(dayOfYear);
      expect(eot).toBeLessThan(-10); // precondition

      const configOff = configWith(false);
      const configOn = configWith(true);

      const resultOff = calc(2024, 2, 12, 3, 10, configOff, MERIDIAN_LON);
      const resultOn = calc(2024, 2, 12, 3, 10, configOn, MERIDIAN_LON);

      expect(resultOff.pillars.hour.jiji).toBe(Jiji.IN);
      expect(resultOn.pillars.hour.jiji).toBe(Jiji.CHUK);
    });

    it('EoT does not affect day pillar when far from midnight', () => {
      const configOff = configWith(false);
      const configOn = configWith(true);

      const resultOff = calc(2024, 2, 12, 12, 0, configOff, MERIDIAN_LON);
      const resultOn = calc(2024, 2, 12, 12, 0, configOn, MERIDIAN_LON);

      expect(resultOff.pillars.day.equals(resultOn.pillars.day)).toBe(true);
    });

    it('EoT combined with LMT produces cumulative effect', () => {
      // Seoul longitude 126.978 => LMT = (126.978 - 135) * 4 = -32 min
      // Nov 3 EoT ~+16 min. Net ~= -32 + 16 = -16 min.
      // Birth at 01:20 KST:
      //   Without EoT: 01:20 - 32 = 00:48 => JA hour
      //   With EoT:    01:20 - 32 + 16 = 01:04 => CHUK hour
      const configOff = configWith(false);
      const configOn = configWith(true);

      const resultOff = calc(2024, 11, 3, 1, 20, configOff, SEOUL_LON);
      const resultOn = calc(2024, 11, 3, 1, 20, configOn, SEOUL_LON);

      expect(resultOff.pillars.hour.jiji).toBe(Jiji.JA);
      expect(resultOn.pillars.hour.jiji).toBe(Jiji.CHUK);
    });
  });

  // =========================================================================
  // Part 5: EoT symmetry and boundary properties
  // =========================================================================

  describe('EoT boundary properties', () => {
    it('EoT is small near April 15 zero crossing', () => {
      const dayOfYear = getDayOfYear(2024, 4, 15);
      const eot = equationOfTimeMinutes(dayOfYear);
      expect(Math.abs(eot)).toBeLessThanOrEqual(2);
    });

    it('EoT toggle does not change hour pillar when not near boundary', () => {
      const configOff = configWith(false);
      const configOn = configWith(true);

      // 14:30 is center of MI hour (13:00-14:59)
      const resultOff = calc(2024, 6, 15, 14, 30, configOff, MERIDIAN_LON);
      const resultOn = calc(2024, 6, 15, 14, 30, configOn, MERIDIAN_LON);

      expect(resultOff.pillars.hour.equals(resultOn.pillars.hour)).toBe(true);
    });

    it('EoT toggle never changes day pillar at midday across multiple dates', () => {
      const configOff = configWith(false);
      const configOn = configWith(true);

      const testDates: [number, number, number][] = [
        [2024, 1, 15],
        [2024, 2, 12],
        [2024, 6, 21],
        [2024, 8, 15],
        [2024, 11, 3],
      ];

      for (const [y, m, d] of testDates) {
        const off = calc(y, m, d, 12, 0, configOff, MERIDIAN_LON);
        const on = calc(y, m, d, 12, 0, configOn, MERIDIAN_LON);
        expect(off.pillars.day.equals(on.pillars.day)).toBe(true);
      }
    });
  });

  // =========================================================================
  // Part 6: YAZA_23_30 boundary precision across multiple dates
  // =========================================================================

  describe('YAZA_23_30 boundary precision across dates', () => {
    it.each([
      [2024, 1, 1],
      [2024, 3, 15],
      [2024, 6, 21],
      [2024, 9, 22],
      [2024, 12, 31],
    ] as [number, number, number][])('day pillar changes at 23:30 boundary on %i-%i-%i', (y, m, d) => {
      const config = yaza2330Config();
      const at2329 = calc(y, m, d, 23, 29, config, MERIDIAN_LON);
      const at2330 = calc(y, m, d, 23, 30, config, MERIDIAN_LON);

      expect(at2329.pillars.day.equals(at2330.pillars.day)).toBe(false);

      // After 23:30 should match next day pillar
      const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
      const nextDayPillar = GanjiCycle.dayPillarByJdn(
        nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, nextDate.getUTCDate(),
      );
      expect(at2330.pillars.day.equals(nextDayPillar)).toBe(true);
    });
  });
});
