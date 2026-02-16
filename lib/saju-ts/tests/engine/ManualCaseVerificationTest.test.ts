import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { createConfig } from '../../src/config/CalculationConfig.js';

/**
 * Manual case verification tests: validates our engine against manually-exported
 * and human-reviewed analysis cases.
 *
 * Each case has been exported via manual-case-export-v2 schema, reviewed for
 * correctness, and its key fields are locked here as regression assertions.
 *
 * This is the foundation for the expert adjudication verification set.
 */

const config = createConfig({
  includeEquationOfTime: false,
  applyDstHistory: true,
});

function makeInput(
  y: number, m: number, d: number, h: number, min: number,
  gender: Gender, longitude = 126.978,
) {
  return createBirthInput({
    birthYear: y, birthMonth: m, birthDay: d,
    birthHour: h, birthMinute: min,
    gender, longitude,
  });
}

describe('ManualCaseVerificationTest', () => {
  // Case 1: shin_sunhye (1989-10-20 07:30 KST, FEMALE, Seoul)
  describe('Case 1: shin_sunhye', () => {
    const input = makeInput(1989, 10, 20, 7, 30, Gender.FEMALE);

    it('pillars', () => {
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

    it('strength', () => {
      const a = analyzeSaju(input, config);
      expect(a.strengthResult).not.toBeNull();
      expect(a.strengthResult!.dayMaster).toBe(Cheongan.GYE);
      expect(a.strengthResult!.isStrong).toBe(false);
    });

    it('daeun', () => {
      const a = analyzeSaju(input, config);
      expect(a.daeunInfo).not.toBeNull();
      expect(a.daeunInfo!.isForward).toBe(true);
      expect(a.daeunInfo!.firstDaeunStartAge).toBe(6);
      expect(a.daeunInfo!.daeunPillars.length).toBeGreaterThanOrEqual(8);
    });

    it('gongmang', () => {
      const a = analyzeSaju(input, config);
      expect(a.gongmangVoidBranches).not.toBeNull();
      expect(a.gongmangVoidBranches![0]).toBe(Jiji.IN);
      expect(a.gongmangVoidBranches![1]).toBe(Jiji.MYO);
    });
  });

  // Case 2: geukshingang (1984-02-19 06:30 KST, MALE, Seoul)
  describe('Case 2: geukshingang', () => {
    const input = makeInput(1984, 2, 19, 6, 30, Gender.MALE);

    it('pillars and core', () => {
      const a = analyzeSaju(input, config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.GAP);
      expect(a.pillars.year.jiji).toBe(Jiji.JA);
      expect(a.pillars.month.cheongan).toBe(Cheongan.BYEONG);
      expect(a.pillars.month.jiji).toBe(Jiji.IN);
      expect(a.pillars.day.cheongan).toBe(Cheongan.GYE);
      expect(a.pillars.day.jiji).toBe(Jiji.MI);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.EUL);
      expect(a.pillars.hour.jiji).toBe(Jiji.MYO);

      expect(a.strengthResult!.dayMaster).toBe(Cheongan.GYE);
      expect(a.strengthResult!.isStrong).toBe(false);
    });

    it('daeun and gongmang', () => {
      const a = analyzeSaju(input, config);
      expect(a.daeunInfo!.isForward).toBe(true);
      expect(a.daeunInfo!.firstDaeunStartAge).toBe(5);
      expect(a.gongmangVoidBranches![0]).toBe(Jiji.SIN);
      expect(a.gongmangVoidBranches![1]).toBe(Jiji.YU);
    });
  });

  // Case 3: DST (1988-07-15 14:30 KST, MALE, Seoul)
  describe('Case 3: DST 1988', () => {
    const input = makeInput(1988, 7, 15, 14, 30, Gender.MALE);

    it('pillars with DST correction', () => {
      const a = analyzeSaju(input, config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.MU);
      expect(a.pillars.year.jiji).toBe(Jiji.JIN);
      expect(a.pillars.month.cheongan).toBe(Cheongan.GI);
      expect(a.pillars.month.jiji).toBe(Jiji.MI);
      expect(a.pillars.day.cheongan).toBe(Cheongan.SIN);
      expect(a.pillars.day.jiji).toBe(Jiji.MI);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.GAP);
      expect(a.pillars.hour.jiji).toBe(Jiji.O);

      expect(a.strengthResult!.dayMaster).toBe(Cheongan.SIN);
      expect(a.strengthResult!.isStrong).toBe(true);
    });
  });

  // Case 4: yaza boundary (1995-08-20 23:15 KST, MALE, Seoul)
  describe('Case 4: yaza boundary', () => {
    const input = makeInput(1995, 8, 20, 23, 15, Gender.MALE);

    it('pillars with yaza', () => {
      const a = analyzeSaju(input, config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.EUL);
      expect(a.pillars.year.jiji).toBe(Jiji.HAE);
      expect(a.pillars.month.cheongan).toBe(Cheongan.GAP);
      expect(a.pillars.month.jiji).toBe(Jiji.SIN);
      expect(a.pillars.day.cheongan).toBe(Cheongan.GYE);
      expect(a.pillars.day.jiji).toBe(Jiji.MI);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.GYE);
      expect(a.pillars.hour.jiji).toBe(Jiji.HAE);
    });

    it('daeun reverse', () => {
      const a = analyzeSaju(input, config);
      expect(a.daeunInfo!.isForward).toBe(false);
      expect(a.daeunInfo!.firstDaeunStartAge).toBe(4);
    });
  });

  // Case 5: ipchun boundary (2024-02-04 05:30 KST, FEMALE, Seoul)
  describe('Case 5: ipchun boundary', () => {
    const input = makeInput(2024, 2, 4, 5, 30, Gender.FEMALE);

    it('before ipchun yields previous year', () => {
      const a = analyzeSaju(input, config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.GYE);
      expect(a.pillars.year.jiji).toBe(Jiji.MYO);
      expect(a.pillars.month.cheongan).toBe(Cheongan.EUL);
      expect(a.pillars.month.jiji).toBe(Jiji.CHUK);
      expect(a.pillars.day.cheongan).toBe(Cheongan.MU);
      expect(a.pillars.day.jiji).toBe(Jiji.SUL);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.GAP);
      expect(a.pillars.hour.jiji).toBe(Jiji.IN);

      expect(a.strengthResult!.dayMaster).toBe(Cheongan.MU);
    });

    it('daeun forward', () => {
      const a = analyzeSaju(input, config);
      expect(a.daeunInfo!.isForward).toBe(true);
      expect(a.daeunInfo!.firstDaeunStartAge).toBe(1);
      expect(a.gongmangVoidBranches![0]).toBe(Jiji.JIN);
      expect(a.gongmangVoidBranches![1]).toBe(Jiji.SA);
    });
  });

  // Case 6: jeonggwan (1990-04-10 10:00 KST, MALE, Seoul)
  describe('Case 6: jeonggwan', () => {
    it('pillars', () => {
      const a = analyzeSaju(makeInput(1990, 4, 10, 10, 0, Gender.MALE), config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.GYEONG);
      expect(a.pillars.year.jiji).toBe(Jiji.O);
      expect(a.pillars.month.cheongan).toBe(Cheongan.GYEONG);
      expect(a.pillars.month.jiji).toBe(Jiji.JIN);
      expect(a.pillars.day.cheongan).toBe(Cheongan.EUL);
      expect(a.pillars.day.jiji).toBe(Jiji.SA);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.SIN);
      expect(a.pillars.hour.jiji).toBe(Jiji.SA);

      expect(a.strengthResult!.dayMaster).toBe(Cheongan.EUL);
      expect(a.strengthResult!.isStrong).toBe(false);
    });
  });

  // Case 7: sikshin (1982-09-03 08:00 KST, FEMALE, Seoul)
  describe('Case 7: sikshin', () => {
    it('pillars', () => {
      const a = analyzeSaju(makeInput(1982, 9, 3, 8, 0, Gender.FEMALE), config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.IM);
      expect(a.pillars.year.jiji).toBe(Jiji.SUL);
      expect(a.pillars.month.cheongan).toBe(Cheongan.MU);
      expect(a.pillars.month.jiji).toBe(Jiji.SIN);
      expect(a.pillars.day.cheongan).toBe(Cheongan.GI);
      expect(a.pillars.day.jiji).toBe(Jiji.CHUK);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.MU);
      expect(a.pillars.hour.jiji).toBe(Jiji.JIN);
    });
  });

  // Case 8: pyeonin (1977-01-25 03:00 KST, MALE, Seoul)
  describe('Case 8: pyeonin', () => {
    it('pillars', () => {
      const a = analyzeSaju(makeInput(1977, 1, 25, 3, 0, Gender.MALE), config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.BYEONG);
      expect(a.pillars.year.jiji).toBe(Jiji.JIN);
      expect(a.pillars.month.cheongan).toBe(Cheongan.SIN);
      expect(a.pillars.month.jiji).toBe(Jiji.CHUK);
      expect(a.pillars.day.cheongan).toBe(Cheongan.IM);
      expect(a.pillars.day.jiji).toBe(Jiji.O);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.SIN);
      expect(a.pillars.hour.jiji).toBe(Jiji.CHUK);

      expect(a.strengthResult!.dayMaster).toBe(Cheongan.IM);
      expect(a.strengthResult!.isStrong).toBe(false);
    });
  });

  // Case 9: yangin (1968-05-05 11:00 KST, MALE, Seoul)
  describe('Case 9: yangin', () => {
    it('pillars', () => {
      const a = analyzeSaju(makeInput(1968, 5, 5, 11, 0, Gender.MALE), config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.MU);
      expect(a.pillars.year.jiji).toBe(Jiji.SIN);
      expect(a.pillars.month.cheongan).toBe(Cheongan.BYEONG);
      expect(a.pillars.month.jiji).toBe(Jiji.JIN);
      expect(a.pillars.day.cheongan).toBe(Cheongan.EUL);
      expect(a.pillars.day.jiji).toBe(Jiji.HAE);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.SIN);
      expect(a.pillars.hour.jiji).toBe(Jiji.SA);

      expect(a.strengthResult!.dayMaster).toBe(Cheongan.EUL);
      expect(a.strengthResult!.isStrong).toBe(false);
    });
  });

  // Case 10: jongjae (1973-11-08 16:00 KST, MALE, Seoul)
  describe('Case 10: jongjae', () => {
    it('pillars and daeun reverse', () => {
      const a = analyzeSaju(makeInput(1973, 11, 8, 16, 0, Gender.MALE), config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.GYE);
      expect(a.pillars.year.jiji).toBe(Jiji.CHUK);
      expect(a.pillars.month.cheongan).toBe(Cheongan.GYE);
      expect(a.pillars.month.jiji).toBe(Jiji.HAE);
      expect(a.pillars.day.cheongan).toBe(Cheongan.MU);
      expect(a.pillars.day.jiji).toBe(Jiji.SIN);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.GYEONG);
      expect(a.pillars.hour.jiji).toBe(Jiji.SIN);

      expect(a.daeunInfo!.isForward).toBe(false);
      expect(a.daeunInfo!.firstDaeunStartAge).toBe(1);
    });
  });

  // Case 11: haphwa (1985-06-21 09:00 KST, FEMALE, Seoul)
  describe('Case 11: haphwa', () => {
    it('pillars', () => {
      const a = analyzeSaju(makeInput(1985, 6, 21, 9, 0, Gender.FEMALE), config);
      expect(a.pillars.year.cheongan).toBe(Cheongan.EUL);
      expect(a.pillars.year.jiji).toBe(Jiji.CHUK);
      expect(a.pillars.month.cheongan).toBe(Cheongan.IM);
      expect(a.pillars.month.jiji).toBe(Jiji.O);
      expect(a.pillars.day.cheongan).toBe(Cheongan.SIN);
      expect(a.pillars.day.jiji).toBe(Jiji.MYO);
      expect(a.pillars.hour.cheongan).toBe(Cheongan.IM);
      expect(a.pillars.hour.jiji).toBe(Jiji.JIN);

      expect(a.daeunInfo!.isForward).toBe(true);
      expect(a.daeunInfo!.firstDaeunStartAge).toBe(5);
    });
  });

  // Cross-case: all 11 cases produce complete pipeline
  describe('All 11 cases: pipeline validation', () => {
    const cases = [
      makeInput(1989, 10, 20, 7, 30, Gender.FEMALE),
      makeInput(1984, 2, 19, 6, 30, Gender.MALE),
      makeInput(1988, 7, 15, 14, 30, Gender.MALE),
      makeInput(1995, 8, 20, 23, 15, Gender.MALE),
      makeInput(2024, 2, 4, 5, 30, Gender.FEMALE),
      makeInput(1990, 4, 10, 10, 0, Gender.MALE),
      makeInput(1982, 9, 3, 8, 0, Gender.FEMALE),
      makeInput(1977, 1, 25, 3, 0, Gender.MALE),
      makeInput(1968, 5, 5, 11, 0, Gender.MALE),
      makeInput(1973, 11, 8, 16, 0, Gender.MALE),
      makeInput(1985, 6, 21, 9, 0, Gender.FEMALE),
    ];

    it('all cases have complete trace', () => {
      const expectedKeys = new Set(['core', 'strength', 'yongshin', 'gyeokguk']);
      for (const input of cases) {
        const a = analyzeSaju(input, config);
        const traceKeys = new Set(a.trace.map(t => t.key));
        for (const key of expectedKeys) {
          expect(traceKeys.has(key), `missing trace key '${key}'`).toBe(true);
        }
      }
    });

    it('all cases have non-empty shinsal hits', () => {
      for (const input of cases) {
        const a = analyzeSaju(input, config);
        expect(a.shinsalHits.length).toBeGreaterThanOrEqual(5);
      }
    });
  });
});
