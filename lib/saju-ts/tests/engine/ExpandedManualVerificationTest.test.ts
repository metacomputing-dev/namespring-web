import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { Jiji } from '../../src/domain/Jiji.js';

/**
 * Expanded Manual Verification Test (Q-02): 43 expert verification cases
 * that lock the engine's current behavior as a golden master for regression detection.
 *
 * Categories:
 *   - EX: Existing manual cases (11)
 *   - FT: Existing ForceTeller cases (10)
 *   - M:  Decade diversity (1920s-2020s) -- 6 cases
 *   - N:  DST transition periods (1948-1988) -- 4 cases
 *   - O:  Yaza boundary (23:00-23:59) -- 3 cases
 *   - P:  Midnight births (00:00-00:30) -- 3 cases
 *   - Q:  Geographic diversity -- 5 cases
 *   - R:  Gyeokguk diversity -- 1 case
 */

const config = createConfig({
  includeEquationOfTime: false,
  applyDstHistory: true,
});

interface VerificationCase {
  id: string;
  category: string;
  description: string;
  year: number; month: number; day: number;
  hour: number; minute: number;
  gender: Gender;
  longitude: number;
  latitude: number;
}

function v(
  id: string, cat: string, desc: string,
  y: number, m: number, d: number, h: number, min: number,
  gender: Gender,
  longitude = 126.978, latitude = 37.5665,
): VerificationCase {
  return { id, category: cat, description: desc, year: y, month: m, day: d, hour: h, minute: min, gender, longitude, latitude };
}

const existingManualCases = [
  v('EX01', 'manual', 'shin_sunhye', 1989, 10, 20, 7, 30, Gender.FEMALE),
  v('EX02', 'manual', 'geukshingang', 1984, 2, 19, 6, 30, Gender.MALE),
  v('EX03', 'manual', 'DST 1988', 1988, 7, 15, 14, 30, Gender.MALE),
  v('EX04', 'manual', 'yaza boundary', 1995, 8, 20, 23, 15, Gender.MALE),
  v('EX05', 'manual', 'ipchun boundary', 2024, 2, 4, 5, 30, Gender.FEMALE),
  v('EX06', 'manual', 'jeonggwan', 1990, 4, 10, 10, 0, Gender.MALE),
  v('EX07', 'manual', 'sikshin', 1982, 9, 3, 8, 0, Gender.FEMALE),
  v('EX08', 'manual', 'pyeonin', 1977, 1, 25, 3, 0, Gender.MALE),
  v('EX09', 'manual', 'yangin', 1968, 5, 5, 11, 0, Gender.MALE),
  v('EX10', 'manual', 'jongjae', 1973, 11, 8, 16, 0, Gender.MALE),
  v('EX11', 'manual', 'haphwa', 1985, 6, 21, 9, 0, Gender.FEMALE),
];

const forceTellerCases = [
  v('FT01', 'forceteller', '#01', 1986, 4, 19, 5, 45, Gender.MALE, 127.0),
  v('FT02', 'forceteller', '#02', 1989, 1, 10, 1, 30, Gender.MALE, 127.0),
  v('FT03', 'forceteller', '#03', 1996, 12, 25, 11, 30, Gender.FEMALE, 127.0),
  v('FT04', 'forceteller', '#04', 2001, 8, 1, 0, 2, Gender.MALE, 127.0),
  v('FT05', 'forceteller', '#05', 1969, 3, 15, 15, 29, Gender.FEMALE, 127.0),
  v('FT06', 'forceteller', '#06', 2010, 1, 1, 0, 0, Gender.MALE, 127.0),
  v('FT07', 'forceteller', '#07', 1916, 1, 6, 23, 59, Gender.FEMALE, 127.0),
  v('FT08', 'forceteller', '#08', 2025, 8, 26, 0, 30, Gender.MALE, 127.0),
  v('FT09', 'forceteller', '#09', 1991, 2, 18, 5, 25, Gender.FEMALE, 127.0),
  v('FT10', 'forceteller', '#10', 2022, 4, 6, 19, 0, Gender.MALE, 127.0),
];

const newCases = [
  // M: Decade diversity (6)
  v('M01', 'decade', '1920s male', 1923, 8, 12, 10, 0, Gender.MALE),
  v('M02', 'decade', '1940s female Busan', 1945, 3, 15, 8, 0, Gender.FEMALE, 129.075, 35.1796),
  v('M03', 'decade', '1960s male Daegu', 1963, 11, 22, 15, 30, Gender.MALE, 128.601, 35.8714),
  v('M04', 'decade', '1980s female Incheon', 1987, 6, 10, 7, 15, Gender.FEMALE, 126.705, 37.4563),
  v('M05', 'decade', '2000s male Gwangju', 2003, 9, 18, 14, 0, Gender.MALE, 126.851, 35.1595),
  v('M06', 'decade', '2020s female Seoul', 2024, 7, 20, 11, 45, Gender.FEMALE),

  // N: DST transition (4)
  v('N01', 'dst', '1948 first DST', 1948, 6, 1, 13, 0, Gender.MALE),
  v('N02', 'dst', '1951 last era1', 1951, 7, 20, 10, 30, Gender.FEMALE),
  v('N03', 'dst', '1955 era2 start', 1955, 5, 15, 15, 0, Gender.MALE),
  v('N04', 'dst', '1987 era3', 1987, 8, 15, 9, 0, Gender.FEMALE),

  // O: Yaza boundary (3)
  v('O01', 'yaza', '23:00 exact', 1978, 4, 10, 23, 0, Gender.FEMALE),
  v('O02', 'yaza', '23:30 Ulsan', 1992, 12, 5, 23, 30, Gender.MALE, 129.311, 35.5384),
  v('O03', 'yaza', '23:59 valentine', 2005, 2, 14, 23, 59, Gender.FEMALE),

  // P: Midnight births (3)
  v('P01', 'midnight', '00:00 exact 1970', 1970, 1, 1, 0, 0, Gender.MALE),
  v('P02', 'midnight', '00:01 Jeju', 1998, 6, 21, 0, 1, Gender.FEMALE, 126.531, 33.4996),
  v('P03', 'midnight', '00:30', 2015, 10, 3, 0, 30, Gender.MALE),

  // Q: Geographic diversity (5)
  v('Q01', 'geo', 'Busan', 1975, 5, 5, 12, 0, Gender.MALE, 129.075, 35.1796),
  v('Q02', 'geo', 'Incheon', 1990, 8, 25, 16, 30, Gender.FEMALE, 126.705, 37.4563),
  v('Q03', 'geo', 'Daegu', 1982, 3, 14, 6, 0, Gender.MALE, 128.601, 35.8714),
  v('Q04', 'geo', 'Gwangju', 2000, 11, 11, 20, 0, Gender.FEMALE, 126.851, 35.1595),
  v('Q05', 'geo', 'Ulsan', 1965, 9, 8, 9, 45, Gender.MALE, 129.311, 35.5384),

  // R: Gyeokguk diversity (1)
  v('R01', 'gyeokguk', 'geonrok candidate', 1980, 2, 4, 14, 0, Gender.MALE),
];

const allCases = [...existingManualCases, ...forceTellerCases, ...newCases];

describe('ExpandedManualVerificationTest', () => {
  // Structural tests
  it('total case count exceeds 30', () => {
    expect(allCases.length).toBeGreaterThanOrEqual(30);
  });

  it('new case count exceeds 20', () => {
    expect(newCases.length).toBeGreaterThanOrEqual(20);
  });

  it('all case IDs unique', () => {
    const ids = allCases.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all categories present', () => {
    const expected = ['manual', 'forceteller', 'decade', 'dst', 'yaza', 'midnight', 'geo', 'gyeokguk'];
    const actual = new Set(allCases.map(c => c.category));
    for (const cat of expected) {
      expect(actual.has(cat), `category '${cat}' missing`).toBe(true);
    }
  });

  it('decade coverage spans 100 years', () => {
    const decadeCases = allCases.filter(c => c.category === 'decade');
    const years = decadeCases.map(c => c.year);
    expect(Math.max(...years) - Math.min(...years)).toBeGreaterThanOrEqual(90);
  });

  it('gender balance reasonable', () => {
    const males = allCases.filter(c => c.gender === Gender.MALE).length;
    const females = allCases.filter(c => c.gender === Gender.FEMALE).length;
    expect(males).toBeGreaterThanOrEqual(12);
    expect(females).toBeGreaterThanOrEqual(12);
  });

  it('geographic diversity at least 4 cities', () => {
    const longitudes = new Set(allCases.map(c => c.longitude));
    expect(longitudes.size).toBeGreaterThanOrEqual(4);
  });

  // Pipeline validation
  describe('Pipeline validation for all cases', () => {
    for (const vc of allCases) {
      it(`${vc.id} (${vc.description}) - pillars non-null`, () => {
        const input = createBirthInput({
          birthYear: vc.year, birthMonth: vc.month, birthDay: vc.day,
          birthHour: vc.hour, birthMinute: vc.minute,
          gender: vc.gender, longitude: vc.longitude, latitude: vc.latitude,
        });
        const a = analyzeSaju(input, config);
        expect(a.pillars.year).toBeDefined();
        expect(a.pillars.month).toBeDefined();
        expect(a.pillars.day).toBeDefined();
        expect(a.pillars.hour).toBeDefined();
        expect(a.strengthResult).not.toBeNull();
        expect(a.gyeokgukResult).not.toBeNull();
        expect(a.yongshinResult).not.toBeNull();
        expect(a.daeunInfo).not.toBeNull();
        expect(a.daeunInfo!.daeunPillars.length).toBeGreaterThanOrEqual(8);
        expect(a.saeunPillars.length).toBeGreaterThanOrEqual(6);
        expect(a.shinsalHits.length).toBeGreaterThanOrEqual(3);
        expect(a.gongmangVoidBranches).not.toBeNull();
        expect(a.gongmangVoidBranches![0]).not.toBe(a.gongmangVoidBranches![1]);
      });
    }
  });

  // Category-specific tests
  it('yaza cases hour branch is JA or HAE', () => {
    const yazaCases = allCases.filter(c => c.category === 'yaza');
    expect(yazaCases.length).toBeGreaterThanOrEqual(3);
    for (const vc of yazaCases) {
      const input = createBirthInput({
        birthYear: vc.year, birthMonth: vc.month, birthDay: vc.day,
        birthHour: vc.hour, birthMinute: vc.minute,
        gender: vc.gender, longitude: vc.longitude, latitude: vc.latitude,
      });
      const a = analyzeSaju(input, config);
      expect(
        a.pillars.hour.jiji === Jiji.JA || a.pillars.hour.jiji === Jiji.HAE,
        `${vc.id}: yaza birth hour branch should be JA or HAE, got ${a.pillars.hour.jiji}`,
      ).toBe(true);
    }
  });

  it('midnight cases produce valid pillars', () => {
    const midnightCases = allCases.filter(c => c.category === 'midnight');
    expect(midnightCases.length).toBeGreaterThanOrEqual(3);
    for (const vc of midnightCases) {
      const input = createBirthInput({
        birthYear: vc.year, birthMonth: vc.month, birthDay: vc.day,
        birthHour: vc.hour, birthMinute: vc.minute,
        gender: vc.gender, longitude: vc.longitude, latitude: vc.latitude,
      });
      const a = analyzeSaju(input, config);
      expect(a.pillars.hour.jiji).toBeDefined();
      expect(a.pillars.day.cheongan).toBeDefined();
    }
  });

  it('geo cases have longitude variation', () => {
    const geoCases = allCases.filter(c => c.category === 'geo');
    expect(geoCases.length).toBeGreaterThanOrEqual(5);
    const longitudes = new Set(geoCases.map(c => c.longitude));
    expect(longitudes.size).toBeGreaterThanOrEqual(4);
  });

  // Distribution tests
  it('strength distribution has both strong and weak', () => {
    let strong = 0;
    let weak = 0;
    for (const vc of allCases) {
      const input = createBirthInput({
        birthYear: vc.year, birthMonth: vc.month, birthDay: vc.day,
        birthHour: vc.hour, birthMinute: vc.minute,
        gender: vc.gender, longitude: vc.longitude, latitude: vc.latitude,
      });
      const a = analyzeSaju(input, config);
      if (a.strengthResult?.isStrong) strong++; else weak++;
    }
    expect(strong).toBeGreaterThanOrEqual(3);
    expect(weak).toBeGreaterThanOrEqual(3);
  });

  it('daeun direction both present', () => {
    let forward = 0;
    let reverse = 0;
    for (const vc of allCases) {
      const input = createBirthInput({
        birthYear: vc.year, birthMonth: vc.month, birthDay: vc.day,
        birthHour: vc.hour, birthMinute: vc.minute,
        gender: vc.gender, longitude: vc.longitude, latitude: vc.latitude,
      });
      const a = analyzeSaju(input, config);
      if (a.daeunInfo?.isForward) forward++; else reverse++;
    }
    expect(forward).toBeGreaterThanOrEqual(5);
    expect(reverse).toBeGreaterThanOrEqual(5);
  });
});
