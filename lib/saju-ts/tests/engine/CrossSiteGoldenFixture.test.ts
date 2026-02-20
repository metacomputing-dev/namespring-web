import { describe, it, expect } from 'vitest';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { CHEONGAN_INFO } from '../../src/domain/Cheongan.js';
import { JIJI_INFO } from '../../src/domain/Jiji.js';
import { ANALYSIS_KEYS } from '../../src/domain/SajuAnalysis.js';
import type { Pillar } from '../../src/domain/Pillar.js';

/**
 * Cross-site golden fixture tests (v2 equivalent).
 * Ported from Kotlin CrossSiteGoldenFixtureTest.kt.
 *
 * Since the JSON fixture files are external, we embed the golden test data
 * directly in the test file. These are forceteller.com confirmed pillar results
 * and boundary profile cases from multiple external saju sites.
 */

const config = createConfig({
  includeEquationOfTime: false,
  applyDstHistory: true,
});

function legacyLabel(pillar: Pillar): string {
  const ci = CHEONGAN_INFO[pillar.cheongan];
  const ji = JIJI_INFO[pillar.jiji];
  return `${ci.hangul}${ci.hanja} / ${ji.hangul}${ji.hanja}`;
}

// =========================================================================
// Forceteller golden cases (pillar_golden type from v2 fixture)
// =========================================================================

interface ForcetellerCase {
  readonly caseId: string;
  readonly date: string;
  readonly time: string;
  readonly gender: Gender;
  readonly longitude: number;
  readonly expected: {
    readonly year: string;
    readonly month: string;
    readonly day: string;
    readonly hour: string;
  };
  readonly shinsalMinHits: number;
}

const forcetellerCases: ForcetellerCase[] = [
  {
    caseId: 'FT-01',
    date: '1986-04-19', time: '05:45',
    gender: Gender.MALE, longitude: 126.978,
    expected: {
      year: '병丙 / 인寅',
      month: '임壬 / 진辰',
      day: '계癸 / 사巳',
      hour: '을乙 / 묘卯',
    },
    shinsalMinHits: 3,
  },
  {
    caseId: 'FT-02',
    date: '1989-01-10', time: '01:30',
    gender: Gender.MALE, longitude: 126.978,
    expected: {
      year: '무戊 / 진辰',
      month: '을乙 / 축丑',
      day: '경庚 / 오午',
      hour: '병丙 / 자子',
    },
    shinsalMinHits: 3,
  },
  {
    caseId: 'FT-03',
    date: '1990-06-15', time: '12:00',
    gender: Gender.MALE, longitude: 126.978,
    expected: {
      year: '경庚 / 오午',
      month: '임壬 / 오午',
      day: '신辛 / 해亥',
      hour: '갑甲 / 오午',
    },
    shinsalMinHits: 3,
  },
  {
    caseId: 'FT-04',
    date: '2000-01-01', time: '00:00',
    gender: Gender.FEMALE, longitude: 126.978,
    expected: {
      year: '기己 / 묘卯',
      month: '병丙 / 자子',
      day: '무戊 / 오午',
      hour: '임壬 / 자子',
    },
    shinsalMinHits: 2,
  },
  {
    caseId: 'FT-05',
    date: '1988-07-15', time: '14:30',
    gender: Gender.MALE, longitude: 126.978,
    expected: {
      year: '무戊 / 진辰',
      month: '기己 / 미未',
      day: '신辛 / 미未',
      hour: '갑甲 / 오午',
    },
    shinsalMinHits: 3,
  },
];

// =========================================================================
// Boundary profile cases from multiple sites
// =========================================================================

interface BoundaryCase {
  readonly caseId: string;
  readonly date: string;
  readonly time: string;
  readonly gender: Gender;
  readonly longitude: number;
  readonly hourBranchOptions: string[];
  readonly yearPillarOptions: string[];
  readonly palaceRequired: boolean;
  readonly shinsalMinHits: number;
}

const boundaryCases: BoundaryCase[] = [
  {
    caseId: 'BP-01',
    date: '2024-02-04', time: '05:30',
    gender: Gender.FEMALE, longitude: 126.978,
    hourBranchOptions: ['IN'],
    yearPillarOptions: ['GYE_MYO'],
    palaceRequired: true,
    shinsalMinHits: 2,
  },
  {
    caseId: 'BP-02',
    date: '1995-08-20', time: '23:15',
    gender: Gender.MALE, longitude: 126.978,
    hourBranchOptions: ['JA', 'HAE'],
    yearPillarOptions: ['EUL_HAE'],
    palaceRequired: true,
    shinsalMinHits: 2,
  },
  {
    caseId: 'BP-03',
    date: '1988-07-15', time: '14:30',
    gender: Gender.MALE, longitude: 126.978,
    hourBranchOptions: ['O', 'MI'],
    yearPillarOptions: ['MU_JIN'],
    palaceRequired: true,
    shinsalMinHits: 2,
  },
  {
    caseId: 'BP-04',
    date: '2020-02-04', time: '17:00',
    gender: Gender.MALE, longitude: 126.978,
    hourBranchOptions: ['YU', 'SIN'],
    yearPillarOptions: ['GYEONG_JA', 'GI_HAE'],
    palaceRequired: true,
    shinsalMinHits: 1,
  },
  {
    caseId: 'BP-05',
    date: '1970-01-01', time: '00:00',
    gender: Gender.FEMALE, longitude: 126.978,
    hourBranchOptions: ['JA'],
    yearPillarOptions: ['GI_YU'],
    palaceRequired: true,
    shinsalMinHits: 1,
  },
];

describe('CrossSiteGoldenFixtureTest', () => {

  describe('forceteller golden cases match expected pillars', () => {
    for (const fc of forcetellerCases) {
      it(`${fc.caseId}: ${fc.date} ${fc.time}`, () => {
        const [y, m, d] = fc.date.split('-').map(Number) as [number, number, number];
        const [h, min] = fc.time.split(':').map(Number) as [number, number];
        const input = createBirthInput({
          birthYear: y, birthMonth: m, birthDay: d,
          birthHour: h, birthMinute: min,
          gender: fc.gender, longitude: fc.longitude,
        });
        const result = calculatePillars(input, config);
        expect(legacyLabel(result.pillars.year)).toBe(fc.expected.year);
        expect(legacyLabel(result.pillars.month)).toBe(fc.expected.month);
        expect(legacyLabel(result.pillars.day)).toBe(fc.expected.day);
        expect(legacyLabel(result.pillars.hour)).toBe(fc.expected.hour);
      });
    }
  });

  describe('forceteller golden cases meet analysis expectations', () => {
    for (const fc of forcetellerCases) {
      it(`${fc.caseId}: shinsal >= ${fc.shinsalMinHits}`, () => {
        const [y, m, d] = fc.date.split('-').map(Number) as [number, number, number];
        const [h, min] = fc.time.split(':').map(Number) as [number, number];
        const input = createBirthInput({
          birthYear: y, birthMonth: m, birthDay: d,
          birthHour: h, birthMinute: min,
          gender: fc.gender, longitude: fc.longitude,
        });
        const analysis = analyzeSaju(input, config);
        expect(analysis.palaceAnalysis).not.toBeNull();
        expect(analysis.shinsalHits.length).toBeGreaterThanOrEqual(fc.shinsalMinHits);
      });
    }
  });

  describe('boundary profiles constrain expected output range', () => {
    for (const bc of boundaryCases) {
      it(`${bc.caseId}: ${bc.date} ${bc.time}`, () => {
        const [y, m, d] = bc.date.split('-').map(Number) as [number, number, number];
        const [h, min] = bc.time.split(':').map(Number) as [number, number];
        const input = createBirthInput({
          birthYear: y, birthMonth: m, birthDay: d,
          birthHour: h, birthMinute: min,
          gender: bc.gender, longitude: bc.longitude,
        });
        const result = calculatePillars(input, config);
        const analysis = analyzeSaju(input, config);

        if (bc.hourBranchOptions.length > 0) {
          expect(bc.hourBranchOptions).toContain(result.pillars.hour.jiji);
        }

        if (bc.yearPillarOptions.length > 0) {
          const yearCode = `${result.pillars.year.cheongan}_${result.pillars.year.jiji}`;
          expect(bc.yearPillarOptions).toContain(yearCode);
        }

        if (bc.palaceRequired) {
          expect(analysis.palaceAnalysis).not.toBeNull();
          expect(analysis.analysisResults.has(ANALYSIS_KEYS.PALACE)).toBe(true);
        }
        expect(analysis.shinsalHits.length).toBeGreaterThanOrEqual(bc.shinsalMinHits);
      });
    }
  });

  it('at least 5 forceteller cases exist', () => {
    expect(forcetellerCases.length).toBeGreaterThanOrEqual(5);
  });

  it('at least 5 boundary cases exist', () => {
    expect(boundaryCases.length).toBeGreaterThanOrEqual(5);
  });
});
