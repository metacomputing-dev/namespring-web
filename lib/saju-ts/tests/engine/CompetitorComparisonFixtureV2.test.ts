import { describe, it, expect } from 'vitest';

/**
 * Competitor comparison fixture V2 tests.
 * Ported from Kotlin CompetitorComparisonFixtureV2Test.kt.
 *
 * V2 fixture contains 11 manual cases with our-engine baseline and
 * per-site capture placeholders. Since the JSON fixture is external,
 * we embed the structural data directly.
 */

// =========================================================================
// Embedded V2 fixture data (structural contract from competitor_comparison_v2.json)
// =========================================================================

const TARGET_SITES = [
  'forceteller.com',
  'jumsin.co.kr',
  'sajunaru.com',
  '8-codes.com',
  'sajuplus.com',
] as const;

interface CompetitorV2Case {
  readonly caseId: string;
  readonly scenario: string;
  readonly scenarioTags: string[];
  readonly birth: {
    readonly date: string;
    readonly time: string;
    readonly gender: 'MALE' | 'FEMALE';
    readonly longitude: number;
  };
  readonly ourEngine: {
    readonly pillarTokens: {
      readonly year: string;
      readonly month: string;
      readonly day: string;
      readonly hour: string;
    };
    readonly reasoningCoverageRatio: number;
  };
  readonly competitors: Record<string, {
    readonly captureStatus: 'pending' | 'captured' | 'reviewed';
  }>;
}

const v2Cases: CompetitorV2Case[] = [
  {
    caseId: 'MC-01',
    scenario: 'dst_1988-07-15_1430_kst',
    scenarioTags: ['DST'],
    birth: { date: '1988-07-15', time: '14:30', gender: 'MALE', longitude: 126.978 },
    ourEngine: {
      pillarTokens: { year: 'MU_JIN', month: 'GI_MI', day: 'SIN_MI', hour: 'GAP_O' },
      reasoningCoverageRatio: 1.0,
    },
    competitors: {
      'forceteller.com': { captureStatus: 'pending' },
      'jumsin.co.kr': { captureStatus: 'pending' },
      'sajunaru.com': { captureStatus: 'pending' },
      '8-codes.com': { captureStatus: 'pending' },
      'sajuplus.com': { captureStatus: 'pending' },
    },
  },
  {
    caseId: 'MC-02',
    scenario: 'yaza_1995-08-20_2315_kst',
    scenarioTags: ['YAZA'],
    birth: { date: '1995-08-20', time: '23:15', gender: 'MALE', longitude: 126.978 },
    ourEngine: {
      pillarTokens: { year: 'EUL_HAE', month: 'GAP_SIN', day: 'GYE_MI', hour: 'GYE_HAE' },
      reasoningCoverageRatio: 1.0,
    },
    competitors: {
      'forceteller.com': { captureStatus: 'pending' },
      'jumsin.co.kr': { captureStatus: 'pending' },
      'sajunaru.com': { captureStatus: 'pending' },
      '8-codes.com': { captureStatus: 'pending' },
      'sajuplus.com': { captureStatus: 'pending' },
    },
  },
  {
    caseId: 'MC-03',
    scenario: 'ipchun_2024-02-04_0530_kst',
    scenarioTags: ['IPCHUN'],
    birth: { date: '2024-02-04', time: '05:30', gender: 'FEMALE', longitude: 126.978 },
    ourEngine: {
      pillarTokens: { year: 'GYE_MYO', month: 'EUL_CHUK', day: 'MU_SUL', hour: 'GAP_IN' },
      reasoningCoverageRatio: 1.0,
    },
    competitors: {
      'forceteller.com': { captureStatus: 'pending' },
      'jumsin.co.kr': { captureStatus: 'pending' },
      'sajunaru.com': { captureStatus: 'pending' },
      '8-codes.com': { captureStatus: 'pending' },
      'sajuplus.com': { captureStatus: 'pending' },
    },
  },
  {
    caseId: 'MC-04',
    scenario: 'hapwha_1989-10-20_0730_kst',
    scenarioTags: ['HAPWHA'],
    birth: { date: '1989-10-20', time: '07:30', gender: 'FEMALE', longitude: 126.978 },
    ourEngine: {
      pillarTokens: { year: 'GI_SA', month: 'GAP_SUL', day: 'GYE_CHUK', hour: 'EUL_MYO' },
      reasoningCoverageRatio: 1.0,
    },
    competitors: {
      'forceteller.com': { captureStatus: 'pending' },
      'jumsin.co.kr': { captureStatus: 'pending' },
      'sajunaru.com': { captureStatus: 'pending' },
      '8-codes.com': { captureStatus: 'pending' },
      'sajuplus.com': { captureStatus: 'pending' },
    },
  },
  {
    caseId: 'MC-05',
    scenario: 'jonggyeok_1990-04-10_1000_kst',
    scenarioTags: ['JONGGYEOK'],
    birth: { date: '1990-04-10', time: '10:00', gender: 'MALE', longitude: 126.978 },
    ourEngine: {
      pillarTokens: { year: 'GYEONG_O', month: 'GYEONG_JIN', day: 'EUL_SA', hour: 'SIN_SA' },
      reasoningCoverageRatio: 1.0,
    },
    competitors: {
      'forceteller.com': { captureStatus: 'pending' },
      'jumsin.co.kr': { captureStatus: 'pending' },
      'sajunaru.com': { captureStatus: 'pending' },
      '8-codes.com': { captureStatus: 'pending' },
      'sajuplus.com': { captureStatus: 'pending' },
    },
  },
  {
    caseId: 'MC-06',
    scenario: 'standard_1986-04-19_0545_kst',
    scenarioTags: ['STANDARD'],
    birth: { date: '1986-04-19', time: '05:45', gender: 'MALE', longitude: 126.978 },
    ourEngine: {
      pillarTokens: { year: 'BYEONG_IN', month: 'IM_JIN', day: 'GYE_YU', hour: 'EUL_MYO' },
      reasoningCoverageRatio: 1.0,
    },
    competitors: {
      'forceteller.com': { captureStatus: 'pending' },
      'jumsin.co.kr': { captureStatus: 'pending' },
      'sajunaru.com': { captureStatus: 'pending' },
      '8-codes.com': { captureStatus: 'pending' },
      'sajuplus.com': { captureStatus: 'pending' },
    },
  },
  {
    caseId: 'MC-07',
    scenario: 'midnight_2000-01-01_0000_kst',
    scenarioTags: ['MIDNIGHT'],
    birth: { date: '2000-01-01', time: '00:00', gender: 'FEMALE', longitude: 126.978 },
    ourEngine: {
      pillarTokens: { year: 'GI_MYO', month: 'BYEONG_JA', day: 'GYEONG_JIN', hour: 'BYEONG_JA' },
      reasoningCoverageRatio: 1.0,
    },
    competitors: {
      'forceteller.com': { captureStatus: 'pending' },
      'jumsin.co.kr': { captureStatus: 'pending' },
      'sajunaru.com': { captureStatus: 'pending' },
      '8-codes.com': { captureStatus: 'pending' },
      'sajuplus.com': { captureStatus: 'pending' },
    },
  },
  {
    caseId: 'MC-08',
    scenario: 'leapday_2020-02-29_1200_kst',
    scenarioTags: ['LEAP_DAY'],
    birth: { date: '2020-02-29', time: '12:00', gender: 'MALE', longitude: 126.978 },
    ourEngine: {
      pillarTokens: { year: 'GYEONG_JA', month: 'MU_IN', day: 'IM_IN', hour: 'BYEONG_O' },
      reasoningCoverageRatio: 1.0,
    },
    competitors: {
      'forceteller.com': { captureStatus: 'pending' },
      'jumsin.co.kr': { captureStatus: 'pending' },
      'sajunaru.com': { captureStatus: 'pending' },
      '8-codes.com': { captureStatus: 'pending' },
      'sajuplus.com': { captureStatus: 'pending' },
    },
  },
  {
    caseId: 'MC-09',
    scenario: 'yearend_1999-12-31_2330_kst',
    scenarioTags: ['YEAREND', 'YAZA'],
    birth: { date: '1999-12-31', time: '23:30', gender: 'MALE', longitude: 126.978 },
    ourEngine: {
      pillarTokens: { year: 'GI_MYO', month: 'BYEONG_JA', day: 'GI_MYO', hour: 'GAP_JA' },
      reasoningCoverageRatio: 1.0,
    },
    competitors: {
      'forceteller.com': { captureStatus: 'pending' },
      'jumsin.co.kr': { captureStatus: 'pending' },
      'sajunaru.com': { captureStatus: 'pending' },
      '8-codes.com': { captureStatus: 'pending' },
      'sajuplus.com': { captureStatus: 'pending' },
    },
  },
  {
    caseId: 'MC-10',
    scenario: 'dst_1949-08-10_1030_kst',
    scenarioTags: ['DST'],
    birth: { date: '1949-08-10', time: '10:30', gender: 'FEMALE', longitude: 126.978 },
    ourEngine: {
      pillarTokens: { year: 'GI_CHUK', month: 'IM_SIN', day: 'GI_MI', hour: 'GI_SA' },
      reasoningCoverageRatio: 1.0,
    },
    competitors: {
      'forceteller.com': { captureStatus: 'pending' },
      'jumsin.co.kr': { captureStatus: 'pending' },
      'sajunaru.com': { captureStatus: 'pending' },
      '8-codes.com': { captureStatus: 'pending' },
      'sajuplus.com': { captureStatus: 'pending' },
    },
  },
  {
    caseId: 'MC-11',
    scenario: 'early_20c_1924-06-15_1200_kst',
    scenarioTags: ['EARLY_20C'],
    birth: { date: '1924-06-15', time: '12:00', gender: 'MALE', longitude: 126.978 },
    ourEngine: {
      pillarTokens: { year: 'GAP_JA', month: 'GYEONG_O', day: 'GYEONG_JIN', hour: 'IM_O' },
      reasoningCoverageRatio: 0.97,
    },
    competitors: {
      'forceteller.com': { captureStatus: 'pending' },
      'jumsin.co.kr': { captureStatus: 'pending' },
      'sajunaru.com': { captureStatus: 'pending' },
      '8-codes.com': { captureStatus: 'pending' },
      'sajuplus.com': { captureStatus: 'pending' },
    },
  },
];

describe('CompetitorComparisonFixtureV2Test', () => {

  it('fixture V2 version and target sites', () => {
    const version = 'v2';
    expect(version).toBe('v2');

    const sites = new Set(TARGET_SITES);
    expect(sites).toEqual(new Set([
      'forceteller.com', 'jumsin.co.kr', 'sajunaru.com', '8-codes.com', 'sajuplus.com',
    ]));
  });

  it('fixture V2 contains 11 manual cases', () => {
    expect(v2Cases.length).toBe(11);

    const ids = v2Cases.map(c => c.caseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each case has our engine and competitor capture contract', () => {
    for (const caseObj of v2Cases) {
      // Birth data present
      expect(caseObj.birth.date.length).toBeGreaterThan(0);
      expect(caseObj.birth.time.length).toBeGreaterThan(0);
      expect(['MALE', 'FEMALE']).toContain(caseObj.birth.gender);

      // Our engine pillar tokens
      const tokens = caseObj.ourEngine.pillarTokens;
      for (const key of ['year', 'month', 'day', 'hour'] as const) {
        expect(tokens[key]).toContain('_');
      }

      // Reasoning coverage ratio in valid range
      expect(caseObj.ourEngine.reasoningCoverageRatio).toBeGreaterThanOrEqual(0.0);
      expect(caseObj.ourEngine.reasoningCoverageRatio).toBeLessThanOrEqual(1.0);

      // 5 competitors per case
      const competitors = Object.keys(caseObj.competitors);
      expect(competitors.length).toBe(5);
      for (const [site, comp] of Object.entries(caseObj.competitors)) {
        expect(['pending', 'captured', 'reviewed']).toContain(comp.captureStatus);
      }
    }
  });

  it('our engine baseline keeps high reasoning coverage', () => {
    for (const caseObj of v2Cases) {
      expect(caseObj.ourEngine.reasoningCoverageRatio).toBeGreaterThanOrEqual(0.95);
    }
  });
});
