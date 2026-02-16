import { describe, it, expect } from 'vitest';
import { calculatePillars, SajuPillarResult } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { configFromPreset, SchoolPreset } from '../../src/config/CalculationConfig.js';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { Cheongan, CHEONGAN_VALUES, cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, jijiOrdinal } from '../../src/domain/Jiji.js';
import { Pillar } from '../../src/domain/Pillar.js';
import { JeolBoundaryTable } from '../../src/calendar/solar/JeolBoundaryTable.js';

/**
 * C-01 + C-02: Year pillar and month pillar precision verification.
 *
 * Section 1 (C-01): Ipchun Year+Month Pillar Interaction
 * At ipchun, both year and month pillar transition simultaneously.
 * Before ipchun: year=previous year, month=chuk(12).
 * After ipchun: year=current year, month=in(1).
 *
 * Section 2 (C-02): Year Pillar Sexagenary Cycle Exhaustive
 * The year pillar follows the sexagenary cycle: ((year-4) % 60 + 60) % 60
 */

const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

function seoulBirth(year: number, month: number, day: number, hour: number, minute: number): SajuPillarResult {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender: Gender.MALE,
    latitude: 37.5665,
    longitude: 126.978,
  });
  return calculatePillars(input, config);
}

/** Independent sexagenary index computation: ((year - 4) % 60 + 60) % 60 */
function expectedSexagenaryIndex(year: number): number {
  return ((year - 4) % 60 + 60) % 60;
}

/**
 * Oho-won (Five Tiger Origin) rule: year stem -> starting month stem for In month.
 */
function ohoWonStartStem(yearStem: Cheongan): Cheongan {
  switch (yearStem) {
    case Cheongan.GAP: case Cheongan.GI: return Cheongan.BYEONG;
    case Cheongan.EUL: case Cheongan.GYEONG: return Cheongan.MU;
    case Cheongan.BYEONG: case Cheongan.SIN: return Cheongan.GYEONG;
    case Cheongan.JEONG: case Cheongan.IM: return Cheongan.IM;
    case Cheongan.MU: case Cheongan.GYE: return Cheongan.GAP;
  }
}

/** Saju month index (1..12) -> earthly branch */
function monthBranch(monthIndex: number): Jiji {
  const branches: Record<number, Jiji> = {
    1: Jiji.IN, 2: Jiji.MYO, 3: Jiji.JIN, 4: Jiji.SA,
    5: Jiji.O, 6: Jiji.MI, 7: Jiji.SIN, 8: Jiji.YU,
    9: Jiji.SUL, 10: Jiji.HAE, 11: Jiji.JA, 12: Jiji.CHUK,
  };
  return branches[monthIndex] ?? Jiji.CHUK;
}

/** Expected month stem for a given year stem and month index. */
function expectedMonthStem(yearStem: Cheongan, monthIndex: number): Cheongan {
  const start = ohoWonStartStem(yearStem);
  return CHEONGAN_VALUES[(cheonganOrdinal(start) + (monthIndex - 1)) % 10]!;
}

describe('YearMonthPillarPrecision', () => {

  // =========================================================================
  // Section 1 (C-01): Ipchun Year+Month Pillar Boundary
  // =========================================================================

  describe('C-01: Ipchun Year+Month Pillar Boundary', () => {
    const ipchunSampleYears = [
      1900, 1910, 1920, 1930, 1940, 1950,
      1960, 1970, 1980, 1990, 2000, 2010,
      2020, 2030, 2040, 2050,
    ];

    it.each(ipchunSampleYears)(
      'year %i: 1 minute BEFORE ipchun yields previous year pillar + CHUK month',
      (year) => {
        const ipchun = JeolBoundaryTable.ipchunOf(year);
        expect(ipchun).toBeDefined();

        // 1 minute before ipchun
        const beforeDate = new Date(Date.UTC(
          ipchun!.year, ipchun!.month - 1, ipchun!.day, ipchun!.hour, ipchun!.minute - 1,
        ));
        const result = seoulBirth(
          beforeDate.getUTCFullYear(), beforeDate.getUTCMonth() + 1,
          beforeDate.getUTCDate(), beforeDate.getUTCHours(), beforeDate.getUTCMinutes(),
        );

        // Year pillar should be for (year - 1)
        const prevYearIndex = expectedSexagenaryIndex(year - 1);
        const expectedYearPillar = GanjiCycle.fromSexagenaryIndex(prevYearIndex);
        expect(result.pillars.year.cheongan).toBe(expectedYearPillar.cheongan);
        expect(result.pillars.year.jiji).toBe(expectedYearPillar.jiji);

        // Month should be CHUK (index 12)
        expect(result.pillars.month.jiji).toBe(Jiji.CHUK);
      },
    );

    it.each(ipchunSampleYears)(
      'year %i: 1 minute AFTER ipchun yields current year pillar + IN month',
      (year) => {
        const ipchun = JeolBoundaryTable.ipchunOf(year);
        expect(ipchun).toBeDefined();

        // 1 minute after ipchun
        const afterDate = new Date(Date.UTC(
          ipchun!.year, ipchun!.month - 1, ipchun!.day, ipchun!.hour, ipchun!.minute + 1,
        ));
        const result = seoulBirth(
          afterDate.getUTCFullYear(), afterDate.getUTCMonth() + 1,
          afterDate.getUTCDate(), afterDate.getUTCHours(), afterDate.getUTCMinutes(),
        );

        // Year pillar should be for current year
        const currentYearIndex = expectedSexagenaryIndex(year);
        const expectedYearPillar = GanjiCycle.fromSexagenaryIndex(currentYearIndex);
        expect(result.pillars.year.cheongan).toBe(expectedYearPillar.cheongan);
        expect(result.pillars.year.jiji).toBe(expectedYearPillar.jiji);

        // Month should be IN (index 1)
        expect(result.pillars.month.jiji).toBe(Jiji.IN);
      },
    );

    it('year stem advances by exactly 1 between consecutive years', () => {
      const stems = Array.from({ length: 10 }, (_, i) => {
        const year = 2020 + i;
        const index = expectedSexagenaryIndex(year);
        return GanjiCycle.fromSexagenaryIndex(index).cheongan;
      });

      for (let i = 0; i < stems.length - 1; i++) {
        const expectedNext = CHEONGAN_VALUES[(cheonganOrdinal(stems[i]!) + 1) % 10]!;
        expect(stems[i + 1]).toBe(expectedNext);
      }
    });

    it('year branch advances by exactly 1 between consecutive years', () => {
      const branches = Array.from({ length: 12 }, (_, i) => {
        const year = 2020 + i;
        const index = expectedSexagenaryIndex(year);
        return GanjiCycle.fromSexagenaryIndex(index).jiji;
      });

      for (let i = 0; i < branches.length - 1; i++) {
        const expectedNext = JIJI_VALUES[(jijiOrdinal(branches[i]!) + 1) % 12]!;
        expect(branches[i + 1]).toBe(expectedNext);
      }
    });

    it('ipchun simultaneously transitions BOTH year AND month pillar', () => {
      const year = 2024;
      const ipchun = JeolBoundaryTable.ipchunOf(year);
      expect(ipchun).toBeDefined();

      const beforeDate = new Date(Date.UTC(ipchun!.year, ipchun!.month - 1, ipchun!.day, ipchun!.hour, ipchun!.minute - 1));
      const afterDate = new Date(Date.UTC(ipchun!.year, ipchun!.month - 1, ipchun!.day, ipchun!.hour, ipchun!.minute + 1));

      const before = seoulBirth(
        beforeDate.getUTCFullYear(), beforeDate.getUTCMonth() + 1,
        beforeDate.getUTCDate(), beforeDate.getUTCHours(), beforeDate.getUTCMinutes(),
      );
      const after = seoulBirth(
        afterDate.getUTCFullYear(), afterDate.getUTCMonth() + 1,
        afterDate.getUTCDate(), afterDate.getUTCHours(), afterDate.getUTCMinutes(),
      );

      // Both pillars must change
      expect(before.pillars.year.equals(after.pillars.year)).toBe(false);
      expect(before.pillars.month.equals(after.pillars.month)).toBe(false);

      // Verify specific transitions
      expect(before.pillars.month.jiji).toBe(Jiji.CHUK);
      expect(after.pillars.month.jiji).toBe(Jiji.IN);
    });

    it('oho-won rule: month stem derives from year stem group after ipchun', () => {
      const groupRepresentatives: [number, Cheongan][] = [
        [2024, Cheongan.GAP],
        [2025, Cheongan.EUL],
        [2026, Cheongan.BYEONG],
        [2027, Cheongan.JEONG],
        [2028, Cheongan.MU],
      ];

      for (const [year, expectedYearStem] of groupRepresentatives) {
        const ipchun = JeolBoundaryTable.ipchunOf(year);
        expect(ipchun).toBeDefined();

        const afterDate = new Date(Date.UTC(ipchun!.year, ipchun!.month - 1, ipchun!.day, ipchun!.hour, ipchun!.minute + 1));
        const result = seoulBirth(
          afterDate.getUTCFullYear(), afterDate.getUTCMonth() + 1,
          afterDate.getUTCDate(), afterDate.getUTCHours(), afterDate.getUTCMinutes(),
        );

        expect(result.pillars.year.cheongan).toBe(expectedYearStem);

        const ohoMonthStem = ohoWonStartStem(expectedYearStem);
        expect(result.pillars.month.cheongan).toBe(ohoMonthStem);
      }
    });

    it('oho-won verified for all 10 year stems (2024-2033)', () => {
      for (let year = 2024; year <= 2033; year++) {
        const ipchun = JeolBoundaryTable.ipchunOf(year);
        expect(ipchun).toBeDefined();

        const afterDate = new Date(Date.UTC(ipchun!.year, ipchun!.month - 1, ipchun!.day, ipchun!.hour, ipchun!.minute + 1));
        const result = seoulBirth(
          afterDate.getUTCFullYear(), afterDate.getUTCMonth() + 1,
          afterDate.getUTCDate(), afterDate.getUTCHours(), afterDate.getUTCMinutes(),
        );

        const yearStem = result.pillars.year.cheongan;
        const expectedStart = ohoWonStartStem(yearStem);
        expect(result.pillars.month.cheongan).toBe(expectedStart);
        expect(result.pillars.month.jiji).toBe(Jiji.IN);
      }
    });

    it('before ipchun 2025: month stem derives from PREVIOUS year stem group', () => {
      const year = 2025;
      const ipchun = JeolBoundaryTable.ipchunOf(year);
      expect(ipchun).toBeDefined();

      const beforeDate = new Date(Date.UTC(ipchun!.year, ipchun!.month - 1, ipchun!.day, ipchun!.hour, ipchun!.minute - 1));
      const result = seoulBirth(
        beforeDate.getUTCFullYear(), beforeDate.getUTCMonth() + 1,
        beforeDate.getUTCDate(), beforeDate.getUTCHours(), beforeDate.getUTCMinutes(),
      );

      // Year should still be 2024's pillar (GAP)
      expect(result.pillars.year.cheongan).toBe(Cheongan.GAP);

      // Month branch should be CHUK (index 12)
      expect(result.pillars.month.jiji).toBe(Jiji.CHUK);

      // Month stem should derive from previous year's stem (GAP group) at month index 12
      const expectedStem = expectedMonthStem(Cheongan.GAP, 12);
      expect(result.pillars.month.cheongan).toBe(expectedStem);
    });
  });

  // =========================================================================
  // Section 2 (C-02): Year Pillar Sexagenary Cycle Exhaustive
  // =========================================================================

  describe('C-02: Year Pillar Sexagenary Cycle', () => {
    // Test every year from 1900 to 2050 at mid-year
    it.each(Array.from({ length: 151 }, (_, i) => 1900 + i))(
      'year %i: year pillar matches sexagenary index',
      (year) => {
        const result = seoulBirth(year, 7, 15, 12, 0);
        const expectedIndex = expectedSexagenaryIndex(year);
        const expectedPillar = GanjiCycle.fromSexagenaryIndex(expectedIndex);

        expect(result.pillars.year.cheongan).toBe(expectedPillar.cheongan);
        expect(result.pillars.year.jiji).toBe(expectedPillar.jiji);
      },
    );

    it('60-year cycle closure: year Y and year Y+60 have identical year pillar', () => {
      const anchorYears = [1900, 1924, 1950, 1984, 2000];
      for (const baseYear of anchorYears) {
        const cycleYear = baseYear + 60;
        if (cycleYear > 2050) continue;

        const basePillar = seoulBirth(baseYear, 7, 15, 12, 0).pillars.year;
        const cyclePillar = seoulBirth(cycleYear, 7, 15, 12, 0).pillars.year;

        expect(basePillar.cheongan).toBe(cyclePillar.cheongan);
        expect(basePillar.jiji).toBe(cyclePillar.jiji);
      }
    });

    it('consecutive years have adjacent sexagenary indices', () => {
      for (let year = 2000; year <= 2019; year++) {
        const indexCurrent = expectedSexagenaryIndex(year);
        const indexNext = expectedSexagenaryIndex(year + 1);
        expect((indexCurrent + 1) % 60).toBe(indexNext);
      }
    });

    it('1984 is GAP-JA and 2044 is GAP-JA (well-known anchors)', () => {
      const pillar1984 = seoulBirth(1984, 7, 15, 12, 0).pillars.year;
      expect(pillar1984.cheongan).toBe(Cheongan.GAP);
      expect(pillar1984.jiji).toBe(Jiji.JA);

      const pillar2044 = seoulBirth(2044, 7, 15, 12, 0).pillars.year;
      expect(pillar2044.cheongan).toBe(Cheongan.GAP);
      expect(pillar2044.jiji).toBe(Jiji.JA);
    });

    it('stem and branch cycle lengths produce exactly 60 unique pillars', () => {
      const allPillars = new Set(
        Array.from({ length: 60 }, (_, i) => {
          const p = GanjiCycle.fromSexagenaryIndex(i);
          return `${p.cheongan}-${p.jiji}`;
        }),
      );
      expect(allPillars.size).toBe(60);
    });

    it('well-known historical year-pillar anchors (JA branch years)', () => {
      const anchors: [number, Cheongan, Jiji][] = [
        [1900, Cheongan.GYEONG, Jiji.JA],
        [1912, Cheongan.IM, Jiji.JA],
        [1924, Cheongan.GAP, Jiji.JA],
        [1936, Cheongan.BYEONG, Jiji.JA],
        [1948, Cheongan.MU, Jiji.JA],
        [1960, Cheongan.GYEONG, Jiji.JA],
        [1972, Cheongan.IM, Jiji.JA],
        [1984, Cheongan.GAP, Jiji.JA],
        [1996, Cheongan.BYEONG, Jiji.JA],
        [2008, Cheongan.MU, Jiji.JA],
        [2020, Cheongan.GYEONG, Jiji.JA],
      ];

      for (const [year, expectedStem, expectedBranch] of anchors) {
        const result = seoulBirth(year, 7, 15, 12, 0);
        expect(result.pillars.year.cheongan).toBe(expectedStem);
        expect(result.pillars.year.jiji).toBe(expectedBranch);
      }
    });

    it('JA branch appears every 12 years', () => {
      const jaYears = Array.from({ length: 151 }, (_, i) => 1900 + i)
        .filter(y => (y - 4) % 12 === 0);

      for (const year of jaYears) {
        const result = seoulBirth(year, 7, 15, 12, 0);
        expect(result.pillars.year.jiji).toBe(Jiji.JA);
      }
    });
  });

  // =========================================================================
  // Section 3 (C-03): Oho-Won Month Stem Cross-Validation
  // =========================================================================

  describe('C-03: Oho-Won Month Stem Cross-Validation', () => {
    it('all 5 stem groups produce correct In month stem', () => {
      const groupExpectations: [number, Cheongan, Cheongan][] = [
        [2024, Cheongan.GAP, Cheongan.BYEONG],
        [2025, Cheongan.EUL, Cheongan.MU],
        [2026, Cheongan.BYEONG, Cheongan.GYEONG],
        [2027, Cheongan.JEONG, Cheongan.IM],
        [2028, Cheongan.MU, Cheongan.GAP],
      ];

      for (const [year, expectedYearStem, expectedMonthStem] of groupExpectations) {
        const ipchun = JeolBoundaryTable.ipchunOf(year);
        expect(ipchun).toBeDefined();

        const afterDate = new Date(Date.UTC(ipchun!.year, ipchun!.month - 1, ipchun!.day, ipchun!.hour, ipchun!.minute + 1));
        const result = seoulBirth(
          afterDate.getUTCFullYear(), afterDate.getUTCMonth() + 1,
          afterDate.getUTCDate(), afterDate.getUTCHours(), afterDate.getUTCMinutes(),
        );

        expect(result.pillars.year.cheongan).toBe(expectedYearStem);
        expect(result.pillars.month.cheongan).toBe(expectedMonthStem);
        expect(result.pillars.month.jiji).toBe(Jiji.IN);
      }
    });

    it.each([
      [2024, 2029, Cheongan.BYEONG, 'GAP-GI'],
      [2025, 2030, Cheongan.MU, 'EUL-GYEONG'],
      [2026, 2031, Cheongan.GYEONG, 'BYEONG-SIN'],
      [2027, 2032, Cheongan.IM, 'JEONG-IM'],
      [2028, 2033, Cheongan.GAP, 'MU-GYE'],
    ] as [number, number, Cheongan, string][])(
      'partner years %i and %i produce identical In month stem (%s pair)',
      (year1, year2, expectedStem) => {
        const ipchun1 = JeolBoundaryTable.ipchunOf(year1);
        const ipchun2 = JeolBoundaryTable.ipchunOf(year2);
        expect(ipchun1).toBeDefined();
        expect(ipchun2).toBeDefined();

        const afterDate1 = new Date(Date.UTC(ipchun1!.year, ipchun1!.month - 1, ipchun1!.day, ipchun1!.hour, ipchun1!.minute + 1));
        const afterDate2 = new Date(Date.UTC(ipchun2!.year, ipchun2!.month - 1, ipchun2!.day, ipchun2!.hour, ipchun2!.minute + 1));

        const month1 = seoulBirth(
          afterDate1.getUTCFullYear(), afterDate1.getUTCMonth() + 1,
          afterDate1.getUTCDate(), afterDate1.getUTCHours(), afterDate1.getUTCMinutes(),
        ).pillars.month.cheongan;

        const month2 = seoulBirth(
          afterDate2.getUTCFullYear(), afterDate2.getUTCMonth() + 1,
          afterDate2.getUTCDate(), afterDate2.getUTCHours(), afterDate2.getUTCMinutes(),
        ).pillars.month.cheongan;

        expect(month1).toBe(month2);
        expect(month1).toBe(expectedStem);
      },
    );

    it('month stem advances by 1 for each successive saju month in 2024', () => {
      const boundaries = JeolBoundaryTable.boundariesForYear(2024);
      expect(boundaries).toBeDefined();

      const ipchun2024 = JeolBoundaryTable.ipchunOf(2024)!;
      const ipchunKey = ipchun2024.year * 100_000_000 + ipchun2024.month * 1_000_000 +
        ipchun2024.day * 10_000 + ipchun2024.hour * 100 + ipchun2024.minute;

      const yearStem2024 = Cheongan.GAP;
      const yearStem2023 = Cheongan.GYE;

      for (let monthIndex = 1; monthIndex <= 12; monthIndex++) {
        const boundary = boundaries!.get(monthIndex);
        expect(boundary, `boundary for month index ${monthIndex}`).toBeDefined();

        // Determine which saju year governs this boundary
        const boundaryKey = boundary!.year * 100_000_000 + boundary!.month * 1_000_000 +
          boundary!.day * 10_000 + boundary!.hour * 100 + boundary!.minute;
        const effectiveYearStem = boundaryKey < ipchunKey ? yearStem2023 : yearStem2024;

        const expectedStem = expectedMonthStem(effectiveYearStem, monthIndex);
        const expectedBr = monthBranch(monthIndex);

        // 1 minute after the boundary
        const afterDate = new Date(Date.UTC(
          boundary!.year, boundary!.month - 1, boundary!.day,
          boundary!.hour, boundary!.minute + 1,
        ));
        const result = seoulBirth(
          afterDate.getUTCFullYear(), afterDate.getUTCMonth() + 1,
          afterDate.getUTCDate(), afterDate.getUTCHours(), afterDate.getUTCMinutes(),
        );

        expect(result.pillars.month.jiji).toBe(expectedBr);
        expect(result.pillars.month.cheongan).toBe(expectedStem);
      }
    });

    it('12-month cycle yields 12 distinct month pillars within 2024', () => {
      const boundaries = JeolBoundaryTable.boundariesForYear(2024);
      expect(boundaries).toBeDefined();

      const pillarSet = new Set<string>();
      for (let monthIndex = 1; monthIndex <= 12; monthIndex++) {
        const boundary = boundaries!.get(monthIndex)!;
        const afterDate = new Date(Date.UTC(
          boundary.year, boundary.month - 1, boundary.day,
          boundary.hour, boundary.minute + 1,
        ));
        const result = seoulBirth(
          afterDate.getUTCFullYear(), afterDate.getUTCMonth() + 1,
          afterDate.getUTCDate(), afterDate.getUTCHours(), afterDate.getUTCMinutes(),
        );
        pillarSet.add(`${result.pillars.month.cheongan}-${result.pillars.month.jiji}`);
      }

      expect(pillarSet.size).toBe(12);
    });
  });

  // =========================================================================
  // Section 4 (C-04): Mathematical Properties and Edge Cases
  // =========================================================================

  describe('C-04: Mathematical Properties and Edge Cases', () => {
    it('sexagenary index formula is consistent for negative offsets from base year', () => {
      const year1984 = expectedSexagenaryIndex(1984);
      expect(year1984).toBe(0);

      const year1900 = expectedSexagenaryIndex(1900);
      expect(year1900).toBe(36);

      // Verify pillar at index 36
      const pillar = GanjiCycle.fromSexagenaryIndex(36);
      expect(pillar.cheongan).toBe(Cheongan.GYEONG);
      expect(pillar.jiji).toBe(Jiji.JA);
    });

    it('January births before ipchun use previous year pillar', () => {
      const result = seoulBirth(2025, 1, 15, 12, 0);
      const expected2024 = GanjiCycle.fromSexagenaryIndex(expectedSexagenaryIndex(2024));
      expect(result.pillars.year.cheongan).toBe(expected2024.cheongan);
      expect(result.pillars.year.jiji).toBe(expected2024.jiji);
    });

    it('late February births after ipchun use current year pillar', () => {
      const result = seoulBirth(2025, 2, 28, 12, 0);
      const expected2025 = GanjiCycle.fromSexagenaryIndex(expectedSexagenaryIndex(2025));
      expect(result.pillars.year.cheongan).toBe(expected2025.cheongan);
      expect(result.pillars.year.jiji).toBe(expected2025.jiji);
    });

    it('December 31 birth uses current year pillar, not next year', () => {
      const result = seoulBirth(2024, 12, 31, 23, 0);
      const expected2024 = GanjiCycle.fromSexagenaryIndex(expectedSexagenaryIndex(2024));
      expect(result.pillars.year.cheongan).toBe(expected2024.cheongan);
      expect(result.pillars.year.jiji).toBe(expected2024.jiji);
    });

    it('ipchun exact boundary instant is treated as previous year', () => {
      const year = 2024;
      const ipchun = JeolBoundaryTable.ipchunOf(year);
      expect(ipchun).toBeDefined();

      const atBoundary = seoulBirth(ipchun!.year, ipchun!.month, ipchun!.day, ipchun!.hour, ipchun!.minute);
      const prev = GanjiCycle.fromSexagenaryIndex(expectedSexagenaryIndex(year - 1));

      expect(atBoundary.pillars.year.cheongan).toBe(prev.cheongan);
      expect(atBoundary.pillars.year.jiji).toBe(prev.jiji);
      expect(atBoundary.pillars.month.jiji).toBe(Jiji.CHUK);
    });

    it('year pillar stem determines 10-year stem cycle offset', () => {
      const stemOrdinals = Array.from({ length: 10 }, (_, i) =>
        cheonganOrdinal(seoulBirth(2020 + i, 7, 15, 12, 0).pillars.year.cheongan),
      );

      for (let i = 0; i < stemOrdinals.length - 1; i++) {
        expect((stemOrdinals[i]! + 1) % 10).toBe(stemOrdinals[i + 1]!);
      }
    });

    it('year pillar branch determines 12-year branch cycle offset', () => {
      const branchOrdinals = Array.from({ length: 12 }, (_, i) =>
        jijiOrdinal(seoulBirth(2020 + i, 7, 15, 12, 0).pillars.year.jiji),
      );

      for (let i = 0; i < branchOrdinals.length - 1; i++) {
        expect((branchOrdinals[i]! + 1) % 12).toBe(branchOrdinals[i + 1]!);
      }
    });

    it('full pipeline: year and month consistency for 2000-2010 March births', () => {
      for (let year = 2000; year <= 2010; year++) {
        const result = seoulBirth(year, 3, 1, 12, 0);
        const expectedYearPillar = GanjiCycle.fromSexagenaryIndex(expectedSexagenaryIndex(year));
        expect(result.pillars.year.cheongan).toBe(expectedYearPillar.cheongan);
        expect(result.pillars.year.jiji).toBe(expectedYearPillar.jiji);

        // The month stem must be derivable from the year stem via oho-won
        const monthBranchActual = result.pillars.month.jiji;
        const monthStemActual = result.pillars.month.cheongan;
        const yearPillar = result.pillars.year;

        const startStem = ohoWonStartStem(yearPillar.cheongan);
        const monthIdxMap: Record<string, number> = {
          [Jiji.IN]: 1, [Jiji.MYO]: 2, [Jiji.JIN]: 3, [Jiji.SA]: 4,
          [Jiji.O]: 5, [Jiji.MI]: 6, [Jiji.SIN]: 7, [Jiji.YU]: 8,
          [Jiji.SUL]: 9, [Jiji.HAE]: 10, [Jiji.JA]: 11, [Jiji.CHUK]: 12,
        };
        const monthIdx = monthIdxMap[monthBranchActual]!;
        const expMonthStem = CHEONGAN_VALUES[(cheonganOrdinal(startStem) + (monthIdx - 1)) % 10]!;

        expect(monthStemActual).toBe(expMonthStem);
      }
    });
  });
});
