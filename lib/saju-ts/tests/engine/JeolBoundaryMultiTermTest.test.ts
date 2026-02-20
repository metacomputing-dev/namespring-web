import { describe, it, expect } from 'vitest';
import { JeolBoundaryTable, type JeolBoundary } from '../../src/calendar/solar/JeolBoundaryTable.js';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { Gender } from '../../src/domain/Gender.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';

/**
 * Ported from JeolBoundaryMultiTermTest.kt (A-04)
 *
 * Multi-term jeol boundary precision test.
 * Verifies month pillar transitions at +/-1 minute precision for 6 additional
 * solar terms beyond Ipchun/Gyeongchip. Each boundary is tested with three probes:
 *
 *   -1 min  => previous month pillar (branch AND stem)
 *    0 min  => previous month pillar (strictly-after rule)
 *   +1 min  => current month pillar (branch AND stem)
 *
 * Configuration: longitude=135.0 to eliminate LMT noise, DST disabled, EoT off.
 *
 * 2024 reference data (year stem = GAP, saju year after ipchun):
 *   Sohan   2024-01-06 05:49 KST  monthIndex=12  CHUK
 *   Ipha    2024-05-05 09:10 KST  monthIndex=4   SA
 *   Soseo   2024-07-06 23:20 KST  monthIndex=6   MI
 *   Ipchu   2024-08-07 09:09 KST  monthIndex=7   SIN
 *   Hanro   2024-10-08 04:00 KST  monthIndex=9   SUL
 *   Ipdong  2024-11-07 07:20 KST  monthIndex=10  HAE
 *
 * 1990 reference (year stem = GYEONG):
 *   Ipchu   1990-08-08 03:45 KST  monthIndex=7   SIN
 */

const noLmtConfig = createConfig({
  dayCutMode: DayCutMode.MIDNIGHT_00,
  applyDstHistory: false,
  includeEquationOfTime: false,
  lmtBaselineLongitude: 135.0,
});

function calc(year: number, month: number, day: number, hour: number, minute: number) {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender: Gender.MALE,
    longitude: 135.0, latitude: 37.5665,
  });
  return calculatePillars(input, noLmtConfig);
}

// =========================================================================
// 1. Ipha (Start of Summer) -- 2024-05-05 09:10 KST
//    Transitions monthIndex 3 (JIN/MU) -> 4 (SA/GI)
// =========================================================================

describe('JeolBoundaryMultiTermTest', () => {
  describe('Ipha 2024', () => {
    it('table contains expected boundary time', () => {
      const boundaries = JeolBoundaryTable.boundariesForYear(2024)!;
      const ipha = boundaries.get(4)!;
      expect(ipha.year).toBe(2024);
      expect(ipha.month).toBe(5);
      expect(ipha.day).toBe(5);
      expect(ipha.hour).toBe(9);
      expect(ipha.minute).toBe(10);
      expect(ipha.branch).toBe(Jiji.SA);
    });

    it('minus 1 minute yields previous month pillar JIN-MU', () => {
      const result = calc(2024, 5, 5, 9, 9);
      expect(result.pillars.month.jiji).toBe(Jiji.JIN);
      expect(result.pillars.month.cheongan).toBe(Cheongan.MU);
    });

    it('exact instant belongs to previous month by strictly-after rule', () => {
      const result = calc(2024, 5, 5, 9, 10);
      expect(result.pillars.month.jiji).toBe(Jiji.JIN);
      expect(result.pillars.month.cheongan).toBe(Cheongan.MU);
    });

    it('plus 1 minute yields current month pillar SA-GI', () => {
      const result = calc(2024, 5, 5, 9, 11);
      expect(result.pillars.month.jiji).toBe(Jiji.SA);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GI);
    });

    it('does not change year pillar', () => {
      const before = calc(2024, 5, 5, 9, 9);
      const after = calc(2024, 5, 5, 9, 11);
      expect(before.pillars.year.cheongan).toBe(after.pillars.year.cheongan);
      expect(before.pillars.year.jiji).toBe(after.pillars.year.jiji);
      expect(before.pillars.year.cheongan).toBe(Cheongan.GAP);
      expect(before.pillars.year.jiji).toBe(Jiji.JIN);
    });
  });

  // =========================================================================
  // 2. Soseo (Minor Heat) -- 2024-07-06 23:20 KST
  //    Transitions monthIndex 5 (O/GYEONG) -> 6 (MI/SIN)
  // =========================================================================

  describe('Soseo 2024', () => {
    it('table contains expected boundary time', () => {
      const boundaries = JeolBoundaryTable.boundariesForYear(2024)!;
      const soseo = boundaries.get(6)!;
      expect(soseo.year).toBe(2024);
      expect(soseo.month).toBe(7);
      expect(soseo.day).toBe(6);
      expect(soseo.hour).toBe(23);
      expect(soseo.minute).toBe(20);
      expect(soseo.branch).toBe(Jiji.MI);
    });

    it('minus 1 minute yields previous month pillar O-GYEONG', () => {
      const result = calc(2024, 7, 6, 23, 19);
      expect(result.pillars.month.jiji).toBe(Jiji.O);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GYEONG);
    });

    it('exact instant belongs to previous month by strictly-after rule', () => {
      const result = calc(2024, 7, 6, 23, 20);
      expect(result.pillars.month.jiji).toBe(Jiji.O);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GYEONG);
    });

    it('plus 1 minute yields current month pillar MI-SIN', () => {
      const result = calc(2024, 7, 6, 23, 21);
      expect(result.pillars.month.jiji).toBe(Jiji.MI);
      expect(result.pillars.month.cheongan).toBe(Cheongan.SIN);
    });

    it('does not change year pillar', () => {
      const before = calc(2024, 7, 6, 23, 19);
      const after = calc(2024, 7, 6, 23, 21);
      expect(before.pillars.year.cheongan).toBe(after.pillars.year.cheongan);
      expect(before.pillars.year.jiji).toBe(after.pillars.year.jiji);
      expect(before.pillars.year.cheongan).toBe(Cheongan.GAP);
      expect(before.pillars.year.jiji).toBe(Jiji.JIN);
    });
  });

  // =========================================================================
  // 3. Ipchu (Start of Autumn) -- 2024-08-07 09:09 KST
  //    Transitions monthIndex 6 (MI/SIN) -> 7 (SIN/IM)
  // =========================================================================

  describe('Ipchu 2024', () => {
    it('table contains expected boundary time', () => {
      const boundaries = JeolBoundaryTable.boundariesForYear(2024)!;
      const ipchu = boundaries.get(7)!;
      expect(ipchu.year).toBe(2024);
      expect(ipchu.month).toBe(8);
      expect(ipchu.day).toBe(7);
      expect(ipchu.hour).toBe(9);
      expect(ipchu.minute).toBe(9);
      expect(ipchu.branch).toBe(Jiji.SIN);
    });

    it('minus 1 minute yields previous month pillar MI-SIN', () => {
      const result = calc(2024, 8, 7, 9, 8);
      expect(result.pillars.month.jiji).toBe(Jiji.MI);
      expect(result.pillars.month.cheongan).toBe(Cheongan.SIN);
    });

    it('exact instant belongs to previous month by strictly-after rule', () => {
      const result = calc(2024, 8, 7, 9, 9);
      expect(result.pillars.month.jiji).toBe(Jiji.MI);
      expect(result.pillars.month.cheongan).toBe(Cheongan.SIN);
    });

    it('plus 1 minute yields current month pillar SIN-IM', () => {
      const result = calc(2024, 8, 7, 9, 10);
      expect(result.pillars.month.jiji).toBe(Jiji.SIN);
      expect(result.pillars.month.cheongan).toBe(Cheongan.IM);
    });

    it('does not change year pillar', () => {
      const before = calc(2024, 8, 7, 9, 8);
      const after = calc(2024, 8, 7, 9, 10);
      expect(before.pillars.year.cheongan).toBe(after.pillars.year.cheongan);
      expect(before.pillars.year.jiji).toBe(after.pillars.year.jiji);
      expect(before.pillars.year.cheongan).toBe(Cheongan.GAP);
      expect(before.pillars.year.jiji).toBe(Jiji.JIN);
    });
  });

  // =========================================================================
  // 4. Hanro (Cold Dew) -- 2024-10-08 04:00 KST
  //    Transitions monthIndex 8 (YU/GYE) -> 9 (SUL/GAP)
  // =========================================================================

  describe('Hanro 2024', () => {
    it('table contains expected boundary time', () => {
      const boundaries = JeolBoundaryTable.boundariesForYear(2024)!;
      const hanro = boundaries.get(9)!;
      expect(hanro.year).toBe(2024);
      expect(hanro.month).toBe(10);
      expect(hanro.day).toBe(8);
      expect(hanro.hour).toBe(4);
      expect(hanro.minute).toBe(0);
      expect(hanro.branch).toBe(Jiji.SUL);
    });

    it('minus 1 minute yields previous month pillar YU-GYE', () => {
      const result = calc(2024, 10, 8, 3, 59);
      expect(result.pillars.month.jiji).toBe(Jiji.YU);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GYE);
    });

    it('exact instant belongs to previous month by strictly-after rule', () => {
      const result = calc(2024, 10, 8, 4, 0);
      expect(result.pillars.month.jiji).toBe(Jiji.YU);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GYE);
    });

    it('plus 1 minute yields current month pillar SUL-GAP', () => {
      const result = calc(2024, 10, 8, 4, 1);
      expect(result.pillars.month.jiji).toBe(Jiji.SUL);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GAP);
    });

    it('does not change year pillar', () => {
      const before = calc(2024, 10, 8, 3, 59);
      const after = calc(2024, 10, 8, 4, 1);
      expect(before.pillars.year.cheongan).toBe(after.pillars.year.cheongan);
      expect(before.pillars.year.jiji).toBe(after.pillars.year.jiji);
      expect(before.pillars.year.cheongan).toBe(Cheongan.GAP);
      expect(before.pillars.year.jiji).toBe(Jiji.JIN);
    });
  });

  // =========================================================================
  // 5. Ipdong (Start of Winter) -- 2024-11-07 07:20 KST
  //    Transitions monthIndex 9 (SUL/GAP) -> 10 (HAE/EUL)
  // =========================================================================

  describe('Ipdong 2024', () => {
    it('table contains expected boundary time', () => {
      const boundaries = JeolBoundaryTable.boundariesForYear(2024)!;
      const ipdong = boundaries.get(10)!;
      expect(ipdong.year).toBe(2024);
      expect(ipdong.month).toBe(11);
      expect(ipdong.day).toBe(7);
      expect(ipdong.hour).toBe(7);
      expect(ipdong.minute).toBe(20);
      expect(ipdong.branch).toBe(Jiji.HAE);
    });

    it('minus 1 minute yields previous month pillar SUL-GAP', () => {
      const result = calc(2024, 11, 7, 7, 19);
      expect(result.pillars.month.jiji).toBe(Jiji.SUL);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GAP);
    });

    it('exact instant belongs to previous month by strictly-after rule', () => {
      const result = calc(2024, 11, 7, 7, 20);
      expect(result.pillars.month.jiji).toBe(Jiji.SUL);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GAP);
    });

    it('plus 1 minute yields current month pillar HAE-EUL', () => {
      const result = calc(2024, 11, 7, 7, 21);
      expect(result.pillars.month.jiji).toBe(Jiji.HAE);
      expect(result.pillars.month.cheongan).toBe(Cheongan.EUL);
    });

    it('does not change year pillar', () => {
      const before = calc(2024, 11, 7, 7, 19);
      const after = calc(2024, 11, 7, 7, 21);
      expect(before.pillars.year.cheongan).toBe(after.pillars.year.cheongan);
      expect(before.pillars.year.jiji).toBe(after.pillars.year.jiji);
      expect(before.pillars.year.cheongan).toBe(Cheongan.GAP);
      expect(before.pillars.year.jiji).toBe(Jiji.JIN);
    });
  });

  // =========================================================================
  // 6. Sohan (Minor Cold) -- 2024-01-06 05:49 KST
  //    Transitions monthIndex 11 (JA/GAP) -> 12 (CHUK/EUL)
  //    NOTE: Before Ipchun 2024, so saju year is 2023 = GYE-MYO.
  // =========================================================================

  describe('Sohan 2024', () => {
    it('table contains expected boundary time', () => {
      const boundaries = JeolBoundaryTable.boundariesForYear(2024)!;
      const sohan = boundaries.get(12)!;
      expect(sohan.year).toBe(2024);
      expect(sohan.month).toBe(1);
      expect(sohan.day).toBe(6);
      expect(sohan.hour).toBe(5);
      expect(sohan.minute).toBe(49);
      expect(sohan.branch).toBe(Jiji.CHUK);
    });

    it('minus 1 minute yields previous month pillar JA-GAP', () => {
      const result = calc(2024, 1, 6, 5, 48);
      expect(result.pillars.month.jiji).toBe(Jiji.JA);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GAP);
    });

    it('exact instant belongs to previous month by strictly-after rule', () => {
      const result = calc(2024, 1, 6, 5, 49);
      expect(result.pillars.month.jiji).toBe(Jiji.JA);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GAP);
    });

    it('plus 1 minute yields current month pillar CHUK-EUL', () => {
      const result = calc(2024, 1, 6, 5, 50);
      expect(result.pillars.month.jiji).toBe(Jiji.CHUK);
      expect(result.pillars.month.cheongan).toBe(Cheongan.EUL);
    });

    it('does not change year pillar -- stays in 2023 saju year', () => {
      const before = calc(2024, 1, 6, 5, 48);
      const after = calc(2024, 1, 6, 5, 50);
      expect(before.pillars.year.cheongan).toBe(after.pillars.year.cheongan);
      expect(before.pillars.year.jiji).toBe(after.pillars.year.jiji);
      // Both before ipchun 2024, so saju year is 2023 = GYE-MYO
      expect(before.pillars.year.cheongan).toBe(Cheongan.GYE);
      expect(before.pillars.year.jiji).toBe(Jiji.MYO);
    });
  });

  // =========================================================================
  // 7. Cross-year consistency: Ipchu 1990 -- 1990-08-08 03:45 KST
  //    Transitions monthIndex 6 (MI/GYE) -> 7 (SIN/GAP)
  //    Year 1990 = GYEONG-O
  // =========================================================================

  describe('Ipchu 1990 (cross-year)', () => {
    it('table contains expected boundary time', () => {
      const boundaries = JeolBoundaryTable.boundariesForYear(1990)!;
      const ipchu = boundaries.get(7)!;
      expect(ipchu.year).toBe(1990);
      expect(ipchu.month).toBe(8);
      expect(ipchu.day).toBe(8);
      expect(ipchu.hour).toBe(3);
      expect(ipchu.minute).toBe(45);
      expect(ipchu.branch).toBe(Jiji.SIN);
    });

    it('minus 1 minute yields previous month pillar MI-GYE', () => {
      const result = calc(1990, 8, 8, 3, 44);
      expect(result.pillars.month.jiji).toBe(Jiji.MI);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GYE);
    });

    it('exact instant belongs to previous month by strictly-after rule', () => {
      const result = calc(1990, 8, 8, 3, 45);
      expect(result.pillars.month.jiji).toBe(Jiji.MI);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GYE);
    });

    it('plus 1 minute yields current month pillar SIN-GAP', () => {
      const result = calc(1990, 8, 8, 3, 46);
      expect(result.pillars.month.jiji).toBe(Jiji.SIN);
      expect(result.pillars.month.cheongan).toBe(Cheongan.GAP);
    });

    it('does not change year pillar', () => {
      const before = calc(1990, 8, 8, 3, 44);
      const after = calc(1990, 8, 8, 3, 46);
      expect(before.pillars.year.cheongan).toBe(after.pillars.year.cheongan);
      expect(before.pillars.year.jiji).toBe(after.pillars.year.jiji);
      // 1990 saju year = GYEONG-O
      expect(before.pillars.year.cheongan).toBe(Cheongan.GYEONG);
      expect(before.pillars.year.jiji).toBe(Jiji.O);
    });
  });

  // =========================================================================
  // 8. Boundary table direct lookups
  // =========================================================================

  describe('JeolBoundaryTable sajuMonthIndexAt transitions at all 6 boundaries in 2024', () => {
    const specs = [
      { name: 'Ipha',   y: 2024, m: 5,  d: 5,  h: 9,  min: 10, indexBefore: 3,  indexAfter: 4 },
      { name: 'Soseo',  y: 2024, m: 7,  d: 6,  h: 23, min: 20, indexBefore: 5,  indexAfter: 6 },
      { name: 'Ipchu',  y: 2024, m: 8,  d: 7,  h: 9,  min: 9,  indexBefore: 6,  indexAfter: 7 },
      { name: 'Hanro',  y: 2024, m: 10, d: 8,  h: 4,  min: 0,  indexBefore: 8,  indexAfter: 9 },
      { name: 'Ipdong', y: 2024, m: 11, d: 7,  h: 7,  min: 20, indexBefore: 9,  indexAfter: 10 },
      { name: 'Sohan',  y: 2024, m: 1,  d: 6,  h: 5,  min: 49, indexBefore: 11, indexAfter: 12 },
    ];

    for (const spec of specs) {
      it(`${spec.name}: transitions from ${spec.indexBefore} to ${spec.indexAfter}`, () => {
        // -1 minute
        const before = JeolBoundaryTable.sajuMonthIndexAt(
          spec.y, spec.m, spec.d, spec.h, spec.min - 1 >= 0 ? spec.min - 1 : 59,
        );
        // Use full -1 minute calculation for hour rollback
        const beforeHour = spec.min > 0 ? spec.h : spec.h - 1;
        const beforeMin = spec.min > 0 ? spec.min - 1 : 59;
        const actualBefore = JeolBoundaryTable.sajuMonthIndexAt(
          spec.y, spec.m, spec.d, beforeHour, beforeMin,
        );

        // At boundary
        const atBoundary = JeolBoundaryTable.sajuMonthIndexAt(
          spec.y, spec.m, spec.d, spec.h, spec.min,
        );

        // +1 minute
        const afterMin = spec.min + 1;
        const afterHour = afterMin >= 60 ? spec.h + 1 : spec.h;
        const actualAfterMin = afterMin >= 60 ? 0 : afterMin;
        const after = JeolBoundaryTable.sajuMonthIndexAt(
          spec.y, spec.m, spec.d, afterHour, actualAfterMin,
        );

        expect(actualBefore).toBe(spec.indexBefore);
        expect(atBoundary).toBe(spec.indexBefore); // strictly-after
        expect(after).toBe(spec.indexAfter);
      });
    }
  });
});
