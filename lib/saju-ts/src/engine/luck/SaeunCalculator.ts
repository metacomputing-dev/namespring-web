import { JeolBoundaryTable } from '../../calendar/solar/JeolBoundaryTable.js';
import type { JeolBoundaryMoment, SaeunPillar, WolunPillar } from '../../domain/SaeunInfo.js';
import { GanjiCycle } from '../GanjiCycle.js';

export const SaeunCalculator = {
    calculate(startYear: number, count: number = 10): SaeunPillar[] {
    return Array.from({ length: count }, (_, offset) => {
      const year = startYear + offset;
      return {
        year,
        pillar: GanjiCycle.yearPillarApprox(year),
      };
    });
  },

    forYear(year: number): SaeunPillar {
    return {
      year,
      pillar: GanjiCycle.yearPillarApprox(year),
    };
  },

    monthlyLuck(year: number): WolunPillar[] {
    const yearPillar = GanjiCycle.yearPillarApprox(year);
    const boundaries = JeolBoundaryTable.boundariesForYear(year);

    return Array.from({ length: 12 }, (_, i) => {
      const sajuMonthIndex = i + 1;
      const boundary = boundaries?.get(sajuMonthIndex);
      const boundaryMoment: JeolBoundaryMoment | undefined = boundary
        ? {
            year: boundary.year,
            month: boundary.month,
            day: boundary.day,
            hour: boundary.hour,
            minute: boundary.minute,
          }
        : undefined;

      return {
        year,
        sajuMonthIndex,
        pillar: GanjiCycle.monthPillarBySajuMonthIndex(yearPillar.cheongan, sajuMonthIndex),
        boundaryMoment,
      };
    });
  },
} as const;

