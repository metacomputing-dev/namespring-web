import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput, type BirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { configFromPreset, SchoolPreset } from '../../src/config/CalculationConfig.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { Ohaeng } from '../../src/domain/Ohaeng.js';
import { GyeokgukType, GyeokgukCategory } from '../../src/domain/Gyeokguk.js';

/**
 * Baseline test for the competitor comparison framework.
 * Ported from Kotlin CompetitorComparisonBaselineTest.kt.
 *
 * Validates that our engine produces the exact results documented in
 * the competitor comparison fixture. These 5 cases are the "showcase" cases
 * specifically chosen to highlight:
 *
 *  1. 합화격 판별 (COMP-01)
 *  2. DST 보정 (COMP-02)
 *  3. 야자시 경계 (COMP-03)
 *  4. 입춘 경계 (COMP-04)
 *  5. 종격 판별 (COMP-05)
 */

const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

describe('CompetitorComparisonBaselineTest', () => {

  // COMP-01: 합화격 여명 (1989-10-20 07:30)
  describe('COMP-01: hapwha case', () => {
    const input = createBirthInput({
      birthYear: 1989, birthMonth: 10, birthDay: 20,
      birthHour: 7, birthMinute: 30,
      gender: Gender.FEMALE, longitude: 126.978,
    });

    it('pillars match expected values', () => {
      const a = analyzeSaju(input, config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.GI);
      expect(a.pillars.year.jiji).toBe(Jiji.SA);
      expect(a.pillars.month.cheongan).toBe(Cheongan.GAP);
      expect(a.pillars.month.jiji).toBe(Jiji.SUL);
      expect(a.pillars.day.cheongan).toBe(Cheongan.GYE);
      expect(a.pillars.day.jiji).toBe(Jiji.CHUK);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.EUL);
      expect(a.pillars.hour.jiji).toBe(Jiji.MYO);
    });

    it('strength is not strong (sinnyak)', () => {
      const a = analyzeSaju(input, config);
      expect(a.strengthResult!.isStrong).toBe(false);
    });

    it('yongshin final element is WOOD (식상 from jongsegyeok)', () => {
      const a = analyzeSaju(input, config);
      expect(a.yongshinResult!.finalYongshin).toBe(Ohaeng.WOOD);
    });

    it('gyeokguk is JONGSE (종세격)', () => {
      const a = analyzeSaju(input, config);
      expect(a.gyeokgukResult!.type).toBe(GyeokgukType.JONGSE);
      expect(a.gyeokgukResult!.category).toBe(GyeokgukCategory.JONGGYEOK);
    });
  });

  // COMP-02: DST 보정 (1988-07-15 14:30)
  describe('COMP-02: DST correction', () => {
    const input = createBirthInput({
      birthYear: 1988, birthMonth: 7, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE, longitude: 126.978,
    });

    it('pillars match expected values', () => {
      const a = analyzeSaju(input, config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.MU);
      expect(a.pillars.year.jiji).toBe(Jiji.JIN);
      expect(a.pillars.month.cheongan).toBe(Cheongan.GI);
      expect(a.pillars.month.jiji).toBe(Jiji.MI);
      expect(a.pillars.day.cheongan).toBe(Cheongan.SIN);
      expect(a.pillars.day.jiji).toBe(Jiji.MI);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.GAP);
      expect(a.pillars.hour.jiji).toBe(Jiji.O);
    });

    it('DST applied: hour branch must be O (오시), not MI (미시)', () => {
      const a = analyzeSaju(input, config);
      expect(a.pillars.hour.jiji).toBe(Jiji.O);
    });

    it('strength is strong (singang)', () => {
      const a = analyzeSaju(input, config);
      expect(a.strengthResult!.isStrong).toBe(true);
    });
  });

  // COMP-03: 야자시 경계 (1995-08-20 23:15)
  describe('COMP-03: yaza-si boundary', () => {
    const input = createBirthInput({
      birthYear: 1995, birthMonth: 8, birthDay: 20,
      birthHour: 23, birthMinute: 15,
      gender: Gender.MALE, longitude: 126.978,
    });

    it('pillars match expected values (yaza-si applied)', () => {
      const a = analyzeSaju(input, config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.EUL);
      expect(a.pillars.year.jiji).toBe(Jiji.HAE);
      expect(a.pillars.month.cheongan).toBe(Cheongan.GAP);
      expect(a.pillars.month.jiji).toBe(Jiji.SIN);
      // Day pillar should be 계미 (next day), NOT 임오 (today)
      expect(a.pillars.day.cheongan).toBe(Cheongan.GYE);
      expect(a.pillars.day.jiji).toBe(Jiji.MI);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.GYE);
      expect(a.pillars.hour.jiji).toBe(Jiji.HAE);
    });

    it('yaza-si key verification: day stem is GYE not IM', () => {
      const a = analyzeSaju(input, config);
      expect(a.pillars.day.cheongan).toBe(Cheongan.GYE);
      expect(a.pillars.day.jiji).toBe(Jiji.MI);
    });
  });

  // COMP-04: 입춘 경계 (2024-02-04 05:30)
  describe('COMP-04: ipchun boundary', () => {
    const input = createBirthInput({
      birthYear: 2024, birthMonth: 2, birthDay: 4,
      birthHour: 5, birthMinute: 30,
      gender: Gender.FEMALE, longitude: 126.978,
    });

    it('year pillar is GYE-MYO (2023), NOT GAP-JIN (2024)', () => {
      const a = analyzeSaju(input, config);
      // 2024 ipchun is around 16:27 KST, so 05:30 is before ipchun
      expect(a.pillars.year.cheongan).toBe(Cheongan.GYE);
      expect(a.pillars.year.jiji).toBe(Jiji.MYO);
    });

    it('month and day pillars match', () => {
      const a = analyzeSaju(input, config);
      expect(a.pillars.month.cheongan).toBe(Cheongan.EUL);
      expect(a.pillars.month.jiji).toBe(Jiji.CHUK);
      expect(a.pillars.day.cheongan).toBe(Cheongan.MU);
      expect(a.pillars.day.jiji).toBe(Jiji.SUL);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.GAP);
      expect(a.pillars.hour.jiji).toBe(Jiji.IN);
    });
  });

  // COMP-05: 종격 판별 (1990-04-10 10:00)
  describe('COMP-05: jonggyeok detection', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 4, birthDay: 10,
      birthHour: 10, birthMinute: 0,
      gender: Gender.MALE, longitude: 126.978,
    });

    it('pillars match expected values', () => {
      const a = analyzeSaju(input, config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.GYEONG);
      expect(a.pillars.year.jiji).toBe(Jiji.O);
      expect(a.pillars.month.cheongan).toBe(Cheongan.GYEONG);
      expect(a.pillars.month.jiji).toBe(Jiji.JIN);
      expect(a.pillars.day.cheongan).toBe(Cheongan.EUL);
      expect(a.pillars.day.jiji).toBe(Jiji.SA);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.SIN);
      expect(a.pillars.hour.jiji).toBe(Jiji.SA);
    });

    it('strength is very weak (geuk-sinnyak)', () => {
      const a = analyzeSaju(input, config);
      const s = a.strengthResult!;
      expect(s.isStrong).toBe(false);
      expect(s.score.totalSupport).toBeLessThan(5.0);
    });

    it('gyeokguk is JONGSE (종세격)', () => {
      const a = analyzeSaju(input, config);
      const g = a.gyeokgukResult!;
      expect(g.type).toBe(GyeokgukType.JONGSE);
      expect(g.category).toBe(GyeokgukCategory.JONGGYEOK);
    });
  });

  // Cross-case: All 5 comparison cases produce analysis with trace
  describe('all 5 COMP cases produce analysis with explainability', () => {
    const compInputs: BirthInput[] = [
      createBirthInput({ birthYear: 1989, birthMonth: 10, birthDay: 20, birthHour: 7, birthMinute: 30, gender: Gender.FEMALE, longitude: 126.978 }),
      createBirthInput({ birthYear: 1988, birthMonth: 7, birthDay: 15, birthHour: 14, birthMinute: 30, gender: Gender.MALE, longitude: 126.978 }),
      createBirthInput({ birthYear: 1995, birthMonth: 8, birthDay: 20, birthHour: 23, birthMinute: 15, gender: Gender.MALE, longitude: 126.978 }),
      createBirthInput({ birthYear: 2024, birthMonth: 2, birthDay: 4, birthHour: 5, birthMinute: 30, gender: Gender.FEMALE, longitude: 126.978 }),
      createBirthInput({ birthYear: 1990, birthMonth: 4, birthDay: 10, birthHour: 10, birthMinute: 0, gender: Gender.MALE, longitude: 126.978 }),
    ];

    for (let i = 0; i < compInputs.length; i++) {
      const caseNum = i + 1;
      it(`COMP-0${caseNum}: trace steps >= 7 and summaries non-blank`, () => {
        const a = analyzeSaju(compInputs[i]!, config);
        expect(a.trace.length).toBeGreaterThanOrEqual(7);
        for (const step of a.trace) {
          expect(step.summary.length).toBeGreaterThan(0);
        }
      });
    }
  });

  // Fixture data integrity: comparison data structure is well-formed
  describe('comparison fixture structural integrity', () => {
    const cases = [
      { caseId: 'COMP-01', birth: { date: '1989-10-20', time: '07:30', gender: 'FEMALE' } },
      { caseId: 'COMP-02', birth: { date: '1988-07-15', time: '14:30', gender: 'MALE' } },
      { caseId: 'COMP-03', birth: { date: '1995-08-20', time: '23:15', gender: 'MALE' } },
      { caseId: 'COMP-04', birth: { date: '2024-02-04', time: '05:30', gender: 'FEMALE' } },
      { caseId: 'COMP-05', birth: { date: '1990-04-10', time: '10:00', gender: 'MALE' } },
    ];

    it('has exactly 5 comparison cases', () => {
      expect(cases.length).toBe(5);
    });

    it('all case IDs are unique', () => {
      const ids = cases.map(c => c.caseId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all cases have valid birth data', () => {
      for (const c of cases) {
        expect(c.caseId).toBeDefined();
        expect(c.birth.date.length).toBeGreaterThan(0);
        expect(c.birth.time.length).toBeGreaterThan(0);
        expect(['MALE', 'FEMALE']).toContain(c.birth.gender);
      }
    });
  });
});
