import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import { Sipseong } from '../../../src/domain/Sipseong.js';
import { StrengthLevel } from '../../../src/domain/StrengthResult.js';
import { HapState, type HapHwaEvaluation } from '../../../src/domain/Relations.js';
import { DEFAULT_CONFIG, createConfig } from '../../../src/config/CalculationConfig.js';
import { StrengthAnalyzer } from '../../../src/engine/analysis/StrengthAnalyzer.js';

/**
 * Tests for StrengthAnalyzer -- the 신강/신약 판단기.
 *
 * Each test constructs a specific four-pillar chart and verifies
 * that the scoring dimensions and overall strength classification
 * behave correctly according to Korean mainstream saju theory.
 *
 * Ported from StrengthAnalyzerTest.kt.
 */

// =========================================================================
// 1. 득령 (得令) tests -- monthly season support
// =========================================================================
describe('StrengthAnalyzer', () => {
  describe('deukryeong (득령)', () => {
    it('GAP wood day master in IN month is deukryeong - wood prosperous season', () => {
      // 갑목(甲木) 일간 + 인월(寅月, 목왕절)
      // 인(寅) 정기 = 갑(甲) -> 비견 -> 득령
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.GAP);
      expect(result.score.deukryeong).toBe(40.0);
      expect(result.details.some(d => d.includes('득령'))).toBe(true);
    });

    it('GAP wood day master in SIN month is silryeong - metal prosperous season', () => {
      // 갑목(甲木) 일간 + 신월(申月, 금왕절)
      // 신(申) 정기 = 경(庚, METAL) -> 편관 -> 실령
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
        new Pillar(Cheongan.GAP, Jiji.SUL),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.score.deukryeong).toBe(0.0);
      expect(result.details.some(d => d.includes('실령'))).toBe(true);
    });

    it('GAP wood day master in HAE month is deukryeong via inseong - water generates wood', () => {
      // 갑목(甲木) 일간 + 해월(亥月)
      // 해(亥) 정기 = 임(壬, WATER) -> 편인 (수생목) -> 득령
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.HAE),
        new Pillar(Cheongan.GAP, Jiji.SUL),
        new Pillar(Cheongan.BYEONG, Jiji.SA),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.score.deukryeong).toBe(40.0);
    });
  });

  // =========================================================================
  // 2. 득지 (得地) tests -- branch hidden-stem support
  // =========================================================================
  describe('deukji (득지)', () => {
    it('deukji scores proportional to supporting hidden stem days', () => {
      // 갑목 일간: 인(寅) branch has hidden stems:
      //   무(EARTH, 여기 7일), 병(FIRE, 중기 7일), 갑(WOOD, 정기 16일)
      // 갑 vs 갑 = 비견 (supporting!) -> (16/30) * 5 = 2.667
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.GYEONG, Jiji.YU),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GYEONG, Jiji.YU),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      // 년지 인: 갑 16일 supporting -> (16/30)*5 ~= 2.667
      // 일지 인: same as 년지 -> 2.667
      // Total deukji ~= 5.333
      const expectedDeukji = (16.0 / 30.0) * 5.0 * 2; // two IN branches
      expect(result.score.deukji).toBeCloseTo(expectedDeukji, 1);
    });

    it('deukji is zero when no branch hidden stems support day master', () => {
      // 갑목 일간 with branches that have no wood or water hidden stems
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.YU),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.YU),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.score.deukji).toBe(0.0);
    });
  });

  // =========================================================================
  // 3. 득세 (得勢) tests -- heavenly stem support
  // =========================================================================
  describe('deukse (득세)', () => {
    it('bigyeop stems score 7 points each in deukse', () => {
      // 갑목 일간 with 을(EUL, WOOD YIN) in all three non-day positions -> 겁재
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.O),
        new Pillar(Cheongan.EUL, Jiji.O),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.EUL, Jiji.O),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.score.deukse).toBe(21.0);
    });

    it('inseong stems score 5 points each in deukse', () => {
      // 갑목 일간 with 임(IM, WATER YANG) -> 편인 in all three non-day positions
      const pillars = new PillarSet(
        new Pillar(Cheongan.IM, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.O),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.O),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.score.deukse).toBe(15.0);
    });

    it('non-supporting stems score zero in deukse', () => {
      // 갑목 일간 with 경(GYEONG, METAL YANG) -> 편관 in all three positions
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYEONG, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.O),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.O),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.score.deukse).toBe(0.0);
    });

    it('deukse mixed bigyeop and inseong stems', () => {
      // 갑목 일간: year=을(겁재 7), month=임(편인 5), hour=계(정인 5)
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.O),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYE, Jiji.O),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.score.deukse).toBe(17.0);
    });
  });

  // =========================================================================
  // 4. Sipseong determination correctness
  // =========================================================================
  describe('sipseong determination', () => {
    it('sipseong determination matches all ten relationships for GAP day master', () => {
      const dm = Cheongan.GAP;

      // Same element
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.GAP)).toBe(Sipseong.BI_GYEON);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.EUL)).toBe(Sipseong.GYEOB_JAE);

      // Day Master generates (WOOD -> FIRE)
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.BYEONG)).toBe(Sipseong.SIK_SIN);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.JEONG)).toBe(Sipseong.SANG_GWAN);

      // Day Master controls (WOOD -> EARTH)
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.MU)).toBe(Sipseong.PYEON_JAE);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.GI)).toBe(Sipseong.JEONG_JAE);

      // Controls Day Master (METAL -> WOOD)
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.GYEONG)).toBe(Sipseong.PYEON_GWAN);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.SIN)).toBe(Sipseong.JEONG_GWAN);

      // Generates Day Master (WATER -> WOOD)
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.IM)).toBe(Sipseong.PYEON_IN);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.GYE)).toBe(Sipseong.JEONG_IN);
    });

    it('sipseong determination correct for BYEONG fire day master', () => {
      const dm = Cheongan.BYEONG; // 병(丙) FIRE YANG

      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.BYEONG)).toBe(Sipseong.BI_GYEON);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.JEONG)).toBe(Sipseong.GYEOB_JAE);

      // FIRE generates EARTH
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.MU)).toBe(Sipseong.SIK_SIN);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.GI)).toBe(Sipseong.SANG_GWAN);

      // FIRE controls METAL
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.GYEONG)).toBe(Sipseong.PYEON_JAE);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.SIN)).toBe(Sipseong.JEONG_JAE);

      // WATER controls FIRE
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.IM)).toBe(Sipseong.PYEON_GWAN);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.GYE)).toBe(Sipseong.JEONG_GWAN);

      // WOOD generates FIRE
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.GAP)).toBe(Sipseong.PYEON_IN);
      expect(StrengthAnalyzer.determineSipseong(dm, Cheongan.EUL)).toBe(Sipseong.JEONG_IN);
    });

    it('supporting sipseong classification is correct', () => {
      // 비겁 (same element) supports
      expect(StrengthAnalyzer.isSupportingSipseong(Sipseong.BI_GYEON)).toBe(true);
      expect(StrengthAnalyzer.isSupportingSipseong(Sipseong.GYEOB_JAE)).toBe(true);

      // 인성 (generates Day Master) supports
      expect(StrengthAnalyzer.isSupportingSipseong(Sipseong.PYEON_IN)).toBe(true);
      expect(StrengthAnalyzer.isSupportingSipseong(Sipseong.JEONG_IN)).toBe(true);

      // All others do NOT support
      expect(StrengthAnalyzer.isSupportingSipseong(Sipseong.SIK_SIN)).toBe(false);
      expect(StrengthAnalyzer.isSupportingSipseong(Sipseong.SANG_GWAN)).toBe(false);
      expect(StrengthAnalyzer.isSupportingSipseong(Sipseong.PYEON_JAE)).toBe(false);
      expect(StrengthAnalyzer.isSupportingSipseong(Sipseong.JEONG_JAE)).toBe(false);
      expect(StrengthAnalyzer.isSupportingSipseong(Sipseong.PYEON_GWAN)).toBe(false);
      expect(StrengthAnalyzer.isSupportingSipseong(Sipseong.JEONG_GWAN)).toBe(false);
    });
  });

  // =========================================================================
  // 5. Overall strength classification (신강/신약)
  // =========================================================================
  describe('overall strength classification', () => {
    it('GAP wood in IN month with wood stems is singang', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.HAE),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.IM, Jiji.JA),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.isStrong).toBe(true);
      expect(result.score.totalSupport).toBeGreaterThanOrEqual(50.0);
      expect(result.score.deukryeong).toBe(40.0);
    });

    it('GAP wood in SIN month with metal stems is sinyak', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
        new Pillar(Cheongan.GAP, Jiji.SUL),
        new Pillar(Cheongan.BYEONG, Jiji.YU),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.isStrong).toBe(false);
      expect(result.score.totalSupport).toBeLessThan(50.0);
      expect(result.score.deukryeong).toBe(0.0);
    });

    it('very strong chart classification', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.HAE),
        new Pillar(Cheongan.IM, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GYE, Jiji.JA),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.isStrong).toBe(true);
      expect(result.score.totalSupport).toBeGreaterThanOrEqual(70.0);
      expect(result.level).toBe(StrengthLevel.VERY_STRONG);
    });

    it('very weak chart classification', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYEONG, Jiji.O),
        new Pillar(Cheongan.SIN, Jiji.YU),
        new Pillar(Cheongan.GAP, Jiji.SUL),
        new Pillar(Cheongan.BYEONG, Jiji.SA),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.isStrong).toBe(false);
      expect(result.score.totalSupport).toBeLessThan(15.0);
      expect(result.level).toBe(StrengthLevel.VERY_WEAK);
    });
  });

  // =========================================================================
  // 6. Score breakdown sanity checks
  // =========================================================================
  describe('score breakdown sanity checks', () => {
    it('total support equals sum of three dimensions', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.HAE),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.IM, Jiji.JA),
      );

      const score = StrengthAnalyzer.analyze(pillars).score;

      const expectedTotal = score.deukryeong + score.deukji + score.deukse;
      expect(score.totalSupport).toBeCloseTo(expectedTotal, 3);
    });

    it('total oppose is non-negative', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.HAE),
        new Pillar(Cheongan.IM, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GYE, Jiji.JA),
      );

      const score = StrengthAnalyzer.analyze(pillars).score;

      expect(score.totalOppose).toBeGreaterThanOrEqual(0.0);
    });

    it('details list is non-empty and contains scoring sections', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details.some(d => d.startsWith('[득령]'))).toBe(true);
      expect(result.details.some(d => d.startsWith('[득지]'))).toBe(true);
      expect(result.details.some(d => d.startsWith('[득세]'))).toBe(true);
      expect(result.details.some(d => d.includes('판정'))).toBe(true);
    });

    it('isStrong matches level classification', () => {
      const strongPillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.HAE),
        new Pillar(Cheongan.IM, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GYE, Jiji.JA),
      );
      const weakPillars = new PillarSet(
        new Pillar(Cheongan.GYEONG, Jiji.O),
        new Pillar(Cheongan.SIN, Jiji.YU),
        new Pillar(Cheongan.GAP, Jiji.SUL),
        new Pillar(Cheongan.BYEONG, Jiji.SA),
      );

      const strong = StrengthAnalyzer.analyze(strongPillars);
      const weak = StrengthAnalyzer.analyze(weakPillars);

      expect(strong.isStrong).toBe(true);
      expect([
        StrengthLevel.VERY_STRONG,
        StrengthLevel.STRONG,
        StrengthLevel.SLIGHTLY_STRONG,
      ]).toContain(strong.level);

      expect(weak.isStrong).toBe(false);
      expect([
        StrengthLevel.VERY_WEAK,
        StrengthLevel.WEAK,
        StrengthLevel.SLIGHTLY_WEAK,
      ]).toContain(weak.level);
    });
  });

  // =========================================================================
  // 7. Different day master elements
  // =========================================================================
  describe('different day master elements', () => {
    it('BYEONG fire day master in SA month is deukryeong', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GYE, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
        new Pillar(Cheongan.MU, Jiji.SUL),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.BYEONG);
      expect(result.score.deukryeong).toBe(40.0);
    });

    it('GYEONG metal day master in YU month is deukryeong', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.SUL),
        new Pillar(Cheongan.EUL, Jiji.YU),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
        new Pillar(Cheongan.IM, Jiji.JA),
      );

      const result = StrengthAnalyzer.analyze(pillars);

      expect(result.dayMaster).toBe(Cheongan.GYEONG);
      expect(result.score.deukryeong).toBe(40.0);
    });
  });

  // =========================================================================
  // 8. 합화/합거 효과가 득세에 미치는 영향 (HapHwa Propagation)
  // =========================================================================
  describe('HapHwa propagation effects on deukse', () => {
    it('HAPGEO neutralizes stem - removes contribution from deukse', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GI, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );

      const hapGeo: HapHwaEvaluation = {
        stem1: Cheongan.GI,
        stem2: Cheongan.GAP,
        position1: PillarPosition.YEAR,
        position2: PillarPosition.MONTH,
        resultOhaeng: Ohaeng.EARTH,
        state: HapState.HAPGEO,
        confidence: 0.5,
        conditionsMet: ['인접 조건'],
        conditionsFailed: ['월령 조건'],
        reasoning: '합거 테스트',
        dayMasterInvolved: false,
      };

      const withoutHap = StrengthAnalyzer.analyze(pillars);
      const withHap = StrengthAnalyzer.analyze(pillars, DEFAULT_CONFIG, null, [hapGeo]);

      // 월간 갑(甲)=비견 contributes 7 to deukse when no hap
      expect(withoutHap.score.deukse).toBeGreaterThan(0);

      // With HAPGEO, both stems are neutralized
      expect(withHap.score.deukse).toBeLessThan(withoutHap.score.deukse);

      // Detail text should mention 합거
      expect(withHap.details.some(d => d.includes('합거'))).toBe(true);
    });

    it('HAPWHA transforms stem element - recalculates support', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.GYE, Jiji.SA),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYE, Jiji.HAE),
      );

      const hapWha: HapHwaEvaluation = {
        stem1: Cheongan.MU,
        stem2: Cheongan.GYE,
        position1: PillarPosition.YEAR,
        position2: PillarPosition.MONTH,
        resultOhaeng: Ohaeng.FIRE,
        state: HapState.HAPWHA,
        confidence: 0.85,
        conditionsMet: ['인접 조건', '월령 조건'],
        conditionsFailed: [],
        reasoning: '합화 테스트',
        dayMasterInvolved: false,
      };

      const withoutHap = StrengthAnalyzer.analyze(pillars);
      const withHap = StrengthAnalyzer.analyze(pillars, DEFAULT_CONFIG, null, [hapWha]);

      // Detail text should mention 합화 transformation
      expect(withHap.details.some(d => d.includes('합화'))).toBe(true);

      // Without hap: 년간 무=편재(0) + 월간 계=정인(+5) + 시간 계=정인(+5) = 10
      // With hapwha: 년간->화=식신(0) + 월간->화=식신(0) + 시간 계=정인(+5) = 5
      const expectedDelta = 5.0;
      expect(withHap.score.deukse).toBeCloseTo(
        withoutHap.score.deukse - expectedDelta, 1,
      );
    });

    it('NOT_ESTABLISHED hap does not affect strength calculation', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GI, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );

      const notEstablished: HapHwaEvaluation = {
        stem1: Cheongan.GI,
        stem2: Cheongan.GAP,
        position1: PillarPosition.YEAR,
        position2: PillarPosition.MONTH,
        resultOhaeng: Ohaeng.EARTH,
        state: HapState.NOT_ESTABLISHED,
        confidence: 1.0,
        conditionsMet: [],
        conditionsFailed: ['인접 조건'],
        reasoning: '불성립',
        dayMasterInvolved: true,
      };

      const withoutHap = StrengthAnalyzer.analyze(pillars);
      const withNotEstablished = StrengthAnalyzer.analyze(
        pillars, DEFAULT_CONFIG, null, [notEstablished],
      );

      expect(withNotEstablished.score.deukse).toBe(withoutHap.score.deukse);
    });
  });

  // =========================================================================
  // 9. 득령 비례 점수 (Proportional Deukryeong) tests
  // =========================================================================
  describe('proportional deukryeong', () => {
    const proportionalConfig = createConfig({ proportionalDeukryeong: true });

    it('GAP in IN month - proportional scores partial support', () => {
      // 갑목(甲木) + 인월(寅月)
      // 인(寅) 지장간: 무(戊)7일 편재->비지지 / 병(丙)7일 식신->비지지 / 갑(甲)16일 비견->지지
      // 지지율 = 16/30 ~= 53.3% -> 40 * 16/30 ~= 21.33
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );

      const result = StrengthAnalyzer.analyze(pillars, proportionalConfig);

      const expected = 40.0 * 16.0 / 30.0; // ~= 21.33
      expect(result.score.deukryeong).toBeCloseTo(expected, 1);
      expect(result.details.some(d => d.includes('비례'))).toBe(true);
    });

    it('GAP in MYO month - proportional scores high support', () => {
      // 갑목(甲木) + 묘월(卯月)
      // 묘(卯) 왕지 지장간: 갑(甲)10일 비견->지지 / 을(乙)20일 겁재->지지
      // 지지율 = 30/30 = 100% -> 40.0
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.SUL),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );

      const result = StrengthAnalyzer.analyze(pillars, proportionalConfig);

      expect(result.score.deukryeong).toBeCloseTo(40.0, 1);
    });

    it('GAP in SIN month - proportional scores partial from inseong', () => {
      // 갑목(甲木) + 신월(申月)
      // 신(申) 지장간: 무(戊)7일 편재->비지지 / 임(壬)7일 편인->지지 / 경(庚)16일 편관->비지지
      // 지지율 = 7/30 ~= 23.3% -> 40 * 7/30 ~= 9.33
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
        new Pillar(Cheongan.GAP, Jiji.SUL),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
      );

      const result = StrengthAnalyzer.analyze(pillars, proportionalConfig);

      const expected = 40.0 * 7.0 / 30.0; // ~= 9.33
      expect(result.score.deukryeong).toBeCloseTo(expected, 1);
    });

    it('GAP in O month - proportional scores zero', () => {
      // 갑목(甲木) + 오월(午月)
      // 지지율 = 0/30 = 0% -> 0.0
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.BYEONG, Jiji.O),
        new Pillar(Cheongan.GAP, Jiji.SUL),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );

      const result = StrengthAnalyzer.analyze(pillars, proportionalConfig);

      expect(result.score.deukryeong).toBeCloseTo(0.0, 1);
    });

    it('binary mode same chart gives full 40', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );

      const binaryResult = StrengthAnalyzer.analyze(
        pillars, createConfig({ proportionalDeukryeong: false }),
      );
      const propResult = StrengthAnalyzer.analyze(pillars, proportionalConfig);

      expect(binaryResult.score.deukryeong).toBe(40.0);
      expect(propResult.score.deukryeong).toBeLessThan(40.0);
      expect(propResult.score.deukryeong).toBeGreaterThan(0.0);
    });

    it('IM in JA month - proportional full support', () => {
      // 임수(壬水) + 자월(子月)
      // 자(子) 왕지 지장간: 임(壬)10일 비견->지지 / 계(癸)20일 겁재->지지
      // 지지율 = 30/30 = 100% -> 40.0
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.IM, Jiji.JA),
        new Pillar(Cheongan.IM, Jiji.JIN),
        new Pillar(Cheongan.BYEONG, Jiji.O),
      );

      const result = StrengthAnalyzer.analyze(pillars, proportionalConfig);

      expect(result.score.deukryeong).toBeCloseTo(40.0, 1);
    });

    it('detail trace contains breakdown per stem', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );

      const result = StrengthAnalyzer.analyze(pillars, proportionalConfig);

      const deukryeongDetail = result.details.find(d => d.includes('득령·비례'))!;
      expect(deukryeongDetail).toBeDefined();
      expect(deukryeongDetail).toContain('비지지');
      expect(deukryeongDetail).toContain('지지');
      expect(deukryeongDetail).toContain('지지율');
    });
  });
});
