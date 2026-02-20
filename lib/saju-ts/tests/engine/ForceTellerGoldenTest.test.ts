import { describe, it, expect } from 'vitest';
import { calculatePillars, type SajuPillarResult } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';

/**
 * Golden tests validating our saju engine against ForceTeller (forceteller.com)
 * verified data. These are the definitive accuracy tests.
 *
 * Each test case includes:
 * - Exact birth datetime with timezone
 * - City/longitude for LMT correction
 * - Expected four pillars verified against ForceTeller output
 *
 * Note: ForceTeller applies LMT correction but does NOT apply
 * Equation of Time. Our engine's default config matches this behavior.
 *
 * LMT offsets by city (standard meridian for KST = 135.0):
 * - Seoul  (126.978): (126.978 - 135.0) * 4 = -32 min
 * - Daegu  (128.601): (128.601 - 135.0) * 4 = -26 min
 * - Busan  (129.075): (129.075 - 135.0) * 4 = -24 min
 */

const config = createConfig({
  includeEquationOfTime: false,
  applyDstHistory: true,
});

const SEOUL_LON = 126.978;
const DAEGU_LON = 128.601;
const BUSAN_LON = 129.075;

function seoulInput(
  year: number, month: number, day: number,
  hour: number, minute: number, gender: Gender,
) {
  return createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender, longitude: SEOUL_LON,
  });
}

function cityInput(
  year: number, month: number, day: number,
  hour: number, minute: number, gender: Gender,
  longitude: number,
) {
  return createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender, longitude,
  });
}

function assertPillars(
  result: SajuPillarResult,
  yearStem: Cheongan, yearBranch: Jiji,
  monthStem: Cheongan, monthBranch: Jiji,
  dayStem: Cheongan, dayBranch: Jiji,
  hourStem: Cheongan, hourBranch: Jiji,
  caseName: string,
) {
  expect(result.pillars.year.cheongan, `${caseName} year stem`).toBe(yearStem);
  expect(result.pillars.year.jiji, `${caseName} year branch`).toBe(yearBranch);
  expect(result.pillars.month.cheongan, `${caseName} month stem`).toBe(monthStem);
  expect(result.pillars.month.jiji, `${caseName} month branch`).toBe(monthBranch);
  expect(result.pillars.day.cheongan, `${caseName} day stem`).toBe(dayStem);
  expect(result.pillars.day.jiji, `${caseName} day branch`).toBe(dayBranch);
  expect(result.pillars.hour.cheongan, `${caseName} hour stem`).toBe(hourStem);
  expect(result.pillars.hour.jiji, `${caseName} hour branch`).toBe(hourBranch);
}

describe('ForceTellerGoldenTest', () => {
  // Case 1: 1986/04/19 05:45 KST, Male, Seoul
  it('case01 1986-04-19 0545', () => {
    const input = seoulInput(1986, 4, 19, 5, 45, Gender.MALE);
    const result = calculatePillars(input, config);
    assertPillars(result,
      Cheongan.BYEONG, Jiji.IN,
      Cheongan.IM, Jiji.JIN,
      Cheongan.GYE, Jiji.SA,
      Cheongan.EUL, Jiji.MYO,
      'case01',
    );
  });

  // Case 2: 1989/01/10 01:30 KST, Male, Seoul
  it('case02 1989-01-10 0130', () => {
    const input = seoulInput(1989, 1, 10, 1, 30, Gender.MALE);
    const result = calculatePillars(input, config);
    assertPillars(result,
      Cheongan.MU, Jiji.JIN,
      Cheongan.EUL, Jiji.CHUK,
      Cheongan.GYEONG, Jiji.O,
      Cheongan.BYEONG, Jiji.JA,
      'case02',
    );
  });

  // Case 3: 1996/12/25 11:30 KST, Female, Seoul
  it('case03 1996-12-25 1130', () => {
    const input = seoulInput(1996, 12, 25, 11, 30, Gender.FEMALE);
    const result = calculatePillars(input, config);
    assertPillars(result,
      Cheongan.BYEONG, Jiji.JA,
      Cheongan.GYEONG, Jiji.JA,
      Cheongan.BYEONG, Jiji.SIN,
      Cheongan.GYE, Jiji.SA,
      'case03',
    );
  });

  // Case 4: 2001/08/01 00:02 KST, Female, Seoul -- midnight boundary
  it('case04 2001-08-01 0002 midnight boundary', () => {
    const input = seoulInput(2001, 8, 1, 0, 2, Gender.FEMALE);
    const result = calculatePillars(input, config);
    assertPillars(result,
      Cheongan.SIN, Jiji.SA,
      Cheongan.EUL, Jiji.MI,
      Cheongan.BYEONG, Jiji.SIN,
      Cheongan.MU, Jiji.JA,
      'case04',
    );
  });

  // Case 5: 1969/03/15 15:29 KST, Male, Seoul
  it('case05 1969-03-15 1529', () => {
    const input = seoulInput(1969, 3, 15, 15, 29, Gender.MALE);
    const result = calculatePillars(input, config);
    assertPillars(result,
      Cheongan.GI, Jiji.YU,
      Cheongan.JEONG, Jiji.MYO,
      Cheongan.GI, Jiji.CHUK,
      Cheongan.SIN, Jiji.MI,
      'case05',
    );
  });

  // Case 6: 2010/01/01 00:00 KST, Female, Seoul -- year boundary
  it('case06 2010-01-01 0000 year boundary', () => {
    const input = seoulInput(2010, 1, 1, 0, 0, Gender.FEMALE);
    const result = calculatePillars(input, config);
    assertPillars(result,
      Cheongan.GI, Jiji.CHUK,
      Cheongan.BYEONG, Jiji.JA,
      Cheongan.SIN, Jiji.HAE,
      Cheongan.MU, Jiji.JA,
      'case06',
    );
  });

  // Case 7: 1916/01/06 23:59 KST, Male, Seoul -- historical near midnight
  it('case07 1916-01-06 2359 historical near midnight', () => {
    const input = seoulInput(1916, 1, 6, 23, 59, Gender.MALE);
    const result = calculatePillars(input, config);
    assertPillars(result,
      Cheongan.EUL, Jiji.MYO,
      Cheongan.MU, Jiji.JA,
      Cheongan.GYE, Jiji.MYO,
      Cheongan.IM, Jiji.JA,
      'case07',
    );
  });

  // Case 8: 2025/08/26 00:30 KST, Female, Seoul -- midnight boundary
  it('case08 2025-08-26 0030 midnight boundary', () => {
    const input = seoulInput(2025, 8, 26, 0, 30, Gender.FEMALE);
    const result = calculatePillars(input, config);
    assertPillars(result,
      Cheongan.EUL, Jiji.SA,
      Cheongan.GAP, Jiji.SIN,
      Cheongan.JEONG, Jiji.MYO,
      Cheongan.GYEONG, Jiji.JA,
      'case08',
    );
  });

  // Case 9: 1991/02/18 05:25 KST, Female, Daegu
  it('case09 1991-02-18 0525 Daegu', () => {
    const input = cityInput(1991, 2, 18, 5, 25, Gender.FEMALE, DAEGU_LON);
    const result = calculatePillars(input, config);
    assertPillars(result,
      Cheongan.SIN, Jiji.MI,
      Cheongan.GYEONG, Jiji.IN,
      Cheongan.GI, Jiji.MI,
      Cheongan.BYEONG, Jiji.IN,
      'case09',
    );
  });

  // Case 10: 2022/04/06 19:00 KST, Male, Busan
  it('case10 2022-04-06 1900 Busan', () => {
    const input = cityInput(2022, 4, 6, 19, 0, Gender.MALE, BUSAN_LON);
    const result = calculatePillars(input, config);
    assertPillars(result,
      Cheongan.IM, Jiji.IN,
      Cheongan.GAP, Jiji.JIN,
      Cheongan.GI, Jiji.CHUK,
      Cheongan.GYE, Jiji.YU,
      'case10',
    );
  });

  describe('BoundaryAnalysis', () => {
    it('case04 YAZA compensates for LMT shift across midnight', () => {
      const withLmt = seoulInput(2001, 8, 1, 0, 2, Gender.FEMALE);
      const resultWithLmt = calculatePillars(withLmt, config);

      const withoutLmt = createBirthInput({
        birthYear: 2001, birthMonth: 8, birthDay: 1,
        birthHour: 0, birthMinute: 2,
        gender: Gender.FEMALE, longitude: 135.0,
      });
      const resultWithoutLmt = calculatePillars(withoutLmt, config);

      expect(resultWithLmt.pillars.day.equals(resultWithoutLmt.pillars.day)).toBe(true);
    });

    it('LMT changes hour pillar across sijnin boundary', () => {
      const withLmt = seoulInput(2001, 8, 1, 1, 15, Gender.FEMALE);
      const resultWithLmt = calculatePillars(withLmt, config);

      const withoutLmt = createBirthInput({
        birthYear: 2001, birthMonth: 8, birthDay: 1,
        birthHour: 1, birthMinute: 15,
        gender: Gender.FEMALE, longitude: 135.0,
      });
      const resultWithoutLmt = calculatePillars(withoutLmt, config);

      expect(resultWithLmt.pillars.hour.jiji).not.toBe(resultWithoutLmt.pillars.hour.jiji);
    });

    it('case06 year month pillars unaffected by LMT', () => {
      const withLmt = seoulInput(2010, 1, 1, 0, 0, Gender.FEMALE);
      const resultWithLmt = calculatePillars(withLmt, config);

      const withoutLmt = createBirthInput({
        birthYear: 2010, birthMonth: 1, birthDay: 1,
        birthHour: 0, birthMinute: 0,
        gender: Gender.FEMALE, longitude: 135.0,
      });
      const resultWithoutLmt = calculatePillars(withoutLmt, config);

      expect(resultWithLmt.pillars.year.equals(resultWithoutLmt.pillars.year)).toBe(true);
      expect(resultWithLmt.pillars.month.equals(resultWithoutLmt.pillars.month)).toBe(true);
      expect(resultWithLmt.pillars.day.equals(resultWithoutLmt.pillars.day)).toBe(true);
    });

    it('DST period 1988-06-01 0030 should apply DST correction', () => {
      const input = seoulInput(1988, 6, 1, 0, 30, Gender.MALE);
      const resultWithDst = calculatePillars(input, config);

      const configNoDst = createConfig({
        includeEquationOfTime: false,
        applyDstHistory: false,
      });
      const resultWithoutDst = calculatePillars(input, configNoDst);

      expect(resultWithDst.pillars.day.equals(resultWithoutDst.pillars.day)).toBe(false);
    });
  });
});
