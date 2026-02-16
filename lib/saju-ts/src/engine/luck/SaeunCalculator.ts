import { JeolBoundaryTable } from '../../calendar/solar/JeolBoundaryTable.js';
import type { JeolBoundaryMoment, SaeunPillar, WolunPillar } from '../../domain/SaeunInfo.js';
import { GanjiCycle } from '../GanjiCycle.js';

type BoundaryMomentSource = JeolBoundaryMoment | undefined;

function toSaeunPillar(year: number): SaeunPillar {
  return { year, pillar: GanjiCycle.yearPillarApprox(year) };
}

function toBoundaryMoment(boundary: BoundaryMomentSource): JeolBoundaryMoment | undefined {
  if (boundary == null) return undefined;
  const { year, month, day, hour, minute } = boundary;
  return { year, month, day, hour, minute };
}

export const SaeunCalculator = {
  calculate(startYear: number, count: number = 10): SaeunPillar[] {
    return Array.from({ length: count }, (_, offset) => toSaeunPillar(startYear + offset));
  },

  forYear(year: number): SaeunPillar {
    return toSaeunPillar(year);
  },

  sajuMonthIndexAt(
    year: number,
    month: number,
    day: number,
    hour: number = 0,
    minute: number = 0,
  ): number {
    return JeolBoundaryTable.previousBoundaryAtOrBefore(year, month, day, hour, minute)?.sajuMonthIndex
      ?? GanjiCycle.sajuMonthIndexByJeolApprox(year, month, day);
  },

  monthlyLuck(year: number): WolunPillar[] {
    const yearPillar = GanjiCycle.yearPillarApprox(year);
    const boundaries = JeolBoundaryTable.boundariesForYear(year);

    return Array.from({ length: 12 }, (_, i) => {
      const sajuMonthIndex = i + 1;
      return {
        year,
        sajuMonthIndex,
        pillar: GanjiCycle.monthPillarBySajuMonthIndex(yearPillar.cheongan, sajuMonthIndex),
        boundaryMoment: toBoundaryMoment(boundaries?.get(sajuMonthIndex)),
      };
    });
  },
} as const;
