/**
 * TST-4: 오호원(五虎遁) and 오자원(五子遁) Full Mapping Verification.
 *
 * The 오호원 rule determines the starting heavenly stem of the first month (인월/寅月)
 * from the year stem. The 오자원 rule determines the starting heavenly stem of the
 * first hour (자시/子時) from the day stem. Both follow 5-pair groupings that cycle
 * through the 10 stems.
 *
 * Classical reference (적천수/淵海子平):
 * - 오호원: 갑기지년 병작수 (甲己之年丙作首)
 * - 오자원: 갑기환가갑 (甲己還加甲)
 */
import { describe, it, expect } from 'vitest';

import { Cheongan, CHEONGAN_VALUES, CHEONGAN_INFO, cheonganOrdinal } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { GanjiCycle } from '../../../src/engine/GanjiCycle.js';

describe('Ohowon & Ojawon mapping (TST-4)', () => {
  // =========================================================================
  // 오호원 (五虎遁) -- Year Stem -> Month Stem at 인월(寅月)
  // =========================================================================

  describe('오호원 5-pair mapping', () => {
    it('갑(甲)/기(己) year -> 병인월(丙寅月)', () => {
      const expected = new Pillar(Cheongan.BYEONG, Jiji.IN);
      expect(GanjiCycle.monthPillarBySajuMonthIndex(Cheongan.GAP, 1)).toEqual(expected);
      expect(GanjiCycle.monthPillarBySajuMonthIndex(Cheongan.GI, 1)).toEqual(expected);
    });

    it('을(乙)/경(庚) year -> 무인월(戊寅月)', () => {
      const expected = new Pillar(Cheongan.MU, Jiji.IN);
      expect(GanjiCycle.monthPillarBySajuMonthIndex(Cheongan.EUL, 1)).toEqual(expected);
      expect(GanjiCycle.monthPillarBySajuMonthIndex(Cheongan.GYEONG, 1)).toEqual(expected);
    });

    it('병(丙)/신(辛) year -> 경인월(庚寅月)', () => {
      const expected = new Pillar(Cheongan.GYEONG, Jiji.IN);
      expect(GanjiCycle.monthPillarBySajuMonthIndex(Cheongan.BYEONG, 1)).toEqual(expected);
      expect(GanjiCycle.monthPillarBySajuMonthIndex(Cheongan.SIN, 1)).toEqual(expected);
    });

    it('정(丁)/임(壬) year -> 임인월(壬寅月)', () => {
      const expected = new Pillar(Cheongan.IM, Jiji.IN);
      expect(GanjiCycle.monthPillarBySajuMonthIndex(Cheongan.JEONG, 1)).toEqual(expected);
      expect(GanjiCycle.monthPillarBySajuMonthIndex(Cheongan.IM, 1)).toEqual(expected);
    });

    it('무(戊)/계(癸) year -> 갑인월(甲寅月)', () => {
      const expected = new Pillar(Cheongan.GAP, Jiji.IN);
      expect(GanjiCycle.monthPillarBySajuMonthIndex(Cheongan.MU, 1)).toEqual(expected);
      expect(GanjiCycle.monthPillarBySajuMonthIndex(Cheongan.GYE, 1)).toEqual(expected);
    });
  });

  describe('오호원 exhaustive 10 stems -> IN month stem', () => {
    const expectedStems: Record<Cheongan, Cheongan> = {
      [Cheongan.GAP]: Cheongan.BYEONG,
      [Cheongan.EUL]: Cheongan.MU,
      [Cheongan.BYEONG]: Cheongan.GYEONG,
      [Cheongan.JEONG]: Cheongan.IM,
      [Cheongan.MU]: Cheongan.GAP,
      [Cheongan.GI]: Cheongan.BYEONG,
      [Cheongan.GYEONG]: Cheongan.MU,
      [Cheongan.SIN]: Cheongan.GYEONG,
      [Cheongan.IM]: Cheongan.IM,
      [Cheongan.GYE]: Cheongan.GAP,
    };

    for (const yearStem of CHEONGAN_VALUES) {
      it(`year stem ${CHEONGAN_INFO[yearStem].hangul}(${CHEONGAN_INFO[yearStem].hanja}) -> IN month stem ${CHEONGAN_INFO[expectedStems[yearStem]].hangul}`, () => {
        const pillar = GanjiCycle.monthPillarBySajuMonthIndex(yearStem, 1);
        expect(pillar.cheongan).toBe(expectedStems[yearStem]);
        expect(pillar.jiji).toBe(Jiji.IN);
      });
    }
  });

  describe('오호원 full 12-month cycle for each year stem', () => {
    const expectedBranches = [
      Jiji.IN, Jiji.MYO, Jiji.JIN, Jiji.SA, Jiji.O, Jiji.MI,
      Jiji.SIN, Jiji.YU, Jiji.SUL, Jiji.HAE, Jiji.JA, Jiji.CHUK,
    ];

    for (const yearStem of CHEONGAN_VALUES) {
      it(`year stem ${CHEONGAN_INFO[yearStem].hangul}: 12-month branch/stem cycle`, () => {
        const firstPillar = GanjiCycle.monthPillarBySajuMonthIndex(yearStem, 1);
        const startStemOrdinal = cheonganOrdinal(firstPillar.cheongan);

        for (let monthIndex = 1; monthIndex <= 12; monthIndex++) {
          const pillar = GanjiCycle.monthPillarBySajuMonthIndex(yearStem, monthIndex);

          // Verify branch
          expect(pillar.jiji).toBe(expectedBranches[monthIndex - 1]);

          // Verify stem advances correctly
          const expectedStemOrdinal = (startStemOrdinal + (monthIndex - 1)) % 10;
          expect(cheonganOrdinal(pillar.cheongan)).toBe(expectedStemOrdinal);
        }
      });
    }
  });

  describe('오호원 last month wraps correctly', () => {
    it('GAP year, month 12 -> JEONG CHUK', () => {
      const pillar = GanjiCycle.monthPillarBySajuMonthIndex(Cheongan.GAP, 12);
      expect(pillar.cheongan).toBe(Cheongan.JEONG);
      expect(pillar.jiji).toBe(Jiji.CHUK);
    });

    it('MU year, month 12 -> EUL CHUK', () => {
      const pillar = GanjiCycle.monthPillarBySajuMonthIndex(Cheongan.MU, 12);
      expect(pillar.cheongan).toBe(Cheongan.EUL);
      expect(pillar.jiji).toBe(Jiji.CHUK);
    });
  });

  // =========================================================================
  // 오자원 (五子遁) -- Day Stem -> Hour Stem at 자시(子時)
  // =========================================================================

  describe('오자원 5-pair mapping', () => {
    it('갑(甲)/기(己) day -> 갑자시(甲子時)', () => {
      const expected = new Pillar(Cheongan.GAP, Jiji.JA);
      expect(GanjiCycle.hourPillar(Cheongan.GAP, 0)).toEqual(expected);
      expect(GanjiCycle.hourPillar(Cheongan.GI, 0)).toEqual(expected);
    });

    it('을(乙)/경(庚) day -> 병자시(丙子時)', () => {
      const expected = new Pillar(Cheongan.BYEONG, Jiji.JA);
      expect(GanjiCycle.hourPillar(Cheongan.EUL, 0)).toEqual(expected);
      expect(GanjiCycle.hourPillar(Cheongan.GYEONG, 0)).toEqual(expected);
    });

    it('병(丙)/신(辛) day -> 무자시(戊子時)', () => {
      const expected = new Pillar(Cheongan.MU, Jiji.JA);
      expect(GanjiCycle.hourPillar(Cheongan.BYEONG, 0)).toEqual(expected);
      expect(GanjiCycle.hourPillar(Cheongan.SIN, 0)).toEqual(expected);
    });

    it('정(丁)/임(壬) day -> 경자시(庚子時)', () => {
      const expected = new Pillar(Cheongan.GYEONG, Jiji.JA);
      expect(GanjiCycle.hourPillar(Cheongan.JEONG, 0)).toEqual(expected);
      expect(GanjiCycle.hourPillar(Cheongan.IM, 0)).toEqual(expected);
    });

    it('무(戊)/계(癸) day -> 임자시(壬子時)', () => {
      const expected = new Pillar(Cheongan.IM, Jiji.JA);
      expect(GanjiCycle.hourPillar(Cheongan.MU, 0)).toEqual(expected);
      expect(GanjiCycle.hourPillar(Cheongan.GYE, 0)).toEqual(expected);
    });
  });

  describe('오자원 exhaustive 10 stems -> JA hour stem', () => {
    const expectedStems: Record<Cheongan, Cheongan> = {
      [Cheongan.GAP]: Cheongan.GAP,
      [Cheongan.EUL]: Cheongan.BYEONG,
      [Cheongan.BYEONG]: Cheongan.MU,
      [Cheongan.JEONG]: Cheongan.GYEONG,
      [Cheongan.MU]: Cheongan.IM,
      [Cheongan.GI]: Cheongan.GAP,
      [Cheongan.GYEONG]: Cheongan.BYEONG,
      [Cheongan.SIN]: Cheongan.MU,
      [Cheongan.IM]: Cheongan.GYEONG,
      [Cheongan.GYE]: Cheongan.IM,
    };

    for (const dayStem of CHEONGAN_VALUES) {
      it(`day stem ${CHEONGAN_INFO[dayStem].hangul}(${CHEONGAN_INFO[dayStem].hanja}) -> JA hour stem ${CHEONGAN_INFO[expectedStems[dayStem]].hangul}`, () => {
        const pillar = GanjiCycle.hourPillar(dayStem, 0);
        expect(pillar.cheongan).toBe(expectedStems[dayStem]);
        expect(pillar.jiji).toBe(Jiji.JA);
      });
    }
  });

  describe('오자원 full 12-hour cycle for each day stem', () => {
    const expectedBranches = [
      Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO, Jiji.JIN, Jiji.SA,
      Jiji.O, Jiji.MI, Jiji.SIN, Jiji.YU, Jiji.SUL, Jiji.HAE,
    ];
    const testHours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

    for (const dayStem of CHEONGAN_VALUES) {
      it(`day stem ${CHEONGAN_INFO[dayStem].hangul}: 12-hour branch/stem cycle`, () => {
        const firstPillar = GanjiCycle.hourPillar(dayStem, 0);
        const startStemOrdinal = cheonganOrdinal(firstPillar.cheongan);

        for (let branchIdx = 0; branchIdx < testHours.length; branchIdx++) {
          const hour24 = testHours[branchIdx]!;
          const pillar = GanjiCycle.hourPillar(dayStem, hour24);

          // Verify branch
          expect(pillar.jiji).toBe(expectedBranches[branchIdx]);

          // Verify stem advances correctly
          const expectedStemOrdinal = (startStemOrdinal + branchIdx) % 10;
          expect(cheonganOrdinal(pillar.cheongan)).toBe(expectedStemOrdinal);
        }
      });
    }
  });

  describe('오자원 last hour wraps correctly', () => {
    it('GAP day, hour 22 -> EUL HAE', () => {
      const pillar = GanjiCycle.hourPillar(Cheongan.GAP, 22);
      expect(pillar.cheongan).toBe(Cheongan.EUL);
      expect(pillar.jiji).toBe(Jiji.HAE);
    });

    it('MU day, hour 22 -> GYE HAE', () => {
      const pillar = GanjiCycle.hourPillar(Cheongan.MU, 22);
      expect(pillar.cheongan).toBe(Cheongan.GYE);
      expect(pillar.jiji).toBe(Jiji.HAE);
    });
  });

  describe('오자원 odd hours match even hours within same period', () => {
    it('each odd+even hour pair within the same branch produces the same pillar', () => {
      const pairsInSamePeriod: Array<[number, number]> = [
        [1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12],
        [13, 14], [15, 16], [17, 18], [19, 20], [21, 22],
      ];

      for (const dayStem of CHEONGAN_VALUES) {
        for (const [h1, h2] of pairsInSamePeriod) {
          const p1 = GanjiCycle.hourPillar(dayStem, h1);
          const p2 = GanjiCycle.hourPillar(dayStem, h2);
          expect(p1).toEqual(p2);
        }
      }
    });
  });

  // =========================================================================
  // Mathematical invariants
  // =========================================================================

  describe('mathematical invariants', () => {
    it('오호원 starting stems follow +2 mathematical pattern', () => {
      const startingStems = CHEONGAN_VALUES.map(yearStem =>
        GanjiCycle.monthPillarBySajuMonthIndex(yearStem, 1).cheongan,
      );

      const expectedPattern = [
        Cheongan.BYEONG, Cheongan.MU, Cheongan.GYEONG, Cheongan.IM, Cheongan.GAP,
        Cheongan.BYEONG, Cheongan.MU, Cheongan.GYEONG, Cheongan.IM, Cheongan.GAP,
      ];
      expect(startingStems).toEqual(expectedPattern);

      // Verify the +2 increment mathematically
      for (let i = 0; i < 9; i++) {
        const diff = (cheonganOrdinal(startingStems[i + 1]!) - cheonganOrdinal(startingStems[i]!) + 10) % 10;
        expect(diff).toBe(2);
      }
    });

    it('오자원 starting stems follow +2 mathematical pattern', () => {
      const startingStems = CHEONGAN_VALUES.map(dayStem =>
        GanjiCycle.hourPillar(dayStem, 0).cheongan,
      );

      const expectedPattern = [
        Cheongan.GAP, Cheongan.BYEONG, Cheongan.MU, Cheongan.GYEONG, Cheongan.IM,
        Cheongan.GAP, Cheongan.BYEONG, Cheongan.MU, Cheongan.GYEONG, Cheongan.IM,
      ];
      expect(startingStems).toEqual(expectedPattern);

      // Verify the +2 increment
      for (let i = 0; i < 9; i++) {
        const diff = (cheonganOrdinal(startingStems[i + 1]!) - cheonganOrdinal(startingStems[i]!) + 10) % 10;
        expect(diff).toBe(2);
      }
    });

    it('오호원 is 오자원 shifted by two', () => {
      for (const stem of CHEONGAN_VALUES) {
        const hourStart = cheonganOrdinal(GanjiCycle.hourPillar(stem, 0).cheongan);
        const monthStart = cheonganOrdinal(
          GanjiCycle.monthPillarBySajuMonthIndex(stem, 1).cheongan,
        );
        const offset = (monthStart - hourStart + 10) % 10;
        expect(offset).toBe(2);
      }
    });
  });
});
