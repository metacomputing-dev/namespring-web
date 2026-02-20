import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { createConfig } from '../../src/config/CalculationConfig.js';

/**
 * V-09: Comprehensive competitor cross-verification test suite.
 *
 * Embeds all 21 manual-case fixture data inline (10 ForceTeller + 11 manual cases)
 * and verifies four pillars for each case.
 *
 * Total cases: 21 (10 ForceTeller + 11 non-ForceTeller manual cases)
 */

const config = createConfig({
  includeEquationOfTime: false,
  applyDstHistory: true,
});

interface FixtureCase {
  id: string;
  name: string;
  year: number; month: number; day: number;
  hour: number; minute: number;
  gender: Gender;
  longitude: number;
  yearStem: Cheongan; yearBranch: Jiji;
  monthStem: Cheongan; monthBranch: Jiji;
  dayStem: Cheongan; dayBranch: Jiji;
  hourStem: Cheongan; hourBranch: Jiji;
}

const forceTellerCases: FixtureCase[] = [
  {
    id: 'FT01', name: '1986-04-19 05:45',
    year: 1986, month: 4, day: 19, hour: 5, minute: 45,
    gender: Gender.MALE, longitude: 126.978,
    yearStem: Cheongan.BYEONG, yearBranch: Jiji.IN,
    monthStem: Cheongan.IM, monthBranch: Jiji.JIN,
    dayStem: Cheongan.GYE, dayBranch: Jiji.SA,
    hourStem: Cheongan.EUL, hourBranch: Jiji.MYO,
  },
  {
    id: 'FT02', name: '1989-01-10 01:30',
    year: 1989, month: 1, day: 10, hour: 1, minute: 30,
    gender: Gender.MALE, longitude: 126.978,
    yearStem: Cheongan.MU, yearBranch: Jiji.JIN,
    monthStem: Cheongan.EUL, monthBranch: Jiji.CHUK,
    dayStem: Cheongan.GYEONG, dayBranch: Jiji.O,
    hourStem: Cheongan.BYEONG, hourBranch: Jiji.JA,
  },
  {
    id: 'FT03', name: '1996-12-25 11:30',
    year: 1996, month: 12, day: 25, hour: 11, minute: 30,
    gender: Gender.FEMALE, longitude: 126.978,
    yearStem: Cheongan.BYEONG, yearBranch: Jiji.JA,
    monthStem: Cheongan.GYEONG, monthBranch: Jiji.JA,
    dayStem: Cheongan.BYEONG, dayBranch: Jiji.SIN,
    hourStem: Cheongan.GYE, hourBranch: Jiji.SA,
  },
  {
    id: 'FT04', name: '2001-08-01 00:02',
    year: 2001, month: 8, day: 1, hour: 0, minute: 2,
    gender: Gender.FEMALE, longitude: 126.978,
    yearStem: Cheongan.SIN, yearBranch: Jiji.SA,
    monthStem: Cheongan.EUL, monthBranch: Jiji.MI,
    dayStem: Cheongan.BYEONG, dayBranch: Jiji.SIN,
    hourStem: Cheongan.MU, hourBranch: Jiji.JA,
  },
  {
    id: 'FT05', name: '1969-03-15 15:29',
    year: 1969, month: 3, day: 15, hour: 15, minute: 29,
    gender: Gender.MALE, longitude: 126.978,
    yearStem: Cheongan.GI, yearBranch: Jiji.YU,
    monthStem: Cheongan.JEONG, monthBranch: Jiji.MYO,
    dayStem: Cheongan.GI, dayBranch: Jiji.CHUK,
    hourStem: Cheongan.SIN, hourBranch: Jiji.MI,
  },
  {
    id: 'FT06', name: '2010-01-01 00:00',
    year: 2010, month: 1, day: 1, hour: 0, minute: 0,
    gender: Gender.FEMALE, longitude: 126.978,
    yearStem: Cheongan.GI, yearBranch: Jiji.CHUK,
    monthStem: Cheongan.BYEONG, monthBranch: Jiji.JA,
    dayStem: Cheongan.SIN, dayBranch: Jiji.HAE,
    hourStem: Cheongan.MU, hourBranch: Jiji.JA,
  },
  {
    id: 'FT07', name: '1916-01-06 23:59',
    year: 1916, month: 1, day: 6, hour: 23, minute: 59,
    gender: Gender.MALE, longitude: 126.978,
    yearStem: Cheongan.EUL, yearBranch: Jiji.MYO,
    monthStem: Cheongan.MU, monthBranch: Jiji.JA,
    dayStem: Cheongan.GYE, dayBranch: Jiji.MYO,
    hourStem: Cheongan.IM, hourBranch: Jiji.JA,
  },
  {
    id: 'FT08', name: '2025-08-26 00:30',
    year: 2025, month: 8, day: 26, hour: 0, minute: 30,
    gender: Gender.FEMALE, longitude: 126.978,
    yearStem: Cheongan.EUL, yearBranch: Jiji.SA,
    monthStem: Cheongan.GAP, monthBranch: Jiji.SIN,
    dayStem: Cheongan.JEONG, dayBranch: Jiji.MYO,
    hourStem: Cheongan.GYEONG, hourBranch: Jiji.JA,
  },
  {
    id: 'FT09', name: '1991-02-18 05:25 Daegu',
    year: 1991, month: 2, day: 18, hour: 5, minute: 25,
    gender: Gender.FEMALE, longitude: 128.601,
    yearStem: Cheongan.SIN, yearBranch: Jiji.MI,
    monthStem: Cheongan.GYEONG, monthBranch: Jiji.IN,
    dayStem: Cheongan.GI, dayBranch: Jiji.MI,
    hourStem: Cheongan.BYEONG, hourBranch: Jiji.IN,
  },
  {
    id: 'FT10', name: '2022-04-06 19:00 Busan',
    year: 2022, month: 4, day: 6, hour: 19, minute: 0,
    gender: Gender.MALE, longitude: 129.075,
    yearStem: Cheongan.IM, yearBranch: Jiji.IN,
    monthStem: Cheongan.GAP, monthBranch: Jiji.JIN,
    dayStem: Cheongan.GI, dayBranch: Jiji.CHUK,
    hourStem: Cheongan.GYE, hourBranch: Jiji.YU,
  },
];

const manualCases: FixtureCase[] = [
  {
    id: 'MC01', name: 'shin_sunhye 1989-10-20 07:30',
    year: 1989, month: 10, day: 20, hour: 7, minute: 30,
    gender: Gender.FEMALE, longitude: 126.978,
    yearStem: Cheongan.GI, yearBranch: Jiji.SA,
    monthStem: Cheongan.GAP, monthBranch: Jiji.SUL,
    dayStem: Cheongan.GYE, dayBranch: Jiji.CHUK,
    hourStem: Cheongan.EUL, hourBranch: Jiji.MYO,
  },
  {
    id: 'MC02', name: 'geukshingang 1984-02-19 06:30',
    year: 1984, month: 2, day: 19, hour: 6, minute: 30,
    gender: Gender.MALE, longitude: 126.978,
    yearStem: Cheongan.GAP, yearBranch: Jiji.JA,
    monthStem: Cheongan.BYEONG, monthBranch: Jiji.IN,
    dayStem: Cheongan.GYE, dayBranch: Jiji.MI,
    hourStem: Cheongan.EUL, hourBranch: Jiji.MYO,
  },
  {
    id: 'MC03', name: 'DST 1988-07-15 14:30',
    year: 1988, month: 7, day: 15, hour: 14, minute: 30,
    gender: Gender.MALE, longitude: 126.978,
    yearStem: Cheongan.MU, yearBranch: Jiji.JIN,
    monthStem: Cheongan.GI, monthBranch: Jiji.MI,
    dayStem: Cheongan.SIN, dayBranch: Jiji.MI,
    hourStem: Cheongan.GAP, hourBranch: Jiji.O,
  },
  {
    id: 'MC04', name: 'yaza 1995-08-20 23:15',
    year: 1995, month: 8, day: 20, hour: 23, minute: 15,
    gender: Gender.MALE, longitude: 126.978,
    yearStem: Cheongan.EUL, yearBranch: Jiji.HAE,
    monthStem: Cheongan.GAP, monthBranch: Jiji.SIN,
    dayStem: Cheongan.GYE, dayBranch: Jiji.MI,
    hourStem: Cheongan.GYE, hourBranch: Jiji.HAE,
  },
  {
    id: 'MC05', name: 'ipchun boundary 2024-02-04 05:30',
    year: 2024, month: 2, day: 4, hour: 5, minute: 30,
    gender: Gender.FEMALE, longitude: 126.978,
    yearStem: Cheongan.GYE, yearBranch: Jiji.MYO,
    monthStem: Cheongan.EUL, monthBranch: Jiji.CHUK,
    dayStem: Cheongan.MU, dayBranch: Jiji.SUL,
    hourStem: Cheongan.GAP, hourBranch: Jiji.IN,
  },
  {
    id: 'MC06', name: 'jeonggwan 1990-04-10 10:00',
    year: 1990, month: 4, day: 10, hour: 10, minute: 0,
    gender: Gender.MALE, longitude: 126.978,
    yearStem: Cheongan.GYEONG, yearBranch: Jiji.O,
    monthStem: Cheongan.GYEONG, monthBranch: Jiji.JIN,
    dayStem: Cheongan.EUL, dayBranch: Jiji.SA,
    hourStem: Cheongan.SIN, hourBranch: Jiji.SA,
  },
  {
    id: 'MC07', name: 'sikshin 1982-09-03 08:00',
    year: 1982, month: 9, day: 3, hour: 8, minute: 0,
    gender: Gender.FEMALE, longitude: 126.978,
    yearStem: Cheongan.IM, yearBranch: Jiji.SUL,
    monthStem: Cheongan.MU, monthBranch: Jiji.SIN,
    dayStem: Cheongan.GI, dayBranch: Jiji.CHUK,
    hourStem: Cheongan.MU, hourBranch: Jiji.JIN,
  },
  {
    id: 'MC08', name: 'pyeonin 1977-01-25 03:00',
    year: 1977, month: 1, day: 25, hour: 3, minute: 0,
    gender: Gender.MALE, longitude: 126.978,
    yearStem: Cheongan.BYEONG, yearBranch: Jiji.JIN,
    monthStem: Cheongan.SIN, monthBranch: Jiji.CHUK,
    dayStem: Cheongan.IM, dayBranch: Jiji.O,
    hourStem: Cheongan.SIN, hourBranch: Jiji.CHUK,
  },
  {
    id: 'MC09', name: 'yangin 1968-05-05 11:00',
    year: 1968, month: 5, day: 5, hour: 11, minute: 0,
    gender: Gender.MALE, longitude: 126.978,
    yearStem: Cheongan.MU, yearBranch: Jiji.SIN,
    monthStem: Cheongan.BYEONG, monthBranch: Jiji.JIN,
    dayStem: Cheongan.EUL, dayBranch: Jiji.HAE,
    hourStem: Cheongan.SIN, hourBranch: Jiji.SA,
  },
  {
    id: 'MC10', name: 'jongjae 1973-11-08 16:00',
    year: 1973, month: 11, day: 8, hour: 16, minute: 0,
    gender: Gender.MALE, longitude: 126.978,
    yearStem: Cheongan.GYE, yearBranch: Jiji.CHUK,
    monthStem: Cheongan.GYE, monthBranch: Jiji.HAE,
    dayStem: Cheongan.MU, dayBranch: Jiji.SIN,
    hourStem: Cheongan.GYEONG, hourBranch: Jiji.SIN,
  },
  {
    id: 'MC11', name: 'haphwa 1985-06-21 09:00',
    year: 1985, month: 6, day: 21, hour: 9, minute: 0,
    gender: Gender.FEMALE, longitude: 126.978,
    yearStem: Cheongan.EUL, yearBranch: Jiji.CHUK,
    monthStem: Cheongan.IM, monthBranch: Jiji.O,
    dayStem: Cheongan.SIN, dayBranch: Jiji.MYO,
    hourStem: Cheongan.IM, hourBranch: Jiji.JIN,
  },
];

const allCases = [...forceTellerCases, ...manualCases];

describe('ForceTellerCrossVerificationTest', () => {
  describe('ForceTeller 10 Cases: Four Pillar Verification', () => {
    for (const fc of forceTellerCases) {
      it(`${fc.name} pillars`, () => {
        const input = createBirthInput({
          birthYear: fc.year, birthMonth: fc.month, birthDay: fc.day,
          birthHour: fc.hour, birthMinute: fc.minute,
          gender: fc.gender, longitude: fc.longitude,
        });
        const analysis = analyzeSaju(input, config);
        const p = analysis.pillars;

        expect(p.year.cheongan, `${fc.id} year stem`).toBe(fc.yearStem);
        expect(p.year.jiji, `${fc.id} year branch`).toBe(fc.yearBranch);
        expect(p.month.cheongan, `${fc.id} month stem`).toBe(fc.monthStem);
        expect(p.month.jiji, `${fc.id} month branch`).toBe(fc.monthBranch);
        expect(p.day.cheongan, `${fc.id} day stem`).toBe(fc.dayStem);
        expect(p.day.jiji, `${fc.id} day branch`).toBe(fc.dayBranch);
        expect(p.hour.cheongan, `${fc.id} hour stem`).toBe(fc.hourStem);
        expect(p.hour.jiji, `${fc.id} hour branch`).toBe(fc.hourBranch);
      });
    }
  });

  describe('Manual 11 Cases: Four Pillar Verification', () => {
    for (const fc of manualCases) {
      it(`${fc.name} pillars`, () => {
        const input = createBirthInput({
          birthYear: fc.year, birthMonth: fc.month, birthDay: fc.day,
          birthHour: fc.hour, birthMinute: fc.minute,
          gender: fc.gender, longitude: fc.longitude,
        });
        const analysis = analyzeSaju(input, config);
        const p = analysis.pillars;

        expect(p.year.cheongan, `${fc.id} year stem`).toBe(fc.yearStem);
        expect(p.year.jiji, `${fc.id} year branch`).toBe(fc.yearBranch);
        expect(p.month.cheongan, `${fc.id} month stem`).toBe(fc.monthStem);
        expect(p.month.jiji, `${fc.id} month branch`).toBe(fc.monthBranch);
        expect(p.day.cheongan, `${fc.id} day stem`).toBe(fc.dayStem);
        expect(p.day.jiji, `${fc.id} day branch`).toBe(fc.dayBranch);
        expect(p.hour.cheongan, `${fc.id} hour stem`).toBe(fc.hourStem);
        expect(p.hour.jiji, `${fc.id} hour branch`).toBe(fc.hourBranch);
      });
    }
  });

  describe('All 21 Cases: Pipeline Completeness', () => {
    for (const fc of allCases) {
      it(`${fc.name} pipeline completeness`, () => {
        const input = createBirthInput({
          birthYear: fc.year, birthMonth: fc.month, birthDay: fc.day,
          birthHour: fc.hour, birthMinute: fc.minute,
          gender: fc.gender, longitude: fc.longitude,
        });
        const analysis = analyzeSaju(input, config);

        expect(analysis.strengthResult).not.toBeNull();
        expect(analysis.yongshinResult).not.toBeNull();
        expect(analysis.gyeokgukResult).not.toBeNull();
        expect(analysis.shinsalHits.length).toBeGreaterThanOrEqual(3);
        expect(analysis.daeunInfo).not.toBeNull();
        expect(analysis.daeunInfo!.daeunPillars.length).toBeGreaterThanOrEqual(8);
        expect(analysis.saeunPillars.length).toBeGreaterThanOrEqual(5);

        const traceKeys = new Set(analysis.trace.map(t => t.key));
        for (const key of ['core', 'strength', 'yongshin', 'gyeokguk']) {
          expect(traceKeys.has(key), `trace missing key '${key}'`).toBe(true);
        }
      });
    }
  });

  it('total fixture coverage is 21 cases', () => {
    expect(forceTellerCases).toHaveLength(10);
    expect(manualCases).toHaveLength(11);
    expect(allCases).toHaveLength(21);
  });

  it('cases include both genders', () => {
    const genders = new Set(allCases.map(c => c.gender));
    expect(genders.has(Gender.MALE)).toBe(true);
    expect(genders.has(Gender.FEMALE)).toBe(true);
  });

  it('cases include diverse longitudes', () => {
    const longs = new Set(allCases.map(c => c.longitude));
    expect(longs.size).toBeGreaterThanOrEqual(3);
  });
});
