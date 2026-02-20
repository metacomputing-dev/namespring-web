import { describe, it, expect } from 'vitest';
import { koreanDstOffsetMinutes, KOREAN_DST_RANGES } from '../../src/calendar/time/KoreanDstPeriod.js';
import { adjustSolarTime } from '../../src/calendar/time/SolarTimeAdjuster.js';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig } from '../../src/config/CalculationConfig.js';

/**
 * T-04: DST 1949-1951 era boundary and per-year verification.
 *
 * Verifies Korean first DST era (1948-1951) per-year boundary handling.
 * Checks:
 * 1. KoreanDstPeriod definitions are correct for each year
 * 2. DST start/end boundaries work correctly
 * 3. DST summer vs winter correction differences
 * 4. 1952 (post-era) has no DST
 * 5. Pipeline produces valid results with DST correction
 */

const SEOUL_LONGITUDE = 126.978;
const TIMEZONE = 'Asia/Seoul';

function dstAt(year: number, month: number, day: number): number {
  return koreanDstOffsetMinutes(year, month, day);
}

function solarAdjust(
  year: number, month: number, day: number, hour: number, minute: number,
  applyDst: boolean, includeEot = false,
) {
  return adjustSolarTime({
    year, month, day, hour, minute,
    timezone: TIMEZONE,
    longitudeDeg: SEOUL_LONGITUDE,
    applyDstHistory: applyDst,
    includeEquationOfTime: includeEot,
  });
}

function calcWithDst(
  year: number, month: number, day: number, hour: number, minute: number,
  gender: Gender = Gender.MALE,
) {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender,
    longitude: SEOUL_LONGITUDE,
  });
  const config = createConfig({ applyDstHistory: true });
  return calculatePillars(input, config);
}

describe('DstEra1949to1951Boundary', () => {
  // == DST Era 1: 1949 ==

  describe('1949 DST boundaries', () => {
    it('1949 DST period starts on April 3', () => {
      expect(dstAt(1949, 4, 3)).toBe(60);
    });

    it('1949 DST period ends on September 11 (exclusive)', () => {
      expect(dstAt(1949, 9, 10)).toBe(60);
      expect(dstAt(1949, 9, 11)).toBe(0);
    });

    it('1949 March outside DST has no correction', () => {
      expect(dstAt(1949, 3, 15)).toBe(0);
    });

    it('1949 October outside DST has no correction', () => {
      expect(dstAt(1949, 10, 15)).toBe(0);
    });

    it('SolarTimeAdjuster applies DST correction for 1949 summer', () => {
      const result = solarAdjust(1949, 7, 15, 14, 30, true);
      expect(result.dstCorrectionMinutes).toBe(60);
      expect(result.standardHour).toBe(13);
    });

    it('SolarTimeAdjuster no DST for 1949 winter', () => {
      const result = solarAdjust(1949, 1, 15, 14, 30, true);
      expect(result.dstCorrectionMinutes).toBe(0);
      expect(result.standardHour).toBe(14);
    });

    it('pipeline produces valid pillars for 1949 DST summer', () => {
      const result = calcWithDst(1949, 7, 15, 14, 30);
      expect(result.pillars.year).toBeDefined();
      expect(result.pillars.hour).toBeDefined();
      expect(result.pillars.year.cheongan).toBeDefined();
      expect(result.pillars.hour.jiji).toBeDefined();
    });
  });

  // == DST Era 1: 1950 ==

  describe('1950 DST boundaries', () => {
    it('1950 DST period starts on April 1', () => {
      expect(dstAt(1950, 4, 1)).toBe(60);
    });

    it('1950 DST period ends on September 10 (exclusive)', () => {
      expect(dstAt(1950, 9, 9)).toBe(60);
      expect(dstAt(1950, 9, 10)).toBe(0);
    });

    it('1950 March outside DST has no correction', () => {
      expect(dstAt(1950, 3, 15)).toBe(0);
    });

    it('1950 October outside DST has no correction', () => {
      expect(dstAt(1950, 10, 15)).toBe(0);
    });

    it('SolarTimeAdjuster applies DST correction for 1950 summer', () => {
      const result = solarAdjust(1950, 7, 15, 14, 30, true);
      expect(result.dstCorrectionMinutes).toBe(60);
      expect(result.standardHour).toBe(13);
    });

    it('SolarTimeAdjuster no DST for 1950 winter', () => {
      const result = solarAdjust(1950, 1, 15, 14, 30, true);
      expect(result.dstCorrectionMinutes).toBe(0);
      expect(result.standardHour).toBe(14);
    });

    it('pipeline produces valid pillars for 1950 DST summer', () => {
      const result = calcWithDst(1950, 7, 15, 14, 30, Gender.FEMALE);
      expect(result.pillars.year.jiji).toBeDefined();
      expect(result.pillars.month.cheongan).toBeDefined();
    });
  });

  // == DST Era 1: 1951 ==

  describe('1951 DST boundaries', () => {
    it('1951 DST period starts on May 6', () => {
      expect(dstAt(1951, 5, 6)).toBe(60);
    });

    it('1951 DST period ends on September 9 (exclusive)', () => {
      expect(dstAt(1951, 9, 8)).toBe(60);
      expect(dstAt(1951, 9, 9)).toBe(0);
    });

    it('1951 April outside DST has no correction', () => {
      expect(dstAt(1951, 4, 15)).toBe(0);
    });

    it('1951 October outside DST has no correction', () => {
      expect(dstAt(1951, 10, 15)).toBe(0);
    });

    it('SolarTimeAdjuster applies DST correction for 1951 summer', () => {
      const result = solarAdjust(1951, 7, 15, 14, 30, true);
      expect(result.dstCorrectionMinutes).toBe(60);
      expect(result.standardHour).toBe(13);
    });

    it('SolarTimeAdjuster no DST for 1951 winter', () => {
      const result = solarAdjust(1951, 1, 15, 14, 30, true);
      expect(result.dstCorrectionMinutes).toBe(0);
      expect(result.standardHour).toBe(14);
    });

    it('pipeline produces valid pillars for 1951 DST summer', () => {
      const result = calcWithDst(1951, 7, 15, 14, 30);
      expect(result.pillars.day.cheongan).toBeDefined();
      expect(result.pillars.day.jiji).toBeDefined();
    });
  });

  // == 1952: After DST era 1 (no DST) ==

  describe('1952 after DST era 1', () => {
    it('1952 has no DST anytime', () => {
      const testDates: [number, number, number][] = [
        [1952, 1, 15],
        [1952, 4, 15],
        [1952, 7, 15],
        [1952, 10, 15],
        [1952, 12, 31],
      ];
      for (const [y, m, d] of testDates) {
        expect(dstAt(y, m, d)).toBe(0);
      }
    });

    it('SolarTimeAdjuster has no correction for 1952 summer', () => {
      const result = solarAdjust(1952, 7, 15, 14, 30, true);
      expect(result.dstCorrectionMinutes).toBe(0);
      expect(result.standardHour).toBe(14);
    });

    it('pipeline produces valid pillars for 1952 no-DST birth', () => {
      const result = calcWithDst(1952, 7, 15, 14, 30, Gender.FEMALE);
      expect(result.pillars.hour.cheongan).toBeDefined();
      expect(result.pillars.hour.jiji).toBeDefined();
    });
  });

  // == DST boundary: just before/at transition ==

  describe('DST second-level boundary precision', () => {
    it('1949: day before DST start has no correction', () => {
      expect(dstAt(1949, 4, 2)).toBe(0);
    });

    it('1949: at exact DST start has 60 minute correction', () => {
      expect(dstAt(1949, 4, 3)).toBe(60);
    });

    it('1950: day before DST start has no correction', () => {
      expect(dstAt(1950, 3, 31)).toBe(0);
    });

    it('1950: at exact DST start has 60 minute correction', () => {
      expect(dstAt(1950, 4, 1)).toBe(60);
    });

    it('1951: day before DST start has no correction', () => {
      expect(dstAt(1951, 5, 5)).toBe(0);
    });

    it('1951: at exact DST start has 60 minute correction', () => {
      expect(dstAt(1951, 5, 6)).toBe(60);
    });
  });

  // == Pipeline comparison: DST enabled vs disabled ==

  describe('DST enabled vs disabled comparison', () => {
    it('DST-enabled vs disabled produces valid results for 1949 summer', () => {
      const input = createBirthInput({
        birthYear: 1949, birthMonth: 7, birthDay: 15,
        birthHour: 2, birthMinute: 0, gender: Gender.MALE,
        longitude: SEOUL_LONGITUDE,
      });
      const configWithDst = createConfig({ applyDstHistory: true });
      const configNoDst = createConfig({ applyDstHistory: false });

      const resultWithDst = calculatePillars(input, configWithDst);
      const resultNoDst = calculatePillars(input, configNoDst);

      expect(resultWithDst.pillars.year.cheongan).toBeDefined();
      expect(resultNoDst.pillars.year.cheongan).toBeDefined();
    });
  });

  // == Summer vs winter DST difference is exactly 60 minutes ==

  describe('summer vs winter DST difference is exactly 60 minutes', () => {
    for (const year of [1949, 1950, 1951]) {
      it(`${year}: summer DST - winter DST = 60`, () => {
        const summerDst = dstAt(year, 7, 15);
        const winterDst = dstAt(year, 1, 15);
        expect(summerDst - winterDst).toBe(60);
      });
    }
  });

  // == DST period definitions ==

  describe('DST period definitions in KOREAN_DST_RANGES', () => {
    it('1949 DST period is April 3 to September 11', () => {
      const period = KOREAN_DST_RANGES.find(p => p.startYear === 1949);
      expect(period).toBeDefined();
      expect(period!.startMonth).toBe(4);
      expect(period!.startDay).toBe(3);
      expect(period!.endMonth).toBe(9);
      expect(period!.endDay).toBe(11);
    });

    it('1950 DST period is April 1 to September 10', () => {
      const period = KOREAN_DST_RANGES.find(p => p.startYear === 1950);
      expect(period).toBeDefined();
      expect(period!.startMonth).toBe(4);
      expect(period!.startDay).toBe(1);
      expect(period!.endMonth).toBe(9);
      expect(period!.endDay).toBe(10);
    });

    it('1951 DST period is May 6 to September 9', () => {
      const period = KOREAN_DST_RANGES.find(p => p.startYear === 1951);
      expect(period).toBeDefined();
      expect(period!.startMonth).toBe(5);
      expect(period!.startDay).toBe(6);
      expect(period!.endMonth).toBe(9);
      expect(period!.endDay).toBe(9);
    });
  });
});
