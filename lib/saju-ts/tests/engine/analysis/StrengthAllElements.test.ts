import { describe, it, expect } from 'vitest';
import { Cheongan, CHEONGAN_INFO, CHEONGAN_VALUES } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { Sipseong } from '../../../src/domain/Sipseong.js';
import { StrengthLevel, type StrengthResult, isStrongSide } from '../../../src/domain/StrengthResult.js';
import { StrengthAnalyzer } from '../../../src/engine/analysis/StrengthAnalyzer.js';
import { createConfig } from '../../../src/config/CalculationConfig.js';
import { analyzeSaju } from '../../../src/engine/SajuAnalysisPipeline.js';
import { Gender } from '../../../src/domain/Gender.js';
import { type BirthInput, createBirthInput } from '../../../src/domain/types.js';

/**
 * Comprehensive strength analysis coverage for ALL five ohaeng day masters.
 *
 * Provides for each element (WOOD, FIRE, EARTH, METAL, WATER):
 *   - A known-STRONG chart with score breakdown verification
 *   - A known-WEAK chart with score breakdown verification
 * Special rule verification:
 *   - EARTH: hwato dongbeop (fire counts as inseong for earth day masters)
 *   - WATER: metal provides inseong support
 * Integration tests using analyzeSaju with default config
 * Score breakdown invariants (deukryeong + deukji + deukse = totalSupport)
 *
 * Ported from StrengthAllElementsTest.kt (A-03).
 */

// =====================================================================
// Helper: score breakdown invariant check
// =====================================================================

const STRONG_LEVELS: readonly StrengthLevel[] = [
  StrengthLevel.VERY_STRONG,
  StrengthLevel.STRONG,
  StrengthLevel.SLIGHTLY_STRONG,
];

const WEAK_LEVELS: readonly StrengthLevel[] = [
  StrengthLevel.SLIGHTLY_WEAK,
  StrengthLevel.WEAK,
  StrengthLevel.VERY_WEAK,
];

function assertScoreBreakdownConsistent(label: string, result: StrengthResult): void {
  const score = result.score;
  const computedTotal = score.deukryeong + score.deukji + score.deukse;
  expect(score.totalSupport).toBeCloseTo(computedTotal, 2,
    // Vitest toBeCloseTo uses numDigits not epsilon, 2 means within 0.005
  );
  expect(score.totalOppose).toBeGreaterThanOrEqual(0.0);
  expect(score.deukryeong).toBeGreaterThanOrEqual(0.0);
  expect(score.deukji).toBeGreaterThanOrEqual(0.0);
  expect(score.deukse).toBeGreaterThanOrEqual(0.0);
}

describe('StrengthAllElementsTest (A-03)', () => {
  // =====================================================================
  // 1. WOOD (GAP/EUL) Day Master
  // =====================================================================
  describe('WoodDayMaster', () => {
    it('GAP wood strong - IN month with wood and water support', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.HAE),
        new Pillar(Cheongan.GYE, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.IM, Jiji.JA),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.GAP);
      expect(result.score.deukryeong).toBe(40.0);
      expect(result.isStrong).toBe(true);
      expect(result.level).toBe(StrengthLevel.VERY_STRONG);
      expect(result.score.totalSupport).toBeGreaterThanOrEqual(62.4);
      assertScoreBreakdownConsistent('GAP strong', result);
    });

    it('EUL wood weak - YU month with metal and fire opposition', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYEONG, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.YU),
        new Pillar(Cheongan.EUL, Jiji.O),
        new Pillar(Cheongan.JEONG, Jiji.SUL),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.EUL);
      expect(result.score.deukryeong).toBe(0.0);
      expect(result.isStrong).toBe(false);
      expect(result.level).toBe(StrengthLevel.VERY_WEAK);
      expect(result.score.totalSupport).toBeLessThan(15.0);
      expect(result.score.deukse).toBe(0.0);
      assertScoreBreakdownConsistent('EUL weak', result);
    });
  });

  // =====================================================================
  // 2. FIRE (BYEONG/JEONG) Day Master
  // =====================================================================
  describe('FireDayMaster', () => {
    it('BYEONG fire strong - SA month with fire and wood support', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.JEONG, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.BYEONG);
      expect(result.score.deukryeong).toBe(40.0);
      expect(result.isStrong).toBe(true);
      expect(STRONG_LEVELS).toContain(result.level);
      expect(result.score.totalSupport).toBeGreaterThanOrEqual(50.0);
      assertScoreBreakdownConsistent('BYEONG strong', result);
    });

    it('JEONG fire weak - HAE month with water opposition', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.IM, Jiji.JA),
        new Pillar(Cheongan.GYEONG, Jiji.HAE),
        new Pillar(Cheongan.JEONG, Jiji.YU),
        new Pillar(Cheongan.SIN, Jiji.SIN),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.JEONG);
      expect(result.score.deukryeong).toBe(0.0);
      expect(result.isStrong).toBe(false);
      expect(result.score.totalSupport).toBeLessThan(15.0);
      expect(result.level).toBe(StrengthLevel.VERY_WEAK);
      expect(result.score.deukse).toBe(0.0);
      assertScoreBreakdownConsistent('JEONG weak', result);
    });
  });

  // =====================================================================
  // 3. EARTH (MU/GI) Day Master -- hwato dongbeop focus
  // =====================================================================
  describe('EarthDayMaster', () => {
    it('MU earth strong - MI month with earth and fire support (hwato dongbeop)', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.O),
        new Pillar(Cheongan.GI, Jiji.MI),
        new Pillar(Cheongan.MU, Jiji.SUL),
        new Pillar(Cheongan.JEONG, Jiji.SA),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.MU);
      expect(CHEONGAN_INFO[result.dayMaster].ohaeng).toBe(Ohaeng.EARTH);
      expect(result.score.deukryeong).toBe(40.0);
      expect(result.isStrong).toBe(true);
      expect(result.level).toBe(StrengthLevel.VERY_STRONG);
      expect(result.score.totalSupport).toBeGreaterThanOrEqual(62.4);
      assertScoreBreakdownConsistent('MU strong', result);
    });

    it('MU earth - fire stems contribute as inseong via hwato dongbeop', () => {
      // 3 fire stems x 5 (inseong) = 15 for earth day master
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.YU),
        new Pillar(Cheongan.JEONG, Jiji.IN),
        new Pillar(Cheongan.MU, Jiji.SIN),
        new Pillar(Cheongan.BYEONG, Jiji.YU),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.score.deukse).toBe(15.0);
      assertScoreBreakdownConsistent('MU hwato', result);
    });

    it('GI earth weak - MYO month with wood opposition', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GI, Jiji.JA),
        new Pillar(Cheongan.IM, Jiji.HAE),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.GI);
      expect(CHEONGAN_INFO[result.dayMaster].ohaeng).toBe(Ohaeng.EARTH);
      expect(result.score.deukryeong).toBe(0.0);
      expect(result.isStrong).toBe(false);
      expect(result.score.deukse).toBe(0.0);
      expect(result.score.totalSupport).toBeLessThan(15.0);
      expect(result.level).toBe(StrengthLevel.VERY_WEAK);
      assertScoreBreakdownConsistent('GI weak', result);
    });

    it('GI earth - fire hidden stems in branches also count as support', () => {
      // 오(O) = 병10일(편인) + 기9일(비견) + 정11일(정인)
      // All three support earth day master -> deukji per 오 = 5.0
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.YU),
        new Pillar(Cheongan.GI, Jiji.O),
        new Pillar(Cheongan.GAP, Jiji.O),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      // Three O branches: 5.0 each + YU: 0 = 15.0
      expect(result.score.deukji).toBeCloseTo(15.0, 1);
      assertScoreBreakdownConsistent('GI deukji fire-earth', result);
    });
  });

  // =====================================================================
  // 4. METAL (GYEONG/SIN) Day Master
  // =====================================================================
  describe('MetalDayMaster', () => {
    it('GYEONG metal strong - SIN month with metal and earth support', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.SIN, Jiji.SUL),
        new Pillar(Cheongan.MU, Jiji.SIN),
        new Pillar(Cheongan.GYEONG, Jiji.YU),
        new Pillar(Cheongan.GI, Jiji.CHUK),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.GYEONG);
      expect(CHEONGAN_INFO[result.dayMaster].ohaeng).toBe(Ohaeng.METAL);
      expect(result.score.deukryeong).toBe(40.0);
      expect(result.isStrong).toBe(true);
      expect(result.level).toBe(StrengthLevel.VERY_STRONG);
      expect(result.score.totalSupport).toBeGreaterThanOrEqual(62.4);
      assertScoreBreakdownConsistent('GYEONG strong', result);
    });

    it('SIN metal weak - MYO month with wood and fire opposition', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.SIN, Jiji.IN),
        new Pillar(Cheongan.JEONG, Jiji.O),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.SIN);
      expect(CHEONGAN_INFO[result.dayMaster].ohaeng).toBe(Ohaeng.METAL);
      expect(result.score.deukryeong).toBe(0.0);
      expect(result.isStrong).toBe(false);
      expect(result.score.deukse).toBe(0.0);
      expect(result.score.totalSupport).toBeLessThan(15.0);
      expect(result.level).toBe(StrengthLevel.VERY_WEAK);
      assertScoreBreakdownConsistent('SIN weak', result);
    });
  });

  // =====================================================================
  // 5. WATER (IM/GYE) Day Master -- Metal-Inseong focus
  // =====================================================================
  describe('WaterDayMaster', () => {
    it('IM water strong - JA month with water and metal support', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYE, Jiji.SIN),
        new Pillar(Cheongan.GYEONG, Jiji.JA),
        new Pillar(Cheongan.IM, Jiji.HAE),
        new Pillar(Cheongan.SIN, Jiji.YU),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.IM);
      expect(CHEONGAN_INFO[result.dayMaster].ohaeng).toBe(Ohaeng.WATER);
      expect(result.score.deukryeong).toBe(40.0);
      expect(result.isStrong).toBe(true);
      expect(result.level).toBe(StrengthLevel.VERY_STRONG);
      expect(result.score.totalSupport).toBeGreaterThanOrEqual(62.4);
      assertScoreBreakdownConsistent('IM strong', result);
    });

    it('IM water - metal stems provide inseong support', () => {
      // 3 metal stems x 5 (inseong) = 15 for water day master
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYEONG, Jiji.O),
        new Pillar(Cheongan.SIN, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.O),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.score.deukse).toBe(15.0);
      assertScoreBreakdownConsistent('IM metal-inseong', result);
    });

    it('GYE water weak - SA month with fire and earth opposition', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.O),
        new Pillar(Cheongan.MU, Jiji.SA),
        new Pillar(Cheongan.GYE, Jiji.MI),
        new Pillar(Cheongan.JEONG, Jiji.SUL),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.GYE);
      expect(CHEONGAN_INFO[result.dayMaster].ohaeng).toBe(Ohaeng.WATER);
      expect(result.score.deukryeong).toBe(0.0);
      expect(result.isStrong).toBe(false);
      expect(result.score.deukse).toBe(0.0);
      expect(result.score.totalSupport).toBeLessThan(15.0);
      expect(result.level).toBe(StrengthLevel.VERY_WEAK);
      assertScoreBreakdownConsistent('GYE weak', result);
    });

    it('GYE water - metal hidden stems in branches provide deukji support', () => {
      // YU = gyeong10 sin20 -> all metal -> full support for water DM
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.YU),
        new Pillar(Cheongan.BYEONG, Jiji.YU),
        new Pillar(Cheongan.GYE, Jiji.YU),
        new Pillar(Cheongan.BYEONG, Jiji.YU),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      // Four YU branches, each 5.0 -> 20.0
      expect(result.score.deukji).toBeCloseTo(20.0, 1);
      assertScoreBreakdownConsistent('GYE deukji metal', result);
    });
  });

  // =====================================================================
  // 6. Cross-Element Score Breakdown Invariants
  // =====================================================================
  describe('ScoreBreakdownInvariants', () => {
    it('score breakdown is consistent across all ten day masters', () => {
      for (const dm of CHEONGAN_VALUES) {
        const pillars = new PillarSet(
          new Pillar(Cheongan.GAP, Jiji.IN),
          new Pillar(Cheongan.BYEONG, Jiji.SA),
          new Pillar(dm, Jiji.SUL),
          new Pillar(Cheongan.IM, Jiji.HAE),
        );

        const result = StrengthAnalyzer.analyze(pillars);
        expect(result.dayMaster).toBe(dm);
        assertScoreBreakdownConsistent(`DM=${dm}`, result);

        // isStrong must be consistent with level
        if (result.isStrong) {
          expect(STRONG_LEVELS).toContain(result.level);
        } else {
          expect(WEAK_LEVELS).toContain(result.level);
        }
      }
    });

    it('deukryeong is either 0 or 40 in binary mode', () => {
      const branches: Jiji[] = [Jiji.JA, Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.YU, Jiji.HAE];
      for (const dm of CHEONGAN_VALUES) {
        for (const branch of branches) {
          const pillars = new PillarSet(
            new Pillar(Cheongan.MU, Jiji.JIN),
            new Pillar(Cheongan.GAP, branch),
            new Pillar(dm, Jiji.O),
            new Pillar(Cheongan.GYEONG, Jiji.SUL),
          );
          const result = StrengthAnalyzer.analyze(pillars);
          expect(
            result.score.deukryeong === 0.0 || result.score.deukryeong === 40.0,
          ).toBe(true);
        }
      }
    });

    it('deukse does not exceed theoretical maximum of 21', () => {
      for (const dm of CHEONGAN_VALUES) {
        const pillars = new PillarSet(
          new Pillar(dm, Jiji.JA),
          new Pillar(dm, Jiji.JA),
          new Pillar(dm, Jiji.JA),
          new Pillar(dm, Jiji.JA),
        );
        const result = StrengthAnalyzer.analyze(pillars);
        expect(result.score.deukse).toBeLessThanOrEqual(21.0);
      }
    });

    it('deukji does not exceed theoretical maximum of 20', () => {
      for (const dm of CHEONGAN_VALUES) {
        const pillars = new PillarSet(
          new Pillar(dm, Jiji.JA),
          new Pillar(dm, Jiji.IN),
          new Pillar(dm, Jiji.SA),
          new Pillar(dm, Jiji.SIN),
        );
        const result = StrengthAnalyzer.analyze(pillars);
        expect(result.score.deukji).toBeLessThanOrEqual(20.0);
      }
    });
  });

  // =====================================================================
  // 7. Integration Tests via analyzeSaju
  // =====================================================================
  describe('IntegrationWithFullAnalysis', () => {
    const config = createConfig();

    function makeInput(
      year: number, month: number, day: number,
      hour: number, minute: number,
      gender: Gender,
    ): BirthInput {
      return createBirthInput({
        birthYear: year, birthMonth: month, birthDay: day,
        birthHour: hour, birthMinute: minute,
        gender,
        timezone: 'Asia/Seoul',
        longitude: 126.978,
      });
    }

    it('wood day master integration - spring birth', () => {
      const input = makeInput(1990, 3, 15, 6, 0, Gender.MALE);
      const analysis = analyzeSaju(input, config);
      const strength = analysis.strengthResult;

      expect(strength).toBeDefined();
      assertScoreBreakdownConsistent('Wood integration', strength);
      expect(strength.details.length).toBeGreaterThan(0);
      expect(strength.details.some(d => d.includes('득령'))).toBe(true);
      expect(strength.details.some(d => d.includes('득지'))).toBe(true);
      expect(strength.details.some(d => d.includes('득세'))).toBe(true);
    });

    it('earth day master integration - summer birth', () => {
      const input = makeInput(1985, 7, 15, 9, 0, Gender.FEMALE);
      const analysis = analyzeSaju(input, config);
      const strength = analysis.strengthResult;

      expect(strength).toBeDefined();
      assertScoreBreakdownConsistent('Earth integration', strength);
      const validLevels = [...STRONG_LEVELS, ...WEAK_LEVELS];
      expect(validLevels).toContain(strength.level);
    });

    it('water day master integration - winter birth', () => {
      const input = makeInput(1992, 12, 20, 3, 0, Gender.MALE);
      const analysis = analyzeSaju(input, config);
      const strength = analysis.strengthResult;

      expect(strength).toBeDefined();
      assertScoreBreakdownConsistent('Water integration', strength);
    });

    it('metal day master integration - autumn birth', () => {
      const input = makeInput(1978, 9, 25, 14, 0, Gender.MALE);
      const analysis = analyzeSaju(input, config);
      const strength = analysis.strengthResult;

      expect(strength).toBeDefined();
      assertScoreBreakdownConsistent('Metal integration', strength);
    });

    it('fire day master integration - early summer birth', () => {
      const input = makeInput(2000, 6, 10, 11, 0, Gender.FEMALE);
      const analysis = analyzeSaju(input, config);
      const strength = analysis.strengthResult;

      expect(strength).toBeDefined();
      assertScoreBreakdownConsistent('Fire integration', strength);
    });

    it('diverse birth dates produce structurally valid analyses', () => {
      const dates: [number, number, number, number][] = [
        [1980, 1, 10, 8],
        [1986, 4, 22, 15],
        [1993, 7, 8, 22],
        [1975, 10, 30, 5],
        [2002, 12, 1, 12],
      ];

      const observedElements = new Set<Ohaeng>();

      for (const [idx, [y, m, d, h]] of dates.entries()) {
        const input = makeInput(y, m, d, h, 0,
          idx % 2 === 0 ? Gender.MALE : Gender.FEMALE);
        const analysis = analyzeSaju(input, config);
        const strength = analysis.strengthResult;
        expect(strength).toBeDefined();
        assertScoreBreakdownConsistent(`date=${y}-${m}-${d}`, strength);
        observedElements.add(CHEONGAN_INFO[strength.dayMaster].ohaeng);
      }

      expect(observedElements.size).toBeGreaterThan(0);
    });
  });

  // =====================================================================
  // 8. Strength Level Classification Edge Cases
  // =====================================================================
  describe('StrengthLevelClassification', () => {
    it('strong charts across all elements have isStrong true', () => {
      const strongCharts: Record<string, PillarSet> = {
        WOOD: new PillarSet(
          new Pillar(Cheongan.EUL, Jiji.HAE),
          new Pillar(Cheongan.GYE, Jiji.IN),
          new Pillar(Cheongan.GAP, Jiji.MYO),
          new Pillar(Cheongan.IM, Jiji.JA),
        ),
        FIRE: new PillarSet(
          new Pillar(Cheongan.GAP, Jiji.IN),
          new Pillar(Cheongan.JEONG, Jiji.SA),
          new Pillar(Cheongan.BYEONG, Jiji.O),
          new Pillar(Cheongan.EUL, Jiji.MYO),
        ),
        EARTH: new PillarSet(
          new Pillar(Cheongan.BYEONG, Jiji.O),
          new Pillar(Cheongan.GI, Jiji.MI),
          new Pillar(Cheongan.MU, Jiji.SUL),
          new Pillar(Cheongan.JEONG, Jiji.SA),
        ),
        METAL: new PillarSet(
          new Pillar(Cheongan.SIN, Jiji.SUL),
          new Pillar(Cheongan.MU, Jiji.SIN),
          new Pillar(Cheongan.GYEONG, Jiji.YU),
          new Pillar(Cheongan.GI, Jiji.CHUK),
        ),
        WATER: new PillarSet(
          new Pillar(Cheongan.GYE, Jiji.SIN),
          new Pillar(Cheongan.GYEONG, Jiji.JA),
          new Pillar(Cheongan.IM, Jiji.HAE),
          new Pillar(Cheongan.SIN, Jiji.YU),
        ),
      };

      for (const [element, pillars] of Object.entries(strongCharts)) {
        const result = StrengthAnalyzer.analyze(pillars);
        expect(result.isStrong).toBe(true);
        expect(STRONG_LEVELS).toContain(result.level);
      }
    });

    it('weak charts across all elements have isStrong false', () => {
      const weakCharts: Record<string, PillarSet> = {
        WOOD: new PillarSet(
          new Pillar(Cheongan.GYEONG, Jiji.SA),
          new Pillar(Cheongan.BYEONG, Jiji.YU),
          new Pillar(Cheongan.EUL, Jiji.O),
          new Pillar(Cheongan.JEONG, Jiji.SUL),
        ),
        FIRE: new PillarSet(
          new Pillar(Cheongan.IM, Jiji.JA),
          new Pillar(Cheongan.GYEONG, Jiji.HAE),
          new Pillar(Cheongan.JEONG, Jiji.YU),
          new Pillar(Cheongan.SIN, Jiji.SIN),
        ),
        EARTH: new PillarSet(
          new Pillar(Cheongan.GAP, Jiji.IN),
          new Pillar(Cheongan.EUL, Jiji.MYO),
          new Pillar(Cheongan.GI, Jiji.JA),
          new Pillar(Cheongan.IM, Jiji.HAE),
        ),
        METAL: new PillarSet(
          new Pillar(Cheongan.BYEONG, Jiji.SA),
          new Pillar(Cheongan.GAP, Jiji.MYO),
          new Pillar(Cheongan.SIN, Jiji.IN),
          new Pillar(Cheongan.JEONG, Jiji.O),
        ),
        WATER: new PillarSet(
          new Pillar(Cheongan.BYEONG, Jiji.O),
          new Pillar(Cheongan.MU, Jiji.SA),
          new Pillar(Cheongan.GYE, Jiji.MI),
          new Pillar(Cheongan.JEONG, Jiji.SUL),
        ),
      };

      for (const [element, pillars] of Object.entries(weakCharts)) {
        const result = StrengthAnalyzer.analyze(pillars);
        expect(result.isStrong).toBe(false);
        expect(WEAK_LEVELS).toContain(result.level);
      }
    });
  });

  // =====================================================================
  // 9. Ohaeng Relationship Correctness Per Element
  // =====================================================================
  describe('OhaengRelationshipCorrectness', () => {
    it('earth DM - fire is inseong, wood is gwanseong', () => {
      const dm = Cheongan.MU; // EARTH YANG

      // Fire stems -> inseong
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.BYEONG)).toBe(Sipseong.PYEON_IN);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.JEONG)).toBe(Sipseong.JEONG_IN);

      // Wood stems -> gwanseong (controls earth)
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.GAP)).toBe(Sipseong.PYEON_GWAN);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.EUL)).toBe(Sipseong.JEONG_GWAN);

      // Fire is supporting for earth DM
      expect(StrengthAnalyzer.isSupportingSipseong(
        StrengthAnalyzer.determineSipseong(dm, Cheongan.BYEONG),
      )).toBe(true);
    });

    it('water DM - metal is inseong, earth is gwanseong', () => {
      const dm = Cheongan.IM; // WATER YANG

      // Metal stems -> inseong
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.GYEONG)).toBe(Sipseong.PYEON_IN);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.SIN)).toBe(Sipseong.JEONG_IN);

      // Earth stems -> gwanseong (controls water)
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.MU)).toBe(Sipseong.PYEON_GWAN);

      // Metal is supporting for water DM
      expect(StrengthAnalyzer.isSupportingSipseong(
        StrengthAnalyzer.determineSipseong(dm, Cheongan.GYEONG),
      )).toBe(true);
      expect(StrengthAnalyzer.isSupportingSipseong(
        StrengthAnalyzer.determineSipseong(dm, Cheongan.SIN),
      )).toBe(true);
    });

    it('all ten DMs - bigyeop and inseong are always supporting', () => {
      for (const dm of CHEONGAN_VALUES) {
        for (const target of CHEONGAN_VALUES) {
          const sipseong = StrengthAnalyzer.determineSipseong(dm, target);
          const isSupporting = StrengthAnalyzer.isSupportingSipseong(sipseong);
          const isBigyeop = sipseong === Sipseong.BI_GYEON || sipseong === Sipseong.GYEOB_JAE;
          const isInseong = sipseong === Sipseong.PYEON_IN || sipseong === Sipseong.JEONG_IN;

          if (isBigyeop || isInseong) {
            expect(isSupporting).toBe(true);
          } else {
            expect(isSupporting).toBe(false);
          }
        }
      }
    });
  });
});
